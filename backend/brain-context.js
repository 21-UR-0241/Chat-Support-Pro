
// // let _brainCacheTime = 0;
// // const BRAIN_TTL = 5 * 60 * 1000;

// // // ── Topic detection ───────────────────────────────────────────────────────────
// // const TOPIC_PATTERNS = {
// //   recommendation: /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)/i,
// //   dosing:   /dose|dosing|dosage|reconstitut|bac water|inject|vial|mix|dilut|mg|mcg|unit|syringe|needle|how (do|to) use|how much|subcutan|administr/i,
// //   shipping: /ship|track|deliver|delay|usps|canada post|transit|in transit|stuck|where is|package|parcel|carrier|courier|estimated|arrival|dispatch/i,
// //   refund:   /refund|return|cancel|money back|charge|chargeback|credit|reimburse|dispute/i,
// //   order:    /order|status|confirm|invoice|purchased|bought|receipt|processing|fulfil/i,
// //   payment:  /payment|pay|paid|card|declined|checkout|billing|charge|transaction/i,
// //   product:  /bpc|tb-500|sema|tirzep|cjc|ipamorelin|hgh|nad|ghk|wolverine|peptide|product|item|vial|kit|blend/i,
// //   storage:  /storage|store|refrigerat|freezer|fridge|temperature|shelf life|expir|stable/i,
// //   french:   /bonjour|merci|svp|s'il vous|monsieur|madame|commander|livraison|remboursement/i,
// //   coa:      /coa|certificate|analysis|purity|test|lab|hplc|third.party/i,
// // };

// // function detectTopic(customerMessage = '') {
// //   if (!customerMessage) return 'general';
// //   for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
// //     if (pattern.test(customerMessage)) return topic;
// //   }
// //   return 'general';
// // }

// // const TOPIC_PRIORITY = {
// //   recommendation: ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
// //   dosing:         ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
// //   shipping:       ['customPolicies', 'preferPatterns', 'avoidPatterns', 'productKnowledge', 'toneRules'],
// //   refund:         ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
// //   order:          ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
// //   payment:        ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules'],
// //   product:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
// //   storage:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
// //   french:         ['toneRules', 'preferPatterns', 'avoidPatterns', 'customPolicies', 'productKnowledge'],
// //   coa:            ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
// //   general:        ['productKnowledge', 'preferPatterns', 'avoidPatterns', 'toneRules', 'customPolicies'],
// // };

// // const TOPIC_CAPS = {
// //   recommendation: [20, 5, 4, 3, 2],
// //   dosing:         [10, 5, 4, 3, 2],
// //   shipping:       [5,  5, 4, 3, 2],
// //   refund:         [5,  5, 4, 3, 2],
// //   product:        [10, 5, 4, 3, 2],
// //   storage:        [8,  5, 4, 3, 2],
// //   coa:            [8,  5, 4, 3, 2],
// //   general:        [8,  4, 3, 3, 2],
// // };

// // // ── Rule normaliser ───────────────────────────────────────────────────────────
// // // Rules can be stored as plain strings OR as {text, confidence} objects.
// // // Normalise everything to {text, confidence} so the rest of the code
// // // doesn't need to branch.
// // function normaliseRule(rule) {
// //   if (!rule) return null;
// //   if (typeof rule === 'string') {
// //     return rule.trim() ? { text: rule.trim(), confidence: 'normal' } : null;
// //   }
// //   if (typeof rule === 'object' && rule.text) {
// //     return { text: String(rule.text).trim(), confidence: rule.confidence || 'normal' };
// //   }
// //   return null;
// // }

// // // ── Dedup helpers ─────────────────────────────────────────────────────────────
// // function keywords(text) {
// //   const stop = new Set([
// //     'never','always','dont','do','not','the','a','an','if','when','to','for',
// //     'in','is','are','and','or','with','of','that','this','their','your','has',
// //     'have','already','from','about','ask','customer','customers','order','number',
// //     'message','provided','information','response','use','make','should','would',
// //     'they','you','them','been','will','just','then','than','only','very',
// //   ]);
// //   return text.toLowerCase()
// //     .replace(/[^a-z0-9 ]/g, ' ')
// //     .split(/\s+/)
// //     .filter(w => w.length > 3 && !stop.has(w));
// // }

// // function similarity(a, b) {
// //   const ka = new Set(keywords(a));
// //   const kb = new Set(keywords(b));
// //   if (!ka.size || !kb.size) return 0;
// //   let overlap = 0;
// //   for (const w of ka) if (kb.has(w)) overlap++;
// //   return overlap / Math.max(ka.size, kb.size);
// // }

// // // isProduct=true → higher threshold so different peptide protocols
// // // (sharing "bac water", "mg", "vial") are never collapsed together.
// // function deduplicate(rules, max, threshold = 0.5, globalSeen = [], isProduct = false) {
// //   const effectiveThreshold = isProduct ? 0.75 : threshold;
// //   const kept = [];

