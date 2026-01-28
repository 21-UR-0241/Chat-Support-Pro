

import React, { useState, useEffect, useRef } from 'react';
import api from './services/api';
import { useConversations } from './hooks/useConversations';
import { useWebSocket } from './hooks/useWebSocket';
import ConversationList from './components/ConversationList';
import ChatWindow from './components/ChatWindow';
import Login from './components/Login';
import EmployeeManagement from './components/EmployeeManagement';
import ErrorBoundary from './components/ErrorBoundary';
import MobileMenu from './components/MobileMenu';

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

  // ✅ Track active notifications by conversation ID
  const activeNotificationsRef = useRef(new Map());

  const {
    conversations,
    loading: conversationsLoading,
    filters,
    updateFilters,
    refresh: refreshConversations,
    updateConversation,
    optimisticUpdate,
  } = useConversations(employee.id);

  useEffect(() => {
    if (conversations && conversations.length > 0) {
      console.log('🔥 CONVERSATIONS DEBUG:', conversations);
      console.log('🔥 FIRST CONVERSATION:', conversations[0]);
      console.log('🔥 KEYS:', Object.keys(conversations[0]));
    }
  }, [conversations]);

  const ws = useWebSocket(employee.id);

  useEffect(() => {
    loadStores();
    loadStats();
    requestNotificationPermission();
  }, []);

  // ✅ WebSocket event listeners with smart notification handling
  useEffect(() => {
    if (!ws) return;

    // Handle new messages
    const unsubscribe1 = ws.on('new_message', (data) => {
      console.log('📨 [App] New message received:', {
        conversationId: data.conversationId,
        senderType: data.message?.senderType || data.message?.sender_type,
        activeConversation: activeConversation?.id
      });

      const message = data.message || {};
      const senderType = message.senderType || message.sender_type;
      const conversationId = data.conversationId;

      // ✅ If it's an AGENT message, clear notifications for this conversation
      if (senderType === 'agent') {
        console.log('🔕 [App] Agent message - clearing notifications for conversation:', conversationId);
        clearNotificationsForConversation(conversationId);
        return; // Don't show notification for agent messages
      }

      // ✅ Only show notification for CUSTOMER messages AND not viewing that conversation
      if (senderType === 'customer' && activeConversation?.id !== conversationId) {
        const conv = data.conversation || {};
        const customerName = conv.customerName || conv.customer_name || 'Guest';
        const messagePreview = message.content?.substring(0, 50) || 'New message';
        
        console.log('🔔 [App] Showing notification for customer message');
        showNotification(conversationId, customerName, messagePreview);
      } else if (senderType === 'customer' && activeConversation?.id === conversationId) {
        console.log('⏭️ [App] Customer message in active conversation - no notification needed');
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
  }, [ws, activeConversation]);

  useEffect(() => {
    if (activeConversation && ws) {
      ws.joinConversation(activeConversation.id);
      
      // ✅ Clear notifications when opening a conversation
      clearNotificationsForConversation(activeConversation.id);
      
      return () => {
        ws.leaveConversation();
      };
    }
  }, [activeConversation, ws]);

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

  const handleSendMessage = async (conversation, message) => {
    console.log('📤 handleSendMessage called with:', {
      conversationId: conversation.id,
      message
    });

    try {
      const storeId = conversation.shopId || conversation.shop_id || conversation.storeId || null;
      
      console.log('🏪 Store ID:', storeId);
      
      if (!storeId) {
        console.error('❌ No store ID found in conversation:', conversation);
        throw new Error('Store ID is missing from conversation');
      }

      // ✅ Clear notifications when agent sends a message
      clearNotificationsForConversation(conversation.id);

      // ✅ Optimistically update the conversation list
      optimisticUpdate(conversation.id, message);

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

      // ✅ Update with actual server response (if different from optimistic)
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
      
      // ✅ On error, refresh to get correct state
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

  // ✅ Enhanced notification function with tracking
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
        tag: `conv-${conversationId}`, // Use conversation ID as tag
        requireInteraction: false,
        silent: false,
      };

      const notification = new Notification(title, options);

      // Track notification
      if (!activeNotificationsRef.current.has(conversationId)) {
        activeNotificationsRef.current.set(conversationId, []);
      }
      activeNotificationsRef.current.get(conversationId).push(notification);

      // Click to open conversation
      notification.onclick = () => {
        window.focus();
        const conv = conversations.find(c => c.id === conversationId);
        if (conv) {
          setActiveConversation(conv);
        }
        notification.close();
        removeNotificationFromTracking(conversationId, notification);
      };

      // Remove from tracking when closed
      notification.onclose = () => {
        removeNotificationFromTracking(conversationId, notification);
      };

      // Auto-close after 6 seconds
      setTimeout(() => {
        notification.close();
      }, 6000);

      console.log('🔔 [App] Notification shown for conversation:', conversationId);
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
    }
  };

  // ✅ Remove notification from tracking
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

  // ✅ Clear all notifications for a specific conversation
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

  const isConnected = getConnectionStatus();

  return (
    <div className="app">
      {/* Desktop Header - Hidden on mobile */}
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

      {/* Mobile Menu */}
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
        onLogout={onLogout}
        stats={stats}
        isConnected={isConnected}
      />

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
          <div className={`conversations-sidebar ${activeConversation ? 'hidden-mobile' : ''}`}>
            {/* Mobile hamburger in conversation list */}
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
              onSelectConversation={setActiveConversation}
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

      {/* Main Content - Employee Management */}
      {activePage === 'employees' && (
        <EmployeeManagement 
          currentUser={employee}
          onBack={handleBackToDashboard}
        />
      )}
    </div>
  );
}

export default App;