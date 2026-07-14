
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const API_BASE = (import.meta.env.PROD
  ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
  : '') + '/api';

const CATEGORY_META = {
  tone:    { color: '#60a5fa', label: 'Tone',    icon: '🎙️', brainKey: 'toneRules',        bg: '#60a5fa12' },
  avoid:   { color: '#f87171', label: 'Avoid',   icon: '🚫', brainKey: 'avoidPatterns',    bg: '#f8717112' },
  prefer:  { color: '#34d399', label: 'Prefer',  icon: '✅', brainKey: 'preferPatterns',   bg: '#34d39912' },
  product: { color: '#fbbf24', label: 'Product', icon: '💊', brainKey: 'productKnowledge', bg: '#fbbf2412' },
  policy:  { color: '#a78bfa', label: 'Policy',  icon: '📋', brainKey: 'customPolicies',   bg: '#a78bfa12' },
  example: { color: '#2dd4bf', label: 'Example', icon: '⭐', brainKey: 'responseExamples', bg: '#2dd4bf12' },
};

const EMPTY_BRAIN = {
  toneRules: [], avoidPatterns: [], preferPatterns: [],
  productKnowledge: [], customPolicies: [], responseExamples: [],
  suggestionSettings: { length: 'medium', tone: 'friendly-professional', empathy: 'high' },
};

const STARTERS = [
  { label: 'Analyze conversations', icon: '📊', text: 'Analyze all our past conversations and find patterns.' },
  { label: 'What do you know?',     icon: '🧠', text: 'What rules do you currently have? Summarize what you know about our business.' },
  { label: 'Peptide knowledge',     icon: '💊', text: 'What do you know about our peptide products and how agents should explain them?' },
  { label: 'Teach a rule',          icon: '✍️', text: 'Agents should always mention that our peptides come with BAC water included.' },
  { label: 'Review screenshot',     icon: '🖼️', text: 'I\'ll share a screenshot of a bad suggestion so you can learn from it.' },
  { label: 'Suggestion length',     icon: '📏', text: 'The suggestions are too short. I want longer, more detailed replies like a real support expert would write.' },
  { label: 'Review bad suggestions',icon: '👎', text: 'I have flagged some bad suggestions. Let\'s review them and improve.' },
  { label: 'Upload a document',     icon: '📄', text: 'I\'ll upload a document (PDF, TXT, or DOCX) for you to learn from.' },
];

function getToken() { return localStorage.getItem('token') || ''; }

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mergeBrainRules(brain, ruleUpdates) {
  const updated = { ...brain };
  ruleUpdates.forEach(rule => {
    const meta = CATEGORY_META[rule.category];
    if (!meta) return;
    const key = meta.brainKey;
    const existing = updated[key] ? [...updated[key]] : [];
    const exists = existing.some(r => (r.text || r) === rule.text);
    if (!exists) existing.push({ text: rule.text, source: rule.source || 'admin-chat' });
    updated[key] = existing;
  });
  return updated;
}

// ─── Duplicate detection ───────────────────────────────────────────────────
const DUPE_THRESHOLD = 0.45;

const PRODUCT_NAMES = [
  '5-amino-1mq','adipotide','aicar','ara-290',
  'bpc-157','bpc157','cagrilintide','cerebrolysin',
  'cjc-1295','cjc1295','dsip','epithalon','epitalon','epo',
  'follistatin','ghk-cu','ghk','ghrp-2','ghrp-6','ghrp','glp-1',
  'gonadorelin','hcg','hexarelin',
  'hgh fragment 176-191','hgh fragment','hgh','hmg','hyaluronic',
  'igf-des','igf-1','igf','ipamorelin','kisspeptin','klow','kpv',
  'lipo-c','mgf','mots-c','motsc','nad+','nad','oxytocin',
  'peg-mgf','pinealon','pt-141','pt141','retatrutide',
  'selank','semax','semaglutide','sermorelin','slu-pp-332',
  'ss-31','elamipretide','survodutide','tb-500','tb500',
  'tesamorelin','thymalin','tirzepatide','triptorelin','vip',
  'wolverine','glow blend',
  // Short forms customers and agents actually type. PRODUCT_NAMES_SORTED sorts by
  // length descending, so 'retatrutide' still wins over 'reta' when both appear.
  'reta','tirz','sema',
];

const PRODUCT_NAMES_SORTED = [...PRODUCT_NAMES].sort((a, b) => b.length - a.length);

function extractProductName(text) {
  const lower = (text || '').toLowerCase();
  for (const name of PRODUCT_NAMES_SORTED) {
    if (lower.slice(0, 120).includes(name)) return name;
  }
  return null;
}

// ─── Intent + concentration discriminators ─────────────────────────────────
//
// extractProductName stops two DIFFERENT products being flagged as duplicates. It
// does nothing for two rules about the SAME product covering DIFFERENT FACTS.
//
// "Retatrutide unit conversions at 10mg/mL" and "Retatrutide unit conversions at
// 5mg/mL" share ~60% of their tokens. They clear DUPE_THRESHOLD. Both carry source
// 'admin-feedback', so srcSet.size === 1, the multi-master branch never fires,
// resolvedKeeper() falls through to g.indexes[0], and defaultSelected() PRE-CHECKS
// the other for deletion — with no conflict badge and no warning.
//
// Deleting the 5mg/mL table means anyone who reconstituted at 2mL is told 5 units
// when they need 10. A silent 2x underdose, shipped by a dedupe tool.
//
// Two rules about the same product with different intents are not duplicates.
// Two rules at different concentrations are REALLY not duplicates.

const RULE_INTENTS = [
  ['unit-math',      /\bunits?\s*[=(]|\d+\s*units?\s*=|unit conversion|per unit|on (?:a|an) .{0,20}insulin syringe/i],
  ['reconstitution', /reconstitut|bacteriostatic|bac water|\bmg\s*\/\s*mL\b|add\s+[\d.]+\s*mL|\+\s*[\d.]+\s*mL/i],
  ['escalation',     /\bWks?\s*\d|\bWeeks?\s*\d|escalation|titrat|taper|ramp/i],
  ['storage',        /stor(?:e|age)|refrigerat|freeze|frozen|shelf life|expire|use within/i],
  ['administration', /subcutaneous|intramuscular|\bSQ\b|\bIM\b|injection site|rotate sites|empty stomach/i],
  ['safety',         /overdose|contraindicat|blood ?work|monitor|side effect|pregnan|chemical castration/i],
];

function extractIntent(text) {
  const t = text || '';
  for (const [name, re] of RULE_INTENTS) if (re.test(t)) return name;
  return null;
}

function extractConcentration(text) {
  const m = (text || '').match(/([\d.]+)\s*(?:mg|mcg|iu)\s*\/\s*mL/i);
  return m ? m[0].replace(/\s+/g, '').toLowerCase() : null;
}

function tokenize(text) {
  return new Set(
    (text || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

function jaccardSimFast(prodA, prodB, setA, setB, intentA, intentB, concA, concB) {
  // Different products: never duplicates.
  if (prodA && prodB && prodA !== prodB) return 0;

  // Same product, different facts: never duplicates. Reconstitution volume, unit
  // math, escalation ladder and storage are four rules, not four phrasings of one.
  if (intentA && intentB && intentA !== intentB) return 0;

  // Same product, same intent, different stated concentration: never duplicates.
  // This is the 10mg/mL vs 5mg/mL case. Deleting one does not remove redundancy,
  // it removes an answer.
  if (concA && concB && concA !== concB) return 0;

  if (!setA.size && !setB.size) return 1;
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return inter / (setA.size + setB.size - inter);
}

function isExplicitMaster(rule) {
  const text = (typeof rule === 'string' ? rule : rule?.text || '').trimStart();
  return /^MASTER RULE\s*[—–\-]/i.test(text);
}

function isMasterRule(rule) {
  if (!rule) return false;
  if (isExplicitMaster(rule)) return true;
  const src = (typeof rule === 'string' ? '' : rule.source || '').toLowerCase().trim();
  return [
    // backend-golden sources (must match normaliseRule in brain-context.js)
    'admin-feedback',
    'admin-upload',
    'admin-training',
    'admin-consolidation-audit',
    'admin-chat',
    // frontend-only authored markers
    'admin',
    'manual',
    '',
  ].includes(src);
}

function detectDuplicates(brain) {
  const result = [];
  for (const [cat, meta] of Object.entries(CATEGORY_META)) {
    const rules = brain[meta.brainKey] || [];
    const texts = rules.map(r => (typeof r === 'string' ? r : r.text) || '');
    if (texts.length < 2) continue;

    const tokenSets    = texts.map(t => tokenize(t));
    const productNames = texts.map(t => extractProductName(t));
    const intents      = texts.map(t => extractIntent(t));
    const concs        = texts.map(t => extractConcentration(t));

    const visited = new Set();
    const groups = [];
    for (let i = 0; i < texts.length; i++) {
      if (visited.has(i)) continue;
      const group = [i];
      for (let j = i + 1; j < texts.length; j++) {
        if (visited.has(j)) continue;
        const sim = jaccardSimFast(
          productNames[i], productNames[j],
          tokenSets[i],    tokenSets[j],
          intents[i],      intents[j],
          concs[i],        concs[j],
        );
        if (sim >= DUPE_THRESHOLD) { group.push(j); visited.add(j); }
      }
      if (group.length > 1) {
        visited.add(i);
        groups.push({ indexes: group, texts: group.map(idx => texts[idx]), rules: group.map(idx => rules[idx]) });
      }
    }
    if (groups.length > 0) {
      result.push({ brainKey: meta.brainKey, cat, color: meta.color, icon: meta.icon, label: meta.label, groups });
    }
  }
  return result;
}

/** Every rule in this group was admin-authored. Nothing gets pre-staged for deletion. */
function isAllMasterGroup(g) {
  const rules = g?.rules || [];
  return rules.length > 0 && rules.every(r => isMasterRule(r));
}


// ─── Small components ─────────────────────────────────────────────────────
function TypingDots({ color = '#34d399' }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block',
          animation: 'tdBounce 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function MessageText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} style={{ color: '#e2e8f0', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        return part.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>{line}{j < arr.length - 1 ? <br /> : null}</span>
        ));
      })}
    </span>
  );
}

function RuleChip({ rule, onAdd }) {
  const [added, setAdded] = useState(false);
  const meta = CATEGORY_META[rule.category] || CATEGORY_META.prefer;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: meta.bg, border: `1px solid ${meta.color}25`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 8, padding: '10px 12px', marginTop: 8, fontSize: 12,
    }}>
      <span style={{ fontSize: 13, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: meta.color, fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{meta.label}</span>
        <p style={{ margin: '0 0 8px', color: '#94a3b8', lineHeight: 1.5, fontSize: 12 }}>{rule.text}</p>
        <button onClick={() => { onAdd(rule); setAdded(true); }} disabled={added} style={{
          background: added ? `${meta.color}20` : 'transparent',
          border: `1px solid ${meta.color}${added ? '60' : '40'}`,
          color: added ? meta.color : `${meta.color}cc`,
          borderRadius: 5, padding: '3px 10px', fontSize: 11,
          cursor: added ? 'default' : 'pointer', fontWeight: 600,
        }}>
          {added ? '✓ Added' : '+ Add to brain'}
        </button>
      </div>
    </div>
  );
}

function ImagePreview({ images, onRemove }) {
  if (!images.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '10px 16px 0', flexWrap: 'wrap' }}>
      {images.map((img, i) => (
        <div key={i} style={{ position: 'relative' }}>
          <img src={`data:${img.type};base64,${img.base64}`} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #1e293b' }} />
          <button onClick={() => onRemove(i)} style={{
            position: 'absolute', top: -5, right: -5, width: 18, height: 18,
            borderRadius: '50%', background: '#f87171', border: '2px solid #080b14',
            color: '#fff', fontSize: 10, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      ))}
    </div>
  );
}

