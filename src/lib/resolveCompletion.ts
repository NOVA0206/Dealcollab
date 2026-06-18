/**
 * DealCollab — resolveCompletion()  [PHASE 1 — STEP 1: REPRODUCE]
 * ================================================================
 * PURPOSE
 *   Today, the decision "is this mandate done, and what happens next?" is made by
 *   ~6 mechanisms smeared across route.ts (the POST handler) and stateManager.ts,
 *   each able to flip is_complete on/off, running in a fixed order where later steps
 *   silently undo earlier ones. That logic lives inside a 950-line request handler
 *   that cannot be unit-tested without the full Next.js + Supabase + OpenAI stack.
 *
 *   This function lifts that ENTIRE pipeline into one pure function so it can be
 *   tested in isolation. It is a FAITHFUL REPRODUCTION — bugs included. We are NOT
 *   fixing anything here. Phases 2–5 change behavior; this step only makes the
 *   current behavior visible and lockable under test.
 *
 * MAPPING TO route.ts (src/app/api/chat/route.ts)
 *   - Friction layer 2 ............. L273–278  (patches storedState BEFORE extraction)
 *   - updateStateFromExtraction .... L496–501
 *   - Persist pre-detected values .. L504–512
 *   - Persist NM3/NM5/NM6 .......... L514–523
 *   - Persist quality/intent flags . L525–534
 *   - Friction layer 3 ............. L536–542
 *   - RC8 4-turn auto-close ........ L544–554
 *   - MOMENTUM phase lock .......... L556–560
 *   - Document-intake auto-clear ... L562–567
 *   - M4 guard ..................... L569–621
 *   - STEP A intent validation ..... L623–643
 *   - STEP B quality gate .......... L645–682
 *   - shouldInsert ................. L752  (updatedState.is_complete)
 *
 * WIRE-IN (later): route.ts's POST handler replaces L496–682 with a single call to
 * resolveCompletion(...) and reads the returned { state, extraction, shouldInsert,
 * messageOverride } instead of the in-line mutations.
 */

import {
  detectFrictionSignal,
  detectConfirmation,
  detectVerificationAuthority,
  detectVerificationReadiness,
} from './detectors';
import { computeQualityGate } from './qualityGate';
import { updateStateFromExtraction } from './stateManager';
import type { RouterState, DealIntent } from './types';

// LLM extraction shape, as route.ts treats it.
export interface Extraction {
  intent: DealIntent;
  state: Partial<RouterState>;
  is_complete: boolean;
  message: string;
  /** Phase 2.5: the AI's structured confirmation signal for the genuine-mandate question. */
  intent_validation?: 'yes' | 'no' | 'unclear' | string | null;
}

export interface ResolveCompletionInput {
  /** State loaded from chat_sessions.state BEFORE any friction patch (route's `storedState`). */
  storedState: RouterState;
  /** The LLM output object (route's `extraction`). Will be cloned, not mutated in place. */
  extraction: Extraction;
  /** The raw user message for this turn. */
  message: string;
  /** State after pre-detection (route's `candidateState`) — supplies values the LLM may not echo. */
  candidateState: RouterState;
  /** modulesLoaded from buildSystemPrompt — gates m4_questions_asked acceptance in stateManager. */
  modulesLoaded?: string[];
}

export interface ResolveCompletionResult {
  /** Final RouterState to persist (route's `updatedState`). */
  state: RouterState;
  /** Possibly-mutated extraction (is_complete / message may change). */
  extraction: Extraction;
  /** route's L752 `shouldInsert` — whether the mandate gets written + matched this turn. */
  shouldInsert: boolean;
  /** If set, route replaces the LLM message with this (the M4-guard "bridge" copy). */
  messageOverride: string | null;
  /** Diagnostics so tests/logs can assert WHY the turn resolved the way it did. */
  hasFriction: boolean;
  m4GuardFired: boolean;
  reason:
  | 'friction'
  | 'rc8-4turn-autoclose'
  | 'llm-extraction'
  | 'blocked-by-m4-guard'
  | 'quality-gate-extend'
  | 'quality-gate-hardclose'
  | 'quality-gate-pass-await-validation'
  | 'intent-validated-yes'
  | 'intent-validated-no'
  | 'verification-qualified'        // NM8: score ≥ 70 (VERIFIED or QUALIFIED)
  | 'verification-exploratory'      // NM8: score < 70 — nurture mode
  | 'verification-pending'          // NM8: still collecting signals
  | 'not-finalized';
}

