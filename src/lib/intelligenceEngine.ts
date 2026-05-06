import { IntelligenceState } from "./conversationState";
import Groq from "groq-sdk";
import OpenAI from "openai";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

/**
 * 🛠️ LAZY INITIALIZERS: Prevents build-time crashes if env vars are missing.
 */
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined in the environment.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not defined in the environment.");
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}



/**
 * 🛠️ AI WRAPPER: Handles OpenAI call with Groq fallback.
 */
async function callAI(messages: ChatMessage[], maxTokens: number = 700): Promise<string> {
  try {
    console.log(`[AI] Attempting OpenAI (gpt-4o-mini)...`);
    const openai = getOpenAI();
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    });
    return res.choices[0].message.content || "";
  } catch (err) {
    console.warn(`[AI] OpenAI failed, falling back to Groq:`, err);
    const groq = getGroq();
    const res = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    });
    return res.choices[0].message.content || "";
  }
}



export async function processIntelligence(
  message: string, 
  history: ChatMessage[], 
  documentText?: string,
  systemPrompt?: string
): Promise<IntelligenceState> {
  const hasDocument = !!(documentText && documentText.trim().length > 50);
  const finalSystemPrompt = systemPrompt || "You are a helpful deal intelligence assistant.";

  let userContent = "";

  if (hasDocument) {
    const docText = documentText!.trim().slice(0, 8000); 
    const userQuestion = message.trim();
    
    userContent = `[CONTEXT: DOCUMENT UPLOADED]
---
${docText}
---

User Input: ${userQuestion || "Please extract all relevant deal data from this document and structure it according to your instructions."}`;
  } else {
    userContent = message;
  }

  const aiMessages = [
    {
      role: "system" as const,
      content: finalSystemPrompt
    },
    // Context: limited history for relevance
    ...history.slice(-8).map(h => ({
      role: h.role as "user" | "assistant" | "system",
      content: h.role === "assistant" 
        ? (() => {
            try {
              const p = JSON.parse(h.content);
              return p.message || h.content;
            } catch { return h.content; }
          })()
        : h.content
    })),
    { role: "user" as const, content: userContent }
  ];

  try {
    console.log(`[INTELLIGENCE] Processing. Document: ${hasDocument} | History: ${history.length} turns`);
    const content = await callAI(aiMessages, 800);
    
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        console.error("[INTELLIGENCE] JSON Parse Error. Raw content:", content);
        throw new Error("AI returned invalid JSON structure.");
      }
    }
  } catch (err) {
    console.error(`[INTELLIGENCE] AI call failed:`, err);
    throw new Error(`AI processing failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error("AI processing returned empty result.");
}

export interface DocumentIntelligence {
  company_overview: string;
  industry: string;
  location: string;
  transaction_type: string;
  products_services: string[];
  capabilities: string[];
  market_position: string;
  competitive_advantages: string[];
  certifications: string[];
  growth_drivers: string[];
  missing_information: string[];
}

/**
 * 🧠 EXPERT DOCUMENT INTELLIGENCE ENGINE
 * Processes raw extracted text into high-quality M&A structured data.
 */
export async function cleanAndStructureDocument(rawText: string): Promise<DocumentIntelligence | null> {
  const DOCUMENT_INTELLIGENCE_PROMPT = `
You are an expert document intelligence engine for M&A (Mergers & Acquisitions).
Your task is to process raw extracted text from a PDF and convert it into clean, structured, high-quality information.

GOALS:
1. CLEAN THE TEXT: Remove noise, duplicate headers/footers, and fix OCR artifacts.
2. RECONSTRUCT STRUCTURE: Identify and rebuild logical business sections.
3. EXTRACT KEY DATA: Identify company overview, industry, location, transaction type, offerings, capabilities, market position, competitive advantages, certifications, and growth drivers.

OUTPUT FORMAT (STRICT):
Return ONLY a JSON object with this exact structure:
{
  "company_overview": "...",
  "industry": "...",
  "location": "...",
  "transaction_type": "...",
  "deal_size": "...",
  "revenue": "...",
  "products_services": ["...", "..."],
  "capabilities": ["...", "..."],
  "market_position": "...",
  "competitive_advantages": ["...", "..."],
  "certifications": ["...", "..."],
  "growth_drivers": ["...", "..."],
  "missing_information": ["...", "..."]
}

RULES:
- DO NOT hallucinate.
- If data is missing, add it to "missing_information".
- Remove redundancy and repeated sections.
- Preserve technical terms and business meaning.
- Tone: Investment banker summarizing a deal document.

Return JSON ONLY. No markdown. No explanation.
`;

  try {
    console.log(`[DOC-INTEL] Processing document (${rawText.length} chars)...`);
    const content = await callAI([
      { role: "system", content: DOCUMENT_INTELLIGENCE_PROMPT },
      { role: "user", content: `RAW EXTRACTED TEXT:\n---\n${rawText.slice(0, 15000)}\n---` }
    ], 1200);

    return JSON.parse(content);
  } catch (err) {
    console.error("[DOC-INTEL] Failed to structure document:", err);
    return null;
  }
}