// //   for (const raw of rules) {
// //     // ← FIX: normalise first so both strings and objects are handled
// //     const rule = normaliseRule(raw);
// //     if (!rule) continue;

// //     const isDupe =
// //       kept.some(k => similarity(k.text, rule.text) >= effectiveThreshold) ||
// //       globalSeen.some(k => similarity(k.text, rule.text) >= effectiveThreshold);

// //     if (!isDupe) {
// //       kept.push(rule);
// //       globalSeen.push(rule);
// //     }
// //     if (kept.length >= max) break;
// //   }
// //   return kept;
// // }

// // // ── Category labels ───────────────────────────────────────────────────────────
// // const CATEGORY_META = {
// //   productKnowledge: { label: 'PRODUCT FACTS',  prefix: '•' },
// //   customPolicies:   { label: 'STORE POLICIES', prefix: '•' },
// //   preferPatterns:   { label: 'ALWAYS DO',      prefix: '✓' },
// //   avoidPatterns:    { label: 'NEVER DO',        prefix: '✗' },
// //   toneRules:        { label: 'TONE',            prefix: '•' },
// //   responseExamples: { label: 'EXAMPLE REPLIES', prefix: '"' },
// // };

// // // ── Format brain into prompt block ────────────────────────────────────────────
// // function formatBrainContext(brain, topic = 'general') {
// //   if (!brain) return '';

// //   const priority   = TOPIC_PRIORITY[topic] || TOPIC_PRIORITY.general;
// //   const caps       = TOPIC_CAPS[topic]     || TOPIC_CAPS.general;
// //   const globalSeen = [];
// //   const sections   = [];

// //   sections.push(`[Brain context — topic: ${topic.toUpperCase()}]`);

// //   priority.forEach((categoryKey, idx) => {
// //     const rawRules = brain[categoryKey];
// //     if (!Array.isArray(rawRules) || rawRules.length === 0) return;

// //     const cap       = caps[idx] ?? 2;
// //     const threshold = idx === 0 ? 0.45 : 0.5;
// //     const isProduct = categoryKey === 'productKnowledge';
// //     const deduped   = deduplicate(rawRules, cap, threshold, globalSeen, isProduct);
// //     if (!deduped.length) return;

// //     const meta = CATEGORY_META[categoryKey];
// //     if (!meta) return;

// //     sections.push(`\n${meta.label}:`);
// //     deduped.forEach(r => {
// //       const prefix = r.confidence === 'high' ? '⚡' : meta.prefix;
// //       sections.push(`${prefix} ${r.text}`);
// //     });
// //   });

// //   // Append examples if not already in priority list
// //   if (brain.responseExamples?.length && !priority.includes('responseExamples')) {
// //     const deduped = deduplicate(brain.responseExamples, 2, 0.4, globalSeen);
// //     if (deduped.length) {
// //       sections.push(`\nEXAMPLE REPLIES:`);
// //       deduped.forEach(r => sections.push(`"${r.text}"`));
// //     }
// //   }

// //   return sections.join('\n');
// // }

// // // ── Cache keyed by topic ──────────────────────────────────────────────────────
// // const _topicCaches = {};

// // async function getBrainContext(pool, customerMessage = '') {
// //   const topic = detectTopic(customerMessage);
// //   const now   = Date.now();

// //   const cached = _topicCaches[topic];
// //   if (cached && (now - cached.time) < BRAIN_TTL) {
// //     console.log(`🧠 [Brain] cache hit — topic=${topic}, ${cached.value.length} chars`);
// //     return cached.value;
// //   }

// //   try {
// //     const result = await pool.query(
// //       `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
// //     );

// //     if (!result.rows.length || !result.rows[0].brain_data) {
// //       console.log(`🧠 [Brain] no data in db`);
// //       _topicCaches[topic] = { value: '', time: now };
// //       return '';
// //     }

// //     const brain   = result.rows[0].brain_data;

// //     // Log category sizes to make empty brain immediately obvious
// //     const sizes = Object.entries(brain)
// //       .filter(([, v]) => Array.isArray(v))
// //       .map(([k, v]) => `${k}:${v.length}`)
// //       .join(', ');
// //     console.log(`🧠 [Brain] DB categories — ${sizes || 'none'}`);

// //     const context = formatBrainContext(brain, topic);
// //     console.log(`🧠 [Brain] topic=${topic}, ${context.length} chars injected`);

// //     if (context.length < 50) {
// //       console.log(`🧠 [Brain] WARNING: very short context — check that brain data is saved with content`);
// //     }

// //     _topicCaches[topic] = { value: context, time: now };
// //     return context;

// //   } catch (err) {
// //     console.error('[Brain] Failed to load:', err.message);
// //     _topicCaches[topic] = { value: '', time: now };
// //     return '';
// //   }
// // }

// // function refreshBrainCache() {
// //   Object.keys(_topicCaches).forEach(k => delete _topicCaches[k]);
// //   _brainCacheTime = 0;
// //   console.log('🧠 [Brain] All topic caches cleared');
// // }