// ─────────────────────────────────────────────────────────────
// NM8: MANDATE VERIFICATION ENGINE
// Pure scoring + state helpers for the multi-step verification flow.
// ─────────────────────────────────────────────────────────────

const AUTHORITY_SCORES: Record<string, number> = {
  FOUNDER_PROMOTER: 30,
  OWNER_SHAREHOLDER: 30,
  BOARD_MEMBER: 26,
  PE_VC_REPRESENTATIVE: 26,
  CORP_DEV_TEAM: 24,
  INVESTMENT_BANKER_ADVISOR: 24,
  AUTHORIZED_MANDATE_HOLDER: 20,
  EXPLORING_OPPORTUNITIES: 3,
};

const READINESS_SCORES: Record<string, number> = {
  IMMEDIATELY: 30,
  WITHIN_30_DAYS: 24,
  WITHIN_90_DAYS: 14,
  EXPLORING_ONLY: 0,
};

// Evidence is derived from mandate state — no separate user question required.

function computeMandateConfidence(state: RouterState): {
  score: number;
  tier: 'VERIFIED' | 'QUALIFIED' | 'EARLY_STAGE' | 'EXPLORATORY';
  breakdown: { authority: number; readiness: number; evidence: number; consistency: number };
} {
  const authority = AUTHORITY_SCORES[state.verification_authority ?? ''] ?? 0;
  const readiness = READINESS_SCORES[state.verification_readiness ?? ''] ?? 0;

  // Evidence: derived from signals already collected — avoids a separate user question.
  let evidence = 0;
  if (state.is_document_intake || !!(state as RouterState & { document_text?: string }).document_text) {
    evidence += 12; // uploaded deal document ≈ CIM / board approval
  }
  const m4FieldCount = Object.values(state.industry_data || {})
    .filter(v => typeof v === 'string' && (v as string).trim().length > 3).length;
  if (m4FieldCount >= 4) evidence += 8;
  else if (m4FieldCount >= 2) evidence += 4;
  if (state.deal_size && state.revenue) evidence += 5;
  else if (state.deal_size || state.revenue) evidence += 3;
  evidence = Math.min(evidence, 25);

  // Consistency: how complete is the mandate data?
  let consistency = 0;
  if (state.intent) consistency += 4;
  if (state.sector) consistency += 4;
  if (state.deal_size || state.revenue) consistency += 4;
  if (state.geography) consistency += 3;

  const score = Math.min(100, Math.round(authority + readiness + evidence + consistency));
  const tier: 'VERIFIED' | 'QUALIFIED' | 'EARLY_STAGE' | 'EXPLORATORY' =
    score >= 90 ? 'VERIFIED'
      : score >= 70 ? 'QUALIFIED'
        : score >= 50 ? 'EARLY_STAGE'
          : 'EXPLORATORY';

  return { score, tier, breakdown: { authority, readiness, evidence, consistency } };
}

// Map is_intermediary field → authority code (pre-fills AUTHORITY step when role is already known)
function deriveAuthorityFromRole(role: 'owner' | 'advisor' | null): string | null {
  if (role === 'owner') return 'OWNER_SHAREHOLDER';
  if (role === 'advisor') return 'INVESTMENT_BANKER_ADVISOR';
  return null;
}

// ── Shared question text constants — used by advanceMandateVerification and STEP A ──

const AUTHORITY_QUESTION_TEXT = [
  'To ensure counterparty quality and avoid irrelevant introductions, we verify transaction intent before activating our matching network.',
  '',
  '**What best describes your relationship to this transaction?**',
  '',
  '1. Founder / Promoter',
  '2. Owner / Shareholder',
  '3. Board Member',
  '4. Corporate Development Team',
  '5. Investment Banker / Advisor',
  '6. PE / VC Representative',
  '7. Authorised Mandate Holder',
  '8. Just Exploring',
  '',
  'Reply with the number, or a brief description.',
].join('\n');

