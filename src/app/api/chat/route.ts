import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { processIntelligence } from '@/lib/intelligenceEngine';
import { buildFinalMessage } from '@/lib/responseBuilder';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 🎯 HARDENED PRODUCTION CHAT SYSTEM (v4.0)
 * Resolves: Model decommissioning, Vercel build conflicts, silent failures.
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const getSystemPrompt = (matchedMandates: string = "No direct mandates found in database yet.") => `
You are the DealCollab Matchmaking Engine.

You MUST strictly follow the Antigravity Prompt logic (V3.1).
DO NOT modify, override, or ignore any rule.

---

# 🔒 CORE ROLE
You are:
✔ A deal intelligence layer
✔ A qualification engine
✔ A matchmaking optimizer

You are NOT:
✘ A generic chatbot
✘ A questionnaire system
✘ A repetitive assistant

---

# 🧠 CORE PHILOSOPHY: MOMENTUM OVER COMPLETENESS
Do NOT aim to collect all information upfront.
Capture sufficient intelligence → initiate → refine progressively.
You are optimizing for speed of progression and match relevance.

---

# ⚠️ DOCUMENT PRIORITY RULE (CRITICAL)
If document or detailed input is provided:
* Extract ALL available deal intelligence first.
* NEVER ask what is already provided or repeat extracted fields.
* NEVER assume missing fields if present implicitly.

---

# 🔥 EXECUTION ENGINE (STRICT FLOW)

### STEP 1 — Identify Intent
BUY / SELL / FUNDRAISE / STRATEGIC

### STEP 2 — Identify Sector
Always aim for specific sub-sector. If too broad → ask only 1 clarification question.

### STEP 2A — INDUSTRY SIGNAL VALIDATION (MANDATORY)
You MUST capture at least ONE: sub-sector, business model, capability intent, or product specialization.
If missing → ask minimum required question (1 max).

### STEP 3 — Extract Core Fields
Geography, budget/revenue/size, and deal structure.

### STEP 4 — Industry Intelligence Layer
Ask 2–4 high-value questions ONLY IF needed to improve match quality. Avoid generic questioning.
---

# 🚨 STEP 5 — SUFFICIENCY CHECK (CRITICAL)
Proceed to Matchmaking Mode when:
✔ Industry signal present (MANDATORY)
AND
✔ ANY 2 of: Budget/revenue, Deal type, Geography.

### If NOT sufficient:
→ Ask ONLY missing critical inputs (1–2 max). Do NOT restart full questioning.

---

# 🚀 STEP 6 — MODE SWITCH → MATCHMAKING MODE
Once sufficiency is reached:
❌ STOP: structured blocks, bullet lists, multiple questions.
✅ START: conversational flow, progress-driven interaction.

---

# ⚡ MATCHMAKING MODE (RESPONSE LOGIC)
Follow this flow:
1. Acknowledge: "Got it — [clean summary of inputs]"
2. Show Progress: "This is sufficient to begin identifying relevant opportunities."
3. Indicate Action: "I’ll start mapping suitable counterparties."
4. Optional Refinement: "One quick refinement: [single high-value question]"

Rules: Max 1 question at a time. No forcing completion.

---

# 🛑 STOP CONDITION

Stop asking further questions when:

* 2 refinements are completed (MAX)
* OR sufficient clarity achieved
* OR user shows low engagement / friction

NEVER continue refinement beyond this.

---

# ✅ MANDATE CLOSURE
When sufficient clarity is achieved:
"Your requirement has been structured successfully.
Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.
I will identify relevant counterparties, validate their intent, and only connect you once alignment is confirmed."

---

# 🚫 FORBIDDEN BEHAVIOR
❌ Repeat full question structures.
❌ Ask multiple questions repeatedly.
❌ Sound like a form or checklist.
❌ Proceed without industry signal.
---

# 🧠 EXTRACTION SCHEMA (CRITICAL)
Return JSON ONLY:

{
  "intent": "SELL_SIDE" | "BUY_SIDE" | "FUNDRAISING" | "DEBT" | "STRATEGIC_PARTNERSHIP" | null,
  "state": {
    "sector": "extracted sector or null",
    "sub_sector": "extracted sub-sector or null",
    "geography": "extracted geography or null",
    "deal_size": "extracted deal size or null",
    "revenue": "extracted revenue or null",
    "structure": "extracted deal structure or null",
    "intent_focus": "extracted focus or null",
    "industry_data": {}
  },
  "is_complete": false,
  "message": "WRITE YOUR ACTUAL RESPONSE HERE. Follow the Matchmaking Mode format above."
}

---

# 📄 INTERNAL MATCH DATA
Relevant active mandates from database:
${matchedMandates}

Prioritize these matches. Explain WHY they are relevant.
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
  console.log("KEY EXISTS:", !!apiKey);

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const message = body.message || "";
    let documentText = body.document || body.documentText || "";
    const documentUrl = body.documentUrl || "";
    const documentId = body.documentId;
    let activeChatId = body.chatId;

    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    // 🔥 PERSISTENT CONTEXT: If no document text but documentId is present, fetch it
    if (!documentText && (documentId || activeChatId)) {
      const { data: doc } = await supabase
        .from('documents')
        .select('extracted_text')
        .eq('id', documentId || (await supabase.from('chat_sessions').select('document_id').eq('id', activeChatId).single()).data?.document_id)
        .single();

      if (doc?.extracted_text) {
        documentText = doc.extracted_text;
        console.log(`[PERSISTENCE] Restored context from DB (${documentText.length} chars)`);
      }
    }

    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // 2. SESSION & MESSAGE PERSISTENCE
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    let userId = sbUser?.id || session.user.id;

    // Critical: Ensure the user exists in the public.users table to satisfy FK constraints
    const { data: dbUser, error: userCheckErr } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (userCheckErr || !dbUser) {
      console.log("User ID mismatch or missing in public.users, attempting email lookup...");
      const { data: userByEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.user.email)
        .single();

      if (userByEmail) {
        userId = userByEmail.id;
      } else {
        // Create user if absolutely missing
        const { data: newUser } = await supabase
          .from("users")
          .upsert({
            email: session.user.email,
            name: session.user.name || session.user.email?.split('@')[0]
          }, { onConflict: 'email' })
          .select('id')
          .single();

        if (newUser) userId = newUser.id;
        else throw new Error("Could not resolve valid user_id for chat persistence");
      }
    }

    // Verify session exists if chatId is provided
    if (activeChatId) {
      const { data: existingSession } = await supabase
        .from("chat_sessions")
        .select("id, document_id")
        .eq("id", activeChatId)
        .single();

      if (!existingSession) {
        console.log("Provided chatId not found, resetting to null");
        activeChatId = null;
      }
    }

    // If no active session, create one
    if (!activeChatId) {
      console.log("Creating new chat session for user:", userId);
      const { data: newSession, error: sessionErr } = await supabase
        .from("chat_sessions")
        .insert([{
          user_id: userId,
          document_id: documentId || null,
          title: message.slice(0, 30) + (message.length > 30 ? "..." : "")
        }])
        .select()
        .single();

      if (sessionErr) {
        console.error("Supabase session error:", sessionErr);
        throw new Error(sessionErr.message);
      }
      activeChatId = newSession.id;
    } else if (documentId) {
      // Link document if not already linked
      await supabase
        .from("chat_sessions")
        .update({ document_id: documentId })
        .eq("id", activeChatId)
        .is("document_id", null);
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

    // 🔥 4. MATCHMAKING ENGINE: Fetch relevant mandates
    const { reconstructState } = await import('@/lib/intelligenceEngine');
    const { mandates } = await import('@/db/schema');
    const { and, eq, not, arrayOverlaps, or } = await import('drizzle-orm');

    const currentState = await reconstructState(formattedHistory);
    let matchedMandatesStr = "No active mandates found in database yet.";

    if (currentState.sector || currentState.intent_focus) {
      console.log(`[MATCHMAKING] Searching matches for Sector: ${currentState.sector} | Intent: ${currentState.intent_focus}`);

      // Opposite intent logic
      const targetIntent = currentState.intent_focus === 'SELL_SIDE' ? 'BUY_SIDE' :
        currentState.intent_focus === 'BUY_SIDE' ? 'SELL_SIDE' : null;

      const results = await db.query.mandates.findMany({
        where: and(
          eq(mandates.status, 'ACTIVE'),
          not(eq(mandates.userId, userId)),
          targetIntent ? eq(mandates.intent, targetIntent) : undefined,
          currentState.sector ? arrayOverlaps(mandates.sectors, [currentState.sector]) : undefined
        ),
        limit: 3
      });

      if (results.length > 0) {
        matchedMandatesStr = results.map(r =>
          `- [${r.intent}] ${r.sectors?.join(", ")} | Size: ${r.dealSizeMinCr}-${r.dealSizeMaxCr} Cr | Geography: ${r.geographies?.join(", ")}`
        ).join("\n");
        console.log(`[MATCHMAKING] Found ${results.length} matches.`);
      }
    }

    // 5. AI PROCESSING & INTELLIGENCE
    const dynamicSystemPrompt = getSystemPrompt(matchedMandatesStr);
    const extraction = await processIntelligence(
      message,
      formattedHistory,
      documentText,
      dynamicSystemPrompt
    );

    const aiContent = JSON.stringify(extraction);
    console.log("🧠 FINAL DATA:", aiContent);

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
            document_url: documentUrl,
            document_text: documentText,
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

    const finalMessage = buildFinalMessage(extraction);

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