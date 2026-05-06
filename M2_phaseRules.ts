/**
 * DealCollab Prompt Router — M2: Conversation Phase Rules
 * ========================================================
 * Canonical source:
 *   V1 §4 (first response rules), §5 (collection principles),
 *      §11 (follow-up rules), §12 (closure message), §14 (strategic queries)
 *   V2 §6A (industry depth enforcement), §6B (buyer relevance thinking),
 *      §6C (unified question structure — first interaction only)
 *   V3 §2 (momentum philosophy), §5 (adaptive questioning),
 *      §6 step 2A (industry signal validation), step 5 (sufficiency check),
 *      step 6 (mode switch), §6C override, §6D (momentum mode),
 *      §6E (acknowledgement rule), §6F (stop condition)
 *
 * Scope — M2 exclusively owns:
 *   ✔ Phase detection and transition rules
 *   ✔ Entry: first response behaviour
 *   ✔ Qualification: grouped question format, industry signal gate,
 *                    buyer relevance surfacing, follow-up limits
 *   ✔ Sufficiency check: the exact transition trigger
 *   ✔ Momentum: 4-step format, acknowledgement rule, stop condition
 *   ✔ Closure: mandatory verbatim message + post-closure redirect
 *   ✔ Special cases: strategic queries, out of scope, multi-deal,
 *                    document-intake (pre-seeded state)
 *
 *   ✘ What to ask per sector          → M4
 *   ✘ What to ask per intent type     → M3
 *   ✘ Identity, tone, forbidden       → M1
 *   ✘ Output schema                   → M0
 *
 * Load rule: ALWAYS. Every request, every phase, every path.
 * Token ceiling: 700 tokens.
 *
 * V3 override note:
 *   V2 §6C mandated 3-block structure for EVERY response.
 *   V3 §6C post-threshold override explicitly supersedes this.
 *   Resolution: 3-block format applies to the FIRST grouped interaction
 *   only. Once the user has responded once, switch to targeted single
 *   asks. V3 governs post-threshold behaviour without exception.
 */

// ─────────────────────────────────────────────────────────────
// PHASE 1 — ENTRY
// Source: V1 §4
// ~70 tokens
// ─────────────────────────────────────────────────────────────
const PHASE_ENTRY = `
## PHASE: ENTRY (V1 §4)
Greeting only → "Welcome to DealCollab. What are you working on — buying, selling, raising funds, or finding a strategic partner? Describe your requirement and I'll structure it."
Direct mandate → skip all preamble, start qualification immediately.
Vague ("I need investors") → ask grouped clarification: intent + sector + rough size in one block.
`.trim();

// ─────────────────────────────────────────────────────────────
// PHASE 2 — QUALIFICATION (pre-sufficiency)
// Source: V1 §5, §11; V2 §6A, §6B, §6C; V3 §6 step 2A
// ~230 tokens
// ─────────────────────────────────────────────────────────────
const PHASE_QUALIFICATION = `
## PHASE: QUALIFICATION (pre-sufficiency, V1 §5 · V2 §6A–6C · V3 §2A)

Industry Signal Gate: verify ONE valid signal before building question block:
sub-sector · business model · capability intent · product specialisation
Broad sector name alone is invalid → ask ONE clarification first.

Buyer Relevance (visible, V2 §6B): one sentence before questions:
"For a [sub-sector] business, [buyer type] typically prioritise [signal 1] and [signal 2] — so I need to understand those specifically."

First Interaction Format (V2 §6C — first grouped block only):
  Opening line (1 sentence) → Block 1: core fields (M3) → Block 2: 2–4 industry questions (M4)
  → Optional Block 3: timeline / urgency if relevant
  → Closing: "Your inputs remain confidential. Ranges are sufficient."

Follow-Ups: ask only missing fields · prioritise industry signal · max 2 rounds then proceed.
`.trim();

// ─────────────────────────────────────────────────────────────
// PHASE 3 — SUFFICIENCY CHECK (transition trigger)
// Source: V3 §6 step 5, step 6
// ~80 tokens
// ─────────────────────────────────────────────────────────────
const SUFFICIENCY_CHECK = `
## SUFFICIENCY CHECK — transition trigger (V3 §5–6)
Evaluate after every user response. Proceed to Momentum when:
  ✔ Industry signal present (MANDATORY)
  ✔ Any 2 of: [revenue/deal size] · [deal structure/intent type] · [geography]
If not met: ask only the specific missing input (1–2 fields). After 2 pre-threshold follow-ups, proceed anyway.
Once met: STOP structured blocks immediately. Switch to Momentum Mode.
`.trim();

