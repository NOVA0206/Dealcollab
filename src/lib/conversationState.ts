/**
 * 🧠 CONVERSATION STATE SCHEMA
 * Defines the structured data extracted during the Deal Intelligence flow.
 */

export interface ExtractedDealState {
  sector?: string | null;
  sub_sector?: string | null;
  geography?: string | null;
  deal_size?: string | null;
  revenue?: string | null;
  structure?: string | null;
  intent_focus?: string | null;
  is_intermediary?: 'owner' | 'advisor' | null;
  industry_data?: Record<string, unknown> | null;
  _source?: "document" | "chat";
  valuation?: string | null;
  offerings?: string | null;
  clients?: string | null;
  risks?: string | null;
  strategic_objective?: string | null;
  risk_appetite?: string | null;
}

export interface IntelligenceState {
  intent: "SELL_SIDE" | "BUY_SIDE" | "FUNDRAISING" | "DEBT" | "STRATEGIC_PARTNERSHIP" | null;
  state: ExtractedDealState;
  is_complete: boolean;
  message: string;
}

export const INITIAL_STATE: ExtractedDealState = {
  sector: null,
  sub_sector: null,
  geography: null,
  deal_size: null,
  revenue: null,
  structure: null,
  intent_focus: null,
  is_intermediary: null,
  industry_data: null
};
