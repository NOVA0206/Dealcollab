import { IntelligenceState } from "./conversationState";

export function buildFinalMessage(extraction: Partial<IntelligenceState>): string {
  const isComplete = extraction.is_complete;

  if (isComplete) {
    return `Your requirement has been structured successfully.

Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.

I will now work to identify the right counterparty for you and surface only relevant aligned opportunities.

If alignment is confirmed and only after your approval, you will be connected.

This process runs continuously in the background, and you'll be notified as relevant matches emerge.`;
  }

  // Use the AI-generated message directly
  const aiMessage = extraction.message;

  // Reject placeholder text that Groq sometimes echoes from the schema
  const PLACEHOLDER_STRINGS = [
    "your sharp, conversational",
    "mandatory response format",
    "write your actual response",
    "this field must contain",
    "i've updated your deal profile",
    "write your actual",
    "your actual response here",
    "following the mandatory",
  ];

  const isPlaceholder = !aiMessage ||
    aiMessage.trim().length < 10 ||
    PLACEHOLDER_STRINGS.some(p => aiMessage.toLowerCase().includes(p));

  if (isPlaceholder) {
    // Groq returned a placeholder — return a safe fallback that at least makes sense
    console.warn("[RESPONSE BUILDER] Groq returned placeholder or empty message. Raw:", aiMessage);
    return "To structure this mandate correctly, please share: the sector, preferred geography, approximate deal size, and whether this is a full acquisition or partial stake. Your inputs remain confidential.";
  }

  return aiMessage;
}
