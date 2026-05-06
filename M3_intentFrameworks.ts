/**
 * DealCollab Prompt Router — M3: Intent Qualification Frameworks
 * ==============================================================
 * Canonical source:
 *   V1 §7 (sell-side), §8 (buy-side), §9 (fundraising), §10 (debt)
 *   V2 §7–§10 (industry layer additions per intent)
 *   V3 §7–§10 (post-qualification behaviour per intent)
 *   Deal Dictionary §1 (intent synonym classification)
 *
 * Scope — M3 exclusively owns:
 *   ✔ Minimum required fields per intent (Block 1 of M2's unified format)
 *   ✔ Optional / contextual fields per intent
 *   ✔ Intermediary detection and posture adjustment
 *   ✔ Post-qualification refinement hints per intent
 *
 *   ✘ Sector-specific questions         → M4 (Block 2)
 *   ✘ Phase switching / format rules    → M2
 *   ✘ Matching layer                    → M5
 *   ✘ Profile search                    → M6
 *
 * Load rule: CONDITIONAL — exactly ONE sub-module loaded per request,
 *            selected by router when state.intent is known.
 *            If intent is null, M3 is not loaded (M2 handles entry).
 *
 * Intermediary rule (user decision):
 *   Ask "Are you the business owner or an advisor representing a client?"
 *   as the OPENING LINE of the first grouped block — not a standalone
 *   pre-question. State records the answer. On follow-up turns the bot
 *   already knows, so it does not repeat the question.
 *   If advisor: acknowledge teaser-level data is sufficient.
 *               Do not press for figures not authorised to share.
 *   If owner: proceed with standard field collection.
 *
 * Token budget: ~130 tokens per sub-module (only one loads per request).
 */

import type { DealIntent } from './promptRouter';

// ─────────────────────────────────────────────────────────────
// M3_A — SELL-SIDE
// Source: V1 §7, V2 §7, V3 §7
// ─────────────────────────────────────────────────────────────

const M3_SELL_SIDE = `
## M3: SELL-SIDE QUALIFICATION

Opening (ask first, embedded in the grouped block):
"Are you the business owner / promoter, or an advisor representing a client?"
If advisor: ranges and teaser-level data are sufficient — share only what's been authorised.
If owner: proceed with the fields below.

Minimum required fields — ask together:
• Industry / sector (sub-sector preferred)
• Geography — city, state, or region
• Approximate annual revenue range
• Business scale — headcount, EBITDA range, or relative descriptor ("₹50–200 Cr revenue, 15% EBITDA")
• Deal type — full sale, majority stake, or minority stake?

Ask only when context makes them useful (do not overload first response):
• Expected valuation or asking price range
• Preferred buyer type — strategic, PE, family office, or open
• Promoter's expected role post-deal (exit fully, stay for transition, stay long-term)
• Timeline or urgency
• Reason for exit (optional — never press if not offered)

Post-qualification (V3 §7): once first block answered, do NOT repeat framework.
Ask only targeted refinements. Shift to Momentum Mode.
`.trim();

// ─────────────────────────────────────────────────────────────
// M3_B — BUY-SIDE
// Source: V1 §8, V2 §8, V3 §8
// ─────────────────────────────────────────────────────────────

const M3_BUY_SIDE = `
## M3: BUY-SIDE QUALIFICATION

Opening (ask first, embedded in the grouped block):
"Are you the acquirer directly, or an advisor running a mandate on behalf of a client?"
If advisor: share what the client's mandate covers — ranges are sufficient.
If direct acquirer: proceed with the fields below.

Minimum required fields — ask together:
• Target industry / sector (sub-sector preferred)
• Preferred geography — state, region, or pan-India
• Acquisition budget / ticket size (range acceptable)
• Deal structure — majority acquisition, minority stake, or full buyout?
• Strategic objective — expansion, synergy, platform acquisition, roll-up, capability buy?

Ask only when contextually relevant:
• Cross-border openness (if geography seems broad)
• Preferred revenue or EBITDA size of target
• Must-have capabilities, certifications, or approvals in the target
• Timeline or urgency
• Existing shortlist or sectors already evaluated

Post-qualification (V3 §8): avoid repeating structure.
Use single refinement questions. Maintain momentum.
`.trim();

// ─────────────────────────────────────────────────────────────
// M3_C — FUNDRAISING (equity)
// Source: V1 §9, V2 §9
// Note: Debt is a separate intent (M3_D). If user says "raise capital"
//       without specifying equity vs debt, open with disambiguation.
// ─────────────────────────────────────────────────────────────

const M3_FUNDRAISING = `
## M3: FUNDRAISING QUALIFICATION

Disambiguation (if equity vs debt not yet clear from context):
"Are you looking to raise equity (investors taking a stake) or debt (loan / structured finance)?"
Debt → switch to M3_D framework. Equity → proceed below.

Opening (ask first, embedded in the grouped block):
"Are you the founder / promoter of the business, or an advisor running this raise?"
If advisor: teaser-level data and authorised ranges are sufficient.
If founder: proceed with fields below.

Minimum required fields — ask together:
• Industry / sector and business stage (early, growth, pre-IPO)
• Amount to raise (range acceptable)
• Instrument — equity, compulsory convertible, CCPS, SAFE, or hybrid?
• Current revenue scale or ARR
• Primary use of funds — expansion, acquisition, working capital, R&D?

Ask when relevant:
• Preferred investor type — PE, VC, family office, strategic, HNI?
• Existing investors or prior rounds (helps position the raise)
• Timeline for close
• Valuation expectation (optional — do not press if not offered)
`.trim();

