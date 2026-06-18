/**
 * DealCollab — Matchmaking Execution Engine
 * ==========================================
 * Place at: src/lib/matchmakingEngine.ts
 *
 * V2 Philosophy: "Semantic meaning is truth"
 *
 * Scoring weights:
 *   SEMANTIC   45% — cosine similarity (pgvector)
 *   INDUSTRY   35% — sector compatibility (DC-KB-003 via M5_sectorMatrix)
 *   FINANCIAL  10% — deal size Jaccard overlap
 *   GEOGRAPHY   5% — geography match
 *   FRESHNESS   5% — recency of proposal
 *
 * Pipeline:
 *   Phase 1 — Build clean canonical normalized text (no raw conversational noise)
 *   Phase 2 — Generate OpenAI embedding for storage (actual intent)
 *   Phase 3 — Generate reversed-intent query embedding (buyer finds sellers semantically)
 *   Phase 4 — Insert proposal record to proposals table
 *   Phase 5 — Store embedding via update_proposal_embedding RPC
 *   Phase 6 — pgvector ANN search with reversed-intent query embedding (top 30)
 *   Phase 7 — Apply hard rejection rules HR-1 to HR-8 in TypeScript
 *   Phase 8 — V2 composite scoring
 *   Phase 9 — Store top 10 matches in proposal_matches
 *   Phase 10 — Return MatchCard[] for immediate frontend rendering
 */

import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { getSectorCompatibility, normalizeSector, MATCH_ARCHETYPES, detectFraudSignals } from './M5_sectorMatrix';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ProposalInput {
  mandateId: string;
  userId: string;
  intent: string;
  raw_text: string;
  sector: string | null;
  sub_sector: string | null;
  geography: string | null;
  deal_size: string | null;
  revenue: string | null;
  structure: string | null;
  intent_focus: string | null;
  industry_data: Record<string, unknown>;
  special_conditions: string[];
  deal_size_min: string | null;
  deal_size_max: string | null;
  revenue_min: string | null;
  revenue_max: string | null;
  is_shell_query?: boolean;   // NM5: true = include shells, false = exclude
  document_url?: string | null;   // URL of uploaded PDF/doc (if any)
  document_text?: string | null;  // Extracted text from uploaded document
  id?: string;
}

interface Candidate {
  id: string;
  user_id: string | null;
  intent: string;
  sectors: string[] | null;
  geographies: string[] | null;
  deal_size_min_cr: number | null;
  deal_size_max_cr: number | null;
  revenue_min_cr: number | null;
  revenue_max_cr: number | null;
  deal_structure: string | null;
  normalised_text: string;
  similarity: number;
  advisor_name: string | null;
  contact_phone: string | null;
  fraud_flags: string[] | null;
  quality_tier: number;
  is_shell: boolean;
  created_at: string;
}

export interface MatchCard {
  matchedProposalId: string;
  sector: string | null;
  geography: string | null;
  sizeRange: string | null;
  finalScore: number;
  scoreLabel: 'High' | 'Good' | 'Possible';
  matchReason: string;
  archetype: string;
}

