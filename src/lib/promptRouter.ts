/**
 * DealCollab Prompt Router
 * ========================
 * BASE: v3.6 working version + all session fixes applied
 *
 * NEW FIXES (bot_response_2.docx analysis):
 *
 * FIX A — Intermediary detection: semantic expansion
 *   Previous: only caught "I am an advisor", "representing a client"
 *   Problem: Missed "one of client", "investment banker...for my client",
 *   "i am promoter" (without "the")
 *   Fix: Added job-role signals (investment banker, ca, chartered accountant),
 *   possessive-relationship patterns (one of client, for my client, our client),
 *   and more owner signals (i am promoter, my business, i am director).
 *
 * FIX B — NGO / Section 8 sector detection
 *   Previous: M4_NGO module existed but 'ngo' was NOT in SECTOR_KEYWORDS,
 *   so "section 8 company" fell into 'mixed' with generic questions.
 *   Fix: Added 'ngo' as SectorKey with keywords: section 8, ngo, trust,
 *   society, 12a, 80g, fcra, charitable, non-profit.
 *
 * FIX C — Shell company detection and M4 override
 *   Previous: No shell company concept existed anywhere.
 *   Problem: ROC teasers with capital, losses, compliance data got
 *   treated as regular sell-side.
 *   Fix: detectShellCompanyFromText() — scoring-based (2+ signals).
 *   When detected: sub_sector='shell_company'. buildSystemPrompt()
 *   loads M4_SHELL instead of the sector's M4 module.
 *   M4_SHELL questions: Structure + Licence + Compliance + Shareholding.
 *
 * FIX D — Compact format when fewer than 3 M3 fields missing
 *   Previous: Always rendered full bullet list even when only 1-2 fields needed.
 *   Fix: computeMissingM3Fields() counts server-side. When < 3 missing,
 *   injects # M3_FORMAT: compact. M3 modules render as one natural sentence.
 *
 * FIX E — Revenue mandatory before M4 on sell-side
 *   Previous: Bot jumped to M4 once sector+structure known, skipping revenue.
 *   Fix: When intent=SELL_SIDE and revenue=null, injects # REVENUE_REQUIRED.
 *   M3_SELL_SIDE treats revenue as the first mandatory question.
 */

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

export type SectorKey =
  | 'pharma'
  | 'manufacturing'
  | 'saas'
  | 'finserv'
  | 'consumer'
  | 'realestate'
  | 'logistics'
  | 'education'
  | 'chemicals'
  | 'hospitality'
  | 'renewable'
  | 'defence'
  | 'oil_gas'
  | 'ngo'       // FIX B: Section 8, trusts, NGOs
  | 'mixed';

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
  industry_data: Record<string, unknown>;
  is_sufficient: boolean;
  is_complete: boolean;
  is_profile_search: boolean;
  is_intermediary: 'owner' | 'advisor' | null;
  m4_questions_asked: boolean;
  phase: ConversationPhase;
  turn_count: number;
  refinement_count: number;
  round_count: number;
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
    industry_data: {},
    is_sufficient: false,
    is_complete: false,
    is_profile_search: false,
    is_intermediary: null,
    m4_questions_asked: false,
    phase: 'ENTRY',
    turn_count: 0,
    refinement_count: 0,
    round_count: 0,
  };
}

export const VALID_SECTOR_KEYS: SectorKey[] = [
  'pharma', 'manufacturing', 'saas', 'finserv', 'consumer',
  'realestate', 'logistics', 'education', 'chemicals', 'hospitality',
  'renewable', 'defence', 'oil_gas', 'ngo', 'mixed',
];

// ─────────────────────────────────────────────────────────────
// SECTOR KEYWORDS
// FIX B: 'ngo' added with Section 8 + trust + society keywords
// ─────────────────────────────────────────────────────────────

const SECTOR_KEYWORDS: Record<SectorKey, string[]> = {
  pharma: [
    'pharma', 'pharmaceutical', 'api pharma', 'formulation', 'crams', 'cdmo',
    'hospital', 'clinic', 'healthcare', 'diagnostics', 'medical device', 'drug',
    'multispeciality', 'multispecialty', 'multi-speciality',
  ],
  manufacturing: [
    'manufactur', 'industrial', 'oem', 'plant', 'factory', 'auto component',
    'auto parts', 'precision engineering', 'casting', 'forging',
    'machining', 'cnc', 'vmc', 'fitness equipment', 'equipment manufactur',
  ],
  saas: [
    'saas', 'software', 'tech startup', 'arr', 'mrr', 'b2b software',
    'platform', 'app', 'mobile app', 'cloud', 'enterprise software',
    'digital marketing', 'marketing agency', 'performance marketing',
    'advertising agency', 'adtech', 'digital agency',
  ],
  finserv: [
    'nbfc', 'lending', 'fintech', 'financial service', 'insurance',
    'wealth management', 'aum', 'loan book', 'bfsi', 'microfinance',
    'payment', 'neo bank', 'investment banker', 'nbd',
  ],
  consumer: [
    'consumer brand', 'd2c', 'fmcg', 'retail', 'brand', 'marketplace',
    'ecommerce', 'food brand', 'personal care', 'beauty', 'fashion',
  ],
  realestate: [
    'real estate', 'property', 'land', 'infrastructure', 'commercial property',
    'residential', 'warehousing asset', 'developer', 'reit',
  ],
  logistics: [
    'logistics', 'supply chain', 'warehousing', 'freight', 'cold chain',
    '3pl', 'last mile', 'transport', 'fleet', 'cargo',
  ],
  education: [
    'education', 'edtech', 'school', 'college', 'university', 'training',
    'skilling', 'k12', 'higher education', 'test prep', 'coaching',
  ],
  chemicals: [
    'chemical', 'specialty chemical', 'agrochemical', 'pigment', 'dye',
    'polymer', 'adhesive', 'coating', 'fine chemical', 'bulk solvent',
  ],
  hospitality: [
    'hospitality', 'hotel', 'restaurant', 'food service', 'qsr',
    'cafe', 'resort', 'travel', 'tourism',
  ],
  renewable: [
    'renewable', 'solar', 'wind', 'green energy', 'ppa', 'biomass',
    'hydro', 'mwp', 'mw', 'mwdc', 'mwac', 'spv', 'ipp', 'epc energy',
    'solar project', 'solar plant', 'open access', 'c&i solar',
    'rooftop solar', 'captive power', 'wind farm', 'power plant',
  ],
  defence: [
    'defence', 'defense', 'aerospace', 'drdl', 'drdo', 'hal', 'military',
    'government tender', 'ordnance', 'security equipment',
    'defence manufactur', 'defense manufactur', 'defence company', 'defense company',
    'defence sector', 'defense sector',
  ],
  oil_gas: [
    'refinery', 'oil & gas', 'oil and gas', 'petroleum', 'crude oil',
    'lpg plant', 'natural gas', 'downstream oil', 'petrochemical',
    'storage terminal', 'pipeline', 'naphtha', 'bitumen', 'condensate',
    'mmtpa', 'fuel depot', 'gas processing', 'topping unit', 'tank farm',
    'pngrb', 'peso clearance',
  ],
  // FIX B: NGO / Section 8 sector
  ngo: [
    'section 8', 'section-8', 'ngo', 'non-profit', 'non profit',
    'charitable trust', 'charitable company', 'trust company',
    'society registration', 'farmer producer company', 'fpc',
    '80g', '12a', 'fcra', 'darpan', 'ngodarpan',
  ],
  mixed: [],
};

