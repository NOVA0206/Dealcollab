import type { RouterState, DealIntent, SectorKey, ConversationPhase } from './types';
import { VALID_SECTOR_KEYS } from './detectors';
import {
    detectSectorFromText,
    detectIntentFromText,
    detectProfileIntentFromText,
    detectIntermediaryFromText,
    detectShellCompanyFromText,
    detectFrictionSignal,
    detectStructureFromText,
} from './detectors';

// ─────────────────────────────────────────────────────────────
// CREATE BLANK STATE
// ─────────────────────────────────────────────────────────────

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
        is_document_intake: false,
        is_shell_query: false,
        gateway_clarifier: null,
        quality_score: 0,
        quality_gate_passed: false,
        quality_gate_attempted: false,
        intent_validated: null,
        m4_questions_asked: false,
        phase: 'ENTRY',
        turn_count: 0,
        refinement_count: 0,
        round_count: 0,
        special_conditions: [],
        strategic_intent: null,
    };
}

// ─────────────────────────────────────────────────────────────
// COMPUTE MISSING M3 FIELDS — server-side count for compact format
// RC10: < 3 missing = compact format trigger
// ─────────────────────────────────────────────────────────────

export function computeMissingM3Fields(state: RouterState): number {
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

// ─────────────────────────────────────────────────────────────
// UPDATE STATE FROM EXTRACTION
// Merges LLM extraction output into current state.
// ─────────────────────────────────────────────────────────────

export function updateStateFromExtraction(
    current: RouterState,
    extraction: { intent: DealIntent; state: Partial<RouterState>; is_complete: boolean },
    currentMessage: string,
    modulesLoaded: string[] = [],
): RouterState {
    const updated: RouterState = { ...current };
    updated.turn_count = current.turn_count + 1;

    // Profile search detection
    if (!updated.is_profile_search)
        updated.is_profile_search = detectProfileIntentFromText(currentMessage);

    // Intent
    if (extraction.intent) updated.intent = extraction.intent;

    // Sector — validate against VALID_SECTOR_KEYS before accepting
    if (extraction.state.sector) {
        const raw = (extraction.state.sector as string).toLowerCase().trim();
        const validKey = VALID_SECTOR_KEYS.find(k => k === raw);
        if (validKey) {
            updated.sector = validKey;
        } else {
            console.warn(`[STATE] Rejected invalid sector "${extraction.state.sector}". Keeping: "${current.sector ?? 'null'}"`);
        }
    }

    // Core deal fields
    if (extraction.state.sub_sector) updated.sub_sector = extraction.state.sub_sector as string;
    if (extraction.state.geography) updated.geography = extraction.state.geography as string;
    if (extraction.state.deal_size) updated.deal_size = extraction.state.deal_size as string;
    if (extraction.state.revenue) updated.revenue = extraction.state.revenue as string;
    if (extraction.state.structure) updated.structure = extraction.state.structure as string;
    if (extraction.state.intent_focus) {
        updated.intent_focus = extraction.state.intent_focus as string;
        updated.strategic_intent = extraction.state.intent_focus as string;
    }

    // Industry data — merge, never overwrite
    if (extraction.state.industry_data &&
        Object.keys(extraction.state.industry_data as object).length > 0) {
        updated.industry_data = { ...current.industry_data, ...(extraction.state.industry_data as object) };
    }

    // RC1: Persist intermediary role
    const extractedRole = (extraction.state as Record<string, unknown>).is_intermediary as string | undefined;
    if ((extractedRole === 'owner' || extractedRole === 'advisor') && updated.is_intermediary === null) {
        updated.is_intermediary = extractedRole;
    }
    if (updated.is_intermediary === null) {
        const detected = detectIntermediaryFromText(currentMessage);
        if (detected) updated.is_intermediary = detected;
    }

    // RC12: M4 questions asked — only accept when M4 module was actually loaded
    if (extraction.state.m4_questions_asked === true) {
        const m4WasLoaded = modulesLoaded.some(m => m.startsWith('M4_'));
        if (m4WasLoaded) {
            updated.m4_questions_asked = true;
            console.log('[STATE] m4_questions_asked=true accepted.');
        } else {
            console.warn('[STATE] Rejected m4_questions_asked=true — M4 not in prompt this turn.');
        }
    }

    // Fallback detection from message text
    if (!updated.sector) {
        const detected = detectSectorFromText(currentMessage);
        if (detected) updated.sector = detected;
    }
    if (!updated.intent) {
        const detected = detectIntentFromText(currentMessage);
        if (detected) updated.intent = detected;
    }

    // RC9: Shell company → set sub_sector
    if (updated.sub_sector === null && detectShellCompanyFromText(currentMessage)) {
        updated.sub_sector = 'shell_company';
        console.log('[DETECTOR] Shell company — sub_sector=shell_company');
    }

    // RC16 (updated for NM1): Healthcare sub_sector auto-detection
    if (updated.sector === 'healthcare' && updated.sub_sector === null) {
        const lower = currentMessage.toLowerCase();
        if (lower.includes('hospital')) {
            updated.sub_sector = 'hospital';
            console.log('[DETECTOR] Healthcare sub_sector: hospital');
        } else if (lower.includes('clinic')) {
            updated.sub_sector = 'clinic';
            console.log('[DETECTOR] Healthcare sub_sector: clinic');
        } else if (lower.includes('diagnostic')) {
            updated.sub_sector = 'diagnostics';
            console.log('[DETECTOR] Healthcare sub_sector: diagnostics');
        }
    }

    // NM3: Clear gateway clarifier once user responds
    if (current.gateway_clarifier && currentMessage.length > 5) {
        updated.gateway_clarifier = null;
        console.log('[STATE] Gateway clarifier cleared — user responded');
    }

    // NM6: Document intake confirmation detection
    if (current.is_document_intake && !updated.is_complete) {
        const confirmSignals = ['yes', 'correct', 'accurate', 'proceed', 'looks good',
            'that is right', 'confirmed', 'right', 'go ahead', "that's right"];
        if (confirmSignals.some(s => currentMessage.toLowerCase().trim().includes(s))) {
            updated.is_complete = true;
            console.log('[STATE] Document intake confirmed — is_complete=true');
        }
    }

    // Sufficiency calculation
    const hasIndustrySignal = !!(updated.sector || updated.sub_sector);
    const capacitySectors: (SectorKey | null)[] = ['renewable', 'realestate'];
    const hasCapacitySignal = capacitySectors.includes(updated.sector)
        ? !!(updated.deal_size || updated.industry_data?.capacity || updated.industry_data?.installed_capacity || updated.sub_sector)
        : !!(updated.revenue || updated.deal_size);

    const qualifyingFieldsCount = [
        hasCapacitySignal,
        !!(updated.structure || updated.intent),
        !!(updated.geography),
    ].filter(Boolean).length;

    // RC3: Friction with minimum fields guard
    const isFrictionSignal = detectFrictionSignal(currentMessage);
    const meetsMinimumFrictionGuard = updated.intent && hasIndustrySignal && qualifyingFieldsCount >= 1;

    if (current.is_complete) {
        updated.is_complete = true;
    } else if (isFrictionSignal && meetsMinimumFrictionGuard) {
        updated.is_complete = true;
        console.log('[STATE] Friction — forcing is_complete=true (Guard: PASS)');
    } else if (isFrictionSignal) {
        console.warn('[STATE] Friction signal ignored — minimum fields not met.');
        updated.is_complete = false;
    } else {
        updated.is_complete = extraction.is_complete;
    }

    // Sufficiency gate — sub_sector only required for healthcare sector
    const hasIntent = !!updated.intent;
    const hasSector = !!updated.sector;
    const hasScale = !!(updated.deal_size || updated.revenue || updated.structure || updated.strategic_intent);
    const requiresSubSector = updated.sector === 'healthcare';
    const hasSubSector = requiresSubSector ? !!updated.sub_sector : true;

    updated.is_sufficient = hasIntent && hasSector && hasSubSector && hasScale && updated.m4_questions_asked;

    // Phase stability — prevent regression
    const nextPhase = resolvePhase(updated);
    const PHASE_ORDER_VAL: Record<ConversationPhase, number> = {
        ENTRY: 1, QUALIFICATION: 2, MOMENTUM: 3,
        INTENT_VALIDATION: 4, CLOSURE: 5, MATCHING: 6, PROFILE_SEARCH: 7,
    };

    if (PHASE_ORDER_VAL[nextPhase] >= PHASE_ORDER_VAL[current.phase]) {
        updated.phase = nextPhase;
    } else {
        console.warn(`[STATE] Phase regression blocked: ${current.phase} → ${nextPhase}`);
        updated.phase = current.phase;
    }

    // NM7: Intent validation yes/no detection (belt-and-suspenders — primary is in route.ts)
    if (updated.quality_gate_passed && updated.intent_validated === null) {
        const lower = currentMessage.toLowerCase().trim();
        const yesSignals = ['yes', 'confirm', 'genuine', 'correct', 'proceed', 'real',
            'absolutely', 'yes it is', 'yes this is'];
        const noSignals = ['no', 'not yet', 'exploring', 'just looking', 'not genuine',
            'cancel', 'no not yet'];
        if (yesSignals.some(s => lower.includes(s))) {
            updated.intent_validated = true;
            updated.is_complete = true;
            console.log('[STATE] Intent validated: YES');
        } else if (noSignals.some(s => lower.includes(s))) {
            updated.intent_validated = false;
            updated.is_complete = false;
            console.log('[STATE] Intent validated: NO');
        }
    }

    // Persist quality gate state from candidateState (set by route.ts pre-detection)
    if ((current as RouterState & { quality_gate_passed?: boolean }).quality_gate_passed === true &&
        !updated.quality_gate_passed) {
        updated.quality_gate_passed = true;
    }

    if (current.phase === 'MOMENTUM') updated.refinement_count = current.refinement_count + 1;
    if (current.phase === 'QUALIFICATION') updated.round_count = current.round_count + 1;

    return updated;
}

// ─────────────────────────────────────────────────────────────
// INITIALIZE STATE FROM DOCUMENT
// Seeds state from structured document extraction.
// ─────────────────────────────────────────────────────────────

export function initializeStateFromDocument(structuredData: Record<string, unknown>): RouterState {
    const state = createBlankState();
    
    // Helper utilities
    const _docStr = (v: unknown): string => (typeof v === 'string' ? v : '');
    const _docArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

    // Normalize intent
    const intent = (structuredData.intent || structuredData.deal_type) as string ?? null;
    if (intent) {
        const norm = intent.toUpperCase().replace(/[-\s]/g, '_');
        if (['SELL_SIDE', 'BUY_SIDE', 'FUNDRAISING', 'DEBT', 'STRATEGIC_PARTNERSHIP'].includes(norm)) {
            state.intent = norm as DealIntent;
        }
    }

    // Normalize sector
    const sectorStr = (structuredData.sector || structuredData.industry) as string ?? '';
    if (sectorStr) {
        const raw = sectorStr.toLowerCase().trim();
        const validKey = VALID_SECTOR_KEYS.find(k => k === raw);
        state.sector = validKey || detectSectorFromText(sectorStr);
    }

    // Fallback sector detection from industry field if sector is still null
    if (!state.sector && structuredData.industry) {
        state.sector = detectSectorFromText(_docStr(structuredData.industry));
    }

    // Normalize location / geography
    const location = (structuredData.geography || structuredData.location) as string ?? '';
    if (location) state.geography = location;

    // Normalize subsector / sub_sector
    const subSector = (structuredData.subsector || structuredData.sub_sector) as string ?? '';
    if (subSector) state.sub_sector = subSector;

    // Normalize deal_size / deal_value
    const dealSize = (structuredData.deal_value || structuredData.deal_size) as string ?? '';
    if (dealSize) state.deal_size = dealSize;

    // Normalize revenue / revenue_range
    const revenue = (structuredData.revenue || structuredData.revenue_range) as string ?? '';
    if (revenue) state.revenue = revenue;

    // Normalize structure / transaction_type
    if (structuredData.structure) {
        state.structure = String(structuredData.structure);
    } else if (structuredData.transaction_type) {
        const txStr = _docStr(structuredData.transaction_type);
        const detectedStruct = detectStructureFromText(txStr);
        state.structure = detectedStruct || txStr;
    }

    // Populate company_overview
    if (structuredData.company_overview) {
        state.industry_data.company_overview = _docStr(structuredData.company_overview);
    }

    // Extract core industry intelligence fields
    const cap = _docStr(structuredData.capacity);
    const prod = _docStr(structuredData.production);
    const util = _docStr(structuredData.utilization);
    const custs = _docArr(structuredData.customers);
    const certs = _docArr(structuredData.certifications);
    const assets = _docArr(structuredData.strategic_assets);
    const ebitda = _docStr(structuredData.ebitda);

    // Save under generic keys
    if (cap) state.industry_data.capacity = cap;
    if (prod) state.industry_data.production = prod;
    if (util) state.industry_data.utilization = util;
    if (custs.length > 0) state.industry_data.customers = custs.join(', ');
    if (certs.length > 0) state.industry_data.certifications = certs.join(', ');
    if (assets.length > 0) state.industry_data.strategic_assets = assets.join(', ');
    if (ebitda) state.industry_data.ebitda = ebitda;

    // Map doc products and capabilities if present
    const docProducts = _docArr(structuredData.products_services);
    if (docProducts.length > 0) {
        state.industry_data.products_services = docProducts.slice(0, 6).join(', ');
    }
    const docCapabilities = _docArr(structuredData.capabilities);
    if (docCapabilities.length > 0) {
        state.industry_data.capabilities = docCapabilities.slice(0, 5).join(', ');
    }
    const docMarketPos = _docStr(structuredData.market_position);
    if (docMarketPos) {
        state.industry_data.market_position = docMarketPos.slice(0, 120);
    }
    const docCompAdv = _docArr(structuredData.competitive_advantages);
    if (docCompAdv.length > 0) {
        state.industry_data.competitive_advantages = docCompAdv.slice(0, 4).join(', ');
    }
    const docGrowthDrivers = _docArr(structuredData.growth_drivers);
    if (docGrowthDrivers.length > 0) {
        state.industry_data.growth_drivers = docGrowthDrivers.slice(0, 4).join(', ');
    }

    // Map sector-specific M4 keys
    if (state.sector === 'manufacturing') {
        if (state.sub_sector) state.industry_data.sub_type = state.sub_sector;
        if (certs.length > 0) state.industry_data.certifications = certs.join(', ');
        
        let capUtilStr = '';
        if (cap) capUtilStr += `Capacity: ${cap}`;
        if (prod) capUtilStr += `${capUtilStr ? ', ' : ''}${prod} production`;
        if (util) capUtilStr += ` (${util} utilization)`;
        if (capUtilStr) state.industry_data.capacity_utilisation = capUtilStr;

        if (custs.length > 0) state.industry_data.client_concentration = custs.join(', ');
    } else if (state.sector === 'renewable') {
        if (structuredData.asset_type) state.industry_data.asset_type = String(structuredData.asset_type);
        if (structuredData.operational_status) state.industry_data.operational_status = String(structuredData.operational_status);
        if (cap) state.industry_data.capacity_mw = cap;
        if (custs.length > 0) state.industry_data.ppa_off_taker = custs.join(', ');
    } else if (state.sector === 'pharma') {
        if (state.sub_sector) state.industry_data.sub_type = state.sub_sector;
        if (certs.length > 0) state.industry_data.regulatory_approvals = certs.join(', ');
        if (cap) state.industry_data.manufacturing_capacity = cap;
    } else if (state.sector === 'defence') {
        if (certs.length > 0) state.industry_data.certifications_approvals = certs.join(', ');
        if (custs.length > 0) state.industry_data.government_oem_exposure = custs.join(', ');
    } else if (state.sector === 'healthcare') {
        if (state.sub_sector) state.industry_data.sub_type = state.sub_sector;
        if (certs.length > 0) state.industry_data.accreditations = certs.join(', ');
        if (cap) state.industry_data.scale_indicator = cap;
    } else if (state.sector === 'saas') {
        if (state.sub_sector) state.industry_data.sub_type = state.sub_sector;
        if (custs.length > 0) state.industry_data.client_profile = custs.join(', ');
    } else if (state.sector === 'education') {
        if (state.sub_sector) state.industry_data.sub_type = state.sub_sector;
        if (certs.length > 0) state.industry_data.accreditations = certs.join(', ');
        if (cap) state.industry_data.enrolment_scale = cap;
    } else if (state.sector === 'logistics') {
        if (custs.length > 0) state.industry_data.client_concentration = custs.join(', ');
    }

    // Infer ev_charging sub_sector for renewable companies
    if (state.sector === 'renewable' && !state.sub_sector) {
        const evSignalText = [
            _docStr(structuredData.company_overview),
            docProducts.join(' '),
            docCapabilities.join(' '),
            _docStr(structuredData.industry),
        ].join(' ').toLowerCase();

        const isEvCharging =
            evSignalText.includes('ev charg') ||
            evSignalText.includes('electric vehicle charg') ||
            evSignalText.includes('dc fast charger') ||
            evSignalText.includes('ac charger') ||
            evSignalText.includes('charging station') ||
            (evSignalText.includes('charging infrastructure') && evSignalText.includes('ev')) ||
            evSignalText.includes('clean mobility');

        if (isEvCharging) {
            state.sub_sector = 'ev_charging';
            state.industry_data = { ...state.industry_data, sub_type: 'EV Charging Manufacturing / Infrastructure' };
        }
    }

    // If document has extracted details, mark document intake mode active!
    state.is_document_intake = true;

    // Set m4_questions_asked=true if key fields are parsed from the document
    const m4Keys = ['capacity', 'capacity_utilisation', 'client_concentration', 'certifications', 'regulatory_approvals', 'government_oem_exposure', 'accreditations', 'enrolment_scale'];
    const hasM4Data = m4Keys.some(key => !!state.industry_data[key]);
    state.m4_questions_asked = hasM4Data;

    // Compute sufficiency
    const hasIndustrySignal = !!(state.sector || state.sub_sector);
    const capacitySectors = ['renewable', 'realestate'];
    const hasCapacitySignal = capacitySectors.includes(state.sector ?? '')
        ? !!(state.deal_size || state.industry_data?.capacity || state.industry_data?.installed_capacity || state.sub_sector)
        : !!(state.revenue || state.deal_size);

    const qualifyingFields = [
        hasCapacitySignal,
        !!(state.structure || state.intent),
        !!(state.geography),
    ].filter(Boolean).length;

    state.is_sufficient = hasIndustrySignal && qualifyingFields >= 2 && state.m4_questions_asked;
    state.phase = resolvePhase(state);

    return state;
}

// ─────────────────────────────────────────────────────────────
// RESOLVE PHASE — pure function, state → phase
// ─────────────────────────────────────────────────────────────

export function resolvePhase(state: RouterState): ConversationPhase {
    if (state.is_profile_search) return 'PROFILE_SEARCH';

    // NM7: Awaiting intent confirmation
    if (state.quality_gate_passed && state.intent_validated === null) return 'INTENT_VALIDATION';
    // NM7: User declined — soft close
    if (state.quality_gate_passed && state.intent_validated === false) return 'CLOSURE';

    if (state.is_complete) return 'CLOSURE';
    if (state.is_sufficient && state.refinement_count >= 3) return 'CLOSURE';
    // RC8: Auto-close after 4 qualification rounds
    if (state.round_count >= 4 && (state.intent || state.sector)) return 'CLOSURE';
    if (state.is_sufficient) return 'MOMENTUM';
    if (state.intent || state.sector) return 'QUALIFICATION';
    return 'ENTRY';
}