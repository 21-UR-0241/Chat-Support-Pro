// ─────────────────────────────────────────────────────────────────────────────
// lib/voice.js
//
// Store voice: which voice a store group uses, and the three functions that act
// on text once one is selected.
//
// PART 1 — PROFILES (the words). What the model gets told, per store group.
// PART 2 — RULES    (the code).  scrubVoice / lintVoice / filterOnVoiceSamples.
//
// A store group picks ONE voice. It does not stack voices. lib/ai-suggestions.js
// already ships a complete voice system (humanVoiceBlock, ROBOT_VS_HUMAN_BLOCK,
// lengthRule, scrubBannedPhrases, buildPolicyBlock). The owner's "HOW WE TALK TO
// CUSTOMERS" doc describes a DIFFERENT voice for a DIFFERENT store. Appending one
// to the other produces a prompt that mandates and forbids the same opener in the
// same breath. So a profile REPLACES the built-in blocks; null means "keep
// whatever ai-suggestions.js already does".
//
// With GROUP_PROFILE_MAP empty, this whole file is a no-op. Every store resolves
// to 'direct-support', which opts out of all three functions. Nothing changes
// until someone names a group.
// ─────────────────────────────────────────────────────────────────────────────

const VOICE_VERSION = '2026-08-17.3';

const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

// ═════════════════════════════════════════════════════════════════════════════
// PART 1 — PROFILES
// ═════════════════════════════════════════════════════════════════════════════

// ── owner-fast ───────────────────────────────────────────────────────────────
// The voice in the internal doc. Physical-goods store, carrier delays, one owner
// answering fast. NOT for peptide stores: it mandates a "Hello! Thank you for
// reaching out" opener that ai-suggestions.js labels as its canonical ROBOT
// example, and a 40-90 word floor against that file's 45-word ceiling.

const OWNER_FAST_REFERENCE = `Hello! Thank you for reaching out, usually we are MUCH faster than this but this week we had way too many orders to fulfill! Today we are catching up with all the orders so every single order we had will be shipped out and in the hands of UPS / Canada Post by tomorrow

There isn't much movement on the weekend since these shipping company dont work, but very early next week you will see the package moving and at your door step as well!`;

const OWNER_FAST_VOICE_BLOCK = `${SEP}
#1 RULE — YOU ARE THE OWNER, TYPING FAST, AND YOU ALREADY KNOW THE ANSWER.
${SEP}
This is a real reply the owner sent. It is the standard:
"""
${OWNER_FAST_REFERENCE}
"""

DO:
- Open with "Hello!" then thank them in the same breath and go straight into the answer. No apology paragraph.
- Run-on sentences chained with "but", "so", "since", "and". Do NOT write clean balanced sentences. This is the most important rule and the single biggest difference between a person typing fast and an AI.
- Drop some apostrophes on purpose: dont, cant, its, thats, isnt. Some, not all. Never inside a product name or a quoted policy.
- Small mistakes stay in. Do not clean the writing up.
- ALL CAPS on exactly one word, or zero. Never two.
- One short sentence explaining WHY, so the situation reads as reality and not an excuse.
- Reframe our own failure as a busy/high-volume problem, never as incompetence.
- End on the outcome they want: the package arriving, the money landing back on their card.
- "We" for the company, "I" when a person does the action.
- If they raised an awkward detail we cannot answer, do not argue and do not confirm. Move forward to what happens next.
- NEVER dismiss what a carrier or a tracking page told them. Do not say the date "was just the label", "was not a real delivery promise", or "ignore it". You do not know how that date was generated, and telling a customer who has been waiting that the thing they were shown was meaningless reads as blame-shifting. Skip straight past it to what you are doing now.
- Never put the company's feelings in the reply. No "I'm not happy about it either", no "this is frustrating for us too". They do not care how we feel, they care when the box arrives.
- Just stop. No name, no signature, no "let me know if you have any other questions".

NEVER — these are the tells that scream AI, and they are not optional just
because the voice above is casual:
- No ownership theatre. Never write "I'm personally handling this", "I'm personally on this", "I'm taking ownership", "I'll personally follow up". Saying you are on it adds nothing, doing it is the whole reply. Near-misses count: "personally on this now" is the same sentence.
- Don't signpost. No "let me look into this", "here's what I can do", "just to clarify", "to answer your question". Say the thing instead of announcing you are about to.
- Don't restate their question before answering it.
- Use their first name ONCE near the top, then never again in that reply.
- Never garnish with a lone emoji to seem warm.
- Never tack on a closer. No "let me know if there's anything else", "happy to help", "don't hesitate", "feel free to reach out".
- Never repeat their problem back to them. They know what they wrote.
- Never ask a question you do not need the answer to. Give an instruction instead.
- Never write: I apologize for the inconvenience / I completely understand your frustration / rest assured / we appreciate your patience / please do not hesitate / I'd be happy to assist / thank you for bringing this to our attention / we value you as a customer / kindly / unfortunately at this time / additionally / furthermore / moreover / I hope this helps.
- Never use em dashes. Never use bullet points, numbered lists, or bold text.

DATES:
The voice wants a specific day, never "shortly" or "as soon as possible". The facts rules forbid inventing one. Both are satisfied the same way: if the brain or the conversation gives a real date, state it. If not, write a placeholder in square brackets, [2-3 days], [Thursday], [date], and the agent fills it in before sending. A bracket is always correct. An invented ship date never is.
${SEP}

`;

