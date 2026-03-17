// let _brainCacheTime = 0;
// const BRAIN_TTL = 5 * 60 * 1000;

// // ── Topic detection ───────────────────────────────────────────────────────────
// const TOPIC_PATTERNS = {
//   // NEW: catches recommendation/goal questions BEFORE the generic product check
//   // "what peptides can you recommend", "my goal is to lose weight", "what's best for X"
//   recommendation: /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)/i,

//   dosing: /dose|dosing|dosage|reconstitut|bac water|inject|vial|mix|dilut|mg|mcg|unit|syringe|needle|how (do|to) use|how much|subcutan|administr/i,
//   shipping: /ship|track|deliver|delay|usps|canada post|transit|in transit|stuck|where is|package|parcel|carrier|courier|estimated|arrival|dispatch/i,
//   refund: /refund|return|cancel|money back|charge|chargeback|credit|reimburse|dispute/i,
//   order: /order|status|confirm|invoice|purchased|bought|receipt|processing|fulfil/i,
//   payment: /payment|pay|paid|card|declined|checkout|billing|charge|transaction/i,
//   product: /bpc|tb-500|sema|tirzep|cjc|ipamorelin|hgh|nad|ghk|wolverine|peptide|product|item|vial|kit|blend/i,
//   storage: /storage|store|refrigerat|freezer|fridge|temperature|shelf life|expir|stable/i,
//   french: /bonjour|merci|svp|s'il vous|monsieur|madame|commander|livraison|remboursement/i,
//   coa: /coa|certificate|analysis|purity|test|lab|hplc|third.party/i,
// };

// function detectTopic(customerMessage = '') {
//   if (!customerMessage) return 'general';
//   for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
//     if (pattern.test(customerMessage)) return topic;
//   }
//   return 'general';
// }

// // Map topic → which brain categories matter most for it
// const TOPIC_PRIORITY = {
//   // recommendation: productKnowledge is primary and gets the highest cap
//   // — the model needs to know ALL relevant products to make a real recommendation
//   recommendation: ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],

//   dosing:   ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
//   shipping: ['customPolicies', 'preferPatterns', 'avoidPatterns', 'productKnowledge', 'toneRules'],
//   refund:   ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
//   order:    ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
//   payment:  ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules'],
//   product:  ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
//   storage:  ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
//   french:   ['toneRules', 'preferPatterns', 'avoidPatterns', 'customPolicies', 'productKnowledge'],
//   coa:      ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],

//   // general: productKnowledge moved to position 1 (was last) with cap raised
//   // so a fallthrough question still gets real product data injected
//   general:  ['productKnowledge', 'preferPatterns', 'avoidPatterns', 'toneRules', 'customPolicies'],
// };

// // Caps per category: [primary, secondary, tertiary, rest...]
// const TOPIC_CAPS = {
//   // recommendation gets the highest primary cap — we want ALL product knowledge
//   // injected so the model can make a complete, specific recommendation
//   recommendation: [20, 5, 4, 3, 2],

//   dosing:   [10, 5, 4, 3, 2],
//   shipping: [5, 5, 4, 3, 2],
//   refund:   [5, 5, 4, 3, 2],
//   product:  [10, 5, 4, 3, 2],
//   storage:  [8, 5, 4, 3, 2],
//   coa:      [8, 5, 4, 3, 2],

//   // general: primary (productKnowledge) raised from 2 → 8 so fallthrough
//   // questions still get meaningful product context
//   general:  [8, 4, 3, 3, 2],
// };

// // ── Dedup helpers ─────────────────────────────────────────────────────────────
// function keywords(text) {
//   const stop = new Set([
//     'never','always','dont','do','not','the','a','an','if','when','to','for',
//     'in','is','are','and','or','with','of','that','this','their','your','has',
//     'have','already','from','about','ask','customer','customers','order','number',
//     'message','provided','information','response','use','make','should','would',
//     'when','they','you','them','been','will','just','then','than','only','very',
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

