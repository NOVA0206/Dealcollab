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
 *
 * CHANGE LOG (v2):
 *   Minimum required fields rewritten as open-ended questions across all
 *   5 sub-modules. Previous format listed specific options in parentheses
 *   (e.g. "Deal structure — majority acquisition, minority stake, or full
 *   buyout?"). This constrained users to the listed options and suppressed
 *   additional context they would otherwise volunteer.
 *   New format: questions invite the user to describe in their own words.
 *   The LLM extracts structured values from free-form answers — the user
 *   does not need to match a fixed option list.
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

Minimum required fields — ask together as open-ended questions:
• What does the business do, and where does it operate?
• What is the approximate revenue scale of the business?
• How would you describe the business in terms of size and financial profile?
• What kind of transaction is the client looking for — and what's the thinking behind it?

Ask only when context makes them useful (do not overload first response):
• What valuation or price expectation does the client have in mind?
• What kind of buyer would be the right fit — and is there a preference?
• What role does the promoter want to play after the transaction?
• Is there a timeline or urgency driving this?
• What's prompting the sale — if the client is comfortable sharing?

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

Minimum required fields — ask together as open-ended questions:
• What kind of business is your client looking to acquire, and in which markets?
• What is the approximate budget or ticket size your client is working with?
• What kind of deal structure is your client looking for — and what's driving that preference?
• What is the strategic rationale behind this acquisition?

Ask only when contextually relevant:
• Is the client open to cross-border opportunities, or is geography fixed?
• What does the ideal target look like in terms of revenue or EBITDA scale?
• Are there specific capabilities, certifications, or approvals the target must have?
• Is there urgency or a timeline the client is working toward?
• Has the client already evaluated any targets or sectors?

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

Minimum required fields — ask together as open-ended questions:
• What does the business do, and what stage is it at?
• How much is the business looking to raise, and what will the capital be used for?
• What kind of funding structure is the business open to?
• What is the current revenue scale or ARR?

Ask when relevant:
• What kind of investor would be the right fit — and does the business have a preference?
• Are there existing investors or prior rounds that context the raise?
• What is the target timeline for closing the round?
• Does the business have a valuation expectation in mind?
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

Minimum required fields — ask together as open-ended questions:
• What does the business do, and what is the funding needed for?
• What is the approximate amount the business is looking to raise?
• What is the current revenue scale of the business?
• What is the collateral position — does the business have assets to back the facility?

Ask when relevant:
• Does the business have existing banking relationships or current lenders?
• Is there urgency or a drawdown timeline?
• What tenure is the business looking for?
• Are there any regulatory constraints that affect the structure?

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

Minimum required fields — ask together as open-ended questions:
• What does your business do, and where does it operate?
• What kind of partnership or collaboration are you looking for?
• What does your business bring to the table, and what are you looking for in a partner?
• Where geographically are you looking for a partner?

Ask when relevant:
• Is exclusivity important, or is the client open to a non-exclusive arrangement?
• Is capital contribution expected from both sides?
• What is the target timeline for formalising the arrangement?
• Has the client attempted partnerships in this space before?

Note: JV and strategic partnership are treated under the same framework.
JV specifics (equity split, SPV structure) are refinement questions in Momentum phase.
`.trim();

// ─────────────────────────────────────────────────────────────
// MODULE MAP — router selects by intent key
// ─────────────────────────────────────────────────────────────

export const M3_MODULES: Record<Exclude<DealIntent, null>, string> = {
  SELL_SIDE: M3_SELL_SIDE,
  BUY_SIDE: M3_BUY_SIDE,
  FUNDRAISING: M3_FUNDRAISING,
  DEBT: M3_DEBT,
  STRATEGIC_PARTNERSHIP: M3_STRATEGIC_PARTNERSHIP,
};

// ─────────────────────────────────────────────────────────────
// TOKEN DIAGNOSTICS
// ─────────────────────────────────────────────────────────────

export const M3_DIAGNOSTICS = {
  sub_modules: {
    SELL_SIDE: Math.round(M3_SELL_SIDE.length / 4),
    BUY_SIDE: Math.round(M3_BUY_SIDE.length / 4),
    FUNDRAISING: Math.round(M3_FUNDRAISING.length / 4),
    DEBT: Math.round(M3_DEBT.length / 4),
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
 * INTERMEDIARY STATE TRACKING
 * ───────────────────────────
 * Add to RouterState in promptRouter.ts:
 *   is_intermediary: boolean | null;  // null = not yet asked
 *
 * updateStateFromExtraction() should extract this from the LLM response.
 * Add to M0 output schema:
 *   "is_intermediary": true | false | null
 *
 * BLOCK STRUCTURE (each sub-module)
 * ───────────────────────────────────
 * 1. Intermediary opening  — always first, embedded in grouped block
 * 2. Minimum required fields — open-ended questions (v2 change)
 * 3. Optional / contextual  — only when context makes them useful
 * 4. Post-qualification note — points bot toward Momentum transition
 *
 * WHY OPEN-ENDED QUESTIONS (v2)
 * ──────────────────────────────
 * Previous format listed specific options inline in each question:
 *   "Deal structure — majority acquisition, minority stake, or full buyout?"
 * This creates a ceiling: users read the options, pick one, say nothing more.
 * Open-ended format:
 *   "What kind of deal structure is your client looking for — and what's
 *   driving that preference?"
 * Users answer in their own words, often volunteering strategic context,
 * timeline, and reasoning that the option-list format never surfaces.
 * The LLM extracts the structured value (majority/minority/full) from the
 * free-form answer — no loss in data quality, significant gain in context.
 *
 * WHY DEBT INSTRUMENT IS IN MOMENTUM, NOT M3_D BLOCK 1
 * ──────────────────────────────────────────────────────
 * Instrument type (bridge / NCD / ECB / mezzanine) is a structuring
 * decision that follows once purpose and amount are known. Asking it
 * upfront creates confusion — most users know what they need funding
 * FOR, not which instrument they want. Instrument refinement belongs
 * in Momentum phase after sufficiency is met.
 */
