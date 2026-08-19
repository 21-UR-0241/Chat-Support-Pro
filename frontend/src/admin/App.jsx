

// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import api from './services/api';
// import { useConversations } from './hooks/useConversations';
// import { useWebSocket } from './hooks/useWebSocket';
// import ConversationList from './components/ConversationList';
// import ChatWindow from './components/ChatWindow';
// import Login from './components/Login';
// import GroupSelector from './components/GroupSelector';
// import EmployeeManagement from './components/EmployeeManagement';
// import ErrorBoundary from './components/ErrorBoundary';
// import MobileMenu from './components/MobileMenu';
// import ConversationNotes from './components/ConversationNotes';
// import AITraining from './components/AITraining';
// import StoreManagement from './components/StoreManagement';
// import ArchivedConversations from './components/Archivedconversations';
// import BlacklistManager from './components/Blacklistmanager';
// import PromoEmailBlast from './components/PromoEmailBlast';

// const DEFAULT_GROUP_COLOR = '#25d366';

// function App() {
//   const [employee, setEmployee] = useState(null);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [selectedGroup, setSelectedGroup]           = useState(null); // store_group slug, or null = "All Stores"
//   const [selectedGroupName, setSelectedGroupName]   = useState(null);
//   const [selectedGroupColor, setSelectedGroupColor] = useState(null);
//   const [groupChosen, setGroupChosen]               = useState(false); // has a group been picked THIS session?

//   useEffect(() => { checkAuth(); }, []);

//   const checkAuth = async () => {
//     const storedEmployee = localStorage.getItem('employee');
//     const token = localStorage.getItem('token');
//     if (storedEmployee && token) {
//       try {
//         const { employee: verified } = await api.verifyToken();
//         setEmployee(verified);
//         setIsAuthenticated(true);

//         const storedGroup = localStorage.getItem('selectedGroup');
//         if (storedGroup !== null && storedGroup !== '__all__') {
//           setSelectedGroup(storedGroup);
//           setSelectedGroupName(localStorage.getItem('selectedGroupName'));
//           setSelectedGroupColor(localStorage.getItem('selectedGroupColor') || null);
//           setGroupChosen(true);
//         } else if (storedGroup === '__all__') {
//           localStorage.removeItem('selectedGroup');
//           localStorage.removeItem('selectedGroupName');
//           localStorage.removeItem('selectedGroupColor');
//         }
//       } catch {
//         localStorage.removeItem('employee');
//         localStorage.removeItem('token');
//       }
//     }
//     setLoading(false);
//   };

//   const handleLogin = (data) => {
//     setEmployee(data);
//     setIsAuthenticated(true);
//     // Every fresh login re-asks which group to open
//     setGroupChosen(false);
//     setSelectedGroup(null);
//     setSelectedGroupName(null);
//     setSelectedGroupColor(null);
//     localStorage.removeItem('selectedGroup');
//     localStorage.removeItem('selectedGroupName');
//     localStorage.removeItem('selectedGroupColor');
//   };

//   const handleLogout = async () => {
//     try { await api.logout(); } catch { /* ignore */ }
//     localStorage.removeItem('employee');
//     localStorage.removeItem('token');
//     localStorage.removeItem('selectedGroup');
//     localStorage.removeItem('selectedGroupName');
//     localStorage.removeItem('selectedGroupColor');
//     setEmployee(null);
//     setIsAuthenticated(false);
//     setSelectedGroup(null);
//     setSelectedGroupName(null);
//     setSelectedGroupColor(null);
//     setGroupChosen(false);
//   };

//   const handleSelectGroup = (group, groupName, color) => {
//     localStorage.setItem('selectedGroup', group === null ? '__all__' : group);
//     localStorage.setItem('selectedGroupName', groupName || '');
//     localStorage.setItem('selectedGroupColor', color || '');
//     setSelectedGroup(group);
//     setSelectedGroupName(groupName);
//     setSelectedGroupColor(color || null);
//     setGroupChosen(true);
//   };

//   const handleSwitchGroup = () => setGroupChosen(false);

//   if (loading)          return <div className="loading-container"><div className="spinner" /></div>;
//   if (!isAuthenticated) return <Login onLogin={handleLogin} />;
//   if (!groupChosen)     return <GroupSelector employee={employee} onSelectGroup={handleSelectGroup} onLogout={handleLogout} />;

//   return (
//     <DashboardContent
//       employee={employee}
//       onLogout={handleLogout}
//       selectedGroup={selectedGroup}
//       selectedGroupName={selectedGroupName}
//       selectedGroupColor={selectedGroupColor}
//       onSwitchGroup={handleSwitchGroup}
//     />
//   );
// }


// function hexToRgbTriple(hex) {
//   if (!hex || typeof hex !== 'string') return null;
//   const clean = hex.replace('#', '');
//   if (clean.length !== 6) return null;
//   const r = parseInt(clean.substring(0, 2), 16);
//   const g = parseInt(clean.substring(2, 4), 16);
//   const b = parseInt(clean.substring(4, 6), 16);
//   if ([r, g, b].some(Number.isNaN)) return null;
//   return `${r}, ${g}, ${b}`;
// }

// function DashboardContent({ employee, onLogout, selectedGroup, selectedGroupName, selectedGroupColor, onSwitchGroup }) {
//   const [activePage,          setActivePage]          = useState('dashboard');
//   const [activeConversation,  setActiveConversation]  = useState(null);
//   const [stores,              setStores]              = useState([]);
//   const [stats,               setStats]               = useState(null);
//   const [storeGroups,         setStoreGroups]         = useState([]); // [{ storeGroup, storeGroupName, color }] for per-conversation group join
//   const [loadingStores,       setLoadingStores]       = useState(true);
//   const [error,               setError]               = useState(null);
//   const [wsStatus,            setWsStatus]            = useState('connecting'); // 'connecting' | 'live' | 'reconnecting'
//   const [wsReconnectAttempt,  setWsReconnectAttempt]  = useState(0);
//   const [mobileMenuOpen,      setMobileMenuOpen]      = useState(false);
//   const [showLogoutModal,     setShowLogoutModal]     = useState(false);
//   const [showNotesModal,      setShowNotesModal]      = useState(false);
//   const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
//   const [excludedConversationIds, setExcludedConversationIds] = useState(new Set());
//   const profileDropdownRef          = useRef(null);
//   const activeNotificationsRef      = useRef(new Map());
//   const markAsReadTimerRef          = useRef(new Map());
//   const activeConversationRef       = useRef(activeConversation);
//   const conversationsRef            = useRef([]);
//   const pendingUnblacklistEmailsRef = useRef(new Set());
//   const handlersRef                 = useRef(null);
//   const wsAuthedOnceRef             = useRef(false);
//   const audioCtxRef                 = useRef(null); // ← ADDED: WebAudio ctx for the primary beep path


//   const groupAccent    = selectedGroupColor || DEFAULT_GROUP_COLOR;
//   const groupAccentRgb = hexToRgbTriple(groupAccent) || '37, 211, 102'; // fallback matches DEFAULT_GROUP_COLOR

//   const headerColor   = selectedGroupColor || '#00a884';                // brand teal for "All Stores"
//   const headerRgb     = hexToRgbTriple(headerColor) || '0, 168, 132';
//   const [hr, hg, hb]  = headerRgb.split(',').map(n => parseInt(n, 10));
//   const headerIsLight = (hr * 299 + hg * 587 + hb * 114) / 1000 > 150;  // YIQ brightness
//   const headerFg      = headerIsLight ? '#0b141a' : '#ffffff';
//   const headerFgRgb   = headerIsLight ? '11, 20, 26' : '255, 255, 255';

//   const appStyle = {
//     '--group-accent':     groupAccent,
//     '--group-accent-rgb': groupAccentRgb,
//     '--header-color':     headerColor,
//     '--header-fg':        headerFg,
//     '--header-fg-rgb':    headerFgRgb,
//   };
//   const headerAccentStyle = {
//     background: `linear-gradient(180deg, rgba(${headerFgRgb}, 0.08) 0%, rgba(${headerFgRgb}, 0) 42%), ${headerColor}`,
//     color: headerFg,
//     borderBottom: '3px solid rgba(0, 0, 0, 0.16)',
//   };
//   const sidebarAccentStyle = { borderTop: `3px solid ${headerColor}` };


//   const ws = useWebSocket(employee.id);

//   const {
//     conversations, loading: conversationsLoading,
//     filters, updateFilters,
//     refresh: refreshConversations,
//     updateConversation, optimisticUpdate,
//     setActiveConversationId,
//     loadMore, hasMore, loadingMore,
//   } = useConversations(employee.id, ws, { storeGroup: selectedGroup || '' });

//   // ── Server-side conversation search ─────────────────────────────────────────
//   // While a query (≥2 chars) is active, results come from /api/conversations/search
//   // — which scans message bodies + name/email across the WHOLE group in Postgres,
//   // not just the loaded page. `searchResults === null` means "not in search mode",
//   // and the list falls back to the live paginated feed. The cancelled flag drops
//   // stale responses so a slow earlier query can't overwrite a newer keystroke's.
//   const [searchResults, setSearchResults] = useState(null);

//   useEffect(() => {
//     const q = (filters.search || '').trim();
//     if (q.length < 2) { setSearchResults(null); return; }
//     let cancelled = false;
//     const t = setTimeout(async () => {
//       try {
//         const rows = await api.searchConversations({
//           q,
//           storeGroup: selectedGroup || '',
//           storeId: filters.storeId || '',
//         });
//         if (!cancelled) setSearchResults(rows || []);
//       } catch (err) {
//         if (!cancelled) { console.error('[Search] Failed:', err); setSearchResults([]); }
//       }
//     }, 300);
//     return () => { cancelled = true; clearTimeout(t); };
//   }, [filters.search, filters.storeId, selectedGroup]);

//   // ── Name helper ───────────────────────────────────────────────────────────
// const getEmployeeName = (emp) => emp.employeeName || emp.name || 'Unknown';

//   // ── Exclusion set helpers ─────────────────────────────────────────────────

//   const removeFromExcluded = useCallback((conversationId) => {
//     setExcludedConversationIds(prev => {
//       const next = new Set(prev);
//       next.delete(String(conversationId));
//       return next;
//     });
//   }, []);

//   const removeEmailFromExcluded = useCallback((email) => {
//     if (!email) return;
//     setExcludedConversationIds(prev => {
//       const emailLower = email.toLowerCase().trim();
//       const idsToRemove = new Set(
//         conversationsRef.current
//           .filter(c => (c.customerEmail || c.customer_email || '').toLowerCase().trim() === emailLower)
//           .map(c => String(c.id))
//       );
//       if (!idsToRemove.size) return prev;
//       const next = new Set(prev);
//       idsToRemove.forEach(id => next.delete(id));
//       return next;
//     });
//   }, []);


//   const groupStoreKeys = React.useMemo(() => {
//     const s = new Set();
//     (stores || []).forEach((st) => {
//       if (st.storeIdentifier)  s.add('ident:' + String(st.storeIdentifier));
//       if (st.store_identifier) s.add('ident:' + String(st.store_identifier));
//       if (st.id != null)       s.add('id:'    + String(st.id));
//       if (st.shop_id != null)  s.add('id:'    + String(st.shop_id));
//     });
//     return s;
//   }, [stores]);

