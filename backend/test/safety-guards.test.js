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

// ── Tone register ───────────────────────────────────────────────────────────
// Casual is the default. Written as worked swaps rather than more banned words:
// the prompt already carries a long NEVER list, and piling on prohibitions makes
// replies careful and flat, which is the opposite of casual.

group('tone', () => {
  const voice = require('../lib/voice');
  const profile = voice.resolveVoiceProfile({});
  const build = (settings) => ai.buildSystemPrompt(
    'S', '', '', '', 'minimal', 'brief', '', settings, '', '',
    'neutral', [], false, false, false, profile,
  );

  test('defaults to casual', () => {
    assert.match(build({}), /Talk the way you would to someone you get on with/);
  });

  test('gives worked swaps, not just an adjective', () => {
    const t = build({});
    assert.match(t, /not "it has been dispatched"/);
    assert.match(t, /not "prior to placing your order"/);
  });

  test('casual does not license vagueness', () => {
    assert.match(build({}), /still give the specific date/i,
      'casual is about the words; the date, number and next step still have to be there');
  });

  test('casual does not license text-speak or all-lowercase', () => {
    assert.match(build({}), /never use text-speak/i);
  });

  test('formal is still selectable', () => {
    assert.match(build({ tone: 'formal' }), /No contractions/);
  });

  test('friendly-professional is still selectable', () => {
    assert.match(build({ tone: 'friendly-professional' }), /a little blunt/);
  });

  test('an unknown tone value falls back to casual rather than breaking', () => {
    assert.match(build({ tone: 'nonsense' }), /Talk the way you would/);
  });
});

// ── Dosing is declined, not answered ────────────────────────────────────────
// Policy reversal: telling a customer what dose to take is medical advice, and
// this is a store. The guards that block unauthorised numbers stay as defence in
// depth; these assert the model is told not to reach for a number at all.

group('dosing decline', () => {
  const voice = require('../lib/voice');
  const profile = voice.resolveVoiceProfile({});
  const build = (dosing) => ai.buildSystemPrompt(
    'S', '', '', '', 'minimal', 'brief', '', {}, '', '',
    'neutral', [], false, dosing, false, profile,
  );

  test('a dosing question gets the decline block', () => {
    const t = build(true);
    assert.match(t, /DECLINE/);
    assert.match(t, /not medical professionals/i);
  });

  test('the decline points at a healthcare provider', () => {
    assert.match(build(true), /healthcare provider/i);
  });

  test('the decline still offers help with everything else', () => {
    const t = build(true);
    assert.match(t, /order|shipping|tracking|returns/i,
      'a bare refusal leaves the customer stonewalled, which is not what was asked for');
  });

  test('forbids stating a dose even when the brain has one', () => {
    assert.match(build(true), /Never state a dose/i);
  });

  test('forbids caving to pressure', () => {
    assert.match(build(true), /Pressure is not authorisation/i);
  });

  test('reconstitution may be relayed but never calculated', () => {
    const t = build(true);
    assert.match(t, /RECONSTITUTION/);
    assert.match(t, /NEVER calculate it/i);
    assert.match(t, /quoted as written/i);
  });

  test('relaying reconstitution does not license stating a dose', () => {
    assert.match(build(true), /does NOT license stating a dose/i);
  });

  test('a non-dosing turn gets no decline block', () => {
    const t = build(false);
    assert.ok(!/DOSING \/ ADMINISTRATION — DECLINE/.test(t),
      'an order question must not be answered with a medical disclaimer');
  });

  test('the existing dose guards are untouched', () => {
    // Defence in depth: the prompt says do not, the guard enforces it.
    const out = ai.validateSafetyDosing(
      [{ text: 'Take 2.5mg weekly and you will be fine.' }],
      'what dose should I take?',
    );
    assert.ok(out, 'validateSafetyDosing must still run on dosing turns');
  });
});

// ── Greeting placement ──────────────────────────────────────────────────────
// The owner-fast voice comes from a doc about answering a NEW message, so it
// mandates "Hello!" on every reply and scrubVoice prepended one when missing.
// Correct on the first reply of a thread; on the ninth it is the clearest
// possible signal that nobody read the conversation.

