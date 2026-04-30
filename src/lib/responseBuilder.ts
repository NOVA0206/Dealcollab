import { IntelligenceState } from "./conversationState";

export function buildFinalMessage(extraction: Partial<IntelligenceState>): string {
  const isComplete = extraction.is_complete;
  
  if (isComplete) {
    return `Your requirement has been structured successfully.

Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.

I will now work to identify the right counterparty for you and surface only relevant aligned opportunities.

If alignment is confirmed and only after your approval, you will be connected.

This process runs continuously in the background, and you’ll be notified as relevant matches emerge.`;
  }

  return extraction.message || "I've updated your deal profile. What else can you tell me?";
}