//   const isConversationInGroup = React.useCallback((c) => {
//     if (!selectedGroup) return true; // All Stores → no scoping
//     const ident = c.storeIdentifier || c.store_identifier;
//     if (ident && groupStoreKeys.has('ident:' + String(ident))) return true;
//     const shopId = c.shopId ?? c.shop_id ?? c.storeId;
//     if (shopId != null && groupStoreKeys.has('id:' + String(shopId))) return true;
//     return false;
//   }, [selectedGroup, groupStoreKeys]);

//   // ── visibleConversations ──────────────────────────────────────────────────
//   const visibleConversations = React.useMemo(
//     () => (conversations || []).filter(c =>
//       !excludedConversationIds.has(String(c.id)) &&
//       c.status !== 'archived'    &&
//       c.status !== 'blacklisted' &&
//       c.status !== 'blacklist'   &&
//       isConversationInGroup(c)
//     ),
//     [conversations, excludedConversationIds, isConversationInGroup]
//   );

//   // ── listConversations ─────────────────────────────────────────────────────
//   // The set actually handed to ConversationList. In search mode we use the
//   // server rows (already group-scoped + archived/blacklisted-filtered by the
//   // query), but still run them through the optimistic exclusion set so a
//   // just-archived/blocked row disappears instantly without waiting for a re-query.
//   const listConversations = React.useMemo(() => {
//     if (searchResults === null) return visibleConversations;
//     return searchResults.filter(c => !excludedConversationIds.has(String(c.id)));
//   }, [searchResults, visibleConversations, excludedConversationIds]);

//   useEffect(() => {
//     if (!conversations?.length || !excludedConversationIds.size) return;
//     if (!pendingUnblacklistEmailsRef.current.size) return;

//     const toRestore = conversations.filter(c => {
//       if (c.status !== 'open') return false;
//       if (!excludedConversationIds.has(String(c.id))) return false;
//       const email = (c.customerEmail || c.customer_email || '').toLowerCase().trim();
//       return pendingUnblacklistEmailsRef.current.has(email);
//     });

//     if (!toRestore.length) return;

//     setExcludedConversationIds(prev => {
//       const next = new Set(prev);
//       toRestore.forEach(c => next.delete(String(c.id)));
//       return next;
//     });

//     toRestore.forEach(c => {
//       const email = (c.customerEmail || c.customer_email || '').toLowerCase().trim();
//       pendingUnblacklistEmailsRef.current.delete(email);
//     });
//   }, [conversations, excludedConversationIds]);

//   // ── Sync refs ─────────────────────────────────────────────────────────────
//   useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
//   useEffect(() => { conversationsRef.current      = conversations;      }, [conversations]);

//   useEffect(() => { loadStores(); loadStats(); loadStoreGroups(); requestNotificationPermission(); }, []);

//   // ── AudioContext unlock (resilient) ─────────────────────────────────────────
//   // ← ADDED. Browsers only move a suspended AudioContext to "running" on a real
//   // user gesture, and new Audio().play() is likewise blocked until the tab has
//   // had one gesture. Prime BOTH here so the very first backgrounded message can
//   // beep. Re-arms on every gesture until the ctx is genuinely running, and
//   // re-resumes when the tab returns to the foreground (Chrome suspends WebAudio
//   // for background tabs — the support-dashboard-in-a-bg-tab case).
//   useEffect(() => {
//     const ensureRunning = () => {
//       try {
//         if (!audioCtxRef.current)
//           audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
//         if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
//       } catch { /* ignore */ }
//       // Prime the HTMLAudio autoplay allowance too (muted, no audible artifact).
//       try { const a = new Audio('/notification.mp3'); a.volume = 0; a.play().catch(() => {}); } catch { /* ignore */ }
//     };

//     const onGesture = () => {
//       ensureRunning();
//       if (audioCtxRef.current?.state === 'running') {
//         window.removeEventListener('pointerdown', onGesture);
//         window.removeEventListener('keydown', onGesture);
//       }
//     };
//     const onVisibility = () => {
//       if (document.visibilityState === 'visible') {
//         try { if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume(); } catch { /* ignore */ }
//       }
//     };

//     window.addEventListener('pointerdown', onGesture);
//     window.addEventListener('keydown', onGesture);
//     document.addEventListener('visibilitychange', onVisibility);
//     return () => {
//       window.removeEventListener('pointerdown', onGesture);
//       window.removeEventListener('keydown', onGesture);
//       document.removeEventListener('visibilitychange', onVisibility);
//     };
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target))
//         setProfileDropdownOpen(false);
//     };
//     if (profileDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [profileDropdownOpen]);

//   useEffect(() => {
//     // if (['employees','stores','blacklist','training'].includes(activePage) && employee.role !== 'admin')
//     if (['employees','stores','blacklist','training','promo'].includes(activePage) && employee.role !== 'admin')
//       setActivePage('dashboard');
//   }, [activePage, employee.role]);

//   useEffect(() => {
//     if (activeConversation) {
//       const updated = conversations.find(c => c.id === activeConversation.id);
//       if (updated && updated !== activeConversation) setActiveConversation(updated);
//     }
//   }, [conversations]);

//   useEffect(() => {
//     if (!activeConversation) setActiveConversationId(null);
//   }, [activeConversation, setActiveConversationId]);

//   // ── Conversation actions ──────────────────────────────────────────────────

//   const handleMarkAsRead = useCallback((conversationId) => {
//     updateConversation(conversationId, { unreadCount: 0, unread_count: 0, unread: 0 });
//     if (markAsReadTimerRef.current.has(conversationId)) clearTimeout(markAsReadTimerRef.current.get(conversationId));
//     markAsReadTimerRef.current.set(conversationId, setTimeout(async () => {
//       try { await api.markConversationRead(conversationId); } catch { /* ignore */ }
//       markAsReadTimerRef.current.delete(conversationId);
//     }, 300));
//   }, [updateConversation]);

//   const handleMarkAsUnread = useCallback(async (conversationId) => {
//     updateConversation(conversationId, { unreadCount: 1, unread_count: 1, unread: 1 });
//     const cur = activeConversationRef.current;
//     if (cur && String(cur.id) === String(conversationId)) {
//       setActiveConversation(null); setActiveConversationId(null);
//     }
//     try { await api.markConversationUnread(conversationId); }
//     catch { updateConversation(conversationId, { unreadCount: 0, unread_count: 0, unread: 0 }); }
//   }, [updateConversation, setActiveConversationId]);

//   const handleArchive = useCallback(async (conversationId) => {
//     try {
//       await api.archiveConversation(conversationId);
//       updateConversation(conversationId, { status: 'archived' });
//       setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
//       const cur = activeConversationRef.current;
//       if (cur && String(cur.id) === String(conversationId)) {
//         setActiveConversation(null); setActiveConversationId(null);
//       }
//     } catch (err) { console.error('[Archive] Failed:', err); }
//   }, [updateConversation, setActiveConversationId]);

//   const handleUnarchive = useCallback(async (conversationId) => {
//     try {
//       await api.unarchiveConversation(conversationId);
//       updateConversation(conversationId, { status: 'open', archivedAt: null });
//       removeFromExcluded(conversationId);
//       refreshConversations();
//     } catch (err) { console.error('[Unarchive] Failed:', err); }
//   }, [updateConversation, removeFromExcluded, refreshConversations]);

//   const handleBlacklist = useCallback(async (payload) => {
//     try {
//       await api.blacklistCustomer(payload);
//       const conversationId = payload.conversationId || payload.conversation_id;
//       if (conversationId) {
//         setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
//         updateConversation(conversationId, { status: 'blacklisted' });
//         const cur = activeConversationRef.current;
//         if (cur && String(cur.id) === String(conversationId)) {
//           setActiveConversation(null); setActiveConversationId(null);
//         }
//       }
//       refreshConversations();
//     } catch (err) { console.error('[Blacklist] Failed:', err); }
//   }, [updateConversation, setActiveConversationId, refreshConversations]);

//   const handleUnblacklist = useCallback(async ({ id, email }) => {
//     try {
//       await api.removeFromBlacklist(id);
//       if (email) {
//         pendingUnblacklistEmailsRef.current.add(email.toLowerCase().trim());
//       }
//       await refreshConversations();
//     } catch (err) {
//       console.error('[Unblacklist] Failed:', err);
//       throw err;
//     }
//   }, [refreshConversations]);

//   const handleBlockFromList = useCallback(async (conversationId) => {
//     const conv = conversationsRef.current.find(c => String(c.id) === String(conversationId));
//     if (!conv) { console.warn('[BlockFromList] Not found:', conversationId); return; }
//     await handleBlacklist({
//       email:           conv.customerEmail || conv.customer_email || '',
//       storeIdentifier: conv.storeIdentifier || conv.store_identifier || conv.shopDomain || conv.shop_domain || '',
//       allStores:       false,
//       reason:          'Blocked via conversation list',
//       customerName:    conv.customerName || conv.customer_name || '',
//       conversationId,
//     });
//   }, [handleBlacklist]);

//   const handleSelectConversation = useCallback((conversation) => {
//     setActiveConversation(conversation);
//     setActiveConversationId(conversation.id);
//     const unread = conversation.unreadCount || conversation.unread_count || conversation.unread || 0;
//     if (unread > 0) handleMarkAsRead(conversation.id);
//   }, [handleMarkAsRead, setActiveConversationId]);


//   const handleSendMessage = async (conversation, message, fileData, clientMsgId) => {
//     const storeId = conversation.shopId || conversation.shop_id || conversation.storeId;
//     if (!storeId) throw new Error('Store ID is missing from conversation');
//     clearNotificationsForConversation(conversation.id);
//     handleMarkAsRead(conversation.id);
//     optimisticUpdate(conversation.id, message);
//     try {
//       const sent = await api.sendMessage({
//         conversationId: conversation.id, storeId,
//         senderType: 'agent', senderName: 'Customer Support',
//         content: message || '', fileData: fileData || null,
//         clientMsgId,                         // ← forward the client id
//       });
//       if (sent.createdAt) updateConversation(conversation.id, { lastMessageAt: sent.createdAt });
//       return { ...sent, clientMsgId };       // ← ensure it's present on the return
//     } catch (err) { refreshConversations(); throw err; }
//   };


// const handleTyping = (isTyping) => {
//   if (activeConversation && ws) ws.sendTyping(activeConversation.id, isTyping);
// };

//   useEffect(() => {
//     if (!ws) return;

//     const u1 = ws.on('new_message', (data) => {
//       const h          = handlersRef.current;
//       const curConv    = activeConversationRef.current;
//       const curList    = conversationsRef.current;
//       const msg        = data.message || {};
//       const sender     = msg.senderType || msg.sender_type;
//       const convId     = data.conversationId || msg.conversationId
//                        || data.conversation_id || msg.conversation_id; // ← CHANGED: tolerate snake_case id
//       const isActive   = curConv?.id === convId;
//       const isAutoReply = msg.isAutoReply === true;
//       const patch = {};

