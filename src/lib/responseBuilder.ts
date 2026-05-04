import { IntelligenceState } from "./conversationState";

export function buildFinalMessage(extraction: Partial<IntelligenceState>): string {
  const isComplete = extraction.is_complete;
  const aiMessage = extraction.message;

  // Use the AI-generated message directly, even if complete (Momentum Mode)
  if (aiMessage && aiMessage.length > 20 && !isPlaceholderMessage(aiMessage)) {
    return aiMessage;
  }

  if (isComplete) {
    return `Your requirement has been structured successfully.

Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.

I will now work to identify the right counterparty for you and surface only relevant aligned opportunities.

If alignment is confirmed and only after your approval, you will be connected.

This process runs continuously in the background, and you'll be notified as relevant matches emerge.`;
  }

  // Safe fallback
  return "To structure this mandate correctly, please share the sector, preferred geography, and approximate deal size. Your inputs remain confidential.";
}

function isPlaceholderMessage(msg: string): boolean {
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
  return PLACEHOLDER_STRINGS.some(p => msg.toLowerCase().includes(p));
}
