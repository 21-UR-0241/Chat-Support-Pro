// ============================================================================
// CANONICAL PRODUCT FACTS
//
// Dosing numbers live HERE, in code, not in ai_training_brain. Reasons, all of
// which we hit for real:
//
//   1. The suggestion engine fused HGH Fragment's "add 1mL BAC water to 5mg vial"
//      onto Retatrutide and produced an authoritative-sounding, entirely invented
//      reconstitution protocol. The arithmetic was self-consistent, which is what
//      made it dangerous.
//   2. The duplicate scanner (DUPE_THRESHOLD 0.45, Jaccard) pre-selects same-source
//      near-neighbours for deletion. A 5mg/mL unit table and a 10mg/mL unit table
//      look ~60% identical to it. Deleting one is a silent 2x dose error.
//   3. AITraining.jsx autosaves the ENTIRE brain object from a React snapshot every
//      4 seconds. Anyone with that page open can overwrite a DB migration.
//
// Code is the only layer none of those can reach.
//
// ── THE RULE FOR THIS FILE ──────────────────────────────────────────────────
// status: 'confirmed' means a human with authority stated this number.
// status: 'pending'   means it was DERIVED — plausible, arithmetically sound, and
//                     NOT SAFE TO SEND. Pending facts are never rendered, never
//                     injected, and never permitted by the contamination guard.
//
// Deriving a number and shipping it is exactly the failure this file exists to
// prevent. Do not promote anything to 'confirmed' without a named human and a date.
// ============================================================================

// ── RETATRUTIDE ─────────────────────────────────────────────────────────────
const RETATRUTIDE = {
  // The CANONICAL display name. matchProducts() may return the alias "reta", and
  // \breta\b does NOT match "Retatrutide" (the \b fails against the 't'), which
  // silently empties every product-scoped regex downstream. Anchors are
  // canonicalised through this field before anything else touches them.
  name: 'Retatrutide',
  aliases: ['retatrutide', 'reta'],
  vialSizes: ['5mg', '10mg', '15mg', '20mg', '30mg'],

  dilutions: [
    {
      vial: '10mg', water: '1mL', concentration: '10mg/mL',
      status: 'confirmed', by: 'admin (Vanta), 2026-07-14',
    },
    {
      vial: '10mg', water: '2mL', concentration: '5mg/mL',
      status: 'confirmed', by: 'admin (Vanta), 2026-07-14',
      note: 'Finer granularity at low doses. Units are NOT interchangeable with the 10mg/mL table.',
    },
    {
      vial: '20mg', water: '2mL', concentration: '10mg/mL',
      status: 'confirmed', by: 'brain responseExamples, source admin-feedback',
    },

    // DERIVED from the 10mg/mL house standard. Arithmetically correct, NOT authorised.
    // A 15mg or 30mg customer gets an honest "let me confirm" until someone signs these off.
    { vial: '5mg',  water: '0.5mL', concentration: '10mg/mL', status: 'pending' },
    { vial: '15mg', water: '1.5mL', concentration: '10mg/mL', status: 'pending' },
    { vial: '30mg', water: '3mL',   concentration: '10mg/mL', status: 'pending' },
  ],

  // Unit math is pure arithmetic ON A CONFIRMED CONCENTRATION, so it inherits that
  // confirmation. 100 units = 1mL on a standard insulin syringe.
  unitMath: {
    '10mg/mL': [
      { units: 1,   mL: '0.01mL',  dose: '0.1mg'  },
      { units: 2.5, mL: '0.025mL', dose: '0.25mg', label: 'conservative start' },
      { units: 5,   mL: '0.05mL',  dose: '0.5mg',  label: 'standard starting dose' },
      { units: 10,  mL: '0.1mL',   dose: '1.0mg'  },
      { units: 15,  mL: '0.15mL',  dose: '1.5mg'  },
      { units: 20,  mL: '0.2mL',   dose: '2.0mg'  },
      { units: 30,  mL: '0.3mL',   dose: '3.0mg'  },
      { units: 40,  mL: '0.4mL',   dose: '4.0mg'  },
      { units: 50,  mL: '0.5mL',   dose: '5.0mg'  },
    ],
    '5mg/mL': [
      { units: 1,   mL: '0.01mL',  dose: '0.05mg' },
      { units: 5,   mL: '0.05mL',  dose: '0.25mg' },
      { units: 10,  mL: '0.1mL',   dose: '0.5mg',  label: 'standard starting dose' },
      { units: 20,  mL: '0.2mL',   dose: '1.0mg'  },
      { units: 30,  mL: '0.3mL',   dose: '1.5mg'  },
      { units: 40,  mL: '0.4mL',   dose: '2.0mg'  },
      { units: 60,  mL: '0.6mL',   dose: '3.0mg'  },
      { units: 80,  mL: '0.8mL',   dose: '4.0mg'  },
      { units: 100, mL: '1.0mL',   dose: '5.0mg',  label: 'a full syringe barrel' },
    ],
  },

  handling: [
    'Inject the BAC water slowly along the vial wall, never straight at the powder.',
    'Do not shake. Roll gently. If it goes cloudy, refrigerate and let it settle.',
    'Room temperature before reconstitution. Refrigerate 2-8C after, never freeze, use within 30 days.',
  ],

  // UNRESOLVED. The brain carries two mutually exclusive ladders:
  //   A: 0.5 -> 1.0 -> 1.5 -> 2.0 -> 3.0 -> 4.0 -> 5.0 mg
  //   B: 1 -> 2 -> 4 -> 8 -> 12 mg  ("ALT: no 3mg step")
  // Until an admin picks one, the weekly schedule is NOT available. Reconstitution
  // and mg<->unit conversion are unaffected and can still be answered.
  escalation: {
    status: 'conflict',
    note: 'Two contradictory escalation ladders exist in the brain. Do not state a weekly schedule.',
  },
};