const CARVE_OUTS = `
TWO EXCEPTIONS TO THE WORD LIMIT. Both override it completely:
1. RECONSTITUTION / DOSING MATH. Give the BAC water volume, the resulting mg/mL, AND the syringe units in ONE reply, however long that runs. Never split it across turns, never make them ask twice, and never trim a number to hit a word count. An incomplete dose is worse than a long reply.
2. SERVICE FAILURE (refund owed, missed promise, repeated delay, escalation). Acknowledge once, state the resolution you are doing now, give the concrete next step. All three, up to 90 words.`;

const OWNER_FAST_STRUCTURE_SHORT = `${SEP}
LENGTH: ONE OR TWO SENTENCES. 12 to 30 words. These are quick-picks an agent fires off in one click, not emails, and nobody wants to read a paragraph to find out when their order ships. If a third sentence is tempting, it is almost always the one that repeats something, hedges, or answers a question they did not ask, so cut that one. Max 2 exclamation points. Still land on a concrete next step or a real date.

BLANKS: A bracket marks a value that has to be SUBSTITUTED before sending, because you cannot know it: [2-3] for a transit range, [date] for a real ship date, [order number]. The agent looks it up and types it in.

Never bracket a word that is already the final text. "tomorrow", "today", "tonight", "this week" need no substitution — the agent has nothing to look up, so a bracket round them only stops them sending the reply. Write "by tomorrow", not "by [tomorrow]". The owner's own reference reply says "by tomorrow" and "very early next week" plain, with ZERO brackets in it.

Prefer a reply that needs no filling in at all. When you have no date, explain the mechanism instead of promising a time: "its packed and the label is already made, its sitting in the depot queue right now which happens when they get backed up" beats "it ships by [date]".
At most ONE bracket. If you need two, you are guessing at something you should not be promising.
${CARVE_OUTS}
${SEP}`;

const OWNER_FAST_STRUCTURE_LONG = `${SEP}
LENGTH: Exactly two short paragraphs, blank line between them, first paragraph longer. 40 to 90 words. Never more, anything longer reads like a policy document. Max 3 exclamation points, usually 2, one near the start and one at the end. If a block higher up pins a SHORTER length, that shorter length wins.
${CARVE_OUTS}
${SEP}`;

