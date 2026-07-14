// ============================================================================
// PRODUCT-SCOPED BRAIN GUARDS
//
// Two jobs:
//   1. COVERAGE  — does an AUTHORISED dosing answer exist for THIS product?
//   2. CONTAMINATION — did the model state a number that belongs to a different
//                      product, or that nobody ever authorised?
//
// Both consult lib/product-facts.js FIRST. Code is authoritative; the brain blob
// is a fallback. That ordering is the fix: the brain blob holds 20+ products in
// 8,000 chars, so "does this text contain a reconstitution volume" is always YES,
// and that YES is how HGH Fragment's 1mL got re-badged as Retatrutide's.
// ============================================================================

const { matchProducts } = require('./product-match');
const {
  hasCanonicalDosing,
  allowedNumbersFor,
  getProductFacts,
  confirmedDilutions,
} = require('./product-facts');

// ── Segmentation ────────────────────────────────────────────────────────────

function _productRe(productName) {
  const escaped = String(productName).trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[-\s]+/g, '[-\\s]?');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

// Accessories are not products. matchProducts() counts "BAC water" as one, and that
// alone pushed a normal 3-product rule over the "this is a list" threshold — so the
// HGH Fragment entry got split on semicolons and lost its own reconstitution volume.
const NON_PRODUCT_RE = /^(bac(?:teriostatic)? water|bacteriostatic|sterile water|saline|sodium chloride|water|syringes?|insulin syringes?|needles?|alcohol (?:swabs?|wipes?|pads?)|swabs?|wipes?|vials?)$/i;

/**
 * Products named in a chunk, overlapping matches collapsed ("HGH Fragment 176-191"
 * does not also count as a bare "HGH"), accessories dropped, ordered by FIRST
 * APPEARANCE IN THE TEXT.
 *
 * The ordering is load-bearing. matchProducts() returns hits in ITS OWN array order,
 * not the text's. Taking hits[0] as the "primary" product made Retatrutide the owner
 * of HGH Fragment's rule — because Retatrutide sits earlier in the matcher's list —
 * which handed Retatrutide the 1mL that started this entire bug hunt.
 */
