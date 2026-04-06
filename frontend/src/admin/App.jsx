


// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import api from './services/api';
// import { useConversations } from './hooks/useConversations';
// import { useWebSocket } from './hooks/useWebSocket';
// import ConversationList from './components/ConversationList';
// import ChatWindow from './components/ChatWindow';
// import Login from './components/Login';
// import EmployeeManagement from './components/EmployeeManagement';
// import ErrorBoundary from './components/ErrorBoundary';
// import MobileMenu from './components/MobileMenu';
// import ConversationNotes from './components/ConversationNotes';
// import AITraining from './components/AITraining';
// import StoreManagement from './components/StoreManagement';
// import ArchivedConversations from './components/Archivedconversations';
// import BlacklistManager from './components/Blacklistmanager';

// function App() {
//   const [employee, setEmployee] = useState(null);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => { checkAuth(); }, []);

//   const checkAuth = async () => {
//     const storedEmployee = localStorage.getItem('employee');
//     const token = localStorage.getItem('token');
//     if (storedEmployee && token) {
//       try {
//         const { employee: verified } = await api.verifyToken();
//         setEmployee(verified);
//         setIsAuthenticated(true);
//       } catch {
//         localStorage.removeItem('employee');
//         localStorage.removeItem('token');
//       }
//     }
//     setLoading(false);
//   };

//   const handleLogin = (data) => { setEmployee(data); setIsAuthenticated(true); };

//   const handleLogout = async () => {
//     try { await api.logout(); } catch { /* ignore */ }
//     localStorage.removeItem('employee');
//     localStorage.removeItem('token');
//     setEmployee(null);
//     setIsAuthenticated(false);
//   };

//   if (loading) return <div className="loading-container"><div className="spinner" /></div>;
//   if (!isAuthenticated) return <Login onLogin={handleLogin} />;
//   return <DashboardContent employee={employee} onLogout={handleLogout} />;
// }

// function DashboardContent({ employee, onLogout }) {
//   const [activePage, setActivePage] = useState('dashboard');
//   const [activeConversation, setActiveConversation] = useState(null);
//   const [stores, setStores] = useState([]);
//   const [stats, setStats] = useState(null);
//   const [loadingStores, setLoadingStores] = useState(true);
//   const [error, setError] = useState(null);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [showLogoutModal, setShowLogoutModal] = useState(false);
//   const [showNotesModal, setShowNotesModal] = useState(false);
//   const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
//   const [excludedConversationIds, setExcludedConversationIds] = useState(new Set());

//   const profileDropdownRef = useRef(null);
//   const activeNotificationsRef = useRef(new Map());
//   const markAsReadTimerRef = useRef(new Map());
//   const activeConversationRef = useRef(activeConversation);
//   const conversationsRef = useRef([]);

//   const {
//     conversations, loading: conversationsLoading,
//     filters, updateFilters,
//     refresh: refreshConversations,
//     updateConversation, optimisticUpdate,
//     setActiveConversationId,
//   } = useConversations(employee.id);

//   // Filter out conversations that were archived/blacklisted this session.
//   // This survives refreshConversations() re-fetches because the exclusion set
//   // lives in component state, not in the hook.
//   const visibleConversations = React.useMemo(
//     () => (conversations || []).filter(c =>
//       !excludedConversationIds.has(String(c.id)) &&
//       c.status !== 'archived' &&
//       c.status !== 'blacklisted' &&
//       c.status !== 'blacklist'
//     ),
//     [conversations, excludedConversationIds]
//   );

//   const ws = useWebSocket(employee.id);

//   useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
//   useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

//   useEffect(() => { loadStores(); loadStats(); requestNotificationPermission(); }, []);

//   // Close dropdown on outside click
//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
//         setProfileDropdownOpen(false);
//       }
//     };
//     if (profileDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [profileDropdownOpen]);

//   useEffect(() => {
//     if (['employees', 'stores', 'blacklist', 'training'].includes(activePage) && employee.role !== 'admin') {
//       setActivePage('dashboard');
//     }
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
//     if (cur && String(cur.id) === String(conversationId)) { setActiveConversation(null); setActiveConversationId(null); }
//     try { await api.markConversationUnread(conversationId); }
//     catch { updateConversation(conversationId, { unreadCount: 0, unread_count: 0, unread: 0 }); }
//   }, [updateConversation, setActiveConversationId]);

//   const handleArchive = useCallback(async (conversationId) => {
//     await api.archiveConversation(conversationId);
//     updateConversation(conversationId, { status: 'archived' });
//     setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
//     const cur = activeConversationRef.current;
//     if (cur && String(cur.id) === String(conversationId)) { setActiveConversation(null); setActiveConversationId(null); }
//   }, [updateConversation, setActiveConversationId]);

