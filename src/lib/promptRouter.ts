/**
 * DealCollab Prompt Router
 * ========================
 * Canonical instruction set: V1 (base) + V2 additions + V3 additions
 *
 * Architecture:
 *   M0  Output schema          — always loaded
 *   M1  Core identity          — always loaded (./M1_coreIdentity)
 *   M2  Phase rules            — always loaded (./M2_phaseRules)
 *   M3  Intent qualification   — one sub-module per intent (./M3_intentFrameworks)
 *   M4  Sector intelligence    — one sub-module per sector (./M4_sectorIntel)
 *   M5  Deal matching          — loaded when is_sufficient=true (./M5_dealMatching)
 *   M6  Profile intelligence   — loaded when profile_search detected; replaces M3/M4/M5
 *
 * DB REQUIREMENT:
 *   ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS state JSONB DEFAULT '{}';
 */

import { M1_CORE_IDENTITY } from './M1_coreIdentity';
import { M2_PHASE_RULES } from './M2_phaseRules';
import { M3_MODULES } from './M3_intentFrameworks';
import { M4_MODULES, type SectorKey } from './M4_sectorIntel';
import { M5_DEAL_MATCHING } from './M5_matchingLayer';

export type { SectorKey };

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type DealIntent =
  | 'SELL_SIDE'
  | 'BUY_SIDE'
  | 'FUNDRAISING'
  | 'DEBT'
  | 'STRATEGIC_PARTNERSHIP'
  | null;

export type ConversationPhase =
  | 'ENTRY'
  | 'QUALIFICATION'
  | 'MOMENTUM'
  | 'CLOSURE'
  | 'MATCHING'
  | 'PROFILE_SEARCH';

export interface RouterState {
  intent: DealIntent;
  sector: SectorKey | null;
  sub_sector: string | null;
  geography: string | null;
  deal_size: string | null;
  revenue: string | null;
  structure: string | null;
  intent_focus: string | null;
  is_intermediary: boolean | null;  // null = not yet asked, true = advisor, false = owner
  industry_data: Record<string, unknown>;
  special_conditions: string[];
  is_sufficient: boolean;
  is_complete: boolean;
  is_profile_search: boolean;
  phase: ConversationPhase;
  turn_count: number;
  refinement_count: number;
}