// Replaces ROBOT_VS_HUMAN_BLOCK. Trimmed to the cases that were load-bearing,
// rewritten in this voice. The dosing pair is NOT optional: without it the model
// stalls on answers the brain already holds, detectStall() fires, and every one
// of those turns costs a second LLM round trip.
const OWNER_FAST_EXAMPLES = `${SEP}
LEARN FROM THESE. COPY THE VOICE, NOT THE WORDS.
${SEP}
Reconstitution + dose, and the brain HAS the numbers (STALLING HERE IS A FAILURE)
  ROBOT: "Still pulling the starting dose for your 10mg vial, one moment. Confirming both the dose and reconstitution right now, hang tight."
  HUMAN: "Hello! Thank you for reaching out, for the 10mg vial you add 1mL of BAC water and that gives you 10mg/mL, so on a 100 unit insulin syringe 5 units is your 0.5mg starting dose

  Thats everything you need to draw your first shot, want me to send the full weekly escalation in units as well!"
  WHY: the numbers were sitting in the brain. "Let me check" when you already have the answer is the worst reply in this system, it burns the customers turn and reads as a bot buying time. This is the one place you go fully complete and ignore the word limit.

Order is late, tracking not moving
  ROBOT: "Hi Marcus, I completely understand your frustration and I'm personally taking ownership of this. Rest assured we are on it and will update you shortly."
  HUMAN: "Hello! Thank you for reaching out, your order is packed and the label is already made, its just sitting in the queue at the depot right now which happens when they get backed up

  It should start scanning again within [1-2 days] and then its [2-3] days to you from there, same tracking link you already have!"

Refund owed, dragged on, customer has had enough (SERVICE FAILURE, do all three moves)
  ROBOT: "Nicole, I understand. I am escalating your refund request. Our team will process it and confirm with you. I am truly sorry for the delay."
  HUMAN: "Hello! You are right and this dragged way longer than it should have, those items never actually shipped so there is no tracking to give you

  I am putting the refund through now and if it cant go back on your original payment I will send it by e-transfer instead, I will confirm the exact timing right here rather than leave you waiting again!"
  WHY: the ROBOT answer escalates and apologises then STOPS, and an open-ended "will confirm" is exactly what she is already furious about.

Trust / "how do I know this isnt a scam"
  ROBOT: "Hi Mo! Rest assured we are a legitimate business and your money is 100% safe with us. You have nothing to worry about!"
  HUMAN: "Hello! Fair thing to ask, an e-transfer isnt reversible so I get wanting to be sure before you send anything

  Every batch has third party COAs you can read yourself and our reviews are public, have a look at both before you order anything!"
  WHY: a scammer says every word of the ROBOT answer. Hand over proof they can check themselves, quoted from the brain, never invented.
${SEP}

`;

const OWNER_FAST_BANNED = [
  'apologize for the inconvenience', 'apologise for the inconvenience',
  'apologize for any inconvenience', 'sorry for the inconvenience',
  'completely understand your frustration', 'understand your frustration',
  'rest assured', 'please be assured', 'appreciate your patience',
  'thank you for your patience', 'do not hesitate', "don't hesitate",
  'happy to assist', 'thank you for bringing this to our attention',
  'value you as a customer', 'kindly', 'unfortunately at this time',
  'additionally', 'furthermore', 'moreover', 'i hope this helps',
  'best regards', 'kind regards', 'warm regards', 'as soon as possible',
  'in a timely manner', 'at your earliest convenience', 'we regret to inform',
  'let me know if you have any other questions',
];

