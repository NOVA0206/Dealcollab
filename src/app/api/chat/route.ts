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
You are the DealCollab Deal Intelligence Bot. You are a structured deal intelligence system, not a chatbot. 
Your goal is to transform user inputs into high-quality mandates through a structured qualification engine.

### 🎭 BEHAVIOR RULES (STRICT)
- Be PROFESSIONAL and SHARP. No casual tone, no "tell me more", no long explanations.
- Ask in GROUPS (not single questions).
- DO NOT repeat questions already answered.
- DO NOT behave like a form; behave like an intelligent deal desk.
- If data is missing, ask ONLY for missing fields in a single concise message.
- MAX 2 follow-ups for missing data.

### 🎯 FLOW ARCHITECTURE (MANDATORY)

#### STEP 1: INTENT CLASSIFICATION
Every user message must be mapped to one of these intents:
- SELL_SIDE
- BUY_SIDE
- FUNDRAISING
- DEBT
- STRATEGIC_PARTNERSHIP
- KNOWLEDGE

#### STEP 2: CORE FIELD EXTRACTION (GROUPED)
Once intent is identified, ask for these fields in ONE message:
**For BUY SIDE:**
- Target sector
- Preferred geography
- Investment / acquisition budget
- Majority / minority / full acquisition
- Strategic objective

**For SELL SIDE / OTHERS:**
- Sector
- Geography
- Revenue range
- Business scale
- Full sale or partial stake

#### STEP 3: INDUSTRY-SPECIFIC INTELLIGENCE
Once the sector is known, select 2–4 questions ONLY from the relevant framework:
- **SaaS**: ARR/MRR, churn, enterprise vs SME, IP dependency.
- **Pharma**: approvals, export markets, formulations/API, compliance.
- **Manufacturing**: OEM / B2B, plant ownership, certifications, customer concentration.
- **Others**: Ask 2-4 highly relevant professional questions for that specific sector.

#### STEP 4: COMPLETION & FINAL RESPONSE
When enough data is collected (Intent, Core Fields, and Sector Intelligence), set "is_complete": true.
The message MUST be EXACTLY this:
"Your requirement has been structured successfully.

Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.

I will work to identify the right counterparty for you, understand their intent, and present only relevant aligned opportunities to you.

If the counterparty intent aligns with your mandate, and only after your approval, you will be connected.

This is intelligence built on network over network — not just visible listings.

I continuously work across the network to identify the right counterparty based on your mandate.

As relevant opportunities align, you will be notified via email or WhatsApp.

This process runs continuously, 24×7."