function InterviewCard({ question, index, total, onAnswer, onSkip }) {
  const [custom, setCustom] = useState('');
  const meta = CATEGORY_META[question.category] || CATEGORY_META.product;
  return (
    <div style={{
      background: '#0d1117', border: `1px solid ${meta.color}30`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 12, padding: '18px 20px', margin: '16px 0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{meta.icon}</span>
          <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
          <span style={{ fontSize: 10, color: '#334155', fontWeight: 500 }}>{index + 1} / {total}</span>
        </div>
        <button onClick={onSkip} style={{ background: 'none', border: '1px solid #1e293b', color: '#475569', fontSize: 11, cursor: 'pointer', borderRadius: 5, padding: '3px 10px' }}>Skip →</button>
      </div>
      <p style={{ color: '#cbd5e1', fontSize: 14, margin: '0 0 8px', lineHeight: 1.6, fontWeight: 500 }}>{question.text}</p>
      {question.hint && (
        <p style={{ fontSize: 11, color: '#475569', margin: '0 0 14px', fontStyle: 'italic', lineHeight: 1.5 }}>💡 {question.hint}</p>
      )}
      {question.quickReplies?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {question.quickReplies.map((qr, i) => (
            <button key={i} onClick={() => onAnswer(question, qr)} style={{
              background: '#0f172a', border: `1px solid ${meta.color}30`,
              color: '#94a3b8', borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
            }}>{qr}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && custom.trim() && (onAnswer(question, custom), setCustom(''))}
          placeholder="Type your answer…"
          style={{ flex: 1, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
        />
        <button onClick={() => { if (custom.trim()) { onAnswer(question, custom); setCustom(''); } }} style={{
          background: meta.color, border: 'none', borderRadius: 8, color: '#000',
          padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Send</button>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onChange }) {
  const s = settings || { length: 'medium', tone: 'friendly-professional', empathy: 'high' };
  const descriptions = {
    length: { short: '1–2 sentences · Direct and fast', medium: '2–4 sentences · Balanced default', long: '4–6 sentences · Expert-level detail' },
    tone: { formal: 'Professional language · No contractions', 'friendly-professional': 'Warm but polished · Best for most cases', casual: 'Conversational · Like a helpful colleague' },
    empathy: { low: 'Skip preambles · Get straight to solution', medium: 'Brief acknowledgment · Then solution', high: 'Lead with empathy · Always acknowledge first' },
  };
  const Section = ({ label, keyName, options }) => (
    <div style={{ marginBottom: 24 }}>
      <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10, fontWeight: 600 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {options.map(opt => {
          const active = s[keyName] === opt.value;
          return (
            <button key={opt.value} onClick={() => onChange({ ...s, [keyName]: opt.value })} style={{
              background: active ? '#34d39915' : '#0f172a', border: `1px solid ${active ? '#34d399' : '#1e293b'}`,
              color: active ? '#34d399' : '#64748b', borderRadius: 8, padding: '7px 16px', fontSize: 12,
              cursor: 'pointer', fontWeight: active ? 700 : 400, flex: 1,
            }}>{opt.label}</button>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.5 }}>{descriptions[keyName][s[keyName]]}</p>
    </div>
  );
  return (
    <div style={{ padding: '24px 28px' }}>
      <p style={{ fontSize: 12, color: '#334155', margin: '0 0 24px', lineHeight: 1.6 }}>
        These settings control how the AI generates replies for all agents across all conversations.
      </p>
      <Section label="Reply Length" keyName="length" options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]} />
      <Section label="Tone" keyName="tone" options={[{ value: 'formal', label: 'Formal' }, { value: 'friendly-professional', label: 'Friendly' }, { value: 'casual', label: 'Casual' }]} />
      <Section label="Empathy Level" keyName="empathy" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
    </div>
  );
}

// ─── Consolidate Preview Modal ─────────────────────────────────────────────
function ConsolidatePreviewModal({ onClose, onDone, showToast }) {
  const [phase, setPhase]             = useState('menu');
  const [proposals, setProposals]     = useState([]);
  const [summary, setSummary]         = useState(null);
  const [filter, setFilter]           = useState('all');
  const [editingId, setEditingId]     = useState(null);
  const [editText, setEditText]       = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');
  const [revertConfirm, setRevertConfirm] = useState(false);
  const [lastCommit, setLastCommit]   = useState(null); // { removed, newTotal }

  const setProposalState = (id, targetState) =>
    setProposals(prev => prev.map(p =>
      p.id === id ? { ...p, _state: p._state === targetState ? 'pending' : targetState } : p
    ));

  const approveAll = () => setProposals(prev => prev.map(p => ({ ...p, _state: 'approved' })));
  const rejectAll  = () => setProposals(prev => prev.map(p => ({ ...p, _state: 'rejected' })));

  const saveEdit = (id) => {
    if (!editText.trim()) return;
    setProposals(prev => prev.map(p => p.id === id ? { ...p, golden: editText.trim() } : p));
    setEditingId(null);
  };

  const toggleExpand = (id) =>
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const loadPreview = async () => {
    setPhase('loading');
    try {
      const data = await apiFetch('/ai/training/consolidate/preview', { method: 'POST', body: JSON.stringify({}) });
      setProposals((data.proposals || []).map(p => ({ ...p, _state: 'pending' })));
      setSummary(data.summary);
      setPhase('review');
    } catch (e) { setError(e.message); setPhase('error'); }
  };

  const runQuick = async () => {
    setPhase('quickRunning');
    try {
      const data = await apiFetch('/ai/training/consolidate', { method: 'POST', body: JSON.stringify({}) });
      setResult(data); setPhase('quickDone'); onDone();
    } catch (e) { setError(e.message); setPhase('error'); }
  };

  const commit = async () => {
    const approved = proposals.filter(p => p._state === 'approved');
    if (!approved.length) return;
    setPhase('committing');
    try {
      const data = await apiFetch('/ai/training/consolidate/commit', {
        method: 'POST', body: JSON.stringify({ approvedProposals: approved }),
      });
      // Stay in review — remove committed proposals, keep pending/rejected
      const removedCount = approved.length;
      const newTotal = data.remainingRules ?? data.rulesAfter ?? null;
      setProposals(prev => prev.filter(p => p._state !== 'approved'));
      setSummary(prev => prev && newTotal != null ? { ...prev, currentRules: newTotal } : prev);
      setLastCommit({ removed: removedCount, newTotal });
      setFilter('all');
      setPhase('review');
      onDone();
    } catch (e) { setError(e.message); setPhase('error'); }
  };

  const revert = async () => {
    setRevertConfirm(false); setPhase('reverting');
    try {
      await apiFetch('/ai/training/consolidate-restore', { method: 'POST', body: JSON.stringify({}) });
      setPhase('reverted'); onDone();
    } catch (e) { setError(e.message); setPhase('error'); }
  };

  // Derived
  const approved  = proposals.filter(p => p._state === 'approved');
  const rejected  = proposals.filter(p => p._state === 'rejected');
  const pending   = proposals.filter(p => p._state === 'pending');
  const savedByApproved = approved.reduce((s, p) => s + Math.max(0, (p.absorbedCount || 0) - 1), 0);
  const estAfter  = summary ? Math.max(0, summary.currentRules - savedByApproved) : 0;

  const filtered = proposals.filter(p => {
    if (filter === 'approved') return p._state === 'approved';
    if (filter === 'rejected') return p._state === 'rejected';
    if (filter === 'pending')  return p._state === 'pending';
    if (filter === 'critical') return p.impact === 'critical' || p.impact === 'high';
    return true;
  });

  const impactColor = i => i === 'critical' ? '#f87171' : i === 'high' ? '#fbbf24' : '#60a5fa';
  const impactBg    = i => i === 'critical' ? '#f8717118' : i === 'high' ? '#fbbf2418' : '#60a5fa18';

  // A merge that swallows dosing numbers is how a 23-product reconstitution blob gets
  // built — and how one product's ratio ends up next to another product's name.
  const DOSING_RE = /reconstitut|bacteriostatic|bac water|\bmg\s*\/\s*mL\b|\d+\s*units?\b|\bmL\b/i;
  const touchesDosing = (p) =>
    DOSING_RE.test(p?.golden || '') || (p?.absorbedTexts || []).some(t => DOSING_RE.test(t));

  const Dots = ({ color = '#a78bfa' }) => (
    <div style={{ display: 'flex', gap: 7, justifyContent: 'center', padding: '32px 0' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: color,
          display: 'inline-block', animation: 'tdBounce 1.4s ease-in-out infinite',
          animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );

  // ── Menu ─────────────────────────────────────────────────────────────────
  if (phase === 'menu') return (
    <div style={OV}>
      <div style={{ ...MB, maxWidth: 520 }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={ICON_BOX('#a78bfa')}>🔀</div>
          <div style={{ flex: 1 }}>
            <div style={H3}>Consolidate brain rules</div>
            <div style={SUB}>AI merges overlapping rules and removes redundancy</div>
          </div>
          <button onClick={onClose} style={X_BTN}>×</button>
        </div>
        <div style={{ padding: '18px 26px 22px' }}>
          {/* Interactive */}
          <div onClick={loadPreview} style={{ ...CHOICE_CARD, marginBottom: 10, borderColor: '#a78bfa30' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#a78bfa70'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#a78bfa30'}>
            <div style={CHOICE_ICON('#a78bfa')}>👁️</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>Interactive review</span>
                <span style={{ fontSize: 10, color: '#a78bfa', background: '#a78bfa18', border: '1px solid #a78bfa30', borderRadius: 20, padding: '1px 9px', fontWeight: 700 }}>Recommended</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.65 }}>
                Preview every proposed merge before it's committed. Approve, edit, or reject each individually — nothing changes until you say so.
              </p>
            </div>
            <span style={{ color: '#a78bfa', fontSize: 20, flexShrink: 0 }}>→</span>
          </div>

          {/* Quick */}
          <div onClick={runQuick} style={{ ...CHOICE_CARD, borderColor: '#1e293b' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1e293b'}>
            <div style={CHOICE_ICON('#475569')}>⚡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#94a3b8', marginBottom: 5 }}>Quick consolidate</div>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.65 }}>
                Runs immediately and writes directly to the brain. A backup is saved automatically so you can revert.
              </p>
            </div>
            <span style={{ color: '#334155', fontSize: 20, flexShrink: 0 }}>→</span>
          </div>

          <div style={{ background: '#f8717108', border: '1px solid #f8717125', borderRadius: 8, padding: '10px 14px', marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#fca5a5', lineHeight: 1.55 }}>
              ⚠️ Merging rules that contain doses, volumes, or unit conversions can silently attach one product's numbers to another product's name. Use <strong>Interactive review</strong> and reject any merge flagged 💊 <strong>dosing</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div style={OV}>
      <div style={{ ...MB, maxWidth: 400 }}>
        <div style={{ padding: '28px 26px', textAlign: 'center' }}>
          <div style={{ ...ICON_BOX('#a78bfa'), margin: '0 auto 16px', width: 44, height: 44, fontSize: 20 }}>🔀</div>
          <div style={H3}>Analysing rules…</div>
          <div style={{ ...SUB, marginBottom: 0 }}>Clustering and generating merge proposals. May take 30–60 seconds.</div>
          <Dots color="#a78bfa" />
        </div>
      </div>
    </div>
  );

  // ── Review ────────────────────────────────────────────────────────────────
  if (phase === 'review') {
    const dosingCount = proposals.filter(touchesDosing).length;
    const fc = {
      all: proposals.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      critical: proposals.filter(p => p.impact === 'critical' || p.impact === 'high').length,
      dosing: dosingCount,
    };
    return (
      <div style={OV}>
        <div style={{ ...MB, maxWidth: 760, maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>

          {/* ── Header ── */}
          <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ ...ICON_BOX('#a78bfa'), width: 32, height: 32, fontSize: 14 }}>🔀</div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>Consolidation review</span>
                  <span style={{ fontSize: 11, color: '#a78bfa', background: '#a78bfa18', border: '1px solid #a78bfa30', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>{proposals.length} proposals</span>
                  {dosingCount > 0 && <span style={{ fontSize: 11, color: '#f87171', background: '#f8717118', border: '1px solid #f8717135', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>💊 {dosingCount} touch dosing</span>}
                </div>
                <p style={{ margin: '0 0 0 42px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  Approve, edit, or reject each merge. Nothing is saved until you commit.
                </p>
              </div>
              <button onClick={onClose} style={X_BTN}>×</button>
            </div>

            {/* Stat row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Current rules',  value: summary?.currentRules ?? '—', color: '#fbbf24' },
                { label: 'After commit',   value: approved.length > 0 ? estAfter : '—', color: '#34d399' },
                { label: 'Rules saved',    value: approved.length > 0 ? savedByApproved : '—', color: '#34d399' },
                { label: 'Approved',       value: approved.length, color: '#34d399' },
                { label: 'Pending',        value: pending.length,  color: '#64748b' },
                { label: 'Rejected',       value: rejected.length, color: '#f87171' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, background: '#0d1117', border: '1px solid #0f172a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 4, fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Filters + bulk */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 14, borderBottom: '1px solid #0f172a' }}>
              {[
                { key: 'all',      label: 'All',         count: fc.all },
                { key: 'pending',  label: 'Pending',     count: fc.pending },
                { key: 'approved', label: 'Approved',    count: fc.approved },
                { key: 'rejected', label: 'Rejected',    count: fc.rejected },
                { key: 'critical', label: 'High-impact', count: fc.critical },
              ].map(({ key, label, count }) => (
                <button key={key} onClick={() => setFilter(key)} style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: filter === key ? 600 : 400,
                  background: filter === key ? '#a78bfa20' : 'transparent',
                  border: filter === key ? '1px solid #a78bfa50' : '1px solid transparent',
                  color: filter === key ? '#c4b5fd' : '#475569',
                  transition: 'all 0.15s',
                }}>
                  {label} <span style={{ opacity: 0.7 }}>{count}</span>
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {/* "Approve all" would sweep dosing merges in with everything else, so it
                    only touches proposals that don't touch dosing. */}
                <button
                  onClick={() => setProposals(prev => prev.map(p => touchesDosing(p) ? p : { ...p, _state: 'approved' }))}
                  title={dosingCount > 0 ? `Skips the ${dosingCount} proposal(s) that touch dosing — review those individually` : 'Approve all proposals'}
                  style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', background: '#34d39918', border: '1px solid #34d39935', color: '#34d399', fontWeight: 600 }}>
                  ✓ Approve all{dosingCount > 0 ? ' (non-dosing)' : ''}
                </button>
                <button onClick={rejectAll}  style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #f8717130', color: '#f87171', fontWeight: 600 }}>✗ Reject all</button>
              </div>
            </div>
          </div>

          {/* ── Commit success banner ── */}
          {lastCommit && (
            <div style={{ margin: '0 24px', marginTop: 12, background: '#34d39910', border: '1px solid #34d39930', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>
                ✓ {lastCommit.removed} merge{lastCommit.removed !== 1 ? 's' : ''} committed
                {lastCommit.newTotal != null && <span style={{ fontWeight: 400, color: '#6ee7b7' }}> · brain now has {lastCommit.newTotal} rules</span>}
              </span>
              <button onClick={() => setLastCommit(null)} style={{ background: 'none', border: 'none', color: '#34d39970', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* ── Proposal list ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px' }}>
            {filtered.length === 0 && proposals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>All done</div>
                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 24px', lineHeight: 1.65 }}>
                  No more merge proposals. Your brain is fully consolidated.
                </p>
                <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Close</button>
              </div>
            )}
            {filtered.length === 0 && proposals.length > 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155', fontSize: 13 }}>
                No proposals match this filter.
              </div>
            )}

            {filtered.map(p => {
              const isApproved = p._state === 'approved';
              const isRejected = p._state === 'rejected';
              const isEditing  = editingId === p.id;
              const isExpanded = expandedIds.has(p.id);
              const isDosing   = touchesDosing(p);
              const SHOW = 3;
              const rest = (p.absorbedTexts || []).length - SHOW;

              const borderAccent = isApproved ? '#34d399' : isRejected ? '#475569' : isDosing ? '#f87171' : '#1e293b';

              return (
                <div key={p.id} style={{
                  borderRadius: 12,
                  border: `1px solid ${isApproved ? '#34d39930' : isDosing ? '#f8717125' : '#1e293b'}`,
                  borderLeft: `4px solid ${borderAccent}`,
                  marginBottom: 10,
                  background: isApproved ? '#34d39906' : '#0d1117',
                  opacity: isRejected ? 0.5 : 1,
                  transition: 'all 0.15s',
                  overflow: 'hidden',
                }}>

                  {/* Card header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #0a0f1a' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900,
                      background: isApproved ? '#34d399' : '#1e293b',
                      color: isApproved ? '#000' : '#334155',
                    }}>
                      {isApproved ? '✓' : isRejected ? '✗' : '·'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: isRejected ? '#475569' : '#e2e8f0', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.topic || p.category}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: impactBg(p.impact), color: impactColor(p.impact) }}>
                          {p.impact}
                        </span>
                        {isDosing && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: '#f8717118', color: '#f87171', border: '1px solid #f8717135' }}>
                            💊 dosing
                          </span>
                        )}
                        {p.absorbedCount > 0 && (
                          <span style={{ fontSize: 11, color: '#334155' }}>{p.absorbedCount} rules → 1</span>
                        )}
                        {isApproved && <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>approved</span>}
                        {isRejected && <span style={{ fontSize: 11, color: '#475569' }}>rejected</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => { setEditingId(isEditing ? null : p.id); setEditText(p.golden); }}
                        title="Edit golden rule"
                        style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: '1px solid #1e293b', color: '#60a5fa', fontWeight: 500, transition: 'all 0.15s' }}>
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setProposalState(p.id, 'rejected')}
                        style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                          background: isRejected ? '#f8717120' : 'transparent',
                          border: `1px solid ${isRejected ? '#f8717150' : '#f8717130'}`,
                          color: '#f87171',
                        }}>
                        {isRejected ? 'Undo' : '✗ Reject'}
                      </button>
                      <button
                        onClick={() => setProposalState(p.id, 'approved')}
                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s',
                          background: isApproved ? '#34d399' : '#34d39920',
                          border: `1px solid ${isApproved ? '#34d399' : '#34d39940'}`,
                          color: isApproved ? '#000' : '#34d399',
                        }}>
                        {isApproved ? '✓ Approved' : 'Approve'}
                      </button>
                    </div>
                  </div>

                  {/* Dosing warning */}
                  {isDosing && !isRejected && (
                    <div style={{ padding: '9px 16px', background: '#f8717108', borderBottom: '1px solid #0a0f1a' }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#fca5a5', lineHeight: 1.55 }}>
                        This merge contains doses, volumes, or unit conversions. Check that <strong>every number still sits beside the product it belongs to</strong>. A merged rule that puts one peptide's mL next to another peptide's name becomes a wrong dose in a syringe.
                      </p>
                    </div>
                  )}

                  {/* Golden rule */}
                  <div style={{ padding: '14px 16px', borderBottom: (p.absorbedTexts?.length > 0) ? '1px solid #0a0f1a' : 'none' }}>
                    <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      ⭐ Golden rule
                    </div>
                    {isEditing ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          style={{ width: '100%', background: '#080b14', border: '1px solid #34d39940', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 90, outline: 'none', lineHeight: 1.65 }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                          <button onClick={() => setEditingId(null)} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 7, background: 'transparent', border: '1px solid #1e293b', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => saveEdit(p.id)} style={{ fontSize: 12, padding: '5px 16px', borderRadius: 7, background: '#34d399', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>{p.golden}</p>
                    )}
                  </div>

                  {/* Absorbed rules */}
                  {p.absorbedTexts?.length > 0 && (
                    <div style={{ padding: '10px 16px 12px', background: '#080b14' }}>
                      <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                        Absorbs {p.absorbedTexts.length} existing rules
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {(isExpanded ? p.absorbedTexts : p.absorbedTexts.slice(0, SHOW)).map((txt, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ color: '#1e293b', fontSize: 12, flexShrink: 0, marginTop: 2, fontWeight: 700 }}>↳</span>
                            <span style={{ fontSize: 12, color: '#334155', lineHeight: 1.55 }}>{txt}</span>
                          </div>
                        ))}
                      </div>
                      {rest > 0 && !isExpanded && (
                        <button onClick={() => toggleExpand(p.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer', padding: '2px 0', fontWeight: 500 }}>
                          + {rest} more rule{rest !== 1 ? 's' : ''}…
                        </button>
                      )}
                      {isExpanded && rest > 0 && (
                        <button onClick={() => toggleExpand(p.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#334155', fontSize: 11, cursor: 'pointer', padding: '2px 0' }}>
                          Show less
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #0f172a', background: '#080b14', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              {approved.length > 0
                ? <><span style={{ color: '#34d399', fontWeight: 600 }}>{approved.length} selected</span> · {summary?.currentRules} → <span style={{ color: '#34d399', fontWeight: 600 }}>{estAfter}</span> rules</>
                : pending.length > 0
                  ? <span style={{ color: '#475569' }}>{pending.length} remaining · {rejected.length} rejected</span>
                  : 'Approve proposals above to commit'
              }
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={GHOST_BTN}>{proposals.length === 0 ? 'Close' : 'Cancel'}</button>
              <button
                onClick={commit}
                disabled={approved.length === 0}
                style={{ fontSize: 13, padding: '9px 24px', borderRadius: 9, border: 'none', fontWeight: 700, cursor: approved.length === 0 ? 'default' : 'pointer',
                  background: approved.length === 0 ? '#1e293b' : '#a78bfa',
                  color: approved.length === 0 ? '#334155' : '#000',
                  transition: 'all 0.15s',
                }}>
                {approved.length === 0 ? 'Select proposals to commit' : `🔀 Commit ${approved.length} merge${approved.length !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Running states ─────────────────────────────────────────────────────────
  if (['committing','quickRunning','reverting'].includes(phase)) {
    const label = phase === 'reverting' ? 'Reverting…' : phase === 'quickRunning' ? 'Consolidating…' : 'Saving merges…';
    const sub   = phase === 'reverting' ? 'Restoring from backup' : phase === 'quickRunning' ? 'This may take 20–40 seconds' : 'Writing approved rules to brain';
    const color = phase === 'reverting' ? '#f87171' : '#a78bfa';
    return (
      <div style={OV}>
        <div style={{ ...MB, maxWidth: 380 }}>
          <div style={{ padding: '32px 26px', textAlign: 'center' }}>
            <div style={{ ...ICON_BOX(color), margin: '0 auto 16px', width: 44, height: 44, fontSize: 20 }}>
              {phase === 'reverting' ? '↩️' : '🔀'}
            </div>
            <div style={H3}>{label}</div>
            <div style={{ ...SUB, marginBottom: 0 }}>{sub}</div>
            <Dots color={color} />
          </div>
        </div>
      </div>
    );
  }

  // ── Done / QuickDone ───────────────────────────────────────────────────────
  if (phase === 'done' || phase === 'quickDone') {
    const beforeVal  = result?.rulesBefore ?? result?.absorbed ?? '—';
    const afterVal   = result?.remainingRules ?? result?.rulesAfter ?? '—';
    const removedVal = result?.absorbed ?? result?.removed
      ?? (result?.rulesBefore != null && result?.rulesAfter != null ? result.rulesBefore - result.rulesAfter : '—');
    return (
      <div style={OV}>
        <div style={{ ...MB, maxWidth: 460 }}>
          <div style={{ padding: '24px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ ...ICON_BOX('#34d399'), width: 40, height: 40, fontSize: 18 }}>✅</div>
              <div>
                <div style={H3}>Consolidation complete</div>
                <div style={SUB}>Brain updated and cache refreshed</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Before',  value: beforeVal,  color: '#fbbf24' },
                { label: 'After',   value: afterVal,   color: '#34d399' },
                { label: 'Removed', value: removedVal, color: '#f87171' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, background: '#0d1117', border: '1px solid #0f172a', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 6, fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>

            {result?.message && <p style={{ fontSize: 12, color: '#475569', margin: '0 0 18px', lineHeight: 1.65 }}>{result.message}</p>}

            <div style={{ background: '#fbbf2408', border: '1px solid #fbbf2420', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#b45309', lineHeight: 1.55 }}>
                Spot-check any merged product rules in the Brain drawer. Confirm every dose, volume, and unit conversion is still attached to the right product before you rely on this.
              </p>
            </div>

            {revertConfirm ? (
              <div style={{ background: '#f8717110', border: '1px solid #f8717125', borderRadius: 10, padding: '14px', marginBottom: 12 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>
                  This will restore the brain to exactly how it was before consolidation. The consolidated version will be discarded.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setRevertConfirm(false)} style={{ flex: 1, ...GHOST_BTN, fontSize: 12 }}>Cancel</button>
                  <button onClick={revert} style={{ flex: 2, background: '#f87171', border: 'none', borderRadius: 8, color: '#000', padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩️ Yes, revert brain</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setRevertConfirm(true)} style={{ flex: 1, ...GHOST_BTN }} title="Restore pre-consolidation state">↩️ Revert</button>
                <button onClick={onClose} style={{ flex: 2, background: '#34d399', border: 'none', borderRadius: 9, color: '#000', padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Done</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Reverted ───────────────────────────────────────────────────────────────
  if (phase === 'reverted') return (
    <div style={OV}>
      <div style={{ ...MB, maxWidth: 380 }}>
        <div style={{ padding: '32px 26px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>↩️</div>
          <div style={H3}>Brain restored</div>
          <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: '8px 0 22px' }}>
            The brain has been reverted to the state before consolidation.
          </p>
          <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Close</button>
        </div>
      </div>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────────────────────
  return (
    <div style={OV}>
      <div style={{ ...MB, maxWidth: 420 }}>
        <div style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ ...ICON_BOX('#f87171'), width: 36, height: 36, fontSize: 16 }}>❌</div>
            <div style={H3}>Operation failed</div>
          </div>
          <div style={{ background: '#f8717110', border: '1px solid #f8717125', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>{error}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, ...GHOST_BTN }}>Close</button>
            <button onClick={() => { setPhase('menu'); setError(''); }} style={{ flex: 1, background: '#a78bfa', border: 'none', borderRadius: 8, color: '#000', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Duplicates Modal ──────────────────────────────────────────────────────
function DuplicatesModal({ brain, dupeGroups, onDeleteIndexes, onClose }) {
  const groups = dupeGroups;
  const [step, setStep] = useState('review');
  const [keepers, setKeepers] = useState({});

  const resolvedKeeper = (cat, gi, g) => {
    const groupKey = `${cat.brainKey}:${gi}`;
    const rules = g.rules || [];
    if (keepers[groupKey] != null) return keepers[groupKey];
    const explicitIdxs = g.indexes.filter((_, ii) => isExplicitMaster(rules[ii]));
    if (explicitIdxs.length >= 1) return explicitIdxs[0];
    const srcSet = new Set(rules.map(r => (typeof r === 'string' ? '' : r?.source || '').toLowerCase()));
    if (srcSet.size > 1) {
      const masterIdxs = g.indexes.filter((_, ii) => isMasterRule(rules[ii]));
      if (masterIdxs.length === 1) return masterIdxs[0];
    }
    return g.indexes[0];
  };

  const isMultiMasterConflict = (cat, gi, g) => {
    const rules = g.rules || [];
    const groupKey = `${cat.brainKey}:${gi}`;
    if (keepers[groupKey] != null) return false;
    return g.indexes.filter((_, ii) => isExplicitMaster(rules[ii])).length > 1;
  };

  const setGroupKeeper = (cat, gi, idx) => {
    setKeepers(prev => ({ ...prev, [`${cat.brainKey}:${gi}`]: idx }));
    setSelected(prev => {
      const s = new Set(prev);
      const g = groups.find(c => c.brainKey === cat.brainKey)?.groups[gi];
      if (g) g.indexes.forEach(i => { if (i !== idx) s.add(`${cat.brainKey}:${i}`); else s.delete(`${cat.brainKey}:${i}`); });
      return s;
    });
  };

  // SAFE DEFAULT. The old version pre-checked every non-keeper for deletion in every
  // group. When all rules shared one source, srcSet.size === 1, the conflict branch
  // never fired, resolvedKeeper fell through to g.indexes[0], and the rest arrived
  // silently staged for deletion behind a tidy-looking list.
  //
  // If every rule in a group is admin-authored, stage NOTHING. Two admin rules that
  // survived the intent and concentration guards are very likely two different facts,
  // not two phrasings. Make the human click.
  const defaultSelected = () => {
    const s = new Set();
    groups.forEach(cat => {
      cat.groups.forEach((g, gi) => {
        if (isAllMasterGroup(g)) return;   // ← nothing pre-staged
        const keeper = resolvedKeeper(cat, gi, g);
        g.indexes.forEach(idx => { if (idx !== keeper) s.add(`${cat.brainKey}:${idx}`); });
      });
    });
    return s;
  };
  const [selected, setSelected] = useState(defaultSelected);

  const totalFlagged = groups.reduce((s, c) => s + c.groups.reduce((ss, g) => ss + g.indexes.length, 0), 0);
  const conflictCount = groups.reduce((s, cat) =>
    s + cat.groups.filter((g, gi) => isMultiMasterConflict(cat, gi, g)).length, 0);
  const allMasterCount = groups.reduce((s, cat) => s + cat.groups.filter(isAllMasterGroup).length, 0);

  const allSelectableKeys = [];
  groups.forEach(cat => cat.groups.forEach((g, gi) => {
    const keeper = resolvedKeeper(cat, gi, g);
    if (keeper !== null) g.indexes.forEach(idx => { if (idx !== keeper) allSelectableKeys.push(`${cat.brainKey}:${idx}`); });
  }));

  const toggle    = key => setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const selectAll = () => setSelected(new Set(allSelectableKeys));
  const deselectAll = () => setSelected(new Set());

  const buildByKey = () => {
    const byKey = {};
    for (const key of selected) {
      const colonIdx = key.indexOf(':');
      const brainKey = key.slice(0, colonIdx);
      const idx = parseInt(key.slice(colonIdx + 1));
      if (!byKey[brainKey]) byKey[brainKey] = [];
      byKey[brainKey].push(idx);
    }
    return byKey;
  };

  const handleConfirmedDelete = () => { onDeleteIndexes(buildByKey()); setStep('done'); };

  // Empty
  if (groups.length === 0) return (
    <div style={OV}>
      <div style={{ ...MB, maxWidth: 400, textAlign: 'center' }}>
        <div style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>✅</div>
          <div style={{ ...H3, marginBottom: 8 }}>No duplicates found</div>
          <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: '0 0 24px' }}>
            No rules with ≥45% word overlap detected. Rules about the same product but different facts (reconstitution vs unit math vs escalation) are not counted as duplicates.
          </p>
          <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Close</button>
        </div>
      </div>
    </div>
  );

  // Done
  if (step === 'done') return (
    <div style={OV}>
      <div style={{ ...MB, maxWidth: 400, textAlign: 'center' }}>
        <div style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🗑️</div>
          <div style={{ ...H3, marginBottom: 8 }}>Rules deleted</div>
          <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: '0 0 24px' }}>
            {selected.size} duplicate rule{selected.size !== 1 ? 's were' : ' was'} removed and the brain was saved.
          </p>
          <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Done</button>
        </div>
      </div>
    </div>
  );

  // Confirm
  if (step === 'confirm') {
    const preview = [];
    groups.forEach(cat => {
      cat.groups.forEach(g => {
        g.indexes.forEach((idx, ii) => {
          if (selected.has(`${cat.brainKey}:${idx}`))
            preview.push({ color: cat.color, icon: cat.icon, label: cat.label, text: g.texts[ii], isMaster: isMasterRule(g.rules[ii]) });
        });
      });
    });
    const masterDeletes = preview.filter(p => p.isMaster).length;
    return (
      <div style={OV}>
        <div style={{ ...MB, maxWidth: 580 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...ICON_BOX('#f87171'), width: 36, height: 36, fontSize: 16 }}>⚠️</div>
            <div>
              <div style={H3}>Confirm deletion</div>
              <div style={SUB}>This cannot be undone — review carefully</div>
            </div>
          </div>

          {masterDeletes > 0 && (
            <div style={{ margin: '14px 24px 0', background: '#f8717110', border: '1px solid #f8717130', borderRadius: 9, padding: '11px 14px' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#fca5a5', lineHeight: 1.6 }}>
                👑 <strong>{masterDeletes} admin-authored rule{masterDeletes !== 1 ? 's' : ''}</strong> {masterDeletes !== 1 ? 'are' : 'is'} in this list. A human wrote {masterDeletes !== 1 ? 'these' : 'this'} on purpose. If any contain doses, volumes, or unit conversions, deleting {masterDeletes !== 1 ? 'them' : 'it'} removes an answer, not a redundancy.
              </p>
            </div>
          )}

          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '16px 24px' }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {preview.length} rule{preview.length !== 1 ? 's' : ''} will be permanently deleted:
            </div>
            {preview.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', marginBottom: 6, background: '#f8717108', border: '1px solid #f8717120', borderLeft: `3px solid ${item.color}`, borderRadius: 8 }}>
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: item.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
                    {item.isMaster && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2412', border: '1px solid #fbbf2430', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>👑 master</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#f87171aa', lineHeight: 1.55, textDecoration: 'line-through', wordBreak: 'break-word' }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #0f172a', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setStep('review')} style={GHOST_BTN}>← Back</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={GHOST_BTN}>Cancel</button>
              <button onClick={handleConfirmedDelete} style={{ ...BTN_DANGER, padding: '9px 20px', fontSize: 13, minWidth: 180 }}>
                🗑️ Delete {preview.length} rule{preview.length !== 1 ? 's' : ''} — confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Review
  return (
    <div style={OV}>
      <div style={{ ...MB, maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #0f172a', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <div style={{ ...ICON_BOX('#f87171'), width: 32, height: 32, fontSize: 14 }}>🔍</div>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Duplicate scanner</span>
                <span style={{ fontSize: 11, color: '#f87171', background: '#f8717112', borderRadius: 20, padding: '2px 9px', border: '1px solid #f8717125', fontWeight: 700 }}>{totalFlagged} flagged</span>
                {conflictCount > 0 && <span style={{ fontSize: 11, color: '#fbbf24', background: '#fbbf2412', borderRadius: 20, padding: '2px 9px', border: '1px solid #fbbf2430', fontWeight: 700 }}>👑 {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}</span>}
                {allMasterCount > 0 && <span style={{ fontSize: 11, color: '#60a5fa', background: '#60a5fa12', borderRadius: 20, padding: '2px 9px', border: '1px solid #60a5fa30', fontWeight: 700 }}>🔒 {allMasterCount} all-admin</span>}
              </div>
              <p style={{ margin: '0 0 0 42px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                <span style={{ color: '#34d399', fontWeight: 600 }}>👑 Master</span> rules are admin-added. Groups where <em>every</em> rule is admin-authored have <strong>nothing pre-selected</strong> — you must choose deliberately.
              </p>
            </div>
            <button onClick={onClose} style={X_BTN}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={selectAll}   style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: '#f8717112', border: '1px solid #f8717130', color: '#f87171', fontWeight: 600 }}>Select all duplicates</button>
            <button onClick={deselectAll} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #1e293b', color: '#475569', fontWeight: 500 }}>Clear selection</button>
            <span style={{ fontSize: 12, color: '#334155', marginLeft: 'auto' }}>{selected.size} of {allSelectableKeys.length} selected for deletion</span>
          </div>
        </div>

        {/* Groups */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {groups.map(cat => (
            <div key={cat.brainKey} style={{ marginBottom: 32 }}>
              {/* Category header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>{cat.icon}</span>
                <span style={{ fontSize: 12, color: cat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat.label}</span>
                <span style={{ fontSize: 11, color: '#334155', background: '#0d1117', borderRadius: 20, padding: '2px 9px', border: '1px solid #0f172a' }}>
                  {cat.groups.reduce((s, g) => s + g.indexes.length, 0)} rules · {cat.groups.length} group{cat.groups.length !== 1 ? 's' : ''}
                </span>
                <div style={{ flex: 1, height: 1, background: `${cat.color}15` }} />
                <button onClick={() => setSelected(prev => {
                  const s = new Set(prev);
                  cat.groups.forEach((g, gi) => {
                    const keeper = resolvedKeeper(cat, gi, g);
                    if (keeper !== null) g.indexes.forEach(idx => { if (idx !== keeper) s.add(`${cat.brainKey}:${idx}`); });
                  });
                  return s;
                })} style={{ fontSize: 10, padding: '2px 9px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '1px solid #1e293b', color: '#475569' }}>
                  Select all in {cat.label}
                </button>
              </div>

              {/* Similarity groups */}
              {cat.groups.map((g, gi) => {
                const keeper     = resolvedKeeper(cat, gi, g);
                const conflict   = isMultiMasterConflict(cat, gi, g);
                const allMaster  = isAllMasterGroup(g);
                const masterIdxs = g.indexes.filter((_, ii) => isMasterRule(g.rules[ii]));
                const accent     = conflict ? '#fbbf24' : allMaster ? '#60a5fa' : '#1e293b';
                return (
                  <div key={gi} style={{ marginBottom: 8, border: `1px solid ${conflict ? '#fbbf2430' : allMaster ? '#60a5fa25' : '#1e293b'}`, borderRadius: 10, overflow: 'hidden' }}>
                    {/* Group bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: conflict ? '#fbbf2406' : allMaster ? '#60a5fa06' : '#0a0e1a', borderBottom: `1px solid ${conflict ? '#fbbf2420' : allMaster ? '#60a5fa18' : '#0f172a'}` }}>
                      <span style={{ fontSize: 10, color: accent === '#1e293b' ? '#334155' : accent, fontWeight: 700, letterSpacing: '0.07em' }}>
                        GROUP {gi + 1}
                      </span>
                      <span style={{ fontSize: 10, color: '#1e293b' }}>·</span>
                      <span style={{ fontSize: 10, color: '#334155' }}>{g.indexes.length} similar rules</span>
                      {conflict && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2415', border: '1px solid #fbbf2430', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>👑 {masterIdxs.length} masters — click Keep to choose</span>}
                      {allMaster && !conflict && <span style={{ fontSize: 10, color: '#60a5fa', background: '#60a5fa15', border: '1px solid #60a5fa30', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>🔒 all admin-authored — nothing pre-selected</span>}
                      <button onClick={() => setSelected(prev => {
                        const s = new Set(prev);
                        const allChecked = g.indexes.filter(idx => idx !== keeper).every(idx => s.has(`${cat.brainKey}:${idx}`));
                        g.indexes.filter(idx => idx !== keeper).forEach(idx => { const k = `${cat.brainKey}:${idx}`; allChecked ? s.delete(k) : s.add(k); });
                        return s;
                      })} style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 9px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: `1px solid ${conflict ? '#fbbf2430' : '#1e293b'}`, color: conflict ? '#fbbf24' : '#475569' }}>
                        {g.indexes.filter(idx => idx !== keeper).every(idx => selected.has(`${cat.brainKey}:${idx}`)) ? 'Deselect group' : 'Select duplicates'}
                      </button>
                    </div>

                    {/* Rules */}
                    {g.indexes.map((idx, ii) => {
                      const itemKey   = `${cat.brainKey}:${idx}`;
                      const isChecked = selected.has(itemKey);
                      const isKeeper  = keeper === idx;
                      const isMast    = isMasterRule(g.rules[ii]);
                      return (
                        <div key={idx} onClick={() => !isKeeper && toggle(itemKey)} style={{
                          display: 'flex', gap: 14, alignItems: 'flex-start',
                          padding: '12px 14px',
                          borderBottom: ii < g.indexes.length - 1 ? '1px solid #0a0e1a' : 'none',
                          background: isChecked ? '#f8717108' : isKeeper ? (conflict ? '#fbbf2405' : '#34d39904') : 'transparent',
                          cursor: isKeeper ? 'default' : 'pointer',
                          transition: 'background 0.1s',
                        }}>
                          {/* Left indicator */}
                          <div style={{ flexShrink: 0, width: 56, paddingTop: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {isKeeper ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '4px 8px', whiteSpace: 'nowrap',
                                color:      conflict ? '#fbbf24' : '#34d399',
                                background: conflict ? '#fbbf2418' : '#34d39918',
                                border:    `1px solid ${conflict ? '#fbbf2440' : '#34d39940'}`,
                              }}>
                                {conflict ? '●' : '✓'} {conflict ? 'AUTO' : 'KEEP'}
                              </span>
                            ) : (
                              <>
                                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isChecked ? '#f87171' : '#1e293b'}`, background: isChecked ? '#f87171' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s', flexShrink: 0 }}>
                                  {isChecked && <span style={{ color: '#000', fontSize: 11, fontWeight: 900 }}>✕</span>}
                                </div>
                                {(conflict || allMaster) && (
                                  <button onClick={e => { e.stopPropagation(); setGroupKeeper(cat, gi, idx); }} style={{ background: 'transparent', border: `1px solid ${conflict ? '#fbbf2430' : '#60a5fa30'}`, color: conflict ? '#fbbf24' : '#60a5fa', borderRadius: 4, padding: '2px 6px', fontSize: 9, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.4 }}>Keep →</button>
                                )}
                              </>
                            )}
                          </div>

                          {/* Rule content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                              {isMast && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2412', border: '1px solid #fbbf2430', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>👑 master</span>}
                              {!isKeeper && (
                                <span style={{ fontSize: 10, color: isChecked ? '#f87171' : '#334155', fontWeight: isChecked ? 600 : 400 }}>
                                  {isChecked ? '🗑️ marked for deletion' : 'click to mark for deletion'}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, wordBreak: 'break-word',
                              color: isChecked ? '#f8717170' : isKeeper ? '#94a3b8' : '#64748b',
                              textDecoration: isChecked ? 'line-through' : 'none',
                            }}>
                              {g.texts[ii]}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #0f172a', background: '#080b14', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13 }}>
            {conflictCount > 0 && <span style={{ color: '#fbbf24', marginRight: 12 }}>👑 {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} auto-resolved</span>}
            {allMasterCount > 0 && <span style={{ color: '#60a5fa', marginRight: 12 }}>🔒 {allMasterCount} all-admin group{allMasterCount !== 1 ? 's' : ''} untouched</span>}
            <span style={{ color: selected.size > 0 ? '#f87171' : '#334155', fontWeight: selected.size > 0 ? 600 : 400 }}>
              {selected.size > 0 ? `${selected.size} rule${selected.size !== 1 ? 's' : ''} selected for deletion` : 'No rules selected'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={GHOST_BTN}>Cancel</button>
            <button onClick={() => selected.size > 0 && setStep('confirm')} disabled={selected.size === 0} style={{ ...BTN_DANGER, opacity: selected.size === 0 ? 0.3 : 1, cursor: selected.size === 0 ? 'default' : 'pointer', fontSize: 13, padding: '9px 20px' }}>
              Review &amp; delete {selected.size > 0 ? `(${selected.size})` : ''} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared style tokens ───────────────────────────────────────────────────
const OV = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
  backdropFilter: 'blur(6px)', zIndex: 300,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
};
const MB = {
  background: '#080b14', border: '1px solid #141c2e', borderRadius: 16,
  width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.75)', overflow: 'hidden',
};
const H3 = { margin: 0, color: '#e2e8f0', fontSize: 15, fontWeight: 700 };
const SUB = { margin: '2px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.5 };
const GHOST_BTN = {
  background: '#0f172a', border: '1px solid #1e293b', color: '#64748b',
  borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 500,
};
const BTN_GREEN = {
  background: '#34d399', border: 'none', borderRadius: 9, color: '#000',
  padding: '11px 32px', fontWeight: 700, cursor: 'pointer', display: 'inline-block',
};
const BTN_DANGER = {
  background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff',
  padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const X_BTN = {
  background: '#0f172a', border: '1px solid #1e293b', color: '#475569',
  fontSize: 18, cursor: 'pointer', borderRadius: 8, width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const ICON_BOX = (color) => ({
  width: 36, height: 36, borderRadius: 10,
  background: `${color}18`, border: `1px solid ${color}35`,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
});
const CHOICE_CARD = {
  display: 'flex', alignItems: 'flex-start', gap: 14,
  background: '#0d1117', border: '1px solid', borderRadius: 12,
  padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s',
};
const CHOICE_ICON = (color) => ({
  width: 42, height: 42, borderRadius: 10,
  background: `${color}18`, border: `1px solid ${color}30`,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
});


// ─── Brain Drawer ──────────────────────────────────────────────────────────
function BrainDrawer({ brain, open, onClose, onRemoveRule, dirty, onSave, saving, onReconsolidate, onFindDupes, dupeCount }) {
  const totalRules = Object.values(CATEGORY_META).reduce((sum, meta) => sum + (brain[meta.brainKey] || []).length, 0);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity 0.2s', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: '#080b14',
        borderLeft: '1px solid #0f172a',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
        zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #0f172a', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ color: '#34d399', fontSize: 16 }}>⬡</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>Brain Rules</span>
                <span style={{ fontSize: 11, color: '#34d399', background: '#34d39915', borderRadius: 20, padding: '2px 8px', border: '1px solid #34d39930', fontWeight: 600 }}>{totalRules}</span>
                {dupeCount > 0 && (
                  <span onClick={onFindDupes} style={{ fontSize: 11, color: '#f87171', background: '#f8717112', borderRadius: 20, padding: '2px 8px', border: '1px solid #f8717125', fontWeight: 600, cursor: 'pointer' }}>
                    ⚠️ {dupeCount} dupe{dupeCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>Rules trained into the suggestion engine</p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {dirty && <button onClick={onSave} disabled={saving} style={{ background: '#34d399', border: 'none', borderRadius: 7, color: '#000', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving…' : '💾'}</button>}
              <button onClick={onClose} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#475569', fontSize: 16, cursor: 'pointer', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
            <button onClick={onReconsolidate} style={{ flex: 1, background: '#a78bfa12', border: '1px solid #a78bfa30', color: '#a78bfa', borderRadius: 7, padding: '7px 0', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>🔀 Consolidate</button>
            <button onClick={onFindDupes} style={{ flex: 1, background: dupeCount > 0 ? '#f8717112' : '#0d1117', border: `1px solid ${dupeCount > 0 ? '#f8717130' : '#0f172a'}`, color: dupeCount > 0 ? '#f87171' : '#475569', borderRadius: 7, padding: '7px 0', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              🔍 Find Dupes{dupeCount > 0 ? ` (${dupeCount})` : ''}
            </button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 10, color: '#334155', lineHeight: 1.5 }}>
            Dosing numbers (reconstitution volumes, mg/mL, syringe units) live in <code style={{ color: '#475569' }}>lib/product-facts.js</code>, not here. Rules in this drawer never override them.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const rules = brain[meta.brainKey] || [];
            if (!rules.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingBottom: 7, borderBottom: `1px solid ${meta.color}15` }}>
                  <span style={{ fontSize: 12 }}>{meta.icon}</span>
                  <span style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
                  <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>{rules.length} rules</span>
                </div>
                {rules.map((r, i) => {
                  const text = typeof r === 'string' ? r : r.text;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#0d1117', borderRadius: 7, padding: '8px 10px', marginBottom: 4, border: '1px solid #0f172a' }}>
                      <span style={{ flex: 1, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{text}</span>
                      <button onClick={() => onRemoveRule(meta.brainKey, i)}
                        style={{ background: 'none', border: 'none', color: '#1e293b', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, transition: 'color 0.15s' }}
                        onMouseEnter={e => e.target.style.color = '#f87171'}
                        onMouseLeave={e => e.target.style.color = '#1e293b'}
                      >×</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {totalRules === 0 && (
            <div style={{ textAlign: 'center', marginTop: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>⬡</div>
              <p style={{ color: '#1e293b', fontSize: 13 }}>No rules yet.<br />Start chatting to teach the brain.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewModal({ results, onAdd, onClose }) {
  const [selected, setSelected] = useState(() => new Set(results.rules.map((_, i) => i)));
  const toggle = i => setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#080b14', border: '1px solid #0f172a', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>Analysis Complete</h3>
            <span style={{ fontSize: 11, color: '#34d399', background: '#34d39915', borderRadius: 20, padding: '2px 10px', border: '1px solid #34d39930' }}>{results.totalConversations} conversations</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{results.message}. Select the rules to add to the brain.</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 26px' }}>
          {results.rules.map((rule, i) => {
            const meta = CATEGORY_META[rule.category] || CATEGORY_META.prefer;
            const isSel = selected.has(i);
            const isDosing = /reconstitut|bac water|\bmg\s*\/\s*mL\b|\d+\s*units?\b|\bmL\b/i.test(rule.text || '');
            return (
              <div key={i} onClick={() => toggle(i)} style={{ display: 'flex', gap: 12, padding: '11px 13px', borderRadius: 9, marginBottom: 6, background: isSel ? meta.bg : '#0d1117', border: `1px solid ${isSel ? meta.color + '35' : '#0f172a'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSel ? meta.color : '#1e293b'}`, background: isSel ? meta.color : 'transparent', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                  {isSel && <span style={{ color: '#000', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{meta.icon} {meta.label}</span>
                    {rule.confidence === 'high' && <span style={{ fontSize: 10, color: '#34d399', background: '#34d39915', borderRadius: 10, padding: '1px 6px' }}>⚡ high</span>}
                    {isDosing && <span style={{ fontSize: 10, color: '#f87171', background: '#f8717112', border: '1px solid #f8717130', borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>💊 verify numbers</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>{rule.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '16px 26px', borderTop: '1px solid #0f172a', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#334155' }}>{selected.size} of {results.rules.length} selected</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#64748b', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => { onAdd([...selected].map(i => results.rules[i])); onClose(); }} style={{ background: '#34d399', border: 'none', borderRadius: 8, color: '#000', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Add {selected.size} rules →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveToast({ message }) {
  if (!message) return null;
  const isError = message.startsWith('⚠️') || message.startsWith('❌');
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: isError ? '#7f1d1d' : '#166534', color: '#fff',
      padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: `1px solid ${isError ? '#ef444430' : '#22c55e30'}`,
      animation: 'fadeSlideUp 0.2s ease forwards', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function AITraining({ onBrainUpdate }) {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [images, setImages]           = useState([]);
  const [brain, setBrain]             = useState({ ...EMPTY_BRAIN });
  const [dirty, setDirty]             = useState(false);
  const [saving, setSaving]           = useState(false);
  const [typing, setTyping]           = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [activeTab, setActiveTab]     = useState('chat');
  const [analyzeResults, setAnalyzeResults] = useState(null);
  const [analyzing, setAnalyzing]     = useState(false);
  const [interview, setInterview]     = useState(null);
  const [interviewDone, setInterviewDone] = useState(false);
  const [saveToast, setSaveToast]     = useState(null);
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal]   = useState(false);

  const bottomRef    = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef  = useRef(null);
  const textareaRef  = useRef(null);
  const toastTimer   = useRef(null);
  const brainRef     = useRef(brain);

  useEffect(() => { brainRef.current = brain; }, [brain]);

  const dupeGroups = useMemo(() => detectDuplicates(brain), [brain]);
  const dupeCount  = useMemo(
    () => dupeGroups.reduce((s, c) => s + c.groups.reduce((ss, g) => ss + g.indexes.length - 1, 0), 0),
    [dupeGroups]
  );

  const showToast = useCallback((msg, duration = 3500) => {
    setSaveToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSaveToast(null), duration);
  }, []);

  useEffect(() => {
    apiFetch('/ai/training/brain')
      .then(d => {
        if (d.brain) {
          const loaded = { ...EMPTY_BRAIN, ...d.brain };
          setBrain(loaded);
          brainRef.current = loaded;
        }
      })
      .catch(() => {});
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing, interview]);

  // NOTE: this PUTs the ENTIRE brain object from a React snapshot. If someone else
  // (or a DB migration) changed the brain since this page loaded, that change is
  // overwritten. It is why dosing numbers now live in lib/product-facts.js, out of
  // reach of this autosave.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      try {
        await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
        setDirty(false);
        onBrainUpdate?.();
      } catch { /* silent */ }
    }, 4000);
    return () => clearTimeout(timer);
  }, [brain, dirty]);

  const addRule = useCallback((rule) => {
    const meta = CATEGORY_META[rule.category];
    if (!meta) return;
    setBrain(prev => {
      const list = prev[meta.brainKey] || [];
      const ruleText = typeof rule === 'string' ? rule : rule.text;
      const already = list.some(r => (typeof r === 'string' ? r : r.text) === ruleText);
      if (already) return prev;
      const next = { ...prev, [meta.brainKey]: [...list, { text: ruleText, source: rule.source || 'admin' }] };
      brainRef.current = next;
      return next;
    });
    setDirty(true);
  }, []);

  const addRules = useCallback((rules) => { rules.forEach(addRule); }, [addRule]);

  const removeRule = useCallback(async (brainKey, index) => {
    setBrain(prev => {
      const list = [...(prev[brainKey] || [])];
      list.splice(index, 1);
      const next = { ...prev, [brainKey]: list };
      brainRef.current = next;
      return next;
    });
    await new Promise(r => setTimeout(r, 50));
    try {
      await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
      setDirty(false); onBrainUpdate?.(); showToast('🗑️ Rule removed');
    } catch (e) { showToast(`❌ Failed to remove rule: ${e.message}`); }
  }, [onBrainUpdate, showToast]);

  const bulkDeleteByKey = useCallback(async (byKey) => {
    setBrain(prev => {
      const next = { ...prev };
      for (const [brainKey, indexes] of Object.entries(byKey)) {
        const list = [...(prev[brainKey] || [])];
        [...indexes].sort((a, b) => b - a).forEach(idx => list.splice(idx, 1));
        next[brainKey] = list;
      }
      brainRef.current = next;
      return next;
    });
    await new Promise(r => setTimeout(r, 50));
    try {
      await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
      setDirty(false); onBrainUpdate?.();
      const total = Object.values(byKey).reduce((s, arr) => s + arr.length, 0);
      showToast(`🗑️ ${total} duplicate rule${total !== 1 ? 's' : ''} deleted`);
    } catch (e) { showToast(`❌ Failed to delete duplicates: ${e.message}`); }
  }, [onBrainUpdate, showToast]);

  const saveBrain = useCallback(async () => {
    setSaving(true);
    try {
      await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
      setDirty(false); onBrainUpdate?.();
      if (brainRef.current.suggestionSettings) {
        try { localStorage.setItem('brain_suggestion_settings', JSON.stringify(brainRef.current.suggestionSettings)); } catch {}
      }
      addSystemMessage('✅ Brain saved — all future suggestions will use these rules.');
    } catch (e) { addSystemMessage(`❌ Save failed: ${e.message}`); }
    finally { setSaving(false); }
  }, [onBrainUpdate]);

  const handleConsolidateDone = useCallback(async () => {
    try {
      const fresh = await apiFetch('/ai/training/brain');
      if (fresh.brain) {
        const loaded = { ...EMPTY_BRAIN, ...fresh.brain };
        setBrain(loaded); brainRef.current = loaded;
      }
      setDirty(false); onBrainUpdate?.();
      addSystemMessage('🔀 Brain rules have been consolidated — merged and deduplicated. Spot-check any merged product rules before relying on them.');
    } catch { /* silent */ }
  }, [onBrainUpdate]);

  function addSystemMessage(text) {
    setMessages(prev => [...prev, { id: Date.now(), role: 'system', content: text, time: nowTime() }]);
  }

  const handleImageFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
        setImages(prev => [...prev, { base64, type: 'image/jpeg', name: file.name }]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) { e.preventDefault(); handleImageFile(item.getAsFile()); }
    }
  }, [handleImageFile]);

  const send = useCallback(async (text, interviewCtx = null) => {
    const msgText = text || input.trim();
    if (!msgText && images.length === 0) return;

    let finalMsg = msgText;
    if (/bad suggestion|flagged|thumbs down|review bad/i.test(msgText)) {
      try {
        const bad = JSON.parse(localStorage.getItem('bad_suggestions') || '[]');
        if (bad.length > 0) {
          finalMsg += `\n\n[FLAGGED BAD SUGGESTIONS — ${bad.length} total]\n` +
            bad.slice(0, 10).map((b, i) =>
              `${i + 1}. Customer said: "${(b.customerMessage || '?').slice(0, 120)}"\n   Bad suggestion was: "${(b.suggestion || '').slice(0, 200)}"`
            ).join('\n\n') +
            `\n\nPlease analyze what's wrong with these suggestions and extract rules to prevent these patterns.`;
          localStorage.removeItem('bad_suggestions');
        } else { finalMsg += '\n\n[No flagged suggestions found yet.]'; }
      } catch {}
    }

    const userMsg = { id: Date.now(), role: 'user', content: msgText, images: [...images], time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); setImages([]); setTyping(true);

    const history = messages.slice(-14).map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content || '' }));

    try {
      const data = await apiFetch('/ai/training/chat', {
        method: 'POST',
        body: JSON.stringify({ message: finalMsg, images: userMsg.images, history, brain: brainRef.current, interviewContext: interviewCtx }),
      });

      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai', content: data.message,
        type: data.type, ruleUpdates: data.ruleUpdates || [],
        nextQuestion: data.nextQuestion, time: nowTime(),
      }]);

      try {
        const fresh = await apiFetch('/ai/training/brain');
        if (fresh.brain) {
          const loaded = { ...EMPTY_BRAIN, ...fresh.brain };
          setBrain(loaded); brainRef.current = loaded;
        }
        if (data.ruleUpdates?.length > 0) {
          const dosing = data.ruleUpdates.filter(r => /reconstitut|bac water|\bmg\s*\/\s*mL\b|\d+\s*units?\b|\bmL\b/i.test(r.text || ''));
          showToast(`✅ ${data.ruleUpdates.length} rule${data.ruleUpdates.length > 1 ? 's' : ''} saved to brain`);
          if (dosing.length > 0) {
            addSystemMessage(`💊 ${dosing.length} of those contain doses or volumes. These were rewritten by the extractor, not saved verbatim — open the Brain drawer and check every number against what you actually wrote.`);
          }
        }
      } catch { /* silent */ }

      setDirty(false); onBrainUpdate?.();
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'system', content: `Error: ${e.message}`, time: nowTime() }]);
    } finally { setTyping(false); }
  }, [input, images, messages, showToast, onBrainUpdate]);

  const handleDocFileWithSend = useCallback(async (file) => {
    const allowed = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
      addSystemMessage(`❌ Unsupported file type: ${file.name}`); return;
    }
    const formData = new FormData();
    formData.append('file', file);
    addSystemMessage(`📄 Reading "${file.name}"…`);
    try {
      const uploadRes = await fetch(`${API_BASE}/ai/training/upload-doc`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
      if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
      const uploadData = await uploadRes.json();
      addSystemMessage(`✅ "${file.name}" read — ${uploadData.chars.toLocaleString()} chars. Extracting rules…`);
      const extractRes = await fetch(`${API_BASE}/ai/training/extract-rules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text: uploadData.text.slice(0, 30000), filename: file.name }),
      });
      if (!extractRes.ok) throw new Error(`Extraction failed: HTTP ${extractRes.status}`);
      const extractData = await extractRes.json();
      if (extractData.rules?.length > 0) {
        try {
          const fresh = await apiFetch('/ai/training/brain');
          if (fresh.brain) { const loaded = { ...EMPTY_BRAIN, ...fresh.brain }; setBrain(loaded); brainRef.current = loaded; }
        } catch { /* silent */ }
        setDirty(false); onBrainUpdate?.();
        showToast(`✅ ${extractData.rules.length} rules extracted from "${file.name}" and saved`);
        addSystemMessage(`🧠 ${extractData.rules.length} rules extracted from "${file.name}" and saved to brain.`);

        const dosing = extractData.rules.filter(r => /reconstitut|bac water|\bmg\s*\/\s*mL\b|\d+\s*units?\b|\bmL\b/i.test(r.text || ''));
        if (dosing.length > 0) {
          addSystemMessage(`💊 ${dosing.length} extracted rule${dosing.length !== 1 ? 's contain' : ' contains'} doses or volumes. Extraction paraphrases — a dropped decimal is a dosing error. Verify each number in the Brain drawer, or put it in lib/product-facts.js instead.`);
        }

        setMessages(prev => [...prev, {
          id: Date.now(), role: 'ai',
          content: extractData.summary || `I've extracted ${extractData.rules.length} rules from **${file.name}** and saved them directly to the brain. They're active now.`,
          type: 'training', ruleUpdates: extractData.rules, time: nowTime(),
        }]);
      } else {
        addSystemMessage(`⚠️ No rules could be extracted from "${file.name}". Try a more structured document.`);
      }
    } catch (e) { addSystemMessage(`❌ Failed to process "${file.name}": ${e.message}`); }
  }, [onBrainUpdate, showToast]);

  const answerInterviewQuestion = useCallback(async (question, answer) => {
    const nextIndex = (interview?.currentIndex ?? 0) + 1;
    const questions = interview?.questions || [];
    await send(`(Interview question: "${question.text}")\n\nMy answer: ${answer}`, { questionText: question.text, hint: question.hint });
    if (nextIndex >= questions.length) {
      setInterview(null); setInterviewDone(true);
      addSystemMessage('✅ Interview complete! All answers have been learned.');
    } else {
      setInterview(prev => ({ ...prev, currentIndex: nextIndex }));
    }
  }, [interview, send]);

  const runAutoAnalyze = useCallback(async () => {
    setAnalyzing(true);
    addSystemMessage('🔍 Analyzing past conversations… this may take a minute.');
    try {
      const data = await apiFetch('/ai/training/auto-analyze', { method: 'POST', body: JSON.stringify({ limit: 300, batchSize: 15 }) });
      setAnalyzeResults(data);
      if (data.gaps?.length > 0) {
        addSystemMessage(`Found ${data.rules.length} patterns and ${data.gaps.length} gaps. Generating interview questions…`);
        try {
          const qData = await apiFetch('/ai/training/proactive-questions', { method: 'POST', body: JSON.stringify({ gaps: data.gaps, rules: data.rules, brain: brainRef.current }) });
          if (qData.questions?.length > 0) {
            setMessages(prev => [...prev, { id: Date.now(), role: 'ai', content: qData.intro || 'I found some gaps in your conversations. Let me ask you a few questions.', type: 'answer', ruleUpdates: [], time: nowTime() }]);
            setInterview({ questions: qData.questions, currentIndex: 0 });
          }
        } catch {}
      }
    } catch (e) { addSystemMessage(`❌ Analysis failed: ${e.message}`); }
    finally { setAnalyzing(false); }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  function handleSend() {
    const msg = input.trim();
    if (!msg && !images.length) return;
    if (/analyz|past conv|all conv|extract rules|auto.?analyz/i.test(msg) && !analyzing) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: msg, time: nowTime() }]);
      setInput('');
      runAutoAnalyze();
    } else {
      send();
    }
  }

  const currentQuestion = interview && !interviewDone ? interview.questions[interview.currentIndex] : null;
  const ruleCount = Object.values(CATEGORY_META).reduce((sum, meta) => sum + (brain[meta.brainKey]?.length || 0), 0);
  const showStarters = messages.length === 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes tdBounce { 0%,80%,100%{transform:translateY(0);opacity:0.3}40%{transform:translateY(-5px);opacity:1} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-green { 0%,100%{box-shadow:0 0 0 0 #34d39930}50%{box-shadow:0 0 0 6px #34d39908} }
        .at-msg{animation:fadeSlideUp 0.2s ease forwards}
        .at-starter:hover{background:#0f172a!important;border-color:#34d39950!important;color:#34d399!important;transform:translateY(-1px)}
        .at-starter{transition:all 0.15s!important}
        .at-send:hover:not(:disabled){background:#2dd4bf!important;transform:translateY(-1px)}
        .at-send{transition:all 0.15s!important}
        .at-tab:hover{color:#94a3b8!important}
        .at-tab{transition:all 0.15s!important}
        .at-img-btn:hover{border-color:#34d39960!important;color:#34d399!important}
        .at-img-btn{transition:all 0.15s!important}
        .at-analyze:hover:not(:disabled){opacity:0.85!important}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
      `}</style>

      <div
        style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080b14', color: '#e2e8f0', fontFamily: "'DM Sans', sans-serif", position: 'relative' }}
        onDrop={e => { e.preventDefault(); [...(e.dataTransfer?.files || [])].forEach(f => { if (f.type.startsWith('image/')) handleImageFile(f); else handleDocFileWithSend(f); }); }}
        onDragOver={e => e.preventDefault()}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #0f172a', height: 56, flexShrink: 0, background: '#080b14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#34d399', flexShrink: 0 }}>⬡</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>Brain AI</span>
                <span style={{ fontSize: 11, color: '#34d399', background: '#34d39912', borderRadius: 20, padding: '1px 8px', border: '1px solid #34d39925', fontWeight: 600 }}>{ruleCount} rules</span>
                {dirty && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2410', borderRadius: 20, padding: '1px 8px', border: '1px solid #fbbf2425', fontWeight: 600 }}>● unsaved</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {['chat', 'settings'].map(tab => (
              <button key={tab} className="at-tab" onClick={() => setActiveTab(tab)} style={{
                background: activeTab === tab ? '#0f172a' : 'none',
                border: `1px solid ${activeTab === tab ? '#1e293b' : 'transparent'}`,
                color: activeTab === tab ? '#e2e8f0' : '#334155',
                borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400,
              }}>{tab === 'settings' ? '⚙️ Quality' : '💬 Chat'}</button>
            ))}
            <div style={{ width: 1, height: 20, background: '#0f172a', margin: '0 2px' }} />
            <button onClick={() => setDrawerOpen(true)} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#64748b', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>🧠 Brain</button>
            <button
              onClick={() => setShowConsolidateModal(true)}
              title="AI merges and deduplicates brain rules — with interactive review"
              style={{ background: '#a78bfa12', border: '1px solid #a78bfa30', color: '#a78bfa', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
            >🔀 Consolidate</button>
            <button
              onClick={() => setShowDuplicatesModal(true)}
              title="Scan for duplicate rules and delete them"
              style={{ background: dupeCount > 0 ? '#f8717112' : '#0f172a', border: '1px solid #1e293b', color: dupeCount > 0 ? '#f87171' : '#64748b', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
            >🔍 Dupes{dupeCount > 0 ? ` (${dupeCount})` : ''}</button>
            <button className="at-analyze" onClick={runAutoAnalyze} disabled={analyzing} style={{
              background: analyzing ? '#0f172a' : '#34d39912', border: `1px solid ${analyzing ? '#1e293b' : '#34d39935'}`,
              color: analyzing ? '#334155' : '#34d399', borderRadius: 7, padding: '5px 12px', fontSize: 12,
              cursor: analyzing ? 'wait' : 'pointer', fontWeight: 500,
            }}>{analyzing ? '⏳ Analyzing…' : '🔍 Analyze'}</button>
            {dirty && <button onClick={saveBrain} disabled={saving} style={{ background: '#34d399', border: 'none', borderRadius: 7, color: '#000', padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving…' : '💾 Save'}</button>}
          </div>
        </div>

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ padding: '28px 28px 0' }}>
                <h4 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>Suggestion Quality</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>Controls how the AI generates replies for all agents</p>
              </div>
              <SettingsPanel
                settings={brain.suggestionSettings}
                onChange={settings => {
                  setBrain(prev => { const next = { ...prev, suggestionSettings: settings }; brainRef.current = next; return next; });
                  setDirty(true);
                }}
              />
              {dirty && (
                <div style={{ padding: '0 28px 28px' }}>
                  <button onClick={saveBrain} disabled={saving} style={{ background: '#34d399', border: 'none', borderRadius: 9, color: '#000', padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                    {saving ? 'Saving…' : '💾 Save changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat tab */}
        {activeTab === 'chat' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0' }}>
              {showStarters && (
                <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#34d399', animation: 'pulse-green 3s ease-in-out infinite' }}>⬡</div>
                    <h3 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>Brain AI</h3>
                    <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>What do you want to teach me today?</p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
                    {STARTERS.map((s, i) => (
                      <button key={i} className="at-starter" onClick={() => send(s.text)} style={{ background: '#0d1117', border: '1px solid #0f172a', color: '#475569', borderRadius: 22, padding: '7px 16px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{s.icon}</span><span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>
                    💊 Doses, reconstitution volumes, and unit conversions belong in <code style={{ color: '#475569' }}>lib/product-facts.js</code>. Anything taught here gets paraphrased by the extractor, and a paraphrased decimal is a dosing error.
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.role === 'system') return (
                  <div key={msg.id} className="at-msg" style={{ textAlign: 'center', margin: '12px 0' }}>
                    <span style={{ fontSize: 11, color: '#334155', background: '#0d1117', borderRadius: 20, padding: '4px 14px', border: '1px solid #0f172a', display: 'inline-block' }}>{msg.content}</span>
                  </div>
                );
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className="at-msg" style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
                    {!isUser && (
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, color: '#34d399' }}>⬡</div>
                    )}
                    <div style={{ maxWidth: '74%' }}>
                      <div style={{ background: isUser ? '#0f172a' : '#0d1117', borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px', padding: '11px 15px', border: `1px solid ${isUser ? '#1e293b' : '#0f172a'}` }}>
                        {msg.images?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {msg.images.map((img, i) => <img key={i} src={`data:${img.type};base64,${img.base64}`} alt="" style={{ maxWidth: 220, maxHeight: 180, borderRadius: 8, border: '1px solid #1e293b' }} />)}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: isUser ? '#cbd5e1' : '#94a3b8' }}>
                          <MessageText text={msg.content} />
                        </p>
                      </div>
                      {msg.ruleUpdates?.length > 0 && msg.type === 'mixed' && (
                        <div style={{ marginTop: 8 }}>
                          {msg.ruleUpdates.map((rule, i) => <RuleChip key={i} rule={rule} onAdd={addRule} />)}
                        </div>
                      )}
                      {msg.ruleUpdates?.length > 0 && (msg.type === 'training' || msg.type === 'mixed') && (
                        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                          <span style={{ fontSize: 11, color: '#34d39980' }}>{msg.ruleUpdates.length} rule{msg.ruleUpdates.length > 1 ? 's' : ''} saved to brain</span>
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#1e293b', marginTop: 5, paddingLeft: 2 }}>{msg.time}</div>
                    </div>
                  </div>
                );
              })}

              {typing && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#34d399' }}>⬡</div>
                  <div style={{ background: '#0d1117', borderRadius: '4px 14px 14px 14px', padding: '12px 16px', border: '1px solid #0f172a' }}>
                    <TypingDots />
                  </div>
                </div>
              )}

              {currentQuestion && (
                <InterviewCard
                  question={currentQuestion}
                  index={interview.currentIndex}
                  total={interview.questions.length}
                  onAnswer={answerInterviewQuestion}
                  onSkip={() => {
                    const nextIndex = interview.currentIndex + 1;
                    if (nextIndex >= interview.questions.length) { setInterview(null); setInterviewDone(true); }
                    else setInterview(prev => ({ ...prev, currentIndex: nextIndex }));
                  }}
                />
              )}

              <div ref={bottomRef} style={{ height: 20 }} />
            </div>

            {/* Input area */}
            <div style={{ borderTop: '1px solid #0f172a', background: '#080b14', flexShrink: 0 }}>
              <ImagePreview images={images} onRemove={i => setImages(prev => prev.filter((_, j) => j !== i))} />
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', alignItems: 'flex-end' }}>
                <button className="at-img-btn" onClick={() => fileInputRef.current?.click()} title="Attach screenshot" style={{ background: '#0d1117', border: '1px solid #0f172a', color: '#334155', borderRadius: 9, padding: '9px 11px', fontSize: 15, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>🖼️</button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { [...e.target.files].forEach(handleImageFile); e.target.value = ''; }} />
                <button className="at-img-btn" onClick={() => docInputRef.current?.click()} title="Upload document (PDF, TXT, DOCX)" style={{ background: '#0d1117', border: '1px solid #0f172a', color: '#334155', borderRadius: 9, padding: '9px 11px', fontSize: 15, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>📄</button>
                <input ref={docInputRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleDocFileWithSend(e.target.files[0]); e.target.value = ''; }} />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  onPaste={handlePaste}
                  placeholder="Teach the brain, ask a question, or paste a screenshot…"
                  rows={1}
                  style={{ flex: 1, background: '#0d1117', border: '1px solid #0f172a', borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif", minHeight: 42, maxHeight: 140 }}
                  onFocus={e => e.target.style.borderColor = '#34d39940'}
                  onBlur={e => e.target.style.borderColor = '#0f172a'}
                />
                <button className="at-send" onClick={handleSend} disabled={typing || (!input.trim() && !images.length)} style={{
                  background: '#34d399', border: 'none', borderRadius: 9, color: '#000', fontWeight: 700, fontSize: 15,
                  width: 42, height: 42, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: (typing || (!input.trim() && !images.length)) ? 0.25 : 1,
                }}>↑</button>
              </div>
              <p style={{ fontSize: 10, color: '#0f172a', textAlign: 'center', margin: '0 0 10px', letterSpacing: '0.02em' }}>
                Ctrl+V to paste screenshots · Drag &amp; drop images or docs · 📄 PDF / TXT / DOCX · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>

      <BrainDrawer
        brain={brain} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        onRemoveRule={removeRule} dirty={dirty} onSave={saveBrain} saving={saving}
        dupeCount={dupeCount}
        onReconsolidate={() => { setDrawerOpen(false); setShowConsolidateModal(true); }}
        onFindDupes={() => { setDrawerOpen(false); setShowDuplicatesModal(true); }}
      />

      {analyzeResults && (
        <ReviewModal results={analyzeResults} onAdd={rules => { addRules(rules); setAnalyzeResults(null); }} onClose={() => setAnalyzeResults(null)} />
      )}

      {showConsolidateModal && (
        <ConsolidatePreviewModal
          onClose={() => setShowConsolidateModal(false)}
          onDone={handleConsolidateDone}
          showToast={showToast}
        />
      )}

      {showDuplicatesModal && (
        <DuplicatesModal
          brain={brain} dupeGroups={dupeGroups}
          onDeleteIndexes={bulkDeleteByKey}
          onClose={() => setShowDuplicatesModal(false)}
        />
      )}

      <SaveToast message={saveToast} />
    </>
  );
}

































// import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// const API_BASE = (import.meta.env.PROD
//   ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
//   : '') + '/api';

// const CATEGORY_META = {
//   tone:    { color: '#60a5fa', label: 'Tone',    icon: '🎙️', brainKey: 'toneRules',        bg: '#60a5fa12' },
//   avoid:   { color: '#f87171', label: 'Avoid',   icon: '🚫', brainKey: 'avoidPatterns',    bg: '#f8717112' },
//   prefer:  { color: '#34d399', label: 'Prefer',  icon: '✅', brainKey: 'preferPatterns',   bg: '#34d39912' },
//   product: { color: '#fbbf24', label: 'Product', icon: '💊', brainKey: 'productKnowledge', bg: '#fbbf2412' },
//   policy:  { color: '#a78bfa', label: 'Policy',  icon: '📋', brainKey: 'customPolicies',   bg: '#a78bfa12' },
//   example: { color: '#2dd4bf', label: 'Example', icon: '⭐', brainKey: 'responseExamples', bg: '#2dd4bf12' },
// };

// const EMPTY_BRAIN = {
//   toneRules: [], avoidPatterns: [], preferPatterns: [],
//   productKnowledge: [], customPolicies: [], responseExamples: [],
//   suggestionSettings: { length: 'medium', tone: 'friendly-professional', empathy: 'high' },
// };

// const STARTERS = [
//   { label: 'Analyze conversations', icon: '📊', text: 'Analyze all our past conversations and find patterns.' },
//   { label: 'What do you know?',     icon: '🧠', text: 'What rules do you currently have? Summarize what you know about our business.' },
//   { label: 'Peptide knowledge',     icon: '💊', text: 'What do you know about our peptide products and how agents should explain them?' },
//   { label: 'Teach a rule',          icon: '✍️', text: 'Agents should always mention that our peptides come with BAC water included.' },
//   { label: 'Review screenshot',     icon: '🖼️', text: 'I\'ll share a screenshot of a bad suggestion so you can learn from it.' },
//   { label: 'Suggestion length',     icon: '📏', text: 'The suggestions are too short. I want longer, more detailed replies like a real support expert would write.' },
//   { label: 'Review bad suggestions',icon: '👎', text: 'I have flagged some bad suggestions. Let\'s review them and improve.' },
//   { label: 'Upload a document',     icon: '📄', text: 'I\'ll upload a document (PDF, TXT, or DOCX) for you to learn from.' },
// ];

// function getToken() { return localStorage.getItem('token') || ''; }

// async function apiFetch(path, opts = {}) {
//   const res = await fetch(`${API_BASE}${path}`, {
//     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
//     ...opts,
//   });
//   if (!res.ok) {
//     const body = await res.text().catch(() => '');
//     throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
//   }
//   return res.json();
// }

// function nowTime() {
//   return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// }

// function mergeBrainRules(brain, ruleUpdates) {
//   const updated = { ...brain };
//   ruleUpdates.forEach(rule => {
//     const meta = CATEGORY_META[rule.category];
//     if (!meta) return;
//     const key = meta.brainKey;
//     const existing = updated[key] ? [...updated[key]] : [];
//     const exists = existing.some(r => (r.text || r) === rule.text);
//     if (!exists) existing.push({ text: rule.text, source: rule.source || 'admin-chat' });
//     updated[key] = existing;
//   });
//   return updated;
// }

// // ─── Duplicate detection ───────────────────────────────────────────────────
// const DUPE_THRESHOLD = 0.45;

// const PRODUCT_NAMES = [
//   '5-amino-1mq','adipotide','aicar','ara-290',
//   'bpc-157','bpc157','cagrilintide','cerebrolysin',
//   'cjc-1295','cjc1295','dsip','epithalon','epitalon','epo',
//   'follistatin','ghk-cu','ghk','ghrp-2','ghrp-6','ghrp','glp-1',
//   'gonadorelin','hcg','hexarelin',
//   'hgh fragment 176-191','hgh fragment','hgh','hmg','hyaluronic',
//   'igf-des','igf-1','igf','ipamorelin','kisspeptin','klow','kpv',
//   'lipo-c','mgf','mots-c','motsc','nad+','nad','oxytocin',
//   'peg-mgf','pinealon','pt-141','pt141','retatrutide',
//   'selank','semax','semaglutide','sermorelin','slu-pp-332',
//   'ss-31','elamipretide','survodutide','tb-500','tb500',
//   'tesamorelin','thymalin','tirzepatide','triptorelin','vip',
//   'wolverine','glow blend',
// ];

// const PRODUCT_NAMES_SORTED = [...PRODUCT_NAMES].sort((a, b) => b.length - a.length);

// function extractProductName(text) {
//   const lower = (text || '').toLowerCase();
//   for (const name of PRODUCT_NAMES_SORTED) {
//     if (lower.slice(0, 120).includes(name)) return name;
//   }
//   return null;
// }

// function tokenize(text) {
//   return new Set(
//     (text || '').toLowerCase()
//       .replace(/[^a-z0-9\s]/g, ' ')
//       .split(/\s+/)
//       .filter(w => w.length > 2)
//   );
// }

// function jaccardSimFast(prodA, prodB, setA, setB) {
//   if (prodA && prodB && prodA !== prodB) return 0;
//   if (!setA.size && !setB.size) return 1;
//   if (!setA.size || !setB.size) return 0;
//   let inter = 0;
//   for (const t of setA) if (setB.has(t)) inter++;
//   return inter / (setA.size + setB.size - inter);
// }

// function isExplicitMaster(rule) {
//   const text = (typeof rule === 'string' ? rule : rule?.text || '').trimStart();
//   return /^MASTER RULE\s*[—–\-]/i.test(text);
// }

// function isMasterRule(rule) {
//   if (!rule) return false;
//   if (isExplicitMaster(rule)) return true;
//   const src = (typeof rule === 'string' ? '' : rule.source || '').toLowerCase().trim();
//   return [
//     // backend-golden sources (must match normaliseRule in brain-context.js)
//     'admin-feedback',
//     'admin-upload',
//     'admin-training',
//     'admin-consolidation-audit',
//     'admin-chat',
//     // frontend-only authored markers
//     'admin',
//     'manual',
//     '',
//   ].includes(src);
// }

// function detectDuplicates(brain) {
//   const result = [];
//   for (const [cat, meta] of Object.entries(CATEGORY_META)) {
//     const rules = brain[meta.brainKey] || [];
//     const texts = rules.map(r => (typeof r === 'string' ? r : r.text) || '');
//     if (texts.length < 2) continue;
//     const tokenSets    = texts.map(t => tokenize(t));
//     const productNames = texts.map(t => extractProductName(t));
//     const visited = new Set();
//     const groups = [];
//     for (let i = 0; i < texts.length; i++) {
//       if (visited.has(i)) continue;
//       const group = [i];
//       for (let j = i + 1; j < texts.length; j++) {
//         if (visited.has(j)) continue;
//         if (jaccardSimFast(productNames[i], productNames[j], tokenSets[i], tokenSets[j]) >= DUPE_THRESHOLD) {
//           group.push(j); visited.add(j);
//         }
//       }
//       if (group.length > 1) {
//         visited.add(i);
//         groups.push({ indexes: group, texts: group.map(idx => texts[idx]), rules: group.map(idx => rules[idx]) });
//       }
//     }
//     if (groups.length > 0) {
//       result.push({ brainKey: meta.brainKey, cat, color: meta.color, icon: meta.icon, label: meta.label, groups });
//     }
//   }
//   return result;
// }


// // ─── Small components ─────────────────────────────────────────────────────
// function TypingDots({ color = '#34d399' }) {
//   return (
//     <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
//       {[0, 1, 2].map(i => (
//         <span key={i} style={{
//           width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block',
//           animation: 'tdBounce 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s`,
//         }} />
//       ))}
//     </div>
//   );
// }

// function MessageText({ text }) {
//   if (!text) return null;
//   const parts = text.split(/(\*\*[^*]+\*\*)/g);
//   return (
//     <span>
//       {parts.map((part, i) => {
//         if (part.startsWith('**') && part.endsWith('**'))
//           return <strong key={i} style={{ color: '#e2e8f0', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
//         return part.split('\n').map((line, j, arr) => (
//           <span key={`${i}-${j}`}>{line}{j < arr.length - 1 ? <br /> : null}</span>
//         ));
//       })}
//     </span>
//   );
// }

// function RuleChip({ rule, onAdd }) {
//   const [added, setAdded] = useState(false);
//   const meta = CATEGORY_META[rule.category] || CATEGORY_META.prefer;
//   return (
//     <div style={{
//       display: 'flex', alignItems: 'flex-start', gap: 10,
//       background: meta.bg, border: `1px solid ${meta.color}25`,
//       borderLeft: `3px solid ${meta.color}`,
//       borderRadius: 8, padding: '10px 12px', marginTop: 8, fontSize: 12,
//     }}>
//       <span style={{ fontSize: 13, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
//       <div style={{ flex: 1, minWidth: 0 }}>
//         <span style={{ color: meta.color, fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{meta.label}</span>
//         <p style={{ margin: '0 0 8px', color: '#94a3b8', lineHeight: 1.5, fontSize: 12 }}>{rule.text}</p>
//         <button onClick={() => { onAdd(rule); setAdded(true); }} disabled={added} style={{
//           background: added ? `${meta.color}20` : 'transparent',
//           border: `1px solid ${meta.color}${added ? '60' : '40'}`,
//           color: added ? meta.color : `${meta.color}cc`,
//           borderRadius: 5, padding: '3px 10px', fontSize: 11,
//           cursor: added ? 'default' : 'pointer', fontWeight: 600,
//         }}>
//           {added ? '✓ Added' : '+ Add to brain'}
//         </button>
//       </div>
//     </div>
//   );
// }

// function ImagePreview({ images, onRemove }) {
//   if (!images.length) return null;
//   return (
//     <div style={{ display: 'flex', gap: 8, padding: '10px 16px 0', flexWrap: 'wrap' }}>
//       {images.map((img, i) => (
//         <div key={i} style={{ position: 'relative' }}>
//           <img src={`data:${img.type};base64,${img.base64}`} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #1e293b' }} />
//           <button onClick={() => onRemove(i)} style={{
//             position: 'absolute', top: -5, right: -5, width: 18, height: 18,
//             borderRadius: '50%', background: '#f87171', border: '2px solid #080b14',
//             color: '#fff', fontSize: 10, cursor: 'pointer', padding: 0,
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//           }}>×</button>
//         </div>
//       ))}
//     </div>
//   );
// }

// function InterviewCard({ question, index, total, onAnswer, onSkip }) {
//   const [custom, setCustom] = useState('');
//   const meta = CATEGORY_META[question.category] || CATEGORY_META.product;
//   return (
//     <div style={{
//       background: '#0d1117', border: `1px solid ${meta.color}30`,
//       borderLeft: `3px solid ${meta.color}`,
//       borderRadius: 12, padding: '18px 20px', margin: '16px 0',
//     }}>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//           <span style={{ fontSize: 13 }}>{meta.icon}</span>
//           <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
//           <span style={{ fontSize: 10, color: '#334155', fontWeight: 500 }}>{index + 1} / {total}</span>
//         </div>
//         <button onClick={onSkip} style={{ background: 'none', border: '1px solid #1e293b', color: '#475569', fontSize: 11, cursor: 'pointer', borderRadius: 5, padding: '3px 10px' }}>Skip →</button>
//       </div>
//       <p style={{ color: '#cbd5e1', fontSize: 14, margin: '0 0 8px', lineHeight: 1.6, fontWeight: 500 }}>{question.text}</p>
//       {question.hint && (
//         <p style={{ fontSize: 11, color: '#475569', margin: '0 0 14px', fontStyle: 'italic', lineHeight: 1.5 }}>💡 {question.hint}</p>
//       )}
//       {question.quickReplies?.length > 0 && (
//         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
//           {question.quickReplies.map((qr, i) => (
//             <button key={i} onClick={() => onAnswer(question, qr)} style={{
//               background: '#0f172a', border: `1px solid ${meta.color}30`,
//               color: '#94a3b8', borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
//             }}>{qr}</button>
//           ))}
//         </div>
//       )}
//       <div style={{ display: 'flex', gap: 8 }}>
//         <input
//           value={custom}
//           onChange={e => setCustom(e.target.value)}
//           onKeyDown={e => e.key === 'Enter' && custom.trim() && (onAnswer(question, custom), setCustom(''))}
//           placeholder="Type your answer…"
//           style={{ flex: 1, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' }}
//         />
//         <button onClick={() => { if (custom.trim()) { onAnswer(question, custom); setCustom(''); } }} style={{
//           background: meta.color, border: 'none', borderRadius: 8, color: '#000',
//           padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
//         }}>Send</button>
//       </div>
//     </div>
//   );
// }

// function SettingsPanel({ settings, onChange }) {
//   const s = settings || { length: 'medium', tone: 'friendly-professional', empathy: 'high' };
//   const descriptions = {
//     length: { short: '1–2 sentences · Direct and fast', medium: '2–4 sentences · Balanced default', long: '4–6 sentences · Expert-level detail' },
//     tone: { formal: 'Professional language · No contractions', 'friendly-professional': 'Warm but polished · Best for most cases', casual: 'Conversational · Like a helpful colleague' },
//     empathy: { low: 'Skip preambles · Get straight to solution', medium: 'Brief acknowledgment · Then solution', high: 'Lead with empathy · Always acknowledge first' },
//   };
//   const Section = ({ label, keyName, options }) => (
//     <div style={{ marginBottom: 24 }}>
//       <label style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10, fontWeight: 600 }}>{label}</label>
//       <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
//         {options.map(opt => {
//           const active = s[keyName] === opt.value;
//           return (
//             <button key={opt.value} onClick={() => onChange({ ...s, [keyName]: opt.value })} style={{
//               background: active ? '#34d39915' : '#0f172a', border: `1px solid ${active ? '#34d399' : '#1e293b'}`,
//               color: active ? '#34d399' : '#64748b', borderRadius: 8, padding: '7px 16px', fontSize: 12,
//               cursor: 'pointer', fontWeight: active ? 700 : 400, flex: 1,
//             }}>{opt.label}</button>
//           );
//         })}
//       </div>
//       <p style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.5 }}>{descriptions[keyName][s[keyName]]}</p>
//     </div>
//   );
//   return (
//     <div style={{ padding: '24px 28px' }}>
//       <p style={{ fontSize: 12, color: '#334155', margin: '0 0 24px', lineHeight: 1.6 }}>
//         These settings control how the AI generates replies for all agents across all conversations.
//       </p>
//       <Section label="Reply Length" keyName="length" options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]} />
//       <Section label="Tone" keyName="tone" options={[{ value: 'formal', label: 'Formal' }, { value: 'friendly-professional', label: 'Friendly' }, { value: 'casual', label: 'Casual' }]} />
//       <Section label="Empathy Level" keyName="empathy" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
//     </div>
//   );
// }

// // ─── Consolidate Preview Modal ─────────────────────────────────────────────
// function ConsolidatePreviewModal({ onClose, onDone, showToast }) {
//   const [phase, setPhase]             = useState('menu');
//   const [proposals, setProposals]     = useState([]);
//   const [summary, setSummary]         = useState(null);
//   const [filter, setFilter]           = useState('all');
//   const [editingId, setEditingId]     = useState(null);
//   const [editText, setEditText]       = useState('');
//   const [expandedIds, setExpandedIds] = useState(new Set());
//   const [result, setResult]           = useState(null);
//   const [error, setError]             = useState('');
//   const [revertConfirm, setRevertConfirm] = useState(false);
//   const [lastCommit, setLastCommit]   = useState(null); // { removed, newTotal }

//   const setProposalState = (id, targetState) =>
//     setProposals(prev => prev.map(p =>
//       p.id === id ? { ...p, _state: p._state === targetState ? 'pending' : targetState } : p
//     ));

//   const approveAll = () => setProposals(prev => prev.map(p => ({ ...p, _state: 'approved' })));
//   const rejectAll  = () => setProposals(prev => prev.map(p => ({ ...p, _state: 'rejected' })));

//   const saveEdit = (id) => {
//     if (!editText.trim()) return;
//     setProposals(prev => prev.map(p => p.id === id ? { ...p, golden: editText.trim() } : p));
//     setEditingId(null);
//   };

//   const toggleExpand = (id) =>
//     setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

//   const loadPreview = async () => {
//     setPhase('loading');
//     try {
//       const data = await apiFetch('/ai/training/consolidate/preview', { method: 'POST', body: JSON.stringify({}) });
//       setProposals((data.proposals || []).map(p => ({ ...p, _state: 'pending' })));
//       setSummary(data.summary);
//       setPhase('review');
//     } catch (e) { setError(e.message); setPhase('error'); }
//   };

//   const runQuick = async () => {
//     setPhase('quickRunning');
//     try {
//       const data = await apiFetch('/ai/training/consolidate', { method: 'POST', body: JSON.stringify({}) });
//       setResult(data); setPhase('quickDone'); onDone();
//     } catch (e) { setError(e.message); setPhase('error'); }
//   };

//   const commit = async () => {
//     const approved = proposals.filter(p => p._state === 'approved');
//     if (!approved.length) return;
//     setPhase('committing');
//     try {
//       const data = await apiFetch('/ai/training/consolidate/commit', {
//         method: 'POST', body: JSON.stringify({ approvedProposals: approved }),
//       });
//       // Stay in review — remove committed proposals, keep pending/rejected
//       const removedCount = approved.length;
//       const newTotal = data.remainingRules ?? data.rulesAfter ?? null;
//       setProposals(prev => prev.filter(p => p._state !== 'approved'));
//       setSummary(prev => prev && newTotal != null ? { ...prev, currentRules: newTotal } : prev);
//       setLastCommit({ removed: removedCount, newTotal });
//       setFilter('all');
//       setPhase('review');
//       onDone();
//     } catch (e) { setError(e.message); setPhase('error'); }
//   };

//   const revert = async () => {
//     setRevertConfirm(false); setPhase('reverting');
//     try {
//       await apiFetch('/ai/training/consolidate-restore', { method: 'POST', body: JSON.stringify({}) });
//       setPhase('reverted'); onDone();
//     } catch (e) { setError(e.message); setPhase('error'); }
//   };

//   // Derived
//   const approved  = proposals.filter(p => p._state === 'approved');
//   const rejected  = proposals.filter(p => p._state === 'rejected');
//   const pending   = proposals.filter(p => p._state === 'pending');
//   const savedByApproved = approved.reduce((s, p) => s + Math.max(0, (p.absorbedCount || 0) - 1), 0);
//   const estAfter  = summary ? Math.max(0, summary.currentRules - savedByApproved) : 0;

//   const filtered = proposals.filter(p => {
//     if (filter === 'approved') return p._state === 'approved';
//     if (filter === 'rejected') return p._state === 'rejected';
//     if (filter === 'pending')  return p._state === 'pending';
//     if (filter === 'critical') return p.impact === 'critical' || p.impact === 'high';
//     return true;
//   });

//   const impactColor = i => i === 'critical' ? '#f87171' : i === 'high' ? '#fbbf24' : '#60a5fa';
//   const impactBg    = i => i === 'critical' ? '#f8717118' : i === 'high' ? '#fbbf2418' : '#60a5fa18';

//   const Dots = ({ color = '#a78bfa' }) => (
//     <div style={{ display: 'flex', gap: 7, justifyContent: 'center', padding: '32px 0' }}>
//       {[0,1,2].map(i => (
//         <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: color,
//           display: 'inline-block', animation: 'tdBounce 1.4s ease-in-out infinite',
//           animationDelay: `${i * 0.2}s` }} />
//       ))}
//     </div>
//   );

//   // ── Menu ─────────────────────────────────────────────────────────────────
//   if (phase === 'menu') return (
//     <div style={OV}>
//       <div style={{ ...MB, maxWidth: 520 }}>
//         <div style={{ padding: '22px 26px', borderBottom: '1px solid #0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
//           <div style={ICON_BOX('#a78bfa')}>🔀</div>
//           <div style={{ flex: 1 }}>
//             <div style={H3}>Consolidate brain rules</div>
//             <div style={SUB}>AI merges overlapping rules and removes redundancy</div>
//           </div>
//           <button onClick={onClose} style={X_BTN}>×</button>
//         </div>
//         <div style={{ padding: '18px 26px 22px' }}>
//           {/* Interactive */}
//           <div onClick={loadPreview} style={{ ...CHOICE_CARD, marginBottom: 10, borderColor: '#a78bfa30' }}
//             onMouseEnter={e => e.currentTarget.style.borderColor = '#a78bfa70'}
//             onMouseLeave={e => e.currentTarget.style.borderColor = '#a78bfa30'}>
//             <div style={CHOICE_ICON('#a78bfa')}>👁️</div>
//             <div style={{ flex: 1 }}>
//               <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
//                 <span style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>Interactive review</span>
//                 <span style={{ fontSize: 10, color: '#a78bfa', background: '#a78bfa18', border: '1px solid #a78bfa30', borderRadius: 20, padding: '1px 9px', fontWeight: 700 }}>Recommended</span>
//               </div>
//               <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.65 }}>
//                 Preview every proposed merge before it's committed. Approve, edit, or reject each individually — nothing changes until you say so.
//               </p>
//             </div>
//             <span style={{ color: '#a78bfa', fontSize: 20, flexShrink: 0 }}>→</span>
//           </div>

//           {/* Quick */}
//           <div onClick={runQuick} style={{ ...CHOICE_CARD, borderColor: '#1e293b' }}
//             onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
//             onMouseLeave={e => e.currentTarget.style.borderColor = '#1e293b'}>
//             <div style={CHOICE_ICON('#475569')}>⚡</div>
//             <div style={{ flex: 1 }}>
//               <div style={{ fontWeight: 600, fontSize: 14, color: '#94a3b8', marginBottom: 5 }}>Quick consolidate</div>
//               <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.65 }}>
//                 Runs immediately and writes directly to the brain. A backup is saved automatically so you can revert.
//               </p>
//             </div>
//             <span style={{ color: '#334155', fontSize: 20, flexShrink: 0 }}>→</span>
//           </div>

//           <div style={{ background: '#fbbf2408', border: '1px solid #fbbf2420', borderRadius: 8, padding: '10px 14px', marginTop: 14 }}>
//             <p style={{ margin: 0, fontSize: 11, color: '#b45309', lineHeight: 1.5 }}>⚠️ A backup is always saved before any write. Revert is available on the result screen.</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );

//   // ── Loading ───────────────────────────────────────────────────────────────
//   if (phase === 'loading') return (
//     <div style={OV}>
//       <div style={{ ...MB, maxWidth: 400 }}>
//         <div style={{ padding: '28px 26px', textAlign: 'center' }}>
//           <div style={{ ...ICON_BOX('#a78bfa'), margin: '0 auto 16px', width: 44, height: 44, fontSize: 20 }}>🔀</div>
//           <div style={H3}>Analysing rules…</div>
//           <div style={{ ...SUB, marginBottom: 0 }}>Clustering and generating merge proposals. May take 30–60 seconds.</div>
//           <Dots color="#a78bfa" />
//         </div>
//       </div>
//     </div>
//   );

//   // ── Review ────────────────────────────────────────────────────────────────
//   if (phase === 'review') {
//     const fc = {
//       all: proposals.length,
//       pending: pending.length,
//       approved: approved.length,
//       rejected: rejected.length,
//       critical: proposals.filter(p => p.impact === 'critical' || p.impact === 'high').length,
//     };
//     return (
//       <div style={OV}>
//         <div style={{ ...MB, maxWidth: 760, maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>

//           {/* ── Header ── */}
//           <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
//             <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
//               <div>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
//                   <div style={{ ...ICON_BOX('#a78bfa'), width: 32, height: 32, fontSize: 14 }}>🔀</div>
//                   <span style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0' }}>Consolidation review</span>
//                   <span style={{ fontSize: 11, color: '#a78bfa', background: '#a78bfa18', border: '1px solid #a78bfa30', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>{proposals.length} proposals</span>
//                 </div>
//                 <p style={{ margin: '0 0 0 42px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
//                   Approve, edit, or reject each merge. Nothing is saved until you commit.
//                 </p>
//               </div>
//               <button onClick={onClose} style={X_BTN}>×</button>
//             </div>

//             {/* Stat row */}
//             <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
//               {[
//                 { label: 'Current rules',  value: summary?.currentRules ?? '—', color: '#fbbf24' },
//                 { label: 'After commit',   value: approved.length > 0 ? estAfter : '—', color: '#34d399' },
//                 { label: 'Rules saved',    value: approved.length > 0 ? savedByApproved : '—', color: '#34d399' },
//                 { label: 'Approved',       value: approved.length, color: '#34d399' },
//                 { label: 'Pending',        value: pending.length,  color: '#64748b' },
//                 { label: 'Rejected',       value: rejected.length, color: '#f87171' },
//               ].map(({ label, value, color }) => (
//                 <div key={label} style={{ flex: 1, background: '#0d1117', border: '1px solid #0f172a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
//                   <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
//                   <div style={{ fontSize: 10, color: '#334155', marginTop: 4, fontWeight: 500 }}>{label}</div>
//                 </div>
//               ))}
//             </div>

//             {/* Filters + bulk */}
//             <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 14, borderBottom: '1px solid #0f172a' }}>
//               {[
//                 { key: 'all',      label: 'All',         count: fc.all },
//                 { key: 'pending',  label: 'Pending',     count: fc.pending },
//                 { key: 'approved', label: 'Approved',    count: fc.approved },
//                 { key: 'rejected', label: 'Rejected',    count: fc.rejected },
//                 { key: 'critical', label: 'High-impact', count: fc.critical },
//               ].map(({ key, label, count }) => (
//                 <button key={key} onClick={() => setFilter(key)} style={{
//                   fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: filter === key ? 600 : 400,
//                   background: filter === key ? '#a78bfa20' : 'transparent',
//                   border: filter === key ? '1px solid #a78bfa50' : '1px solid transparent',
//                   color: filter === key ? '#c4b5fd' : '#475569',
//                   transition: 'all 0.15s',
//                 }}>
//                   {label} <span style={{ opacity: 0.7 }}>{count}</span>
//                 </button>
//               ))}
//               <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
//                 <button onClick={approveAll} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', background: '#34d39918', border: '1px solid #34d39935', color: '#34d399', fontWeight: 600 }}>✓ Approve all</button>
//                 <button onClick={rejectAll}  style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #f8717130', color: '#f87171', fontWeight: 600 }}>✗ Reject all</button>
//               </div>
//             </div>
//           </div>

//           {/* ── Commit success banner ── */}
//           {lastCommit && (
//             <div style={{ margin: '0 24px', marginTop: 12, background: '#34d39910', border: '1px solid #34d39930', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
//               <span style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>
//                 ✓ {lastCommit.removed} merge{lastCommit.removed !== 1 ? 's' : ''} committed
//                 {lastCommit.newTotal != null && <span style={{ fontWeight: 400, color: '#6ee7b7' }}> · brain now has {lastCommit.newTotal} rules</span>}
//               </span>
//               <button onClick={() => setLastCommit(null)} style={{ background: 'none', border: 'none', color: '#34d39970', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
//             </div>
//           )}

//           {/* ── Proposal list ── */}
//           <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px' }}>
//             {filtered.length === 0 && proposals.length === 0 && (
//               <div style={{ textAlign: 'center', padding: '64px 0' }}>
//                 <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
//                 <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>All done</div>
//                 <p style={{ fontSize: 13, color: '#475569', margin: '0 0 24px', lineHeight: 1.65 }}>
//                   No more merge proposals. Your brain is fully consolidated.
//                 </p>
//                 <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Close</button>
//               </div>
//             )}
//             {filtered.length === 0 && proposals.length > 0 && (
//               <div style={{ textAlign: 'center', padding: '48px 0', color: '#334155', fontSize: 13 }}>
//                 No proposals match this filter.
//               </div>
//             )}

//             {filtered.map(p => {
//               const isApproved = p._state === 'approved';
//               const isRejected = p._state === 'rejected';
//               const isEditing  = editingId === p.id;
//               const isExpanded = expandedIds.has(p.id);
//               const SHOW = 3;
//               const rest = (p.absorbedTexts || []).length - SHOW;

//               // Card left-border color
//               const borderAccent = isApproved ? '#34d399' : isRejected ? '#475569' : '#1e293b';

//               return (
//                 <div key={p.id} style={{
//                   borderRadius: 12,
//                   border: `1px solid ${isApproved ? '#34d39930' : isRejected ? '#1e293b' : '#1e293b'}`,
//                   borderLeft: `4px solid ${borderAccent}`,
//                   marginBottom: 10,
//                   background: isApproved ? '#34d39906' : '#0d1117',
//                   opacity: isRejected ? 0.5 : 1,
//                   transition: 'all 0.15s',
//                   overflow: 'hidden',
//                 }}>

//                   {/* Card header row */}
//                   <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #0a0f1a' }}>
//                     {/* State icon */}
//                     <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900,
//                       background: isApproved ? '#34d399' : isRejected ? '#1e293b' : '#1e293b',
//                       color: isApproved ? '#000' : '#334155',
//                     }}>
//                       {isApproved ? '✓' : isRejected ? '✗' : '·'}
//                     </div>

//                     {/* Topic + meta */}
//                     <div style={{ flex: 1, minWidth: 0 }}>
//                       <div style={{ fontWeight: 600, fontSize: 14, color: isRejected ? '#475569' : '#e2e8f0', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//                         {p.topic || p.category}
//                       </div>
//                       <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//                         <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: impactBg(p.impact), color: impactColor(p.impact) }}>
//                           {p.impact}
//                         </span>
//                         {p.absorbedCount > 0 && (
//                           <span style={{ fontSize: 11, color: '#334155' }}>{p.absorbedCount} rules → 1</span>
//                         )}
//                         {isApproved && <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>approved</span>}
//                         {isRejected && <span style={{ fontSize: 11, color: '#475569' }}>rejected</span>}
//                       </div>
//                     </div>

//                     {/* Action buttons */}
//                     <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
//                       <button
//                         onClick={() => { setEditingId(isEditing ? null : p.id); setEditText(p.golden); }}
//                         title="Edit golden rule"
//                         style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: '1px solid #1e293b', color: '#60a5fa', fontWeight: 500, transition: 'all 0.15s' }}>
//                         ✏️ Edit
//                       </button>
//                       <button
//                         onClick={() => setProposalState(p.id, 'rejected')}
//                         style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
//                           background: isRejected ? '#f8717120' : 'transparent',
//                           border: `1px solid ${isRejected ? '#f8717150' : '#f8717130'}`,
//                           color: '#f87171',
//                         }}>
//                         {isRejected ? 'Undo' : '✗ Reject'}
//                       </button>
//                       <button
//                         onClick={() => setProposalState(p.id, 'approved')}
//                         style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s',
//                           background: isApproved ? '#34d399' : '#34d39920',
//                           border: `1px solid ${isApproved ? '#34d399' : '#34d39940'}`,
//                           color: isApproved ? '#000' : '#34d399',
//                         }}>
//                         {isApproved ? '✓ Approved' : 'Approve'}
//                       </button>
//                     </div>
//                   </div>

//                   {/* Golden rule */}
//                   <div style={{ padding: '14px 16px', borderBottom: (p.absorbedTexts?.length > 0) ? '1px solid #0a0f1a' : 'none' }}>
//                     <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
//                       ⭐ Golden rule
//                     </div>
//                     {isEditing ? (
//                       <div>
//                         <textarea
//                           value={editText}
//                           onChange={e => setEditText(e.target.value)}
//                           style={{ width: '100%', background: '#080b14', border: '1px solid #34d39940', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 90, outline: 'none', lineHeight: 1.65 }}
//                           autoFocus
//                         />
//                         <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
//                           <button onClick={() => setEditingId(null)} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 7, background: 'transparent', border: '1px solid #1e293b', color: '#475569', cursor: 'pointer' }}>Cancel</button>
//                           <button onClick={() => saveEdit(p.id)} style={{ fontSize: 12, padding: '5px 16px', borderRadius: 7, background: '#34d399', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer' }}>Save</button>
//                         </div>
//                       </div>
//                     ) : (
//                       <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>{p.golden}</p>
//                     )}
//                   </div>

//                   {/* Absorbed rules */}
//                   {p.absorbedTexts?.length > 0 && (
//                     <div style={{ padding: '10px 16px 12px', background: '#080b14' }}>
//                       <div style={{ fontSize: 10, color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
//                         Absorbs {p.absorbedTexts.length} existing rules
//                       </div>
//                       <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
//                         {(isExpanded ? p.absorbedTexts : p.absorbedTexts.slice(0, SHOW)).map((txt, i) => (
//                           <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
//                             <span style={{ color: '#1e293b', fontSize: 12, flexShrink: 0, marginTop: 2, fontWeight: 700 }}>↳</span>
//                             <span style={{ fontSize: 12, color: '#334155', lineHeight: 1.55 }}>{txt}</span>
//                           </div>
//                         ))}
//                       </div>
//                       {rest > 0 && !isExpanded && (
//                         <button onClick={() => toggleExpand(p.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer', padding: '2px 0', fontWeight: 500 }}>
//                           + {rest} more rule{rest !== 1 ? 's' : ''}…
//                         </button>
//                       )}
//                       {isExpanded && rest > 0 && (
//                         <button onClick={() => toggleExpand(p.id)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#334155', fontSize: 11, cursor: 'pointer', padding: '2px 0' }}>
//                           Show less
//                         </button>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               );
//             })}
//           </div>

//           {/* ── Footer ── */}
//           <div style={{ padding: '14px 24px', borderTop: '1px solid #0f172a', background: '#080b14', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
//             <div style={{ fontSize: 13, color: '#475569' }}>
//               {approved.length > 0
//                 ? <><span style={{ color: '#34d399', fontWeight: 600 }}>{approved.length} selected</span> · {summary?.currentRules} → <span style={{ color: '#34d399', fontWeight: 600 }}>{estAfter}</span> rules</>
//                 : pending.length > 0
//                   ? <span style={{ color: '#475569' }}>{pending.length} remaining · {rejected.length} rejected</span>
//                   : 'Approve proposals above to commit'
//               }
//             </div>
//             <div style={{ display: 'flex', gap: 8 }}>
//               <button onClick={onClose} style={GHOST_BTN}>{proposals.length === 0 ? 'Close' : 'Cancel'}</button>
//               <button
//                 onClick={commit}
//                 disabled={approved.length === 0}
//                 style={{ fontSize: 13, padding: '9px 24px', borderRadius: 9, border: 'none', fontWeight: 700, cursor: approved.length === 0 ? 'default' : 'pointer',
//                   background: approved.length === 0 ? '#1e293b' : '#a78bfa',
//                   color: approved.length === 0 ? '#334155' : '#000',
//                   transition: 'all 0.15s',
//                 }}>
//                 {approved.length === 0 ? 'Select proposals to commit' : `🔀 Commit ${approved.length} merge${approved.length !== 1 ? 's' : ''} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ── Running states ─────────────────────────────────────────────────────────
//   if (['committing','quickRunning','reverting'].includes(phase)) {
//     const label = phase === 'reverting' ? 'Reverting…' : phase === 'quickRunning' ? 'Consolidating…' : 'Saving merges…';
//     const sub   = phase === 'reverting' ? 'Restoring from backup' : phase === 'quickRunning' ? 'This may take 20–40 seconds' : 'Writing approved rules to brain';
//     const color = phase === 'reverting' ? '#f87171' : '#a78bfa';
//     return (
//       <div style={OV}>
//         <div style={{ ...MB, maxWidth: 380 }}>
//           <div style={{ padding: '32px 26px', textAlign: 'center' }}>
//             <div style={{ ...ICON_BOX(color), margin: '0 auto 16px', width: 44, height: 44, fontSize: 20 }}>
//               {phase === 'reverting' ? '↩️' : '🔀'}
//             </div>
//             <div style={H3}>{label}</div>
//             <div style={{ ...SUB, marginBottom: 0 }}>{sub}</div>
//             <Dots color={color} />
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ── Done / QuickDone ───────────────────────────────────────────────────────
//   if (phase === 'done' || phase === 'quickDone') {
//     const beforeVal  = result?.rulesBefore ?? result?.absorbed ?? '—';
//     const afterVal   = result?.remainingRules ?? result?.rulesAfter ?? '—';
//     const removedVal = result?.absorbed ?? result?.removed
//       ?? (result?.rulesBefore != null && result?.rulesAfter != null ? result.rulesBefore - result.rulesAfter : '—');
//     return (
//       <div style={OV}>
//         <div style={{ ...MB, maxWidth: 460 }}>
//           <div style={{ padding: '24px 26px' }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
//               <div style={{ ...ICON_BOX('#34d399'), width: 40, height: 40, fontSize: 18 }}>✅</div>
//               <div>
//                 <div style={H3}>Consolidation complete</div>
//                 <div style={SUB}>Brain updated and cache refreshed</div>
//               </div>
//             </div>

//             <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
//               {[
//                 { label: 'Before',  value: beforeVal,  color: '#fbbf24' },
//                 { label: 'After',   value: afterVal,   color: '#34d399' },
//                 { label: 'Removed', value: removedVal, color: '#f87171' },
//               ].map(({ label, value, color }) => (
//                 <div key={label} style={{ flex: 1, background: '#0d1117', border: '1px solid #0f172a', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
//                   <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
//                   <div style={{ fontSize: 11, color: '#475569', marginTop: 6, fontWeight: 500 }}>{label}</div>
//                 </div>
//               ))}
//             </div>

//             {result?.message && <p style={{ fontSize: 12, color: '#475569', margin: '0 0 18px', lineHeight: 1.65 }}>{result.message}</p>}

//             {revertConfirm ? (
//               <div style={{ background: '#f8717110', border: '1px solid #f8717125', borderRadius: 10, padding: '14px', marginBottom: 12 }}>
//                 <p style={{ margin: '0 0 12px', fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>
//                   This will restore the brain to exactly how it was before consolidation. The consolidated version will be discarded.
//                 </p>
//                 <div style={{ display: 'flex', gap: 8 }}>
//                   <button onClick={() => setRevertConfirm(false)} style={{ flex: 1, ...GHOST_BTN, fontSize: 12 }}>Cancel</button>
//                   <button onClick={revert} style={{ flex: 2, background: '#f87171', border: 'none', borderRadius: 8, color: '#000', padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩️ Yes, revert brain</button>
//                 </div>
//               </div>
//             ) : (
//               <div style={{ display: 'flex', gap: 10 }}>
//                 <button onClick={() => setRevertConfirm(true)} style={{ flex: 1, ...GHOST_BTN }} title="Restore pre-consolidation state">↩️ Revert</button>
//                 <button onClick={onClose} style={{ flex: 2, background: '#34d399', border: 'none', borderRadius: 9, color: '#000', padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Done</button>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // ── Reverted ───────────────────────────────────────────────────────────────
//   if (phase === 'reverted') return (
//     <div style={OV}>
//       <div style={{ ...MB, maxWidth: 380 }}>
//         <div style={{ padding: '32px 26px', textAlign: 'center' }}>
//           <div style={{ fontSize: 48, marginBottom: 14 }}>↩️</div>
//           <div style={H3}>Brain restored</div>
//           <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: '8px 0 22px' }}>
//             The brain has been reverted to the state before consolidation.
//           </p>
//           <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Close</button>
//         </div>
//       </div>
//     </div>
//   );

//   // ── Error ──────────────────────────────────────────────────────────────────
//   return (
//     <div style={OV}>
//       <div style={{ ...MB, maxWidth: 420 }}>
//         <div style={{ padding: '24px 26px' }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
//             <div style={{ ...ICON_BOX('#f87171'), width: 36, height: 36, fontSize: 16 }}>❌</div>
//             <div style={H3}>Operation failed</div>
//           </div>
//           <div style={{ background: '#f8717110', border: '1px solid #f8717125', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
//             <p style={{ margin: 0, fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>{error}</p>
//           </div>
//           <div style={{ display: 'flex', gap: 10 }}>
//             <button onClick={onClose} style={{ flex: 1, ...GHOST_BTN }}>Close</button>
//             <button onClick={() => { setPhase('menu'); setError(''); }} style={{ flex: 1, background: '#a78bfa', border: 'none', borderRadius: 8, color: '#000', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Duplicates Modal ──────────────────────────────────────────────────────
// function DuplicatesModal({ brain, dupeGroups, onDeleteIndexes, onClose }) {
//   const groups = dupeGroups;
//   const [step, setStep] = useState('review');
//   const [keepers, setKeepers] = useState({});

//   const resolvedKeeper = (cat, gi, g) => {
//     const groupKey = `${cat.brainKey}:${gi}`;
//     const rules = g.rules || [];
//     if (keepers[groupKey] != null) return keepers[groupKey];
//     const explicitIdxs = g.indexes.filter((_, ii) => isExplicitMaster(rules[ii]));
//     if (explicitIdxs.length >= 1) return explicitIdxs[0];
//     const srcSet = new Set(rules.map(r => (typeof r === 'string' ? '' : r?.source || '').toLowerCase()));
//     if (srcSet.size > 1) {
//       const masterIdxs = g.indexes.filter((_, ii) => isMasterRule(rules[ii]));
//       if (masterIdxs.length === 1) return masterIdxs[0];
//     }
//     return g.indexes[0];
//   };

//   const isMultiMasterConflict = (cat, gi, g) => {
//     const rules = g.rules || [];
//     const groupKey = `${cat.brainKey}:${gi}`;
//     if (keepers[groupKey] != null) return false;
//     return g.indexes.filter((_, ii) => isExplicitMaster(rules[ii])).length > 1;
//   };

//   const setGroupKeeper = (cat, gi, idx) => {
//     setKeepers(prev => ({ ...prev, [`${cat.brainKey}:${gi}`]: idx }));
//     setSelected(prev => {
//       const s = new Set(prev);
//       const g = groups.find(c => c.brainKey === cat.brainKey)?.groups[gi];
//       if (g) g.indexes.forEach(i => { if (i !== idx) s.add(`${cat.brainKey}:${i}`); else s.delete(`${cat.brainKey}:${i}`); });
//       return s;
//     });
//   };

//   const defaultSelected = () => {
//     const s = new Set();
//     groups.forEach(cat => {
//       cat.groups.forEach((g, gi) => {
//         const keeper = resolvedKeeper(cat, gi, g);
//         g.indexes.forEach(idx => { if (idx !== keeper) s.add(`${cat.brainKey}:${idx}`); });
//       });
//     });
//     return s;
//   };
//   const [selected, setSelected] = useState(defaultSelected);

//   const totalFlagged = groups.reduce((s, c) => s + c.groups.reduce((ss, g) => ss + g.indexes.length, 0), 0);
//   const conflictCount = groups.reduce((s, cat) =>
//     s + cat.groups.filter((g, gi) => isMultiMasterConflict(cat, gi, g)).length, 0);

//   const allSelectableKeys = [];
//   groups.forEach(cat => cat.groups.forEach((g, gi) => {
//     const keeper = resolvedKeeper(cat, gi, g);
//     if (keeper !== null) g.indexes.forEach(idx => { if (idx !== keeper) allSelectableKeys.push(`${cat.brainKey}:${idx}`); });
//   }));

//   const toggle    = key => setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
//   const selectAll = () => setSelected(new Set(allSelectableKeys));
//   const deselectAll = () => setSelected(new Set());

//   const buildByKey = () => {
//     const byKey = {};
//     for (const key of selected) {
//       const colonIdx = key.indexOf(':');
//       const brainKey = key.slice(0, colonIdx);
//       const idx = parseInt(key.slice(colonIdx + 1));
//       if (!byKey[brainKey]) byKey[brainKey] = [];
//       byKey[brainKey].push(idx);
//     }
//     return byKey;
//   };

//   const handleConfirmedDelete = () => { onDeleteIndexes(buildByKey()); setStep('done'); };

//   // Empty
//   if (groups.length === 0) return (
//     <div style={OV}>
//       <div style={{ ...MB, maxWidth: 400, textAlign: 'center' }}>
//         <div style={{ padding: '48px 32px' }}>
//           <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>✅</div>
//           <div style={{ ...H3, marginBottom: 8 }}>No duplicates found</div>
//           <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: '0 0 24px' }}>
//             No rules with ≥45% word overlap detected across any category. Your brain is clean.
//           </p>
//           <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Close</button>
//         </div>
//       </div>
//     </div>
//   );

//   // Done
//   if (step === 'done') return (
//     <div style={OV}>
//       <div style={{ ...MB, maxWidth: 400, textAlign: 'center' }}>
//         <div style={{ padding: '48px 32px' }}>
//           <div style={{ fontSize: 52, marginBottom: 16 }}>🗑️</div>
//           <div style={{ ...H3, marginBottom: 8 }}>Rules deleted</div>
//           <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: '0 0 24px' }}>
//             {selected.size} duplicate rule{selected.size !== 1 ? 's were' : ' was'} removed and the brain was saved.
//           </p>
//           <button onClick={onClose} style={{ ...BTN_GREEN, fontSize: 13 }}>Done</button>
//         </div>
//       </div>
//     </div>
//   );

//   // Confirm
//   if (step === 'confirm') {
//     const preview = [];
//     groups.forEach(cat => {
//       cat.groups.forEach(g => {
//         g.indexes.forEach((idx, ii) => {
//           if (selected.has(`${cat.brainKey}:${idx}`))
//             preview.push({ color: cat.color, icon: cat.icon, label: cat.label, text: g.texts[ii], isMaster: isMasterRule(g.rules[ii]) });
//         });
//       });
//     });
//     return (
//       <div style={OV}>
//         <div style={{ ...MB, maxWidth: 580 }}>
//           <div style={{ padding: '20px 24px', borderBottom: '1px solid #0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
//             <div style={{ ...ICON_BOX('#f87171'), width: 36, height: 36, fontSize: 16 }}>⚠️</div>
//             <div>
//               <div style={H3}>Confirm deletion</div>
//               <div style={SUB}>This cannot be undone — review carefully</div>
//             </div>
//           </div>
//           <div style={{ maxHeight: 360, overflowY: 'auto', padding: '16px 24px' }}>
//             <div style={{ fontSize: 11, color: '#475569', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
//               {preview.length} rule{preview.length !== 1 ? 's' : ''} will be permanently deleted:
//             </div>
//             {preview.map((item, i) => (
//               <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', marginBottom: 6, background: '#f8717108', border: '1px solid #f8717120', borderLeft: `3px solid ${item.color}`, borderRadius: 8 }}>
//                 <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
//                 <div style={{ flex: 1, minWidth: 0 }}>
//                   <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
//                     <span style={{ fontSize: 10, color: item.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</span>
//                     {item.isMaster && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2412', border: '1px solid #fbbf2430', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>👑 master</span>}
//                   </div>
//                   <p style={{ margin: 0, fontSize: 12, color: '#f87171aa', lineHeight: 1.55, textDecoration: 'line-through', wordBreak: 'break-word' }}>{item.text}</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//           <div style={{ padding: '14px 24px', borderTop: '1px solid #0f172a', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
//             <button onClick={() => setStep('review')} style={GHOST_BTN}>← Back</button>
//             <div style={{ display: 'flex', gap: 8 }}>
//               <button onClick={onClose} style={GHOST_BTN}>Cancel</button>
//               <button onClick={handleConfirmedDelete} style={{ ...BTN_DANGER, padding: '9px 20px', fontSize: 13, minWidth: 180 }}>
//                 🗑️ Delete {preview.length} rule{preview.length !== 1 ? 's' : ''} — confirm
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Review
//   return (
//     <div style={OV}>
//       <div style={{ ...MB, maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

//         {/* Header */}
//         <div style={{ padding: '18px 24px', borderBottom: '1px solid #0f172a', flexShrink: 0 }}>
//           <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
//             <div>
//               <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
//                 <div style={{ ...ICON_BOX('#f87171'), width: 32, height: 32, fontSize: 14 }}>🔍</div>
//                 <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Duplicate scanner</span>
//                 <span style={{ fontSize: 11, color: '#f87171', background: '#f8717112', borderRadius: 20, padding: '2px 9px', border: '1px solid #f8717125', fontWeight: 700 }}>{totalFlagged} flagged</span>
//                 {conflictCount > 0 && <span style={{ fontSize: 11, color: '#fbbf24', background: '#fbbf2412', borderRadius: 20, padding: '2px 9px', border: '1px solid #fbbf2430', fontWeight: 700 }}>👑 {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}</span>}
//               </div>
//               <p style={{ margin: '0 0 0 42px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
//                 <span style={{ color: '#34d399', fontWeight: 600 }}>👑 Master</span> rules are admin-added and kept by default. Click any non-master rule to mark it for deletion.
//               </p>
//             </div>
//             <button onClick={onClose} style={X_BTN}>×</button>
//           </div>
//           <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
//             <button onClick={selectAll}   style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: '#f8717112', border: '1px solid #f8717130', color: '#f87171', fontWeight: 600 }}>Select all duplicates</button>
//             <button onClick={deselectAll} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #1e293b', color: '#475569', fontWeight: 500 }}>Clear selection</button>
//             <span style={{ fontSize: 12, color: '#334155', marginLeft: 'auto' }}>{selected.size} of {allSelectableKeys.length} selected for deletion</span>
//           </div>
//         </div>

//         {/* Groups */}
//         <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
//           {groups.map(cat => (
//             <div key={cat.brainKey} style={{ marginBottom: 32 }}>
//               {/* Category header */}
//               <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
//                 <span style={{ fontSize: 14 }}>{cat.icon}</span>
//                 <span style={{ fontSize: 12, color: cat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat.label}</span>
//                 <span style={{ fontSize: 11, color: '#334155', background: '#0d1117', borderRadius: 20, padding: '2px 9px', border: '1px solid #0f172a' }}>
//                   {cat.groups.reduce((s, g) => s + g.indexes.length, 0)} rules · {cat.groups.length} group{cat.groups.length !== 1 ? 's' : ''}
//                 </span>
//                 <div style={{ flex: 1, height: 1, background: `${cat.color}15` }} />
//                 <button onClick={() => setSelected(prev => {
//                   const s = new Set(prev);
//                   cat.groups.forEach((g, gi) => {
//                     const keeper = resolvedKeeper(cat, gi, g);
//                     if (keeper !== null) g.indexes.forEach(idx => { if (idx !== keeper) s.add(`${cat.brainKey}:${idx}`); });
//                   });
//                   return s;
//                 })} style={{ fontSize: 10, padding: '2px 9px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '1px solid #1e293b', color: '#475569' }}>
//                   Select all in {cat.label}
//                 </button>
//               </div>

//               {/* Similarity groups */}
//               {cat.groups.map((g, gi) => {
//                 const keeper    = resolvedKeeper(cat, gi, g);
//                 const conflict  = isMultiMasterConflict(cat, gi, g);
//                 const masterIdxs = g.indexes.filter((_, ii) => isMasterRule(g.rules[ii]));
//                 return (
//                   <div key={gi} style={{ marginBottom: 8, border: `1px solid ${conflict ? '#fbbf2430' : '#1e293b'}`, borderRadius: 10, overflow: 'hidden' }}>
//                     {/* Group bar */}
//                     <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: conflict ? '#fbbf2406' : '#0a0e1a', borderBottom: `1px solid ${conflict ? '#fbbf2420' : '#0f172a'}` }}>
//                       <span style={{ fontSize: 10, color: conflict ? '#fbbf24' : '#334155', fontWeight: 700, letterSpacing: '0.07em' }}>
//                         GROUP {gi + 1}
//                       </span>
//                       <span style={{ fontSize: 10, color: '#1e293b' }}>·</span>
//                       <span style={{ fontSize: 10, color: '#334155' }}>{g.indexes.length} similar rules</span>
//                       {conflict && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2415', border: '1px solid #fbbf2430', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>👑 {masterIdxs.length} masters — click Keep to choose</span>}
//                       <button onClick={() => setSelected(prev => {
//                         const s = new Set(prev);
//                         const allChecked = g.indexes.filter(idx => idx !== keeper).every(idx => s.has(`${cat.brainKey}:${idx}`));
//                         g.indexes.filter(idx => idx !== keeper).forEach(idx => { const k = `${cat.brainKey}:${idx}`; allChecked ? s.delete(k) : s.add(k); });
//                         return s;
//                       })} style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 9px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: `1px solid ${conflict ? '#fbbf2430' : '#1e293b'}`, color: conflict ? '#fbbf24' : '#475569' }}>
//                         {g.indexes.filter(idx => idx !== keeper).every(idx => selected.has(`${cat.brainKey}:${idx}`)) ? 'Deselect group' : 'Select duplicates'}
//                       </button>
//                     </div>

//                     {/* Rules */}
//                     {g.indexes.map((idx, ii) => {
//                       const itemKey   = `${cat.brainKey}:${idx}`;
//                       const isChecked = selected.has(itemKey);
//                       const isKeeper  = keeper === idx;
//                       const isMast    = isMasterRule(g.rules[ii]);
//                       return (
//                         <div key={idx} onClick={() => !isKeeper && toggle(itemKey)} style={{
//                           display: 'flex', gap: 14, alignItems: 'flex-start',
//                           padding: '12px 14px',
//                           borderBottom: ii < g.indexes.length - 1 ? '1px solid #0a0e1a' : 'none',
//                           background: isChecked ? '#f8717108' : isKeeper ? (conflict ? '#fbbf2405' : '#34d39904') : 'transparent',
//                           cursor: isKeeper ? 'default' : 'pointer',
//                           transition: 'background 0.1s',
//                         }}>
//                           {/* Left indicator */}
//                           <div style={{ flexShrink: 0, width: 56, paddingTop: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
//                             {isKeeper ? (
//                               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '4px 8px', whiteSpace: 'nowrap',
//                                 color:      conflict ? '#fbbf24' : '#34d399',
//                                 background: conflict ? '#fbbf2418' : '#34d39918',
//                                 border:    `1px solid ${conflict ? '#fbbf2440' : '#34d39940'}`,
//                               }}>
//                                 {conflict ? '●' : '✓'} {conflict ? 'AUTO' : 'KEEP'}
//                               </span>
//                             ) : (
//                               <>
//                                 <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isChecked ? '#f87171' : '#1e293b'}`, background: isChecked ? '#f87171' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s', flexShrink: 0 }}>
//                                   {isChecked && <span style={{ color: '#000', fontSize: 11, fontWeight: 900 }}>✕</span>}
//                                 </div>
//                                 {conflict && (
//                                   <button onClick={e => { e.stopPropagation(); setGroupKeeper(cat, gi, idx); }} style={{ background: 'transparent', border: '1px solid #fbbf2430', color: '#fbbf24', borderRadius: 4, padding: '2px 6px', fontSize: 9, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.4 }}>Keep →</button>
//                                 )}
//                               </>
//                             )}
//                           </div>

//                           {/* Rule content */}
//                           <div style={{ flex: 1, minWidth: 0 }}>
//                             <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
//                               {isMast && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2412', border: '1px solid #fbbf2430', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>👑 master</span>}
//                               {!isKeeper && (
//                                 <span style={{ fontSize: 10, color: isChecked ? '#f87171' : '#334155', fontWeight: isChecked ? 600 : 400 }}>
//                                   {isChecked ? '🗑️ marked for deletion' : 'click to mark for deletion'}
//                                 </span>
//                               )}
//                             </div>
//                             <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, wordBreak: 'break-word',
//                               color: isChecked ? '#f8717170' : isKeeper ? '#94a3b8' : '#64748b',
//                               textDecoration: isChecked ? 'line-through' : 'none',
//                             }}>
//                               {g.texts[ii]}
//                             </p>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 );
//               })}
//             </div>
//           ))}
//         </div>

//         {/* Footer */}
//         <div style={{ padding: '14px 24px', borderTop: '1px solid #0f172a', background: '#080b14', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
//           <div style={{ fontSize: 13 }}>
//             {conflictCount > 0 && <span style={{ color: '#fbbf24', marginRight: 12 }}>👑 {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} auto-resolved</span>}
//             <span style={{ color: selected.size > 0 ? '#f87171' : '#334155', fontWeight: selected.size > 0 ? 600 : 400 }}>
//               {selected.size > 0 ? `${selected.size} rule${selected.size !== 1 ? 's' : ''} selected for deletion` : 'No rules selected'}
//             </span>
//           </div>
//           <div style={{ display: 'flex', gap: 8 }}>
//             <button onClick={onClose} style={GHOST_BTN}>Cancel</button>
//             <button onClick={() => selected.size > 0 && setStep('confirm')} disabled={selected.size === 0} style={{ ...BTN_DANGER, opacity: selected.size === 0 ? 0.3 : 1, cursor: selected.size === 0 ? 'default' : 'pointer', fontSize: 13, padding: '9px 20px' }}>
//               Review &amp; delete {selected.size > 0 ? `(${selected.size})` : ''} →
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Shared style tokens ───────────────────────────────────────────────────
// const OV = {
//   position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
//   backdropFilter: 'blur(6px)', zIndex: 300,
//   display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
// };
// const MB = {
//   background: '#080b14', border: '1px solid #141c2e', borderRadius: 16,
//   width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.75)', overflow: 'hidden',
// };
// const H3 = { margin: 0, color: '#e2e8f0', fontSize: 15, fontWeight: 700 };
// const SUB = { margin: '2px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.5 };
// const GHOST_BTN = {
//   background: '#0f172a', border: '1px solid #1e293b', color: '#64748b',
//   borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 500,
// };
// const BTN_GREEN = {
//   background: '#34d399', border: 'none', borderRadius: 9, color: '#000',
//   padding: '11px 32px', fontWeight: 700, cursor: 'pointer', display: 'inline-block',
// };
// const BTN_DANGER = {
//   background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff',
//   padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
// };
// const X_BTN = {
//   background: '#0f172a', border: '1px solid #1e293b', color: '#475569',
//   fontSize: 18, cursor: 'pointer', borderRadius: 8, width: 32, height: 32,
//   display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
// };
// const ICON_BOX = (color) => ({
//   width: 36, height: 36, borderRadius: 10,
//   background: `${color}18`, border: `1px solid ${color}35`,
//   display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
// });
// const CHOICE_CARD = {
//   display: 'flex', alignItems: 'flex-start', gap: 14,
//   background: '#0d1117', border: '1px solid', borderRadius: 12,
//   padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s',
// };
// const CHOICE_ICON = (color) => ({
//   width: 42, height: 42, borderRadius: 10,
//   background: `${color}18`, border: `1px solid ${color}30`,
//   display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
// });


// // ─── Brain Drawer ──────────────────────────────────────────────────────────
// function BrainDrawer({ brain, open, onClose, onRemoveRule, dirty, onSave, saving, onReconsolidate, onFindDupes, dupeCount }) {
//   const totalRules = Object.values(CATEGORY_META).reduce((sum, meta) => sum + (brain[meta.brainKey] || []).length, 0);
//   return (
//     <>
//       <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity 0.2s', zIndex: 100 }} />
//       <div style={{
//         position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: '#080b14',
//         borderLeft: '1px solid #0f172a',
//         transform: open ? 'translateX(0)' : 'translateX(100%)',
//         transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
//         zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
//       }}>
//         <div style={{ padding: '18px 22px', borderBottom: '1px solid #0f172a', flexShrink: 0 }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
//             <div>
//               <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
//                 <span style={{ color: '#34d399', fontSize: 16 }}>⬡</span>
//                 <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>Brain Rules</span>
//                 <span style={{ fontSize: 11, color: '#34d399', background: '#34d39915', borderRadius: 20, padding: '2px 8px', border: '1px solid #34d39930', fontWeight: 600 }}>{totalRules}</span>
//                 {dupeCount > 0 && (
//                   <span onClick={onFindDupes} style={{ fontSize: 11, color: '#f87171', background: '#f8717112', borderRadius: 20, padding: '2px 8px', border: '1px solid #f8717125', fontWeight: 600, cursor: 'pointer' }}>
//                     ⚠️ {dupeCount} dupe{dupeCount !== 1 ? 's' : ''}
//                   </span>
//                 )}
//               </div>
//               <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>Rules trained into the suggestion engine</p>
//             </div>
//             <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
//               {dirty && <button onClick={onSave} disabled={saving} style={{ background: '#34d399', border: 'none', borderRadius: 7, color: '#000', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving…' : '💾'}</button>}
//               <button onClick={onClose} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#475569', fontSize: 16, cursor: 'pointer', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
//             </div>
//           </div>
//           <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
//             <button onClick={onReconsolidate} style={{ flex: 1, background: '#a78bfa12', border: '1px solid #a78bfa30', color: '#a78bfa', borderRadius: 7, padding: '7px 0', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>🔀 Consolidate</button>
//             <button onClick={onFindDupes} style={{ flex: 1, background: dupeCount > 0 ? '#f8717112' : '#0d1117', border: `1px solid ${dupeCount > 0 ? '#f8717130' : '#0f172a'}`, color: dupeCount > 0 ? '#f87171' : '#475569', borderRadius: 7, padding: '7px 0', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
//               🔍 Find Dupes{dupeCount > 0 ? ` (${dupeCount})` : ''}
//             </button>
//           </div>
//         </div>
//         <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
//           {Object.entries(CATEGORY_META).map(([cat, meta]) => {
//             const rules = brain[meta.brainKey] || [];
//             if (!rules.length) return null;
//             return (
//               <div key={cat} style={{ marginBottom: 22 }}>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingBottom: 7, borderBottom: `1px solid ${meta.color}15` }}>
//                   <span style={{ fontSize: 12 }}>{meta.icon}</span>
//                   <span style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
//                   <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>{rules.length} rules</span>
//                 </div>
//                 {rules.map((r, i) => {
//                   const text = typeof r === 'string' ? r : r.text;
//                   return (
//                     <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#0d1117', borderRadius: 7, padding: '8px 10px', marginBottom: 4, border: '1px solid #0f172a' }}>
//                       <span style={{ flex: 1, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{text}</span>
//                       <button onClick={() => onRemoveRule(meta.brainKey, i)}
//                         style={{ background: 'none', border: 'none', color: '#1e293b', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, transition: 'color 0.15s' }}
//                         onMouseEnter={e => e.target.style.color = '#f87171'}
//                         onMouseLeave={e => e.target.style.color = '#1e293b'}
//                       >×</button>
//                     </div>
//                   );
//                 })}
//               </div>
//             );
//           })}
//           {totalRules === 0 && (
//             <div style={{ textAlign: 'center', marginTop: 60 }}>
//               <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>⬡</div>
//               <p style={{ color: '#1e293b', fontSize: 13 }}>No rules yet.<br />Start chatting to teach the brain.</p>
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }

// function ReviewModal({ results, onAdd, onClose }) {
//   const [selected, setSelected] = useState(() => new Set(results.rules.map((_, i) => i)));
//   const toggle = i => setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
//   return (
//     <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
//       <div style={{ background: '#080b14', border: '1px solid #0f172a', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
//         <div style={{ padding: '22px 26px', borderBottom: '1px solid #0f172a' }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
//             <span style={{ fontSize: 18 }}>📊</span>
//             <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>Analysis Complete</h3>
//             <span style={{ fontSize: 11, color: '#34d399', background: '#34d39915', borderRadius: 20, padding: '2px 10px', border: '1px solid #34d39930' }}>{results.totalConversations} conversations</span>
//           </div>
//           <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{results.message}. Select the rules to add to the brain.</p>
//         </div>
//         <div style={{ flex: 1, overflowY: 'auto', padding: '16px 26px' }}>
//           {results.rules.map((rule, i) => {
//             const meta = CATEGORY_META[rule.category] || CATEGORY_META.prefer;
//             const isSel = selected.has(i);
//             return (
//               <div key={i} onClick={() => toggle(i)} style={{ display: 'flex', gap: 12, padding: '11px 13px', borderRadius: 9, marginBottom: 6, background: isSel ? meta.bg : '#0d1117', border: `1px solid ${isSel ? meta.color + '35' : '#0f172a'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
//                 <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSel ? meta.color : '#1e293b'}`, background: isSel ? meta.color : 'transparent', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
//                   {isSel && <span style={{ color: '#000', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
//                 </div>
//                 <div style={{ flex: 1 }}>
//                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
//                     <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{meta.icon} {meta.label}</span>
//                     {rule.confidence === 'high' && <span style={{ fontSize: 10, color: '#34d399', background: '#34d39915', borderRadius: 10, padding: '1px 6px' }}>⚡ high</span>}
//                   </div>
//                   <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>{rule.text}</p>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//         <div style={{ padding: '16px 26px', borderTop: '1px solid #0f172a', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
//           <span style={{ fontSize: 12, color: '#334155' }}>{selected.size} of {results.rules.length} selected</span>
//           <div style={{ display: 'flex', gap: 10 }}>
//             <button onClick={onClose} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#64748b', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
//             <button onClick={() => { onAdd([...selected].map(i => results.rules[i])); onClose(); }} style={{ background: '#34d399', border: 'none', borderRadius: 8, color: '#000', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
//               Add {selected.size} rules →
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function SaveToast({ message }) {
//   if (!message) return null;
//   const isError = message.startsWith('⚠️') || message.startsWith('❌');
//   return (
//     <div style={{
//       position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
//       background: isError ? '#7f1d1d' : '#166534', color: '#fff',
//       padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
//       boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: `1px solid ${isError ? '#ef444430' : '#22c55e30'}`,
//       animation: 'fadeSlideUp 0.2s ease forwards', display: 'flex', alignItems: 'center', gap: 8,
//     }}>
//       {message}
//     </div>
//   );
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Main component
// // ─────────────────────────────────────────────────────────────────────────────
// export default function AITraining({ onBrainUpdate }) {
//   const [messages, setMessages]       = useState([]);
//   const [input, setInput]             = useState('');
//   const [images, setImages]           = useState([]);
//   const [brain, setBrain]             = useState({ ...EMPTY_BRAIN });
//   const [dirty, setDirty]             = useState(false);
//   const [saving, setSaving]           = useState(false);
//   const [typing, setTyping]           = useState(false);
//   const [drawerOpen, setDrawerOpen]   = useState(false);
//   const [activeTab, setActiveTab]     = useState('chat');
//   const [analyzeResults, setAnalyzeResults] = useState(null);
//   const [analyzing, setAnalyzing]     = useState(false);
//   const [interview, setInterview]     = useState(null);
//   const [interviewDone, setInterviewDone] = useState(false);
//   const [saveToast, setSaveToast]     = useState(null);
//   const [showConsolidateModal, setShowConsolidateModal] = useState(false);
//   const [showDuplicatesModal, setShowDuplicatesModal]   = useState(false);

//   const bottomRef    = useRef(null);
//   const fileInputRef = useRef(null);
//   const docInputRef  = useRef(null);
//   const textareaRef  = useRef(null);
//   const toastTimer   = useRef(null);
//   const brainRef     = useRef(brain);

//   useEffect(() => { brainRef.current = brain; }, [brain]);

//   const dupeGroups = useMemo(() => detectDuplicates(brain), [brain]);
//   const dupeCount  = useMemo(
//     () => dupeGroups.reduce((s, c) => s + c.groups.reduce((ss, g) => ss + g.indexes.length - 1, 0), 0),
//     [dupeGroups]
//   );

//   const showToast = useCallback((msg, duration = 3500) => {
//     setSaveToast(msg);
//     if (toastTimer.current) clearTimeout(toastTimer.current);
//     toastTimer.current = setTimeout(() => setSaveToast(null), duration);
//   }, []);

//   useEffect(() => {
//     apiFetch('/ai/training/brain')
//       .then(d => {
//         if (d.brain) {
//           const loaded = { ...EMPTY_BRAIN, ...d.brain };
//           setBrain(loaded);
//           brainRef.current = loaded;
//         }
//       })
//       .catch(() => {});
//     return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
//   }, []);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages, typing, interview]);

//   useEffect(() => {
//     if (!dirty) return;
//     const timer = setTimeout(async () => {
//       try {
//         await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
//         setDirty(false);
//         onBrainUpdate?.();
//       } catch { /* silent */ }
//     }, 4000);
//     return () => clearTimeout(timer);
//   }, [brain, dirty]);

//   const addRule = useCallback((rule) => {
//     const meta = CATEGORY_META[rule.category];
//     if (!meta) return;
//     setBrain(prev => {
//       const list = prev[meta.brainKey] || [];
//       const ruleText = typeof rule === 'string' ? rule : rule.text;
//       const already = list.some(r => (typeof r === 'string' ? r : r.text) === ruleText);
//       if (already) return prev;
//       const next = { ...prev, [meta.brainKey]: [...list, { text: ruleText, source: rule.source || 'admin' }] };
//       brainRef.current = next;
//       return next;
//     });
//     setDirty(true);
//   }, []);

//   const addRules = useCallback((rules) => { rules.forEach(addRule); }, [addRule]);

//   const removeRule = useCallback(async (brainKey, index) => {
//     setBrain(prev => {
//       const list = [...(prev[brainKey] || [])];
//       list.splice(index, 1);
//       const next = { ...prev, [brainKey]: list };
//       brainRef.current = next;
//       return next;
//     });
//     await new Promise(r => setTimeout(r, 50));
//     try {
//       await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
//       setDirty(false); onBrainUpdate?.(); showToast('🗑️ Rule removed');
//     } catch (e) { showToast(`❌ Failed to remove rule: ${e.message}`); }
//   }, [onBrainUpdate, showToast]);

//   const bulkDeleteByKey = useCallback(async (byKey) => {
//     setBrain(prev => {
//       const next = { ...prev };
//       for (const [brainKey, indexes] of Object.entries(byKey)) {
//         const list = [...(prev[brainKey] || [])];
//         [...indexes].sort((a, b) => b - a).forEach(idx => list.splice(idx, 1));
//         next[brainKey] = list;
//       }
//       brainRef.current = next;
//       return next;
//     });
//     await new Promise(r => setTimeout(r, 50));
//     try {
//       await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
//       setDirty(false); onBrainUpdate?.();
//       const total = Object.values(byKey).reduce((s, arr) => s + arr.length, 0);
//       showToast(`🗑️ ${total} duplicate rule${total !== 1 ? 's' : ''} deleted`);
//     } catch (e) { showToast(`❌ Failed to delete duplicates: ${e.message}`); }
//   }, [onBrainUpdate, showToast]);

//   const saveBrain = useCallback(async () => {
//     setSaving(true);
//     try {
//       await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
//       setDirty(false); onBrainUpdate?.();
//       if (brainRef.current.suggestionSettings) {
//         try { localStorage.setItem('brain_suggestion_settings', JSON.stringify(brainRef.current.suggestionSettings)); } catch {}
//       }
//       addSystemMessage('✅ Brain saved — all future suggestions will use these rules.');
//     } catch (e) { addSystemMessage(`❌ Save failed: ${e.message}`); }
//     finally { setSaving(false); }
//   }, [onBrainUpdate]);

//   const handleConsolidateDone = useCallback(async () => {
//     try {
//       const fresh = await apiFetch('/ai/training/brain');
//       if (fresh.brain) {
//         const loaded = { ...EMPTY_BRAIN, ...fresh.brain };
//         setBrain(loaded); brainRef.current = loaded;
//       }
//       setDirty(false); onBrainUpdate?.();
//       addSystemMessage('🔀 Brain rules have been consolidated — merged and deduplicated.');
//     } catch { /* silent */ }
//   }, [onBrainUpdate]);

//   function addSystemMessage(text) {
//     setMessages(prev => [...prev, { id: Date.now(), role: 'system', content: text, time: nowTime() }]);
//   }

//   const handleImageFile = useCallback((file) => {
//     if (!file.type.startsWith('image/')) return;
//     const reader = new FileReader();
//     reader.onload = (e) => {
//       const img = new Image();
//       img.onload = () => {
//         const MAX = 1280;
//         let { width, height } = img;
//         if (width > MAX || height > MAX) {
//           if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
//           else { width = Math.round(width * MAX / height); height = MAX; }
//         }
//         const canvas = document.createElement('canvas');
//         canvas.width = width; canvas.height = height;
//         canvas.getContext('2d').drawImage(img, 0, 0, width, height);
//         const base64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
//         setImages(prev => [...prev, { base64, type: 'image/jpeg', name: file.name }]);
//       };
//       img.src = e.target.result;
//     };
//     reader.readAsDataURL(file);
//   }, []);

//   const handlePaste = useCallback((e) => {
//     const items = e.clipboardData?.items;
//     if (!items) return;
//     for (const item of items) {
//       if (item.type.startsWith('image/')) { e.preventDefault(); handleImageFile(item.getAsFile()); }
//     }
//   }, [handleImageFile]);

//   const send = useCallback(async (text, interviewCtx = null) => {
//     const msgText = text || input.trim();
//     if (!msgText && images.length === 0) return;

//     let finalMsg = msgText;
//     if (/bad suggestion|flagged|thumbs down|review bad/i.test(msgText)) {
//       try {
//         const bad = JSON.parse(localStorage.getItem('bad_suggestions') || '[]');
//         if (bad.length > 0) {
//           finalMsg += `\n\n[FLAGGED BAD SUGGESTIONS — ${bad.length} total]\n` +
//             bad.slice(0, 10).map((b, i) =>
//               `${i + 1}. Customer said: "${(b.customerMessage || '?').slice(0, 120)}"\n   Bad suggestion was: "${(b.suggestion || '').slice(0, 200)}"`
//             ).join('\n\n') +
//             `\n\nPlease analyze what's wrong with these suggestions and extract rules to prevent these patterns.`;
//           localStorage.removeItem('bad_suggestions');
//         } else { finalMsg += '\n\n[No flagged suggestions found yet.]'; }
//       } catch {}
//     }

//     const userMsg = { id: Date.now(), role: 'user', content: msgText, images: [...images], time: nowTime() };
//     setMessages(prev => [...prev, userMsg]);
//     setInput(''); setImages([]); setTyping(true);

//     const history = messages.slice(-14).map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content || '' }));

//     try {
//       const data = await apiFetch('/ai/training/chat', {
//         method: 'POST',
//         body: JSON.stringify({ message: finalMsg, images: userMsg.images, history, brain: brainRef.current, interviewContext: interviewCtx }),
//       });

//       setMessages(prev => [...prev, {
//         id: Date.now() + 1, role: 'ai', content: data.message,
//         type: data.type, ruleUpdates: data.ruleUpdates || [],
//         nextQuestion: data.nextQuestion, time: nowTime(),
//       }]);

//       try {
//         const fresh = await apiFetch('/ai/training/brain');
//         if (fresh.brain) {
//           const loaded = { ...EMPTY_BRAIN, ...fresh.brain };
//           setBrain(loaded); brainRef.current = loaded;
//         }
//         if (data.ruleUpdates?.length > 0) showToast(`✅ ${data.ruleUpdates.length} rule${data.ruleUpdates.length > 1 ? 's' : ''} saved to brain`);
//       } catch { /* silent */ }

//       setDirty(false); onBrainUpdate?.();
//     } catch (e) {
//       setMessages(prev => [...prev, { id: Date.now() + 1, role: 'system', content: `Error: ${e.message}`, time: nowTime() }]);
//     } finally { setTyping(false); }
//   }, [input, images, messages, showToast, onBrainUpdate]);

//   const handleDocFileWithSend = useCallback(async (file) => {
//     const allowed = ['application/pdf', 'text/plain', 'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
//     if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
//       addSystemMessage(`❌ Unsupported file type: ${file.name}`); return;
//     }
//     const formData = new FormData();
//     formData.append('file', file);
//     addSystemMessage(`📄 Reading "${file.name}"…`);
//     try {
//       const uploadRes = await fetch(`${API_BASE}/ai/training/upload-doc`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
//       if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
//       const uploadData = await uploadRes.json();
//       addSystemMessage(`✅ "${file.name}" read — ${uploadData.chars.toLocaleString()} chars. Extracting rules…`);
//       const extractRes = await fetch(`${API_BASE}/ai/training/extract-rules`, {
//         method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
//         body: JSON.stringify({ text: uploadData.text.slice(0, 30000), filename: file.name }),
//       });
//       if (!extractRes.ok) throw new Error(`Extraction failed: HTTP ${extractRes.status}`);
//       const extractData = await extractRes.json();
//       if (extractData.rules?.length > 0) {
//         try {
//           const fresh = await apiFetch('/ai/training/brain');
//           if (fresh.brain) { const loaded = { ...EMPTY_BRAIN, ...fresh.brain }; setBrain(loaded); brainRef.current = loaded; }
//         } catch { /* silent */ }
//         setDirty(false); onBrainUpdate?.();
//         showToast(`✅ ${extractData.rules.length} rules extracted from "${file.name}" and saved`);
//         addSystemMessage(`🧠 ${extractData.rules.length} rules extracted from "${file.name}" and saved to brain.`);
//         setMessages(prev => [...prev, {
//           id: Date.now(), role: 'ai',
//           content: extractData.summary || `I've extracted ${extractData.rules.length} rules from **${file.name}** and saved them directly to the brain. They're active now.`,
//           type: 'training', ruleUpdates: extractData.rules, time: nowTime(),
//         }]);
//       } else {
//         addSystemMessage(`⚠️ No rules could be extracted from "${file.name}". Try a more structured document.`);
//       }
//     } catch (e) { addSystemMessage(`❌ Failed to process "${file.name}": ${e.message}`); }
//   }, [onBrainUpdate, showToast]);

//   const answerInterviewQuestion = useCallback(async (question, answer) => {
//     const nextIndex = (interview?.currentIndex ?? 0) + 1;
//     const questions = interview?.questions || [];
//     await send(`(Interview question: "${question.text}")\n\nMy answer: ${answer}`, { questionText: question.text, hint: question.hint });
//     if (nextIndex >= questions.length) {
//       setInterview(null); setInterviewDone(true);
//       addSystemMessage('✅ Interview complete! All answers have been learned.');
//     } else {
//       setInterview(prev => ({ ...prev, currentIndex: nextIndex }));
//     }
//   }, [interview, send]);

//   const runAutoAnalyze = useCallback(async () => {
//     setAnalyzing(true);
//     addSystemMessage('🔍 Analyzing past conversations… this may take a minute.');
//     try {
//       const data = await apiFetch('/ai/training/auto-analyze', { method: 'POST', body: JSON.stringify({ limit: 300, batchSize: 15 }) });
//       setAnalyzeResults(data);
//       if (data.gaps?.length > 0) {
//         addSystemMessage(`Found ${data.rules.length} patterns and ${data.gaps.length} gaps. Generating interview questions…`);
//         try {
//           const qData = await apiFetch('/ai/training/proactive-questions', { method: 'POST', body: JSON.stringify({ gaps: data.gaps, rules: data.rules, brain: brainRef.current }) });
//           if (qData.questions?.length > 0) {
//             setMessages(prev => [...prev, { id: Date.now(), role: 'ai', content: qData.intro || 'I found some gaps in your conversations. Let me ask you a few questions.', type: 'answer', ruleUpdates: [], time: nowTime() }]);
//             setInterview({ questions: qData.questions, currentIndex: 0 });
//           }
//         } catch {}
//       }
//     } catch (e) { addSystemMessage(`❌ Analysis failed: ${e.message}`); }
//     finally { setAnalyzing(false); }
//   }, []);

//   useEffect(() => {
//     const ta = textareaRef.current;
//     if (!ta) return;
//     ta.style.height = 'auto';
//     ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
//   }, [input]);

//   function handleSend() {
//     const msg = input.trim();
//     if (!msg && !images.length) return;
//     if (/analyz|past conv|all conv|extract rules|auto.?analyz/i.test(msg) && !analyzing) {
//       setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: msg, time: nowTime() }]);
//       setInput('');
//       runAutoAnalyze();
//     } else {
//       send();
//     }
//   }

//   const currentQuestion = interview && !interviewDone ? interview.questions[interview.currentIndex] : null;
//   const ruleCount = Object.values(CATEGORY_META).reduce((sum, meta) => sum + (brain[meta.brainKey]?.length || 0), 0);
//   const showStarters = messages.length === 0;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
//         @keyframes tdBounce { 0%,80%,100%{transform:translateY(0);opacity:0.3}40%{transform:translateY(-5px);opacity:1} }
//         @keyframes fadeSlideUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
//         @keyframes pulse-green { 0%,100%{box-shadow:0 0 0 0 #34d39930}50%{box-shadow:0 0 0 6px #34d39908} }
//         .at-msg{animation:fadeSlideUp 0.2s ease forwards}
//         .at-starter:hover{background:#0f172a!important;border-color:#34d39950!important;color:#34d399!important;transform:translateY(-1px)}
//         .at-starter{transition:all 0.15s!important}
//         .at-send:hover:not(:disabled){background:#2dd4bf!important;transform:translateY(-1px)}
//         .at-send{transition:all 0.15s!important}
//         .at-tab:hover{color:#94a3b8!important}
//         .at-tab{transition:all 0.15s!important}
//         .at-img-btn:hover{border-color:#34d39960!important;color:#34d399!important}
//         .at-img-btn{transition:all 0.15s!important}
//         .at-analyze:hover:not(:disabled){opacity:0.85!important}
//         *{box-sizing:border-box}
//         ::-webkit-scrollbar{width:4px}
//         ::-webkit-scrollbar-track{background:transparent}
//         ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
//       `}</style>

//       <div
//         style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080b14', color: '#e2e8f0', fontFamily: "'DM Sans', sans-serif", position: 'relative' }}
//         onDrop={e => { e.preventDefault(); [...(e.dataTransfer?.files || [])].forEach(f => { if (f.type.startsWith('image/')) handleImageFile(f); else handleDocFileWithSend(f); }); }}
//         onDragOver={e => e.preventDefault()}
//       >
//         {/* Top bar */}
//         <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #0f172a', height: 56, flexShrink: 0, background: '#080b14' }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
//             <div style={{ width: 30, height: 30, borderRadius: 8, background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#34d399', flexShrink: 0 }}>⬡</div>
//             <div style={{ minWidth: 0 }}>
//               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//                 <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>Brain AI</span>
//                 <span style={{ fontSize: 11, color: '#34d399', background: '#34d39912', borderRadius: 20, padding: '1px 8px', border: '1px solid #34d39925', fontWeight: 600 }}>{ruleCount} rules</span>
//                 {dirty && <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2410', borderRadius: 20, padding: '1px 8px', border: '1px solid #fbbf2425', fontWeight: 600 }}>● unsaved</span>}
//               </div>
//             </div>
//           </div>
//           <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
//             {['chat', 'settings'].map(tab => (
//               <button key={tab} className="at-tab" onClick={() => setActiveTab(tab)} style={{
//                 background: activeTab === tab ? '#0f172a' : 'none',
//                 border: `1px solid ${activeTab === tab ? '#1e293b' : 'transparent'}`,
//                 color: activeTab === tab ? '#e2e8f0' : '#334155',
//                 borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400,
//               }}>{tab === 'settings' ? '⚙️ Quality' : '💬 Chat'}</button>
//             ))}
//             <div style={{ width: 1, height: 20, background: '#0f172a', margin: '0 2px' }} />
//             <button onClick={() => setDrawerOpen(true)} style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#64748b', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>🧠 Brain</button>
//             <button
//               onClick={() => setShowConsolidateModal(true)}
//               title="AI merges and deduplicates brain rules — with interactive review"
//               style={{ background: '#a78bfa12', border: '1px solid #a78bfa30', color: '#a78bfa', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
//             >🔀 Consolidate</button>
//             <button
//               onClick={() => setShowDuplicatesModal(true)}
//               title="Scan for duplicate rules and delete them"
//               style={{ background: dupeCount > 0 ? '#f8717112' : '#0f172a', border: '1px solid #1e293b', color: dupeCount > 0 ? '#f87171' : '#64748b', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
//             >🔍 Dupes{dupeCount > 0 ? ` (${dupeCount})` : ''}</button>
//             <button className="at-analyze" onClick={runAutoAnalyze} disabled={analyzing} style={{
//               background: analyzing ? '#0f172a' : '#34d39912', border: `1px solid ${analyzing ? '#1e293b' : '#34d39935'}`,
//               color: analyzing ? '#334155' : '#34d399', borderRadius: 7, padding: '5px 12px', fontSize: 12,
//               cursor: analyzing ? 'wait' : 'pointer', fontWeight: 500,
//             }}>{analyzing ? '⏳ Analyzing…' : '🔍 Analyze'}</button>
//             {dirty && <button onClick={saveBrain} disabled={saving} style={{ background: '#34d399', border: 'none', borderRadius: 7, color: '#000', padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving…' : '💾 Save'}</button>}
//           </div>
//         </div>

//         {/* Settings tab */}
//         {activeTab === 'settings' && (
//           <div style={{ flex: 1, overflowY: 'auto' }}>
//             <div style={{ maxWidth: 560, margin: '0 auto' }}>
//               <div style={{ padding: '28px 28px 0' }}>
//                 <h4 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>Suggestion Quality</h4>
//                 <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>Controls how the AI generates replies for all agents</p>
//               </div>
//               <SettingsPanel
//                 settings={brain.suggestionSettings}
//                 onChange={settings => {
//                   setBrain(prev => { const next = { ...prev, suggestionSettings: settings }; brainRef.current = next; return next; });
//                   setDirty(true);
//                 }}
//               />
//               {dirty && (
//                 <div style={{ padding: '0 28px 28px' }}>
//                   <button onClick={saveBrain} disabled={saving} style={{ background: '#34d399', border: 'none', borderRadius: 9, color: '#000', padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
//                     {saving ? 'Saving…' : '💾 Save changes'}
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}

//         {/* Chat tab */}
//         {activeTab === 'chat' && (
//           <>
//             <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0' }}>
//               {showStarters && (
//                 <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
//                   <div style={{ textAlign: 'center' }}>
//                     <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#34d399', animation: 'pulse-green 3s ease-in-out infinite' }}>⬡</div>
//                     <h3 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>Brain AI</h3>
//                     <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>What do you want to teach me today?</p>
//                   </div>
//                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
//                     {STARTERS.map((s, i) => (
//                       <button key={i} className="at-starter" onClick={() => send(s.text)} style={{ background: '#0d1117', border: '1px solid #0f172a', color: '#475569', borderRadius: 22, padding: '7px 16px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
//                         <span>{s.icon}</span><span>{s.label}</span>
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               )}

//               {messages.map((msg) => {
//                 if (msg.role === 'system') return (
//                   <div key={msg.id} className="at-msg" style={{ textAlign: 'center', margin: '12px 0' }}>
//                     <span style={{ fontSize: 11, color: '#334155', background: '#0d1117', borderRadius: 20, padding: '4px 14px', border: '1px solid #0f172a', display: 'inline-block' }}>{msg.content}</span>
//                   </div>
//                 );
//                 const isUser = msg.role === 'user';
//                 return (
//                   <div key={msg.id} className="at-msg" style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
//                     {!isUser && (
//                       <div style={{ width: 30, height: 30, borderRadius: 9, background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, color: '#34d399' }}>⬡</div>
//                     )}
//                     <div style={{ maxWidth: '74%' }}>
//                       <div style={{ background: isUser ? '#0f172a' : '#0d1117', borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px', padding: '11px 15px', border: `1px solid ${isUser ? '#1e293b' : '#0f172a'}` }}>
//                         {msg.images?.length > 0 && (
//                           <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
//                             {msg.images.map((img, i) => <img key={i} src={`data:${img.type};base64,${img.base64}`} alt="" style={{ maxWidth: 220, maxHeight: 180, borderRadius: 8, border: '1px solid #1e293b' }} />)}
//                           </div>
//                         )}
//                         <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: isUser ? '#cbd5e1' : '#94a3b8' }}>
//                           <MessageText text={msg.content} />
//                         </p>
//                       </div>
//                       {msg.ruleUpdates?.length > 0 && msg.type === 'mixed' && (
//                         <div style={{ marginTop: 8 }}>
//                           {msg.ruleUpdates.map((rule, i) => <RuleChip key={i} rule={rule} onAdd={addRule} />)}
//                         </div>
//                       )}
//                       {msg.ruleUpdates?.length > 0 && (msg.type === 'training' || msg.type === 'mixed') && (
//                         <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 2 }}>
//                           <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
//                           <span style={{ fontSize: 11, color: '#34d39980' }}>{msg.ruleUpdates.length} rule{msg.ruleUpdates.length > 1 ? 's' : ''} saved to brain</span>
//                         </div>
//                       )}
//                       <div style={{ fontSize: 10, color: '#1e293b', marginTop: 5, paddingLeft: 2 }}>{msg.time}</div>
//                     </div>
//                   </div>
//                 );
//               })}

//               {typing && (
//                 <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
//                   <div style={{ width: 30, height: 30, borderRadius: 9, background: '#34d39912', border: '1px solid #34d39930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#34d399' }}>⬡</div>
//                   <div style={{ background: '#0d1117', borderRadius: '4px 14px 14px 14px', padding: '12px 16px', border: '1px solid #0f172a' }}>
//                     <TypingDots />
//                   </div>
//                 </div>
//               )}

//               {currentQuestion && (
//                 <InterviewCard
//                   question={currentQuestion}
//                   index={interview.currentIndex}
//                   total={interview.questions.length}
//                   onAnswer={answerInterviewQuestion}
//                   onSkip={() => {
//                     const nextIndex = interview.currentIndex + 1;
//                     if (nextIndex >= interview.questions.length) { setInterview(null); setInterviewDone(true); }
//                     else setInterview(prev => ({ ...prev, currentIndex: nextIndex }));
//                   }}
//                 />
//               )}

//               <div ref={bottomRef} style={{ height: 20 }} />
//             </div>

//             {/* Input area */}
//             <div style={{ borderTop: '1px solid #0f172a', background: '#080b14', flexShrink: 0 }}>
//               <ImagePreview images={images} onRemove={i => setImages(prev => prev.filter((_, j) => j !== i))} />
//               <div style={{ display: 'flex', gap: 8, padding: '12px 16px', alignItems: 'flex-end' }}>
//                 <button className="at-img-btn" onClick={() => fileInputRef.current?.click()} title="Attach screenshot" style={{ background: '#0d1117', border: '1px solid #0f172a', color: '#334155', borderRadius: 9, padding: '9px 11px', fontSize: 15, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>🖼️</button>
//                 <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { [...e.target.files].forEach(handleImageFile); e.target.value = ''; }} />
//                 <button className="at-img-btn" onClick={() => docInputRef.current?.click()} title="Upload document (PDF, TXT, DOCX)" style={{ background: '#0d1117', border: '1px solid #0f172a', color: '#334155', borderRadius: 9, padding: '9px 11px', fontSize: 15, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>📄</button>
//                 <input ref={docInputRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleDocFileWithSend(e.target.files[0]); e.target.value = ''; }} />
//                 <textarea
//                   ref={textareaRef}
//                   value={input}
//                   onChange={e => setInput(e.target.value)}
//                   onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
//                   onPaste={handlePaste}
//                   placeholder="Teach the brain, ask a question, or paste a screenshot…"
//                   rows={1}
//                   style={{ flex: 1, background: '#0d1117', border: '1px solid #0f172a', borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif", minHeight: 42, maxHeight: 140 }}
//                   onFocus={e => e.target.style.borderColor = '#34d39940'}
//                   onBlur={e => e.target.style.borderColor = '#0f172a'}
//                 />
//                 <button className="at-send" onClick={handleSend} disabled={typing || (!input.trim() && !images.length)} style={{
//                   background: '#34d399', border: 'none', borderRadius: 9, color: '#000', fontWeight: 700, fontSize: 15,
//                   width: 42, height: 42, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
//                   opacity: (typing || (!input.trim() && !images.length)) ? 0.25 : 1,
//                 }}>↑</button>
//               </div>
//               <p style={{ fontSize: 10, color: '#0f172a', textAlign: 'center', margin: '0 0 10px', letterSpacing: '0.02em' }}>
//                 Ctrl+V to paste screenshots · Drag & drop images or docs · 📄 PDF / TXT / DOCX · Shift+Enter for new line
//               </p>
//             </div>
//           </>
//         )}
//       </div>

//       <BrainDrawer
//         brain={brain} open={drawerOpen} onClose={() => setDrawerOpen(false)}
//         onRemoveRule={removeRule} dirty={dirty} onSave={saveBrain} saving={saving}
//         dupeCount={dupeCount}
//         onReconsolidate={() => { setDrawerOpen(false); setShowConsolidateModal(true); }}
//         onFindDupes={() => { setDrawerOpen(false); setShowDuplicatesModal(true); }}
//       />

//       {analyzeResults && (
//         <ReviewModal results={analyzeResults} onAdd={rules => { addRules(rules); setAnalyzeResults(null); }} onClose={() => setAnalyzeResults(null)} />
//       )}

//       {showConsolidateModal && (
//         <ConsolidatePreviewModal
//           onClose={() => setShowConsolidateModal(false)}
//           onDone={handleConsolidateDone}
//           showToast={showToast}
//         />
//       )}

//       {showDuplicatesModal && (
//         <DuplicatesModal
//           brain={brain} dupeGroups={dupeGroups}
//           onDeleteIndexes={bulkDeleteByKey}
//           onClose={() => setShowDuplicatesModal(false)}
//         />
//       )}

//       <SaveToast message={saveToast} />
//     </>
//   );
// }
