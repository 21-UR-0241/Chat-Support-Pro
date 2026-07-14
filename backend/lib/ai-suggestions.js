// const { firstProduct, matchProducts } = require('./product-match');

// const BANNED_PHRASE_REPLACEMENTS = [
//   // — patience / inconvenience —
//   [/\bthank you for your patience\b[.!]?/gi, ''],
//   [/\bthanks for your patience\b[.!]?/gi, ''],
//   [/\bi apolog(?:ize|ise) for any inconvenience\b[.!]?/gi, 'sorry about that'],
//   [/\bwe apolog(?:ize|ise) for any inconvenience\b[.!]?/gi, 'sorry about that'],

//   // — "great question" family —
//   [/\bthat['’]s a (?:really )?great question\b[.!]?/gi, ''],
//   [/\bthat is a (?:really )?great question\b[.!]?/gi, ''],
//   [/\bgreat question\b[.!]?/gi, ''],
//   [/\bgood question\b[.!]?/gi, ''],

//   // — "happy to help" softening (keep, don't hard-ban) —
//   [/\bi['’]d be happy to help\b/gi, 'happy to help'],
//   [/\bi would be happy to help\b/gi, 'happy to help'],
//   [/\bmore than happy to\b/gi, 'happy to'],
//   [/\bi['’]d be happy to\b/gi, 'I can'],
//   [/\bi would be happy to\b/gi, 'I can'],

//   // — ownership theatre (new: Sam doc flags these hard) —
//   [/\bi['’]m personally (?:handling|taking care of|looking into) this\b[.!]?/gi, ''],
//   [/\bi am personally (?:handling|taking care of|looking into) this\b[.!]?/gi, ''],
//   [/\b(?:i['’]m|i am) (?:personally )?taking (?:full )?ownership(?: of this)?\b[.!]?/gi, ''],
//   [/\bi['’]ll personally\b/gi, "I'll"],
//   [/\bi will personally\b/gi, "I'll"],
//   [/\bon your behalf\b/gi, ''],
//   [/\brest assured(?:,| that)?\b[,.]?/gi, ''],

//   // — reach-out / hesitate / closers (new) —
//   [/\bfeel free to reach out\b/gi, 'just let me know'],
//   [/\bdon['’]t hesitate to reach out\b/gi, 'just let me know'],
//   [/\bdon['’]t hesitate to\b/gi, 'just'],
//   [/\bplease don['’]t hesitate\b[.!]?/gi, ''],
//   [/\breach out\b/gi, 'get in touch'],
//   [/\b(?:please )?let me know if (?:there['’]s|there is) anything else\b[.!]?/gi, ''],
//   [/\bif (?:there['’]s|there is) anything else (?:i can help(?: with)?|you need)\b[.!]?/gi, ''],
//   [/\bis there anything else i can help(?: you)?(?: with)?\b[.!?]?/gi, ''],
//   [/\bi['’]m here to help\b[.!]?/gi, ''],
//   [/\bi am here to help\b[.!]?/gi, ''],

//   // — signposting (new) —
//   [/\bhere['’]s what i can do\b[:.!]?/gi, ''],
//   [/\bjust to clarify\b[,]?/gi, ''],
//   [/\bto answer your question\b[,]?/gi, ''],
//   [/\bplease be advised\b[,.]?/gi, ''],
//   [/\bas per our policy\b/gi, ''],
//   [/\bas per our\b/gi, 'per our'],

//   // — misc corporate —
//   [/\bat your earliest convenience\b/gi, 'when you can'],
//   [/\bwe appreciate your\b/gi, 'thanks for your'],
//   [/\bi appreciate you bringing this to my attention\b[.!]?/gi, 'thanks for flagging this'],
//   [/\bi hope this (?:message |email )?finds you well\b[.!]?/gi, ''],
//   [/\bi['’]d like to inquire\b/gi, ''],
//   [/\bi understand your frustration\b[.!]?/gi, 'I hear you'],
//   [/\bi (?:completely |totally )?understand your frustration\b[.!]?/gi, 'I hear you'],
//   [/\bi understand your concern\b[.!]?/gi, 'I hear you'],
//   [/\bkindly\b\s*/gi, ''],
// ];

// function scrubBannedPhrases(text) {
//   if (!text || typeof text !== 'string') return text;
//   let out = text;
//   for (const [pattern, replacement] of BANNED_PHRASE_REPLACEMENTS) out = out.replace(pattern, replacement);
//   out = out
//     .replace(/[^\S\n]{2,}/g, ' ')                                  
//     .replace(/\s+([.,!?;:])/g, '$1')                              
//     .replace(/([.!?])\s*,/g, '$1')                                
//     .replace(/,\s*([.!?])/g, '$1')                                
//     .replace(/,\s*,/g, ',')                                       
//     .replace(/([.!?])[ \t]*\1+/g, '$1')                           
//     .replace(/^[\s.,!?;:]+/, '')                                  
//     .replace(/\s+$/g, '')                                         
//     .replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase()) 
//     .trim();
//   return out;
// }

// function humanizeText(text) {
//   if (!text || typeof text !== 'string') return text;
//   const dashFixed = text
//     .replace(/\s*--\s*/g, ', ')   // double-hyphen used as a dash
//     .replace(/\s*—\s*/g, ', ')    // em dash
//     .replace(/\s*–\s*/g, ', ')    // en dash used as separator
//     .replace(/,\s*,/g, ',')       // collapse accidental double commas
//     .replace(/\s+,/g, ',')        // fix stray space before comma
//     .trim();
//   const scrubbed = scrubBannedPhrases(dashFixed);

//   return scrubbed && scrubbed.length >= 4 ? scrubbed : dashFixed;
// }

// function _extractBalancedBlocks(s) {
//   const blocks = [];
//   let depth = 0, start = -1, inString = false, escape = false;
//   for (let i = 0; i < s.length; i++) {
//     const ch = s[i];
//     if (inString) {
//       if (escape) escape = false;
//       else if (ch === '\\') escape = true;
//       else if (ch === '"') inString = false;
//       continue;
//     }
//     if (ch === '"') { inString = true; continue; }
//     if (ch === '{' || ch === '[') { if (depth === 0) start = i; depth++; }
//     else if (ch === '}' || ch === ']') {
//       if (depth > 0 && --depth === 0 && start !== -1) { blocks.push(s.slice(start, i + 1)); start = -1; }
//     }
//   }
//   return blocks;
// }

// // Single string-aware pass: escape raw control chars inside strings, drop trailing commas.
// function _normalizeJSONish(s) {
//   let out = '', inString = false, escape = false;
//   for (let i = 0; i < s.length; i++) {
//     const ch = s[i];
//     if (inString) {
//       if (escape) { out += ch; escape = false; continue; }
//       if (ch === '\\') { out += ch; escape = true; continue; }
//       if (ch === '"') { inString = false; out += ch; continue; }
//       if (ch === '\n') { out += '\\n'; continue; }
//       if (ch === '\r') { out += '\\r'; continue; }
//       if (ch === '\t') { out += '\\t'; continue; }
//       out += ch; continue;
//     }
//     if (ch === '"') { inString = true; out += ch; continue; }
//     if (ch === ',') {
//       let j = i + 1; while (j < s.length && /\s/.test(s[j])) j++;
//       if (s[j] === '}' || s[j] === ']') continue; // trailing comma -> drop
//     }
//     out += ch;
//   }
//   return out;
// }

// function _robustJSONParse(s) {
//   try { return JSON.parse(s); } catch (_) {}
//   try { return JSON.parse(_normalizeJSONish(s)); } catch (_) {}
//   return undefined;
// }

// function parseAIResponse(rawContent, expectedKey = 'suggestions') {
//   if (!rawContent || typeof rawContent !== 'string') return null;

//   const normalizeShape = (v) => {
//     if (v == null || typeof v !== 'object') return null;
//     if (Array.isArray(v)) {
//       if (expectedKey === 'suggestions' && v.every(x => typeof x === 'string')) return { suggestions: v };
//       if (expectedKey === 'detailedAnswers' && v.every(x => x && typeof x === 'object' && 'text' in x)) return { detailedAnswers: v };
//       return null;
//     }
//     if (Array.isArray(v[expectedKey])) return v;
//     return null;
//   };

//   const fenceStripped = rawContent
//     .replace(/```(?:json|javascript|js)?/gi, '')
//     .replace(/```/g, '')
//     .trim();

//   // Fast path: whole thing parses and matches.
//   const wholeShaped = normalizeShape(_robustJSONParse(fenceStripped));
//   if (wholeShaped) return wholeShaped;

//   // Otherwise scan balanced blocks; last matching one wins.
//   let best = null;
//   for (const b of _extractBalancedBlocks(fenceStripped)) {
//     const shaped = normalizeShape(_robustJSONParse(b));
//     if (shaped) best = shaped;
//   }
//   return best;
// }



// const SAFETY_EFFICACY_RE = /\b(lose|losing|lost|drop|dropping|shed|shedding)\s+(weight|fat|pounds|lbs|inches)\b|\bkeep (losing|dropping|shedding|going)\b|\b(you'?ll|you will|you'?d|you can expect|expect to|you'?re still|still)\b[^.!?]*\b(lose|los(e|ing)|see|drop|shed|get|work|effective|result)\w*\b|\b(still|it'?s still|keeps?)\s*(works?|working|effective|active)\b|\b(see|seeing|get|getting)\s+(progress|results|weight ?loss)\b|\bsolid results\b|\bactive dose\b/i;
// const SAFETY_SOCIAL_PROOF_RE = /\b(a lot of|many|most|plenty of|tons of|lots of)\b[^.!?]*\b(people|customers|users|clients|find|stay|report|say|do|get)\b|\b(that'?s all (you|they|most)|works for most|is enough for most|all (you|they) need)\b/i;
// const SAFETY_BARE_SAFE_RE = /\b(is|it'?s|that'?s|perfectly|completely|totally)\s+(safe|fine)\b|\bnothing to worry\b|\bno (risk|concern|issue)s?\b|\byou'?ll be (fine|okay|ok)\b/i;
// const PROVIDER_POINTER_RE = /\b(healthcare|health care) provider\b|\byour (doctor|physician|provider|gp)\b|\bmedical (advice|professional|provider)\b|\b(talk to|check with|speak (to|with)) (a|your) (doctor|provider|healthcare)\b/i;
// const PROVIDER_POINTER_TEXT = " Since you mentioned not feeling great on a higher dose, it's worth checking with your healthcare provider before you change anything.";
 
// /**
//  *
//  * @param {string[]} suggestions
//  * @returns {{ suggestions: string[], needsReview: {index:number, reasons:string[]}[], pointerAdded: boolean }}
//  */
// function validateSafetyDosing(suggestions) {
//   if (!Array.isArray(suggestions) || suggestions.length === 0) {
//     return { suggestions: Array.isArray(suggestions) ? suggestions : [], needsReview: [], pointerAdded: false };
//   }
 
//   const needsReview = [];
//   suggestions.forEach((s, index) => {
//     if (!s || typeof s !== 'string') return;
//     const reasons = [];
//     if (SAFETY_EFFICACY_RE.test(s))     reasons.push('efficacy claim');
//     if (SAFETY_SOCIAL_PROOF_RE.test(s)) reasons.push('unverified social proof');
//     if (SAFETY_BARE_SAFE_RE.test(s))    reasons.push('bare safety assertion');
//     if (reasons.length) {
//       needsReview.push({ index, reasons });
//       console.log(`✦ [SafetyGate] flagged #${index + 1} (${reasons.join(', ')}): "${s.slice(0, 80)}"`);
//     }
//   });
 
//   const out = [...suggestions];
//   let pointerAdded = false;
//   const hasPointer = out.some(s => typeof s === 'string' && PROVIDER_POINTER_RE.test(s));
//   if (!hasPointer) {
//     const firstIdx = out.findIndex(s => typeof s === 'string' && s.trim().length > 0);
//     if (firstIdx !== -1) {
//       out[firstIdx] = (out[firstIdx] + PROVIDER_POINTER_TEXT).replace(/\s{2,}/g, ' ').trim();
//       pointerAdded = true;
//       console.log('✦ [SafetyGate] no provider pointer present — appended to first suggestion');
//     }
//   }
 
//   return { suggestions: out, needsReview, pointerAdded };
// }
 
// // ============ ANTHROPIC CLIENT (with retry) ============

// function callAnthropicAPIWithRetry(requestBody, apiKey, retries = 1, timeoutMs = 15000) {
//   const attempt = (attemptsLeft) => new Promise((resolve, reject) => {
//     const options = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(requestBody) } };
//     const req = require('https').request(options, apiRes => {
//       let body = '';
//       apiRes.on('data', chunk => { body += chunk; });
//       apiRes.on('end', () => {
//         console.log(`✦ [AI] Anthropic response status: ${apiRes.statusCode}`);
//         if (apiRes.statusCode !== 200) return reject(new Error(`Anthropic API ${apiRes.statusCode}: ${body.slice(0, 200)}`));
//         try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON from Anthropic')); }
//       });
//     });
//     req.on('error', (err) => {
//       const currentAttempt = retries - attemptsLeft + 1;
//       console.error(`✦ [AI] Attempt ${currentAttempt}/${retries} failed: ${err.message}`);
//       if (attemptsLeft > 0) setTimeout(() => attempt(attemptsLeft - 1).then(resolve).catch(reject), 1200 * currentAttempt);
//       else reject(err);
//     });
//     req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Anthropic timeout')); });
//     req.write(requestBody); req.end();
//   });
//   return attempt(retries);
// }

// async function callAIForSuggestions(requestBody, apiKey) {
//   try {
//     const { tryDeepSeekFallback } = require('./deepseek-fallback');
//     const primary = await tryDeepSeekFallback(requestBody);
//     if (primary) {
//       console.log('✦ [AI] Suggestions served via DeepSeek (primary)');
//       return { data: primary, provider: 'deepseek' };
//     }
//     console.warn('✦ [AI] DeepSeek primary unavailable — falling back to Claude');
//   } catch (err) {
//     console.warn(`✦ [AI] DeepSeek primary error: ${err.message} — falling back to Claude`);
//   }
//   console.log('✦ [AI] Suggestions served via Claude (fallback)');
//   const data = await callAnthropicAPIWithRetry(requestBody, apiKey);
//   return { data, provider: 'claude' };
// }

// // ============ AI STYLE FINGERPRINTING ============