// ─────────────────────────────────────────────────────────────
// INTENT KEYWORDS
// ─────────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<Exclude<DealIntent, null>, string[]> = {
  SELL_SIDE: [
    'sell', 'exit', 'divest', 'divestiture', 'find buyer', 'stake sale',
    'looking for buyer', 'want to sell', 'selling', 'full sale',
    'sell my business', 'sell my company', 'sell our business', 'sell our company',
    'business for sale', 'company for sale', 'want an exit', 'looking for an exit',
    'exit strategy', 'exit opportunity', 'promoter exit', 'partial exit',
    'strategic sale', 'trade sale', 'secondary sale', 'sell a stake',
    'offload', 'divesting', 'find an acquirer', 'find acquirer',
    'available for acquisition', 'available for sale', 'spv for sale', 'asset for sale',
    'acquisition opportunity', 'investment opportunity', 'transaction ready',
    'transaction-ready', 'ready to transact', 'seeking acquirer', 'seeking buyer',
    'open to acquisition', 'open to sale', 'inviting offers', 'inviting bids',
    'teaser', 'information memorandum', 'mandate shared', 'for sale', 'company for sale',
  ],
  BUY_SIDE: [
    'buy', 'acquire', 'acquisition', 'looking to buy', 'find target',
    'roll-up', 'platform acquisition', 'want to acquire', 'purchasing',
    'investor mandate', 'deploy capital', 'looking to deploy', 'actively investing',
    'investment mandate', 'deploy ₹', 'actively looking to acquire',
    'actively looking to invest', 'seeking to acquire', 'buyout',
    'majority acquisition', 'control acquisition', 'i want to buy', 'we want to buy',
    'looking to acquire a', 'looking to buy a', 'client is looking to acquire',
    'client wants to acquire', 'one of client is looking', 'mandate to acquire',
  ],
  FUNDRAISING: [
    'raise', 'fundraise', 'looking for investor', 'seeking investor', 'need investor',
    'equity funding', 'pe fund', 'vc fund', 'growth capital raise',
    'pre-ipo', 'series a', 'series b', 'raise capital', 'raise equity',
  ],
  DEBT: [
    'debt', 'loan', 'working capital', 'ncd', 'structured finance',
    'credit facility', 'term loan', 'refinance', 'borrow',
  ],
  STRATEGIC_PARTNERSHIP: [
    'partner', 'partnership', 'jv', 'joint venture', 'distribution partner',
    'strategic collaboration', 'tie-up', 'co-invest',
  ],
};

const PROFILE_INTENT_KEYWORDS = [
  'find advisor', 'find banker', 'find consultant', 'find a professional', 'find an advisor',
  'need an advisor', 'looking for advisor', 'who can help', 'find someone who works in',
  'recommend a banker', 'recommend an advisor', 'looking for an m&a professional',
  'find a ca', 'find a lawyer', 'find a deal professional',
  'references for', 'looking for candidates', 'need candidates', 'hiring for',
  'recruitment', 'talent search', 'headhunt', 'sap project manager',
];

const FRICTION_SIGNALS = [
  'no data', 'no more data', "don't have", 'dont have', 'no further',
  'accept as is', 'accept my proposal', 'proceed with this', 'proceed as is',
  "that's all", 'thats all', 'nothing more', 'no more information',
  'move forward', 'go ahead', 'just proceed', 'move on',
  'this is enough', 'enough information', 'i have given', 'i have gave',
  'i can only give', 'only this information', 'proceed it', 'submit my deal',
  'go ahead and submit', 'please proceed', 'please go ahead',
  'that is all', 'this is all', 'continue with this', 'work with this',
  'accept and continue', 'proceed with what', 'i prefer any',
  'any will do', 'doesnt matter', "doesn't matter",
  'at this stage', 'for now', 'submit this', 'save this', 'capture this',
  'proceed for now', 'close this', 'finalize', 'finalise',
  'this is sufficient', 'sufficient information',
];

// ─────────────────────────────────────────────────────────────
// DETECTORS
// ─────────────────────────────────────────────────────────────

export function detectSectorFromText(text: string): SectorKey | null {
  const lower = text.toLowerCase();
  let bestKey: SectorKey | null = null;
  let bestScore = 0;
  for (const [key, keywords] of Object.entries(SECTOR_KEYWORDS) as [SectorKey, string[]][]) {
    if (key === 'mixed') continue;
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestKey = key as SectorKey; }
  }
  if (bestScore > 0) console.log(`[DETECTOR] Sector: ${bestKey} (score: ${bestScore})`);
  return bestKey;
}

export function detectIntentFromText(text: string): DealIntent {
  const lower = text.toLowerCase();
  const scores: Partial<Record<Exclude<DealIntent, null>, number>> = {};
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Exclude<DealIntent, null>, string[]][]) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > 0) scores[intent] = score;
  }
  if (Object.keys(scores).length === 0) return null;
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as DealIntent;
}

export function detectProfileIntentFromText(text: string): boolean {
  return PROFILE_INTENT_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}

export function detectFrictionSignal(text: string): boolean {
  return FRICTION_SIGNALS.some(sig => text.toLowerCase().includes(sig));
}

