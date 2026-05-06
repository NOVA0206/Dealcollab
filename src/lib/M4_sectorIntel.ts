/**
 * DealCollab Prompt Router — M4: Sector Intelligence
 * ====================================================
 * Canonical source:
 *   Industry Framework §3 (sectors A–L) — primary source for all
 *   framework sectors, qualification areas, and buyer signals
 *   Deal Dictionary §3 (industry synonyms) — coverage expansion
 *   Domain knowledge — Agriculture, Textiles, BPO, Advertising,
 *   NGO (user-confirmed in scope, lightweight)
 *
 * Scope — M4 exclusively owns:
 *   ✔ Sector-specific qualification areas (priority-ordered)
 *   ✔ Example questions per area (LLM picks 2–4 most relevant)
 *   ✔ Buyer relevance signals per sector
 *   ✔ Sub-sector variant notes where sectors overlap
 *
 *   ✘ Question format / grouping rules    → M2
 *   ✘ Core deal fields (Block 1)          → M3
 *   ✘ Phase rules                         → M2
 *   ✘ Matching layer                      → M5
 *
 * Load rule: CONDITIONAL — exactly ONE sub-module per request,
 *            selected by router when state.sector is detected.
 *
 * Sub-modules (18 total):
 *   Framework (12): MANUFACTURING · PHARMA · SAAS · FINSERV ·
 *                   CONSUMER · REALESTATE · LOGISTICS · EDUCATION ·
 *                   CHEMICALS · HOSPITALITY · RENEWABLE · DEFENCE
 *   Additional (4): AGRICULTURE · TEXTILES · BPO · ADVERTISING
 *   Special   (2): NGO (lightweight) · MIXED (fallback)
 *
 * Absorbed as variant notes (not standalone):
 *   Steel / Cement / Automation → MANUFACTURING
 *   Data Center                 → SAAS
 *   Fintech Payments            → FINSERV
 *
 * Format per sub-module:
 *   Sector header (what it covers)
 *   Buyer relevance thinking (who the likely buyer is — 1 sentence)
 *   Priority qualification areas: pick 2–4 most relevant
 *   Buyer signals (what strategic buyers actually value)
 *
 * Token budget: ~120–145 tokens per sub-module.
 * Per-request cost: ONE sub-module only.
 *
 * CHANGE LOG (v2):
 *   Priority qualification areas rewritten as open-ended questions
 *   across all 18 sub-modules. Previous format listed specific options
 *   inline in questions (e.g. "OEM-led, export-driven, or domestic B2B?").
 *   This constrained user responses to the listed options and suppressed
 *   volunteered context. New format invites description — the LLM extracts
 *   structured values from free-form answers. No loss in data quality;
 *   significant gain in context richness per conversation turn.
 */

// ─────────────────────────────────────────────────────────────
// A. MANUFACTURING / INDUSTRIAL
// Framework §3A | also covers Steel · Cement · Automation
// ─────────────────────────────────────────────────────────────
const M4_MANUFACTURING = `
## M4: MANUFACTURING / INDUSTRIAL
Covers: auto components · precision engineering · OEM · industrial mfg
Also covers: steel plants · TMT · cement · industrial automation · IIoT
Buyer: strategic acquirers seeking capacity, certifications, or customer access.

Priority qualification areas (pick 2–4 most relevant):
• How does the business primarily generate revenue — who are the end customers and how does it serve them?
• What manufacturing infrastructure does the business own or operate, and where is it located?
• What certifications or approvals does the business hold, and how central are they to the business?
• How spread out is the customer base — is the business dependent on a handful of large customers?

Sub-sector variants:
Steel / metals: capacity (TPD/MTPA), product type, utilisation rate.
Cement: capacity (TPD), geography concentration, fuel source.
Automation / IIoT: proprietary technology or OEM distribution? Government or enterprise contracts?

Buyer signals: capacity expansion · certification moat · OEM relationships · export access · customer stickiness.
`.trim();

// ─────────────────────────────────────────────────────────────
// B. PHARMA / HEALTHCARE
// Framework §3B
// ─────────────────────────────────────────────────────────────
const M4_PHARMA = `
## M4: PHARMA / HEALTHCARE
Covers: formulations · API · CRAMS · diagnostics · hospitals · clinics · medical devices · digital health
Buyer: pharma conglomerates · PE · healthcare platforms seeking regulatory moat or capacity.

Priority qualification areas (pick 2–4 most relevant):
• What does the business actually do within pharma or healthcare — what is its core activity?
• What regulatory approvals does the business hold, and how critical are they to operations?
• Does the business sell into international markets — and how significant is that revenue?
• How concentrated is the revenue — around a few products, clients, or contracts?

Buyer signals: regulatory approvals · export access · IP defensibility · compliance strength · manufacturing capacity.
`.trim();

