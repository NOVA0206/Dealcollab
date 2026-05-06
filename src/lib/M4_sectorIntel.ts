/**
 * M4: Sector-Specific Domain Intelligence
 * =======================================
 * Defines domain signals and value-drivers for each sector.
 * Note: These are for context/depth. They do NOT define questions.
 */

import { SectorKey } from './types';

const M4_PHARMA = `
# SECTOR SIGNALS: PHARMA / HEALTHCARE
- Signals: ["Formulations vs API", "CRAMS/CDMO exposure", "Therapeutic area focus", "Institution dependency"]
- Filters: ["USFDA/EU approvals", "MIDC/GIDC plant status", "DMF/CEP ownership", "R&D spend %"]
`.trim();

const M4_MANUFACTURING = `
# SECTOR SIGNALS: MANUFACTURING / INDUSTRIAL
- Signals: ["OEM-led vs Aftermarket", "Export-driven", "Contract manufacturing exposure", "Capital intensive"]
- Filters: ["ISO/IATF certifications", "MIDC/GIDC location", "Order book value", "Capacity utilization"]
`.trim();

const M4_SAAS = `
# SECTOR SIGNALS: SAAS / TECHNOLOGY
- Signals: ["B2B Enterprise vs SME", "Platform vs Product", "Founder dependent sales", "India-centric vs Global"]
- Filters: ["ARR/MRR quality", "Net Revenue Retention (NRR)", "LTV/CAC ratio", "Tech stack moat"]
`.trim();

const M4_FINSERV = `
# SECTOR SIGNALS: FINANCIAL SERVICES / NBFC
- Signals: ["Asset-led vs Advisory", "Lending vertical (Gold/Auto/SME)", "Tech-first (Fintech) vs Traditional"]
- Filters: ["RBI License status", "AUM growth", "Gross/Net NPA", "Cost of funds"]
`.trim();

const M4_CONSUMER = `
# SECTOR SIGNALS: CONSUMER BRAND / D2C
- Signals: ["Omnichannel vs D2C", "Hero-product concentration", "Regional vs National", "High repeat purchase"]
- Filters: ["Gross margin level", "Marketplace dependency %", "SKU depth", "Brand search volume"]
`.trim();

const M4_REALESTATE = `
# SECTOR SIGNALS: REAL ESTATE / INFRA
- Signals: ["Annuity income vs Project sales", "Commercial vs Residential", "Asset-light development"]
- Filters: ["RERA compliance", "Occupancy rates", "FSI available", "Debt service coverage"]
`.trim();

const M4_LOGISTICS = `
# SECTOR SIGNALS: LOGISTICS / SUPPLY CHAIN
- Signals: ["Asset-light (3PL) vs Owned-fleet", "Cold chain specialty", "Enterprise contract density"]
- Filters: ["Route concentration", "Warehouse sqft under mgmt", "Vehicle age/health", "Tech integration level"]
`.trim();

const M4_EDUCATION = `
# SECTOR SIGNALS: EDUCATION / EDTECH
- Signals: ["K12 vs Higher Ed vs Skilling", "Physical vs Online", "Test prep dependency"]
- Filters: ["Accreditation status", "Customer Acquisition Cost (CAC)", "Course completion rates"]
`.trim();

const M4_CHEMICALS = `
# SECTOR SIGNALS: CHEMICALS / SPECIALTY
- Signals: ["Commodity vs Speciality", "B2B industrial supply", "Pollution-intensive status"]
- Filters: ["Environmental clearances (EC)", "GIDC location", "Solvent recovery systems"]
`.trim();

const M4_HOSPITALITY = `
# SECTOR SIGNALS: HOSPITALITY
- Signals: ["Owned vs Managed", "Corporate vs Leisure focus", "F&B vs Room revenue mix"]
- Filters: ["Occupancy rates", "Average Room Rate (ARR)", "RevPAR", "Star rating/Brand"]
`.trim();

const M4_RENEWABLE = `
# SECTOR SIGNALS: RENEWABLE ENERGY
- Signals: ["Utility scale vs C&I", "Solar vs Wind vs Hybrid", "EPC vs IPP model"]
- Filters: ["PPA tenure", "Counterparty rating", "CUF %", "Land title status"]
`.trim();

const M4_DEFENCE = `
# SECTOR SIGNALS: DEFENCE / AEROSPACE
- Signals: ["Indigenization focus", "OEM partnership status", "Govt vs Export mix"]
- Filters: ["DGQA/DRDO approvals", "Industrial License status", "Security clearances"]
`.trim();

const M4_STEEL = `
# SECTOR SIGNALS: STEEL / METALS
- Signals: ["Integrated vs Secondary steel", "TMT/Rebar focus", "Export vs Domestic B2B"]
- Filters: ["Power cost per ton", "Raw material sourcing security", "MIDC proximity"]
`.trim();

const M4_AUTOMATION = `
# SECTOR SIGNALS: AUTOMATION / ROBOTICS
- Signals: ["Industry 4.0 integration", "IIoT vs Hardware", "Project vs Recurring revenue"]
- Filters: ["Proprietary IP", "Client retention", "Implementation cycles"]
`.trim();

const M4_BPO = `
# SECTOR SIGNALS: BPO / BPM
- Signals: ["International vs Domestic voice/non-voice", "Health/BFSI vertical focus", "High automation %"]
- Filters: ["Seat capacity", "Seat utilization %", "Contract longevity"]
`.trim();

const M4_MIXED = `
# SECTOR SIGNALS: MIXED / CROSS-SECTOR
- Signals: ["Multi-industry exposure", "Conglomerate structure", "Synergy-led expansion"]
- Filters: ["Core revenue driver", "Diversification risk", "Resource sharing level"]
`.trim();

export const M4_MODULES: Record<SectorKey, string> = {
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
  steel: M4_STEEL,
  automation: M4_AUTOMATION,
  bpo: M4_BPO,
  mixed: M4_MIXED,
};