// FIX A: Expanded intermediary detection — semantic patterns, not just explicit phrases
export function detectIntermediaryFromText(text: string): 'owner' | 'advisor' | null {
  const lower = text.toLowerCase();

  const advisorSignals = [
    // Explicit role declarations
    'i am an advisor', 'i am a banker', 'i am an investment banker',
    'i am a ca', 'i am a chartered accountant', 'i am a consultant',
    'i am a broker', 'i am an intermediary', 'i am a facilitator',
    'we are bankers', 'we are advisors', 'we are consultants',
    // Possessive-relationship patterns ("client" as third party)
    'one of client', 'one of my client', 'one of our client',
    'one of clients', 'one of my clients', 'one of our clients',
    'my client', 'our client', 'for my client', 'for our client',
    'for a client', 'on behalf of client', 'on behalf of a client',
    'client is looking', 'client wants', 'client is interested',
    'client requires', 'client needs', 'representing a client',
    'representing the client', 'representing a seller', 'representing a buyer',
    // Role + action patterns
    'acting as advisor', 'acting as banker', 'as an advisor',
    'as a banker', 'as an investment banker', 'mandated to',
    'i represent', 'we represent', 'representing the promoter',
    'mandate on behalf', 'advisor representing',
  ];

  const ownerSignals = [
    // "i am" + role (with and without "the")
    'i am the owner', 'i am owner', 'i am a owner',
    'i am the promoter', 'i am promoter', 'i am a promoter',
    'i am the founder', 'i am founder', 'i am a founder',
    'i am the co-founder', 'i am co-founder', 'i am cofounder',
    'i am the director', 'i am director', 'i am the md',
    'i am md', 'i am the ceo', 'i am ceo',
    'we are the promoters', 'we are promoters',
    // Possessive business signals
    'my business', 'our business', 'my company', 'our company',
    'my firm', 'our firm', 'my startup', 'our startup',
    'i own', 'we own', 'i run', 'we run',
    // Intent + first-person sell/exit
    'i am looking to sell', 'we are looking to sell',
    'i want to sell my', 'we want to sell our',
    'i am looking to exit', 'promoter looking',
    // First-person investor/acquirer
    'i am an investor', 'i am the acquirer', 'we are the acquirer',
    'i am looking to acquire', 'i am looking to buy',
  ];

  if (advisorSignals.some(s => lower.includes(s))) return 'advisor';
  if (ownerSignals.some(s => lower.includes(s))) return 'owner';
  return null;
}

// FIX C: Shell company detection — scoring-based, 2+ signals = shell
export function detectShellCompanyFromText(text: string): boolean {
  const lower = text.toLowerCase();
  const shellSignals = [
    'shell company', 'dormant company', 'blank company',
    'roc ', ' roc\n', '| roc', 'roc based', // ROC registration mentions
    'authorised capital', 'authorized capital', 'paid up capital',
    'paid-up capital', 'share capital',
    'gst surrendered', 'gst cancelled', 'gst inactive',
    'c/f loss', 'c/f capital loss', 'c/f business loss',
    'carried forward loss', 'carry forward loss',
    'loss carry forward', 'unabsorbed loss',
    'zero litigation', 'no litigation', 'nil litigation',
    'it compliant', 'roc compliant', 'roc fully compliant',
    'objects -', 'objects:', '| objects', // ROC objects clause format
    'no operations', 'dormant', 'non-operational',
  ];
  const score = shellSignals.filter(s => lower.includes(s)).length;
  console.log(`[DETECTOR] Shell signals: ${score}`);
  return score >= 2;
}

// FIX D: Count genuinely missing M3 fields per intent for compact format decision
function computeMissingM3Fields(state: RouterState): number {
  if (!state.intent) return 99;
  let missing = 0;
  switch (state.intent) {
    case 'SELL_SIDE':
      if (!(state.sector && state.geography)) missing++;
      if (!state.revenue) missing++;
      if (!state.structure) missing++;
      break;
    case 'BUY_SIDE':
      if (!state.geography) missing++;
      if (!state.deal_size) missing++;
      if (!state.structure) missing++;
      if (!state.intent_focus) missing++;
      break;
    case 'FUNDRAISING':
      if (!state.deal_size) missing++;
      if (!state.structure) missing++;
      if (!state.revenue) missing++;
      break;
    case 'DEBT':
      if (!state.deal_size) missing++;
      if (!state.revenue) missing++;
      if (!state.intent_focus) missing++;
      break;
    case 'STRATEGIC_PARTNERSHIP':
      if (!(state.sector && state.geography)) missing++;
      if (!state.structure) missing++;
      if (!state.intent_focus) missing++;
      break;
  }
  return missing;
}

// FIX 7 (retained): Pre-detect structure from teasers
export function detectStructureFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('100%') || lower.includes('full buyout') ||
    lower.includes('complete acquisition') || lower.includes('outright purchase')) {
    return '100% / Full Buyout';
  }
  if (lower.includes('majority acquisition') || lower.includes('majority buyout') ||
    lower.includes('majority stake') || lower.includes('control acquisition')) {
    return 'Majority / Control Acquisition';
  }
  if (lower.includes('minority stake') || lower.includes('minority investment')) {
    return 'Minority Stake';
  }
  return null;
}

export function detectDealSizeFromText(text: string): string | null {
  const patterns = [
    /budget[:\s]+(?:₹|rs\.?)?[\s]?(\d[\d,]*)[\s]?(?:[–\-to]+[\s]?(\d[\d,]*)[\s]?)?(?:cr|crore)/gi,
    /ticket[:\s]+(?:₹|rs\.?)?[\s]?(\d[\d,]*)[\s]?(?:[–\-to]+[\s]?(\d[\d,]*)[\s]?)?(?:cr|crore)/gi,
    /(?:₹|rs\.?)[\s]?(\d[\d,]*)[\s]?[–\-to]+[\s]?(?:₹|rs\.?)?[\s]?(\d[\d,]*)[\s]?(?:cr|crore)/gi,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match[2] ? `₹${match[1]}–${match[2]} Cr` : `₹${match[1]} Cr`;
  }
  return null;
}

