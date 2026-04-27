import { generateAIResponse, cleanAIJSON } from "./ai-client";

export interface DealData {
  intent: "BUY_SIDE" | "SELL_SIDE" | "INVESTMENT" | null;
  sectors: string[];
  geographies: string[];
  deal_size_min_cr: number | null;
  deal_size_max_cr: number | null;
  revenue_min_cr: number | null;
  revenue_max_cr: number | null;
  deal_structure: string | null;
  special_conditions: string[];
  fraud_flags: string[];
  inferred_urgency: "Low" | "Medium" | "High" | null;
  inferred_buyer_type: "Strategic" | "Financial" | null;
}

export interface EngineResponse {
  type: "clarification" | "deal_ready" | "deal_saved" | "error";
  data: DealData;
  questions: string[];
  missing_fields?: string[];
  message?: string;
}

export const REQUIRED_FIELDS = [
  "intent",
  "sectors",
  "geographies",
  "deal_size_min_cr",
  "deal_size_max_cr",
  "revenue_min_cr",
  "revenue_max_cr",
  "deal_structure",
  "special_conditions",
  "inferred_urgency",
  "inferred_buyer_type"
];

const VALID_INTENTS = ["BUY_SIDE", "SELL_SIDE", "INVESTMENT"];

const SYSTEM_PROMPT = `
You are DealCollab Intake AI — a STRICT deal data collection engine.

Your ONLY job is to extract structured deal data from user input.
DO NOT provide conversational replies.
DO NOT explain yourself.
DO NOT use markdown code blocks.
ONLY return a valid JSON object.

CONTEXT AWARENESS:
1. You will be provided with "Current Session Data".
2. Your goal is to fill the null/empty fields based ONLY on the NEW user input.

STRICT EXTRACTION RULES:
1. Intent: BUY_SIDE / SELL_SIDE / INVESTMENT. If ambiguous, set to null.
2. Sectors: Array of industry sectors.
3. Geographies: Array of cities/locations.
4. Deal Size: Extract Cr values for min/max.
5. Revenue: Extract Cr values for min/max.
6. Deal Structure: Extract (Asset / Share / Majority) or similar.
7. Special Conditions: Array of extra details. If user says "no" or "none", return ["None"].
8. Fraud Flags: Array of red flags detected.
9. Inferred Urgency: Low / Medium / High.
10. Inferred Buyer Type: Strategic / Financial.

OUTPUT FORMAT (MANDATORY):
{
  "data": {
    "intent": "BUY_SIDE" | "SELL_SIDE" | "INVESTMENT" | null,
    "sectors": [],
    "geographies": [],
    "deal_size_min_cr": number | null,
    "deal_size_max_cr": number | null,
    "revenue_min_cr": number | null,
    "revenue_max_cr": number | null,
    "deal_structure": string | null,
    "special_conditions": [],
    "fraud_flags": [],
    "inferred_urgency": "Low" | "Medium" | "High" | null,
    "inferred_buyer_type": "Strategic" | "Financial" | null
  }
}
`;

export function isMissing(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

export function getMissingFields(data: DealData): string[] {
  const missing = REQUIRED_FIELDS.filter(field => isMissing(data[field as keyof DealData]));

  // Strict Intent Validation
  if (data.intent && !VALID_INTENTS.includes(data.intent)) {
    if (!missing.includes("intent")) missing.push("intent");
  }

  return missing;
}

export function generateQuestions(missing: string[]): string[] {
  const map: Record<string, string> = {
    intent: "Are you looking to BUY, SELL, or INVEST?",
    sectors: "Which industry or sector?",
    geographies: "Which city or location?",
    deal_size_min_cr: "Minimum deal size in Cr?",
    deal_size_max_cr: "Maximum deal size in Cr?",
    revenue_min_cr: "Minimum revenue in Cr?",
    revenue_max_cr: "Maximum revenue in Cr?",
    deal_structure: "Preferred deal structure? (Asset / Share / Majority)",
    special_conditions: "Any special conditions?",
    inferred_urgency: "How urgent is this deal? (Low / Medium / High)",
    inferred_buyer_type: "What type of buyer? (Strategic / Financial)"
  };

  return missing.map(f => map[f] || `Please provide details for ${f}`);
}

function mergeData(oldData: Partial<DealData>, newData: Partial<DealData>): DealData {
  const filteredNewData = Object.fromEntries(
    Object.entries(newData).filter(([_, v]) => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true))
  );

  const merged = {
    ...oldData,
    ...filteredNewData
  } as DealData;

  // Ensure arrays are unique and filtered
  if (Array.isArray(merged.sectors)) merged.sectors = Array.from(new Set(merged.sectors)).filter(Boolean);
  if (Array.isArray(merged.geographies)) merged.geographies = Array.from(new Set(merged.geographies)).filter(Boolean);
  if (Array.isArray(merged.special_conditions)) merged.special_conditions = Array.from(new Set(merged.special_conditions)).filter(Boolean);
  if (Array.isArray(merged.fraud_flags)) merged.fraud_flags = Array.from(new Set(merged.fraud_flags)).filter(Boolean);

  return merged;
}

export async function processDealIntake(
  userInput: string,
  sessionData: Partial<DealData> = {}
): Promise<EngineResponse> {
  try {
    const rawResponse = await generateAIResponse([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Current Session Data: ${JSON.stringify(sessionData)}\nUser Input: "${userInput}"` }
    ]);

    const cleaned = cleanAIJSON(rawResponse);
    const extracted = JSON.parse(cleaned);
    const extractedData = extracted.data || {};

    // HANDLE "NO SPECIAL CONDITIONS"
    if (
      typeof extractedData.special_conditions === "string" &&
      extractedData.special_conditions.toLowerCase().includes("no")
    ) {
      extractedData.special_conditions = ["None"];
    } else if (Array.isArray(extractedData.special_conditions) && extractedData.special_conditions.some((s: string) => s.toLowerCase() === "no" || s.toLowerCase() === "none")) {
      extractedData.special_conditions = ["None"];
    }

    // MERGE LOGIC
    const mergedData = mergeData(sessionData, extractedData);

    console.log("Previous:", sessionData);
    console.log("Extracted:", extractedData);
    console.log("Merged:", mergedData);

    const missing = getMissingFields(mergedData);
    console.log("Missing:", missing);

    if (missing.length > 0) {
      return {
        type: "clarification",
        data: mergedData,
        missing_fields: missing,
        questions: generateQuestions(missing).slice(0, 3)
      };
    }

    // COMPLETE DATA
    return {
      type: "deal_ready",
      data: mergedData,
      questions: []
    };

  } catch (error) {
    console.error("Deal Processing Pipeline Error:", error);
    return {
      type: "error",
      data: sessionData as DealData,
      questions: ["I'm sorry, I'm having trouble processing that right now. Could you please try again?"]
    };
  }
}
