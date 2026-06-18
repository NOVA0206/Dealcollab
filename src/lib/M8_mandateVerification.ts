/**
 * DealCollab — M8: Mandate Verification Framework
 * =================================================
 * Two-step verification before matchmaking activates:
 *   AUTHORITY  — who are you in this transaction?
 *   READINESS  — when can you engage? (last question — matching fires after this)
 *
 * Evidence is derived from the mandate state (documents uploaded, industry_data
 * richness, deal_size/revenue presence) — no separate user question required.
 *
 * Load rule: EXCLUSIVE — when phase === 'MANDATE_VERIFICATION'
 * Server-side resolveCompletion.ts handles answer detection, confidence scoring,
 * and message overrides. The LLM only generates fallback text.
 */

// ─────────────────────────────────────────────────────────────
// STAGE 2: MANDATE CONFIRMATION
// The server overrides extraction.message with the structured summary.
// This module is a fallback if the server override is not applied.
// ─────────────────────────────────────────────────────────────

const M8_CONFIRMATION = `
## M8: MANDATE VERIFICATION — CONFIRMATION

The mandate summary has already been delivered to the user by the server.

Your role this turn:
- If the user says YES, correct, or confirms → reply "Understood. Let me verify your transaction authority." and set is_complete=false
- If the user wants to correct something → acknowledge what they said and ask for the correction. Set is_complete=false.
- Do NOT repeat the mandate summary. Do NOT close the mandate. Do NOT ask for verification questions yet.

RULES:
- Set is_complete=false always.
- This is Stage 2 of 5. Verification has NOT started yet.
`.trim();

// ─────────────────────────────────────────────────────────────
// STEP 1: TRANSACTION AUTHORITY
// ─────────────────────────────────────────────────────────────

const M8_AUTHORITY = `
## M8: MANDATE VERIFICATION — TRANSACTION AUTHORITY

Your mandate has reached our quality threshold.

Before activating matching, DealCollab verifies transaction readiness.
This improves counterparty quality and avoids irrelevant introductions.

Deliver this opening verbatim (do NOT paraphrase):
"To ensure counterparty quality and avoid irrelevant introductions, we verify transaction intent before activating our matching network. This takes under a minute."

Then ask verbatim:
"**What best describes your relationship to this transaction?**

1. Founder / Promoter
2. Owner / Shareholder
3. Board Member
4. Corporate Development Team
5. Investment Banker / Advisor
6. PE / VC Representative
7. Authorised Mandate Holder
8. Just Exploring

Reply with the number, or a brief description."

RULES:
- Set is_complete=false. Do NOT close the mandate this turn.
- Ask ONLY this question. No qualification questions.
- Do NOT say "thank you" or "great choice".
`.trim();

// ─────────────────────────────────────────────────────────────
// STEP 2: TRANSACTION READINESS
// ─────────────────────────────────────────────────────────────

const M8_READINESS = `
## M8: MANDATE VERIFICATION — TRANSACTION READINESS

Authority has been recorded. This is the final verification question.
After the user replies, matchmaking activates automatically — do NOT ask any further questions.

Ask verbatim:
"**How soon are you prepared to engage with a relevant counterparty if one is identified?**

1. Immediately — we are active right now
2. Within 30 Days — approaching readiness
3. Within 90 Days — in preparation
4. Exploring — no fixed timeline yet

Reply with the number or description."

RULES:
- Set is_complete=false. Do NOT close the mandate this turn — the server handles finalization.
- Do NOT repeat the authority question — it is already captured.
- Ask ONLY this one question. No follow-ups.
`.trim();

// ─────────────────────────────────────────────────────────────
// MODULE BUILDER — exported to promptRouter
// ─────────────────────────────────────────────────────────────

export function buildM8_MandateVerification(
  step: 'CONFIRMATION' | 'AUTHORITY' | 'READINESS' | 'MATERIALS' | 'COMPLETE' | null,
): string {
  switch (step) {
    case 'CONFIRMATION': return M8_CONFIRMATION;
    case 'READINESS':
    case 'MATERIALS': // legacy sessions at MATERIALS step — show readiness fallback
      return M8_READINESS;
    default: return M8_AUTHORITY; // AUTHORITY or null (first entry)
  }
}
