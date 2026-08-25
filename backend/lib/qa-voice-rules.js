'use strict';

/**
 * QA VOICE RULE ENGINE
 * --------------------
 * Encodes "HOW WE TALK TO CUSTOMERS / INTERNAL" as executable checks.
 *
 * Everything here is pure + synchronous. No DB, no network. The AI voice
 * grader lives in routes/qa-routes.js and layers on top of this.
 *
 * Severity model:
 *   critical -> instant QA fail. Score is hard-capped at CRITICAL_CAP.
 *   major    -> -10 each
 *   minor    -> -4 each
 *   info     -> 0. NOT a violation. Returned separately as `advisories` so it
 *               never pollutes the violations feed or the rule-frequency chart.
 *
 * NOT CHECKED HERE, and not checkable by any regex: whether the facts in the
 * reply are true. "Only promise dates you can actually hit" and the prompt's
 * FACTS rule need the order, the carrier and the refund date, none of which
 * this engine can see. A clean 100 means the reply SOUNDS right, not that it
 * IS right. That check stays human.
 */

const CRITICAL = 'critical';
const MAJOR = 'major';
const MINOR = 'minor';
const INFO = 'info';

const PENALTY = { critical: 20, major: 10, minor: 4, info: 0 };
const CRITICAL_CAP = 55;

/** The owner reply that defines the standard. Used as the AI grader's anchor. */
const VOICE_REFERENCE =
  "Hello! Thank you for reaching out, usually we are MUCH faster than this but this week we had way too many orders to fulfill! Today we are catching up with all the orders so every single order we had will be shipped out and in the hands of UPS / Canada Post by tomorrow\n\n" +
  "There isn't much movement on the weekend since these shipping company dont work, but very early next week you will see the package moving and at your door step as well!";

/** Acronyms that are legitimately uppercase and must not count as "shouting". */
const CAPS_ALLOWLIST = new Set([
  'UPS', 'USPS', 'DHL', 'FEDEX', 'EMS', 'PO', 'ETA', 'ID', 'US', 'USA', 'CA',
  'UK', 'EU', 'AM', 'PM', 'EST', 'PST', 'CST', 'MST', 'UTC', 'OK', 'SKU',
  'COA', 'FYI', 'TBA', 'QA', 'AI', 'CS', 'DM', 'URL', 'PDF', 'GLS', 'DPD',
  'A', 'I',
]);

// ───────────────────────────────────────────────────────────────────────────
// PART THREE — banned phrases. If QA sees any of these, the reply goes back.
// ───────────────────────────────────────────────────────────────────────────

