import { IntelligenceState, INITIAL_STATE, ConversationState } from "./conversationState";
import Groq from "groq-sdk";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const MODEL = "llama-3.1-8b-instant";
const FALLBACK_MODEL = "mixtral-8x7b-32768";

export async function reconstructState(history: ChatMessage[]): Promise<IntelligenceState["state"]> {
  let conversationData: ConversationState = { ...INITIAL_STATE };

  // Scan backwards for the latest state
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') {
      try {
        const parsed = JSON.parse(history[i].content);
        if (parsed.state || parsed.intent) {
          conversationData = {
            ...conversationData,
            intent_focus: parsed.intent || conversationData.intent_focus,
            ...(parsed.state || {})
          };
        }
      } catch { continue; }
    }
  }
  return conversationData;
}

export async function processIntelligence(
  message: string, 
  history: ChatMessage[], 
  documentText?: string,
  systemPrompt?: string
): Promise<IntelligenceState> {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
  });

  const conversationData = await reconstructState(history);
  
  let contextPrompt = systemPrompt || "";
  if (documentText) {
    const truncatedDoc = documentText.slice(0, 15000);
    contextPrompt = `You are a deal intelligence assistant.\nUse the following document to answer the user query.\n\nDOCUMENT:\n${truncatedDoc}\n\n---\n${contextPrompt}`;
  }

  const aiMessages = [
    { role: "system", content: contextPrompt + `\n\nCURRENT_STATE_OF_EXTRACTION: ${JSON.stringify(conversationData)}` },
    ...history.map(h => ({ role: h.role, content: h.content }))
  ];

  let aiContent = "";
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    const currentModel = attempts === 0 ? MODEL : FALLBACK_MODEL;
    try {
      const aiResponse = await groq.chat.completions.create({
        model: currentModel,
        messages: aiMessages as Groq.Chat.ChatCompletionMessageParam[],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      aiContent = aiResponse?.choices?.[0]?.message?.content || "";
      if (aiContent) break;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) throw err;
    }
  }

  // Verify extraction has the expected structure
  const extraction = JSON.parse(aiContent) as IntelligenceState;
  
  return extraction;
}