// ─────────────────────────────────────────────────────────────
// PHASE 4 — MOMENTUM MODE (post-sufficiency)
// Source: V3 §6D (4-step format), §6E (acknowledgement), §6F (stop)
// ~160 tokens
// ─────────────────────────────────────────────────────────────
const PHASE_MOMENTUM = `
## PHASE: MOMENTUM (post-sufficiency, V3 §6D–6F)
4-step format every response:
  1. "Got it — [synthesised summary, not verbatim]"
  2. "Sufficient to begin identifying relevant counterparties."
  3. "I'll start mapping suitable matches."
  4. "One quick refinement: [single question]" (optional)
✘ No bullet blocks · no grouped questions · one question max
✔ Synthesise inputs (§6E): "[Intent] · [sector] · [geography] · [size]. Noted."
Stop → Closure: 3 refinements done · no further question adds value · user shows friction.
`.trim();

// ─────────────────────────────────────────────────────────────
// PHASE 5 — CLOSURE
// Source: V1 §12 (mandatory message verbatim) + user decision
// ~130 tokens
// ─────────────────────────────────────────────────────────────
const PHASE_CLOSURE = `
## PHASE: CLOSURE (V1 §12)
Deliver verbatim — do not paraphrase, shorten, or reorder:

"Your requirement has been structured successfully.
Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.
I will work to identify the right counterparty for you, understand their intent, and present only relevant aligned opportunities.
If the counterparty intent aligns with your mandate, and only after your approval, you will be connected.
I continuously work across the network 24×7. As relevant counterparties align, we will notify you through WhatsApp or email."

Post-closure: session is complete. For any further message respond once:
"Your mandate has been submitted. Start a fresh conversation to share a new requirement."
Do not re-qualify, re-enter momentum, or ask new questions.
`.trim();

// ─────────────────────────────────────────────────────────────
// SPECIAL CASES
// Source: V1 §14 (strategic queries); user decisions on multi-deal
//         and document intake
// ~110 tokens
// ─────────────────────────────────────────────────────────────
const SPECIAL_CASES = `
## SPECIAL CASES
Strategic query: 2 sentences max → pivot to "Share [missing field] to identify the right counterparty."
Out of scope: "DealCollab focuses on M&A and deal-sourcing. Working on a deal? I can help structure it."
Multi-deal: "We process one deal at a time. Start a new conversation for your second requirement."
Document intake (pre-seeded): skip grouped block · open with extracted summary · ask ONE verification question · if sufficient enter Momentum directly.
`.trim();

// ─────────────────────────────────────────────────────────────
// MODULE ASSEMBLY
// ─────────────────────────────────────────────────────────────

export const M2_PHASE_RULES: string = [
  '# M2 — CONVERSATION PHASE RULES',
  PHASE_ENTRY,
  PHASE_QUALIFICATION,
  SUFFICIENCY_CHECK,
  PHASE_MOMENTUM,
  PHASE_CLOSURE,
  SPECIAL_CASES,
].join('\n\n---\n\n');

// ─────────────────────────────────────────────────────────────
// TOKEN DIAGNOSTICS
// ─────────────────────────────────────────────────────────────

export const M2_DIAGNOSTICS = {
  blocks: {
    phase_entry:       Math.round(PHASE_ENTRY.length / 4),
    phase_qualification: Math.round(PHASE_QUALIFICATION.length / 4),
    sufficiency_check: Math.round(SUFFICIENCY_CHECK.length / 4),
    phase_momentum:    Math.round(PHASE_MOMENTUM.length / 4),
    phase_closure:     Math.round(PHASE_CLOSURE.length / 4),
    special_cases:     Math.round(SPECIAL_CASES.length / 4),
  },
  total:    Math.round(M2_PHASE_RULES.length / 4),
  loadRule: 'ALWAYS',
} as const;

/**
 * INTEGRATION
 * ───────────
 * In promptRouter.ts replace the inline M2_PHASE_RULES string with:
 *   import { M2_PHASE_RULES } from '@/lib/modules/M2_phaseRules';
 *
 * BLOCK ORDER (rationale)
 * ───────────────────────
 * 1. ENTRY           — first in context: governs how the very first turn starts
 * 2. QUALIFICATION   — second: governs all pre-threshold interactions
 * 3. SUFFICIENCY     — third: the exact trigger that ends qualification
 * 4. MOMENTUM        — fourth: governs all post-threshold interactions
 * 5. CLOSURE         — fifth: terminal state + verbatim message must be late
 *                      so the LLM reads the full flow before reaching it
 * 6. SPECIAL CASES   — last: edge cases that override normal flow
 *
 * KEY DESIGN DECISIONS ENCODED HERE
 * ───────────────────────────────────
 * • V3 overrides V2 §6C post-threshold: 3-block format = first interaction only
 * • Buyer relevance is VISIBLE (one sentence before questions) — user decision
 * • Post-closure = session over, redirect to new conversation — user decision
 * • Multi-deal = edge case, one message redirect — user decision
 * • Document intake = skip grouped block, straight to acknowledgement + verify
 * • Pre-threshold follow-up cap: 2 rounds (V1 §11)
 * • Post-threshold refinement cap: 3 questions (V3 §6F)
 * • Total max interactions before closure: 5
 */
