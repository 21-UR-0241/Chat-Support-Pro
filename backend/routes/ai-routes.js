

// const express = require('express');
// const db = require('../database');
// const { authenticateToken } = require('../auth');
// const { getBrainContext, getBrainSettings, refreshBrainCache } = require('../brain-context');

// const {
//   humanizeText,
//   callAnthropicAPIWithRetry,
//   callAIForSuggestions,
//   parseAIResponse,
//   extractAdminStyle,
//   buildAdminStyleBlock,
//   buildSystemPrompt,
//   buildUserPrompt,
//   buildBrainQuery,
//   detectTrustQuestion,
//   detectSafetyDosingQuestion,
//   detectStall,
//   detectInventedTimeframe,
//   detectUnauthorisedUpgrade,
//   detectUngroundedDate,
//   STALL_RETRY_INSTRUCTION,
//   buildEnhancedAnalysisBlock,
//   buildCustomerContext,
//   buildPolicyBlock,
//   analyzeConversationState,
//   validateSuggestions,
//   validateSafetyDosing,
//   generateSmartFallbackSuggestions,
// } = require('../lib/ai-suggestions');

// const { brainDosingCoverage, detectNumberContamination } = require('../lib/brain-guards');

// const { injectProductFacts } = require('../lib/product-facts');
// const { validateCommitments } = require('../lib/commitment-guards');

// const {
//   VOICE_VERSION,
//   PROFILES,
//   resolveVoiceProfile,
//   scrubVoice,
//   lintVoice,
//   filterOnVoiceSamples,
// } = require('../lib/voice');

// (function assertGuardsWired() {
//   const facts       = require('../lib/product-facts');
//   const guards      = require('../lib/brain-guards');
//   const commitments = require('../lib/commitment-guards');
//   const voice       = require('../lib/voice');
//   const ai          = require('../lib/ai-suggestions');

//   const required = [
//     [facts,       'lib/product-facts.js',     ['injectProductFacts', 'canonicalProductName', 'hasCanonicalDosing', 'allowedNumbersFor']],
//     [guards,      'lib/brain-guards.js',      ['brainDosingCoverage', 'brainHasDosingAnswer', 'detectNumberContamination']],
//     [commitments, 'lib/commitment-guards.js', ['validateCommitments', 'detectInventedProducts', 'detectUnauthorisedFreeOffer']],
//     [voice,       'lib/voice.js',             ['resolveVoiceProfile', 'scrubVoice', 'lintVoice', 'filterOnVoiceSamples']],
//     [ai,          'lib/ai-suggestions.js',    ['detectInventedTimeframe', 'detectUnauthorisedUpgrade', 'detectUngroundedDate']],
//   ];
//   for (const [mod, file, fns] of required) {
//     for (const fn of fns) {
//       if (typeof mod[fn] !== 'function') {
//         throw new Error(`[BOOT] Guard missing: ${file} does not export ${fn}(). Refusing to start.`);
//       }
//     }
//   }

//   // Non-function exports this file interpolates into prompts. An undefined here
//   // stringifies to the literal "undefined" inside the system prompt, and any
//   // .length read on it throws inside the request handler where the outer catch
//   // converts it to a fallback — every request serving canned templates behind a
//   // green boot log. Assert them by name so a rename fails at boot instead.
//   for (const key of ['VOICE_VERSION', 'PROFILES']) {
//     if (voice[key] == null) throw new Error(`[BOOT] lib/voice.js does not export ${key}. Refusing to start.`);
//   }

//   // Self-test the exact failures that reached customers.
//   const anchor = facts.canonicalProductName('reta');
//   if (anchor !== 'Retatrutide') {
//     throw new Error(`[BOOT] Alias canonicalisation broken: 'reta' resolved to '${anchor}', expected 'Retatrutide'. Every product-scoped regex would silently match nothing.`);
//   }

//   const dose = guards.detectNumberContamination(
//     ['Reconstitute that vial with 2.5mL BAC water for 4mg/mL.'],
//     '', 'Retatrutide'
//   );
//   if (dose.contaminated.length !== 1) {
//     throw new Error('[BOOT] Contamination guard failed to block an unauthorised dose. Refusing to start.');
//   }

//   const promise = commitments.validateCommitments(
//     ["I'll add a free Snap-8 vial to your next order as a make-good."], ''
//   );
//   if (promise.blocked.length !== 1) {
//     throw new Error('[BOOT] Commitment guard failed to block an invented free product. Refusing to start.');
//   }

//   // Voice. Every assertion below passes a REAL profile. The voice functions are
//   // deliberate no-ops without one, so a profile-less assertion proves nothing
//   // and passes vacuously.
//   const active = voice.resolveVoiceProfile({});
//   if (!active?.id) throw new Error('[BOOT] resolveVoiceProfile({}) returned no profile. Refusing to start.');

//   // Includes the dismissal and emoting content checks. If a new rule ever rejects
//   // the owner's own reply, the rule is wrong, not the reply.
//   if (active.lint) {
//     if (voice.lintVoice(active.referenceReply, active, { detailed: true }).length !== 0) {
//       throw new Error(`[BOOT] Voice linter rejects profile '${active.id}' own reference reply. The rules are wrong, not the reply. Refusing to start.`);
//     }
//   }
//   // Authorisation must be line-scoped and negation-aware. A blob-wide
//   // brainContext.includes('express') cleared "reshipping express" on a brain whose
//   // only mention was "We do not offer express shipping" — presence read as
//   // permission, polarity inverted. Assert both directions at boot.
//   const denyBrain  = 'We do not offer express shipping. Standard Canada Post only.';
//   const allowBrain = 'Express reship is approved for orders past 7 days.';
//   const upgradeSug = ["Hello! I'm reshipping express today with new tracking!"];
//   if (ai.detectUnauthorisedUpgrade(upgradeSug, denyBrain).blocked.length !== 1) {
//     throw new Error('[BOOT] Upgrade guard cleared an expedited offer on a brain that DENIES it. Presence is not permission. Refusing to start.');
//   }
//   if (ai.detectUnauthorisedUpgrade(upgradeSug, allowBrain).blocked.length !== 0) {
//     throw new Error('[BOOT] Upgrade guard blocked an expedited offer the brain explicitly approves. Refusing to start.');
//   }
//   // Sample must be UNBRACKETED (bracketed dates no longer flag — 100% noise over
//   // seven live fires) AND must make an ARRIVAL claim (a checkpoint the agent
//   // controls is not a delivery promise). "tracking by tomorrow" satisfies neither
//   // condition now, so it was asserting on a case the guard deliberately ignores.
//   if (ai.detectInventedTimeframe(['Hello! it arrives at your door by tomorrow!'], 'We cannot promise delivery by tomorrow.').review.length !== 1) {
//     throw new Error('[BOOT] Timeframe guard treated a negated brain line as authorisation. Refusing to start.');
//   }
//   if (ai.detectInventedTimeframe(['Hello! it arrives at your door by tomorrow!'], 'It arrives at your door by tomorrow.').review.length !== 0) {
//     throw new Error('[BOOT] Timeframe guard flagged a promise the brain affirmatively states. Refusing to start.');
//   }
//   // An approved live reply must be writable cleanly. "If it hasnt scanned by
//   // tomorrow, I'll reship" is a checkpoint the agent controls, not a delivery
//   // promise — flagging it made the reply unwritable either way, bracketed or not.
//   const approved = "Hello! I'm pulling your tracking right now. If it hasnt scanned by tomorrow, I'll get a brand-new package out to you express with new tracking so you wont have to chase this again.";
//   if (ai.detectInventedTimeframe([approved], 'express reship is approved').review.length !== 0) {
//     throw new Error('[BOOT] Timeframe guard flags a self-imposed checkpoint as a delivery promise. An approved reply must be writable cleanly. Refusing to start.');
//   }
//   if (ai.detectInventedTimeframe(['Hello! it will be at your door by tomorrow!'], '').review.length !== 1) {
//     throw new Error('[BOOT] Timeframe guard missed a real arrival claim. Refusing to start.');
//   }
//   if (ai.detectInventedTimeframe([active.referenceReply], '').review.length !== 0) {
//     throw new Error("[BOOT] Timeframe guard flags the owner's own reference reply. Refusing to start.");
//   }

//   // Needless brackets must self-correct to the approved wording, and vague speed
//   // must NOT be laundered into plain text by the same mechanism.
//   const needless = "Hello! if it hasnt scanned by [tomorrow], I'll reship express.";
//   if (voice.scrubVoice(needless, active) !== needless.replace('[tomorrow]', 'tomorrow')) {
//     throw new Error('[BOOT] Needless bracket not stripped. "[tomorrow]" needs no substitution, so the bracket only blocks sending. Refusing to start.');
//   }
//   const keepThese = 'Hello! its [2-3] days and I reship by [Friday] if no scan.';
//   if (voice.scrubVoice(keepThese, active) !== keepThese) {
//     throw new Error('[BOOT] Scrubber removed a SUBSTITUTABLE bracket. [2-3] and [Friday] are values the agent fills in. Refusing to start.');
//   }
//   if (voice.scrubVoice('Hello! new tracking by [asap]!', active).includes('by asap')) {
//     throw new Error('[BOOT] Scrubber laundered bracketed vague speed into plain text. "[asap]" needs a rewrite, not a bracket removal. Refusing to start.');
//   }

//   // Locks in the bracket fix: the mandated form must stay quiet and be counted.
//   const bracketed = ai.detectInventedTimeframe(['Hello! if no scan by [tomorrow] I will reship!'], '');
//   if (bracketed.review.length !== 0 || bracketed.placeholders !== 1) {
//     throw new Error('[BOOT] Timeframe guard flags bracketed placeholders, which the voice block mandates. That is noise, and noise teaches agents to ignore flags. Refusing to start.');
//   }

//   // The upgrade guard must never block the house's own approved copy. It did:
//   // "which is on us" means OUR FAULT here, and the guard read it as a comped cost,
//   // deleting a correct on-voice suggestion. Assert against the real fallback
//   // strings so the same class of false positive fails at boot, not in front of a
//   // customer.
//   const houseCopy = ai.generateSmartFallbackSuggestionsRaw('i got the wrong item', '', { detectedTopics: ['product_issue'] }, '');
//   const houseBlocked = ai.detectUnauthorisedUpgrade(houseCopy, '').blocked;
//   if (houseBlocked.length) {
//     throw new Error(`[BOOT] Upgrade guard blocks our own approved fallback copy: ${houseBlocked.map(b => b.hits.join('/')).join(', ')}. A guard that deletes house voice is worse than no guard. Refusing to start.`);
//   }
//   if (ai.detectUnauthorisedUpgrade(["Hello! that date came and went which is on us, reshipping now!"], '').blocked.length) {
//     throw new Error('[BOOT] Upgrade guard reads "on us" as a comped cost. In this house it means our fault. Refusing to start.');
//   }
//   // A past date asserted as fact is the same failure as an invented ship date,
//   // pointed backwards. Live twice: "the 12th passed with no movement" on a
//   // conversation that only ever said Wednesday.
//   if (ai.detectUngroundedDate(['Hello! the 12th passed with no movement.'], 'Customer: it was due Wednesday.').review.length !== 1) {
//     throw new Error('[BOOT] Date guard missed a calendar date absent from the conversation. Refusing to start.');
//   }
//   if (ai.detectUngroundedDate(['Hello! the 12th passed with no movement.'], 'Customer: my order was due the 12th.').review.length !== 0) {
//     throw new Error('[BOOT] Date guard flagged a date the customer actually gave. Refusing to start.');
//   }
//   if (ai.detectUngroundedDate(['Hello! reshipping by [Friday]!'], '').review.length !== 0) {
//     throw new Error('[BOOT] Date guard treats a bracketed slot as a claim. Refusing to start.');
//   }

//   if (!ai.detectUnauthorisedUpgrade(["Hello! shipping is at no cost on this one!"], '').blocked.length) {
//     throw new Error('[BOOT] Upgrade guard missed an unambiguous comped shipping cost. Refusing to start.');
//   }

//   // Opener repair is the one thing the scrubber is allowed to ADD. Assert it fixes
//   // the miss, keeps a name, is idempotent, and still cannot touch a figure.
//   if (active.openerFix) {
//     const noGreeting = "You're right, that date passed.";
//     if (voice.scrubVoice(noGreeting, active) !== `${active.openerFix} ${noGreeting}`) {
//       throw new Error('[BOOT] Opener repair did not prepend the greeting. Refusing to start.');
//     }
//     if (voice.scrubVoice('Hi Linda, its packed!', active) !== 'Hello Linda! its packed!') {
//       throw new Error('[BOOT] Opener repair dropped the customer name when converting a greeting. Refusing to start.');
//     }
//     const once = voice.scrubVoice(noGreeting, active);
//     if (voice.scrubVoice(once, active) !== once) {
//       throw new Error('[BOOT] Opener repair is not idempotent — a second scrub changes the text. Refusing to start.');
//     }
//   }

//   const factLine = 'Hello! Reconstitute the 10mg vial with 2.5mL BAC water for 4mg/mL, and it ships [Thursday]!';
//   if (voice.scrubVoice(factLine, active) !== factLine) {
//     throw new Error('[BOOT] Voice scrubber mutated a dosing line. It may only strip formatting and filler. Refusing to start.');
//   }
//   if (voice.lintVoice(factLine, active, { detailed: true }).some(f => f.code === 'length')) {
//     throw new Error('[BOOT] Voice linter flags a complete dosing reply on length. That trains agents to trim numbers out of a dose. Refusing to start.');
//   }

//   console.log(`✅ [BOOT] Safety guards wired and self-tested (reta → Retatrutide; unauthorised dose blocked; invented free product blocked; voice ${voice.VOICE_VERSION}, default profile '${active.id}', reference-clean, scrubber fact-safe, dosing exempt from length).`);
// })();

// // Tunable models in one place.
// const SUGGEST_MODEL  = 'claude-haiku-4-5-20251001';
// const DETAILED_MODEL = 'claude-sonnet-4-6';
// const IMAGE_MODEL    = 'claude-sonnet-4-6';
// // Per-intent brain budget. Reasoning cost scales with how much context the model
// // has to reason over, and DeepSeek spends 93-98% of its completion tokens on
// // reasoning (measured: 1175-3768 reasoning tokens to emit ~84 tokens of JSON).
// //
// // A dosing turn genuinely needs the full budget: product facts, reconstitution
// // tables, protocols. A "where is my order" turn does not, and the critical-line
// // hoist has already moved the policy lines that matter to the front, so trimming
// // the tail costs nothing.
// const BRAIN_BUDGET = { dosing: 12000, refund: 9000, general: 6000 };
// const MAX_BRAIN_CHARS = BRAIN_BUDGET.dosing;   // ceiling, and what injectProductFacts sizes against

// // Do NOT lower this to throttle latency. It is a reasoning model: cap the budget
// // below the reasoning spend and it never reaches the JSON, parseAIResponse returns
// // null, and every request silently serves canned templates instead.
// //
// // 3768 reasoning tokens was the WORST measured run, and ~84 tokens of JSON on top
// // of it lands at ~3852 against a 4000 ceiling — a 4% margin. A run at or past the
// // top of that range truncates mid-reasoning and never emits the closing brace,
// // which is the single most likely cause of an intermittent template fallback.
// // Env-overridable so this can be raised without a deploy while the non-reasoning
// // model question is settled.
// const SUGGEST_MAX_TOKENS = Number(process.env.SUGGEST_MAX_TOKENS) || 6000;

// // DeepSeek stays primary for BOTH modes. Haiku is only reached when DeepSeek is
// // unavailable or out of credit — unchanged.
// //
// // What changes is which DeepSeek model each mode asks for. Measured on
// // deepseek-v4-pro: 93-98% of completion tokens go to chain-of-thought, 20-59s wall
// // clock, and reasoning_effort was already 'low' on every call with no effect. Fast
// // mode is a click-to-suggest panel and cannot wait for reasoning; detailed mode is
// // a deliberate "expand this" action where the extra thinking earns its seconds.
// // Both default to null = whatever DEEPSEEK_MODEL says. Defaulting to a guessed
// // model name was wrong: deepseek-v4-pro is the confirmed model here and I have no
// // verified non-reasoning sibling name, so shipping one as a default just buys a
// // failed request per boot. Set these explicitly once GET /api/ai/deepseek-models
// // tells you what the account actually serves.
// const DEEPSEEK_SUGGEST_MODEL  = process.env.DEEPSEEK_SUGGEST_MODEL  || null;
// const DEEPSEEK_DETAILED_MODEL = process.env.DEEPSEEK_DETAILED_MODEL || null;

// // 90s, not 25s. Measured over 9 runs: 20.1-59.1s, median 31.5s. A 25s ceiling
// // would time out 6 of 9 and make Haiku the PRIMARY path for fast mode, which is
// // the opposite of the rule. This sits above the worst observed run so DeepSeek
// // stays primary; it exists to stop a hung socket holding the agent forever, not
// // to race the provider.
// const DEEPSEEK_SUGGEST_TIMEOUT_MS = Number(process.env.DEEPSEEK_SUGGEST_TIMEOUT_MS) || 90000;

// // Optional. Only send a reasoning-effort override when explicitly configured —
// // 'low' is already the module default and I have not verified which other values
// // this account accepts.
// const DEEPSEEK_SUGGEST_EFFORT = process.env.DEEPSEEK_SUGGEST_EFFORT || null;

