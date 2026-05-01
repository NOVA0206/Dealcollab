import { ConversationState } from "./conversationState";

/**
 * 🧠 CONTROL LAYER (v1.0)
 * Sits before and after core AI logic to enforce non-repetition and priority questioning.
 */

export function getMissingFields(state: ConversationState): string[] {
  // STEP 1 & 2: DEFINE STATE & HARD ELIMINATION
  const allFields = [
    'structure',            // maps to deal_structure
    'strategic_objective',   // maps to strategic_fit
    'risk_appetite',         // maps to risk_alignment
    'sector',
    'geography',
    'valuation',             // maps to investment_flexibility
    'offerings',
    'clients'
  ];

  const filtered = allFields.filter(f => {
    const val = state[f as keyof ConversationState];
    return !val || (typeof val === 'string' && val.length === 0);
  });

  // STEP 4: LIMIT QUESTIONS (NEVER exceed 3)
  return filtered.slice(0, 3);
}

export function generateControlPrompt(state: ConversationState): string {
  const presentFields = Object.entries(state)
    .filter(([, v]) => v !== null && v !== "" && (typeof v !== 'object' || Object.keys(v).length > 0))
    .map(([k]) => k);

  const missingFields = getMissingFields(state);

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ELIMINATION-FIRST QUESTION ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLE: Institutional M&A Advisor.

1. DATA ELIMINATION (HARD RULE):
   - Already Extracted: ${presentFields.join(", ") || "none"}.
   - If a field is in the list above, you are FORBIDDEN from asking about it.
   - NO generic template questions.

2. QUESTION PRIORITY (Decision-Level Only):
   - Priority 1: Deal Structure (Majority/Minority/Buyout)
   - Priority 2: Strategic Objective (Expansion/Capability/Platform)
   - Priority 3: Risk Alignment (Regulatory/Dependency/Market)
   - Priority 4: Investment Flexibility (Only if Valuation is known)

3. CONTEXT-AWARE REWRITE:
   - Example: If Valuation is ₹400–500 Cr, ask: "Are you flexible within the ${state.valuation || "detected"} range or strictly capped?"
   - Example: If Sector is Defense, ask about "government contract dependency".

4. MANDATORY RESPONSE FORMAT:
   1. OPENING (1 line): Sharp summary using DOCUMENT data (e.g., "defense tech acquisition in Mumbai, ₹400–500 Cr range").
   2. QUESTIONS (Max 3): Use bullet points. Ask ONLY for: ${missingFields.join(", ")}.
   3. CLOSING: "Share in ranges — no sensitive info required."

5. TONAL RULE: "Ask only what is missing. Everything else is noise."
`;
}

export function validateResponse(response: string, state: ConversationState): { isValid: boolean; reason?: string } {
  const lowerResponse = response.toLowerCase();
  const presentFields = Object.entries(state)
    .filter(([, v]) => v !== null && v !== "" && (typeof v !== 'object' || Object.keys(v).length > 0))
    .map(([k]) => k);

  for (const field of presentFields) {
    const fieldName = field.replace('_', ' ');
    if (lowerResponse.includes(`what is the ${fieldName}`) || 
        lowerResponse.includes(`which ${fieldName}`) || 
        lowerResponse.includes(`provide the ${fieldName}`)) {
      return { isValid: false, reason: `Repeated question about ${field}` };
    }
  }

  if (!lowerResponse.includes("share in ranges")) {
    return { isValid: false, reason: "Missing mandatory closing line" };
  }

  return { isValid: true };
}

export function parseDealDocument(text: string): Partial<ConversationState> {
  const lowerText = text.toLowerCase();
  
  const extractIntent = (t: string) => {
    if (t.includes("buy") || t.includes("acquire")) return "BUY_SIDE";
    if (t.includes("sell") || t.includes("exit") || t.includes("divest")) return "SELL_SIDE";
    if (t.includes("raise") || t.includes("fundraising") || t.includes("capital")) return "FUNDRAISING";
    return null;
  };

  const extractSector = (t: string) => {
    if (t.includes("defense")) return "Defense Technology";
    if (t.includes("saas") || t.includes("software")) return "SaaS";
    if (t.includes("biotech")) return "Biotech";
    if (t.includes("pharma")) return "Pharmaceuticals";
    if (t.includes("fintech") || t.includes("banking")) return "FinTech";
    return null;
  };

  const extractLocation = (t: string) => {
    const locations = ["mumbai", "delhi", "bangalore", "india", "usa", "europe", "dubai"];
    for (const loc of locations) {
      if (t.includes(loc)) return loc.charAt(0).toUpperCase() + loc.slice(1);
    }
    return null;
  };

  const extractValuation = (t: string) => {
    const match = t.match(/₹?\s?(\d+[-–]\d+)\s?Cr/i) || t.match(/₹?\s?(\d+)\s?Cr/i);
    return match ? match[0] : null;
  };

  const extractOfferings = (t: string) => {
    if (t.includes("drone") || t.includes("surveillance")) return "Unmanned Aerial Systems";
    if (t.includes("threat detection") || t.includes("security")) return "Security Systems";
    return null;
  };

  return {
    intent_focus: extractIntent(lowerText),
    sector: extractSector(lowerText),
    geography: extractLocation(lowerText),
    valuation: extractValuation(text),
    deal_size: extractValuation(text),
    offerings: extractOfferings(lowerText),
    _source: "document"
  };
}

export function mergeWithPriority(existing: ConversationState, detected: Partial<ConversationState>, priority: 'user' | 'document' = 'document'): ConversationState {
  const newState = { ...existing };
  for (const [key, value] of Object.entries(detected)) {
    if (key.startsWith('_')) continue;
    
    const isEmpty = !newState[key as keyof ConversationState] || (typeof newState[key as keyof ConversationState] === 'string' && (newState[key as keyof ConversationState] as string).length === 0);
    
    if (priority === 'user' || isEmpty) {
      if (value !== null && value !== undefined) {
        // @ts-expect-error - dynamic key
        newState[key as keyof ConversationState] = value;
      }
    }
  }
  
  if (detected._source) {
    newState._source = detected._source;
  }
  
  return newState;
}
