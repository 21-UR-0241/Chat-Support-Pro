// ============================================================================
// COMMITMENT GUARDS
//
// The dosing guards stop the model inventing a NUMBER. Nothing stopped it inventing
// a PROMISE.
//
// Real output, conversation 3494:
//   "I'll add a free Snap-8 vial to your next order as a make-good."
//   "I can refund your shipping cost."
//
// "Snap-8" appears nowhere in the brain. The model invented a product and gave it
// away. And even for a REAL product, the brain forbids this four separate times:
//
//   - "Never promise a specific free product as compensation unless stock is confirmed"
//   - "Never send a compensation offer that does not match what the customer uses"
//   - "offer a reship plus one free MYSTERY vial... the customer CANNOT CHOOSE which
//      vial - it is selected based on current stock"
//   - "Agents are not authorized to offer a free product without admin approval"
//
// Same failure as the dosing bug: an unauthorised, specific, actionable commitment,
// stated with total confidence. Different domain, identical shape. A wrong dose hurts
// the customer; a false promise to an already-angry customer costs you the customer.
// Both are the model asserting authority it does not have.
// ============================================================================

const { matchProducts } = require('./product-match');

// ── 1. INVENTED PRODUCTS ────────────────────────────────────────────────────
//
// Tokens shaped like a peptide name (Snap-8, BPC-157, GHK-Cu, SLU-PP-332, MOTS-c)
// that the catalog has never heard of. If the model names a product we do not sell,
// nothing downstream can catch it — matchProducts() simply returns nothing, and the
// reply sails through looking authoritative.

const PRODUCT_SHAPED_RE = /\b([A-Z][A-Za-z]{1,14}(?:[-‑][A-Za-z0-9]{1,6}){1,3}|[A-Z]{2,6}[-‑]?\d{1,4})\b/g;

// Things that LOOK product-shaped but aren't. Keep this tight; a false positive here
// only costs a log line, a false negative ships an invented product.
const NOT_A_PRODUCT_RE = /^(?:UPS|USPS|FedEx|DHL|COA|HPLC|BAC|SQ|IM|IU|ID|OK|PDF|URL|FAQ|CEO|VIP|E-?transfer|Interac|Stripe|Helcim|Shopify|Google|Amazon|Monday|Tuesday|Wednesday|Thursday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|U-?100|BD|Ultra-?Fine|EasyTouch|CareTouch)$/i;

/**
 * @param {string[]} suggestions
 * @param {string}   catalogText  any text listing real products (brain context works)
 * @returns {{ index:number, invented:string[] }[]}
 */
function detectInventedProducts(suggestions, catalogText = '') {
  const out = [];
  if (!Array.isArray(suggestions)) return out;

  suggestions.forEach((s, index) => {
    if (typeof s !== 'string') return;
    const known = new Set((matchProducts(s) || []).map(p => String(p).toLowerCase()));
    const invented = [];

    for (const m of s.matchAll(PRODUCT_SHAPED_RE)) {
      const token = m[1];
      if (NOT_A_PRODUCT_RE.test(token)) continue;
      const lower = token.toLowerCase();
      // Known to the matcher, or contained in one of its hits (e.g. "157" inside BPC-157).
      if ([...known].some(k => k.includes(lower) || lower.includes(k))) continue;
      // Present verbatim in the catalog/brain we were given? Then it's real, just unmatched.
      if (catalogText && new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-‑]/g, '[-‑]')}\\b`, 'i').test(catalogText)) continue;
      invented.push(token);
    }

    if (invented.length) {
      out.push({ index, invented });
      console.error(`🚨 [Commitment] #${index + 1} names product(s) not in the catalog: ${invented.join(', ')} — INVENTED. BLOCKING.`);
    }
  });
  return out;
}

// ── 2. UNAUTHORISED FREE-PRODUCT OFFERS ─────────────────────────────────────

const FREE_OFFER_RE   = /\b(?:free|complimentary|bonus|on (?:us|the house)|no charge|gratis|make[-\s]?good|goodwill (?:gesture|item|vial))\b/i;
const MYSTERY_VIAL_RE = /\bmystery\s+vial\b/i;
const OFFERS_ITEM_RE  = /\b(?:vial|bottle|item|product|peptide|kit|sample)\b/i;

