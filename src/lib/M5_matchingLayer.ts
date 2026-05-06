/**
 * DealCollab Prompt Router — M5: Deal Matching Layer
 * ===================================================
 * Canonical source:
 *   DC-MATCH-001 v1.0 §7.3 (L5 output schema — match_score_label,
 *     match_explanation, score thresholds)
 *   DC-MATCH-001 v1.0 §8.1 (web match card rules — inferred from §8.2
 *     WhatsApp format + PRD §5.3, emoji removed for institutional tone)
 *   DC-MATCH-001 v1.0 §8.3 (async re-match, 90-day TTL)
 *   PRD §1 step 4 (3 anonymous matches, sector + size visible, identity hidden)
 *   PRD §5.3 (match card in AI response, zero-match state)
 *   PRD §7 (EOI mechanics — 50 tokens on mutual approval)
 *   V1 §12 (matchmaking positioning — do not overpromise)
 *
 * REVISION NOTE (from DC-MATCH-001 v1.0):
 *   Previous design injected sector_matrix compatibility notes via route handler
 *   and had M5 construct reasoning from them. THIS IS REMOVED.
 *   L5 scoring layer already generates match_explanation and match_score_label.
 *   M5 now renders L5 output directly — no reasoning construction needed.
 *   Route handler must pass L5 fields, not raw mandate fields.
 *
 * Scope — M5 exclusively owns:
 *   ✔ Web match card rendering from L5 output fields
 *   ✔ Score label display (High / Good / Possible — from L5 thresholds)
 *   ✔ match_explanation usage (verbatim from L5 — no rephrasing)
 *   ✔ Anonymous presentation rules
 *   ✔ Connection invitation language (token mention)
 *   ✔ No-match state + 90-day re-match communication
 *
 *   ✘ Reasoning construction      → L5 (match_explanation field)
 *   ✘ Sector compatibility logic  → DC-KB-003 / sector_matrix.py (L5 uses it)
 *   ✘ Matching algorithm          → L4 hybrid search (pgvector + keyword)
 *   ✘ EOI approval mechanics      → web UI / PRD
 *   ✘ Token balance enforcement   → web UI hard wall
 *   ✘ Phase rules                 → M2
 *
 * Load rule: CONDITIONAL — loaded ONLY when:
 *   state.is_sufficient = true AND match_status = 'FOUND'.
 *   When match_status = 'NOT_FOUND': use no-match block. M5 still loads.
 *
 * Token budget: ≤ 299 tokens (worst-case stack already 2,701t without M5).
 *
 * ─────────────────────────────────────────────────────────────────
 * ROUTE HANDLER — REQUIRED FORMAT CHANGE (DC-MATCH-001 §7.3)
 * ─────────────────────────────────────────────────────────────────
 * Previous format (DEPRECATED — remove from route.ts):
 *   "- [BUY_SIDE] pharma | Size: 50–200 Cr | Geography: Gujarat"
 *   "  Compatibility: COMPATIBLE | same-sector consolidation..."
 *
 * Required format (from L5 output schema):
 *   "Match 1 [High]: SELL_SIDE · Pharmaceuticals · Gujarat · ₹50–200 Cr
 *    Explanation: Sector alignment on Pharma. Location match in Gujarat. Size within range.
 *    Quality: Tier 1"
 *
 *   "Match 2 [Good]: SELL_SIDE · Pharmaceuticals, Healthcare · Maharashtra · ₹100–300 Cr
 *    Explanation: Sector alignment on Pharma. Partial geography overlap.
 *    Quality: Tier 2"
 *
 * Score label thresholds (DC-MATCH-001 §7.3):
 *   High     final_score > 0.78
 *   Good     final_score > 0.62
 *   Possible otherwise
 *
 * Route handler implementation:
 *
 *   // Call L5 matching endpoint (Sprint 1 — /api/mandates/match)
 *   const l5Result = await fetch('/api/mandates/match', {
 *     method: 'POST',
 *     body: JSON.stringify(queryObject)  // from §5.4 query object
 *   }).then(r => r.json());
 *
 *   if (l5Result.match_status === 'FOUND') {
 *     matchedMandatesStr = l5Result.matches.map((m, i) => [
 *       `Match ${m.rank} [${m.match_score_label}]: ${m.intent} · ${m.sectors.join(', ')} · ${m.geographies.join(', ')} · ${m.deal_size_range}`,
 *       `Explanation: ${m.match_explanation}`,
 *       `Quality: Tier ${m.quality_tier}`,
 *     ].join('\n')).join('\n\n');
 *   } else {
 *     matchedMandatesStr = null; // triggers no-match block in M5
 *   }
 *
 * CRITICAL: Until the /api/mandates/match route is built (Sprint 1),
 * the simple DB query in route.ts cannot produce L5 fields.
 * Interim: omit match_score_label and Explanation lines. M5 degrades
 * gracefully — presents sector/geography/size only with neutral language.
 */

