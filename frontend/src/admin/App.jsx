// // /**
// //  * App Component
// //  * Main admin dashboard with authentication and navigation
// //  */

// // import React, { useState, useEffect } from 'react';
// // import api from './services/api';
// // import { useConversations } from './hooks/useConversations';
// // import { useWebSocket } from './hooks/useWebSocket';
// // import ConversationList from './components/ConversationList';
// // import ChatWindow from './components/ChatWindow';
// // import Login from './components/Login';
// // import EmployeeManagement from './components/EmployeeManagement';

// // function App() {
// //   const [employee, setEmployee] = useState(null);
// //   const [isAuthenticated, setIsAuthenticated] = useState(false);
// //   const [loading, setLoading] = useState(true);

// //   // Check for existing session on mount
// //   useEffect(() => {
// //     checkAuth();
// //   }, []);

// //   const checkAuth = async () => {
// //     const storedEmployee = localStorage.getItem('employee');
// //     const token = localStorage.getItem('token');

// //     if (storedEmployee && token) {
// //       try {
// //         // IMPORTANT: Verify token with server, don't just trust localStorage
// //         console.log('🔍 Verifying stored session...');
// //         const { employee: verifiedEmployee } = await api.verifyToken();
        
// //         console.log('✅ Session valid, logged in as:', verifiedEmployee.email);
// //         setEmployee(verifiedEmployee);
// //         setIsAuthenticated(true);
// //       } catch (error) {
// //         console.error('❌ Session verification failed:', error.message);
// //         // Clear invalid session data
// //         localStorage.removeItem('employee');
// //         localStorage.removeItem('token');
// //         setEmployee(null);
// //         setIsAuthenticated(false);
// //       }
// //     }
    
// //     setLoading(false);
// //   };

// //   const handleLogin = (employeeData) => {
// //     console.log('✅ Login successful, setting authenticated state');
// //     setEmployee(employeeData);
// //     setIsAuthenticated(true);
// //   };

// //   const handleLogout = async () => {
// //     try {
// //       await api.logout();
// //     } catch (error) {
// //       console.error('Logout error:', error);
// //     }
// //     localStorage.removeItem('employee');
// //     localStorage.removeItem('token');
// //     setEmployee(null);
// //     setIsAuthenticated(false);
// //   };

// //   // Show loading spinner while checking auth
// //   if (loading) {
// //     return (
// //       <div style={{ 
// //         display: 'flex', 
// //         alignItems: 'center', 
// //         justifyContent: 'center', 
// //         height: '100vh',
// //         background: 'var(--bg-primary)'
// //       }}>
// //         <div className="spinner" style={{
// //           width: '40px',
// //           height: '40px',
// //           border: '4px solid rgba(102, 126, 234, 0.1)',
// //           borderTopColor: '#667eea',
// //           borderRadius: '50%',
// //           animation: 'spin 0.8s linear infinite'
// //         }}></div>
// //       </div>
// //     );
// //   }

// //   // Show login page if not authenticated
// //   if (!isAuthenticated) {
// //     return <Login onLogin={handleLogin} />;
// //   }

// //   // Show dashboard if authenticated
// //   return <DashboardContent employee={employee} onLogout={handleLogout} />;
// // }

// // function DashboardContent({ employee, onLogout }) {
// //   const [activePage, setActivePage] = useState('dashboard');
// //   const [activeConversation, setActiveConversation] = useState(null);
// //   const [stores, setStores] = useState([]);
// //   const [stats, setStats] = useState(null);
// //   const [loadingStores, setLoadingStores] = useState(true);
// //   const [error, setError] = useState(null);

// //   // Use conversations hook
// //   const {
// //     conversations,
// //     loading: conversationsLoading,
// //     filters,
// //     updateFilters,
// //     refresh: refreshConversations,
// //   } = useConversations(employee.id);

// //   // Use WebSocket hook
// //   const ws = useWebSocket(employee.id);

// //   // Load stores and stats on mount
// //   useEffect(() => {
// //     loadStores();
// //     loadStats();
// //     requestNotificationPermission();
// //   }, []);

// //   // Listen for WebSocket events
// //   useEffect(() => {
// //     if (!ws) return;

// //     // New message
// //     const unsubscribe1 = ws.on('new_message', (data) => {
// //       console.log('New message received:', data);
      
