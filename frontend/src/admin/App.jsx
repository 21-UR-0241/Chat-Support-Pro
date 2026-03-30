

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
// // import AnalyticsDashboard from './components/AnalyticsDashboard';
// import AITraining from './components/AITraining';
// import StoreManagement from './components/StoreManagement';

// function App() {
//   const [employee, setEmployee] = useState(null);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     checkAuth();
//   }, []);

//   const checkAuth = async () => {
//     const storedEmployee = localStorage.getItem('employee');
//     const token = localStorage.getItem('token');

//     if (storedEmployee && token) {
//       try {
//         console.log('🔍 Verifying stored session...');
//         const { employee: verifiedEmployee } = await api.verifyToken();
        
//         console.log('✅ Session valid, logged in as:', verifiedEmployee.email);
//         setEmployee(verifiedEmployee);
//         setIsAuthenticated(true);
//       } catch (error) {
//         console.error('❌ Session verification failed:', error.message);
//         localStorage.removeItem('employee');
//         localStorage.removeItem('token');
//         setEmployee(null);
//         setIsAuthenticated(false);
//       }
//     }
    
//     setLoading(false);
//   };

//   const handleLogin = (employeeData) => {
//     console.log('✅ Login successful, setting authenticated state');
//     setEmployee(employeeData);
//     setIsAuthenticated(true);
//   };

//   const handleLogout = async () => {
//     try {
//       await api.logout();
//     } catch (error) {
//       console.error('Logout error:', error);
//     }
//     localStorage.removeItem('employee');
//     localStorage.removeItem('token');
//     setEmployee(null);
//     setIsAuthenticated(false);
//   };

//   if (loading) {
//     return (
//       <div className="loading-container">
//         <div className="spinner"></div>
//       </div>
//     );
//   }

//   if (!isAuthenticated) {
//     return <Login onLogin={handleLogin} />;
//   }

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

//   const activeNotificationsRef = useRef(new Map());
//   const markAsReadTimerRef = useRef(new Map());

//   const {
//     conversations,
//     loading: conversationsLoading,
//     filters,
//     updateFilters,
//     refresh: refreshConversations,
//     updateConversation,
//     optimisticUpdate,
//     setActiveConversationId,
//   } = useConversations(employee.id);

//   const ws = useWebSocket(employee.id);

//   const activeConversationRef = useRef(activeConversation);
//   const conversationsRef = useRef(conversations);

//   useEffect(() => {
//     activeConversationRef.current = activeConversation;
//   }, [activeConversation]);

//   useEffect(() => {
//     conversationsRef.current = conversations;
//   }, [conversations]);

//   useEffect(() => {
//     loadStores();
//     loadStats();
//     requestNotificationPermission();
//   }, []);

//   const handleMarkAsRead = useCallback((conversationId) => {
//     console.log('👁️ [App] Marking conversation as read:', conversationId);

//     updateConversation(conversationId, {
//       unreadCount: 0,
//       unread_count: 0,
//       unread: 0,
//     });

//     if (markAsReadTimerRef.current.has(conversationId)) {
//       clearTimeout(markAsReadTimerRef.current.get(conversationId));
//     }

//     markAsReadTimerRef.current.set(
//       conversationId,
//       setTimeout(async () => {
//         try {
//           await api.markConversationRead(conversationId);
//           console.log('✅ [App] Server confirmed conversation read:', conversationId);
//         } catch (error) {
//           console.error('❌ [App] Failed to mark conversation as read:', error);
//         }
//         markAsReadTimerRef.current.delete(conversationId);
//       }, 300)
//     );
//   }, [updateConversation]);

//   // ── Mark as unread ────────────────────────────────────────────────────────
//   const handleMarkAsUnread = useCallback(async (conversationId) => {
//     console.log('🔵 [App] Marking conversation as unread:', conversationId);

//     // Optimistic update — badge reappears instantly
//     updateConversation(conversationId, {
//       unreadCount: 1,
//       unread_count: 1,
//       unread: 1,
//     });

//     // If this is the active conversation, deselect it so the user
//     // navigates back to the list (matching WhatsApp behaviour)
//     const currentActiveConv = activeConversationRef.current;
//     if (currentActiveConv && String(currentActiveConv.id) === String(conversationId)) {
//       setActiveConversation(null);
//       setActiveConversationId(null);
//     }

//     try {
//       await api.markConversationUnread(conversationId);
//       console.log('✅ [App] Server confirmed conversation unread:', conversationId);
//     } catch (error) {
//       console.error('❌ [App] Failed to mark conversation as unread:', error);
//       // Roll back optimistic update on failure
//       updateConversation(conversationId, {
//         unreadCount: 0,
//         unread_count: 0,
//         unread: 0,
//       });
//     }
//   }, [updateConversation, setActiveConversationId]);
//   // ─────────────────────────────────────────────────────────────────────────

//   const handleSelectConversation = useCallback((conversation) => {
//     setActiveConversation(conversation);
//     setActiveConversationId(conversation.id);