const READINESS_QUESTION_TEXT = [
  '**How soon are you prepared to engage with a relevant counterparty if one is identified?**',
  '',
  '1. Immediately — we are active right now',
  '2. Within 30 Days — approaching readiness',
  '3. Within 90 Days — in preparation',
  '4. Exploring — no fixed timeline yet',
  '',
  'Reply with the number or description.',
].join('\n');

// Stage 2: Mandate Summary — shown when quality gate first passes.
// Eliminates the false terminal state by replacing generic success messages
// with a structured confirmation that clearly positions the next step.
function buildMandateSummaryMessage(state: RouterState): string {
  const intentLabels: Record<string, string> = {
    SELL_SIDE: 'Sell Side — Divestiture / Exit',
    BUY_SIDE: 'Buy Side — Acquisition / Investment',
    FUNDRAISING: 'Fundraising — Equity Capital',
    DEBT: 'Debt Raise — Structured Finance',
    STRATEGIC_PARTNERSHIP: 'Strategic Partnership / JV',
  };

  const lines: string[] = [
    '**Here\'s what I\'ve captured for your mandate:**',
    '',
  ];

  if (state.intent) lines.push(`**Transaction Type:** ${intentLabels[state.intent] ?? state.intent}`);
  if (state.sector) {
    const sectorLabel = state.sector.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sub = state.sub_sector && state.sub_sector !== 'shell_company'
      ? ` (${state.sub_sector.replace(/_/g, ' ')})`
      : '';
    lines.push(`**Sector:** ${sectorLabel}${sub}`);
  }
  if (state.geography) lines.push(`**Geography:** ${state.geography}`);
  if (state.deal_size) lines.push(`**Deal Size:** ${state.deal_size}`);
  if (state.revenue) lines.push(`**Revenue / Financials:** ${state.revenue}`);
  if (state.structure) lines.push(`**Structure:** ${state.structure}`);
  if (state.intent_focus ?? state.strategic_intent) {
    lines.push(`**Strategic Rationale:** ${state.intent_focus ?? state.strategic_intent}`);
  }

  lines.push('');
  lines.push('Is this accurate? Reply **Yes** to proceed, or tell me what to correct.');

  return lines.join('\n');
}

// Stage 5: Activation message — shown when verification passes and matchmaking fires.
function buildVerificationSuccessMessage(
  tier: string,
  intent: string | null,
  sector: string | null,
  score: number,
): string {
  const tierLabel = tier === 'VERIFIED' ? 'Verified Mandate' : 'Qualified Mandate';
  const dealContext = intent && sector
    ? `${intent.replace(/_/g, ' ').toLowerCase()} · ${sector.replace(/_/g, ' ')}`
    : (intent ?? sector ?? 'Your mandate');
  return [
    '✓ Intent Captured',
    '✓ Mandate Structured',
    '✓ Verification Complete',
    '✓ Matchmaking Activated',
    '',
    `**${tierLabel} — Counterparty Search Initiated**`,
    '',
    `Your ${dealContext.toLowerCase()} mandate has been verified and registered. DealCollab's matching network is now scanning for aligned counterparties.`,
    '',
    'Our intelligence engine evaluates each counterparty across:',
    '— Sector and sub-sector alignment',
    '— Geographic proximity',
    '— Deal size compatibility',
    '— Strategic rationale fit',
    '',
    '**Mandate Active — 90 Day Monitoring**',
    'This mandate remains live. New proposals, mandates, and advisor submissions are continuously evaluated. Stronger matches surface as the network grows.',
    '',
    'You will be notified on your Deal Dashboard when relevant counterparties are identified.',
  ].join('\n');
}