group('greeting placement', () => {
  const voice = require('../lib/voice');
  const profile = voice.resolveVoiceProfile({});
  const draft = 'Nothing was charged, so theres nothing to cancel.';

  test('adds the greeting on the first reply of a thread', () => {
    assert.match(voice.scrubVoice(draft, profile, { isContinuation: false }), /^Hello/);
  });

  test('does NOT add a greeting mid-conversation', () => {
    const out = voice.scrubVoice(draft, profile, { isContinuation: true });
    assert.strictEqual(out, draft, 'a reply mid-thread must be left exactly as written');
  });

  test('defaults to first-reply behaviour when not told', () => {
    assert.match(voice.scrubVoice(draft, profile), /^Hello/,
      'omitting the flag must not silently suppress the greeting on turn one');
  });

  test('flags a missing greeting only on the first reply', () => {
    const first = voice.lintVoice(draft, profile, { isContinuation: false }).map(f => f.code);
    const mid   = voice.lintVoice(draft, profile, { isContinuation: true }).map(f => f.code);
    assert.ok(first.includes('opener'), 'turn one should still want a greeting');
    assert.ok(!mid.includes('opener'), 'flagging a missing greeting mid-thread is noise');
  });

  test('does not strip a greeting the model deliberately wrote first-turn', () => {
    const greeted = 'Hello! Nothing was charged.';
    assert.strictEqual(voice.scrubVoice(greeted, profile, { isContinuation: false }), greeted);
  });

  test('the prompt block tells the model not to greet', () => {
    assert.match(ai.CONTINUATION_BLOCK, /DO NOT GREET/i);
    assert.match(ai.CONTINUATION_BLOCK, /not the first reply/i);
  });
});

// ── Warmth gating ───────────────────────────────────────────────────────────
// Levity is a liability on a dosing question, a trust challenge, or with a
// customer who is already unhappy: a joke there reads as not taking them
// seriously. These lock the gate shut on every such turn.

group('warmth vs no-levity', () => {
  const voice = require('../lib/voice');
  const profile = voice.resolveVoiceProfile({});
  const build = (o = {}) => ai.buildSystemPrompt(
    'S', '', o.analysis ?? '', '', 'minimal', 'brief', '', {}, '', '',
    o.sentiment ?? 'neutral', [], o.trust ?? false, o.dosing ?? false, false, profile,
  );
  const isWarm = (t) => t.includes('WARMTH — this one is safe');
  const isCold = (t) => t.includes('NO LEVITY ON THIS ONE');

  test('allows warmth on a routine neutral turn', () => {
    assert.ok(isWarm(build()));
  });

  test('allows warmth with a happy customer', () => {
    assert.ok(isWarm(build({ sentiment: 'positive' })));
  });

  test('forbids levity on a dosing question', () => {
    const t = build({ dosing: true });
    assert.ok(isCold(t) && !isWarm(t), 'a joke on a dosing turn is a safety problem, not a tone one');
  });

  test('forbids levity on a trust challenge', () => {
    assert.ok(isCold(build({ trust: true })));
  });

  test('forbids levity with an unhappy customer', () => {
    assert.ok(isCold(build({ sentiment: 'negative' })));
  });

  test('forbids levity with an angry customer', () => {
    assert.ok(isCold(build({ sentiment: 'very_negative' })));
  });

  test('always emits exactly one of the two, never neither', () => {
    for (const o of [{}, { dosing: true }, { trust: true }, { sentiment: 'very_negative' }, { sentiment: 'very_positive' }]) {
      const t = build(o);
      assert.strictEqual(isWarm(t) !== isCold(t), true, `ambiguous warmth state for ${JSON.stringify(o)}`);
    }
  });
});

group('reply length rules', () => {
  const voice = require('../lib/voice');
  const profile = voice.resolveVoiceProfile({});

  test('the quick-pick rule asks for one or two sentences', () => {
    assert.match(profile.structureShort, /ONE OR TWO SENTENCES/);
  });

  test('dosing math is still exempt from the word limit', () => {
    assert.match(profile.structureShort, /RECONSTITUTION \/ DOSING MATH/i,
      'trimming a dose to hit a word count is worse than a long reply');
  });

  test('service failure is still exempt from the word limit', () => {
    assert.match(profile.structureShort, /SERVICE FAILURE/i);
  });

  test('a complete dosing reply is not flagged on length', () => {
    const dosing = 'Reconstitute the 10mg vial with 2.5mL of BAC water for 4mg/mL, which is 25 units on an insulin syringe.';
    const flags = voice.lintVoice(dosing, profile, { detailed: true });
    assert.ok(!flags.some(f => f.code === 'length'),
      'flagging a complete dose on length trains agents to cut numbers out of it');
  });
});

// ── Prompt cache prefix ─────────────────────────────────────────────────────
// The cache split is only safe while the prompt genuinely starts with this
// prefix. If buildSystemPrompt's return is ever reordered, these fail here
// rather than silently costing 1.25x per request in production.

