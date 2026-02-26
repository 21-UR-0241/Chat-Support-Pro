



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

// function App() {
//   const [employee, setEmployee] = useState(null);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loading, setLoading] = useState(true);

//   // Check for existing session on mount
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

//   // ✅ Track active notifications by conversation ID
//   const activeNotificationsRef = useRef(new Map());

//   // ✅ Debounce ref to prevent duplicate mark-as-read API calls
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

//   // ✅ Refs to avoid stale closures in WebSocket handler
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

//   // ─────────────────────────────────────────────────
//   // ✅ Mark conversation as read (local + backend)
//   // ─────────────────────────────────────────────────
//   const handleMarkAsRead = useCallback((conversationId) => {
//     console.log('👁️ [App] Marking conversation as read:', conversationId);

//     // 1. Instantly update local state so UI clears badges immediately
//     updateConversation(conversationId, {
//       unreadCount: 0,
//       unread_count: 0,
//       unread: 0,
//     });

//     // 2. Debounce the API call to avoid spamming if messages arrive rapidly
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

//   // ─────────────────────────────────────────────────
//   // ✅ Select conversation + mark as read
//   // ─────────────────────────────────────────────────
//   const handleSelectConversation = useCallback((conversation) => {
//     setActiveConversation(conversation);

//     setActiveConversationId(conversation.id);

//     const unreadCount = conversation.unreadCount || conversation.unread_count || conversation.unread || 0;
//     if (unreadCount > 0) {
//       handleMarkAsRead(conversation.id);
//     }
//   }, [handleMarkAsRead, setActiveConversationId]);

//   // ─────────────────────────────────────────────────
//   // ✅ WebSocket event listeners
//   // ─────────────────────────────────────────────────
//   useEffect(() => {
//     if (!ws) return;

//     // Handle new messages
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

//       // ✅ ALWAYS update the conversation list with new message data
//       const isActiveConv = currentActiveConv?.id === conversationId;
//       const conversationUpdate = {
//         lastMessage: message.content || '',
//         lastMessageAt: message.createdAt || message.created_at || new Date().toISOString(),
//         lastSenderType: senderType,
//         lastMessageSenderType: senderType,
//       };

//       if (senderType === 'customer' && !isActiveConv) {
//         // Increment unread only for customer messages on non-active conversations
//         const existingConv = currentConversations.find(c => c.id === conversationId);
//         const currentUnread = existingConv?.unreadCount || existingConv?.unread_count || 0;
//         conversationUpdate.unreadCount = currentUnread + 1;
//         conversationUpdate.unread_count = currentUnread + 1;
//       }

//       updateConversation(conversationId, conversationUpdate);

//       // If it's an AGENT message, clear notifications for this conversation
//       if (senderType === 'agent') {
//         console.log('🔕 [App] Agent message - clearing notifications for conversation:', conversationId);
//         clearNotificationsForConversation(conversationId);
//         return;
//       }

//       // Customer message on a conversation the admin is NOT viewing → notify
//       if (senderType === 'customer' && !isActiveConv) {
//         const customerName =
//           currentConversations.find(c => c.id === conversationId)?.customerName ||
//           data.conversation?.customerName ||
//           data.conversation?.customer_name ||
//           'Guest';
//         const messagePreview = message.content?.substring(0, 50) || 'New message';

//         console.log('🔔 [App] Showing notification for customer message');
//         showNotification(conversationId, customerName, messagePreview);
//       }
//       // Customer message on the conversation the admin IS viewing → auto mark read
//       else if (senderType === 'customer' && isActiveConv) {
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

//     return () => {
//       unsubscribe1();
//       unsubscribe2();
//       unsubscribe3();
//       unsubscribe4();
//       unsubscribe5();
//     };
//     // ✅ Only depend on ws, handleMarkAsRead, updateConversation
//     // activeConversation and conversations are read via refs to avoid re-subscribing
//   }, [ws, handleMarkAsRead, updateConversation]);

//   useEffect(() => {
//     if (activeConversation && ws) {
//       ws.joinConversation(activeConversation.id);

//       // ✅ Clear notifications when opening a conversation
//       clearNotificationsForConversation(activeConversation.id);

//       return () => {
//         ws.leaveConversation();
//       };
//     }
//   }, [activeConversation, ws]);

//   // ✅ When admin closes a conversation (goes back to list), clear the active ID
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