//   const handleBlacklist = useCallback(async (payload) => {
//     await api.blacklistCustomer(payload);
//     const conversationId = payload.conversationId || payload.conversation_id;
//     if (conversationId) {
//       // Exclude immediately — survives any subsequent refreshConversations() re-fetch
//       setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
//       updateConversation(conversationId, { status: 'blacklisted' });
//       const cur = activeConversationRef.current;
//       if (cur && String(cur.id) === String(conversationId)) {
//         setActiveConversation(null);
//         setActiveConversationId(null);
//       }
//     }
//     refreshConversations();
//   }, [updateConversation, setActiveConversationId, refreshConversations]);

//   const handleSelectConversation = useCallback((conversation) => {
//     setActiveConversation(conversation);
//     setActiveConversationId(conversation.id);
//     const unread = conversation.unreadCount || conversation.unread_count || conversation.unread || 0;
//     if (unread > 0) handleMarkAsRead(conversation.id);
//   }, [handleMarkAsRead, setActiveConversationId]);

//   const handleSendMessage = async (conversation, message, fileData) => {
//     const storeId = conversation.shopId || conversation.shop_id || conversation.storeId;
//     if (!storeId) throw new Error('Store ID is missing from conversation');
//     clearNotificationsForConversation(conversation.id);
//     handleMarkAsRead(conversation.id);
//     optimisticUpdate(conversation.id, message);
//     try {
//       const sent = await api.sendMessage({
//         conversationId: conversation.id, storeId,
//         senderType: 'agent', senderName: employee.name,
//         content: message || '', fileData: fileData || null,
//       });
//       if (sent.createdAt) updateConversation(conversation.id, { lastMessageAt: sent.createdAt });
//       return sent;
//     } catch (err) { refreshConversations(); throw err; }
//   };

//   const handleTyping = (isTyping) => {
//     if (activeConversation && ws) ws.sendTyping(activeConversation.id, isTyping, employee.name);
//   };

//   useEffect(() => {
//     if (!ws) return;

//     const u1 = ws.on('new_message', (data) => {
//       const curConv = activeConversationRef.current;
//       const curList = conversationsRef.current;
//       const msg = data.message || {};
//       const sender = msg.senderType || msg.sender_type;
//       const convId = data.conversationId || msg.conversationId;
//       const isActive = curConv?.id === convId;

//       const patch = {
//         lastMessage: msg.content || '',
//         lastMessageAt: msg.createdAt || msg.created_at || new Date().toISOString(),
//         lastSenderType: sender, lastMessageSenderType: sender,
//       };
//       if (sender === 'customer' && !isActive) {
//         const existing = curList.find(c => c.id === convId);
//         const prev = existing?.unreadCount || existing?.unread_count || 0;
//         patch.unreadCount = prev + 1;
//         patch.unread_count = prev + 1;
//       }
//       updateConversation(convId, patch);

//       if (sender === 'agent') { clearNotificationsForConversation(convId); return; }
//       if (sender === 'customer' && !isActive) {
//         const name = curList.find(c => c.id === convId)?.customerName || data.conversation?.customerName || 'Guest';
//         showNotification(convId, name, msg.content?.substring(0, 50) || 'New message');
//       } else if (sender === 'customer' && isActive) {
//         handleMarkAsRead(convId);
//       }
//     });

//     const u2 = ws.on('connected', () => setError(null));
//     const u3 = ws.on('error', () => setError('WebSocket connection error. Retrying…'));
//     const u4 = ws.on('max_reconnect_reached', () => setError('Unable to connect to server. Please refresh the page.'));

//     const u5 = ws.on('legal_threat_detected', (data) => {
//       const a = data.alert;
//       if (!a?.conversationId) return;
//       const emoji = a.severity === 'critical' ? '🚨' : a.severity === 'high' ? '⚠️' : '🔔';
//       updateConversation(a.conversationId, { priority: 'urgent', legalFlag: true, legalFlagSeverity: a.severity, legalFlagTerm: a.matchedTerm });
//       if (String(activeConversationRef.current?.id) !== String(a.conversationId))
//         showNotification(a.conversationId, `${emoji} Legal Threat — ${a.severity?.toUpperCase()}`, `"${a.matchedTerm}" from ${a.senderName || 'Customer'}`);
//     });

//     const u6 = ws.on('conversation_unread', (data) => {
//       if (!data?.conversationId) return;
//       updateConversation(data.conversationId, { unreadCount: 1, unread_count: 1, unread: 1, ...(data.conversation || {}) });
//     });