// ── PENDING: derived, NOT authorised, NOT injected ──────────────────────────
// Every volume below was back-derived from unit math already sitting in the brain
// ("0.5mg (10 units)" implies 5mg/mL implies 1mL in a 5mg vial). The arithmetic is
// sound. Nobody has confirmed it. Until they do, these products stall honestly.
const PENDING_REVIEW = {
  semax:       { vial: '10mg', water: '1mL', concentration: '10mg/mL', derivedFrom: '250mcg = 2.5 units' },
  'tb-500':    { vial: '5mg',  water: '1mL', concentration: '5mg/mL',  derivedFrom: '2mg = 40 units' },
  tesamorelin: { vial: '5mg',  water: '1mL', concentration: '5mg/mL',  derivedFrom: '0.5mg = 10 units' },
  gonadorelin: { vial: '2mg',  water: '1mL', concentration: '2mg/mL',  derivedFrom: '100mcg = 5 units' },
  'mots-c':    { vial: '10mg', water: '2mL', concentration: '5mg/mL',  derivedFrom: '2.5mg = 12-13 units' },
  dsip:        { vial: '5mg',  water: '1mL', concentration: '5mg/mL',  derivedFrom: 'catalog default' },
};

// Products with NO dosing data anywhere, derived or otherwise. Listed so the gap is
// visible in code review rather than discovered by a customer.
const NO_DATA = [
  'semaglutide', 'tirzepatide', 'cjc-1295', 'sermorelin', 'hgh',
  'selank', 'nad+', 'aod-9604', 'peg-mgf', 'lipo-c',
];

const PRODUCT_FACTS = {
  retatrutide: RETATRUTIDE,
};

// ── LOOKUP ──────────────────────────────────────────────────────────────────

// matchProducts() can hand back 'BPC 157', 'bpc-157', 'BPC-157', or a bare alias
// like 'reta'. Normalise all of it away before comparing.
function _norm(s) { return String(s || '').trim().toLowerCase().replace(/[\s_-]+/g, ''); }

function resolveFactsKey(productName) {
  if (!productName) return null;
  const needle = _norm(productName);
  if (!needle) return null;
  for (const [key, entry] of Object.entries(PRODUCT_FACTS)) {
    if (_norm(key) === needle) return key;
    if ((entry.aliases || []).some(a => _norm(a) === needle)) return key;
  }
  return null;
}

/**
 * Alias → canonical display name. 'reta' → 'Retatrutide'.
 *
 * THIS IS LOad-BEARING. Every product-scoped regex in brain-guards is built from
 * the anchor. An alias anchor produces \breta\b, which does not match the word
 * "Retatrutide" anywhere in the brain — so segment lookup returns nothing, the
 * allow-list comes back empty, and the guard has nothing to check against while
 * still appearing to run.
 *
 * Unknown products pass through unchanged, so they still anchor on whatever the
 * matcher found.
 */
function canonicalProductName(productName) {
  const key = resolveFactsKey(productName);
  if (key) return PRODUCT_FACTS[key].name || key;
  return productName || null;
}

function getProductFacts(productName) {
  const key = resolveFactsKey(productName);
  return key ? PRODUCT_FACTS[key] : null;
}

/** Only CONFIRMED dilutions. Pending ones do not exist as far as the model is concerned. */
function confirmedDilutions(productName) {
  const facts = getProductFacts(productName);
  if (!facts) return [];
  return (facts.dilutions || []).filter(d => d.status === 'confirmed');
}