//       if (!convId) return; // ← ADDED: no id → nothing we can safely target

//       if (!isAutoReply) {
//         patch.lastMessage           = msg.content || '';
//         patch.lastMessageAt         = msg.createdAt || msg.created_at || new Date().toISOString();
//         patch.lastSenderType        = sender;
//         patch.lastMessageSenderType = sender;
//       }

//       if (sender === 'customer' && !isActive) {
//         const existing = curList.find(c => c.id === convId);
//         const prev = existing?.unreadCount || existing?.unread_count || 0;
//         patch.unreadCount = prev + 1; patch.unread_count = prev + 1;
//       }

//       if (Object.keys(patch).length > 0) h.updateConversation(convId, patch);

//       // ── Notification ownership: App is the SINGLE source of truth. ──────────
//       // ← CHANGED. Notify the instant the WS event lands — before any list
//       // filtering, group scoping, search mode, or state round-trip. This retires
//       // the fragile diff-based notifier in ConversationList and the duplicate
//       // beep in useConversations (both of which should have their notify paths
//       // removed so nothing double-fires).
//       if (sender === 'agent') { h.clearNotificationsForConversation(convId); return; }

//       if (sender === 'customer') {
//         if (isActive) {
//           h.handleMarkAsRead(convId);
//         } else if (!isAutoReply) {
//           const existing = curList.find(c => c.id === convId);
//           const name = existing?.customerName || existing?.customer_name
//                      || msg.senderName || msg.sender_name || 'Guest';
//           h.showNotification(convId, name, msg.content || 'New message'); // OS notification
//           h.playBeep();                                                    // audible cue
//         }
//       }
//     });

//     const u2  = ws.on('connected', () => {
//       setError(null); setWsStatus('live'); setWsReconnectAttempt(0);
//       if (wsAuthedOnceRef.current) handlersRef.current.refreshConversations();
//       else wsAuthedOnceRef.current = true;
//     });
//     const u3  = ws.on('disconnected', () => setWsStatus('reconnecting'));
//     const u4  = ws.on('reconnecting', (d) => { setWsStatus('reconnecting'); setWsReconnectAttempt(d?.attempt || 0); });
//     const uE  = ws.on('error',        () => setWsStatus('reconnecting'));

//     // ── Refocus / network-back resync ──────────────────────────────────────
//     // ← ADDED. websocket.js emits 'resync' on every tab refocus and 'online'
//     // event, BEFORE any liveness check. This is the fix for "new messages don't
//     // show unless I reload": broadcastToAgents() is fire-and-forget, so a frame
//     // that lands while this tab's event loop is throttled (backgrounded/minimized)
//     // is dropped from state with the socket still technically OPEN — meaning no
//     // reconnect, no 'connected', nothing else pulls it. This refetches
//     // unconditionally on return. One cached GET; idempotent, so the extra fetch
//     // when a reconnect ALSO fires 'connected' is harmless.
//     const uR  = ws.on('resync', () => handlersRef.current.refreshConversations());

//     const u5  = ws.on('legal_threat_detected', (data) => {
//       const h = handlersRef.current;
//       const a = data.alert;
//       if (!a?.conversationId) return;
//       const emoji = a.severity === 'critical' ? '🚨' : a.severity === 'high' ? '⚠️' : '🔔';
//       h.updateConversation(a.conversationId, { priority: 'urgent', legalFlag: true, legalFlagSeverity: a.severity, legalFlagTerm: a.matchedTerm });
//       if (String(activeConversationRef.current?.id) !== String(a.conversationId)) {
//         h.showNotification(a.conversationId, `${emoji} Legal Threat — ${a.severity?.toUpperCase()}`, `"${a.matchedTerm}" from ${a.senderName || 'Customer'}`);
//         h.playBeep(); // ← ADDED: legal threats should beep too
//       }
//     });

//     const u6  = ws.on('conversation_unread', (data) => {
//       if (!data?.conversationId) return;
//       handlersRef.current.updateConversation(data.conversationId, { unreadCount: 1, unread_count: 1, unread: 1, ...(data.conversation || {}) });
//     });

//     const u7  = ws.on('conversation_archived', (data) => {
//       const h = handlersRef.current;
//       if (!data?.conversationId) return;
//       h.updateConversation(data.conversationId, { status: 'archived' });
//       setExcludedConversationIds(prev => new Set([...prev, String(data.conversationId)]));
//       const cur = activeConversationRef.current;
//       if (cur && String(cur.id) === String(data.conversationId)) {
//         setActiveConversation(null); h.setActiveConversationId(null);
//       }
//     });

//     const u8  = ws.on('conversation_unarchived', (data) => {
//       const h = handlersRef.current;
//       if (!data?.conversationId) return;
//       h.updateConversation(data.conversationId, { status: 'open', archivedAt: null, ...(data.conversation || {}) });
//       h.removeFromExcluded(data.conversationId);
//       h.refreshConversations();
//     });

//     const u9  = ws.on('conversation_blacklisted', (data) => {
//       const h = handlersRef.current;
//       if (!data?.conversationId) return;
//       h.updateConversation(data.conversationId, { status: 'blacklisted' });
//       setExcludedConversationIds(prev => new Set([...prev, String(data.conversationId)]));
//       const cur = activeConversationRef.current;
//       if (cur && String(cur.id) === String(data.conversationId)) {
//         setActiveConversation(null); h.setActiveConversationId(null);
//       }
//     });

//     const u10 = ws.on('conversation_unblacklisted', (data) => {
//       const h = handlersRef.current;
//       if (!data?.conversationId) return;
//       h.updateConversation(data.conversationId, { status: 'open' });
//       h.removeFromExcluded(data.conversationId);
//       if (data.email) h.removeEmailFromExcluded(data.email);
//       h.refreshConversations();
//     });

//     const u11 = ws.on('conversation_updated', (data) => {
//       if (!data?.conversationId || !data?.conversation) return;
//       const conv = data.conversation;
//       handlersRef.current.updateConversation(data.conversationId, {
//         lastMessage:           conv.lastMessage           || conv.last_message           || '',
//         lastMessageSenderType: conv.lastMessageSenderType || conv.last_message_sender_type || 'customer',
//         lastSenderType:        conv.lastMessageSenderType || conv.last_message_sender_type || 'customer',
//         lastMessageAt:         conv.lastMessageAt          || conv.last_message_at,
//         unreadCount:           conv.unreadCount            ?? conv.unread_count,
//         unread_count:          conv.unreadCount            ?? conv.unread_count,
//       });
//     });

//     return () => { u1(); u2(); u3(); u4(); uE(); uR(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); };

//   }, [ws]);

//   useEffect(() => {
//     if (activeConversation && ws) {
//       ws.joinConversation(activeConversation.id);
//       clearNotificationsForConversation(activeConversation.id);
//       return () => { ws.leaveConversation(); };
//     }
//   }, [activeConversation, ws]);

//   // ── Notification helpers ──────────────────────────────────────────────────

//   // ← ADDED: single audible-cue path. WebAudio primary; if the context is
//   // suspended (backgrounded tab) we DON'T await the pending resume() — we fire
//   // an <audio> ping immediately so the beep isn't swallowed. Both paths are
//   // pre-unlocked by the gesture effect above.
//   const playBeep = useCallback(() => {
//     try {
//       let ctx = audioCtxRef.current;
//       if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx; }
//       if (ctx.state === 'suspended') {
//         ctx.resume().catch(() => {});
//         try { const a = new Audio('/notification.mp3'); a.volume = 0.5; a.play().catch(() => {}); } catch { /* ignore */ }
//         return;
//       }
//       const osc  = ctx.createOscillator();
//       const gain = ctx.createGain();
//       osc.connect(gain); gain.connect(ctx.destination);
//       osc.frequency.value = 600; osc.type = 'sine';
//       gain.gain.setValueAtTime(0.3, ctx.currentTime);
//       gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
//       osc.start(ctx.currentTime);
//       osc.stop(ctx.currentTime + 0.3);
//     } catch {
//       // Last-ditch fallback if WebAudio throws entirely.
//       try { const a = new Audio('/notification.mp3'); a.volume = 0.5; a.play().catch(() => {}); } catch { /* ignore */ }
//     }
//   }, []);

//   const showNotification = (convId, name, preview) => {
//     if (!('Notification' in window) || Notification.permission !== 'granted') return;
//     try {
//       const n = new Notification(`New message from ${name}`, {
//         body: preview, icon: '/favicon.ico', tag: `conv-${convId}`,
//         requireInteraction: false, silent: false,
//       });
//       if (!activeNotificationsRef.current.has(convId)) activeNotificationsRef.current.set(convId, []);
//       activeNotificationsRef.current.get(convId).push(n);
//       n.onclick = () => {
//         window.focus();
//         const conv = conversationsRef.current.find(c => c.id === convId);
//         if (conv) handleSelectConversation(conv);
//         n.close(); removeNotifFromTracking(convId, n);
//       };
//       n.onclose = () => removeNotifFromTracking(convId, n);
//       setTimeout(() => n.close(), 6000);
//     } catch { /* ignore */ }
//   };

//   const removeNotifFromTracking = (convId, n) => {
//     const arr = activeNotificationsRef.current.get(convId);
//     if (!arr) return;
//     const i = arr.indexOf(n); if (i > -1) arr.splice(i, 1);
//     if (!arr.length) activeNotificationsRef.current.delete(convId);
//   };

//   const clearNotificationsForConversation = (convId) => {
//     const arr = activeNotificationsRef.current.get(convId);
//     if (arr?.length) {
//       arr.forEach(n => { try { n.close(); } catch { /* ignore */ } });
//       activeNotificationsRef.current.delete(convId);
//     }
//   };

//   const requestNotificationPermission = () => {
//     if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
//   };

//   const loadStores = async () => {
//     try {
//       setLoadingStores(true);
//       const filters = selectedGroup ? { storeGroup: selectedGroup } : {};
//       setStores((await api.getStores(filters)) || []);
//     }
//     catch { setStores([]); } finally { setLoadingStores(false); }
//   };

//   const loadStats = async () => {
//     try { setStats(await api.getDashboardStats()); } catch { /* non-critical */ }
//   };

//   // Groups (with colors + names) used to label each conversation by its store
//   // group. Same endpoint the group picker uses.
//   const loadStoreGroups = async () => {
//     try { setStoreGroups((await api.getStoreGroups()) || []); }
//     catch { setStoreGroups([]); }
//   };

//   const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
//   const isLive = wsStatus === 'live';
//   const navigateTo  = (page) => { setActivePage(page); setProfileDropdownOpen(false); };

//   // ── Keep the live handler set fresh for the (once-registered) WS listeners ──
//   // Runs every render; placed after all referenced functions are defined so
//   // there's no temporal-dead-zone issue. The WS effect reads handlersRef.current
//   // at event time, so it never needs these in its dependency array.
//   handlersRef.current = {
//     updateConversation, handleMarkAsRead, setActiveConversationId,
//     removeFromExcluded, removeEmailFromExcluded, refreshConversations,
//     showNotification, clearNotificationsForConversation,
//     playBeep, // ← ADDED
//   };