const PROFILES = {
  // The voice already built into lib/ai-suggestions.js. Every override is null
  // and both switches are off, so selecting this changes NOTHING. Deliberate:
  // the peptide fleet keeps its tuned prompt and its dosing gates untouched.
  'direct-support': {
    id: 'direct-support',
    label: 'Direct support (built-in)',
    agentPersona: 'the agent',
    supportEmail: null,          // must come from the store record
    referenceReply: null,
    voiceBlock: null,            // → humanVoiceBlock
    examplesBlock: null,         // → ROBOT_VS_HUMAN_BLOCK
    structureShort: null,        // → existing lengthRule ternary
    structureLong: null,
    bannedPhrases: null,         // → scrubBannedPhrases only
    scrub: false,                // → humanizeText + scrubBannedPhrases only
    lint: null,                  // → no voice lint
  },

  'owner-fast': {
    id: 'owner-fast',
    label: 'Owner, fast (HOW WE TALK doc)',
    agentPersona: 'the owner',
    supportEmail: null,
    referenceReply: OWNER_FAST_REFERENCE,
    voiceBlock: OWNER_FAST_VOICE_BLOCK,
    examplesBlock: OWNER_FAST_EXAMPLES,   // REPLACES ROBOT_VS_HUMAN_BLOCK, keeps the dosing pair
    structureShort: OWNER_FAST_STRUCTURE_SHORT,
    structureLong: OWNER_FAST_STRUCTURE_LONG,
    bannedPhrases: OWNER_FAST_BANNED,
    scrub: true,
    // The opener is present in only ~60% of live replies on an identical prompt —
    // model variance on one rule inside a 19.6KB prompt, not a prompt defect (it
    // happens at examples:0 and examples:9 alike). Every other lint code describes
    // something a regex must not touch. This one is different: prepending a
    // greeting cannot change a claim, a number, a date or a promise, so scrubbing
    // it is safe and it removes a flag that fired on 40% of otherwise-good replies.
    openerFix: 'Hello!',
    lint: {
      // /^hello!/ was wrong: it demanded the "!" immediately after "Hello", so it
      // flagged "Hello Linda!" — which is BETTER, since it also satisfies the
      // "use their first name ONCE near the top" rule. Match the greeting word.
      requireOpener: /^hello\b/i,
      // owner-fast mandates "Hello!" on EVERY reply, not just long ones, so the
      // short-mode lint must check it. Without this the panel showed no flag at
      // all on a live reply that opened "That Wednesday date has passed".
      requireOpenerShort: true,
      // Part Two says 40 to 90 words, Part Six makes 90 the QA ceiling. I had set
      // 60-140 as a compromise, so the linter passed replies a human reviewer
      // would send straight back. The dosing exemption still overrides this.
      wordMin: 40, wordMax: 90,     // long replies only
      paraMin: 2,  paraMax: 2,      // "Two short paragraphs, blank line between them"
      bangMaxShort: 2, bangMaxLong: 3,
      capsMax: 1,
      // Appeared in four consecutive live runs: "That tracking date is just when
      // the label was made, ignore it" / "was just the label estimate, not a real
      // delivery promise". The voice block forbids arguing with the awkward
      // detail; this catches it when the model does it anyway.
      dismissRe: /\b(?:just|only|merely) (?:the |a )?label\b|\blabel (?:date|estimate)\b|\bnot a real (?:delivery|shipping)?\s*(?:promise|date|estimate)\b|\bignore (?:it|that|the (?:date|tracking))\b|\bthat (?:date|tracking) (?:is|was) (?:just|only|meaningless)\b|\bdoesn'?t mean anything\b|\bwasn'?t (?:a )?(?:real|actual)\b/i,
      // "I'm not happy about it either" — the company's feelings are not the reply.
      // "I'm personally on this now" slipped both the ban list and the scrubber,
      // because replacing humanVoiceBlock dropped its ownership-theatre rule and
      // scrubBannedPhrases only matched handling|taking care of|looking into.
      // "[today/tomorrow]" is not a value the agent looks up, it is the model
      // refusing to pick. A placeholder has to name ONE missing fact.
      // SERVICE_FAILURE_BLOCK: "DO NOT end on a bare 'I'll update you when it's
      // processed' with nothing concrete attached. That open-ended non-answer is
      // exactly what the customer is already furious about." Nothing enforced it.
      // Live: "...will reply here with the next step as soon as I see it." — no
      // date, no bracket, no outcome. Only flagged when the reply carries no
      // placeholder and no weekday, since "I'll reply by [Friday]" is fine.
      vagueCloseRe: /(?:as soon as|once|when)\s+(?:i|we)\s+(?:see|hear|know|get|have|find out)\b[^.!?]{0,25}[.!]?\s*$|\bwith (?:the next step|an update|more info(?:rmation)?)\b[^.!?]{0,25}[.!]?\s*$|\b(?:i'?ll|i will|we'?ll) (?:update|let you know|come back|get back)\b[^.!?]{0,20}[.!]?\s*$/i,
      // A bracket marks a value needing SUBSTITUTION: [2-3], [date], [order number].
      // These words are already the final text — there is nothing to substitute, so
      // the bracket only stops the agent sending. Write "by tomorrow", not
      // "by [tomorrow]". Closed list of relative time words, so it cannot drift
      // into flagging real slots.
      // Two different problems, two different fixes.
      //
      // bracketStripRe — a real word wearing a pointless bracket. "tomorrow" needs
      // no substitution, so removing the bracket cannot change any claim and makes
      // the reply sendable. Scrubbed automatically, same safety argument as the
      // opener prepend.
      bracketStripRe: /\[\s*((?:by\s+)?(?:end of (?:day|today|business)|today|tonight|tomorrow|this (?:afternoon|evening|morning)))\s*\]/gi,
      // bracketRewriteRe — vague speed. Stripping "[asap]" to "asap" would launder
      // a banned phrase into plain text. This needs a human rewrite, so flag only.
      bracketRewriteRe: /\[\s*(?:by\s+)?(?:asap|a\.s\.a\.p\.?|right away|shortly|immediately|eod|cob)\s*\]/i,
      // Part Six: "Do the sentences run on, or does it read like a school essay?"
      // The owner reference reply averages 28.3 words per sentence. An essay-shaped
      // reply averages 12-15. Long replies only, where the mean means something.
      minMeanSentenceWords: 18,
      // A quick-pick with several blanks is a form, not something an agent can
      // click and send, and every unfilled bracket is a chance to leak
      // "[Thursday]" to a customer. Live median for fast mode was 2. One lookup
      // is fine. Detailed mode is exempt — that is a draft the agent edits anyway.
      maxPlaceholdersShort: 1,
      // Part Six: "Does the last sentence leave the customer picturing a good
      // outcome?" vagueclose catches the negative case; this checks the positive.
      outcomeRe: /\b(?:door|doorstep|door step|arriv|deliver|land|hands|in your|on your card|back on your|refund|tracking|moving|move|scan|shipped|ships|out to you|to you)\b/i,
      choiceHolderRe: /\[[^\]]*\/[^\]]*\]|\[[^\]]*\bor\b[^\]]*\]/i,
      theatreRe: /\b(?:i'?m|i am|im) personally\b|\bi'?ll personally\b|\bi will personally\b|\btaking (?:full )?ownership\b|\bpersonally (?:on|handling|overseeing|seeing to) (?:this|it)\b|\bon your behalf\b/i,
      emoteRe: /\b(?:i'?m|we'?re|im|were) not happy\b|\bfrustrating for (?:us|me)\b|\bthis upsets (?:us|me)\b|\bi hate (?:this|that|when)\b|\bwe feel (?:terrible|awful|bad)\b/i,
      // A complete reconstitution answer is SUPPOSED to blow the word cap.
      // Flagging it would train agents to trim numbers out of a dose.
      skipLengthIf: /\b[\d.]+\s*mL\b|\b[\d.]+\s*(?:mg|mcg|iu)\s*\/\s*mL\b|\b\d+\s*units?\b/i,
    },
  },
};