// ─────────────────────────────────────────────────────────────
// C. SAAS / TECHNOLOGY
// Framework §3C | also covers Data Center
// ─────────────────────────────────────────────────────────────
const M4_SAAS = `
## M4: SAAS / TECHNOLOGY
Covers: B2B SaaS · IT services · enterprise software · AI platforms · cybersecurity · analytics · digital marketing
Also covers: data centers (tier certification, hyperscaler relationships, MW capacity)
Buyer: tech acquirers · PE · strategic roll-ups seeking IP, recurring revenue, or customer base.

Priority qualification areas (pick 2–4 most relevant):
• What does the product or platform do, and who pays for it?
• What does the revenue profile look like — how much is recurring versus project-based?
• What is the customer base like — who are the buyers and how sticky are they?
• What makes the business defensible — is there proprietary technology, IP, or a platform moat?

Buyer signals: sticky recurring revenue · IP ownership · low churn · enterprise contracts · platform expansion potential.
`.trim();

// ─────────────────────────────────────────────────────────────
// D. FINANCIAL SERVICES / NBFC / FINTECH
// Framework §3D | also covers Fintech Payments
// ─────────────────────────────────────────────────────────────
const M4_FINSERV = `
## M4: FINANCIAL SERVICES / NBFC / FINTECH
Covers: NBFC · HFC · MFI · lending · wealth management · PMS · insurance · advisory
Also covers: fintech payments (PCI-DSS, merchant base, AD licence, payment gateway)
Buyer: banks · PE · financial conglomerates · strategic acquirers seeking licence or portfolio.

Priority qualification areas (pick 2–4 most relevant):
• What kind of financial services business is this — what does it do and how does it make money?
• What licences or regulatory approvals does the business hold, and are they transferable?
• What does the loan book or AUM look like, and what is the current quality of the portfolio?
• How does the business originate its customers or assets — is it self-sourced or partnership-driven?

Fintech Payments variant: PCI-DSS compliance · merchant base size · AD licence status.

Buyer signals: licence value · regulatory defensibility · loan book quality · risk-adjusted growth · tech platform.
`.trim();

// ─────────────────────────────────────────────────────────────
// E. CONSUMER BRAND / RETAIL / D2C
// Framework §3E
// ─────────────────────────────────────────────────────────────
const M4_CONSUMER = `
## M4: CONSUMER BRAND / RETAIL / D2C
Covers: D2C brands · FMCG · retail chains · personal care · fashion · lifestyle · consumer products
Buyer: FMCG conglomerates · PE · strategic roll-ups seeking brand or distribution.

Priority qualification areas (pick 2–4 most relevant):
• What does the brand sell, and how would you describe the business model?
• How does the business reach its customers — what channels drive revenue?
• Is the business built around a few key products, or does it have a broad product range?
• What is the geographic reach of the business, and how mature is the distribution?

Buyer signals: brand defensibility · repeat purchase behaviour · gross margin quality · channel stability.
`.trim();

// ─────────────────────────────────────────────────────────────
// F. REAL ESTATE / INFRASTRUCTURE
// Framework §3F
// ─────────────────────────────────────────────────────────────
const M4_REALESTATE = `
## M4: REAL ESTATE / INFRASTRUCTURE
Covers: residential development · commercial · pre-leased assets · IT parks · EPC · civil infrastructure
Buyer: REITs · developers · family offices · infra funds · PE.

Priority qualification areas (pick 2–4 most relevant):
• What is the nature of the asset — is this land, a development project, or a completed income-generating property?
• Where does the regulatory approval status stand — are all clearances in place?
• What does the revenue or income profile look like on this asset?
• If tenanted, what does the tenancy profile look like — who are the tenants and what are the lease terms?

Buyer signals: title clarity · approval status · annuity income stability · execution risk · tenant quality.
`.trim();

// ─────────────────────────────────────────────────────────────
// G. LOGISTICS / SUPPLY CHAIN
// Framework §3G
// ─────────────────────────────────────────────────────────────
const M4_LOGISTICS = `
## M4: LOGISTICS / SUPPLY CHAIN
Covers: warehousing · FTL / PTL · cold chain · freight forwarding · CHA / customs · last-mile
Buyer: logistics conglomerates · PE · 3PL platforms seeking network or infrastructure.

Priority qualification areas (pick 2–4 most relevant):
• How does the business operate — does it own infrastructure or work asset-light?
• What does the revenue model look like — is it built on long-term contracts or transactional volumes?
• Who are the key clients, and how dependent is the business on its top customers?
• What geographies and corridors does the business cover?

Buyer signals: contract revenue quality · owned infrastructure · route network density · enterprise relationships.
`.trim();