//     const unreadCount = conversation.unreadCount || conversation.unread_count || conversation.unread || 0;
//     if (unreadCount > 0) {
//       handleMarkAsRead(conversation.id);
//     }
//   }, [handleMarkAsRead, setActiveConversationId]);

//   const handleShowNotes = useCallback(() => {
//     console.log('📝 [App] Opening notes modal');
//     setShowNotesModal(true);
//   }, []);

//   const handleCloseNotes = useCallback(() => {
//     console.log('📝 [App] Closing notes modal');
//     setShowNotesModal(false);
//   }, []);


//   useEffect(() => {
//     if (!ws) return;

//     const unsubscribe1 = ws.on('new_message', (data) => {
//       const currentActiveConv = activeConversationRef.current;
//       const currentConversations = conversationsRef.current;

//       console.log('📨 [App] New message received:', {
//         conversationId: data.conversationId,
//         senderType: data.message?.senderType || data.message?.sender_type,
//         activeConversation: currentActiveConv?.id
//       });

//       const message = data.message || {};
//       const senderType = message.senderType || message.sender_type;
//       const conversationId = data.conversationId || message.conversationId;

//       const isActiveConv = currentActiveConv?.id === conversationId;
//       const conversationUpdate = {
//         lastMessage: message.content || '',
//         lastMessageAt: message.createdAt || message.created_at || new Date().toISOString(),
//         lastSenderType: senderType,
//         lastMessageSenderType: senderType,
//       };

//       if (senderType === 'customer' && !isActiveConv) {
//         const existingConv = currentConversations.find(c => c.id === conversationId);
//         const currentUnread = existingConv?.unreadCount || existingConv?.unread_count || 0;
//         conversationUpdate.unreadCount = currentUnread + 1;
//         conversationUpdate.unread_count = currentUnread + 1;
//       }

//       updateConversation(conversationId, conversationUpdate);

//       if (senderType === 'agent') {
//         console.log('🔕 [App] Agent message - clearing notifications for conversation:', conversationId);
//         clearNotificationsForConversation(conversationId);
//         return;
//       }

//       if (senderType === 'customer' && !isActiveConv) {
//         const customerName =
//           currentConversations.find(c => c.id === conversationId)?.customerName ||
//           data.conversation?.customerName ||
//           data.conversation?.customer_name ||
//           'Guest';
//         const messagePreview = message.content?.substring(0, 50) || 'New message';

//         console.log('🔔 [App] Showing notification for customer message');
//         showNotification(conversationId, customerName, messagePreview);
//       } else if (senderType === 'customer' && isActiveConv) {
//         console.log('⏭️ [App] Customer message in active conversation - auto marking read');
//         handleMarkAsRead(conversationId);
//       }
//     });

//     const unsubscribe2 = ws.on('connected', () => {
//       console.log('✅ [App] Connected to WebSocket');
//       setError(null);
//     });

//     const unsubscribe3 = ws.on('disconnected', () => {
//       console.log('❌ [App] Disconnected from WebSocket');
//     });

//     const unsubscribe4 = ws.on('error', (error) => {
//       console.error('[App] WebSocket error:', error);
//       setError('WebSocket connection error. Retrying...');
//     });

//     const unsubscribe5 = ws.on('max_reconnect_reached', () => {
//       setError('Unable to connect to server. Please refresh the page.');
//     });

//     // ── Legal threat detection ─────────────────────────────────────────
//     const unsubscribe6 = ws.on('legal_threat_detected', (data) => {
//       const alert = data.alert;
//       if (!alert?.conversationId) return;

//       const emoji = alert.severity === 'critical' ? '🚨'
//                   : alert.severity === 'high'     ? '⚠️'
//                   : '🔔';

//       console.warn(`${emoji} [App] Legal threat — conv #${alert.conversationId} | ${alert.severity?.toUpperCase()} | "${alert.matchedTerm}"`);

//       updateConversation(alert.conversationId, {
//         priority: 'urgent',
//         legalFlag: true,
//         legalFlagSeverity: alert.severity,
//         legalFlagTerm: alert.matchedTerm,
//       });

//       const currentActiveConv = activeConversationRef.current;
//       if (String(currentActiveConv?.id) !== String(alert.conversationId)) {
//         showNotification(
//           alert.conversationId,
//           `${emoji} Legal Threat — ${alert.severity?.toUpperCase()}`,
//           `"${alert.matchedTerm}" from ${alert.senderName || 'Customer'}`
//         );
//       }
//     });

//     // ── Mark as unread (broadcast from another agent tab) ──────────────
//     const unsubscribe7 = ws.on('conversation_unread', (data) => {
//       if (!data?.conversationId) return;
//       console.log('🔵 [App] WS conversation_unread received for:', data.conversationId);
//       updateConversation(data.conversationId, {
//         unreadCount: 1,
//         unread_count: 1,
//         unread: 1,
//         ...(data.conversation || {}),
//       });
//     });
//     // ──────────────────────────────────────────────────────────────────

