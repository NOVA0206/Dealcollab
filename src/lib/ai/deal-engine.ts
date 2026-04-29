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
  data: Partial<DealData>;
  message: string;
}

// MANDATORY FIELDS FOR BACKEND VALIDATION
export const MANDATORY_FIELDS = [
  "intent",
  "sectors",
  "geographies",
  "deal_size_min_cr",
  "deal_size_max_cr",
  "deal_structure",
  "revenue_min_cr",
  "revenue_max_cr",
  "special_conditions"
];

const SYSTEM_PROMPT = `
You are a deal extraction assistant.

You ONLY:
* extract structured data
* suggest next questions

You DO NOT decide completion.

Return JSON:
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
    "special_conditions": []
  },
  "message": "a short, smart conversational response acknowledging the input and asking the next 1-2 priority questions"
}

Rules:
* Extract aggressively.
* Do NOT skip fields.
* Ask smart questions based on priority: 1. deal_structure, 2. revenue, 3. special_conditions.
* No text outside JSON.
* If user says "Hi", give exactly: "Hey 👋 Welcome to DealCollab AI — your intelligent deal-making partner. I help you discover high-quality opportunities, structure mandates, and match with the right buyers, sellers, or investors in seconds. Just tell me in one line — what are you looking for today?"
`;

export function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

export function getMissingFields(data: DealData): string[] {
  const missing: string[] = [];
  if (isMissing(data.intent)) missing.push("intent");
  if (isMissing(data.sectors)) missing.push("sectors");
  if (isMissing(data.geographies)) missing.push("geographies");
  if (isMissing(data.deal_size_min_cr)) missing.push("deal_size");
  if (isMissing(data.deal_structure)) missing.push("deal_structure");
  if (isMissing(data.revenue_min_cr)) missing.push("revenue");
  if (isMissing(data.special_conditions)) missing.push("special_conditions");
  return missing;
}

export function mergeData(oldData: Partial<DealData>, newData: Partial<DealData>): DealData {
  const filteredNewData = Object.fromEntries(
    Object.entries(newData).filter(([, v]) => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true))
  );

  const merged = {
    ...oldData,
    ...filteredNewData
  } as DealData;

  // Cleanup arrays
  if (Array.isArray(merged.sectors)) merged.sectors = Array.from(new Set(merged.sectors)).filter(Boolean);
  if (Array.isArray(merged.geographies)) merged.geographies = Array.from(new Set(merged.geographies)).filter(Boolean);
  if (Array.isArray(merged.special_conditions)) merged.special_conditions = Array.from(new Set(merged.special_conditions)).filter(Boolean);

  return merged;
}

export async function processDealIntake(
  userInput: string,
  sessionData: Partial<DealData> = {},
  messageCount: number = 0
): Promise<EngineResponse> {
  try {
    const rawResponse = await generateAIResponse([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Context: Turn ${messageCount + 1}. Session Data: ${JSON.stringify(sessionData)}\nUser Message: "${userInput}"` }
    ]);

    const cleaned = cleanAIJSON(rawResponse);
    const parsed = JSON.parse(cleaned);

    return {
      data: parsed.data || {},
      message: parsed.message
    };

  } catch (error: unknown) {
    console.error("FULL ERROR:", error);
    console.error("STRINGIFIED:", JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    throw new Error(errorMessage);
  }
}
