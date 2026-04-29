import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';

/**
 * 🎯 HARDENED PRODUCTION CHAT SYSTEM (v4.0)
 * Resolves: Model decommissioning, Vercel build conflicts, silent failures.
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const MODEL = "llama-3.1-8b-instant"; // Primary model
const FALLBACK_MODEL = "mixtral-8x7b-32768"; // Fallback model
const SYSTEM_PROMPT = `
You are DealCollab AI — a high-intelligence Deal Advisor. You behave like a proactive M&A partner, not a passive respondent.

### 🎭 PERSONALITY & TONE
- **Proactive & Guiding**: ALWAYS drive the conversation forward. Never give a dead-end response. Every message must end with a question or a clear next step.
- **Human-Centric**: Acknowledge compliments or casual chat naturally, but always pivot back to helping them with their deal flow.
- **Expertise**: Be professional, smart, and assertive in your guidance.

### 🎯 INTERACTION RULES
1. **GREETINGS (Hi, Hello)**: Greet them warmly and immediately ask a deal-related hook.
   - Example: "Hello! I'm your Deal Advisor. Are you exploring any specific sectors for your next move, or should we look at what's trending?"
2. **NO DEAD-ENDS**: If you've acknowledged a point, immediately ask about a missing parameter (Intent, Sector, Geography, or Size).
3. **SMART FOLLOW-UPS**: If a user is vague, give them 2 options to choose from to keep the momentum.
4. **NO REPETITION**: If you've asked about intent once and they haven't answered, try asking about their sector instead.

### ⚙️ EXTRACTION SCHEMA (CRITICAL)
You MUST return JSON in every response. This data is used for matching.
{
  "data": {
    "intent": "BUY_SIDE" | "SELL_SIDE" | "INVESTMENT" | null,
    "sectors": string[],
    "geographies": string[],
    "deal_size_min_cr": number | null,
    "deal_size_max_cr": number | null,
    "deal_structure": string | null,
    "revenue_min_cr": number | null,
    "revenue_max_cr": number | null,
    "special_conditions": string[]
  },
  "is_complete": boolean,
  "message": "Your proactive, intelligent, 1-2 line conversational response here. MUST end with a question."
}

### 🏁 COMPLETION
When Intent, Sector, Geography, and Size are collected, set is_complete: true and use this message:
"Perfect — got everything I need. I’ll record this and start matching you with relevant opportunities."
`;


export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    // Fetch DB ID by email (mismatch fix)
    const { data: dbUser, error: fetchErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    if (fetchErr || !dbUser) {
      console.warn("User not found in DB for history fetch:", session.user.email);
      return NextResponse.json([]);
    }

    const history = await db.query.chatSessions.findMany({
      where: eq(chatSessions.userId, dbUser.id),
      orderBy: [desc(chatSessions.createdAt)],
    });

    return NextResponse.json(history);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("🔥 HISTORY FETCH ERROR:", err);
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 1. HARD ENVIRONMENT VALIDATION
  if (!process.env.GROQ_API_KEY) {
    console.error("❌ CRITICAL: Missing GROQ_API_KEY");
    throw new Error("GROQ_API_KEY not found in runtime");
  }
  const apiKey = process.env.GROQ_API_KEY;
  console.log("PRIMARY MODEL:", MODEL);
  console.log("FALLBACK MODEL:", FALLBACK_MODEL);
  console.log("KEY EXISTS:", !!apiKey);

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, chatId, documentText } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // 2. SESSION & MESSAGE PERSISTENCE
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    // ENSURE USER EXISTS & GET DB ID (Production Fix for mismatched IDs)
    const userEmail = session.user.email?.trim().toLowerCase();
    if (!userEmail) throw new Error("User email missing from session");

    const { data: dbUser, error: upsertError } = await supabase
      .from("users")
      .upsert({ 
        email: userEmail,
        name: session.user.name || userEmail.split('@')[0]
      }, { onConflict: 'email' })
      .select('id')
      .single();
      
    if (upsertError || !dbUser) {
      console.error("User sync failed:", upsertError);
      throw new Error("Failed to sync user identity: " + (upsertError?.message || "User not found"));
    }

    const userId = dbUser.id;
    console.log("Database User ID:", userId);

    let activeChatId = chatId;
    if (!activeChatId) {
      const { data: newSession, error: sessionErr } = await supabase
        .from("chat_sessions")
        .insert([{
          user_id: userId,
          title: message.slice(0, 30) + (message.length > 30 ? "..." : "")
        }])
        .select()
        .single();
        
      if (sessionErr) {
        console.error("Supabase error:", sessionErr);
        throw new Error(sessionErr.message);
      }
      activeChatId = newSession.id;
    }

    const { error: msgErr } = await supabase
      .from("chat_messages")
      .insert([{
        chat_id: activeChatId,
        role: 'user',
        content: message,
      }]);
      
    if (msgErr) {
      console.error("Supabase error:", msgErr);
      throw new Error(msgErr.message);
    }

    // 3. FETCH FULL HISTORY (Use Supabase for consistency with the insert above)
    const { data: history, error: historyErr } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", activeChatId)
      .order("created_at", { ascending: true });

    if (historyErr || !history) {
      console.error("Supabase history error:", historyErr);
      throw new Error(historyErr?.message || "Failed to fetch history");
    }

    const formattedHistory = history.map(h => {
      let content = h.content;
      if (h.role === 'assistant') {
        try {
          const parsed = JSON.parse(h.content);
          content = parsed.message || h.content;
        } catch {
          // Fallback if not JSON
        }
      }
      return {
        role: h.role as "user" | "assistant" | "system",
        content: content
      };
    });

    // --- MEMORY LOGIC: Reconstruct State from History ---
    let conversationData = {
      intent: null,
      sectors: [],
      geographies: [],
      deal_size_min_cr: null,
      deal_size_max_cr: null,
      deal_structure: null,
      special_conditions: []
    };

    // Scan backwards for the latest state
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'assistant') {
        try {
          const parsed = JSON.parse(history[i].content);
          if (parsed.data) {
            conversationData = { ...conversationData, ...parsed.data };
            break; // Found latest state
          }
        } catch { continue; }
      }
    }
    console.log("🧠 CURRENT STATE:", JSON.stringify(conversationData));

    // 4. GROQ CLIENT INITIALIZATION (INSIDE HANDLER ONLY)
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    // 5. AI CALL WITH RETRY LOGIC
    let aiContent = "";
    let attempts = 0;
    const maxAttempts = 2;

    // Build context-aware prompt
    let contextPrompt = SYSTEM_PROMPT;
    if (documentText) {
      // Chunking: keep only first 15k characters to stay within context limits for now
      const truncatedDoc = documentText.slice(0, 15000);
      contextPrompt = `You are a deal intelligence assistant.
Use the following document to answer the user query. Prioritize document content over generic knowledge.

DOCUMENT:
${truncatedDoc}

---
${SYSTEM_PROMPT}`;
    }

    const aiMessages = [
      { role: "system", content: contextPrompt + `\n\nCURRENT_STATE_OF_EXTRACTION: ${JSON.stringify(conversationData)}` },
      ...formattedHistory
    ];

    console.log("MESSAGES SENT TO AI:", JSON.stringify(aiMessages, null, 2));

    while (attempts < maxAttempts) {
      const currentModel = attempts === 0 ? MODEL : FALLBACK_MODEL;
      try {
        console.log(`Using model: ${currentModel} (Attempt ${attempts + 1})`);
        const aiResponse = await groq.chat.completions.create({
          model: currentModel,
          messages: aiMessages as Groq.Chat.ChatCompletionMessageParam[],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        console.log("RAW RESPONSE:", JSON.stringify(aiResponse));
        aiContent = aiResponse?.choices?.[0]?.message?.content || "";

        if (!aiContent) {
          throw new Error("Empty response from Groq");
        }
        break; // Success
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;
        console.warn(`AI: Switching to fallback after error with ${currentModel}:`, (err as Error).message);
        await new Promise(resolve => setTimeout(resolve, 500)); // Short backoff
      }
    }

    // 5. PARSE & VALIDATE
    let extraction;
    try {
      extraction = JSON.parse(aiContent);
    } catch {
      console.error("JSON PARSE ERROR:", aiContent);
      throw new Error("Invalid AI response format");
    }

    // 6. PERSIST ASSISTANT RESPONSE (FULL JSON FOR MEMORY)
    const { error: assistantMsgErr } = await supabase
      .from("chat_messages")
      .insert([{
        chat_id: activeChatId,
        role: 'assistant',
        content: JSON.stringify(extraction),
      }]);
      
    if (assistantMsgErr) {
      console.error("Supabase error:", assistantMsgErr);
      throw new Error(assistantMsgErr.message);
    }

    // 7. DEAL EXTRACTION LOGIC & PERSISTENCE
    const d = extraction.data;
    const isComplete = 
      d.intent && 
      d.sectors?.length > 0 && 
      d.geographies?.length > 0 && 
      d.deal_size_min_cr !== null && 
      d.deal_size_max_cr !== null && 
      d.deal_structure;

    console.log("🧠 FINAL DATA:", JSON.stringify(d));

    if (isComplete) {
      console.log("✅ DATA COMPLETE - INSERTING INTO DB");
      try {
        // Step 3: Insert into Mandates
        const { error: mandateErr } = await supabase
          .from("mandates")
          .insert([{
            user_id: userId,
            raw_text: message,
            normalised_text: JSON.stringify(d),
            intent: d.intent,
            sectors: d.sectors,
            geographies: d.geographies,
            deal_size_min_cr: d.deal_size_min_cr?.toString(),
            deal_size_max_cr: d.deal_size_max_cr?.toString(),
            revenue_min_cr: d.revenue_min_cr?.toString(),
            revenue_max_cr: d.revenue_max_cr?.toString(),
            deal_structure: d.deal_structure,
            special_conditions: d.special_conditions || [],
            urgency: d.inferred_urgency || "Medium",
            buyer_type: d.inferred_buyer_type || "Strategic",
            status: 'ACTIVE',
            source: 'WEB',
          }]);

        if (mandateErr) {
          console.error("Supabase error:", mandateErr);
          throw new Error(mandateErr.message);
        }

        // Step 4: Insert into Deals
        const { error: dealErr } = await supabase
          .from("deals")
          .insert([{
            user_id: userId,
            title: `${d.intent}: ${d.sectors.join(", ")} deal`,
            sector: d.sectors.join(", "),
            region: d.geographies.join(", "),
            size: `${d.deal_size_min_cr}-${d.deal_size_max_cr} Cr`,
            status: 'live',
          }]);

        if (dealErr) {
          console.error("Supabase error:", dealErr);
          throw new Error(dealErr.message);
        }

        console.log("✅ DB INSERT SUCCESSFUL");
      } catch (dbErr) {
        console.error("❌ DB INSERT FAILED:", dbErr);
      }
    } else {
      console.log("⏳ DATA INCOMPLETE - WAITING FOR MORE DETAILS");
    }

    const finalMessage = isComplete 
      ? "Perfect — got everything I need. I’ll record this and start matching you with relevant opportunities."
      : extraction.message;

    return Response.json({
      success: true,
      data: aiContent,
      message: finalMessage,
      is_complete: isComplete,
      chatId: activeChatId
    });

  } catch (error: unknown) {
    console.error("FULL ERROR:", error);
    console.error("STRINGIFIED:", JSON.stringify(error, null, 2));
    
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));

    return Response.json({
      success: false,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}