// // ── FALLBACK REASONS ───────────────────────────────────────────────────────────
// // Every template response carries one of these. Before this existed, nine
// // separate exits all returned an identical `{ fallback: true }` and the agent saw
// // one undifferentiated "AI unavailable" chip — a config miss, a truncated
// // completion, and a safety guard doing its job were indistinguishable in the UI
// // and only separable by tailing server logs. The codes are the contract the
// // client's FALLBACK_REASONS map renders; an unknown code degrades to the raw
// // string there rather than being swallowed, so adding one here is safe.
// const FALLBACK_REASON = {
//   NO_API_KEY:      'no_api_key',
//   PARSE_FAILED:    'parse_failed',
//   SHAPE_MISMATCH:  'shape_mismatch',
//   CONTAMINATION:   'number_contamination',
//   DOSE_LEAK:       'unauthorised_dose_leak',
//   COMMITMENT:      'unauthorised_commitment',
//   UPGRADE:         'unauthorised_upgrade',
//   ALL_FILTERED:    'all_filtered',
//   ENDPOINT_ERROR:  'endpoint_error',
// };

// // Widened after a live miss. "tracking number said I would receive my package on
// // Wednesday" is a missed-promise complaint, but matched none of the old terms, so
// // COMPENSATION_BLOCK was never pinned and the model freely offered an express
// // shipping upgrade — which that block bans outright.
// const REFUND_COMPLAINT_RE = /refund|money back|reimburse|charge.?back|cancel(l|led|ling|lation)?|escalat|complaint|unacceptable|lawyer|attorney|sue|dispute|still waiting|no (tracking|update|response|communication)|missed|delay(ed|s)?|supposed to|was due|has passed|would receive|never (arrived|came|showed)|still (haven'?t|hasn'?t|not) (got|received|arrived|come)|not (arrived|received) yet/i;
// const SHIPPING_LOCATION_RE = /pick.?up|collect|in.?person|in.?store|walk.?in|delivery|deliver|shipping|\bship\b|postage|courier|mail|when.*(arrive|get here|receive|come)|how long|near(by)?|close to|local\b/i;
// const CRITICAL_POLICY_RE = /refund|unshipped|unfulfilled|not shipped|shipped\/|delivered|store credit|e-transfer|escalate|escalation|replacement|reship|return-to-sender|lost package|cancel|mystery vial|goodwill|compensation|free product/i;
// const CRITICAL_DOSING_RE = /reconstitut|bacteriostatic|bac water|\bmg\s*\/\s*ml\b|\bunits?\b|starting dose|start dose|titrat|escalation|\bmL\b/i;
// const JSON_HARDENING_SUFFIX = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOUTPUT FORMAT — ABSOLUTE, OVERRIDES EVERYTHING ABOVE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDo ALL of your thinking silently. Output NOTHING before the JSON — no analysis, no "we are asked to", no restating the customer's question, no reasoning, no preamble of any kind. Your ENTIRE response is the single JSON object and nothing else. The FIRST character you output must be { and the LAST character must be }. Start immediately with {.`;

// const COMPENSATION_BLOCK = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCOMPENSATION — YOU MAY NOT INVENT A PROMISE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNever name a specific free product. The ONLY compensation you may offer is a free MYSTERY vial, chosen from current stock, and the customer does not get to pick it. "I'll add a free [product name]" is banned outright, and naming a product we do not sell is worse still.\n\nNever offer a discount, a shipping-cost refund, an expedited upgrade, or a cancellation on your own authority. Orders cannot be cancelled once placed. Anything beyond the brain's named remedies needs admin approval, and a promise you cannot keep to an already-angry customer costs more than the delay did.\n\nOffer only what the BRAIN DATA explicitly authorises, in the words it authorises.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

// module.exports = function createAiRoutes({ getCachedStore }) {
//   if (typeof getCachedStore !== 'function') {
//     throw new Error('createAiRoutes requires a getCachedStore function');
//   }

//   const router = express.Router();

//   const detailedFromFallback = (fallback) => ([
//     { label: 'Empathetic',     text: fallback[0] || 'Unable to generate.' },
//     { label: 'Thorough',       text: fallback[1] || 'Unable to generate.' },
//     { label: 'Above & Beyond', text: fallback[2] || 'Unable to generate.' },
//   ]);

//   // Fallback templates come from lib/ai-suggestions and are written in generic
//   // support English. Scrub them on the way out so a canned reply is never the
//   // most obviously AI-sounding thing the customer receives.
//   //
//   // NOTE the explicit arrow. `.map(scrubVoice)` would pass the array INDEX as
//   // the profile argument and silently disable the scrub on every element.
//   const voicedFallback = (profile, ...args) =>
//     generateSmartFallbackSuggestions(...args, { supportEmail: profile?.supportEmail || null })
//       .map(s => scrubVoice(s, profile));

//   // The single exit for a template response. Stamping the reason here rather than
//   // at nine call sites means a new fallback path cannot ship without one.
//   // `detail` is trimmed hard: it is rendered to an agent mid-conversation, not
//   // read as a stack trace.
//   const fallbackReply = (res, { reason, detail = null, provider = 'none', detailed = false, suggestions, extra = {} }) => {
//     console.warn(`⚠️  [AI] FALLBACK reason=${reason} provider=${provider}${detail ? ` detail=${detail}` : ''}`);
//     const body = {
//       fallback: true,
//       source: 'fallback',
//       provider,
//       fallbackReason: reason,
//       ...(detail && { fallbackDetail: String(detail).slice(0, 200) }),
//       ...extra,
//     };
//     return res.json(detailed
//       ? { ...body, detailedAnswers: detailedFromFallback(suggestions) }
//       : { ...body, suggestions });
//   };

//   // Why a completion could not be parsed. `stop_reason: 'max_tokens'` is the one
//   // that matters: it means the model spent the whole budget on chain-of-thought
//   // and was cut off before the closing brace. That is a config problem, not a
//   // provider outage, and it reads completely differently to an agent.
//   const describeParseFailure = (data, raw, provider, maxTokens) => {
//     const stop = data?.stop_reason || data?.stopReason || 'unknown';
//     const parts = [`${provider} returned ${raw.length} chars`, `stop_reason=${stop}`];
//     if (stop === 'max_tokens') parts.push(`truncated at max_tokens=${maxTokens} before emitting JSON`);
//     else if (!raw.length) parts.push('empty completion');
//     return parts.join(', ');
//   };

//   const warnIfTruncated = (data, maxTokens, label) => {
//     const stop = data?.stop_reason || data?.stopReason;
//     if (stop !== 'max_tokens') return;
//     console.error(
//       `✦ [AI] ${label} TRUNCATED at max_tokens=${maxTokens}. A reasoning model spent the budget on chain-of-thought and never emitted the JSON. ` +
//       `Fix: raise SUGGEST_MAX_TOKENS, or set DEEPSEEK_SUGGEST_MODEL to a non-reasoning entry from GET /api/ai/deepseek-models.`
//     );
//   };

//   // Resolve the store's voice. Never throws, never blocks a reply — an unknown
//   // or unreachable store falls through to the fleet default.
//   const profileFor = async (storeIdentifier) => {
//     if (!storeIdentifier) return resolveVoiceProfile({});
//     try {
//       return resolveVoiceProfile((await getCachedStore(storeIdentifier)) || {});
//     } catch (err) {
//       console.warn(`🗣️  [Voice] store lookup failed for "${storeIdentifier}" (${err.message}) — using fleet default`);
//       return resolveVoiceProfile({});
//     }
//   };

//   // ============ IMAGE ANALYSIS ============

//   router.post('/analyze-image', authenticateToken, async (req, res) => {
//     try {
//       const { image, conversationId, storeIdentifier } = req.body;
//       if (!image?.base64 || !image?.mimeType) return res.status(400).json({ error: 'image.base64 and image.mimeType are required' });
//       const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
//       if (!ALLOWED_TYPES.includes(image.mimeType)) return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' });
//       const approxBytes = (image.base64.length * 3) / 4;
//       if (approxBytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image exceeds 5 MB limit.' });
//       const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//       if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured (missing ANTHROPIC_API_KEY)' });
//       console.log(`🖼️  [ImageAnalysis] conv=${conversationId} type=${image.mimeType} approxKB=${Math.round(approxBytes / 1024)}`);
//       let storeContext = '';
//       if (storeIdentifier) {
//         try { const store = await getCachedStore(storeIdentifier); if (store?.brand_name) storeContext = ` for ${store.brand_name}`; }
//         catch (_) {}
//       }
//       const requestBody = JSON.stringify({ model: IMAGE_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: [
//         { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
//         { type: 'text', text: `You are a customer support assistant analyzing a screenshot uploaded by a support agent${storeContext}. Extract and report EVERYTHING visible in this image so the agent can write a precise, accurate reply to the customer.\n\nRead the ENTIRE screenshot carefully and extract:\n\n1. SCREEN TYPE — What kind of screen is this? (order confirmation, tracking page, error message, product page, payment screen, account page, chat/email, invoice, etc.)\n\n2. ALL VISIBLE TEXT — Extract every piece of text you can read: headings, labels, values, statuses, messages, error text, button labels, dates, times, prices, quantities, addresses, names, email addresses, phone numbers, reference numbers, order IDs, tracking numbers, product names, SKUs, descriptions — everything.\n\n3. KEY DATA POINTS — Specifically call out:\n   - Order/reference numbers (exact format, e.g. #1001, ORD-12345)\n   - Order status (pending, fulfilled, shipped, cancelled, refunded, etc.)\n   - Payment status and amounts (exact dollar figures)\n   - Tracking numbers and carrier names\n   - Shipping/delivery dates or estimated dates\n   - Product names, quantities, sizes, variants\n   - Customer name and email if visible\n   - Any error messages or warning text (copy exactly)\n   - Any action items, buttons, or options shown\n\n4. WHAT ISSUE THIS RELATES TO — Based on what you see, what is the customer's likely concern or question?\n\nWrite your response as a clear, structured report. Include every specific value — exact numbers, exact text, exact statuses. Do not summarize or paraphrase data — reproduce it exactly as shown. Plain text only, no markdown.` }
//       ]}]});
//       const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY, 1, 40000);
//       const analysis = data.content?.[0]?.text || '';
//       console.log(`🖼️  [ImageAnalysis] Done — ${analysis.length} chars`);
//       return res.json({ analysis });
//     } catch (err) { console.error('🖼️  [ImageAnalysis] Error:', err.message); return res.status(500).json({ error: 'Image analysis failed', message: err.message }); }
//   });

//   // ============ AI SUGGESTIONS ============

//   router.post('/suggestions', authenticateToken, async (req, res) => {
//     // Hoisted so the outer catch can still scrub its fallback with a real profile.
//     let voiceProfile = resolveVoiceProfile({});
//     try {
//       const { clientMessage, chatHistory, agentStyleSamples = [], recentContext, customerName, customerEmail, storeName, storeIdentifier, analysis, adminNote, messageEdited, detailedAnswerMode, adminImage, imageAnalysis } = req.body;
//       let brainSettings = req.body.brainSettings || {};
//       if (!clientMessage) return res.status(400).json({ error: 'clientMessage is required' });

//       voiceProfile = await profileFor(storeIdentifier);

//       const contextQuality = recentContext?.contextQuality || 'minimal';
//       const messageRichness = recentContext?.messageRichness || 'brief';
//       console.log(`✦ [AI] context: ${contextQuality}, richness: ${messageRichness}, agentSamples: ${agentStyleSamples.length}, detailedMode: ${!!detailedAnswerMode}, imageAnalysis: ${!!imageAnalysis}, voice: ${voiceProfile.id}`);

//       const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//       if (!ANTHROPIC_API_KEY) {
//         return fallbackReply(res, {
//           reason: FALLBACK_REASON.NO_API_KEY,
//           detail: 'ANTHROPIC_API_KEY is not set, so no model was called.',
//           detailed: !!detailedAnswerMode,
//           suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
//         });
//       }

//       const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);
//       const isTrustQuestion = detectTrustQuestion(clientMessage);
//       const isSafetyDosing = detectSafetyDosingQuestion(clientMessage, chatHistory);
//       const isRefundOrComplaint = REFUND_COMPLAINT_RE.test(clientMessage);

//       if (isTrustQuestion) console.log('✦ [AI] Trust/legitimacy question detected — proof-first mode');
//       if (isSafetyDosing) console.log(`✦ [AI] Dosing question — anchor: ${conversationState.productName || 'NONE'} ${conversationState.productStrength || ''}`);
//       if (isRefundOrComplaint) console.log('✦ [AI] Refund/complaint — compensation rules pinned');

//       const brainBudget = isSafetyDosing ? BRAIN_BUDGET.dosing
//                         : isRefundOrComplaint ? BRAIN_BUDGET.refund
//                         : BRAIN_BUDGET.general;

//       let analysisBlock = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);

      // The signals, not just the label. "very_negative" tells the model to be
      // sorry; "asked three times, three week wait, no reply" tells it what to be
      // sorry ABOUT, which is the difference between a tailored reply and a
      // generic apology. This is also what stops three consecutive turns in an
      // escalating thread from producing three interchangeable drafts.
      if (emotion.signals.length) {
        analysisBlock += `\nWhy they feel that way: ${emotion.signals.join('; ')}.`;
        analysisBlock += `\nRespond to these specifics. Do not apologise in the abstract.`;
      }
//       const customerContext = buildCustomerContext(customerName, customerEmail, conversationState);
//       const policyBlock = buildPolicyBlock();

//       // ── STYLE LEARNING, VOICE-FILTERED ───────────────────────────────────────
//       // extractAdminStyle learns from whatever the team actually sent, and
//       // buildAdminStyleBlock then calls that style "non-negotiable". If those
//       // replies are off-voice, the learned block argues with the voice block for
//       // the rest of the conversation and usually wins, because it sits lower in
//       // the prompt. Drop the bad samples before they are learned.
//       const onVoiceSamples = filterOnVoiceSamples(agentStyleSamples, voiceProfile);
//       const droppedSamples = agentStyleSamples.length - onVoiceSamples.length;
//       if (droppedSamples > 0) console.log(`🗣️  [Voice] Dropped ${droppedSamples}/${agentStyleSamples.length} agent style sample(s) as off-voice before style extraction`);

//       // The learned style block sits LOWER in the prompt than the voice block and
//       // calls itself non-negotiable, so on a conflict it wins. When the profile
//       // supplies a voice, strip this block back to vocabulary only.
//       const voiceOwnedByProfile = !!voiceProfile.voiceBlock;
//       const adminStyle = extractAdminStyle(chatHistory, onVoiceSamples);
//       const adminStyleBlock = buildAdminStyleBlock(adminStyle, { voiceOwnedByProfile });
//       if (adminStyle) console.log(`✦ [AI] Style: avg ${adminStyle.avgWords}w, ${adminStyle.sampleLines.length} samples, lowercase:${adminStyle.writesLowercase}, contractions:${adminStyle.usesContractions}, exclamations:${adminStyle.usesExclamation}, voiceOwnedByProfile:${voiceOwnedByProfile} (styleBlock ${adminStyleBlock.length}c)`);
//       else console.log(`✦ [AI] No style yet — not enough on-voice agent replies`);

//       // ── BRAIN RETRIEVAL QUERY ────────────────────────────────────────────────
//       let brainSearchTerms = buildBrainQuery(clientMessage, chatHistory, conversationState);

//       if (isRefundOrComplaint) {
//         brainSearchTerms = `${brainSearchTerms} refund policy unshipped unfulfilled not shipped store credit e-transfer escalation cancellation replacement reship missing items delay compensation free mystery vial goodwill admin approval`;
//         console.log('✦ [AI] Refund/complaint intent — augmenting brain retrieval toward refund + compensation policy');
//       } else if (isSafetyDosing) {
//         brainSearchTerms = `${brainSearchTerms} reconstitution bacteriostatic water mL mg/ml insulin syringe units starting dose titration weekly escalation protocol`;
//         console.log('✦ [AI] Dosing intent — augmenting brain retrieval toward reconstitution/protocol');
//       } else if (SHIPPING_LOCATION_RE.test(clientMessage)) {
//         brainSearchTerms = `${brainSearchTerms} shipping delivery handling time dispatch pickup collection in-person order fulfillment how long to arrive shipping policy`;
//         console.log('✦ [AI] Shipping/pickup/location intent — augmenting brain retrieval query');
//       }

//       let brainContext = '';
//       let responseExamples = [];
//       const needSettings = !brainSettings.length && !brainSettings.tone && !brainSettings.empathy;

//       console.time('✦ [AI] brainDB');
//       const [brainRes, settingsRes, exRes] = await Promise.allSettled([
//         getBrainContext(db.pool, brainSearchTerms),
//         needSettings ? getBrainSettings(db.pool) : Promise.resolve(null),
//         db.pool.query(`SELECT brain_data -> 'responseExamples' AS examples FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`),
//       ]);
//       console.timeEnd('✦ [AI] brainDB');

//       if (brainRes.status === 'fulfilled') brainContext = brainRes.value || '';
//       else console.error('🧠 [Brain] Failed:', brainRes.reason?.message);

//       if (settingsRes.status === 'fulfilled' && settingsRes.value) brainSettings = settingsRes.value;
//       else if (settingsRes.status === 'rejected') console.error('🧠 [Brain] settings fetch failed:', settingsRes.reason?.message);

