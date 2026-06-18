import { describe, it, expect } from 'vitest';
import { resolveCompletion } from '../resolveCompletion';
import { baseState, ext } from './_helpers';

// Convenience: candidateState defaults to the storedState (no pre-detection effect)
// unless a test needs pre-detected values.
function run(args: Parameters<typeof resolveCompletion>[0]) {
  return resolveCompletion(args);
}

describe('resolveCompletion — quality gate funnel (correct behavior)', () => {
  it('A. full SELL_SIDE, M4 asked, LLM completes → quality PASS → INTENT_VALIDATION (no insert yet)', () => {
    const stored = baseState({
      intent: 'SELL_SIDE', sector: 'pharma', geography: 'Mumbai', revenue: '₹50 Cr',
      m4_questions_asked: true, is_sufficient: true, phase: 'MOMENTUM',
    });
    const r = run({ storedState: stored, candidateState: stored, message: "that's everything", extraction: ext({ is_complete: true }) });
    expect(r.shouldInsert).toBe(false);
    expect(r.state.quality_gate_passed).toBe(true);
    expect(r.state.is_complete).toBe(false);
    expect(r.extraction.is_complete).toBe(false);
    expect(r.state.phase).toBe('INTENT_VALIDATION');
    expect(r.state.intent_validated).toBeNull();
    expect(r.reason).toBe('quality-gate-pass-await-validation');
    expect(r.extraction.message).toContain("Is this a genuine mandate?");
  });

  it('B. SELL_SIDE missing geography → quality FAIL (first) → extend, no insert', () => {
    const stored = baseState({
      intent: 'SELL_SIDE', sector: 'pharma', m4_questions_asked: true, phase: 'MOMENTUM',
    });
    const r = run({ storedState: stored, candidateState: stored, message: 'done', extraction: ext({ is_complete: true }) });
    expect(r.shouldInsert).toBe(false);
    expect(r.state.is_complete).toBe(false);
    expect(r.state.quality_gate_attempted).toBe(true);
    expect(r.state.quality_gate_passed).toBe(false);
    expect(r.state.round_count).toBe(0);
    expect(r.reason).toBe('quality-gate-extend');
  });

  it('N. BUY_SIDE full set → quality PASS → INTENT_VALIDATION', () => {
    const stored = baseState({
      intent: 'BUY_SIDE', sector: 'saas', geography: 'India', deal_size: '₹100 Cr',
      m4_questions_asked: true, phase: 'MOMENTUM',
    });
    const r = run({ storedState: stored, candidateState: stored, message: 'ready', extraction: ext({ is_complete: true }) });
    expect(r.state.quality_gate_passed).toBe(true);
    expect(r.state.phase).toBe('INTENT_VALIDATION');
    expect(r.state.is_complete).toBe(false);
    expect(r.extraction.is_complete).toBe(false);
    expect(r.reason).toBe('quality-gate-pass-await-validation');
    expect(r.extraction.message).toContain("Is this a genuine mandate?");
  });
});

describe('resolveCompletion — intent validation', () => {
  const validatedStored = () => baseState({
    intent: 'SELL_SIDE', sector: 'pharma', geography: 'Mumbai', revenue: '₹50 Cr',
    m4_questions_asked: true, quality_gate_passed: true, quality_score: 7,
    intent_validated: null, phase: 'INTENT_VALIDATION',
  });

  it('C. "yes" → validated, inserts', () => {
    const stored = validatedStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'yes', extraction: ext({ is_complete: false }) });
    expect(r.state.intent_validated).toBe(true);
    expect(r.state.is_complete).toBe(true);
    expect(r.shouldInsert).toBe(true);
    expect(r.reason).toBe('intent-validated-yes');
  });

  it('E. "no, just exploring" → declined, no insert', () => {
    const stored = validatedStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'no, just exploring', extraction: ext({ is_complete: false }) });
    expect(r.state.intent_validated).toBe(false);
    expect(r.shouldInsert).toBe(false);
    expect(r.reason).toBe('intent-validated-no');
  });

  it('D. FIXED (Phase 2.5): "absolutely not" is read as NO — declined, no insert', () => {
    const stored = validatedStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'absolutely not', extraction: ext({ is_complete: false }) });
    expect(r.state.intent_validated).toBe(false);
    expect(r.shouldInsert).toBe(false);
    expect(r.reason).toBe('intent-validated-no');
  });

  it('M. FIXED (Phase 2.5): "sure" is a real Yes — inserts with intent_validated=true (no more null insert)', () => {
    const stored = validatedStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'sure', extraction: ext({ is_complete: true }) });
    expect(r.state.intent_validated).toBe(true);
    expect(r.shouldInsert).toBe(true);
    expect(r.reason).toBe('intent-validated-yes');
  });

  it('AI-field primary: intent_validation="yes" confirms even when the text is ambiguous', () => {
    const stored = validatedStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'ok', extraction: ext({ is_complete: false, intent_validation: 'yes' }) });
    expect(r.state.intent_validated).toBe(true);
    expect(r.shouldInsert).toBe(true);
  });

  it('AI-field primary: intent_validation="no" declines on ambiguous text', () => {
    const stored = validatedStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'ok', extraction: ext({ is_complete: false, intent_validation: 'no' }) });
    expect(r.state.intent_validated).toBe(false);
    expect(r.shouldInsert).toBe(false);
  });

  it('negation backstop overrides the AI: AI says yes but user clearly says "no thanks" → declined', () => {
    const stored = validatedStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'no thanks', extraction: ext({ is_complete: false, intent_validation: 'yes' }) });
    expect(r.state.intent_validated).toBe(false);
    expect(r.shouldInsert).toBe(false);
  });
});