// function extractAdminStyle(chatHistory, agentStyleSamples = []) {
//   let agentLines = agentStyleSamples.filter(s => s && s.trim().length > 8);
//   if (agentLines.length === 0 && chatHistory) {
//     agentLines = chatHistory.split('\n').filter(line => line.startsWith('Agent:')).map(line => line.replace(/^Agent:\s*/, '').trim()).filter(line => line.length > 8);
//   }
//   if (agentLines.length === 0) return null;
//   const allText = agentLines.join(' ');
//   const avgWords = Math.round(agentLines.reduce((sum, l) => sum + l.split(/\s+/).filter(Boolean).length, 0) / agentLines.length);
//   const lengthStyle = avgWords <= 12 ? 'very short (under 12 words)' : avgWords <= 25 ? 'short (12–25 words)' : avgWords <= 55 ? 'medium (25–55 words)' : 'long (55+ words)';
//   const greetingLines = agentLines.filter(l => /^(hi|hey|hello|heya|sup)\b/i.test(l.trim()));
//   const greetingRatio = greetingLines.length / agentLines.length;
//   const greetingNote = greetingRatio >= 0.3 ? `often opens with "${greetingLines[0].split(' ')[0]}" — do the same` : 'usually jumps straight into the reply without a greeting — do the same';
//   const lowercaseLines = agentLines.filter(l => /[a-z]/.test(l) && l === l.toLowerCase());
//   const writesLowercase = lowercaseLines.length / agentLines.length >= 0.4;
//   const exclamationCount = (allText.match(/!/g) || []).length;
//   const usesExclamation = exclamationCount / agentLines.length >= 0.4;
//   const usesEllipsis = /\.{2,}|…/.test(allText);
//   const usesEmoji = /[\u{1F300}-\u{1FFFF}]/u.test(allText);
//   const emojiMatches = allText.match(/[\u{1F300}-\u{1FFFF}]/gu) || [];
//   const contractions = (allText.match(/\b(i'm|i'll|i've|i'd|we're|we'll|we've|don't|can't|won't|it's|that's|you're|you'll|they're|there's|let's|isn't|wasn't|didn't|couldn't|wouldn't|shouldn't)\b/gi) || []).length;
//   const usesContractions = contractions / agentLines.length >= 0.5;
//   const vocab = {
//     usesJust: /\bjust\b/i.test(allText), usesActually: /\bactually\b/i.test(allText), usesAlright: /\balright\b|\baight\b/i.test(allText),
//     usesTotally: /\btotally\b/i.test(allText), usesPerfect: /\bperfect\b/i.test(allText), usesGotIt: /\bgot it\b|\bgotcha\b/i.test(allText),
//     usesNoProblem: /\bno problem\b|\bnp\b|\bno worries\b/i.test(allText), usesAbsolutely: /\babsolutely\b/i.test(allText),
//     usesSure: /\bsure\b/i.test(allText), usesYep: /\byep\b|\byup\b/i.test(allText),
//   };
//   const signoffs = { lmk: /\blmk\b|let me know/i.test(allText), reachOut: /reach out|feel free/i.test(allText), thankYou: /\bthank you\b/i.test(allText), thanks: /\bthanks[!.]?\s*$/im.test(allText), cheers: /\bcheers\b/i.test(allText), takecare: /\btake care\b/i.test(allText) };
//   const empathyPatterns = [/so sorry/i, /really sorry/i, /apologize/i, /totally understand/i, /completely understand/i, /i get it/i, /makes sense/i, /that's frustrating/i, /that sucks/i, /not okay/i, /not right/i, /we messed up/i, /our fault/i, /my bad/i];
//   const empathyPhrases = empathyPatterns.filter(p => p.test(allText)).map(p => p.source.replace(/\\/g, '').replace(/\\b/g, ''));
//   const avgSentences = agentLines.reduce((sum, l) => sum + (l.match(/[.!?]+/g) || []).length, 0) / agentLines.length;
//   const writesSingleSentence = avgSentences <= 1.3;
//   const writesMultipleSentences = avgSentences >= 2.5;
//   const phraseMap = {};
//   agentLines.forEach(line => {
//     const words = line.toLowerCase().split(/\s+/).filter(Boolean);
//     for (let i = 0; i < words.length - 1; i++) {
//       const bigram = `${words[i]} ${words[i + 1]}`;
//       if (!/^(the |a |an |to |of |in |is |it |at |on |be |by |do |go )/.test(bigram)) phraseMap[bigram] = (phraseMap[bigram] || 0) + 1;
//     }
//   });
//   const recurringPhrases = Object.entries(phraseMap).filter(([, count]) => count >= 2).sort(([, a], [, b]) => b - a).slice(0, 5).map(([phrase]) => phrase);
//   const sampleLines = agentLines.filter(l => l.split(/\s+/).length >= 5).slice(-8);
//   return { avgWords, lengthStyle, greetingNote, greetingRatio, writesLowercase, usesExclamation, usesEllipsis, usesEmoji, emojiMatches: emojiMatches.slice(0, 3), usesContractions, vocab, signoffs, empathyPhrases, writesSingleSentence, writesMultipleSentences, recurringPhrases, sampleLines, totalSamplesAnalyzed: agentLines.length };
// }

// function buildAdminStyleBlock(style) {
//   if (!style) return '';
//   const rules = [];
//   rules.push(`Match the agent's message length: ${style.lengthStyle} per reply.`);
//   rules.push(`The agent ${style.greetingNote}.`);
//   if (style.writesLowercase) rules.push(`The agent often writes in lowercase — mirror that. Don't correct their casing style.`);
//   if (style.usesContractions) rules.push(`Use contractions freely (I'll, we'll, don't, it's, you're) — the agent does.`);
//   else rules.push(`Avoid contractions — the agent writes without them.`);
//   if (style.usesExclamation) rules.push(`Use exclamation marks naturally — the agent uses them to sound warm and enthusiastic.`);
//   else rules.push(`Don't use exclamation marks — the agent keeps an even, calm tone.`);
//   if (style.usesEllipsis) rules.push(`The agent uses ellipses (…) as a natural pause or trail-off. Mirror this sparingly.`);
//   if (style.usesEmoji && style.emojiMatches.length > 0) rules.push(`The agent uses emoji: ${style.emojiMatches.join(' ')} — use these same ones where natural. Never add a lone "safe" emoji just to seem warm.`);
//   if (style.writesSingleSentence) rules.push(`The agent usually writes in single sentences. Keep replies tight and punchy.`);
//   else if (style.writesMultipleSentences) rules.push(`The agent writes in multi-sentence paragraphs — match that flow, but still one topic per reply.`);
//   const casualWords = Object.entries(style.vocab).filter(([, v]) => v).map(([k]) => k.replace('uses', '').replace('Uses', '').toLowerCase()).filter(w => w.length > 1);
//   if (casualWords.length > 0) rules.push(`The agent naturally uses words like: "${casualWords.join('", "')}". Use them where they fit.`);
//   if (style.signoffs.lmk) rules.push(`When there's a genuine open question, "let me know" / "lmk" is fine — but never tack it on when the reply is already complete.`);
//   else if (style.signoffs.cheers) rules.push(`The agent signs off with "cheers" — use this where appropriate.`);
//   else if (style.signoffs.takecare) rules.push(`The agent uses "take care" as a sign-off.`);
//   if (style.empathyPhrases.length > 0) rules.push(`When empathy is needed, use phrasing close to what the agent actually says: "${style.empathyPhrases.slice(0, 3).join('", "')}" — and only ONCE, fused into the sentence that does the work.`);
//   if (style.recurringPhrases.length > 0) rules.push(`The agent habitually uses these phrases — weave them in naturally: "${style.recurringPhrases.join('", "')}".`);
//   const sampleBlock = style.sampleLines.length > 0 ? `\nREAL MESSAGES from this agent — match this exact voice, rhythm, and vocabulary:\n${style.sampleLines.map(l => `  • "${l}"`).join('\n')}` : '';
//   return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nADMIN WRITING STYLE — mirror this precisely (non-negotiable)\nBased on ${style.totalSamplesAnalyzed} real messages from this agent.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n${sampleBlock}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
// }

// // ============ PROMPT BUILDERS ============
// const ROBOT_VS_HUMAN_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEARN FROM THESE. COPY THE VOICE, NOT THE WORDS.
// ROBOT = what the brain pushes you toward. HUMAN = what you actually send.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Late order, customer's mad
//   ROBOT: "Hey Marcus! I completely understand your frustration, and I'm personally taking full ownership of this right now. I'll personally follow up with the carrier on your behalf. Rest assured we're on it!"
//   HUMAN: "Marcus, 8 days is way too long, sorry about that. Let me pull your tracking and chase the carrier now, I'll come back with exactly where it's at."

// Chargeback threat
//   ROBOT: "Hi David, I completely understand your frustration and I'm personally handling this right now. Here's what I can do, I'll ship a replacement that matches your order exactly, plus a free mystery vial on us. This won't be open-ended, I'm on it."
//   HUMAN: "David, no chargeback needed, I've got you. I can see your order and I know it's lost. I'll get a replacement out and I'm chasing the carrier on the original now. Same address, or a new one?"

// Missing item
//   ROBOT: "Hi Mike! Thank you so much for reaching out. I've looked into your order and I can see the bacteriostatic water should have been included. I sincerely apologize for this oversight. I'll arrange a replacement and include a complimentary item as a goodwill gesture. Please let me know if there's anything else I can help with!"
//   HUMAN: "Ah, missing your BAC water, sorry Mike. Sending one out today, plus a free vial for the hassle."

// Simple "where's my order" (no failure, so don't perform one)
//   ROBOT: "Hi Sarah! Thank you for reaching out. I completely understand you'd like an update. I've taken a look and I'm happy to help. It appears your order should typically arrive within the standard window. Please don't hesitate to let me know if there's anything else!"
//   HUMAN: "Hey Sarah, nothing's stuck, it's moving normally. Here's your tracking: [link]"
//   WHY: state a shipping window ONLY if the brain gave you one this turn, and quote it exactly. If it didn't, point to tracking instead of inventing a day count. Never make up "next day" or a number.

// Yes/no question, actually answer it
//   ROBOT: "Hey Jordan! Great question! So to answer your question about whether needles come with your order, I want to make sure I get this 100% right, so I'll check on the exact inclusions for you."
//   HUMAN: "Hi Jordan, needles aren't included, you'll want U-100 insulin syringes separately. You do get 1 free BAC water per vial though. Want a link for the syringes?"

// Dosing where a route conflict exists in the brain (don't leak the conflict)
//   ROBOT: "Great question! For your 10mg Semax vial, add 2mL BAC water for 5mg/mL. A quick note, per our current admin guidance we administer SQ, not intranasal."
//   HUMAN: "Hey Priya, we run Semax subcutaneous, not nasal. What dose are you aiming for per shot? Tell me that and I'll give you the exact water amount and units."

// Trust / "how do I know this isn't a scam" (e-transfer or crypto, no card)
//   ROBOT: "Hi Mo! I completely understand your concern. Rest assured we are a legitimate business and your e-transfer is 100% safe with us. We confirm every order within a day and have thousands of happy customers. You have nothing to worry about!"
//   HUMAN: "Fair thing to ask, Mo, e-transfer isn't reversible so I get the caution. Every batch has third-party COAs and you can read our reviews before you send anything."
//   WHY: the ROBOT answer is everything a scammer would also say ("trust us", "you're safe", "nothing to worry about") plus an invented timeline. The HUMAN answer names the real reason the worry is fair, then hands over proof the customer can check THEMSELVES, pulled from the brain, never invented.

// Refund owed, repeated delay, customer's had enough (SERVICE FAILURE — do the full stack)
//   ROBOT: "Nicole, I understand. I am escalating your refund request right now. Our admin team will process it and confirm with you. I am truly sorry for the delay."
//   HUMAN: "Nicole, this dragged way too long and that's on us, sorry. Those items never actually shipped so there's no tracking to give you. I'm putting your refund through now, and if it can't go back on your original payment I'll send it by e-transfer, I'll confirm the exact timing right here, not leave you waiting again."
//   WHY: the ROBOT answer escalates and apologizes but STOPS there, it drops the alternative and gives an open-ended "will confirm" that's the exact non-answer she's already furious about. The HUMAN answer acknowledges once, answers her real question honestly (never shipped, so no tracking), commits to the refund, AND offers the brain's named alternative (e-transfer) with a promise to confirm timing in-chat. This is the ONE case where you stack acknowledge + resolution + next-step instead of sending one line.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// `;





// const SAFETY_DOSING_RE = /\bdos(e|ing|age)\b|titrat|\bmg\b|how much (do i|should i)|start(ing)? (dose|at)|move up|ramp up|increase.{0,15}dose|drop back|lower.{0,15}dose|is (it|this) safe|safe to (take|use|stay|increase)|side effect|get sick|feel sick|nause|make me sick|too much|overdose|pregnan|breastfeed|medical condition|contraindicat|interact(ion)? with|can i (take|use|stay|still)/i;
// function detectSafetyDosingQuestion(clientMessage) {
//   return SAFETY_DOSING_RE.test((clientMessage || '').toLowerCase());
// }
 
// const SAFETY_DOSING_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOSING / SAFETY QUESTION — HONESTY AND SAFETY GATES OVERRIDE EVERYTHING BELOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The customer is asking about a dose, titration, or whether something is safe for
// them. This is the highest-stakes kind of reply. The gates here are absolute:
 
// DOSES AND PROTOCOLS:
// - State a dose, mg amount, frequency, or titration step ONLY if it appears in the
//   BRAIN DATA for THIS product, quoted exactly. Confirm WHICH product first if it
//   isn't pinned down. Never carry a number over from your own knowledge, from the
//   chat history, or infer it.
// - If the brain gives no dosing rule for this product, say you'll confirm the exact
//   protocol rather than stating one.
 
// NEVER ASSERT SAFETY OR EFFICACY THE BRAIN DIDN'T STATE:
// - Never say a dose "is safe", "is a safe dose", "won't hurt", or "you'll be fine".
//   Safety is not yours to assert. Only relay a safety rule the brain explicitly gives.
// - Never promise an outcome ("you'll still see progress", "you'll lose weight",
//   "it'll work"). You can relay what the brain states about a dose, not guarantee a result.
// - Never give titration advice ("move up then drop back down") as your own judgement.
//   If the brain states a titration protocol, relay it exactly. If it doesn't, don't invent one.
 
// ALWAYS POINT TO A PROVIDER ON A SAFETY TURN:
// - Whenever the customer raises getting sick, side effects, a health condition,
//   pregnancy, other medications, or "is this safe for me" — point them to their
//   healthcare provider before changing dose. One line, fused in, not a disclaimer wall.
 
// Keep the voice human and calm. These gates change WHAT you may claim, not the tone.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
// `;


// const TRUST_QUESTION_RE = /scam|scammed|legit|legitimate|is this real|are you (real|legit)|how do i know|how can i trust|can i trust|trustworthy|reputable|sketch|sketchy|too good to be true|rip.?off|ripped off|not (getting|being) scammed|fake|is this safe|safe to (send|pay|order)|lose my money|get my money|money back if|no chargeback|not reversible|irreversible|why (no|don.t you take) card|prove (you|it)/i;
// function detectTrustQuestion(clientMessage) {
//   return TRUST_QUESTION_RE.test((clientMessage || '').toLowerCase());
// }

// const TRUST_QUESTION_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THIS IS A TRUST / "AM I GETTING SCAMMED" QUESTION — HANDLE IT DIFFERENTLY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The customer is about to send money they can't reverse (e-transfer / crypto have
// no chargeback). Their caution is reasonable. Treat it as reasonable.

// The single rule here: TRUST IS BUILT FROM WHAT THEY CAN CHECK, NOT WHAT YOU ASSERT.
// A scammer says the exact same reassuring words you'd be tempted to say. So:

// DO:
// - Acknowledge the worry once, and name WHY it's fair ("e-transfer isn't reversible,
//   so I get wanting to be sure"). Naming the real risk out loud builds credibility.
// - Point ONLY to whatever verification the BRAIN provides that the customer can
//   check themselves before paying, e.g. lab COAs, published reviews, a track record,
//   guarantees, quoted exactly as the brain states them. Checkable proof, not
//   adjectives. If the brain lists no such proof, don't invent any, offer to send
//   them whatever verification you do have and keep it honest.
// - If the brain offers a low-risk path (e.g. a smaller first order), you can offer
//   it. Don't invent one the brain doesn't support.