// Build nurture message when confidence < 70
function buildVerificationNurtureMessage(
  tier: string,
  score: number,
  breakdown: { authority: number; readiness: number; evidence: number; consistency: number },
): string {
  if (tier === 'EXPLORATORY') {
    return (
      `Exploratory enquiries are welcome — this is how many transactions begin.\n\n` +
      `Your session is saved. Return when you have a confirmed mandate and we will activate matching immediately. ` +
      `The stronger your readiness and supporting materials, the higher the counterparty quality we surface.`
    );
  }
  // EARLY_STAGE (50-69): identify the weakest dimension and prompt
  const weakest = Object.entries(breakdown).sort((a, b) => a[1] - b[1])[0][0];
  const nudge: Record<string, string> = {
    readiness: 'Confirming your engagement timeline would strengthen this mandate significantly.',
    evidence: 'Having a teaser or financial summary available signals seriousness to counterparties.',
    authority: 'Clarifying your role in the transaction would improve counterparty matching.',
    consistency: 'Adding deal size, geography or structure data improves the accuracy of matches.',
  };
  return (
    `Your mandate is at early stage (confidence: ${score}/100).\n\n` +
    `${nudge[weakest] ?? 'Building out your mandate data will improve match quality.'}\n\n` +
    `Update your mandate and submit again when ready — DealCollab's network runs continuously for 90 days.`
  );
}

// Core verification state machine — three-stage flow:
//   CONFIRMATION → user confirms mandate summary
//   AUTHORITY    → who are you in this transaction? (or pre-filled from is_intermediary)
//   READINESS    → engagement timeline → finalizeVerification immediately after
function advanceMandateVerification(
  message: string,
  state: RouterState,
  extraction: Extraction,
): void {
  const step = state.verification_step ?? 'AUTHORITY';

  if (step === 'CONFIRMATION') {
    // Stage 2 → 3: user either confirms the mandate summary or requests corrections.
    const decision = detectConfirmation(message, null);
    const isYes = decision === 'yes' || detectFrictionSignal(message);
    const isNo = decision === 'no';

    if (isYes) {
      const prefilledAuthority = deriveAuthorityFromRole(state.is_intermediary);
      if (prefilledAuthority && !state.verification_authority) {
        state.verification_authority = prefilledAuthority;
        state.verification_step = 'READINESS';
        console.log(`[MANDATE_CONFIRMED] Mandate summary confirmed | authority pre-filled: ${prefilledAuthority}`);
        console.log('[VERIFICATION_STARTED] Skipping authority question — proceeding to readiness');
        extraction.message = READINESS_QUESTION_TEXT;
      } else {
        state.verification_step = 'AUTHORITY';
        console.log('[MANDATE_CONFIRMED] Mandate summary confirmed');
        console.log('[VERIFICATION_STARTED] Entering authority verification');
        extraction.message = AUTHORITY_QUESTION_TEXT;
      }
    } else if (isNo) {
      // User wants to correct something — return to qualification
      state.quality_gate_passed = false;
      state.quality_gate_attempted = false;
      state.is_complete = false;
      state.phase = 'QUALIFICATION';
      state.verification_step = null;
      extraction.is_complete = false;
      extraction.message = "Of course. What would you like to correct?";
    }
    // No decision detected — keep at CONFIRMATION and wait

  } else if (step === 'AUTHORITY') {
    const authority = detectVerificationAuthority(message)
      || deriveAuthorityFromRole(state.is_intermediary);
    if (authority) {
      state.verification_authority = authority;
      console.log(`[VERIFY] Authority: ${authority}`);
      if (authority === 'EXPLORING_OPPORTUNITIES') {
        state.verification_step = 'COMPLETE';
        finalizeVerification(state, extraction);
      } else {
        state.verification_step = 'READINESS';
        // Override LLM message — deliver readiness question in the same turn the authority answer is received.
        extraction.message = `Noted.\n\n${READINESS_QUESTION_TEXT}`;
      }
    }

  } else if (step === 'READINESS' || step === 'MATERIALS') {
    // MATERIALS is a legacy step — sessions stuck there are finalized immediately.
    const readiness = state.verification_readiness ?? detectVerificationReadiness(message);
    if (readiness || step === 'MATERIALS') {
      if (readiness) state.verification_readiness = readiness;
      console.log(`[VERIFY] Readiness: ${state.verification_readiness ?? 'unknown'}`);
      console.log('[VERIFICATION_COMPLETED] All verification signals collected — finalizing');
      finalizeVerification(state, extraction);
    }
  }
}