// ─────────────────────────────────────────────────────────────
// H. EDUCATION / EDTECH
// Framework §3H
// ─────────────────────────────────────────────────────────────
const M4_EDUCATION = `
## M4: EDUCATION / EDTECH
Covers: K12 schools · higher education · coaching / test prep · edtech platforms · B2B skilling · vocational
Buyer: education groups · PE · edtech platforms seeking enrolment, content, or accreditation.

Priority qualification areas (pick 2–4 most relevant):
• What kind of education business is this — what does it do and who does it serve?
• What accreditations or approvals does it hold, and how central are they to its operations?
• How does the business attract and retain students — is acquisition self-sustaining?
• How dependent is the business on its founders or key leadership for day-to-day operations?

Buyer signals: recurring enrolment · accreditation value · content IP · geographic rollout potential.
`.trim();

// ─────────────────────────────────────────────────────────────
// I. SPECIALTY CHEMICALS
// Framework §3I
// ─────────────────────────────────────────────────────────────
const M4_CHEMICALS = `
## M4: SPECIALTY CHEMICALS
Covers: specialty / fine chemicals · agrochemicals · dyes · pigments · polymers · construction chemicals
Buyer: chemical conglomerates · PE · strategic acquirers seeking formulation IP or export access.

Priority qualification areas (pick 2–4 most relevant):
• What does the business produce, and how would you describe its position — commodity or specialty?
• How much of the revenue comes from exports, and which markets does the business serve?
• What is the environmental compliance status — are all plant approvals and effluent systems in order?
• How concentrated is the customer base — is the business dependent on a few large industrial buyers?

Buyer signals: formulation defensibility · export market access · compliance moat · customer stickiness.
`.trim();

// ─────────────────────────────────────────────────────────────
// J. HOSPITALITY / FOOD SERVICE
// Framework §3J
// ─────────────────────────────────────────────────────────────
const M4_HOSPITALITY = `
## M4: HOSPITALITY / FOOD SERVICE
Covers: hotels · resorts · heritage properties · restaurants · QSR chains · food and beverage · nightclubs
Buyer: hospitality chains · PE · family offices seeking asset or brand.

Priority qualification areas (pick 2–4 most relevant):
• What is the nature of the business — does it own the asset, or operate under a lease or franchise?
• How has the business performed over the last 2–3 years — occupancy, footfall, or revenue trends?
• What is the brand positioning — independently owned or tied to a franchise?
• Is the revenue spread across multiple locations, or concentrated in one?

Buyer signals: asset ownership · brand defensibility · location quality · margin stability · operational track record.
`.trim();

// ─────────────────────────────────────────────────────────────
// K. RENEWABLE ENERGY
// Framework §3K
// ─────────────────────────────────────────────────────────────
const M4_RENEWABLE = `
## M4: RENEWABLE ENERGY
Covers: solar IPP · wind IPP · EPC contractors · biofuel · ethanol (energy) · waste-to-energy
Buyer: energy companies · PE infra funds · strategic acquirers seeking operational yield or pipeline.

Priority qualification areas (pick 2–4 most relevant):
• What is the nature of the energy business — is it an operating asset, EPC pipeline, or development-stage project?
• What does the power purchase agreement situation look like — are PPAs in place, and with whom?
• What is the debt structure on the assets, and does lender consent factor into a transaction?
• Where does the value primarily sit — operational yield or development upside?

Buyer signals: PPA quality and counterparty · debt coverage · IRR profile · regulatory approvals · grid connectivity.
`.trim();

// ─────────────────────────────────────────────────────────────
// L. DEFENCE / AEROSPACE
// Framework §3L
// ─────────────────────────────────────────────────────────────
const M4_DEFENCE = `
## M4: DEFENCE / AEROSPACE
Covers: defence manufacturing · aerospace · UAV systems · electromagnetic tech · dual-use technology
Buyer: defence OEMs · strategic acquirers · government-backed entities (PE rare in this sector).

Priority qualification areas (pick 2–4 most relevant):
• What approvals, certifications, or offset credits does the business hold?
• How does the business generate revenue — government tenders, OEM partnerships, or product sales?
• What is the technology or capability moat — is there proprietary IP, and are there any export restrictions?
• How diversified is the order book — is the business tied to specific programmes or contracts?

Buyer signals: approvals and certifications · government relationships · technology moat · offset credit value · IP defensibility.
`.trim();