//       // ✅ Clear notifications when agent sends a message
//       clearNotificationsForConversation(conversation.id);

//       // ✅ Mark as read when agent replies
//       handleMarkAsRead(conversation.id);

//       // ✅ Optimistically update the conversation list
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

//   // ✅ Logout confirmation handlers
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

//   // ✅ Enhanced notification function with tracking
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

//       // Track notification
//       if (!activeNotificationsRef.current.has(conversationId)) {
//         activeNotificationsRef.current.set(conversationId, []);
//       }
//       activeNotificationsRef.current.get(conversationId).push(notification);

//       // Click to open conversation
//       notification.onclick = () => {
//         window.focus();
//         const conv = conversationsRef.current.find(c => c.id === conversationId);
//         if (conv) {
//           handleSelectConversation(conv);
//         }
//         notification.close();
//         removeNotificationFromTracking(conversationId, notification);
//       };

//       // Remove from tracking when closed
//       notification.onclose = () => {
//         removeNotificationFromTracking(conversationId, notification);
//       };

//       // Auto-close after 6 seconds
//       setTimeout(() => {
//         notification.close();
//       }, 6000);

//       console.log('🔔 [App] Notification shown for conversation:', conversationId);
//     } catch (error) {
//       console.error('❌ Failed to create notification:', error);
//     }
//   };

//   // ✅ Remove notification from tracking
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

//   // ✅ Clear all notifications for a specific conversation
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

//   // ✅ Prevent non-admin access to employee management
//   useEffect(() => {
//     if (activePage === 'employees' && employee.role !== 'admin') {
//       console.warn('⚠️ Non-admin user attempted to access employee management');
//       setActivePage('dashboard');
//     }
//   }, [activePage, employee.role]);

//   const isConnected = getConnectionStatus();

//   return (
//     <div className="app">
//       {/* Desktop Header - Hidden on mobile */}
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
//             {employee.role === 'admin' && (
//               <button
//                 className={`nav-btn ${activePage === 'employees' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('employees')}
//                 type="button"
//               >
//                 👥 Employees
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

//       {/* Logout Confirmation Modal */}
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

//       {/* Mobile Menu */}
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

//       {/* Error Banner */}
//       {error && (
//         <div className="error-banner">
//           <span>⚠️ {error}</span>
//           <button onClick={() => setError(null)} type="button">×</button>
//         </div>
//       )}

//       {/* Main Content - Dashboard */}
//       {activePage === 'dashboard' && (
//         <div className="app-content">
//           <div className={`conversations-sidebar ${activeConversation ? 'hidden-mobile' : ''}`}>
//             {/* Mobile hamburger in conversation list */}
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
//               />
//             </ErrorBoundary>
//           </div>
//         </div>
//       )}

//       {/* Main Content - Employee Management */}
//       {activePage === 'employees' && (
//         <EmployeeManagement
//           currentUser={employee}
//           onBack={handleBackToDashboard}
//         />
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
import AnalyticsDashboard from './components/AnalyticsDashboard';