// // async function getBrainSettings(pool) {
// //   try {
// //     const result = await pool.query(
// //       `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
// //     );
// //     const brain = result.rows[0]?.brain_data;
// //     return brain?.suggestionSettings || {};
// //   } catch {
// //     return {};
// //   }
// // }

// // module.exports = { getBrainContext, refreshBrainCache, getBrainSettings };


// let _brainCacheTime = 0;
// const BRAIN_TTL = 5 * 60 * 1000;

// // ── Topic detection ───────────────────────────────────────────────────────────
// const TOPIC_PATTERNS = {
//   recommendation: /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)/i,
//   dosing:   /dose|dosing|dosage|reconstitut|bac water|inject|vial|mix|dilut|mg|mcg|unit|syringe|needle|how (do|to) use|how much|subcutan|administr/i,
//   shipping: /ship|track|deliver|delay|usps|canada post|transit|in transit|stuck|where is|package|parcel|carrier|courier|estimated|arrival|dispatch/i,
//   refund:   /refund|return|cancel|money back|charge|chargeback|credit|reimburse|dispute/i,
//   order:    /order|status|confirm|invoice|purchased|bought|receipt|processing|fulfil/i,
//   payment:  /payment|pay|paid|card|declined|checkout|billing|charge|transaction/i,
//   product:  /bpc|tb-500|sema|tirzep|cjc|ipamorelin|hgh|nad|ghk|wolverine|peptide|product|item|vial|kit|blend/i,
//   storage:  /storage|store|refrigerat|freezer|fridge|temperature|shelf life|expir|stable/i,
//   french:   /bonjour|merci|svp|s'il vous|monsieur|madame|commander|livraison|remboursement/i,
//   coa:      /coa|certificate|analysis|purity|test|lab|hplc|third.party/i,
// };

// function detectTopic(customerMessage = '') {
//   if (!customerMessage) return 'general';
//   for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
//     if (pattern.test(customerMessage)) return topic;
//   }
//   return 'general';
// }

// const TOPIC_PRIORITY = {
//   recommendation: ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
//   dosing:         ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
//   shipping:       ['customPolicies', 'preferPatterns', 'avoidPatterns', 'productKnowledge', 'toneRules'],
//   refund:         ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
//   order:          ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
//   payment:        ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules'],
//   product:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
//   storage:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
//   french:         ['toneRules', 'preferPatterns', 'avoidPatterns', 'customPolicies', 'productKnowledge'],
//   coa:            ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
//   general:        ['productKnowledge', 'preferPatterns', 'avoidPatterns', 'toneRules', 'customPolicies'],
// };

// // Tightened caps — product knowledge max reduced from 20 to 6
// // to avoid injecting unrelated peptide protocols as noise.
// const TOPIC_CAPS = {
//   recommendation: [6, 4, 3, 3, 2],
//   dosing:         [6, 4, 3, 3, 2],
//   shipping:       [4, 4, 3, 3, 2],
//   refund:         [4, 4, 3, 3, 2],
//   product:        [6, 4, 3, 3, 2],
//   storage:        [5, 4, 3, 3, 2],
//   coa:            [5, 4, 3, 3, 2],
//   general:        [5, 3, 3, 3, 2],
// };

// // ── Rule normaliser ───────────────────────────────────────────────────────────
// function normaliseRule(rule) {
//   if (!rule) return null;
//   if (typeof rule === 'string') {
//     return rule.trim() ? { text: rule.trim(), confidence: 'normal' } : null;
//   }
//   if (typeof rule === 'object' && rule.text) {
//     return { text: String(rule.text).trim(), confidence: rule.confidence || 'normal' };
//   }
//   return null;
// }

// // ── Dedup helpers ─────────────────────────────────────────────────────────────
// function keywords(text) {
//   const stop = new Set([
//     'never','always','dont','do','not','the','a','an','if','when','to','for',
//     'in','is','are','and','or','with','of','that','this','their','your','has',
//     'have','already','from','about','ask','customer','customers','order','number',
//     'message','provided','information','response','use','make','should','would',
//     'they','you','them','been','will','just','then','than','only','very',
//   ]);
//   return text.toLowerCase()
//     .replace(/[^a-z0-9 ]/g, ' ')
//     .split(/\s+/)
//     .filter(w => w.length > 3 && !stop.has(w));
// }

// function similarity(a, b) {
//   const ka = new Set(keywords(a));
//   const kb = new Set(keywords(b));
//   if (!ka.size || !kb.size) return 0;
//   let overlap = 0;
//   for (const w of ka) if (kb.has(w)) overlap++;
//   return overlap / Math.max(ka.size, kb.size);
// }

// function deduplicate(rules, max, threshold = 0.5, globalSeen = [], isProduct = false) {
//   const effectiveThreshold = isProduct ? 0.75 : threshold;
//   const kept = [];
//   for (const raw of rules) {
//     const rule = normaliseRule(raw);
//     if (!rule) continue;
//     const isDupe =
//       kept.some(k => similarity(k.text, rule.text) >= effectiveThreshold) ||
//       globalSeen.some(k => similarity(k.text, rule.text) >= effectiveThreshold);
//     if (!isDupe) {
//       kept.push(rule);
//       globalSeen.push(rule);
//     }
//     if (kept.length >= max) break;
//   }
//   return kept;
// }