// NEVER:
// - Never bare-assert legitimacy: "we're legit", "your money is safe with us",
//   "you have nothing to worry about", "trust us", "we're not a scam", "100% safe".
//   These are worthless here, a scammer says all of them, so they read as a red flag.
// - Never answer the scam worry with an invented timeline ("we confirm within a day",
//   "you'll have tracking by tomorrow"). Fast confirmation does not equal legitimate,
//   it's off-topic, and it's a fake time promise on top of that.
// - Never invent proof: don't fabricate review counts, years in business, ratings,
//   certifications, guarantees, or COAs the brain doesn't actually state. Only proof
//   the brain gives you. If it gives none, say so honestly rather than making it up.
// - Don't get defensive or oversell. Calm and matter-of-fact reads as more legit
//   than enthusiastic reassurance.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// `;

// const SERVICE_FAILURE_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVICE FAILURE — THIS OVERRIDES "ONE THING, THEN STOP" FOR THIS REPLY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Something actually went wrong here: a refund is owed, a promise was missed, the
// same issue keeps dragging, or the customer is escalating. This is the ONE case
// where a single line is NOT enough — the customer needs to see the whole
// resolution or they stay angry. For THIS reply the "one thing, then stop" rule and
// the "don't stack empathy + remedy + next-step" rule are LIFTED. Do all three, in
// order, fused tight, no padding, no closer:

//   1. ACKNOWLEDGE the specific failure once, in your own words. Name the real thing
//      (the delay, the shipment that never went out, the silence), not a generic "sorry."
//   2. STATE THE RESOLUTION you're doing right now and commit to it: the refund,
//      replacement, reship, or escalation. Not "I'll look into it" — the actual action.
//   3. GIVE THE CONCRETE NEXT STEP the brain provides. If the brain names an
//      alternative (store credit, e-transfer, replacement), OFFER IT BY NAME. If the
//      brain states a specific timeline, quote it exactly. If the brain names an
//      alternative but gives NO number, still offer the alternative and say you'll
//      confirm the exact timing right here in this chat — never invent a number.

// If the customer asked a direct question (e.g. "where is my package?"), answer it
// honestly first. If the brain shows the item never shipped, say so plainly — there
// is no tracking to give, so don't imply a package is in transit.

// DO NOT end on a bare "I'll update you when it's processed" / "as soon as it's
// done" with nothing concrete attached. That open-ended non-answer is exactly what
// the customer is already furious about. If you truly have no timeline from the
// brain, commit to WHEN you'll come back with one ("I'll have that number for you
// in my next message"), never an empty "as soon as."

// Honesty gates still hold: never invent a timeframe, amount, or policy the brain
// didn't give you. Offering the brain's named alternative is REQUIRED here;
// fabricating a number is still banned. 2 to 4 sentences.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// `;

// const FAILURE_SIGNAL_RE = /refund|return|cancel|complaint|escalat|damaged|broken|wrong item|missing|not received|never (arrived|received)|replacement|reship|delay|late/i;
// function detectServiceFailure(sentiment, analysisBlock, isTrustQuestion) {
//   if (isTrustQuestion) return false;
//   if (sentiment !== 'negative' && sentiment !== 'very_negative') return false;
//   return FAILURE_SIGNAL_RE.test(analysisBlock || '');
// }

// function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext = '', brainSettings = {}, adminStyleBlock = '', imageAnalysis = '', sentiment = 'neutral', responseExamples = [], isTrustQuestion = false, isSafetyDosing = false) {
//   const hasBrain = brainContext && brainContext.trim().length > 0;
//   const trustBlock = isTrustQuestion ? TRUST_QUESTION_BLOCK : '';
//   const safetyBlock = isSafetyDosing ? SAFETY_DOSING_BLOCK : '';
//   const isServiceFailure = detectServiceFailure(sentiment, analysisBlock, isTrustQuestion);
//   const serviceFailureBlock = isServiceFailure ? SERVICE_FAILURE_BLOCK : '';
 
//   const humanVoiceBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #1 RULE — ONE MESSAGE, ONE THING, THEN STOP.
// You're a real person who already knows the answer, texting a customer fast.
// Not a call center. Not a script. Not a corporate email.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Answer the ONE thing they actually asked. Then stop. Do NOT also cover the four
// things they didn't ask. If they asked "did it ship?", the reply is whether it
// shipped, not shipping + tracking + an apology + a timeline + an offer to help
// more. That reach for "completeness" is the single biggest reason replies read as
// a bot. Say your one thing and let them reply.
 
// (The ONE exception is a genuine SERVICE FAILURE — refund owed, missed promise,
// repeated delay, escalation. If a SERVICE FAILURE block appears above, follow it:
// there you MUST give the full acknowledge + resolution + next-step, not one line.)
 
// DO:
// - Contractions, always: I'll, you're, it's, we've, don't, that's.
// - Short, plain sentences. Fragments are fine. Get to the point in the first line.
//   Most replies are 1 to 3 sentences.
// - Acknowledge ONCE, fused into the sentence that does the work: "8 days is too
//   long, sorry, let me pull your tracking." Feel it once, say it once, move on.
// - Own it in your OWN words, and only when something actually went wrong. On a
//   routine question there's nothing to own, just answer.
// - State what you know FLAT: drop the hedges (should, typically, it appears) on
//   anything the brain actually tells you. But if the brain didn't give you a
//   number, don't invent one, commit to the action instead.
// - Use their first name ONCE, near the top. Then never again in that reply.
// - Only say "let me check" for a real lookup you genuinely can't do yourself.
// - End when the answer ends. If there's a real open question, ask it. Otherwise
//   just stop.
// - Match the customer's language fully, reply in French to a French customer,
//   same human voice.
 
// NEVER (these are the tells that scream AI):
// - Don't stack empathy + ownership + remedy + timeline + reassurance in one
//   message. Pick the ONE move the moment needs. (Exception: a SERVICE FAILURE, where
//   acknowledge + resolution + next-step together ARE the one move.)
// - Don't tack on a closer: no "let me know if there's anything else", "happy to
//   help", "don't hesitate", "feel free to reach out". Most replies just end.
// - Don't signpost: no "let me look into this", "here's what I can do", "just to
//   clarify", "to answer your question".
// - Don't restate their question before answering. Don't announce a rule.
// - Don't leak the brain: never narrate internal policy, that two rules conflict,
//   or "admin guidance".
// - Never write: "I'd like to inquire", "thank you for your patience", "I apologize
//   for any inconvenience", "rest assured", "kindly", "please be advised", "at your
//   earliest convenience", "we appreciate your", "I hope this finds you well", "as
//   per our policy", "that's a great question", "I'm personally handling this",
//   "taking full ownership". Near-misses count: "Per our admin guidance" is still
//   "as per our policy". If it belongs in an email signature, don't type it.
// - Don't garnish with a lone emoji to seem warm.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
// `;
 
//   const cleanExamples = (responseExamples || [])
//     .map(r => (typeof r === 'string' ? r : r?.text))
//     .filter(t => t && t.trim().length > 15)
//     .slice(0, 4);
//   const voiceExamplesBlock = cleanExamples.length ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOW WE ACTUALLY TALK — copy this exact rhythm, word choice, and warmth.
// Real replies our best agent has sent. Match this voice.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ${cleanExamples.map(t => `  • "${t.trim()}"`).join('\n')}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
// ` : '';
 
//  const brainBlock = hasBrain ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBRAIN RULES, READ THIS BEFORE ANYTHING ELSE\nMandatory store-owner FACTS: products, doses, protocols, policies, prices, timeframes. These override every other source of FACTS, including chat history and your own knowledge. They do NOT override the voice rules above, say these facts in Sam's voice.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nA BRAIN DATA block appears in the user message below. It is the only source of truth for facts, use it exactly as given there.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCRITICAL BRAIN ENFORCEMENT:\n1. If the customer asks about a product, protocol, dosing, or anything the BRAIN DATA block covers, ANSWER IT NOW. Do NOT say "let me check".\n2. Only stall when the BRAIN DATA does NOT contain the answer AND you genuinely need external info (order status, tracking, account details).\n3. Do NOT cross-apply one product's rule to another.\n4. Every number, dose, product name, and policy term must come verbatim from the matching brain rule, never invent or round. Everything around those values, sentence shape, word choice, warmth, follows the #1 RULE voice, and still ONE thing at a time unless this is a service failure, where the full resolution is required. Do not copy brain-rule sentences word-for-word, restate the facts the way Sam talks.\n5. Never narrate that the brain exists or that any rules conflict. Just answer in your own voice.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//   const imageBlock = imageAnalysis && imageAnalysis.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA, full analysis of the agent's uploaded image, appears in the user message below.\nAll values there are CONFIRMED FACTS extracted from the screenshot.\nReference exact order numbers, statuses, amounts, dates, and names directly from that block.\nDo NOT ask for information that is already visible there.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//   const styleSection = adminStyleBlock ? `${adminStyleBlock}\n` : '';
//   let contextGuidance = '';
//   if (!hasBrain) {
//     if (contextQuality === 'minimal') contextGuidance = messageRichness === 'very_brief' || messageRichness === 'brief' ? `⚠️ FIRST BRIEF MESSAGE, greet and ask the ONE thing you need. Don't assume.` : `ℹ️ DETAILED FIRST MESSAGE, address their one concern directly. Ask only for the single missing critical thing.`;
//     else if (contextQuality === 'basic') contextGuidance = `ℹ️ BASIC CONTEXT, build on what's been discussed.`;
//     else if (contextQuality === 'good') contextGuidance = `✓ GOOD CONTEXT, avoid repeating what's been asked. Move toward resolution.`;
//     else if (contextQuality === 'excellent') contextGuidance = `✓ EXCELLENT CONTEXT, customer may be losing patience. Be efficient, one move.`;
//   } else {
//     contextGuidance = contextQuality === 'minimal' ? `ℹ️ FIRST MESSAGE: Answer the one thing you can from brain rules directly. Only ask a follow-up for something the brain doesn't cover.` : `✓ Use history + brain rules to answer the one thing they asked, specifically.`;
//   }
//   const len = brainSettings.length || 'medium';
//   const tone = brainSettings.tone || 'friendly-professional';
//   const empathy = brainSettings.empathy || 'high';
//   const isComplexComplaint = messageRichness === 'very_detailed' && (sentiment === 'very_negative' || sentiment === 'negative');
//   const lengthRule = isServiceFailure
//     ? `SERVICE FAILURE: this OVERRIDES any shorter length setting. Use 2 to 4 sentences to complete all three required moves — acknowledge once, state the resolution, give the brain's concrete next step/alternative. MAX 90 words. Never pad, but never drop the resolution or the next step just to stay short.`
//     : len === 'long'
//       ? (isComplexComplaint
//           ? `Up to 4 sentences, only because this is a genuine multi-part complaint. Acknowledge the single most important thing ONCE, fused into the sentence that fixes it, then the action. Don't cover everything they didn't ask. MAX 90 words. Reconstitution/dosing math is the one place you may go fully complete regardless.`
//           : `2 to 4 sentences MAX, and only if the message truly needs it. Usually 2 is plenty. Fuse any apology into the working sentence. MAX 70 words.`)
//       : len === 'short'
//         ? `1 to 2 sentences. Say the one thing, then stop. MAX 30 words.`
//         : `1 to 3 sentences, usually 1 or 2. Answer the one thing they asked, then stop. MAX 45 words. The only exception is reconstitution/dosing math, where the numbers must be complete and exact even if that runs a bit longer.`;
 
//   const toneRule = tone === 'formal' ? `Formal, professional, but still a real person, not a form letter. No contractions.` : tone === 'casual' ? `Casual, conversational. Contractions and fragments encouraged.` : `Friendly, direct, a little blunt, genuinely on their side. Warm but not eager or performing.`;
//   const empathyRule = empathy === 'high' ? `When something actually went wrong, lead with a short genuine acknowledgment fused into the fix. One acknowledgment, never stacked. On a routine question, skip empathy entirely and just answer.` : empathy === 'low' ? `Skip empathy preambles. Get straight to the answer.` : `Brief acknowledgment only when warranted, then the answer.`;
 
//   const qualityBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nREPLY QUALITY (admin-set, non-negotiable):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nLENGTH:  ${lengthRule}\nTONE:    ${toneRule}\nEMPATHY: ${empathyRule}`;
 
//   const nonNegotiablesBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNON-NEGOTIABLES (override the voice — correctness wins over brevity):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n- NO fake time promises. State a shipping, handling, or delivery timeframe ONLY if it appears in the BRAIN DATA for this reply, and quote the brain's numbers exactly. If the brain gave you no timeframe, do NOT state one, commit to the action, not the clock. Never invent a date or deadline of any kind.\n- Never say "same day", "next day", "overnight", "by tomorrow", or any specific speed unless the brain explicitly states it. And never infer delivery speed from where the customer is or from them saying you're "close", "local", or "nearby", proximity is not a service you offer unless the brain says so.\n- Stay honest. Never invent tracking status, stock, pickup options, or order details. If you don't know, say you're checking, for real.\n- Confirm the SPECIFIC product before giving any dosing or reconstitution answer.\n- All facts come from the brain, never from you. Product details, dosing, protocols, prices, stock, shipping, handling, returns, refunds, guarantees, eligibility, and safety rules are only what the BRAIN DATA states. Never assert a fact, number, policy, or restriction the brain didn't give you. If it's not in the brain and you can't look it up, say you'll check, don't fill the gap.\n- Safety and eligibility: apply whatever health, age, or contraindication rules the brain provides, exactly, in your own voice. Never invent one, and never give dosing or medical guidance beyond what the brain states. If a customer raises a health condition, age, or safety concern, follow the brain's rule and point them to a healthcare provider.\n- Only ever give links or URLs that appear in the brain, exactly as written. Never guess, shorten, or invent a domain.`;
 
//   const serviceFailureCoreNote = isServiceFailure
//     ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSERVICE-FAILURE EXCEPTION TO RULE 5 (applies to THIS reply only):\nBoth suggestions must EACH be a COMPLETE resolution — acknowledge once + the resolution you're doing now + the brain's concrete next step/alternative. Rule 5's SHORT variant does NOT apply here. Vary the wording and warmth between the two, NOT the completeness. Neither may drop the resolution or the next step. Still no tacked-on closer.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
//     : '';
 
//   return `${humanVoiceBlock}${ROBOT_VS_HUMAN_BLOCK}${trustBlock}${safetyBlock}${serviceFailureBlock}${voiceExamplesBlock}${brainBlock}${imageBlock}${styleSection}You ARE the support person at ${storeName || 'this store'}, texting a customer directly. Not ghostwriting, not relaying, you. The customer must feel like they're talking to the same knowledgeable person every time.\n\n${qualityBlock}\n\n${nonNegotiablesBlock}\n\n${contextGuidance}\n\n${customerContext}\n\n${analysisBlock}\n\n${policyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCORE RULES:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. Answer the ONE thing they asked. Reference something they actually said, the product, their stated goal, or the specific issue. Generic replies are not acceptable, but neither is covering things they didn't ask.\n2. NEVER say "let me check" / "let me find out" / "let me get back to you" when the brain already contains the answer.\n3. "Let me check" is ONLY for real-time lookups (order status, tracking, account balance). Never for product/knowledge questions.\n4. Never ask for info already provided. Never repeat what the agent already said.\n5. The 2 suggestions are two DIFFERENT moves, not two phrasings:\n   - Suggestion 1 (BEST): the reply you'd actually send. Complete, in Sam's voice.\n   - Suggestion 2 (SHORT): the 1-2 sentence version. Just the core fact/action.\n   If they share more than half their words, rewrite one. (SERVICE FAILURE is the exception, see the note below the rules.)\n6. Match the customer's emotional state, once, fused in. Don't perform a failure that didn't happen.\n7. No promises on timeframes or amounts unless confirmed. Shipping windows above are the only exception.\n8. CRITICAL, JSON LIMIT: each suggestion string must fit inside a JSON value and stay within the LENGTH word limit above. If tempted to write more, cut it, a truncated JSON response is a total failure.\n9. NEVER use em dashes, en dashes, or double hyphens (--). Use a comma, a period, or a new sentence. Write like a person typing in a chat.\n10. Avoid AI tells: no three-adjective stacks, no "furthermore/moreover/additionally", no throat-clearing warm-up ("Thanks so much for reaching out about your order"). Short, plain, like someone who already knows the answer.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${serviceFailureCoreNote}\nRespond ONLY with valid JSON: {"suggestions": ["reply 1", "reply 2"]}`;
// }