//     const u7 = ws.on('conversation_archived', (data) => {
//       if (!data?.conversationId) return;
//       updateConversation(data.conversationId, { status: 'archived' });
//       const cur = activeConversationRef.current;
//       if (cur && String(cur.id) === String(data.conversationId)) { setActiveConversation(null); setActiveConversationId(null); }
//     });

//     const u8 = ws.on('conversation_unarchived', (data) => {
//       if (!data?.conversationId) return;
//       updateConversation(data.conversationId, { status: 'open', ...(data.conversation || {}) });
//     });

//     return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
//   }, [ws, handleMarkAsRead, updateConversation, setActiveConversationId]);

//   useEffect(() => {
//     if (activeConversation && ws) {
//       ws.joinConversation(activeConversation.id);
//       clearNotificationsForConversation(activeConversation.id);
//       return () => { ws.leaveConversation(); };
//     }
//   }, [activeConversation, ws]);

//   const showNotification = (convId, name, preview) => {
//     if (!('Notification' in window) || Notification.permission !== 'granted') return;
//     try {
//       const n = new Notification(`New message from ${name}`, {
//         body: preview, icon: '/favicon.ico', tag: `conv-${convId}`, requireInteraction: false, silent: false,
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
//     const i = arr.indexOf(n);
//     if (i > -1) arr.splice(i, 1);
//     if (!arr.length) activeNotificationsRef.current.delete(convId);
//   };

//   const clearNotificationsForConversation = (convId) => {
//     const arr = activeNotificationsRef.current.get(convId);
//     if (arr?.length) { arr.forEach(n => { try { n.close(); } catch { /* ignore */ } }); activeNotificationsRef.current.delete(convId); }
//   };

//   const requestNotificationPermission = () => {
//     if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
//   };

//   const loadStores = async () => {
//     try { setLoadingStores(true); setStores((await api.getStores()) || []); }
//     catch { setStores([]); } finally { setLoadingStores(false); }
//   };

//   const loadStats = async () => {
//     try { setStats(await api.getDashboardStats()); } catch { /* non-critical */ }
//   };

//   const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
//   const isConnected = (() => { try { return ws?.isConnected() ?? false; } catch { return false; } })();
//   const handleBackToDashboard = () => setActivePage('dashboard');

//   const navigateTo = (page) => {
//     setActivePage(page);
//     setProfileDropdownOpen(false);
//   };

//   return (
//     <div className="app">

//       {/* ─── HEADER ─── */}
//       <header className="app-header">
//         <div className="header-left">
//           <h1>💬 Chat Support Pro</h1>
//           {activePage === 'dashboard' && stats && (
//             <div className="header-stats">
//               <span className="stat-pill">
//                 <span className="stat-dot open" />
//                 {stats.openConversations || 0} open
//               </span>
//               <span className="stat-pill">
//                 🏪 {stats.activeStores || stores.length} stores
//               </span>
//               <span className={`stat-pill ${isConnected ? 'stat-connected' : 'stat-offline'}`}>
//                 <span className={`status-dot ${isConnected ? '' : 'status-offline'}`} />
//                 {isConnected ? 'Live' : 'Offline'}
//               </span>
//             </div>
//           )}
//         </div>

//         <div className="header-right">
//           {/* Primary nav — only non-admin shortcuts */}
//           <nav className="header-nav">
//             <button
//               className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
//               onClick={() => setActivePage('dashboard')}
//               type="button"
//             >
//               💬 Dashboard
//             </button>

//             {activePage === 'dashboard' && (
//               <button
//                 className={`nav-btn ${showNotesModal ? 'nav-active' : ''}`}
//                 onClick={() => setShowNotesModal(true)}
//                 type="button"
//                 title="My Notes"
//               >
//                 📝 Notes
//               </button>
//             )}

//             {activePage === 'dashboard' && (
//               <button
//                 className="btn-refresh"
//                 onClick={refreshConversations}
//                 type="button"
//                 title="Refresh conversations"
//               >
//                 🔄
//               </button>
//             )}
//           </nav>

//           {/* ─── Profile + Dropdown ─── */}
//           <div className="profile-menu-wrapper" ref={profileDropdownRef}>
//             <button
//               className={`profile-trigger ${profileDropdownOpen ? 'profile-trigger--open' : ''}`}
//               onClick={() => setProfileDropdownOpen(v => !v)}
//               type="button"
//               aria-haspopup="true"
//               aria-expanded={profileDropdownOpen}
//             >
//               <div className="profile-avatar" data-role={employee.role}>
//                 {getInitials(employee.name)}
//               </div>
//               <div className="profile-info">
//                 <span className="profile-name">{employee.name}</span>
//                 <span className="profile-role">
//                   {employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}
//                 </span>
//               </div>
//               <span className={`profile-chevron ${profileDropdownOpen ? 'profile-chevron--up' : ''}`}>
//                 ▾
//               </span>
//             </button>