// // ── Message-level relevance scoring ──────────────────────────────────────────
// // Scores a brain entry against the specific customer message so we can
// // surface the most relevant entries first rather than injecting everything.
// //
// // Strategy:
// //   1. Extract keywords from the customer message
// //   2. For each brain entry, count how many of those keywords appear in it
// //   3. Bonus points for exact peptide name matches (highest signal)
// //   4. Return a 0–1 score
// //
// function scoreRelevance(entryText, messageKeywords, exactTerms) {
//   if (!entryText || !messageKeywords.length) return 0;
//   const entryLower = entryText.toLowerCase();
  
//   // Exact term match — highest weight (peptide names, product names)
//   let exactMatches = 0;
//   for (const term of exactTerms) {
//     if (entryLower.includes(term)) exactMatches++;
//   }

//   // Keyword overlap
//   let kwMatches = 0;
//   for (const kw of messageKeywords) {
//     if (entryLower.includes(kw)) kwMatches++;
//   }

//   const exactScore = exactMatches > 0 ? (exactMatches / exactTerms.length) * 0.6 : 0;
//   const kwScore    = messageKeywords.length > 0 ? (kwMatches / messageKeywords.length) * 0.4 : 0;

//   return exactScore + kwScore;
// }

// // Extract exact product/peptide names mentioned in the message.
// // These are the highest-signal terms for filtering product knowledge.
// const KNOWN_PRODUCTS = [
//   'retatrutide', 'reta',
//   'semaglutide', 'sema', 'ozempic', 'wegovy',
//   'tirzepatide', 'tirz', 'mounjaro',
//   'bpc-157', 'bpc157', 'bpc',
//   'tb-500', 'tb500',
//   'cjc-1295', 'cjc1295', 'cjc',
//   'ipamorelin', 'ipa',
//   'ghk-cu', 'ghkcu', 'ghk',
//   'tesamorelin', 'tesa',
//   'sermorelin',
//   'nad+', 'nad',
//   'wolverine', 'glow', 'klow',
//   'mots-c', 'motsc',
//   'pt-141', 'pt141',
//   'selank', 'semax',
//   'epithalon',
//   'bac water', 'bacteriostatic', 'reconstitution solution', 'recon water',
// ];

// function extractExactTerms(message) {
//   const lower = message.toLowerCase();
//   return KNOWN_PRODUCTS.filter(p => lower.includes(p));
// }

// // ── Sort product knowledge by relevance to the specific message ───────────────
// // Non-product categories (policies, tone, etc.) are left in original order
// // since they don't need message-level filtering.
// function sortByRelevance(rules, customerMessage) {
//   if (!customerMessage || !rules.length) return rules;

//   const msgKeywords = keywords(customerMessage);
//   const exactTerms  = extractExactTerms(customerMessage);

//   // If no specific product terms detected, return original order
//   // (avoids incorrectly deprioritizing general knowledge entries)
//   if (exactTerms.length === 0 && msgKeywords.length < 3) return rules;

//   return [...rules]
//     .map(raw => {
//       const rule = normaliseRule(raw);
//       if (!rule) return { raw, score: 0 };
//       return { raw, score: scoreRelevance(rule.text, msgKeywords, exactTerms) };
//     })
//     .sort((a, b) => b.score - a.score)
//     .map(item => item.raw);
// }

// // ── Category labels ───────────────────────────────────────────────────────────
// const CATEGORY_META = {
//   productKnowledge: { label: 'PRODUCT FACTS',   prefix: '•' },
//   customPolicies:   { label: 'STORE POLICIES',  prefix: '•' },
//   preferPatterns:   { label: 'ALWAYS DO',       prefix: '✓' },
//   avoidPatterns:    { label: 'NEVER DO',         prefix: '✗' },
//   toneRules:        { label: 'TONE',             prefix: '•' },
//   responseExamples: { label: 'EXAMPLE REPLIES',  prefix: '"' },
// };

// // ── Format brain into prompt block ────────────────────────────────────────────
// function formatBrainContext(brain, topic = 'general', customerMessage = '') {
//   if (!brain) return '';

//   const priority   = TOPIC_PRIORITY[topic] || TOPIC_PRIORITY.general;
//   const caps       = TOPIC_CAPS[topic]     || TOPIC_CAPS.general;
//   const globalSeen = [];
//   const sections   = [];

//   const exactTerms = extractExactTerms(customerMessage);
//   const topicLabel = exactTerms.length > 0
//     ? `${topic.toUpperCase()} — filtered for: ${exactTerms.join(', ')}`
//     : topic.toUpperCase();

//   sections.push(`[Brain context — topic: ${topicLabel}]`);

//   priority.forEach((categoryKey, idx) => {
//     const rawRules = brain[categoryKey];
//     if (!Array.isArray(rawRules) || rawRules.length === 0) return;