// /**
//  * Deduplicate rules.
//  * isProduct=true → threshold raised to 0.75 so different peptide protocols
//  * (which share vocab like "bac water", "mg", "vial") are never collapsed.
//  */
// function deduplicate(rules, max, threshold = 0.5, globalSeen = [], isProduct = false) {
//   const effectiveThreshold = isProduct ? 0.75 : threshold;
//   const kept = [];
//   for (const rule of rules) {
//     if (!rule?.text) continue;
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

// // ── Category labels ───────────────────────────────────────────────────────────
// const CATEGORY_META = {
//   productKnowledge: { label: 'PRODUCT FACTS',   prefix: '•' },
//   customPolicies:   { label: 'STORE POLICIES',   prefix: '•' },
//   preferPatterns:   { label: 'ALWAYS DO',        prefix: '✓' },
//   avoidPatterns:    { label: 'NEVER DO',         prefix: '✗' },
//   toneRules:        { label: 'TONE',             prefix: '•' },
//   responseExamples: { label: 'EXAMPLE REPLIES',  prefix: '"' },
// };

// // ── Format brain into compact, topic-prioritized prompt block ─────────────────
// function formatBrainContext(brain, topic = 'general') {
//   if (!brain) return '';

//   const priority = TOPIC_PRIORITY[topic] || TOPIC_PRIORITY.general;
//   const caps     = TOPIC_CAPS[topic]     || TOPIC_CAPS.general;
//   const globalSeen = [];
//   const sections   = [];

//   sections.push(`[Brain context — topic: ${topic.toUpperCase()}]`);

//   priority.forEach((categoryKey, idx) => {
//     const rules = brain[categoryKey];
//     if (!rules?.length) return;

//     const cap       = caps[idx] ?? 2;
//     const threshold = idx === 0 ? 0.45 : 0.5;
//     const isProduct = categoryKey === 'productKnowledge';
//     const deduped   = deduplicate(rules, cap, threshold, globalSeen, isProduct);
//     if (!deduped.length) return;

//     const meta = CATEGORY_META[categoryKey];
//     if (!meta) return;

//     sections.push(`\n${meta.label}:`);
//     deduped.forEach(r => {
//       const text       = typeof r === 'string' ? r : r.text;
//       const confidence = r.confidence === 'high' ? '⚡' : meta.prefix;
//       sections.push(`${confidence} ${text}`);
//     });
//   });

//   // Always append examples last if they exist and weren't in priority list
//   if (brain.responseExamples?.length && !priority.includes('responseExamples')) {
//     const deduped = deduplicate(brain.responseExamples, 2, 0.4, globalSeen);
//     if (deduped.length) {
//       sections.push(`\nEXAMPLE REPLIES:`);
//       deduped.forEach(r => {
//         const text = typeof r === 'string' ? r : r.text;
//         sections.push(`"${text}"`);
//       });
//     }
//   }

//   return sections.join('\n');
// }

// // ── Cache keyed by topic ──────────────────────────────────────────────────────
// const _topicCaches = {};

// async function getBrainContext(pool, customerMessage = '') {
//   const topic = detectTopic(customerMessage);
//   const now   = Date.now();

//   const cached = _topicCaches[topic];
//   if (cached && (now - cached.time) < BRAIN_TTL) {
//     console.log(`🧠 [Brain] cache hit — topic=${topic}, ${cached.value.length} chars`);
//     return cached.value;
//   }

//   try {
//     const result = await pool.query(
//       `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
//     );

//     if (!result.rows.length || !result.rows[0].brain_data) {
//       console.log(`🧠 [Brain] no data in db`);
//       _topicCaches[topic] = { value: '', time: now };
//       return '';
//     }

//     const brain   = result.rows[0].brain_data;
//     const context = formatBrainContext(brain, topic);

//     console.log(`🧠 [Brain] topic=${topic}, ${context.length} chars injected`);
//     if (context.length < 50) {
//       console.log(`🧠 [Brain] WARNING: very short context — brain may be missing data for this topic`);
//     }

//     _topicCaches[topic] = { value: context, time: now };
//     return context;

//   } catch (err) {
//     console.error('[Brain] Failed to load:', err.message);
//     _topicCaches[topic] = { value: '', time: now };
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