// //       // Play notification if not active conversation
// //       if (activeConversation?.id !== data.conversationId) {
// //         showNotification('New Message', {
// //           body: `New message from ${data.storeId}`,
// //           icon: '/favicon.ico',
// //         });
// //       }
// //     });

// //     // Message
// //     const unsubscribe2 = ws.on('message', (data) => {
// //       console.log('WebSocket message:', data.type);
// //     });

// //     // Connected
// //     const unsubscribe3 = ws.on('connected', () => {
// //       console.log('✅ Connected to WebSocket');
// //       setError(null);
// //     });

// //     // Disconnected
// //     const unsubscribe4 = ws.on('disconnected', () => {
// //       console.log('❌ Disconnected from WebSocket');
// //     });

// //     // Error
// //     const unsubscribe5 = ws.on('error', (error) => {
// //       console.error('WebSocket error:', error);
// //       setError('WebSocket connection error. Retrying...');
// //     });

// //     // Max reconnect reached
// //     const unsubscribe6 = ws.on('max_reconnect_reached', () => {
// //       setError('Unable to connect to server. Please refresh the page.');
// //     });

// //     return () => {
// //       unsubscribe1();
// //       unsubscribe2();
// //       unsubscribe3();
// //       unsubscribe4();
// //       unsubscribe5();
// //       unsubscribe6();
// //     };
// //   }, [ws, activeConversation]);

// //   // Join conversation room when selected
// //   useEffect(() => {
// //     if (activeConversation && ws) {
// //       ws.joinConversation(activeConversation.id);
      
// //       return () => {
// //         ws.leaveConversation();
// //       };
// //     }
// //   }, [activeConversation, ws]);

// //   // Load stores
// //   const loadStores = async () => {
// //     try {
// //       setLoadingStores(true);
// //       const data = await api.getStores();
// //       setStores(data || []);
// //     } catch (error) {
// //       console.error('Failed to load stores:', error);
// //       setStores([]);
// //     } finally {
// //       setLoadingStores(false);
// //     }
// //   };

// //   // Load stats
// //   const loadStats = async () => {
// //     try {
// //       const data = await api.getDashboardStats();
// //       setStats(data);
// //     } catch (error) {
// //       console.error('Failed to load stats:', error);
// //       // Don't show error for stats, just log it
// //     }
// //   };

// //   // Handle send message
// //   const handleSendMessage = async (conversation, message) => {
// //     try {
// //       const sentMessage = await api.sendMessage({
// //         conversationId: conversation.id,
// //         storeId: conversation.shopId,
// //         senderType: 'agent',
// //         senderName: employee.name,
// //         content: message,
// //       });

// //       return sentMessage;
// //     } catch (error) {
// //       console.error('Failed to send message:', error);
// //       throw error;
// //     }
// //   };

// //   // Handle typing
// //   const handleTyping = (isTyping) => {
// //     if (activeConversation && ws) {
// //       ws.sendTyping(activeConversation.id, isTyping, employee.name);
// //     }
// //   };

// //   // Handle close conversation
// //   const handleCloseConversation = () => {
// //     setActiveConversation(null);
// //     refreshConversations();
// //   };

// //   // Show notification
// //   const showNotification = (title, options) => {
// //     if ('Notification' in window && Notification.permission === 'granted') {
// //       try {
// //         new Notification(title, options);
// //       } catch (error) {
// //         console.log('Notification failed:', error);
// //       }
// //     }
// //   };

// //   // Request notification permission
// //   const requestNotificationPermission = () => {
// //     if ('Notification' in window && Notification.permission === 'default') {
// //       Notification.requestPermission().then((permission) => {
// //         console.log('Notification permission:', permission);
// //       });
// //     }
// //   };

// //   // Check WebSocket connection status
// //   const getConnectionStatus = () => {
// //     if (!ws) return false;
// //     try {
// //       return ws.isConnected();
// //     } catch (error) {
// //       return false;
// //     }
// //   };

// //   return (
// //     <div className="app">
// //       {/* Header */}
// //       <header className="app-header">
// //         <div className="header-left">
// //           <h1>💬 Chat Support Pro</h1>
// //           {activePage === 'dashboard' && stats && (
// //             <div className="header-stats">
// //               <span>Open: {stats.openConversations || 0}</span>
// //               <span>•</span>
// //               <span>Stores: {stats.activeStores || stores.length}</span>
// //               <span>•</span>
// //               <span className={getConnectionStatus() ? 'status-online' : 'status-offline'}>
// //                 {getConnectionStatus() ? '🟢 Connected' : '🔴 Disconnected'}
// //               </span>
// //             </div>
// //           )}
// //         </div>