// function buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext, brainContext = '', imageAnalysis = '') {
//   const msgLower = clientMessage.toLowerCase();
//   const isKnowledgeQuestion = /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)|how does|how do|what is|tell me about|explain|difference between|compare|dosing|dose|protocol|reconstitut/i.test(msgLower);
//   const isOrderQuestion = /order|tracking|shipped|delivery|refund|return|cancel|charge|payment|where is|status|when will/i.test(msgLower);
//   const isTrustQuestion = detectTrustQuestion(clientMessage);
//   const questionType = isTrustQuestion ? 'TRUST/LEGITIMACY — customer fears being scammed (likely because payment is e-transfer/crypto, no chargeback). See the TRUST block above. Acknowledge the worry once, name why it is fair, then point ONLY to verification the BRAIN provides (whatever proof it lists), quoted exactly. NO bare "we are safe/legit" assertions. NO invented timelines. NO fabricated proof, numbers, or guarantees.' : isKnowledgeQuestion && !isOrderQuestion ? 'PRODUCT/KNOWLEDGE — answer directly from brain data below. Do NOT stall.' : isOrderQuestion ? 'ORDER/ACCOUNT — may need lookup. Ask for order number only if not already provided.' : 'GENERAL — use brain data if applicable.';
//   const brainBlock = brainContext?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — USE THIS DATA TO WRITE YOUR REPLIES\nThe store's knowledge base. Your replies come from here first.\nIf the answer exists below, use it immediately, in your own plain voice.\nDo NOT say "let me check" when the data is right here. Don't quote it like a spec sheet.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//   const imageBlock = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA — complete analysis of the agent's uploaded image\nCONFIRMED FACTS from the screenshot. Use them directly. Reference exact values.\nDo NOT ask for any information already visible here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//   const signals = [`QUESTION TYPE: ${questionType}`];
//   if (conversationState?.orderNumber) signals.push(`Order number: #${conversationState.orderNumber}`);
//   if (conversationState?.customerEmail && conversationState.customerEmail !== 'unknown') signals.push(`Customer email: ${conversationState.customerEmail}`);
//   const issue = conversationState?.detectedIssue || recentContext?.detectedIssue;
//   if (issue) signals.push(`Issue: ${issue.replace(/_/g, ' ')}`);
//   const wants = conversationState?.customerWants || recentContext?.customerWants || {};
//   const wantsList = Object.entries(wants).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' '));
//   if (wantsList.length > 0) signals.push(`Customer wants: ${wantsList.join(', ')}`);
//   if (conversationState?.sentiment && conversationState.sentiment !== 'neutral') signals.push(`Sentiment: ${conversationState.sentiment.replace(/_/g, ' ')}`);
//   if (conversationState?.isUrgent) signals.push(`Urgent: yes`);
//   if (conversationState?.isRepeat) signals.push(`REPEAT/FOLLOW-UP: already asked about this`);
//   if (conversationState?.isWrongItem) signals.push(`WRONG ITEM SENT — do not ask for photo, acknowledge and arrange correct shipment`);
//   if (conversationState?.customerConfirmedAddress) signals.push(`Customer confirmed address is same as on order — do NOT ask for address again`);
//   if (conversationState?.customerAskingForEmail) signals.push(`Customer is asking for an email to send documents to — provide support email`);
//   const alreadyDone = [];
//   if (conversationState?.agentAskedForOrder) alreadyDone.push('asked for order number');
//   if (conversationState?.agentAskedForEmail) alreadyDone.push('asked for email');
//   if (conversationState?.agentAskedForPhoto) alreadyDone.push('asked for photo');
//   if (conversationState?.agentAlreadyApologized) alreadyDone.push('apologized');
//   if (conversationState?.agentOfferedRefund) alreadyDone.push('offered refund');
//   if (conversationState?.agentOfferedReplacement) alreadyDone.push('offered replacement');
//   if (alreadyDone.length > 0) signals.push(`Agent already: ${alreadyDone.join(', ')} — do NOT repeat`);
//   const topics = conversationState?.detectedTopics || [];
//   if (topics.length > 0) signals.push(`Topics: ${topics.join(', ')}`);
//   if (messageEdited) signals.push(`Admin edited this message to guide suggestions`);
//   if (imageAnalysis?.trim()) signals.push(`Screenshot provided — treat the screenshot content as the PRIMARY customer message. Generate replies based on what the screenshot shows.`);
//   const lastAgent = recentContext?.lastAgentMessages?.filter(Boolean).at(-1);
//   const prevCustomer = recentContext?.lastCustomerMessages?.filter(Boolean).at(-2);
//   const recentLines = [];
//   if (lastAgent) recentLines.push(`Last agent reply: "${lastAgent}"`);
//   if (prevCustomer) recentLines.push(`Previous customer message: "${prevCustomer}"`);
//   const signalsBlock = `SIGNALS:\n${signals.map(s => `• ${s}`).join('\n')}`;
//   const recentBlock = recentLines.length > 0 ? `\nRECENT:\n${recentLines.join('\n')}` : '';
//   const historyBlock = chatHistory ? `\nCONVERSATION HISTORY:\n${chatHistory}` : '';
//   const noteBlock = adminNote ? `\nADMIN NOTE: ${adminNote}` : '';

//   const asksAboutTiming = /ship|deliver|arrive|arrival|how long|when.*(get|receive|come|arrive|ship|here)|pick.?up|walk.?in|business day|days? to|get here|reach me|takes? to/i.test(msgLower);
//   const timeframeGuard = asksAboutTiming
//     ? `\n\n⚠️ TIMEFRAME RULE (overrides all voice/length guidance):\n- State a delivery/shipping timeframe ONLY if it is written in the BRAIN data above. Never invent one.\n- The brain gives DIFFERENT figures for Canada vs the US. Do NOT mix them. Give a US customer the US range and a Canada customer the Canada range.\n- If you cannot tell which country the customer is in, do NOT guess a number — ask where they're located or point to tracking instead.\n- Quote the FULL range exactly as the brain states it. Do NOT collapse a range to its fastest end (never say "2-3 days" when the brain's range is "2-5"; never drop the upper bound).\n- Present carrier transit as a maximum ("up to X business days"), never as a guaranteed delivery date. Weekends don't count as business days.\n- This applies to both replies.`
//     : '';
//   const isFactualClaim = !isOrderQuestion && /\?|do you|can i|is it|are they|does it|will it|how (much|many|do|does)|what('| i)?s|stable|store|storage|heat|cold|cool|temperature|ingredient|contain|include|come with|safe/i.test(msgLower);
//   const brainSilenceGuard = isFactualClaim
//     ? `\n\n⚠️ FACT-SILENCE RULE: If the BRAIN data above does NOT contain the specific fact this customer is asking about, do NOT invent an answer, do NOT reassure ("you're all good", "it's fine", "quite stable"), and do NOT state a product/handling/stability claim from your own general knowledge. Instead acknowledge their point and say you'll confirm the exact detail. It is far better to say "let me confirm that and come right back" than to state something the brain never told you. This applies to both replies.`
//     : '';

//   return `${brainBlock}${imageBlock}${signalsBlock}${recentBlock}${historyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCUSTOMER MESSAGE:\n${clientMessage}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${noteBlock}${timeframeGuard}${brainSilenceGuard}\n\nUsing the brain data${imageAnalysis?.trim() ? ' and the screenshot context' : ''} above as your primary source, write 2 replies that each answer the ONE thing this customer asked, then stop. Two different moves, not two amounts of stuff. Keep each within the word limit. Return JSON only.`;
// }

// function buildEnhancedAnalysisBlock(analysis, conversationState, recentContext) {
//   if (!analysis && !conversationState && !recentContext) return '';
//   const lines = ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'CONVERSATION ANALYSIS (use this to inform your replies):', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'];
//   const richnessLabels = { 'very_detailed': '📝 VERY DETAILED MESSAGE - Customer gave lots of info, use the relevant part, still answer ONE thing', 'detailed': '📝 Detailed message - Good context to work with', 'brief': '💬 Brief message - May need to ask the one thing you need', 'very_brief': '💬 Very brief message - Likely a greeting or needs one follow-up' };
//   if (recentContext?.messageRichness && richnessLabels[recentContext.messageRichness]) lines.push(richnessLabels[recentContext.messageRichness]);
//   const issueLabels = { 'damaged': '📦 Issue Type: DAMAGED/BROKEN item - Offer replacement or refund', 'wrong_item': '📦 Issue Type: WRONG ITEM received - Own it once, arrange the correct shipment', 'missing': '📦 Issue Type: MISSING/NOT RECEIVED - Check tracking, offer reship or refund', 'late': '📦 Issue Type: LATE DELIVERY - Check tracking, be straight about it', 'quality': '📦 Issue Type: QUALITY concerns - Get the one detail you need, offer fix' };
//   if (recentContext?.detectedIssue) lines.push(issueLabels[recentContext.detectedIssue] || `📦 Issue: ${recentContext.detectedIssue}`);
//   if (recentContext?.customerWants) {
//     const wants = [];
//     if (recentContext.customerWants.refund) wants.push('REFUND'); if (recentContext.customerWants.replacement) wants.push('REPLACEMENT');
//     if (recentContext.customerWants.tracking) wants.push('TRACKING INFO'); if (recentContext.customerWants.help) wants.push('GENERAL HELP');
//     if (wants.length > 0) lines.push(`🎯 Customer explicitly wants: ${wants.join(' or ')} - Address this directly, don't hedge`);
//   }
//   const orderNum = conversationState?.orderNumber || analysis?.orderNumber;
//   if (orderNum) lines.push(`📦 Order Number: ${orderNum} — reference it, DO NOT ask for it again`);
//   if (conversationState?.productName) lines.push(`🏷️  Product: ${conversationState.productName} — Reference this specifically`);
//   if (conversationState?.customerEmail && conversationState.customerEmail !== 'unknown') lines.push(`📧 Email: ${conversationState.customerEmail} — DO NOT ask for email again`);
//   if (analysis?.detectedTopics?.length > 0) {
//     const topicLabels = { order_status: 'Order Status / Tracking', refund_return: 'Refund / Return / Cancellation', product_issue: 'Product Issue / Damaged / Defective', payment: 'Payment / Billing', discount_promo: 'Discount / Promo Code', product_inquiry: 'Product Inquiry', shipping: 'Shipping Questions', account: 'Account Issue', complaint: 'Complaint / Escalation', gratitude: 'Customer Expressing Thanks', greeting: 'Greeting / Opening' };
//     lines.push(`🏷️  Topics: ${analysis.detectedTopics.map(t => topicLabels[t] || t).join(', ')}`);
//   }
//   const sentimentLabels = { very_negative: '😡 VERY UPSET / ANGRY — One genuine acknowledgment fused into the fix, then act. Don\'t stack apologies', negative: '😟 FRUSTRATED / UNHAPPY — Acknowledge once, in your own words, then the answer', neutral: '😐 NEUTRAL — Just answer, efficiently. No performed empathy', positive: '😊 POSITIVE / FRIENDLY — Match their energy, keep it short', very_positive: '🎉 VERY HAPPY / GRATEFUL — Warm and brief, a line is enough' };
//   if (analysis?.sentiment) lines.push(`${sentimentLabels[analysis.sentiment] || analysis.sentiment}`);
//   if (analysis?.isUrgent || conversationState?.isEscalating) lines.push('⚠️  URGENT / ESCALATING — Commit to the action now. Don\'t invent a deadline');
//   if (analysis?.isRepeat || conversationState?.customerMessageCount >= 3) lines.push('🔁 CUSTOMER REPEATING / FOLLOWING UP — They feel unheard. Acknowledge the drag ONCE and take the action now.');
//   if (conversationState?.isLongConversation) lines.push(`⏰ LONG CONVERSATION (${conversationState.turnCount} messages) — Be efficient, one move, solution-oriented.`);
//   if (analysis?.isQuestion) lines.push('❓ Direct question asked — Answer THAT question specifically, don\'t deflect or pad');
//   if (analysis?.hasAttachment || conversationState?.hasAttachment) lines.push('📎 Customer sent file/image — Acknowledge you\'ve seen it, briefly');
//   if (analysis?.agentAskedForOrder || conversationState?.agentAskedForOrder) lines.push('🚫 Agent ALREADY asked for order number — DO NOT ask again');
//   if (analysis?.agentAskedForEmail || conversationState?.agentAskedForEmail) lines.push('🚫 Agent ALREADY asked for email — DO NOT ask again');
//   if (analysis?.agentAskedForPhoto || conversationState?.agentAskedForPhoto) lines.push('🚫 Agent ALREADY asked for photo — DO NOT ask again');
//   if (analysis?.agentAlreadyApologized || conversationState?.agentAlreadyApologized) lines.push('🚫 Agent ALREADY apologized — no more sorries, just action');
//   if (analysis?.agentOfferedRefund) lines.push('💰 Agent already mentioned refund — confirm the next step, don\'t re-pitch it');
//   if (analysis?.agentOfferedReplacement) lines.push('🔄 Agent already offered replacement — confirm shipping detail, don\'t re-offer');
//   const lastMsg = (analysis?.lastAgentText || conversationState?.lastAgentMessage || '').substring(0, 150);
//   if (lastMsg) lines.push(`💬 Agent's last message: "${lastMsg}${lastMsg.length >= 150 ? '...' : ''}" — Don't repeat this`);
//   return lines.length > 2 ? lines.join('\n') : '';
// }

// function buildCustomerContext(customerName, customerEmail, conversationState) {
//   const lines = [`CUSTOMER: ${customerName || 'Guest'}${customerEmail ? ` (${customerEmail})` : ''}`];
//   if (conversationState?.customerHistory) lines.push(`Customer History: ${conversationState.customerHistory.totalOrders || 0} previous orders`);
//   return lines.join('\n');
// }

// function buildPolicyBlock() {
//   return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BRAND VOICE & ESCALATION:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Brand Voice:
// - Friendly, direct, a little blunt, genuinely on the customer's side.
// - Warm without performing. Relaxed, not eager. You've done this a hundred times.
// - Action-oriented, when there's a next step, name it in one line.
// - Honest, if you don't know, say you're checking, for real.

// Auto-Escalation Triggers:
// - Customer uses words like "lawyer", "sue", "fraud", "scam".
// - Customer explicitly asks for manager/supervisor.
// - 3+ messages about the same unresolved issue.
// - Very negative sentiment + repeat customer.
// When escalating, say it plainly in one line ("I'm getting this in front of the
// right person now"), don't recite ownership theatre.`;
// }

// // ============ CONVERSATION STATE ============

// function analyzeConversationState(chatHistory, clientMessage, analysis) {
//   const fullText = `${chatHistory || ''} ${clientMessage || ''}`.toLowerCase();
//   const messages = (chatHistory || '').split('\n').filter(m => m.trim());
//   const orderMatch = fullText.match(/(?:order|#)\s*#?(\d{4,})/i);
//   const orderNumber = orderMatch ? orderMatch[1] : null;
//   const emailMatch = fullText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
//   const customerEmail = emailMatch ? emailMatch[0] : null;
//   const msgLower = (clientMessage || '').toLowerCase();
 