export function detectRevenueFromText(text: string): string | null {
  const patterns = [
    /₹[\s]?(\d[\d,]*)[\s]?[–\-to]+[\s]?(\d[\d,]*)[\s]?(?:Cr|cr|crore)/gi,
    /revenue[:\s]+₹?[\s]?(\d[\d,]*)[\s]?[–\-to]+[\s]?(\d[\d,]*)[\s]?(?:Cr|cr|crore)/gi,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return `₹${match[1]}–${match[2]} Cr`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────

export function updateStateFromExtraction(
  current: RouterState,
  extraction: { intent: DealIntent; state: Partial<RouterState>; is_complete: boolean },
  currentMessage: string,
  modulesLoaded: string[] = [],
): RouterState {
  const updated: RouterState = { ...current };
  updated.turn_count = current.turn_count + 1;

  if (!updated.is_profile_search)
    updated.is_profile_search = detectProfileIntentFromText(currentMessage);

  if (extraction.intent) updated.intent = extraction.intent;

  if (extraction.state.sector) {
    const raw = (extraction.state.sector as string).toLowerCase().trim();
    const validKey = VALID_SECTOR_KEYS.find(k => k === raw);
    if (validKey) updated.sector = validKey;
    else console.warn(`[ROUTER] Rejected sector "${extraction.state.sector}". Keeping: "${current.sector ?? 'null'}"`);
  }

  if (extraction.state.sub_sector) updated.sub_sector = extraction.state.sub_sector as string;
  if (extraction.state.geography) updated.geography = extraction.state.geography as string;
  if (extraction.state.deal_size) updated.deal_size = extraction.state.deal_size as string;
  if (extraction.state.revenue) updated.revenue = extraction.state.revenue as string;
  if (extraction.state.structure) updated.structure = extraction.state.structure as string;
  if (extraction.state.intent_focus) updated.intent_focus = extraction.state.intent_focus as string;
  if (extraction.state.industry_data &&
    Object.keys(extraction.state.industry_data as object).length > 0) {
    updated.industry_data = { ...current.industry_data, ...(extraction.state.industry_data as object) };
  }

  // FIX A: Persist intermediary from LLM + message detection
  const extractedRole = (extraction.state as Record<string, unknown>).is_intermediary as string | undefined;
  if ((extractedRole === 'owner' || extractedRole === 'advisor') && updated.is_intermediary === null) {
    updated.is_intermediary = extractedRole;
  }
  if (updated.is_intermediary === null) {
    const detected = detectIntermediaryFromText(currentMessage);
    if (detected) updated.is_intermediary = detected;
  }

  if (extraction.state.m4_questions_asked === true) {
    const m4WasLoaded = modulesLoaded.some(m => m.startsWith('M4_'));
    if (m4WasLoaded) {
      updated.m4_questions_asked = true;
      console.log('[ROUTER] m4_questions_asked=true accepted.');
    }
  }

  if (!updated.sector) {
    const detected = detectSectorFromText(currentMessage);
    if (detected) updated.sector = detected;
  }
  if (!updated.intent) {
    const detected = detectIntentFromText(currentMessage);
    if (detected) updated.intent = detected;
  }

  // FIX C: Shell company → set sub_sector
  if (updated.sub_sector === null && detectShellCompanyFromText(currentMessage)) {
    updated.sub_sector = 'shell_company';
    console.log('[DETECTOR] Shell company detected — sub_sector=shell_company');
  }

  if (detectFrictionSignal(currentMessage)) {
    updated.is_complete = true;
    console.log('[ROUTER] Friction — forcing is_complete=true');
  } else {
    updated.is_complete = extraction.is_complete;
  }

  const hasIndustrySignal = !!(updated.sector || updated.sub_sector);
  const qualifyingFields = [
    !!(updated.revenue || updated.deal_size),
    !!(updated.structure || updated.intent),
    !!(updated.geography),
  ].filter(Boolean).length;

  updated.is_sufficient = hasIndustrySignal && qualifyingFields >= 2 && updated.m4_questions_asked;
  updated.phase = resolvePhase(updated);

  if (current.phase === 'MOMENTUM') updated.refinement_count = current.refinement_count + 1;
  if (current.phase === 'QUALIFICATION') updated.round_count = current.round_count + 1;

  return updated;
}

export function initializeStateFromDocument(
  structuredData: Record<string, unknown>,
): RouterState {
  const state = createBlankState();
  const intent = structuredData.intent as DealIntent ?? null;
  const sectorStr = structuredData.sector as string ?? '';
  const location = structuredData.geography as string ?? structuredData.location as string ?? '';

  if (intent) state.intent = intent;
  if (sectorStr) {
    const raw = sectorStr.toLowerCase().trim();
    const validKey = VALID_SECTOR_KEYS.find(k => k === raw);
    state.sector = validKey || detectSectorFromText(sectorStr);
  }
  if (location) state.geography = location;
  if (structuredData.sub_sector) state.sub_sector = String(structuredData.sub_sector);
  if (structuredData.deal_size) state.deal_size = String(structuredData.deal_size);
  if (structuredData.revenue) state.revenue = String(structuredData.revenue);
  if (structuredData.structure) state.structure = String(structuredData.structure);
  if (structuredData.company_overview) {
    state.industry_data = { ...state.industry_data, company_overview: structuredData.company_overview };
  }
  state.m4_questions_asked = false;
  const hasIndustrySignal = !!(state.sector || state.sub_sector);
  const qualifyingFields = [
    !!(state.revenue || state.deal_size),
    !!(state.structure || state.intent),
    !!(state.geography),
  ].filter(Boolean).length;
  state.is_sufficient = hasIndustrySignal && qualifyingFields >= 2 && state.m4_questions_asked;
  state.phase = resolvePhase(state);
  return state;
}

function resolvePhase(state: RouterState): ConversationPhase {
  if (state.is_profile_search) return 'PROFILE_SEARCH';
  if (state.is_complete) return 'CLOSURE';
  if (state.is_sufficient && state.refinement_count >= 3) return 'CLOSURE';
  if (state.round_count >= 4 && (state.intent || state.sector)) return 'CLOSURE';
  if (state.is_sufficient) return 'MOMENTUM';
  if (state.intent || state.sector) return 'QUALIFICATION';
  return 'ENTRY';
}

// ─────────────────────────────────────────────────────────────
// M0 — Output Schema
// ─────────────────────────────────────────────────────────────

const M0_OUTPUT_SCHEMA = `
# OUTPUT CONTRACT (non-negotiable)
Return ONLY valid JSON. No preamble, no markdown, no fences.
{
  "intent": "SELL_SIDE"|"BUY_SIDE"|"FUNDRAISING"|"DEBT"|"STRATEGIC_PARTNERSHIP"|null,
  "state": {
    "sector":          string|null,
    "sub_sector":      string|null,
    "geography":       string|null,
    "deal_size":       string|null,
    "revenue":         string|null,
    "structure":       string|null,
    "intent_focus":    string|null,
    "industry_data":   {},
    "is_intermediary": "owner"|"advisor"|null,
    "m4_questions_asked": boolean
  },
  "is_complete": boolean,
  "message": "YOUR FULL RESPONSE TEXT HERE"
}

STEP 1 — EXTRACT ALL FIELDS BEFORE WRITING ANY QUESTION:
  Read ENTIRE message and ALL prior conversation. Fill state first.
  is_intermediary detection:
    "advisor": investment banker, ca, chartered accountant, banker, consultant,
               "one of client", "for my client", "our client", "on behalf of",
               "i represent", "mandated to", "representing a/the client"
    "owner":   "i am promoter", "i am founder", "i am the owner", "i am the director",
               "my business", "our company", "i am an investor", "i am the acquirer"
  sub_sector: "shell_company" when 2+ shell signals (ROC, capital, GST surrendered, C/F loss, zero litigation)
  structure: extract from "100% exit", "Majority Acquisition", "full sale", "outright purchase"
  deal_size: extract from budget/ticket figures. revenue: extract from stated revenue.
  NEVER ask for a field already present in conversation.

STEP 2 — INTERMEDIARY RULE:
  # INTERMEDIARY_ROLE shows "owner"/"advisor" → SKIP question entirely. Never ask again.
  "unknown" → Ask once, embedded in opening block.

STEP 3 — COMPACT FORMAT RULE (# M3_FORMAT: compact):
  When # M3_FORMAT: compact is set — write missing fields as ONE natural sentence.
  NOT bullets. Example: "To match you with the right target, share your geography and budget."

STEP 4 — REVENUE RULE (# REVENUE_REQUIRED):
  When # REVENUE_REQUIRED is set — ask revenue + EBITDA as the FIRST question.
  Do not jump to M4 until revenue is captured.

STEP 5 — SHELL COMPANY RULE (# SHELL_COMPANY_DETECTED):
  When set — ignore sector-specific M4 questions. Ask only: structure, licences, compliance, shareholding.

STEP 6 — FRICTION: "proceed", "enough", "this is all", "i have gave", "accept and continue" → is_complete=TRUE.

STEP 7 — ROUND LIMIT: # QUALIFICATION_ROUNDS ≥ 4 → stop all questions, deliver closure.

SECTOR keys: pharma | manufacturing | saas | finserv | consumer | realestate |
  logistics | education | chemicals | hospitality | renewable | defence | oil_gas | ngo | mixed | null
  hospital/clinic/healthcare → "pharma" | refinery/petroleum → "oil_gas"
  section 8/ngo/trust/society → "ngo"

M4_QUESTIONS_ASKED: TRUE only when M4_ in modules AND message has M4 bullets. Once TRUE, stays TRUE.
`.trim();

// ─────────────────────────────────────────────────────────────
// M1 — Core Identity
// ─────────────────────────────────────────────────────────────

const M1_CORE_IDENTITY = `
# ROLE
You are the DealCollab Deal Intelligence Assistant — a deal qualification engine and matchmaking optimizer.
You are NOT a generic chatbot, a listing platform, or a lead distribution system.

# PHILOSOPHY
- Trust First: never ask for company name or promoter identity early.
- Matching First: every question improves counterparty discovery.
- Fewer Interactions, Better Intelligence: group questions. Never one field per reply.
- Transactional, Not Advisory: sharp and direct. Two sentences max on strategy questions.
- Momentum Over Completeness: sector + 2 qualifying fields = sufficient.

# TONE
Premium. Sharp. Credible. Calm. Institutional. Deal desk, not chatbot.
Replace: "could you share" → "share"; "to proceed" → "to structure this correctly."

# CONFIDENTIALITY
Remind once: "Your inputs remain confidential. Share in ranges or descriptors — no sensitive details required."

# FORBIDDEN
✘ Ask for any field already stated by the user in any message
✘ Re-ask the owner/advisor question if # INTERMEDIARY_ROLE is already set
✘ Use bullet format when # M3_FORMAT: compact — use one natural sentence instead
✘ Skip revenue question on SELL_SIDE when # REVENUE_REQUIRED is set
✘ Ask sector-specific M4 questions when # SHELL_COMPANY_DETECTED is set
✘ Map "investor mandate" or "deploy capital" to FUNDRAISING — this is BUY_SIDE
✘ Continue after 4 qualification rounds — deliver deal summary and closure
✘ Ignore friction signals — close immediately when user signals no more data
✘ Banned phrases: "Thank you for the information" | "To proceed" | "To move forward" |
  "Great" | "Absolutely" | "Happy to help" | "Could you share" | "Tell me more" | "As an AI"
`.trim();

// ─────────────────────────────────────────────────────────────
// M2 — Conversation Phase Rules
// ─────────────────────────────────────────────────────────────

const M2_PHASE_RULES = `
# CONVERSATION PHASE RULES

## ENTRY
Greeting only → "Welcome to DealCollab. Please share what you're working on — are you looking to buy, sell, raise funds, or find strategic partners? Describe your requirement in plain text."
Direct mandate → qualification immediately.

## QUALIFICATION (pre-sufficiency)

### PRE-EXTRACTION RULE:
When user sends a rich first message — extract all fields silently first.
Open with synthesis: "[Intent] · [Sector] · [Geography] · [Size/Revenue]. Noted."
Then ask ONLY genuinely missing fields.

### INTERMEDIARY RULE:
Check # INTERMEDIARY_ROLE. "owner" or "advisor" → skip entirely. Never ask.
"unknown" → ask once as opening line of grouped block.

### FORMAT RULES:
Standard (3+ fields missing): opening line → bullet list → M4 bullets → confidentiality reminder.
Compact (# M3_FORMAT: compact, fewer than 3 fields missing):
  Write missing fields as ONE natural sentence: "To [goal], share your [field1] and [field2]."
  No bullet points. No opening line. One sentence only.

### REVENUE-FIRST RULE (# REVENUE_REQUIRED):
When SELL_SIDE and revenue unknown — ask revenue + EBITDA FIRST, before any other question.
Do not ask M4 questions until revenue is captured.

### SHELL COMPANY RULE (# SHELL_COMPANY_DETECTED):
Ignore all sector-specific M4 questions. Ask only:
• Legal structure (Section 8, Pvt Ltd, LLP, Public Ltd)
• Licences and registrations held (GST, 12A, 80G, FCRA, sector-specific)
• Compliance status (ROC filings, IT returns, pending dues, litigation)
• Shareholding structure (promoter holding, locked shares, pending transfers)

### FRICTION → IMMEDIATE CLOSE:
"proceed", "this is enough", "i have gave", "accept and continue", "at this stage", "any will do":
1. "Noted — I'll work with what you've shared."
2. Deal summary: "Your mandate: [Intent] · [Sector] · [key fields captured]."
3. Closure message verbatim.

### ROUND LIMIT → AUTO-CLOSE at 4 rounds:
Check # QUALIFICATION_ROUNDS. If 4 or higher: stop, summarise, close.

## MOMENTUM (sufficiency met)
ONE question max. Synthesise → "sufficient to begin identifying counterparties" → one refinement.
Max 3 refinements before closure.

## CLOSURE
Deliver verbatim:
"Your requirement has been structured successfully. Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution. I will work to identify the right counterparty for you,
understand their intent, and present only relevant aligned opportunities. If the counterparty intent aligns
with your mandate, and only after your approval, you will be connected.
I continuously work across the network 24×7. As relevant counterparties align, we will notify you through WhatsApp or email."

## OUT OF SCOPE
Talent/recruitment: "DealCollab focuses on M&A deal-sourcing. For hiring functional roles, Naukri or LinkedIn will serve you better. For M&A advisors or bankers, I can identify profiles in our network."
`.trim();

// ─────────────────────────────────────────────────────────────
// M3 — Intent Qualification Frameworks
// FIX A: Intermediary conditional on # INTERMEDIARY_ROLE
// FIX D: Compact format instructions added to all sub-modules
// FIX E: Revenue-first rule added to SELL_SIDE
// ─────────────────────────────────────────────────────────────

const M3_SELL_SIDE = `
# QUALIFICATION: SELL-SIDE

INTERMEDIARY (check # INTERMEDIARY_ROLE first):
  "owner" or "advisor" → SKIP entirely. Do not ask.
  "unknown" → Ask as opening line: "Are you the business owner / promoter, or an advisor representing a client?"

COMPACT FORMAT (check # M3_FORMAT):
  compact → Write all missing fields as ONE sentence: "To position this correctly, share your [missing fields]."
  standard → Use bullet format below.

REVENUE-FIRST (check # REVENUE_REQUIRED):
  When set → Ask revenue + EBITDA as the FIRST and ONLY question this turn:
  "To position this correctly for relevant buyers, what is the approximate annual revenue and EBITDA or profitability range?"
  Do NOT ask other questions or M4 questions until revenue is captured.

Standard format — ask only fields NOT in # FIELDS ALREADY PROVIDED:
• What does the business do, and where does it operate? [SKIP if sector + geography known]
• What is the approximate annual revenue and EBITDA or profitability range? [SKIP if revenue known]
• What kind of transaction — full sale, majority stake, or minority stake? [SKIP if structure known]

Ask when contextually useful: valuation expectation · preferred buyer type · timeline.
`.trim();

const M3_BUY_SIDE = `
# QUALIFICATION: BUY-SIDE

INTERMEDIARY (check # INTERMEDIARY_ROLE first):
  "owner" or "advisor" → SKIP entirely. Do not ask.
  "unknown" → Ask as opening line: "Are you the acquirer directly, or an advisor running a mandate on behalf of a client?"
  Note: financial investors ("investor mandate", "deploy capital") → treat as direct acquirer ("you").

COMPACT FORMAT (check # M3_FORMAT):
  compact → Write all missing fields as ONE sentence: "To match you with the right target, share your [missing fields]."
  standard → Use bullet format below.

Standard format — ask only fields NOT in # FIELDS ALREADY PROVIDED:
• What geography are you targeting? [SKIP if geography known]
• What is the approximate budget or ticket size? [SKIP if deal_size known]
• What deal structure — majority, minority, or full buyout? [SKIP if structure known]
• What is the strategic rationale behind this acquisition? [SKIP if intent_focus known]

Add when relevant: urgency, cross-border openness, preferred revenue size of target.
`.trim();

const M3_FUNDRAISING = `
# QUALIFICATION: FUNDRAISING

INTERMEDIARY (check # INTERMEDIARY_ROLE first):
  "owner" or "advisor" → SKIP entirely. Do not ask.
  "unknown" → Ask as opening line: "Are you the founder / promoter, or an advisor running this raise?"

COMPACT FORMAT (check # M3_FORMAT):
  compact → Write missing fields as ONE sentence.
  standard → Use bullet format below.

Standard format — ask only fields NOT in # FIELDS ALREADY PROVIDED:
• Business stage and sector? [SKIP if known]
• Amount to raise? [SKIP if deal_size known]
• Equity, debt, or hybrid? [SKIP if structure known]
• Current revenue or ARR? [SKIP if revenue known]
• Primary use of funds? [SKIP if intent_focus known]
`.trim();

const M3_DEBT = `
# QUALIFICATION: DEBT / STRUCTURED FINANCE

INTERMEDIARY (check # INTERMEDIARY_ROLE first):
  "owner" or "advisor" → SKIP entirely. Do not ask.
  "unknown" → Ask as opening line: "Are you the business seeking the facility, or an advisor arranging it?"

COMPACT FORMAT (check # M3_FORMAT):
  compact → Write missing fields as ONE sentence.
  standard → Use bullet format below.

Standard format — ask only fields NOT in # FIELDS ALREADY PROVIDED:
• Industry and purpose of funding? [SKIP if known]
• Approximate amount required? [SKIP if deal_size known]
• Current revenue scale? [SKIP if revenue known]
• Collateral availability? [SKIP if known]
`.trim();

const M3_STRATEGIC = `
# QUALIFICATION: STRATEGIC PARTNERSHIP

INTERMEDIARY (check # INTERMEDIARY_ROLE first):
  "owner" or "advisor" → SKIP entirely. Do not ask.
  "unknown" → Ask as opening line: "Are you representing your own firm, or acting as an advisor facilitating this partnership?"

COMPACT FORMAT (check # M3_FORMAT):
  compact → Write missing fields as ONE sentence.
  standard → Use bullet format below.

Standard format — ask only fields NOT in # FIELDS ALREADY PROVIDED:
• Your sector and geography? [SKIP if both known]
• Partnership type (JV, distribution, co-investment, licensing)? [SKIP if known]
• What you bring and what you seek? [SKIP if known]
`.trim();

const M3_MODULES: Record<Exclude<DealIntent, null>, string> = {
  SELL_SIDE: M3_SELL_SIDE,
  BUY_SIDE: M3_BUY_SIDE,
  FUNDRAISING: M3_FUNDRAISING,
  DEBT: M3_DEBT,
  STRATEGIC_PARTNERSHIP: M3_STRATEGIC,
};

// ─────────────────────────────────────────────────────────────
// M4 — Sector Intelligence
// FIX B: M4_NGO added
// FIX C: M4_SHELL added (overrides sector-specific M4)
// ─────────────────────────────────────────────────────────────

const M4_PHARMA = `
# SECTOR INTELLIGENCE: PHARMA / HEALTHCARE
Ask 2–4 of:
• "Is the business focused on formulations, API, diagnostics, or healthcare services?"
• "Are there key regulatory approvals or manufacturing licences important for buyer interest?"
• "Do you export to regulated markets (US, EU, emerging)?"
• "Is the business dependent on a few key products or institutional clients?"
Buyer signals: regulatory moat · USFDA/EU approvals · export access · IP defensibility.
`.trim();

const M4_MANUFACTURING = `
# SECTOR INTELLIGENCE: MANUFACTURING / INDUSTRIAL
Ask 2–4 of:
• "Is the business OEM-led, export-driven, or domestic B2B focused?"
• "Do you own manufacturing facilities or operate through contract manufacturing?"
• "Are there certifications or approvals critical for buyer qualification?"
• "Is revenue concentrated among a few major customers?"
Buyer signals: capacity expansion · certifications · customer access · export relationships.
`.trim();

const M4_SAAS = `
# SECTOR INTELLIGENCE: SAAS / TECHNOLOGY
Ask 2–4 of:
• "Is this primarily B2B SaaS or consumer-led technology?"
• "What is the recurring revenue profile (ARR / MRR)?"
• "Are customers enterprise accounts or SME-driven?"
• "Is the business strongly dependent on founder relationships or proprietary IP?"
Buyer signals: sticky recurring revenue · IP defensibility · low churn · enterprise contracts.
`.trim();

const M4_FINSERV = `
# SECTOR INTELLIGENCE: FINANCIAL SERVICES / NBFC / FINTECH
Ask 2–4 of:
• "Is this an operating NBFC, fintech platform, advisory firm, or lending business?"
• "Are there licences or RBI approvals critical for operational continuity?"
• "What is the loan book / AUM profile and current NPA level?"
• "Is growth dependent on distribution partnerships or internal sourcing?"
Buyer signals: licence value · regulatory defensibility · loan book quality.
`.trim();

const M4_CONSUMER = `
# SECTOR INTELLIGENCE: CONSUMER BRAND / RETAIL / D2C
Ask 2–4 of:
• "Is the business primarily brand-led or distribution-led?"
• "Are sales driven through D2C, offline retail, or marketplaces?"
• "Is revenue dependent on a few hero products or broad SKU depth?"
• "Is the brand regional or nationally distributed?"
Buyer signals: brand defensibility · repeat purchase · margin quality · channel stability.
`.trim();

const M4_REALESTATE = `
# SECTOR INTELLIGENCE: REAL ESTATE / INFRASTRUCTURE
Ask 2–4 of:
• "Is this asset-led ownership or development rights driven?"
• "Are all regulatory approvals fully in place?"
• "Is revenue from completed annuity assets or project-stage development?"
• "Is buyer value dependent on location concentration?"
Buyer signals: title clarity · approval status · annuity stability · tenant quality.
`.trim();

const M4_LOGISTICS = `
# SECTOR INTELLIGENCE: LOGISTICS / SUPPLY CHAIN
Ask 2–4 of:
• "Is the business asset-light logistics or owned-infrastructure driven?"
• "Are revenues contract-based or transactional?"
• "Is there dependency on a few enterprise customers?"
• "Are operations regional or pan-India?"
Buyer signals: contract revenue quality · infrastructure ownership · route density.
`.trim();

const M4_EDUCATION = `
# SECTOR INTELLIGENCE: EDUCATION / EDTECH
Ask 2–4 of:
• "Is this an institutional school/college, online platform, or B2B skilling business?"
• "Are there accreditations or approvals critical for operations?"
• "Is student acquisition self-sustaining or highly dependent on marketing spend?"
• "Is the business founder-dependent or does it have independent operational leadership?"
Buyer signals: recurring enrolment · accreditation value · content IP.
`.trim();

const M4_CHEMICALS = `
# SECTOR INTELLIGENCE: CHEMICALS / SPECIALTY CHEMICALS
Ask 2–4 of:
• "Is the business commodity chemicals or specialty / niche formulations?"
• "Is there significant export dependency or domestic-focused revenue?"
• "Are plant approvals and environmental compliance fully in order?"
• "Is revenue concentrated among a few large industrial customers?"
Buyer signals: formulation defensibility · export access · compliance moat.
`.trim();

const M4_HOSPITALITY = `
# SECTOR INTELLIGENCE: HOSPITALITY / FOOD / RESTAURANTS
Ask 2–4 of:
• "Is this owned-asset hospitality or managed/franchised operations?"
• "Are occupancy or revenue metrics stable over the last 2–3 years?"
• "Is the brand franchise-dependent or independently owned?"
• "Is revenue concentrated in one or a few locations?"
Buyer signals: asset ownership · brand defensibility · location quality · margin stability.
`.trim();

const M4_RENEWABLE = `
# SECTOR INTELLIGENCE: RENEWABLE ENERGY
Ask 2–4 of:
• "Is this an operating IPP, EPC contractor, or early-stage development project?"
• "Are PPAs in place — who is the off-taker, and what is the tenure?"
• "What is the debt structure on the asset, and does lender consent factor into the transaction?"
• "What is the asking consideration or value expectation for the asset?"
Buyer signals: PPA quality · off-taker profile · debt coverage · lender consent.
`.trim();

const M4_DEFENCE = `
# SECTOR INTELLIGENCE: DEFENCE / AEROSPACE
Ask 2–4 of:
• "Does the business hold key DGQA / DRDL / DRDO approvals or offset credits?"
• "Is revenue primarily government-tender driven or from OEM partnerships?"
• "Are there export restrictions on the products or technology?"
• "Is there proprietary capability or IP that creates a moat?"
Buyer signals: approvals · government relationships · technology moat · offset credit value.
`.trim();

const M4_OIL_GAS = `
# SECTOR INTELLIGENCE: OIL & GAS / DOWNSTREAM
Ask 2–4 of:
• "What type of asset — refinery, storage terminal, topping unit, or gas processing facility?"
• "What is the capacity scale — MMTPA for refinery, KL for storage?"
• "What regulatory licences does the asset hold — PNGRB, PESO, environmental clearances?"
• "What is the debt structure, and does lender consent factor into the transaction?"
Buyer signals: PNGRB/PESO approvals · offtake contracts · capacity utilisation · debt profile.
`.trim();

// FIX B: NGO / Section 8 sector — full module
const M4_NGO = `
# SECTOR INTELLIGENCE: NGO / SECTION 8 / TRUST
Covers: Section 8 companies · NGOs · trusts · societies · cooperatives · farmer producer companies
Context: typically acquired for regulatory benefits (80G, 12A, FCRA) or impact-sector deals.
Qualification is intentionally lightweight — registration and compliance cleanliness are primary signals.

Ask 2–3 of:
• "What registrations does the entity hold — 12A, 80G, FCRA, DARPAN — and are they active and transferable?"
• "Is the entity operationally active with ongoing programmes, or primarily a compliance / dormant entity?"
• "Are there any statutory dues, pending regulatory notices, or RBI issues?"
Buyer signals: registration transferability · compliance cleanliness · absence of legacy liabilities.
`.trim();

// FIX C: Shell company M4 override — Structure + Licence + Compliance + Shareholding
const M4_SHELL = `
# SECTOR INTELLIGENCE: SHELL COMPANY
This is a shell or dormant company deal. Ignore all sector-specific questions.
The value in this deal lies in: Structure · Licence · Compliance · Shareholding.

Ask ALL of these (these are the only questions that matter):
• "What is the legal structure of the entity — Section 8, Private Limited, LLP, or Public Limited?"
• "What licences, registrations, or approvals does the entity hold — GST, 12A, 80G, FCRA, RBI, SEBI, IRDAI, or sector-specific permits?"
• "What is the current compliance status — are ROC filings and IT returns current, any pending statutory dues, or litigation?"
• "What is the shareholding structure — promoter holding percentage, any locked-in shares, or pending share transfers?"

Buyer signals: licence transferability · clean compliance record · no legacy liabilities · clear shareholding.
`.trim();

const M4_MIXED = `
# SECTOR INTELLIGENCE: MIXED / CROSS-SECTOR
Ask these 3 universal questions:
• "What is the core revenue driver — product, service, or platform?"
• "Is the business asset-heavy or asset-light?"
• "Is revenue primarily contract-based, repeat, or transactional?"
`.trim();

const M4_MODULES: Record<SectorKey, string> = {
  pharma: M4_PHARMA,
  manufacturing: M4_MANUFACTURING,
  saas: M4_SAAS,
  finserv: M4_FINSERV,
  consumer: M4_CONSUMER,
  realestate: M4_REALESTATE,
  logistics: M4_LOGISTICS,
  education: M4_EDUCATION,
  chemicals: M4_CHEMICALS,
  hospitality: M4_HOSPITALITY,
  renewable: M4_RENEWABLE,
  defence: M4_DEFENCE,
  oil_gas: M4_OIL_GAS,
  ngo: M4_NGO,     // FIX B
  mixed: M4_MIXED,
};

// ─────────────────────────────────────────────────────────────
// M5 — Deal Matching Layer
// ─────────────────────────────────────────────────────────────

function buildM5_Matching(matchedMandates: string | null): string {
  if (!matchedMandates || matchedMandates.trim().length === 0) {
    return `
## M5: NO MATCHES FOUND
Deliver this verbatim, then the closure message:
"No matches at this stage. Your mandate has been saved and is running against the network continuously.
You will be notified via WhatsApp or email when a relevant counterparty is identified — this runs for 90 days."
    `.trim();
  }
  return `
## M5: DEAL MATCHING MODE
Matched mandates (anonymous):
${matchedMandates}

Present: "We have identified [N] potentially aligned counterpart[y/ies] in our network."
Per match: "[Sector] · [Geography] · [Size]" + one sentence why relevant.
After: "To connect, send a connection request from your Deal Dashboard. Tokens deducted only if both parties approve."
Then deliver closure message.
✘ Never reveal name · firm · contact · mandate ID. ✘ Never fabricate.
  `.trim();
}

// ─────────────────────────────────────────────────────────────
// M6 — Profile Intelligence
// ─────────────────────────────────────────────────────────────

const M6_PROFILE_INTELLIGENCE = `
# PROFILE INTELLIGENCE MODE

STEP 1 — CLASSIFY:
M&A professional → proceed below.
Talent/recruitment (SAP, IT roles, engineers, general hiring):
→ "DealCollab focuses on M&A deal-sourcing and deal intelligence — not general recruitment.
For hiring functional roles, Naukri or LinkedIn will serve you better.
If you need an M&A advisor or transaction banker, I can identify relevant profiles in our network."

STEP 2 — M&A PROFESSIONAL QUALIFICATION:
"To find the right professional, share:
• What type of professional — M&A advisor, investment banker, PE professional, CA / legal, or deal consultant?
• Which sector?
• Geography preference?
• Nature of engagement — transaction-specific, retainer, or one-time advisory?"

Present anonymously. Frame as: "We have [X] professionals aligned to your requirement."
Set intent_focus = "PROFILE_SEARCH". is_complete = true after interest expressed.
`.trim();

// ─────────────────────────────────────────────────────────────
// ROUTER — Main composition function
// FIX B: NGO routing added
// FIX C: Shell override — M4_SHELL instead of sector M4
// FIX D: computeMissingM3Fields → # M3_FORMAT: compact
// FIX E: # REVENUE_REQUIRED injection for sell-side
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

  modules.push({ key: 'M0_output_schema', content: M0_OUTPUT_SCHEMA });
  modules.push({ key: 'M1_core_identity', content: M1_CORE_IDENTITY });
  modules.push({ key: 'M2_phase_rules', content: M2_PHASE_RULES });

  if (state.is_profile_search || state.phase === 'PROFILE_SEARCH') {
    modules.push({ key: 'M6_profile_intelligence', content: M6_PROFILE_INTELLIGENCE });
  } else {
    if (state.intent && M3_MODULES[state.intent]) {
      modules.push({ key: `M3_${state.intent}`, content: M3_MODULES[state.intent] });
    }

    // FIX C: Shell company overrides sector M4
    if (state.sub_sector === 'shell_company') {
      modules.push({ key: 'M4_shell', content: M4_SHELL });
    } else if (state.sector && M4_MODULES[state.sector]) {
      modules.push({ key: `M4_${state.sector}`, content: M4_MODULES[state.sector] });
    }

    if (state.is_sufficient) {
      modules.push({ key: 'M5_matching', content: buildM5_Matching(matchedMandates) });
    }
  }

  const m4Loaded = modules.some(m => m.key.startsWith('M4_'));

  // FIX A: Intermediary status
  const intermediaryLine = state.is_intermediary
    ? `# INTERMEDIARY_ROLE: ${state.is_intermediary} — DO NOT ask the owner/advisor question again`
    : `# INTERMEDIARY_ROLE: unknown — ask once if not already stated in user's message`;

  // FIX D: Compact format when < 3 M3 fields missing
  const missingCount = computeMissingM3Fields(state);
  const compactLine = (missingCount > 0 && missingCount < 3)
    ? `# M3_FORMAT: compact — only ${missingCount} field(s) missing. Write as one natural sentence, NOT bullets.`
    : `# M3_FORMAT: standard`;

  // FIX E: Revenue mandatory for sell-side
  const revenueLine = (state.intent === 'SELL_SIDE' && !state.revenue)
    ? `# REVENUE_REQUIRED: true — ask revenue + EBITDA FIRST before any M4 questions`
    : `# REVENUE_REQUIRED: false`;

  // FIX C: Shell company context line
  const shellLine = (state.sub_sector === 'shell_company')
    ? `# SHELL_COMPANY_DETECTED: true — ask ONLY Structure, Licence, Compliance, Shareholding questions`
    : `# SHELL_COMPANY_DETECTED: false`;

  // FIX 4: Round limit
  const roundLine = state.round_count >= 4
    ? `# QUALIFICATION_ROUNDS: ${state.round_count}/4 — LIMIT REACHED. Summarise and close.`
    : `# QUALIFICATION_ROUNDS: ${state.round_count}/4`;

  // FIX 7: Known fields
  const knownFields: string[] = [];
  if (state.intent) knownFields.push(`intent:${state.intent}`);
  if (state.sector) knownFields.push(`sector:${state.sector}`);
  if (state.sub_sector) knownFields.push(`sub_sector:${state.sub_sector}`);
  if (state.geography) knownFields.push(`geography:${state.geography}`);
  if (state.deal_size) knownFields.push(`deal_size:${state.deal_size}`);
  if (state.revenue) knownFields.push(`revenue:${state.revenue}`);
  if (state.structure) knownFields.push(`structure:${state.structure}`);
  if (state.intent_focus) knownFields.push(`rationale:${state.intent_focus}`);
  if (state.is_intermediary) knownFields.push(`role:${state.is_intermediary}`);

  const phaseContext = [
    `\n# CURRENT CONVERSATION PHASE: ${state.phase}`,
    `# CURRENT INTENT: ${state.intent ?? 'unknown'}`,
    `# TURN: ${state.turn_count + 1} | REFINEMENTS USED: ${state.refinement_count}/3`,
    `# M4 QUESTIONS ASKED THIS SESSION: ${state.m4_questions_asked}`,
    `# MODULES IN THIS PROMPT: ${modules.map(m => m.key).join(', ')}`,
    intermediaryLine,
    compactLine,
    revenueLine,
    shellLine,
    roundLine,
    knownFields.length > 0
      ? `# FIELDS ALREADY PROVIDED — DO NOT ASK FOR THESE: ${knownFields.join(' | ')}`
      : '# FIELDS ALREADY PROVIDED: none yet',
    m4Loaded
      ? `# ⚠ M4 IS LOADED — sector questions are MANDATORY. Use intent-aware framing.`
      : `# M4 NOT LOADED — no sector-specific questions this turn`,
  ].join('\n');

  const systemPrompt = [phaseContext, ...modules.map(m => m.content)].join('\n\n---\n\n');

  return {
    systemPrompt,
    phase: state.phase,
    modulesLoaded: modules.map(m => m.key),
    tokenEstimate: Math.round(systemPrompt.length / 4),
  };
}