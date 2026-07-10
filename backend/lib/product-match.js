
const PRODUCT_TERMS = [
  'retatrutide','reta','semaglutide','sema','ozempic','wegovy',
  'tirzepatide','tirz','mounjaro','bpc-157','bpc157','bpc',
  'tb-500','tb500','cjc-1295','cjc1295','cjc','ipamorelin','ipa',
  'ghk-cu','ghkcu','ghk','tesamorelin','tesa','sermorelin',
  'nad+','nad','wolverine','glow blend','glow','klow','mots-c','motsc',
  'pt-141','pt141','selank','semax','epithalon',
  'bac water','bacteriostatic','reconstitution solution','recon water',
  'survodutide','cagrilintide','kisspeptin','follistatin','adipotide',
  'aicar','epo','cerebrolysin','hexarelin','ghrp','igf','peg-mgf','mgf',
  'triptorelin','thymalin','pinealon','oxytocin','vip','ara-290',
  'ss-31','elamipretide','slu-pp-332','gonadorelin','hcg','hmg',
  'lipo-c','dsip','hyaluronic','botulinum','5-amino-1mq','5-amino','1mq',
];


const _PRODUCT_RE = (() => {
  const sorted  = [...PRODUCT_TERMS].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![a-z0-9])(?:${escaped.join('|')})(?![a-z0-9])`, 'gi');
})();


function matchProducts(msg = '') {
  if (!msg) return [];
  const seen = new Set();
  const out  = [];
  for (const m of msg.toLowerCase().matchAll(_PRODUCT_RE)) {
    if (!seen.has(m[0])) { seen.add(m[0]); out.push(m[0]); }
  }
  return out;
}


function firstProduct(msg = '') {
  return matchProducts(msg)[0] || null;
}

module.exports = { PRODUCT_TERMS, matchProducts, firstProduct };