import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

/**
 * QA AUTOMATION — admin only.
 *
 * Drop-in page for the agent dashboard. Self-contained: all styling is a
 * scoped <style> block with qa- prefixed classes so it cannot collide with
 * the rest of the app.
 *
 * All network calls go through the shared ApiService, so this page inherits
 * the app's base URL, bearer token, 401 session handling and no-store cache
 * policy rather than reimplementing them.
 *
 * Props:
 *   user  { role, ... }  current employee. Falls back to localStorage.
 */

const GRADE_COLOR = { A: '#10b981', B: '#22c55e', C: '#f59e0b', D: '#f97316', F: '#ef4444' };
const SEVERITY_COLOR = { critical: '#ef4444', major: '#f59e0b', minor: '#64748b', info: '#3b82f6' };
const NEUTRAL = '#8b93a7';

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('employee') || localStorage.getItem('user') || 'null'); }
  catch { return null; }
}

const isAbort = e => e?.name === 'AbortError';

export default function QAAutomation({ user: userProp }) {
  const user = userProp || readStoredUser();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(14);
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [violations, setViolations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null); // { text, tone: 'ok' | 'warn' }

  const [filters, setFilters] = useState({
    agentId: '', grade: '', criticalOnly: false, q: '', ruleId: '', sort: 'recent', page: 1,
  });

  // Held apart from `filters` on purpose. Typing straight into `filters` put
  // `loadReviews` in a new identity on every keystroke, which fired one paged
  // query per character. The search only commits on Enter.
  const [searchDraft, setSearchDraft] = useState('');

  const [draft, setDraft] = useState('');
  const [draftCustomer, setDraftCustomer] = useState('');
  const [draftUseAi, setDraftUseAi] = useState(false);
  const [draftResult, setDraftResult] = useState(null);
  const [draftBusy, setDraftBusy] = useState(false);

  const [rules, setRules] = useState(null);

  const dashAbort = useRef(null);
  const reviewsAbort = useRef(null);

  // ── Loaders ────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    dashAbort.current?.abort();
    const ctrl = new AbortController();
    dashAbort.current = ctrl;
    const { signal } = ctrl;

    setLoading(true); setError(null);
    try {
      const [h, o, lb, v] = await Promise.all([
        api.getQaHealth({ signal }),
        api.getQaOverview({ days, signal }),
        api.getQaLeaderboard({ days, signal }),
        api.getQaViolations({ days, signal }),
      ]);
      setHealth(h); setOverview(o); setLeaderboard(lb); setViolations(v);
    } catch (e) { if (!isAbort(e)) setError(e.message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, [days]);

  const loadReviews = useCallback(async () => {
    reviewsAbort.current?.abort();
    const ctrl = new AbortController();
    reviewsAbort.current = ctrl;
    const { signal } = ctrl;

    setLoading(true); setError(null);
    try {
      const data = await api.getQaReviews({
        days,
        page: filters.page,
        limit: 25,
        sort: filters.sort,
        agentId: filters.agentId || undefined,
        grade: filters.grade || undefined,
        criticalOnly: filters.criticalOnly || undefined,
        q: filters.q || undefined,
        ruleId: filters.ruleId || undefined,
        signal,
      });
      const list = data.reviews || [];
      setReviews(list);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      // Drop a detail pane pointing at a reply that is no longer in the list.
      setSelected(sel => (sel && list.some(r => r.id === sel.id) ? sel : null));
    } catch (e) { if (!isAbort(e)) setError(e.message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, [days, filters]);

  useEffect(() => { if (isAdmin) loadDashboard(); }, [isAdmin, loadDashboard]);
  useEffect(() => { if (isAdmin && tab === 'reviews') loadReviews(); }, [isAdmin, tab, loadReviews]);
  useEffect(() => {
    if (isAdmin && tab === 'rules' && !rules) {
      api.getQaRules().then(setRules).catch(e => setError(e.message));
    }
  }, [isAdmin, tab, rules]);
  useEffect(() => () => { dashAbort.current?.abort(); reviewsAbort.current?.abort(); }, []);

  // ── Actions ────────────────────────────────────────────────────────────

  const runScan = async (hours) => {
    setScanning(true); setBanner(null); setError(null);
    try {
      const r = await api.runQaScan({ hours, limit: 100, useAi: true });
      const parts = [
        `Scanned ${r.scanned} replies`,
        `graded ${r.reviewed}`,
        `skipped ${r.skipped} short ones`,
      ];
      if (r.failed) parts.push(`${r.failed} failed to grade`);
      if (r.avgScore != null) parts.push(`average ${r.avgScore}`);
      setBanner({ text: `${parts[0]} — ${parts.slice(1).join(', ')}.`, tone: r.failed ? 'warn' : 'ok' });
      await loadDashboard();
      if (tab === 'reviews') await loadReviews();
    } catch (e) {
      // A 409 means another instance already holds the scan lock. That is
      // normal coordination, not a failure, so it reads as a notice.
      if (/already running/i.test(e.message || '')) {
        setBanner({ text: e.message, tone: 'warn' });
      } else {
        setError(e.message);
      }
    }
    finally { setScanning(false); }
  };

  const checkDraft = async () => {
    if (!draft.trim()) return;
    setDraftBusy(true); setError(null);
    try {
      setDraftResult(await api.checkQaDraft({
        text: draft,
        customerMessage: draftCustomer || null,
        useAi: draftUseAi,
      }));
    } catch (e) { setError(e.message); }
    finally { setDraftBusy(false); }
  };

  const regrade = async (id) => {
    try {
      const updated = await api.regradeQaReview(id, { useAi: true });
      setSelected(updated);
      setReviews(rs => rs.map(r => (r.id === id ? { ...r, ...updated } : r)));
    } catch (e) { setError(e.message); }
  };

  const applySearch = () => setFilters(f => ({ ...f, q: searchDraft.trim(), page: 1 }));
  const clearSearch = () => { setSearchDraft(''); setFilters(f => ({ ...f, q: '', page: 1 })); };

  const agentOptions = useMemo(
    () => leaderboard.map(a => ({ id: a.agentId, name: a.agentName })),
    [leaderboard]
  );

  // ── Gate ───────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="qa-root">
        <Styles />
        <div className="qa-locked">
          <div className="qa-locked-icon">🔒</div>
          <h2>Admin access required</h2>
          <p>QA Automation is restricted to admin accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qa-root">
      <Styles />

      <header className="qa-head">
        <div>
          <h1>QA Automation</h1>
          <p className="qa-sub">
            Every outbound agent reply graded against the house voice.
            {health && (
              <> {' · '}{health.total} reviewed all-time · {health.last24h} in the last 24h ·
                {' '}AI grader {health.aiEnabled ? 'on' : 'off'} ·
                {' '}auto-scan {health.autoScan ? `every ${health.autoScanMinutes}m` : 'off'}</>
            )}
          </p>
        </div>
        <div className="qa-head-actions">
          <select className="qa-select" value={days}
                  onChange={e => { setDays(Number(e.target.value)); setFilters(f => ({ ...f, page: 1 })); }}>
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button className="qa-btn qa-btn-ghost" onClick={loadDashboard} disabled={loading}>Refresh</button>
          <button className="qa-btn qa-btn-primary" onClick={() => runScan(24)} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan last 24h'}
          </button>
          <button className="qa-btn qa-btn-ghost" onClick={() => runScan(168)} disabled={scanning}>Scan 7d</button>
        </div>
      </header>

      {banner && (
        <div className={`qa-banner qa-banner-${banner.tone === 'warn' ? 'warn' : 'ok'}`} onClick={() => setBanner(null)}>
          {banner.text}
        </div>
      )}
      {error && <div className="qa-banner qa-banner-err" onClick={() => setError(null)}>{error}</div>}

      <nav className="qa-tabs">
        {[['overview', 'Overview'], ['agents', 'Agents'], ['reviews', 'Replies'], ['checker', 'Draft checker'], ['rules', 'Rules']]
          .map(([id, label]) => (
            <button key={id} className={`qa-tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
      </nav>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <section className="qa-section">
          <div className="qa-stats">
            <Stat label="Replies graded" value={overview?.total ?? '—'} />
            <Stat label="Average score" value={overview?.avgScore ?? '—'} accent={scoreColor(overview?.avgScore)} />
            <Stat label="Pass rate (80+)" value={overview?.passRate != null ? `${overview.passRate}%` : '—'} />
            <Stat label="With a hard fail" value={overview?.withCritical ?? '—'} accent={overview?.withCritical ? '#ef4444' : undefined} />
            <Stat label="Agents covered" value={overview?.agents ?? '—'} />
          </div>

          <div className="qa-grid-2">
            <Card title="Grade spread">
              {overview?.distribution?.length ? (
                <div className="qa-dist">
                  {['A', 'B', 'C', 'D', 'F'].map(g => {
                    const n = overview.distribution.find(d => d.grade === g)?.n || 0;
                    const pct = overview.total ? (n / overview.total) * 100 : 0;
                    return (
                      <div key={g} className="qa-dist-row">
                        <span className="qa-dist-label" style={{ color: GRADE_COLOR[g] }}>{g}</span>
                        <div className="qa-dist-track">
                          <div className="qa-dist-fill" style={{ width: `${pct}%`, background: GRADE_COLOR[g] }} />
                        </div>
                        <span className="qa-dist-n">{n}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <Empty text="Nothing graded in this window yet. Run a scan." />}
            </Card>

            <Card title="Most broken rules" subtitle="Scored violations only. Advisories are excluded.">
              {violations.length ? (
                <ul className="qa-vlist">
                  {violations.slice(0, 10).map(v => (
                    <li key={v.rule_id}>
                      <button
                        className="qa-vlink"
                        onClick={() => { setFilters(f => ({ ...f, ruleId: v.rule_id, page: 1 })); setTab('reviews'); }}
                      >
                        <span className="qa-dot" style={{ background: SEVERITY_COLOR[v.severity] || NEUTRAL }} />
                        <span className="qa-vlabel">{v.label}</span>
                        <span className="qa-vcount">{v.n}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <Empty text="No violations recorded." />}
            </Card>
          </div>

          <Card title="Daily average">
            {overview?.trend?.length ? <Trend points={overview.trend} /> : <Empty text="Not enough history yet." />}
          </Card>
        </section>
      )}

      {/* ── AGENTS ── */}
      {tab === 'agents' && (
        <section className="qa-section">
          <Card title="Agent scorecard" subtitle="Sorted worst first. Click an agent to see their replies.">
            {leaderboard.length ? (
              <div className="qa-table-wrap">
                <table className="qa-table">
                  <thead>
                    <tr>
                      <th>Agent</th><th>Replies</th><th>Avg</th><th>Rules</th>
                      <th>Voice</th><th>Worst</th><th>Hard fails</th><th>Pass rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map(a => (
                      <tr key={a.agentId} className="qa-row"
                          onClick={() => { setFilters(f => ({ ...f, agentId: a.agentId, ruleId: '', page: 1 })); setTab('reviews'); }}>
                        <td className="qa-strong">{a.agentName}</td>
                        <td>{a.reviews}</td>
                        <td><ScorePill score={a.avgScore} /></td>
                        <td className="qa-muted">{a.avgRuleScore ?? '—'}</td>
                        <td className="qa-muted">{a.avgVoiceScore ?? '—'}</td>
                        <td className="qa-muted">{a.worstScore ?? '—'}</td>
                        <td style={{ color: a.criticalReplies ? '#ef4444' : undefined }}>{a.criticalReplies}</td>
                        <td>{a.passRate != null ? `${a.passRate}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty text="No agent data in this window." />}
          </Card>
        </section>
      )}

      {/* ── REVIEWS ── */}
      {tab === 'reviews' && (
        <section className="qa-section">
          <div className="qa-filters">
            <select className="qa-select" value={filters.agentId}
                    onChange={e => setFilters(f => ({ ...f, agentId: e.target.value, page: 1 }))}>
              <option value="">All agents</option>
              {agentOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="qa-select" value={filters.grade}
                    onChange={e => setFilters(f => ({ ...f, grade: e.target.value, page: 1 }))}>
              <option value="">Any grade</option>
              {['A', 'B', 'C', 'D', 'F'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="qa-select" value={filters.sort}
                    onChange={e => setFilters(f => ({ ...f, sort: e.target.value, page: 1 }))}>
              <option value="recent">Most recent</option>
              <option value="worst">Worst first</option>
              <option value="best">Best first</option>
            </select>
            <label className="qa-check">
              <input type="checkbox" checked={filters.criticalOnly}
                     onChange={e => setFilters(f => ({ ...f, criticalOnly: e.target.checked, page: 1 }))} />
              Hard fails only
            </label>
            <input className="qa-input" placeholder="Search reply text or agent, then press Enter"
                   value={searchDraft}
                   onChange={e => setSearchDraft(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') applySearch(); }} />
            <button className="qa-btn qa-btn-ghost" onClick={applySearch}
                    disabled={searchDraft.trim() === filters.q}>Search</button>
            {filters.q && (
              <button className="qa-chip" onClick={clearSearch}>“{filters.q}” ✕</button>
            )}
            {filters.ruleId && (
              <button className="qa-chip" onClick={() => setFilters(f => ({ ...f, ruleId: '', page: 1 }))}>
                rule: {filters.ruleId} ✕
              </button>
            )}
          </div>

          <div className="qa-split">
            <div className="qa-list">
              {loading && <Empty text="Loading…" />}
              {!loading && !reviews.length && <Empty text="No graded replies match these filters. Widen the window or clear a filter." />}
              {reviews.map(r => (
                <button key={r.id} className={`qa-item ${selected?.id === r.id ? 'is-active' : ''}`}
                        onClick={() => setSelected(r)}>
                  <div className="qa-item-top">
                    <ScorePill score={r.score} grade={r.grade} />
                    <span className="qa-item-agent">{r.agent_name || `#${r.agent_id}`}</span>
                    <span className="qa-item-date">{fmtDate(r.message_sent_at)}</span>
                  </div>
                  <div className="qa-item-body">{truncate(r.content, 160)}</div>
                  <div className="qa-item-tags">
                    {(r.rule_report?.violations || []).slice(0, 3).map(v => (
                      <span key={v.id} className="qa-tag" style={{ borderColor: SEVERITY_COLOR[v.severity], color: SEVERITY_COLOR[v.severity] }}>
                        {v.label}
                      </span>
                    ))}
                    {(r.rule_report?.violations?.length || 0) > 3 && (
                      <span className="qa-tag qa-tag-more">+{r.rule_report.violations.length - 3}</span>
                    )}
                  </div>
                </button>
              ))}

              {pagination.pages > 1 && (
                <div className="qa-pager">
                  <button className="qa-btn qa-btn-ghost" disabled={pagination.page <= 1}
                          onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Prev</button>
                  <span>{pagination.page} / {pagination.pages} · {pagination.total} replies</span>
                  <button className="qa-btn qa-btn-ghost" disabled={pagination.page >= pagination.pages}
                          onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next</button>
                </div>
              )}
            </div>

            <div className="qa-detail">
              {selected ? <ReviewDetail review={selected} onRegrade={() => regrade(selected.id)} />
                        : <Empty text="Pick a reply to see the full breakdown." />}
            </div>
          </div>
        </section>
      )}

      {/* ── CHECKER ── */}
      {tab === 'checker' && (
        <section className="qa-section">
          <div className="qa-grid-2">
            <Card title="Paste a draft" subtitle="Same engine that grades live replies. Nothing is saved.">
              <textarea className="qa-textarea qa-textarea-sm" rows={3} placeholder="What the customer wrote (optional, improves the AI pass)…"
                        value={draftCustomer} onChange={e => setDraftCustomer(e.target.value)} />
              <textarea className="qa-textarea" rows={10} placeholder="Paste the agent reply here…"
                        value={draft} onChange={e => setDraft(e.target.value)} />
              <div className="qa-checker-actions">
                <label className="qa-check">
                  <input type="checkbox" checked={draftUseAi} onChange={e => setDraftUseAi(e.target.checked)} />
                  Run the AI voice pass too
                </label>
                <button className="qa-btn qa-btn-primary" onClick={checkDraft} disabled={draftBusy || !draft.trim()}>
                  {draftBusy ? 'Checking…' : 'Check it'}
                </button>
              </div>
            </Card>
            <Card title="Result">
              {draftResult ? <Breakdown result={draftResult} /> : <Empty text="Paste a reply and hit check." />}
            </Card>
          </div>
        </section>
      )}

      {/* ── RULES ── */}
      {tab === 'rules' && (
        <section className="qa-section">
          <Card title="The reference reply" subtitle="This is the owner's own message. Everything is graded against it.">
            <pre className="qa-pre">{rules?.reference || 'Loading…'}</pre>
          </Card>
          {rules?.criticalCap != null && (
            <div className="qa-note">Any critical violation caps the reply at {rules.criticalCap}, whatever the AI pass says.</div>
          )}
          {rules && groupBy(rules.rules, 'group').map(([group, items]) => (
            <Card key={group} title={group}>
              <ul className="qa-rules">
                {items.map(r => (
                  <li key={r.id}>
                    <span className="qa-dot" style={{ background: SEVERITY_COLOR[r.severity] }} />
                    <div>
                      <div className="qa-strong">{r.label}</div>
                      {r.why && <div className="qa-muted">{r.why}</div>}
                      {r.fix && <div className="qa-fix">Fix: {r.fix}</div>}
                    </div>
                    <span className="qa-sev" style={{ color: SEVERITY_COLOR[r.severity] }}>{r.severity}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────────────────────────────── */

function ReviewDetail({ review, onRegrade }) {
  const rr = review.rule_report || {};
  const ai = review.ai_report || null;
  const advisories = rr.advisories || [];
  return (
    <div className="qa-detail-inner">
      <div className="qa-detail-head">
        <ScorePill score={review.score} grade={review.grade} large />
        <div>
          <div className="qa-strong">{review.agent_name || `#${review.agent_id}`}</div>
          <div className="qa-muted">
            Conversation #{review.conversation_id} · {fmtDate(review.message_sent_at)}
            {review.voice_score != null && ` · rules ${review.rule_score} / voice ${review.voice_score}`}
          </div>
        </div>
        <button className="qa-btn qa-btn-ghost" onClick={onRegrade}>Re-grade</button>
      </div>

      {review.customer_prompt && (
        <div className="qa-quote qa-quote-customer">
          <div className="qa-quote-label">Customer</div>
          <pre className="qa-pre">{review.customer_prompt}</pre>
        </div>
      )}

      <div className="qa-quote">
        <div className="qa-quote-label">Agent reply</div>
        <pre className="qa-pre">{review.content}</pre>
      </div>

      <div className="qa-metrics">
        <Metric label="Words" value={rr.wordCount} warn={rr.wordCount < 40 || rr.wordCount > 90} />
        <Metric label="Paragraphs" value={rr.paragraphCount} warn={rr.paragraphCount !== 2} />
        <Metric label="!" value={rr.exclamations} warn={rr.exclamations > 3 || rr.exclamations === 0} />
        <Metric label="CAPS" value={(rr.capsWords || []).length} warn={(rr.capsWords || []).length > 1} />
        <Metric label="Dropped '" value={rr.apostropheDrops} warn={rr.apostropheDrops === 0} />
      </div>

      {(rr.violations || []).length > 0 && (
        <div className="qa-block">
          <h4>Violations</h4>
          <ul className="qa-vdetail">
            {rr.violations.map(v => (
              <li key={v.id}>
                <span className="qa-sev" style={{ color: SEVERITY_COLOR[v.severity] }}>{v.severity}</span>
                <div>
                  <div className="qa-strong">{v.label}</div>
                  {v.detail && <div className="qa-muted">{v.detail}</div>}
                  {v.fix && <div className="qa-fix">{v.fix}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {advisories.length > 0 && (
        <div className="qa-block">
          <h4>Advisories <span className="qa-note-inline">not scored</span></h4>
          <ul className="qa-vdetail">
            {advisories.map(v => (
              <li key={v.id}>
                <span className="qa-sev" style={{ color: SEVERITY_COLOR.info }}>note</span>
                <div>
                  <div className="qa-strong">{v.label}</div>
                  {v.detail && <div className="qa-muted">{v.detail}</div>}
                  {v.fix && <div className="qa-fix">{v.fix}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ai && (
        <div className="qa-block">
          <h4>AI voice pass {ai.soundsLikeAi && <span className="qa-flag">reads as AI-written</span>}</h4>
          {ai.aiTell && <p className="qa-muted">Strongest tell: {ai.aiTell}</p>}
          <div className="qa-bars">
            {Object.entries(ai.scores || {}).map(([k, v]) => (
              <div key={k} className="qa-bar-row">
                <span className="qa-bar-label">{labelize(k)}</span>
                <div className="qa-bar-track"><div className="qa-bar-fill" style={{ width: `${(v / 5) * 100}%` }} /></div>
                <span className="qa-bar-n">{v}/5</span>
              </div>
            ))}
          </div>
          {ai.coaching && <p className="qa-coaching">{ai.coaching}</p>}
          {ai.betterVersion && (
            <div className="qa-quote qa-quote-good">
              <div className="qa-quote-label">How it should have read</div>
              <pre className="qa-pre">{ai.betterVersion}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Breakdown({ result }) {
  const rr = result.ruleReport || {};
  const advisories = rr.advisories || [];
  return (
    <div>
      <div className="qa-detail-head">
        <ScorePill score={result.score} grade={result.grade} large />
        <div className="qa-muted">
          Rules {rr.score}{result.voiceScore != null && ` · Voice ${result.voiceScore}`} · {rr.wordCount} words · {rr.paragraphCount} paragraphs
        </div>
      </div>

      {result.aiRequested && !result.aiRan && (
        <div className="qa-note">The AI voice pass did not run, so this is the rule score alone.</div>
      )}

      {(rr.violations || []).length ? (
        <ul className="qa-vdetail">
          {rr.violations.map(v => (
            <li key={v.id}>
              <span className="qa-sev" style={{ color: SEVERITY_COLOR[v.severity] }}>{v.severity}</span>
              <div>
                <div className="qa-strong">{v.label}</div>
                {v.detail && <div className="qa-muted">{v.detail}</div>}
                {v.fix && <div className="qa-fix">{v.fix}</div>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="qa-clean">Clean. Nothing to send back.</p>}

      {advisories.length > 0 && (
        <div className="qa-block">
          <h4>Advisories <span className="qa-note-inline">not scored</span></h4>
          <ul className="qa-vdetail">
            {advisories.map(v => (
              <li key={v.id}>
                <span className="qa-sev" style={{ color: SEVERITY_COLOR.info }}>note</span>
                <div>
                  <div className="qa-strong">{v.label}</div>
                  {v.detail && <div className="qa-muted">{v.detail}</div>}
                  {v.fix && <div className="qa-fix">{v.fix}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.ai?.betterVersion && (
        <div className="qa-quote qa-quote-good">
          <div className="qa-quote-label">Rewritten in the house voice</div>
          <pre className="qa-pre">{result.ai.betterVersion}</pre>
        </div>
      )}
    </div>
  );
}

function Trend({ points }) {
  const w = 720, h = 140, pad = 24;
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1));
  const ys = points.map(p => h - pad - ((p.avgScore || 0) / 100) * (h - pad * 2));
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg className="qa-trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Daily average QA score">
      {[0, 50, 80, 100].map(v => {
        const y = h - pad - (v / 100) * (h - pad * 2);
        return <line key={v} x1={pad} x2={w - pad} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.12" strokeDasharray={v === 80 ? '4 4' : ''} />;
      })}
      {/* A single day produces a moveto-only path, which draws nothing. The
          dots below carry it instead. */}
      {points.length > 1 && <path d={d} fill="none" stroke="#6366f1" strokeWidth="2" />}
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={points.length > 1 ? 3 : 4} fill="#6366f1" />)}
    </svg>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className="qa-stat"><div className="qa-stat-v" style={accent ? { color: accent } : undefined}>{value}</div><div className="qa-stat-l">{label}</div></div>
);

const Card = ({ title, subtitle, children }) => (
  <div className="qa-card">
    {title && <div className="qa-card-head"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>}
    <div className="qa-card-body">{children}</div>
  </div>
);

const Empty = ({ text }) => <div className="qa-empty">{text}</div>;

const Metric = ({ label, value, warn }) => (
  <div className={`qa-metric ${warn ? 'is-warn' : ''}`}><b>{value ?? '—'}</b><span>{label}</span></div>
);

function ScorePill({ score, grade, large }) {
  // No score means no grade. The old fallback painted "—" amber, which read as
  // a C at a glance.
  const g = grade || (score == null ? null : gradeOf(score));
  const c = g ? GRADE_COLOR[g] : NEUTRAL;
  return (
    <span className={`qa-pill ${large ? 'is-large' : ''}`} style={{ background: `${c}1a`, color: c, borderColor: `${c}55` }}>
      {score ?? '—'}{grade ? ` · ${grade}` : ''}
    </span>
  );
}

/* ── Utils ───────────────────────────────────────────────────────────────── */

function gradeOf(s) {
  if (s == null) return null;
  if (s >= 90) return 'A'; if (s >= 80) return 'B'; if (s >= 70) return 'C'; if (s >= 60) return 'D';
  return 'F';
}
const scoreColor = s => (s == null ? undefined : GRADE_COLOR[gradeOf(s)]);
const truncate = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''));
const fmtDate = d => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const labelize = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
function groupBy(items, key) {
  const map = new Map();
  for (const it of items || []) {
    const g = it[key] || 'Other';
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(it);
  }
  return [...map.entries()];
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

function Styles() {
  return (
    <style>{`
.qa-root{--qa-bg:#0f1117;--qa-panel:#161a23;--qa-line:#252b38;--qa-text:#e6e9ef;--qa-mute:#8b93a7;
  color:var(--qa-text);background:var(--qa-bg);min-height:100%;padding:24px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;box-sizing:border-box}
.qa-root *{box-sizing:border-box}
.qa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.qa-head h1{margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:-.01em}
.qa-sub{margin:0;color:var(--qa-mute);font-size:13px}
.qa-head-actions{display:flex;gap:8px;flex-wrap:wrap}
.qa-btn{border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid var(--qa-line);
  background:var(--qa-panel);color:var(--qa-text);transition:.15s}
.qa-btn:hover:not(:disabled){border-color:#3a4256}
.qa-btn:disabled{opacity:.5;cursor:not-allowed}
.qa-btn-primary{background:#6366f1;border-color:#6366f1;color:#fff}
.qa-btn-primary:hover:not(:disabled){background:#4f46e5}
.qa-btn-ghost:hover:not(:disabled){background:#1e2430}
.qa-select,.qa-input{border-radius:8px;padding:8px 12px;font-size:13px;background:var(--qa-panel);
  color:var(--qa-text);border:1px solid var(--qa-line);outline:none}
.qa-input{min-width:220px;flex:1}
.qa-banner{padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px;cursor:pointer}
.qa-banner-ok{background:#10b98118;color:#34d399;border:1px solid #10b98140}
.qa-banner-warn{background:#f59e0b18;color:#fbbf24;border:1px solid #f59e0b40}
.qa-banner-err{background:#ef444418;color:#f87171;border:1px solid #ef444440}
.qa-note{background:#6366f114;border:1px solid #6366f140;color:#a5b4fc;border-radius:8px;
  padding:10px 12px;font-size:12px;margin:0 0 4px}
.qa-note-inline{color:var(--qa-mute);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-left:6px}
.qa-tabs{display:flex;gap:4px;border-bottom:1px solid var(--qa-line);margin-bottom:20px;overflow-x:auto}
.qa-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--qa-mute);
  padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}
.qa-tab.is-active{color:var(--qa-text);border-bottom-color:#6366f1}
.qa-section{display:flex;flex-direction:column;gap:16px}
.qa-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.qa-stat{background:var(--qa-panel);border:1px solid var(--qa-line);border-radius:12px;padding:16px}
.qa-stat-v{font-size:26px;font-weight:700;line-height:1.1}
.qa-stat-l{color:var(--qa-mute);font-size:12px;margin-top:4px}
.qa-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.qa-card{background:var(--qa-panel);border:1px solid var(--qa-line);border-radius:12px;overflow:hidden}
.qa-card-head{padding:14px 16px;border-bottom:1px solid var(--qa-line)}
.qa-card-head h3{margin:0;font-size:14px;font-weight:700}
.qa-card-head p{margin:4px 0 0;color:var(--qa-mute);font-size:12px}
.qa-card-body{padding:16px}
.qa-empty{color:var(--qa-mute);font-size:13px;padding:24px;text-align:center}
.qa-dist{display:flex;flex-direction:column;gap:10px}
.qa-dist-row{display:flex;align-items:center;gap:10px}
.qa-dist-label{width:16px;font-weight:700}
.qa-dist-track{flex:1;height:8px;border-radius:4px;background:#ffffff10;overflow:hidden}
.qa-dist-fill{height:100%;border-radius:4px}
.qa-dist-n{width:36px;text-align:right;color:var(--qa-mute);font-size:12px}
.qa-vlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.qa-vlink{display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;color:var(--qa-text);
  padding:8px;border-radius:6px;cursor:pointer;font-size:13px;text-align:left}
.qa-vlink:hover{background:#ffffff08}
.qa-vlabel{flex:1}
.qa-vcount{color:var(--qa-mute);font-variant-numeric:tabular-nums}
.qa-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.qa-trend{width:100%;height:140px;color:var(--qa-text)}
.qa-table-wrap{overflow-x:auto}
.qa-table{width:100%;border-collapse:collapse;font-size:13px}
.qa-table th{text-align:left;padding:8px;color:var(--qa-mute);font-weight:600;font-size:11px;
  text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--qa-line)}
.qa-table td{padding:10px 8px;border-bottom:1px solid #ffffff08}
.qa-row{cursor:pointer}
.qa-row:hover{background:#ffffff06}
.qa-strong{font-weight:600}
.qa-muted{color:var(--qa-mute);font-size:12px}
.qa-fix{color:#60a5fa;font-size:12px;margin-top:2px}
.qa-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.qa-check{display:flex;align-items:center;gap:6px;color:var(--qa-mute);font-size:13px;cursor:pointer}
.qa-chip{background:#6366f120;border:1px solid #6366f150;color:#a5b4fc;border-radius:999px;
  padding:6px 12px;font-size:12px;cursor:pointer}
.qa-split{display:grid;grid-template-columns:minmax(300px,1fr) minmax(320px,1.2fr);gap:16px;align-items:start}
@media(max-width:900px){.qa-split{grid-template-columns:1fr}}
.qa-list{display:flex;flex-direction:column;gap:8px;max-height:70vh;overflow-y:auto}
.qa-item{background:var(--qa-panel);border:1px solid var(--qa-line);border-radius:10px;padding:12px;
  text-align:left;cursor:pointer;color:var(--qa-text)}
.qa-item:hover{border-color:#3a4256}
.qa-item.is-active{border-color:#6366f1;background:#6366f10d}
.qa-item-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.qa-item-agent{font-weight:600;font-size:13px}
.qa-item-date{margin-left:auto;color:var(--qa-mute);font-size:11px}
.qa-item-body{color:var(--qa-mute);font-size:12px;line-height:1.5;white-space:pre-wrap}
.qa-item-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.qa-tag{border:1px solid;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:600}
.qa-tag-more{border-color:var(--qa-line);color:var(--qa-mute)}
.qa-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--qa-mute);font-size:12px;padding:8px 0}
.qa-detail{background:var(--qa-panel);border:1px solid var(--qa-line);border-radius:12px;
  max-height:70vh;overflow-y:auto;position:sticky;top:16px}
.qa-detail-inner{padding:16px;display:flex;flex-direction:column;gap:14px}
.qa-detail-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.qa-detail-head>button{margin-left:auto}
.qa-pill{border:1px solid;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;
  font-variant-numeric:tabular-nums;white-space:nowrap}
.qa-pill.is-large{font-size:16px;padding:6px 14px}
.qa-quote{border-left:3px solid var(--qa-line);padding:8px 0 8px 12px}
.qa-quote-customer{border-left-color:#64748b}
.qa-quote-good{border-left-color:#10b981;margin-top:12px}
.qa-quote-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--qa-mute);margin-bottom:6px}
.qa-pre{white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;font-size:13px;line-height:1.6}
.qa-metrics{display:flex;gap:8px;flex-wrap:wrap}
.qa-metric{background:#ffffff08;border-radius:8px;padding:8px 12px;text-align:center;min-width:64px}
.qa-metric b{display:block;font-size:16px}
.qa-metric span{color:var(--qa-mute);font-size:10px}
.qa-metric.is-warn b{color:#f59e0b}
.qa-block h4{margin:0 0 8px;font-size:13px;font-weight:700}
.qa-vdetail{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.qa-vdetail li{display:flex;gap:10px;align-items:flex-start}
.qa-sev{font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:.04em;min-width:52px;margin-top:2px}
.qa-flag{background:#ef444420;color:#f87171;border-radius:999px;padding:2px 8px;font-size:10px;margin-left:6px}
.qa-bars{display:flex;flex-direction:column;gap:6px}
.qa-bar-row{display:flex;align-items:center;gap:10px;font-size:12px}
.qa-bar-label{width:110px;color:var(--qa-mute)}
.qa-bar-track{flex:1;height:6px;background:#ffffff10;border-radius:3px;overflow:hidden}
.qa-bar-fill{height:100%;background:#6366f1;border-radius:3px}
.qa-bar-n{width:30px;text-align:right;color:var(--qa-mute)}
.qa-coaching{background:#6366f114;border-left:3px solid #6366f1;padding:10px 12px;border-radius:0 8px 8px 0;
  font-size:13px;line-height:1.5;margin:12px 0 0}
.qa-textarea{width:100%;background:#0f1117;border:1px solid var(--qa-line);border-radius:8px;color:var(--qa-text);
  padding:12px;font-family:inherit;font-size:13px;line-height:1.6;resize:vertical;margin-bottom:10px;outline:none}
.qa-textarea:focus{border-color:#6366f1}
.qa-checker-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.qa-clean{color:#34d399;font-size:13px}
.qa-rules{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.qa-rules li{display:flex;gap:10px;align-items:flex-start}
.qa-rules li>div{flex:1}
.qa-rules .qa-dot{margin-top:6px}
.qa-locked{text-align:center;padding:80px 20px;color:var(--qa-mute)}
.qa-locked-icon{font-size:40px;margin-bottom:12px}
.qa-locked h2{color:var(--qa-text);margin:0 0 6px;font-size:18px}
    `}</style>
  );
}