// //         <div className="header-right">
// //           {/* Navigation */}
// //           <div className="header-nav">
// //             <button
// //               className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
// //               onClick={() => setActivePage('dashboard')}
// //             >
// //               💬 Dashboard
// //             </button>
// //             {employee.role === 'admin' && (
// //               <button
// //                 className={`nav-btn ${activePage === 'employees' ? 'nav-active' : ''}`}
// //                 onClick={() => setActivePage('employees')}
// //               >
// //                 👥 Employees
// //               </button>
// //             )}
// //           </div>

// //           {activePage === 'dashboard' && (
// //             <button className="btn-refresh" onClick={refreshConversations}>
// //               🔄 Refresh
// //             </button>
// //           )}
          
// //           <div className="employee-info" onClick={onLogout} title="Click to logout" style={{ cursor: 'pointer' }}>
// //             <span className="employee-name">{employee.name}</span>
// //             <div className="employee-avatar">
// //               {employee.name.charAt(0).toUpperCase()}
// //             </div>
// //           </div>
// //         </div>
// //       </header>

// //       {/* Error Banner */}
// //       {error && (
// //         <div className="error-banner">
// //           <span>⚠️ {error}</span>
// //           <button onClick={() => setError(null)}>×</button>
// //         </div>
// //       )}

// //       {/* Main Content - Dashboard */}
// //       {activePage === 'dashboard' && (
// //         <div className="app-content">
// //           {/* Conversation List */}
// //           <ConversationList
// //             conversations={conversations}
// //             activeConversation={activeConversation}
// //             onSelectConversation={setActiveConversation}
// //             filters={filters}
// //             onFilterChange={updateFilters}
// //             stores={stores}
// //             loading={conversationsLoading || loadingStores}
// //           />

// //           {/* Chat Window */}
// //           <ChatWindow
// //             conversation={activeConversation}
// //             onSendMessage={handleSendMessage}
// //             onClose={handleCloseConversation}
// //             onTyping={handleTyping}
// //             employeeName={employee.name}
// //           />
// //         </div>
// //       )}

// //       {/* Main Content - Employee Management */}
// //       {activePage === 'employees' && (
// //         <EmployeeManagement currentUser={employee} />
// //       )}
// //     </div>
// //   );
// // }

// // export default App;



// /**
//  * App Component
//  * Main admin dashboard with authentication and navigation
//  */

// import React, { useState, useEffect } from 'react';
// import api from './services/api';
// import { useConversations } from './hooks/useConversations';
// import { useWebSocket } from './hooks/useWebSocket';
// import ConversationList from './components/ConversationList';
// import ChatWindow from './components/ChatWindow';
// import Login from './components/Login';
// import EmployeeManagement from './components/EmployeeManagement';

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
//         // IMPORTANT: Verify token with server, don't just trust localStorage
//         console.log('🔍 Verifying stored session...');
//         const { employee: verifiedEmployee } = await api.verifyToken();
        
//         console.log('✅ Session valid, logged in as:', verifiedEmployee.email);
//         setEmployee(verifiedEmployee);
//         setIsAuthenticated(true);
//       } catch (error) {
//         console.error('❌ Session verification failed:', error.message);
//         // Clear invalid session data
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

//   // Show loading spinner while checking auth
//   if (loading) {
//     return (
//       <div className="loading-container">
//         <div className="spinner"></div>
//       </div>
//     );
//   }

//   // Show login page if not authenticated
//   if (!isAuthenticated) {
//     return <Login onLogin={handleLogin} />;
//   }

//   // Show dashboard if authenticated
//   return <DashboardContent employee={employee} onLogout={handleLogout} />;
// }

// function DashboardContent({ employee, onLogout }) {
//   const [activePage, setActivePage] = useState('dashboard');
//   const [activeConversation, setActiveConversation] = useState(null);
//   const [stores, setStores] = useState([]);
//   const [stats, setStats] = useState(null);
//   const [loadingStores, setLoadingStores] = useState(true);
//   const [error, setError] = useState(null);