//       if (exRes.status === 'fulfilled') responseExamples = Array.isArray(exRes.value.rows[0]?.examples) ? exRes.value.rows[0].examples : [];
//       else console.error('🧠 [Brain] responseExamples fetch failed:', exRes.reason?.message);

//       // These are presented to the model as the voice. Under a profile they are a
//       // THIRD competing voice source, below the profile block, and this store's
//       // examples carry no "Hello!" opener because that is how the team writes. Left
//       // unfiltered they teach the model to drop the greeting the profile mandates.
//       if (voiceOwnedByProfile && responseExamples.length) {
//         const flat = responseExamples.map(r => (typeof r === 'string' ? r : r?.text)).filter(Boolean);
//         const onVoice = filterOnVoiceSamples(flat, voiceProfile, { strict: true });
//         const dropped = flat.length - onVoice.length;
//         if (dropped) console.log(`🗣️  [Voice] Dropped ${dropped}/${flat.length} brain responseExample(s) that contradict the '${voiceProfile.id}' voice, kept ${onVoice.length}`);
//         if (flat.length && !onVoice.length) console.warn(`🗣️  [Voice] ALL ${flat.length} curated responseExamples rejected. Either the '${voiceProfile.id}' profile does not match how this store actually writes, or the examples need rewriting. The DB query fetched them for nothing.`);
//         responseExamples = onVoice;
//       }

//       if (brainContext.length > brainBudget) {
//         const before = brainContext.length;
//         const hoistRe = isRefundOrComplaint ? CRITICAL_POLICY_RE : isSafetyDosing ? CRITICAL_DOSING_RE : null;
//         if (hoistRe) {
//           const lines = brainContext.split('\n');
//           const critical = [];
//           const rest = [];
//           for (const line of lines) (hoistRe.test(line) ? critical : rest).push(line);
//           if (critical.length) {
//             brainContext = [...critical, ...rest].join('\n');
//             console.log(`🧠 [Brain] ${isRefundOrComplaint ? 'refund/complaint' : 'dosing'} — hoisted ${critical.length} critical line(s) before truncation`);
//           }
//         }
//         brainContext = brainContext.slice(0, brainBudget);
//         console.log(`🧠 [Brain] truncated ${before}c → ${brainBudget}c (${isSafetyDosing ? 'dosing' : isRefundOrComplaint ? 'refund' : 'general'} budget)`);
//       }

//       console.log(`🧠 [Brain] ${brainContext.length} chars for: "${brainSearchTerms.substring(0, 80)}" — ${responseExamples.length} example(s)`);

//       if (conversationState.productName) {
//         // Sized against the ceiling so the injector has room to work, then trimmed
//         // back to this turn's budget. Injected product facts are prepended, so the
//         // trim takes from the tail and never cuts the facts it just added.
//         brainContext = injectProductFacts(brainContext, conversationState.productName, MAX_BRAIN_CHARS);
//         if (brainContext.length > brainBudget) brainContext = brainContext.slice(0, brainBudget);
//       }

//       // ── PRODUCT-SCOPED COVERAGE ──────────────────────────────────────────────
//       const coverage = brainDosingCoverage(brainContext, conversationState.productName);
//       const brainHasProductAnswer = coverage.complete;

//       if (isSafetyDosing && !brainHasProductAnswer) {
//         console.warn(`🚨 [Brain] DOSING GAP — no authorised rule for "${conversationState.productName || 'NO ANCHOR'}". Numbers are FORBIDDEN this turn.`);
//       }

//       const brainUserBlock = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — BUILD YOUR REPLIES FROM THIS DATA FIRST\nIf the answer to the customer's question exists below, use it immediately.\nDo NOT say "let me check" or "let me get back to you" when the data is here.\nEvery figure belongs to the product named beside it. NEVER move a number from one product to another.\nNever name a product, price, timeline, or free item that does not appear below.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';

//       // ============ DETAILED ANSWER MODE ============
//       if (detailedAnswerMode) {
//         const brainSystemSection = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         BRAIN RULES — READ FIRST.
//         Mandatory store-owner FACTS: products, doses, protocols, policies, prices, timeframes. These override every other source of FACTS, including chat history and your own knowledge. They do NOT override the voice instructions below, say these facts the way a real person talks, not like a spec sheet.
//         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         ${brainContext}
//         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         Use brain data as the ONLY source of truth for product info, protocols, dosing, and policies. Every number, dose, product name, and policy term must come verbatim from the matching brain rule. Every figure belongs to the product named beside it — never move a number from one product to another, no matter how plausible the arithmetic looks. Never name a product we do not sell.
//         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         ` : '';
//         const imageSystemSection = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT CONTEXT — uploaded by the agent:\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//         const trustSystemSection = isTrustQuestion ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTRUST / "AM I GETTING SCAMMED" QUESTION — OVERRIDES LENGTH BELOW\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe customer fears being scammed (payment is likely e-transfer/crypto, no chargeback). A long, enthusiastic essay reads as overselling, which is a red flag here. Keep ALL three replies short and calm (2 to 4 sentences). Acknowledge the worry once and name why it is fair (the payment isn't reversible), then point ONLY to verification the brain data provides, quoted exactly. NEVER bare-assert legitimacy. NEVER invent a confirmation timeline. NEVER fabricate proof, review counts, years, or ratings.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//         const compSystemSection = isRefundOrComplaint ? COMPENSATION_BLOCK : '';

//         const safetySystemSection = !isSafetyDosing ? '' : brainHasProductAnswer
//           ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDOSING / SAFETY QUESTION — HONESTY GATES OVERRIDE EVERYTHING\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe product under discussion is ${conversationState.productName}${conversationState.productStrength ? ` (${conversationState.productStrength})` : ''}. The brain above HOLDS its reconstitution and dose figures — state them, exactly as written. These gates restrict what you may INVENT; they do not license stalling.\n\nNever carry a number over from your own knowledge, from another product, or from the chat history. Never do arithmetic on top of the brain's numbers. Never say a dose "is safe" or "you'll be fine", and never promise an outcome unless the brain states it.\n\nPoint to a healthcare provider ONLY if the customer actually raised getting sick, side effects, a health condition, pregnancy, or other medications. NEVER reference a symptom they never mentioned.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
//           : `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 DOSING QUESTION, NO DATA FOR THIS PRODUCT — NUMBERS ARE FORBIDDEN\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe brain above has NO reconstitution volume, concentration, or unit math for ${conversationState.productName || 'the product being asked about'}. It DOES have those figures for OTHER products. Those belong to those products. You may not borrow, scale, adapt, or infer from them.\n\nA "1mL" beside a product in a SYRINGE spec ("1mL 29G insulin syringe") is a barrel size, NOT a reconstitution volume.\n\nBanned in all three replies: any mL volume, any mg/mL concentration, any syringe unit count. Say honestly that you're confirming the exact protocol and coming straight back.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

//         // Profile-supplied voice. A profile with null blocks ('direct-support')
//         // contributes nothing and the prose below carries the instructions,
//         // exactly as it did before profiles existed.
//         const voiceSection     = voiceProfile.voiceBlock    || '';
//         const examplesSection  = voiceProfile.examplesBlock || '';
//         const structureSection = voiceProfile.structureLong || '';
//         const fallbackLength   = structureSection ? '' : '\n\nWrite three distinct, detailed replies in flowing paragraphs. No bullet points.';

//         const systemPrompt = `${trustSystemSection}${safetySystemSection}${compSystemSection}${brainSystemSection}${imageSystemSection}${adminStyleBlock ? `${adminStyleBlock}\n\n` : ''}${voiceSection}${examplesSection}${structureSection}\nYou are ghostwriting replies for a human support agent. All three styles must sound like the SAME person.\n\nNO fake time promises: state a shipping, handling, or delivery timeframe ONLY if it appears in the brain data above, quoted exactly, otherwise put a [bracketed placeholder] there. Never invent tracking status, stock, or pickup options.\n\nNever attribute a statement, symptom, or concern to the customer that they did not actually make. Never name a product, price, or free item that is not in the brain data.${fallbackLength}\n\n${policyBlock ? `Policies:\n${policyBlock}\n` : ''}${customerContext ? `Customer context:\n${customerContext}\n` : ''}${analysisBlock ? `Conversation analysis:\n${analysisBlock}\n` : ''}\nEmpathetic: Name the frustration once in the opening line, then straight into the answer. One line, never an apology paragraph.\nThorough: Covers every step, policy, and expectation the brain data authorises. Nothing left unanswered.\nAbove & Beyond: Everything in Thorough plus one genuine extra, a tip or a follow-up offer, only where the brain data authorises it.\n\nYour response MUST END with the JSON object and nothing after it. Return ONLY valid JSON:\n{\n  "detailedAnswers": [\n    { "label": "Empathetic",     "text": "..." },\n    { "label": "Thorough",       "text": "..." },\n    { "label": "Above & Beyond", "text": "..." }\n  ]\n}`;

//         const userPrompt = `${brainUserBlock}Conversation history:\n${chatHistory || '(none)'}\n\nCustomer's message:\n${clientMessage}${adminNote ? `\nAdmin note: ${adminNote}` : ''}\n\nWrite 3 detailed replies. Your response must END with the JSON, nothing after it.`;
//         // Detailed mode keeps the reasoning model: the agent chose to expand, so a
//         // slower, better answer is the point. No timeout override, so it uses the
//         // provider default.
//         const DETAILED_MAX_TOKENS = 3000;
//         const requestBody = JSON.stringify({
//           model: DETAILED_MODEL,
//           max_tokens: DETAILED_MAX_TOKENS,
//           temperature: 0.5,
//           system: systemPrompt,
//           messages: [{ role: 'user', content: userPrompt }],
//           ...(DEEPSEEK_DETAILED_MODEL && { deepseekModel: DEEPSEEK_DETAILED_MODEL }),
//         });

//         console.time('✦ [AI] llmDetailed');
//         const { data: anthropicData, provider } = await callAIForSuggestions(requestBody, ANTHROPIC_API_KEY);
//         console.timeEnd('✦ [AI] llmDetailed');

//         const rawContent = anthropicData.content?.[0]?.text || '';
//         console.log(`✦ [AI] Detailed raw (first 300): ${rawContent.substring(0, 300)}`);
//         warnIfTruncated(anthropicData, DETAILED_MAX_TOKENS, 'Detailed');

//         const parsed = parseAIResponse(rawContent, 'detailedAnswers');
//         if (!parsed) {
//           return fallbackReply(res, {
//             reason: FALLBACK_REASON.PARSE_FAILED,
//             detail: describeParseFailure(anthropicData, rawContent, provider, DETAILED_MAX_TOKENS),
//             provider,
//             detailed: true,
//             suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
//           });
//         }
//         let detailedAnswers = Array.isArray(parsed.detailedAnswers) ? parsed.detailedAnswers.slice(0, 3) : null;
//         if (!detailedAnswers) {
//           console.warn('✦ [AI] Detailed parsed but detailedAnswers not an array — serving fallback');
//           return fallbackReply(res, {
//             reason: FALLBACK_REASON.SHAPE_MISMATCH,
//             detail: 'The model returned JSON without a detailedAnswers array.',
//             provider,
//             detailed: true,
//             suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
//           });
//         }

//         // Essay mode is MORE prone to both failures — a longer reply gives it far more
//         // room to helpfully "fill in" a ratio or invent a goodwill gesture.
//         const texts = detailedAnswers.map(a => a?.text || '');
//         const { contaminated } = detectNumberContamination(texts, brainContext, conversationState.productName);
//         const { blocked: cBlocked } = validateCommitments(texts, brainContext);
//         if (contaminated.length || cBlocked.length) {
//           const why = contaminated.length ? FALLBACK_REASON.CONTAMINATION : FALLBACK_REASON.COMMITMENT;
//           console.error(`🚨 [AI] Detailed mode blocked (${why}) — serving fallback rather than a borrowed dose or an invented promise`);
//           return fallbackReply(res, {
//             reason: why,
//             detail: contaminated.length
//               ? 'Every detailed reply carried a dose figure the brain does not authorise.'
//               : 'Every detailed reply made a promise the brain does not authorise.',
//             provider,
//             detailed: true,
//             suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
//             extra: { blocked: why },
//           });
//         }

//         // Voice pass LAST — after every safety guard has had its say, so a scrub
//         // never changes what a guard already inspected.
//         const detailedVoiceFlags = [];
//         detailedAnswers.forEach((a, i) => {
//           if (!a?.text) return;
//           a.text = scrubVoice(humanizeText(a.text), voiceProfile);
//           const flags = lintVoice(a.text, voiceProfile, { detailed: true });
//           if (flags.length) {
//             detailedVoiceFlags.push({ index: i, label: a.label, flags });
//             console.warn(`🗣️  [Voice] detailed[${i}] ${a.label}: ${flags.map(f => f.label).join(', ')}`);
//           }
//         });

//         return res.json({
//           detailedAnswers,
//           fallback: false,
//           source: 'ai',
//           provider,
//           voiceProfile: voiceProfile.id,
//           voiceRulesVersion: VOICE_VERSION,
//           ...(detailedVoiceFlags.length && { voiceFlags: detailedVoiceFlags }),
//         });
//       }

//       // ============ FAST SUGGESTION MODE ============
//       // voiceProfile is the 16th arg. buildSystemPrompt SWAPS humanVoiceBlock,
//       // ROBOT_VS_HUMAN_BLOCK and lengthRule for the profile's versions when they
//       // are non-null. It does not append them — stacking two voices produces a
//       // prompt that mandates and forbids the same opener in the same breath.
//       const systemPrompt = buildSystemPrompt(
//         storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness,
//         brainContext, brainSettings, adminStyleBlock, imageAnalysis,
//         conversationState?.sentiment || analysis?.sentiment || 'neutral',
//         responseExamples, isTrustQuestion, isSafetyDosing, brainHasProductAnswer,
//         voiceProfile
//       ) + (isRefundOrComplaint ? COMPENSATION_BLOCK : '') + JSON_HARDENING_SUFFIX;

//       const userPrompt = buildUserPrompt(
//         chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext,
//         brainContext, imageAnalysis || '', brainHasProductAnswer
//       );

//       // `model` is the CLAUDE fallback model. lib/deepseek-fallback.js currently
//       // ignores it and hardcodes its own, so `deepseekModel` is passed alongside as
//       // an explicit hint for it to honour.
//       const buildBody = (prompt) => JSON.stringify({
//         model: SUGGEST_MODEL,
//         max_tokens: SUGGEST_MAX_TOKENS,
//         temperature: 0.6,
//         system: systemPrompt,
//         messages: [{ role: 'user', content: prompt }],
//         ...(DEEPSEEK_SUGGEST_MODEL && { deepseekModel: DEEPSEEK_SUGGEST_MODEL }),
//         ...(DEEPSEEK_SUGGEST_EFFORT && { deepseekReasoningEffort: DEEPSEEK_SUGGEST_EFFORT }),
//         deepseekTimeoutMs: DEEPSEEK_SUGGEST_TIMEOUT_MS,
//       });

//       console.log(`✦ [AI] Calling suggestions (DeepSeek primary / ${SUGGEST_MODEL} fallback) — brain: ${brainContext.length}c, style: ${adminStyleBlock.length}c, voice: ${voiceProfile.id}, budget: ${brainBudget}c, dsModel: ${DEEPSEEK_SUGGEST_MODEL || process.env.DEEPSEEK_MODEL || 'provider default'}, maxTokens: ${SUGGEST_MAX_TOKENS}, sysPrompt: ${systemPrompt.length}c, userPrompt: ${userPrompt.length}c, examples: ${responseExamples.length}, image: ${!!imageAnalysis}, productAnswer: ${brainHasProductAnswer}`);
//       console.time('✦ [AI] llmSuggest');
//       const { data: anthropicData, provider } = await callAIForSuggestions(buildBody(userPrompt), ANTHROPIC_API_KEY);
//       console.timeEnd('✦ [AI] llmSuggest');

//       const rawContent = anthropicData.content?.[0]?.text || '';
//       console.log(`✦ [AI] Served by: ${provider} — Raw (first 300): ${rawContent.substring(0, 300)}`);

//       // Token accounting is the difference between "the provider is down" and "the
//       // budget is too small". Log it on every call, not only on failure, so the
//       // reasoning-vs-output split is visible before it starts truncating.
//       const usage = anthropicData?.usage || {};
//       if (usage.output_tokens != null || usage.completion_tokens != null) {
//         console.log(`✦ [AI] usage — in:${usage.input_tokens ?? usage.prompt_tokens ?? '?'} out:${usage.output_tokens ?? usage.completion_tokens ?? '?'} reasoning:${usage.reasoning_tokens ?? '?'} cap:${SUGGEST_MAX_TOKENS} stop:${anthropicData?.stop_reason || 'unknown'}`);
//       }
//       warnIfTruncated(anthropicData, SUGGEST_MAX_TOKENS, 'Suggestions');

//       let usedFallback = false;
//       let blocked = null;
//       let fallbackReason = null;
//       let fallbackDetail = null;
//       let safetyReview = [];

//       const parsed = parseAIResponse(rawContent, 'suggestions');
//       if (!parsed) {
//         console.error(`✦ [AI] JSON parse failed (provider=${provider}). Raw:`, rawContent.substring(0, 500));
//         return fallbackReply(res, {
//           reason: FALLBACK_REASON.PARSE_FAILED,
//           detail: describeParseFailure(anthropicData, rawContent, provider, SUGGEST_MAX_TOKENS),
//           provider,
//           suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
//         });
//       }