//     const cap       = caps[idx] ?? 2;
//     const threshold = idx === 0 ? 0.45 : 0.5;
//     const isProduct = categoryKey === 'productKnowledge';

//     // For product knowledge, sort by relevance to the specific message first
//     // so the most applicable entries bubble to the top before the cap applies.
//     const sorted = isProduct
//       ? sortByRelevance(rawRules, customerMessage)
//       : rawRules;

//     const deduped = deduplicate(sorted, cap, threshold, globalSeen, isProduct);
//     if (!deduped.length) return;

//     const meta = CATEGORY_META[categoryKey];
//     if (!meta) return;

//     sections.push(`\n${meta.label}:`);
//     deduped.forEach(r => {
//       const prefix = r.confidence === 'high' ? '⚡' : meta.prefix;
//       sections.push(`${prefix} ${r.text}`);
//     });
//   });

//   // Append examples if not already in priority list
//   if (brain.responseExamples?.length && !priority.includes('responseExamples')) {
//     const deduped = deduplicate(brain.responseExamples, 2, 0.4, globalSeen);
//     if (deduped.length) {
//       sections.push(`\nEXAMPLE REPLIES:`);
//       deduped.forEach(r => sections.push(`"${r.text}"`));
//     }
//   }

//   return sections.join('\n');
// }

// // ── Cache keyed by topic + message fingerprint ────────────────────────────────
// // Previously cached only by topic — so "lose weight" and "build muscle" both
// // hit the same "recommendation" cache and got identical brain context even
// // though different product entries are relevant to each.
// // Now we cache by topic + a lightweight hash of the customer message so each
// // distinct question gets its own relevance-sorted result.
// const _topicCaches = {};

// function messageFingerprint(msg) {
//   // Simple fingerprint: topic + sorted exact product terms found in message.
//   // Cheap to compute, good enough for cache keying.
//   const topic      = detectTopic(msg);
//   const exactTerms = extractExactTerms(msg).sort().join(',');
//   return `${topic}::${exactTerms}`;
// }

// async function getBrainContext(pool, customerMessage = '') {
//   const topic       = detectTopic(customerMessage);
//   const fingerprint = messageFingerprint(customerMessage);
//   const now         = Date.now();

//   const cached = _topicCaches[fingerprint];
//   if (cached && (now - cached.time) < BRAIN_TTL) {
//     console.log(`🧠 [Brain] cache hit — ${fingerprint}, ${cached.value.length} chars`);
//     return cached.value;
//   }

//   try {
//     const result = await pool.query(
//       `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
//     );

//     if (!result.rows.length || !result.rows[0].brain_data) {
//       console.log(`🧠 [Brain] no data in db`);
//       _topicCaches[fingerprint] = { value: '', time: now };
//       return '';
//     }

//     const brain = result.rows[0].brain_data;

//     const sizes = Object.entries(brain)
//       .filter(([, v]) => Array.isArray(v))
//       .map(([k, v]) => `${k}:${v.length}`)
//       .join(', ');
//     console.log(`🧠 [Brain] DB categories — ${sizes || 'none'}`);

//     const context = formatBrainContext(brain, topic, customerMessage);
//     console.log(`🧠 [Brain] fingerprint=${fingerprint}, ${context.length} chars injected`);

//     if (context.length < 50) {
//       console.log(`🧠 [Brain] WARNING: very short context — check brain data`);
//     }

//     _topicCaches[fingerprint] = { value: context, time: now };
//     return context;

//   } catch (err) {
//     console.error('[Brain] Failed to load:', err.message);
//     _topicCaches[fingerprint] = { value: '', time: now };
//     return '';
//   }
// }

// function refreshBrainCache() {
//   Object.keys(_topicCaches).forEach(k => delete _topicCaches[k]);
//   _brainCacheTime = 0;
//   console.log('🧠 [Brain] All topic caches cleared');
// }

// async function getBrainSettings(pool) {
//   try {
//     const result = await pool.query(
//       `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
//     );
//     const brain = result.rows[0]?.brain_data;
//     return brain?.suggestionSettings || {};
//   } catch {
//     return {};
//   }
// }

// module.exports = { getBrainContext, refreshBrainCache, getBrainSettings };

































const BRAIN_TTL = 5 * 60 * 1000;

// ── Topic detection ───────────────────────────────────────────────────────────

const TOPIC_PATTERNS = {
  recommendation: /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)/i,
  dosing:         /dose|dosing|dosage|reconstitut|bac water|inject|vial|mix|dilut|mg|mcg|unit|syringe|needle|how (do|to) use|how much|subcutan|administr/i,
  shipping:       /ship|track|deliver|delay|usps|canada post|transit|in transit|stuck|where is|package|parcel|carrier|courier|estimated|arrival|dispatch/i,
  refund:         /refund|return|cancel|money back|charge|chargeback|credit|reimburse|dispute/i,
  order:          /order|status|confirm|invoice|purchased|bought|receipt|processing|fulfil/i,
  payment:        /payment|pay|paid|card|declined|checkout|billing|charge|transaction/i,
  product:        /bpc|tb-500|sema|tirzep|cjc|ipamorelin|hgh|nad|ghk|wolverine|peptide|product|item|vial|kit|blend/i,
  storage:        /storage|store|refrigerat|freezer|fridge|temperature|shelf life|expir|stable/i,
  french:         /bonjour|merci|svp|s'il vous|monsieur|madame|commander|livraison|remboursement/i,
  coa:            /coa|certificate|analysis|purity|test|lab|hplc|third.party/i,
};