//   return (
//     <div className="app" style={appStyle}>
//       <header className="app-header" style={headerAccentStyle}>
//         <div className="header-left">
//           <h1>💬 Chat Support Pro</h1>
//           {selectedGroupName && (
//             <div className="header-group-badge" title={selectedGroupName}>
//               <span className="header-group-dot" aria-hidden="true" />
//               <span className="header-group-name">{selectedGroupName}</span>
//             </div>
//           )}
//           {activePage === 'dashboard' && stats && (
//             <div className="header-stats">
//               <span className="stat-pill"><span className="stat-dot open" />{stats.openConversations || 0} open</span>
//               <span className="stat-pill">🏪 {stores.length} stores</span>
//               <span className={`stat-pill ${isLive ? 'stat-connected' : 'stat-offline'}`}>
//                 <span className={`status-dot ${isLive ? '' : 'status-offline'}`} />
//                 {isLive ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
//               </span>
//             </div>
//           )}
//         </div>

//         <div className="header-right">
//           <nav className="header-nav">
//             <button className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`} onClick={() => setActivePage('dashboard')} type="button">
//               💬 Dashboard
//             </button>
//             {activePage === 'dashboard' && (
//               <button className={`nav-btn ${showNotesModal ? 'nav-active' : ''}`} onClick={() => setShowNotesModal(true)} type="button" title="My Notes">
//                 📝 Notes
//               </button>
//             )}
//             {activePage === 'dashboard' && (
//               <button className="btn-refresh" onClick={refreshConversations} type="button" title="Refresh conversations">🔄</button>
//             )}
//           </nav>

//           <div className="profile-menu-wrapper" ref={profileDropdownRef}>
//             <button
//               className={`profile-trigger ${profileDropdownOpen ? 'profile-trigger--open' : ''}`}
//               onClick={() => setProfileDropdownOpen(v => !v)}
//               type="button" aria-haspopup="true" aria-expanded={profileDropdownOpen}
//             >
//               <div className="profile-avatar" data-role={employee.role}>{getInitials(getEmployeeName(employee))}</div>
//               <div className="profile-info">
//                 <span className="profile-name">{getEmployeeName(employee)}</span>
//                 <span className="profile-role">{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
//               </div>
//               <span className={`profile-chevron ${profileDropdownOpen ? 'profile-chevron--up' : ''}`}>▾</span>
//             </button>

//             {profileDropdownOpen && (
//               <div className="profile-dropdown" role="menu">
//                 <div className="dropdown-user-card">
//                   <div className="dropdown-avatar" data-role={employee.role}>{getInitials(getEmployeeName(employee))}</div>
//                   <div>
//                     <div className="dropdown-user-name">{getEmployeeName(employee)}</div>
//                     <div className="dropdown-user-role">{employee.role === 'admin' ? '👑 Administrator' : '👤 Support Agent'}</div>
//                   </div>
//                 </div>
//                 <div className="dropdown-divider" />

//                 <button className="dropdown-item" onClick={() => { setProfileDropdownOpen(false); onSwitchGroup(); }} type="button" role="menuitem">
//                   <span className="dropdown-item-icon">🔀</span>
//                   <span className="dropdown-item-label">
//                     Switch Group{selectedGroupName ? ` (${selectedGroupName})` : ''}
//                   </span>
//                   {selectedGroupColor && <span className="group-color-dot" style={{ background: groupAccent, marginLeft: 'auto' }} />}
//                 </button>

//                 <button className={`dropdown-item ${activePage === 'archived' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('archived')} type="button" role="menuitem">
//                   <span className="dropdown-item-icon">📦</span>
//                   <span className="dropdown-item-label">Archived Messages</span>
//                   {activePage === 'archived' && <span className="dropdown-item-check">✓</span>}
//                 </button>

//                 {employee.role === 'admin' && (<>
//                   <button className={`dropdown-item ${activePage === 'blacklist' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('blacklist')} type="button" role="menuitem">
//                     <span className="dropdown-item-icon">🚫</span>
//                     <span className="dropdown-item-label">Blacklist</span>
//                     {activePage === 'blacklist' && <span className="dropdown-item-check">✓</span>}
//                   </button>
//                   <button className={`dropdown-item ${activePage === 'stores' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('stores')} type="button" role="menuitem">
//                     <span className="dropdown-item-icon">🏪</span>
//                     <span className="dropdown-item-label">Store Management</span>
//                     {activePage === 'stores' && <span className="dropdown-item-check">✓</span>}
//                   </button>
//                   <button className={`dropdown-item ${activePage === 'employees' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('employees')} type="button" role="menuitem">
//                     <span className="dropdown-item-icon">👥</span>
//                     <span className="dropdown-item-label">Employee Management</span>
//                     {activePage === 'employees' && <span className="dropdown-item-check">✓</span>}
//                   </button>
//                   <button className={`dropdown-item ${activePage === 'training' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('training')} type="button" role="menuitem">
//                     <span className="dropdown-item-icon">🧠</span>
//                     <span className="dropdown-item-label">AI Training</span>
//                     {activePage === 'training' && <span className="dropdown-item-check">✓</span>}
//                   </button>

//                   <button
//                     className={`dropdown-item ${activePage === 'promo' ? 'dropdown-item--active' : ''}`}
//                     onClick={() => navigateTo('promo')}
//                     type="button"
//                     role="menuitem"
//                   >
//                     <span className="dropdown-item-icon">📣</span>
//                     <span className="dropdown-item-label">Promo Email Blast</span>
//                     {activePage === 'promo' && <span className="dropdown-item-check">✓</span>}
//                   </button>


//                 </>)}

//                 <div className="dropdown-divider" />
//                 <button className="dropdown-item dropdown-item--danger" onClick={() => { setProfileDropdownOpen(false); setShowLogoutModal(true); }} type="button" role="menuitem">
//                   <span className="dropdown-item-icon">🚪</span>
//                   <span className="dropdown-item-label">Logout</span>
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>
//       </header>

//       {showLogoutModal && (
//         <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
//           <div className="modal-content logout-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🚪 Confirm Logout</h3></div>
//             <div className="modal-body">
//               <p>Are you sure you want to logout?</p>
//               <p className="logout-user-info">
//                 Logged in as: <strong>{getEmployeeName(employee)}</strong>
//                 <span className={`logout-role-badge ${employee.role}`}>{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
//               </p>
//             </div>
//             <div className="modal-footer">
//               <button className="btn-cancel" onClick={() => setShowLogoutModal(false)} type="button">Cancel</button>
//               <button className="btn-logout" onClick={() => { setShowLogoutModal(false); onLogout(); }} type="button">Yes, Logout</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {showNotesModal && (
//         <ConversationNotes
//           employee={employee}
//           employeeId={employee.id}
//           employeeName={getEmployeeName(employee)}
//           groupColor={headerColor}
//           onClose={() => setShowNotesModal(false)}
//         />
//       )}

//       <MobileMenu
//         isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}
//         employee={employee} activePage={activePage}
//         onPageChange={(page) => { setActivePage(page); setMobileMenuOpen(false); }}
//         onRefresh={() => { refreshConversations(); setMobileMenuOpen(false); }}
//         onLogout={() => setShowLogoutModal(true)}
//         stats={stats} isConnected={isLive}
//       />

//       {wsStatus === 'reconnecting' && wsReconnectAttempt >= 3 && (
//         <div className="error-banner">
//           {/* <span>🔄 Reconnecting to server…</span> */}
//         </div>
//       )}

//       {error && (
//         <div className="error-banner">
//           <span>⚠️ {error}</span>
//           <button onClick={() => setError(null)} type="button">×</button>
//         </div>
//       )}

//       {activePage === 'dashboard' && (
//         <div className="app-content">
//           <div className={`conversations-sidebar ${activeConversation ? 'hidden-mobile' : ''}`} style={sidebarAccentStyle}>
//             <div className="conversation-list-header mobile-header">
//               <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu" type="button">
//                 <span /><span /><span />
//               </button>
//               <h2>Conversations</h2>
//               <span className="conversation-count">{listConversations.length}</span>
//             </div>
//             <ConversationList
//               conversations={listConversations}
//               isServerSearch={searchResults !== null}
//               activeConversation={activeConversation}
//               onSelectConversation={handleSelectConversation}
//               onMarkAsRead={handleMarkAsRead}
//               onMarkAsUnread={handleMarkAsUnread}
//               filters={filters}
//               onFilterChange={updateFilters}
//               stores={stores}
//               loading={conversationsLoading || loadingStores}
//               onArchive={handleArchive}
//               onBlock={handleBlockFromList}
//               groupColor={headerColor}
//               storeGroups={storeGroups}
//               loadMore={loadMore}
//               hasMore={hasMore}
//               loadingMore={loadingMore}
//             />
//           </div>
//           <div className={`chat-window ${!activeConversation ? 'hidden' : ''}`}>
//             <ErrorBoundary>
//               <ChatWindow
//                 conversation={activeConversation}
//                 ws={ws}   
//                 onSendMessage={handleSendMessage}
//                 onClose={() => setActiveConversation(null)}
//                 onTyping={handleTyping}
//                 employeeName={getEmployeeName(employee)}
//                 onMenuToggle={() => setMobileMenuOpen(v => !v)}
//                 stores={stores}
//                 isAdmin={employee.role === 'admin'}
//                 onMarkAsUnread={handleMarkAsUnread}
//                 onArchive={handleArchive}
//                 onBlacklist={handleBlacklist}
//                 groupColor={headerColor}
//               />
//             </ErrorBoundary>
//           </div>
//         </div>
//       )}

//       {activePage === 'archived' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
//           <ErrorBoundary>
//             <ArchivedConversations onBack={() => setActivePage('dashboard')} onUnarchive={handleUnarchive} stores={stores} />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'blacklist' && employee.role === 'admin' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
//           <ErrorBoundary>
//             <BlacklistManager onBack={() => setActivePage('dashboard')} onUnblacklist={handleUnblacklist} />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'stores' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
//           <ErrorBoundary>
//             <StoreManagement onBack={() => setActivePage('dashboard')} onStoresUpdated={loadStores} />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'employees' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
//           <EmployeeManagement currentUser={employee} onBack={() => setActivePage('dashboard')} />
//         </div>
//       )}

//       {activePage === 'training' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
//           <ErrorBoundary>
//             <AITraining onBrainUpdate={() => {}} />
//           </ErrorBoundary>
//         </div>
//       )}
//             {activePage === 'promo' && employee.role === 'admin' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
//           <ErrorBoundary>
//             <PromoEmailBlast onBack={() => setActivePage('dashboard')} />
//           </ErrorBoundary>
//         </div>
//       )}

//       <style>{`
//         .group-color-dot {
//           display: inline-block;
//           width: 8px;
//           height: 8px;
//           border-radius: 50%;
//           margin: 0 6px;
//           flex-shrink: 0;
//         }

//         /* ── Header theming: text + controls follow the group color ── */
//         .app-header h1 { color: var(--header-fg); }

