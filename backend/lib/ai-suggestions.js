const BANNED_PHRASE_REPLACEMENTS = [
  // — patience / inconvenience —
  [/\bthank you for your patience\b[.!]?/gi, ''],
  [/\bthanks for your patience\b[.!]?/gi, ''],
  [/\bi apolog(?:ize|ise) for any inconvenience\b[.!]?/gi, 'sorry about that'],
  [/\bwe apolog(?:ize|ise) for any inconvenience\b[.!]?/gi, 'sorry about that'],

  // — "great question" family —
  [/\bthat['’]s a (?:really )?great question\b[.!]?/gi, ''],
  [/\bthat is a (?:really )?great question\b[.!]?/gi, ''],
  [/\bgreat question\b[.!]?/gi, ''],
  [/\bgood question\b[.!]?/gi, ''],

  // — "happy to help" softening (keep, don't hard-ban) —
  [/\bi['’]d be happy to help\b/gi, 'happy to help'],
  [/\bi would be happy to help\b/gi, 'happy to help'],
  [/\bmore than happy to\b/gi, 'happy to'],
  [/\bi['’]d be happy to\b/gi, 'I can'],
  [/\bi would be happy to\b/gi, 'I can'],

  // — ownership theatre (new: Sam doc flags these hard) —
  [/\bi['’]m personally (?:handling|taking care of|looking into) this\b[.!]?/gi, ''],
  [/\bi am personally (?:handling|taking care of|looking into) this\b[.!]?/gi, ''],
  [/\b(?:i['’]m|i am) (?:personally )?taking (?:full )?ownership(?: of this)?\b[.!]?/gi, ''],
  [/\bi['’]ll personally\b/gi, "I'll"],
  [/\bi will personally\b/gi, "I'll"],
  [/\bon your behalf\b/gi, ''],
  [/\brest assured(?:,| that)?\b[,.]?/gi, ''],

  // — reach-out / hesitate / closers (new) —
  [/\bfeel free to reach out\b/gi, 'just let me know'],
  [/\bdon['’]t hesitate to reach out\b/gi, 'just let me know'],
  [/\bdon['’]t hesitate to\b/gi, 'just'],
  [/\bplease don['’]t hesitate\b[.!]?/gi, ''],
  [/\breach out\b/gi, 'get in touch'],
  [/\b(?:please )?let me know if (?:there['’]s|there is) anything else\b[.!]?/gi, ''],
  [/\bif (?:there['’]s|there is) anything else (?:i can help(?: with)?|you need)\b[.!]?/gi, ''],
  [/\bis there anything else i can help(?: you)?(?: with)?\b[.!?]?/gi, ''],
  [/\bi['’]m here to help\b[.!]?/gi, ''],
  [/\bi am here to help\b[.!]?/gi, ''],

  // — signposting (new) —
  [/\bhere['’]s what i can do\b[:.!]?/gi, ''],
  [/\bjust to clarify\b[,]?/gi, ''],
  [/\bto answer your question\b[,]?/gi, ''],
  [/\bplease be advised\b[,.]?/gi, ''],
  [/\bas per our policy\b/gi, ''],
  [/\bas per our\b/gi, 'per our'],

  // — misc corporate —
  [/\bat your earliest convenience\b/gi, 'when you can'],
  [/\bwe appreciate your\b/gi, 'thanks for your'],
  [/\bi appreciate you bringing this to my attention\b[.!]?/gi, 'thanks for flagging this'],
  [/\bi hope this (?:message |email )?finds you well\b[.!]?/gi, ''],
  [/\bi['’]d like to inquire\b/gi, ''],
  [/\bi understand your frustration\b[.!]?/gi, 'I hear you'],
  [/\bi (?:completely |totally )?understand your frustration\b[.!]?/gi, 'I hear you'],
  [/\bi understand your concern\b[.!]?/gi, 'I hear you'],
  [/\bkindly\b\s*/gi, ''],
];

function scrubBannedPhrases(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const [pattern, replacement] of BANNED_PHRASE_REPLACEMENTS) out = out.replace(pattern, replacement);
  out = out
    .replace(/[^\S\n]{2,}/g, ' ')                                  // collapse runs of spaces (keep newlines)
    .replace(/\s+([.,!?;:])/g, '$1')                              // no space before punctuation
    .replace(/([.!?])\s*,/g, '$1')                                // "help. ," left by a deletion -> "help."
    .replace(/,\s*([.!?])/g, '$1')                                // "help ,." -> "help."
    .replace(/,\s*,/g, ',')                                       // collapse double commas
    .replace(/([.!?])[ \t]*\1+/g, '$1')                           // collapse duplicated end punctuation (.. -> .)
    .replace(/^[\s.,!?;:]+/, '')                                  // strip leading orphan punctuation
    .replace(/\s+$/g, '')                                         // trailing space
    .replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase()) // capitalize sentence starts
    .trim();
  return out;
}

// ============ TEXT HUMANIZER ============
// Fixes dashes, then scrubs banned phrases. Every call site that already ran
// suggestions through humanizeText now also gets banned-phrase removal for free.

function humanizeText(text) {
  if (!text || typeof text !== 'string') return text;
  const dashFixed = text
    .replace(/\s*--\s*/g, ', ')   // double-hyphen used as a dash
    .replace(/\s*—\s*/g, ', ')    // em dash
    .replace(/\s*–\s*/g, ', ')    // en dash used as separator
    .replace(/,\s*,/g, ',')       // collapse accidental double commas
    .replace(/\s+,/g, ',')        // fix stray space before comma
    .trim();
  const scrubbed = scrubBannedPhrases(dashFixed);
  // If scrubbing nuked the whole thing (rare), keep the dash-fixed original so
  // the agent never gets an empty bubble.
  return scrubbed && scrubbed.length >= 4 ? scrubbed : dashFixed;
}

function _extractBalancedBlocks(s) {
  const blocks = [];
  let depth = 0, start = -1, inString = false, escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { if (depth === 0) start = i; depth++; }
    else if (ch === '}' || ch === ']') {
      if (depth > 0 && --depth === 0 && start !== -1) { blocks.push(s.slice(start, i + 1)); start = -1; }
    }
  }
  return blocks;
}

// Single string-aware pass: escape raw control chars inside strings, drop trailing commas.
function _normalizeJSONish(s) {
  let out = '', inString = false, escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) { out += ch; escape = false; continue; }
      if (ch === '\\') { out += ch; escape = true; continue; }
      if (ch === '"') { inString = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch; continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === ',') {
      let j = i + 1; while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === '}' || s[j] === ']') continue; // trailing comma -> drop
    }
    out += ch;
  }
  return out;
}

function _robustJSONParse(s) {
  try { return JSON.parse(s); } catch (_) {}
  try { return JSON.parse(_normalizeJSONish(s)); } catch (_) {}
  return undefined;
}

function parseAIResponse(rawContent, expectedKey = 'suggestions') {
  if (!rawContent || typeof rawContent !== 'string') return null;

  const normalizeShape = (v) => {
    if (v == null || typeof v !== 'object') return null;
    if (Array.isArray(v)) {
      if (expectedKey === 'suggestions' && v.every(x => typeof x === 'string')) return { suggestions: v };
      if (expectedKey === 'detailedAnswers' && v.every(x => x && typeof x === 'object' && 'text' in x)) return { detailedAnswers: v };
      return null;
    }
    if (Array.isArray(v[expectedKey])) return v;
    return null;
  };

  const fenceStripped = rawContent
    .replace(/```(?:json|javascript|js)?/gi, '')
    .replace(/```/g, '')
    .trim();

  // Fast path: whole thing parses and matches.
  const wholeShaped = normalizeShape(_robustJSONParse(fenceStripped));
  if (wholeShaped) return wholeShaped;

  // Otherwise scan balanced blocks; last matching one wins.
  let best = null;
  for (const b of _extractBalancedBlocks(fenceStripped)) {
    const shaped = normalizeShape(_robustJSONParse(b));
    if (shaped) best = shaped;
  }
  return best;
}
// ============ ANTHROPIC CLIENT (with retry) ============

function callAnthropicAPIWithRetry(requestBody, apiKey, retries = 1) {
  const attempt = (attemptsLeft) => new Promise((resolve, reject) => {
    const options = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(requestBody) } };
    const req = require('https').request(options, apiRes => {
      let body = '';
      apiRes.on('data', chunk => { body += chunk; });
      apiRes.on('end', () => {
        console.log(`✦ [AI] Anthropic response status: ${apiRes.statusCode}`);
        if (apiRes.statusCode !== 200) return reject(new Error(`Anthropic API ${apiRes.statusCode}: ${body.slice(0, 200)}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON from Anthropic')); }
      });
    });
    req.on('error', (err) => {
      const currentAttempt = retries - attemptsLeft + 1;
      console.error(`✦ [AI] Attempt ${currentAttempt}/${retries} failed: ${err.message}`);
      if (attemptsLeft > 0) setTimeout(() => attempt(attemptsLeft - 1).then(resolve).catch(reject), 1200 * currentAttempt);
      else reject(err);
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Anthropic timeout')); });
    req.write(requestBody); req.end();
  });
  return attempt(retries);
}

// DeepSeek-primary — used ONLY by /api/ai/suggestions.
async function callAIForSuggestions(requestBody, apiKey) {
  try {
    const { tryDeepSeekFallback } = require('./deepseek-fallback');
    const primary = await tryDeepSeekFallback(requestBody);
    if (primary) {
      console.log('✦ [AI] Suggestions served via DeepSeek (primary)');
      return primary;
    }
    console.warn('✦ [AI] DeepSeek primary unavailable — falling back to Claude');
  } catch (err) {
    console.warn(`✦ [AI] DeepSeek primary error: ${err.message} — falling back to Claude`);
  }
  console.log('✦ [AI] Suggestions served via Claude (fallback)');
  return callAnthropicAPIWithRetry(requestBody, apiKey);
}

// ============ AI STYLE FINGERPRINTING ============

function extractAdminStyle(chatHistory, agentStyleSamples = []) {
  let agentLines = agentStyleSamples.filter(s => s && s.trim().length > 8);
  if (agentLines.length === 0 && chatHistory) {
    agentLines = chatHistory.split('\n').filter(line => line.startsWith('Agent:')).map(line => line.replace(/^Agent:\s*/, '').trim()).filter(line => line.length > 8);
  }
  if (agentLines.length === 0) return null;
  const allText = agentLines.join(' ');
  const avgWords = Math.round(agentLines.reduce((sum, l) => sum + l.split(/\s+/).filter(Boolean).length, 0) / agentLines.length);
  const lengthStyle = avgWords <= 12 ? 'very short (under 12 words)' : avgWords <= 25 ? 'short (12–25 words)' : avgWords <= 55 ? 'medium (25–55 words)' : 'long (55+ words)';
  const greetingLines = agentLines.filter(l => /^(hi|hey|hello|heya|sup)\b/i.test(l.trim()));
  const greetingRatio = greetingLines.length / agentLines.length;
  const greetingNote = greetingRatio >= 0.3 ? `often opens with "${greetingLines[0].split(' ')[0]}" — do the same` : 'usually jumps straight into the reply without a greeting — do the same';
  const lowercaseLines = agentLines.filter(l => /[a-z]/.test(l) && l === l.toLowerCase());
  const writesLowercase = lowercaseLines.length / agentLines.length >= 0.4;
  const exclamationCount = (allText.match(/!/g) || []).length;
  const usesExclamation = exclamationCount / agentLines.length >= 0.4;
  const usesEllipsis = /\.{2,}|…/.test(allText);
  const usesEmoji = /[\u{1F300}-\u{1FFFF}]/u.test(allText);
  const emojiMatches = allText.match(/[\u{1F300}-\u{1FFFF}]/gu) || [];
  const contractions = (allText.match(/\b(i'm|i'll|i've|i'd|we're|we'll|we've|don't|can't|won't|it's|that's|you're|you'll|they're|there's|let's|isn't|wasn't|didn't|couldn't|wouldn't|shouldn't)\b/gi) || []).length;
  const usesContractions = contractions / agentLines.length >= 0.5;
  const vocab = {
    usesJust: /\bjust\b/i.test(allText), usesActually: /\bactually\b/i.test(allText), usesAlright: /\balright\b|\baight\b/i.test(allText),
    usesTotally: /\btotally\b/i.test(allText), usesPerfect: /\bperfect\b/i.test(allText), usesGotIt: /\bgot it\b|\bgotcha\b/i.test(allText),
    usesNoProblem: /\bno problem\b|\bnp\b|\bno worries\b/i.test(allText), usesAbsolutely: /\babsolutely\b/i.test(allText),
    usesSure: /\bsure\b/i.test(allText), usesYep: /\byep\b|\byup\b/i.test(allText),
  };
  const signoffs = { lmk: /\blmk\b|let me know/i.test(allText), reachOut: /reach out|feel free/i.test(allText), thankYou: /\bthank you\b/i.test(allText), thanks: /\bthanks[!.]?\s*$/im.test(allText), cheers: /\bcheers\b/i.test(allText), takecare: /\btake care\b/i.test(allText) };
  const empathyPatterns = [/so sorry/i, /really sorry/i, /apologize/i, /totally understand/i, /completely understand/i, /i get it/i, /makes sense/i, /that's frustrating/i, /that sucks/i, /not okay/i, /not right/i, /we messed up/i, /our fault/i, /my bad/i];
  const empathyPhrases = empathyPatterns.filter(p => p.test(allText)).map(p => p.source.replace(/\\/g, '').replace(/\\b/g, ''));
  const avgSentences = agentLines.reduce((sum, l) => sum + (l.match(/[.!?]+/g) || []).length, 0) / agentLines.length;
  const writesSingleSentence = avgSentences <= 1.3;
  const writesMultipleSentences = avgSentences >= 2.5;
  const phraseMap = {};
  agentLines.forEach(line => {
    const words = line.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!/^(the |a |an |to |of |in |is |it |at |on |be |by |do |go )/.test(bigram)) phraseMap[bigram] = (phraseMap[bigram] || 0) + 1;
    }
  });
  const recurringPhrases = Object.entries(phraseMap).filter(([, count]) => count >= 2).sort(([, a], [, b]) => b - a).slice(0, 5).map(([phrase]) => phrase);
  const sampleLines = agentLines.filter(l => l.split(/\s+/).length >= 5).slice(-8);
  return { avgWords, lengthStyle, greetingNote, greetingRatio, writesLowercase, usesExclamation, usesEllipsis, usesEmoji, emojiMatches: emojiMatches.slice(0, 3), usesContractions, vocab, signoffs, empathyPhrases, writesSingleSentence, writesMultipleSentences, recurringPhrases, sampleLines, totalSamplesAnalyzed: agentLines.length };
}

function buildAdminStyleBlock(style) {
  if (!style) return '';
  const rules = [];
  rules.push(`Match the agent's message length: ${style.lengthStyle} per reply.`);
  rules.push(`The agent ${style.greetingNote}.`);
  if (style.writesLowercase) rules.push(`The agent often writes in lowercase — mirror that. Don't correct their casing style.`);
  if (style.usesContractions) rules.push(`Use contractions freely (I'll, we'll, don't, it's, you're) — the agent does.`);
  else rules.push(`Avoid contractions — the agent writes without them.`);
  if (style.usesExclamation) rules.push(`Use exclamation marks naturally — the agent uses them to sound warm and enthusiastic.`);
  else rules.push(`Don't use exclamation marks — the agent keeps an even, calm tone.`);
  if (style.usesEllipsis) rules.push(`The agent uses ellipses (…) as a natural pause or trail-off. Mirror this sparingly.`);
  if (style.usesEmoji && style.emojiMatches.length > 0) rules.push(`The agent uses emoji: ${style.emojiMatches.join(' ')} — use these same ones where natural. Never add a lone "safe" emoji just to seem warm.`);
  if (style.writesSingleSentence) rules.push(`The agent usually writes in single sentences. Keep replies tight and punchy.`);
  else if (style.writesMultipleSentences) rules.push(`The agent writes in multi-sentence paragraphs — match that flow, but still one topic per reply.`);
  const casualWords = Object.entries(style.vocab).filter(([, v]) => v).map(([k]) => k.replace('uses', '').replace('Uses', '').toLowerCase()).filter(w => w.length > 1);
  if (casualWords.length > 0) rules.push(`The agent naturally uses words like: "${casualWords.join('", "')}". Use them where they fit.`);
  if (style.signoffs.lmk) rules.push(`When there's a genuine open question, "let me know" / "lmk" is fine — but never tack it on when the reply is already complete.`);
  else if (style.signoffs.cheers) rules.push(`The agent signs off with "cheers" — use this where appropriate.`);
  else if (style.signoffs.takecare) rules.push(`The agent uses "take care" as a sign-off.`);
  if (style.empathyPhrases.length > 0) rules.push(`When empathy is needed, use phrasing close to what the agent actually says: "${style.empathyPhrases.slice(0, 3).join('", "')}" — and only ONCE, fused into the sentence that does the work.`);
  if (style.recurringPhrases.length > 0) rules.push(`The agent habitually uses these phrases — weave them in naturally: "${style.recurringPhrases.join('", "')}".`);
  const sampleBlock = style.sampleLines.length > 0 ? `\nREAL MESSAGES from this agent — match this exact voice, rhythm, and vocabulary:\n${style.sampleLines.map(l => `  • "${l}"`).join('\n')}` : '';
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nADMIN WRITING STYLE — mirror this precisely (non-negotiable)\nBased on ${style.totalSamplesAnalyzed} real messages from this agent.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n${sampleBlock}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ============ PROMPT BUILDERS ============

// Static teaching pairs — the strongest lever for tone. Kept verbatim-in-spirit
// from the Sam persona doc. These show the model the exact gap between what the
// brain pushes it toward (ROBOT) and what a real person sends (HUMAN).
const ROBOT_VS_HUMAN_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEARN FROM THESE. COPY THE VOICE, NOT THE WORDS.
ROBOT = what the brain pushes you toward. HUMAN = what you actually send.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Late order, customer's mad
  ROBOT: "Hey Marcus! I completely understand your frustration, and I'm personally taking full ownership of this right now. I'll personally follow up with the carrier on your behalf. Rest assured we're on it!"
  HUMAN: "Marcus, 8 days is way too long, sorry about that. Let me pull your tracking and chase the carrier now, I'll come back with exactly where it's at."

Chargeback threat
  ROBOT: "Hi David, I completely understand your frustration and I'm personally handling this right now. Here's what I can do, I'll ship a replacement that matches your order exactly, plus a free mystery vial on us. This won't be open-ended, I'm on it."
  HUMAN: "David, no chargeback needed, I've got you. I can see your order and I know it's lost. I'll get a replacement out and I'm chasing the carrier on the original now. Same address, or a new one?"

Missing item
  ROBOT: "Hi Mike! Thank you so much for reaching out. I've looked into your order and I can see the bacteriostatic water should have been included. I sincerely apologize for this oversight. I'll arrange a replacement and include a complimentary item as a goodwill gesture. Please let me know if there's anything else I can help with!"
  HUMAN: "Ah, missing your BAC water, sorry Mike. Sending one out today, plus a free vial for the hassle."

Simple "where's my order" (no failure, so don't perform one)
  ROBOT: "Hi Sarah! Thank you for reaching out. I completely understand you'd like an update. I've taken a look and I'm happy to help. It appears your order should typically arrive within the standard window. Please don't hesitate to let me know if there's anything else!"
  HUMAN: "Hey Sarah, nothing's stuck, it's moving normally. Here's your tracking: [link]"
  WHY: state a shipping window ONLY if the brain gave you one this turn, and quote it exactly. If it didn't, point to tracking instead of inventing a day count. Never make up "next day" or a number.

Yes/no question, actually answer it
  ROBOT: "Hey Jordan! Great question! So to answer your question about whether needles come with your order, I want to make sure I get this 100% right, so I'll check on the exact inclusions for you."
  HUMAN: "Hi Jordan, needles aren't included, you'll want U-100 insulin syringes separately. You do get 1 free BAC water per vial though. Want a link for the syringes?"

Dosing where a route conflict exists in the brain (don't leak the conflict)
  ROBOT: "Great question! For your 10mg Semax vial, add 2mL BAC water for 5mg/mL. A quick note, per our current admin guidance we administer SQ, not intranasal."
  HUMAN: "Hey Priya, we run Semax subcutaneous, not nasal. What dose are you aiming for per shot? Tell me that and I'll give you the exact water amount and units."

Trust / "how do I know this isn't a scam" (e-transfer or crypto, no card)
  ROBOT: "Hi Mo! I completely understand your concern. Rest assured we are a legitimate business and your e-transfer is 100% safe with us. We confirm every order within a day and have thousands of happy customers. You have nothing to worry about!"
  HUMAN: "Fair thing to ask, Mo, e-transfer isn't reversible so I get the caution. Every batch has third-party COAs and you can read our reviews before you send anything."
  WHY: the ROBOT answer is everything a scammer would also say ("trust us", "you're safe", "nothing to worry about") plus an invented timeline. The HUMAN answer names the real reason the worry is fair, then hands over proof the customer can check THEMSELVES, pulled from the brain, never invented.

Refund owed, repeated delay, customer's had enough (SERVICE FAILURE — do the full stack)
  ROBOT: "Nicole, I understand. I am escalating your refund request right now. Our admin team will process it and confirm with you. I am truly sorry for the delay."
  HUMAN: "Nicole, this dragged way too long and that's on us, sorry. Those items never actually shipped so there's no tracking to give you. I'm putting your refund through now, and if it can't go back on your original payment I'll send it by e-transfer, I'll confirm the exact timing right here, not leave you waiting again."
  WHY: the ROBOT answer escalates and apologizes but STOPS there, it drops the alternative and gives an open-ended "will confirm" that's the exact non-answer she's already furious about. The HUMAN answer acknowledges once, answers her real question honestly (never shipped, so no tracking), commits to the refund, AND offers the brain's named alternative (e-transfer) with a promise to confirm timing in-chat. This is the ONE case where you stack acknowledge + resolution + next-step instead of sending one line.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

// Single source of truth for detecting a trust/scam question. The route calls
// this once and passes the result into BOTH buildSystemPrompt (13th arg) and
// buildUserPrompt (last arg), so the two prompts stay in sync.
const TRUST_QUESTION_RE = /scam|scammed|legit|legitimate|is this real|are you (real|legit)|how do i know|how can i trust|can i trust|trustworthy|reputable|sketch|sketchy|too good to be true|rip.?off|ripped off|not (getting|being) scammed|fake|is this safe|safe to (send|pay|order)|lose my money|get my money|money back if|no chargeback|not reversible|irreversible|why (no|don.t you take) card|prove (you|it)/i;
function detectTrustQuestion(clientMessage) {
  return TRUST_QUESTION_RE.test((clientMessage || '').toLowerCase());
}

// Trust / legitimacy / "is this a scam" handling. These questions are common
// when the store only takes e-transfer or crypto (no card, no chargeback). The
// customer is not attacking you, they're deciding whether to risk money they
// can't claw back. The wrong instinct is to assert your way out of it, which is
// exactly what a scammer does. The right move is to hand over what they can
// verify for themselves. Only injected when a trust/scam signal is detected.
const TRUST_QUESTION_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THIS IS A TRUST / "AM I GETTING SCAMMED" QUESTION — HANDLE IT DIFFERENTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The customer is about to send money they can't reverse (e-transfer / crypto have
no chargeback). Their caution is reasonable. Treat it as reasonable.

The single rule here: TRUST IS BUILT FROM WHAT THEY CAN CHECK, NOT WHAT YOU ASSERT.
A scammer says the exact same reassuring words you'd be tempted to say. So:

DO:
- Acknowledge the worry once, and name WHY it's fair ("e-transfer isn't reversible,
  so I get wanting to be sure"). Naming the real risk out loud builds credibility.
- Point ONLY to whatever verification the BRAIN provides that the customer can
  check themselves before paying, e.g. lab COAs, published reviews, a track record,
  guarantees, quoted exactly as the brain states them. Checkable proof, not
  adjectives. If the brain lists no such proof, don't invent any, offer to send
  them whatever verification you do have and keep it honest.
- If the brain offers a low-risk path (e.g. a smaller first order), you can offer
  it. Don't invent one the brain doesn't support.

NEVER:
- Never bare-assert legitimacy: "we're legit", "your money is safe with us",
  "you have nothing to worry about", "trust us", "we're not a scam", "100% safe".
  These are worthless here, a scammer says all of them, so they read as a red flag.
- Never answer the scam worry with an invented timeline ("we confirm within a day",
  "you'll have tracking by tomorrow"). Fast confirmation does not equal legitimate,
  it's off-topic, and it's a fake time promise on top of that.
- Never invent proof: don't fabricate review counts, years in business, ratings,
  certifications, guarantees, or COAs the brain doesn't actually state. Only proof
  the brain gives you. If it gives none, say so honestly rather than making it up.
- Don't get defensive or oversell. Calm and matter-of-fact reads as more legit
  than enthusiastic reassurance.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

// Service-failure handling. This is the ONE case that OVERRIDES "one thing, then
// stop." When something actually went wrong (refund owed, missed promise, the
// same issue dragging, an escalation), a single-line reply reads as dismissive
// and leaves the customer angry. Here the reply must carry the full resolution:
// acknowledge once + state the action + the brain's concrete next step. The
// honesty gates still hold — offering the brain's NAMED alternative is required,
// inventing a timeline/number is still banned. Injected only when detected.
const SERVICE_FAILURE_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVICE FAILURE — THIS OVERRIDES "ONE THING, THEN STOP" FOR THIS REPLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Something actually went wrong here: a refund is owed, a promise was missed, the
same issue keeps dragging, or the customer is escalating. This is the ONE case
where a single line is NOT enough — the customer needs to see the whole
resolution or they stay angry. For THIS reply the "one thing, then stop" rule and
the "don't stack empathy + remedy + next-step" rule are LIFTED. Do all three, in
order, fused tight, no padding, no closer:

  1. ACKNOWLEDGE the specific failure once, in your own words. Name the real thing
     (the delay, the shipment that never went out, the silence), not a generic "sorry."
  2. STATE THE RESOLUTION you're doing right now and commit to it: the refund,
     replacement, reship, or escalation. Not "I'll look into it" — the actual action.
  3. GIVE THE CONCRETE NEXT STEP the brain provides. If the brain names an
     alternative (store credit, e-transfer, replacement), OFFER IT BY NAME. If the
     brain states a specific timeline, quote it exactly. If the brain names an
     alternative but gives NO number, still offer the alternative and say you'll
     confirm the exact timing right here in this chat — never invent a number.

If the customer asked a direct question (e.g. "where is my package?"), answer it
honestly first. If the brain shows the item never shipped, say so plainly — there
is no tracking to give, so don't imply a package is in transit.

DO NOT end on a bare "I'll update you when it's processed" / "as soon as it's
done" with nothing concrete attached. That open-ended non-answer is exactly what
the customer is already furious about. If you truly have no timeline from the
brain, commit to WHEN you'll come back with one ("I'll have that number for you
in my next message"), never an empty "as soon as."

Honesty gates still hold: never invent a timeframe, amount, or policy the brain
didn't give you. Offering the brain's named alternative is REQUIRED here;
fabricating a number is still banned. 2 to 4 sentences.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

// Detects a service failure from the analysis block + sentiment (no route change
// needed). Negative sentiment PLUS a concrete failure/remedy signal in the
// analysis block. Deliberately does NOT fire on mere negative mood with no
// failure topic (e.g. "your site is annoying"), and never on trust questions
// (those have their own handling).
const FAILURE_SIGNAL_RE = /refund|return|cancel|complaint|escalat|damaged|broken|wrong item|missing|not received|never (arrived|received)|replacement|reship|delay|late/i;
function detectServiceFailure(sentiment, analysisBlock, isTrustQuestion) {
  if (isTrustQuestion) return false;
  if (sentiment !== 'negative' && sentiment !== 'very_negative') return false;
  return FAILURE_SIGNAL_RE.test(analysisBlock || '');
}

function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext = '', brainSettings = {}, adminStyleBlock = '', imageAnalysis = '', sentiment = 'neutral', responseExamples = [], isTrustQuestion = false) {
  const hasBrain = brainContext && brainContext.trim().length > 0;
  const trustBlock = isTrustQuestion ? TRUST_QUESTION_BLOCK : '';

  // Service-failure detection is derived from sentiment + the analysis block, so
  // the route needs no change. When true, the full acknowledge+resolution+next-step
  // stack is REQUIRED and the "one thing" compression is lifted for this reply.
  const isServiceFailure = detectServiceFailure(sentiment, analysisBlock, isTrustQuestion);
  const serviceFailureBlock = isServiceFailure ? SERVICE_FAILURE_BLOCK : '';

  // ── HUMAN VOICE — first thing the model reads, positive framing ──
  const humanVoiceBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#1 RULE — ONE MESSAGE, ONE THING, THEN STOP.
You're a real person who already knows the answer, texting a customer fast.
Not a call center. Not a script. Not a corporate email.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Answer the ONE thing they actually asked. Then stop. Do NOT also cover the four
things they didn't ask. If they asked "did it ship?", the reply is whether it
shipped, not shipping + tracking + an apology + a timeline + an offer to help
more. That reach for "completeness" is the single biggest reason replies read as
a bot. Say your one thing and let them reply.

(The ONE exception is a genuine SERVICE FAILURE — refund owed, missed promise,
repeated delay, escalation. If a SERVICE FAILURE block appears above, follow it:
there you MUST give the full acknowledge + resolution + next-step, not one line.)

DO:
- Contractions, always: I'll, you're, it's, we've, don't, that's.
- Short, plain sentences. Fragments are fine. Get to the point in the first line.
  Most replies are 1 to 3 sentences.
- Acknowledge ONCE, fused into the sentence that does the work: "8 days is too
  long, sorry, let me pull your tracking." Feel it once, say it once, move on.
- Own it in your OWN words, and only when something actually went wrong. On a
  routine question there's nothing to own, just answer.
- State what you know FLAT: drop the hedges (should, typically, it appears) on
  anything the brain actually tells you. But if the brain didn't give you a
  number, don't invent one, commit to the action instead.
- Use their first name ONCE, near the top. Then never again in that reply.
- Only say "let me check" for a real lookup you genuinely can't do yourself.
- End when the answer ends. If there's a real open question, ask it. Otherwise
  just stop.
- Match the customer's language fully, reply in French to a French customer,
  same human voice.

NEVER (these are the tells that scream AI):
- Don't stack empathy + ownership + remedy + timeline + reassurance in one
  message. Pick the ONE move the moment needs. (Exception: a SERVICE FAILURE, where
  acknowledge + resolution + next-step together ARE the one move.)
- Don't tack on a closer: no "let me know if there's anything else", "happy to
  help", "don't hesitate", "feel free to reach out". Most replies just end.
- Don't signpost: no "let me look into this", "here's what I can do", "just to
  clarify", "to answer your question".
- Don't restate their question before answering. Don't announce a rule.
- Don't leak the brain: never narrate internal policy, that two rules conflict,
  or "admin guidance".
- Never write: "I'd like to inquire", "thank you for your patience", "I apologize
  for any inconvenience", "rest assured", "kindly", "please be advised", "at your
  earliest convenience", "we appreciate your", "I hope this finds you well", "as
  per our policy", "that's a great question", "I'm personally handling this",
  "taking full ownership". Near-misses count: "Per our admin guidance" is still
  "as per our policy". If it belongs in an email signature, don't type it.
- Don't garnish with a lone emoji to seem warm.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  // ── FEW-SHOT VOICE — real gold replies, strongest lever for matching tone ──
  const cleanExamples = (responseExamples || [])
    .map(r => (typeof r === 'string' ? r : r?.text))
    .filter(t => t && t.trim().length > 15)
    .slice(0, 4);
  const voiceExamplesBlock = cleanExamples.length ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW WE ACTUALLY TALK — copy this exact rhythm, word choice, and warmth.
Real replies our best agent has sent. Match this voice.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${cleanExamples.map(t => `  • "${t.trim()}"`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : '';

  const brainBlock = hasBrain ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBRAIN RULES, READ THIS BEFORE ANYTHING ELSE\nMandatory store-owner instructions. Override ALL other guidelines.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCRITICAL BRAIN ENFORCEMENT:\n1. If the customer asks about a product, protocol, dosing, or anything the brain covers, ANSWER IT NOW. Do NOT say "let me check".\n2. Only stall when the brain does NOT contain the answer AND you genuinely need external info (order status, tracking, account details).\n3. Do NOT cross-apply one product's rule to another.\n4. Use exact values from the matching brain rule. But say them like a person, not a spec sheet, and still ONE thing at a time (unless this is a service failure, where the full resolution is required).\n5. Never narrate that the brain exists or that any rules conflict. Just answer in your own voice.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const imageBlock = imageAnalysis && imageAnalysis.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA, full analysis of the agent's uploaded image\nAll values below are CONFIRMED FACTS extracted from the screenshot.\nReference exact order numbers, statuses, amounts, dates, and names directly.\nDo NOT ask for information that is already visible in this screenshot.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const styleSection = adminStyleBlock ? `${adminStyleBlock}\n` : '';
  let contextGuidance = '';
  if (!hasBrain) {
    if (contextQuality === 'minimal') contextGuidance = messageRichness === 'very_brief' || messageRichness === 'brief' ? `⚠️ FIRST BRIEF MESSAGE, greet and ask the ONE thing you need. Don't assume.` : `ℹ️ DETAILED FIRST MESSAGE, address their one concern directly. Ask only for the single missing critical thing.`;
    else if (contextQuality === 'basic') contextGuidance = `ℹ️ BASIC CONTEXT, build on what's been discussed.`;
    else if (contextQuality === 'good') contextGuidance = `✓ GOOD CONTEXT, avoid repeating what's been asked. Move toward resolution.`;
    else if (contextQuality === 'excellent') contextGuidance = `✓ EXCELLENT CONTEXT, customer may be losing patience. Be efficient, one move.`;
  } else {
    contextGuidance = contextQuality === 'minimal' ? `ℹ️ FIRST MESSAGE: Answer the one thing you can from brain rules directly. Only ask a follow-up for something the brain doesn't cover.` : `✓ Use history + brain rules to answer the one thing they asked, specifically.`;
  }
  const len = brainSettings.length || 'medium';
  const tone = brainSettings.tone || 'friendly-professional';
  const empathy = brainSettings.empathy || 'high';
  const isComplexComplaint = messageRichness === 'very_detailed' && (sentiment === 'very_negative' || sentiment === 'negative');

  // Length rules pulled hard toward short. Dosing/reconstitution is the ONLY
  // sanctioned exception where numbers must be complete and exact. A SERVICE
  // FAILURE is the other: it needs 2-4 sentences to carry the full resolution,
  // and that requirement overrides any shorter admin length setting.
  const lengthRule = isServiceFailure
    ? `SERVICE FAILURE: this OVERRIDES any shorter length setting. Use 2 to 4 sentences to complete all three required moves — acknowledge once, state the resolution, give the brain's concrete next step/alternative. MAX 90 words. Never pad, but never drop the resolution or the next step just to stay short.`
    : len === 'long'
      ? (isComplexComplaint
          ? `Up to 4 sentences, only because this is a genuine multi-part complaint. Acknowledge the single most important thing ONCE, fused into the sentence that fixes it, then the action. Don't cover everything they didn't ask. MAX 90 words. Reconstitution/dosing math is the one place you may go fully complete regardless.`
          : `2 to 4 sentences MAX, and only if the message truly needs it. Usually 2 is plenty. Fuse any apology into the working sentence. MAX 70 words.`)
      : len === 'short'
        ? `1 to 2 sentences. Say the one thing, then stop. MAX 30 words.`
        : `1 to 3 sentences, usually 1 or 2. Answer the one thing they asked, then stop. MAX 45 words. The only exception is reconstitution/dosing math, where the numbers must be complete and exact even if that runs a bit longer.`;

  const toneRule = tone === 'formal' ? `Formal, professional, but still a real person, not a form letter. No contractions.` : tone === 'casual' ? `Casual, conversational. Contractions and fragments encouraged.` : `Friendly, direct, a little blunt, genuinely on their side. Warm but not eager or performing.`;
  const empathyRule = empathy === 'high' ? `When something actually went wrong, lead with a short genuine acknowledgment fused into the fix. One acknowledgment, never stacked. On a routine question, skip empathy entirely and just answer.` : empathy === 'low' ? `Skip empathy preambles. Get straight to the answer.` : `Brief acknowledgment only when warranted, then the answer.`;

  const qualityBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nREPLY QUALITY (admin-set, non-negotiable):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nLENGTH:  ${lengthRule}\nTONE:    ${toneRule}\nEMPATHY: ${empathyRule}`;

  // Safety + honesty gates. These OVERRIDE the voice — short never means unsafe.
  const nonNegotiablesBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNON-NEGOTIABLES (override the voice — correctness wins over brevity):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n- NO fake time promises. State a shipping, handling, or delivery timeframe ONLY if it appears in the BRAIN DATA for this reply, and quote the brain's numbers exactly. If the brain gave you no timeframe, do NOT state one, commit to the action, not the clock. Never invent a date or deadline of any kind.\n- Never say "same day", "next day", "overnight", "by tomorrow", or any specific speed unless the brain explicitly states it. And never infer delivery speed from where the customer is or from them saying you're "close", "local", or "nearby", proximity is not a service you offer unless the brain says so.\n- Stay honest. Never invent tracking status, stock, pickup options, or order details. If you don't know, say you're checking, for real.\n- Confirm the SPECIFIC product before giving any dosing or reconstitution answer.\n- All facts come from the brain, never from you. Product details, dosing, protocols, prices, stock, shipping, handling, returns, refunds, guarantees, eligibility, and safety rules are only what the BRAIN DATA states. Never assert a fact, number, policy, or restriction the brain didn't give you. If it's not in the brain and you can't look it up, say you'll check, don't fill the gap.\n- Safety and eligibility: apply whatever health, age, or contraindication rules the brain provides, exactly, in your own voice. Never invent one, and never give dosing or medical guidance beyond what the brain states. If a customer raises a health condition, age, or safety concern, follow the brain's rule and point them to a healthcare provider.\n- Only ever give links or URLs that appear in the brain, exactly as written. Never guess, shorten, or invent a domain.`;

  const serviceFailureCoreNote = isServiceFailure
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSERVICE-FAILURE EXCEPTION TO RULE 5 (applies to THIS reply only):\nAll three suggestions must EACH be a COMPLETE resolution — acknowledge once + the resolution you're doing now + the brain's concrete next step/alternative. Rule 5's "don't stack" does NOT apply here. Vary the wording and warmth across the three, NOT the completeness. None of the three may drop the resolution or the next step. Still no tacked-on closer.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : '';

  return `${humanVoiceBlock}${ROBOT_VS_HUMAN_BLOCK}${trustBlock}${serviceFailureBlock}${voiceExamplesBlock}${brainBlock}${imageBlock}${styleSection}You ARE the support person at ${storeName || 'this store'}, texting a customer directly. Not ghostwriting, not relaying, you. The customer must feel like they're talking to the same knowledgeable person every time.\n\n${qualityBlock}\n\n${nonNegotiablesBlock}\n\n${contextGuidance}\n\n${customerContext}\n\n${analysisBlock}\n\n${policyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCORE RULES:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. Answer the ONE thing they asked. Reference something they actually said, the product, their stated goal, or the specific issue. Generic replies are not acceptable, but neither is covering things they didn't ask.\n2. NEVER say "let me check" / "let me find out" / "let me get back to you" when the brain already contains the answer.\n3. "Let me check" is ONLY for real-time lookups (order status, tracking, account balance). Never for product/knowledge questions.\n4. Never ask for info already provided. Never repeat what the agent already said.\n5. The 3 suggestions are 3 DIFFERENT WAYS TO SAY THE ONE THING, not one-thing vs one-thing-plus-extra. Vary the angle, warmth, and phrasing, NOT the amount of stuff:\n   - Suggestion 1: The tightest, most direct version.\n   - Suggestion 2: Same answer, slightly warmer or with the one most relevant detail.\n   - Suggestion 3: Same answer phrased as a quick back-and-forth (only add a follow-up question if there's a GENUINE open question, otherwise just a third phrasing).\n   None of the three should stack empathy + action + timeline + closer. (SERVICE FAILURE is the exception — see the note below the rules.)\n6. Match the customer's emotional state, once, fused in. Don't perform a failure that didn't happen.\n7. No promises on timeframes or amounts unless confirmed. Shipping windows above are the only exception.\n8. CRITICAL, JSON LIMIT: each suggestion string must fit inside a JSON value and stay within the LENGTH word limit above. If tempted to write more, cut it, a truncated JSON response is a total failure.\n9. NEVER use em dashes, en dashes, or double hyphens (--). Use a comma, a period, or a new sentence. Write like a person typing in a chat.\n10. Avoid AI tells: no three-adjective stacks, no "furthermore/moreover/additionally", no throat-clearing warm-up ("Thanks so much for reaching out about your order"). Short, plain, like someone who already knows the answer.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${serviceFailureCoreNote}\nRespond ONLY with valid JSON: {"suggestions": ["reply 1", "reply 2", "reply 3"]}`;
}

function buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext, brainContext = '', imageAnalysis = '') {
  const msgLower = clientMessage.toLowerCase();
  const isKnowledgeQuestion = /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)|how does|how do|what is|tell me about|explain|difference between|compare|dosing|dose|protocol|reconstitut/i.test(msgLower);
  const isOrderQuestion = /order|tracking|shipped|delivery|refund|return|cancel|charge|payment|where is|status|when will/i.test(msgLower);
  // Trust / legitimacy / scam-fear — usually triggered by payment method (e-transfer,
  // crypto, no card). Takes priority: it changes HOW you answer, not just what.
  const isTrustQuestion = detectTrustQuestion(clientMessage);
  const questionType = isTrustQuestion ? 'TRUST/LEGITIMACY — customer fears being scammed (likely because payment is e-transfer/crypto, no chargeback). See the TRUST block above. Acknowledge the worry once, name why it is fair, then point ONLY to verification the BRAIN provides (whatever proof it lists), quoted exactly. NO bare "we are safe/legit" assertions. NO invented timelines. NO fabricated proof, numbers, or guarantees.' : isKnowledgeQuestion && !isOrderQuestion ? 'PRODUCT/KNOWLEDGE — answer directly from brain data below. Do NOT stall.' : isOrderQuestion ? 'ORDER/ACCOUNT — may need lookup. Ask for order number only if not already provided.' : 'GENERAL — use brain data if applicable.';
  const brainBlock = brainContext?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — USE THIS DATA TO WRITE YOUR REPLIES\nThe store's knowledge base. Your replies come from here first.\nIf the answer exists below, use it immediately, in your own plain voice.\nDo NOT say "let me check" when the data is right here. Don't quote it like a spec sheet.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const imageBlock = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA — complete analysis of the agent's uploaded image\nCONFIRMED FACTS from the screenshot. Use them directly. Reference exact values.\nDo NOT ask for any information already visible here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const signals = [`QUESTION TYPE: ${questionType}`];
  if (conversationState?.orderNumber) signals.push(`Order number: #${conversationState.orderNumber}`);
  if (conversationState?.customerEmail && conversationState.customerEmail !== 'unknown') signals.push(`Customer email: ${conversationState.customerEmail}`);
  const issue = conversationState?.detectedIssue || recentContext?.detectedIssue;
  if (issue) signals.push(`Issue: ${issue.replace(/_/g, ' ')}`);
  const wants = conversationState?.customerWants || recentContext?.customerWants || {};
  const wantsList = Object.entries(wants).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' '));
  if (wantsList.length > 0) signals.push(`Customer wants: ${wantsList.join(', ')}`);
  if (conversationState?.sentiment && conversationState.sentiment !== 'neutral') signals.push(`Sentiment: ${conversationState.sentiment.replace(/_/g, ' ')}`);
  if (conversationState?.isUrgent) signals.push(`Urgent: yes`);
  if (conversationState?.isRepeat) signals.push(`REPEAT/FOLLOW-UP: already asked about this`);
  if (conversationState?.isWrongItem) signals.push(`WRONG ITEM SENT — do not ask for photo, acknowledge and arrange correct shipment`);
  if (conversationState?.customerConfirmedAddress) signals.push(`Customer confirmed address is same as on order — do NOT ask for address again`);
  if (conversationState?.customerAskingForEmail) signals.push(`Customer is asking for an email to send documents to — provide support email`);
  const alreadyDone = [];
  if (conversationState?.agentAskedForOrder) alreadyDone.push('asked for order number');
  if (conversationState?.agentAskedForEmail) alreadyDone.push('asked for email');
  if (conversationState?.agentAskedForPhoto) alreadyDone.push('asked for photo');
  if (conversationState?.agentAlreadyApologized) alreadyDone.push('apologized');
  if (conversationState?.agentOfferedRefund) alreadyDone.push('offered refund');
  if (conversationState?.agentOfferedReplacement) alreadyDone.push('offered replacement');
  if (alreadyDone.length > 0) signals.push(`Agent already: ${alreadyDone.join(', ')} — do NOT repeat`);
  const topics = conversationState?.detectedTopics || [];
  if (topics.length > 0) signals.push(`Topics: ${topics.join(', ')}`);
  if (messageEdited) signals.push(`Admin edited this message to guide suggestions`);
  if (imageAnalysis?.trim()) signals.push(`Screenshot provided — treat the screenshot content as the PRIMARY customer message. Generate replies based on what the screenshot shows.`);
  const lastAgent = recentContext?.lastAgentMessages?.filter(Boolean).at(-1);
  const prevCustomer = recentContext?.lastCustomerMessages?.filter(Boolean).at(-2);
  const recentLines = [];
  if (lastAgent) recentLines.push(`Last agent reply: "${lastAgent}"`);
  if (prevCustomer) recentLines.push(`Previous customer message: "${prevCustomer}"`);
  const signalsBlock = `SIGNALS:\n${signals.map(s => `• ${s}`).join('\n')}`;
  const recentBlock = recentLines.length > 0 ? `\nRECENT:\n${recentLines.join('\n')}` : '';
  const historyBlock = chatHistory ? `\nCONVERSATION HISTORY:\n${chatHistory}` : '';
  const noteBlock = adminNote ? `\nADMIN NOTE: ${adminNote}` : '';

  // ── Region-aware timeframe guard ───────────────────────────────────────────
  // Lands LAST (right after the customer message) so the model weights it most.
  // The brain has SEPARATE Canada vs US shipping ranges. Failure modes seen:
  //   (1) inventing a number the brain never states, and
  //   (2) grabbing the Canada figure ("2-3 days") for a US customer, and
  //   (3) collapsing a range ("2-5") to its optimistic end ("2-3") as a promise.
  // This guard forces: right region, full range, stated as a max, never invented.
  const asksAboutTiming = /ship|deliver|arrive|arrival|how long|when.*(get|receive|come|arrive|ship|here)|pick.?up|walk.?in|business day|days? to|get here|reach me|takes? to/i.test(msgLower);
  const timeframeGuard = asksAboutTiming
    ? `\n\n⚠️ TIMEFRAME RULE (overrides all voice/length guidance):\n- State a delivery/shipping timeframe ONLY if it is written in the BRAIN data above. Never invent one.\n- The brain gives DIFFERENT figures for Canada vs the US. Do NOT mix them. Give a US customer the US range and a Canada customer the Canada range.\n- If you cannot tell which country the customer is in, do NOT guess a number — ask where they're located or point to tracking instead.\n- Quote the FULL range exactly as the brain states it. Do NOT collapse a range to its fastest end (never say "2-3 days" when the brain's range is "2-5"; never drop the upper bound).\n- Present carrier transit as a maximum ("up to X business days"), never as a guaranteed delivery date. Weekends don't count as business days.\n- This applies to all 3 replies.`
    : '';

  // ── Brain-silence guard ────────────────────────────────────────────────────
  // Catches invented facts on ANY topic the brain is silent on (cooling packs,
  // heat stability, ingredients, etc.) — not just timeframes. Same landing spot
  // as the timeframe guard so the model weights it at generation time. The
  // system prompt already says "all facts from brain," but buried mid-prompt it
  // loses to the customer's direct question. This repeats it last.
  const isFactualClaim = !isOrderQuestion && /\?|do you|can i|is it|are they|does it|will it|how (much|many|do|does)|what('| i)?s|stable|store|storage|heat|cold|cool|temperature|ingredient|contain|include|come with|safe/i.test(msgLower);
  const brainSilenceGuard = isFactualClaim
    ? `\n\n⚠️ FACT-SILENCE RULE: If the BRAIN data above does NOT contain the specific fact this customer is asking about, do NOT invent an answer, do NOT reassure ("you're all good", "it's fine", "quite stable"), and do NOT state a product/handling/stability claim from your own general knowledge. Instead acknowledge their point and say you'll confirm the exact detail. It is far better to say "let me confirm that and come right back" than to state something the brain never told you. This applies to all 3 replies.`
    : '';

  return `${brainBlock}${imageBlock}${signalsBlock}${recentBlock}${historyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCUSTOMER MESSAGE:\n${clientMessage}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${noteBlock}${timeframeGuard}${brainSilenceGuard}\n\nUsing the brain data${imageAnalysis?.trim() ? ' and the screenshot context' : ''} above as your primary source, write 3 replies that each answer the ONE thing this customer asked, then stop. Three different phrasings of that one answer, not three amounts of stuff. Keep each within the word limit. Return JSON only.`;
}


function buildEnhancedAnalysisBlock(analysis, conversationState, recentContext) {
  if (!analysis && !conversationState && !recentContext) return '';
  const lines = ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'CONVERSATION ANALYSIS (use this to inform your replies):', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'];
  const richnessLabels = { 'very_detailed': '📝 VERY DETAILED MESSAGE - Customer gave lots of info, use the relevant part, still answer ONE thing', 'detailed': '📝 Detailed message - Good context to work with', 'brief': '💬 Brief message - May need to ask the one thing you need', 'very_brief': '💬 Very brief message - Likely a greeting or needs one follow-up' };
  if (recentContext?.messageRichness && richnessLabels[recentContext.messageRichness]) lines.push(richnessLabels[recentContext.messageRichness]);
  const issueLabels = { 'damaged': '📦 Issue Type: DAMAGED/BROKEN item - Offer replacement or refund', 'wrong_item': '📦 Issue Type: WRONG ITEM received - Own it once, arrange the correct shipment', 'missing': '📦 Issue Type: MISSING/NOT RECEIVED - Check tracking, offer reship or refund', 'late': '📦 Issue Type: LATE DELIVERY - Check tracking, be straight about it', 'quality': '📦 Issue Type: QUALITY concerns - Get the one detail you need, offer fix' };
  if (recentContext?.detectedIssue) lines.push(issueLabels[recentContext.detectedIssue] || `📦 Issue: ${recentContext.detectedIssue}`);
  if (recentContext?.customerWants) {
    const wants = [];
    if (recentContext.customerWants.refund) wants.push('REFUND'); if (recentContext.customerWants.replacement) wants.push('REPLACEMENT');
    if (recentContext.customerWants.tracking) wants.push('TRACKING INFO'); if (recentContext.customerWants.help) wants.push('GENERAL HELP');
    if (wants.length > 0) lines.push(`🎯 Customer explicitly wants: ${wants.join(' or ')} - Address this directly, don't hedge`);
  }
  const orderNum = conversationState?.orderNumber || analysis?.orderNumber;
  if (orderNum) lines.push(`📦 Order Number: ${orderNum} — reference it, DO NOT ask for it again`);
  if (conversationState?.productName) lines.push(`🏷️  Product: ${conversationState.productName} — Reference this specifically`);
  if (conversationState?.customerEmail && conversationState.customerEmail !== 'unknown') lines.push(`📧 Email: ${conversationState.customerEmail} — DO NOT ask for email again`);
  if (analysis?.detectedTopics?.length > 0) {
    const topicLabels = { order_status: 'Order Status / Tracking', refund_return: 'Refund / Return / Cancellation', product_issue: 'Product Issue / Damaged / Defective', payment: 'Payment / Billing', discount_promo: 'Discount / Promo Code', product_inquiry: 'Product Inquiry', shipping: 'Shipping Questions', account: 'Account Issue', complaint: 'Complaint / Escalation', gratitude: 'Customer Expressing Thanks', greeting: 'Greeting / Opening' };
    lines.push(`🏷️  Topics: ${analysis.detectedTopics.map(t => topicLabels[t] || t).join(', ')}`);
  }
  const sentimentLabels = { very_negative: '😡 VERY UPSET / ANGRY — One genuine acknowledgment fused into the fix, then act. Don\'t stack apologies', negative: '😟 FRUSTRATED / UNHAPPY — Acknowledge once, in your own words, then the answer', neutral: '😐 NEUTRAL — Just answer, efficiently. No performed empathy', positive: '😊 POSITIVE / FRIENDLY — Match their energy, keep it short', very_positive: '🎉 VERY HAPPY / GRATEFUL — Warm and brief, a line is enough' };
  if (analysis?.sentiment) lines.push(`${sentimentLabels[analysis.sentiment] || analysis.sentiment}`);
  if (analysis?.isUrgent || conversationState?.isEscalating) lines.push('⚠️  URGENT / ESCALATING — Commit to the action now. Don\'t invent a deadline');
  if (analysis?.isRepeat || conversationState?.customerMessageCount >= 3) lines.push('🔁 CUSTOMER REPEATING / FOLLOWING UP — They feel unheard. Acknowledge the drag ONCE and take the action now.');
  if (conversationState?.isLongConversation) lines.push(`⏰ LONG CONVERSATION (${conversationState.turnCount} messages) — Be efficient, one move, solution-oriented.`);
  if (analysis?.isQuestion) lines.push('❓ Direct question asked — Answer THAT question specifically, don\'t deflect or pad');
  if (analysis?.hasAttachment || conversationState?.hasAttachment) lines.push('📎 Customer sent file/image — Acknowledge you\'ve seen it, briefly');
  if (analysis?.agentAskedForOrder || conversationState?.agentAskedForOrder) lines.push('🚫 Agent ALREADY asked for order number — DO NOT ask again');
  if (analysis?.agentAskedForEmail || conversationState?.agentAskedForEmail) lines.push('🚫 Agent ALREADY asked for email — DO NOT ask again');
  if (analysis?.agentAskedForPhoto || conversationState?.agentAskedForPhoto) lines.push('🚫 Agent ALREADY asked for photo — DO NOT ask again');
  if (analysis?.agentAlreadyApologized || conversationState?.agentAlreadyApologized) lines.push('🚫 Agent ALREADY apologized — no more sorries, just action');
  if (analysis?.agentOfferedRefund) lines.push('💰 Agent already mentioned refund — confirm the next step, don\'t re-pitch it');
  if (analysis?.agentOfferedReplacement) lines.push('🔄 Agent already offered replacement — confirm shipping detail, don\'t re-offer');
  const lastMsg = (analysis?.lastAgentText || conversationState?.lastAgentMessage || '').substring(0, 150);
  if (lastMsg) lines.push(`💬 Agent's last message: "${lastMsg}${lastMsg.length >= 150 ? '...' : ''}" — Don't repeat this`);
  return lines.length > 2 ? lines.join('\n') : '';
}

function buildCustomerContext(customerName, customerEmail, conversationState) {
  const lines = [`CUSTOMER: ${customerName || 'Guest'}${customerEmail ? ` (${customerEmail})` : ''}`];
  if (conversationState?.customerHistory) lines.push(`Customer History: ${conversationState.customerHistory.totalOrders || 0} previous orders`);
  return lines.join('\n');
}

function buildPolicyBlock() {
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND VOICE & ESCALATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Brand Voice:
- Friendly, direct, a little blunt, genuinely on the customer's side.
- Warm without performing. Relaxed, not eager. You've done this a hundred times.
- Action-oriented — when there's a next step, name it in one line.
- Honest — if you don't know, say you're checking, for real.

Auto-Escalation Triggers:
- Customer uses words like "lawyer", "sue", "fraud", "scam".
- Customer explicitly asks for manager/supervisor.
- 3+ messages about the same unresolved issue.
- Very negative sentiment + repeat customer.
When escalating, say it plainly in one line ("I'm getting this in front of the
right person now"), don't recite ownership theatre.`;
}

// ============ CONVERSATION STATE ============

function analyzeConversationState(chatHistory, clientMessage, analysis) {
  const fullText = `${chatHistory || ''} ${clientMessage || ''}`.toLowerCase();
  const messages = (chatHistory || '').split('\n').filter(m => m.trim());
  const orderMatch = fullText.match(/(?:order|#)\s*#?(\d{4,})/i);
  const orderNumber = orderMatch ? orderMatch[1] : null;
  const emailMatch = fullText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const customerEmail = emailMatch ? emailMatch[0] : null;
  const PEPTIDE_PRODUCTS = ['retatrutide','semaglutide','tirzepatide','bpc-157','bpc157','tb-500','tb500','cjc-1295','ipamorelin','ghk-cu','tesamorelin','sermorelin','nad+','nad','wolverine','glow blend','klow','mots-c','pt-141','selank','semax','epithalon','survodutide','cagrilintide','kisspeptin','follistatin','adipotide','aicar','hexarelin','igf','triptorelin','thymalin','pinealon','oxytocin','ara-290','ss-31','gonadorelin','hcg','hmg','lipo-c','5-amino-1mq','peg-mgf','mgf','ghrp','dsip','vip','ghk','tb500','bpc','reta','tirz','sema'];
  const msgLower = (clientMessage || '').toLowerCase();
  const productName = PEPTIDE_PRODUCTS.find(p => msgLower.includes(p)) || null;
  const isWrongItem = /ordered.{0,40}received|sent.{0,30}instead|received.{0,30}instead/i.test(fullText) || /wrong (item|product|vial|size|dose|peptide)/i.test(fullText);
  const wordCount = (clientMessage || '').split(/\s+/).filter(Boolean).length;
  const messageRichness = wordCount >= 30 ? 'very_detailed' : wordCount >= 15 ? 'detailed' : wordCount >= 5 ? 'brief' : 'very_brief';
  const customerConfirmedAddress = /address.{0,30}(same|correct|on file|on the order|unchanged)/i.test(msgLower) || /contact.{0,30}(same|correct|on file|on the order)/i.test(msgLower) || /same as.{0,20}order/i.test(msgLower);
  const customerAskingForEmail = /email.{0,30}(address|send|reach|contact)/i.test(msgLower) || /where.{0,20}(send|email)/i.test(msgLower);
  const customerMessages = messages.filter(m => m.startsWith('Customer:') || m.startsWith('Client:'));
  const agentMessages = messages.filter(m => m.startsWith('Agent:') || m.startsWith('Support:'));
  const customerMessageCount = customerMessages.length;
  const lastAgentMessage = agentMessages[agentMessages.length - 1] || '';
  return {
    orderNumber, customerEmail: customerEmail || 'unknown', productName, customerMessageCount, lastAgentMessage, messageRichness, isWrongItem, customerConfirmedAddress, customerAskingForEmail,
    agentAskedForOrder: /order number|order #|order id/i.test(lastAgentMessage),
    agentAskedForEmail: /email|e-mail address/i.test(lastAgentMessage),
    agentAskedForPhoto: /photo|picture|image|screenshot/i.test(lastAgentMessage),
    agentAlreadyApologized: /sorry|apologize|apologies/i.test(lastAgentMessage),
    agentOfferedRefund: /refund|money back/i.test(lastAgentMessage),
    agentOfferedReplacement: /replacement|replace|reship/i.test(lastAgentMessage),
    isEscalating: /manager|supervisor|escalate|unacceptable|ridiculous|lawsuit|lawyer|sue|fraud|scam|bbb|attorney general/i.test(clientMessage),
    hasAttachment: /attached|attachment|photo|image|screenshot|picture|file/i.test(clientMessage),
    isLongConversation: customerMessageCount >= 4,
    turnCount: Math.max(customerMessageCount, agentMessages.length),
    extractedEntities: { ...(orderNumber && { order_number: orderNumber }), ...(productName && { product: productName }), ...(customerEmail && customerEmail !== 'unknown' && { email: customerEmail }) },
  };
}

// ============ VALIDATION ============

function validateSuggestions(suggestions, conversationState, chatHistory) {
  if (!Array.isArray(suggestions)) return [];
  const hasOrderNumber = !!conversationState?.orderNumber;
  const hasEmail = conversationState?.customerEmail && conversationState.customerEmail !== 'unknown';
  return suggestions.filter((suggestion, index) => {
    if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length < 10) { console.log(`✦ [Validate] Filtered ${index + 1}: too short`); return false; }
    if (/as an ai|i'm a bot|i'm an assistant|as an assistant/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: mentions being AI`); return false; }
    if (hasOrderNumber && /\b(can you|could you|please provide|would you.*provide|share your).*?(order number|order #|order id)\b/i.test(suggestion) && !/order #?\d+/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: asking for order number already provided`); return false; }
    if (hasEmail && /\b(can you|could you|please provide|would you.*provide|share your).*?(email address|your email)\b/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: asking for email already provided`); return false; }
    return true;
  });
}

// ============ SMART FALLBACK SUGGESTIONS ============
// Canned templates used ONLY when the AI call fails or its output is filtered to
// nothing. Rewritten to the Sam voice: ONE fused acknowledgment, then the action,
// then stop. No empathyPrefix+repeatPrefix+body+urgencySuffix stacking, no tacked
// closers. humanizeText (banned-phrase scrubber) still runs on the way out as a net.
// The route always tags these responses with fallback:true / source:'fallback' so
// the frontend can label them instead of passing them off as AI.

function generateSmartFallbackSuggestionsRaw(customerMsg, chatHistory, analysis, adminNote) {
  const lower = (customerMsg || '').toLowerCase();
  const topics = analysis?.detectedTopics || [];
  const sentiment = analysis?.sentiment || 'neutral';
  const isRepeat = analysis?.isRepeat || false;
  const hasOrderNumber = analysis?.hasOrderNumber || /\b\d{4,}\b/.test(customerMsg + chatHistory);
  const hasAttachment = analysis?.hasAttachment || /attach|photo|image/i.test(customerMsg);
  const agentAskedForOrder = analysis?.agentAskedForOrder || false;
  const agentAlreadyApologized = analysis?.agentAlreadyApologized || false;
  const messageRichness = analysis?.messageRichness || 'brief';
  const customerAlreadyExplained = messageRichness === 'very_detailed' || messageRichness === 'detailed';
  const isWrongItem = /ordered.{0,40}received|sent.{0,30}instead|received.{0,30}instead|wrong (item|product|vial|size|dose|peptide)/i.test(customerMsg + chatHistory) || topics.includes('wrong_item');
  const customerAskingForEmail = /email.{0,30}(address|send|reach|contact)/i.test(lower) || /where.{0,20}(send|email)/i.test(lower);

  // ONE lead, never stacked. Picks a single fused acknowledgment when something
  // actually went wrong AND we haven't already apologized. Otherwise empty.
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let lead = '';
  if (!agentAlreadyApologized) {
    if (isRepeat) lead = pick(['Sorry this has dragged on. ', 'I know this has taken too long, sorry. ']);
    else if (sentiment === 'very_negative') lead = pick(["I'm really sorry about this. ", "That's not okay and I want to fix it. "]);
    else if (sentiment === 'negative') lead = pick(['Sorry about that. ', 'I hear you. ', 'Thanks for flagging this. ']);
  }

  // — pure gratitude: the whole reply IS a short warm line, no closer tacked on —
  if (topics.includes('gratitude') && topics.length === 1 && (sentiment === 'positive' || sentiment === 'very_positive')) {
    return ["Anytime!", "You got it.", "No worries at all, glad it's sorted."];
  }

  // — greeting: one line, ask the one thing —
  if (topics.length === 1 && topics.includes('greeting') && lower.trim().split(/\s+/).length <= 3) {
    return ['Hey! What can I help you with?', "Hi, what do you need a hand with?", "Hey there, what's up?"];
  }

  // — trust / "am I getting scammed" (high priority: pre-purchase, topic-agnostic) —
  // This is a FALLBACK: the brain/AI path already failed, so we have NO verified
  // facts to hand over. Never assert specific proof (COAs, reviews, guarantees)
  // here, we can't confirm it exists. Acknowledge honestly and offer to get them
  // the verification, without inventing what that is.
  if (detectTrustQuestion(customerMsg)) {
    return [
      "Fair thing to ask. E-transfer isn't reversible so I get wanting to be sure, let me get you what you need to check us out before you send anything.",
      "Totally fair to want to verify first. Give me a sec and I'll pull together everything you can use to confirm we're the real deal.",
      "Get it, you can't claw back an e-transfer so you want to be sure. What would make you comfortable? I'll get you whatever you need to check before paying.",
    ];
  }

  // — product issue —
  if (topics.includes('product_issue')) {
    if (isWrongItem) {
      if (customerAskingForEmail) return [
        `${lead}Send your order list to support@pepscustomercare.com and I'll get the right items out to you.`,
        `That's our mistake. Email your order list to support@pepscustomercare.com and I'll match it and ship the correct one.`,
        `${lead}Shoot your order details to support@pepscustomercare.com and I'll sort the correct products.`,
      ];
      return [
        `${lead}I'll get the correct item sent out, no need to return anything.`,
        `That's on us. Same shipping address as the order, or a new one?`,
        `${lead}Shipping the right one now, I'll send tracking once it's out.`,
      ];
    }
    if (customerAlreadyExplained) return [
      `${lead}Got everything I need from that, let me pull your order and fix it.`,
      `I can see exactly what happened. Pulling your order now.`,
      `${lead}All noted, I'm getting the right items lined up for you.`,
    ];
    if (hasOrderNumber && hasAttachment) return [
      `${lead}Got the photo and your order, looking now.`,
      `I can see the issue from the photo. Replacement or refund, your call?`,
      `${lead}Issue's noted on your order, sorting the fix now.`,
    ];
    if (hasOrderNumber && !hasAttachment && !analysis?.agentAskedForPhoto) return [
      `${lead}Can you send a quick photo of what you got? That'll speed this up.`,
      `Found your order. A pic of what arrived and I'll sort it fast.`,
      `${lead}Send a photo when you can and I'll pick the best fix.`,
    ];
    if (!hasOrderNumber && !agentAskedForOrder) return [
      `${lead}What's your order number? I'll pull it up.`,
      `Drop your order number and a quick line on what's wrong.`,
      `${lead}Order number and a photo if you've got one, and I'm on it.`,
    ];
    return [
      `${lead}Looking into this now, back shortly with a fix.`,
      `One sec, checking the options to fix this.`,
      `${lead}Want to get this right, let me check your case.`,
    ];
  }

  // — order status / shipping —
  if (topics.includes('order_status') || topics.includes('shipping')) {
    if (hasOrderNumber) return [
      `Let me pull the tracking on that now.`,
      `Checking your order, I'll have the latest shipping update in a sec.`,
      `On it, let me see where your order's at.`,
    ];
    if (!agentAskedForOrder) return [
      `What's your order number? I'll check it.`,
      `Give me your order number or the email you checked out with and I'll look.`,
      `Order number's in your confirmation email, drop it here and I'll pull it up.`,
    ];
    return [
      `Checking your order now, I'll send tracking as soon as I have it.`,
      `One sec, pulling the shipping status.`,
      `Verifying where it's at now.`,
    ];
  }

  // — refund / return —
  if (topics.includes('refund_return')) {
    if (hasOrderNumber) return [
      `${lead}Found your order, checking the return options now.`,
      `Pulling your order, I'll tell you the next step in a sec.`,
      `What's the reason for the return? That lets me sort it faster.`,
    ];
    if (!agentAskedForOrder) return [
      `${lead}What's your order number? I'll check the return options.`,
      `Drop your order number, it's in your confirmation email, and I'll start it.`,
      `Order number and the reason for the return, and I'm on it.`,
    ];
    return [
      `${lead}Checking your return now.`,
      `One sec, looking at the return policy for your order.`,
      `Refund to your original payment or store credit?`,
    ];
  }

  // — payment —
  if (topics.includes('payment')) {
    if (hasOrderNumber) return [
      `${lead}Pulling your order to check the payment now.`,
      `Checking the billing on your order.`,
      `${lead}Looking at the charge now, back shortly.`,
    ];
    return [
      `What's your order number or the email tied to the charge?`,
      `Order number, date, and amount, and I'll trace the charge.`,
      `Order number and the last four of the card used, and I'll dig in.`,
    ];
  }

  // — promo / product inquiry / account —
  if (topics.includes('discount_promo')) return [
    `What's the code, and which items are you putting it on?`,
    `Which promo do you mean, or what's the code?`,
    `What product or category are you after? I'll check what's running.`,
  ];
  if (topics.includes('product_inquiry')) return [
    `Which product are you asking about?`,
    `What's the product name or a link? I'll pull the details.`,
    `Tell me a bit more about what you're after and I'll point you right.`,
  ];
  if (topics.includes('account')) return [
    `${lead}What's the email on the account? I'll take a look.`,
    `What happens when you try to log in?`,
    `${lead}Confirm the email tied to it and I'll check.`,
  ];

  // — complaint —
  if (topics.includes('complaint')) {
    if (analysis?.isLongConversation) return [
      `${lead}This has gone on too long, I'm getting it handled now.`,
      `Not resolved yet, I know. I'm making sure it gets taken care of today.`,
      `You've been patient enough, I'm pushing this through now.`,
    ];
    return [
      `${lead}What are the specifics? I'll act on it.`,
      `I want to make this right, let me look and find the fix.`,
      `Noted, I'm looking into this myself and I'll follow up.`,
    ];
  }

  // — generic question / catch-all —
  if (analysis?.isQuestion) return [
    `${lead}Let me get you the answer, one sec.`,
    `Checking now, back with the details.`,
    `Anything else that'd help me find it faster?`,
  ];
  return [
    `${lead}Let me look into this and get back to you.`,
    `Can you give me a bit more detail so I can help?`,
    `Tell me a little more about what you need and I'll point you right.`,
  ];
}

function generateSmartFallbackSuggestions(customerMsg, chatHistory, analysis, adminNote) {
  return generateSmartFallbackSuggestionsRaw(customerMsg, chatHistory, analysis, adminNote).map(humanizeText);
}

module.exports = {
  humanizeText,
  scrubBannedPhrases,
  callAnthropicAPIWithRetry,
  callAIForSuggestions,
  extractAdminStyle,
  buildAdminStyleBlock,
  buildSystemPrompt,
  buildUserPrompt,
  detectTrustQuestion,
  detectServiceFailure,
  buildEnhancedAnalysisBlock,
  buildCustomerContext,
  buildPolicyBlock,
  parseAIResponse,
  analyzeConversationState,
  validateSuggestions,
  generateSmartFallbackSuggestionsRaw,
  generateSmartFallbackSuggestions,
};