function finalizeVerification(state: RouterState, extraction: Extraction): void {
  state.verification_step = 'COMPLETE';
  const confidence = computeMandateConfidence(state);
  state.mandate_confidence_score = confidence.score;
  state.mandate_confidence_tier = confidence.tier;
  console.log(`[MANDATE_CONFIDENCE] Score: ${confidence.score} | Tier: ${confidence.tier} | breakdown: authority=${confidence.breakdown.authority} readiness=${confidence.breakdown.readiness} evidence=${confidence.breakdown.evidence} consistency=${confidence.breakdown.consistency}`);

  if (confidence.score >= 70) {
    console.log(`[MANDATE_VERIFIED] authority=${state.verification_authority} readiness=${state.verification_readiness} score=${confidence.score} tier=${confidence.tier}`);
    state.intent_validated = true;
    state.is_complete = true;
    state.phase = 'CLOSURE';
    extraction.is_complete = true;
    console.log(`[MANDATE_APPROVED] intent=${state.intent} sector=${state.sector} score=${confidence.score}`);
    extraction.message = buildVerificationSuccessMessage(
      confidence.tier,
      state.intent,
      state.sector,
      confidence.score,
    );
  } else {
    console.log(`[VERIFY] Score below threshold (${confidence.score}/100) — nurture mode`);
    state.intent_validated = false;
    state.quality_gate_passed = false;
    state.quality_gate_attempted = false;
    state.is_complete = false;
    state.phase = 'QUALIFICATION';
    extraction.is_complete = false;
    extraction.message = buildVerificationNurtureMessage(
      confidence.tier,
      confidence.score,
      confidence.breakdown,
    );
  }
}

// Phase 3.2: confirmation logic moved to detectors.detectConfirmation (one shared,
// negation-aware detector used by both intent-validation and document synthesis).