//     return () => {
//       unsubscribe1();
//       unsubscribe2();
//       unsubscribe3();
//       unsubscribe4();
//       unsubscribe5();
//       unsubscribe6();
//       unsubscribe7();
//     };
//   }, [ws, handleMarkAsRead, updateConversation]);


//   useEffect(() => {
//     if (activeConversation && ws) {
//       ws.joinConversation(activeConversation.id);
//       clearNotificationsForConversation(activeConversation.id);

//       return () => {
//         ws.leaveConversation();
//       };
//     }
//   }, [activeConversation, ws]);

//   useEffect(() => {
//     if (!activeConversation) {
//       setActiveConversationId(null);
//     }
//   }, [activeConversation, setActiveConversationId]);

//   useEffect(() => {
//     if (activeConversation) {
//       const updated = conversations.find(c => c.id === activeConversation.id);

//       if (updated && updated !== activeConversation) {
//         console.log('🔄 [App] Syncing activeConversation with updated data');
//         setActiveConversation(updated);
//       }
//     }
//   }, [conversations]);

//   const loadStores = async () => {
//     try {
//       setLoadingStores(true);
//       const data = await api.getStores();
//       setStores(data || []);
//     } catch (error) {
//       console.error('Failed to load stores:', error);
//       setStores([]);
//     } finally {
//       setLoadingStores(false);
//     }
//   };

//   const loadStats = async () => {
//     try {
//       const data = await api.getDashboardStats();
//       setStats(data);
//     } catch (error) {
//       console.error('Failed to load stats:', error);
//     }
//   };

//   const handleSendMessage = async (conversation, message, fileData) => {
//     console.log('📤 handleSendMessage called with:', {
//       conversationId: conversation.id,
//       message,
//       fileData
//     });

//     try {
//       const storeId = conversation.shopId || conversation.shop_id || conversation.storeId || null;

//       console.log('🏪 Store ID:', storeId);

//       if (!storeId) {
//         console.error('❌ No store ID found in conversation:', conversation);
//         throw new Error('Store ID is missing from conversation');
//       }

//       clearNotificationsForConversation(conversation.id);
//       handleMarkAsRead(conversation.id);
//       optimisticUpdate(conversation.id, message);

//       const messageData = {
//         conversationId: conversation.id,
//         storeId: storeId,
//         senderType: 'agent',
//         senderName: employee.name,
//         content: message || '',
//         fileData: fileData || null,
//       };

//       console.log('📨 Sending message with data:', messageData);

//       const sentMessage = await api.sendMessage(messageData);

//       console.log('✅ Message sent successfully:', sentMessage);

//       if (sentMessage.createdAt) {
//         updateConversation(conversation.id, {
//           lastMessageAt: sentMessage.createdAt,
//         });
//       }

//       return sentMessage;
//     } catch (error) {
//       console.error('❌ Failed to send message:', error);
//       console.error('Error details:', {
//         message: error.message,
//         response: error.response,
//         stack: error.stack
//       });

//       refreshConversations();

//       throw error;
//     }
//   };

//   const handleTyping = (isTyping) => {
//     if (activeConversation && ws) {
//       ws.sendTyping(activeConversation.id, isTyping, employee.name);
//     }
//   };

//   const handleCloseConversation = () => {
//     console.log('⬅️ Closing conversation (back to list)');
//     setActiveConversation(null);
//   };

//   const handleLogoutClick = () => {
//     setShowLogoutModal(true);
//   };

//   const handleConfirmLogout = () => {
//     setShowLogoutModal(false);
//     onLogout();
//   };

//   const handleCancelLogout = () => {
//     setShowLogoutModal(false);
//   };

//   const showNotification = (conversationId, customerName, messagePreview) => {
//     if (!('Notification' in window)) {
//       console.log('⚠️ Browser does not support notifications');
//       return;
//     }

//     if (Notification.permission !== 'granted') {
//       console.log('⚠️ Notification permission not granted');
//       return;
//     }

//     try {
//       const title = `New message from ${customerName}`;
//       const options = {
//         body: messagePreview,
//         icon: '/favicon.ico',
//         badge: '/badge-icon.png',
//         tag: `conv-${conversationId}`,
//         requireInteraction: false,
//         silent: false,
//       };

//       const notification = new Notification(title, options);

//       if (!activeNotificationsRef.current.has(conversationId)) {
//         activeNotificationsRef.current.set(conversationId, []);
//       }
//       activeNotificationsRef.current.get(conversationId).push(notification);

//       notification.onclick = () => {
//         window.focus();
//         const conv = conversationsRef.current.find(c => c.id === conversationId);
//         if (conv) {
//           handleSelectConversation(conv);
//         }
//         notification.close();
//         removeNotificationFromTracking(conversationId, notification);
//       };

//       notification.onclose = () => {
//         removeNotificationFromTracking(conversationId, notification);
//       };

//       setTimeout(() => {
//         notification.close();
//       }, 6000);

