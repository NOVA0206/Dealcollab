import type { DealIntent } from './types';

export interface IntentFraming {
    /** Opening line for a qualification message (Block 1 / mixed Block 1+2). */
    opener: string | null;
    /** Opening line when the message asks ONLY sector (Block 2) questions. */
    m4Intro: string | null;
}

export function buildIntentFraming(
    intent: DealIntent,
    flavor: 'strategic' | 'financial' | null,
): IntentFraming {
    switch (intent) {
        case 'SELL_SIDE':
            return {
                opener: 'To position this correctly for relevant buyers, share:',
                m4Intro: 'A few more details to position this for the right buyers:',
            };

        case 'BUY_SIDE':
            // Financial sponsor (PE/VC/family office) → INVESTOR language, never "buyer".
            if (flavor === 'financial') {
                return {
                    opener: 'To identify the right opportunities for your investment mandate, share:',
                    m4Intro: 'A few more questions to sharpen your investment mandate:',
                };
            }
            // Strategic / operating-company acquirer.
            return {
                opener: 'To match you with the right target, share:',
                m4Intro: 'One more set of questions to identify the right counterparties:',
            };

        case 'FUNDRAISING':
            return {
                opener: 'To identify the right investors, share:',
                m4Intro: 'A few more questions to identify the right investors:',
            };

        case 'DEBT':
            return {
                opener: 'To identify relevant debt providers, share:',
                m4Intro: 'A few more questions to match you with the right lenders:',
            };

        case 'STRATEGIC_PARTNERSHIP':
            return {
                opener: 'To identify aligned strategic partners, share:',
                m4Intro: 'A few more questions to find the right partners:',
            };

        // Intent not yet determined — no intent-specific opener may be used.
        default:
            return { opener: null, m4Intro: null };
    }
}
