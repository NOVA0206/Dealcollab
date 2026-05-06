/**
 * DealCollab Prompt Router
 * ========================
 * Canonical instruction set: V1 (base) + V2 additions + V3 additions
 */

import { INTENT_SYNONYMS, SECTOR_SYNONYMS } from './dealDictionary';
import { M1_CORE_IDENTITY } from './M1_coreIdentity';
import { M2_PHASE_RULES } from './M2_phaseRules';
import { M3_MODULES } from './M3_intentFrameworks';
import { M4_MODULES } from './M4_sectorIntel';
import { extractSpecialConditions } from './normalizeMessage';
import {
  ConversationPhase,
  DealIntent,
  RouterState,
  SectorKey
} from './types';

export { type ConversationPhase, type DealIntent, type RouterState, type SectorKey };

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
    industry_data: {},
    is_sufficient: false,
    is_complete: false,
    is_profile_search: false,
    phase: 'ENTRY',
    turn_count: 0,
    refinement_count: 0,
    special_conditions: [],
  };
}

// ─────────────────────────────────────────────────────────────
// DETECTORS
// ─────────────────────────────────────────────────────────────

const SECTOR_KEYWORDS: Record<SectorKey, string[]> = {
  pharma: ['pharma', 'pharmaceutical', 'api pharma', 'formulation', 'crams', 'cdmo', 'hospital', 'clinic', 'healthcare', 'diagnostics', 'medical device', 'drug'],
  manufacturing: ['manufactur', 'industrial', 'oem', 'plant', 'factory', 'auto component', 'auto parts', 'defence manufactur', 'defense manufactur', 'precision engineering', 'casting', 'forging'],
  saas: ['saas', 'software', 'tech startup', 'arrmrr', 'arr', 'mrr', 'b2b software', 'platform', 'app', 'mobile app', 'cloud', 'enterprise software'],
  finserv: ['nbfc', 'lending', 'fintech', 'financial service', 'insurance', 'wealth management', 'aum', 'loan book', 'bfsi', 'microfinance', 'payment', 'neo bank'],
  consumer: ['consumer brand', 'd2c', 'fmcg', 'retail', 'brand', 'marketplace', 'ecommerce', 'food brand', 'personal care', 'beauty', 'fashion'],
  realestate: ['real estate', 'property', 'land', 'infrastructure', 'commercial property', 'residential', 'warehousing asset', 'developer', 'reit'],
  logistics: ['logistics', 'supply chain', 'warehousing', 'freight', 'cold chain', '3pl', 'last mile', 'transport', 'fleet', 'cargo'],
  education: ['education', 'edtech', 'school', 'college', 'university', 'training', 'skilling', 'k12', 'higher education', 'test prep', 'coaching'],
  chemicals: ['chemical', 'specialty chemical', 'agrochemical', 'pigment', 'dye', 'polymer', 'adhesive', 'coating', 'fine chemical'],
  hospitality: ['hospitality', 'hotel', 'restaurant', 'food service', 'qsr', 'cafe', 'resort', 'travel', 'tourism'],
  renewable: ['renewable', 'solar', 'wind', 'energy', 'epc', 'ipp', 'power plant', 'green energy', 'ppa', 'biomass', 'hydro'],
  defence: ['defence', 'defense', 'aerospace', 'drdl', 'drdo', 'hal', 'military', 'government tender', 'ordnance', 'security equipment'],
  steel: ['steel', 'iron', 'tmt', 'rebar', 'foundry', 'rolling mill', 'metal', 'metallurgy'],
  automation: ['automation', 'iiot', 'robotics', 'industry 4.0', 'iot', 'sensors', 'control system'],
  bpo: ['bpo', 'kpo', 'bpm', 'outsourcing', 'customer support', 'back office', 'shared services'],
  mixed: [],
};

const INTENT_KEYWORDS: Record<Exclude<DealIntent, null>, string[]> = {
  SELL_SIDE: ['sell', 'exit', 'divest', 'divestiture', 'find buyer', 'stake sale', 'looking for buyer', 'want to sell', 'selling', 'full sale'],
  BUY_SIDE: ['buy', 'acquire', 'acquisition', 'looking to buy', 'find target', 'roll-up', 'platform acquisition', 'want to acquire', 'purchasing'],
  FUNDRAISING: ['raise', 'fundraise', 'funding', 'investor', 'equity', 'pe fund', 'vc fund', 'growth capital', 'pre-ipo', 'series a', 'series b', 'raise capital'],
  DEBT: ['debt', 'loan', 'working capital', 'ncd', 'structured finance', 'credit facility', 'term loan', 'refinance', 'borrow'],
  STRATEGIC_PARTNERSHIP: ['partner', 'partnership', 'jv', 'joint venture', 'distribution partner', 'strategic collaboration', 'tie-up', 'co-invest'],
};

