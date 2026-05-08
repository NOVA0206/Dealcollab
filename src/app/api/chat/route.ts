import { auth } from '@/auth';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { processIntelligence } from '@/lib/intelligenceEngine';
import { normalizeMessage } from '@/lib/normalizeMessage';
import {
  buildSystemPrompt,
  createBlankState,
  detectDealSizeFromText,
  detectFrictionSignal,
  detectIntentFromText,
  detectIntermediaryFromText,
  detectRevenueFromText,
  detectSectorFromText,
  detectShellCompanyFromText,
  detectStructureFromText,
  updateStateFromExtraction,
  type DealIntent,
  type RouterState
} from '@/lib/promptRouter';
import { buildFinalMessage } from '@/lib/responseBuilder';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DealCollab Chat Route
 * =====================
 * ADDITIONS from bot_response_2.docx analysis:
 *
 * FIX A — Intermediary pre-detected every turn (retained + expanded)
 *   detectIntermediaryFromText() now catches: "one of client", "investment
 *   banker", "for my client", "i am promoter" (without "the"), "my business".
 *   Runs before prompt build so # INTERMEDIARY_ROLE is always accurate.
 *
 * FIX B — NGO sector routed correctly
 *   detectSectorFromText() now has 'ngo' keywords (section 8, trust, 80g,
 *   12a, fcra). "section 8 company" now routes to M4_NGO, not 'mixed'.
 *
 * FIX C — Shell company pre-detected server-side
 *   detectShellCompanyFromText() runs on every message. When 2+ shell
 *   signals present (ROC, authorised capital, GST surrendered, C/F loss,
 *   zero litigation), sets sub_sector = 'shell_company' in candidateState.
 *   buildSystemPrompt() then loads M4_SHELL instead of the sector M4.
 *
 * FIX D — Compact format server-side computed
 *   computeMissingM3Fields() runs in promptRouter.buildSystemPrompt().
 *   No route.ts logic needed — the injection is automatic.
 *
 * FIX E — Revenue mandatory server-side signal
 *   # REVENUE_REQUIRED injected by promptRouter.buildSystemPrompt() when
 *   intent=SELL_SIDE and revenue=null. No route.ts logic needed.
 */

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    const { data: dbUser, error: fetchErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    if (fetchErr || !dbUser) {
      console.warn("User not found in DB:", session.user.email);
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
  if (!process.env.GROQ_API_KEY) {
    console.error("❌ CRITICAL: Missing GROQ_API_KEY");
    throw new Error("GROQ_API_KEY not found in runtime");
  }
  console.log("KEY EXISTS:", !!process.env.GROQ_API_KEY);

  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const rawMessage = body.message || "";
    const message = normalizeMessage(rawMessage);

    let documentText = body.document || body.documentText || "";
    const documentUrl = body.documentUrl || "";
    const documentId = body.documentId;
    let activeChatId = body.chatId;

    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // ─── USER RESOLUTION ─────────────────────────────────────
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    let userId = sbUser?.id || session.user.id;

    const { data: dbUser, error: userCheckErr } = await supabase
      .from("users").select("id").eq("id", userId).single();

    if (userCheckErr || !dbUser) {
      const { data: userByEmail } = await supabase
        .from("users").select("id").eq("email", session.user.email).single();
      if (userByEmail) {
        userId = userByEmail.id;
      } else {
        const { data: newUser } = await supabase
          .from("users")
          .upsert({ email: session.user.email, name: session.user.name || session.user.email?.split('@')[0] },
            { onConflict: 'email' })
          .select('id').single();
        if (newUser) userId = newUser.id;
        else throw new Error("Could not resolve valid user_id");
      }
    }

    // ─── STATE LOADING ────────────────────────────────────────
    let storedState: RouterState = createBlankState();

    if (!activeChatId && (documentId || body.documentId)) {
      const docIdToSearch = documentId || body.documentId;
      const { data: seededSession } = await supabase
        .from("chat_sessions").select("id, state")
        .eq("document_id", docIdToSearch).eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (seededSession) {
        activeChatId = seededSession.id;
        storedState = { ...createBlankState(), ...(seededSession.state as unknown as Partial<RouterState> || {}) };
      }
    }

    if (activeChatId) {
      const { data: existingSession } = await supabase
        .from("chat_sessions").select("id, document_id, state").eq("id", activeChatId).single();
      if (!existingSession) {
        activeChatId = null;
      } else {
        storedState = { ...createBlankState(), ...(existingSession.state as unknown as Partial<RouterState> || {}) };
        console.log(`[STATE] Phase: ${storedState.phase} | turn: ${storedState.turn_count} | intermediary: ${storedState.is_intermediary} | sub_sector: ${storedState.sub_sector}`);
      }
    }

    if (!activeChatId) {
      const { data: newSession, error: sessionErr } = await supabase
        .from("chat_sessions")
        .insert([{
          user_id: userId, document_id: documentId || null,
          title: message.slice(0, 30) + (message.length > 30 ? "..." : ""), state: storedState
        }])
        .select().single();
      if (sessionErr) throw new Error(sessionErr.message);
      activeChatId = newSession.id;
    }

    // ─── DOCUMENT RESTORATION ─────────────────────────────────
    if (!documentText && activeChatId) {
      const { data: sessionDoc } = await supabase
        .from('chat_sessions').select('document_id').eq('id', activeChatId).maybeSingle();
      const docId = documentId || sessionDoc?.document_id;
      if (docId) {
        const { data: doc } = await supabase
          .from('documents').select('extracted_text').eq('id', docId).maybeSingle();
        if (doc?.extracted_text) {
          documentText = doc.extracted_text;
          console.log(`[PERSISTENCE] Restored document context (${documentText.length} chars)`);
        }
      }
    }

    // ─── FRICTION HARD OVERRIDE (before prompt build) ─────────
    const hasFriction = detectFrictionSignal(message);
    if (hasFriction) {
      console.log('[ROUTE] Friction detected — patching to CLOSURE before prompt build.');
      storedState = { ...storedState, is_complete: true, phase: 'CLOSURE' };
    }

    // ─── PERSIST USER MESSAGE ─────────────────────────────────
    await supabase.from("chat_messages").insert([{ chat_id: activeChatId, role: 'user', content: message }]);

    // ─── FETCH HISTORY ────────────────────────────────────────
    const { data: history } = await supabase
      .from("chat_messages").select("*").eq("chat_id", activeChatId)
      .order("created_at", { ascending: true });

    const formattedHistory = (history || []).map(h => {
      let content = h.content;
      if (h.role === 'assistant') {
        try { const parsed = JSON.parse(h.content); content = parsed.message || h.content; } catch { }
      }
      return { role: h.role as "user" | "assistant" | "system", content };
    });

    // ─── MATCHMAKING ─────────────────────────────────────────
    const { mandates } = await import('@/db/schema');
    const { and, eq: drizzleEq, not, arrayOverlaps } = await import('drizzle-orm');
    let matchedMandatesStr: string | null = null;

    if (storedState.sector || storedState.intent) {
      try {
        const targetIntent = storedState.intent === 'SELL_SIDE' ? 'BUY_SIDE' :
          storedState.intent === 'BUY_SIDE' ? 'SELL_SIDE' : null;

        const results = await db.query.mandates.findMany({
          where: and(
            drizzleEq(mandates.status, 'ACTIVE'),
            not(drizzleEq(mandates.userId, userId)),
            targetIntent ? drizzleEq(mandates.intent, targetIntent) : undefined,
            storedState.sector ? arrayOverlaps(mandates.sectors, [storedState.sector]) : undefined,
          ),
          limit: 3,
        });

        if (results && results.length > 0) {
          matchedMandatesStr = results.map((r, i) => {
            const sizeStr = r.dealSizeMinCr && r.dealSizeMaxCr
              ? `₹${r.dealSizeMinCr}–${r.dealSizeMaxCr} Cr` : 'Size undisclosed';
            return `Match ${i + 1}: ${r.intent} · ${r.sectors?.join(', ')} · ${r.geographies?.join(', ')} · ${sizeStr}`;
          }).join('\n');
          console.log(`[MATCHMAKING] Found ${results.length} match(es).`);
        }
      } catch (matchErr) { console.error("❌ MATCHMAKING FAILED:", matchErr); }
    }

    // ─── PRE-DETECTION ────────────────────────────────────────
    const candidateState: RouterState = { ...storedState };

    if (!candidateState.intent) {
      const detectedIntent = detectIntentFromText(message);
      if (detectedIntent) { candidateState.intent = detectedIntent; console.log(`[PRE-DETECT] Intent: ${detectedIntent}`); }
    }

    if (!candidateState.sector) {
      const detectedSector = detectSectorFromText(message);
      if (detectedSector) { candidateState.sector = detectedSector; console.log(`[PRE-DETECT] Sector: ${detectedSector}`); }
    }

    // FIX A: Intermediary — runs every turn
    if (candidateState.is_intermediary === null) {
      const detectedRole = detectIntermediaryFromText(message);
      if (detectedRole) { candidateState.is_intermediary = detectedRole; console.log(`[PRE-DETECT] Intermediary: ${detectedRole}`); }
    }

    // FIX C: Shell company — runs every turn, sets sub_sector
    if (candidateState.sub_sector === null && detectShellCompanyFromText(message)) {
      candidateState.sub_sector = 'shell_company';
      console.log('[PRE-DETECT] Shell company — sub_sector=shell_company');
    }

    // FIX 7: Structure, size, revenue pre-detected from rich messages
    if (!candidateState.structure) {
      const s = detectStructureFromText(message);
      if (s) { candidateState.structure = s; console.log(`[PRE-DETECT] Structure: ${s}`); }
    }
    if (!candidateState.deal_size) {
      const ds = detectDealSizeFromText(message);
      if (ds) { candidateState.deal_size = ds; console.log(`[PRE-DETECT] Deal size: ${ds}`); }
    }
    if (!candidateState.revenue) {
      const rv = detectRevenueFromText(message);
      if (rv) { candidateState.revenue = rv; console.log(`[PRE-DETECT] Revenue: ${rv}`); }
    }

    // ─── BUILD SYSTEM PROMPT ──────────────────────────────────
    const { systemPrompt, modulesLoaded, tokenEstimate } = buildSystemPrompt(candidateState, matchedMandatesStr);
    console.log(`[ROUTER] Modules: ${modulesLoaded.join(', ')} | ~${tokenEstimate} tokens`);

    // ─── AI PROCESSING ────────────────────────────────────────
    const extraction = await processIntelligence(message, formattedHistory, documentText, systemPrompt);
    const aiContent = JSON.stringify(extraction);
    console.log("🧠 FINAL DATA:", aiContent);

    // ─── STATE UPDATE ─────────────────────────────────────────
    const updatedState = updateStateFromExtraction(
      storedState,
      extraction as unknown as { intent: DealIntent; state: Partial<RouterState>; is_complete: boolean },
      message,
      modulesLoaded,
    );

    // Persist pre-detected values the LLM may not have re-extracted
    if (updatedState.is_intermediary === null && candidateState.is_intermediary !== null) {
      updatedState.is_intermediary = candidateState.is_intermediary;
    }
    if (!updatedState.sub_sector && candidateState.sub_sector) {
      updatedState.sub_sector = candidateState.sub_sector;
    }
    if (!updatedState.structure && candidateState.structure) updatedState.structure = candidateState.structure;
    if (!updatedState.deal_size && candidateState.deal_size) updatedState.deal_size = candidateState.deal_size;
    if (!updatedState.revenue && candidateState.revenue) updatedState.revenue = candidateState.revenue;

    // Friction hard override (layer 2)
    if (hasFriction) {
      updatedState.is_complete = true;
      updatedState.phase = 'CLOSURE';
      extraction.is_complete = true;
      console.log('[ROUTE] Friction override applied.');
    }

    // 4-turn server-side auto-close
    if (updatedState.turn_count >= 4 && (updatedState.intent || updatedState.sector) && !updatedState.is_complete) {
      updatedState.is_complete = true;
      updatedState.phase = 'CLOSURE';
      extraction.is_complete = true;
      console.log(`[ROUTE] 4-turn auto-close at turn ${updatedState.turn_count}`);
    }

    // Phase lock: stay in MOMENTUM unless complete
    if (storedState.phase === 'MOMENTUM' && updatedState.phase !== 'CLOSURE' && !updatedState.is_complete) {
      updatedState.phase = 'MOMENTUM';
      updatedState.is_sufficient = true;
    }

    // ─── PERSIST ─────────────────────────────────────────────
    await supabase.from("chat_messages").insert([{ chat_id: activeChatId, role: 'assistant', content: JSON.stringify(extraction) }]);
    await supabase.from('chat_sessions').update({ state: updatedState }).eq('id', activeChatId);

    // ─── DEAL PERSISTENCE ─────────────────────────────────────
    const s = extraction.state;
    const isComplete = updatedState.is_complete;
    console.log("🧠 FINAL DATA:", JSON.stringify(extraction));

    if (isComplete) {
      console.log("✅ DATA COMPLETE - INSERTING INTO DB");
      try {
        const parseRange = (val: string | null) => {
          if (!val) return { min: null, max: null };
          const matches = val.match(/(\d+)/g);
          if (matches && matches.length >= 2) return { min: matches[0], max: matches[1] };
          if (matches && matches.length === 1) return { min: matches[0], max: matches[0] };
          return { min: null, max: null };
        };
        const size = parseRange(s.deal_size);
        const revenue = parseRange(s.revenue);

        const { error: mandateErr } = await supabase.from("mandates").insert([{
          user_id: userId, raw_text: message, normalised_text: JSON.stringify(extraction),
          intent: extraction.intent,
          sectors: s.sector ? [s.sector] : [],
          geographies: s.geography ? [s.geography] : [],
          deal_size_min_cr: size.min, deal_size_max_cr: size.max,
          revenue_min_cr: revenue.min, revenue_max_cr: revenue.max,
          deal_structure: s.structure,
          special_conditions: s.industry_data ? [JSON.stringify(s.industry_data)] : [],
          urgency: "Medium", buyer_type: s.intent_focus || "Strategic",
          status: 'ACTIVE', source: 'WEB', document_url: documentUrl, document_text: documentText,
        }]);
        if (mandateErr) throw new Error(mandateErr.message);

        const { error: dealErr } = await supabase.from("deals").insert([{
          user_id: userId, title: `${extraction.intent}: ${s.sector} deal`,
          sector: s.sector, region: s.geography, size: s.deal_size || "Undisclosed", status: 'live',
        }]);
        if (dealErr) throw new Error(dealErr.message);
        console.log("✅ DB INSERT SUCCESSFUL");
      } catch (dbErr) { console.error("❌ DB INSERT FAILED:", dbErr); }
    } else {
      console.log("⏳ DATA INCOMPLETE - WAITING FOR MORE DETAILS");
    }

    const finalMessage = buildFinalMessage(extraction);
    console.log(`[DEBUG] ${storedState.phase}→${updatedState.phase} | intermediary:${updatedState.is_intermediary} | sub_sector:${updatedState.sub_sector} | revenue:${updatedState.revenue} | friction:${hasFriction}`);

    return Response.json({
      success: true, data: aiContent, message: finalMessage,
      is_complete: isComplete, chatId: activeChatId,
      type: isComplete ? 'complete' : 'conversation',
    });

  } catch (error: unknown) {
    console.error("❌ CHAT ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return Response.json({ success: false, error: errorMessage, stack: errorStack }, { status: 500 });
  }
}