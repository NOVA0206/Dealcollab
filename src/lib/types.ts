/**
 * 🧱 DEAL INTELLIGENCE TYPES
 * Shared types for Router, Dictionary, and Intelligence Engine.
 */

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
  | 'steel'
  | 'automation'
  | 'bpo'
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
  phase: ConversationPhase;
  turn_count: number;
  refinement_count: number;
  special_conditions: string[];
}