const PROFILE_INTENT_KEYWORDS = [
  'find advisor', 'find banker', 'find consultant', 'find a professional', 'find an advisor',
  'need an advisor', 'looking for advisor', 'who can help', 'find someone who works in',
  'recommend a banker', 'recommend an advisor', 'looking for an m&a professional',
  'find a ca', 'find a lawyer', 'find a deal professional',
];

export function detectSectorFromText(text: string): SectorKey | null {
  const lower = text.toLowerCase().trim();
  if (SECTOR_SYNONYMS[lower]) return SECTOR_SYNONYMS[lower];
  for (const [key, keywords] of Object.entries(SECTOR_KEYWORDS) as [SectorKey, string[]][]) {
    if (key === 'mixed') continue;
    if (keywords.some(kw => lower.includes(kw))) return key;
  }
  return null;
}

export function detectIntentFromText(text: string): DealIntent {
  const lower = text.toLowerCase().trim();
  if (INTENT_SYNONYMS[lower]) return INTENT_SYNONYMS[lower];
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
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────

export function updateStateFromExtraction(
  current: RouterState,
  extraction: {
    intent: DealIntent;
    state: Partial<RouterState>;
    is_complete: boolean;
  },
  currentMessage: string,
  preDetectedConditions?: string[]
): RouterState {
  const updated: RouterState = { ...current };
  updated.turn_count = current.turn_count + 1;

  if (!updated.is_profile_search) {
    updated.is_profile_search = detectProfileIntentFromText(currentMessage);
  }

  if (extraction.intent) updated.intent = extraction.intent;
  if (extraction.state.sector) updated.sector = extraction.state.sector as SectorKey;
  if (extraction.state.sub_sector) updated.sub_sector = extraction.state.sub_sector as string;
  if (extraction.state.geography) updated.geography = extraction.state.geography as string;
  if (extraction.state.deal_size) updated.deal_size = extraction.state.deal_size as string;
  if (extraction.state.revenue) updated.revenue = extraction.state.revenue as string;
  if (extraction.state.structure) updated.structure = extraction.state.structure as string;
  if (extraction.state.intent_focus) updated.intent_focus = extraction.state.intent_focus as string;
  if (extraction.state.industry_data && Object.keys(extraction.state.industry_data as object).length > 0) {
    updated.industry_data = { ...current.industry_data, ...(extraction.state.industry_data as object) };
  }

  if (!updated.sector) {
    const detected = detectSectorFromText(currentMessage);
    if (detected) updated.sector = detected;
  }
  if (!updated.intent) {
    const detected = detectIntentFromText(currentMessage);
    if (detected) updated.intent = detected;
  }


  const hasIndustrySignal = !!(updated.sector || updated.sub_sector);
  const qualifyingFields = [
    !!(updated.revenue || updated.deal_size),
    !!(updated.structure || updated.intent),
    !!(updated.geography),
  ].filter(Boolean).length;
  updated.is_sufficient = hasIndustrySignal && qualifyingFields >= 2;
  updated.is_complete = extraction.is_complete;
  updated.phase = resolvePhase(updated);

  if (current.phase === 'MOMENTUM') {
    updated.refinement_count = current.refinement_count + 1;
  }

  const newConditions = preDetectedConditions || extractSpecialConditions(currentMessage);
  if (newConditions.length > 0) {
    updated.special_conditions = [...new Set([...current.special_conditions, ...newConditions])];
  }

  return updated;
}

export function initializeStateFromDocument(structuredData: Record<string, unknown>): RouterState {
  const state = createBlankState();
  const intent = (structuredData.intent || structuredData.transaction_type) as DealIntent;
  const sector = (structuredData.sector || structuredData.industry) as string;
  const location = (structuredData.geography || structuredData.location) as string;

  if (intent) state.intent = intent;
  if (sector) state.sector = detectSectorFromText(sector);
  if (location) state.geography = location;

  if (structuredData.sub_sector) state.sub_sector = String(structuredData.sub_sector);
  if (structuredData.deal_size) state.deal_size = String(structuredData.deal_size);
  if (structuredData.revenue) state.revenue = String(structuredData.revenue);
  if (structuredData.structure) state.structure = String(structuredData.structure);

  if (structuredData.company_overview) {
    state.industry_data = { ...state.industry_data, company_overview: structuredData.company_overview };
  }

  const hasIndustrySignal = !!(state.sector || state.sub_sector);
  const qualifyingFields = [
    !!(state.revenue || state.deal_size),
    !!(state.structure || state.intent),
    !!(state.geography),
  ].filter(Boolean).length;

  state.is_sufficient = hasIndustrySignal && qualifyingFields >= 2;
  state.phase = state.is_sufficient ? 'MOMENTUM' : (state.intent || state.sector ? 'QUALIFICATION' : 'ENTRY');
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
// MODULE STRINGS
// ─────────────────────────────────────────────────────────────

const M0_OUTPUT_SCHEMA = `
# OUTPUT CONTRACT (non-negotiable)
Return ONLY valid JSON. No preamble, no markdown, no fences.
{
  "intent": "SELL_SIDE"|"BUY_SIDE"|"FUNDRAISING"|"DEBT"|"STRATEGIC_PARTNERSHIP"|null,
  "state": {
    "sector":       string|null,
    "sub_sector":   string|null,
    "geography":    string|null,
    "deal_size":    string|null,
    "revenue":      string|null,
    "structure":    string|null,
    "intent_focus": string|null,
    "industry_data": {}
  },
  "is_complete": boolean,
  "message": "YOUR FULL RESPONSE TEXT HERE",
  "special_conditions": ["DEBT_FREE", "ROC_COMPLIANT"]
}
Extract every available field from the conversation. Never leave a field null if the information is present.
`.trim();

// M2 Phase Rules removed (now imported from ./M2_phaseRules)

// M4 Sector Intelligence removed (now imported from ./M4_sectorIntel)

const M6_PROFILE_INTELLIGENCE = `# PROFILE INTELLIGENCE MODE\nRole: Match professional profiles based on sector, deal focus, and geography.`;

function buildM5_Matching(matchedMandates: string): string {
  return `# DEAL MATCHING MODE\nMatches found:\n${matchedMandates}\nRules: Explain relevance, maintain anonymity, invite interest.`.trim();
}

export interface RouterOutput {
  systemPrompt: string;
  phase: ConversationPhase;
  modulesLoaded: string[];
  tokenEstimate: number;
}


export function buildSystemPrompt(state: RouterState, matchedMandates: string | null): RouterOutput {
  const modules: Array<{ key: string; content: string }> = [];
  modules.push({ key: 'M0_output_schema', content: M0_OUTPUT_SCHEMA });
  modules.push({ key: 'M1_core_identity', content: M1_CORE_IDENTITY });
  modules.push({ key: 'M2_phase_rules', content: M2_PHASE_RULES });

  if (state.is_profile_search || state.phase === 'PROFILE_SEARCH') {
    modules.push({ key: 'M6_profile_intelligence', content: M6_PROFILE_INTELLIGENCE });
  } else {
    if (state.intent && M3_MODULES[state.intent]) {
      modules.push({ key: `M3_${state.intent}`, content: M3_MODULES[state.intent] });
    }
    if (state.sector && M4_MODULES[state.sector]) {
      modules.push({ key: `M4_${state.sector}`, content: M4_MODULES[state.sector] });
    }
    if (state.is_sufficient && matchedMandates && matchedMandates.trim().length > 0) {
      modules.push({ key: 'M5_matching', content: buildM5_Matching(matchedMandates) });
    }
  }

  const phaseContext = `\n# CURRENT CONVERSATION PHASE: ${state.phase}\n# TURN: ${state.turn_count + 1} | REFINEMENTS USED: ${state.refinement_count}/3`;
  const systemPrompt = [phaseContext, ...modules.map(m => m.content)].join('\n\n---\n\n');
  const tokenEstimate = Math.round(systemPrompt.length / 4);

  return { systemPrompt, phase: state.phase, modulesLoaded: modules.map(m => m.key), tokenEstimate };
}
