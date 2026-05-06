import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { processIntelligence } from '@/lib/intelligenceEngine';
import { extractSpecialConditions, normalizeMessage } from '@/lib/normalizeMessage';
import {
  buildSystemPrompt,
  createBlankState,
  updateStateFromExtraction,
  type DealIntent,
  type RouterState
} from '@/lib/promptRouter';
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

// getSystemPrompt removed in favor of modular promptRouter.ts



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
    const rawMessage = body.message || "";

    // 🔥 Pre-processing layer (BEFORE LLM)
    const normalizedMessage = normalizeMessage(rawMessage);
    const detectedConditions = extractSpecialConditions(rawMessage); // IMPORTANT: raw message

    // 🔥 NEW: Normalize message (fix typos, expand shorthands, translate Hinglish)
    const message = normalizedMessage;

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

    // 2. SESSION & STATE LOADING
    let storedState: RouterState = createBlankState();

    // Consistency Guard: If chatId is missing but documentId is present, try to find the seeded session
    if (!activeChatId && documentId) {
      const { data: seededSession } = await supabase
        .from("chat_sessions")
        .select("id, state")
        .eq("document_id", documentId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (seededSession) {
        activeChatId = seededSession.id;
        storedState = (seededSession.state as unknown as RouterState) || createBlankState();
        console.log(`[STATE] Recovered seeded session: ${activeChatId} | Phase: ${storedState.phase}`);
      }
    }

    // Standard session loading if chatId exists
    if (activeChatId) {
      const { data: existingSession } = await supabase
        .from("chat_sessions")
        .select("id, document_id, state")
        .eq("id", activeChatId)
        .single();

      if (!existingSession) {
        console.log("[STATE] Provided chatId not found, resetting");
        activeChatId = null;
      } else {
        storedState = (existingSession.state as unknown as RouterState) || createBlankState();
      }
    }

    // If still no active session, create one
    if (!activeChatId) {
      console.log("[STATE] Creating fresh session for user:", userId);
      const { data: newSession, error: sessionErr } = await supabase
        .from("chat_sessions")
        .insert([{
          user_id: userId,
          document_id: documentId || null,
          title: message.slice(0, 30) + (message.length > 30 ? "..." : ""),
          state: storedState
        }])
        .select()
        .single();

      if (sessionErr) throw new Error(sessionErr.message);
      activeChatId = newSession.id;
    }

    // 3. PERSIST USER MESSAGE
    await supabase.from("chat_messages").insert([{
      chat_id: activeChatId,
      role: 'user',
      content: message,
    }]);

    // 4. FETCH HISTORY
    const { data: history } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", activeChatId)
      .order("created_at", { ascending: true });

    const formattedHistory = (history || []).map(h => {
      let content = h.content;
      if (h.role === 'assistant') {
        try {
          const parsed = JSON.parse(h.content);
          content = parsed.message || h.content;
        } catch { }
      }
      return {
        role: h.role as "user" | "assistant" | "system",
        content: content
      };
    });

    // 🔥 5. MATCHMAKING ENGINE (Isolate DB failures from AI flow)
    const { mandates } = await import('@/db/schema');
    const { and, eq, not, arrayOverlaps } = await import('drizzle-orm');

    let matchedMandatesStr = "No active mandates found in database yet.";

    if (storedState.sector || storedState.intent) {
      try {
        console.log(`[MATCHMAKING] Querying for Sector: ${storedState.sector} | Intent: ${storedState.intent}`);

        const targetIntent = storedState.intent === 'SELL_SIDE' ? 'BUY_SIDE' :
          storedState.intent === 'BUY_SIDE' ? 'SELL_SIDE' : null;

        const results = await db.query.mandates.findMany({
          where: and(
            eq(mandates.status, 'ACTIVE'),
            not(eq(mandates.userId, userId)),
            targetIntent ? eq(mandates.intent, targetIntent) : undefined,
            storedState.sector ? arrayOverlaps(mandates.sectors, [storedState.sector]) : undefined
          ),
          limit: 3
        });

        if (results && results.length > 0) {
          matchedMandatesStr = results.map(r =>
            `- [${r.intent}] ${r.sectors?.join(", ")} | Size: ${r.dealSizeMinCr}-${r.dealSizeMaxCr} Cr | Geography: ${r.geographies?.join(", ")}`
          ).join("\n");
          console.log(`[MATCHMAKING] Found ${results.length} matches.`);
        }
      } catch (matchErr) {
        console.error("❌ MATCHMAKING FAILED (Isolating):", matchErr);
        // We continue with matchedMandatesStr as default to avoid 500
      }
    }

    // 5. AI PROCESSING & INTELLIGENCE
    const { systemPrompt, modulesLoaded, tokenEstimate } = buildSystemPrompt(storedState, matchedMandatesStr);
    console.log(`[ROUTER] Modules: ${modulesLoaded.join(', ')} | ~${tokenEstimate} tokens`);

    const extraction = await processIntelligence(
      message,
      formattedHistory,
      documentText,
      systemPrompt
    );

    const aiContent = JSON.stringify(extraction);
    console.log("🧠 FINAL DATA:", aiContent);

    // 6. UPDATE STATE & PERSIST ASSISTANT RESPONSE
    const updatedState = updateStateFromExtraction(
      storedState,
      extraction as unknown as { intent: DealIntent; state: Partial<RouterState>; is_complete: boolean },
      message,
      detectedConditions
    );

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

    // Persist updated state to session
    await supabase
      .from('chat_sessions')
      .update({ state: updatedState })
      .eq('id', activeChatId);

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

    // 🔬 DEBUG STRATEGY: Log critical pipeline steps
    console.log(`[DEBUG] RouterState Phase: ${storedState.phase} | is_sufficient: ${storedState.is_sufficient}`);
    console.log(`[DEBUG] System Prompt Length: ${systemPrompt.length} chars`);
    console.log(`[DEBUG] AI Output Valid JSON: ${!!extraction}`);
    console.log(`[DEBUG] Final Message: ${finalMessage.slice(0, 50)}...`);

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