//       let suggestions;
//       if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions.slice(0, 3);
//       else if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3);
//       else {
//         suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
//         usedFallback = true;
//         fallbackReason = FALLBACK_REASON.SHAPE_MISMATCH;
//         fallbackDetail = 'The model returned JSON without a suggestions array.';
//       }

//       console.log(`✦ [AI] BEFORE VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
//       if (!usedFallback) {
//         suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
//         console.log(`✦ [AI] AFTER VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
//       }

//       if (!usedFallback) {
//         const { clean, contaminated } = detectNumberContamination(suggestions, brainContext, conversationState.productName);
//         if (contaminated.length) {
//           blocked = FALLBACK_REASON.CONTAMINATION;
//           suggestions = clean;
//           if (!suggestions.length) {
//             console.error('🚨 [AI] Every suggestion carried an unauthorised dosing number — serving honest fallback');
//             suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
//             usedFallback = true;
//             fallbackReason = FALLBACK_REASON.CONTAMINATION;
//             fallbackDetail = `Every reply carried a dose figure the brain does not authorise for ${conversationState.productName || 'this product'}.`;
//           }
//         }
//         if (!brainHasProductAnswer && !usedFallback) {
//           const SYRINGE = /\d+(?:\.\d+)?\s*mL\s*(?:\/\s*\d+\s*[-\s]?unit)?[^.]{0,25}?\d{2}\s*G|\b1\s*mL\s*\/\s*100\s*[-\s]?unit\b/gi;
//           const leaked = suggestions.filter(s => {
//             const t = String(s).replace(SYRINGE, ' ');
//             return /\b[\d.]+\s*mL\b/i.test(t) || /\b[\d.]+\s*(?:mg|mcg|iu)\s*\/\s*mL\b/i.test(t);
//           });
//           if (leaked.length) {
//             console.error(`🚨 [AI] COVERAGE=false for ${conversationState.productName || 'NO ANCHOR'} but ${leaked.length} suggestion(s) still state a dose. Serving fallback.`);
//             leaked.forEach(s => console.error(`   leaked: "${String(s).slice(0, 110)}"`));
//             suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
//             usedFallback = true;
//             blocked = FALLBACK_REASON.DOSE_LEAK;
//             fallbackReason = FALLBACK_REASON.DOSE_LEAK;
//             fallbackDetail = `The brain has no dosing entry for ${conversationState.productName || 'this product'}, but every reply stated one. Author the brain entry to unblock this.`;
//           }
//         }
//       }

//       if (!usedFallback) {
//         const { clean, blocked: cBlocked, review } = validateCommitments(suggestions, brainContext);
//         if (cBlocked.length) {
//           blocked = blocked || FALLBACK_REASON.COMMITMENT;
//           suggestions = clean;
//           if (!suggestions.length) {
//             console.error('🚨 [AI] Every suggestion made an unauthorised promise — serving honest fallback');
//             suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
//             usedFallback = true;
//             fallbackReason = FALLBACK_REASON.COMMITMENT;
//             fallbackDetail = 'Every reply promised something the brain does not authorise.';
//           }
//         }
//         if (review.length) safetyReview = [...safetyReview, ...review];
//       }

//       // ── STALL GUARD ──────────────────────────────────────────────────────────
//       if (!usedFallback && !blocked) {
//         const { stalled } = detectStall(suggestions, { isSafetyDosing, brainHasProductAnswer });
//         if (stalled) {
//           try {
//             console.time('✦ [AI] llmStallRetry');
//             const retry = await callAIForSuggestions(buildBody(userPrompt + STALL_RETRY_INSTRUCTION), ANTHROPIC_API_KEY);
//             console.timeEnd('✦ [AI] llmStallRetry');
//             warnIfTruncated(retry.data, SUGGEST_MAX_TOKENS, 'Stall retry');
//             const retryParsed = parseAIResponse(retry.data.content?.[0]?.text || '', 'suggestions');
//             const retrySuggestions = Array.isArray(retryParsed?.suggestions) ? retryParsed.suggestions.slice(0, 3) : null;
//             if (retrySuggestions?.length) {
//               let cleaned = validateSuggestions(retrySuggestions, conversationState, chatHistory);
//               // The retry is under explicit pressure to produce numbers — re-check both guards.
//               cleaned = detectNumberContamination(cleaned, brainContext, conversationState.productName).clean;
//               cleaned = validateCommitments(cleaned, brainContext).clean;
//               if (cleaned.length) {
//                 suggestions = cleaned;
//                 console.log(`✦ [AI] STALL RETRY OK (${cleaned.length}):`, JSON.stringify(cleaned));
//               }
//             }
//           } catch (retryErr) {
//             console.error('✦ [AI] Stall retry failed, keeping original:', retryErr.message);
//           }
//         }
//       }

//       if (!usedFallback && suggestions.length === 0) {
//         console.log('✦ [AI] All suggestions filtered — using fallback');
//         suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
//         usedFallback = true;
//         fallbackReason = FALLBACK_REASON.ALL_FILTERED;
//         fallbackDetail = 'Validation removed every reply the model produced.';
//       }

//       if (isSafetyDosing && !usedFallback) {
//         const result = validateSafetyDosing(suggestions, clientMessage);
//         suggestions  = result.suggestions;
//         safetyReview = [...safetyReview, ...result.needsReview];
//       }

//       // ── UNAUTHORISED UPGRADE — BLOCKS ────────────────────────────────────────
//       // COMPENSATION_BLOCK bans expedited upgrades on the AI's own authority. An
//       // express reship the warehouse never agreed to is a real cost the store did
//       // not approve, and the customer has already been told it is happening. So
//       // this drops the suggestion rather than flagging it.
//       if (!usedFallback) {
//         const { clean, blocked: upBlocked } = detectUnauthorisedUpgrade(suggestions, brainContext);
//         if (upBlocked.length) {
//           blocked = blocked || FALLBACK_REASON.UPGRADE;
//           suggestions = clean;
//           if (!suggestions.length) {
//             console.error('🚫 [AI] Every suggestion offered an unauthorised shipping upgrade — serving honest fallback');
//             suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
//             usedFallback = true;
//             fallbackReason = FALLBACK_REASON.UPGRADE;
//             fallbackDetail = 'Every reply offered a shipping upgrade the brain does not authorise.';
//           }
//         }
//       }

//       // ── INVENTED TIMEFRAME — FLAGS ───────────────────────────────────────────
//       // Advisory, not a block: a real brain-sourced date phrased differently must
//       // not be silently deleted. The agent sees the flag and checks before sending.
//       let placeholderCount = 0;
//       if (!usedFallback) {
//         const { review: timeReview, placeholders } = detectInventedTimeframe(suggestions, brainContext);
//         placeholderCount = placeholders;
//         if (timeReview.length) safetyReview = [...safetyReview, ...timeReview];

//         // Everything the model was legitimately shown. A date present in any of
//         // these is grounded; one that appears in none of them was invented.
//         const groundingContext = [clientMessage, chatHistory, imageAnalysis || '', brainContext].join('\n');
//         const { review: dateReview } = detectUngroundedDate(suggestions, groundingContext);
//         if (dateReview.length) safetyReview = [...safetyReview, ...dateReview];
//       }

//       // ── VOICE PASS — LAST ────────────────────────────────────────────────────
//       // Runs after every safety guard so a scrub can never alter text a guard
//       // already cleared. scrubVoice only strips formatting and filler; anything
//       // it cannot safely fix comes back as a flag for the agent to eyeball.
//       suggestions = suggestions.map(s => scrubVoice(humanizeText(s), voiceProfile));

//       const voiceFlags = [];
//       suggestions.forEach((s, i) => {
//         const flags = lintVoice(s, voiceProfile);
//         if (flags.length) {
//           voiceFlags.push({ index: i, flags });
//           console.warn(`🗣️  [Voice] suggestion[${i}]: ${flags.map(f => f.detail ? `${f.label} (${f.detail})` : f.label).join(', ')}`);
//         }
//       });

//       console.log(`✦ [AI] FINAL (${suggestions.length}) — fallback:${usedFallback}${usedFallback ? ` (${fallbackReason})` : ''}, blocked:${blocked || 'none'}, needsReview:${safetyReview.length}, voiceFlags:${voiceFlags.length}, aiTells:${aiTells.length}, placeholders:${placeholderCount}`);
//       if (usedFallback) console.warn(`⚠️  [AI] FALLBACK reason=${fallbackReason} provider=${provider}`);

//       res.json({
//         suggestions,
//         fallback: usedFallback,
//         source: usedFallback ? 'fallback' : 'ai',
//         provider,
//         needsReview: safetyReview,
//         placeholders: placeholderCount,
//         voiceProfile: voiceProfile.id,
//         voiceRulesVersion: VOICE_VERSION,
//         ...(usedFallback && { fallbackReason: fallbackReason || FALLBACK_REASON.ALL_FILTERED }),
//         ...(usedFallback && fallbackDetail && { fallbackDetail }),
//         ...(voiceFlags.length && { voiceFlags }),
//         ...(blocked && { blocked }),
//         ...(isSafetyDosing && { coverage: { product: coverage.product, complete: coverage.complete } }),
//       });

//     } catch (error) {
//       console.error('✦ [AI] Endpoint error:', error.message, error.stack);
//       return fallbackReply(res, {
//         reason: FALLBACK_REASON.ENDPOINT_ERROR,
//         detail: error.message,
//         detailed: !!req.body?.detailedAnswerMode,
//         suggestions: voicedFallback(voiceProfile, req.body?.clientMessage || '', req.body?.chatHistory || '', req.body?.analysis || {}, req.body?.adminNote || ''),
//       });
//     }
//   });

//   // ============ BRAIN DEBUG / CACHE ============

//   router.get('/brain-debug', authenticateToken, async (req, res) => {
//     try {
//       const result = await db.pool.query(`SELECT brain_data, updated_at FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`);
//       if (!result.rows.length) return res.json({ status: 'empty', message: 'No brain data in database' });
//       const brain = result.rows[0].brain_data; const updatedAt = result.rows[0].updated_at;
//       const summary = {}; for (const [key, val] of Object.entries(brain || {})) summary[key] = Array.isArray(val) ? val.length : typeof val;
//       const productSample = (brain?.productKnowledge || []).slice(0, 3).map(r => typeof r === 'string' ? r : r?.text);
//       return res.json({ status: 'found', updatedAt, categorySummary: summary, productKnowledgeSample: productSample, totalCategories: Object.keys(brain || {}).length });
//     } catch (err) { return res.status(500).json({ error: err.message }); }
//   });

//   router.post('/brain-debug/query', authenticateToken, async (req, res) => {
//     try {
//       const { clientMessage = '', chatHistory = '' } = req.body;
//       const state = analyzeConversationState(chatHistory, clientMessage, {});
//       const query = buildBrainQuery(clientMessage, chatHistory, state);
//       const context = (await getBrainContext(db.pool, query)) || '';
//       const coverage = brainDosingCoverage(context, state.productName);
//       return res.json({
//         productAnchor: state.productName,
//         strengthAnchor: state.productStrength,
//         query,
//         isSafetyDosing: detectSafetyDosingQuestion(clientMessage, chatHistory),
//         brainChars: context.length,
//         coverage,
//         verdict: coverage.complete
//           ? "Brain HAS this product's dosing data — the model may state numbers."
//           : 'Brain has NO dosing data for this product — numbers are forbidden. Author the entry.',
//         brainPreview: context.slice(0, 1200),
//       });
//     } catch (err) { return res.status(500).json({ error: err.message }); }
//   });

//   // ── VOICE DEBUG ────────────────────────────────────────────────────────────
//   // Paste a draft reply, see which profile applies, what the scrubber fixes, and
//   // what stays broken. Pass storeIdentifier to test the profile a real store
//   // resolves to, or profileId to force one.
//   router.post('/voice-debug', authenticateToken, async (req, res) => {
//     try {
//       const { text = '', detailed = false, storeIdentifier, profileId } = req.body;
//       const profile = (profileId && PROFILES[profileId]) || await profileFor(storeIdentifier);
//       const scrubbed = scrubVoice(text, profile);
//       return res.json({
//         version: VOICE_VERSION,
//         profile: profile.id,
//         profileLabel: profile.label,
//         available: Object.keys(PROFILES),
//         original: text,
//         scrubbed,
//         changed: scrubbed !== text,
//         flagsBefore: lintVoice(text, profile, { detailed }),
//         flagsAfter: lintVoice(scrubbed, profile, { detailed }),
//         referenceReply: profile.referenceReply || null,
//       });
//     } catch (err) { return res.status(500).json({ error: err.message }); }
//   });

//   // ── FALLBACK REASON REFERENCE ──────────────────────────────────────────────
//   // The client renders these codes. Exposing the list means the frontend map can
//   // be checked against the server's actual vocabulary instead of drifting quietly
//   // — a code the client does not know still renders, but as a raw slug.
//   router.get('/fallback-reasons', authenticateToken, async (req, res) => {
//     return res.json({
//       reasons: Object.values(FALLBACK_REASON),
//       suggestMaxTokens: SUGGEST_MAX_TOKENS,
//       deepseekSuggestModel: DEEPSEEK_SUGGEST_MODEL || process.env.DEEPSEEK_MODEL || 'provider default',
//       hint: 'parse_failed with stop_reason=max_tokens means the budget went to reasoning. Raise SUGGEST_MAX_TOKENS or move fast mode to a non-reasoning model.',
//     });
//   });

//   // ── DEEPSEEK MODEL PROBE ───────────────────────────────────────────────────
//   // Lists what the account actually serves. Uses getProviderKey, the same DB-first
//   // lookup tryDeepSeekFallback uses — a curl with $DEEPSEEK_API_KEY will not work
//   // if the key lives in api_provider_keys rather than the environment.
//   router.get('/deepseek-models', authenticateToken, async (req, res) => {
//     try {
//       const { getProviderKey } = require('../lib/deepseek-fallback');
//       const key = await getProviderKey('deepseek', 'DEEPSEEK_API_KEY');
//       if (!key) return res.status(400).json({ error: 'No DeepSeek key in api_provider_keys or DEEPSEEK_API_KEY' });

//       const r = await fetch('https://api.deepseek.com/models', {
//         headers: { 'Authorization': `Bearer ${key}` },
//         signal: AbortSignal.timeout(15000),
//       });
//       const text = await r.text();
//       if (!r.ok) return res.status(502).json({ error: `DeepSeek ${r.status}`, body: text.slice(0, 500) });

//       const ids = (JSON.parse(text).data || []).map(m => m.id);
//       const { REASONING_MODEL_RE } = require('../lib/deepseek-fallback');
//       return res.json({
//         models: ids,
//         reasoning: ids.filter(id => REASONING_MODEL_RE.test(id)),
//         nonReasoning: ids.filter(id => !REASONING_MODEL_RE.test(id)),
//         currentDefault: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
//         suggestOverride: DEEPSEEK_SUGGEST_MODEL,
//         hint: 'Set DEEPSEEK_SUGGEST_MODEL to a nonReasoning entry to cut fast-mode latency. If nonReasoning is empty, the account only serves reasoning models.',
//       });
//     } catch (err) { return res.status(500).json({ error: err.message }); }
//   });

//   router.post('/brain-cache/clear', authenticateToken, async (req, res) => {
//     try {
//       if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//       refreshBrainCache();
//       return res.json({ ok: true, message: 'Brain cache cleared — next request will reload from DB' });
//     } catch (err) { return res.status(500).json({ error: err.message }); }
//   });

//   return router;
// };



const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../auth');
const { getBrainContext, getBrainSettings, refreshBrainCache } = require('../brain-context');

const {
  normalizeTypography,
  detectAITells,
  callAnthropicAPIWithRetry,
  callAIForSuggestions,
  parseAIResponse,
  extractAdminStyle,
  buildAdminStyleBlock,
  buildSystemPrompt,
  buildUserPrompt,
  buildBrainQuery,
  detectTrustQuestion,
  detectSafetyDosingQuestion,
  detectStall,
  detectInventedTimeframe,
  detectUnauthorisedUpgrade,
  detectUngroundedDate,
  STALL_RETRY_INSTRUCTION,
  buildEnhancedAnalysisBlock,
  buildCustomerContext,
  buildPolicyBlock,
  analyzeConversationState,
  pickModelTier,
  stableSystemPrefix,
  detectEmotion,
  validateSuggestions,
  validateSafetyDosing,
  generateSmartFallbackSuggestions,
} = require('../lib/ai-suggestions');

const { brainDosingCoverage, detectNumberContamination } = require('../lib/brain-guards');

const { injectProductFacts } = require('../lib/product-facts');
const { validateCommitments } = require('../lib/commitment-guards');

const {
  VOICE_VERSION,
  PROFILES,
  resolveVoiceProfile,
  scrubVoice,
  lintVoice,
  filterOnVoiceSamples,
} = require('../lib/voice');