describe('resolveCompletion — M4 guard', () => {
  it('F. LLM completes before M4 asked → guard blocks, rewrites message to the sector bridge', () => {
    const stored = baseState({
      intent: 'SELL_SIDE', sector: 'pharma', geography: 'Mumbai',
      m4_questions_asked: false, phase: 'QUALIFICATION',
    });
    const r = run({ storedState: stored, candidateState: stored, message: 'looks complete to me', extraction: ext({ is_complete: true }) });
    expect(r.m4GuardFired).toBe(true);
    expect(r.state.is_complete).toBe(false);
    expect(r.state.phase).toBe('QUALIFICATION');
    expect(r.messageOverride).toMatch(/sector-specific details about the pharma target/);
    expect(r.reason).toBe('blocked-by-m4-guard');
  });

  it('G. friction bypasses the M4 guard → jumps straight to quality gate / validation, M4 skipped', () => {
    const stored = baseState({
      intent: 'SELL_SIDE', sector: 'pharma', geography: 'Mumbai', revenue: '₹50 Cr',
      m4_questions_asked: false, phase: 'QUALIFICATION',
    });
    const r = run({ storedState: stored, candidateState: stored, message: 'go ahead', extraction: ext({ is_complete: false }) });
    expect(r.m4GuardFired).toBe(false);            // friction skipped enrichment entirely
    expect(r.state.quality_gate_passed).toBe(true);
    expect(r.state.phase).toBe('INTENT_VALIDATION');
    expect(r.reason).toBe('quality-gate-pass-await-validation');
  });
});

describe('resolveCompletion — document fast-lane (Phase 3.2/3.3/3.4 ✓)', () => {
  const docStored = () => baseState({
    is_document_intake: true,
    intent: 'SELL_SIDE', sector: 'pharma', geography: 'Mumbai', revenue: '₹50 Cr',
    m4_questions_asked: false, phase: 'QUALIFICATION', turn_count: 1,
  });

  it('H. FIXED (Phase 3.2/3.4): confirming a document with "yes" completes it and goes straight to matching (skips M4 AND the separate genuine-mandate Y/N)', () => {
    const stored = docStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'yes', extraction: ext({ is_complete: false }) });
    expect(r.m4GuardFired).toBe(false);            // fast-lane: M4 skipped
    expect(r.state.quality_gate_passed).toBe(true);
    expect(r.state.intent_validated).toBe(true);   // the document confirmation IS the genuine signal
    expect(r.shouldInsert).toBe(true);             // → matching
  });

  it('I. FIXED (Phase 3.4): "go ahead" behaves the SAME as "yes" — a confirmed document goes straight to matching', () => {
    const stored = docStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'go ahead', extraction: ext({ is_complete: false }) });
    expect(r.state.intent_validated).toBe(true);
    expect(r.shouldInsert).toBe(true);
  });

  it('correction: "no, the revenue is wrong" stays in synthesis, nothing saved', () => {
    const stored = docStored();
    const r = run({ storedState: stored, candidateState: stored, message: 'no, the revenue is wrong', extraction: ext({ is_complete: false }) });
    expect(r.shouldInsert).toBe(false);
    expect(r.state.is_complete).toBe(false);
    expect(r.state.is_document_intake).toBe(true);
  });
});

describe('resolveCompletion — friction & RC8 are still gated by the quality gate', () => {
  it('J. RC8 4-turn auto-close with thin BUY_SIDE → quality FAIL → extend, no insert', () => {
    const stored = baseState({
      intent: 'BUY_SIDE', sector: 'saas', m4_questions_asked: true,
      turn_count: 3, phase: 'QUALIFICATION',
    });
    const r = run({ storedState: stored, candidateState: stored, message: 'what else do you need', extraction: ext({ is_complete: false }) });
    expect(r.shouldInsert).toBe(false);
    expect(r.state.quality_gate_attempted).toBe(true);
    expect(r.reason).toBe('quality-gate-extend');
  });

  it('K. friction with only intent+sector → quality FAIL → extend, no insert', () => {
    const stored = baseState({
      intent: 'SELL_SIDE', sector: 'pharma', m4_questions_asked: true, phase: 'QUALIFICATION',
    });
    const r = run({ storedState: stored, candidateState: stored, message: 'this is enough', extraction: ext({ is_complete: false }) });
    expect(r.shouldInsert).toBe(false);
    expect(r.state.is_complete).toBe(false);
    expect(r.reason).toBe('quality-gate-extend');
  });
});

describe('resolveCompletion — in-progress turn', () => {
  it('L. nothing complete → not finalized, no insert, no guard', () => {
    const stored = baseState({
      intent: 'SELL_SIDE', sector: 'pharma', m4_questions_asked: false, phase: 'QUALIFICATION',
    });
    const r = run({ storedState: stored, candidateState: stored, message: "it's based in Mumbai", extraction: ext({ is_complete: false }) });
    expect(r.shouldInsert).toBe(false);
    expect(r.m4GuardFired).toBe(false);
    expect(r.reason).toBe('not-finalized');
  });
});

describe('resolveCompletion — pre-detection persistence', () => {
  it('should persist intent_focus from candidateState when not present in extraction', () => {
    const stored = baseState({
      intent: 'BUY_SIDE', sector: 'saas', geography: 'Pune', deal_size: '50 Cr', structure: 'Full Buyout',
    });
    const candidate = { ...stored, intent_focus: 'Geographical expansion' };
    const r = run({
      storedState: stored,
      candidateState: candidate,
      message: 'Geographical Expansion',
      extraction: ext({ is_complete: false, state: { intent_focus: null } }),
    });
    expect(r.state.intent_focus).toBe('Geographical expansion');
    expect(r.state.strategic_intent).toBe('Geographical expansion');
  });
});

