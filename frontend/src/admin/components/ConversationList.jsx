

import React, { useMemo, useEffect, useRef, useState } from 'react';
import '../styles/ConversationList.css';

function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation,
  filters,
  onFilterChange,
  stores,
  loading,
}) {
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const previousConversationsRef = useRef(null);

  // Initialize notification permission status
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  // Toast helper
  const showToast = (text) => {
    setToast(text);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
  };

  // Play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 600;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  // Show browser notification
  const showNotification = (conversation, newMessage) => {
    if (!notificationsEnabled || notificationPermission !== 'granted') return;

    const title = conversation.customerName || 'New Message';
    const options = {
      body: newMessage || conversation.lastMessage || 'You have a new message',
      icon: '/notification-icon.png',
      badge: '/notification-badge.png',
      tag: `conversation-${conversation.id}`,
      requireInteraction: false,
      silent: !soundEnabled,
      data: {
        conversationId: conversation.id,
        url: window.location.href
      }
    };

    try {
      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        onSelectConversation(conversation);
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  // Detect new messages
  useEffect(() => {
    if (!conversations || loading) return;
    const previousConversations = previousConversationsRef.current;

    if (previousConversations) {
      conversations.forEach((currentConv) => {
        const previousConv = previousConversations.find(c => c.id === currentConv.id);

        if (previousConv) {
          const hasNewMessage =
            (currentConv.unreadCount > previousConv.unreadCount) ||
            (currentConv.lastMessage !== previousConv.lastMessage &&
              currentConv.lastMessageAt !== previousConv.lastMessageAt);

          if (hasNewMessage && currentConv.id !== activeConversation?.id) {
            playNotificationSound();
            showNotification(currentConv, currentConv.lastMessage);
            showToast(`New message from ${currentConv.customerName || 'Guest'}`);
          }
        } else {
          if (currentConv.unreadCount > 0) {
            playNotificationSound();
            showNotification(currentConv, currentConv.lastMessage);
            showToast(`New conversation from ${currentConv.customerName || 'Guest'}`);
          }
        }
      });
    }

    previousConversationsRef.current = conversations;
  }, [conversations, activeConversation, loading, notificationsEnabled, soundEnabled]);

  // Group conversations by email and store
  const groupedConversations = useMemo(() => {
    if (!conversations) return [];
    
    const grouped = new Map();
    
    conversations.forEach((conv) => {
      // Create a unique key based on email + store identifier
      const email = (conv.customerEmail || '').toLowerCase().trim();
      const storeId = conv.storeIdentifier || conv.shopId || '';
      
      // Skip if no email (can't group without email)
      if (!email) {
        // Add ungrouped conversations with a unique key
        const uniqueKey = `no-email-${conv.id}`;
        grouped.set(uniqueKey, {
          conversations: [conv],
          mostRecent: conv,
          groupKey: uniqueKey,
        });
        return;
      }
      
      const groupKey = `${email}-${storeId}`;
      
      if (grouped.has(groupKey)) {
        const group = grouped.get(groupKey);
        group.conversations.push(conv);
        
        // Update most recent conversation
        const currentMostRecent = group.mostRecent;
        const currentTime = new Date(conv.lastMessageAt || 0);
        const mostRecentTime = new Date(currentMostRecent.lastMessageAt || 0);
        
        if (currentTime > mostRecentTime) {
          group.mostRecent = conv;
        }
      } else {
        grouped.set(groupKey, {
          conversations: [conv],
          mostRecent: conv,
          groupKey,
        });
      }
    });
    
    // Convert map to array and sort by most recent message
    return Array.from(grouped.values()).sort((a, b) => {
      const timeA = new Date(a.mostRecent.lastMessageAt || 0);
      const timeB = new Date(b.mostRecent.lastMessageAt || 0);
      return timeB - timeA;
    });
  }, [conversations]);

  // Filter grouped conversations
  const filteredGroupedConversations = useMemo(() => {
    if (!groupedConversations) return [];
    
    return groupedConversations.filter((group) => {
      const conv = group.mostRecent;
      const search = filters.search?.toLowerCase();
      
      if (search) {
        // Get store name for this conversation
        const storeName = stores?.find(s =>
          s.storeIdentifier === conv.storeIdentifier ||
          s.id === conv.shopId
        )?.brandName || conv.storeName || '';
        
        const matchesSearch =
          conv.customerName?.toLowerCase().includes(search) ||
          conv.customerEmail?.toLowerCase().includes(search) ||
          conv.customerId?.toLowerCase().includes(search) ||
          conv.lastMessage?.toLowerCase().includes(search) ||
          storeName.toLowerCase().includes(search) ||
          conv.storeIdentifier?.toLowerCase().includes(search) ||
          conv.shopId?.toString().toLowerCase().includes(search);
        
        if (!matchesSearch) return false;
      }
      
      if (filters.status) {
        // Check if any conversation in the group matches the status
        const hasMatchingStatus = group.conversations.some(c => c.status === filters.status);
        if (!hasMatchingStatus) return false;
      }
      
      if (filters.storeId) {
        const matchesStore = stores?.find(s =>
          (s.storeIdentifier === filters.storeId) &&
          (s.storeIdentifier === conv.storeIdentifier || s.id === conv.shopId)
        );
        if (!matchesStore) return false;
      }
      
      if (filters.priority) {
        // Check if any conversation in the group matches the priority
        const hasMatchingPriority = group.conversations.some(c => c.priority === filters.priority);
        if (!hasMatchingPriority) return false;
      }
      
      // Read/Unread filter
      if (filters.readStatus) {
        // Calculate total unread for the group
        const totalUnread = group.conversations.reduce((sum, c) => {
          const count = c.unreadCount || c.unread_count || c.unread || 0;
          return sum + count;
        }, 0);
        
        const hasUnread = totalUnread > 0;
        
        if (filters.readStatus === 'unread' && !hasUnread) return false;
        if (filters.readStatus === 'read' && hasUnread) return false;
      }
      
      return true;
    });
  }, [groupedConversations, filters, stores]);

  // Total unread counter
  const totalUnread = useMemo(() => {
    if (!conversations) return 0;
    return conversations.reduce((sum, c) => {
      const count = c.unreadCount || c.unread_count || c.unread || 0;
      return sum + (Number(count) || 0);
    }, 0);
  }, [conversations]);

  // Format time
  const formatTime = (date) => {
    if (!date) return '';
    try {
      const now = new Date();
      const messageDate = new Date(date);
      const diffInHours = (now - messageDate) / (1000 * 60 * 60);

      if (diffInHours < 24 && messageDate.getDate() === now.getDate()) {
        return messageDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (messageDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }

      if (diffInHours < 168) {
        return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
      }

      if (messageDate.getFullYear() === now.getFullYear()) {
        return messageDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }

      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  // WhatsApp-style User Icon SVG Component
  const UserIcon = () => (
    <svg viewBox="0 0 212 212" width="50" height="50">
      <path
        fill="#DFE5E7"
        d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z"
      />
      <g fill="#FFF">
        <path d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.678 0 52.761-11.103 71.055-29.095v-.289s-.619-1.45-1.992-3.778a58.346 58.346 0 0 0-1.446-2.322zM106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-1.215-5.494 36.68 36.68 0 0 0-3.648-8.298 35.923 35.923 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342z" />
      </g>
    </svg>
  );

  // Clear all filters
  const clearFilters = () => {
    onFilterChange({ search: '', status: '', priority: '', storeId: '', readStatus: '' });
  };

  // Handle clicking on a grouped conversation
  const handleGroupClick = (group) => {
    // Always select the most recent conversation in the group
    onSelectConversation(group.mostRecent);
  };

  const hasActiveFilters = filters.status || filters.priority || filters.storeId || filters.readStatus;

  return (
    <div className="conversation-list">
      {/* Header */}
      <div className="conversation-list-header">
        <h2>
          Chats
          {totalUnread > 0 && (
            <span className="total-unread-badge">{totalUnread}</span>
          )}
        </h2>

        <div className="header-actions">
          <button
            className="notification-settings-btn"
            onClick={() => setShowNotificationSettings(!showNotificationSettings)}
            title="Notification settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C9.45 2 9 2.45 9 3V3.5C7.16 4.08 5.82 5.75 5.82 7.75V11.5L4.5 13V14H15.5V13L14.18 11.5V7.75C14.18 5.75 12.84 4.08 11 3.5V3C11 2.45 10.55 2 10 2ZM10 17C10.83 17 11.5 16.33 11.5 15.5H8.5C8.5 16.33 9.17 17 10 17Z" fill="currentColor" />
            </svg>
            {notificationPermission === 'granted' && notificationsEnabled && (
              <span className="notification-active-indicator"></span>
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast-notice">
          <span className="toast-icon">🔔</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Notification Settings */}
      {showNotificationSettings && (
        <div className="notification-settings-panel">
          <div className="notification-setting-item">
            <span>Browser Notifications</span>
            {notificationPermission === 'granted' ? (
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            ) : notificationPermission === 'denied' ? (
              <span className="permission-status denied">Blocked</span>
            ) : (
              <button className="permission-request-btn" onClick={requestNotificationPermission}>
                Enable
              </button>
            )}
          </div>

          <div className="notification-setting-item">
            <span>Notification Sound</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {notificationPermission === 'denied' && (
            <div className="permission-help">
              <small>
                Notifications are blocked. Click the lock icon 🔒 in your browser's address bar, then change Notifications to "Allow" and reload.
              </small>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="conversation-search">
        <div className="search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search or start new chat"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button
              className="search-clear"
              onClick={() => onFilterChange({ ...filters, search: '' })}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Read/Unread Filter Tabs */}
      <div className="read-status-tabs">
        <button
          className={`read-status-tab ${!filters.readStatus ? 'active' : ''}`}
          onClick={() => onFilterChange({ ...filters, readStatus: '' })}
        >
          All
        </button>
        <button
          className={`read-status-tab ${filters.readStatus === 'unread' ? 'active' : ''}`}
          onClick={() => onFilterChange({ ...filters, readStatus: 'unread' })}
        >
          Unread
          {totalUnread > 0 && (
            <span className="tab-badge">{totalUnread}</span>
          )}
        </button>
        <button
          className={`read-status-tab ${filters.readStatus === 'read' ? 'active' : ''}`}
          onClick={() => onFilterChange({ ...filters, readStatus: 'read' })}
        >
          Read
        </button>
      </div>

      {/* Filters */}
      <div className="conversation-filters">
        {stores && stores.length > 0 && (
          <select
            className="filter-select"
            value={filters.storeId || ''}
            onChange={(e) => onFilterChange({ ...filters, storeId: e.target.value })}
          >
            <option value="">All Stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.storeIdentifier}>
                {store.brandName}
              </option>
            ))}
          </select>
        )}
        {hasActiveFilters && (
          <button className="filter-clear" onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      {/* Conversation List */}
      <div className="conversation-items">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading chats...</p>
          </div>
        ) : filteredGroupedConversations.length === 0 ? (
          <div className="empty-conversations">
            <div className="empty-icon">💬</div>
            <h3>No chats</h3>
            <p>
              {filters.search || hasActiveFilters
                ? 'No conversations match your search'
                : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          filteredGroupedConversations.map((group) => {
            const conversation = group.mostRecent;
            const isActive = group.conversations.some(c => c.id === activeConversation?.id);
            const isGrouped = group.conversations.length > 1;
            
            // Calculate total unread for the group
            const totalGroupUnread = group.conversations.reduce((sum, c) => {
              const count = c.unreadCount || c.unread_count || c.unread || 0;
              return sum + count;
            }, 0);
            
            const hasUnread = totalGroupUnread > 0;
            const isUrgent = group.conversations.some(c => c.priority === 'urgent');

            const storeName =
              stores?.find(s =>
                s.storeIdentifier === conversation.storeIdentifier ||
                s.id === conversation.shopId
              )?.brandName || conversation.storeName || 'Unknown Store';

            return (
              <div
                key={group.groupKey}
                className={`conversation-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
                onClick={() => handleGroupClick(group)}
              >
                <div className="conversation-avatar">
                  <UserIcon />
                  {hasUnread && <span className="avatar-badge">{totalGroupUnread}</span>}
                  {isGrouped && (
                    <span className="group-count-badge">{group.conversations.length}</span>
                  )}
                </div>

                <div className="conversation-details">
                  <div className="conversation-top">
                    <div className="conversation-name-wrapper">
                      <h3 className="conversation-name">
                        {conversation.customerName || 'Guest'}
                      </h3>
                      {isUrgent && <span className="urgent-indicator">🔴</span>}
                    </div>
                    <span className="conversation-time">
                      {formatTime(conversation.lastMessageAt)}
                    </span>
                  </div>

                  <div className="conversation-meta">
                    <span className="store-badge">🏪 {storeName}</span>
                    {conversation.customerEmail && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="customer-email">{conversation.customerEmail}</span>
                      </>
                    )}

                    {/* NEW badge on far right */}
                    {hasUnread && <span className="meta-new-badge">NEW</span>}
                  </div>

                  <div className="conversation-bottom">
                    <p className="conversation-preview">
                      {(() => {
                        // If there's a last message
                        if (conversation.lastMessage) {
                          // Check if it was from an agent (you sent it)
                          const isAgentMessage = 
                            conversation.lastSenderType === 'agent' || 
                            conversation.lastMessageSenderType === 'agent';
                          
                          return (
                            <>
                              {isAgentMessage && (
                                <span className="you-label">You: </span>
                              )}
                              {conversation.lastMessage}
                            </>
                          );
                        }
                        
                        return 'No messages yet';
                      })()}
                    </p>
                    {hasUnread && (
                      <span className="unread-badge">
                        {totalGroupUnread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ConversationList;