//   // Use conversations hook
//   const {
//     conversations,
//     loading: conversationsLoading,
//     filters,
//     updateFilters,
//     refresh: refreshConversations,
//   } = useConversations(employee.id);

//   // Use WebSocket hook
//   const ws = useWebSocket(employee.id);

//   // Load stores and stats on mount
//   useEffect(() => {
//     loadStores();
//     loadStats();
//     requestNotificationPermission();
//   }, []);

//   // Listen for WebSocket events
//   useEffect(() => {
//     if (!ws) return;

//     // New message
//     const unsubscribe1 = ws.on('new_message', (data) => {
//       console.log('New message received:', data);
      
//       // Play notification if not active conversation
//       if (activeConversation?.id !== data.conversationId) {
//         showNotification('New Message', {
//           body: `New message from ${data.storeId}`,
//           icon: '/favicon.ico',
//         });
//       }
//     });

//     // Message
//     const unsubscribe2 = ws.on('message', (data) => {
//       console.log('WebSocket message:', data.type);
//     });

//     // Connected
//     const unsubscribe3 = ws.on('connected', () => {
//       console.log('✅ Connected to WebSocket');
//       setError(null);
//     });

//     // Disconnected
//     const unsubscribe4 = ws.on('disconnected', () => {
//       console.log('❌ Disconnected from WebSocket');
//     });

//     // Error
//     const unsubscribe5 = ws.on('error', (error) => {
//       console.error('WebSocket error:', error);
//       setError('WebSocket connection error. Retrying...');
//     });

//     // Max reconnect reached
//     const unsubscribe6 = ws.on('max_reconnect_reached', () => {
//       setError('Unable to connect to server. Please refresh the page.');
//     });

//     return () => {
//       unsubscribe1();
//       unsubscribe2();
//       unsubscribe3();
//       unsubscribe4();
//       unsubscribe5();
//       unsubscribe6();
//     };
//   }, [ws, activeConversation]);

//   // Join conversation room when selected
//   useEffect(() => {
//     if (activeConversation && ws) {
//       ws.joinConversation(activeConversation.id);
      
//       return () => {
//         ws.leaveConversation();
//       };
//     }
//   }, [activeConversation, ws]);

//   // Load stores
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

//   // Load stats
//   const loadStats = async () => {
//     try {
//       const data = await api.getDashboardStats();
//       setStats(data);
//     } catch (error) {
//       console.error('Failed to load stats:', error);
//       // Don't show error for stats, just log it
//     }
//   };

//   // Handle send message
//   const handleSendMessage = async (conversation, message) => {
//     try {
//       const sentMessage = await api.sendMessage({
//         conversationId: conversation.id,
//         storeId: conversation.shopId,
//         senderType: 'agent',
//         senderName: employee.name,
//         content: message,
//       });

//       return sentMessage;
//     } catch (error) {
//       console.error('Failed to send message:', error);
//       throw error;
//     }
//   };

//   // Handle typing
//   const handleTyping = (isTyping) => {
//     if (activeConversation && ws) {
//       ws.sendTyping(activeConversation.id, isTyping, employee.name);
//     }
//   };

//   // Handle close conversation
//   const handleCloseConversation = () => {
//     setActiveConversation(null);
//     refreshConversations();
//   };

//   // Show notification
//   const showNotification = (title, options) => {
//     if ('Notification' in window && Notification.permission === 'granted') {
//       try {
//         new Notification(title, options);
//       } catch (error) {
//         console.log('Notification failed:', error);
//       }
//     }
//   };

//   // Request notification permission
//   const requestNotificationPermission = () => {
//     if ('Notification' in window && Notification.permission === 'default') {
//       Notification.requestPermission().then((permission) => {
//         console.log('Notification permission:', permission);
//       });
//     }
//   };

//   // Check WebSocket connection status
//   const getConnectionStatus = () => {
//     if (!ws) return false;
//     try {
//       return ws.isConnected();
//     } catch (error) {
//       return false;
//     }
//   };

//   // Get initials from name
//   const getInitials = (name) => {
//     if (!name) return 'U';
//     return name
//       .split(' ')
//       .map((n) => n[0])
//       .join('')
//       .toUpperCase()
//       .slice(0, 2);
//   };