// ─────────────────────────────────────────────────────────────
// M. AGRICULTURE / FOOD PROCESSING
// Additional (standalone) — user confirmed
// ─────────────────────────────────────────────────────────────
const M4_AGRICULTURE = `
## M4: AGRICULTURE / FOOD PROCESSING
Covers: agro processing · dairy · flour milling · distillery / ethanol · packaged food · D2C food brands · agro commodities
Buyer: FMCG conglomerates · agribusiness groups · PE · food platforms — distinct from consumer brand; buyers differ by processing vs brand value.

Priority qualification areas (pick 2–4 most relevant):
• What does the business do within food or agriculture — processing, manufacturing, branded products, or trading?
• What licences and regulatory approvals does the business hold?
• Is the business primarily a processing or manufacturing operation, or is it brand-driven?
• How does the business source its raw materials — captive supply or open market?

Buyer signals: processing capacity · licence transferability · supply chain control · brand (if applicable) · regulatory compliance.
`.trim();

// ─────────────────────────────────────────────────────────────
// N. TEXTILES / GARMENTS
// Additional (standalone) — user confirmed
// ─────────────────────────────────────────────────────────────
const M4_TEXTILES = `
## M4: TEXTILES / GARMENTS
Covers: technical textiles · narrow woven / knitted fabrics · garments manufacturing · apparel · fabric trading · textile machinery
Buyer: textile conglomerates · export-focused acquirers · PE — value driven by export relationships and compliance.

Priority qualification areas (pick 2–4 most relevant):
• What does the business produce or trade, and how would you describe its specialisation?
• How is the business oriented — domestic supply, export markets, or branded retail?
• What compliance certifications does it hold, particularly for export?
• How does the business reach its customers — OEM brand relationships or domestic distribution?

Buyer signals: export relationships · buyer compliance certifications · manufacturing capacity · customer access · fabric specialisation.
`.trim();

// ─────────────────────────────────────────────────────────────
// O. BPO / SERVICES
// Additional (standalone) — user confirmed
// ─────────────────────────────────────────────────────────────
const M4_BPO = `
## M4: BPO / OUTSOURCED SERVICES
Covers: BPO · KPO · IT staffing and augmentation · facility management · HR outsourcing · manpower
Buyer: global outsourcing firms · PE · strategic acquirers — value driven by contracts and delivery capability, not tech IP.

Priority qualification areas (pick 2–4 most relevant):
• What services does the business deliver, and to what kind of clients?
• What does the revenue model look like — long-term contracts or project-based work?
• How concentrated is the client base, and how dependent is the business on its top clients?
• What does the workforce profile look like — scale, stability, and delivery locations?

Buyer signals: long-term MSA contracts · enterprise client quality · headcount scale and stability · delivery capability · geographic coverage.
`.trim();

// ─────────────────────────────────────────────────────────────
// P. ADVERTISING / MEDIA
// Additional (standalone) — confirmed in architecture decision
// ─────────────────────────────────────────────────────────────
const M4_ADVERTISING = `
## M4: ADVERTISING / MEDIA
Covers: media houses · advertising agencies · digital / performance marketing · DOOH · content companies · AdTech
Buyer: media conglomerates · PE · holding companies · strategic acquirers — value driven by audience, client roster, or platform.

Priority qualification areas (pick 2–4 most relevant):
• What does the business do within media or advertising — what is its core offering?
• What does the revenue model look like — retainer relationships, project work, or inventory-driven?
• Who are the clients, and how stable are those relationships?
• What does the business own — content, audience, platform, or proprietary technology?

Buyer signals: audience ownership · content or platform IP · enterprise client relationships · proprietary technology · inventory scale.
`.trim();

// ─────────────────────────────────────────────────────────────
// Q. NGO / SECTION 8 / TRUST
// Lightweight — user decision: in scope but not in depth
// ─────────────────────────────────────────────────────────────
const M4_NGO = `
## M4: NGO / SECTION 8 / TRUST (lightweight)
Covers: Section 8 companies · NGOs · trusts · societies · cooperatives · farmer producer companies
Context: typically shell acquisitions for regulatory benefits (80G, 12A, FCRA) or impact-sector deals.
Qualification is intentionally lightweight — registration status and compliance cleanliness are the primary signals.

Priority qualification areas (ask 2–3 only):
• What registrations does the entity hold — 12A, 80G, FCRA, DARPAN — and what is their current status?
• Is the entity actively running programmes, or is it primarily a compliance or dormant structure?
• Are there any outstanding statutory dues, regulatory notices, or legacy liabilities?

Buyer signals: registration transferability · compliance cleanliness · absence of legacy liabilities.
`.trim();

