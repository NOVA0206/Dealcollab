import { IntelligenceState } from "./conversationState";
import { RouterState } from "./types";

/**
 * Hydrates the template summary containing placeholders with actual state values.
 * Throws an error if any placeholder remains unresolved.
 */
export function hydrateMandateSummary(message: string, state: RouterState): string {
  console.log("[MANDATE STATE]", JSON.stringify(state, null, 2));

  let hydrated = message;

  const formatSector = () => {
    if (!state.sector) return "";
    const sec = state.sector.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    if (state.sub_sector) {
      const sub = state.sub_sector.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      return `${sec} (${sub})`;
    }
    return sec;
  };

  const intentVal = state.intent || "";
  const sectorVal = formatSector();
  const geographyVal = state.geography || "";
  const sizeVal = state.deal_size || state.revenue || "";
  const structureVal = state.structure || "";
  
  const detailsParts: string[] = [];
  if (state.intent_focus) detailsParts.push(state.intent_focus);
  if (state.industry_data) {
    Object.entries(state.industry_data).forEach(([k, v]) => {
      if (v && typeof v === 'string' && k !== 'company_overview') {
        detailsParts.push(`${k.replace(/_/g, ' ')}: ${v}`);
      }
    });
  }
  const detailsVal = detailsParts.join(', ') || "";

  // Perform replacements for standard forms
  hydrated = hydrated.replace(/\[Intent\]/g, intentVal);
  hydrated = hydrated.replace(/\[Sector\]/g, sectorVal);
  
  hydrated = hydrated.replace(/\[Geography if stated\]/g, geographyVal);
  hydrated = hydrated.replace(/\[Geography\]/g, geographyVal);
  
  hydrated = hydrated.replace(/\[Deal size if stated\]/g, sizeVal);
  hydrated = hydrated.replace(/\[Size\]/g, sizeVal);
  
  hydrated = hydrated.replace(/\[Structure if stated\]/g, structureVal);
  hydrated = hydrated.replace(/\[Structure\]/g, structureVal);
  
  hydrated = hydrated.replace(/\[Any other key details:.*?\]/g, detailsVal);
  hydrated = hydrated.replace(/\[Key details\]/g, detailsVal);

  // VALIDATION: check if any unresolved placeholders remain
  const placeholders = [
    /\[Intent\]/i,
    /\[Sector\]/i,
    /\[Geography.*?\]/i,
    /\[Size\]/i,
    /\[Deal size.*?\]/i,
    /\[Structure.*?\]/i,
    /\[Key details.*?\]/i,
    /\[Any other key details.*?\]/i
  ];

  const hasUnresolved = placeholders.some(regex => regex.test(hydrated));
  if (hasUnresolved) {
    console.error("Hydration failed for message:", hydrated);
    throw new Error("[CLOSURE ERROR]\nTemplate hydration failed");
  }

  return hydrated;
}

/**
 * 🛡️ RESPONSE GUARD LAYER
 * Ensures that if the AI returns a weak/empty message, we construct a 
 * system-consistent response based on the RouterState.
 */
export function buildFinalMessage(extraction: Partial<IntelligenceState>, fullState?: RouterState): string {
  const s = fullState || extraction.state;
  const intent = fullState?.intent || extraction.intent;
  const aiMessage = extraction.message;
  const isComplete = fullState?.is_complete ?? extraction.is_complete;

  const isSufficient = s?.sector && (
    (s.revenue || s.deal_size ? 1 : 0) + 
    (intent ? 1 : 0) + 
    (s.geography ? 1 : 0) >= 2
  );

  // 1. TRUST AI MESSAGE FIRST (if valid)
  if (aiMessage && aiMessage.length > 30 && !isPlaceholderMessage(aiMessage)) {
    const hasPlaceholders = aiMessage.includes('[Intent]') || 
                            aiMessage.includes('[Sector]') || 
                            aiMessage.includes('[Geography]') || 
                            aiMessage.includes('[Size]') || 
                            aiMessage.includes('[Structure]');
    if (hasPlaceholders && fullState) {
      return hydrateMandateSummary(aiMessage, fullState);
    }
    return aiMessage;
  }

  // 2. CLOSURE OVERRIDE
  if (isComplete) {
    return `Your requirement has been structured successfully.

Your intent is secure and confidential with us.
This is not deal distribution — this is deal resolution.

I will now work to identify the right counterparty for you and surface only relevant aligned opportunities.

If alignment is confirmed and only after your approval, you will be connected.

This process runs continuously in the background, and you can track status in your Deal Log.`;
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

What is the preferred transaction timeline or key criteria for counterparties?`;
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