group('stableSystemPrefix', () => {
  const build = (over = {}) => ai.buildSystemPrompt(
    over.store ?? 'TestStore', over.customer ?? '', over.analysis ?? '', over.policy ?? '',
    'minimal', 'brief', over.brain ?? '', {}, over.style ?? '', '',
    over.sentiment ?? 'neutral', [], false, false, false, null,
  );

  test('is a prefix of the built system prompt', () => {
    assert.ok(build().startsWith(ai.stableSystemPrefix(null)));
  });

  test('stays a prefix when turn-specific content is present', () => {
    const prompt = build({
      brain: 'Retatrutide ships in 10mg vials.',
      customer: 'Customer: Linda',
      analysis: 'SIGNALS:\n• angry',
      sentiment: 'very_negative',
    });
    assert.ok(prompt.startsWith(ai.stableSystemPrefix(null)),
      'turn-specific blocks must stay BEHIND the cached prefix');
  });

  test('is byte-identical across calls', () => {
    assert.strictEqual(ai.stableSystemPrefix(null), ai.stableSystemPrefix(null));
  });

  test('does not vary with the store name or the customer', () => {
    const a = build({ store: 'StoreA', customer: 'Customer: Linda' });
    const b = build({ store: 'StoreB', customer: 'Customer: Sam' });
    const prefix = ai.stableSystemPrefix(null);
    assert.ok(a.startsWith(prefix) && b.startsWith(prefix));
  });

  test('is large enough for the API to actually cache it', () => {
    assert.ok(ai.stableSystemPrefix(null).length >= 4000,
      'below roughly 1k tokens the prefix is silently not cached');
  });

  test('honours a voice profile override', () => {
    const profile = { voiceBlock: 'VOICE.', examplesBlock: 'EXAMPLES.' };
    assert.strictEqual(ai.stableSystemPrefix(profile), 'VOICE.EXAMPLES.');
  });
});

// ── Agent commitments ───────────────────────────────────────────────────────
// From a real thread: the agent answered "2-3 business days", and the model
// then suggested "4-7 business days" from the brain. Both defensible alone; a
// flat contradiction to the customer reading the thread.

group('extractAgentCommitments', () => {
  const THREAD = [
    'Customer: Hi there, I am looking for the store',
    'Agent: Hi Josh, we are fully online so no actual store',
    'Customer: Do you know how long shipping should take?',
    'Agent: Usually after payment processing, 2-3 business days',
  ].join('\n');

  test('finds a timeframe the agent already gave', () => {
    const found = ai.extractAgentCommitments(THREAD);
    assert.ok(found.some(c => /2-3 business days/i.test(c.value)),
      'the number the customer is holding us to must be surfaced');
  });

  test('ignores timeframes the CUSTOMER mentioned', () => {
    const thread = 'Customer: your site said 2-3 business days\nAgent: let me look into it';
    assert.deepStrictEqual(ai.extractAgentCommitments(thread), [],
      'only what WE promised counts as a commitment');
  });

  test('captures money and discounts', () => {
    const thread = 'Agent: I can do 20% off, and refund the $45 shipping';
    const values = ai.extractAgentCommitments(thread).map(c => c.value.toLowerCase());
    assert.ok(values.some(v => v.includes('20%')));
    assert.ok(values.some(v => v.includes('45')));
  });

  test('keeps the later value when the agent revised it', () => {
    const thread = 'Agent: about 2-3 business days\nCustomer: ok\nAgent: actually 4-7 business days';
    const found = ai.extractAgentCommitments(thread);
    assert.ok(found.some(c => /4-7/.test(c.value)), 'the revision must be present');
  });

  test('carries the sentence it came from, for the prompt to quote', () => {
    const [first] = ai.extractAgentCommitments(THREAD);
    assert.ok(first.said && first.said.length > 0);
  });

  test('returns nothing for a thread with no commitments', () => {
    assert.deepStrictEqual(ai.extractAgentCommitments('Agent: hello\nCustomer: hi'), []);
  });

  test('tolerates empty and null input', () => {
    assert.deepStrictEqual(ai.extractAgentCommitments(''), []);
    assert.deepStrictEqual(ai.extractAgentCommitments(null), []);
  });
});

// ── Anthropic request/response shape ────────────────────────────────────────
// Both of these are regressions that reached production. The premium tier
// stopped going through the DeepSeek shim, which exposed two assumptions that
// had been safe only because the shim sat in the middle.

