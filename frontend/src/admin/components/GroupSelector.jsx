import React, { useState, useEffect } from 'react';
import api from '../services/api';

// ── small color helpers (all tolerate a missing / non-hex color) ──
const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const c = hex.replace('#', '');
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return [r, g, b].some(Number.isNaN) ? null : { r, g, b };
};
const readableOn = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 150 ? '#0b141a' : '#ffffff';
};
const rgba = (hex, a) => {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})` : `rgba(100, 116, 139, ${a})`;
};
const initialsOf = (name) =>
  (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';

const NEUTRAL = '#94a3b8';

function GroupSelector({ employee, onSelectGroup, onLogout }) {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStoreGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load store groups:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (group) =>
    onSelectGroup(group.storeGroup, group.storeGroupName || group.storeGroup, group.color || null);

  const who = (employee?.name || '').trim().split(/\s+/)[0] || employee?.email || 'there';

  return (
    <div className="gs-wrap">
      <div className="gs-card">
        <div className="gs-brand">
          <span className="gs-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
                    fill="#ffffff" />
            </svg>
          </span>
          <span className="gs-brand-name">Chat Support Pro</span>
        </div>

        <h1 className="gs-title">Welcome back!</h1>
        <p className="gs-sub">Choose a store group to open</p>

        {error && (
          <div className="gs-error" role="alert">
            <div>
              <strong>Couldn't load store groups.</strong>
              <span>{error}</span>
            </div>
            <button className="gs-error-retry" onClick={loadGroups} type="button">Try again</button>
          </div>
        )}

        {loading ? (
          <div className="gs-loading">
            <div className="gs-spinner" />
            <p>Loading your groups…</p>
          </div>
        ) : groups.length === 0 && !error ? (
          <div className="gs-empty">
            <p>No store groups are available for your account. Ask an administrator to add you to one, then try again.</p>
            <button className="gs-empty-retry" onClick={loadGroups} type="button">Try again</button>
          </div>
        ) : (
          <div className="gs-grid">
            {groups.map((g, i) => {
              const color = g.color || NEUTRAL;
              const name  = g.storeGroupName || g.storeGroup || 'Untitled group';
              const count = g.storeCount;
              return (
                <button
                  key={g.storeGroup || i}
                  className="gs-tile"
                  style={{ '--c': color, '--c-soft': rgba(color, 0.18), '--c-faint': rgba(color, 0.10) }}
                  onClick={() => handleSelect(g)}
                  type="button"
                >
                  <span className="gs-strip" aria-hidden="true" />
                  <span className="gs-chip" style={{ background: color, color: readableOn(color) }}>
                    {initialsOf(name)}
                  </span>
                  <span className="gs-name" title={name}>{name}</span>
                  <span className="gs-count">
                    {count === 0 || count == null ? 'No stores yet' : `${count} store${count !== 1 ? 's' : ''}`}
                  </span>
                  <span className="gs-enter" aria-hidden="true">Open →</span>
                </button>
              );
            })}
          </div>
        )}

        <button className="gs-signout" onClick={onLogout} type="button">Sign out</button>
      </div>

      <style>{`
        .gs-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(900px 480px at 50% -12%, #eef2f8, transparent 62%),
            linear-gradient(180deg, #f7f8fa 0%, #eceff3 100%);
          -webkit-font-smoothing: antialiased;
        }

        .gs-card {
          width: 100%;
          max-width: 600px;
          background: #ffffff;
          border: 1px solid #edeef1;
          border-radius: 20px;
          padding: 34px 34px 24px;
          box-shadow: 0 24px 56px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.05);
          animation: gsRise 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .gs-brand { display: flex; align-items: center; gap: 9px; margin-bottom: 22px; }
        .gs-logo {
          width: 30px; height: 30px; border-radius: 9px;
          background: linear-gradient(135deg, #00a884, #048f70);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(0, 168, 132, 0.30);
        }
        .gs-brand-name {
          font-size: 14px; font-weight: 700; letter-spacing: -0.01em; color: #0f172a;
        }

        .gs-title {
          margin: 0 0 4px;
          font-size: 1.55rem; font-weight: 700; letter-spacing: -0.02em; color: #0f172a;
        }
        .gs-sub { margin: 0; color: #64748b; font-size: 0.92rem; line-height: 1.5; }

        .gs-error {
          margin-top: 18px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
          padding: 12px 14px;
        }
        .gs-error strong { display: block; color: #b91c1c; font-size: 13.5px; }
        .gs-error span   { color: #ef4444; font-size: 12.5px; }
        .gs-error-retry {
          flex-shrink: 0; background: #dc2626; color: #fff; border: none;
          border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s;
        }
        .gs-error-retry:hover { background: #b91c1c; }

        .gs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
          gap: 12px;
          margin: 22px 0 14px;
        }

        .gs-tile {
          position: relative;
          display: flex; flex-direction: column; align-items: flex-start;
          gap: 3px;
          text-align: left;
          padding: 20px 16px 16px;
          border: 1px solid #e6e8ec;
          border-radius: 14px;
          background: #fff;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
          animation: gsRise 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .gs-tile:hover {
          transform: translateY(-2px);
          border-color: var(--c);
          box-shadow: 0 12px 26px var(--c-soft);
        }
        .gs-tile:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }

        .gs-strip {
          position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: var(--c);
        }

        .gs-chip {
          width: 42px; height: 42px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; letter-spacing: 0.02em;
          margin-bottom: 10px;
          box-shadow: 0 2px 8px var(--c-soft);
        }

        .gs-name {
          font-weight: 700; color: #1e293b; font-size: 0.98rem; letter-spacing: -0.01em;
          max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .gs-count { font-size: 0.78rem; color: #94a3b8; font-weight: 500; }

        .gs-enter {
          margin-top: 8px;
          font-size: 0.78rem; font-weight: 700; color: var(--c);
          opacity: 0; transform: translateX(-4px);
          transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .gs-tile:hover .gs-enter { opacity: 1; transform: translateX(0); }

        .gs-signout {
          display: block; margin: 0 auto;
          background: none; border: none; color: #94a3b8;
          font-size: 0.84rem; font-weight: 500; cursor: pointer; padding: 4px 8px;
          transition: color 0.15s;
        }
        .gs-signout:hover { color: #64748b; text-decoration: underline; }

        .gs-loading { padding: 44px 0; text-align: center; }
        .gs-loading p { margin: 12px 0 0; color: #94a3b8; font-size: 0.88rem; }
        .gs-spinner {
          width: 34px; height: 34px; margin: 0 auto;
          border: 3px solid #e6e8ec; border-top-color: #00a884;
          border-radius: 50%; animation: gsSpin 0.8s linear infinite;
        }

        .gs-empty { padding: 24px 0 10px; text-align: center; }
        .gs-empty p { margin: 0 auto 16px; max-width: 380px; color: #64748b; font-size: 0.92rem; line-height: 1.55; }
        .gs-empty-retry {
          background: #fff; border: 1px solid #cbd5e1; border-radius: 8px;
          padding: 9px 18px; font-size: 13px; font-weight: 600; color: #334155;
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .gs-empty-retry:hover { background: #f4f6f9; border-color: #94a3b8; }

        @keyframes gsSpin { to { transform: rotate(360deg); } }
        @keyframes gsRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .gs-grid .gs-tile:nth-child(1) { animation-delay: 0.03s; }
        .gs-grid .gs-tile:nth-child(2) { animation-delay: 0.06s; }
        .gs-grid .gs-tile:nth-child(3) { animation-delay: 0.09s; }
        .gs-grid .gs-tile:nth-child(4) { animation-delay: 0.12s; }
        .gs-grid .gs-tile:nth-child(5) { animation-delay: 0.15s; }
        .gs-grid .gs-tile:nth-child(6) { animation-delay: 0.18s; }
        .gs-grid .gs-tile:nth-child(n+7) { animation-delay: 0.20s; }

        @media (max-width: 420px) {
          .gs-card { padding: 26px 20px 20px; border-radius: 16px; }
          .gs-title { font-size: 1.35rem; }
          .gs-grid { grid-template-columns: 1fr 1fr; }
        }

        @media (prefers-reduced-motion: reduce) {
          .gs-card, .gs-tile { animation: none !important; }
          .gs-tile, .gs-enter { transition: none !important; }
        }
      `}</style>
    </div>
  );
}

export default GroupSelector;