let _brainCacheTime = 0;
const BRAIN_TTL = 5 * 60 * 1000;

// ── Topic detection ───────────────────────────────────────────────────────────
const TOPIC_PATTERNS = {
  recommendation: /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)/i,
  dosing:   /dose|dosing|dosage|reconstitut|bac water|inject|vial|mix|dilut|mg|mcg|unit|syringe|needle|how (do|to) use|how much|subcutan|administr/i,
  shipping: /ship|track|deliver|delay|usps|canada post|transit|in transit|stuck|where is|package|parcel|carrier|courier|estimated|arrival|dispatch/i,
  refund:   /refund|return|cancel|money back|charge|chargeback|credit|reimburse|dispute/i,
  order:    /order|status|confirm|invoice|purchased|bought|receipt|processing|fulfil/i,
  payment:  /payment|pay|paid|card|declined|checkout|billing|charge|transaction/i,
  product:  /bpc|tb-500|sema|tirzep|cjc|ipamorelin|hgh|nad|ghk|wolverine|peptide|product|item|vial|kit|blend/i,
  storage:  /storage|store|refrigerat|freezer|fridge|temperature|shelf life|expir|stable/i,
  french:   /bonjour|merci|svp|s'il vous|monsieur|madame|commander|livraison|remboursement/i,
  coa:      /coa|certificate|analysis|purity|test|lab|hplc|third.party/i,
};

function detectTopic(customerMessage = '') {
  if (!customerMessage) return 'general';
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(customerMessage)) return topic;
  }
  return 'general';
}

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

const TOPIC_CAPS = {
  recommendation: [20, 5, 4, 3, 2],
  dosing:         [10, 5, 4, 3, 2],
  shipping:       [5,  5, 4, 3, 2],
  refund:         [5,  5, 4, 3, 2],
  product:        [10, 5, 4, 3, 2],
  storage:        [8,  5, 4, 3, 2],
  coa:            [8,  5, 4, 3, 2],
  general:        [8,  4, 3, 3, 2],
};

// ── Rule normaliser ───────────────────────────────────────────────────────────
// Rules can be stored as plain strings OR as {text, confidence} objects.
// Normalise everything to {text, confidence} so the rest of the code
// doesn't need to branch.
function normaliseRule(rule) {
  if (!rule) return null;
  if (typeof rule === 'string') {
    return rule.trim() ? { text: rule.trim(), confidence: 'normal' } : null;
  }
  if (typeof rule === 'object' && rule.text) {
    return { text: String(rule.text).trim(), confidence: rule.confidence || 'normal' };
  }
  return null;
}

// ── Dedup helpers ─────────────────────────────────────────────────────────────
function keywords(text) {
  const stop = new Set([
    'never','always','dont','do','not','the','a','an','if','when','to','for',
    'in','is','are','and','or','with','of','that','this','their','your','has',
    'have','already','from','about','ask','customer','customers','order','number',
    'message','provided','information','response','use','make','should','would',
    'they','you','them','been','will','just','then','than','only','very',
  ]);
  return text.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stop.has(w));
}

function similarity(a, b) {
  const ka = new Set(keywords(a));
  const kb = new Set(keywords(b));
  if (!ka.size || !kb.size) return 0;
  let overlap = 0;
  for (const w of ka) if (kb.has(w)) overlap++;
  return overlap / Math.max(ka.size, kb.size);
}

// isProduct=true → higher threshold so different peptide protocols
// (sharing "bac water", "mg", "vial") are never collapsed together.
function deduplicate(rules, max, threshold = 0.5, globalSeen = [], isProduct = false) {
  const effectiveThreshold = isProduct ? 0.75 : threshold;
  const kept = [];

  for (const raw of rules) {
    // ← FIX: normalise first so both strings and objects are handled
    const rule = normaliseRule(raw);
    if (!rule) continue;

    const isDupe =
      kept.some(k => similarity(k.text, rule.text) >= effectiveThreshold) ||
      globalSeen.some(k => similarity(k.text, rule.text) >= effectiveThreshold);

    if (!isDupe) {
      kept.push(rule);
      globalSeen.push(rule);
    }
    if (kept.length >= max) break;
  }
  return kept;
}