//   // Product anchor. On a follow-up turn ("can I stay at that dose?", "is that
//   // safe?") the current message names no product — it's two turns back. Fall
//   // back to the most recent product mentioned anywhere in the conversation so
//   // the dosing/product anchor doesn't silently vanish exactly when the question
//   // gets more specific. matchProducts(...).at(-1) picks the LAST product named,
//   // so a conversation that switched products anchors on the current one.
//   const productName =
//     firstProduct(clientMessage) ||
//     matchProducts(chatHistory).at(-1) ||
//     null;
 
//   const isWrongItem = /ordered.{0,40}received|sent.{0,30}instead|received.{0,30}instead/i.test(fullText) || /wrong (item|product|vial|size|dose|peptide)/i.test(fullText);
//   const wordCount = (clientMessage || '').split(/\s+/).filter(Boolean).length;
//   const messageRichness = wordCount >= 30 ? 'very_detailed' : wordCount >= 15 ? 'detailed' : wordCount >= 5 ? 'brief' : 'very_brief';
//   const customerConfirmedAddress = /address.{0,30}(same|correct|on file|on the order|unchanged)/i.test(msgLower) || /contact.{0,30}(same|correct|on file|on the order)/i.test(msgLower) || /same as.{0,20}order/i.test(msgLower);
//   const customerAskingForEmail = /email.{0,30}(address|send|reach|contact)/i.test(msgLower) || /where.{0,20}(send|email)/i.test(msgLower);
//   const customerMessages = messages.filter(m => m.startsWith('Customer:') || m.startsWith('Client:'));
//   const agentMessages = messages.filter(m => m.startsWith('Agent:') || m.startsWith('Support:'));
//   const customerMessageCount = customerMessages.length;
//   const lastAgentMessage = agentMessages[agentMessages.length - 1] || '';
//   return {
//     orderNumber, customerEmail: customerEmail || 'unknown', productName, customerMessageCount, lastAgentMessage, messageRichness, isWrongItem, customerConfirmedAddress, customerAskingForEmail,
//     agentAskedForOrder: /order number|order #|order id/i.test(lastAgentMessage),
//     agentAskedForEmail: /email|e-mail address/i.test(lastAgentMessage),
//     agentAskedForPhoto: /photo|picture|image|screenshot/i.test(lastAgentMessage),
//     agentAlreadyApologized: /sorry|apologize|apologies/i.test(lastAgentMessage),
//     agentOfferedRefund: /refund|money back/i.test(lastAgentMessage),
//     agentOfferedReplacement: /replacement|replace|reship/i.test(lastAgentMessage),
//     isEscalating: /manager|supervisor|escalate|unacceptable|ridiculous|lawsuit|lawyer|sue|fraud|scam|bbb|attorney general/i.test(clientMessage),
//     hasAttachment: /attached|attachment|photo|image|screenshot|picture|file/i.test(clientMessage),
//     isLongConversation: customerMessageCount >= 4,
//     turnCount: Math.max(customerMessageCount, agentMessages.length),
//     extractedEntities: { ...(orderNumber && { order_number: orderNumber }), ...(productName && { product: productName }), ...(customerEmail && customerEmail !== 'unknown' && { email: customerEmail }) },
//   };
// }
 

// // ============ VALIDATION ============

// function validateSuggestions(suggestions, conversationState, chatHistory) {
//   if (!Array.isArray(suggestions)) return [];
//   const hasOrderNumber = !!conversationState?.orderNumber;
//   const hasEmail = conversationState?.customerEmail && conversationState.customerEmail !== 'unknown';
//   return suggestions.filter((suggestion, index) => {
//     if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length < 10) { console.log(`✦ [Validate] Filtered ${index + 1}: too short`); return false; }
//     if (/as an ai|i'm a bot|i'm an assistant|as an assistant/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: mentions being AI`); return false; }
//     if (hasOrderNumber && /\b(can you|could you|please provide|would you.*provide|share your).*?(order number|order #|order id)\b/i.test(suggestion) && !/order #?\d+/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: asking for order number already provided`); return false; }
//     if (hasEmail && /\b(can you|could you|please provide|would you.*provide|share your).*?(email address|your email)\b/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: asking for email already provided`); return false; }
//     return true;
//   });
// }

// // ============ SMART FALLBACK SUGGESTIONS ============

// function generateSmartFallbackSuggestionsRaw(customerMsg, chatHistory, analysis, adminNote) {
//   const lower = (customerMsg || '').toLowerCase();
//   const topics = analysis?.detectedTopics || [];
//   const sentiment = analysis?.sentiment || 'neutral';
//   const isRepeat = analysis?.isRepeat || false;
//   const hasOrderNumber = analysis?.hasOrderNumber || /\b\d{4,}\b/.test(customerMsg + chatHistory);
//   const hasAttachment = analysis?.hasAttachment || /attach|photo|image/i.test(customerMsg);
//   const agentAskedForOrder = analysis?.agentAskedForOrder || false;
//   const agentAlreadyApologized = analysis?.agentAlreadyApologized || false;
//   const messageRichness = analysis?.messageRichness || 'brief';
//   const customerAlreadyExplained = messageRichness === 'very_detailed' || messageRichness === 'detailed';
//   const isWrongItem = /ordered.{0,40}received|sent.{0,30}instead|received.{0,30}instead|wrong (item|product|vial|size|dose|peptide)/i.test(customerMsg + chatHistory) || topics.includes('wrong_item');
//   const customerAskingForEmail = /email.{0,30}(address|send|reach|contact)/i.test(lower) || /where.{0,20}(send|email)/i.test(lower);

//   const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
//   let lead = '';
//   if (!agentAlreadyApologized) {
//     if (isRepeat) lead = pick(['Sorry this has dragged on. ', 'I know this has taken too long, sorry. ']);
//     else if (sentiment === 'very_negative') lead = pick(["I'm really sorry about this. ", "That's not okay and I want to fix it. "]);
//     else if (sentiment === 'negative') lead = pick(['Sorry about that. ', 'I hear you. ', 'Thanks for flagging this. ']);
//   }

//   // — pure gratitude: the whole reply IS a short warm line, no closer tacked on —
//   if (topics.includes('gratitude') && topics.length === 1 && (sentiment === 'positive' || sentiment === 'very_positive')) {
//     return ["Anytime!", "You got it.", "No worries at all, glad it's sorted."];
//   }

//   // — greeting: one line, ask the one thing —
//   if (topics.length === 1 && topics.includes('greeting') && lower.trim().split(/\s+/).length <= 3) {
//     return ['Hey! What can I help you with?', "Hi, what do you need a hand with?", "Hey there, what's up?"];
//   }

//   if (detectTrustQuestion(customerMsg)) {
//     return [
//       "Fair thing to ask. E-transfer isn't reversible so I get wanting to be sure, let me get you what you need to check us out before you send anything.",
//       "Totally fair to want to verify first. Give me a sec and I'll pull together everything you can use to confirm we're the real deal.",
//       "Get it, you can't claw back an e-transfer so you want to be sure. What would make you comfortable? I'll get you whatever you need to check before paying.",
//     ];
//   }

//   // — product issue —
//   if (topics.includes('product_issue')) {
//     if (isWrongItem) {
//       if (customerAskingForEmail) return [
//         `${lead}Send your order list to support@pepscustomercare.com and I'll get the right items out to you.`,
//         `That's our mistake. Email your order list to support@pepscustomercare.com and I'll match it and ship the correct one.`,
//         `${lead}Shoot your order details to support@pepscustomercare.com and I'll sort the correct products.`,
//       ];
//       return [
//         `${lead}I'll get the correct item sent out, no need to return anything.`,
//         `That's on us. Same shipping address as the order, or a new one?`,
//         `${lead}Shipping the right one now, I'll send tracking once it's out.`,
//       ];
//     }
//     if (customerAlreadyExplained) return [
//       `${lead}Got everything I need from that, let me pull your order and fix it.`,
//       `I can see exactly what happened. Pulling your order now.`,
//       `${lead}All noted, I'm getting the right items lined up for you.`,
//     ];
//     if (hasOrderNumber && hasAttachment) return [
//       `${lead}Got the photo and your order, looking now.`,
//       `I can see the issue from the photo. Replacement or refund, your call?`,
//       `${lead}Issue's noted on your order, sorting the fix now.`,
//     ];
//     if (hasOrderNumber && !hasAttachment && !analysis?.agentAskedForPhoto) return [
//       `${lead}Can you send a quick photo of what you got? That'll speed this up.`,
//       `Found your order. A pic of what arrived and I'll sort it fast.`,
//       `${lead}Send a photo when you can and I'll pick the best fix.`,
//     ];
//     if (!hasOrderNumber && !agentAskedForOrder) return [
//       `${lead}What's your order number? I'll pull it up.`,
//       `Drop your order number and a quick line on what's wrong.`,
//       `${lead}Order number and a photo if you've got one, and I'm on it.`,
//     ];
//     return [
//       `${lead}Looking into this now, back shortly with a fix.`,
//       `One sec, checking the options to fix this.`,
//       `${lead}Want to get this right, let me check your case.`,
//     ];
//   }

//   // — order status / shipping —
//   if (topics.includes('order_status') || topics.includes('shipping')) {
//     if (hasOrderNumber) return [
//       `Let me pull the tracking on that now.`,
//       `Checking your order, I'll have the latest shipping update in a sec.`,
//       `On it, let me see where your order's at.`,
//     ];
//     if (!agentAskedForOrder) return [
//       `What's your order number? I'll check it.`,
//       `Give me your order number or the email you checked out with and I'll look.`,
//       `Order number's in your confirmation email, drop it here and I'll pull it up.`,
//     ];
//     return [
//       `Checking your order now, I'll send tracking as soon as I have it.`,
//       `One sec, pulling the shipping status.`,
//       `Verifying where it's at now.`,
//     ];
//   }

//   // — refund / return —
//   if (topics.includes('refund_return')) {
//     if (hasOrderNumber) return [
//       `${lead}Found your order, checking the return options now.`,
//       `Pulling your order, I'll tell you the next step in a sec.`,
//       `What's the reason for the return? That lets me sort it faster.`,
//     ];
//     if (!agentAskedForOrder) return [
//       `${lead}What's your order number? I'll check the return options.`,
//       `Drop your order number, it's in your confirmation email, and I'll start it.`,
//       `Order number and the reason for the return, and I'm on it.`,
//     ];
//     return [
//       `${lead}Checking your return now.`,
//       `One sec, looking at the return policy for your order.`,
//       `Refund to your original payment or store credit?`,
//     ];
//   }

//   // — payment —
//   if (topics.includes('payment')) {
//     if (hasOrderNumber) return [
//       `${lead}Pulling your order to check the payment now.`,
//       `Checking the billing on your order.`,
//       `${lead}Looking at the charge now, back shortly.`,
//     ];
//     return [
//       `What's your order number or the email tied to the charge?`,
//       `Order number, date, and amount, and I'll trace the charge.`,
//       `Order number and the last four of the card used, and I'll dig in.`,
//     ];
//   }

//   // — promo / product inquiry / account —
//   if (topics.includes('discount_promo')) return [
//     `What's the code, and which items are you putting it on?`,
//     `Which promo do you mean, or what's the code?`,
//     `What product or category are you after? I'll check what's running.`,
//   ];
//   if (topics.includes('product_inquiry')) return [
//     `Which product are you asking about?`,
//     `What's the product name or a link? I'll pull the details.`,
//     `Tell me a bit more about what you're after and I'll point you right.`,
//   ];
//   if (topics.includes('account')) return [
//     `${lead}What's the email on the account? I'll take a look.`,
//     `What happens when you try to log in?`,
//     `${lead}Confirm the email tied to it and I'll check.`,
//   ];

//   // — complaint —
//   if (topics.includes('complaint')) {
//     if (analysis?.isLongConversation) return [
//       `${lead}This has gone on too long, I'm getting it handled now.`,
//       `Not resolved yet, I know. I'm making sure it gets taken care of today.`,
//       `You've been patient enough, I'm pushing this through now.`,
//     ];
//     return [
//       `${lead}What are the specifics? I'll act on it.`,
//       `I want to make this right, let me look and find the fix.`,
//       `Noted, I'm looking into this myself and I'll follow up.`,
//     ];
//   }

//   // — generic question / catch-all —
//   if (analysis?.isQuestion) return [
//     `${lead}Let me get you the answer, one sec.`,
//     `Checking now, back with the details.`,
//     `Anything else that'd help me find it faster?`,
//   ];
//   return [
//     `${lead}Let me look into this and get back to you.`,
//     `Can you give me a bit more detail so I can help?`,
//     `Tell me a little more about what you need and I'll point you right.`,
//   ];
// }

// function generateSmartFallbackSuggestions(customerMsg, chatHistory, analysis, adminNote) {
//   return generateSmartFallbackSuggestionsRaw(customerMsg, chatHistory, analysis, adminNote).map(humanizeText);
// }

// module.exports = {
//   humanizeText,
//   scrubBannedPhrases,
//   callAnthropicAPIWithRetry,
//   callAIForSuggestions,
//   extractAdminStyle,
//   buildAdminStyleBlock,
//   buildSystemPrompt,
//   buildUserPrompt,
//   detectTrustQuestion,
//   detectSafetyDosingQuestion,  
//   detectServiceFailure,
//   buildEnhancedAnalysisBlock,
//   buildCustomerContext,
//   buildPolicyBlock,
//   parseAIResponse,
//   analyzeConversationState,
//   validateSuggestions,
//   validateSafetyDosing,  
//   generateSmartFallbackSuggestionsRaw,
//   generateSmartFallbackSuggestions,
// };







const { firstProduct, matchProducts } = require('./product-match');
const { canonicalProductName } = require('./product-facts');

// ============ ANCHOR RESOLUTION ============
// The peptide is the anchor. BAC water, syringes, and needles are accessories that
// happen to be "products" in the matcher — if they win the anchor, retrieval goes
// hunting for BAC water docs instead of the peptide's reconstitution rule.
const NON_ANCHOR_PRODUCT_RE = /^(bac(?:teriostatic)? water|bacteriostatic|sterile water|saline|sodium chloride|water|syringes?|insulin syringes?|needles?|alcohol (?:swabs?|wipes?|pads?)|swabs?|wipes?|vials?|caps?)$/i;

const _isAnchorable = (p) => !!p && !NON_ANCHOR_PRODUCT_RE.test(String(p).trim());

function _customerLines(chatHistory = '') {
  return String(chatHistory || '')
    .split('\n')
    .filter(l => /^\s*(customer|client)\s*:/i.test(l))
    .map(l => l.replace(/^\s*(customer|client)\s*:\s*/i, '').trim())
    .filter(Boolean);
}

/**
 * Product anchor, in priority order:
 *   1. A real product named in the CURRENT message.
 *   2. The last real product the CUSTOMER named (they pick, the agent lists).
 *   3. The last real product anywhere.
 *
 * Accessories are never the anchor, and the result is ALWAYS canonicalised.
 *
 * That last part is load-bearing. matchProducts() returns whichever alias hit, so
 * a customer typing "reta" yields the anchor "reta" — and \breta\b does not match
 * the word "Retatrutide". Every product-scoped regex downstream then silently
 * matches nothing while still appearing to run.
 */
function resolveProductAnchor(clientMessage = '', chatHistory = '') {
  const pick = (hits) => {
    const usable = (hits || []).filter(_isAnchorable);
    return usable.length ? canonicalProductName(usable.at(-1)) : null;
  };

  const inMsg = pick(matchProducts(clientMessage || ''));
  if (inMsg) return inMsg;

  const custLines = _customerLines(chatHistory);
  for (let i = custLines.length - 1; i >= 0; i--) {
    const hit = pick(matchProducts(custLines[i]));
    if (hit) return hit;
  }

  return pick(matchProducts(chatHistory || ''));
}