export function createBlankState(): RouterState {
  return {
    intent: null,
    sector: null,
    sub_sector: null,
    geography: null,
    deal_size: null,
    revenue: null,
    structure: null,
    intent_focus: null,
    is_intermediary: null,
    industry_data: {},
    special_conditions: [],
    is_sufficient: false,
    is_complete: false,
    is_profile_search: false,
    phase: 'ENTRY',
    turn_count: 0,
    refinement_count: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// SPECIAL CONDITIONS EXTRACTOR
// Inline — no external dependency required
// ─────────────────────────────────────────────────────────────

function extractSpecialConditions(message: string): string[] {
  const lower = message.toLowerCase();
  const conditions: string[] = [];
  if (lower.includes('debt free') || lower.includes('debt-free') || lower.includes('no debt'))
    conditions.push('DEBT_FREE');
  if (lower.includes('roc compliant') || lower.includes('roc-compliant'))
    conditions.push('ROC_COMPLIANT');
  if (lower.includes('fssai') || lower.includes('fssai compliant'))
    conditions.push('FSSAI_COMPLIANT');
  if (lower.includes('no litigation') || lower.includes('litigation free'))
    conditions.push('LITIGATION_FREE');
  if (lower.includes('promoter exit') || lower.includes('full exit'))
    conditions.push('FULL_PROMOTER_EXIT');
  return conditions;
}

// ─────────────────────────────────────────────────────────────
// DETECTORS
// Keyword-based — run before LLM call on turn 1.
// Subsequent turns read from stored state.
// ─────────────────────────────────────────────────────────────

// IMPORTANT: 'hospital', 'clinic', 'healthcare' are in HOSPITALITY not PHARMA.
// A hospital being sold is a healthcare services deal. A pharma API plant is pharma.
// Keyword order in this record determines detection priority (first match wins).
const SECTOR_KEYWORDS: Record<SectorKey, string[]> = {
  pharma: ['pharma', 'pharmaceutical', 'api pharma', 'formulation', 'crams', 'cdmo',
    'diagnostics', 'medical device', 'drug'],
  manufacturing: ['manufactur', 'industrial', 'oem', 'plant', 'factory', 'auto component',
    'auto parts', 'precision engineering', 'casting', 'forging',
    // Steel / Cement / Automation absorbed here per M4 design decision
    'steel', 'tmt', 'rebar', 'foundry', 'rolling mill', 'metal', 'metallurgy',
    'cement', 'automation', 'iiot', 'robotics', 'industry 4.0', 'iot', 'sensors'],
  saas: ['saas', 'software', 'tech startup', 'arr', 'mrr', 'b2b software',
    'platform', 'mobile app', 'cloud', 'enterprise software'],
  finserv: ['nbfc', 'lending', 'fintech', 'financial service', 'insurance',
    'wealth management', 'aum', 'loan book', 'bfsi', 'microfinance',
    'payment', 'neo bank'],
  consumer: ['consumer brand', 'd2c', 'fmcg', 'retail brand', 'marketplace',
    'ecommerce', 'food brand', 'personal care', 'beauty', 'fashion'],
  realestate: ['real estate', 'property', 'land parcel', 'commercial property',
    'residential', 'warehousing asset', 'developer', 'reit'],
  logistics: ['logistics', 'supply chain', 'warehousing', 'freight', 'cold chain',
    '3pl', 'last mile', 'transport', 'fleet', 'cargo'],
  education: ['education', 'edtech', 'school', 'college', 'university', 'training',
    'skilling', 'k12', 'higher education', 'test prep', 'coaching'],
  chemicals: ['chemical', 'specialty chemical', 'agrochemical', 'pigment', 'dye',
    'polymer', 'adhesive', 'coating', 'fine chemical'],
  hospitality: ['hospitality', 'hotel', 'resort', 'restaurant', 'food service', 'qsr',
    'cafe', 'travel', 'tourism',
    // Healthcare services (hospital, clinic) belong here — not in pharma
    'hospital', 'clinic', 'healthcare', 'nursing home', 'multispeciality'],
  renewable: ['renewable', 'solar', 'wind', 'energy', 'epc', 'ipp', 'power plant',
    'green energy', 'ppa', 'biomass', 'hydro'],
  defence: ['defence', 'defense', 'aerospace', 'drdl', 'drdo', 'hal', 'military',
    'government tender', 'ordnance', 'security equipment'],
  agriculture: ['agriculture', 'farming', 'agro processing', 'dairy', 'packaged food',
    'fssai food', 'distillery', 'ethanol', 'milling', 'flour mill'],
  textiles: ['textiles', 'garments', 'fabric', 'apparel', 'fashion manufacturing',
    'weaving', 'knitting', 'spinning', 'narrow woven'],
  bpo: ['bpo', 'kpo', 'outsourcing', 'staffing', 'manpower', 'it staffing',
    'shared services', 'call center', 'facility management'],
  advertising: ['advertising', 'media house', 'ad agency', 'digital marketing', 'dooh',
    'adtech', 'branding agency', 'performance marketing'],
  ngo: ['ngo', 'trust', 'society', 'section 8', 'non-profit', 'non profit',
    '80g', '12a', 'fcra', 'nonprofit'],
  steel: ['steel', 'iron', 'tmt', 'rebar', 'foundry', 'rolling mill', 'metal', 'metallurgy'],
  automation: ['automation', 'iiot', 'robotics', 'industry 4.0', 'iot', 'sensors'],
  mixed: [],
};

const INTENT_KEYWORDS: Record<Exclude<DealIntent, null>, string[]> = {
  SELL_SIDE: ['sell', 'exit', 'divest', 'divestiture', 'find buyer', 'stake sale',
    'looking for buyer', 'want to sell', 'selling', 'full sale', 'for sell',
    'for sale'],
  BUY_SIDE: ['buy', 'acquire', 'acquisition', 'looking to buy', 'find target',
    'roll-up', 'platform acquisition', 'want to acquire', 'purchasing'],
  FUNDRAISING: ['raise', 'fundraise', 'funding', 'investor', 'equity funding', 'pe fund',
    'vc fund', 'growth capital', 'pre-ipo', 'series a', 'series b',
    'raise capital'],
  DEBT: ['debt', 'loan', 'working capital', 'ncd', 'structured finance',
    'credit facility', 'term loan', 'refinance', 'borrow'],
  STRATEGIC_PARTNERSHIP: ['partner', 'partnership', 'jv', 'joint venture', 'distribution partner',
    'strategic collaboration', 'tie-up', 'co-invest'],
};

const PROFILE_INTENT_KEYWORDS = [
  'find advisor', 'find banker', 'find consultant', 'find a professional', 'find an advisor',
  'need an advisor', 'looking for advisor', 'who can help', 'find someone who works in',
  'recommend a banker', 'recommend an advisor', 'looking for an m&a professional',
  'find a ca', 'find a lawyer', 'find a deal professional',
];

export function detectSectorFromText(text: string): SectorKey | null {
  const lower = text.toLowerCase();
  for (const [key, keywords] of Object.entries(SECTOR_KEYWORDS) as [SectorKey, string[]][]) {
    if (key === 'mixed') continue;
    if (keywords.some(kw => lower.includes(kw))) return key;
  }
  return null;
}

export function detectIntentFromText(text: string): DealIntent {
  const lower = text.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Exclude<DealIntent, null>, string[]][]) {
    if (keywords.some(kw => lower.includes(kw))) return intent;
  }
  return null;
}