// ── Category labels ───────────────────────────────────────────────────────────
const CATEGORY_META = {
  productKnowledge: { label: 'PRODUCT FACTS',  prefix: '•' },
  customPolicies:   { label: 'STORE POLICIES', prefix: '•' },
  preferPatterns:   { label: 'ALWAYS DO',      prefix: '✓' },
  avoidPatterns:    { label: 'NEVER DO',        prefix: '✗' },
  toneRules:        { label: 'TONE',            prefix: '•' },
  responseExamples: { label: 'EXAMPLE REPLIES', prefix: '"' },
};

// ── Format brain into prompt block ────────────────────────────────────────────
function formatBrainContext(brain, topic = 'general') {
  if (!brain) return '';

  const priority   = TOPIC_PRIORITY[topic] || TOPIC_PRIORITY.general;
  const caps       = TOPIC_CAPS[topic]     || TOPIC_CAPS.general;
  const globalSeen = [];
  const sections   = [];

  sections.push(`[Brain context — topic: ${topic.toUpperCase()}]`);

  priority.forEach((categoryKey, idx) => {
    const rawRules = brain[categoryKey];
    if (!Array.isArray(rawRules) || rawRules.length === 0) return;

    const cap       = caps[idx] ?? 2;
    const threshold = idx === 0 ? 0.45 : 0.5;
    const isProduct = categoryKey === 'productKnowledge';
    const deduped   = deduplicate(rawRules, cap, threshold, globalSeen, isProduct);
    if (!deduped.length) return;

    const meta = CATEGORY_META[categoryKey];
    if (!meta) return;

    sections.push(`\n${meta.label}:`);
    deduped.forEach(r => {
      const prefix = r.confidence === 'high' ? '⚡' : meta.prefix;
      sections.push(`${prefix} ${r.text}`);
    });
  });

  // Append examples if not already in priority list
  if (brain.responseExamples?.length && !priority.includes('responseExamples')) {
    const deduped = deduplicate(brain.responseExamples, 2, 0.4, globalSeen);
    if (deduped.length) {
      sections.push(`\nEXAMPLE REPLIES:`);
      deduped.forEach(r => sections.push(`"${r.text}"`));
    }
  }

  return sections.join('\n');
}

// ── Cache keyed by topic ──────────────────────────────────────────────────────
const _topicCaches = {};

async function getBrainContext(pool, customerMessage = '') {
  const topic = detectTopic(customerMessage);
  const now   = Date.now();

  const cached = _topicCaches[topic];
  if (cached && (now - cached.time) < BRAIN_TTL) {
    console.log(`🧠 [Brain] cache hit — topic=${topic}, ${cached.value.length} chars`);
    return cached.value;
  }

  try {
    const result = await pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );

    if (!result.rows.length || !result.rows[0].brain_data) {
      console.log(`🧠 [Brain] no data in db`);
      _topicCaches[topic] = { value: '', time: now };
      return '';
    }

    const brain   = result.rows[0].brain_data;

    // Log category sizes to make empty brain immediately obvious
    const sizes = Object.entries(brain)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => `${k}:${v.length}`)
      .join(', ');
    console.log(`🧠 [Brain] DB categories — ${sizes || 'none'}`);

    const context = formatBrainContext(brain, topic);
    console.log(`🧠 [Brain] topic=${topic}, ${context.length} chars injected`);

    if (context.length < 50) {
      console.log(`🧠 [Brain] WARNING: very short context — check that brain data is saved with content`);
    }

    _topicCaches[topic] = { value: context, time: now };
    return context;

  } catch (err) {
    console.error('[Brain] Failed to load:', err.message);
    _topicCaches[topic] = { value: '', time: now };
    return '';
  }
}

function refreshBrainCache() {
  Object.keys(_topicCaches).forEach(k => delete _topicCaches[k]);
  _brainCacheTime = 0;
  console.log('🧠 [Brain] All topic caches cleared');
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