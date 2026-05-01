import { IntelligenceState, INITIAL_STATE, ConversationState } from "./conversationState";
import { generateControlPrompt, mergeWithPriority } from "./controlLayer";
import Groq from "groq-sdk";
import OpenAI from "openai";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function reconstructState(history: ChatMessage[]): Promise<IntelligenceState["state"]> {
  let conversationData: ConversationState = { ...INITIAL_STATE };

  // Scan backwards for the latest state - Optimized
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      try {
        const content = history[i].content;
        if (content.startsWith('{')) { // Quick JSON check
          const parsed = JSON.parse(content);
          if (parsed.state || parsed.intent) {
            conversationData = {
              ...conversationData,
              intent_focus: parsed.intent || conversationData.intent_focus,
              ...(parsed.state || {})
            };
            break;
          }
        }
      } catch { continue; }
    }
  }
  return conversationData;
}

/**
 * 🛠️ AI WRAPPER: Handles OpenAI call with Groq fallback.
 */
async function callAI(messages: ChatMessage[], maxTokens: number = 700): Promise<string> {
  try {
    console.log(`[AI] Attempting OpenAI (gpt-4o-mini)...`);
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

/**
 * 🛠️ PRE-PROCESSOR: Extracts raw data from text/document before main logic.
 */
async function extractFromInput(input: string): Promise<Partial<ConversationState>> {
  try {
    const content = await callAI([
      { 
        role: "system", 
        content: `Extract deal metadata into JSON. 
        Fields: sector, geography, valuation, revenue, structure, offerings, clients, risks, strategic_objective, intent_focus (BUY_SIDE/SELL_SIDE/FUNDRAISING). 
        Be specific. Return JSON ONLY.` 
      },
      { role: "user", content: input.slice(0, 10000) }
    ], 300);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function processIntelligence(
  message: string, 
  history: ChatMessage[], 
  documentText?: string,
  systemPrompt?: string
): Promise<IntelligenceState> {
  const hasDocument = !!(documentText && documentText.trim().length > 50);

  // Reconstruct conversation state from history
  const conversationData = await reconstructState(history);

  // Build system prompt — keep it clean, no document injected here
  const finalSystemPrompt = systemPrompt || "";

  let userContent = "";

  if (hasDocument) {
    const docText = documentText!.trim().slice(0, 6000); // OpenAI handles more context

    // Determine what the user is asking alongside the document
    const userQuestion = message.trim();
    const isGenericInstruction = 
      !userQuestion || 
      userQuestion.toLowerCase().includes("extract and analyse") || 
      userQuestion.toLowerCase().includes("summary of") ||
      userQuestion.toLowerCase().includes("analyse this document");

    if (isGenericInstruction) {
      userContent = `I have uploaded a deal document. You are an expert M&A assistant.

DOCUMENT CONTENT:
---
${docText}
---

STRICT RULES:
1. ACKNOWLEDGE FACTS: Internally identify all facts in the document first.
2. NO REPETITION: You MUST NOT ask any question whose answer is already present.
3. ALLOWED ACTIONS: You are ONLY allowed to deepen, clarify, expand, or position strategically.
4. CITE AND ASK: Always reference a document fact before asking a related question.

PROCESS:
Step 1: Identify what is already known from the document.
Step 2: Identify gaps or areas needing deeper insight.
Step 3: Ask ONLY high-value follow-up questions.

OUTPUT FORMAT:

### Strategic Questions
- [Document Fact] — [Follow-up Question]
- [Document Fact] — [Follow-up Question]
...

EXAMPLE:
❌ "What products does the company offer?"
✅ "The company offers AC/DC chargers and software — which segment drives the highest revenue?"

If your output looks like a generic questionnaire, it is WRONG.`;
    } else {
      // User typed a specific question alongside the document
      userContent = `Document uploaded:
---
${docText}
---

User question: ${userQuestion}

Answer the user's question using the document content. Then, generate 3-4 "Strategic Questions" following the citation format: "[Document Fact] — [Follow-up Question]".

STRICT RULES: 
1. Do NOT ask for information already explicitly present in the document.
2. If the output looks like a generic questionnaire, it is INVALID.`;
    }
  } else {
    // No document — normal text conversation
    if (message.trim().length > 0) {
      const userMsgData = await extractFromInput(message);
      const merged = mergeWithPriority(conversationData, userMsgData, 'user');
      Object.assign(conversationData, merged);
    }
    const controlPrompt = generateControlPrompt(conversationData);
    userContent = message;

    const aiMessages = [
      {
        role: "system" as const,
        content: controlPrompt + "\n\n" + finalSystemPrompt + 
          `\n\nCURRENT STATE: ${JSON.stringify(conversationData)}`
      },
      ...history.slice(-6).map(h => ({
        role: h.role as "user" | "assistant" | "system",
        content: h.content
      })),
      { role: "user" as const, content: userContent }
    ];

    try {
      const content = await callAI(aiMessages, 600);
      if (content) return JSON.parse(content);
    } catch (err) {
      console.error("[INTELLIGENCE] AI failed:", err);
      throw new Error(`AI failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Document path — single AI call with document in user message
  const aiMessages = [
    {
      role: "system" as const,
      content: finalSystemPrompt
    },
    // Include last 4 turns of history for context
    ...history.slice(-4).map(h => ({
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
    console.log(`[INTELLIGENCE] Has document: ${hasDocument} | Doc length: ${documentText?.length || 0}`);
    const content = await callAI(aiMessages, 700);
    console.log(`[INTELLIGENCE] Raw response: ${content.slice(0, 200)}`);
    if (content) return JSON.parse(content);
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