const _MG_RE = /(\d+(?:\.\d+)?)\s*mg\b/gi;
const _strengthsIn = (text) => [...String(text || '').matchAll(_MG_RE)].map(m => m[1]);

/**
 * Strength anchor. The trap: the agent's line "available in 5mg, 10mg, 15mg, 20mg,
 * and 30mg" is a MENU, not a choice. A forward scan grabs 5mg and anchors the wrong
 * vial. So: current message first, then walk the CUSTOMER's lines backwards, and
 * skip any line carrying 3+ strengths (that's a menu).
 */
function resolveStrengthAnchor(clientMessage = '', chatHistory = '') {
  const inMsg = _strengthsIn(clientMessage);
  if (inMsg.length) return `${inMsg.at(-1)}mg`;

  const custLines = _customerLines(chatHistory);
  for (let i = custLines.length - 1; i >= 0; i--) {
    const s = _strengthsIn(custLines[i]);
    if (s.length && s.length < 3) return `${s.at(-1)}mg`;
  }

  const lines = String(chatHistory || '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const s = _strengthsIn(lines[i]);
    if (s.length && s.length < 3) return `${s.at(-1)}mg`;
  }
  return null;
}

/**
 * When the agent hits Suggest on a one-word turn ("Hello", "?"), the live question
 * is whatever the customer last actually asked. Intent detection has to look there
 * or every gate in this file silently disarms.
 */
function _effectiveQuestion(clientMessage = '', chatHistory = '') {
  const msg = String(clientMessage || '').trim();
  if (msg.split(/\s+/).filter(Boolean).length > 4) return msg;
  const recent = _customerLines(chatHistory).slice(-3).reverse();
  const substantive = recent.find(l => l.split(/\s+/).filter(Boolean).length > 4);
  return substantive ? `${msg} ${substantive}`.trim() : msg;
}

const _IS_CLOSER_RE = /^(thanks|thank you|ty|thx|tysm|got it|gotcha|perfect|great|awesome|nice|cool|ok|okay|k|sounds good|will do|bye)\b/i;

/**
 * The customer's LIVE unanswered question.
 *
 * Returns null when the current message IS the question. Returns the earlier message
 * when the current turn is filler — "Hello", "Ok", "?", "any update" — because those
 * are the customer WAITING, not asking something new.
 *
 * Without this, the prompt hands the model `CUSTOMER MESSAGE: Hello` under a rule that
 * says "answer the ONE thing they asked", and the model either guesses the topic or
 * invents one. It is the same blind spot that disarmed the dosing gate, showing up in
 * the prompt instead of in the guards.
 */
function resolveOpenQuestion(clientMessage = '', chatHistory = '') {
  const msg = String(clientMessage || '').trim();
  const words = msg.split(/\s+/).filter(Boolean).length;
  const isFiller = _FILLER_RE.test(msg) || words <= 3;
  if (!isFiller) return null;

  const substantive = _customerLines(chatHistory).filter(l => l && !_FILLER_RE.test(l.trim()));
  return substantive.at(-1) || null;
}

/** Did the agent last reply with a stall ("checking on it now")? Then it's still open. */
function agentLastStalled(chatHistory = '') {
  const agentLines = String(chatHistory || '')
    .split('\n')
    .filter(l => /^\s*(agent|support)\s*:/i.test(l))
    .map(l => l.replace(/^\s*(agent|support)\s*:\s*/i, '').trim());
  const last = agentLines.at(-1);
  return !!last && STALL_RE.test(last);
}

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

  // — ownership theatre —
  [/\bi['’]m personally (?:handling|taking care of|looking into) this\b[.!]?/gi, ''],
  [/\bi am personally (?:handling|taking care of|looking into) this\b[.!]?/gi, ''],
  [/\b(?:i['’]m|i am) (?:personally )?taking (?:full )?ownership(?: of this)?\b[.!]?/gi, ''],
  [/\bi['’]ll personally\b/gi, "I'll"],
  [/\bi will personally\b/gi, "I'll"],
  [/\bon your behalf\b/gi, ''],
  [/\brest assured(?:,| that)?\b[,.]?/gi, ''],

  // — reach-out / hesitate / closers —
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

  // — signposting —
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
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.!?])\s*,/g, '$1')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/([.!?])[ \t]*\1+/g, '$1')
    .replace(/^[\s.,!?;:]+/, '')
    .replace(/\s+$/g, '')
    .replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase())
    .trim();
  return out;
}

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

  return scrubbed && scrubbed.length >= 4 ? scrubbed : dashFixed;
}

/**
 * Join two sentences without producing "one moment Since you mentioned...".
 * The old code did `s + POINTER` where POINTER began with a bare space, so any
 * suggestion that didn't end in punctuation got welded to the next sentence.
 */
function _appendSentence(base, addition) {
  const b = (base || '').trim();
  const a = (addition || '').trim();
  if (!a) return b;
  if (!b) return a;
  const punctuated = /[.!?]$/.test(b) ? b : `${b}.`;
  return `${punctuated} ${a}`.replace(/\s{2,}/g, ' ').trim();
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

// ============ SAFETY / DOSING GATES ============

const SAFETY_EFFICACY_RE = /\b(lose|losing|lost|drop|dropping|shed|shedding)\s+(weight|fat|pounds|lbs|inches)\b|\bkeep (losing|dropping|shedding|going)\b|\b(you'?ll|you will|you'?d|you can expect|expect to|you'?re still|still)\b[^.!?]*\b(lose|los(e|ing)|see|drop|shed|get|work|effective|result)\w*\b|\b(still|it'?s still|keeps?)\s*(works?|working|effective|active)\b|\b(see|seeing|get|getting)\s+(progress|results|weight ?loss)\b|\bsolid results\b|\bactive dose\b/i;
const SAFETY_SOCIAL_PROOF_RE = /\b(a lot of|many|most|plenty of|tons of|lots of)\b[^.!?]*\b(people|customers|users|clients|find|stay|report|say|do|get)\b|\b(that'?s all (you|they|most)|works for most|is enough for most|all (you|they) need)\b/i;
const SAFETY_BARE_SAFE_RE = /\b(is|it'?s|that'?s|perfectly|completely|totally)\s+(safe|fine)\b|\bnothing to worry\b|\bno (risk|concern|issue)s?\b|\byou'?ll be (fine|okay|ok)\b/i;
const PROVIDER_POINTER_RE = /\b(healthcare|health care) provider\b|\byour (doctor|physician|provider|gp)\b|\bmedical (advice|professional|provider)\b|\b(talk to|check with|speak (to|with)) (a|your) (doctor|provider|healthcare)\b/i;

/**
 * The provider pointer now only fires when the CUSTOMER actually raised a health
 * flag. A plain "how do I reconstitute this / what's my start dose" is a protocol
 * question, not a safety escalation — bolting a provider line onto it is noise,
 * and the old hardcoded text asserted a symptom the customer never mentioned
 * ("since you mentioned not feeling great on a higher dose").
 */
const SAFETY_ESCALATION_RE = /side ?effects?|feel(?:ing)? (?:sick|ill|off|awful|terrible|bad|weird|rough|great)|(?:got|get|getting|felt) sick|nause|vomit|throw(?:ing)? up|dizzy|headache|fatigue|pregnan|breastfeed|nursing|medical condition|diabet|thyroid|heart|blood pressure|kidney|liver|medication|other (?:meds|drugs)|on (?:a|any) (?:med|drug)|interact|contraindicat|allerg|overdose|too much|is (?:it|this) safe|safe for me|safe to (?:take|use|stay|increase)|can i (?:still )?(?:take|use)[^.!?]*(?:with|while|on)\b/i;

// Neutral, factual, asserts nothing about the customer's state.
const PROVIDER_POINTER_TEXT = "Worth running it past your healthcare provider before you start or change a dose.";

/**
 * @param {string[]} suggestions
 * @param {string}   clientMessage  the customer's current message (required for the pointer gate)
 * @returns {{ suggestions: string[], needsReview: {index:number, reasons:string[]}[], pointerAdded: boolean }}
 */
function validateSafetyDosing(suggestions, clientMessage = '') {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return { suggestions: Array.isArray(suggestions) ? suggestions : [], needsReview: [], pointerAdded: false };
  }

  const needsReview = [];
  suggestions.forEach((s, index) => {
    if (!s || typeof s !== 'string') return;
    const reasons = [];
    if (SAFETY_EFFICACY_RE.test(s))     reasons.push('efficacy claim');
    if (SAFETY_SOCIAL_PROOF_RE.test(s)) reasons.push('unverified social proof');
    if (SAFETY_BARE_SAFE_RE.test(s))    reasons.push('bare safety assertion');
    if (reasons.length) {
      needsReview.push({ index, reasons });
      console.log(`✦ [SafetyGate] flagged #${index + 1} (${reasons.join(', ')}): "${s.slice(0, 80)}"`);
    }
  });

  const out = [...suggestions];
  let pointerAdded = false;

  const customerRaisedHealthFlag = SAFETY_ESCALATION_RE.test(clientMessage || '');
  const hasPointer = out.some(s => typeof s === 'string' && PROVIDER_POINTER_RE.test(s));

  if (!customerRaisedHealthFlag) {
    console.log('✦ [SafetyGate] dosing question, no health flag raised — no provider pointer appended');
  } else if (hasPointer) {
    console.log('✦ [SafetyGate] health flag raised, provider pointer already present');
  } else {
    const firstIdx = out.findIndex(s => typeof s === 'string' && s.trim().length > 0);
    if (firstIdx !== -1) {
      out[firstIdx] = _appendSentence(out[firstIdx], PROVIDER_POINTER_TEXT);
      pointerAdded = true;
      console.log('✦ [SafetyGate] health flag raised, no pointer present — appended to first suggestion');
    }
  }

  return { suggestions: out, needsReview, pointerAdded };
}

// ============ STALL GUARD ============
// If the brain HAS the answer and the model still wrote "let me check", that's a
// failure, not a safe reply. Detect it so the caller can retry once, hard.

const STALL_RE = /\b(?:let me (?:check|confirm|find out|look|pull|get)|checking (?:on )?(?:it|that|this)|still (?:pulling|checking|confirming|looking)|pulling (?:the|your|it)|confirming (?:the|both|your)|hang tight|one moment|give me a (?:minute|sec|second)|come right back|get back to you|i'?ll (?:confirm|check|verify)|bear with me|two secs?)\b/i;

/**
 * Returns { stalled, stalledIndexes }. stalled === true means EVERY suggestion is a
 * stall while the brain holds the answer FOR THE ANCHORED PRODUCT. Caller retries once
 * with STALL_RETRY_INSTRUCTION appended.
 *
 * `brainHasProductAnswer` MUST come from brain-guards.brainHasDosingAnswer(ctx, product).
 * It is NOT a blob-wide check. A blob-wide check is always true (20+ products in 8000
 * chars, somebody's ratio is in there) and would arm the retry on a product the brain
 * knows nothing about — which is exactly how HGH Fragment's 1mL got re-badged as
 * Retatrutide's. Never pass `true` here without product-scoped evidence.
 */
function detectStall(suggestions, { isSafetyDosing = false, brainHasProductAnswer = false } = {}) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return { stalled: false, stalledIndexes: [] };
  if (!isSafetyDosing || !brainHasProductAnswer) return { stalled: false, stalledIndexes: [] };

  const stalledIndexes = suggestions
    .map((s, i) => (typeof s === 'string' && STALL_RE.test(s) ? i : -1))
    .filter(i => i !== -1);

  const stalled = stalledIndexes.length === suggestions.length;
  if (stalled) console.warn('✦ [StallGuard] all suggestions stalled while the brain holds THIS product\'s dosing answer — retrying hard');
  else if (stalledIndexes.length) console.log(`✦ [StallGuard] partial stall on #${stalledIndexes.map(i => i + 1).join(', #')}`);

  return { stalled, stalledIndexes };
}

const STALL_RETRY_INSTRUCTION = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETRY — YOUR LAST ATTEMPT STALLED. THAT IS A FAILURE.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The BRAIN DATA above contains the reconstitution volume and/or the dose for this
exact product. You wrote "let me check" / "still pulling" / "one moment" anyway.
Do not do that again.

Give the numbers NOW, exactly as the brain states them: the BAC water volume, the
resulting mg/mL, and the syringe units for the dose. Complete, in one reply, in
Sam's voice. Both suggestions must contain the actual numbers. Neither may stall.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// ============ BRAIN RETRIEVAL QUERY ============

/**
 * ROOT CAUSE FIX for "failed to fetch dosage".
 *
 * The customer's message on a follow-up turn ("10mg. How many ML do u reconstitute
 * it?" / "And what should be my start dose?") contains NO product name — the product
 * is two turns back ("reta"). If brain retrieval keys off the raw current message,
 * it searches for "how many ml reconstitute" and misses every Retatrutide rule, so
 * brainContext comes back empty and the model correctly stalls.
 *
 * Use THIS to build the retrieval query instead of the raw clientMessage: it carries
 * the resolved product anchor + strength + intent forward.
 */
function buildBrainQuery(clientMessage = '', chatHistory = '', conversationState = null) {
  const msg = String(clientMessage || '');
  const history = String(chatHistory || '');

  const product  = conversationState?.productName     || resolveProductAnchor(msg, history)  || '';
  const strength = conversationState?.productStrength || resolveStrengthAnchor(msg, history) || '';

  // Intent comes from the EFFECTIVE question. If the agent hits Suggest on "Hello",
  // the live question is whatever the customer last actually asked — read it from
  // there or every downstream gate silently disarms.
  const q = _effectiveQuestion(msg, history);

  const intents = [];
  if (/reconstitut|how (?:many|much) ml|how much (?:water|bac)|bac water|bacteriostatic|mix(?:ing)?|dilut/i.test(q)) {
    intents.push('reconstitution bacteriostatic water mL concentration mg/mL');
  }
  if (/start(?:ing)? dose|\bdose\b|dosing|dosage|units?|titrat|escalat|protocol|how much (?:do|should)|ramp|increase|weekly/i.test(q)) {
    intents.push('dosing protocol starting dose titration insulin syringe units');
  }
  if (/stor(?:e|age)|fridge|freez|expire|expiry|shelf life|heat|cold/i.test(q)) intents.push('storage stability');
  if (/stack|combine|together|with .*peptide/i.test(q)) intents.push('stacking combination');

  const query = [product, strength, ...intents, q].filter(Boolean).join(' ').trim();
  console.log(`✦ [Brain] query anchor -> product="${product || 'NONE'}" strength="${strength || 'NONE'}"`);
  if (!product) console.warn('✦ [Brain] no product anchor resolved — retrieval will miss product-specific rules, and NO dosing numbers may be stated');
  return query;
}

// ============ ANTHROPIC CLIENT (with retry) ============

function callAnthropicAPIWithRetry(requestBody, apiKey, retries = 1, timeoutMs = 15000) {
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
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Anthropic timeout')); });
    req.write(requestBody); req.end();
  });
  return attempt(retries);
}