function _namedProducts(text) {
  const s = String(text || '');
  let hits = [...new Set((matchProducts(s) || []).filter(Boolean).map(String))]
    .filter(p => !NON_PRODUCT_RE.test(p.trim()));
  hits = hits.filter(p => !hits.some(q => q !== p && q.toLowerCase().includes(p.toLowerCase())));
  return hits
    .map(p => ({ p, i: s.search(_productRe(p)) }))
    .filter(x => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map(x => x.p);
}

/**
 * Brain segments whose NUMBERS belong to this product.
 *
 * The first version of this kept only sentences that literally contained the product
 * name. That threw away almost every real rule, because rules are written like prose:
 * "Epithalon is a tetrapeptide... Supplied as 50mg vial: add 2mL BAC water -> 25mg/mL."
 * The sentence carrying the volume never repeats the name. Coverage came back false for
 * 43 of 44 products whose data was sitting right there.
 *
 * Rules are authored one-per-product, so ownership works at ENTRY level:
 *
 *   1. A true multi-product LIST (>3 products — e.g. the 23-product reconstitution
 *      blob) is split on its delimiters, and only items naming THIS product and no
 *      other are taken. "Adipotide 5mg+1mL->5mg/mL" is one such item.
 *   2. Otherwise the entry belongs to its PRIMARY product — the first one named. If
 *      that's our product, the whole entry's numbers are ours.
 *   3. If our product is only mentioned in passing (not primary), the entry donates
 *      NOTHING. This is the HGH Fragment rule that ends "...secondary option after
 *      Semaglutide/Retatrutide" — its 1mL belongs to HGH Fragment, and Retatrutide
 *      must never inherit it. That inheritance was the original bug.
 */
function ownedSegments(brainContext, productName) {
  if (!brainContext || !productName) return [];
  const productRe = _productRe(productName);
  const target = String(productName).toLowerCase();

  const entries = String(brainContext).split(/\n+/).map(s => s.trim()).filter(Boolean);
  const owned = [];

  for (const raw of entries) {
    if (!productRe.test(raw)) continue;
    const entry = stripSyringeSpecs(raw);
    const named = _namedProducts(entry);

    // 1. Multi-product list → take only the items that are exclusively ours.
    if (named.length > 3) {
      for (const item of entry.split(/[;\n]+/)) {
        if (!productRe.test(item)) continue;
        const inItem = _namedProducts(item);
        if (inItem.length <= 1) owned.push(item.trim());
      }
      continue;
    }

    // 2/3. Single-topic entry → only the PRIMARY product owns its numbers.
    const primary = named[0];
    if (primary && primary.toLowerCase() === target) owned.push(entry);
  }

  return owned;
}

/** Kept for callers that want the raw name-matching behaviour. */
function brainSegmentsForProduct(brainContext, productName) {
  if (!brainContext || !productName) return [];
  const productRe = _productRe(productName);
  return String(brainContext)
    .split(/(?<=[.;])\s+(?=[A-Z0-9])|\n+/)
    .map(s => s.trim())
    .filter(s => s && productRe.test(s));
}

// A syringe BARREL size is not a water volume. "1mL 29G insulin syringe" reading as
// a reconstitution volume is precisely how the Retatrutide fabrication was assembled.
const SYRINGE_SPEC_RE  = /\d+(?:\.\d+)?\s*mL\s*(?:\/\s*\d+\s*[-\s]?unit)?\s*(?:insulin\s+)?(?:syringe|barrel)?\s*,?\s*\d{2}\s*G\b/i;
const SYRINGE_REF_RE   = /\b1\s*mL\s*\/\s*100\s*[-\s]?unit\b/i;

const RECON_VOLUME_RE  = /(?:add|reconstitute[^.;]{0,40}?with|inject)\s+[\d.]+\s*mL|\+\s*[\d.]+\s*mL\s*(?:BAC|bacteriostatic|→)|[\d.]+\s*mL\s+(?:of\s+)?(?:BAC|bacteriostatic)/i;
const CONCENTRATION_RE = /[\d.]+\s*(?:mg|mcg|iu)\s*\/\s*mL/i;
const UNIT_MATH_RE     = /\d+\s*units?\s*[=(]|\(\d+\s*u\)|=\s*\d+\s*units?\b/i;

const stripSyringeSpecs = (s) => String(s || '').replace(SYRINGE_SPEC_RE, ' ').replace(SYRINGE_REF_RE, ' ');

// ── Coverage ────────────────────────────────────────────────────────────────

/**
 * Is there an AUTHORISED dosing answer for this product?
 * Canonical code facts win. Brain scan is the fallback.
 */
function brainDosingCoverage(brainContext, productName) {
  const base = { product: productName || null, source: null, hasVolume: false, hasConcentration: false, hasUnitMath: false, complete: false };
  if (!productName) return base;

  // 1. Canonical (lib/product-facts.js). Only 'confirmed' dilutions count.
  if (hasCanonicalDosing(productName)) {
    const facts = getProductFacts(productName);
    const pending = (facts.dilutions || []).filter(d => d.status === 'pending').map(d => d.vial);
    return {
      ...base,
      source: 'canonical',
      hasVolume: true,
      hasConcentration: true,
      hasUnitMath: Object.keys(facts.unitMath || {}).length > 0,
      complete: true,
      confirmedVials: confirmedDilutions(productName).map(d => d.vial),
      pendingVials: pending,
      escalationAvailable: facts.escalation?.status !== 'conflict',
    };
  }

  // 2. Brain fallback.
  const owned = ownedSegments(brainContext, productName);
  if (!owned.length) return { ...base, source: 'none', ownedSegments: 0 };

  const blob = owned.join(' ');
  const hasVolume        = RECON_VOLUME_RE.test(blob);
  const hasConcentration = CONCENTRATION_RE.test(blob);
  const hasUnitMath      = UNIT_MATH_RE.test(blob);

  return {
    ...base,
    source: 'brain',
    ownedSegments: owned.length,
    hasVolume,
    hasConcentration,
    hasUnitMath,
    complete: hasVolume && hasConcentration,
  };
}

/** Drop-in check. REQUIRES a product anchor — no anchor, no numbers, no exceptions. */
function brainHasDosingAnswer(brainContext, productName) {
  const cov = brainDosingCoverage(brainContext, productName);
  if (cov.complete) {
    console.log(`🧠 [Coverage] ${productName} — OK via ${cov.source}${cov.pendingVials?.length ? ` (pending vials: ${cov.pendingVials.join(', ')})` : ''}`);
  } else {
    console.log(`🧠 [Coverage] ${productName || 'NO ANCHOR'} — vol:${cov.hasVolume} conc:${cov.hasConcentration} units:${cov.hasUnitMath} → numbers FORBIDDEN this turn`);
  }
  return cov.complete;
}

// ── Contamination ───────────────────────────────────────────────────────────

const STATED_VOLUME_RE = /\b([\d.]+)\s*mL\b/gi;
const STATED_CONC_RE   = /\b([\d.]+)\s*(?:mg|mcg|iu)\s*\/\s*mL\b/gi;

/**
 * Blocks any suggestion that states a mL volume or concentration which is neither
 * (a) in the canonical allow-list for this product, nor (b) present in a brain
 * segment that names this product and nothing else.
 *
 * This is the check that catches the original bug: "add 1mL, that's 10mg/mL" for
 * Retatrutide, where the 1mL was lifted from HGH Fragment's rule.
 *
 * @returns {{ clean: string[], contaminated: {index:number, values:string[]}[] }}
 */
function detectNumberContamination(suggestions, brainContext, productName) {
  const contaminated = [];
  if (!Array.isArray(suggestions) || !suggestions.length) return { clean: suggestions || [], contaminated };

  const allowed = allowedNumbersFor(productName);           // canonical allow-list
  const owned   = ownedSegments(brainContext, productName)  // brain fallback
    .join(' ')
    .replace(/\s+/g, '')
    .toLowerCase();

  const isAllowed = (raw) => {
    const norm = raw.replace(/\s+/g, '').toLowerCase();
    if (allowed.has(norm)) return true;
    return owned.includes(norm);
  };

  suggestions.forEach((s, index) => {
    if (typeof s !== 'string') return;
    const reply = stripSyringeSpecs(s);   // "use a 1mL insulin syringe" is fine
    const values = [];

    for (const m of reply.matchAll(STATED_VOLUME_RE)) {
      if (!isAllowed(m[0])) values.push(m[0].trim());
    }
    for (const m of reply.matchAll(STATED_CONC_RE)) {
      if (!isAllowed(m[0])) values.push(m[0].trim());
    }

    if (values.length) {
      contaminated.push({ index, values });
      console.error(`🚨 [Contamination] #${index + 1} states ${values.join(', ')} — not authorised for ${productName || 'this product'}. Borrowed or invented. BLOCKING.`);
    }
  });

  const clean = suggestions.filter((_, i) => !contaminated.some(c => c.index === i));
  return { clean, contaminated };
}

module.exports = {
  brainSegmentsForProduct,
  ownedSegments,
  brainDosingCoverage,
  brainHasDosingAnswer,
  detectNumberContamination,
};