group('stripNonAnthropicFields', () => {
  test('removes shim-only hints that Anthropic rejects outright', () => {
    const body = JSON.stringify({
      model: 'claude-opus-5', max_tokens: 100, system: 's', messages: [],
      deepseekTimeoutMs: 90000, deepseekModel: 'x', deepseekReasoningEffort: 'low',
    });
    const out = JSON.parse(ai.stripNonAnthropicFields(body));
    assert.ok(!Object.keys(out).some(k => /^deepseek/i.test(k)),
      'a deepseek* field reaching Anthropic 400s the whole request');
  });

  test('keeps every legitimate Anthropic field', () => {
    const body = JSON.stringify({
      model: 'claude-opus-5', max_tokens: 100, system: 's', messages: [{ role: 'user', content: 'x' }],
      output_config: { effort: 'medium' }, deepseekTimeoutMs: 1,
    });
    const out = JSON.parse(ai.stripNonAnthropicFields(body));
    assert.deepStrictEqual(
      Object.keys(out).sort(),
      ['max_tokens', 'messages', 'model', 'output_config', 'system'],
    );
  });

  test('leaves a clean body byte-identical', () => {
    const body = JSON.stringify({ model: 'claude-opus-5', max_tokens: 1, messages: [] });
    assert.strictEqual(ai.stripNonAnthropicFields(body), body);
  });

  test('passes an unparseable body through rather than swallowing it', () => {
    assert.strictEqual(ai.stripNonAnthropicFields('not json'), 'not json');
  });
});

group('extractText', () => {
  test('finds the reply when a thinking block comes first', () => {
    const data = { content: [
      { type: 'thinking', thinking: 'deliberating' },
      { type: 'text', text: '{"suggestions":["a"]}' },
    ] };
    assert.strictEqual(ai.extractText(data), '{"suggestions":["a"]}',
      'reading content[0].text here yields "" and silently serves templates');
  });

  test('still works when text is the only block', () => {
    assert.strictEqual(ai.extractText({ content: [{ type: 'text', text: 'hello' }] }), 'hello');
  });

  test('joins a reply split across several text blocks', () => {
    const data = { content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] };
    assert.strictEqual(ai.extractText(data), '{"a":1}');
  });

  test('returns empty string when there is no text block at all', () => {
    assert.strictEqual(ai.extractText({ content: [{ type: 'thinking', thinking: 'x' }] }), '');
  });

  test('tolerates missing, null and malformed responses', () => {
    assert.strictEqual(ai.extractText(null), '');
    assert.strictEqual(ai.extractText({}), '');
    assert.strictEqual(ai.extractText({ content: null }), '');
    assert.strictEqual(ai.extractText({ content: [null, { type: 'text', text: 'ok' }] }), 'ok');
  });

  test('accepts a plain string content', () => {
    assert.strictEqual(ai.extractText({ content: 'raw' }), 'raw');
  });
});

// ── Model tier routing ──────────────────────────────────────────────────────
// Routing must be conservative in one direction only: sending a routine turn to
// the expensive model wastes money, but sending an angry customer to the cheap
// one is the failure that gets noticed.

group('pickModelTier', () => {
  const routine = { sentiment: 'neutral', isTrustQuestion: false, isSafetyDosing: false,
                    isRefundOrComplaint: false, conversationState: {} };

  test('keeps a plain order-status turn on the cheap tier', () => {
    assert.strictEqual(pickTier(routine), 'routine');
  });

  test('escalates an angry customer', () => {
    assert.strictEqual(pickTier({ ...routine, sentiment: 'very_negative' }), 'premium');
  });

  test('escalates a merely negative customer too', () => {
    assert.strictEqual(pickTier({ ...routine, sentiment: 'negative' }), 'premium');
  });

  test('escalates anything touching dosing', () => {
    assert.strictEqual(pickTier({ ...routine, isSafetyDosing: true }), 'premium');
  });

  test('escalates a trust challenge', () => {
    assert.strictEqual(pickTier({ ...routine, isTrustQuestion: true }), 'premium');
  });

  test('escalates refunds and complaints', () => {
    assert.strictEqual(pickTier({ ...routine, isRefundOrComplaint: true }), 'premium');
  });

  test('escalates an explicitly escalating thread', () => {
    assert.strictEqual(pickTier({ ...routine, conversationState: { isEscalating: true } }), 'premium');
  });

  test('reports why it escalated', () => {
    const { reasons } = ai.pickModelTier({ ...routine, sentiment: 'very_negative', isSafetyDosing: true });
    assert.ok(reasons.length >= 2, 'every reason should be recorded, not just the first');
  });

  test('gives a positive customer the cheap tier', () => {
    assert.strictEqual(pickTier({ ...routine, sentiment: 'very_positive' }), 'routine');
  });

  test('survives a missing conversationState', () => {
    assert.strictEqual(pickTier({ ...routine, conversationState: null }), 'routine');
  });
});

function pickTier(args) { return ai.pickModelTier(args).tier; }

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