// ─────────────────────────────────────────────────────────────
// R. MIXED / CROSS-SECTOR (fallback)
// Used when sector is ambiguous or spans multiple sectors
// ─────────────────────────────────────────────────────────────
const M4_MIXED = `
## M4: MIXED / CROSS-SECTOR (fallback)
Used when sector cannot be confidently identified or spans multiple sectors.
Ask these 3 universal questions to identify the primary sector lens for matching:

• "What is the core revenue driver — manufactured product, delivered service, or software platform?"
• "Is the business asset-heavy (plant, fleet, property) or asset-light (people, IP, contracts)?"
• "Is revenue primarily contract-based and recurring, or transactional and variable?"

Once answered, map to the most relevant primary sector and proceed with that sub-module's signals.
`.trim();

// ─────────────────────────────────────────────────────────────
// MODULE MAP — router selects by sector key
// ─────────────────────────────────────────────────────────────

export type SectorKey =
  | 'manufacturing' | 'pharma' | 'saas' | 'finserv'
  | 'consumer' | 'realestate' | 'logistics' | 'education'
  | 'chemicals' | 'hospitality' | 'renewable' | 'defence'
  | 'agriculture' | 'textiles' | 'bpo' | 'advertising'
  | 'ngo' | 'mixed';

export const M4_MODULES: Record<SectorKey, string> = {
  manufacturing: M4_MANUFACTURING,
  pharma: M4_PHARMA,
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
  agriculture: M4_AGRICULTURE,
  textiles: M4_TEXTILES,
  bpo: M4_BPO,
  advertising: M4_ADVERTISING,
  ngo: M4_NGO,
  mixed: M4_MIXED,
};

// ─────────────────────────────────────────────────────────────
// TOKEN DIAGNOSTICS
// ─────────────────────────────────────────────────────────────

export const M4_DIAGNOSTICS = {
  sub_modules: Object.fromEntries(
    Object.entries(M4_MODULES).map(([k, v]) => [k, Math.round(v.length / 4)])
  ),
  loadRule: 'ONE sub-module per request, selected by state.sector',
  perRequestCost: 'one sub-module only (~120–165 tokens)',
} as const;

/**
 * INTEGRATION
 * ───────────
 * In promptRouter.ts:
 *   1. Replace the inline M4_MODULES object with:
 *      import { M4_MODULES, type SectorKey } from '@/lib/modules/M4_sectorIntel';
 *
 *   2. Update SectorKey type in promptRouter.ts to use the exported
 *      SectorKey from this file (removes the old 12-sector definition).
 *
 *   3. Update SECTOR_KEYWORDS in promptRouter.ts to map the 4 new
 *      sector keys: 'agriculture' | 'textiles' | 'bpo' | 'advertising'
 *
 * DESIGN DECISIONS
 * ────────────────
 * • Open-ended questions (v2): option lists removed from all questions.
 *   The LLM extracts structured values from free-form user answers.
 *   Users volunteer context, rationale, and nuance that option-lists
 *   suppress. Data quality is unchanged — extraction quality improves.
 *
 * • 2–4 questions: LLM picks based on what user has already said.
 *   Priority-ordered list means the bot starts from the top and skips
 *   areas already covered. Never asks all areas at once.
 *
 * • Sub-sector variants (Steel, Cement, Automation, DataCenter,
 *   Fintech Payments) absorbed into parent modules as variant notes.
 *   Rationale: buyer overlap is high; separate sub-modules would load
 *   near-identical signals at extra complexity.
 *
 * • NGO is intentionally lightweight (user decision).
 *   No commercial valuation framework applied.
 *   Focus: registration status, compliance, liability cleanliness.
 *   Questions left slightly more structured here because NGO buyers
 *   need binary compliance answers, not descriptive context.
 *
 * • Agriculture is separate from Consumer Brand.
 *   A buyer for an ethanol plant (capacity + licence + compliance)
 *   is not the same as a buyer for a D2C food brand (GMV + repeat).
 *   Different buyer profiles require different qualification signals.
 *
 * • MIXED fallback fires only when sector cannot be determined after
 *   the industry signal gate in M2. Its 3 questions identify the
 *   primary sector lens so the correct M4 sub-module applies next turn.
 *   MIXED questions retained as semi-structured — these are diagnostic,
 *   not qualification. User needs to converge on a sector answer.
 */