// Fleet-wide. Every store gets this voice unless GROUP_PROFILE_MAP says otherwise.
const DEFAULT_PROFILE_ID = 'owner-fast';

// Now an ESCAPE HATCH, not the main path. Every store defaults to 'owner-fast'.
// If a group goes wrong, drop it back to 'direct-support' here and it returns to
// the ai-suggestions.js built-in voice on the next request, no deploy needed
// beyond this map.
const GROUP_PROFILE_MAP = {
  // 'peptide': 'direct-support',
};

/**
 * @param {{ storeGroup?: string, voiceProfile?: string }} store  cached store record
 * @returns {object} a profile, never null
 */
function resolveVoiceProfile(store = {}) {
  const explicit = store?.voiceProfile || store?.voice_profile;
  if (explicit && PROFILES[explicit]) return PROFILES[explicit];

  const group = store?.storeGroup || store?.store_group || store?.groupId || store?.group_id;
  const byGroup = group && GROUP_PROFILE_MAP[group];
  if (byGroup && PROFILES[byGroup]) return PROFILES[byGroup];

  return PROFILES[DEFAULT_PROFILE_ID];
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 2 — RULES
//
// Each function takes a profile and is a no-op unless that profile opts in:
//   scrubVoice            profile.scrub === true
//   lintVoice             profile.lint  !== null
//   filterOnVoiceSamples  profile.bannedPhrases !== null
// ═════════════════════════════════════════════════════════════════════════════

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE_CACHE = new Map();
const phraseRe = (p) => {
  if (!RE_CACHE.has(p)) RE_CACHE.set(p, new RegExp(`\\b${escapeRe(p)}`, 'i'));
  return RE_CACHE.get(p);
};

// Acronyms that may be caps without counting toward the caps limit.
const CAPS_ALLOW = new Set([
  'UPS', 'USPS', 'DHL', 'FEDEX', 'CP', 'ID', 'OK', 'AM', 'PM', 'ETA', 'PO', 'FYI',
  'USA', 'US', 'UK', 'EU', 'CA', 'QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB',
  'SKU', 'VAT', 'GST', 'HST', 'QST', 'CAD', 'USD', 'COD', 'FAQ',
  'BAC', 'IU', 'ML', 'MG', 'MCG', 'GLP', 'COA', 'HPLC', 'MS', 'LOT',
]);

/**
 * Mechanical fixes only, and only the four that lib/ai-suggestions.js does NOT
 * already make. humanizeText() and scrubBannedPhrases() run first and own em
 * dashes, "kindly", "rest assured", "don't hesitate" and "at your earliest
 * convenience" — repeating them here buys nothing and lets two regexes fight
 * over the same sentence.
 *
 * It never rewrites a claim. A regex editing a sentence about a refund is how
 * you ship a wrong promise. Whatever it can't safely fix comes back from
 * lintVoice() instead.
 */
/**
 * @param {object} [opts]
 * @param {boolean} [opts.isContinuation]  True when the agent has already
 *   replied in this thread. The opener repair below is skipped in that case: a
 *   greeting belongs on the first reply of a conversation, not the ninth, and
 *   prepending one to every suggestion is what made the panel read as though it
 *   had not been following along.
 */
function scrubVoice(text, profile, { isContinuation = false } = {}) {
  if (!profile?.scrub) return text;
  if (!text || typeof text !== 'string') return text;
  let t = text;

  // Opener repair. Runs first so the greeting sits in front of whatever follows.
  // Three cases: right greeting already there, a DIFFERENT greeting to convert
  // (keeping the customer's name, since "Hello Linda!" also satisfies the
  // use-their-name-once rule), or none at all.
  if (!isContinuation && profile.openerFix && profile.lint?.requireOpener && !profile.lint.requireOpener.test(t.trim())) {
    // Greeting match is case-insensitive; the NAME check that follows is not.
    // With /i on the whole pattern, [A-Z][a-z]+ also matched lowercase words, so
    // "Hey there" read "there" as a name and "Hey so its packed" would have become
    // "Hello so! its packed". "there" is folded into the greeting instead.
    const greet = t.match(/^\s*(?:hi|hey|hiya|good\s+(?:morning|afternoon|evening))(?:\s+there)?\s*[,!.]?\s*/i);
    if (greet) {
      const rest = t.slice(greet[0].length);
      const named = rest.match(/^([A-Z][a-z]+)\s*[,!.]\s*/);   // no /i — a real name is capitalised
      t = named
        ? `${profile.openerFix.replace(/!$/, '')} ${named[1]}! ` + rest.slice(named[0].length)
        : `${profile.openerFix} ` + rest;
    } else {
      t = `${profile.openerFix} ` + t.replace(/^\s+/, '');
    }
  }

  // Needless brackets. A bracket marks a value the agent must SUBSTITUTE; these
  // words are already the final text, so the bracket only blocks sending. Strip it
  // and the reply reads exactly as the owner writes it: "by tomorrow", not
  // "by [tomorrow]". Cannot alter a claim — same bar as the opener repair.
  if (profile.lint?.bracketStripRe) {
    t = t.replace(profile.lint.bracketStripRe, '$1');
  }

  t = t.replace(/\*\*([^*\n]+)\*\*/g, '$1');            // markdown bold
  t = t.replace(/__([^_\n]+)__/g, '$1');
  t = t.replace(/^[ \t]*[-*•‣▪]\s+/gm, '');             // list markers
  t = t.replace(/^[ \t]*\d+[.)]\s+/gm, '');
  t = t.replace(/(^|[.!?]\s+)(Additionally|Furthermore|Moreover)\s*,?\s*/g, '$1');
  t = t.replace(/\n*\s*(?:Best|Kind|Warm)\s+regards\s*,?[\s\S]*$/i, '');  // sign-off + tail
  t = t.replace(/\n*\s*Sincerely\s*,?[\s\S]*$/i, '');
  t = t.replace(/\n*\s*(?:The\s+)?(?:Customer\s+)?Support\s+Team\s*\.?\s*$/i, '');

  t = t.replace(/[ \t]{2,}/g, ' ')
       .replace(/ +([.,!?])/g, '$1')
       .replace(/\n{3,}/g, '\n\n')
       .replace(/(^|\n)[ \t]+/g, '$1');

  return t.trim();
}

