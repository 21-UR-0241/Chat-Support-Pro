// Extract the cache helpers from the component and exercise them against a
// sessionStorage stub, so the eviction and key logic is checked without a browser.
import { readFileSync } from 'node:fs';

const src = readFileSync('frontend/src/admin/components/Aisuggestions.jsx', 'utf8');
const start = src.indexOf("const CACHE_KEY = 'ai-suggestion-cache';");
// Stop at the end of readEntry — everything after it is unrelated module code
// (some of it JSX) that new Function() cannot parse.
const marker = 'const readEntry =';
const end = src.indexOf(';', src.indexOf(marker)) + 1;
const block = src.slice(start, end);

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
};

const mod = new Function(`${block}; return { cacheEntry, readEntry, readCache, CACHE_MAX };`)();
const { cacheEntry, readEntry, readCache, CACHE_MAX } = mod;

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.error('  ✗', name, '\n     ', e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

t('stores and reads back suggestions', () => {
  cacheEntry('convA', 'msg1', { suggestions: ['a', 'b'] });
  assert(readEntry('convA', 'msg1').suggestions.length === 2, 'not stored');
});

t('a different message on the same conversation misses', () => {
  assert(readEntry('convA', 'msg2') === null, 'stale entry returned for a newer message');
});

t('a different conversation misses', () => {
  assert(readEntry('convB', 'msg1') === null, 'cross-conversation leak');
});

t('merges detailed answers onto the same entry', () => {
  cacheEntry('convA', 'msg1', { detailed: { answers: [{ label: 'Refund now' }] } });
  const e = readEntry('convA', 'msg1');
  assert(e.suggestions.length === 2, 'suggestions lost when detailed was added');
  assert(e.detailed.answers.length === 1, 'detailed not stored');
});

t('survives a simulated remount (module scope, not component state)', () => {
  const again = new Function(`${block}; return { readEntry };`)();
  assert(again.readEntry('convA', 'msg1').suggestions.length === 2, 'did not survive');
});

t('evicts oldest beyond the cap', () => {
  for (let i = 0; i < CACHE_MAX + 10; i++) cacheEntry('bulk', `m${i}`, { suggestions: [String(i)] });
  const keys = Object.keys(readCache());
  assert(keys.length <= CACHE_MAX, `cache grew to ${keys.length}, cap is ${CACHE_MAX}`);
  assert(readEntry('bulk', `m${CACHE_MAX + 9}`) !== null, 'newest entry was evicted');
});

t('null ids are a no-op rather than a crash', () => {
  cacheEntry(null, 'm', { suggestions: ['x'] });
  assert(readEntry(null, 'm') === null);
  assert(readEntry('convA', null) === null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