//             {profileDropdownOpen && (
//               <div className="profile-dropdown" role="menu">
//                 {/* User info card at top */}
//                 <div className="dropdown-user-card">
//                   <div className="dropdown-avatar" data-role={employee.role}>
//                     {getInitials(employee.name)}
//                   </div>
//                   <div>
//                     <div className="dropdown-user-name">{employee.name}</div>
//                     <div className="dropdown-user-role">
//                       {employee.role === 'admin' ? '👑 Administrator' : '👤 Support Agent'}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="dropdown-divider" />

//                 {/* Navigation items */}
//                 <button
//                   className={`dropdown-item ${activePage === 'archived' ? 'dropdown-item--active' : ''}`}
//                   onClick={() => navigateTo('archived')}
//                   type="button"
//                   role="menuitem"
//                 >
//                   <span className="dropdown-item-icon">📦</span>
//                   <span className="dropdown-item-label">Archived Messages</span>
//                   {activePage === 'archived' && <span className="dropdown-item-check">✓</span>}
//                 </button>

//                 {employee.role === 'admin' && (
//                   <>
//                     <button
//                       className={`dropdown-item ${activePage === 'blacklist' ? 'dropdown-item--active' : ''}`}
//                       onClick={() => navigateTo('blacklist')}
//                       type="button"
//                       role="menuitem"
//                     >
//                       <span className="dropdown-item-icon">🚫</span>
//                       <span className="dropdown-item-label">Blacklist</span>
//                       {activePage === 'blacklist' && <span className="dropdown-item-check">✓</span>}
//                     </button>

//                     <button
//                       className={`dropdown-item ${activePage === 'stores' ? 'dropdown-item--active' : ''}`}
//                       onClick={() => navigateTo('stores')}
//                       type="button"
//                       role="menuitem"
//                     >
//                       <span className="dropdown-item-icon">🏪</span>
//                       <span className="dropdown-item-label">Store Management</span>
//                       {activePage === 'stores' && <span className="dropdown-item-check">✓</span>}
//                     </button>

//                     <button
//                       className={`dropdown-item ${activePage === 'employees' ? 'dropdown-item--active' : ''}`}
//                       onClick={() => navigateTo('employees')}
//                       type="button"
//                       role="menuitem"
//                     >
//                       <span className="dropdown-item-icon">👥</span>
//                       <span className="dropdown-item-label">Employee Management</span>
//                       {activePage === 'employees' && <span className="dropdown-item-check">✓</span>}
//                     </button>

//                     <button
//                       className={`dropdown-item ${activePage === 'training' ? 'dropdown-item--active' : ''}`}
//                       onClick={() => navigateTo('training')}
//                       type="button"
//                       role="menuitem"
//                     >
//                       <span className="dropdown-item-icon">🧠</span>
//                       <span className="dropdown-item-label">AI Training</span>
//                       {activePage === 'training' && <span className="dropdown-item-check">✓</span>}
//                     </button>
//                   </>
//                 )}

//                 <div className="dropdown-divider" />

//                 <button
//                   className="dropdown-item dropdown-item--danger"
//                   onClick={() => { setProfileDropdownOpen(false); setShowLogoutModal(true); }}
//                   type="button"
//                   role="menuitem"
//                 >
//                   <span className="dropdown-item-icon">🚪</span>
//                   <span className="dropdown-item-label">Logout</span>
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>
//       </header>

//       {/* ─── Logout Modal ─── */}
//       {showLogoutModal && (
//         <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
//           <div className="modal-content logout-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🚪 Confirm Logout</h3></div>
//             <div className="modal-body">
//               <p>Are you sure you want to logout?</p>
//               <p className="logout-user-info">
//                 Logged in as: <strong>{employee.name}</strong>
//                 <span className={`logout-role-badge ${employee.role}`}>
//                   {employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}
//                 </span>
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
//         <ConversationNotes employeeId={employee.id} employeeName={employee.name} onClose={() => setShowNotesModal(false)} />
//       )}

//       <MobileMenu
//         isOpen={mobileMenuOpen}
//         onClose={() => setMobileMenuOpen(false)}
//         employee={employee}
//         activePage={activePage}
//         onPageChange={(page) => { setActivePage(page); setMobileMenuOpen(false); }}
//         onRefresh={() => { refreshConversations(); setMobileMenuOpen(false); }}
//         onLogout={() => setShowLogoutModal(true)}
//         stats={stats}
//         isConnected={isConnected}
//       />