const BANNED_PHRASES = [
  {
    id: 'apologize_inconvenience',
    label: 'Apology-for-the-inconvenience opener',
    re: /\b(i\s+)?(apologi[sz]e|sorry)\s+for\s+(the|any|this)\s+inconvenience/i,
    severity: CRITICAL,
    why: 'Every AI on earth opens with this.',
    fix: 'Thank them, then go straight into the answer.',
  },
  {
    id: 'understand_frustration',
    label: '"I completely understand your frustration"',
    re: /\b(i\s+)?(completely\s+|totally\s+|fully\s+)?understand\s+(your|the)\s+(frustration|frustrations|disappointment|concern)/i,
    severity: CRITICAL,
    why: 'Nobody talks like this.',
    fix: 'Try "I hear you and you have every right to be annoyed".',
  },
  {
    id: 'rest_assured',
    label: '"Rest assured" / "Please be assured"',
    re: /\b(rest\s+assured|please\s+be\s+assured|be\s+assured\s+that)\b/i,
    severity: CRITICAL,
    why: 'Corporate robot.',
    fix: 'State the actual date and action instead.',
  },
  {
    id: 'appreciate_patience',
    label: '"We appreciate your patience"',
    re: /\b(we\s+)?(appreciate|thank\s+you\s+for)\s+your\s+patience\b/i,
    severity: CRITICAL,
    why: 'Filler, says nothing.',
    fix: 'Delete it. Give the date instead.',
  },
  {
    id: 'do_not_hesitate',
    label: '"Please do not hesitate to reach out"',
    re: /\b(do\s+not|don'?t)\s+hesitate\b/i,
    severity: CRITICAL,
    why: 'Nobody has said this out loud, ever.',
    fix: 'Use "just reply here".',
  },
  {
    id: 'happy_to_assist',
    label: '"I\'d be happy to assist you with that"',
    re: /\b(i'?d|i\s+would|we'?d|we\s+would)\s+be\s+(happy|glad|more\s+than\s+happy)\s+to\s+(assist|help)/i,
    severity: CRITICAL,
    why: 'Assistant voice.',
    fix: 'Just do the thing: "I will get a new one sent out".',
  },
  {
    id: 'bringing_to_attention',
    label: '"Thank you for bringing this to our attention"',
    re: /\bbringing\s+(this|it|that)\s+to\s+(our|my|the\s+team'?s)\s+attention\b/i,
    severity: CRITICAL,
    why: 'Assistant voice.',
    fix: '"Thank you for reaching out" and move on.',
  },
  {
    id: 'value_you',
    label: '"We value you as a customer"',
    re: /\bwe\s+(value|truly\s+value|really\s+value)\s+(you|your\s+business)\b/i,
    severity: CRITICAL,
    why: 'Reads as insincere.',
    fix: 'Cut it.',
  },
  {
    id: 'kindly',
    label: '"Kindly"',
    re: /\bkindly\b/i,
    severity: CRITICAL,
    why: 'Instant offshore-template flag.',
    fix: 'Use "just" or nothing at all.',
  },
  {
    id: 'unfortunately_at_this_time',
    label: '"Unfortunately, at this time"',
    re: /\bunfortunately,?\s+(at\s+this\s+time|we\s+are\s+unable|we'?re\s+unable)\b/i,
    severity: CRITICAL,
    why: 'Bad news padding.',
    fix: 'Say the thing plainly, then say what happens next.',
  },
  {
    id: 'essay_words',
    label: 'Essay words (additionally / furthermore / moreover)',
    re: /\b(additionally|furthermore|moreover|in\s+addition,)\b/i,
    severity: CRITICAL,
    why: 'Essay words.',
    fix: 'Chain the thought with "and" or "so" instead.',
  },
  {
    id: 'hope_this_helps',
    label: '"I hope this helps!"',
    re: /\b(i\s+)?hope\s+(this|that)\s+helps\b/i,
    severity: CRITICAL,
    why: 'Assistant sign-off.',
    fix: 'End on the outcome the customer wants.',
  },
  {
    id: 'signoff_regards',
    label: 'Sign-off ("Best regards", "Sincerely", "Support Team")',
    re: /\b(best\s+regards|kind\s+regards|warm\s+regards|regards,|sincerely,|yours\s+truly|customer\s+(support|service)\s+team\b|the\s+support\s+team\b)/i,
    severity: CRITICAL,
    why: 'We do not sign our messages.',
    fix: 'Just stop after the last sentence.',
  },
  {
    // Not in the Part Three table, but named in point 10 of Part One and in the
    // AI prompt's NEVER list. The table should gain a row for it.
    id: 'any_other_questions',
    label: '"Let me know if you have any other questions"',
    re: /\b(let\s+me\s+know|feel\s+free\s+to\s+ask|reach\s+out)\s+(if|should)\s+you\s+(have|need)\s+(any\s+)?(other\s+|further\s+|more\s+)?questions?\b/i,
    severity: CRITICAL,
    why: 'Assistant sign-off.',
    fix: 'End on the box arriving or the money landing.',
  },
  {
    id: 'em_dash',
    label: 'Em dash / en dash',
    re: /[\u2014\u2013]/,
    severity: CRITICAL,
    why: 'Dead giveaway that a model wrote it.',
    fix: 'Use a comma or start a new sentence.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Soft signals
// ───────────────────────────────────────────────────────────────────────────

const VAGUE_TIME = /\b(as\s+soon\s+as\s+possible|asap|shortly|in\s+due\s+course|in\s+a\s+timely\s+manner|at\s+your\s+earliest\s+convenience|we\s+are\s+working\s+on\s+it|we'?re\s+working\s+on\s+it|soon\s+as\s+we\s+can)\b/i;

/**
 * NOTE: a [bracket] placeholder is deliberately NOT a date signal. Part Four is
 * explicit that brackets are filled in before sending, and the AI prompt uses
 * them precisely for facts we do not have yet — so a draft carrying [date] has
 * no date in it and should still fail the date rule on top of the critical for
 * shipping with the bracket intact.
 */
const DATE_SIGNALS = [
  /\b(today|tomorrow|tonight|overnight|this\s+(morning|afternoon|evening|week|weekend)|next\s+(week|monday|tuesday|wednesday|thursday|friday|day))\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i,
  /\b\d{1,2}\s*[-\/]\s*\d{1,2}(\s*[-\/]\s*\d{2,4})?\b/,
  /\b\d+\s*(-|to|or)?\s*\d*\s*(business\s+)?(day|days|hour|hours|week|weeks)\b/i,
  /\b(same\s+day|next\s+(day|morning|business\s+day)|within\s+the\s+(next\s+)?(day|hour|week)|by\s+the\s+end\s+of\s+(the\s+)?(day|week))\b/i,
];

/**
 * Contractions typed without the apostrophe.
 *
 * `its` IS included, despite colliding with the legitimate possessive. The
 * house guide names it directly — "Drop some apostrophes on purpose: dont,
 * cant, its, thats, isnt" — and several Part Four templates carry `its` as
 * their ONLY dropped apostrophe ("its just sitting in the queue at the carrier
 * depot", "its [2-3] days to you from there"). Excluding it made the store's
 * own reference replies fail the texture check, which is a worse error than
 * occasionally crediting a correctly-spelled possessive.
 *
 * Excluded on purpose: "were" (past tense), "ill" (unwell), "lets" (permits).
 * None appear in the guide's list and all three are ordinary English words.
 */
const APOSTROPHE_DROPS = /\b(dont|cant|wont|isnt|arent|didnt|doesnt|hasnt|havent|thats|its|youre|theyre|im|ive|couldnt|wouldnt|shouldnt|hadnt|theres|whats)\b/gi;

const COMMA_SPLICE = /,\s*(its?|i|we|you|they|he|she|this|that|there|then|and|but|so|since|which|usually|nothing|sometimes|the)\b/i;
const MID_CHAIN = /\s(but|so|since|and)\s+(this|that|we|i|it|its|they|the|there|then|you|he|she)\b/i;

/** A person typing fast writes long sentences and splices clauses with commas. */
function readsAsRunOn(text) {
  if (COMMA_SPLICE.test(text) || MID_CHAIN.test(text)) return true;
  const sentences = String(text).split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  return sentences.some(s => s.split(/\s+/).length >= 25);
}

const REPEAT_BACK = /\b(you\s+(mentioned|said|stated|indicated|wrote)|as\s+(you|per\s+your)\s+(mentioned|said|email|message)|i\s+understand\s+that\s+you)\b/i;

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function countWords(text) {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

function splitParagraphs(text) {
  return String(text || '')
    .trim()
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(Boolean);
}

function shoutingWords(text) {
  const matches = String(text || '').match(/\b[A-Z]{2,}\b/g) || [];
  return matches.filter(w => !CAPS_ALLOWLIST.has(w));
}

function hasDateSignal(text) {
  return DATE_SIGNALS.some(re => re.test(text));
}

function emptyReport() {
  return {
    score: 0, grade: 'F', wordCount: 0, paragraphCount: 0, exclamations: 0,
    capsWords: [], questionCount: 0, apostropheDrops: 0,
    criticalCount: 1, majorCount: 0, minorCount: 0,
    violations: [{ id: 'empty', label: 'Empty reply', severity: CRITICAL, detail: 'Nothing to review.', fix: null }],
    advisories: [],
    passes: [],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Main evaluator
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {string} rawText  the agent's reply exactly as sent
 * @returns {object} full rule report
 */
function evaluateReply(rawText) {
  const text = String(rawText == null ? '' : rawText);
  const trimmed = text.trim();

  // ── Empty / non-reply guard ───────────────────────────────────────────
  // Checked first so we do not run every rule over a blank string and then
  // throw the result away.
  if (!trimmed) return emptyReport();

  const violations = [];
  const advisories = [];
  const passes = [];

  const add = (id, label, severity, detail, fix) => {
    const entry = { id, label, severity, detail: detail || null, fix: fix || null };
    // INFO scores zero and is reviewer-only. Keeping it out of `violations`
    // stops it tagging review cards and topping the "most broken rules" chart.
    (severity === INFO ? advisories : violations).push(entry);
  };
  const ok = (id, label) => passes.push({ id, label });

  // ── Banned phrases ────────────────────────────────────────────────────
  for (const rule of BANNED_PHRASES) {
    const m = trimmed.match(rule.re);
    if (m) add(rule.id, rule.label, rule.severity, `Found: "${String(m[0]).trim()}" — ${rule.why}`, rule.fix);
  }
  if (!violations.length) ok('no_banned_phrases', 'No banned phrases');

  // ── Formatting that no human types in a support email ─────────────────
  if (/(^|\n)\s*([-*•]|\d+[.)])\s+/.test(trimmed)) {
    add('list_formatting', 'Bullet points or numbered list', CRITICAL,
      'Nobody types a list in a support reply.', 'Write it as two flowing paragraphs.');
  } else ok('no_lists', 'No bullets or numbered lists');

  if (/\*\*[^*]+\*\*|<b>|<strong>|__[^_]+__/i.test(trimmed)) {
    add('bold_text', 'Bold / markdown formatting', CRITICAL,
      'Nobody types bold in a support email.', 'Remove the formatting.');
  } else ok('no_bold', 'No bold text');

  // ── PART TWO: hard rules ──────────────────────────────────────────────
  const wordCount = countWords(trimmed);
  if (wordCount < 35) {
    add('word_count_low', 'Well under 40 words', MAJOR,
      `${wordCount} words. Too thin to carry a why and a date.`, 'Add the one-sentence why.');
  } else if (wordCount < 40) {
    add('word_count_low', 'Slightly under 40 words', MINOR,
      `${wordCount} words.`, 'A touch more detail.');
  } else if (wordCount > 100) {
    add('word_count_high', 'Well over 90 words', MAJOR,
      `${wordCount} words. Anything longer reads like a policy document.`, 'Cut to 40-90 words.');
  } else if (wordCount > 90) {
    add('word_count_high', 'Slightly over 90 words', MINOR,
      `${wordCount} words.`, 'Trim a sentence.');
  } else ok('word_count', `Length is right (${wordCount} words)`);

  const paragraphs = splitParagraphs(trimmed);
  if (paragraphs.length !== 2) {
    add('paragraph_count', 'Not exactly two paragraphs', MAJOR,
      `Found ${paragraphs.length}. The format is two short paragraphs with a blank line between them.`,
      'Split into exactly two, blank line between.');
  } else {
    ok('paragraph_count', 'Two paragraphs');
    // Advisory, not a violation. Part Two states it as a hard rule, but five of
    // the fourteen Part Four templates invert it — a short opener followed by
    // the longer detail paragraph is a real, working shape.
    if (countWords(paragraphs[0]) <= countWords(paragraphs[1])) {
      add('paragraph_balance', 'First paragraph is not the longer one', INFO,
        `${countWords(paragraphs[0])} words then ${countWords(paragraphs[1])}.`,
        'Front-load the detail, land short.');
    } else ok('paragraph_balance', 'First paragraph is longer');
  }

  const exclamations = (trimmed.match(/!/g) || []).length;
  if (exclamations === 0) {
    add('no_exclamation', 'No exclamation points', MINOR,
      'The voice runs warm. One near the start, one at the end.', 'Add one or two.');
  } else if (exclamations > 3) {
    add('too_many_exclamations', 'More than 3 exclamation points', MAJOR,
      `${exclamations} found.`, 'Keep it to 2, 3 absolute maximum.');
  } else ok('exclamations', `${exclamations} exclamation point${exclamations === 1 ? '' : 's'}`);

  const caps = shoutingWords(trimmed);
  const uniqueCaps = [...new Set(caps)];
  if (uniqueCaps.length > 1) {
    add('too_many_caps', 'More than one ALL CAPS word', MAJOR,
      `${uniqueCaps.join(', ')}. Two or three caps words reads like a scam email.`,
      'Keep exactly one, or zero.');
  } else ok('caps', uniqueCaps.length ? `One caps word (${uniqueCaps[0]})` : 'No shouting');

  // ── Opener ────────────────────────────────────────────────────────────
  if (!/^hello!/i.test(trimmed)) {
    add('opener', 'Does not open with "Hello!"', MAJOR,
      `Opens with: "${trimmed.slice(0, 40)}"`, 'Open with "Hello!" then thank them in the same breath.');
  } else ok('opener', 'Opens with "Hello!"');

  const firstLine = paragraphs[0] || trimmed;
  if (!/thank\s+you\s+for\s+reaching\s+out|thanks\s+for\s+reaching\s+out|i\s+hear\s+you/i.test(firstLine)) {
    add('no_thanks', 'No thanks in the opening breath', MINOR,
      'The standard is "Hello! Thank you for reaching out," straight into the answer.',
      'Add it, or use "I hear you" for an angry customer.');
  } else ok('thanks', 'Thanks them up front');

  // ── Dates and vagueness ───────────────────────────────────────────────
  const vague = trimmed.match(VAGUE_TIME);
  if (vague) {
    add('vague_timing', 'Vague timing instead of a real date', CRITICAL,
      `Found: "${vague[0]}"`, 'Give a real day: "by tomorrow", "very early next week".');
  } else ok('no_vague_timing', 'No vague timing language');

  if (!hasDateSignal(trimmed)) {
    add('no_date', 'No specific date or day', MAJOR,
      'A real date, every single time.',
      'Name a real day: "by tomorrow", "very early next week". Look it up before sending, do not leave a bracket.');
  } else ok('date', 'Gives a specific date or day');

  const placeholders = trimmed.match(/\[[^\]]+\]/g) || [];
  if (placeholders.length) {
    add('unfilled_placeholder', 'Unfilled bracket placeholder was sent', CRITICAL,
      `Sent to the customer with: ${placeholders.join(', ')}`,
      'Brackets are for drafting only. Look up the real detail before sending, never guess.');
  }

  // ── Texture ───────────────────────────────────────────────────────────
  if (!readsAsRunOn(trimmed)) {
    add('too_clean', 'Sentences are too clean and balanced', MAJOR,
      'This is the single biggest tell. A real person types one long thought and hits enter.',
      'Chain the thought with "but", "so", "since", "and".');
  } else ok('runon', 'Sentences chain like a person typing fast');

  const drops = (trimmed.match(APOSTROPHE_DROPS) || []).length;
  if (drops === 0) {
    add('too_perfect', 'Every apostrophe is perfect', MINOR,
      'AI has never once forgotten an apostrophe in its life.',
      'Drop a few on purpose: dont, cant, its, thats, isnt.');
  } else ok('typos', `Natural texture (${drops} dropped apostrophe${drops === 1 ? '' : 's'})`);

  if (REPEAT_BACK.test(trimmed)) {
    add('repeats_problem', 'Repeats their problem back to them', MINOR,
      'They know what they wrote.', 'Cut straight to what happens next.');
  } else ok('no_repeat', 'Does not repeat their problem back');

  const questions = (trimmed.match(/\?/g) || []).length;
  if (questions > 1) {
    add('too_many_questions', 'Asks more than one question', MINOR,
      `${questions} questions. Never ask a question you do not need the answer to.`,
      'Give an instruction instead.');
  } else ok('questions', questions ? 'One question' : 'No unnecessary questions');

  if (/\n\s*(thanks|thank you|cheers|best|warmly)[,!]?\s*\n\s*\w+\s*$/i.test(text)) {
    add('name_signoff', 'Signed off with a name', CRITICAL,
      'We do not sign our messages.', 'Delete the sign-off.');
  }

  // ── Score ─────────────────────────────────────────────────────────────
  const criticalCount = violations.filter(v => v.severity === CRITICAL).length;
  const majorCount = violations.filter(v => v.severity === MAJOR).length;
  const minorCount = violations.filter(v => v.severity === MINOR).length;

  let score = 100
    - criticalCount * PENALTY.critical
    - majorCount * PENALTY.major
    - minorCount * PENALTY.minor;

  if (criticalCount > 0) score = Math.min(score, CRITICAL_CAP);
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: gradeFor(score),
    wordCount,
    paragraphCount: paragraphs.length,
    exclamations,
    capsWords: uniqueCaps,
    questionCount: questions,
    apostropheDrops: drops,
    criticalCount,
    majorCount,
    minorCount,
    violations,
    advisories,
    passes,
  };
}

function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Flat catalogue for the UI's "Rules" tab. */
const RULE_CATALOG = [
  ...BANNED_PHRASES.map(r => ({
    id: r.id, label: r.label, severity: r.severity, group: 'Banned phrases', why: r.why, fix: r.fix,
  })),
  { id: 'list_formatting', label: 'No bullets or numbered lists', severity: CRITICAL, group: 'Formatting', why: 'Nobody types a list in a support email.' },
  { id: 'bold_text', label: 'No bold text', severity: CRITICAL, group: 'Formatting', why: 'Nobody types bold in a support email.' },
  { id: 'word_count', label: '40 to 90 words', severity: MAJOR, group: 'Structure', why: 'Longer reads like a policy document.' },
  { id: 'paragraph_count', label: 'Exactly two paragraphs', severity: MAJOR, group: 'Structure', why: 'Blank line between them.' },
  { id: 'paragraph_balance', label: 'First paragraph usually longer', severity: INFO, group: 'Structure', why: 'Advisory only. Several house templates invert it and still work.' },
  { id: 'exclamations', label: 'Max 3 exclamation points, usually 2', severity: MAJOR, group: 'Structure' },
  { id: 'caps', label: 'Exactly one ALL CAPS word, or zero', severity: MAJOR, group: 'Structure' },
  { id: 'opener', label: 'Opens with "Hello!" then thanks', severity: MAJOR, group: 'Voice' },
  { id: 'runon', label: 'Run-on sentences chained with but / so / since', severity: MAJOR, group: 'Voice', why: 'The single biggest human tell.' },
  { id: 'typos', label: 'Some apostrophes dropped on purpose', severity: MINOR, group: 'Voice', why: 'dont, cant, its, thats, isnt.' },
  { id: 'vague_timing', label: 'Never "shortly" or "as soon as possible"', severity: CRITICAL, group: 'Substance' },
  { id: 'no_date', label: 'A real date, every single time', severity: MAJOR, group: 'Substance' },
  { id: 'unfilled_placeholder', label: 'No [brackets] left in a sent reply', severity: CRITICAL, group: 'Substance', why: 'Brackets never satisfy the date rule. Fill it in before sending, never guess.' },
  { id: 'repeats_problem', label: 'Never repeat their problem back', severity: MINOR, group: 'Voice' },
  { id: 'too_many_questions', label: 'Never ask a question you do not need answered', severity: MINOR, group: 'Voice' },
  { id: 'name_signoff', label: 'Never sign off with a name', severity: CRITICAL, group: 'Voice' },
  { id: 'facts_unchecked', label: 'Every fact true and checkable in our system', severity: INFO, group: 'Not automated', why: 'The engine cannot see the order, the carrier or the refund date. Only promise dates you can actually hit — this one is on the agent.' },
  { id: 'we_i_unchecked', label: '"We" for the company, "I" for a personal action', severity: INFO, group: 'Not automated', why: 'Both legitimately appear in the same reply, so no rule fires on it.' },
];

module.exports = {
  evaluateReply,
  gradeFor,
  countWords,
  splitParagraphs,
  readsAsRunOn,
  RULE_CATALOG,
  BANNED_PHRASES,
  VOICE_REFERENCE,
  SEVERITY: { CRITICAL, MAJOR, MINOR, INFO },
  PENALTY,
  CRITICAL_CAP,
};