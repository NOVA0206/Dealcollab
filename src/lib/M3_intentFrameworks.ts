/**
 * M3: Intent-Specific Intelligence Frameworks
 * ==========================================
 * Defines high-value signals and qualification frameworks for each deal intent.
 * Note: These provide intelligence, not control flow or behavior.
 */

import { DealIntent } from './types';

const M3_SELL_SIDE = `
# INTENT FRAMEWORK: SELL-SIDE
Goal: Position the business to attract high-quality buyers.
Key Signals:
- Full vs Partial Exit: Is the promoter staying?
- Valuation Expectation: Not mandatory but highly indicative of deal realism.
- Reason for Exit: Continuity, retirement, diversification, or distress?
- Buyer Preference: Strategic (synergy) vs Private Equity (growth/return).
`.trim();

const M3_BUY_SIDE = `
# INTENT FRAMEWORK: BUY_SIDE
Goal: Identify targets that meet specific strategic acquisition criteria.
Key Signals:
- Acquisition Objective: Roll-up, technology acquisition, or market entry?
- Target Profile: Preferred revenue/EBITDA size of the target.
- Geography Sensitivity: Domestic vs cross-border openness.
- Ticket Size: Maximum budget for the acquisition.
`.trim();

const M3_FUNDRAISING = `
# INTENT FRAMEWORK: FUNDRAISING
Goal: Match company to investors based on stage and capital needs.
Key Signals:
- Business Stage: Early-growth, Series A/B, or pre-IPO?
- Use of Funds: Expansion, debt reduction, or working capital?
- Instrument Preference: Pure Equity, Convertible, or Hybrid?
- Current Cap Table: Is it a primary or secondary round?
`.trim();

const M3_DEBT = `
# INTENT FRAMEWORK: DEBT / STRUCTURED FINANCE
Goal: Secure non-dilutive capital based on cash flows or assets.
Key Signals:
- Loan Purpose: Capex, Working Capital, or Acquisition Financing?
- Security/Collateral: Is there hard asset backing?
- Repayment Source: Operating cash flow vs project-specific proceeds.
- Current Debt: Existing leverage and debt-service capability.
`.trim();

const M3_STRATEGIC = `
# INTENT FRAMEWORK: STRATEGIC PARTNERSHIP
Goal: Identify non-capital collaboration opportunities.
Key Signals:
- Partnership Nature: JV, Distribution, Licensing, or Co-Development?
- Value Contribution: What does the user bring vs what do they seek?
- Exclusivity: Is this a sole-market partnership?
`.trim();

export const M3_MODULES: Record<Exclude<DealIntent, null>, string> = {
  SELL_SIDE: M3_SELL_SIDE,
  BUY_SIDE: M3_BUY_SIDE,
  FUNDRAISING: M3_FUNDRAISING,
  DEBT: M3_DEBT,
  STRATEGIC_PARTNERSHIP: M3_STRATEGIC,
};