function detectTopic(msg = '') {
  if (!msg) return 'general';
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(msg)) return topic;
  }
  return 'general';
}

// ── Known product names for relevance scoring ─────────────────────────────────

const KNOWN_PRODUCTS = [
  'retatrutide','reta','semaglutide','sema','ozempic','wegovy',
  'tirzepatide','tirz','mounjaro','bpc-157','bpc157','bpc',
  'tb-500','tb500','cjc-1295','cjc1295','cjc','ipamorelin','ipa',
  'ghk-cu','ghkcu','ghk','tesamorelin','tesa','sermorelin',
  'nad+','nad','wolverine','glow','klow','mots-c','motsc',
  'pt-141','pt141','selank','semax','epithalon',
  'bac water','bacteriostatic','reconstitution solution','recon water',
  'survodutide','cagrilintide','kisspeptin','follistatin','adipotide',
  'aicar','epo','cerebrolysin','hexarelin','ghrp','igf','mgf',
  'triptorelin','thymalin','pinealon','oxytocin','vip',
];

function extractExactTerms(msg) {
  const lower = (msg || '').toLowerCase();
  return KNOWN_PRODUCTS.filter(p => lower.includes(p));
}

// ── Rule normaliser ───────────────────────────────────────────────────────────
// Treats source=admin-feedback as the golden signal.
// These are rules explicitly written by the store owner — highest priority.

function normaliseRule(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return raw.trim() ? { text: raw.trim(), source: 'auto-analysis', golden: false } : null;
  }
  if (typeof raw === 'object' && raw.text) {
    const source = raw.source || 'auto-analysis';
    // admin-feedback = explicitly written by the store owner → golden
    // admin-upload / admin-training = manually added → semi-golden
    const golden = source === 'admin-feedback' || source === 'admin-upload' || source === 'admin-training';
    return { text: String(raw.text).trim(), source, golden, confidence: raw.confidence || 'normal' };
  }
  return null;
}

// ── Dedup helpers ─────────────────────────────────────────────────────────────
// Aggressive semantic dedup so 15 "never ask for order number" variants
// collapse into 1.

const STOP_WORDS = new Set([
  'never','always','dont','do','not','the','a','an','if','when','to','for',
  'in','is','are','and','or','with','of','that','this','their','your','has',
  'have','already','from','about','ask','customer','customers','order','number',
  'message','provided','information','response','use','make','should','would',
  'they','you','them','been','will','just','then','than','only','very',
  'already','same','again','their','once','provide','please','given','earlier',
]);

