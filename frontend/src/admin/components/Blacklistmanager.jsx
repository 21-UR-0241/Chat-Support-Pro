import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const fmtFull = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fmtRelative = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso), diff = Date.now() - d, days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};
const isGlobal = (e) => !e.storeIdentifier && !e.store_identifier;
const getInitials = (email = '') => {
  const parts = email.split('@')[0].split(/[._-]/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : email.substring(0, 2)).toUpperCase();
};
const hashHue = (str = '') => {
  const hues = [0, 15, 200, 220, 260, 280, 320];
  let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return hues[Math.abs(h) % hues.length];
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
.bl-root * { box-sizing: border-box; font-family: 'DM Sans', system-ui, sans-serif; }
@keyframes blToastIn { from{opacity:0;transform:translateX(-50%) translateY(-10px) scale(0.96)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
@keyframes blModalIn { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes blRowIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes blSpin    { to{transform:rotate(360deg)} }
.bl-entry-row { background:#fff; border:1px solid #eef0f3; border-radius:14px; padding:16px 20px; display:flex; align-items:center; gap:16px; transition:box-shadow .18s,border-color .18s,transform .12s; animation:blRowIn .25s ease both; }
.bl-entry-row:hover { box-shadow:0 6px 24px rgba(220,38,38,.08); border-color:#fecaca; transform:translateY(-1px); }
.bl-remove-btn { background:#fff5f5; color:#dc2626; border:1.5px solid #fecaca; border-radius:9px; padding:7px 16px; font-size:12.5px; font-weight:600; cursor:pointer; transition:background .15s,color .15s,transform .1s; white-space:nowrap; flex-shrink:0; font-family:inherit; }
.bl-remove-btn:hover { background:#dc2626; color:#fff; transform:scale(1.04); }
.bl-scope-tab { padding:10px 20px; border:none; background:transparent; font-size:13px; font-weight:500; cursor:pointer; transition:color .15s; border-bottom:2.5px solid transparent; margin-bottom:-1px; font-family:inherit; white-space:nowrap; }
.bl-scope-tab.active { color:#dc2626; font-weight:700; border-bottom-color:#dc2626; }
.bl-scope-tab:not(.active) { color:#6b7280; }
.bl-scope-tab:not(.active):hover { color:#374151; }
.bl-search-input { width:100%; padding:10px 14px 10px 38px; border:1.5px solid #eef0f3; border-radius:12px; font-size:13.5px; outline:none; background:#f9fafb; color:#111827; transition:border-color .2s,background .2s,box-shadow .2s; font-family:inherit; }
.bl-search-input:focus { border-color:#dc2626; background:#fff; box-shadow:0 0 0 3px rgba(220,38,38,.08); }
.bl-search-input::placeholder { color:#9ca3af; }
.bl-modal-input { width:100%; padding:10px 14px; border:1.5px solid #eef0f3; border-radius:10px; font-size:14px; outline:none; background:#f9fafb; color:#111827; transition:border-color .2s,box-shadow .2s; font-family:inherit; box-sizing:border-box; }
.bl-modal-input:focus { border-color:#dc2626; background:#fff; box-shadow:0 0 0 3px rgba(220,38,38,.08); }
.bl-modal-input::placeholder { color:#9ca3af; }
.bl-scope-opt { flex:1; padding:14px 12px; border-radius:11px; cursor:pointer; text-align:left; transition:all .15s; outline:none; font-family:inherit; }
.bl-scope-opt.selected { border:2px solid #dc2626; background:#fff5f5; }
.bl-scope-opt:not(.selected) { border:2px solid #eef0f3; background:#f9fafb; }
.bl-scope-opt:not(.selected):hover { border-color:#fca5a5; }
.bl-submit-btn { display:flex; align-items:center; gap:7px; background:#dc2626; color:#fff; border:none; border-radius:10px; padding:11px 24px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; transition:background .15s,opacity .15s,transform .1s; box-shadow:0 2px 8px rgba(220,38,38,.28); }
.bl-submit-btn:hover:not(:disabled) { background:#b91c1c; transform:translateY(-1px); }
.bl-submit-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
.bl-cancel-btn { background:#f3f4f6; border:none; border-radius:10px; padding:11px 20px; font-size:14px; font-weight:500; cursor:pointer; color:#6b7280; font-family:inherit; transition:background .15s,color .15s; }
.bl-cancel-btn:hover:not(:disabled) { background:#e5e7eb; color:#374151; }
.bl-cancel-btn:disabled { opacity:.5; cursor:not-allowed; }
.bl-add-btn { display:flex; align-items:center; gap:7px; background:#dc2626; color:#fff; border:none; border-radius:10px; padding:9px 18px; font-size:13.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s,transform .1s,box-shadow .15s; box-shadow:0 2px 8px rgba(220,38,38,.25); }
.bl-add-btn:hover { background:#b91c1c; transform:translateY(-1px); box-shadow:0 4px 14px rgba(220,38,38,.32); }
.bl-back-btn { display:flex; align-items:center; gap:6px; background:transparent; border:1.5px solid #eef0f3; border-radius:9px; padding:8px 14px; font-size:13px; font-weight:500; color:#6b7280; cursor:pointer; font-family:inherit; transition:border-color .15s,color .15s; }
.bl-back-btn:hover { border-color:#d1d5db; color:#374151; }
.bl-refresh-btn { display:flex; align-items:center; gap:6px; background:#f3f4f6; border:none; border-radius:9px; padding:9px 16px; font-size:13px; font-weight:500; cursor:pointer; color:#6b7280; font-family:inherit; transition:background .15s,color .15s; }
.bl-refresh-btn:hover { background:#e5e7eb; color:#374151; }
.bl-page-btn { border:1.5px solid #eef0f3; background:#fff; border-radius:9px; padding:8px 18px; font-size:13px; font-family:inherit; cursor:pointer; color:#374151; transition:all .15s; }
.bl-page-btn:hover:not(:disabled) { border-color:#dc2626; color:#dc2626; }
.bl-page-btn:disabled { opacity:.4; cursor:not-allowed; }
.bl-stat { background:#fff; border:1px solid #eef0f3; border-radius:12px; padding:14px 18px; flex:1; text-align:center; transition:box-shadow .15s; }
.bl-stat:hover { box-shadow:0 4px 14px rgba(0,0,0,.06); }
`;

function AddEntryModal({ onClose, onAdd }) {
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState('store');
  const [storeIdentifier, setStore] = useState('');
  const [reason, setReason] = useState('');
  const [customerName, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) { setError('A valid email address is required.'); return; }
    if (scope === 'store' && !storeIdentifier.trim()) { setError('Store identifier is required for store-only blocks.'); return; }
    setError('');
    try {
      setSaving(true);
      const entry = await api.blacklistCustomer({
        email: email.trim(),
        storeIdentifier: scope === 'all' ? undefined : storeIdentifier.trim(),
        allStores: scope === 'all',
        reason: reason.trim() || undefined,
        customerName: customerName.trim() || undefined,
      });
      onAdd(entry);
    } catch (err) {
      setError(err.message || 'Failed to add entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const OVERLAY_STYLE = {
    position:'fixed',inset:0,zIndex:10001,
    background:'rgba(17,24,39,.65)',backdropFilter:'blur(4px)',
    display:'flex',alignItems:'center',justifyContent:'center',padding:20,
  };
  const CARD = {
    background:'#fff',borderRadius:18,width:'100%',maxWidth:500,
    boxShadow:'0 25px 60px rgba(0,0,0,.28)',overflow:'hidden',
    animation:'blModalIn .22s cubic-bezier(0.34,1.56,0.64,1)',
  };
  const LBL = { fontSize:11.5,fontWeight:700,color:'#374151',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em' };

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div style={CARD} onClick={e => e.stopPropagation()}>
        <div style={{ background:'linear-gradient(135deg,#dc2626 0%,#ef4444 100%)',padding:'20px 24px',display:'flex',alignItems:'center',gap:12 }}>
          <div style={{ width:44,height:44,borderRadius:12,background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>🚫</div>
          <div style={{ flex:1 }}>
            <div style={{ color:'#fff',fontWeight:800,fontSize:16,letterSpacing:'-0.01em' }}>Add to Blacklist</div>
            <div style={{ color:'rgba(255,255,255,.75)',fontSize:12.5,marginTop:1 }}>Block a customer from support</div>
          </div>
          <button type="button" onClick={onClose} style={{ background:'rgba(255,255,255,.18)',border:'none',borderRadius:'50%',width:32,height:32,cursor:'pointer',color:'#fff',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'22px 24px',display:'flex',flexDirection:'column',gap:18 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
            <div>
              <label style={LBL}>Email <span style={{ color:'#dc2626' }}>*</span></label>
              <input className="bl-modal-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="customer@email.com" autoFocus />
            </div>
            <div>
              <label style={LBL}>Name <span style={{ color:'#9ca3af',fontWeight:400,textTransform:'none' }}>(optional)</span></label>
              <input className="bl-modal-input" type="text" value={customerName} onChange={e=>setName(e.target.value)} placeholder="John Smith" />
            </div>
          </div>
          <div>
            <label style={LBL}>Block scope <span style={{ color:'#dc2626' }}>*</span></label>
            <div style={{ display:'flex',gap:10 }}>
              {[{value:'store',icon:'🏪',label:'Store only',sub:'One specific store'},{value:'all',icon:'🌐',label:'All stores',sub:'Network-wide block'}].map(opt => (
                <button key={opt.value} type="button" className={`bl-scope-opt ${scope===opt.value?'selected':''}`} onClick={()=>setScope(opt.value)}>
                  <div style={{ fontSize:22,marginBottom:6 }}>{opt.icon}</div>
                  <div style={{ fontSize:13,fontWeight:700,color:scope===opt.value?'#dc2626':'#111827',marginBottom:2 }}>{opt.label}</div>
                  <div style={{ fontSize:11,color:'#9ca3af' }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
          {scope === 'store' && (
            <div style={{ animation:'blRowIn .18s ease' }}>
              <label style={LBL}>Store identifier <span style={{ color:'#dc2626' }}>*</span></label>
              <input className="bl-modal-input" type="text" value={storeIdentifier} onChange={e=>setStore(e.target.value)} placeholder="peptides-toronto.myshopify.com" />
            </div>
          )}
          <div>
            <label style={LBL}>Reason <span style={{ color:'#9ca3af',fontWeight:400,textTransform:'none' }}>(optional)</span></label>
            <textarea className="bl-modal-input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Repeated chargebacks, abusive behaviour…" rows={3} style={{ resize:'vertical',lineHeight:1.5 }} />
          </div>
          {error && (
            <div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#dc2626',display:'flex',gap:8,alignItems:'center' }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display:'flex',justifyContent:'flex-end',gap:10,paddingTop:2 }}>
            <button type="button" onClick={onClose} disabled={saving} className="bl-cancel-btn">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={saving} className="bl-submit-btn">
              {saving ? '⏳ Saving…' : <><span>🚫</span> Blacklist Customer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoveModal({ entry, onConfirm, onClose, loading }) {
  const OVERLAY_STYLE = { position:'fixed',inset:0,zIndex:10001,background:'rgba(17,24,39,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 };
  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div style={{ background:'#fff',borderRadius:18,width:'100%',maxWidth:400,boxShadow:'0 25px 60px rgba(0,0,0,.22)',overflow:'hidden',animation:'blModalIn .22s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'32px 28px 0',textAlign:'center' }}>
          <div style={{ width:60,height:60,borderRadius:'50%',background:'#fef2f2',margin:'0 auto 18px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,border:'2px solid #fecaca' }}>✕</div>
          <div style={{ fontWeight:800,fontSize:18,color:'#111827',marginBottom:8,letterSpacing:'-0.02em' }}>Remove Block</div>
          <div style={{ fontSize:14,color:'#6b7280',lineHeight:1.7,marginBottom:6 }}>
            <strong style={{ color:'#111827' }}>{entry.email}</strong> will be unblocked from{' '}
            {isGlobal(entry) ? <><strong>all stores</strong> in your network</> : <><strong>{entry.storeIdentifier||entry.store_identifier}</strong></>}.
          </div>
          <div style={{ fontSize:12.5,color:'#9ca3af',marginBottom:28 }}>They can contact support again immediately.</div>
        </div>
        <div style={{ padding:'0 28px 28px',display:'flex',gap:10,justifyContent:'center' }}>
          <button type="button" onClick={onClose} disabled={loading} className="bl-cancel-btn" style={{ minWidth:100 }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="bl-submit-btn" style={{ minWidth:140 }}>
            {loading ? '⏳ Removing…' : '✓ Yes, Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryRow({ entry, onRemove, index }) {
  const store  = entry.storeIdentifier || entry.store_identifier;
  const by     = entry.blockedBy || entry.blocked_by;
  const reason = entry.reason;
  const name   = entry.customerName || entry.customer_name;
  const global = isGlobal(entry);
  const hue    = hashHue(entry.email);

  return (
    <div className="bl-entry-row" style={{ animationDelay:`${index*.04}s` }}>
      <div style={{ width:44,height:44,borderRadius:12,flexShrink:0,background:`hsl(${hue},65%,94%)`,border:`2px solid hsl(${hue},55%,82%)`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:`hsl(${hue},55%,38%)`,letterSpacing:'-0.02em' }}>
        {getInitials(entry.email)}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:5,flexWrap:'wrap' }}>
          <span style={{ fontWeight:700,fontSize:14,color:'#111827',letterSpacing:'-0.01em' }}>{entry.email}</span>
          {name && <span style={{ fontSize:12,color:'#9ca3af',fontStyle:'italic' }}>({name})</span>}
          <span style={{ display:'inline-flex',alignItems:'center',gap:4,background:global?'#fef2f2':'#eff6ff',color:global?'#dc2626':'#2563eb',borderRadius:6,padding:'2px 9px',fontSize:11,fontWeight:700,letterSpacing:'0.02em',border:`1px solid ${global?'#fecaca':'#bfdbfe'}` }}>
            {global ? '🌐 Network-wide' : `🏪 ${store}`}
          </span>
        </div>
        {reason && (
          <div style={{ fontSize:12.5,color:'#6b7280',marginBottom:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:500 }}>
            <span style={{ color:'#d1d5db',marginRight:4 }}>›</span>
            {reason.length > 90 ? reason.substring(0,90)+'…' : reason}
          </div>
        )}
        <div style={{ display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
          {by && <span style={{ fontSize:11.5,color:'#9ca3af' }}>by <strong style={{ color:'#6b7280',fontWeight:600 }}>{by}</strong></span>}
          <span style={{ fontSize:11.5,color:'#9ca3af',background:'#f9fafb',border:'1px solid #eef0f3',borderRadius:6,padding:'2px 8px' }}>{fmtRelative(entry.createdAt||entry.created_at)}</span>
          <span style={{ fontSize:11,color:'#d1d5db' }}>{fmtFull(entry.createdAt||entry.created_at)}</span>
        </div>
      </div>
      <button type="button" className="bl-remove-btn" onClick={()=>onRemove(entry)}>✕ Remove</button>
    </div>
  );
}

export default function BlacklistManager({ onBack }) {
  const [entries, setEntries]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(1);
  const [pagination, setPagination]     = useState(null);
  const [emailSearch, setEmailSearch]   = useState('');
  const [scopeTab, setScopeTab]         = useState('all');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving]         = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast]               = useState(null);
  const toastRef       = useRef(null);
  const searchDebounce = useRef(null);

  const showToast = (msg, type='success') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(()=>setToast(null), 3200);
  };
  useEffect(()=>()=>{ if(toastRef.current) clearTimeout(toastRef.current); if(searchDebounce.current) clearTimeout(searchDebounce.current); },[]);

  const load = useCallback(async (p=1, search=emailSearch) => {
    try {
      setLoading(true);
      const data = await api.getBlacklist({ page:p, limit:30, email:search.trim()||undefined });
      setEntries(data.entries||[]);
      setPagination(data.pagination||null);
      setPage(p);
    } catch(err) {
      showToast(`⚠️ Failed to load: ${err.message}`, 'error');
    } finally { setLoading(false); }
  }, [emailSearch]);

  useEffect(()=>{ load(1); },[]);

  const handleSearchChange = (val) => {
    setEmailSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(()=>load(1,val), 350);
  };

  const displayed = scopeTab==='all' ? entries : scopeTab==='global' ? entries.filter(e=>isGlobal(e)) : entries.filter(e=>!isGlobal(e));
  const handleRemove = (entry) => setRemoveTarget(entry);
  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      setRemoving(true);
      await api.removeBlacklistEntry(removeTarget.id);
      setEntries(prev=>prev.filter(e=>e.id!==removeTarget.id));
      if (pagination) setPagination(p=>({...p,total:Math.max(0,p.total-1)}));
      showToast(`✅ ${removeTarget.email} removed from blacklist`);
    } catch(err) { showToast(`⚠️ Remove failed: ${err.message}`,'error'); }
    finally { setRemoving(false); setRemoveTarget(null); }
  };
  const handleAdd = (newEntry) => {
    setEntries(prev=>[newEntry,...prev]);
    if (pagination) setPagination(p=>({...p,total:p.total+1}));
    setShowAddModal(false);
    showToast(`🚫 ${newEntry.email} added to blacklist`);
  };

  const totalAll    = pagination?.total ?? entries.length;
  const totalGlobal = entries.filter(e=>isGlobal(e)).length;
  const totalStore  = entries.filter(e=>!isGlobal(e)).length;

  return (
    <div className="bl-root" style={{ height:'100%',display:'flex',flexDirection:'column',background:'#f7f8fa',overflow:'hidden' }}>
      <style>{GLOBAL_CSS}</style>

      {toast && (
        <div style={{ position:'fixed',top:72,left:'50%',transform:'translateX(-50%)',zIndex:9999,background:toast.type==='error'?'#dc2626':'#111827',color:'#fff',fontSize:13,fontWeight:600,padding:'10px 24px',borderRadius:999,boxShadow:'0 8px 24px rgba(0,0,0,.22)',pointerEvents:'none',animation:'blToastIn .22s ease',whiteSpace:'nowrap' }}>
          {toast.msg}
        </div>
      )}
      {showAddModal  && <AddEntryModal onClose={()=>setShowAddModal(false)} onAdd={handleAdd} />}
      {removeTarget  && <RemoveModal entry={removeTarget} onConfirm={handleConfirmRemove} onClose={()=>setRemoveTarget(null)} loading={removing} />}

      {/* Header */}
      <div style={{ background:'#fff',flexShrink:0,borderBottom:'1px solid #eef0f3',boxShadow:'0 1px 6px rgba(0,0,0,.04)' }}>
        <div style={{ padding:'16px 28px',display:'flex',alignItems:'center',gap:14 }}>
          <button type="button" onClick={onBack} className="bl-back-btn">← Back</button>
          <div style={{ display:'flex',alignItems:'center',gap:12,flex:1 }}>
            <div style={{ width:44,height:44,borderRadius:13,background:'linear-gradient(135deg,#dc2626 0%,#ef4444 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,boxShadow:'0 4px 12px rgba(220,38,38,.28)' }}>🚫</div>
            <div>
              <div style={{ fontWeight:800,fontSize:18,color:'#111827',letterSpacing:'-0.02em',lineHeight:1.2 }}>Blacklist Manager</div>
              <div style={{ fontSize:12.5,color:'#9ca3af',marginTop:1 }}>{loading?'Loading…':`${totalAll} active block${totalAll!==1?'s':''}`}</div>
            </div>
          </div>
          <button type="button" onClick={()=>load(1)} className="bl-refresh-btn">🔄 Refresh</button>
          <button type="button" onClick={()=>setShowAddModal(true)} className="bl-add-btn"><span style={{fontSize:16}}>+</span> Add Entry</button>
        </div>

        {/* Search + tabs */}
        <div style={{ padding:'0 28px',display:'flex',alignItems:'center',gap:20,borderTop:'1px solid #f3f4f6' }}>
          <div style={{ position:'relative',width:300,paddingTop:10,paddingBottom:10 }}>
            <span style={{ position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#9ca3af',pointerEvents:'none' }}>🔍</span>
            <input className="bl-search-input" type="text" placeholder="Search by email…" value={emailSearch} onChange={e=>handleSearchChange(e.target.value)} />
            {emailSearch && (
              <button type="button" onClick={()=>handleSearchChange('')} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:13,padding:0 }}>✕</button>
            )}
          </div>
          <div style={{ display:'flex',gap:0,flex:1 }}>
            {[
              {key:'all',label:'All',count:totalAll},
              {key:'global',label:'🌐 Network-wide',count:totalGlobal},
              {key:'store',label:'🏪 Store-specific',count:totalStore},
            ].map(tab => (
              <button key={tab.key} type="button" className={`bl-scope-tab ${scopeTab===tab.key?'active':''}`} onClick={()=>setScopeTab(tab.key)}>
                {tab.label}
                <span style={{ marginLeft:6,background:scopeTab===tab.key?'#fef2f2':'#f3f4f6',color:scopeTab===tab.key?'#dc2626':'#9ca3af',borderRadius:999,padding:'1px 8px',fontSize:11.5,fontWeight:700 }}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      {!loading && pagination && (
        <div style={{ padding:'18px 28px 0',display:'flex',gap:12,maxWidth:920,margin:'0 auto',width:'100%',boxSizing:'border-box' }}>
          {[
            {label:'Total Blocked', value:pagination.total, color:'#dc2626', bg:'#fef2f2', icon:'🚫'},
            {label:'Network-wide',  value:totalGlobal,      color:'#dc2626', bg:'#fef2f2', icon:'🌐'},
            {label:'Store-specific',value:totalStore,       color:'#2563eb', bg:'#eff6ff', icon:'🏪'},
            {label:'Page',          value:`${page}/${pagination.pages||1}`, color:'#6b7280', bg:'#f9fafb', icon:'📄'},
          ].map(s => (
            <div key={s.label} className="bl-stat">
              <div style={{ fontSize:22,marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontWeight:800,fontSize:22,color:s.color,letterSpacing:'-0.02em' }}>{s.value}</div>
              <div style={{ fontSize:11.5,color:'#9ca3af',marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1,overflow:'auto',padding:'18px 28px 28px' }}>
        {loading ? (
          <div style={{ textAlign:'center',padding:'80px 20px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
            <div style={{ width:34,height:34,border:'3px solid #fee2e2',borderTopColor:'#dc2626',borderRadius:'50%',animation:'blSpin .75s linear infinite',marginBottom:14 }} />
            <div style={{ fontSize:14,color:'#9ca3af' }}>Loading blacklist…</div>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign:'center',padding:'80px 20px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
            <div style={{ fontSize:64,marginBottom:16,filter:'grayscale(.3)' }}>✅</div>
            <div style={{ fontWeight:800,fontSize:18,color:'#111827',marginBottom:6,letterSpacing:'-0.02em' }}>
              {emailSearch ? 'No matches found' : scopeTab!=='all' ? `No ${scopeTab==='global'?'network-wide':'store-specific'} blocks` : 'Blacklist is empty'}
            </div>
            <div style={{ fontSize:13.5,color:'#9ca3af',marginBottom:20 }}>
              {emailSearch ? `No entries match "${emailSearch}".` : 'No customers have been blacklisted yet.'}
            </div>
            <button type="button" onClick={()=>setShowAddModal(true)} className="bl-add-btn">+ Add First Entry</button>
          </div>
        ) : (
          <>
            <div style={{ display:'flex',flexDirection:'column',gap:10,maxWidth:920,margin:'0 auto' }}>
              {displayed.map((entry, i) => (
                <EntryRow key={entry.id} entry={entry} onRemove={handleRemove} index={i} />
              ))}
            </div>
            {pagination && pagination.pages > 1 && (
              <div style={{ display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:24 }}>
                <button type="button" disabled={page<=1} onClick={()=>load(page-1)} className="bl-page-btn">← Prev</button>
                <div style={{ display:'flex',gap:4 }}>
                  {Array.from({length:Math.min(pagination.pages,7)},(_,i)=>i+1).map(p=>(
                    <button key={p} type="button" onClick={()=>load(p)} style={{ width:36,height:36,borderRadius:9,border:`1.5px solid ${p===page?'#dc2626':'#eef0f3'}`,background:p===page?'#dc2626':'#fff',color:p===page?'#fff':'#374151',fontWeight:p===page?700:400,cursor:'pointer',fontSize:13,fontFamily:'inherit',transition:'all .15s' }}>{p}</button>
                  ))}
                </div>
                <button type="button" disabled={page>=pagination.pages} onClick={()=>load(page+1)} className="bl-page-btn">Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}