export function resolveCompletion(input: ResolveCompletionInput): ResolveCompletionResult {
  const { message, candidateState, modulesLoaded = [] } = input;

  // Clone so callers can compare input vs output without aliasing surprises.
  const extraction: Extraction = JSON.parse(JSON.stringify(input.extraction));
  let storedState: RouterState = { ...input.storedState };

  let messageOverride: string | null = null;
  let m4GuardFired = false;

  // ── Friction layer 2 (route L273–278) ──────────────────────────────────────
  // Patches storedState BEFORE extraction. Also affects the MOMENTUM-lock check below,
  // which reads storedState.phase (route uses the patched value at L557).
  const hasFriction = detectFrictionSignal(message);
  if (hasFriction) {
    storedState = { ...storedState, is_complete: true, phase: 'CLOSURE' };
  }

  // ── updateStateFromExtraction (route L496–501) ─────────────────────────────
  const updatedState: RouterState = updateStateFromExtraction(
    storedState,
    extraction as unknown as { intent: DealIntent; state: Partial<RouterState>; is_complete: boolean },
    message,
    modulesLoaded,
  );

  // Phase 1: auto-mark M4 when rich sector intel already captured (mirrors stateManager logic)
  const rcM4FieldCount = Object.values(updatedState.industry_data || {})
    .filter(v => typeof v === 'string' && (v as string).trim().length > 3).length;
  const hasRichM4Data = rcM4FieldCount >= 2;
  if (hasRichM4Data && !updatedState.m4_questions_asked) {
    updatedState.m4_questions_asked = true;
    console.log(`[RESOLVE] Rich industry_data (${rcM4FieldCount} fields) — m4_questions_asked auto-set`);
  }

  // ── Persist pre-detected values the LLM may not have re-extracted (L504–512) ─
  if (updatedState.is_intermediary === null && candidateState.is_intermediary !== null) {
    updatedState.is_intermediary = candidateState.is_intermediary;
  }
  if (!updatedState.sub_sector && candidateState.sub_sector) updatedState.sub_sector = candidateState.sub_sector;
  if (!updatedState.structure && candidateState.structure) updatedState.structure = candidateState.structure;
  if (!updatedState.deal_size && candidateState.deal_size) updatedState.deal_size = candidateState.deal_size;
  if (!updatedState.revenue && candidateState.revenue) updatedState.revenue = candidateState.revenue;
  if (!updatedState.intent_focus && candidateState.intent_focus) {
    updatedState.intent_focus = candidateState.intent_focus;
    updatedState.strategic_intent = candidateState.intent_focus;
  }

  // ── Persist NM3/NM5/NM6 (L514–523) ─────────────────────────────────────────
  if (candidateState.gateway_clarifier !== null && updatedState.gateway_clarifier === null) {
    updatedState.gateway_clarifier = candidateState.gateway_clarifier;
  }
  if (candidateState.is_document_intake && !updatedState.is_document_intake) {
    updatedState.is_document_intake = true;
  }
  if (candidateState.is_shell_query && !updatedState.is_shell_query) {
    updatedState.is_shell_query = true;
  }

  // ── Persist quality gate / intent_validated from candidate (L525–534) ──────
  if (candidateState.quality_gate_passed && !updatedState.quality_gate_passed) {
    updatedState.quality_gate_passed = true;
  }
  if (candidateState.quality_gate_attempted && !updatedState.quality_gate_attempted) {
    updatedState.quality_gate_attempted = true;
  }
  if (candidateState.intent_validated !== null && updatedState.intent_validated === null) {
    updatedState.intent_validated = candidateState.intent_validated;
  }

  // ── Friction layer 3 (L536–542) ────────────────────────────────────────────
  if (hasFriction) {
    updatedState.is_complete = true;
    updatedState.phase = 'CLOSURE';
    extraction.is_complete = true;
  }

  // ── RC8: 4-turn auto-close (L544–554) ──────────────────────────────────────
  if (
    updatedState.turn_count >= 4 &&
    (updatedState.intent || updatedState.sector) &&
    !updatedState.is_complete
  ) {
    updatedState.is_complete = true;
    updatedState.phase = 'CLOSURE';
    extraction.is_complete = true;
  }

  // ── CLOSURE phase sync ───────────────────────────────────────────────────────
  // When the system prompt was built in CLOSURE context (round_count ≥ 4 or
  // is_sufficient + refinements exhausted) but the LLM held is_complete=false,
  // force is_complete=true so STEP B can evaluate the quality gate and present
  // the mandate summary rather than leaking the LLM's premature closure text.
  if (
    candidateState.phase === 'CLOSURE' &&
    !updatedState.is_complete &&
    !updatedState.quality_gate_passed &&
    !updatedState.quality_gate_attempted &&
    !hasFriction
  ) {
    updatedState.is_complete = true;
    extraction.is_complete = true;
    console.log('[CLOSURE] Phase-sync: LLM held is_complete=false in CLOSURE context — overriding for quality gate evaluation');
  }

  // ── MOMENTUM phase lock (L556–560) ─────────────────────────────────────────
  // Note: reads the (possibly friction-patched) storedState.phase, exactly as route does.
  if (storedState.phase === 'MOMENTUM' && updatedState.phase !== 'CLOSURE' && !updatedState.is_complete) {
    updatedState.phase = 'MOMENTUM';
    updatedState.is_sufficient = true;
  }

  // ── Document-intake auto-clear after 3 turns unconfirmed (L562–567) ────────
  if (updatedState.is_document_intake && !updatedState.is_complete && updatedState.turn_count > 3) {
    updatedState.is_document_intake = false;
  }

  // ── M4 guard (L569–621) ────────────────────────────────────────────────────
  const m4JustAsked = !storedState.m4_questions_asked && updatedState.m4_questions_asked;
  const m4GuardShouldFire =
    updatedState.is_complete &&
    !hasFriction &&
    !updatedState.is_document_intake &&   // Phase 3.3: documents take the fast-lane — skip M4 enrichment
    !!updatedState.sector &&
    (!updatedState.m4_questions_asked || m4JustAsked) &&
    !hasRichM4Data &&                     // Phase 1: skip guard when sector intel already captured upfront
    updatedState.turn_count <= 9;

  if (m4GuardShouldFire) {
    m4GuardFired = true;
    updatedState.is_complete = false;
    updatedState.phase = 'QUALIFICATION';

    if (updatedState.is_document_intake) {
      updatedState.is_document_intake = false;
    }
    if (!updatedState.geography && updatedState.round_count === 0) {
      updatedState.round_count = 1;
    }
    extraction.is_complete = false;

    if (!updatedState.m4_questions_asked) {
      // Case A — M4 never asked: replace the LLM's premature closure with a bridge.
      const sectorLabel = (updatedState.sector || 'target').replace(/_/g, ' ');
      messageOverride =
        `Before I finalise this mandate, I need a few sector-specific details ` +
        `about the ${sectorLabel} target to find the most aligned counterparties.`;
      extraction.message = messageOverride;
    }
    // Case B — m4JustAsked: keep the LLM message (it already contains M4 questions).
  }

  // ── STEP A: Mandate Verification Engine (NM8) ─────────────────────────────────
  // NM8: `verification_step !== null` is the reliable NM8 signal — it survives friction
  // layer 2 patching phase to CLOSURE, so we don't rely on phase for this check.
  if (updatedState.quality_gate_passed && updatedState.intent_validated === null) {
    const inNM8 = updatedState.phase === 'MANDATE_VERIFICATION'
      || (updatedState.verification_step !== null && updatedState.verification_step !== 'COMPLETE');

    if (inNM8) {
      const atConfirmation = updatedState.verification_step === 'CONFIRMATION';
      if (hasFriction && !atConfirmation) {
        // Friction signal past confirmation ("go ahead", "proceed") = skip remaining questions.
        // CONFIRMATION friction is handled inside advanceMandateVerification (treats as yes).
        if (!updatedState.verification_authority) {
          updatedState.verification_authority =
            deriveAuthorityFromRole(updatedState.is_intermediary) ?? 'AUTHORIZED_MANDATE_HOLDER';
        }
        if (!updatedState.verification_readiness) {
          updatedState.verification_readiness = 'IMMEDIATELY';
        }
        console.log('[VERIFY] Friction signal during verification — finalizing with available data');
        console.log('[VERIFICATION_COMPLETED] Friction-triggered finalization');
        finalizeVerification(updatedState, extraction);
      } else {
        // ── NM8: Multi-step verification state machine ──
        advanceMandateVerification(message, updatedState, extraction);
      }
    } else if (updatedState.phase === 'INTENT_VALIDATION') {
      // ── Legacy path: binary yes/no (backward compat for existing sessions) ──
      const decision = detectConfirmation(message, extraction.intent_validation);
      if (decision === 'yes') {
        console.log('[MANDATE_CONFIRMED] Legacy path — user confirmed the mandate.');
        updatedState.intent_validated = true;
        updatedState.is_complete = true;
        updatedState.phase = 'CLOSURE';
        extraction.is_complete = true;
      } else if (decision === 'no') {
        updatedState.intent_validated = false;
        updatedState.quality_gate_passed = false;
        updatedState.quality_gate_attempted = false;
        updatedState.is_complete = false;
        updatedState.phase = 'QUALIFICATION';
        extraction.is_complete = false;
        extraction.message = "Understood. Let's modify the details. What would you like to change?";
      }
    }
  }

  // Phase 2.5: once the quality gate is passed, the mandate can ONLY complete on an
  // explicit yes. The LLM cannot self-complete past this gate — closes the hole where
  // is_complete=true slipped through (e.g. an unrecognised "sure") with intent_validated
  // still null, and the insert hardcoded intent_validated:true.
  if (updatedState.quality_gate_passed && updatedState.intent_validated !== true) {
    updatedState.is_complete = false;
    extraction.is_complete = false;
  }

  // ── STEP B: quality gate (L645–682) ────────────────────────────────────────
  if (updatedState.is_complete && !updatedState.quality_gate_passed && updatedState.intent_validated !== true) {
    const q = computeQualityGate(updatedState);
    if (!q.passed) {
      if (updatedState.quality_gate_attempted) {
        // Second failure — hard close, no DB insert.
        updatedState.is_complete = false;
        updatedState.quality_gate_passed = false;
        extraction.is_complete = false;
        extraction.message = q.message
          || 'I need a few more details to match this mandate effectively. Please provide the missing information.';
      } else {
        // First failure — one extension.
        updatedState.quality_gate_attempted = true;
        updatedState.quality_score = q.score;
        updatedState.is_complete = false;
        updatedState.quality_gate_passed = false;
        updatedState.round_count = 0;
        extraction.is_complete = false;
        extraction.message = q.message
          || 'To register this mandate and begin matching, please provide the missing details.';
      }
    } else if (updatedState.is_document_intake) {
      // For document intake, quality gate passed.
      const decision = detectConfirmation(message, extraction.intent_validation);
      if (decision === 'yes') {
        console.log("[MANDATE_CONFIRMED] Document confirmed by user message.");
        updatedState.quality_gate_passed = true;
        updatedState.quality_score = q.score;
        updatedState.intent_validated = true;
        updatedState.is_complete = true;
        updatedState.phase = 'CLOSURE';
        extraction.is_complete = true;
      } else {
        console.log("[MANDATE_CAPTURED] Document mandate captured. Awaiting confirmation.");
        updatedState.quality_gate_passed = true;
        updatedState.quality_score = q.score;
        updatedState.intent_validated = null;
        updatedState.is_complete = false;
        extraction.is_complete = false;
        updatedState.phase = 'INTENT_VALIDATION';
      }
    } else {
      // Stage 2: Quality gate passed — show mandate summary for confirmation.
      // This replaces all generic "Your requirement has been structured" messages with a
      // structured summary that is clearly in-progress, not terminal.
      console.log('[MANDATE_STRUCTURED] Quality gate passed — presenting mandate summary.');
      updatedState.quality_gate_passed = true;
      updatedState.quality_score = q.score;
      updatedState.is_complete = false;
      extraction.is_complete = false;
      updatedState.intent_validated = null;
      updatedState.phase = 'MANDATE_VERIFICATION';
      updatedState.verification_step = 'CONFIRMATION';

      // Show the structured mandate summary — verification begins on next turn after user confirms
      extraction.message = buildMandateSummaryMessage(updatedState);
    }
  }

  // ── Final outputs ───────────────────────────────────────────────────────────
  const shouldInsert = updatedState.is_complete; // route L752

  // Derive a single human-readable reason (mirrors route's [ENRICH] finalizeReason logic, extended).
  let reason: ResolveCompletionResult['reason'];
  if (m4GuardFired) {
    reason = 'blocked-by-m4-guard';
  } else if (updatedState.phase === 'MANDATE_VERIFICATION' && !shouldInsert) {
    // NM8: still collecting verification signals
    reason = 'verification-pending';
  } else if (updatedState.intent_validated === true && shouldInsert && updatedState.mandate_confidence_tier !== null) {
    // NM8: verification qualified
    reason = 'verification-qualified';
  } else if (updatedState.intent_validated === false && updatedState.mandate_confidence_tier !== null) {
    // NM8: verification failed — exploratory
    reason = 'verification-exploratory';
  } else if (updatedState.intent_validated === true && shouldInsert) {
    reason = 'intent-validated-yes';
  } else if (updatedState.intent_validated === false) {
    reason = 'intent-validated-no';
  } else if (updatedState.phase === 'INTENT_VALIDATION' && updatedState.quality_gate_passed) {
    // NOTE: if shouldInsert is ALSO true here, that's the "sure" edge (scenario M) —
    // inserting while phase still reads INTENT_VALIDATION and intent_validated is null.
    reason = 'quality-gate-pass-await-validation';
  } else if (updatedState.quality_gate_attempted && !updatedState.quality_gate_passed && !shouldInsert) {
    reason = updatedState.round_count === 0 ? 'quality-gate-extend' : 'quality-gate-hardclose';
  } else if (shouldInsert && hasFriction) {
    reason = 'friction';
  } else if (shouldInsert && updatedState.turn_count >= 4) {
    reason = 'rc8-4turn-autoclose';
  } else if (shouldInsert) {
    reason = 'llm-extraction';
  } else {
    reason = 'not-finalized';
  }

  return { state: updatedState, extraction, shouldInsert, messageOverride, hasFriction, m4GuardFired, reason };
}