//       {error && (
//         <div className="error-banner">
//           <span>⚠️ {error}</span>
//           <button onClick={() => setError(null)} type="button">×</button>
//         </div>
//       )}

//       {activePage === 'dashboard' && (
//         <div className="app-content">
//           <div className={`conversations-sidebar ${activeConversation ? 'hidden-mobile' : ''}`}>
//             <div className="conversation-list-header mobile-header">
//               <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu" type="button">
//                 <span /><span /><span />
//               </button>
//               <h2>Conversations</h2>
//               <span className="conversation-count">{conversations.length}</span>
//             </div>
//             <ConversationList
//               conversations={visibleConversations}
//               activeConversation={activeConversation}
//               onSelectConversation={handleSelectConversation}
//               onMarkAsRead={handleMarkAsRead}
//               onMarkAsUnread={handleMarkAsUnread}
//               filters={filters}
//               onFilterChange={updateFilters}
//               stores={stores}
//               loading={conversationsLoading || loadingStores}
//               onArchive={(convId) => updateConversationStatus(convId, 'archived')}
//               onBlock={(convId) => updateConversationStatus(convId, 'blacklisted')}

//             />
//           </div>
//           <div className={`chat-window ${!activeConversation ? 'hidden' : ''}`}>
//             <ErrorBoundary>
//               <ChatWindow
//                 conversation={activeConversation}
//                 onSendMessage={handleSendMessage}
//                 onClose={() => setActiveConversation(null)}
//                 onTyping={handleTyping}
//                 employeeName={employee.name}
//                 onMenuToggle={() => setMobileMenuOpen(v => !v)}
//                 stores={stores}
//                 isAdmin={employee.role === 'admin'}
//                 onMarkAsUnread={handleMarkAsUnread}
//                 onArchive={handleArchive}
//                 onBlacklist={handleBlacklist}
//               />
//             </ErrorBoundary>
//           </div>
//         </div>
//       )}

//       {activePage === 'archived' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
//           <ErrorBoundary>
//             <ArchivedConversations onBack={handleBackToDashboard} onUnarchive={() => refreshConversations()} stores={stores} />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'blacklist' && employee.role === 'admin' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
//           <ErrorBoundary>
//             <BlacklistManager onBack={handleBackToDashboard} />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'stores' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
//           <ErrorBoundary>
//             <StoreManagement onBack={handleBackToDashboard} onStoresUpdated={loadStores} />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'employees' && (
//         <div className="app-content full-width">
//           <EmployeeManagement currentUser={employee} onBack={handleBackToDashboard} />
//         </div>
//       )}

//       {activePage === 'training' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
//           <ErrorBoundary>
//             <AITraining onBrainUpdate={() => {}} />
//           </ErrorBoundary>
//         </div>
//       )}

//     </div>
//   );
// }

// export default App;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from './services/api';
import { useConversations } from './hooks/useConversations';
import { useWebSocket } from './hooks/useWebSocket';
import ConversationList from './components/ConversationList';
import ChatWindow from './components/ChatWindow';
import Login from './components/Login';
import EmployeeManagement from './components/EmployeeManagement';
import ErrorBoundary from './components/ErrorBoundary';
import MobileMenu from './components/MobileMenu';
import ConversationNotes from './components/ConversationNotes';
import AITraining from './components/AITraining';
import StoreManagement from './components/StoreManagement';
import ArchivedConversations from './components/Archivedconversations';
import BlacklistManager from './components/Blacklistmanager';