/**
 * The brain permits exactly ONE compensation product: a free MYSTERY vial, chosen by
 * stock, not by the customer or the agent. Anything else — a named product, a chosen
 * product, an extra of what they ordered — needs admin approval and confirmed stock.
 *
 * @returns {{ index:number, reason:string }[]}
 */
function detectUnauthorisedFreeOffer(suggestions) {
  const out = [];
  if (!Array.isArray(suggestions)) return out;

  suggestions.forEach((s, index) => {
    if (typeof s !== 'string') return;
    if (!FREE_OFFER_RE.test(s)) return;
    if (!OFFERS_ITEM_RE.test(s)) return;
    if (MYSTERY_VIAL_RE.test(s)) return;   // the one authorised form

    const named = (matchProducts(s) || []).filter(Boolean);
    const reason = named.length
      ? `offers a specific free product (${named.join(', ')}) — brain allows only an unnamed "free mystery vial", chosen by stock`
      : `offers a free item that is not the authorised "free mystery vial"`;

    out.push({ index, reason });
    console.error(`🚨 [Commitment] #${index + 1} ${reason}. BLOCKING.`);
  });
  return out;
}

// ── 3. REMEDIES THE BRAIN NEVER AUTHORISED ──────────────────────────────────
//
// Flag, don't block — these are judgement calls an agent can make, but they should
// not be pre-written by a model that has no basis for them.

const UNBACKED_REMEDY_RE = [
  [/\brefund (?:your |the )?shipping(?: cost| fee| charge)?\b/i, 'shipping-cost refund (not in brain)'],
  [/\b(?:upgrade|expedite|rush|overnight) (?:your |the )?(?:shipping|delivery|order)\b/i, 'shipping upgrade (brain: confirm carrier capacity first)'],
  [/\b(?:discount|% off|percent off)\b/i, 'discount offer (brain: >20% needs admin approval)'],
  [/\bstore credit\b/i, 'store credit (verify it is authorised for this order state)'],
  [/\bcancel (?:your |the )?order\b/i, 'cancellation (brain: orders CANNOT be cancelled once placed)'],
];

function detectUnbackedRemedy(suggestions) {
  const out = [];
  if (!Array.isArray(suggestions)) return out;
  suggestions.forEach((s, index) => {
    if (typeof s !== 'string') return;
    const reasons = UNBACKED_REMEDY_RE.filter(([re]) => re.test(s)).map(([, why]) => why);
    if (reasons.length) {
      out.push({ index, reasons });
      console.warn(`⚠️  [Commitment] #${index + 1} offers a remedy that may not be authorised: ${reasons.join('; ')} — REVIEW`);
    }
  });
  return out;
}

// ── ENTRY POINT ─────────────────────────────────────────────────────────────

/**
 * Blocks invented products and unauthorised free-product offers.
 * Flags (does not block) remedies the brain never backed.
 *
 * @returns {{ clean: string[], blocked: {index:number, why:string}[], review: {index:number, reasons:string[]}[] }}
 */
function validateCommitments(suggestions, catalogText = '') {
  if (!Array.isArray(suggestions) || !suggestions.length) {
    return { clean: suggestions || [], blocked: [], review: [] };
  }

  const blocked = [];
  for (const { index, invented } of detectInventedProducts(suggestions, catalogText)) {
    blocked.push({ index, why: `invented product: ${invented.join(', ')}` });
  }
  for (const { index, reason } of detectUnauthorisedFreeOffer(suggestions)) {
    if (!blocked.some(b => b.index === index)) blocked.push({ index, why: reason });
  }

  const review = detectUnbackedRemedy(suggestions);
  const clean = suggestions.filter((_, i) => !blocked.some(b => b.index === i));

  return { clean, blocked, review };
}

module.exports = {
  detectInventedProducts,
  detectUnauthorisedFreeOffer,
  detectUnbackedRemedy,
  validateCommitments,
};