//         .app-header .nav-btn,
//         .app-header .btn-refresh,
//         .app-header .profile-trigger {
//           color: var(--header-fg);
//           background: rgba(var(--header-fg-rgb), 0.12);
//           border-color: rgba(var(--header-fg-rgb), 0.18);
//         }
//         .app-header .nav-btn:hover,
//         .app-header .btn-refresh:hover,
//         .app-header .profile-trigger:hover { background: rgba(var(--header-fg-rgb), 0.2); }
//         .app-header .nav-btn.nav-active,
//         .app-header .profile-trigger--open { background: rgba(var(--header-fg-rgb), 0.26); }

//         /* Plain info pills — skip the semantic Live/Offline pills */
//         .app-header .stat-pill:not(.stat-connected):not(.stat-offline) {
//           color: rgba(var(--header-fg-rgb), 0.92);
//           background: rgba(var(--header-fg-rgb), 0.12);
//           border-color: rgba(var(--header-fg-rgb), 0.18);
//         }
//         .app-header .header-stats { border-left-color: rgba(var(--header-fg-rgb), 0.25); }

//         .app-header .profile-name    { color: rgba(var(--header-fg-rgb), 0.95); }
//         .app-header .profile-role,
//         .app-header .profile-chevron { color: rgba(var(--header-fg-rgb), 0.6); }

//         /* Keep the avatar disc visible on light headers (admin amber untouched) */
//         .app-header .profile-avatar:not([data-role="admin"]) {
//           background: var(--header-fg);
//           color: var(--header-color);
//         }

//         /* ── Selected store group name, sat beside the title ── */
//         .app-header .header-group-badge {
//           display: inline-flex;
//           align-items: center;
//           gap: 8px;
//           padding: 6px 14px;
//           border-radius: 20px;
//           font-size: 17px;
//           font-weight: 700;
//           letter-spacing: -0.01em;
//           line-height: 1;
//           color: var(--header-fg);
//           background: rgba(var(--header-fg-rgb), 0.15);
//           border: 1px solid rgba(var(--header-fg-rgb), 0.24);
//           max-width: 280px;
//         }
//         .app-header .header-group-name {
//           overflow: hidden;
//           text-overflow: ellipsis;
//           white-space: nowrap;
//         }
//         .app-header .header-group-dot {
//           width: 9px;
//           height: 9px;
//           border-radius: 50%;
//           background: var(--header-fg);
//           opacity: 0.6;
//           flex-shrink: 0;
//         }
//         @media (max-width: 1024px) {
//           .app-header .header-group-badge { font-size: 15px; max-width: 170px; padding: 5px 12px; }
//         }
//       `}</style>

//     </div>
//   );
// }

// export default App;






import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import api from './services/api';
import { useConversations } from './hooks/useConversations';
import { useWebSocket } from './hooks/useWebSocket';
import ConversationList from './components/ConversationList';
import ChatWindow from './components/ChatWindow';
import Login from './components/Login';
import GroupSelector from './components/GroupSelector';
import ErrorBoundary from './components/ErrorBoundary';
import MobileMenu from './components/MobileMenu';
import ConversationNotes from './components/ConversationNotes';

// Admin-only pages: not shown on first paint, and collectively a large slice of
// the bundle. Lazy-load so they download on demand (on first navigation) instead
// of blocking initial load. Each is rendered inside a <Suspense> boundary below.
const EmployeeManagement    = lazy(() => import('./components/EmployeeManagement'));
const AITraining            = lazy(() => import('./components/AITraining'));
const StoreManagement       = lazy(() => import('./components/StoreManagement'));
const ArchivedConversations = lazy(() => import('./components/Archivedconversations'));
const BlacklistManager      = lazy(() => import('./components/Blacklistmanager'));
const PromoEmailBlast       = lazy(() => import('./components/PromoEmailBlast'));

const DEFAULT_GROUP_COLOR = '#25d366';