export interface MatchmakingResult {
  proposalId: string;
  matchCount: number;
  topScore: number;
  cards: MatchCard[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────
// INTENT REVERSAL
// ─────────────────────────────────────────────────────────────

// Single-target reverse used only for building the reversed query EMBEDDING TEXT
// (so a FUNDRAISING company's query text sounds like BUY_SIDE to attract investors)
const REVERSE_INTENT: Record<string, string> = {
  BUY_SIDE: 'SELL_SIDE',
  SELL_SIDE: 'BUY_SIDE',
  FUNDRAISING: 'BUY_SIDE',   // FIX: was 'INVESTMENT' — not a valid intent in this system
  DEBT: 'DEBT',
  STRATEGIC_PARTNERSHIP: 'STRATEGIC_PARTNERSHIP',
};

// Multi-target map: the actual counterparty intents the SQL should search for.
// Authoritative — mirrors scoringEngine.ts INTENT_FLIP exactly.
// Used for: (a) match_proposals RPC 'match_intents' param, (b) HR-1 check.
const COUNTERPARTY_INTENTS: Record<string, string[]> = {
  BUY_SIDE: ['SELL_SIDE', 'FUNDRAISING'],
  SELL_SIDE: ['BUY_SIDE'],
  FUNDRAISING: ['BUY_SIDE'],
  DEBT: ['DEBT'],
  STRATEGIC_PARTNERSHIP: ['STRATEGIC_PARTNERSHIP'],
};

// ─────────────────────────────────────────────────────────────
// V2 SCORING WEIGHTS
// ─────────────────────────────────────────────────────────────

const W = {
  SEMANTIC: 0.40,   // Phase 4: reduced from 0.45 to give room for geography
  INDUSTRY: 0.35,
  FINANCIAL: 0.10,
  GEOGRAPHY: 0.10,  // Phase 4: increased from 0.05 — geo proximity matters in India M&A
  FRESHNESS: 0.05,
} as const;

// ─────────────────────────────────────────────────────────────
// PHASE 1: CANONICAL NORMALIZED TEXT
// V2: clean structured text only — NO raw conversational noise
// ─────────────────────────────────────────────────────────────

export function buildCanonicalText(input: ProposalInput, intentOverride?: string): string {
  const parts: string[] = [];

  const intent = intentOverride ?? input.intent;
  if (intent) parts.push(intent);

  if (input.sector) {
    const canonical = normalizeSector(input.sector);
    parts.push(canonical);
    if (canonical !== input.sector.toUpperCase()) parts.push(input.sector);
  }

  if (input.sub_sector) parts.push(input.sub_sector);
  if (input.geography) parts.push(input.geography);
  if (input.structure) parts.push(input.structure);
  if (input.intent_focus) parts.push(input.intent_focus);

  // Financial signals as clean tokens
  const sMin = parseNum(input.deal_size_min);
  const sMax = parseNum(input.deal_size_max);
  if (sMin !== null || sMax !== null) {
    parts.push(`deal size ${sMin ?? '?'} to ${sMax ?? '?'} crore`);
  } else if (input.deal_size) {
    const nums = input.deal_size.match(/\d+/g);
    if (nums) parts.push(`deal size ${nums.join(' to ')} crore`);
  }

  const rMin = parseNum(input.revenue_min);
  const rMax = parseNum(input.revenue_max);
  if (rMin !== null || rMax !== null) {
    parts.push(`revenue ${rMin ?? '?'} to ${rMax ?? '?'} crore`);
  } else if (input.revenue) {
    const nums = input.revenue.match(/\d+/g);
    if (nums) parts.push(`revenue ${nums.join(' to ')} crore`);
  }

  // Structured industry_data only (skip narrative fields)
  const skipKeys = new Set(['company_overview', 'raw_description']);
  Object.entries(input.industry_data || {}).forEach(([k, v]) => {
    if (!skipKeys.has(k) && v && typeof v === 'string' && v.length < 120) {
      parts.push(`${k.replace(/_/g, ' ')}: ${v}`);
    }
  });

  return parts.filter(Boolean).join(' | ');
}

// ─────────────────────────────────────────────────────────────
// PHASE 2/3: EMBEDDING GENERATION
// ─────────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('[EMBEDDING] OPENAI_API_KEY not configured');
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

// ─────────────────────────────────────────────────────────────
// PHASE 7: HARD REJECTION RULES
// HR-1 to HR-8 — any rejection = discard candidate, no score computed
// ─────────────────────────────────────────────────────────────

function applyHardRejections(
  source: ProposalInput,
  candidate: Candidate,
): { rejected: boolean; reason?: string } {

  // 1. Sector Filter (Mandatory)
  if (source.sector && candidate.sectors?.[0]) {
    const comp = getSectorCompatibility(source.sector, candidate.sectors[0]);
    if (comp.level === 'INCOMPATIBLE') {
      return { rejected: true, reason: `HR-4: Sector incompatibility: ${comp.reason}` };
    }
  }

  // 2. Buy/Sell Side Filter (Intent polarity)
  const expectedIntents = COUNTERPARTY_INTENTS[source.intent] ?? [];
  if (expectedIntents.length > 0 && !expectedIntents.includes(candidate.intent)) {
    return { rejected: true, reason: `HR-1: Intent mismatch: ${candidate.intent} not in expected [${expectedIntents.join(', ')}]` };
  }

  // 3. Deal Structure Filter
  if (source.structure && candidate.deal_structure) {
    const src = source.structure.toLowerCase();
    const cnd = candidate.deal_structure.toLowerCase();
    if ((src.includes('100%') || src.includes('full buyout')) &&
      (cnd.includes('minority') || cnd.includes('fundrais'))) {
      return { rejected: true, reason: 'HR-3: Structure mismatch: Full buyout incompatible with minority fundraise' };
    }
  }

  // 4. Revenue / Deal Size Filter
  const sMax = parseNum(source.deal_size_max) ?? 0;
  const cMax = candidate.deal_size_max_cr ?? 0;
  if (sMax > 0 && cMax > 0) {
    const ratio = Math.max(sMax, cMax) / Math.max(Math.min(sMax, cMax), 0.01);
    if (ratio > 10) {
      return { rejected: true, reason: `HR-2: Size ratio ${ratio.toFixed(0)}× exceeds 10× ceiling` };
    }
  }

  // 5. Geography Filter
  if (source.geography && candidate.geographies && candidate.geographies.length > 0) {
    const srcGeo = source.geography.toLowerCase().trim();
    if (srcGeo !== 'flexible' && srcGeo !== 'india' && srcGeo !== 'pan india') {
      const cndGeos = candidate.geographies.map(g => g.toLowerCase().trim());
      const geoMatched = cndGeos.some(g =>
        g === srcGeo ||
        g.includes(srcGeo) ||
        srcGeo.includes(g) ||
        sameState(srcGeo, g) ||
        g === 'flexible' ||
        g === 'india' ||
        g === 'pan india'
      );
      if (!geoMatched) {
        return { rejected: true, reason: `Geography mismatch: candidate in [${candidate.geographies.join(', ')}] not aligned with ${source.geography}` };
      }
    }
  }

  // HR-7: Shell company filtering (NM5)
  if (!source.is_shell_query && candidate.is_shell === true) {
    return { rejected: true, reason: 'HR-7: Shell proposal excluded from operational query' };
  }

  // HR-8: Fraud signal rejection
  const fraudInFlags = (candidate.fraud_flags ?? []);
  const fraudInText = detectFraudSignals(candidate.normalised_text ?? '');
  if (fraudInFlags.length > 0 || fraudInText.length > 0) {
    return { rejected: true, reason: 'HR-8: Fraud signals detected' };
  }

  return { rejected: false };
}

// ─────────────────────────────────────────────────────────────
// PHASE 8: V2 COMPOSITE SCORING
// ─────────────────────────────────────────────────────────────

interface ScoreResult {
  finalScore: number;
  breakdown: Record<string, number>;
  matchReason: string;
  archetype: string;
}

// Phase 5 & 6: generate structured JSON match reason with bullet-point explanation
// and fit fields consumed by MatchPanel's detail view (sectorFit, geographyFit, revenueFit, strategicFit)
function buildMatchReason(
  source: ProposalInput,
  candidate: Candidate,
  breakdown: Record<string, number>,
  comp: { level: string; reason: string },
  archetype: string,
): string {
  const srcNorm = normalizeSector(source.sector ?? '');
  const cndNorm = normalizeSector(candidate.sectors?.[0] ?? '');
  const sectorLabel = (candidate.sectors?.[0] ?? 'target sector').replace(/_/g, ' ');
  const geoLabel = candidate.geographies?.[0] ?? 'matched region';
  const cMin = candidate.deal_size_min_cr ?? 0;
  const cMax = candidate.deal_size_max_cr ?? 0;
  const sizeLabel = formatSizeRange(cMin, cMax);
  const { semanticScore, industryScore, financialScore, geoScore } = breakdown;

  // Bullet-point explanation (Phase 6)
  const bullets: string[] = [];
  if (srcNorm && srcNorm === cndNorm) {
    bullets.push(`Exact sector match — same ${sectorLabel} sector`);
  } else if (industryScore >= 0.45) {
    bullets.push(`Compatible sector: ${sectorLabel} — ${archetype.toLowerCase()}`);
  }
  if (geoScore >= 0.9) {
    bullets.push(`Exact geography: ${geoLabel}`);
  } else if (geoScore >= 0.75) {
    bullets.push(`Same region: ${geoLabel}`);
  } else if (geoScore >= 0.45) {
    bullets.push(`Same state: ${geoLabel}`);
  } else if (geoScore >= 0.2) {
    bullets.push(`Same zone: ${geoLabel}`);
  }
  if (financialScore >= 0.7) {
    bullets.push(`Strong financial alignment${sizeLabel ? ': ' + sizeLabel : ''}`);
  } else if (sizeLabel) {
    bullets.push(`Deal size: ${sizeLabel}`);
  }
  if (semanticScore >= 0.7) {
    bullets.push('Strong mandate-to-opportunity semantic alignment');
  } else if (semanticScore >= 0.5) {
    bullets.push('Moderate mandate alignment detected');
  }
  if (bullets.length === 0) {
    bullets.push(`${sectorLabel} opportunity in ${geoLabel}${sizeLabel ? ' · ' + sizeLabel : ''}`);
  }
  const reason = bullets.map(b => `• ${b}`).join('\n');

  // Fit field texts for MatchPanel detail view (Phase 5)
  const sectorFit = srcNorm === cndNorm
    ? `Exact match — ${sectorLabel}`
    : industryScore >= 0.45
      ? `Compatible — ${comp.reason.split('.')[0]}`
      : `Adjacent — ${comp.reason.split('.')[0]}`;

  const geographyFit = geoScore >= 0.9
    ? `Exact: ${geoLabel}`
    : geoScore >= 0.75
      ? `Same region: ${geoLabel}`
      : geoScore >= 0.45
        ? `Same state: ${geoLabel}`
        : geoScore >= 0.2
          ? `Same zone: ${geoLabel}`
          : geoLabel;

  const revenueFit = sizeLabel
    ? financialScore >= 0.7
      ? `Strong overlap: ${sizeLabel}`
      : `Within range: ${sizeLabel}`
    : null;

  const strategicFit = source.intent_focus ?? null;

  return JSON.stringify({
    reason,
    sectorFit,
    geographyFit,
    ...(revenueFit ? { revenueFit } : {}),
    ...(strategicFit ? { strategicFit } : {}),
  });
}

function calculateV2Score(source: ProposalInput, candidate: Candidate): ScoreResult {

  // SEMANTIC (45%) — raw cosine similarity from pgvector
  const semanticScore = Math.max(0, Math.min(1, candidate.similarity));

  // INDUSTRY ALIGNMENT (35%) — sector compatibility via DC-KB-003
  const srcNorm = normalizeSector(source.sector ?? '');
  const cndNorm = normalizeSector(candidate.sectors?.[0] ?? '');
  const isSameSector = srcNorm === cndNorm;

  const comp = getSectorCompatibility(
    source.sector ?? '',
    candidate.sectors?.[0] ?? '',
  );
  let industryScore = 0;
  if (isSameSector) {
    industryScore = 1.0;
  } else if (comp.level === 'COMPATIBLE') {
    industryScore = 0.5; // Lower industry score for cross-sector compatible
  } else if (comp.level === 'NARROW') {
    industryScore = 0.25;
  } else {
    industryScore = 0.1;
  }

  // FINANCIAL (10%) — deal size Jaccard overlap
  const sMin = parseNum(source.deal_size_min) ?? 0;
  const sMax = parseNum(source.deal_size_max) ?? sMin;
  const cMin = candidate.deal_size_min_cr ?? 0;
  const cMax = candidate.deal_size_max_cr ?? cMin;

  let financialScore = 0.5; // neutral when data unavailable
  if (sMax > 0 && cMax > 0) {
    const overlapMin = Math.max(sMin, cMin);
    const overlapMax = Math.min(sMax, cMax);
    const overlap = Math.max(0, overlapMax - overlapMin);
    const union = Math.max(sMax, cMax) - Math.min(sMin, cMin);
    financialScore = union > 0 ? overlap / union : 0.1;
  }

  // GEOGRAPHY (10%) — 5-level proximity scoring (Phase 4)
  const geoScore = getGeoProximityScore(source.geography ?? '', candidate.geographies ?? []);

  // FRESHNESS (5%) — recency bonus
  let freshnessScore = 0.5;
  if (candidate.created_at) {
    const ageDays = (Date.now() - new Date(candidate.created_at).getTime()) / 86400000;
    if (ageDays <= 30) freshnessScore = 1.0;
    else if (ageDays <= 90) freshnessScore = 0.7;
    else freshnessScore = 0.3;
  }

  // COMPOSITE
  let finalScore =
    semanticScore * W.SEMANTIC * 100 +
    industryScore * W.INDUSTRY * 100 +
    financialScore * W.FINANCIAL * 100 +
    geoScore * W.GEOGRAPHY * 100 +
    freshnessScore * W.FRESHNESS * 100;

  // ADJUSTMENTS
  if (!isSameSector) finalScore -= 15; // Cross-sector penalty to guarantee same-sector preference
  if (comp.level === 'NARROW') finalScore -= 10;
  // Phase 4: tiered geo bonus (5 proximity levels)
  if (geoScore >= 0.9) finalScore += 10;       // exact city
  else if (geoScore >= 0.75) finalScore += 7;   // city-in-region
  else if (geoScore >= 0.45) finalScore += 4;   // same state
  else if (geoScore >= 0.2) finalScore += 2;    // same zone
  if (candidate.quality_tier === 1) finalScore += 5;
  else if (candidate.quality_tier === 2) finalScore += 2;

  finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  // ARCHETYPE
  let archetype: string = MATCH_ARCHETYPES.CROSS_SECTOR;
  if (!source.sector || srcNorm === cndNorm) {
    archetype = MATCH_ARCHETYPES.BOLT_ON;
  } else if (comp.reason.includes('licence') || comp.reason.includes('Licence')) {
    archetype = MATCH_ARCHETYPES.LICENSE;
  } else if (comp.reason.includes('Vertical') || comp.reason.includes('backward integration')) {
    archetype = MATCH_ARCHETYPES.VERTICAL;
  } else if (comp.reason.includes('software') || comp.reason.includes('Tech')) {
    archetype = MATCH_ARCHETYPES.TECH_ENABLER;
  }

  // MATCH REASON — structured JSON (Phases 5 & 6): bullet-point reason + sectorFit / geographyFit / revenueFit
  const breakdown = { semanticScore, industryScore, financialScore, geoScore, freshnessScore };
  const matchReason = buildMatchReason(source, candidate, breakdown, comp, archetype);

  return {
    finalScore,
    breakdown: { semanticScore, industryScore, financialScore, geoScore, freshnessScore },
    matchReason,
    archetype,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function parseNum(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function formatSizeRange(min: number, max: number): string | null {
  if (!min && !max) return null;
  if (min === max) return `₹${min} Cr`;
  if (!min) return `Up to ₹${max} Cr`;
  if (!max) return `₹${min}+ Cr`;
  return `₹${min}–${max} Cr`;
}

function getScoreLabel(score: number): 'High' | 'Good' | 'Possible' {
  if (score >= 75) return 'High';
  if (score >= 55) return 'Good';
  return 'Possible';
}

function sameState(geo1: string, geo2: string): boolean {
  const groups = [
    ['mumbai', 'pune', 'nashik', 'nagpur', 'maharashtra', 'mh'],
    ['ahmedabad', 'surat', 'gujarat', 'rajkot', 'vadodara', 'gj'],
    ['delhi', 'noida', 'gurgaon', 'gurugram', 'faridabad', 'ncr', 'new delhi'],
    ['bangalore', 'bengaluru', 'mysore', 'karnataka'],
    ['hyderabad', 'secunderabad', 'telangana', 'andhra'],
    ['chennai', 'coimbatore', 'madurai', 'tamil nadu', 'tn'],
    ['kolkata', 'west bengal', 'wb'],
    ['lucknow', 'kanpur', 'uttar pradesh', 'up'],
    ['kochi', 'trivandrum', 'thiruvananthapuram', 'kerala'],
    ['bhopal', 'indore', 'madhya pradesh', 'mp'],
  ];
  return groups.some(g => g.some(k => geo1.includes(k)) && g.some(k => geo2.includes(k)));
}

// Phase 4: broader geographic zone groupings (cross-state clusters)
function sameZone(geo1: string, geo2: string): boolean {
  const ZONES: string[][] = [
    // Western India
    ['mumbai', 'pune', 'nashik', 'nagpur', 'maharashtra', 'mh', 'ahmedabad', 'surat',
     'gujarat', 'rajkot', 'vadodara', 'gj', 'goa', 'rajasthan', 'jaipur', 'udaipur'],
    // Northern India / NCR
    ['delhi', 'noida', 'gurgaon', 'gurugram', 'faridabad', 'ncr', 'new delhi', 'lucknow',
     'kanpur', 'uttar pradesh', 'up', 'punjab', 'haryana', 'chandigarh', 'amritsar'],
    // Southern India
    ['bangalore', 'bengaluru', 'mysore', 'karnataka', 'hyderabad', 'secunderabad',
     'telangana', 'andhra', 'vizag', 'visakhapatnam', 'chennai', 'coimbatore',
     'madurai', 'tamil nadu', 'tn', 'kerala', 'kochi', 'trivandrum', 'thiruvananthapuram'],
    // Eastern India
    ['kolkata', 'west bengal', 'wb', 'odisha', 'bhubaneswar', 'jharkhand', 'ranchi',
     'patna', 'bihar'],
    // Central India
    ['bhopal', 'indore', 'madhya pradesh', 'mp', 'raipur', 'chhattisgarh'],
  ];
  return ZONES.some(z => z.some(k => geo1.includes(k)) && z.some(k => geo2.includes(k)));
}

// Phase 4: 5-level geo proximity scorer
function getGeoProximityScore(srcGeo: string, cndGeos: string[]): number {
  if (!srcGeo || !cndGeos.length) return 0;
  const src = srcGeo.toLowerCase().trim();
  const cndLower = cndGeos.map(g => g.toLowerCase().trim());
  const panIndia = ['india', 'pan-india', 'pan india', 'all india', 'nationwide', 'pan', 'flexible'];
  // Pan-India mandate — partial credit (they accept anywhere)
  if (cndLower.some(g => panIndia.includes(g)) || panIndia.includes(src)) return 0.15;
  // Level 1: exact city match
  if (cndLower.some(g => g === src)) return 1.0;
  // Level 2: one string contains the other (e.g. "Pune" ⊂ "Pune, Maharashtra")
  if (cndLower.some(g => g.includes(src) || src.includes(g))) return 0.80;
  // Level 3: same state cluster
  if (cndLower.some(g => sameState(src, g))) return 0.50;
  // Level 4: same broad zone
  if (cndLower.some(g => sameZone(src, g))) return 0.25;
  return 0;
}

function computeQualityScore(input: ProposalInput): number {
  let s = 0;
  if (input.intent) s += 2;
  if (input.sector) s += 2;
  if (input.geography) s += 1;
  if (input.deal_size_min || input.deal_size_max) s += 1;
  if (input.revenue_min || input.revenue_max) s += 1;
  if (input.structure) s += 1;
  if (input.intent_focus) s += 1;
  if (Object.keys(input.industry_data ?? {}).length > 0) s += 1;
  return Math.min(s, 10);
}

function computeQualityTier(input: ProposalInput): number {
  const s = computeQualityScore(input);
  if (s >= 8) return 1;
  if (s >= 5) return 2;
  if (s >= 2) return 3;
  return 4;
}

// ─────────────────────────────────────────────────────────────
// MANDATE SUMMARY GENERATOR
// Produces an 80–250 word anonymized executive summary from
// structured ProposalInput fields. Stored in proposals.metadata
// and surfaced in the Deal Log as the human-readable preview.
// ─────────────────────────────────────────────────────────────

export function buildMandateSummary(input: ProposalInput): string {
  const intentMap: Record<string, string> = {
    SELL_SIDE: 'sell-side divestment',
    BUY_SIDE: 'strategic acquisition',
    FUNDRAISING: 'growth capital fundraise',
    DEBT: 'debt financing',
    STRATEGIC_PARTNERSHIP: 'strategic partnership',
  };
  const intentLabel = intentMap[input.intent] ?? 'strategic transaction';
  const sectorRaw = input.sector ?? 'business';
  const sector = sectorRaw.replace(/_/g, ' ');
  const subSector = input.sub_sector === 'shell_company' ? 'dormant/shell company' : (input.sub_sector?.replace(/_/g, ' ') ?? null);
  const geo = input.geography;

  const sentences: string[] = [];

  // — Opener
  const geoStr = geo ? `${geo}-based ` : '';
  const subStr = subSector && subSector !== sector ? ` (${subSector})` : '';
  sentences.push(
    `${cap(intentLabel)} opportunity in the ${geoStr}${sector}${subStr} sector.`
  );

  // — Deal parameters
  const paramParts: string[] = [];
  const sMin = parseNum(input.deal_size_min);
  const sMax = parseNum(input.deal_size_max);
  if (sMin !== null || sMax !== null) {
    paramParts.push(
      sMin !== null && sMax !== null && sMin !== sMax
        ? `deal size ₹${sMin}–${sMax} Cr`
        : `deal size ₹${sMax ?? sMin} Cr`
    );
  } else if (input.deal_size) {
    paramParts.push(`deal size of ${input.deal_size}`);
  }
  const rMin = parseNum(input.revenue_min);
  const rMax = parseNum(input.revenue_max);
  if (rMin !== null || rMax !== null) {
    paramParts.push(
      rMin !== null && rMax !== null && rMin !== rMax
        ? `annual revenue ₹${rMin}–${rMax} Cr`
        : `annual revenue ₹${rMax ?? rMin} Cr`
    );
  } else if (input.revenue) {
    paramParts.push(`revenue of ${input.revenue}`);
  }
  if (input.structure) paramParts.push(`${input.structure} transaction structure`);
  if (paramParts.length > 0) {
    sentences.push(`The mandate involves ${paramParts.join(', ')}.`);
  }

  // — Operational highlights from industry_data
  const id = input.industry_data ?? {};
  const strOf = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

  const highlights: string[] = [];
  const capacity = strOf(id.capacity) ?? strOf(id.installed_capacity) ?? strOf(id.production_capacity);
  const employees = strOf(id.employees) ?? strOf(id.workforce) ?? strOf(id.headcount);
  const ebitda = strOf(id.ebitda) ?? strOf(id.profitability) ?? strOf(id.margins);
  const channel = strOf(id.distribution_channel) ?? strOf(id.channel) ?? strOf(id.sales_channel);
  const model = strOf(id.business_model) ?? strOf(id.model) ?? strOf(id.revenue_model);
  const clients = strOf(id.clients) ?? strOf(id.customer_count) ?? strOf(id.customers);
  const beds = strOf(id.beds) ?? strOf(id.bed_count);
  const hospitals = strOf(id.hospitals) ?? strOf(id.hospital_count);
  const sku = strOf(id.sku_count) ?? strOf(id.product_range) ?? strOf(id.product_count);
  const arr = strOf(id.arr) ?? strOf(id.arpu) ?? strOf(id.mrr);
  const growth = strOf(id.growth_rate) ?? strOf(id.yoy_growth) ?? strOf(id.growth);
  const patents = strOf(id.patents) ?? strOf(id.ip);

  if (capacity) highlights.push(`production capacity of ${capacity}`);
  if (employees) highlights.push(`workforce of ${employees}`);
  if (ebitda) highlights.push(`${ebitda} EBITDA / profitability profile`);
  if (channel) highlights.push(`${channel} distribution channel`);
  if (model) highlights.push(`${model} business model`);
  if (clients) highlights.push(`${clients} active clients or customers`);
  if (hospitals) highlights.push(`${hospitals} hospital facilities`);
  if (beds) highlights.push(`${beds} operational beds`);
  if (sku) highlights.push(`${sku} SKU / product range`);
  if (arr) highlights.push(`ARR / revenue run-rate of ${arr}`);
  if (growth) highlights.push(`${growth} revenue growth trajectory`);
  if (patents) highlights.push(`${patents} patents or IP assets`);

  if (highlights.length > 0) {
    sentences.push(`Key operational attributes include ${highlights.slice(0, 4).join(', ')}.`);
  }

  // — Counterparty profile
  const counterpartyFallback: Record<string, string> = {
    SELL_SIDE: 'strategic operators and private investment groups seeking expansion within the sector',
    BUY_SIDE: 'business owners, promoters, and intermediaries representing viable sell-side opportunities',
    FUNDRAISING: 'institutional investors, family offices, and growth-stage equity funds',
    DEBT: 'NBFCs, private credit funds, and structured debt providers',
    STRATEGIC_PARTNERSHIP: 'aligned strategic counterparties seeking mutually beneficial business collaboration',
  };
  const counterpartyDesc = input.intent_focus
    ? input.intent_focus.charAt(0).toLowerCase() + input.intent_focus.slice(1)
    : counterpartyFallback[input.intent] ?? 'aligned strategic counterparties';
  const geoSuffix = geo ? ` operating in or around ${geo}` : ' across India';
  sentences.push(`Ideal counterparties include ${counterpartyDesc}${geoSuffix}.`);

  const summary = sentences.join(' ');
  console.log(`[M5] Mandate summary generated (${summary.split(' ').length} words): ${summary.slice(0, 80)}...`);
  return summary;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────
// ASYNC RE-MATCH: save to saved_searches when no matches found
// ─────────────────────────────────────────────────────────────

async function saveForAsyncRematch(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  proposalId: string,
  input: ProposalInput,
  embedding: number[],
): Promise<void> {
  try {
    await supabase!.from('saved_searches').insert([{
      user_id: input.userId,
      proposal_id: proposalId,
      intent: input.intent,
      sectors: input.sector ? [normalizeSector(input.sector)] : [],
      geographies: input.geography ? [input.geography] : [],
      query_embedding: embedding,
      status: 'PENDING',
    }]);
    console.log('[M5] Saved to saved_searches for 90-day async re-match');
  } catch (e) {
    console.warn('[M5] saved_searches insert failed (non-blocking):', e);
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN EXECUTION ENGINE
// Called synchronously from route.ts after mandate insert.
// Runs with 12-second timeout — match cards appear in same API response.
// ─────────────────────────────────────────────────────────────

export async function executeMatchmaking(
  input: ProposalInput,
): Promise<MatchmakingResult | null> {

  console.log("[MATCHING] Triggering matching");
  console.log('[M5] ====== MATCHMAKING ENGINE STARTED ======');
  console.log('[MATCHMAKING_TRIGGERED] Matchmaking triggered.');
  console.log(`[M5] intent: ${input.intent} | sector: ${input.sector} | geo: ${input.geography}`);

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    console.error('[M5] Supabase client init failed');
    return null;
  }

  try {
    // ── Phase 1: Build canonical texts ───────────────────────
    const storageText = buildCanonicalText(input);
    const reversedIntent = REVERSE_INTENT[input.intent] ?? input.intent;
    const queryText = buildCanonicalText(input, reversedIntent);

    console.log('[M5] Storage text:', storageText.slice(0, 80) + '...');
    console.log('[M5] Query text (reversed):', queryText.slice(0, 80) + '...');
    console.log(`[MATCH_QUERY_GENERATED] Matching query generated: "${queryText.slice(0, 100)}..."`);

    // ── Phase 2/3: Generate embeddings ───────────────────────
    const [storageEmbedding, queryEmbeddingRaw] = await Promise.all([
      embed(storageText),
      storageText !== queryText ? embed(queryText) : Promise.resolve(null as number[] | null),
    ]);
    const searchEmbedding = queryEmbeddingRaw ?? storageEmbedding;
    console.log('[M5] Embeddings generated');

    // ── Phase 4: Insert proposal record ──────────────────────
    // raw_text: document text first (full PDF content for full-text search),
    // fall back to user message only when substantive (>50 chars — avoids storing "Go ahead!" etc.),
    // then canonical text if no document attached.
    const rawTextIsSubstantive = input.raw_text && input.raw_text.trim().length > 50;
    const enrichedRawText = (input.document_text || (rawTextIsSubstantive ? input.raw_text : null) || storageText).slice(0, 50_000);

    const safeDocText = input.document_text || null;
    const safeDocUrl = input.document_url || null;

    const { data: proposal, error: propErr } = await supabase
      .from('proposals')
      .insert([{
        id: input.id || undefined,
        user_id: input.userId,
        mandate_id: input.mandateId,
        raw_text: enrichedRawText || storageText.slice(0, 4000),
        normalised_text: storageText,
        document_text: safeDocText,
        document_url: safeDocUrl,
        intent: input.intent,
        sectors: input.sector ? [normalizeSector(input.sector)] : [],
        geographies: input.geography ? [input.geography] : [],
        deal_structure: input.structure,
        deal_size_min_cr: parseNum(input.deal_size_min),
        deal_size_max_cr: parseNum(input.deal_size_max),
        revenue_min_cr: parseNum(input.revenue_min),
        revenue_max_cr: parseNum(input.revenue_max),
        special_conditions: input.special_conditions ?? [],
        metadata: {
          ...(input.industry_data ?? {}),
          ...(safeDocUrl ? { document_url: safeDocUrl } : {}),
          mandate_summary: buildMandateSummary(input),
        },
        quality_score: computeQualityScore(input),
        quality_tier: computeQualityTier(input),
        embedding_status: 'GENERATING',
        status: 'ACTIVE',
        source: 'WEB',
      }])
      .select('id')
      .single();

    if (propErr || !proposal) {
      console.error('[M5] Proposal insert failed:', propErr);
      return null;
    }
    console.log('[M5] Proposal created:', proposal.id);
    console.log('[M5] Document text length:', safeDocText?.length ?? 0);
    console.log('[M5] Document URL:', safeDocUrl);

    // ── Phase 5: Store embedding ──────────────────────────────
    const { error: embErr } = await supabase.rpc('update_proposal_embedding', {
      proposal_id: proposal.id,
      embedding_vector: storageEmbedding,
    });
    if (embErr) console.warn('[M5] Embedding RPC failed (non-blocking):', embErr.message);
    else console.log('[M5] Storage embedding stored');

    // Fetch total active proposals count from public DB for observability
    let totalActiveProposals = 0;
    try {
      const { count } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE');
      totalActiveProposals = count ?? 0;
    } catch (e) {
      console.warn('[M5] Failed to fetch total active proposals count:', e);
    }
    console.log(`[TOTAL_ACTIVE_PROPOSALS] Total Active Proposals: ${totalActiveProposals}`);

    // ── Phase 6: pgvector ANN search ─────────────────────────
    // result_count increased to 1000 to search complete universe of candidates
    const targetIntents = COUNTERPARTY_INTENTS[input.intent] ?? [input.intent];
    console.log('[M5] Target counterparty intents:', targetIntents);
    console.log("[MATCHMAKING] Search started");
    const { data: rawCandidates, error: searchErr } = await supabase.rpc('match_proposals', {
      query_embedding: searchEmbedding,
      match_intents: targetIntents,
      exclude_user_id: input.userId,
      min_quality: 3,
      result_count: 1000,
    });

    if (searchErr) {
      console.error('[M5] pgvector search failed:', searchErr);
      await saveForAsyncRematch(supabase, proposal.id, input, searchEmbedding);
      return { proposalId: proposal.id, matchCount: 0, topScore: 0, cards: [], summary: 'Searching for counterparties...' };
    }

    const candidates = (rawCandidates ?? []) as Candidate[];
    console.log("[MATCHMAKING] Candidates found");
    console.log('[M5] Candidates from pgvector:', candidates.length);
    console.log(`[MATCHES_RETRIEVED] Retrieved ${candidates.length} candidates from database query.`);

    if (candidates.length === 0) {
      await saveForAsyncRematch(supabase, proposal.id, input, searchEmbedding);
      return { proposalId: proposal.id, matchCount: 0, topScore: 0, cards: [], summary: 'No immediate matches. Your mandate runs continuously for 90 days.' };
    }

    // ── Phase 7/8: Hard rejections + V2 scoring ──────────────
    const phoneCount: Record<string, number> = {};
    const scoredRows: Array<{
      proposal_id: string;
      matched_proposal_id: string;
      similarity_score: number;   // FIX: was semantic_score (renamed in 20260515 migration)
      industry_score: number;
      financial_score: number;
      geography_boost: number;    // FIX: was geography_score (renamed in 20260515 migration)
      confidence_score: number;   // FIX: was freshness_score (renamed in 20260515 migration)
      final_score: number;
      match_reason: string;
      match_archetype: string;
      status: string;
    }> = [];

    // Diagnostic filter checks on retrieved candidates
    let sectorMatchCount = 0;
    let geographyMatchCount = 0;
    let sizeMatchCount = 0;
    let eligibleMatchCount = 0;

    for (const cand of candidates) {
      const { rejected, reason } = applyHardRejections(input, cand);

      // Track individual filter diagnostics
      const sectorComp = getSectorCompatibility(input.sector ?? '', cand.sectors?.[0] ?? '');
      if (sectorComp.level !== 'INCOMPATIBLE') sectorMatchCount++;

      const srcGeo = (input.geography ?? '').toLowerCase();
      const cndGeos = (cand.geographies ?? []).map(g => g.toLowerCase());
      const geoMatched = !srcGeo || cndGeos.length === 0 || cndGeos.some(g => g === srcGeo || g.includes(srcGeo) || srcGeo.includes(g) || sameState(srcGeo, g));
      if (geoMatched) geographyMatchCount++;

      const sMax = parseNum(input.deal_size_max) ?? 0;
      const cMax = cand.deal_size_max_cr ?? 0;
      const sizeMatched = !(sMax > 0 && cMax > 0 && (Math.max(sMax, cMax) / Math.max(Math.min(sMax, cMax), 0.01)) > 10);
      if (sizeMatched) sizeMatchCount++;

      if (rejected) { console.log(`[M5] REJECT ${cand.id}: ${reason}`); continue; }

      // HR-6: Advisor flood cap
      if (cand.contact_phone) {
        phoneCount[cand.contact_phone] = (phoneCount[cand.contact_phone] ?? 0) + 1;
        if (phoneCount[cand.contact_phone] > 2) {
          console.log('[M5] HR-6: advisor flood cap hit');
          continue;
        }
      }

      eligibleMatchCount++;
      const scored = calculateV2Score(input, cand);
      console.log(`[M5] SCORE ${cand.id.slice(-8)}: ${scored.finalScore} (${scored.archetype})`);

      if (scored.finalScore >= 40) {
        scoredRows.push({
          proposal_id: proposal.id,
          matched_proposal_id: cand.id,
          similarity_score: scored.breakdown.semanticScore,   // FIX: post-rename column
          industry_score: scored.breakdown.industryScore,
          financial_score: scored.breakdown.financialScore,
          geography_boost: scored.breakdown.geoScore,          // FIX: post-rename column
          confidence_score: scored.breakdown.freshnessScore,   // FIX: post-rename column
          final_score: scored.finalScore,
          match_reason: scored.matchReason,
          match_archetype: scored.archetype,
          status: 'ACTIVE',
        });
      }
    }

    console.log(`[SECTOR_MATCHES] Sector matches count: ${sectorMatchCount}`);
    console.log(`[GEOGRAPHY_MATCHES] Geography matches count: ${geographyMatchCount}`);
    console.log(`[SIZE_MATCHES] Size matches count: ${sizeMatchCount}`);
    console.log(`[MATCHES_FILTERED] Filtered matches count: ${eligibleMatchCount}`);

    // Sort by score descending, keep top 10
    scoredRows.sort((a, b) => b.final_score - a.final_score);
    const topRows = scoredRows.slice(0, 10);
    console.log(`[MATCHES_RANKED] Ranked matches: ${topRows.length} qualified matches (score >= 40).`);
    console.log(`[FINAL_MATCHES] Final matches count: ${topRows.length}`);

    // ── Phase 9: Store matches ────────────────────────────────
    if (topRows.length > 0) {
      const { error: insertErr } = await supabase.from('proposal_matches').insert(topRows);
      if (insertErr) console.error('[M5] Match insert error:', insertErr);
      else console.log(`[M5] ${topRows.length} matches stored`);
    } else {
      await saveForAsyncRematch(supabase, proposal.id, input, searchEmbedding);
    }

    // ── Phase 10: Build match cards for frontend ──────────────
    const cards: MatchCard[] = topRows.slice(0, 3).map(row => {
      const cand = candidates.find(c => c.id === row.matched_proposal_id)!;
      const cMin = cand.deal_size_min_cr ?? 0;
      const cMax = cand.deal_size_max_cr ?? 0;
      return {
        matchedProposalId: row.matched_proposal_id,
        sector: cand.sectors?.[0] ?? null,
        geography: cand.geographies?.[0] ?? null,
        sizeRange: formatSizeRange(cMin, cMax),
        finalScore: row.final_score,
        scoreLabel: getScoreLabel(row.final_score),
        matchReason: row.match_reason,
        archetype: row.match_archetype,
      };
    });

    const topScore = topRows[0]?.final_score ?? 0;
    console.log("[MATCHING] Matches found");
    console.log("[MATCHMAKING] Finished");
    console.log(`[M5] ====== COMPLETE: ${topRows.length} matches, top score ${topScore} ======`);
    console.log(`[MATCHES_RETURNED] Returning ${cards.length} match cards for frontend display.`);
    console.log(`[FINAL_MATCH_COUNT] Final Ranked Matches: ${topRows.length}`);

    return {
      proposalId: proposal.id,
      matchCount: topRows.length,
      topScore,
      cards,
      summary: topRows.length > 0
        ? `${topRows.length} aligned counterpart${topRows.length > 1 ? 'ies' : 'y'} identified.`
        : 'No immediate matches. Your mandate runs continuously for 90 days.',
    };

  } catch (err) {
    console.error('[M5] CRITICAL FAILURE:', err);
    return null;
  }
}