/** Does code hold an authorised reconstitution answer for this product? */
function hasCanonicalDosing(productName) {
  return confirmedDilutions(productName).length > 0;
}

/**
 * Every numeric string the model is ALLOWED to state for this product. The
 * contamination guard rejects any mL volume or concentration outside this set.
 * Pending dilutions are deliberately excluded — that is the whole point.
 */
function allowedNumbersFor(productName) {
  const allowed = new Set();
  const facts = getProductFacts(productName);
  if (!facts) return allowed;

  for (const d of confirmedDilutions(productName)) {
    allowed.add(d.water.toLowerCase());
    allowed.add(d.concentration.toLowerCase().replace(/\s+/g, ''));
    allowed.add(d.vial.toLowerCase());

    for (const row of facts.unitMath?.[d.concentration] || []) {
      allowed.add(row.mL.toLowerCase());
      allowed.add(row.dose.toLowerCase());
      allowed.add(`${row.units}units`);
    }
  }
  // Syringe barrel sizes are not doses.
  ['1ml', '0.5ml', '0.3ml'].forEach(v => allowed.add(v));
  return allowed;
}

/**
 * Renders the block injected into brainContext. Only confirmed facts. Each line
 * names the product explicitly so the product-scoped segment guard in brain-guards
 * recognises it as owned.
 */
function renderProductFactsBlock(productName) {
  const facts = getProductFacts(productName);
  if (!facts) return '';
  const confirmed = confirmedDilutions(productName);
  if (!confirmed.length) return '';

  // Canonical name, never the alias. Otherwise this emits "reta 10mg vial + 1mL
  // BAC water" into the prompt, and every product-scoped regex built from it misses.
  const name = canonicalProductName(productName);
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `CANONICAL ${name.toUpperCase()} FACTS — AUTHORITATIVE, ADMIN-CONFIRMED`,
    'These override anything below. Quote them exactly. Do not compute new values from them.',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  const byConc = new Map();
  for (const d of confirmed) {
    if (!byConc.has(d.concentration)) byConc.set(d.concentration, []);
    byConc.get(d.concentration).push(d);
  }

  for (const [conc, ds] of byConc) {
    const vials = ds.map(d => `${name} ${d.vial} vial + ${d.water} BAC water`).join(', or ');
    lines.push(`${name} reconstitution at ${conc}: ${vials}. All give ${conc}.`);
    const rows = facts.unitMath?.[conc] || [];
    if (rows.length) {
      const table = rows.map(r =>
        `${r.units} units (${r.mL}) = ${r.dose}${r.label ? ` [${r.label}]` : ''}`
      ).join('; ');
      lines.push(`${name} unit conversions at ${conc} on a 1mL/100-unit insulin syringe: ${table}.`);
    }
  }

  if (byConc.size > 1) {
    lines.push(`${name} units are NOT interchangeable between concentrations. Confirm which volume the customer used before quoting any unit count.`);
  }

  for (const h of facts.handling || []) lines.push(`${name}: ${h}`);

  const pending = (facts.dilutions || []).filter(d => d.status === 'pending');
  if (pending.length) {
    const sizes = pending.map(d => d.vial).join(', ');
    lines.push(`${name}: NO confirmed reconstitution volume exists for the ${sizes} vial(s). If the customer has one of those, say you are confirming the exact volume and coming back. Do NOT scale it from the confirmed sizes.`);
  }

  if (facts.escalation?.status === 'conflict') {
    lines.push(`${name}: the weekly escalation schedule is NOT available. Do not state one. You may still give reconstitution volumes and mg-to-unit conversions above. If asked for the weekly ladder, say you are confirming it.`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n') + '\n\n';
}

/**
 * Prepends the canonical block to the retrieved brain context, trimming the
 * retrieved half so the total stays under the budget. Canonical facts are never
 * the thing that gets truncated.
 */
function injectProductFacts(brainContext, productName, maxChars = 8000) {
  const block = renderProductFactsBlock(productName);
  if (!block) return brainContext || '';
  const room = Math.max(0, maxChars - block.length);
  const trimmed = (brainContext || '').slice(0, room);
  console.log(`🧬 [Facts] injected canonical ${canonicalProductName(productName)} facts (${block.length}c), brain trimmed to ${trimmed.length}c`);
  return block + trimmed;
}

module.exports = {
  PRODUCT_FACTS,
  PENDING_REVIEW,
  NO_DATA,
  resolveFactsKey,
  canonicalProductName,
  getProductFacts,
  confirmedDilutions,
  hasCanonicalDosing,
  allowedNumbersFor,
  renderProductFactsBlock,
  injectProductFacts,
};