//   const isConnected = getConnectionStatus();

//   return (
//     <div className="app">
//       {/* Header */}
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
//           {/* Navigation */}
//           <div className="header-nav">
//             <button
//               className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
//               onClick={() => setActivePage('dashboard')}
//             >
//               💬 Dashboard
//             </button>
//             {employee.role === 'admin' && (
//               <button
//                 className={`nav-btn ${activePage === 'employees' ? 'nav-active' : ''}`}
//                 onClick={() => setActivePage('employees')}
//               >
//                 👥 Employees
//               </button>
//             )}
//           </div>

//           {activePage === 'dashboard' && (
//             <button className="btn-refresh" onClick={refreshConversations}>
//               🔄 Refresh
//             </button>
//           )}
          
//           <div 
//             className="employee-info" 
//             onClick={onLogout} 
//             title="Click to logout"
//           >
//             <span className="employee-name">{employee.name}</span>
//             <div className="employee-avatar">
//               {getInitials(employee.name)}
//             </div>
//           </div>
//         </div>
//       </header>

//       {/* Error Banner */}
//       {error && (
//         <div className="error-banner">
//           <span>⚠️ {error}</span>
//           <button onClick={() => setError(null)}>×</button>
//         </div>
//       )}

//       {/* Main Content - Dashboard */}
//       {activePage === 'dashboard' && (
//         <div className="app-content">
//           {/* Conversation List */}
//           <ConversationList
//             conversations={conversations}
//             activeConversation={activeConversation}
//             onSelectConversation={setActiveConversation}
//             filters={filters}
//             onFilterChange={updateFilters}
//             stores={stores}
//             loading={conversationsLoading || loadingStores}
//           />

//           {/* Chat Window */}
//           <ChatWindow
//             conversation={activeConversation}
//             onSendMessage={handleSendMessage}
//             onClose={handleCloseConversation}
//             onTyping={handleTyping}
//             employeeName={employee.name}
//           />
//         </div>
//       )}

//       {/* Main Content - Employee Management */}
//       {activePage === 'employees' && (
//         <EmployeeManagement currentUser={employee} />
//       )}
//     </div>
//   );
// }

// export default App;

/**
 * App Component
 * Main admin dashboard with authentication and navigation
 */

import React, { useState, useEffect } from 'react';
import api from './services/api';
import { useConversations } from './hooks/useConversations';
import { useWebSocket } from './hooks/useWebSocket';
import ConversationList from './components/ConversationList';
import ChatWindow from './components/ChatWindow';
import Login from './components/Login';
import EmployeeManagement from './components/EmployeeManagement';