(function assertGuardsWired() {
  const facts       = require('../lib/product-facts');
  const guards      = require('../lib/brain-guards');
  const commitments = require('../lib/commitment-guards');
  const voice       = require('../lib/voice');
  const ai          = require('../lib/ai-suggestions');

  const required = [
    [facts,       'lib/product-facts.js',     ['injectProductFacts', 'canonicalProductName', 'hasCanonicalDosing', 'allowedNumbersFor']],
    [guards,      'lib/brain-guards.js',      ['brainDosingCoverage', 'brainHasDosingAnswer', 'detectNumberContamination']],
    [commitments, 'lib/commitment-guards.js', ['validateCommitments', 'detectInventedProducts', 'detectUnauthorisedFreeOffer']],
    [voice,       'lib/voice.js',             ['resolveVoiceProfile', 'scrubVoice', 'lintVoice', 'filterOnVoiceSamples']],
    [ai,          'lib/ai-suggestions.js',    ['detectInventedTimeframe', 'detectUnauthorisedUpgrade', 'detectUngroundedDate']],
  ];
  for (const [mod, file, fns] of required) {
    for (const fn of fns) {
      if (typeof mod[fn] !== 'function') {
        throw new Error(`[BOOT] Guard missing: ${file} does not export ${fn}(). Refusing to start.`);
      }
    }
  }

  // Non-function exports this file interpolates into prompts. An undefined here
  // stringifies to the literal "undefined" inside the system prompt, and any
  // .length read on it throws inside the request handler where the outer catch
  // converts it to a fallback — every request serving canned templates behind a
  // green boot log. Assert them by name so a rename fails at boot instead.
  for (const key of ['VOICE_VERSION', 'PROFILES']) {
    if (voice[key] == null) throw new Error(`[BOOT] lib/voice.js does not export ${key}. Refusing to start.`);
  }

  // Self-test the exact failures that reached customers.
  const anchor = facts.canonicalProductName('reta');
  if (anchor !== 'Retatrutide') {
    throw new Error(`[BOOT] Alias canonicalisation broken: 'reta' resolved to '${anchor}', expected 'Retatrutide'. Every product-scoped regex would silently match nothing.`);
  }

  const dose = guards.detectNumberContamination(
    ['Reconstitute that vial with 2.5mL BAC water for 4mg/mL.'],
    '', 'Retatrutide'
  );
  if (dose.contaminated.length !== 1) {
    throw new Error('[BOOT] Contamination guard failed to block an unauthorised dose. Refusing to start.');
  }

  const promise = commitments.validateCommitments(
    ["I'll add a free Snap-8 vial to your next order as a make-good."], ''
  );
  if (promise.blocked.length !== 1) {
    throw new Error('[BOOT] Commitment guard failed to block an invented free product. Refusing to start.');
  }

  // Voice. Every assertion below passes a REAL profile. The voice functions are
  // deliberate no-ops without one, so a profile-less assertion proves nothing
  // and passes vacuously.
  const active = voice.resolveVoiceProfile({});
  if (!active?.id) throw new Error('[BOOT] resolveVoiceProfile({}) returned no profile. Refusing to start.');

  // Includes the dismissal and emoting content checks. If a new rule ever rejects
  // the owner's own reply, the rule is wrong, not the reply.
  if (active.lint) {
    if (voice.lintVoice(active.referenceReply, active, { detailed: true }).length !== 0) {
      throw new Error(`[BOOT] Voice linter rejects profile '${active.id}' own reference reply. The rules are wrong, not the reply. Refusing to start.`);
    }
  }
  // Authorisation must be line-scoped and negation-aware. A blob-wide
  // brainContext.includes('express') cleared "reshipping express" on a brain whose
  // only mention was "We do not offer express shipping" — presence read as
  // permission, polarity inverted. Assert both directions at boot.
  const denyBrain  = 'We do not offer express shipping. Standard Canada Post only.';
  const allowBrain = 'Express reship is approved for orders past 7 days.';
  const upgradeSug = ["Hello! I'm reshipping express today with new tracking!"];
  if (ai.detectUnauthorisedUpgrade(upgradeSug, denyBrain).blocked.length !== 1) {
    throw new Error('[BOOT] Upgrade guard cleared an expedited offer on a brain that DENIES it. Presence is not permission. Refusing to start.');
  }
  if (ai.detectUnauthorisedUpgrade(upgradeSug, allowBrain).blocked.length !== 0) {
    throw new Error('[BOOT] Upgrade guard blocked an expedited offer the brain explicitly approves. Refusing to start.');
  }
  // Sample must be UNBRACKETED (bracketed dates no longer flag — 100% noise over
  // seven live fires) AND must make an ARRIVAL claim (a checkpoint the agent
  // controls is not a delivery promise). "tracking by tomorrow" satisfies neither
  // condition now, so it was asserting on a case the guard deliberately ignores.
  if (ai.detectInventedTimeframe(['Hello! it arrives at your door by tomorrow!'], 'We cannot promise delivery by tomorrow.').review.length !== 1) {
    throw new Error('[BOOT] Timeframe guard treated a negated brain line as authorisation. Refusing to start.');
  }
  if (ai.detectInventedTimeframe(['Hello! it arrives at your door by tomorrow!'], 'It arrives at your door by tomorrow.').review.length !== 0) {
    throw new Error('[BOOT] Timeframe guard flagged a promise the brain affirmatively states. Refusing to start.');
  }
  // An approved live reply must be writable cleanly. "If it hasnt scanned by
  // tomorrow, I'll reship" is a checkpoint the agent controls, not a delivery
  // promise — flagging it made the reply unwritable either way, bracketed or not.
  const approved = "Hello! I'm pulling your tracking right now. If it hasnt scanned by tomorrow, I'll get a brand-new package out to you express with new tracking so you wont have to chase this again.";
  if (ai.detectInventedTimeframe([approved], 'express reship is approved').review.length !== 0) {
    throw new Error('[BOOT] Timeframe guard flags a self-imposed checkpoint as a delivery promise. An approved reply must be writable cleanly. Refusing to start.');
  }
  if (ai.detectInventedTimeframe(['Hello! it will be at your door by tomorrow!'], '').review.length !== 1) {
    throw new Error('[BOOT] Timeframe guard missed a real arrival claim. Refusing to start.');
  }
  if (ai.detectInventedTimeframe([active.referenceReply], '').review.length !== 0) {
    throw new Error("[BOOT] Timeframe guard flags the owner's own reference reply. Refusing to start.");
  }

  // Needless brackets must self-correct to the approved wording, and vague speed
  // must NOT be laundered into plain text by the same mechanism.
  const needless = "Hello! if it hasnt scanned by [tomorrow], I'll reship express.";
  if (voice.scrubVoice(needless, active) !== needless.replace('[tomorrow]', 'tomorrow')) {
    throw new Error('[BOOT] Needless bracket not stripped. "[tomorrow]" needs no substitution, so the bracket only blocks sending. Refusing to start.');
  }
  const keepThese = 'Hello! its [2-3] days and I reship by [Friday] if no scan.';
  if (voice.scrubVoice(keepThese, active) !== keepThese) {
    throw new Error('[BOOT] Scrubber removed a SUBSTITUTABLE bracket. [2-3] and [Friday] are values the agent fills in. Refusing to start.');
  }
  if (voice.scrubVoice('Hello! new tracking by [asap]!', active).includes('by asap')) {
    throw new Error('[BOOT] Scrubber laundered bracketed vague speed into plain text. "[asap]" needs a rewrite, not a bracket removal. Refusing to start.');
  }

  // Locks in the bracket fix: the mandated form must stay quiet and be counted.
  const bracketed = ai.detectInventedTimeframe(['Hello! if no scan by [tomorrow] I will reship!'], '');
  if (bracketed.review.length !== 0 || bracketed.placeholders !== 1) {
    throw new Error('[BOOT] Timeframe guard flags bracketed placeholders, which the voice block mandates. That is noise, and noise teaches agents to ignore flags. Refusing to start.');
  }

  // The upgrade guard must never block the house's own approved copy. It did:
  // "which is on us" means OUR FAULT here, and the guard read it as a comped cost,
  // deleting a correct on-voice suggestion. Assert against the real fallback
  // strings so the same class of false positive fails at boot, not in front of a
  // customer.
  const houseCopy = ai.generateSmartFallbackSuggestionsRaw('i got the wrong item', '', { detectedTopics: ['product_issue'] }, '');
  const houseBlocked = ai.detectUnauthorisedUpgrade(houseCopy, '').blocked;
  if (houseBlocked.length) {
    throw new Error(`[BOOT] Upgrade guard blocks our own approved fallback copy: ${houseBlocked.map(b => b.hits.join('/')).join(', ')}. A guard that deletes house voice is worse than no guard. Refusing to start.`);
  }
  if (ai.detectUnauthorisedUpgrade(["Hello! that date came and went which is on us, reshipping now!"], '').blocked.length) {
    throw new Error('[BOOT] Upgrade guard reads "on us" as a comped cost. In this house it means our fault. Refusing to start.');
  }
  // A past date asserted as fact is the same failure as an invented ship date,
  // pointed backwards. Live twice: "the 12th passed with no movement" on a
  // conversation that only ever said Wednesday.
  if (ai.detectUngroundedDate(['Hello! the 12th passed with no movement.'], 'Customer: it was due Wednesday.').review.length !== 1) {
    throw new Error('[BOOT] Date guard missed a calendar date absent from the conversation. Refusing to start.');
  }
  if (ai.detectUngroundedDate(['Hello! the 12th passed with no movement.'], 'Customer: my order was due the 12th.').review.length !== 0) {
    throw new Error('[BOOT] Date guard flagged a date the customer actually gave. Refusing to start.');
  }
  if (ai.detectUngroundedDate(['Hello! reshipping by [Friday]!'], '').review.length !== 0) {
    throw new Error('[BOOT] Date guard treats a bracketed slot as a claim. Refusing to start.');
  }

  if (!ai.detectUnauthorisedUpgrade(["Hello! shipping is at no cost on this one!"], '').blocked.length) {
    throw new Error('[BOOT] Upgrade guard missed an unambiguous comped shipping cost. Refusing to start.');
  }

  // Opener repair is the one thing the scrubber is allowed to ADD. Assert it fixes
  // the miss, keeps a name, is idempotent, and still cannot touch a figure.
  if (active.openerFix) {
    const noGreeting = "You're right, that date passed.";
    if (voice.scrubVoice(noGreeting, active) !== `${active.openerFix} ${noGreeting}`) {
      throw new Error('[BOOT] Opener repair did not prepend the greeting. Refusing to start.');
    }
    if (voice.scrubVoice('Hi Linda, its packed!', active) !== 'Hello Linda! its packed!') {
      throw new Error('[BOOT] Opener repair dropped the customer name when converting a greeting. Refusing to start.');
    }
    const once = voice.scrubVoice(noGreeting, active);
    if (voice.scrubVoice(once, active) !== once) {
      throw new Error('[BOOT] Opener repair is not idempotent — a second scrub changes the text. Refusing to start.');
    }
  }

  const factLine = 'Hello! Reconstitute the 10mg vial with 2.5mL BAC water for 4mg/mL, and it ships [Thursday]!';
  if (voice.scrubVoice(factLine, active) !== factLine) {
    throw new Error('[BOOT] Voice scrubber mutated a dosing line. It may only strip formatting and filler. Refusing to start.');
  }
  if (voice.lintVoice(factLine, active, { detailed: true }).some(f => f.code === 'length')) {
    throw new Error('[BOOT] Voice linter flags a complete dosing reply on length. That trains agents to trim numbers out of a dose. Refusing to start.');
  }

  console.log(`✅ [BOOT] Safety guards wired and self-tested (reta → Retatrutide; unauthorised dose blocked; invented free product blocked; voice ${voice.VOICE_VERSION}, default profile '${active.id}', reference-clean, scrubber fact-safe, dosing exempt from length).`);
})();

// Tunable models in one place.
// ── MODEL TIERS ──────────────────────────────────────────────────────────────
// Two tiers, because reply quality and cost pull in opposite directions and a
// single model has to lose one of them.
//
// ROUTINE covers turns where the answer is largely determined by the facts:
// order status, shipping windows, account questions. Voice matters least here
// and the wording is close to formulaic, so these keep the existing cheap path
// (DeepSeek primary, Haiku on fallback) and the cost profile that goes with it.
//
// PREMIUM covers turns where the wording IS the job — an angry customer, a
// refund, a trust challenge, a product recommendation, anything touching dosing.
// These skip DeepSeek entirely and go to Opus. Routing a turn here and then
// letting the cheap provider answer first would quietly undo the decision.
//
// The split matters commercially: if most traffic is routine, blended cost per
// suggestion stays near the cheap tier while the turns a customer remembers get
// the strong model.
const ROUTINE_MODEL  = 'claude-haiku-4-5';   // fallback for the cheap tier
const PREMIUM_MODEL  = 'claude-opus-5';      // the tier that earns its cost
const DETAILED_MODEL = 'claude-opus-5';      // "expand this" is always deliberate
const IMAGE_MODEL    = 'claude-sonnet-5';

// Kept under the old name because the DeepSeek shim reads `model` off the body
// and several log lines still refer to it.
const SUGGEST_MODEL  = ROUTINE_MODEL;

// Effort tunes how much the model thinks before answering. A support reply is
// not a reasoning problem, so premium fast suggestions sit at 'medium' rather
// than the 'high' default; the detailed expansion earns 'high'. Thinking is left
// ON at every tier: disabling it on Opus 5 risks tool-call text and stray tags
// leaking into the visible reply, and lowering effort is the cheaper lever.
const PREMIUM_EFFORT  = process.env.PREMIUM_EFFORT  || 'medium';
const DETAILED_EFFORT = process.env.DETAILED_EFFORT || 'high';

// A thinking-enabled Opus turn does not fit in the 15s default sized for Haiku,
// and a timeout here degrades to canned templates rather than to a slower reply.
const PREMIUM_TIMEOUT_MS = Number(process.env.PREMIUM_TIMEOUT_MS) || 60000;

// Per-intent brain budget. Reasoning cost scales with how much context the model
// has to reason over, and DeepSeek spends 93-98% of its completion tokens on
// reasoning (measured: 1175-3768 reasoning tokens to emit ~84 tokens of JSON).
//
// A dosing turn genuinely needs the full budget: product facts, reconstitution
// tables, protocols. A "where is my order" turn does not, and the critical-line
// hoist has already moved the policy lines that matter to the front, so trimming
// the tail costs nothing.
const BRAIN_BUDGET = { dosing: 12000, refund: 9000, general: 6000 };
const MAX_BRAIN_CHARS = BRAIN_BUDGET.dosing;   // ceiling, and what injectProductFacts sizes against

// Do NOT lower this to throttle latency. It is a reasoning model: cap the budget
// below the reasoning spend and it never reaches the JSON, parseAIResponse returns
// null, and every request silently serves canned templates instead.
//
// 3768 reasoning tokens was the WORST measured run, and ~84 tokens of JSON on top
// of it lands at ~3852 against a 4000 ceiling — a 4% margin. A run at or past the
// top of that range truncates mid-reasoning and never emits the closing brace,
// which is the single most likely cause of an intermittent template fallback.
// Env-overridable so this can be raised without a deploy while the non-reasoning
// model question is settled.
const SUGGEST_MAX_TOKENS = Number(process.env.SUGGEST_MAX_TOKENS) || 6000;

// DeepSeek stays primary for BOTH modes. Haiku is only reached when DeepSeek is
// unavailable or out of credit — unchanged.
//
// What changes is which DeepSeek model each mode asks for. Measured on
// deepseek-v4-pro: 93-98% of completion tokens go to chain-of-thought, 20-59s wall
// clock, and reasoning_effort was already 'low' on every call with no effect. Fast
// mode is a click-to-suggest panel and cannot wait for reasoning; detailed mode is
// a deliberate "expand this" action where the extra thinking earns its seconds.
// Both default to null = whatever DEEPSEEK_MODEL says. Defaulting to a guessed
// model name was wrong: deepseek-v4-pro is the confirmed model here and I have no
// verified non-reasoning sibling name, so shipping one as a default just buys a
// failed request per boot. Set these explicitly once GET /api/ai/deepseek-models
// tells you what the account actually serves.
const DEEPSEEK_SUGGEST_MODEL  = process.env.DEEPSEEK_SUGGEST_MODEL  || null;
// DEEPSEEK_DETAILED_MODEL is gone: detailed mode is always premium tier now and
// skips DeepSeek entirely, so a per-request hint for it had nothing to steer.

// 90s, not 25s. Measured over 9 runs: 20.1-59.1s, median 31.5s. A 25s ceiling
// would time out 6 of 9 and make Haiku the PRIMARY path for fast mode, which is
// the opposite of the rule. This sits above the worst observed run so DeepSeek
// stays primary; it exists to stop a hung socket holding the agent forever, not
// to race the provider.
const DEEPSEEK_SUGGEST_TIMEOUT_MS = Number(process.env.DEEPSEEK_SUGGEST_TIMEOUT_MS) || 90000;

// Optional. Only send a reasoning-effort override when explicitly configured —
// 'low' is already the module default and I have not verified which other values
// this account accepts.
const DEEPSEEK_SUGGEST_EFFORT = process.env.DEEPSEEK_SUGGEST_EFFORT || null;