function App() {
  const [employee, setEmployee] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup]           = useState(null); // store_group slug, or null = "All Stores"
  const [selectedGroupName, setSelectedGroupName]   = useState(null);
  const [selectedGroupColor, setSelectedGroupColor] = useState(null);
  const [groupChosen, setGroupChosen]               = useState(false); // has a group been picked THIS session?

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const storedEmployee = localStorage.getItem('employee');
    const token = localStorage.getItem('token');
    if (storedEmployee && token) {
      try {
        const { employee: verified } = await api.verifyToken();
        setEmployee(verified);
        setIsAuthenticated(true);

        const storedGroup = localStorage.getItem('selectedGroup');
        if (storedGroup !== null && storedGroup !== '__all__') {
          setSelectedGroup(storedGroup);
          setSelectedGroupName(localStorage.getItem('selectedGroupName'));
          setSelectedGroupColor(localStorage.getItem('selectedGroupColor') || null);
          setGroupChosen(true);
        } else if (storedGroup === '__all__') {
          localStorage.removeItem('selectedGroup');
          localStorage.removeItem('selectedGroupName');
          localStorage.removeItem('selectedGroupColor');
        }
      } catch {
        localStorage.removeItem('employee');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogin = (data) => {
    setEmployee(data);
    setIsAuthenticated(true);
    // Every fresh login re-asks which group to open
    setGroupChosen(false);
    setSelectedGroup(null);
    setSelectedGroupName(null);
    setSelectedGroupColor(null);
    localStorage.removeItem('selectedGroup');
    localStorage.removeItem('selectedGroupName');
    localStorage.removeItem('selectedGroupColor');
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    localStorage.removeItem('employee');
    localStorage.removeItem('token');
    localStorage.removeItem('selectedGroup');
    localStorage.removeItem('selectedGroupName');
    localStorage.removeItem('selectedGroupColor');
    setEmployee(null);
    setIsAuthenticated(false);
    setSelectedGroup(null);
    setSelectedGroupName(null);
    setSelectedGroupColor(null);
    setGroupChosen(false);
  };

  const handleSelectGroup = (group, groupName, color) => {
    localStorage.setItem('selectedGroup', group === null ? '__all__' : group);
    localStorage.setItem('selectedGroupName', groupName || '');
    localStorage.setItem('selectedGroupColor', color || '');
    setSelectedGroup(group);
    setSelectedGroupName(groupName);
    setSelectedGroupColor(color || null);
    setGroupChosen(true);
  };

  const handleSwitchGroup = () => setGroupChosen(false);

  if (loading)          return <div className="loading-container"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;
  if (!groupChosen)     return <GroupSelector employee={employee} onSelectGroup={handleSelectGroup} onLogout={handleLogout} />;

  return (
    <DashboardContent
      employee={employee}
      onLogout={handleLogout}
      selectedGroup={selectedGroup}
      selectedGroupName={selectedGroupName}
      selectedGroupColor={selectedGroupColor}
      onSwitchGroup={handleSwitchGroup}
    />
  );
}


function hexToRgbTriple(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return `${r}, ${g}, ${b}`;
}

function DashboardContent({ employee, onLogout, selectedGroup, selectedGroupName, selectedGroupColor, onSwitchGroup }) {
  const [activePage,          setActivePage]          = useState('dashboard');
  const [activeConversation,  setActiveConversation]  = useState(null);
  const [stores,              setStores]              = useState([]);
  const [stats,               setStats]               = useState(null);
  const [storeGroups,         setStoreGroups]         = useState([]); // [{ storeGroup, storeGroupName, color }] for per-conversation group join
  const [loadingStores,       setLoadingStores]       = useState(true);
  const [error,               setError]               = useState(null);
  const [wsStatus,            setWsStatus]            = useState('connecting'); // 'connecting' | 'live' | 'reconnecting'
  const [wsReconnectAttempt,  setWsReconnectAttempt]  = useState(0);
  const [mobileMenuOpen,      setMobileMenuOpen]      = useState(false);
  const [showLogoutModal,     setShowLogoutModal]     = useState(false);
  const [showNotesModal,      setShowNotesModal]      = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [excludedConversationIds, setExcludedConversationIds] = useState(new Set());
  const profileDropdownRef          = useRef(null);
  const activeNotificationsRef      = useRef(new Map());
  const markAsReadTimerRef          = useRef(new Map());
  const activeConversationRef       = useRef(activeConversation);
  const conversationsRef            = useRef([]);
  const pendingUnblacklistEmailsRef = useRef(new Set());
  const handlersRef                 = useRef(null);
  const wsAuthedOnceRef             = useRef(false);
  const audioCtxRef                 = useRef(null); // ← ADDED: WebAudio ctx for the primary beep path


  const groupAccent    = selectedGroupColor || DEFAULT_GROUP_COLOR;
  const groupAccentRgb = hexToRgbTriple(groupAccent) || '37, 211, 102'; // fallback matches DEFAULT_GROUP_COLOR

  const headerColor   = selectedGroupColor || '#00a884';                // brand teal for "All Stores"
  const headerRgb     = hexToRgbTriple(headerColor) || '0, 168, 132';
  const [hr, hg, hb]  = headerRgb.split(',').map(n => parseInt(n, 10));
  const headerIsLight = (hr * 299 + hg * 587 + hb * 114) / 1000 > 150;  // YIQ brightness
  const headerFg      = headerIsLight ? '#0b141a' : '#ffffff';
  const headerFgRgb   = headerIsLight ? '11, 20, 26' : '255, 255, 255';

  const appStyle = {
    '--group-accent':     groupAccent,
    '--group-accent-rgb': groupAccentRgb,
    '--header-color':     headerColor,
    '--header-fg':        headerFg,
    '--header-fg-rgb':    headerFgRgb,
  };
  const headerAccentStyle = {
    background: `linear-gradient(180deg, rgba(${headerFgRgb}, 0.08) 0%, rgba(${headerFgRgb}, 0) 42%), ${headerColor}`,
    color: headerFg,
    borderBottom: '3px solid rgba(0, 0, 0, 0.16)',
  };
  const sidebarAccentStyle = { borderTop: `3px solid ${headerColor}` };


  const ws = useWebSocket(employee.id);

  const {
    conversations, loading: conversationsLoading,
    filters, updateFilters,
    refresh: refreshConversations,
    updateConversation, optimisticUpdate,
    setActiveConversationId,
    loadMore, hasMore, loadingMore,
  } = useConversations(employee.id, ws, { storeGroup: selectedGroup || '' });

  // ── Server-side conversation search ─────────────────────────────────────────
  // While a query (≥2 chars) is active, results come from /api/conversations/search
  // — which scans message bodies + name/email across the WHOLE group in Postgres,
  // not just the loaded page. `searchResults === null` means "not in search mode",
  // and the list falls back to the live paginated feed. The cancelled flag drops
  // stale responses so a slow earlier query can't overwrite a newer keystroke's.
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    const q = (filters.search || '').trim();
    if (q.length < 2) { setSearchResults(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const rows = await api.searchConversations({
          q,
          storeGroup: selectedGroup || '',
          storeId: filters.storeId || '',
        });
        if (!cancelled) setSearchResults(rows || []);
      } catch (err) {
        if (!cancelled) { console.error('[Search] Failed:', err); setSearchResults([]); }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [filters.search, filters.storeId, selectedGroup]);

  // ── Name helper ───────────────────────────────────────────────────────────
const getEmployeeName = (emp) => emp.employeeName || emp.name || 'Unknown';

  // ── Exclusion set helpers ─────────────────────────────────────────────────

  const removeFromExcluded = useCallback((conversationId) => {
    setExcludedConversationIds(prev => {
      const next = new Set(prev);
      next.delete(String(conversationId));
      return next;
    });
  }, []);

  const removeEmailFromExcluded = useCallback((email) => {
    if (!email) return;
    setExcludedConversationIds(prev => {
      const emailLower = email.toLowerCase().trim();
      const idsToRemove = new Set(
        conversationsRef.current
          .filter(c => (c.customerEmail || c.customer_email || '').toLowerCase().trim() === emailLower)
          .map(c => String(c.id))
      );
      if (!idsToRemove.size) return prev;
      const next = new Set(prev);
      idsToRemove.forEach(id => next.delete(id));
      return next;
    });
  }, []);


  const groupStoreKeys = React.useMemo(() => {
    const s = new Set();
    (stores || []).forEach((st) => {
      if (st.storeIdentifier)  s.add('ident:' + String(st.storeIdentifier));
      if (st.store_identifier) s.add('ident:' + String(st.store_identifier));
      if (st.id != null)       s.add('id:'    + String(st.id));
      if (st.shop_id != null)  s.add('id:'    + String(st.shop_id));
    });
    return s;
  }, [stores]);

  const isConversationInGroup = React.useCallback((c) => {
    if (!selectedGroup) return true; // All Stores → no scoping
    const ident = c.storeIdentifier || c.store_identifier;
    if (ident && groupStoreKeys.has('ident:' + String(ident))) return true;
    const shopId = c.shopId ?? c.shop_id ?? c.storeId;
    if (shopId != null && groupStoreKeys.has('id:' + String(shopId))) return true;
    return false;
  }, [selectedGroup, groupStoreKeys]);

  // ── visibleConversations ──────────────────────────────────────────────────
  const visibleConversations = React.useMemo(
    () => (conversations || []).filter(c =>
      !excludedConversationIds.has(String(c.id)) &&
      c.status !== 'archived'    &&
      c.status !== 'blacklisted' &&
      c.status !== 'blacklist'   &&
      isConversationInGroup(c)
    ),
    [conversations, excludedConversationIds, isConversationInGroup]
  );

  // ── listConversations ─────────────────────────────────────────────────────
  // The set actually handed to ConversationList. In search mode we use the
  // server rows (already group-scoped + archived/blacklisted-filtered by the
  // query), but still run them through the optimistic exclusion set so a
  // just-archived/blocked row disappears instantly without waiting for a re-query.
  const listConversations = React.useMemo(() => {
    if (searchResults === null) return visibleConversations;
    return searchResults.filter(c => !excludedConversationIds.has(String(c.id)));
  }, [searchResults, visibleConversations, excludedConversationIds]);

  useEffect(() => {
    if (!conversations?.length || !excludedConversationIds.size) return;
    if (!pendingUnblacklistEmailsRef.current.size) return;

    const toRestore = conversations.filter(c => {
      if (c.status !== 'open') return false;
      if (!excludedConversationIds.has(String(c.id))) return false;
      const email = (c.customerEmail || c.customer_email || '').toLowerCase().trim();
      return pendingUnblacklistEmailsRef.current.has(email);
    });

    if (!toRestore.length) return;

    setExcludedConversationIds(prev => {
      const next = new Set(prev);
      toRestore.forEach(c => next.delete(String(c.id)));
      return next;
    });

    toRestore.forEach(c => {
      const email = (c.customerEmail || c.customer_email || '').toLowerCase().trim();
      pendingUnblacklistEmailsRef.current.delete(email);
    });
  }, [conversations, excludedConversationIds]);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { conversationsRef.current      = conversations;      }, [conversations]);

  useEffect(() => { loadStores(); loadStats(); loadStoreGroups(); requestNotificationPermission(); }, []);

  // ── AudioContext unlock (resilient) ─────────────────────────────────────────
  // ← ADDED. Browsers only move a suspended AudioContext to "running" on a real
  // user gesture, and new Audio().play() is likewise blocked until the tab has
  // had one gesture. Prime BOTH here so the very first backgrounded message can
  // beep. Re-arms on every gesture until the ctx is genuinely running, and
  // re-resumes when the tab returns to the foreground (Chrome suspends WebAudio
  // for background tabs — the support-dashboard-in-a-bg-tab case).
  useEffect(() => {
    const ensureRunning = () => {
      try {
        if (!audioCtxRef.current)
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      } catch { /* ignore */ }
      // Prime the HTMLAudio autoplay allowance too (muted, no audible artifact).
      try { const a = new Audio('/notification.mp3'); a.volume = 0; a.play().catch(() => {}); } catch { /* ignore */ }
    };

    const onGesture = () => {
      ensureRunning();
      if (audioCtxRef.current?.state === 'running') {
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        try { if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume(); } catch { /* ignore */ }
      }
    };

    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target))
        setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  useEffect(() => {
    // if (['employees','stores','blacklist','training'].includes(activePage) && employee.role !== 'admin')
    if (['employees','stores','blacklist','training','promo'].includes(activePage) && employee.role !== 'admin')
      setActivePage('dashboard');
  }, [activePage, employee.role]);

  useEffect(() => {
    if (activeConversation) {
      const updated = conversations.find(c => c.id === activeConversation.id);
      if (updated && updated !== activeConversation) setActiveConversation(updated);
    }
  }, [conversations]);

  useEffect(() => {
    if (!activeConversation) setActiveConversationId(null);
  }, [activeConversation, setActiveConversationId]);

  // ── Conversation actions ──────────────────────────────────────────────────

  const handleMarkAsRead = useCallback((conversationId) => {
    updateConversation(conversationId, { unreadCount: 0, unread_count: 0, unread: 0 });
    if (markAsReadTimerRef.current.has(conversationId)) clearTimeout(markAsReadTimerRef.current.get(conversationId));
    markAsReadTimerRef.current.set(conversationId, setTimeout(async () => {
      try { await api.markConversationRead(conversationId); } catch { /* ignore */ }
      markAsReadTimerRef.current.delete(conversationId);
    }, 300));
  }, [updateConversation]);

  const handleMarkAsUnread = useCallback(async (conversationId) => {
    updateConversation(conversationId, { unreadCount: 1, unread_count: 1, unread: 1 });
    const cur = activeConversationRef.current;
    if (cur && String(cur.id) === String(conversationId)) {
      setActiveConversation(null); setActiveConversationId(null);
    }
    try { await api.markConversationUnread(conversationId); }
    catch { updateConversation(conversationId, { unreadCount: 0, unread_count: 0, unread: 0 }); }
  }, [updateConversation, setActiveConversationId]);

  const handleArchive = useCallback(async (conversationId) => {
    try {
      await api.archiveConversation(conversationId);
      updateConversation(conversationId, { status: 'archived' });
      setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
      const cur = activeConversationRef.current;
      if (cur && String(cur.id) === String(conversationId)) {
        setActiveConversation(null); setActiveConversationId(null);
      }
    } catch (err) { console.error('[Archive] Failed:', err); }
  }, [updateConversation, setActiveConversationId]);

  const handleUnarchive = useCallback(async (conversationId) => {
    try {
      await api.unarchiveConversation(conversationId);
      updateConversation(conversationId, { status: 'open', archivedAt: null });
      removeFromExcluded(conversationId);
      refreshConversations();
    } catch (err) { console.error('[Unarchive] Failed:', err); }
  }, [updateConversation, removeFromExcluded, refreshConversations]);

  const handleBlacklist = useCallback(async (payload) => {
    try {
      await api.blacklistCustomer(payload);
      const conversationId = payload.conversationId || payload.conversation_id;
      if (conversationId) {
        setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
        updateConversation(conversationId, { status: 'blacklisted' });
        const cur = activeConversationRef.current;
        if (cur && String(cur.id) === String(conversationId)) {
          setActiveConversation(null); setActiveConversationId(null);
        }
      }
      refreshConversations();
    } catch (err) { console.error('[Blacklist] Failed:', err); }
  }, [updateConversation, setActiveConversationId, refreshConversations]);

  const handleUnblacklist = useCallback(async ({ id, email }) => {
    try {
      await api.removeFromBlacklist(id);
      if (email) {
        pendingUnblacklistEmailsRef.current.add(email.toLowerCase().trim());
      }
      await refreshConversations();
    } catch (err) {
      console.error('[Unblacklist] Failed:', err);
      throw err;
    }
  }, [refreshConversations]);

  const handleBlockFromList = useCallback(async (conversationId) => {
    const conv = conversationsRef.current.find(c => String(c.id) === String(conversationId));
    if (!conv) { console.warn('[BlockFromList] Not found:', conversationId); return; }
    await handleBlacklist({
      email:           conv.customerEmail || conv.customer_email || '',
      storeIdentifier: conv.storeIdentifier || conv.store_identifier || conv.shopDomain || conv.shop_domain || '',
      allStores:       false,
      reason:          'Blocked via conversation list',
      customerName:    conv.customerName || conv.customer_name || '',
      conversationId,
    });
  }, [handleBlacklist]);

  const handleSelectConversation = useCallback((conversation) => {
    setActiveConversation(conversation);
    setActiveConversationId(conversation.id);
    const unread = conversation.unreadCount || conversation.unread_count || conversation.unread || 0;
    if (unread > 0) handleMarkAsRead(conversation.id);
  }, [handleMarkAsRead, setActiveConversationId]);


  const handleSendMessage = async (conversation, message, fileData, clientMsgId) => {
    const storeId = conversation.shopId || conversation.shop_id || conversation.storeId;
    if (!storeId) throw new Error('Store ID is missing from conversation');
    clearNotificationsForConversation(conversation.id);
    handleMarkAsRead(conversation.id);
    optimisticUpdate(conversation.id, message);
    try {
      const sent = await api.sendMessage({
        conversationId: conversation.id, storeId,
        senderType: 'agent', senderName: 'Customer Support',
        content: message || '', fileData: fileData || null,
        clientMsgId,                         // ← forward the client id
      });
      if (sent.createdAt) updateConversation(conversation.id, { lastMessageAt: sent.createdAt });
      return { ...sent, clientMsgId };       // ← ensure it's present on the return
    } catch (err) { refreshConversations(); throw err; }
  };


const handleTyping = (isTyping) => {
  if (activeConversation && ws) ws.sendTyping(activeConversation.id, isTyping);
};

  useEffect(() => {
    if (!ws) return;
const u1 = ws.on('new_message', (data) => {
  const h       = handlersRef.current;
  const curConv = activeConversationRef.current;
  const curList = conversationsRef.current;
  const msg     = data.message || {};

  // widen field resolution — tolerate whatever the server actually sends
  const sender = msg.senderType || msg.sender_type
              || msg.sender     || msg.role || msg.from || '';
  const convId = data.conversationId || msg.conversationId
              || data.conversation_id || msg.conversation_id;

  console.log('[new_message]', {
    sender, convId,
    activeId: curConv?.id,
    isAutoReply: msg.isAutoReply,
    msgKeys: Object.keys(msg),
  });

  if (!convId) return;

  // String() everywhere, like the rest of the file
  const isActive    = curConv != null && String(curConv.id) === String(convId);
  const isAutoReply = msg.isAutoReply === true;
  const patch = {};

  if (!isAutoReply) {
    patch.lastMessage           = msg.content || '';
    patch.lastMessageAt         = msg.createdAt || msg.created_at || new Date().toISOString();
    patch.lastSenderType        = sender;
    patch.lastMessageSenderType = sender;
  }

  if (sender === 'customer' && !isActive) {
    const existing = curList.find(c => String(c.id) === String(convId));
    const prev = existing?.unreadCount || existing?.unread_count || 0;
    patch.unreadCount = prev + 1; patch.unread_count = prev + 1;
  }

  if (Object.keys(patch).length > 0) h.updateConversation(convId, patch);

  if (sender === 'agent') { h.clearNotificationsForConversation(convId); return; }

  if (sender === 'customer') {
    if (isActive) {
      h.handleMarkAsRead(convId);
    } else if (!isAutoReply) {
      const existing = curList.find(c => String(c.id) === String(convId));
      const name = existing?.customerName || existing?.customer_name
                 || msg.senderName || msg.sender_name || 'Guest';
      h.showNotification(convId, name, msg.content || 'New message');
      h.playBeep();
    }
  }
});

    const u2  = ws.on('connected', () => {
      setError(null); setWsStatus('live'); setWsReconnectAttempt(0);
      if (wsAuthedOnceRef.current) handlersRef.current.refreshConversations();
      else wsAuthedOnceRef.current = true;
    });
    const u3  = ws.on('disconnected', () => setWsStatus('reconnecting'));
    const u4  = ws.on('reconnecting', (d) => { setWsStatus('reconnecting'); setWsReconnectAttempt(d?.attempt || 0); });
    const uE  = ws.on('error',        () => setWsStatus('reconnecting'));

    // ── Refocus / network-back resync ──────────────────────────────────────
    // ← ADDED. websocket.js emits 'resync' on every tab refocus and 'online'
    // event, BEFORE any liveness check. This is the fix for "new messages don't
    // show unless I reload": broadcastToAgents() is fire-and-forget, so a frame
    // that lands while this tab's event loop is throttled (backgrounded/minimized)
    // is dropped from state with the socket still technically OPEN — meaning no
    // reconnect, no 'connected', nothing else pulls it. This refetches
    // unconditionally on return. One cached GET; idempotent, so the extra fetch
    // when a reconnect ALSO fires 'connected' is harmless.
    const uR  = ws.on('resync', () => handlersRef.current.refreshConversations());

    const u5  = ws.on('legal_threat_detected', (data) => {
      const h = handlersRef.current;
      const a = data.alert;
      if (!a?.conversationId) return;
      const emoji = a.severity === 'critical' ? '🚨' : a.severity === 'high' ? '⚠️' : '🔔';
      h.updateConversation(a.conversationId, { priority: 'urgent', legalFlag: true, legalFlagSeverity: a.severity, legalFlagTerm: a.matchedTerm });
      if (String(activeConversationRef.current?.id) !== String(a.conversationId)) {
        h.showNotification(a.conversationId, `${emoji} Legal Threat — ${a.severity?.toUpperCase()}`, `"${a.matchedTerm}" from ${a.senderName || 'Customer'}`);
        h.playBeep(); // ← ADDED: legal threats should beep too
      }
    });

    const u6  = ws.on('conversation_unread', (data) => {
      if (!data?.conversationId) return;
      handlersRef.current.updateConversation(data.conversationId, { unreadCount: 1, unread_count: 1, unread: 1, ...(data.conversation || {}) });
    });

    const u7  = ws.on('conversation_archived', (data) => {
      const h = handlersRef.current;
      if (!data?.conversationId) return;
      h.updateConversation(data.conversationId, { status: 'archived' });
      setExcludedConversationIds(prev => new Set([...prev, String(data.conversationId)]));
      const cur = activeConversationRef.current;
      if (cur && String(cur.id) === String(data.conversationId)) {
        setActiveConversation(null); h.setActiveConversationId(null);
      }
    });

    const u8  = ws.on('conversation_unarchived', (data) => {
      const h = handlersRef.current;
      if (!data?.conversationId) return;
      h.updateConversation(data.conversationId, { status: 'open', archivedAt: null, ...(data.conversation || {}) });
      h.removeFromExcluded(data.conversationId);
      h.refreshConversations();
    });

    const u9  = ws.on('conversation_blacklisted', (data) => {
      const h = handlersRef.current;
      if (!data?.conversationId) return;
      h.updateConversation(data.conversationId, { status: 'blacklisted' });
      setExcludedConversationIds(prev => new Set([...prev, String(data.conversationId)]));
      const cur = activeConversationRef.current;
      if (cur && String(cur.id) === String(data.conversationId)) {
        setActiveConversation(null); h.setActiveConversationId(null);
      }
    });

    const u10 = ws.on('conversation_unblacklisted', (data) => {
      const h = handlersRef.current;
      if (!data?.conversationId) return;
      h.updateConversation(data.conversationId, { status: 'open' });
      h.removeFromExcluded(data.conversationId);
      if (data.email) h.removeEmailFromExcluded(data.email);
      h.refreshConversations();
    });

    const u11 = ws.on('conversation_updated', (data) => {
      if (!data?.conversationId || !data?.conversation) return;
      const conv = data.conversation;
      handlersRef.current.updateConversation(data.conversationId, {
        lastMessage:           conv.lastMessage           || conv.last_message           || '',
        lastMessageSenderType: conv.lastMessageSenderType || conv.last_message_sender_type || 'customer',
        lastSenderType:        conv.lastMessageSenderType || conv.last_message_sender_type || 'customer',
        lastMessageAt:         conv.lastMessageAt          || conv.last_message_at,
        unreadCount:           conv.unreadCount            ?? conv.unread_count,
        unread_count:          conv.unreadCount            ?? conv.unread_count,
      });
    });

    return () => { u1(); u2(); u3(); u4(); uE(); uR(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); };

  }, [ws]);

  useEffect(() => {
    if (activeConversation && ws) {
      ws.joinConversation(activeConversation.id);
      clearNotificationsForConversation(activeConversation.id);
      return () => { ws.leaveConversation(); };
    }
  }, [activeConversation, ws]);

  // ── Notification helpers ──────────────────────────────────────────────────

  // ← ADDED: single audible-cue path. WebAudio primary; if the context is
  // suspended (backgrounded tab) we DON'T await the pending resume() — we fire
  // an <audio> ping immediately so the beep isn't swallowed. Both paths are
  // pre-unlocked by the gesture effect above.
const playBeep = useCallback(() => {
  console.log('[beep] playBeep called, ctx state:', audioCtxRef.current?.state);
  try {
    let ctx = audioCtxRef.current;
    if (!ctx) { ctx = new (window.AudioContext||window.webkitAudioContext)(); audioCtxRef.current = ctx; }
    console.log('[beep] using ctx, state:', ctx.state);
    if (ctx.state === 'suspended') {
      ctx.resume().catch(e=>console.log('[beep] resume failed', e));
      try { const a = new Audio('/notification.mp3'); a.volume=0.5; a.play().then(()=>console.log('[beep] mp3 fallback played')).catch(e=>console.log('[beep] mp3 fallback blocked', e.message)); } catch(e){ console.log('[beep] mp3 threw', e); }
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 600; osc.type='sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.3);
    console.log('[beep] oscillator fired');
  } catch (e) {
    console.log('[beep] threw, trying mp3:', e.message);
    try { const a = new Audio('/notification.mp3'); a.volume=0.5; a.play().catch(err=>console.log('[beep] final mp3 blocked', err.message)); } catch(_){}
  }
}, []);

  const showNotification = (convId, name, preview) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(`New message from ${name}`, {
        body: preview, icon: '/favicon.ico', tag: `conv-${convId}`,
        requireInteraction: false, silent: false,
      });
      if (!activeNotificationsRef.current.has(convId)) activeNotificationsRef.current.set(convId, []);
      activeNotificationsRef.current.get(convId).push(n);
      n.onclick = () => {
        window.focus();
        const conv = conversationsRef.current.find(c => c.id === convId);
        if (conv) handleSelectConversation(conv);
        n.close(); removeNotifFromTracking(convId, n);
      };
      n.onclose = () => removeNotifFromTracking(convId, n);
      setTimeout(() => n.close(), 6000);
    } catch { /* ignore */ }
  };

  const removeNotifFromTracking = (convId, n) => {
    const arr = activeNotificationsRef.current.get(convId);
    if (!arr) return;
    const i = arr.indexOf(n); if (i > -1) arr.splice(i, 1);
    if (!arr.length) activeNotificationsRef.current.delete(convId);
  };

  const clearNotificationsForConversation = (convId) => {
    const arr = activeNotificationsRef.current.get(convId);
    if (arr?.length) {
      arr.forEach(n => { try { n.close(); } catch { /* ignore */ } });
      activeNotificationsRef.current.delete(convId);
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  };

  const loadStores = async () => {
    try {
      setLoadingStores(true);
      const filters = selectedGroup ? { storeGroup: selectedGroup } : {};
      setStores((await api.getStores(filters)) || []);
    }
    catch { setStores([]); } finally { setLoadingStores(false); }
  };

  const loadStats = async () => {
    try { setStats(await api.getDashboardStats()); } catch { /* non-critical */ }
  };

  // Groups (with colors + names) used to label each conversation by its store
  // group. Same endpoint the group picker uses.
  const loadStoreGroups = async () => {
    try { setStoreGroups((await api.getStoreGroups()) || []); }
    catch { setStoreGroups([]); }
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  const isLive = wsStatus === 'live';
  const navigateTo  = (page) => { setActivePage(page); setProfileDropdownOpen(false); };

  // ── Keep the live handler set fresh for the (once-registered) WS listeners ──
  // Runs every render; placed after all referenced functions are defined so
  // there's no temporal-dead-zone issue. The WS effect reads handlersRef.current
  // at event time, so it never needs these in its dependency array.
  handlersRef.current = {
    updateConversation, handleMarkAsRead, setActiveConversationId,
    removeFromExcluded, removeEmailFromExcluded, refreshConversations,
    showNotification, clearNotificationsForConversation,
    playBeep, // ← ADDED
  };

  return (
    <div className="app" style={appStyle}>
      <header className="app-header" style={headerAccentStyle}>
        <div className="header-left">
          <h1>💬 Chat Support Pro</h1>
          {selectedGroupName && (
            <div className="header-group-badge" title={selectedGroupName}>
              <span className="header-group-dot" aria-hidden="true" />
              <span className="header-group-name">{selectedGroupName}</span>
            </div>
          )}
          {activePage === 'dashboard' && stats && (
            <div className="header-stats">
              <span className="stat-pill"><span className="stat-dot open" />{stats.openConversations || 0} open</span>
              <span className="stat-pill">🏪 {stores.length} stores</span>
              <span className={`stat-pill ${isLive ? 'stat-connected' : 'stat-offline'}`}>
                <span className={`status-dot ${isLive ? '' : 'status-offline'}`} />
                {isLive ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
              </span>
            </div>
          )}
        </div>

        <div className="header-right">
          <nav className="header-nav">
            <button className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`} onClick={() => setActivePage('dashboard')} type="button">
              💬 Dashboard
            </button>
            {activePage === 'dashboard' && (
              <button className={`nav-btn ${showNotesModal ? 'nav-active' : ''}`} onClick={() => setShowNotesModal(true)} type="button" title="My Notes">
                📝 Notes
              </button>
            )}
            {activePage === 'dashboard' && (
              <button className="btn-refresh" onClick={refreshConversations} type="button" title="Refresh conversations">🔄</button>
            )}
          </nav>

          <div className="profile-menu-wrapper" ref={profileDropdownRef}>
            <button
              className={`profile-trigger ${profileDropdownOpen ? 'profile-trigger--open' : ''}`}
              onClick={() => setProfileDropdownOpen(v => !v)}
              type="button" aria-haspopup="true" aria-expanded={profileDropdownOpen}
            >
              <div className="profile-avatar" data-role={employee.role}>{getInitials(getEmployeeName(employee))}</div>
              <div className="profile-info">
                <span className="profile-name">{getEmployeeName(employee)}</span>
                <span className="profile-role">{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
              </div>
              <span className={`profile-chevron ${profileDropdownOpen ? 'profile-chevron--up' : ''}`}>▾</span>
            </button>

            {profileDropdownOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="dropdown-user-card">
                  <div className="dropdown-avatar" data-role={employee.role}>{getInitials(getEmployeeName(employee))}</div>
                  <div>
                    <div className="dropdown-user-name">{getEmployeeName(employee)}</div>
                    <div className="dropdown-user-role">{employee.role === 'admin' ? '👑 Administrator' : '👤 Support Agent'}</div>
                  </div>
                </div>
                <div className="dropdown-divider" />

                <button className="dropdown-item" onClick={() => { setProfileDropdownOpen(false); onSwitchGroup(); }} type="button" role="menuitem">
                  <span className="dropdown-item-icon">🔀</span>
                  <span className="dropdown-item-label">
                    Switch Group{selectedGroupName ? ` (${selectedGroupName})` : ''}
                  </span>
                  {selectedGroupColor && <span className="group-color-dot" style={{ background: groupAccent, marginLeft: 'auto' }} />}
                </button>

                <button className={`dropdown-item ${activePage === 'archived' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('archived')} type="button" role="menuitem">
                  <span className="dropdown-item-icon">📦</span>
                  <span className="dropdown-item-label">Archived Messages</span>
                  {activePage === 'archived' && <span className="dropdown-item-check">✓</span>}
                </button>

                {employee.role === 'admin' && (<>
                  <button className={`dropdown-item ${activePage === 'blacklist' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('blacklist')} type="button" role="menuitem">
                    <span className="dropdown-item-icon">🚫</span>
                    <span className="dropdown-item-label">Blacklist</span>
                    {activePage === 'blacklist' && <span className="dropdown-item-check">✓</span>}
                  </button>
                  <button className={`dropdown-item ${activePage === 'stores' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('stores')} type="button" role="menuitem">
                    <span className="dropdown-item-icon">🏪</span>
                    <span className="dropdown-item-label">Store Management</span>
                    {activePage === 'stores' && <span className="dropdown-item-check">✓</span>}
                  </button>
                  <button className={`dropdown-item ${activePage === 'employees' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('employees')} type="button" role="menuitem">
                    <span className="dropdown-item-icon">👥</span>
                    <span className="dropdown-item-label">Employee Management</span>
                    {activePage === 'employees' && <span className="dropdown-item-check">✓</span>}
                  </button>
                  <button className={`dropdown-item ${activePage === 'training' ? 'dropdown-item--active' : ''}`} onClick={() => navigateTo('training')} type="button" role="menuitem">
                    <span className="dropdown-item-icon">🧠</span>
                    <span className="dropdown-item-label">AI Training</span>
                    {activePage === 'training' && <span className="dropdown-item-check">✓</span>}
                  </button>

                  <button
                    className={`dropdown-item ${activePage === 'promo' ? 'dropdown-item--active' : ''}`}
                    onClick={() => navigateTo('promo')}
                    type="button"
                    role="menuitem"
                  >
                    <span className="dropdown-item-icon">📣</span>
                    <span className="dropdown-item-label">Promo Email Blast</span>
                    {activePage === 'promo' && <span className="dropdown-item-check">✓</span>}
                  </button>


                </>)}

                <div className="dropdown-divider" />
                <button className="dropdown-item dropdown-item--danger" onClick={() => { setProfileDropdownOpen(false); setShowLogoutModal(true); }} type="button" role="menuitem">
                  <span className="dropdown-item-icon">🚪</span>
                  <span className="dropdown-item-label">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="modal-content logout-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>🚪 Confirm Logout</h3></div>
            <div className="modal-body">
              <p>Are you sure you want to logout?</p>
              <p className="logout-user-info">
                Logged in as: <strong>{getEmployeeName(employee)}</strong>
                <span className={`logout-role-badge ${employee.role}`}>{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowLogoutModal(false)} type="button">Cancel</button>
              <button className="btn-logout" onClick={() => { setShowLogoutModal(false); onLogout(); }} type="button">Yes, Logout</button>
            </div>
          </div>
        </div>
      )}

      {showNotesModal && (
        <ConversationNotes
          employee={employee}
          employeeId={employee.id}
          employeeName={getEmployeeName(employee)}
          groupColor={headerColor}
          onClose={() => setShowNotesModal(false)}
        />
      )}

      <MobileMenu
        isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}
        employee={employee} activePage={activePage}
        onPageChange={(page) => { setActivePage(page); setMobileMenuOpen(false); }}
        onRefresh={() => { refreshConversations(); setMobileMenuOpen(false); }}
        onLogout={() => setShowLogoutModal(true)}
        stats={stats} isConnected={isLive}
      />

      {wsStatus === 'reconnecting' && wsReconnectAttempt >= 3 && (
        <div className="error-banner">
          {/* <span>🔄 Reconnecting to server…</span> */}
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} type="button">×</button>
        </div>
      )}

      {activePage === 'dashboard' && (
        <div className="app-content">
          <div className={`conversations-sidebar ${activeConversation ? 'hidden-mobile' : ''}`} style={sidebarAccentStyle}>
            <div className="conversation-list-header mobile-header">
              <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu" type="button">
                <span /><span /><span />
              </button>
              <h2>Conversations</h2>
              <span className="conversation-count">{listConversations.length}</span>
            </div>
            <ConversationList
              conversations={listConversations}
              isServerSearch={searchResults !== null}
              activeConversation={activeConversation}
              onSelectConversation={handleSelectConversation}
              onMarkAsRead={handleMarkAsRead}
              onMarkAsUnread={handleMarkAsUnread}
              filters={filters}
              onFilterChange={updateFilters}
              stores={stores}
              loading={conversationsLoading || loadingStores}
              onArchive={handleArchive}
              onBlock={handleBlockFromList}
              groupColor={headerColor}
              storeGroups={storeGroups}
              loadMore={loadMore}
              hasMore={hasMore}
              loadingMore={loadingMore}
            />
          </div>
          <div className={`chat-window ${!activeConversation ? 'hidden' : ''}`}>
            <ErrorBoundary>
              <ChatWindow
                conversation={activeConversation}
                ws={ws}   
                onSendMessage={handleSendMessage}
                onClose={() => setActiveConversation(null)}
                onTyping={handleTyping}
                employeeName={getEmployeeName(employee)}
                onMenuToggle={() => setMobileMenuOpen(v => !v)}
                stores={stores}
                isAdmin={employee.role === 'admin'}
                onMarkAsUnread={handleMarkAsUnread}
                onArchive={handleArchive}
                onBlacklist={handleBlacklist}
                groupColor={headerColor}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {activePage === 'archived' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
              <ArchivedConversations onBack={() => setActivePage('dashboard')} onUnarchive={handleUnarchive} stores={stores} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'blacklist' && employee.role === 'admin' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
              <BlacklistManager onBack={() => setActivePage('dashboard')} onUnblacklist={handleUnblacklist} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'stores' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
          <ErrorBoundary>
            <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
              <StoreManagement onBack={() => setActivePage('dashboard')} onStoresUpdated={loadStores} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'employees' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
          <ErrorBoundary>
            <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
              <EmployeeManagement currentUser={employee} onBack={() => setActivePage('dashboard')} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'training' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
              <AITraining onBrainUpdate={() => {}} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
      {activePage === 'promo' && employee.role === 'admin' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
              <PromoEmailBlast onBack={() => setActivePage('dashboard')} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      <style>{`
        .group-color-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin: 0 6px;
          flex-shrink: 0;
        }

        /* ── Header theming: text + controls follow the group color ── */
        .app-header h1 { color: var(--header-fg); }

        .app-header .nav-btn,
        .app-header .btn-refresh,
        .app-header .profile-trigger {
          color: var(--header-fg);
          background: rgba(var(--header-fg-rgb), 0.12);
          border-color: rgba(var(--header-fg-rgb), 0.18);
        }
        .app-header .nav-btn:hover,
        .app-header .btn-refresh:hover,
        .app-header .profile-trigger:hover { background: rgba(var(--header-fg-rgb), 0.2); }
        .app-header .nav-btn.nav-active,
        .app-header .profile-trigger--open { background: rgba(var(--header-fg-rgb), 0.26); }

        /* Plain info pills — skip the semantic Live/Offline pills */
        .app-header .stat-pill:not(.stat-connected):not(.stat-offline) {
          color: rgba(var(--header-fg-rgb), 0.92);
          background: rgba(var(--header-fg-rgb), 0.12);
          border-color: rgba(var(--header-fg-rgb), 0.18);
        }
        .app-header .header-stats { border-left-color: rgba(var(--header-fg-rgb), 0.25); }

        .app-header .profile-name    { color: rgba(var(--header-fg-rgb), 0.95); }
        .app-header .profile-role,
        .app-header .profile-chevron { color: rgba(var(--header-fg-rgb), 0.6); }

        /* Keep the avatar disc visible on light headers (admin amber untouched) */
        .app-header .profile-avatar:not([data-role="admin"]) {
          background: var(--header-fg);
          color: var(--header-color);
        }

        /* ── Selected store group name, sat beside the title ── */
        .app-header .header-group-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1;
          color: var(--header-fg);
          background: rgba(var(--header-fg-rgb), 0.15);
          border: 1px solid rgba(var(--header-fg-rgb), 0.24);
          max-width: 280px;
        }
        .app-header .header-group-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .app-header .header-group-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--header-fg);
          opacity: 0.6;
          flex-shrink: 0;
        }
        @media (max-width: 1024px) {
          .app-header .header-group-badge { font-size: 15px; max-width: 170px; padding: 5px 12px; }
        }
      `}</style>

    </div>
  );
}

export default App;