function App() {
  const [employee, setEmployee] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const storedEmployee = localStorage.getItem('employee');
    const token = localStorage.getItem('token');

    if (storedEmployee && token) {
      try {
        // IMPORTANT: Verify token with server, don't just trust localStorage
        console.log('🔍 Verifying stored session...');
        const { employee: verifiedEmployee } = await api.verifyToken();
        
        console.log('✅ Session valid, logged in as:', verifiedEmployee.email);
        setEmployee(verifiedEmployee);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('❌ Session verification failed:', error.message);
        // Clear invalid session data
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

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Show dashboard if authenticated
  return <DashboardContent employee={employee} onLogout={handleLogout} />;
}

function DashboardContent({ employee, onLogout }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [activeConversation, setActiveConversation] = useState(null);
  const [stores, setStores] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStores, setLoadingStores] = useState(true);
  const [error, setError] = useState(null);

  // Use conversations hook
  const {
    conversations,
    loading: conversationsLoading,
    filters,
    updateFilters,
    refresh: refreshConversations,
  } = useConversations(employee.id);

  // Use WebSocket hook
  const ws = useWebSocket(employee.id);

  // Load stores and stats on mount
  useEffect(() => {
    loadStores();
    loadStats();
    requestNotificationPermission();
  }, []);

  // Listen for WebSocket events
  useEffect(() => {
    if (!ws) return;

    // New message
    const unsubscribe1 = ws.on('new_message', (data) => {
      console.log('New message received:', data);
      
      // Refresh conversations when new message arrives
      refreshConversations();
      
      // Play notification if not active conversation
      if (activeConversation?.id !== data.conversationId) {
        showNotification('New Message', {
          body: `New message from ${data.storeId}`,
          icon: '/favicon.ico',
        });
      }
    });

    // Message
    const unsubscribe2 = ws.on('message', (data) => {
      console.log('WebSocket message:', data.type);
    });

    // Connected
    const unsubscribe3 = ws.on('connected', () => {
      console.log('✅ Connected to WebSocket');
      setError(null);
    });

    // Disconnected
    const unsubscribe4 = ws.on('disconnected', () => {
      console.log('❌ Disconnected from WebSocket');
    });

    // Error
    const unsubscribe5 = ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error. Retrying...');
    });

    // Max reconnect reached
    const unsubscribe6 = ws.on('max_reconnect_reached', () => {
      setError('Unable to connect to server. Please refresh the page.');
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      unsubscribe4();
      unsubscribe5();
      unsubscribe6();
    };
  }, [ws, activeConversation, refreshConversations]);

  // Join conversation room when selected
  useEffect(() => {
    if (activeConversation && ws) {
      ws.joinConversation(activeConversation.id);
      
      return () => {
        ws.leaveConversation();
      };
    }
  }, [activeConversation, ws]);

  // Load stores
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

  // Load stats
  const loadStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Don't show error for stats, just log it
    }
  };

  // Handle send message
  const handleSendMessage = async (conversation, message) => {
    console.log('📤 handleSendMessage called with:', {
      conversationId: conversation.id,
      conversationData: conversation,
      message
    });

    try {
      // Get storeId from conversation - handle both camelCase and snake_case
      const storeId = conversation.shopId || conversation.shop_id || conversation.storeId || null;
      
      console.log('🏪 Store ID:', storeId);
      
      if (!storeId) {
        console.error('❌ No store ID found in conversation:', conversation);
        throw new Error('Store ID is missing from conversation');
      }

      const messageData = {
        conversationId: conversation.id,
        storeId: storeId,
        senderType: 'agent',
        senderName: employee.name,
        content: message,
      };

      console.log('📨 Sending message with data:', messageData);

      const sentMessage = await api.sendMessage(messageData);
      
      console.log('✅ Message sent successfully:', sentMessage);

      // Refresh conversations to update last message
      refreshConversations();

      return sentMessage;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      throw error;
    }
  };

  // Handle typing
  const handleTyping = (isTyping) => {
    if (activeConversation && ws) {
      ws.sendTyping(activeConversation.id, isTyping, employee.name);
    }
  };

  // Handle close conversation
  const handleCloseConversation = () => {
    setActiveConversation(null);
    refreshConversations();
  };

  // Show notification
  const showNotification = (title, options) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, options);
      } catch (error) {
        console.log('Notification failed:', error);
      }
    }
  };

  // Request notification permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission:', permission);
      });
    }
  };

  // Check WebSocket connection status
  const getConnectionStatus = () => {
    if (!ws) return false;
    try {
      return ws.isConnected();
    } catch (error) {
      return false;
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isConnected = getConnectionStatus();

  return (
    <div className="app">
      {/* Header */}
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
          {/* Navigation */}
          <div className="header-nav">
            <button
              className={`nav-btn ${activePage === 'dashboard' ? 'nav-active' : ''}`}
              onClick={() => setActivePage('dashboard')}
              type="button"
            >
              💬 Dashboard
            </button>
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
            >
              🔄 Refresh
            </button>
          )}
          
          <div 
            className="employee-info" 
            onClick={onLogout} 
            title="Click to logout"
          >
            <span className="employee-name">{employee.name}</span>
            <div className="employee-avatar">
              {getInitials(employee.name)}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} type="button">×</button>
        </div>
      )}

      {/* Main Content - Dashboard */}
      {activePage === 'dashboard' && (
        <div className="app-content">
          {/* Conversation List */}
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={setActiveConversation}
            filters={filters}
            onFilterChange={updateFilters}
            stores={stores}
            loading={conversationsLoading || loadingStores}
          />

          {/* Chat Window */}
          <ChatWindow
            conversation={activeConversation}
            onSendMessage={handleSendMessage}
            onClose={handleCloseConversation}
            onTyping={handleTyping}
            employeeName={employee.name}
          />
        </div>
      )}

      {/* Main Content - Employee Management */}
      {activePage === 'employees' && (
        <EmployeeManagement currentUser={employee} />
      )}
    </div>
  );
}

export default App;