async function callAIForSuggestions(requestBody, apiKey) {
  try {
    const { tryDeepSeekFallback } = require('./deepseek-fallback');
    const primary = await tryDeepSeekFallback(requestBody);
    if (primary) {
      console.log('✦ [AI] Suggestions served via DeepSeek (primary)');
      return { data: primary, provider: 'deepseek' };
    }
    console.warn('✦ [AI] DeepSeek primary unavailable — falling back to Claude');
  } catch (err) {
    console.warn(`✦ [AI] DeepSeek primary error: ${err.message} — falling back to Claude`);
  }
  console.log('✦ [AI] Suggestions served via Claude (fallback)');
  const data = await callAnthropicAPIWithRetry(requestBody, apiKey);
  return { data, provider: 'claude' };
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

Reconstitution + starting dose, and the brain HAS the numbers (STALLING HERE IS A FAILURE)
  ROBOT: "Still pulling the starting dose for 10mg Retatrutide, one moment. Confirming both the starting dose and reconstitution for your 10mg vial right now, hang tight."
  HUMAN: "For the 10mg vial, add 1mL of BAC water, that gives you 10mg/mL. On a 100-unit insulin syringe, 5 units (0.05mL) is your 0.5mg starting dose. Want the full weekly escalation in units?"
  WHY: the numbers were sitting in the brain. "Let me check" when you already have the answer is the single worst reply you can send, it wastes the customer's turn and reads as a bot buying time. Reconstitution math is the ONE place you go fully complete: water volume, resulting mg/mL, and syringe units, all in one reply.

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

const SAFETY_DOSING_RE = /\bdos(e|ing|age)\b|titrat|\bmg\b|how much (do i|should i)|start(ing)? (dose|at)|move up|ramp up|increase.{0,15}dose|drop back|lower.{0,15}dose|is (it|this) safe|safe to (take|use|stay|increase)|side effect|get sick|feel sick|nause|make me sick|too much|overdose|pregnan|breastfeed|medical condition|contraindicat|interact(ion)? with|can i (take|use|stay|still)|reconstitut|how many ml|bac water|bacteriostatic|\bunits?\b/i;

// Acknowledgements, greetings, nudges. These are the customer WAITING, not changing
// the subject. Treating them as a new topic is what disarmed every dosing guard on a
// live thread: the last two customer lines were "Ok" and "Hello", so the reconstitution
// question two turns further back went unseen and the gates stood down.
const _FILLER_RE = /^(ok(ay)?|k|kk|hello+|hi+|hey+|yes|yeah|yep|yup|no|nope|sure|thanks|thank you|ty|thx|tysm|got it|gotcha|perfect|great|awesome|nice|cool|sounds good|will do|bye|any update|update|still there|you there|hello\?+|\?+|\.+|…)\W*$/i;

/**
 * Conversation-aware, filler-aware.
 *
 * A short or empty-content turn does NOT mean there is no live dosing question — it
 * usually means the customer is waiting for an answer to one. Walk back through what
 * they actually said, skipping acknowledgements, and test that.
 */
function detectSafetyDosingQuestion(clientMessage, chatHistory = '') {
  const msg = String(clientMessage || '').trim();
  if (SAFETY_DOSING_RE.test(msg.toLowerCase())) return true;

  // A substantive new message that isn't about dosing: take it at face value.
  const wordCount = msg.split(/\s+/).filter(Boolean).length;
  if (wordCount > 6 && !_FILLER_RE.test(msg)) return false;

  // Short or filler turn: the live question is whatever they last really asked.
  const substantive = _customerLines(chatHistory).filter(l => l && !_FILLER_RE.test(l.trim()));
  return substantive.slice(-6).some(l => SAFETY_DOSING_RE.test(l.toLowerCase()));
}

const SAFETY_DOSING_BLOCK = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOSING / SAFETY QUESTION — HONESTY AND SAFETY GATES OVERRIDE EVERYTHING BELOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The customer is asking about a dose, reconstitution, titration, or whether something
is safe for them. This is the highest-stakes kind of reply. The gates here are absolute.

READ THIS FIRST — THESE GATES RESTRICT WHAT YOU MAY INVENT. THEY DO NOT LICENSE STALLING:
- If the BRAIN DATA contains the reconstitution volume, concentration, unit conversion,
  or dose for this product, STATE THE EXACT NUMBERS IN THIS REPLY. Do not write
  "let me check", "still pulling", "confirming that", "one moment", or "hang tight"
  when the answer is sitting in the brain block. That is a failure, not caution.
- Reconstitution/dosing math is the ONE place completeness beats brevity. Give the BAC
  water volume, the resulting mg/mL, AND the syringe units for the dose, in one reply.
  Don't split it across turns and don't make them ask twice.
- Only stall when the brain genuinely has NO rule for THIS product.

DOSES AND PROTOCOLS:
- State a dose, mg amount, mL volume, unit count, frequency, or titration step ONLY if
  it appears in the BRAIN DATA for THIS product, quoted exactly. Confirm WHICH product
  first if it isn't pinned down. Never carry a number over from your own knowledge, from
  the chat history, or infer it. Never do your own arithmetic on top of the brain's numbers.
- If the brain gives no dosing rule for this product, say you'll confirm the exact
  protocol rather than stating one.

NEVER ASSERT SAFETY OR EFFICACY THE BRAIN DIDN'T STATE:
- Never say a dose "is safe", "is a safe dose", "won't hurt", or "you'll be fine".
  Safety is not yours to assert. Only relay a safety rule the brain explicitly gives.
- Never promise an outcome ("you'll still see progress", "you'll lose weight",
  "it'll work"). You can relay what the brain states about a dose, not guarantee a result.
- Never give titration advice ("move up then drop back down") as your own judgement.
  If the brain states a titration protocol, relay it exactly. If it doesn't, don't invent one.

POINT TO A PROVIDER ONLY WHEN THE CUSTOMER ACTUALLY RAISED A HEALTH FLAG:
- If the customer raises getting sick, side effects, a health condition, pregnancy, other
  medications, or "is this safe for me" — point them to their healthcare provider before
  changing dose. One line, fused in, not a disclaimer wall.
- If they did NOT raise any of that and simply asked how to reconstitute or where to start,
  do NOT bolt on a provider line, and NEVER reference a symptom or concern they never
  mentioned. Inventing "since you mentioned not feeling great" is a fabrication.

Keep the voice human and calm. These gates change WHAT you may claim, not the tone.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

const TRUST_QUESTION_RE = /scam|scammed|legit|legitimate|is this real|are you (real|legit)|how do i know|how can i trust|can i trust|trustworthy|reputable|sketch|sketchy|too good to be true|rip.?off|ripped off|not (getting|being) scammed|fake|is this safe|safe to (send|pay|order)|lose my money|get my money|money back if|no chargeback|not reversible|irreversible|why (no|don.t you take) card|prove (you|it)/i;
function detectTrustQuestion(clientMessage) {
  return TRUST_QUESTION_RE.test((clientMessage || '').toLowerCase());
}

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

const FAILURE_SIGNAL_RE = /refund|return|cancel|complaint|escalat|damaged|broken|wrong item|missing|not received|never (arrived|received)|replacement|reship|delay|late/i;
function detectServiceFailure(sentiment, analysisBlock, isTrustQuestion) {
  if (isTrustQuestion) return false;
  if (sentiment !== 'negative' && sentiment !== 'very_negative') return false;
  return FAILURE_SIGNAL_RE.test(analysisBlock || '');
}

function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext = '', brainSettings = {}, adminStyleBlock = '', imageAnalysis = '', sentiment = 'neutral', responseExamples = [], isTrustQuestion = false, isSafetyDosing = false, brainHasProductAnswer = false) {
  const hasBrain = brainContext && brainContext.trim().length > 0;
  const trustBlock = isTrustQuestion ? TRUST_QUESTION_BLOCK : '';
  const safetyBlock = isSafetyDosing ? SAFETY_DOSING_BLOCK : '';
  const isServiceFailure = detectServiceFailure(sentiment, analysisBlock, isTrustQuestion);
  const serviceFailureBlock = isServiceFailure ? SERVICE_FAILURE_BLOCK : '';

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

(TWO exceptions. 1) A genuine SERVICE FAILURE — refund owed, missed promise,
repeated delay, escalation. 2) RECONSTITUTION/DOSING MATH, where the numbers must
be complete: water volume + resulting mg/mL + syringe units, all in one reply. If
either block appears above, follow it instead of the one-line rule.)

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
- Only say "let me check" for a real lookup you genuinely can't do yourself. If
  the brain already holds the answer, "let me check" is banned outright.
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
- Never reference a symptom, concern, or statement the customer did not actually
  make. Do not write "since you mentioned…" unless they mentioned it.
- Never write: "I'd like to inquire", "thank you for your patience", "I apologize
  for any inconvenience", "rest assured", "kindly", "please be advised", "at your
  earliest convenience", "we appreciate your", "I hope this finds you well", "as
  per our policy", "that's a great question", "I'm personally handling this",
  "taking full ownership". Near-misses count: "Per our admin guidance" is still
  "as per our policy". If it belongs in an email signature, don't type it.
- Don't garnish with a lone emoji to seem warm.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

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

 const brainBlock = hasBrain ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBRAIN RULES, READ THIS BEFORE ANYTHING ELSE\nMandatory store-owner FACTS: products, doses, protocols, policies, prices, timeframes. These override every other source of FACTS, including chat history and your own knowledge. They do NOT override the voice rules above, say these facts in Sam's voice.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nA BRAIN DATA block appears in the user message below. It is the only source of truth for facts, use it exactly as given there.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCRITICAL BRAIN ENFORCEMENT:\n1. If the customer asks about a product, protocol, dosing, reconstitution, or anything the BRAIN DATA block covers, ANSWER IT NOW with the actual numbers. Do NOT say "let me check", "still pulling", "confirming that", or "one moment". Stalling on data you already have is the worst failure mode in this system.\n2. Only stall when the BRAIN DATA does NOT contain the answer AND you genuinely need external info (order status, tracking, account details).\n3. Do NOT cross-apply one product's rule to another.\n4. Every number, dose, product name, and policy term must come verbatim from the matching brain rule, never invent or round. Everything around those values, sentence shape, word choice, warmth, follows the #1 RULE voice, and still ONE thing at a time unless this is a service failure or reconstitution math, where the full answer is required. Do not copy brain-rule sentences word-for-word, restate the facts the way Sam talks.\n5. Never narrate that the brain exists or that any rules conflict. Just answer in your own voice.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const imageBlock = imageAnalysis && imageAnalysis.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA, full analysis of the agent's uploaded image, appears in the user message below.\nAll values there are CONFIRMED FACTS extracted from the screenshot.\nReference exact order numbers, statuses, amounts, dates, and names directly from that block.\nDo NOT ask for information that is already visible there.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
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
  const lengthRule = isServiceFailure
    ? `SERVICE FAILURE: this OVERRIDES any shorter length setting. Use 2 to 4 sentences to complete all three required moves — acknowledge once, state the resolution, give the brain's concrete next step/alternative. MAX 90 words. Never pad, but never drop the resolution or the next step just to stay short.`
    : len === 'long'
      ? (isComplexComplaint
          ? `Up to 4 sentences, only because this is a genuine multi-part complaint. Acknowledge the single most important thing ONCE, fused into the sentence that fixes it, then the action. Don't cover everything they didn't ask. MAX 90 words. Reconstitution/dosing math is the one place you may go fully complete regardless.`
          : `2 to 4 sentences MAX, and only if the message truly needs it. Usually 2 is plenty. Fuse any apology into the working sentence. MAX 70 words.`)
      : len === 'short'
        ? `1 to 2 sentences. Say the one thing, then stop. MAX 30 words. EXCEPTION: reconstitution/dosing math must be complete (water volume + mg/mL + syringe units) even if that runs longer.`
        : `1 to 3 sentences, usually 1 or 2. Answer the one thing they asked, then stop. MAX 45 words. The only exception is reconstitution/dosing math, where the numbers must be complete and exact even if that runs a bit longer.`;

  const toneRule = tone === 'formal' ? `Formal, professional, but still a real person, not a form letter. No contractions.` : tone === 'casual' ? `Casual, conversational. Contractions and fragments encouraged.` : `Friendly, direct, a little blunt, genuinely on their side. Warm but not eager or performing.`;
  const empathyRule = empathy === 'high' ? `When something actually went wrong, lead with a short genuine acknowledgment fused into the fix. One acknowledgment, never stacked. On a routine question, skip empathy entirely and just answer.` : empathy === 'low' ? `Skip empathy preambles. Get straight to the answer.` : `Brief acknowledgment only when warranted, then the answer.`;

  const qualityBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nREPLY QUALITY (admin-set, non-negotiable):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nLENGTH:  ${lengthRule}\nTONE:    ${toneRule}\nEMPATHY: ${empathyRule}`;

  const nonNegotiablesBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNON-NEGOTIABLES (override the voice — correctness wins over brevity):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n- NO fake time promises. State a shipping, handling, or delivery timeframe ONLY if it appears in the BRAIN DATA for this reply, and quote the brain's numbers exactly. If the brain gave you no timeframe, do NOT state one, commit to the action, not the clock. Never invent a date or deadline of any kind.\n- Never say "same day", "next day", "overnight", "by tomorrow", or any specific speed unless the brain explicitly states it. And never infer delivery speed from where the customer is or from them saying you're "close", "local", or "nearby", proximity is not a service you offer unless the brain says so.\n- Stay honest. Never invent tracking status, stock, pickup options, or order details. If you don't know, say you're checking, for real. But if the brain DOES know, you know, answer it.\n- Never attribute a statement, symptom, or concern to the customer that they did not make.\n- Confirm the SPECIFIC product before giving any dosing or reconstitution answer. If the product was named earlier in the conversation, that IS the product, don't ask again.\n- All facts come from the brain, never from you. Product details, dosing, protocols, prices, stock, shipping, handling, returns, refunds, guarantees, eligibility, and safety rules are only what the BRAIN DATA states. Never assert a fact, number, policy, or restriction the brain didn't give you. If it's not in the brain and you can't look it up, say you'll check, don't fill the gap.\n- Safety and eligibility: apply whatever health, age, or contraindication rules the brain provides, exactly, in your own voice. Never invent one, and never give dosing or medical guidance beyond what the brain states. If a customer raises a health condition, age, or safety concern, follow the brain's rule and point them to a healthcare provider.\n- Only ever give links or URLs that appear in the brain, exactly as written. Never guess, shorten, or invent a domain.`;

  const serviceFailureCoreNote = isServiceFailure
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSERVICE-FAILURE EXCEPTION TO RULE 5 (applies to THIS reply only):\nBoth suggestions must EACH be a COMPLETE resolution — acknowledge once + the resolution you're doing now + the brain's concrete next step/alternative. Rule 5's SHORT variant does NOT apply here. Vary the wording and warmth between the two, NOT the completeness. Neither may drop the resolution or the next step. Still no tacked-on closer.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : '';

  const dosingCoreNote = !isSafetyDosing ? ''
    : brainHasProductAnswer
      ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDOSING EXCEPTION TO RULE 5 (applies to THIS reply only):\nThe brain holds this product's reconstitution/dose numbers, so BOTH suggestions must contain the actual numbers. Neither may be a stall ("let me check", "one moment", "confirming that"). Suggestion 1 = the full breakdown (water volume, resulting mg/mL, syringe units) plus the natural next question. Suggestion 2 = the same numbers, tighter. Vary the wording, NOT whether the answer is there.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 DOSING TURN WITH NO DATA FOR THIS PRODUCT (applies to THIS reply only):\nThe brain has NO reconstitution volume, concentration, or unit math for the product being asked about. It DOES have those for other products in the same block. You may not borrow, scale, or adapt them. NEITHER suggestion may contain a mL volume, an mg/mL concentration, or a syringe unit count. Both must honestly say you're confirming the exact protocol for that vial and coming right back. An invented number here is the single worst output this system can produce, worse than any stall.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return `${humanVoiceBlock}${ROBOT_VS_HUMAN_BLOCK}${trustBlock}${safetyBlock}${serviceFailureBlock}${voiceExamplesBlock}${brainBlock}${imageBlock}${styleSection}You ARE the support person at ${storeName || 'this store'}, texting a customer directly. Not ghostwriting, not relaying, you. The customer must feel like they're talking to the same knowledgeable person every time.\n\n${qualityBlock}\n\n${nonNegotiablesBlock}\n\n${contextGuidance}\n\n${customerContext}\n\n${analysisBlock}\n\n${policyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCORE RULES:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. Answer the ONE thing they asked. Reference something they actually said, the product, their stated goal, or the specific issue. Generic replies are not acceptable, but neither is covering things they didn't ask.\n2. NEVER say "let me check" / "let me find out" / "let me get back to you" / "still pulling" / "one moment" / "hang tight" when the brain already contains the answer.\n3. "Let me check" is ONLY for real-time lookups (order status, tracking, account balance). Never for product/dosing/knowledge questions.\n4. Never ask for info already provided. Never repeat what the agent already said.\n5. The 2 suggestions are two DIFFERENT moves, not two phrasings:\n   - Suggestion 1 (BEST): the reply you'd actually send. Complete, in Sam's voice.\n   - Suggestion 2 (SHORT): the 1-2 sentence version. Just the core fact/action.\n   If they share more than half their words, rewrite one. (SERVICE FAILURE and DOSING MATH are the exceptions, see the notes below the rules.)\n6. Match the customer's emotional state, once, fused in. Don't perform a failure that didn't happen.\n7. No promises on timeframes or amounts unless confirmed. Shipping windows above are the only exception.\n8. CRITICAL, JSON LIMIT: each suggestion string must fit inside a JSON value and stay within the LENGTH word limit above. If tempted to write more, cut it, a truncated JSON response is a total failure.\n9. NEVER use em dashes, en dashes, or double hyphens (--). Use a comma, a period, or a new sentence. Write like a person typing in a chat.\n10. Avoid AI tells: no three-adjective stacks, no "furthermore/moreover/additionally", no throat-clearing warm-up ("Thanks so much for reaching out about your order"). Short, plain, like someone who already knows the answer.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${serviceFailureCoreNote}${dosingCoreNote}\nRespond ONLY with valid JSON: {"suggestions": ["reply 1", "reply 2"]}`;
}

function buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext, brainContext = '', imageAnalysis = '', brainHasProductAnswer = false) {
  const msgLower = clientMessage.toLowerCase();
  const isKnowledgeQuestion = /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)|how does|how do|what is|tell me about|explain|difference between|compare|dosing|dose|protocol|reconstitut|how many ml|bac water/i.test(msgLower);
  const isOrderQuestion = /order|tracking|shipped|delivery|refund|return|cancel|charge|payment|where is|status|when will/i.test(msgLower);
  const isTrustQuestion = detectTrustQuestion(clientMessage);
  const isSafetyDosing = detectSafetyDosingQuestion(clientMessage, chatHistory);
  const questionType = isTrustQuestion ? 'TRUST/LEGITIMACY — customer fears being scammed (likely because payment is e-transfer/crypto, no chargeback). See the TRUST block above. Acknowledge the worry once, name why it is fair, then point ONLY to verification the BRAIN provides (whatever proof it lists), quoted exactly. NO bare "we are safe/legit" assertions. NO invented timelines. NO fabricated proof, numbers, or guarantees.' : isKnowledgeQuestion && !isOrderQuestion ? 'PRODUCT/KNOWLEDGE — answer directly from brain data below. Do NOT stall.' : isOrderQuestion ? 'ORDER/ACCOUNT — may need lookup. Ask for order number only if not already provided.' : 'GENERAL — use brain data if applicable.';
  const brainBlock = brainContext?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — USE THIS DATA TO WRITE YOUR REPLIES\nThe store's knowledge base. Your replies come from here first.\nIf the answer exists below, use it immediately, in your own plain voice.\nDo NOT say "let me check" when the data is right here. Don't quote it like a spec sheet.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const imageBlock = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA — complete analysis of the agent's uploaded image\nCONFIRMED FACTS from the screenshot. Use them directly. Reference exact values.\nDo NOT ask for any information already visible here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const signals = [`QUESTION TYPE: ${questionType}`];

  // ── THE LIVE QUESTION ────────────────────────────────────────────────────
  // If this turn is filler, say so LOUDLY and name the real question. Otherwise the
  // model reads "CUSTOMER MESSAGE: Hello" under a rule that says "answer the ONE thing
  // they asked" and answers the greeting, or guesses a topic, or invents one.
  const openQuestion = resolveOpenQuestion(clientMessage, chatHistory);
  const stalled = agentLastStalled(chatHistory);
  if (openQuestion) {
    signals.push(`⚠️ THIS TURN IS FILLER. The customer wrote "${String(clientMessage).trim()}" — they are WAITING, not asking something new.`);
    signals.push(`⚠️ THEIR ACTUAL UNANSWERED QUESTION IS: "${openQuestion}"`);
    signals.push(`⚠️ ANSWER THAT QUESTION. Do not greet them back, do not ask what they need, do not change the subject. They already told you what they need.${stalled ? ' The agent promised to check and never came back, so they are waiting on that answer.' : ''}`);
  } else if (stalled) {
    signals.push(`The agent's last reply was a stall ("checking on it now"). Deliver the actual answer this turn, do not stall again.`);
  }

  // Product anchor must reach the model even when the current message names no product.
  if (conversationState?.productName) signals.push(`PRODUCT ANCHOR: ${conversationState.productName}${conversationState.productStrength ? ` (${conversationState.productStrength})` : ''} — carried from earlier in the conversation. Do NOT ask which product again.`);
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

  const asksAboutTiming = /ship|deliver|arrive|arrival|how long|when.*(get|receive|come|arrive|ship|here)|pick.?up|walk.?in|business day|days? to|get here|reach me|takes? to/i.test(msgLower);
  const timeframeGuard = asksAboutTiming
    ? `\n\n⚠️ TIMEFRAME RULE (overrides all voice/length guidance):\n- State a delivery/shipping timeframe ONLY if it is written in the BRAIN data above. Never invent one.\n- The brain gives DIFFERENT figures for Canada vs the US. Do NOT mix them. Give a US customer the US range and a Canada customer the Canada range.\n- If you cannot tell which country the customer is in, do NOT guess a number — ask where they're located or point to tracking instead.\n- Quote the FULL range exactly as the brain states it. Do NOT collapse a range to its fastest end (never say "2-3 days" when the brain's range is "2-5"; never drop the upper bound).\n- Present carrier transit as a maximum ("up to X business days"), never as a guaranteed delivery date. Weekends don't count as business days.\n- This applies to both replies.`
    : '';

  const product = conversationState?.productName || null;

  // TWO mutually exclusive dosing guards, driven by PRODUCT-SCOPED evidence.
  let dosingAnswerGuard = '';
  if (isSafetyDosing && brainHasProductAnswer) {
    dosingAnswerGuard = `\n\n⚠️ DOSING ANSWER PRESENT — DO NOT STALL:\nThe BRAIN DATA above contains the reconstitution and/or dose figures for ${product}. State them. Both replies must contain the actual numbers: the BAC water volume, the resulting mg/mL, and the syringe units for the dose. "Let me check", "still pulling", "confirming that", "one moment", and "hang tight" are BANNED on this turn. Quote the brain's numbers exactly, do not perform arithmetic on top of them, and never reference a symptom the customer never mentioned.`;
  } else if (isSafetyDosing) {
    // The brain has NO dosing rule for this product. It almost certainly has one for a
    // DIFFERENT product sitting in the same block. That is the trap.
    dosingAnswerGuard = `\n\n🚨 NO DOSING DATA FOR ${product ? product.toUpperCase() : 'THIS PRODUCT'} — YOU MAY NOT STATE ANY NUMBERS:\nThe BRAIN DATA above does NOT contain a reconstitution volume, concentration, or unit conversion for ${product || 'the product being asked about'}. It DOES contain those figures for OTHER products. Those belong to those products. You may NOT borrow them, adapt them, scale them, or infer this product's ratio from them, no matter how plausible the arithmetic looks.\n\nSpecifically banned on this turn: any mL volume, any mg/mL concentration, any syringe unit count, any "add X mL of BAC water". A "1mL" that appears next to a product name in a SYRINGE spec (e.g. "1mL 29G insulin syringe") is a barrel size, NOT a reconstitution volume — do not read it as one.\n\nThe correct reply says you're confirming the exact protocol for that vial and coming straight back. That is the honest answer and it is the ONLY acceptable one here. Both replies.`;
  }

  const isFactualClaim = !isOrderQuestion && /\?|do you|can i|is it|are they|does it|will it|how (much|many|do|does)|what('| i)?s|stable|store|storage|heat|cold|cool|temperature|ingredient|contain|include|come with|safe/i.test(msgLower);
  const brainSilenceGuard = (isFactualClaim && !(isSafetyDosing && brainHasProductAnswer))
    ? `\n\n⚠️ FACT-SILENCE RULE: If the BRAIN data above does NOT contain the specific fact this customer is asking about, do NOT invent an answer, do NOT reassure ("you're all good", "it's fine", "quite stable"), and do NOT state a product/handling/stability claim from your own general knowledge, and do NOT lift a fact that belongs to a different product. Instead acknowledge their point and say you'll confirm the exact detail. It is far better to say "let me confirm that and come right back" than to state something the brain never told you. This applies to both replies.`
    : '';

  const liveQuestionBlock = openQuestion
    ? `\n\n⚠️ WHAT YOU ARE ACTUALLY ANSWERING:\nThe message above ("${String(clientMessage).trim()}") is filler. The customer is waiting. Their real, still-unanswered question is:\n\n    "${openQuestion}"\n\nAnswer THAT. Both replies. Do not greet them back, do not ask "what can I help with", do not pick a different topic. They have already told you what they need and nobody has given it to them.`
    : '';

  return `${brainBlock}${imageBlock}${signalsBlock}${recentBlock}${historyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCUSTOMER MESSAGE:\n${clientMessage}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${liveQuestionBlock}${noteBlock}${timeframeGuard}${dosingAnswerGuard}${brainSilenceGuard}\n\nUsing the brain data${imageAnalysis?.trim() ? ' and the screenshot context' : ''} above as your primary source, write 2 replies that each answer the ONE thing this customer is actually waiting on, then stop. Two different moves, not two amounts of stuff. Keep each within the word limit. Return JSON only.`;
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
  if (conversationState?.productName) lines.push(`🏷️  PRODUCT ANCHOR: ${conversationState.productName} — this is the product under discussion. Use it for every dosing/reconstitution answer. DO NOT ask which product again.`);
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
- Action-oriented, when there's a next step, name it in one line.
- Honest, if you don't know, say you're checking, for real. If you DO know, say it.

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
  const msgLower = (clientMessage || '').toLowerCase();

  // Anchors. On a follow-up turn ("how many mL do I reconstitute it?") the current
  // message names no product — it's two turns back. And the agent's "available in 5mg,
  // 10mg, 15mg, 20mg, 30mg" line is a MENU, not the customer's choice. Both resolvers
  // handle that; see the top of this file.
  const productName     = resolveProductAnchor(clientMessage, chatHistory);
  const productStrength = resolveStrengthAnchor(clientMessage, chatHistory);

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
    orderNumber, customerEmail: customerEmail || 'unknown', productName, productStrength, customerMessageCount, lastAgentMessage, messageRichness, isWrongItem, customerConfirmedAddress, customerAskingForEmail,
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
    extractedEntities: { ...(orderNumber && { order_number: orderNumber }), ...(productName && { product: productName }), ...(productStrength && { strength: productStrength }), ...(customerEmail && customerEmail !== 'unknown' && { email: customerEmail }) },
  };
}

// ============ VALIDATION ============

function validateSuggestions(suggestions, conversationState, chatHistory) {
  if (!Array.isArray(suggestions)) return [];
  const hasOrderNumber = !!conversationState?.orderNumber;
  const hasEmail = conversationState?.customerEmail && conversationState.customerEmail !== 'unknown';
  const hasProduct = !!conversationState?.productName;
  return suggestions.filter((suggestion, index) => {
    if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length < 10) { console.log(`✦ [Validate] Filtered ${index + 1}: too short`); return false; }
    if (/as an ai|i'm a bot|i'm an assistant|as an assistant/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: mentions being AI`); return false; }
    if (/\bsince you mentioned\b|\byou said you\b|\bas you mentioned\b/i.test(suggestion) && !/(chatHistoryPlaceholder)/.test('')) {
      // Not auto-filtered (can be legitimate), but loud, because the old hardcoded
      // pointer produced "since you mentioned not feeling great" out of thin air.
      console.warn(`✦ [Validate] #${index + 1} attributes a statement to the customer — verify they actually said it: "${suggestion.slice(0, 80)}"`);
    }
    if (hasOrderNumber && /\b(can you|could you|please provide|would you.*provide|share your).*?(order number|order #|order id)\b/i.test(suggestion) && !/order #?\d+/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: asking for order number already provided`); return false; }
    if (hasEmail && /\b(can you|could you|please provide|would you.*provide|share your).*?(email address|your email)\b/i.test(suggestion)) { console.log(`✦ [Validate] Filtered ${index + 1}: asking for email already provided`); return false; }
    if (hasProduct && !/\bwhich\s+(?:vial|volume|concentration|dilution|strength|size|one)\b[^.?!]{0,30}(?:water|mL|mg\/mL|did you (?:use|mix)|are you (?:going|using))/i.test(suggestion)
        && /\b(?:which|what)\s+(?:product|peptide|compound)\b[^.?!]{0,25}\b(?:are you|do you mean|is this|were you|did you)\b/i.test(suggestion)
        && !new RegExp(`\\b${String(conversationState.productName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(suggestion)) {
      console.log(`✦ [Validate] Filtered ${index + 1}: asking which product when the anchor is already ${conversationState.productName}`);
      return false;
    }
    return true;
  });
}

// ============ SMART FALLBACK SUGGESTIONS ============

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

  if (detectTrustQuestion(customerMsg)) {
    return [
      "Fair thing to ask. E-transfer isn't reversible so I get wanting to be sure, let me get you what you need to check us out before you send anything.",
      "Totally fair to want to verify first. Give me a sec and I'll pull together everything you can use to confirm we're the real deal.",
      "Get it, you can't claw back an e-transfer so you want to be sure. What would make you comfortable? I'll get you whatever you need to check before paying.",
    ];
  }

  // — dosing/reconstitution with no brain hit: never fabricate numbers, but be specific
  //   about WHAT you're confirming and don't invent a symptom the customer never raised.
  if (detectSafetyDosingQuestion(customerMsg)) {
    return [
      "Let me pull the exact reconstitution and starting dose for that vial so I give you the right numbers, not a guess.",
      "I don't want to eyeball the numbers on this one. Grabbing the exact protocol for your vial now.",
      "Confirming the exact water volume and starting units for that size vial, back in a sec.",
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
  buildBrainQuery,
  resolveProductAnchor,
  resolveStrengthAnchor,
  resolveOpenQuestion,
  agentLastStalled,
  detectTrustQuestion,
  detectSafetyDosingQuestion,
  detectServiceFailure,
  detectStall,
  STALL_RETRY_INSTRUCTION,
  buildEnhancedAnalysisBlock,
  buildCustomerContext,
  buildPolicyBlock,
  parseAIResponse,
  analyzeConversationState,
  validateSuggestions,
  validateSafetyDosing,
  generateSmartFallbackSuggestionsRaw,
  generateSmartFallbackSuggestions,
};