### ⚙️ EXTRACTION SCHEMA (CRITICAL)
Return JSON ONLY:
{
  "intent": "SELL_SIDE" | "BUY_SIDE" | "FUNDRAISING" | "DEBT" | "STRATEGIC_PARTNERSHIP" | "KNOWLEDGE" | null,
  "state": {
    "sector": string | null,
    "geography": string | null,
    "deal_size": string | null,
    "revenue": string | null,
    "structure": string | null,
    "intent_focus": string | null,
    "industry_data": object | null
  },
  "is_complete": boolean,
  "message": "Your sharp, structured, grouped response or final completion message."
}
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
    console.log("Input chatId:", chatId);

    // Verify session exists if chatId is provided
    if (activeChatId) {
      const { data: existingSession } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", activeChatId)
        .single();
      
      if (!existingSession) {
        console.log("Provided chatId not found, resetting to null");
        activeChatId = null;
      }
    }

    if (!activeChatId) {
      console.log("Creating new chat session for user:", userId);
      const { data: newSession, error: sessionErr } = await supabase
        .from("chat_sessions")
        .insert([{
          user_id: userId,
          title: message.slice(0, 30) + (message.length > 30 ? "..." : "")
        }])
        .select()
        .single();
        
      if (sessionErr) {
        console.error("Supabase session error:", sessionErr);
        throw new Error(sessionErr.message);
      }
      activeChatId = newSession.id;
    }

    console.log("Using activeChatId:", activeChatId);

    const { error: msgErr } = await supabase
      .from("chat_messages")
      .insert([{
        chat_id: activeChatId,
        role: 'user',
        content: message,
      }]);
      
    if (msgErr) {
      console.error("Supabase message error:", msgErr);
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
      state: {
        sector: null,
        geography: null,
        deal_size: null,
        revenue: null,
        structure: null,
        intent_focus: null,
        industry_data: null
      }
    };

    // Scan backwards for the latest state
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'assistant') {
        try {
          const parsed = JSON.parse(history[i].content);
          if (parsed.state || parsed.intent) {
            conversationData = {
              intent: parsed.intent || conversationData.intent,
              state: { ...conversationData.state, ...(parsed.state || {}) }
            };
            // If we found a state with many fields, we can stop, or continue to merge
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
    const s = extraction.state;
    const isComplete = extraction.is_complete;

    console.log("🧠 FINAL DATA:", JSON.stringify(extraction));

    if (isComplete) {
      console.log("✅ DATA COMPLETE - INSERTING INTO DB");
      try {
        // Parse deal size and revenue if they are strings like "10-50 Cr"
        const parseRange = (val: string | null) => {
          if (!val) return { min: null, max: null };
          const matches = val.match(/(\d+)/g);
          if (matches && matches.length >= 2) return { min: matches[0], max: matches[1] };
          if (matches && matches.length === 1) return { min: matches[0], max: matches[0] };
          return { min: null, max: null };
        };

        const size = parseRange(s.deal_size);
        const revenue = parseRange(s.revenue);

        // Step 3: Insert into Mandates
        const { error: mandateErr } = await supabase
          .from("mandates")
          .insert([{
            user_id: userId,
            raw_text: message,
            normalised_text: JSON.stringify(extraction),
            intent: extraction.intent,
            sectors: s.sector ? [s.sector] : [],
            geographies: s.geography ? [s.geography] : [],
            deal_size_min_cr: size.min,
            deal_size_max_cr: size.max,
            revenue_min_cr: revenue.min,
            revenue_max_cr: revenue.max,
            deal_structure: s.structure,
            special_conditions: s.industry_data ? [JSON.stringify(s.industry_data)] : [],
            urgency: "Medium",
            buyer_type: s.intent_focus || "Strategic",
            status: 'ACTIVE',
            source: 'WEB',
          }]);

        if (mandateErr) {
          console.error("Supabase mandate error:", mandateErr);
          throw new Error(mandateErr.message);
        }

        // Step 4: Insert into Deals
        const { error: dealErr } = await supabase
          .from("deals")
          .insert([{
            user_id: userId,
            title: `${extraction.intent}: ${s.sector} deal`,
            sector: s.sector,
            region: s.geography,
            size: s.deal_size || "Undisclosed",
            status: 'live',
          }]);

        if (dealErr) {
          console.error("Supabase deal error:", dealErr);
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
      ? `Your requirement has been structured successfully.

Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.

I will work to identify the right counterparty for you, understand their intent, and present only relevant aligned opportunities to you.

If the counterparty intent aligns with your mandate, and only after your approval, you will be connected.

This is intelligence built on network over network — not just visible listings.

I continuously work across the network to identify the right counterparty based on your mandate.

As relevant opportunities align, you will be notified via email or WhatsApp.

This process runs continuously, 24×7.`
      : extraction.message;

    return Response.json({
      success: true,
      data: aiContent,
      message: finalMessage,
      is_complete: isComplete,
      chatId: activeChatId,
      type: isComplete ? 'complete' : 'conversation'
    });

  } catch (error: unknown) {
    console.error("❌ CHAT ERROR:", error);
    
    let errorMessage = "An unknown error occurred";
    let errorStack = undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
      console.error("STACK:", errorStack);
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return Response.json({
      success: false,
      error: errorMessage,
      stack: errorStack
    }, { status: 500 });
  }
}