//       console.log('🔔 [App] Notification shown for conversation:', conversationId);
//     } catch (error) {
//       console.error('❌ Failed to create notification:', error);
//     }
//   };

//   const removeNotificationFromTracking = (conversationId, notification) => {
//     const notifications = activeNotificationsRef.current.get(conversationId);
//     if (notifications) {
//       const index = notifications.indexOf(notification);
//       if (index > -1) {
//         notifications.splice(index, 1);
//       }
//       if (notifications.length === 0) {
//         activeNotificationsRef.current.delete(conversationId);
//       }
//     }
//   };

//   const clearNotificationsForConversation = (conversationId) => {
//     const notifications = activeNotificationsRef.current.get(conversationId);
//     if (notifications && notifications.length > 0) {
//       console.log(`🔕 [App] Closing ${notifications.length} notification(s) for conversation ${conversationId}`);
//       notifications.forEach(notification => {
//         try {
//           notification.close();
//         } catch (error) {
//           console.error('Error closing notification:', error);
//         }
//       });
//       activeNotificationsRef.current.delete(conversationId);
//     }
//   };

//   const requestNotificationPermission = () => {
//     if ('Notification' in window && Notification.permission === 'default') {
//       Notification.requestPermission().then((permission) => {
//         console.log('Notification permission:', permission);
//       });
//     }
//   };

//   const getConnectionStatus = () => {
//     if (!ws) return false;
//     try {
//       return ws.isConnected();
//     } catch (error) {
//       return false;
//     }
//   };

//   const getInitials = (name) => {
//     if (!name) return 'U';
//     return name
//       .split(' ')
//       .map((n) => n[0])
//       .join('')
//       .toUpperCase()
//       .slice(0, 2);
//   };

//   const handleMobileMenuToggle = () => {
//     setMobileMenuOpen(!mobileMenuOpen);
//   };

//   const closeMobileMenu = () => {
//     setMobileMenuOpen(false);
//   };

//   const handleBackToDashboard = () => {
//     console.log('⬅️ Navigating back to dashboard');
//     setActivePage('dashboard');
//   };

//   // Re-sync the stores list in the sidebar after StoreManagement makes changes
//   const handleStoresUpdated = () => {
//     loadStores();
//   };

//   useEffect(() => {
//     if (
//       (activePage === 'employees' || activePage === 'analytics' || activePage === 'stores') &&
//       employee.role !== 'admin'
//     ) {
//       console.warn('⚠️ Non-admin user attempted to access restricted page');
//       setActivePage('dashboard');
//     }
//   }, [activePage, employee.role]);

//   const isConnected = getConnectionStatus();

//   return (
//     <div className="app">
//       <header className="app-header">
//         <div className="header-left">
//           <h1>💬 Chat Support Pro</h1>
//           {activePage === 'dashboard' && stats && (
//             <div className="header-stats">
//               <span>Open: {stats.openConversations || 0}</span>
//               <span>•</span>
//               <span>Stores: {stats.activeStores || stores.length}</span>
//               <span>•</span>
//               <span className={`status-badge ${isConnected ? '' : 'status-offline'}`}>
//                 <span className="status-dot"></span>
//                 {isConnected ? 'Connected' : 'Disconnected'}
//               </span>
//             </div>
//           )}
//         </div>

//         <div className="header-right">
//           <div className="header-nav">
//             <button
//               className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
//               onClick={() => setActivePage('dashboard')}
//               type="button"
//             >
//               💬 Dashboard
//             </button>

// {/* {employee.role === 'admin' && (
//   <button
//     className={`nav-btn ${activePage === 'analytics' ? 'nav-active' : ''}`}
//     onClick={() => setActivePage('analytics')}
//     type="button"
//   >
//     📊 Analytics
//   </button>
// )} */}

// {activePage === 'dashboard' && (
//   <button
//     className={`nav-btn ${showNotesModal ? 'nav-active' : ''}`}
//     onClick={handleShowNotes}
//     type="button"
//     title="My Notes"
//   >
//     📝 Notes
//   </button>
// )}

//             {employee.role === 'admin' && (
//               <button
//                 className={`nav-btn ${activePage === 'stores' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('stores')}
//                 type="button"
//               >
//                 🏪 Stores
//               </button>
//             )}

//             {employee.role === 'admin' && (
//               <button
//                 className={`nav-btn ${activePage === 'employees' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('employees')}
//                 type="button"
//               >
//                 👥 Employees
//               </button>
//             )}

//             {employee.role === 'admin' && (
//               <button
//                 className={`nav-btn ${activePage === 'training' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('training')}
//                 type="button"
//               >
//                 🧠 AI Training
//               </button>
//             )}
//           </div>

//           {activePage === 'dashboard' && (
//             <button
//               className="btn-refresh"
//               onClick={refreshConversations}
//               type="button"
//               title="Manually refresh conversations"
//             >
//               🔄 Refresh
//             </button>
//           )}

