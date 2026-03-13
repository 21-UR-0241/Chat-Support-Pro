import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = (import.meta.env.PROD 
  ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
  : '') + '/api';

const CATEGORY_META = {
  tone:    { color: '#60a5fa', label: 'Tone',    icon: '🎙️', brainKey: 'toneRules',       bg: '#60a5fa12' },
  avoid:   { color: '#f87171', label: 'Avoid',   icon: '🚫', brainKey: 'avoidPatterns',   bg: '#f8717112' },
  prefer:  { color: '#34d399', label: 'Prefer',  icon: '✅', brainKey: 'preferPatterns',  bg: '#34d39912' },
  product: { color: '#fbbf24', label: 'Product', icon: '💊', brainKey: 'productKnowledge', bg: '#fbbf2412' },
  policy:  { color: '#a78bfa', label: 'Policy',  icon: '📋', brainKey: 'customPolicies',  bg: '#a78bfa12' },
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

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#34d399',
          display: 'inline-block',
          animation: 'tdBounce 1.4s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
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
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: '#e2e8f0', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
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
      transition: 'all 0.2s',
    }}>
      <span style={{ fontSize: 13, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: meta.color, fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{meta.label}</span>
        <p style={{ margin: '0 0 8px', color: '#94a3b8', lineHeight: 1.5, fontSize: 12 }}>{rule.text}</p>
        <button onClick={() => { onAdd(rule); setAdded(true); }} disabled={added} style={{
          background: added ? `${meta.color}20` : 'transparent',
          border: `1px solid ${meta.color}${added ? '60' : '40'}`,
          color: added ? meta.color : `${meta.color}cc`,
          borderRadius: 5, padding: '3px 10px',
          fontSize: 11, cursor: added ? 'default' : 'pointer', fontWeight: 600,
          transition: 'all 0.2s', letterSpacing: '0.02em',
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
          <img src={`data:${img.type};base64,${img.base64}`} alt="" style={{
            width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #1e293b',
          }} />
          <button onClick={() => onRemove(i)} style={{
            position: 'absolute', top: -5, right: -5, width: 18, height: 18,
            borderRadius: '50%', background: '#f87171', border: '2px solid #080b14',
            color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: '14px',
            padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
      boxShadow: `0 0 24px ${meta.color}08`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{meta.icon}</span>
          <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
          <span style={{ fontSize: 10, color: '#334155', fontWeight: 500 }}>{index + 1} / {total}</span>
        </div>
        <button onClick={onSkip} style={{
          background: 'none', border: '1px solid #1e293b', color: '#475569',
          fontSize: 11, cursor: 'pointer', borderRadius: 5, padding: '3px 10px', transition: 'all 0.15s',
        }}>Skip →</button>
      </div>
      <p style={{ color: '#cbd5e1', fontSize: 14, margin: '0 0 8px', lineHeight: 1.6, fontWeight: 500 }}>{question.text}</p>
      {question.hint && (
        <p style={{ fontSize: 11, color: '#475569', margin: '0 0 14px', fontStyle: 'italic', lineHeight: 1.5 }}>
          💡 {question.hint}
        </p>
      )}
      {question.quickReplies?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {question.quickReplies.map((qr, i) => (
            <button key={i} onClick={() => onAnswer(question, qr)} style={{
              background: '#0f172a', border: `1px solid ${meta.color}30`,
              color: '#94a3b8', borderRadius: 20, padding: '5px 14px',
              fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
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
          style={{
            flex: 1, background: '#0f172a', border: '1px solid #1e293b',
            borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13,
            outline: 'none', transition: 'border-color 0.2s',
          }}
        />
        <button onClick={() => { if (custom.trim()) { onAnswer(question, custom); setCustom(''); } }} style={{
          background: meta.color, border: 'none', borderRadius: 8,
          color: '#000', padding: '8px 16px', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', transition: 'opacity 0.15s',
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
              cursor: 'pointer', fontWeight: active ? 700 : 400, transition: 'all 0.15s', flex: 1,
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

function BrainDrawer({ brain, open, onClose, onRemoveRule, dirty, onSave, saving }) {
  const totalRules = Object.values(CATEGORY_META).reduce((sum, meta) => sum + (brain[meta.brainKey] || []).length, 0);
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'opacity 0.2s', zIndex: 100,
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: '#080b14',
        borderLeft: '1px solid #0f172a',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
        zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '20px 22px', borderBottom: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#34d399', fontSize: 16 }}>⬡</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>Brain Rules</span>
              <span style={{ fontSize: 11, color: '#34d399', background: '#34d39915', borderRadius: 20, padding: '2px 8px', border: '1px solid #34d39930', fontWeight: 600 }}>{totalRules}</span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#334155' }}>Rules trained into the suggestion engine</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {dirty && (
              <button onClick={onSave} disabled={saving} style={{
                background: '#34d399', border: 'none', borderRadius: 7, color: '#000',
                padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              }}>{saving ? 'Saving…' : '💾 Save'}</button>
            )}
            <button onClick={onClose} style={{
              background: '#0f172a', border: '1px solid #1e293b', color: '#475569',
              fontSize: 16, cursor: 'pointer', borderRadius: 7, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const rules = brain[meta.brainKey] || [];
            if (!rules.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${meta.color}15` }}>
                  <span style={{ fontSize: 13 }}>{meta.icon}</span>
                  <span style={{ fontSize: 11, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
                  <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>{rules.length} rules</span>
                </div>
                {rules.map((r, i) => {
                  const text = typeof r === 'string' ? r : r.text;
                  return (
                    <div key={i} style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                      background: '#0d1117', borderRadius: 7, padding: '8px 10px', marginBottom: 4,
                      border: '1px solid #0f172a', transition: 'border-color 0.15s',
                    }}>
                      <span style={{ flex: 1, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{text}</span>
                      <button onClick={() => onRemoveRule(meta.brainKey, i)} style={{
                        background: 'none', border: 'none', color: '#1e293b', fontSize: 16,
                        cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, transition: 'color 0.15s',
                      }} title="Remove"
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#080b14', border: '1px solid #0f172a', borderRadius: 16,
        width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>Analysis Complete</h3>
            <span style={{ fontSize: 11, color: '#34d399', background: '#34d39915', borderRadius: 20, padding: '2px 10px', border: '1px solid #34d39930' }}>
              {results.totalConversations} conversations
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
            {results.message}. Select the rules to add to the brain.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 26px' }}>
          {results.rules.map((rule, i) => {
            const meta = CATEGORY_META[rule.category] || CATEGORY_META.prefer;
            const isSelected = selected.has(i);
            return (
              <div key={i} onClick={() => toggle(i)} style={{
                display: 'flex', gap: 12, padding: '11px 13px', borderRadius: 9, marginBottom: 6,
                background: isSelected ? meta.bg : '#0d1117',
                border: `1px solid ${isSelected ? meta.color + '35' : '#0f172a'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? meta.color : '#1e293b'}`,
                  background: isSelected ? meta.color : 'transparent',
                  flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                }}>
                  {isSelected && <span style={{ color: '#000', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {meta.icon} {meta.label}
                    </span>
                    {rule.confidence === 'high' && (
                      <span style={{ fontSize: 10, color: '#34d399', background: '#34d39915', borderRadius: 10, padding: '1px 6px' }}>⚡ high</span>
                    )}
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
            <button onClick={() => { onAdd([...selected].map(i => results.rules[i])); onClose(); }} style={{
              background: '#34d399', border: 'none', borderRadius: 8, color: '#000', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Add {selected.size} rules →</button>
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
      background: isError ? '#7f1d1d' : '#166534',
      color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      border: `1px solid ${isError ? '#ef444430' : '#22c55e30'}`,
      animation: 'fadeSlideUp 0.2s ease forwards',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function AITraining({ onBrainUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]);
  const [brain, setBrain] = useState({ ...EMPTY_BRAIN });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typing, setTyping] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [analyzeResults, setAnalyzeResults] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [interview, setInterview] = useState(null);
  const [interviewDone, setInterviewDone] = useState(false);
  const [saveToast, setSaveToast] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const textareaRef = useRef(null);
  const toastTimer = useRef(null);

  // ── brainRef: always holds latest brain so useCallback closures never go stale ──
  const brainRef = useRef(brain);
  useEffect(() => { brainRef.current = brain; }, [brain]);

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

  // Auto-save 4s after any brain change
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

  const removeRule = useCallback((brainKey, index) => {
    setBrain(prev => {
      const list = [...(prev[brainKey] || [])];
      list.splice(index, 1);
      const next = { ...prev, [brainKey]: list };
      brainRef.current = next;
      return next;
    });
    setDirty(true);
  }, []);

  const saveBrain = useCallback(async () => {
    setSaving(true);
    try {
      await apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: brainRef.current }) });
      setDirty(false);
      onBrainUpdate?.();
      if (brainRef.current.suggestionSettings) {
        try { localStorage.setItem('brain_suggestion_settings', JSON.stringify(brainRef.current.suggestionSettings)); } catch {}
      }
      addSystemMessage('✅ Brain saved — all future suggestions will use these rules.');
    } catch (e) {
      addSystemMessage(`❌ Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
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
        } else {
          finalMsg += '\n\n[No flagged suggestions found yet.]';
        }
      } catch {}
    }

    const userMsg = { id: Date.now(), role: 'user', content: msgText, images: [...images], time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImages([]);
    setTyping(true);

    const history = messages.slice(-14).map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content || '' }));

    try {
      const data = await apiFetch('/ai/training/chat', {
        method: 'POST',
        // ── brainRef.current: always sends latest brain, not stale closure value ──
        body: JSON.stringify({ message: finalMsg, images: userMsg.images, history, brain: brainRef.current, interviewContext: interviewCtx }),
      });

      const aiMsg = {
        id: Date.now() + 1, role: 'ai', content: data.message,
        type: data.type, ruleUpdates: data.ruleUpdates || [],
        nextQuestion: data.nextQuestion, time: nowTime(),
      };
      setMessages(prev => [...prev, aiMsg]);

      if (data.ruleUpdates?.length > 0) {
        setBrain(prev => {
          const updated = mergeBrainRules(prev, data.ruleUpdates);
          // ── update ref immediately so next send() sees the accumulated rules ──
          brainRef.current = updated;
          apiFetch('/ai/training/brain', { method: 'PUT', body: JSON.stringify({ brain: updated }) })
            .then(() => {
              setDirty(false);
              onBrainUpdate?.();
              showToast(`✅ ${data.ruleUpdates.length} rule${data.ruleUpdates.length > 1 ? 's' : ''} saved to brain`);
            })
            .catch(() => {
              showToast('⚠️ Rules extracted but save failed — click 💾 Save manually', 4500);
            });
          return updated;
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'system', content: `Error: ${e.message}`, time: nowTime() }]);
    } finally {
      setTyping(false);
    }
  }, [input, images, messages, showToast, onBrainUpdate]);

  const handleDocFileWithSend = useCallback(async (file) => {
    const allowed = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
      addSystemMessage(`❌ Unsupported file type: ${file.name}`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    addSystemMessage(`📄 Reading "${file.name}"…`);

    try {
      const uploadRes = await fetch(`${API_BASE}/ai/training/upload-doc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
      const uploadData = await uploadRes.json();
      addSystemMessage(`✅ "${file.name}" read — ${uploadData.chars.toLocaleString()} chars. Extracting rules…`);

      const extractRes = await fetch(`${API_BASE}/ai/training/extract-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        // ── brainRef.current here too ──
        body: JSON.stringify({ text: uploadData.text.slice(0, 30000), filename: file.name, brain: brainRef.current }),
      });
      if (!extractRes.ok) throw new Error(`Extraction failed: HTTP ${extractRes.status}`);
      const extractData = await extractRes.json();

      if (extractData.rules?.length > 0) {
        setBrain(prev => {
          const updated = mergeBrainRules(prev, extractData.rules);
          brainRef.current = updated;
          setDirty(false);
          onBrainUpdate?.();
          return updated;
        });
        showToast(`✅ ${extractData.rules.length} rules extracted from "${file.name}" and saved`);
        addSystemMessage(`🧠 ${extractData.rules.length} rules extracted from "${file.name}" and saved to brain.`);
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'ai',
          content: extractData.summary || `I've extracted ${extractData.rules.length} rules from **${file.name}** and saved them directly to the brain. They're active now.`,
          type: 'training', ruleUpdates: extractData.rules, time: nowTime(),
        }]);
      } else {
        addSystemMessage(`⚠️ No rules could be extracted from "${file.name}". Try a more structured document.`);
      }
    } catch (e) {
      addSystemMessage(`❌ Failed to process "${file.name}": ${e.message}`);
    }
  }, [onBrainUpdate, showToast]);

  const answerInterviewQuestion = useCallback(async (question, answer) => {
    const nextIndex = (interview?.currentIndex ?? 0) + 1;
    const questions = interview?.questions || [];
    await send(`(Interview question: "${question.text}")\n\nMy answer: ${answer}`, { questionText: question.text, hint: question.hint });
    if (nextIndex >= questions.length) {
      setInterview(null);
      setInterviewDone(true);
      addSystemMessage('✅ Interview complete! All answers have been learned.');
    } else {
      setInterview(prev => ({ ...prev, currentIndex: nextIndex }));
    }
  }, [interview, send]);

  const runAutoAnalyze = useCallback(async () => {
    setAnalyzing(true);
    addSystemMessage('🔍 Analyzing past conversations… this may take a minute.');
    try {
      const data = await apiFetch('/ai/training/auto-analyze', {
        method: 'POST', body: JSON.stringify({ limit: 300, batchSize: 15 }),
      });
      setAnalyzeResults(data);
      if (data.gaps?.length > 0) {
        addSystemMessage(`Found ${data.rules.length} patterns and ${data.gaps.length} gaps. Generating interview questions…`);
        try {
          const qData = await apiFetch('/ai/training/proactive-questions', {
            method: 'POST', body: JSON.stringify({ gaps: data.gaps, rules: data.rules, brain: brainRef.current }),
          });
          if (qData.questions?.length > 0) {
            setMessages(prev => [...prev, {
              id: Date.now(), role: 'ai',
              content: qData.intro || 'I found some gaps in your conversations. Let me ask you a few questions.',
              type: 'answer', ruleUpdates: [], time: nowTime(),
            }]);
            setInterview({ questions: qData.questions, currentIndex: 0 });
          }
        } catch {}
      }
    } catch (e) {
      addSystemMessage(`❌ Analysis failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
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
        @keyframes tdBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 #34d39930; }
          50%       { box-shadow: 0 0 0 6px #34d39908; }
        }
        .at-msg { animation: fadeSlideUp 0.2s ease forwards; }
        .at-starter:hover { background: #0f172a !important; border-color: #34d39950 !important; color: #34d399 !important; transform: translateY(-1px); }
        .at-starter { transition: all 0.15s !important; }
        .at-send:hover:not(:disabled) { background: #2dd4bf !important; transform: translateY(-1px); }
        .at-send { transition: all 0.15s !important; }
        .at-tab:hover { color: #94a3b8 !important; }
        .at-tab { transition: all 0.15s !important; }
        .at-img-btn:hover { border-color: #34d39960 !important; color: #34d399 !important; }
        .at-img-btn { transition: all 0.15s !important; }
        .at-analyze:hover:not(:disabled) { opacity: 0.85 !important; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>

      <div
        style={{
          display: 'flex', flexDirection: 'column', height: '100%',
          background: '#080b14', color: '#e2e8f0',
          fontFamily: "'DM Sans', sans-serif", position: 'relative',
        }}
        onDrop={e => {
          e.preventDefault();
          [...(e.dataTransfer?.files || [])].forEach(f => {
            if (f.type.startsWith('image/')) handleImageFile(f);
            else handleDocFileWithSend(f);
          });
        }}
        onDragOver={e => e.preventDefault()}
      >
        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '0 20px',
          borderBottom: '1px solid #0f172a', height: 56, flexShrink: 0, background: '#080b14',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: '#34d39912', border: '1px solid #34d39930',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#34d399', flexShrink: 0,
            }}>⬡</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>Brain AI</span>
                <span style={{ fontSize: 11, color: '#34d399', background: '#34d39912', borderRadius: 20, padding: '1px 8px', border: '1px solid #34d39925', fontWeight: 600 }}>{ruleCount} rules</span>
                {dirty && (
                  <span style={{ fontSize: 10, color: '#fbbf24', background: '#fbbf2410', borderRadius: 20, padding: '1px 8px', border: '1px solid #fbbf2425', fontWeight: 600 }}>● unsaved</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {['chat', 'settings'].map(tab => (
              <button key={tab} className="at-tab" onClick={() => setActiveTab(tab)} style={{
                background: activeTab === tab ? '#0f172a' : 'none',
                border: `1px solid ${activeTab === tab ? '#1e293b' : 'transparent'}`,
                color: activeTab === tab ? '#e2e8f0' : '#334155',
                borderRadius: 7, padding: '5px 12px', fontSize: 12,
                cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400,
              }}>{tab === 'settings' ? '⚙️ Quality' : '💬 Chat'}</button>
            ))}
            <div style={{ width: 1, height: 20, background: '#0f172a', margin: '0 2px' }} />
            <button onClick={() => setDrawerOpen(true)} style={{
              background: '#0f172a', border: '1px solid #1e293b', color: '#64748b',
              borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
            }}>🧠 Brain</button>
            <button className="at-analyze" onClick={runAutoAnalyze} disabled={analyzing} style={{
              background: analyzing ? '#0f172a' : '#34d39912',
              border: `1px solid ${analyzing ? '#1e293b' : '#34d39935'}`,
              color: analyzing ? '#334155' : '#34d399',
              borderRadius: 7, padding: '5px 12px', fontSize: 12,
              cursor: analyzing ? 'wait' : 'pointer', fontWeight: 500,
            }}>{analyzing ? '⏳ Analyzing…' : '🔍 Analyze'}</button>
            {dirty && (
              <button onClick={saveBrain} disabled={saving} style={{
                background: '#34d399', border: 'none', borderRadius: 7, color: '#000',
                padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              }}>{saving ? 'Saving…' : '💾 Save'}</button>
            )}
          </div>
        </div>

        {/* ── Settings tab ── */}
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
                  setBrain(prev => {
                    const next = { ...prev, suggestionSettings: settings };
                    brainRef.current = next;
                    return next;
                  });
                  setDirty(true);
                }}
              />
              {dirty && (
                <div style={{ padding: '0 28px 28px' }}>
                  <button onClick={saveBrain} disabled={saving} style={{
                    background: '#34d399', border: 'none', borderRadius: 9, color: '#000',
                    padding: '11px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%',
                  }}>{saving ? 'Saving…' : '💾 Save changes'}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Chat tab ── */}
        {activeTab === 'chat' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0' }}>
              {showStarters && (
                <div style={{ padding: '48px 0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
                      background: '#34d39912', border: '1px solid #34d39930',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, color: '#34d399', animation: 'pulse-green 3s ease-in-out infinite',
                    }}>⬡</div>
                    <h3 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>Brain AI</h3>
                    <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>What do you want to teach me today?</p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
                    {STARTERS.map((s, i) => (
                      <button key={i} className="at-starter" onClick={() => send(s.text)} style={{
                        background: '#0d1117', border: '1px solid #0f172a', color: '#475569',
                        borderRadius: 22, padding: '7px 16px', fontSize: 12,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span>{s.icon}</span><span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.role === 'system') {
                  return (
                    <div key={msg.id} className="at-msg" style={{ textAlign: 'center', margin: '12px 0' }}>
                      <span style={{
                        fontSize: 11, color: '#334155', background: '#0d1117',
                        borderRadius: 20, padding: '4px 14px', border: '1px solid #0f172a', display: 'inline-block',
                      }}>{msg.content}</span>
                    </div>
                  );
                }
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className="at-msg" style={{
                    display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
                    gap: 10, marginBottom: 20, alignItems: 'flex-start',
                  }}>
                    {!isUser && (
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, background: '#34d39912',
                        border: '1px solid #34d39930', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 13, flexShrink: 0, color: '#34d399',
                      }}>⬡</div>
                    )}
                    <div style={{ maxWidth: '74%' }}>
                      <div style={{
                        background: isUser ? '#0f172a' : '#0d1117',
                        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                        padding: '11px 15px', border: `1px solid ${isUser ? '#1e293b' : '#0f172a'}`,
                      }}>
                        {msg.images?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {msg.images.map((img, i) => (
                              <img key={i} src={`data:${img.type};base64,${img.base64}`} alt="" style={{
                                maxWidth: 220, maxHeight: 180, borderRadius: 8, border: '1px solid #1e293b',
                              }} />
                            ))}
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
                          <span style={{ fontSize: 11, color: '#34d39980' }}>
                            {msg.ruleUpdates.length} rule{msg.ruleUpdates.length > 1 ? 's' : ''} saved to brain
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#1e293b', marginTop: 5, paddingLeft: 2 }}>{msg.time}</div>
                    </div>
                  </div>
                );
              })}

              {typing && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, background: '#34d39912',
                    border: '1px solid #34d39930', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13, color: '#34d399',
                  }}>⬡</div>
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

            {/* ── Input area ── */}
            <div style={{ borderTop: '1px solid #0f172a', background: '#080b14', flexShrink: 0 }}>
              <ImagePreview images={images} onRemove={i => setImages(prev => prev.filter((_, j) => j !== i))} />
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', alignItems: 'flex-end' }}>
                <button className="at-img-btn" onClick={() => fileInputRef.current?.click()} title="Attach screenshot" style={{
                  background: '#0d1117', border: '1px solid #0f172a', color: '#334155',
                  borderRadius: 9, padding: '9px 11px', fontSize: 15, cursor: 'pointer', flexShrink: 0, lineHeight: 1,
                }}>🖼️</button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { [...e.target.files].forEach(handleImageFile); e.target.value = ''; }} />

                <button className="at-img-btn" onClick={() => docInputRef.current?.click()} title="Upload document (PDF, TXT, DOCX)" style={{
                  background: '#0d1117', border: '1px solid #0f172a', color: '#334155',
                  borderRadius: 9, padding: '9px 11px', fontSize: 15, cursor: 'pointer', flexShrink: 0, lineHeight: 1,
                }}>📄</button>
                <input ref={docInputRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) handleDocFileWithSend(e.target.files[0]); e.target.value = ''; }} />

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  onPaste={handlePaste}
                  placeholder="Teach the brain, ask a question, or paste a screenshot…"
                  rows={1}
                  style={{
                    flex: 1, background: '#0d1117', border: '1px solid #0f172a',
                    borderRadius: 10, padding: '10px 14px', color: '#e2e8f0',
                    fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.55,
                    fontFamily: "'DM Sans', sans-serif", minHeight: 42, maxHeight: 140,
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#34d39940'}
                  onBlur={e => e.target.style.borderColor = '#0f172a'}
                />
                <button className="at-send" onClick={handleSend}
                  disabled={typing || (!input.trim() && !images.length)} style={{
                    background: '#34d399', border: 'none', borderRadius: 9,
                    color: '#000', fontWeight: 700, fontSize: 15,
                    width: 42, height: 42, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: (typing || (!input.trim() && !images.length)) ? 0.25 : 1,
                  }}>↑</button>
              </div>
              <p style={{ fontSize: 10, color: '#0f172a', textAlign: 'center', margin: '0 0 10px', letterSpacing: '0.02em' }}>
                Ctrl+V to paste screenshots · Drag & drop images or docs · 📄 PDF / TXT / DOCX · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>

      <BrainDrawer
        brain={brain} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        onRemoveRule={removeRule} dirty={dirty} onSave={saveBrain} saving={saving}
      />

      {analyzeResults && (
        <ReviewModal
          results={analyzeResults}
          onAdd={rules => { addRules(rules); setAnalyzeResults(null); }}
          onClose={() => setAnalyzeResults(null)}
        />
      )}

      <SaveToast message={saveToast} />
    </>
  );
}