// ── FALLBACK REASONS ───────────────────────────────────────────────────────────
// Every template response carries one of these. Before this existed, nine
// separate exits all returned an identical `{ fallback: true }` and the agent saw
// one undifferentiated "AI unavailable" chip — a config miss, a truncated
// completion, and a safety guard doing its job were indistinguishable in the UI
// and only separable by tailing server logs. The codes are the contract the
// client's FALLBACK_REASONS map renders; an unknown code degrades to the raw
// string there rather than being swallowed, so adding one here is safe.
const FALLBACK_REASON = {
  NO_API_KEY:      'no_api_key',
  PARSE_FAILED:    'parse_failed',
  SHAPE_MISMATCH:  'shape_mismatch',
  CONTAMINATION:   'number_contamination',
  DOSE_LEAK:       'unauthorised_dose_leak',
  COMMITMENT:      'unauthorised_commitment',
  UPGRADE:         'unauthorised_upgrade',
  ALL_FILTERED:    'all_filtered',
  ENDPOINT_ERROR:  'endpoint_error',
};

// Widened after a live miss. "tracking number said I would receive my package on
// Wednesday" is a missed-promise complaint, but matched none of the old terms, so
// COMPENSATION_BLOCK was never pinned and the model freely offered an express
// shipping upgrade — which that block bans outright.
const REFUND_COMPLAINT_RE = /refund|money back|reimburse|charge.?back|cancel(l|led|ling|lation)?|escalat|complaint|unacceptable|lawyer|attorney|sue|dispute|still waiting|no (tracking|update|response|communication)|missed|delay(ed|s)?|supposed to|was due|has passed|would receive|never (arrived|came|showed)|still (haven'?t|hasn'?t|not) (got|received|arrived|come)|not (arrived|received) yet/i;
const SHIPPING_LOCATION_RE = /pick.?up|collect|in.?person|in.?store|walk.?in|delivery|deliver|shipping|\bship\b|postage|courier|mail|when.*(arrive|get here|receive|come)|how long|near(by)?|close to|local\b/i;
const CRITICAL_POLICY_RE = /refund|unshipped|unfulfilled|not shipped|shipped\/|delivered|store credit|e-transfer|escalate|escalation|replacement|reship|return-to-sender|lost package|cancel|mystery vial|goodwill|compensation|free product/i;
const CRITICAL_DOSING_RE = /reconstitut|bacteriostatic|bac water|\bmg\s*\/\s*ml\b|\bunits?\b|starting dose|start dose|titrat|escalation|\bmL\b/i;
const JSON_HARDENING_SUFFIX = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOUTPUT FORMAT — ABSOLUTE, OVERRIDES EVERYTHING ABOVE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDo ALL of your thinking silently. Output NOTHING before the JSON — no analysis, no "we are asked to", no restating the customer's question, no reasoning, no preamble of any kind. Your ENTIRE response is the single JSON object and nothing else. The FIRST character you output must be { and the LAST character must be }. Start immediately with {.`;

const COMPENSATION_BLOCK = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCOMPENSATION — YOU MAY NOT INVENT A PROMISE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNever name a specific free product. The ONLY compensation you may offer is a free MYSTERY vial, chosen from current stock, and the customer does not get to pick it. "I'll add a free [product name]" is banned outright, and naming a product we do not sell is worse still.\n\nNever offer a discount, a shipping-cost refund, an expedited upgrade, or a cancellation on your own authority. Orders cannot be cancelled once placed. Anything beyond the brain's named remedies needs admin approval, and a promise you cannot keep to an already-angry customer costs more than the delay did.\n\nOffer only what the BRAIN DATA explicitly authorises, in the words it authorises.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