function keywords(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function similarity(a, b) {
  const ka = new Set(keywords(a));
  const kb = new Set(keywords(b));
  if (!ka.size || !kb.size) return 0;
  let overlap = 0;
  for (const w of ka) if (kb.has(w)) overlap++;
  return overlap / Math.max(ka.size, kb.size);
}

// Lower threshold for non-product categories so near-duplicates collapse.
// Product knowledge uses higher threshold so different peptide protocols
// with shared vocabulary (mg, vial, inject) don't get collapsed together.
function deduplicate(rules, max, threshold, globalSeen = []) {
  const kept = [];
  for (const raw of rules) {
    const rule = normaliseRule(raw);
    if (!rule || rule.text.length < 15) continue;
    const isDupe =
      kept.some(k => similarity(k.text, rule.text) >= threshold) ||
      globalSeen.some(k => similarity(k.text, rule.text) >= threshold);
    if (!isDupe) {
      kept.push(rule);
      globalSeen.push(rule);
    }
    if (kept.length >= max) break;
  }
  return kept;
}

// ── Relevance scoring for product knowledge ───────────────────────────────────

function scoreRelevance(entryText, msgKeywords, exactTerms) {
  if (!entryText) return 0;
  const lower = entryText.toLowerCase();
  let exactMatches = 0;
  for (const t of exactTerms) if (lower.includes(t)) exactMatches++;
  let kwMatches = 0;
  for (const kw of msgKeywords) if (lower.includes(kw)) kwMatches++;
  const exactScore = exactTerms.length  > 0 ? (exactMatches / exactTerms.length)  * 0.7 : 0;
  const kwScore    = msgKeywords.length > 0 ? (kwMatches    / msgKeywords.length)  * 0.3 : 0;
  return exactScore + kwScore;
}

function sortByRelevance(rules, customerMessage) {
  if (!customerMessage || !rules.length) return rules;
  const msgKeywords = keywords(customerMessage);
  const exactTerms  = extractExactTerms(customerMessage);
  if (exactTerms.length === 0 && msgKeywords.length < 3) return rules;
  return [...rules]
    .map(raw => {
      const rule = normaliseRule(raw);
      return { raw, score: rule ? scoreRelevance(rule.text, msgKeywords, exactTerms) : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.raw);
}

// ── Golden rule extraction ────────────────────────────────────────────────────
// Pulls admin-feedback rules from ALL categories.
// These are the store owner's non-negotiables and always go at the top.
// Aggressive dedup (0.35) so near-duplicates in avoidPatterns collapse.
// Hard cap: 8 golden rules max — forces the brain editor to stay lean.

function extractGoldenRules(brain, topic, customerMessage, globalSeen) {
  const ALL_CATS = ['avoidPatterns', 'customPolicies', 'preferPatterns', 'toneRules', 'productKnowledge'];

  // Topic-based priority for golden rules:
  // shipping topics → shipping/avoid rules first
  // product/dosing topics → product knowledge first
  const topicGoldenOrder = {
    shipping: ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
    refund:   ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
    order:    ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
    dosing:   ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
    recommendation: ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  };
  const order = topicGoldenOrder[topic] || ALL_CATS;

  const candidates = [];
  for (const cat of order) {
    const rules = brain[cat];
    if (!Array.isArray(rules)) continue;
    for (const raw of rules) {
      const rule = normaliseRule(raw);
      if (rule?.golden) candidates.push({ rule, cat });
    }
  }

  // For product knowledge golden rules, further filter by relevance to message
  const exactTerms = extractExactTerms(customerMessage);
  const msgKw = keywords(customerMessage);

  const sorted = candidates.sort((a, b) => {
    // Product knowledge: sort by relevance
    if (a.cat === 'productKnowledge' && b.cat === 'productKnowledge') {
      return scoreRelevance(b.rule.text, msgKw, exactTerms) -
             scoreRelevance(a.rule.text, msgKw, exactTerms);
    }
    // Non-product: original order preserved
    return 0;
  });

  const golden = [];
  for (const { rule } of sorted) {
    const isDupe =
      golden.some(g => similarity(g.text, rule.text) >= 0.35) ||
      globalSeen.some(g => similarity(g.text, rule.text) >= 0.35);
    if (!isDupe) {
      golden.push(rule);
      globalSeen.push(rule);
    }
    if (golden.length >= 8) break;
  }
  return golden;
}

// ── Topic config ──────────────────────────────────────────────────────────────

const TOPIC_PRIORITY = {
  recommendation: ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  dosing:         ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
  shipping:       ['customPolicies', 'preferPatterns', 'avoidPatterns', 'productKnowledge', 'toneRules'],
  refund:         ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
  order:          ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
  payment:        ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules'],
  product:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  storage:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  french:         ['toneRules', 'preferPatterns', 'avoidPatterns', 'customPolicies', 'productKnowledge'],
  coa:            ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
  general:        ['productKnowledge', 'preferPatterns', 'avoidPatterns', 'toneRules', 'customPolicies'],
};

// Supplementary caps AFTER golden rules are already injected.
// Very tight — golden rules handle the heavy lifting.
// [productKnowledge, preferPatterns/customPolicies, avoidPatterns/toneRules]
const TOPIC_CAPS = {
  recommendation: [3, 2, 1, 1, 1],
  dosing:         [3, 2, 1, 1, 1],
  shipping:       [1, 2, 2, 1, 1],
  refund:         [1, 2, 2, 1, 1],
  order:          [1, 2, 2, 1, 1],
  payment:        [1, 2, 2, 1, 1],
  product:        [3, 2, 1, 1, 1],
  storage:        [3, 2, 1, 1, 1],
  coa:            [2, 2, 1, 1, 1],
  general:        [2, 2, 1, 1, 1],
};

// Dedup thresholds per category:
// avoidPatterns gets 0.30 — very aggressive — collapses all "order number" variants
// toneRules gets 0.35 — collapses "respond in French" variants
// others get 0.45–0.50
const CATEGORY_THRESHOLDS = {
  avoidPatterns:    0.30,
  toneRules:        0.35,
  customPolicies:   0.40,
  preferPatterns:   0.45,
  productKnowledge: 0.70,  // high — different peptide protocols should NOT merge
};

const CATEGORY_META = {
  productKnowledge: { label: 'PRODUCT FACTS',   prefix: '•' },
  customPolicies:   { label: 'STORE POLICIES',  prefix: '•' },
  preferPatterns:   { label: 'ALWAYS DO',       prefix: '✓' },
  avoidPatterns:    { label: 'NEVER DO',         prefix: '✗' },
  toneRules:        { label: 'TONE',             prefix: '•' },
  responseExamples: { label: 'EXAMPLE REPLY',   prefix: '"' },
};

// ── Main formatter ────────────────────────────────────────────────────────────

function formatBrainContext(brain, topic = 'general', customerMessage = '') {
  if (!brain) return '';

  const priority   = TOPIC_PRIORITY[topic] || TOPIC_PRIORITY.general;
  const caps       = TOPIC_CAPS[topic]     || TOPIC_CAPS.general;
  const globalSeen = [];
  const sections   = [];

  // ── 1. Golden rules ───────────────────────────────────────────────────────
  // Admin-written rules that always apply. Injected first so Claude
  // reads them before anything else. Aggressively deduped so 15 variants
  // of "don't ask for order number" become 1 clear rule.
  const goldenRules = extractGoldenRules(brain, topic, customerMessage, globalSeen);
  if (goldenRules.length) {
    sections.push('GOLDEN RULES (non-negotiable — admin-set):');
    goldenRules.forEach(r => sections.push(`⚡ ${r.text}`));
  }

  // ── 2. Topic-specific supplementary context ───────────────────────────────
  // Only what's directly relevant to this message. Tight caps.
  // Auto-generated rules only — golden rules already handled above.
  const exactTerms = extractExactTerms(customerMessage);
  const label = exactTerms.length > 0
    ? `CONTEXT [${topic.toUpperCase()} — ${exactTerms.join(', ')}]:`
    : `CONTEXT [${topic.toUpperCase()}]:`;
  sections.push(`\n${label}`);

  let hasSupplementary = false;
  priority.forEach((categoryKey, idx) => {
    const rawRules = brain[categoryKey];
    if (!Array.isArray(rawRules) || rawRules.length === 0) return;

    const cap       = caps[idx] ?? 1;
    const threshold = CATEGORY_THRESHOLDS[categoryKey] ?? 0.45;
    const isProduct = categoryKey === 'productKnowledge';

    // Sort product knowledge by relevance to this specific message
    const sorted = isProduct ? sortByRelevance(rawRules, customerMessage) : rawRules;

    // Only auto-generated rules here — admin rules already in golden section
    const autoOnly = sorted.filter(raw => {
      const r = normaliseRule(raw);
      return r && !r.golden;
    });

    const deduped = deduplicate(autoOnly, cap, threshold, globalSeen);
    if (!deduped.length) return;

    const meta = CATEGORY_META[categoryKey];
    if (!meta) return;

    sections.push(`\n${meta.label}:`);
    deduped.forEach(r => sections.push(`${meta.prefix} ${r.text}`));
    hasSupplementary = true;
  });

  if (!hasSupplementary) sections.push('(no additional context for this topic)');

  // ── 3. One example reply (most relevant) ─────────────────────────────────
  if (brain.responseExamples?.length) {
    const sorted = sortByRelevance(brain.responseExamples, customerMessage);
    const deduped = deduplicate(sorted, 1, 0.4, globalSeen);
    if (deduped.length) {
      sections.push(`\nEXAMPLE REPLY:`);
      sections.push(`"${deduped[0].text}"`);
    }
  }

  return sections.join('\n');
}

// ── Cache ─────────────────────────────────────────────────────────────────────
// Keyed by topic + exact product terms so "Retatrutide dosing" and
// "Semaglutide dosing" get different cached contexts.

const _cache = {};

function fingerprint(msg) {
  const topic      = detectTopic(msg);
  const exactTerms = extractExactTerms(msg).sort().join(',');
  return `${topic}::${exactTerms}`;
}

async function getBrainContext(pool, customerMessage = '') {
  const topic = detectTopic(customerMessage);
  const fp    = fingerprint(customerMessage);
  const now   = Date.now();

  const cached = _cache[fp];
  if (cached && (now - cached.time) < BRAIN_TTL) {
    console.log(`🧠 [Brain] cache hit — ${fp}, ${cached.value.length} chars`);
    return cached.value;
  }

  try {
    const result = await pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );

    if (!result.rows.length || !result.rows[0].brain_data) {
      console.log(`🧠 [Brain] no data in db`);
      _cache[fp] = { value: '', time: now };
      return '';
    }

    const brain = result.rows[0].brain_data;

    // Log sizes so empty brain is immediately obvious
    const sizes = Object.entries(brain)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => `${k}:${v.length}`)
      .join(', ');
    console.log(`🧠 [Brain] DB — ${sizes || 'none'}`);

    const context = formatBrainContext(brain, topic, customerMessage);
    const lineCount = context.split('\n').length;
    console.log(`🧠 [Brain] fp=${fp} → ${context.length} chars, ${lineCount} lines`);

    if (context.length < 50) {
      console.log(`🧠 [Brain] WARNING: very short context — check brain data`);
    }

    _cache[fp] = { value: context, time: now };
    return context;

  } catch (err) {
    console.error('[Brain] Failed to load:', err.message);
    _cache[fp] = { value: '', time: now };
    return '';
  }
}

function refreshBrainCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
  console.log('🧠 [Brain] All caches cleared');
}

async function getBrainSettings(pool) {
  try {
    const result = await pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );
    const brain = result.rows[0]?.brain_data;
    return brain?.suggestionSettings || {};
  } catch {
    return {};
  }
}

module.exports = { getBrainContext, refreshBrainCache, getBrainSettings };