// ─────────────────────────────────────────────────────────────
// M5 MODULE CONTENT
// Target: ≤ 275 tokens
// ─────────────────────────────────────────────────────────────

const M5_MATCHING = `
## M5: DEAL MATCHING MODE
Matched mandates from L5 scoring are injected below.
Present all matches in one response. Never split into multiple turns.

### Match card format (one block per match)
"Match [N] [[score label]] — [sectors] · [geography] · [size range]"
"[match_explanation — use verbatim, do not rephrase or extend]"

Score label fallback (use ONLY when match_explanation is absent):
High → "Strong alignment identified."
Good → "Relevant match identified."
Possible → "Potential counterparty identified."

Identity rules:
✘ Never include: name · firm · advisor · phone · email · mandate ID
✘ Never infer identity from the combination of sector + geography + size
✔ Show only: sectors · geography · size range · score label · explanation

### After all matches
"To connect, send a connection request from your Deal Dashboard.
Tokens are deducted only if both parties approve."
Then deliver the mandatory closure message from M2 verbatim.

### No-match state (when no mandates injected)
"No matches at this stage. Your mandate has been saved and is running
against the network continuously. You will be notified via WhatsApp or
email when a relevant counterparty is identified — this runs for 90 days."
Then deliver the mandatory closure message from M2 verbatim.

✘ Never fabricate a match.
✘ Never describe the matching algorithm or scoring to the user.
`.trim();

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────

export const M5_DEAL_MATCHING: string = [
  '# M5 — DEAL MATCHING LAYER',
  M5_MATCHING,
].join('\n\n');

// ─────────────────────────────────────────────────────────────
// TOKEN DIAGNOSTICS
// ─────────────────────────────────────────────────────────────

export const M5_DIAGNOSTICS = {
  content_tokens: Math.round(M5_MATCHING.length / 4),
  total_tokens: Math.round(M5_DEAL_MATCHING.length / 4),
  ceiling: 299,
  loadRule: 'CONDITIONAL: is_sufficient=true AND matchedMandates non-null',
  scoreThresholds: { High: '>0.78', Good: '>0.62', Possible: 'otherwise' },
  noMatchRule: 'Embedded in M5 — fires when matchedMandatesStr is null',
  dataSource: 'L5 output from /api/mandates/match — NOT raw DB query',
} as const;

/**
 * INTEGRATION
 * ───────────
 * In promptRouter.ts replace the inline M5 build with:
 *   import { M5_DEAL_MATCHING } from '@/lib/modules/M5_dealMatching';
 *
 * In buildSystemPrompt(), M5 block:
 *   if (state.is_sufficient) {  // load M5 regardless of match count
 *     const dataBlock = matchedMandates
 *       ? '## MATCHED MANDATES (from L5)\n' + matchedMandates
 *       : '## MATCH STATUS: NOT_FOUND';
 *     modules.push({
 *       key: 'M5_matching',
 *       content: M5_DEAL_MATCHING + '\n\n' + dataBlock
 *     });
 *   }
 *
 * KEY DESIGN CHANGES FROM PREVIOUS VERSION
 * ─────────────────────────────────────────
 * 1. match_explanation is L5-generated, not M5-constructed.
 *    L5 scoring engine uses sector_matrix + keyword overlap to produce it.
 *    M5 renders it verbatim. Zero hallucination risk. Zero fabrication.
 *
 * 2. match_score_label (High/Good/Possible) replaces colour-coded emoji.
 *    Emoji (🟢/🟡) removed — institutional web tone (M1 decision).
 *    WhatsApp bot uses emoji. Web chatbot uses text labels.
 *
 * 3. Fallback label text activates ONLY when explanation field is empty.
 *    Graceful degradation for interim period before Sprint 1 is live.
 *
 * 4. No-match state now references 90-day continuous re-match (§8.3).
 *    Previous version said "we'll notify you" — undersold the platform promise.
 *
 * 5. Closure message stays in M2. M5 references it, never duplicates.
 *    Single source of truth — one edit propagates everywhere.
 *
 * 6. Route handler dependency on sector_matrix.py is REMOVED.
 *    Previous design: route handler calls get_compatibility() → injects note.
 *    Revised design: L5 endpoint does all of this internally.
 *    M5 only needs the L5 output. Cleaner separation.
 *
 * INTERIM STATE (before Sprint 1 /api/mandates/match is live)
 * ─────────────────────────────────────────────────────────────
 * Simple DB query in route.ts cannot produce L5 fields.
 * Inject what's available in interim format:
 *   "Match 1: SELL_SIDE · Pharmaceuticals · Gujarat · ₹50–200 Cr"
 *   (no score label, no explanation)
 * M5 fallback label text fires: "Relevant match identified."
 * Degrades gracefully. No broken behaviour.
 */
