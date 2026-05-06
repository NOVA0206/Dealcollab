import { IntelligenceState } from "./conversationState";

/**
 * 🛡️ RESPONSE GUARD LAYER
 * Ensures that if the AI returns a weak/empty message, we construct a 
 * system-consistent response based on the RouterState.
 */
export function buildFinalMessage(extraction: Partial<IntelligenceState>): string {
  const s = extraction.state;
  const intent = extraction.intent;
  const aiMessage = extraction.message;
  const isComplete = extraction.is_complete;

  const isSufficient = s?.sector && (
    (s.revenue || s.deal_size ? 1 : 0) + 
    (intent ? 1 : 0) + 
    (s.geography ? 1 : 0) >= 2
  );

  // 1. TRUST AI MESSAGE FIRST (if valid)
  if (aiMessage && aiMessage.length > 30 && !isPlaceholderMessage(aiMessage)) {
    return aiMessage;
  }

  // 2. CLOSURE OVERRIDE
  if (isComplete) {
    return `Your requirement has been structured successfully.

Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.

I will now work to identify the right counterparty for you and surface only relevant aligned opportunities.

If alignment is confirmed and only after your approval, you will be connected.

This process runs continuously in the background, and you'll be notified as relevant matches emerge.`;
  }

  // 3. MOMENTUM SYNTHESIZER (Guard against empty AI output in Momentum Mode)
  if (isSufficient) {
    const intentStr = intent?.replace('_', ' ').toLowerCase() || "transaction";
    const sectorStr = s.sector || "your sector";
    const sizeStr = s.deal_size || s.revenue || "undisclosed size";
    const geoStr = s.geography || "India";

    return `Got it — you are looking for a ${intentStr} in the ${sectorStr} sector, with a deal size of ~${sizeStr} across ${geoStr}.

This is sufficient to begin identifying relevant opportunities.

I’ll start mapping suitable counterparties.

One quick refinement:
Are you primarily targeting strategic operators or financial investors for this requirement?`;
  }

  // 4. QUALIFICATION FALLBACK (If AI fails during intake)
  if (intent || s?.sector) {
    const intentStr = intent?.replace('_', ' ') || 'a deal';
    return `I have captured your interest in ${s?.sector || 'the sector'} for ${intentStr}.

To move to the matchmaking phase, I need a few more details:
• Approximate annual revenue or deal size
• Preferred geography
• Transaction structure preference

Your inputs remain confidential and will only be used for precise matchmaking.`;
  }

  // 5. LAST RESORT FALLBACK
  return "Welcome to DealCollab. Please share your requirement — are you looking to buy, sell, or raise funds? Describe your business or target in plain text to begin.";
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