function App() {
  const [employee, setEmployee] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const storedEmployee = localStorage.getItem('employee');
    const token = localStorage.getItem('token');

    if (storedEmployee && token) {
      try {
        console.log('🔍 Verifying stored session...');
        const { employee: verifiedEmployee } = await api.verifyToken();
        
        console.log('✅ Session valid, logged in as:', verifiedEmployee.email);
        setEmployee(verifiedEmployee);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('❌ Session verification failed:', error.message);
        localStorage.removeItem('employee');
        localStorage.removeItem('token');
        setEmployee(null);
        setIsAuthenticated(false);
      }
    }
    
    setLoading(false);
  };

  const handleLogin = (employeeData) => {
    console.log('✅ Login successful, setting authenticated state');
    setEmployee(employeeData);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('employee');
    localStorage.removeItem('token');
    setEmployee(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

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

  const activeNotificationsRef = useRef(new Map());
  const markAsReadTimerRef = useRef(new Map());

  const {
    conversations,
    loading: conversationsLoading,
    filters,
    updateFilters,
    refresh: refreshConversations,
    updateConversation,
    optimisticUpdate,
    setActiveConversationId,
  } = useConversations(employee.id);

  const ws = useWebSocket(employee.id);

  const activeConversationRef = useRef(activeConversation);
  const conversationsRef = useRef(conversations);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    loadStores();
    loadStats();
    requestNotificationPermission();
  }, []);

  const handleMarkAsRead = useCallback((conversationId) => {
    console.log('👁️ [App] Marking conversation as read:', conversationId);

    updateConversation(conversationId, {
      unreadCount: 0,
      unread_count: 0,
      unread: 0,
    });

    if (markAsReadTimerRef.current.has(conversationId)) {
      clearTimeout(markAsReadTimerRef.current.get(conversationId));
    }

    markAsReadTimerRef.current.set(
      conversationId,
      setTimeout(async () => {
        try {
          await api.markConversationRead(conversationId);
          console.log('✅ [App] Server confirmed conversation read:', conversationId);
        } catch (error) {
          console.error('❌ [App] Failed to mark conversation as read:', error);
        }
        markAsReadTimerRef.current.delete(conversationId);
      }, 300)
    );
  }, [updateConversation]);

  const handleSelectConversation = useCallback((conversation) => {
    setActiveConversation(conversation);
    setActiveConversationId(conversation.id);

    const unreadCount = conversation.unreadCount || conversation.unread_count || conversation.unread || 0;
    if (unreadCount > 0) {
      handleMarkAsRead(conversation.id);
    }
  }, [handleMarkAsRead, setActiveConversationId]);

  const handleShowNotes = useCallback(() => {
    console.log('📝 [App] Opening notes modal');
    setShowNotesModal(true);
  }, []);

  const handleCloseNotes = useCallback(() => {
    console.log('📝 [App] Closing notes modal');
    setShowNotesModal(false);
  }, []);

  useEffect(() => {
    if (!ws) return;

    const unsubscribe1 = ws.on('new_message', (data) => {
      const currentActiveConv = activeConversationRef.current;
      const currentConversations = conversationsRef.current;

      console.log('📨 [App] New message received:', {
        conversationId: data.conversationId,
        senderType: data.message?.senderType || data.message?.sender_type,
        activeConversation: currentActiveConv?.id
      });

      const message = data.message || {};
      const senderType = message.senderType || message.sender_type;
      const conversationId = data.conversationId || message.conversationId;

      const isActiveConv = currentActiveConv?.id === conversationId;
      const conversationUpdate = {
        lastMessage: message.content || '',
        lastMessageAt: message.createdAt || message.created_at || new Date().toISOString(),
        lastSenderType: senderType,
        lastMessageSenderType: senderType,
      };

      if (senderType === 'customer' && !isActiveConv) {
        const existingConv = currentConversations.find(c => c.id === conversationId);
        const currentUnread = existingConv?.unreadCount || existingConv?.unread_count || 0;
        conversationUpdate.unreadCount = currentUnread + 1;
        conversationUpdate.unread_count = currentUnread + 1;
      }

      updateConversation(conversationId, conversationUpdate);

      if (senderType === 'agent') {
        console.log('🔕 [App] Agent message - clearing notifications for conversation:', conversationId);
        clearNotificationsForConversation(conversationId);
        return;
      }

      if (senderType === 'customer' && !isActiveConv) {
        const customerName =
          currentConversations.find(c => c.id === conversationId)?.customerName ||
          data.conversation?.customerName ||
          data.conversation?.customer_name ||
          'Guest';
        const messagePreview = message.content?.substring(0, 50) || 'New message';

        console.log('🔔 [App] Showing notification for customer message');
        showNotification(conversationId, customerName, messagePreview);
      }
      else if (senderType === 'customer' && isActiveConv) {
        console.log('⏭️ [App] Customer message in active conversation - auto marking read');
        handleMarkAsRead(conversationId);
      }
    });

    const unsubscribe2 = ws.on('connected', () => {
      console.log('✅ [App] Connected to WebSocket');
      setError(null);
    });

    const unsubscribe3 = ws.on('disconnected', () => {
      console.log('❌ [App] Disconnected from WebSocket');
    });

    const unsubscribe4 = ws.on('error', (error) => {
      console.error('[App] WebSocket error:', error);
      setError('WebSocket connection error. Retrying...');
    });

    const unsubscribe5 = ws.on('max_reconnect_reached', () => {
      setError('Unable to connect to server. Please refresh the page.');
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      unsubscribe4();
      unsubscribe5();
    };
  }, [ws, handleMarkAsRead, updateConversation]);

  useEffect(() => {
    if (activeConversation && ws) {
      ws.joinConversation(activeConversation.id);
      clearNotificationsForConversation(activeConversation.id);

      return () => {
        ws.leaveConversation();
      };
    }
  }, [activeConversation, ws]);

  useEffect(() => {
    if (!activeConversation) {
      setActiveConversationId(null);
    }
  }, [activeConversation, setActiveConversationId]);

  useEffect(() => {
    if (activeConversation) {
      const updated = conversations.find(c => c.id === activeConversation.id);

      if (updated && updated !== activeConversation) {
        console.log('🔄 [App] Syncing activeConversation with updated data');
        setActiveConversation(updated);
      }
    }
  }, [conversations]);

  const loadStores = async () => {
    try {
      setLoadingStores(true);
      const data = await api.getStores();
      setStores(data || []);
    } catch (error) {
      console.error('Failed to load stores:', error);
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleSendMessage = async (conversation, message, fileData) => {
    console.log('📤 handleSendMessage called with:', {
      conversationId: conversation.id,
      message,
      fileData
    });

    try {
      const storeId = conversation.shopId || conversation.shop_id || conversation.storeId || null;

      console.log('🏪 Store ID:', storeId);

      if (!storeId) {
        console.error('❌ No store ID found in conversation:', conversation);
        throw new Error('Store ID is missing from conversation');
      }

      clearNotificationsForConversation(conversation.id);
      handleMarkAsRead(conversation.id);
      optimisticUpdate(conversation.id, message);

      const messageData = {
        conversationId: conversation.id,
        storeId: storeId,
        senderType: 'agent',
        senderName: employee.name,
        content: message || '',
        fileData: fileData || null,
      };

      console.log('📨 Sending message with data:', messageData);

      const sentMessage = await api.sendMessage(messageData);

      console.log('✅ Message sent successfully:', sentMessage);

      if (sentMessage.createdAt) {
        updateConversation(conversation.id, {
          lastMessageAt: sentMessage.createdAt,
        });
      }

      return sentMessage;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });

      refreshConversations();

      throw error;
    }
  };

  const handleTyping = (isTyping) => {
    if (activeConversation && ws) {
      ws.sendTyping(activeConversation.id, isTyping, employee.name);
    }
  };

  const handleCloseConversation = () => {
    console.log('⬅️ Closing conversation (back to list)');
    setActiveConversation(null);
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    onLogout();
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };

  const showNotification = (conversationId, customerName, messagePreview) => {
    if (!('Notification' in window)) {
      console.log('⚠️ Browser does not support notifications');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.log('⚠️ Notification permission not granted');
      return;
    }

    try {
      const title = `New message from ${customerName}`;
      const options = {
        body: messagePreview,
        icon: '/favicon.ico',
        badge: '/badge-icon.png',
        tag: `conv-${conversationId}`,
        requireInteraction: false,
        silent: false,
      };

      const notification = new Notification(title, options);

      if (!activeNotificationsRef.current.has(conversationId)) {
        activeNotificationsRef.current.set(conversationId, []);
      }
      activeNotificationsRef.current.get(conversationId).push(notification);

      notification.onclick = () => {
        window.focus();
        const conv = conversationsRef.current.find(c => c.id === conversationId);
        if (conv) {
          handleSelectConversation(conv);
        }
        notification.close();
        removeNotificationFromTracking(conversationId, notification);
      };

      notification.onclose = () => {
        removeNotificationFromTracking(conversationId, notification);
      };

      setTimeout(() => {
        notification.close();
      }, 6000);

      console.log('🔔 [App] Notification shown for conversation:', conversationId);
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
    }
  };

  const removeNotificationFromTracking = (conversationId, notification) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications) {
      const index = notifications.indexOf(notification);
      if (index > -1) {
        notifications.splice(index, 1);
      }
      if (notifications.length === 0) {
        activeNotificationsRef.current.delete(conversationId);
      }
    }
  };

  const clearNotificationsForConversation = (conversationId) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications && notifications.length > 0) {
      console.log(`🔕 [App] Closing ${notifications.length} notification(s) for conversation ${conversationId}`);
      notifications.forEach(notification => {
        try {
          notification.close();
        } catch (error) {
          console.error('Error closing notification:', error);
        }
      });
      activeNotificationsRef.current.delete(conversationId);
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission:', permission);
      });
    }
  };

  const getConnectionStatus = () => {
    if (!ws) return false;
    try {
      return ws.isConnected();
    } catch (error) {
      return false;
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleBackToDashboard = () => {
    console.log('⬅️ Navigating back to dashboard');
    setActivePage('dashboard');
  };

  useEffect(() => {
    if ((activePage === 'employees' || activePage === 'analytics') && employee.role !== 'admin') {
      console.warn('⚠️ Non-admin user attempted to access restricted page');
      setActivePage('dashboard');
    }
  }, [activePage, employee.role]);

  const isConnected = getConnectionStatus();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>💬 Chat Support Pro</h1>
          {activePage === 'dashboard' && stats && (
            <div className="header-stats">
              <span>Open: {stats.openConversations || 0}</span>
              <span>•</span>
              <span>Stores: {stats.activeStores || stores.length}</span>
              <span>•</span>
              <span className={`status-badge ${isConnected ? '' : 'status-offline'}`}>
                <span className="status-dot"></span>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          )}
        </div>

        <div className="header-right">
          <div className="header-nav">
            <button
              className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
              onClick={() => setActivePage('dashboard')}
              type="button"
            >
              💬 Dashboard
            </button>
            
{/* {employee.role === 'admin' && (
  <button
    className={`nav-btn ${activePage === 'analytics' ? 'nav-active' : ''}`}
    onClick={() => setActivePage('analytics')}
    type="button"
  >
    📊 Analytics
  </button>
)} */}
            
            {employee.role === 'admin' && activePage === 'dashboard' && (
              <button
                className={`nav-btn ${showNotesModal ? 'nav-active' : ''}`}
                onClick={handleShowNotes}
                type="button"
                title="My Notes"
              >
                📝 Notes
              </button>
            )}
            
            {employee.role === 'admin' && (
              <button
                className={`nav-btn ${activePage === 'employees' ? 'nav-active' : ''}`}
                onClick={() => setActivePage('employees')}
                type="button"
              >
                👥 Employees
              </button>
            )}
          </div>

          {activePage === 'dashboard' && (
            <button
              className="btn-refresh"
              onClick={refreshConversations}
              type="button"
              title="Manually refresh conversations"
            >
              🔄 Refresh
            </button>
          )}

          <div
            className="employee-info"
            data-role={employee.role}
            onClick={handleLogoutClick}
            title="Click to logout"
          >
            <div className="employee-details">
              <span className="employee-name">{employee.name}</span>
              <span className="employee-role">{employee.role === 'admin' ? '👑 Admin' : '👤 Agent'}</span>
            </div>
            <div className="employee-avatar">
              {getInitials(employee.name)}
            </div>
          </div>
        </div>
      </header>

      {showLogoutModal && (
        <div className="modal-overlay" onClick={handleCancelLogout}>
          <div className="modal-content logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🚪 Confirm Logout</h3>
            </div>
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
              <button
                className="btn-cancel"
                onClick={handleCancelLogout}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn-logout"
                onClick={handleConfirmLogout}
                type="button"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotesModal && (
        <ConversationNotes
          employeeId={employee.id}
          employeeName={employee.name}
          onClose={handleCloseNotes}
        />
      )}

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
        employee={employee}
        activePage={activePage}
        onPageChange={(page) => {
          setActivePage(page);
          closeMobileMenu();
        }}
        onRefresh={() => {
          refreshConversations();
          closeMobileMenu();
        }}
        onLogout={handleLogoutClick}
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
              <button
                className="mobile-menu-btn"
                onClick={handleMobileMenuToggle}
                aria-label="Menu"
                type="button"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
              <h2>Conversations</h2>
              <span className="conversation-count">{conversations.length}</span>
            </div>

            <ConversationList
              conversations={conversations}
              activeConversation={activeConversation}
              onSelectConversation={handleSelectConversation}
              onMarkAsRead={handleMarkAsRead}
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
                onClose={handleCloseConversation}
                onTyping={handleTyping}
                employeeName={employee.name}
                onMenuToggle={handleMobileMenuToggle}
                stores={stores}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {activePage === 'analytics' && (
        <div className="app-content full-width">
          <ErrorBoundary>
            <AnalyticsDashboard onBack={handleBackToDashboard} />
          </ErrorBoundary>
        </div>
      )}

      {activePage === 'employees' && (
        <div className="app-content full-width">
          <EmployeeManagement
            currentUser={employee}
            onBack={handleBackToDashboard}
          />
        </div>
      )}
    </div>
  );
}

export default App;