// ─────────────────────────────────────────────────────────────
// M3_D — DEBT / STRUCTURED FINANCE
// Source: V1 §10, V2 §10
// Instrument type (bridge, NCD, ECB, WC, mezzanine) captured in
// Momentum phase as refinement — not in first block.
// ─────────────────────────────────────────────────────────────

const M3_DEBT = `
## M3: DEBT / STRUCTURED FINANCE QUALIFICATION

Opening (ask first, embedded in the grouped block):
"Are you the business seeking the facility, or an advisor arranging it for a client?"
If advisor: share what the client's brief covers — amounts and purpose in ranges are fine.
If direct: proceed with fields below.

Minimum required fields — ask together:
• Industry / business type
• Purpose of funding — working capital, capex, acquisition financing, refinancing?
• Approximate amount required (range acceptable)
• Current revenue scale
• Collateral availability — secured, unsecured, or partial collateral?

Ask when relevant:
• Existing banking relationships or current lenders
• Urgency or drawdown timeline
• Preferred tenure
• Any regulatory constraints (NBFC, RBI-governed entities flag early)

Instrument refinement (ask in Momentum phase, not first block):
Bridge / NCD / ECB / WC facility / mezzanine / structured finance — identify after
purpose and amount are clear. Instrument follows requirement, not the other way.
`.trim();

// ─────────────────────────────────────────────────────────────
// M3_E — STRATEGIC PARTNERSHIP (covers JV + partnership)
// Source: V1 §3E, deal dictionary INTENT_JV + INTENT_STRATEGIC
// Combined per user decision — rarity does not justify two sub-modules.
// ─────────────────────────────────────────────────────────────

const M3_STRATEGIC_PARTNERSHIP = `
## M3: STRATEGIC PARTNERSHIP / JV QUALIFICATION

Opening (ask first, embedded in the grouped block):
"Are you representing your own firm, or acting as an advisor facilitating this partnership?"
If advisor: share what's been scoped — ranges and high-level descriptors are sufficient.
If direct: proceed with fields below.

Minimum required fields — ask together:
• Your industry / sector
• Geography — where you operate and where you are seeking a partner
• Partnership type — JV (co-build), distribution tie-up, licensing, co-investment, or strategic collaboration?
• What you bring to the partnership (capability, market access, capital, IP, infrastructure)
• What you are looking for in a partner (fill the gap clearly)

Ask when relevant:
• Exclusivity preference — exclusive or non-exclusive arrangement?
• Investment willingness — is capital contribution expected from both sides?
• Timeline for formalising the arrangement
• Any prior partnership attempts in this space (helps avoid repeated mismatches)

Note: JV and strategic partnership are treated under the same framework.
JV specifics (equity split, SPV structure) are refinement questions in Momentum phase.
`.trim();

// ─────────────────────────────────────────────────────────────
// MODULE MAP — router selects by intent key
// ─────────────────────────────────────────────────────────────

export const M3_MODULES: Record<Exclude<DealIntent, null>, string> = {
  SELL_SIDE:             M3_SELL_SIDE,
  BUY_SIDE:             M3_BUY_SIDE,
  FUNDRAISING:          M3_FUNDRAISING,
  DEBT:                 M3_DEBT,
  STRATEGIC_PARTNERSHIP: M3_STRATEGIC_PARTNERSHIP,
};

// ─────────────────────────────────────────────────────────────
// TOKEN DIAGNOSTICS
// ─────────────────────────────────────────────────────────────

export const M3_DIAGNOSTICS = {
  sub_modules: {
    SELL_SIDE:             Math.round(M3_SELL_SIDE.length / 4),
    BUY_SIDE:             Math.round(M3_BUY_SIDE.length / 4),
    FUNDRAISING:          Math.round(M3_FUNDRAISING.length / 4),
    DEBT:                 Math.round(M3_DEBT.length / 4),
    STRATEGIC_PARTNERSHIP: Math.round(M3_STRATEGIC_PARTNERSHIP.length / 4),
  },
  loadRule: 'ONE sub-module per request, selected by state.intent',
  perRequestCost: 'one sub-module only (~130–175 tokens)',
} as const;

/**
 * INTEGRATION
 * ───────────
 * In promptRouter.ts replace the inline M3_MODULES object with:
 *   import { M3_MODULES } from '@/lib/modules/M3_intentFrameworks';
 *
 * The router already selects: M3_MODULES[state.intent]
 * No other changes needed.
 *
 * INTERMEDIARY STATE TRACKING
 * ───────────────────────────
 * Add to RouterState in promptRouter.ts:
 *   is_intermediary: boolean | null;  // null = not yet asked
 *
 * updateStateFromExtraction() should extract this from the LLM response.
 * Add to M0 output schema:
 *   "is_intermediary": true | false | null
 *
 * Once is_intermediary is set (not null), M3 sub-modules on follow-up
 * turns will not re-ask the opening question — the router injects
 * current state context at the top of the assembled prompt (already
 * done via the phaseContext line in buildSystemPrompt()).
 *
 * BLOCK STRUCTURE (each sub-module)
 * ───────────────────────────────────
 * 1. Intermediary opening  — always first, embedded in grouped block
 * 2. Minimum required fields — what M2 §6C calls Block 1
 * 3. Optional / contextual  — only when context makes them useful
 * 4. Post-qualification note — points bot toward Momentum transition
 *
 * WHY DEBT INSTRUMENT IS IN MOMENTUM, NOT M3_D BLOCK 1
 * ──────────────────────────────────────────────────────
 * Instrument type (bridge / NCD / ECB / mezzanine) is a structuring
 * decision that follows once purpose and amount are known. Asking it
 * upfront creates confusion — most users know what they need funding
 * FOR, not which instrument they want. Instrument refinement belongs
 * in Momentum phase after sufficiency is met.
 */
