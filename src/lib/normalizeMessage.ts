import { HINGLISH_MAP, SHORTHAND_MAP, TYPO_MAP, SPECIAL_CONDITIONS_MAP } from './dealDictionary';

export function normalizeMessage(raw: string): string {
    let text = raw;

    // 1. Fix typos
    for (const [typo, correct] of Object.entries(TYPO_MAP)) {
        text = text.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correct);
    }

    // 2. Expand shorthand (case-sensitive where needed — "TO", "NW", "PAT")
    for (const [short, expanded] of Object.entries(SHORTHAND_MAP)) {
        text = text.replace(new RegExp(`\\b${short}\\b`, 'g'), expanded);
    }

    // 3. Translate Hinglish signals
    for (const [hinglish, english] of Object.entries(HINGLISH_MAP)) {
        text = text.replace(new RegExp(hinglish, 'gi'), english);
    }

    return text.trim();
}

// Also extract special conditions from raw text (before normalization destroys signals)
export function extractSpecialConditions(raw: string): string[] {
    const lower = raw.toLowerCase();
    const detected: string[] = [];
    for (const [signal, condition] of Object.entries(SPECIAL_CONDITIONS_MAP)) {
        if (lower.includes(signal.toLowerCase())) {
            detected.push(condition as string);
        }
    }
    return [...new Set(detected)]; // deduplicate
}