/**
 * Reports what scrub could not safely fix. Advisory — never blocks a send.
 * Opener, word count and paragraph count apply to long replies only; a one-line
 * quick-pick would fail all three by design.
 *
 * @returns {Array<{code:string,label:string,detail?:string}>}
 */
function lintVoice(text, profile, { detailed = false, isContinuation = false } = {}) {
  const cfg = profile?.lint;
  if (!cfg) return [];
  if (!text || typeof text !== 'string') return [];
  const t = text.trim();
  if (!t) return [];

  const issues = [];
  const banned = profile.bannedPhrases || [];

  const hits = banned.filter((p) => phraseRe(p).test(t));
  if (hits.length) {
    issues.push({
      code: 'banned',
      label: hits.length === 1 ? 'banned phrase' : `${hits.length} banned phrases`,
      detail: hits.slice(0, 4).join(' / '),
    });
  }

  if (/[—–]|\S\s--\s\S/.test(t)) issues.push({ code: 'emdash', label: 'em dash' });
  if (/^\s*(?:[-*•‣▪]|\d+[.)])\s+/m.test(t)) issues.push({ code: 'list', label: 'list' });
  if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(t)) issues.push({ code: 'bold', label: 'bold' });
  if (/\b(?:best|kind|warm)\s+regards\b|\bsincerely\b|\bsupport team\b/i.test(t)) {
    issues.push({ code: 'signoff', label: 'sign-off' });
  }

  // Content checks the voice block mandates but no formatting rule can catch.
  // Both apply in short and long mode: a one-line quick-pick can dismiss a
  // carrier date just as easily as a paragraph can.
  if (cfg.dismissRe && cfg.dismissRe.test(t)) {
    issues.push({ code: 'dismissive', label: 'dismisses their tracking' });
  }
  if (cfg.emoteRe && cfg.emoteRe.test(t)) {
    issues.push({ code: 'emoting', label: 'our feelings, not theirs' });
  }
  if (cfg.theatreRe && cfg.theatreRe.test(t)) {
    issues.push({ code: 'theatre', label: 'ownership theatre' });
  }
  if (cfg.choiceHolderRe && cfg.choiceHolderRe.test(t)) {
    issues.push({ code: 'choiceholder', label: 'placeholder offers a choice' });
  }
  // Part Six: "Is there a real, specific date in it?" Only required when the reply
  // COMMITS to something. "What's your order number" legitimately has no date, and
  // demanding one there is the noise that trains agents to ignore flags. A bracket
  // counts — the agent fills it before sending.
  if (cfg.requireDateOnCommitment !== false) {
    const commits = /\b(?:i'?ll|i will|we'?ll|we will|i'?m)\s+(?:ship|send|reship|resend|refund|replace|get|put|post|dispatch)\b|\breplacement\b|\brefund\b|\breship\b/i.test(t);
    const hasDate = /\[[^\]]*\]/.test(t)
      || /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tonight|tomorrow)\b/i.test(t)
      || /\b\d{1,2}\s*(?:-|\u2013|to)\s*\d{1,2}\s*(?:business\s+)?(?:day|week)s?\b/i.test(t)
      || /\b\d{1,2}(?:st|nd|rd|th)\b/i.test(t)
      || /\bnext (?:week|monday|tuesday|wednesday|thursday|friday)\b/i.test(t);
    if (commits && !hasDate) issues.push({ code: 'nodate', label: 'commits with no date' });
  }

  if (!detailed && Number.isInteger(cfg.maxPlaceholdersShort)) {
    const n = (t.match(/\[[^\]]*\]/g) || []).length;
    if (n > cfg.maxPlaceholdersShort) issues.push({ code: 'toomanyblanks', label: `${n} blanks to fill` });
  }

  // Only the rewrite case is flagged. The strip case is repaired by scrubVoice
  // before lint ever sees it, so flagging it too would be noise about something
  // already fixed.
  if (cfg.bracketRewriteRe && cfg.bracketRewriteRe.test(t)) {
    const picked = [...new Set((t.match(new RegExp(cfg.bracketRewriteRe.source, 'gi')) || []).map(x => x.trim()))];
    issues.push({
      code: 'vaguebracket',
      label: 'bracketed vague speed',
      detail: picked.join(', '),
    });
  }
  // Scoped to the CLOSING sentence only. My first version excluded any reply
  // mentioning a weekday, which cleared "that Wednesday date passed while the
  // package was waiting for UPS ... will reply here with the next step as soon as
  // I see it" — the customer's PAST date suppressed a flag about the ending. What
  // matters is whether the close itself carries a bracket or a real day.
  if (cfg.vagueCloseRe) {
    const closing = t.split(/(?<=[.!?])\s+/).filter(Boolean).pop() || t;
    const closeHasCommitment = /\[[^\]]*\]/.test(closing)
      || /\b(?:by|on)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/i.test(closing);
    if (cfg.vagueCloseRe.test(closing) && !closeHasCommitment) {
      issues.push({ code: 'vagueclose', label: 'ends on an open-ended update' });
    }
  }

  if (Number.isInteger(cfg.capsMax)) {
    const caps = (t.match(/\b[A-Z][A-Z0-9]+\b/g) || []).filter((w) => !CAPS_ALLOW.has(w));
    if (caps.length > cfg.capsMax) {
      issues.push({ code: 'caps', label: `${caps.length} caps words`, detail: caps.join(', ') });
    }
  }

  const bangMax = detailed ? cfg.bangMaxLong : cfg.bangMaxShort;
  if (Number.isInteger(bangMax)) {
    const bangs = (t.match(/!/g) || []).length;
    if (bangs > bangMax) issues.push({ code: 'bangs', label: `${bangs} exclamations` });
  }

  // Opener is checked in short mode only when the profile says it is mandatory
  // for every reply. Word count and paragraph count stay long-mode only: a
  // one-line quick-pick would fail both by design.
  if (!isContinuation && cfg.requireOpener && (detailed || cfg.requireOpenerShort) && !cfg.requireOpener.test(t)) {
    issues.push({ code: 'opener', label: 'wrong opener' });
  }

  if (detailed) {
    const skipLength = cfg.skipLengthIf && cfg.skipLengthIf.test(t);
    if (!skipLength && Number.isInteger(cfg.wordMin) && Number.isInteger(cfg.wordMax)) {
      const words = t.split(/\s+/).filter(Boolean).length;
      if (words < cfg.wordMin || words > cfg.wordMax) {
        issues.push({ code: 'length', label: `${words} words` });
      }
    }
    // Part Six: reads like a school essay?
    if (!skipLength && Number.isInteger(cfg.minMeanSentenceWords)) {
      const sents = t.split(/(?<=[.!?])\s+/).filter(x => x.trim());
      const w = t.split(/\s+/).filter(Boolean).length;
      const mean = sents.length ? w / sents.length : w;
      if (sents.length >= 3 && mean < cfg.minMeanSentenceWords) {
        issues.push({ code: 'choppy', label: `essay rhythm (${mean.toFixed(0)}w/sentence)` });
      }
    }

    // Part Six: does the last sentence leave them picturing a good outcome?
    if (!skipLength && cfg.outcomeRe) {
      const closing = t.split(/(?<=[.!?])\s+/).filter(Boolean).pop() || t;
      if (!cfg.outcomeRe.test(closing)) issues.push({ code: 'nooutcome', label: 'close has no outcome' });
    }

    if (!skipLength && Number.isInteger(cfg.paraMin) && Number.isInteger(cfg.paraMax)) {
      const paras = t.split(/\n\s*\n/).filter((p) => p.trim()).length;
      if (paras < cfg.paraMin || paras > cfg.paraMax) {
        issues.push({ code: 'paras', label: `${paras} paragraph${paras === 1 ? '' : 's'}` });
      }
    }
  }

  return issues;
}

