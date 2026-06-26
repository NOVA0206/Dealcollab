export const M_INTENT_REASONING = `
# INTENT — REASON, DO NOT PATTERN-MATCH

Decide the user's intent by reasoning about their ROLE and the DIRECTION of the deal, never by
spotting words like "sell", "exit", "fund", or "invest". Ask: relative to the business or asset in
question, what is this party trying to do?

- BUY_SIDE — acquire, invest into, or take a stake in someone else's business OR asset (a strategic
  acquirer, a roll-up, OR a PE/VC fund / financial sponsor deploying capital into targets).
- SELL_SIDE — sell, divest, or exit their OWN business or a stake in it.
- FUNDRAISING — raise capital INTO their own business from investors (equity / growth capital).
- DEBT — borrow or raise structured debt for their own business.
- STRATEGIC_PARTNERSHIP — a JV, alliance, or commercial partnership, with no change of ownership.

## How to resolve intent — apply in THIS order, highest signal wins:
1. EXPLICIT STATEMENT — what the user directly says they want to do.
2. CLIENT'S OBJECTIVE — if the user is an intermediary acting for a client / promoter / investor /
   lender, infer intent from the UNDERLYING party's goal. "Our client wants to sell a pharma
   company" → SELL_SIDE. "We represent a PE fund seeking acquisitions" → BUY_SIDE.
3. CAPITAL-FLOW TEST — who RECEIVES the capital?
   Into the user's own business → FUNDRAISING.
   Out of the user, into external businesses → BUY_SIDE.
   "Looking for investors for our company" → FUNDRAISING.
   "Looking to invest in manufacturing businesses" → BUY_SIDE.
4. DEAL NARRATIVE / ACTOR — actions about the TARGET are not the user's intent.
   "Seeking businesses where promoters are exiting" → user is ACQUIRING → BUY_SIDE.
5. DOCUMENT SHAPE — a detailed multi-section profile of ONE business (overview + financials +
   products + customers) → user presenting THEIR OWN business → SELL_SIDE or FUNDRAISING.
   A short thesis / investment-criteria / requirements note → a BUYER's brief → BUY_SIDE.
6. KEYWORDS — last resort only. Never let a single word override signals 1–5.

## Acquiring an asset is BUY_SIDE
Acquiring a business, asset, licence, brand, plant, shell company, hospital, distribution network,
IP, or business unit is BUY_SIDE — whatever the object.
"Looking for an NBFC licence" / "a pharma manufacturing plant" / "a shell company" → BUY_SIDE.

## Flavor — BUY_SIDE only
- intent_flavor = "financial" — PE/VC fund, financial sponsor, or family office deploying capital.
  Address in INVESTOR language ("investment", "opportunities", "portfolio"), not "buyer" language.
- intent_flavor = "strategic" — operating company or strategic acquirer.
- Every non-BUY_SIDE intent → intent_flavor = null.

## FIELD INFERENCE FROM FIRST MESSAGE
Extract every structured field you can from the VERY FIRST message — do not ask what is already
stated. Apply these inference rules silently before generating any question:

GEOGRAPHY — extract from:
  "company in Pune" / "based in Mumbai" / "located in Hyderabad" / "Delhi NCR" → geography
  "pan-India" / "across India" / "nationally" → geography = "India"
  "South India" / "Western India" → geography = that region

STRUCTURE — extract from:
  "want to buy 100%" / "full buyout" / "complete acquisition" → "100% acquisition"
  "majority stake" / "controlling interest" → "majority stake"
  "minority stake" / "15% equity" / "25% shares" → "minority stake — X%"
  "partial exit" / "partial stake sale" → "partial stake"

DEAL SIZE / TICKET — extract from:
  "₹50–100 Cr deal" / "ticket ₹75 Cr" / "around ₹200 Cr valuation" → deal_size
  "mid-market" → deal_size = implied ₹50–250 Cr (record as such)
  "large cap" / "enterprise" → deal_size = ₹500 Cr+
  "SME" / "MSME" / "small company" → deal_size = implied ₹5–50 Cr

REVENUE — extract from:
  "₹40 Cr topline" / "turnover ₹60 Cr" / "revenue ~₹80 Cr" → revenue
  "18% EBITDA on ₹100 Cr" → revenue = ₹100 Cr, EBITDA margin = 18%

STRATEGIC INTENT — extract from:
  "succession issue" / "next gen not interested" → intent_focus = founder succession exit
  "expanding geographically" / "entering South India" → strategic_intent = geo expansion
  "consolidation play" / "roll-up strategy" → strategic_intent = consolidation / roll-up
  "IP / tech acquisition" / "buying for the brand" → strategic_intent = IP/brand acquisition
  "capacity addition" / "adding manufacturing" → strategic_intent = capacity expansion

Store all inferred fields immediately. Do NOT ask for a field you have already inferred.

## Confidence and commit
Output intent_confidence (0–100):
- 80–100 — clear; proceed.
- 50–79 — proceed, but stay open to correction.
- 0–49 — do NOT guess: ask ONE short question to establish buy / sell / raise / borrow / partner.
Score 50 or below whenever TWO different intents are both plausible.
Always output a one-line intent_rationale naming the role and direction you inferred.
Set intent = null ONLY for a bare greeting with no stated goal.

## Stability
Once intent is set, PRESERVE it. Change ONLY when the user EXPLICITLY states a different objective
and set intent_changed = true. Any change without intent_changed = true will be treated as drift.
`.trim();