//           <div
//             className="employee-info"
//             data-role={employee.role}
//             onClick={handleLogoutClick}
//             title="Click to logout"
//           >
//             <div className="employee-details">
//               <span className="employee-name">{employee.name}</span>
//               <span className="employee-role">{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
//             </div>
//             <div className="employee-avatar">
//               {getInitials(employee.name)}
//             </div>
//           </div>
//         </div>
//       </header>

//       {showLogoutModal && (
//         <div className="modal-overlay" onClick={handleCancelLogout}>
//           <div className="modal-content logout-modal" onClick={(e) => e.stopPropagation()}>
//             <div className="modal-header">
//               <h3>🚪 Confirm Logout</h3>
//             </div>
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
//               <button
//                 className="btn-cancel"
//                 onClick={handleCancelLogout}
//                 type="button"
//               >
//                 Cancel
//               </button>
//               <button
//                 className="btn-logout"
//                 onClick={handleConfirmLogout}
//                 type="button"
//               >
//                 Yes, Logout
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {showNotesModal && (
//         <ConversationNotes
//           employeeId={employee.id}
//           employeeName={employee.name}
//           onClose={handleCloseNotes}
//         />
//       )}

//       <MobileMenu
//         isOpen={mobileMenuOpen}
//         onClose={closeMobileMenu}
//         employee={employee}
//         activePage={activePage}
//         onPageChange={(page) => {
//           setActivePage(page);
//           closeMobileMenu();
//         }}
//         onRefresh={() => {
//           refreshConversations();
//           closeMobileMenu();
//         }}
//         onLogout={handleLogoutClick}
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
//               <button
//                 className="mobile-menu-btn"
//                 onClick={handleMobileMenuToggle}
//                 aria-label="Menu"
//                 type="button"
//               >
//                 <span></span>
//                 <span></span>
//                 <span></span>
//               </button>
//               <h2>Conversations</h2>
//               <span className="conversation-count">{conversations.length}</span>
//             </div>

//             <ConversationList
//               conversations={conversations}
//               activeConversation={activeConversation}
//               onSelectConversation={handleSelectConversation}
//               onMarkAsRead={handleMarkAsRead}
//               onMarkAsUnread={handleMarkAsUnread}
//               filters={filters}
//               onFilterChange={updateFilters}
//               stores={stores}
//               loading={conversationsLoading || loadingStores}
//             />
//           </div>

//           <div className={`chat-window ${!activeConversation ? 'hidden' : ''}`}>
//             <ErrorBoundary>
//               <ChatWindow
//                 conversation={activeConversation}
//                 onSendMessage={handleSendMessage}
//                 onClose={handleCloseConversation}
//                 onTyping={handleTyping}
//                 employeeName={employee.name}
//                 onMenuToggle={handleMobileMenuToggle}
//                 stores={stores}
//                 isAdmin={employee.role === 'admin'}
//                 onMarkAsUnread={handleMarkAsUnread}
//               />
//             </ErrorBoundary>
//           </div>
//         </div>
//       )}

//       {activePage === 'analytics' && (
//         <div className="app-content full-width">
//           <ErrorBoundary>
//             <AnalyticsDashboard onBack={handleBackToDashboard} />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'stores' && (
//         <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
//           <ErrorBoundary>
//             <StoreManagement
//               onBack={handleBackToDashboard}
//               onStoresUpdated={handleStoresUpdated}
//             />
//           </ErrorBoundary>
//         </div>
//       )}

//       {activePage === 'employees' && (
//         <div className="app-content full-width">
//           <EmployeeManagement
//             currentUser={employee}
//             onBack={handleBackToDashboard}
//           />
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
// import ArchivedConversations from './components/ArchivedConversations';
// import BlacklistManager from './components/BlacklistManager';

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

//   const ws = useWebSocket(employee.id);

//   useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
//   useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

//   useEffect(() => { loadStores(); loadStats(); requestNotificationPermission(); }, []);

//   useEffect(() => {
//     if (['employees','stores','blacklist','training'].includes(activePage) && employee.role !== 'admin') {
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
//     const cur = activeConversationRef.current;
//     if (cur && String(cur.id) === String(conversationId)) { setActiveConversation(null); setActiveConversationId(null); }
//   }, [updateConversation, setActiveConversationId]);

//   const handleBlacklist = useCallback((payload) => api.blacklistCustomer(payload), []);

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

//   return (
//     <div className="app">

//       <header className="app-header">
//         <div className="header-left">
//           <h1>💬 Chat Support Pro</h1>
//           {activePage === 'dashboard' && stats && (
//             <div className="header-stats">
//               <span>Open: {stats.openConversations || 0}</span>
//               <span>•</span>
//               <span>Stores: {stats.activeStores || stores.length}</span>
//               <span>•</span>
//               <span className={`status-badge ${isConnected ? '' : 'status-offline'}`}>
//                 <span className="status-dot" />
//                 {isConnected ? 'Connected' : 'Disconnected'}
//               </span>
//             </div>
//           )}
//         </div>

//         <div className="header-right">
//           <div className="header-nav">
//             <button className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
//               onClick={() => setActivePage('dashboard')} type="button">💬 Dashboard</button>

//             {activePage === 'dashboard' && (
//               <button className={`nav-btn ${showNotesModal ? 'nav-active' : ''}`}
//                 onClick={() => setShowNotesModal(true)} type="button" title="My Notes">📝 Notes</button>
//             )}

//             <button
//               className={`nav-btn ${activePage === 'archived' ? 'nav-active' : ''}`}
//               onClick={() => setActivePage('archived')} type="button"
//               style={activePage === 'archived' ? { color: '#6366f1', borderColor: '#6366f1' } : {}}
//             >📦 Archived</button>

//             {employee.role === 'admin' && (
//               <button
//                 className={`nav-btn ${activePage === 'blacklist' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('blacklist')} type="button"
//                 style={activePage === 'blacklist' ? { color: '#e53e3e', borderColor: '#e53e3e' } : {}}
//               >🚫 Blacklist</button>
//             )}

//             {employee.role === 'admin' && (
//               <button className={`nav-btn ${activePage === 'stores' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('stores')} type="button">🏪 Stores</button>
//             )}

//             {employee.role === 'admin' && (
//               <button className={`nav-btn ${activePage === 'employees' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('employees')} type="button">👥 Employees</button>
//             )}

//             {employee.role === 'admin' && (
//               <button className={`nav-btn ${activePage === 'training' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('training')} type="button">🧠 AI Training</button>
//             )}
//           </div>

//           {activePage === 'dashboard' && (
//             <button className="btn-refresh" onClick={refreshConversations} type="button" title="Manually refresh conversations">
//               🔄 Refresh
//             </button>
//           )}

//           <div className="employee-info" data-role={employee.role}
//             onClick={() => setShowLogoutModal(true)} title="Click to logout">
//             <div className="employee-details">
//               <span className="employee-name">{employee.name}</span>
//               <span className="employee-role">{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
//             </div>
//             <div className="employee-avatar">{getInitials(employee.name)}</div>
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
//               conversations={conversations}
//               activeConversation={activeConversation}
//               onSelectConversation={handleSelectConversation}
//               onMarkAsRead={handleMarkAsRead}
//               onMarkAsUnread={handleMarkAsUnread}
//               filters={filters}
//               onFilterChange={updateFilters}
//               stores={stores}
//               loading={conversationsLoading || loadingStores}
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
//             <ArchivedConversations onBack={handleBackToDashboard} onUnarchive={() => refreshConversations()} />
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

  const handleLogin = (data) => { setEmployee(data); setIsAuthenticated(true); };

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    localStorage.removeItem('employee');
    localStorage.removeItem('token');
    setEmployee(null);
    setIsAuthenticated(false);
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;
  return <DashboardContent employee={employee} onLogout={handleLogout} />;
}

function DashboardContent({ employee, onLogout }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [activeConversation, setActiveConversation] = useState(null);
  const [stores, setStores] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStores, setLoadingStores] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [excludedConversationIds, setExcludedConversationIds] = useState(new Set());

  const profileDropdownRef = useRef(null);
  const activeNotificationsRef = useRef(new Map());
  const markAsReadTimerRef = useRef(new Map());
  const activeConversationRef = useRef(activeConversation);
  const conversationsRef = useRef([]);

  const {
    conversations, loading: conversationsLoading,
    filters, updateFilters,
    refresh: refreshConversations,
    updateConversation, optimisticUpdate,
    setActiveConversationId,
  } = useConversations(employee.id);

  // Filter out conversations that were archived/blacklisted this session.
  // This survives refreshConversations() re-fetches because the exclusion set
  // lives in component state, not in the hook.
  const visibleConversations = React.useMemo(
    () => (conversations || []).filter(c =>
      !excludedConversationIds.has(String(c.id)) &&
      c.status !== 'archived' &&
      c.status !== 'blacklisted' &&
      c.status !== 'blacklist'
    ),
    [conversations, excludedConversationIds]
  );

  const ws = useWebSocket(employee.id);

  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  useEffect(() => { loadStores(); loadStats(); requestNotificationPermission(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  useEffect(() => {
    if (['employees', 'stores', 'blacklist', 'training'].includes(activePage) && employee.role !== 'admin') {
      setActivePage('dashboard');
    }
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
    if (cur && String(cur.id) === String(conversationId)) { setActiveConversation(null); setActiveConversationId(null); }
    try { await api.markConversationUnread(conversationId); }
    catch { updateConversation(conversationId, { unreadCount: 0, unread_count: 0, unread: 0 }); }
  }, [updateConversation, setActiveConversationId]);

  const handleArchive = useCallback(async (conversationId) => {
    await api.archiveConversation(conversationId);
    updateConversation(conversationId, { status: 'archived' });
    setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
    const cur = activeConversationRef.current;
    if (cur && String(cur.id) === String(conversationId)) { setActiveConversation(null); setActiveConversationId(null); }
  }, [updateConversation, setActiveConversationId]);

  const handleBlacklist = useCallback(async (payload) => {
    await api.blacklistCustomer(payload);
    const conversationId = payload.conversationId || payload.conversation_id;
    if (conversationId) {
      // Exclude immediately — survives any subsequent refreshConversations() re-fetch
      setExcludedConversationIds(prev => new Set([...prev, String(conversationId)]));
      updateConversation(conversationId, { status: 'blacklisted' });
      const cur = activeConversationRef.current;
      if (cur && String(cur.id) === String(conversationId)) {
        setActiveConversation(null);
        setActiveConversationId(null);
      }
    }
    refreshConversations();
  }, [updateConversation, setActiveConversationId, refreshConversations]);

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

  useEffect(() => {
    if (!ws) return;

    const u1 = ws.on('new_message', (data) => {
      const curConv = activeConversationRef.current;
      const curList = conversationsRef.current;
      const msg = data.message || {};
      const sender = msg.senderType || msg.sender_type;
      const convId = data.conversationId || msg.conversationId;
      const isActive = curConv?.id === convId;

      const patch = {
        lastMessage: msg.content || '',
        lastMessageAt: msg.createdAt || msg.created_at || new Date().toISOString(),
        lastSenderType: sender, lastMessageSenderType: sender,
      };
      if (sender === 'customer' && !isActive) {
        const existing = curList.find(c => c.id === convId);
        const prev = existing?.unreadCount || existing?.unread_count || 0;
        patch.unreadCount = prev + 1;
        patch.unread_count = prev + 1;
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

    const u2 = ws.on('connected', () => setError(null));
    const u3 = ws.on('error', () => setError('WebSocket connection error. Retrying…'));
    const u4 = ws.on('max_reconnect_reached', () => setError('Unable to connect to server. Please refresh the page.'));

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
      const cur = activeConversationRef.current;
      if (cur && String(cur.id) === String(data.conversationId)) { setActiveConversation(null); setActiveConversationId(null); }
    });

    const u8 = ws.on('conversation_unarchived', (data) => {
      if (!data?.conversationId) return;
      updateConversation(data.conversationId, { status: 'open', ...(data.conversation || {}) });
    });

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, [ws, handleMarkAsRead, updateConversation, setActiveConversationId]);

  useEffect(() => {
    if (activeConversation && ws) {
      ws.joinConversation(activeConversation.id);
      clearNotificationsForConversation(activeConversation.id);
      return () => { ws.leaveConversation(); };
    }
  }, [activeConversation, ws]);

  const showNotification = (convId, name, preview) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(`New message from ${name}`, {
        body: preview, icon: '/favicon.ico', tag: `conv-${convId}`, requireInteraction: false, silent: false,
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
    const i = arr.indexOf(n);
    if (i > -1) arr.splice(i, 1);
    if (!arr.length) activeNotificationsRef.current.delete(convId);
  };

  const clearNotificationsForConversation = (convId) => {
    const arr = activeNotificationsRef.current.get(convId);
    if (arr?.length) { arr.forEach(n => { try { n.close(); } catch { /* ignore */ } }); activeNotificationsRef.current.delete(convId); }
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
  const handleBackToDashboard = () => setActivePage('dashboard');

  const navigateTo = (page) => {
    setActivePage(page);
    setProfileDropdownOpen(false);
  };

  return (
    <div className="app">

      {/* ─── HEADER ─── */}
      <header className="app-header">
        <div className="header-left">
          <h1>💬 Chat Support Pro</h1>
          {activePage === 'dashboard' && stats && (
            <div className="header-stats">
              <span className="stat-pill">
                <span className="stat-dot open" />
                {stats.openConversations || 0} open
              </span>
              <span className="stat-pill">
                🏪 {stats.activeStores || stores.length} stores
              </span>
              <span className={`stat-pill ${isConnected ? 'stat-connected' : 'stat-offline'}`}>
                <span className={`status-dot ${isConnected ? '' : 'status-offline'}`} />
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          )}
        </div>

        <div className="header-right">
          {/* Primary nav — only non-admin shortcuts */}
          <nav className="header-nav">
            <button
              className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
              onClick={() => setActivePage('dashboard')}
              type="button"
            >
              💬 Dashboard
            </button>

            {activePage === 'dashboard' && (
              <button
                className={`nav-btn ${showNotesModal ? 'nav-active' : ''}`}
                onClick={() => setShowNotesModal(true)}
                type="button"
                title="My Notes"
              >
                📝 Notes
              </button>
            )}

            {activePage === 'dashboard' && (
              <button
                className="btn-refresh"
                onClick={refreshConversations}
                type="button"
                title="Refresh conversations"
              >
                🔄
              </button>
            )}
          </nav>

          {/* ─── Profile + Dropdown ─── */}
          <div className="profile-menu-wrapper" ref={profileDropdownRef}>
            <button
              className={`profile-trigger ${profileDropdownOpen ? 'profile-trigger--open' : ''}`}
              onClick={() => setProfileDropdownOpen(v => !v)}
              type="button"
              aria-haspopup="true"
              aria-expanded={profileDropdownOpen}
            >
              <div className="profile-avatar" data-role={employee.role}>
                {getInitials(employee.name)}
              </div>
              <div className="profile-info">
                <span className="profile-name">{employee.name}</span>
                <span className="profile-role">
                  {employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}
                </span>
              </div>
              <span className={`profile-chevron ${profileDropdownOpen ? 'profile-chevron--up' : ''}`}>
                ▾
              </span>
            </button>

            {profileDropdownOpen && (
              <div className="profile-dropdown" role="menu">
                {/* User info card at top */}
                <div className="dropdown-user-card">
                  <div className="dropdown-avatar" data-role={employee.role}>
                    {getInitials(employee.name)}
                  </div>
                  <div>
                    <div className="dropdown-user-name">{employee.name}</div>
                    <div className="dropdown-user-role">
                      {employee.role === 'admin' ? '👑 Administrator' : '👤 Support Agent'}
                    </div>
                  </div>
                </div>

                <div className="dropdown-divider" />

                {/* Navigation items */}
                <button
                  className={`dropdown-item ${activePage === 'archived' ? 'dropdown-item--active' : ''}`}
                  onClick={() => navigateTo('archived')}
                  type="button"
                  role="menuitem"
                >
                  <span className="dropdown-item-icon">📦</span>
                  <span className="dropdown-item-label">Archived Messages</span>
                  {activePage === 'archived' && <span className="dropdown-item-check">✓</span>}
                </button>

                {employee.role === 'admin' && (
                  <>
                    <button
                      className={`dropdown-item ${activePage === 'blacklist' ? 'dropdown-item--active' : ''}`}
                      onClick={() => navigateTo('blacklist')}
                      type="button"
                      role="menuitem"
                    >
                      <span className="dropdown-item-icon">🚫</span>
                      <span className="dropdown-item-label">Blacklist</span>
                      {activePage === 'blacklist' && <span className="dropdown-item-check">✓</span>}
                    </button>

                    <button
                      className={`dropdown-item ${activePage === 'stores' ? 'dropdown-item--active' : ''}`}
                      onClick={() => navigateTo('stores')}
                      type="button"
                      role="menuitem"
                    >
                      <span className="dropdown-item-icon">🏪</span>
                      <span className="dropdown-item-label">Store Management</span>
                      {activePage === 'stores' && <span className="dropdown-item-check">✓</span>}
                    </button>

                    <button
                      className={`dropdown-item ${activePage === 'employees' ? 'dropdown-item--active' : ''}`}
                      onClick={() => navigateTo('employees')}
                      type="button"
                      role="menuitem"
                    >
                      <span className="dropdown-item-icon">👥</span>
                      <span className="dropdown-item-label">Employee Management</span>
                      {activePage === 'employees' && <span className="dropdown-item-check">✓</span>}
                    </button>

                    <button
                      className={`dropdown-item ${activePage === 'training' ? 'dropdown-item--active' : ''}`}
                      onClick={() => navigateTo('training')}
                      type="button"
                      role="menuitem"
                    >
                      <span className="dropdown-item-icon">🧠</span>
                      <span className="dropdown-item-label">AI Training</span>
                      {activePage === 'training' && <span className="dropdown-item-check">✓</span>}
                    </button>
                  </>
                )}

                <div className="dropdown-divider" />

                <button
                  className="dropdown-item dropdown-item--danger"
                  onClick={() => { setProfileDropdownOpen(false); setShowLogoutModal(true); }}
                  type="button"
                  role="menuitem"
                >
                  <span className="dropdown-item-icon">🚪</span>
                  <span className="dropdown-item-label">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Logout Modal ─── */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="modal-content logout-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>🚪 Confirm Logout</h3></div>
            <div className="modal-body">
              <p>Are you sure you want to logout?</p>
              <p className="logout-user-info">
                Logged in as: <strong>{employee.name}</strong>
                <span className={`logout-role-badge ${employee.role}`}>
                  {employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}
                </span>
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
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        employee={employee}
        activePage={activePage}
        onPageChange={(page) => { setActivePage(page); setMobileMenuOpen(false); }}
        onRefresh={() => { refreshConversations(); setMobileMenuOpen(false); }}
        onLogout={() => setShowLogoutModal(true)}
        stats={stats}
        isConnected={isConnected}
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
            <ArchivedConversations onBack={handleBackToDashboard} onUnarchive={() => refreshConversations()} stores={stores} />
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'blacklist' && employee.role === 'admin' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
          <ErrorBoundary>
            <BlacklistManager onBack={handleBackToDashboard} />
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'stores' && (
        <div className="app-content full-width" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', display: 'block' }}>
          <ErrorBoundary>
            <StoreManagement onBack={handleBackToDashboard} onStoresUpdated={loadStores} />
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'employees' && (
        <div className="app-content full-width">
          <EmployeeManagement currentUser={employee} onBack={handleBackToDashboard} />
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