export function detectProfileIntentFromText(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFILE_INTENT_KEYWORDS.some(kw => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────
// SUFFICIENCY CHECK
// FIX: `intent` alone does NOT count as a qualifying field.
// Intent identifies what the user wants to do — not deal structure.
// Structure requires the user to explicitly state deal type
// (full sale / majority stake / minority / full buyout etc.).
// This prevents premature MOMENTUM entry on turn 1 when the user
// provides only a one-liner like "I want to sell my hospital in Pune."
// ─────────────────────────────────────────────────────────────

function checkSufficiency(state: RouterState): boolean {
  const hasIndustrySignal = !!(state.sector || state.sub_sector);
  const qualifyingFields = [
    !!(state.revenue || state.deal_size),
    !!(state.structure),          // explicit structure only — NOT intent
    !!(state.geography),
  ].filter(Boolean).length;
  return hasIndustrySignal && qualifyingFields >= 2;
}

// ─────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────

export function updateStateFromExtraction(
  current: RouterState,
  extraction: {
    intent: DealIntent;
    is_intermediary?: boolean | null;
    state: Partial<RouterState>;
    is_complete: boolean;
    special_conditions?: string[];
  },
  currentMessage: string,
): RouterState {
  const updated: RouterState = { ...current };

  // Turn counter
  updated.turn_count = current.turn_count + 1;

  // Profile path detection (sticky — once set, stays for session)
  if (!updated.is_profile_search) {
    updated.is_profile_search = detectProfileIntentFromText(currentMessage);
  }

  // Merge extracted fields — never overwrite with null if value already exists
  if (extraction.intent) updated.intent = extraction.intent;
  if (extraction.state.sector) updated.sector = extraction.state.sector as SectorKey;
  if (extraction.state.sub_sector) updated.sub_sector = extraction.state.sub_sector as string;
  if (extraction.state.geography) updated.geography = extraction.state.geography as string;
  if (extraction.state.deal_size) updated.deal_size = extraction.state.deal_size as string;
  if (extraction.state.revenue) updated.revenue = extraction.state.revenue as string;
  if (extraction.state.structure) updated.structure = extraction.state.structure as string;
  if (extraction.state.intent_focus) updated.intent_focus = extraction.state.intent_focus as string;

  // is_intermediary: only update when LLM has a definitive answer (not null)
  const extractedIntermediary = extraction.is_intermediary ?? extraction.state.is_intermediary;
  if (extractedIntermediary !== undefined && extractedIntermediary !== null) {
    updated.is_intermediary = extractedIntermediary as boolean;
  }

  // industry_data: deep merge
  if (extraction.state.industry_data &&
    Object.keys(extraction.state.industry_data as object).length > 0) {
    updated.industry_data = {
      ...current.industry_data,
      ...(extraction.state.industry_data as object),
    };
  }

  // Keyword fallbacks (if LLM didn't extract, try keyword detection)
  if (!updated.sector) {
    const detected = detectSectorFromText(currentMessage);
    if (detected) updated.sector = detected;
  }
  if (!updated.intent) {
    const detected = detectIntentFromText(currentMessage);
    if (detected) updated.intent = detected;
  }

  // Special conditions: accumulate (never clear)
  const newConditions = [
    ...(extraction.special_conditions || []),
    ...extractSpecialConditions(currentMessage),
  ];
  if (newConditions.length > 0) {
    updated.special_conditions = Array.from(
      new Set([...current.special_conditions, ...newConditions]),
    );
  }

  // Sufficiency check (fixed — intent does not count as structure)
  updated.is_sufficient = checkSufficiency(updated);
  updated.is_complete = extraction.is_complete;

  // Refinement counter (only increments during MOMENTUM)
  if (current.phase === 'MOMENTUM') {
    updated.refinement_count = current.refinement_count + 1;
  }

  // Phase resolution
  updated.phase = resolvePhase(updated);

  // ── GUARD 1: Non-regressive sufficiency ──────────────────────
  // Once sufficient, never go back — prevents state corruption from
  // partial LLM extraction on follow-up turns.
  if (current.is_sufficient && !updated.is_sufficient && !updated.is_complete) {
    console.warn('[ROUTER GUARD] Prevented sufficiency regression — restoring is_sufficient=true');
    updated.is_sufficient = true;
    updated.phase = resolvePhase(updated); // re-resolve with corrected sufficiency
  }

  // ── GUARD 2: Phase lock (no backward movement) ───────────────
  // Prevents MOMENTUM → QUALIFICATION regression caused by
  // incomplete state extraction on a given turn.
  const PHASE_ORDER: ConversationPhase[] = [
    'ENTRY', 'QUALIFICATION', 'MOMENTUM', 'CLOSURE',
  ];
  const prevIdx = PHASE_ORDER.indexOf(current.phase);
  const nextIdx = PHASE_ORDER.indexOf(updated.phase);
  if (
    prevIdx > -1 &&
    nextIdx > -1 &&
    nextIdx < prevIdx &&
    updated.phase !== 'PROFILE_SEARCH' &&
    !updated.is_complete
  ) {
    console.warn(`[ROUTER GUARD] Prevented phase regression: ${current.phase} → ${updated.phase}`);
    updated.phase = current.phase;
  }

  return updated;
}

/**
 * Called when a document is uploaded and pre-parsed.
 * Seeds state from structured extraction so the bot skips
 * redundant questions on turn 1.
 */
export function initializeStateFromDocument(
  structuredData: Record<string, unknown>,
): RouterState {
  const state = createBlankState();

  const intent = structuredData.intent as DealIntent ?? null;
  const sector = structuredData.sector as string ?? '';
  const location = structuredData.geography as string ?? structuredData.location as string ?? '';

  if (intent) state.intent = intent;
  if (sector) state.sector = detectSectorFromText(sector);
  if (location) state.geography = location;

  if (structuredData.sub_sector) state.sub_sector = String(structuredData.sub_sector);
  if (structuredData.deal_size) state.deal_size = String(structuredData.deal_size);
  if (structuredData.revenue) state.revenue = String(structuredData.revenue);
  if (structuredData.structure) state.structure = String(structuredData.structure);

  if (structuredData.company_overview) {
    state.industry_data = {
      ...state.industry_data,
      company_overview: structuredData.company_overview,
    };
  }

  state.is_sufficient = checkSufficiency(state);
  state.phase = state.is_sufficient
    ? 'MOMENTUM'
    : (state.intent || state.sector ? 'QUALIFICATION' : 'ENTRY');

  return state;
}

function resolvePhase(state: RouterState): ConversationPhase {
  if (state.is_profile_search) return 'PROFILE_SEARCH';
  if (state.is_complete) return 'CLOSURE';
  if (state.is_sufficient && state.refinement_count >= 3) return 'CLOSURE';
  if (state.is_sufficient) return 'MOMENTUM';
  if (state.intent || state.sector) return 'QUALIFICATION';
  return 'ENTRY';
}

// ─────────────────────────────────────────────────────────────
// M0 — Output Schema (always loaded, inline)
// ─────────────────────────────────────────────────────────────

const M0_OUTPUT_SCHEMA = `
# OUTPUT CONTRACT (non-negotiable)
Return ONLY valid JSON. No preamble, no markdown, no fences.
{
  "intent": "SELL_SIDE"|"BUY_SIDE"|"FUNDRAISING"|"DEBT"|"STRATEGIC_PARTNERSHIP"|null,
  "is_intermediary": true|false|null,
  "state": {
    "sector":            string|null,
    "sub_sector":        string|null,
    "geography":         string|null,
    "deal_size":         string|null,
    "revenue":           string|null,
    "structure":         string|null,
    "intent_focus":      string|null,
    "industry_data":     {}
  },
  "is_complete":         boolean,
  "special_conditions":  string[],
  "message":             "YOUR FULL RESPONSE TEXT HERE"
}

Extraction rules:
• Extract every available field from the conversation. Never leave a field null if information is present.
• "structure" = explicit deal type stated by user (e.g. "full sale", "majority stake", "minority"). Do NOT populate from intent alone.
• "is_intermediary": true if user identifies as advisor/banker/CA; false if owner/promoter; null if not yet established.
• "special_conditions": array of flags like DEBT_FREE, ROC_COMPLIANT, LITIGATION_FREE — only when user explicitly states them.

# LIVE INTENT PRIORITY
1. The current user message takes precedence over all prior context and documents.
2. If the user shifts direction (sell → buy, new sector), follow the new intent immediately.
3. Use prior document context only to avoid re-asking already-answered questions.
`.trim();

// ─────────────────────────────────────────────────────────────
// M6 — Profile Intelligence (conditional, inline)
// Loaded ONLY when is_profile_search = true
// Replaces M3 / M4 / M5 entirely on this path
// ─────────────────────────────────────────────────────────────

const M6_PROFILE_INTELLIGENCE = `
# PROFILE INTELLIGENCE MODE
The user is looking for a professional, advisor, or deal partner — not submitting a deal mandate.
This path is completely separate from deal qualification. Do NOT ask deal qualification questions here.

## Your role in this mode
Match the user's requirement to professional profiles in the DealCollab network based on:
- Sector expertise (primary sectors declared in their Deal Identity)
- Deal focus (buy-side, sell-side, fundraising, debt, strategic)
- Active geographies
- Professional category (M&A advisor, PE professional, investment banker, CA/CS, legal, corporate strategist)
- Co-advisory preference and collaboration model

## Qualification questions for profile search
Ask grouped, in one interaction:
"To find the right professional for your requirement, share:
• What type of professional are you looking for? (M&A advisor, investment banker, PE professional, legal, CA)
• Which sector is this for?
• Geography preference?
• Nature of engagement — one-time advisory, ongoing retainer, or transaction-specific?"

## Profile presentation rules
- Present profiles anonymously first: role + sector + geography + deal focus. No name or firm until connection is approved.
- Frame as: "We have [X] professionals in our network aligned to your requirement."
- Readiness Score acts as a trust signal — higher score = more active and credible on the platform.
- Invite connection: "Would you like to connect with any of these profiles?"

## Output
Set intent_focus = "PROFILE_SEARCH" in the JSON output.
is_complete = true only after user has been presented with profiles and shown intent to connect.
`.trim();

// ─────────────────────────────────────────────────────────────
// ROUTER — Main composition function
// Called once per request in the route handler
// ─────────────────────────────────────────────────────────────

export interface RouterOutput {
  systemPrompt: string;
  phase: ConversationPhase;
  modulesLoaded: string[];
  tokenEstimate: number;
}

export function buildSystemPrompt(
  state: RouterState,
  matchedMandates: string | null,
): RouterOutput {
  const modules: Array<{ key: string; content: string }> = [];

  // M0 + M1 + M2 — always loaded
  modules.push({ key: 'M0_output_schema', content: M0_OUTPUT_SCHEMA });
  modules.push({ key: 'M1_core_identity', content: M1_CORE_IDENTITY });
  modules.push({ key: 'M2_phase_rules', content: M2_PHASE_RULES });

  if (state.is_profile_search || state.phase === 'PROFILE_SEARCH') {
    // Profile path — M3/M4/M5 excluded
    modules.push({ key: 'M6_profile_intelligence', content: M6_PROFILE_INTELLIGENCE });
  } else {
    // Deal path

    // M3 — intent qualification (load once intent is known)
    if (state.intent && M3_MODULES[state.intent]) {
      modules.push({ key: `M3_${state.intent}`, content: M3_MODULES[state.intent] });
    }

    // M4 — sector intelligence (load once sector is known)
    if (state.sector && M4_MODULES[state.sector]) {
      modules.push({ key: `M4_${state.sector}`, content: M4_MODULES[state.sector] });
    }

    // M5 — load whenever is_sufficient=true.
    // M5 internally handles both match-found and no-match states.
    // Data is injected as a separate block so M5 module stays static.
    if (state.is_sufficient) {
      const dataBlock = matchedMandates && matchedMandates.trim().length > 0
        ? `## MATCHED MANDATES (from L5)\n${matchedMandates}`
        : `## MATCH STATUS: NOT_FOUND`;
      modules.push({
        key: 'M5_matching',
        content: M5_DEAL_MATCHING + '\n\n' + dataBlock,
      });
    }
  }

  const detectedFields = [
    state.intent   ? `INTENT: ${state.intent}`   : null,
    state.sector   ? `SECTOR: ${state.sector}`   : null,
    state.geography? `GEOGRAPHY: ${state.geography}` : null,
    state.deal_size? `DEAL SIZE: ${state.deal_size}` : null,
    state.revenue  ? `REVENUE: ${state.revenue}` : null,
  ].filter(Boolean).join(' | ');

  const phaseInstruction =
    state.phase === 'ENTRY' && detectedFields
      ? `Direct mandate received. DO NOT greet or delay. Start qualification NOW.\nAlready known: ${detectedFields}\nDo NOT re-ask these fields. Ask only what is missing from M3 and M4.`
    : state.phase === 'ENTRY'
      ? `No mandate yet. Ask the ENTRY greeting per M2 rules.`
    : state.phase === 'QUALIFICATION'
      ? `Pre-sufficiency. Ask grouped M3 + M4 questions. Do not repeat already-known fields: ${detectedFields || 'none'}.`
    : state.phase === 'MOMENTUM'
      ? `Post-sufficiency. Follow 4-step MOMENTUM format. One refinement question max.`
    : state.phase === 'CLOSURE'
      ? `Deliver closure message verbatim. Session complete. Redirect new requirements to fresh conversation.`
    : state.phase === 'PROFILE_SEARCH'
      ? `Profile search mode. Use M6 rules only. Do not ask deal qualification questions.`
    : `Unknown phase. Default to qualification mode.`;

  const phaseContext = `
# EXECUTION CONTEXT (read before responding)
PHASE: ${state.phase}
TURN: ${state.turn_count + 1}
REFINEMENTS USED: ${state.refinement_count}/3
IS_SUFFICIENT: ${state.is_sufficient}
IS_INTERMEDIARY: ${state.is_intermediary ?? 'not yet established'}
${(state.special_conditions?.length ?? 0) > 0 ? `SPECIAL CONDITIONS: ${state.special_conditions?.join(', ')}` : ''}

INSTRUCTION: ${phaseInstruction}

# TONE & VERBOSITY RULES
- Turn 1 only: you may briefly acknowledge what you are. All subsequent turns: skip self-description entirely.
- Only mention confidentiality if the user expresses hesitation or M2 phase rules require it.
- Never say "I hope this helps", "Great to hear", "Absolutely", or any filler affirmation.
- Be sharp, transactional, and direct.
`.trim();

  const systemPrompt = [
    phaseContext,
    ...modules.map(m => m.content),
  ].join('\n\n---\n\n');

  const tokenEstimate = Math.round(systemPrompt.length / 4);

  return {
    systemPrompt,
    phase: state.phase,
    modulesLoaded: modules.map(m => m.key),
    tokenEstimate,
  };
}

// ─────────────────────────────────────────────────────────────
// USAGE IN route.ts
// ─────────────────────────────────────────────────────────────

/*

STEP 1 — Add state column to DB (run once):
  ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS state JSONB DEFAULT '{}';

STEP 2 — Replace getSystemPrompt() in your POST handler:

  import {
    buildSystemPrompt,
    updateStateFromExtraction,
    createBlankState,
    type RouterState,
  } from '@/lib/promptRouter';

  // Read stored state (or blank on first turn):
  const storedState: RouterState =
    (existingSession?.state as RouterState) ?? createBlankState();

  // Build system prompt BEFORE the LLM call:
  const { systemPrompt, modulesLoaded, tokenEstimate } =
    buildSystemPrompt(storedState, matchedMandatesStr ?? null);

  console.log(`[ROUTER] Modules: ${modulesLoaded.join(', ')} | ~${tokenEstimate} tokens`);

  // Pass systemPrompt into processIntelligence():
  const extraction = await processIntelligence(
    message, formattedHistory, documentText, systemPrompt
  );

  // Update and persist state:
  const updatedState = updateStateFromExtraction(storedState, extraction, message);
  await supabase
    .from('chat_sessions')
    .update({ state: updatedState })
    .eq('id', activeChatId);

STEP 3 — Delete the old getSystemPrompt() from route.ts entirely.
          The promptRouter owns all prompt logic now.

STEP 4 — Ensure these module files exist at the same path level:
  ./M1_coreIdentity.ts    (exports M1_CORE_IDENTITY: string)
  ./M2_phaseRules.ts      (exports M2_PHASE_RULES: string)
  ./M3_intentFrameworks.ts (exports M3_MODULES: Record<DealIntent, string>)
  ./M4_sectorIntel.ts     (exports M4_MODULES: Record<SectorKey, string>, SectorKey type)
  ./M5_dealMatching.ts    (exports M5_DEAL_MATCHING: string)

*/