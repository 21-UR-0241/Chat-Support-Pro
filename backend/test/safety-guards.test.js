/**
 * Characterization tests for the AI safety guards.
 *
 * These lock in the behaviour of the guards that keep unauthorised dosing,
 * invented timeframes, and ungrounded product claims out of agent-facing
 * suggestions. They are deliberately behavioural, not structural: they assert
 * what a guard DECIDES, never how it is written, so a refactor of the
 * generation pipeline around them does not require touching this file.
 *
 * Run: node backend/test/safety-guards.test.js
 */

const assert = require('assert');
const ai = require('../lib/ai-suggestions');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

function group(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ── Intent detection ────────────────────────────────────────────────────────
// These gate which safety block gets pinned into the prompt. A miss here
// silently disarms every downstream dosing guard.

group('detectSafetyDosingQuestion', () => {
  test('catches a direct dosing question', () => {
    assert.ok(ai.detectSafetyDosingQuestion('what dose should I start on?', ''));
  });

  test('catches a reconstitution question', () => {
    assert.ok(ai.detectSafetyDosingQuestion('how much bac water do I use?', ''));
  });

  test('catches a follow-up whose subject is in the history', () => {
    const history = 'Customer: do you have reta?\nAgent: We do, in 10mg vials.';
    assert.ok(ai.detectSafetyDosingQuestion('how many ml do I reconstitute it with?', history));
  });

  test('does not fire on an order-status question', () => {
    assert.ok(!ai.detectSafetyDosingQuestion('where is my order?', ''));
  });
});

group('detectTrustQuestion', () => {
  test('fires on a legitimacy challenge', () => {
    assert.ok(ai.detectTrustQuestion('is this site even legit?'));
  });

  test('does not fire on a routine question', () => {
    assert.ok(!ai.detectTrustQuestion('when does my order ship?'));
  });
});

// ── Anchor resolution ───────────────────────────────────────────────────────
// The product anchor decides which brain rules are retrieved. If it resolves
// to a consumable, dosing numbers get attached to the wrong product.

group('resolveProductAnchor', () => {
  test('resolves a product named in the current message', () => {
    assert.match(String(ai.resolveProductAnchor('tell me about retatrutide', '') || ''), /retatrutide/i);
  });

  test('carries the anchor forward from history on a follow-up', () => {
    const history = 'Customer: interested in retatrutide\nAgent: Sure, what would you like to know?';
    assert.match(String(ai.resolveProductAnchor('how do I store it?', history) || ''), /retatrutide/i);
  });

  test('never anchors on bacteriostatic water', () => {
    const anchor = ai.resolveProductAnchor('how much bacteriostatic water?', '');
    assert.ok(!/bacteriostatic|bac water/i.test(String(anchor || '')));
  });
});

// ── Dosing safety ───────────────────────────────────────────────────────────
// The single most important guard in the system: an unauthorised dose reaching
// an agent is a real-world harm, not a tone problem.

group('validateSafetyDosing', () => {
  test('flags efficacy promises on a dosing turn', () => {
    const out = ai.validateSafetyDosing(
      [{ text: "Stay on 2.5mg and you'll keep losing weight." }],
      'should I stay on 2.5mg?'
    );
    assert.ok(out, 'expected a result from validateSafetyDosing');
  });

  test('does not mangle a clean reconstitution answer', () => {
    const clean = 'Reconstitute the 10mg vial with 2.5mL of BAC water for 4mg/mL.';
    const out = ai.validateSafetyDosing([{ text: clean }], 'how do I reconstitute 10mg?');
    const text = JSON.stringify(out);
    assert.ok(text.includes('2.5mL') || text.includes('2.5'), 'dosing numbers must survive validation');
  });
});

// ── Fabrication guards ──────────────────────────────────────────────────────

group('detectInventedTimeframe', () => {
  test('flags an arrival promise with no brain backing', () => {
    const { flagged } = ai.detectInventedTimeframe(['It will arrive within 2 business days.'], '');
    assert.ok(flagged.length > 0, 'an unbacked delivery window must be flagged');
  });

  test('does not flag a bracketed placeholder', () => {
    const { flagged, placeholders } = ai.detectInventedTimeframe(['It arrives [timeframe].'], '');
    assert.strictEqual(flagged.length, 0, 'a placeholder defers the promise instead of making it');
    assert.strictEqual(placeholders, 1, 'the placeholder should be counted');
  });

  test('does not flag a timeframe the brain authorises', () => {
    const brain = 'Orders ship within 2 business days of payment clearing.';
    const { flagged } = ai.detectInventedTimeframe(['It will arrive within 2 business days.'], brain);
    assert.strictEqual(flagged.length, 0, 'a brain-backed timeframe is allowed to be stated flat');
  });

  test('ignores a timeframe that makes no arrival claim', () => {
    const { flagged } = ai.detectInventedTimeframe(['I replied to your email within 2 hours.'], '');
    assert.strictEqual(flagged.length, 0, 'only arrival claims can make an unauthorised delivery promise');
  });
});

group('detectStall', () => {
  test('catches "let me check" when the brain already has the answer', () => {
    const hit = ai.detectStall(
      [{ text: 'Let me check on that and get back to you.' }],
      { brainHasProductAnswer: true }
    );
    assert.ok(hit, 'stalling on a known answer must be caught');
  });
});

// ── Emotion ─────────────────────────────────────────────────────────────────
// The regression that motivated moving this off the browser: real anger is
// usually expressed in facts and repetition, not adjectives.

group('detectEmotion', () => {
  test('reads anger expressed as facts, with no angry words at all', () => {
    const msg = "I've been waiting three weeks and nobody has replied. This is the third time I've asked.";
    const { level, signals } = ai.detectEmotion('', msg, null);
    assert.strictEqual(level, 'very_negative',
      'the calmly-worded complaint is the one that most needs escalation');
    assert.ok(signals.length >= 2, 'the reasons should be reported, not just the label');
  });

  test('still reads anger expressed as adjectives', () => {
    const { level } = ai.detectEmotion('', 'This is ridiculous and completely unacceptable!!', null);
    assert.ok(level === 'negative' || level === 'very_negative');
  });

  test('understands spelled-out durations', () => {
    const digits = ai.detectEmotion('', 'Its been 3 weeks now.', null);
    const words  = ai.detectEmotion('', 'Its been three weeks now.', null);
    assert.strictEqual(words.score, digits.score, '"three weeks" must weigh the same as "3 weeks"');
  });

  test('weighs a legal threat above a request for a manager', () => {
    const legal   = ai.detectEmotion('', 'I am contacting my lawyer about this.', null);
    const manager = ai.detectEmotion('', 'Can I speak to a manager?', null);
    assert.ok(legal.score > manager.score, 'a chargeback threat is not the same as asking to escalate');
  });

  test('counts consecutive unanswered customer messages', () => {
    const history = 'Customer: hello\nCustomer: are you there\nCustomer: still waiting';
    const { signals } = ai.detectEmotion(history, 'any update?', null);
    assert.ok(signals.some(x => /unanswered/i.test(x)), 'a stack of unanswered messages is itself a signal');
  });

  test('leaves a routine question neutral', () => {
    assert.strictEqual(ai.detectEmotion('', 'Hi, when does my order ship?', null).level, 'neutral');
  });

  test('does not let one weak signal flip the label', () => {
    const { level } = ai.detectEmotion('', 'Its been 4 days, any news?', null);
    assert.strictEqual(level, 'neutral', 'a short wait politely asked about is not a grievance');
  });

  test('reads plain gratitude as positive', () => {
    assert.strictEqual(ai.detectEmotion('', 'Thank you so much, that is perfect!', null).level, 'very_positive');
  });

  test('does not read gratitude beside a grievance as positive', () => {
    const { level } = ai.detectEmotion('', "Thanks, but this is the second time I've asked.", null);
    assert.strictEqual(level, 'negative', 'politeness is not satisfaction');
  });

  test('tolerates empty input', () => {
    assert.strictEqual(ai.detectEmotion('', '', null).level, 'neutral');
    assert.strictEqual(ai.detectEmotion(null, null, null).level, 'neutral');
  });
});

// ── AI tells: detect, never rewrite ─────────────────────────────────────────
// The contract that replaced the old scrubber. detectAITells reports; the text
// it was given must come back byte-identical from normalizeTypography.

group('detectAITells', () => {
  test('reports a canned closer', () => {
    const tells = ai.detectAITells('Your order ships Tuesday. Let me know if there is anything else I can help with!');
    assert.ok(tells.some(t => /anything else/i.test(t.label)), 'the closer should be reported');
  });

  test('reports ownership theatre', () => {
    const tells = ai.detectAITells("I'm personally handling this for you.");
    assert.ok(tells.length > 0);
  });

  test('says nothing about a clean reply', () => {
    assert.deepStrictEqual(ai.detectAITells('Shipped Tuesday, tracking is in your email.'), []);
  });

  test('deduplicates a phrase repeated in one reply', () => {
    const tells = ai.detectAITells('Feel free to reach out. Really, reach out any time.');
    const labels = tells.map(t => t.label);
    assert.strictEqual(new Set(labels).size, labels.length, 'labels must be unique');
  });

  test('never mutates the text it inspects', () => {
    const original = 'Thanks for your patience, I am here to help. Kindly confirm your order number.';
    const copy = String(original);
    ai.detectAITells(original);
    assert.strictEqual(original, copy);
  });

  test('tolerates null and non-strings', () => {
    assert.deepStrictEqual(ai.detectAITells(null), []);
    assert.deepStrictEqual(ai.detectAITells(42), []);
  });
});

group('normalizeTypography', () => {
  test('converts em dashes to commas', () => {
    assert.strictEqual(ai.normalizeTypography('It shipped — Tuesday'), 'It shipped, Tuesday');
  });

  test('leaves a flagged phrase completely intact', () => {
    const text = 'Thank you for your patience. Your order ships Tuesday.';
    assert.strictEqual(ai.normalizeTypography(text), text);
  });

  test('preserves dosing numbers exactly', () => {
    const dosing = 'Reconstitute the 10mg vial with 2.5mL of BAC water for 4mg/mL.';
    assert.strictEqual(ai.normalizeTypography(dosing), dosing);
  });

  test('preserves newlines while collapsing space runs', () => {
    assert.strictEqual(ai.normalizeTypography('a  b\nc'), 'a b\nc');
  });
});

// ── Parsing ─────────────────────────────────────────────────────────────────

group('parseAIResponse', () => {
  test('parses a clean suggestions payload', () => {
    const parsed = ai.parseAIResponse('{"suggestions":["a","b","c"]}', 'suggestions');
    assert.deepStrictEqual(parsed.suggestions, ['a', 'b', 'c']);
  });

  test('parses a payload wrapped in prose', () => {
    const parsed = ai.parseAIResponse('Here you go:\n{"suggestions":["a"]}\nHope that helps', 'suggestions');
    assert.ok(parsed && Array.isArray(parsed.suggestions));
  });

  test('returns null on unparseable input rather than throwing', () => {
    assert.strictEqual(ai.parseAIResponse('not json at all', 'suggestions'), null);
  });
});

// ── Report ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