module.exports = function createAiRoutes({ getCachedStore }) {
  if (typeof getCachedStore !== 'function') {
    throw new Error('createAiRoutes requires a getCachedStore function');
  }

  const router = express.Router();

  const detailedFromFallback = (fallback) => ([
    { label: 'Empathetic',     text: fallback[0] || 'Unable to generate.' },
    { label: 'Thorough',       text: fallback[1] || 'Unable to generate.' },
    { label: 'Above & Beyond', text: fallback[2] || 'Unable to generate.' },
  ]);

  // Fallback templates come from lib/ai-suggestions and are written in generic
  // support English. Scrub them on the way out so a canned reply is never the
  // most obviously AI-sounding thing the customer receives.
  //
  // NOTE the explicit arrow. `.map(scrubVoice)` would pass the array INDEX as
  // the profile argument and silently disable the scrub on every element.
  const voicedFallback = (profile, ...args) =>
    generateSmartFallbackSuggestions(...args, { supportEmail: profile?.supportEmail || null })
      .map(s => scrubVoice(s, profile));

  // The single exit for a template response. Stamping the reason here rather than
  // at nine call sites means a new fallback path cannot ship without one.
  // `detail` is trimmed hard: it is rendered to an agent mid-conversation, not
  // read as a stack trace.
  const fallbackReply = (res, { reason, detail = null, provider = 'none', detailed = false, suggestions, extra = {} }) => {
    console.warn(`⚠️  [AI] FALLBACK reason=${reason} provider=${provider}${detail ? ` detail=${detail}` : ''}`);
    const body = {
      fallback: true,
      source: 'fallback',
      provider,
      fallbackReason: reason,
      ...(detail && { fallbackDetail: String(detail).slice(0, 200) }),
      ...extra,
    };
    return res.json(detailed
      ? { ...body, detailedAnswers: detailedFromFallback(suggestions) }
      : { ...body, suggestions });
  };

  // Why a completion could not be parsed. `stop_reason: 'max_tokens'` is the one
  // that matters: it means the model spent the whole budget on chain-of-thought
  // and was cut off before the closing brace. That is a config problem, not a
  // provider outage, and it reads completely differently to an agent.
  const describeParseFailure = (data, raw, provider, maxTokens) => {
    const stop = data?.stop_reason || data?.stopReason || 'unknown';
    const parts = [`${provider} returned ${raw.length} chars`, `stop_reason=${stop}`];
    if (stop === 'max_tokens') parts.push(`truncated at max_tokens=${maxTokens} before emitting JSON`);
    else if (!raw.length) parts.push('empty completion');
    return parts.join(', ');
  };

  const warnIfTruncated = (data, maxTokens, label) => {
    const stop = data?.stop_reason || data?.stopReason;
    if (stop !== 'max_tokens') return;
    console.error(
      `✦ [AI] ${label} TRUNCATED at max_tokens=${maxTokens}. A reasoning model spent the budget on chain-of-thought and never emitted the JSON. ` +
      `Fix: raise SUGGEST_MAX_TOKENS, or set DEEPSEEK_SUGGEST_MODEL to a non-reasoning entry from GET /api/ai/deepseek-models.`
    );
  };

  // Resolve the store's voice. Never throws, never blocks a reply — an unknown
  // or unreachable store falls through to the fleet default.
  const profileFor = async (storeIdentifier) => {
    if (!storeIdentifier) return resolveVoiceProfile({});
    try {
      return resolveVoiceProfile((await getCachedStore(storeIdentifier)) || {});
    } catch (err) {
      console.warn(`🗣️  [Voice] store lookup failed for "${storeIdentifier}" (${err.message}) — using fleet default`);
      return resolveVoiceProfile({});
    }
  };

  // ============ IMAGE ANALYSIS ============

  router.post('/analyze-image', authenticateToken, async (req, res) => {
    try {
      const { image, conversationId, storeIdentifier } = req.body;
      if (!image?.base64 || !image?.mimeType) return res.status(400).json({ error: 'image.base64 and image.mimeType are required' });
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!ALLOWED_TYPES.includes(image.mimeType)) return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' });
      const approxBytes = (image.base64.length * 3) / 4;
      if (approxBytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image exceeds 5 MB limit.' });
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured (missing ANTHROPIC_API_KEY)' });
      console.log(`🖼️  [ImageAnalysis] conv=${conversationId} type=${image.mimeType} approxKB=${Math.round(approxBytes / 1024)}`);
      let storeContext = '';
      if (storeIdentifier) {
        try { const store = await getCachedStore(storeIdentifier); if (store?.brand_name) storeContext = ` for ${store.brand_name}`; }
        catch (_) {}
      }
      const requestBody = JSON.stringify({ model: IMAGE_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
        { type: 'text', text: `You are a customer support assistant analyzing a screenshot uploaded by a support agent${storeContext}. Extract and report EVERYTHING visible in this image so the agent can write a precise, accurate reply to the customer.\n\nRead the ENTIRE screenshot carefully and extract:\n\n1. SCREEN TYPE — What kind of screen is this? (order confirmation, tracking page, error message, product page, payment screen, account page, chat/email, invoice, etc.)\n\n2. ALL VISIBLE TEXT — Extract every piece of text you can read: headings, labels, values, statuses, messages, error text, button labels, dates, times, prices, quantities, addresses, names, email addresses, phone numbers, reference numbers, order IDs, tracking numbers, product names, SKUs, descriptions — everything.\n\n3. KEY DATA POINTS — Specifically call out:\n   - Order/reference numbers (exact format, e.g. #1001, ORD-12345)\n   - Order status (pending, fulfilled, shipped, cancelled, refunded, etc.)\n   - Payment status and amounts (exact dollar figures)\n   - Tracking numbers and carrier names\n   - Shipping/delivery dates or estimated dates\n   - Product names, quantities, sizes, variants\n   - Customer name and email if visible\n   - Any error messages or warning text (copy exactly)\n   - Any action items, buttons, or options shown\n\n4. WHAT ISSUE THIS RELATES TO — Based on what you see, what is the customer's likely concern or question?\n\nWrite your response as a clear, structured report. Include every specific value — exact numbers, exact text, exact statuses. Do not summarize or paraphrase data — reproduce it exactly as shown. Plain text only, no markdown.` }
      ]}]});
      const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY, 1, 40000);
      const analysis = data.content?.[0]?.text || '';
      console.log(`🖼️  [ImageAnalysis] Done — ${analysis.length} chars`);
      return res.json({ analysis });
    } catch (err) { console.error('🖼️  [ImageAnalysis] Error:', err.message); return res.status(500).json({ error: 'Image analysis failed', message: err.message }); }
  });

  // ============ AI SUGGESTIONS ============

  router.post('/suggestions', authenticateToken, async (req, res) => {
    // Hoisted so the outer catch can still scrub its fallback with a real profile.
    let voiceProfile = resolveVoiceProfile({});
    try {
      const { clientMessage, chatHistory, agentStyleSamples = [], recentContext, customerName, customerEmail, storeName, storeIdentifier, analysis, adminNote, messageEdited, detailedAnswerMode, adminImage, imageAnalysis } = req.body;
      let brainSettings = req.body.brainSettings || {};
      if (!clientMessage) return res.status(400).json({ error: 'clientMessage is required' });

      voiceProfile = await profileFor(storeIdentifier);

      const contextQuality = recentContext?.contextQuality || 'minimal';
      const messageRichness = recentContext?.messageRichness || 'brief';
      console.log(`✦ [AI] context: ${contextQuality}, richness: ${messageRichness}, agentSamples: ${agentStyleSamples.length}, detailedMode: ${!!detailedAnswerMode}, imageAnalysis: ${!!imageAnalysis}, voice: ${voiceProfile.id}`);

      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        return fallbackReply(res, {
          reason: FALLBACK_REASON.NO_API_KEY,
          detail: 'ANTHROPIC_API_KEY is not set, so no model was called.',
          detailed: !!detailedAnswerMode,
          suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
        });
      }

      const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);

      // Emotion is read HERE, from the transcript, not taken from the client.
      // The panel used to compute it by counting fifteen adjectives in the
      // browser and post it up with the request, which meant a customer writing
      // "three weeks, third time asking, no reply" arrived labelled 'neutral'
      // and every escalation path downstream stayed switched off. The client
      // value is still accepted as a floor so a caller that knows something the
      // transcript does not cannot be overruled downward.
      const emotion = detectEmotion(chatHistory, clientMessage, conversationState);
      const clientSentiment = conversationState?.sentiment || analysis?.sentiment || 'neutral';
      const EMOTION_RANK = { very_negative: 0, negative: 1, neutral: 2, positive: 3, very_positive: 4 };
      const sentiment = (EMOTION_RANK[clientSentiment] ?? 2) < (EMOTION_RANK[emotion.level] ?? 2)
        ? clientSentiment
        : emotion.level;
      if (emotion.signals.length) {
        console.log(`✦ [AI] emotion: ${emotion.level} (score ${emotion.score}) — ${emotion.signals.join('; ')}${sentiment !== emotion.level ? ` [client said ${clientSentiment}, using that]` : ''}`);
      }

      const isTrustQuestion = detectTrustQuestion(clientMessage);
      const isSafetyDosing = detectSafetyDosingQuestion(clientMessage, chatHistory);
      const isRefundOrComplaint = REFUND_COMPLAINT_RE.test(clientMessage);

      if (isTrustQuestion) console.log('✦ [AI] Trust/legitimacy question detected — proof-first mode');
      if (isSafetyDosing) console.log(`✦ [AI] Dosing question — anchor: ${conversationState.productName || 'NONE'} ${conversationState.productStrength || ''}`);
      if (isRefundOrComplaint) console.log('✦ [AI] Refund/complaint — compensation rules pinned');

      const brainBudget = isSafetyDosing ? BRAIN_BUDGET.dosing
                        : isRefundOrComplaint ? BRAIN_BUDGET.refund
                        : BRAIN_BUDGET.general;

      const analysisBlock = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);
      const customerContext = buildCustomerContext(customerName, customerEmail, conversationState);
      const policyBlock = buildPolicyBlock();

      // ── STYLE LEARNING, VOICE-FILTERED ───────────────────────────────────────
      // extractAdminStyle learns from whatever the team actually sent, and
      // buildAdminStyleBlock then calls that style "non-negotiable". If those
      // replies are off-voice, the learned block argues with the voice block for
      // the rest of the conversation and usually wins, because it sits lower in
      // the prompt. Drop the bad samples before they are learned.
      const onVoiceSamples = filterOnVoiceSamples(agentStyleSamples, voiceProfile);
      const droppedSamples = agentStyleSamples.length - onVoiceSamples.length;
      if (droppedSamples > 0) console.log(`🗣️  [Voice] Dropped ${droppedSamples}/${agentStyleSamples.length} agent style sample(s) as off-voice before style extraction`);

      // The learned style block sits LOWER in the prompt than the voice block and
      // calls itself non-negotiable, so on a conflict it wins. When the profile
      // supplies a voice, strip this block back to vocabulary only.
      const voiceOwnedByProfile = !!voiceProfile.voiceBlock;
      const adminStyle = extractAdminStyle(chatHistory, onVoiceSamples);
      const adminStyleBlock = buildAdminStyleBlock(adminStyle, { voiceOwnedByProfile });
      if (adminStyle) console.log(`✦ [AI] Style: avg ${adminStyle.avgWords}w, ${adminStyle.sampleLines.length} samples, lowercase:${adminStyle.writesLowercase}, contractions:${adminStyle.usesContractions}, exclamations:${adminStyle.usesExclamation}, voiceOwnedByProfile:${voiceOwnedByProfile} (styleBlock ${adminStyleBlock.length}c)`);
      else console.log(`✦ [AI] No style yet — not enough on-voice agent replies`);

      // ── BRAIN RETRIEVAL QUERY ────────────────────────────────────────────────
      let brainSearchTerms = buildBrainQuery(clientMessage, chatHistory, conversationState);

      if (isRefundOrComplaint) {
        brainSearchTerms = `${brainSearchTerms} refund policy unshipped unfulfilled not shipped store credit e-transfer escalation cancellation replacement reship missing items delay compensation free mystery vial goodwill admin approval`;
        console.log('✦ [AI] Refund/complaint intent — augmenting brain retrieval toward refund + compensation policy');
      } else if (isSafetyDosing) {
        brainSearchTerms = `${brainSearchTerms} reconstitution bacteriostatic water mL mg/ml insulin syringe units starting dose titration weekly escalation protocol`;
        console.log('✦ [AI] Dosing intent — augmenting brain retrieval toward reconstitution/protocol');
      } else if (SHIPPING_LOCATION_RE.test(clientMessage)) {
        brainSearchTerms = `${brainSearchTerms} shipping delivery handling time dispatch pickup collection in-person order fulfillment how long to arrive shipping policy`;
        console.log('✦ [AI] Shipping/pickup/location intent — augmenting brain retrieval query');
      }

      let brainContext = '';
      let responseExamples = [];
      const needSettings = !brainSettings.length && !brainSettings.tone && !brainSettings.empathy;

      console.time('✦ [AI] brainDB');
      const [brainRes, settingsRes, exRes] = await Promise.allSettled([
        getBrainContext(db.pool, brainSearchTerms),
        needSettings ? getBrainSettings(db.pool) : Promise.resolve(null),
        db.pool.query(`SELECT brain_data -> 'responseExamples' AS examples FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`),
      ]);
      console.timeEnd('✦ [AI] brainDB');

      if (brainRes.status === 'fulfilled') brainContext = brainRes.value || '';
      else console.error('🧠 [Brain] Failed:', brainRes.reason?.message);

      if (settingsRes.status === 'fulfilled' && settingsRes.value) brainSettings = settingsRes.value;
      else if (settingsRes.status === 'rejected') console.error('🧠 [Brain] settings fetch failed:', settingsRes.reason?.message);

      if (exRes.status === 'fulfilled') responseExamples = Array.isArray(exRes.value.rows[0]?.examples) ? exRes.value.rows[0].examples : [];
      else console.error('🧠 [Brain] responseExamples fetch failed:', exRes.reason?.message);

      // These are presented to the model as the voice. Under a profile they are a
      // THIRD competing voice source, below the profile block, and this store's
      // examples carry no "Hello!" opener because that is how the team writes. Left
      // unfiltered they teach the model to drop the greeting the profile mandates.
      if (voiceOwnedByProfile && responseExamples.length) {
        const flat = responseExamples.map(r => (typeof r === 'string' ? r : r?.text)).filter(Boolean);
        const onVoice = filterOnVoiceSamples(flat, voiceProfile, { strict: true });
        const dropped = flat.length - onVoice.length;
        if (dropped) console.log(`🗣️  [Voice] Dropped ${dropped}/${flat.length} brain responseExample(s) that contradict the '${voiceProfile.id}' voice, kept ${onVoice.length}`);
        if (flat.length && !onVoice.length) console.warn(`🗣️  [Voice] ALL ${flat.length} curated responseExamples rejected. Either the '${voiceProfile.id}' profile does not match how this store actually writes, or the examples need rewriting. The DB query fetched them for nothing.`);
        responseExamples = onVoice;
      }

      if (brainContext.length > brainBudget) {
        const before = brainContext.length;
        const hoistRe = isRefundOrComplaint ? CRITICAL_POLICY_RE : isSafetyDosing ? CRITICAL_DOSING_RE : null;
        if (hoistRe) {
          const lines = brainContext.split('\n');
          const critical = [];
          const rest = [];
          for (const line of lines) (hoistRe.test(line) ? critical : rest).push(line);
          if (critical.length) {
            brainContext = [...critical, ...rest].join('\n');
            console.log(`🧠 [Brain] ${isRefundOrComplaint ? 'refund/complaint' : 'dosing'} — hoisted ${critical.length} critical line(s) before truncation`);
          }
        }
        brainContext = brainContext.slice(0, brainBudget);
        console.log(`🧠 [Brain] truncated ${before}c → ${brainBudget}c (${isSafetyDosing ? 'dosing' : isRefundOrComplaint ? 'refund' : 'general'} budget)`);
      }

      console.log(`🧠 [Brain] ${brainContext.length} chars for: "${brainSearchTerms.substring(0, 80)}" — ${responseExamples.length} example(s)`);

      if (conversationState.productName) {
        // Sized against the ceiling so the injector has room to work, then trimmed
        // back to this turn's budget. Injected product facts are prepended, so the
        // trim takes from the tail and never cuts the facts it just added.
        brainContext = injectProductFacts(brainContext, conversationState.productName, MAX_BRAIN_CHARS);
        if (brainContext.length > brainBudget) brainContext = brainContext.slice(0, brainBudget);
      }

      // ── PRODUCT-SCOPED COVERAGE ──────────────────────────────────────────────
      const coverage = brainDosingCoverage(brainContext, conversationState.productName);
      const brainHasProductAnswer = coverage.complete;

      if (isSafetyDosing && !brainHasProductAnswer) {
        console.warn(`🚨 [Brain] DOSING GAP — no authorised rule for "${conversationState.productName || 'NO ANCHOR'}". Numbers are FORBIDDEN this turn.`);
      }

      const brainUserBlock = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — BUILD YOUR REPLIES FROM THIS DATA FIRST\nIf the answer to the customer's question exists below, use it immediately.\nDo NOT say "let me check" or "let me get back to you" when the data is here.\nEvery figure belongs to the product named beside it. NEVER move a number from one product to another.\nNever name a product, price, timeline, or free item that does not appear below.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';

      // ============ DETAILED ANSWER MODE ============
      if (detailedAnswerMode) {
        const brainSystemSection = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        BRAIN RULES — READ FIRST.
        Mandatory store-owner FACTS: products, doses, protocols, policies, prices, timeframes. These override every other source of FACTS, including chat history and your own knowledge. They do NOT override the voice instructions below, say these facts the way a real person talks, not like a spec sheet.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ${brainContext}
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Use brain data as the ONLY source of truth for product info, protocols, dosing, and policies. Every number, dose, product name, and policy term must come verbatim from the matching brain rule. Every figure belongs to the product named beside it — never move a number from one product to another, no matter how plausible the arithmetic looks. Never name a product we do not sell.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ` : '';
        const imageSystemSection = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT CONTEXT — uploaded by the agent:\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
        const trustSystemSection = isTrustQuestion ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTRUST / "AM I GETTING SCAMMED" QUESTION — OVERRIDES LENGTH BELOW\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe customer fears being scammed (payment is likely e-transfer/crypto, no chargeback). A long, enthusiastic essay reads as overselling, which is a red flag here. Keep ALL three replies short and calm (2 to 4 sentences). Acknowledge the worry once and name why it is fair (the payment isn't reversible), then point ONLY to verification the brain data provides, quoted exactly. NEVER bare-assert legitimacy. NEVER invent a confirmation timeline. NEVER fabricate proof, review counts, years, or ratings.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
        const compSystemSection = isRefundOrComplaint ? COMPENSATION_BLOCK : '';

        const safetySystemSection = !isSafetyDosing ? '' : brainHasProductAnswer
          ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDOSING / SAFETY QUESTION — HONESTY GATES OVERRIDE EVERYTHING\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe product under discussion is ${conversationState.productName}${conversationState.productStrength ? ` (${conversationState.productStrength})` : ''}. The brain above HOLDS its reconstitution and dose figures — state them, exactly as written. These gates restrict what you may INVENT; they do not license stalling.\n\nNever carry a number over from your own knowledge, from another product, or from the chat history. Never do arithmetic on top of the brain's numbers. Never say a dose "is safe" or "you'll be fine", and never promise an outcome unless the brain states it.\n\nPoint to a healthcare provider ONLY if the customer actually raised getting sick, side effects, a health condition, pregnancy, or other medications. NEVER reference a symptom they never mentioned.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          : `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 DOSING QUESTION, NO DATA FOR THIS PRODUCT — NUMBERS ARE FORBIDDEN\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe brain above has NO reconstitution volume, concentration, or unit math for ${conversationState.productName || 'the product being asked about'}. It DOES have those figures for OTHER products. Those belong to those products. You may not borrow, scale, adapt, or infer from them.\n\nA "1mL" beside a product in a SYRINGE spec ("1mL 29G insulin syringe") is a barrel size, NOT a reconstitution volume.\n\nBanned in all three replies: any mL volume, any mg/mL concentration, any syringe unit count. Say honestly that you're confirming the exact protocol and coming straight back.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        // Profile-supplied voice. A profile with null blocks ('direct-support')
        // contributes nothing and the prose below carries the instructions,
        // exactly as it did before profiles existed.
        const voiceSection     = voiceProfile.voiceBlock    || '';
        const examplesSection  = voiceProfile.examplesBlock || '';
        const structureSection = voiceProfile.structureLong || '';
        const fallbackLength   = structureSection ? '' : '\n\nWrite three distinct, detailed replies in flowing paragraphs. No bullet points.';

        const systemPrompt = `${trustSystemSection}${safetySystemSection}${compSystemSection}${brainSystemSection}${imageSystemSection}${adminStyleBlock ? `${adminStyleBlock}\n\n` : ''}${voiceSection}${examplesSection}${structureSection}\nYou are ghostwriting replies for a human support agent. All three styles must sound like the SAME person.\n\nNO fake time promises: state a shipping, handling, or delivery timeframe ONLY if it appears in the brain data above, quoted exactly, otherwise put a [bracketed placeholder] there. Never invent tracking status, stock, or pickup options.\n\nNever attribute a statement, symptom, or concern to the customer that they did not actually make. Never name a product, price, or free item that is not in the brain data.${fallbackLength}\n\n${policyBlock ? `Policies:\n${policyBlock}\n` : ''}${customerContext ? `Customer context:\n${customerContext}\n` : ''}${analysisBlock ? `Conversation analysis:\n${analysisBlock}\n` : ''}\nEmpathetic: Name the frustration once in the opening line, then straight into the answer. One line, never an apology paragraph.\nThorough: Covers every step, policy, and expectation the brain data authorises. Nothing left unanswered.\nAbove & Beyond: Everything in Thorough plus one genuine extra, a tip or a follow-up offer, only where the brain data authorises it.\n\nYour response MUST END with the JSON object and nothing after it. Return ONLY valid JSON:\n{\n  "detailedAnswers": [\n    { "label": "Empathetic",     "text": "..." },\n    { "label": "Thorough",       "text": "..." },\n    { "label": "Above & Beyond", "text": "..." }\n  ]\n}`;

        const userPrompt = `${brainUserBlock}Conversation history:\n${chatHistory || '(none)'}\n\nCustomer's message:\n${clientMessage}${adminNote ? `\nAdmin note: ${adminNote}` : ''}\n\nWrite 3 detailed replies. Your response must END with the JSON, nothing after it.`;
        // Detailed mode keeps the reasoning model: the agent chose to expand, so a
        // slower, better answer is the point. No timeout override, so it uses the
        // provider default.
        // Raised from 3000: on Opus this budget covers thinking AND the visible
        // reply, and a truncated completion never emits closing JSON — which
        // surfaces as a silent template fallback rather than as an error.
        const DETAILED_MAX_TOKENS = 8000;
        const requestBody = JSON.stringify({
          model: DETAILED_MODEL,
          max_tokens: DETAILED_MAX_TOKENS,
          output_config: { effort: DETAILED_EFFORT },
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        console.time('✦ [AI] llmDetailed');
        const { data: anthropicData, provider } = await callAIForSuggestions(requestBody, ANTHROPIC_API_KEY, { skipDeepSeek: true, timeoutMs: PREMIUM_TIMEOUT_MS });
        console.timeEnd('✦ [AI] llmDetailed');

        const rawContent = anthropicData.content?.[0]?.text || '';
        console.log(`✦ [AI] Detailed raw (first 300): ${rawContent.substring(0, 300)}`);
        warnIfTruncated(anthropicData, DETAILED_MAX_TOKENS, 'Detailed');

        const parsed = parseAIResponse(rawContent, 'detailedAnswers');
        if (!parsed) {
          return fallbackReply(res, {
            reason: FALLBACK_REASON.PARSE_FAILED,
            detail: describeParseFailure(anthropicData, rawContent, provider, DETAILED_MAX_TOKENS),
            provider,
            detailed: true,
            suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
          });
        }
        let detailedAnswers = Array.isArray(parsed.detailedAnswers) ? parsed.detailedAnswers.slice(0, 3) : null;
        if (!detailedAnswers) {
          console.warn('✦ [AI] Detailed parsed but detailedAnswers not an array — serving fallback');
          return fallbackReply(res, {
            reason: FALLBACK_REASON.SHAPE_MISMATCH,
            detail: 'The model returned JSON without a detailedAnswers array.',
            provider,
            detailed: true,
            suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
          });
        }

        // Essay mode is MORE prone to both failures — a longer reply gives it far more
        // room to helpfully "fill in" a ratio or invent a goodwill gesture.
        const texts = detailedAnswers.map(a => a?.text || '');
        const { contaminated } = detectNumberContamination(texts, brainContext, conversationState.productName);
        const { blocked: cBlocked } = validateCommitments(texts, brainContext);
        if (contaminated.length || cBlocked.length) {
          const why = contaminated.length ? FALLBACK_REASON.CONTAMINATION : FALLBACK_REASON.COMMITMENT;
          console.error(`🚨 [AI] Detailed mode blocked (${why}) — serving fallback rather than a borrowed dose or an invented promise`);
          return fallbackReply(res, {
            reason: why,
            detail: contaminated.length
              ? 'Every detailed reply carried a dose figure the brain does not authorise.'
              : 'Every detailed reply made a promise the brain does not authorise.',
            provider,
            detailed: true,
            suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
            extra: { blocked: why },
          });
        }

        // Voice pass LAST — after every safety guard has had its say, so a scrub
        // never changes what a guard already inspected.
        const detailedVoiceFlags = [];
        const detailedAiTells = [];
        detailedAnswers.forEach((a, i) => {
          if (!a?.text) return;
          a.text = scrubVoice(normalizeTypography(a.text), voiceProfile);
          const flags = lintVoice(a.text, voiceProfile, { detailed: true });
          if (flags.length) {
            detailedVoiceFlags.push({ index: i, label: a.label, flags });
            console.warn(`🗣️  [Voice] detailed[${i}] ${a.label}: ${flags.map(f => f.label).join(', ')}`);
          }
          const tells = detectAITells(a.text);
          if (tells.length) {
            detailedAiTells.push({ index: i, label: a.label, tells });
            console.warn(`🤖 [AITell] detailed[${i}] ${a.label}: ${tells.map(t => `"${t.match}"`).join(', ')}`);
          }
        });

        return res.json({
          detailedAnswers,
          fallback: false,
          source: 'ai',
          provider,
          voiceProfile: voiceProfile.id,
          voiceRulesVersion: VOICE_VERSION,
          ...(detailedVoiceFlags.length && { voiceFlags: detailedVoiceFlags }),
          ...(detailedAiTells.length && { aiTells: detailedAiTells }),
        });
      }

      // ============ FAST SUGGESTION MODE ============
      // voiceProfile is the 16th arg. buildSystemPrompt SWAPS humanVoiceBlock,
      // ROBOT_VS_HUMAN_BLOCK and lengthRule for the profile's versions when they
      // are non-null. It does not append them — stacking two voices produces a
      // prompt that mandates and forbids the same opener in the same breath.
      const systemPrompt = buildSystemPrompt(
        storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness,
        brainContext, brainSettings, adminStyleBlock, imageAnalysis,
        sentiment,
        responseExamples, isTrustQuestion, isSafetyDosing, brainHasProductAnswer,
        voiceProfile
      ) + (isRefundOrComplaint ? COMPENSATION_BLOCK : '') + JSON_HARDENING_SUFFIX;

      const userPrompt = buildUserPrompt(
        chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext,
        brainContext, imageAnalysis || '', brainHasProductAnswer
      );

      // `model` is the CLAUDE fallback model. lib/deepseek-fallback.js currently
      // ignores it and hardcodes its own, so `deepseekModel` is passed alongside as
      // an explicit hint for it to honour.
      const { tier, reasons: tierReasons } = pickModelTier({
        sentiment, isTrustQuestion, isSafetyDosing, isRefundOrComplaint, conversationState,
      });
      const isPremium = tier === 'premium';

      // Opus 5 rejects `temperature` outright (400), and thinking is on by
      // default there — effort is the lever, not sampling. The routine tier keeps
      // temperature because Haiku still accepts it and the DeepSeek shim reads it.
      // ── PROMPT CACHE ─────────────────────────────────────────────────────────
      // The voice block and the robot-vs-human examples open every system prompt
      // and do not vary by request — roughly 2.4k tokens re-sent verbatim on every
      // suggestion. Split them into their own cached block so repeat turns read
      // them at cache rates instead of paying full input price each time.
      //
      // This is metadata only. The two blocks concatenate back to byte-identical
      // text, so the model sees exactly the prompt it saw before. If the prefix
      // ever stops matching (someone reorders buildSystemPrompt's return), the
      // guard below drops back to the plain string: the cost goes up, the output
      // does not change.
      const cachePrefix = stableSystemPrefix(voiceProfile);
      const canCache = isPremium
        && systemPrompt.startsWith(cachePrefix)
        && cachePrefix.length >= 4000;   // under ~1k tokens the API will not cache it
      if (isPremium && !canCache) {
        console.warn('✦ [AI] prompt cache skipped — system prompt no longer starts with the stable prefix');
      }
      const systemField = canCache
        ? [
            { type: 'text', text: cachePrefix, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: systemPrompt.slice(cachePrefix.length) },
          ]
        : systemPrompt;


      const buildBody = (prompt) => JSON.stringify({
        model: isPremium ? PREMIUM_MODEL : SUGGEST_MODEL,
        max_tokens: SUGGEST_MAX_TOKENS,
        ...(isPremium
          ? { output_config: { effort: PREMIUM_EFFORT } }
          : { temperature: 0.6 }),
        system: systemField,
        messages: [{ role: 'user', content: prompt }],
        ...(DEEPSEEK_SUGGEST_MODEL && { deepseekModel: DEEPSEEK_SUGGEST_MODEL }),
        ...(DEEPSEEK_SUGGEST_EFFORT && { deepseekReasoningEffort: DEEPSEEK_SUGGEST_EFFORT }),
        deepseekTimeoutMs: DEEPSEEK_SUGGEST_TIMEOUT_MS,
      });

      const callOpts = isPremium
        ? { skipDeepSeek: true, timeoutMs: PREMIUM_TIMEOUT_MS }
        : {};

      console.log(`✦ [AI] tier=${tier}${tierReasons.length ? ` (${tierReasons.join(', ')})` : ''} model=${isPremium ? PREMIUM_MODEL : `deepseek→${SUGGEST_MODEL}`}`);
      console.log(`✦ [AI] Calling suggestions — brain: ${brainContext.length}c, style: ${adminStyleBlock.length}c, voice: ${voiceProfile.id}, budget: ${brainBudget}c, dsModel: ${DEEPSEEK_SUGGEST_MODEL || process.env.DEEPSEEK_MODEL || 'provider default'}, maxTokens: ${SUGGEST_MAX_TOKENS}, sysPrompt: ${systemPrompt.length}c, userPrompt: ${userPrompt.length}c, examples: ${responseExamples.length}, image: ${!!imageAnalysis}, productAnswer: ${brainHasProductAnswer}`);
      console.time('✦ [AI] llmSuggest');
      const { data: anthropicData, provider } = await callAIForSuggestions(buildBody(userPrompt), ANTHROPIC_API_KEY, callOpts);
      console.timeEnd('✦ [AI] llmSuggest');

      const rawContent = anthropicData.content?.[0]?.text || '';
      console.log(`✦ [AI] Served by: ${provider} — Raw (first 300): ${rawContent.substring(0, 300)}`);

      // Token accounting is the difference between "the provider is down" and "the
      // budget is too small". Log it on every call, not only on failure, so the
      // reasoning-vs-output split is visible before it starts truncating.
      const usage = anthropicData?.usage || {};
      if (usage.output_tokens != null || usage.completion_tokens != null) {
        console.log(`✦ [AI] usage — in:${usage.input_tokens ?? usage.prompt_tokens ?? '?'} out:${usage.output_tokens ?? usage.completion_tokens ?? '?'} reasoning:${usage.reasoning_tokens ?? '?'} cap:${SUGGEST_MAX_TOKENS} stop:${anthropicData?.stop_reason || 'unknown'}`);
        // Cache reads are the whole point of the split above. If this stays at 0
        // across repeated turns, something upstream is varying the prefix and the
        // cache is costing 1.25x on every write instead of saving on reads.
        if (canCache) {
          const wrote = usage.cache_creation_input_tokens ?? 0;
          const read  = usage.cache_read_input_tokens ?? 0;
          console.log(`✦ [AI] cache — read:${read} wrote:${wrote}${read === 0 && wrote === 0 ? ' (NOT CACHING — check the prefix is byte-stable)' : ''}`);
        }
      }
      warnIfTruncated(anthropicData, SUGGEST_MAX_TOKENS, 'Suggestions');

      let usedFallback = false;
      let blocked = null;
      let fallbackReason = null;
      let fallbackDetail = null;
      let safetyReview = [];

      const parsed = parseAIResponse(rawContent, 'suggestions');
      if (!parsed) {
        console.error(`✦ [AI] JSON parse failed (provider=${provider}). Raw:`, rawContent.substring(0, 500));
        return fallbackReply(res, {
          reason: FALLBACK_REASON.PARSE_FAILED,
          detail: describeParseFailure(anthropicData, rawContent, provider, SUGGEST_MAX_TOKENS),
          provider,
          suggestions: voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote),
        });
      }

      let suggestions;
      if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions.slice(0, 3);
      else if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3);
      else {
        suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
        usedFallback = true;
        fallbackReason = FALLBACK_REASON.SHAPE_MISMATCH;
        fallbackDetail = 'The model returned JSON without a suggestions array.';
      }

      console.log(`✦ [AI] BEFORE VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
      if (!usedFallback) {
        suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
        console.log(`✦ [AI] AFTER VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
      }

      if (!usedFallback) {
        const { clean, contaminated } = detectNumberContamination(suggestions, brainContext, conversationState.productName);
        if (contaminated.length) {
          blocked = FALLBACK_REASON.CONTAMINATION;
          suggestions = clean;
          if (!suggestions.length) {
            console.error('🚨 [AI] Every suggestion carried an unauthorised dosing number — serving honest fallback');
            suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
            usedFallback = true;
            fallbackReason = FALLBACK_REASON.CONTAMINATION;
            fallbackDetail = `Every reply carried a dose figure the brain does not authorise for ${conversationState.productName || 'this product'}.`;
          }
        }
        if (!brainHasProductAnswer && !usedFallback) {
          const SYRINGE = /\d+(?:\.\d+)?\s*mL\s*(?:\/\s*\d+\s*[-\s]?unit)?[^.]{0,25}?\d{2}\s*G|\b1\s*mL\s*\/\s*100\s*[-\s]?unit\b/gi;
          const leaked = suggestions.filter(s => {
            const t = String(s).replace(SYRINGE, ' ');
            return /\b[\d.]+\s*mL\b/i.test(t) || /\b[\d.]+\s*(?:mg|mcg|iu)\s*\/\s*mL\b/i.test(t);
          });
          if (leaked.length) {
            console.error(`🚨 [AI] COVERAGE=false for ${conversationState.productName || 'NO ANCHOR'} but ${leaked.length} suggestion(s) still state a dose. Serving fallback.`);
            leaked.forEach(s => console.error(`   leaked: "${String(s).slice(0, 110)}"`));
            suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
            usedFallback = true;
            blocked = FALLBACK_REASON.DOSE_LEAK;
            fallbackReason = FALLBACK_REASON.DOSE_LEAK;
            fallbackDetail = `The brain has no dosing entry for ${conversationState.productName || 'this product'}, but every reply stated one. Author the brain entry to unblock this.`;
          }
        }
      }

      if (!usedFallback) {
        const { clean, blocked: cBlocked, review } = validateCommitments(suggestions, brainContext);
        if (cBlocked.length) {
          blocked = blocked || FALLBACK_REASON.COMMITMENT;
          suggestions = clean;
          if (!suggestions.length) {
            console.error('🚨 [AI] Every suggestion made an unauthorised promise — serving honest fallback');
            suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
            usedFallback = true;
            fallbackReason = FALLBACK_REASON.COMMITMENT;
            fallbackDetail = 'Every reply promised something the brain does not authorise.';
          }
        }
        if (review.length) safetyReview = [...safetyReview, ...review];
      }

      // ── STALL GUARD ──────────────────────────────────────────────────────────
      if (!usedFallback && !blocked) {
        const { stalled } = detectStall(suggestions, { isSafetyDosing, brainHasProductAnswer });
        if (stalled) {
          try {
            console.time('✦ [AI] llmStallRetry');
            const retry = await callAIForSuggestions(buildBody(userPrompt + STALL_RETRY_INSTRUCTION), ANTHROPIC_API_KEY, callOpts);
            console.timeEnd('✦ [AI] llmStallRetry');
            warnIfTruncated(retry.data, SUGGEST_MAX_TOKENS, 'Stall retry');
            const retryParsed = parseAIResponse(retry.data.content?.[0]?.text || '', 'suggestions');
            const retrySuggestions = Array.isArray(retryParsed?.suggestions) ? retryParsed.suggestions.slice(0, 3) : null;
            if (retrySuggestions?.length) {
              let cleaned = validateSuggestions(retrySuggestions, conversationState, chatHistory);
              // The retry is under explicit pressure to produce numbers — re-check both guards.
              cleaned = detectNumberContamination(cleaned, brainContext, conversationState.productName).clean;
              cleaned = validateCommitments(cleaned, brainContext).clean;
              if (cleaned.length) {
                suggestions = cleaned;
                console.log(`✦ [AI] STALL RETRY OK (${cleaned.length}):`, JSON.stringify(cleaned));
              }
            }
          } catch (retryErr) {
            console.error('✦ [AI] Stall retry failed, keeping original:', retryErr.message);
          }
        }
      }

      if (!usedFallback && suggestions.length === 0) {
        console.log('✦ [AI] All suggestions filtered — using fallback');
        suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
        usedFallback = true;
        fallbackReason = FALLBACK_REASON.ALL_FILTERED;
        fallbackDetail = 'Validation removed every reply the model produced.';
      }

      if (isSafetyDosing && !usedFallback) {
        const result = validateSafetyDosing(suggestions, clientMessage);
        suggestions  = result.suggestions;
        safetyReview = [...safetyReview, ...result.needsReview];
      }

      // ── UNAUTHORISED UPGRADE — BLOCKS GRANTS, FLAGS DESCRIPTIONS ──────────────
      // COMPENSATION_BLOCK bans expedited upgrades on the AI's own authority. A GRANT
      // (an express reship the warehouse never agreed to) is a real cost the store
      // did not approve and the customer has been told is happening, so it is
      // dropped. A DESCRIPTION of an existing conditional/automatic tier ("express
      // applies automatically over $150") is a factual policy claim the brain may
      // simply have truncated — the guard flags it for review rather than dropping a
      // correct reply and leaving the agent with templates.
      if (!usedFallback) {
        const { clean, blocked: upBlocked, review: upReview } = detectUnauthorisedUpgrade(suggestions, brainContext);
        if (upReview.length) safetyReview = [...safetyReview, ...upReview];
        if (upBlocked.length) {
          blocked = blocked || FALLBACK_REASON.UPGRADE;
          suggestions = clean;
          if (!suggestions.length) {
            console.error('🚫 [AI] Every suggestion GRANTED an unauthorised shipping upgrade — serving honest fallback');
            suggestions = voicedFallback(voiceProfile, clientMessage, chatHistory, analysis, adminNote);
            usedFallback = true;
            fallbackReason = FALLBACK_REASON.UPGRADE;
            fallbackDetail = 'Every reply granted a shipping upgrade the brain does not authorise.';
          }
        }
      }

      // ── INVENTED TIMEFRAME — FLAGS ───────────────────────────────────────────
      // Advisory, not a block: a real brain-sourced date phrased differently must
      // not be silently deleted. The agent sees the flag and checks before sending.
      let placeholderCount = 0;
      if (!usedFallback) {
        const { review: timeReview, placeholders } = detectInventedTimeframe(suggestions, brainContext);
        placeholderCount = placeholders;
        if (timeReview.length) safetyReview = [...safetyReview, ...timeReview];

        // Everything the model was legitimately shown. A date present in any of
        // these is grounded; one that appears in none of them was invented.
        const groundingContext = [clientMessage, chatHistory, imageAnalysis || '', brainContext].join('\n');
        const { review: dateReview } = detectUngroundedDate(suggestions, groundingContext);
        if (dateReview.length) safetyReview = [...safetyReview, ...dateReview];
      }

      // ── VOICE PASS — LAST ────────────────────────────────────────────────────
      // Runs after every safety guard so a scrub can never alter text a guard
      // already cleared. scrubVoice only strips formatting and filler; anything
      // it cannot safely fix comes back as a flag for the agent to eyeball.
      suggestions = suggestions.map(s => scrubVoice(normalizeTypography(s), voiceProfile));

      const voiceFlags = [];
      suggestions.forEach((s, i) => {
        const flags = lintVoice(s, voiceProfile);
        if (flags.length) {
          voiceFlags.push({ index: i, flags });
          console.warn(`🗣️  [Voice] suggestion[${i}]: ${flags.map(f => f.detail ? `${f.label} (${f.detail})` : f.label).join(', ')}`);
        }
      });

      // AI tells are reported, never rewritten — see detectAITells(). This runs
      // independently of the voice profile, because the built-in 'direct-support'
      // profile has no lint config and would otherwise surface nothing at all.
      const aiTells = [];
      suggestions.forEach((s, i) => {
        const tells = detectAITells(s);
        if (tells.length) {
          aiTells.push({ index: i, tells });
          console.warn(`🤖 [AITell] suggestion[${i}]: ${tells.map(t => `"${t.match}"`).join(', ')}`);
        }
      });

      console.log(`✦ [AI] FINAL (${suggestions.length}) — fallback:${usedFallback}${usedFallback ? ` (${fallbackReason})` : ''}, blocked:${blocked || 'none'}, needsReview:${safetyReview.length}, voiceFlags:${voiceFlags.length}, placeholders:${placeholderCount}`);
      if (usedFallback) console.warn(`⚠️  [AI] FALLBACK reason=${fallbackReason} provider=${provider}`);

      res.json({
        suggestions,
        fallback: usedFallback,
        source: usedFallback ? 'fallback' : 'ai',
        provider,
        needsReview: safetyReview,
        placeholders: placeholderCount,
        voiceProfile: voiceProfile.id,
        voiceRulesVersion: VOICE_VERSION,
        ...(usedFallback && { fallbackReason: fallbackReason || FALLBACK_REASON.ALL_FILTERED }),
        ...(usedFallback && fallbackDetail && { fallbackDetail }),
        ...(voiceFlags.length && { voiceFlags }),
        ...(aiTells.length && { aiTells }),
        ...(blocked && { blocked }),
        ...(isSafetyDosing && { coverage: { product: coverage.product, complete: coverage.complete } }),
      });

    } catch (error) {
      console.error('✦ [AI] Endpoint error:', error.message, error.stack);
      return fallbackReply(res, {
        reason: FALLBACK_REASON.ENDPOINT_ERROR,
        detail: error.message,
        detailed: !!req.body?.detailedAnswerMode,
        suggestions: voicedFallback(voiceProfile, req.body?.clientMessage || '', req.body?.chatHistory || '', req.body?.analysis || {}, req.body?.adminNote || ''),
      });
    }
  });

  // ============ BRAIN DEBUG / CACHE ============

  router.get('/brain-debug', authenticateToken, async (req, res) => {
    try {
      const result = await db.pool.query(`SELECT brain_data, updated_at FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`);
      if (!result.rows.length) return res.json({ status: 'empty', message: 'No brain data in database' });
      const brain = result.rows[0].brain_data; const updatedAt = result.rows[0].updated_at;
      const summary = {}; for (const [key, val] of Object.entries(brain || {})) summary[key] = Array.isArray(val) ? val.length : typeof val;
      const productSample = (brain?.productKnowledge || []).slice(0, 3).map(r => typeof r === 'string' ? r : r?.text);
      return res.json({ status: 'found', updatedAt, categorySummary: summary, productKnowledgeSample: productSample, totalCategories: Object.keys(brain || {}).length });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  });

  router.post('/brain-debug/query', authenticateToken, async (req, res) => {
    try {
      const { clientMessage = '', chatHistory = '' } = req.body;
      const state = analyzeConversationState(chatHistory, clientMessage, {});
      const query = buildBrainQuery(clientMessage, chatHistory, state);
      const context = (await getBrainContext(db.pool, query)) || '';
      const coverage = brainDosingCoverage(context, state.productName);
      return res.json({
        productAnchor: state.productName,
        strengthAnchor: state.productStrength,
        query,
        isSafetyDosing: detectSafetyDosingQuestion(clientMessage, chatHistory),
        brainChars: context.length,
        coverage,
        verdict: coverage.complete
          ? "Brain HAS this product's dosing data — the model may state numbers."
          : 'Brain has NO dosing data for this product — numbers are forbidden. Author the entry.',
        brainPreview: context.slice(0, 1200),
      });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  });

  // ── VOICE DEBUG ────────────────────────────────────────────────────────────
  // Paste a draft reply, see which profile applies, what the scrubber fixes, and
  // what stays broken. Pass storeIdentifier to test the profile a real store
  // resolves to, or profileId to force one.
  router.post('/voice-debug', authenticateToken, async (req, res) => {
    try {
      const { text = '', detailed = false, storeIdentifier, profileId } = req.body;
      const profile = (profileId && PROFILES[profileId]) || await profileFor(storeIdentifier);
      const scrubbed = scrubVoice(text, profile);
      return res.json({
        version: VOICE_VERSION,
        profile: profile.id,
        profileLabel: profile.label,
        available: Object.keys(PROFILES),
        original: text,
        scrubbed,
        changed: scrubbed !== text,
        flagsBefore: lintVoice(text, profile, { detailed }),
        flagsAfter: lintVoice(scrubbed, profile, { detailed }),
        referenceReply: profile.referenceReply || null,
      });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  });

  // ── FALLBACK REASON REFERENCE ──────────────────────────────────────────────
  // The client renders these codes. Exposing the list means the frontend map can
  // be checked against the server's actual vocabulary instead of drifting quietly
  // — a code the client does not know still renders, but as a raw slug.
  router.get('/fallback-reasons', authenticateToken, async (req, res) => {
    return res.json({
      reasons: Object.values(FALLBACK_REASON),
      suggestMaxTokens: SUGGEST_MAX_TOKENS,
      deepseekSuggestModel: DEEPSEEK_SUGGEST_MODEL || process.env.DEEPSEEK_MODEL || 'provider default',
      hint: 'parse_failed with stop_reason=max_tokens means the budget went to reasoning. Raise SUGGEST_MAX_TOKENS or move fast mode to a non-reasoning model.',
    });
  });

  // ── DEEPSEEK MODEL PROBE ───────────────────────────────────────────────────
  // Lists what the account actually serves. Uses getProviderKey, the same DB-first
  // lookup tryDeepSeekFallback uses — a curl with $DEEPSEEK_API_KEY will not work
  // if the key lives in api_provider_keys rather than the environment.
  router.get('/deepseek-models', authenticateToken, async (req, res) => {
    try {
      const { getProviderKey } = require('../lib/deepseek-fallback');
      const key = await getProviderKey('deepseek', 'DEEPSEEK_API_KEY');
      if (!key) return res.status(400).json({ error: 'No DeepSeek key in api_provider_keys or DEEPSEEK_API_KEY' });

      const r = await fetch('https://api.deepseek.com/models', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      });
      const text = await r.text();
      if (!r.ok) return res.status(502).json({ error: `DeepSeek ${r.status}`, body: text.slice(0, 500) });

      const ids = (JSON.parse(text).data || []).map(m => m.id);
      const { REASONING_MODEL_RE } = require('../lib/deepseek-fallback');
      return res.json({
        models: ids,
        reasoning: ids.filter(id => REASONING_MODEL_RE.test(id)),
        nonReasoning: ids.filter(id => !REASONING_MODEL_RE.test(id)),
        currentDefault: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
        suggestOverride: DEEPSEEK_SUGGEST_MODEL,
        hint: 'Set DEEPSEEK_SUGGEST_MODEL to a nonReasoning entry to cut fast-mode latency. If nonReasoning is empty, the account only serves reasoning models.',
      });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  });

  router.post('/brain-cache/clear', authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      refreshBrainCache();
      return res.json({ ok: true, message: 'Brain cache cleared — next request will reload from DB' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  });

  return router;
};