function App() {
  const [employee, setEmployee] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const storedEmployee = localStorage.getItem('employee');
    const token = localStorage.getItem('token');
    if (storedEmployee && token) {
      try {
        const { employee: verified } = await api.verifyToken();
        setEmployee(verified);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('employee');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogin  = (data) => { setEmployee(data); setIsAuthenticated(true); };
  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    localStorage.removeItem('employee');
    localStorage.removeItem('token');
    setEmployee(null);
    setIsAuthenticated(false);
  };

  if (loading)          return <div className="loading-container"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;
  return <DashboardContent employee={employee} onLogout={handleLogout} />;
}

function DashboardContent({ employee, onLogout }) {
  const [activePage,          setActivePage]          = useState('dashboard');
  const [activeConversation,  setActiveConversation]  = useState(null);
  const [stores,              setStores]              = useState([]);
  const [stats,               setStats]               = useState(null);
  const [loadingStores,       setLoadingStores]       = useState(true);
  const [error,               setError]               = useState(null);
  const [mobileMenuOpen,      setMobileMenuOpen]      = useState(false);
  const [showLogoutModal,     setShowLogoutModal]     = useState(false);
  const [showNotesModal,      setShowNotesModal]      = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Session-level exclusion set — conversations hidden after archive/blacklist.
  // Managed explicitly; NO generic self-healing effect (that caused blocked convs
  // to reappear when the server status update was delayed or didn't match).
  const [excludedConversationIds, setExcludedConversationIds] = useState(new Set());

  const profileDropdownRef          = useRef(null);
  const activeNotificationsRef      = useRef(new Map());
  const markAsReadTimerRef          = useRef(new Map());
  const activeConversationRef       = useRef(activeConversation);
  const conversationsRef            = useRef([]);

  // Emails we've explicitly unblacklisted — used by the targeted self-heal
  // effect so it only restores conversations we deliberately unblacklisted,
  // never ones that were just blacklisted and are pending a server update.
  const pendingUnblacklistEmailsRef = useRef(new Set());

  const {
    conversations, loading: conversationsLoading,
    filters, updateFilters,
    refresh: refreshConversations,
    updateConversation, optimisticUpdate,
    setActiveConversationId,
  } = useConversations(employee.id);

  const ws = useWebSocket(employee.id);

  // ── Exclusion set helpers ─────────────────────────────────────────────────

  const removeFromExcluded = useCallback((conversationId) => {
    setExcludedConversationIds(prev => {
      const next = new Set(prev);
      next.delete(String(conversationId));
      return next;
    });
  }, []);

  // Removes ALL conversation IDs belonging to a given email.
  // Used when unblacklisting (blacklist is keyed by email, not conv ID).
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

  // ── visibleConversations ──────────────────────────────────────────────────
  // Original filter — exclusion set + status both act as independent guards.
  const visibleConversations = React.useMemo(
    () => (conversations || []).filter(c =>
      !excludedConversationIds.has(String(c.id)) &&
      c.status !== 'archived'    &&
      c.status !== 'blacklisted' &&
      c.status !== 'blacklist'
    ),
    [conversations, excludedConversationIds]
  );

  // ── Targeted self-heal for unblacklist ───────────────────────────────────
  // Blacklisted conversations are NOT returned by the server API, so they are
  // absent from conversationsRef when blacklisted. That means removeEmailFromExcluded
  // can't find their IDs to clear them from the exclusion set.
  // This effect runs after refreshConversations() brings them back as status:'open'
  // and clears them from the exclusion set — but ONLY for emails we explicitly
  // unblacklisted (pendingUnblacklistEmailsRef), so we never accidentally restore
  // a conversation that was just blacklisted and is pending a slow server update.
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

    // Clean up pending emails once restored
    toRestore.forEach(c => {
      const email = (c.customerEmail || c.customer_email || '').toLowerCase().trim();
      pendingUnblacklistEmailsRef.current.delete(email);
    });
  }, [conversations, excludedConversationIds]);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { conversationsRef.current      = conversations;      }, [conversations]);

  useEffect(() => { loadStores(); loadStats(); requestNotificationPermission(); }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target))
        setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  useEffect(() => {
    if (['employees','stores','blacklist','training'].includes(activePage) && employee.role !== 'admin')
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

  // Called by BlacklistManager when removing an entry.
  // 1. Marks email in pendingUnblacklistEmailsRef so the self-heal effect
  //    knows it's safe to clear those IDs from the exclusion set once
  //    refreshConversations brings them back as status:'open'.
  // 2. awaits refreshConversations so state updates before the effect fires.
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

  const handleSendMessage = async (conversation, message, fileData) => {
    const storeId = conversation.shopId || conversation.shop_id || conversation.storeId;
    if (!storeId) throw new Error('Store ID is missing from conversation');
    clearNotificationsForConversation(conversation.id);
    handleMarkAsRead(conversation.id);
    optimisticUpdate(conversation.id, message);
    try {
      const sent = await api.sendMessage({
        conversationId: conversation.id, storeId,
        senderType: 'agent', senderName: employee.name,
        content: message || '', fileData: fileData || null,
      });
      if (sent.createdAt) updateConversation(conversation.id, { lastMessageAt: sent.createdAt });
      return sent;
    } catch (err) { refreshConversations(); throw err; }
  };

  const handleTyping = (isTyping) => {
    if (activeConversation && ws) ws.sendTyping(activeConversation.id, isTyping, employee.name);
  };

  // ── WebSocket handlers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ws) return;

    const u1 = ws.on('new_message', (data) => {
      const curConv  = activeConversationRef.current;
      const curList  = conversationsRef.current;
      const msg      = data.message || {};
      const sender   = msg.senderType || msg.sender_type;
      const convId   = data.conversationId || msg.conversationId;
      const isActive = curConv?.id === convId;

      const patch = {
        lastMessage:           msg.content || '',
        lastMessageAt:         msg.createdAt || msg.created_at || new Date().toISOString(),
        lastSenderType:        sender,
        lastMessageSenderType: sender,
      };
      if (sender === 'customer' && !isActive) {
        const existing = curList.find(c => c.id === convId);
        const prev = existing?.unreadCount || existing?.unread_count || 0;
        patch.unreadCount = prev + 1; patch.unread_count = prev + 1;
      }
      updateConversation(convId, patch);

      if (sender === 'agent') { clearNotificationsForConversation(convId); return; }
      if (sender === 'customer' && !isActive) {
        const name = curList.find(c => c.id === convId)?.customerName || data.conversation?.customerName || 'Guest';
        showNotification(convId, name, msg.content?.substring(0, 50) || 'New message');
      } else if (sender === 'customer' && isActive) {
        handleMarkAsRead(convId);
      }
    });

    const u2 = ws.on('connected',             () => setError(null));
    const u3 = ws.on('error',                 () => setError('WebSocket connection error. Retrying…'));
    const u4 = ws.on('max_reconnect_reached',  () => setError('Unable to connect to server. Please refresh the page.'));

    const u5 = ws.on('legal_threat_detected', (data) => {
      const a = data.alert;
      if (!a?.conversationId) return;
      const emoji = a.severity === 'critical' ? '🚨' : a.severity === 'high' ? '⚠️' : '🔔';
      updateConversation(a.conversationId, { priority: 'urgent', legalFlag: true, legalFlagSeverity: a.severity, legalFlagTerm: a.matchedTerm });
      if (String(activeConversationRef.current?.id) !== String(a.conversationId))
        showNotification(a.conversationId, `${emoji} Legal Threat — ${a.severity?.toUpperCase()}`, `"${a.matchedTerm}" from ${a.senderName || 'Customer'}`);
    });

    const u6 = ws.on('conversation_unread', (data) => {
      if (!data?.conversationId) return;
      updateConversation(data.conversationId, { unreadCount: 1, unread_count: 1, unread: 1, ...(data.conversation || {}) });
    });

    const u7 = ws.on('conversation_archived', (data) => {
      if (!data?.conversationId) return;
      updateConversation(data.conversationId, { status: 'archived' });
      setExcludedConversationIds(prev => new Set([...prev, String(data.conversationId)]));
      const cur = activeConversationRef.current;
      if (cur && String(cur.id) === String(data.conversationId)) {
        setActiveConversation(null); setActiveConversationId(null);
      }
    });

    const u8 = ws.on('conversation_unarchived', (data) => {
      if (!data?.conversationId) return;
      updateConversation(data.conversationId, { status: 'open', archivedAt: null, ...(data.conversation || {}) });
      removeFromExcluded(data.conversationId);
      refreshConversations();
    });

    // Server just set status → 'blacklisted': hide immediately
    const u9 = ws.on('conversation_blacklisted', (data) => {
      if (!data?.conversationId) return;
      updateConversation(data.conversationId, { status: 'blacklisted' });
      setExcludedConversationIds(prev => new Set([...prev, String(data.conversationId)]));
      const cur = activeConversationRef.current;
      if (cur && String(cur.id) === String(data.conversationId)) {
        setActiveConversation(null); setActiveConversationId(null);
      }
    });

    // Server just set status → 'open': restore the conversation.
    // Fires regardless of which UI path triggered the blacklist removal.
    const u10 = ws.on('conversation_unblacklisted', (data) => {
      if (!data?.conversationId) return;
      updateConversation(data.conversationId, { status: 'open' });
      removeFromExcluded(data.conversationId);
      if (data.email) removeEmailFromExcluded(data.email);
      refreshConversations();
    });
    const u11 = ws.on('conversation_updated', (data) => {
  if (!data?.conversationId || !data?.conversation) return;
  const conv = data.conversation;
  updateConversation(data.conversationId, {
    lastMessage:           conv.lastMessage           || conv.last_message           || '',
    lastMessageSenderType: conv.lastMessageSenderType || conv.last_message_sender_type || 'customer',
    lastSenderType:        conv.lastMessageSenderType || conv.last_message_sender_type || 'customer',
    lastMessageAt:         conv.lastMessageAt          || conv.last_message_at,
    unreadCount:           conv.unreadCount            ?? conv.unread_count,
    unread_count:          conv.unreadCount            ?? conv.unread_count,
  });
});

return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); };

  }, [ws, handleMarkAsRead, updateConversation, setActiveConversationId,
      removeFromExcluded, removeEmailFromExcluded, refreshConversations]);

  useEffect(() => {
    if (activeConversation && ws) {
      ws.joinConversation(activeConversation.id);
      clearNotificationsForConversation(activeConversation.id);
      return () => { ws.leaveConversation(); };
    }
  }, [activeConversation, ws]);

  // ── Notification helpers ──────────────────────────────────────────────────
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
    try { setLoadingStores(true); setStores((await api.getStores()) || []); }
    catch { setStores([]); } finally { setLoadingStores(false); }
  };

  const loadStats = async () => {
    try { setStats(await api.getDashboardStats()); } catch { /* non-critical */ }
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  const isConnected = (() => { try { return ws?.isConnected() ?? false; } catch { return false; } })();
  const navigateTo  = (page) => { setActivePage(page); setProfileDropdownOpen(false); };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>💬 Chat Support Pro</h1>
          {activePage === 'dashboard' && stats && (
            <div className="header-stats">
              <span className="stat-pill"><span className="stat-dot open" />{stats.openConversations || 0} open</span>
              <span className="stat-pill">🏪 {stats.activeStores || stores.length} stores</span>
              <span className={`stat-pill ${isConnected ? 'stat-connected' : 'stat-offline'}`}>
                <span className={`status-dot ${isConnected ? '' : 'status-offline'}`} />
                {isConnected ? 'Live' : 'Offline'}
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
              <div className="profile-avatar" data-role={employee.role}>{getInitials(employee.name)}</div>
              <div className="profile-info">
                <span className="profile-name">{employee.name}</span>
                <span className="profile-role">{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
              </div>
              <span className={`profile-chevron ${profileDropdownOpen ? 'profile-chevron--up' : ''}`}>▾</span>
            </button>

            {profileDropdownOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="dropdown-user-card">
                  <div className="dropdown-avatar" data-role={employee.role}>{getInitials(employee.name)}</div>
                  <div>
                    <div className="dropdown-user-name">{employee.name}</div>
                    <div className="dropdown-user-role">{employee.role === 'admin' ? '👑 Administrator' : '👤 Support Agent'}</div>
                  </div>
                </div>
                <div className="dropdown-divider" />

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
                Logged in as: <strong>{employee.name}</strong>
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
        <ConversationNotes employeeId={employee.id} employeeName={employee.name} onClose={() => setShowNotesModal(false)} />
      )}

      <MobileMenu
        isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}
        employee={employee} activePage={activePage}
        onPageChange={(page) => { setActivePage(page); setMobileMenuOpen(false); }}
        onRefresh={() => { refreshConversations(); setMobileMenuOpen(false); }}
        onLogout={() => setShowLogoutModal(true)}
        stats={stats} isConnected={isConnected}
      />

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} type="button">×</button>
        </div>
      )}

      {activePage === 'dashboard' && (
        <div className="app-content">
          <div className={`conversations-sidebar ${activeConversation ? 'hidden-mobile' : ''}`}>
            <div className="conversation-list-header mobile-header">
              <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu" type="button">
                <span /><span /><span />
              </button>
              <h2>Conversations</h2>
              <span className="conversation-count">{conversations.length}</span>
            </div>
            <ConversationList
              conversations={visibleConversations}
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
            />
          </div>
          <div className={`chat-window ${!activeConversation ? 'hidden' : ''}`}>
            <ErrorBoundary>
              <ChatWindow
                conversation={activeConversation}
                onSendMessage={handleSendMessage}
                onClose={() => setActiveConversation(null)}
                onTyping={handleTyping}
                employeeName={employee.name}
                onMenuToggle={() => setMobileMenuOpen(v => !v)}
                stores={stores}
                isAdmin={employee.role === 'admin'}
                onMarkAsUnread={handleMarkAsUnread}
                onArchive={handleArchive}
                onBlacklist={handleBlacklist}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {activePage === 'archived' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <ArchivedConversations onBack={() => setActivePage('dashboard')} onUnarchive={handleUnarchive} stores={stores} />
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'blacklist' && employee.role === 'admin' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <BlacklistManager onBack={() => setActivePage('dashboard')} onUnblacklist={handleUnblacklist} />
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'stores' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
          <ErrorBoundary>
            <StoreManagement onBack={() => setActivePage('dashboard')} onStoresUpdated={loadStores} />
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'employees' && (
        <div className="app-content full-width">
          <EmployeeManagement currentUser={employee} onBack={() => setActivePage('dashboard')} />
        </div>
      )}

      {activePage === 'training' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <AITraining onBrainUpdate={() => {}} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

export default App;