/**
 * extractAdminStyle() learns from whatever the team actually sent, and
 * buildAdminStyleBlock() then calls that style "non-negotiable". If agents have
 * been sending AI-slop, the learned block argues with the voice block every turn
 * and usually wins, because it sits lower in the prompt. Drop the bad samples
 * before they are learned.
 */
function filterOnVoiceSamples(samples = [], profile, { strict = false } = {}) {
  if (!Array.isArray(samples)) return [];
  if (!profile?.bannedPhrases) return samples;
  // strict also drops samples that contradict the profile's mandated opener or
  // voice rules. Use it for anything the prompt presents AS the voice — brain
  // responseExamples say "copy this exact rhythm", so a sample with no "Hello!"
  // teaches the model to skip the greeting the profile requires.
  // 'opener' is deliberately NOT in the strict set by default. Measured live:
  // responseExamples dropped 9/9 with it, agentStyleSamples dropped 1/10 without
  // it — the whole difference is the greeting. The team does not open with
  // "Hello!", so an opener check discards every hand-curated example the store
  // wrote, and those examples encode WHAT to say (real remedies, house policy
  // wording), not how. The subordinated header already stops them claiming
  // authority over voice.
  //
  // Set VOICE_STRICT_OPENER=1 to put it back if openers start going missing again.
  const strictOpener = process.env.VOICE_STRICT_OPENER === '1';
  const HARD = strict
    ? ['banned', 'emdash', 'list', 'bold', 'signoff', 'theatre', 'dismissive', 'emoting',
       ...(strictOpener ? ['opener'] : [])]
    : ['banned', 'emdash', 'list', 'bold', 'signoff'];
  return samples.filter((s) => !lintVoice(s, profile).some((f) => HARD.includes(f.code)));
}

module.exports = {
  VOICE_VERSION,
  PROFILES,
  DEFAULT_PROFILE_ID,
  GROUP_PROFILE_MAP,
  resolveVoiceProfile,
  scrubVoice,
  lintVoice,
  filterOnVoiceSamples,
};