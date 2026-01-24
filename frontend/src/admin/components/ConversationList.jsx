// /**
//  * ConversationList Component
//  * WhatsApp-inspired conversation list
//  */

// import React, { useMemo } from 'react';

// function ConversationList({
//   conversations,
//   activeConversation,
//   onSelectConversation,
//   filters,
//   onFilterChange,
//   stores,
//   loading,
// }) {
//   // Filter conversations
//   const filteredConversations = useMemo(() => {
//     if (!conversations) return [];

//     return conversations.filter((conv) => {
//       const search = filters.search?.toLowerCase();
//       if (search) {
//         const matchesSearch =
//           conv.customerName?.toLowerCase().includes(search) ||
//           conv.customerEmail?.toLowerCase().includes(search) ||
//           conv.customerId?.toLowerCase().includes(search) ||
//           conv.lastMessage?.toLowerCase().includes(search);
//         if (!matchesSearch) return false;
//       }

//       if (filters.status && conv.status !== filters.status) return false;
//       if (filters.storeId && conv.storeIdentifier !== filters.storeId) return false;
//       if (filters.priority && conv.priority !== filters.priority) return false;

//       return true;
//     });
//   }, [conversations, filters]);

//   // Format time - WhatsApp style
//   const formatTime = (date) => {
//     if (!date) return '';
    
//     try {
//       const now = new Date();
//       const messageDate = new Date(date);
//       const diffInHours = (now - messageDate) / (1000 * 60 * 60);

//       // Today - show time
//       if (diffInHours < 24 && messageDate.getDate() === now.getDate()) {
//         return messageDate.toLocaleTimeString('en-US', {
//           hour: 'numeric',
//           minute: '2-digit',
//           hour12: true,
//         });
//       }
      
//       // Yesterday
//       const yesterday = new Date(now);
//       yesterday.setDate(yesterday.getDate() - 1);
//       if (messageDate.toDateString() === yesterday.toDateString()) {
//         return 'Yesterday';
//       }
      
//       // This week - show day
//       if (diffInHours < 168) {
//         return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
//       }
      
//       // This year - show date
//       if (messageDate.getFullYear() === now.getFullYear()) {
//         return messageDate.toLocaleDateString('en-US', {
//           month: 'short',
//           day: 'numeric',
//         });
//       }
      
//       // Older - show year
//       return messageDate.toLocaleDateString('en-US', {
//         month: 'short',
//         day: 'numeric',
//         year: '2-digit',
//       });
//     } catch (e) {
//       return '';
//     }
//   };

//   // Get initials
//   const getInitials = (name) => {
//     if (!name) return 'G';
//     return name
//       .split(' ')
//       .map((n) => n[0])
//       .join('')
//       .toUpperCase()
//       .slice(0, 2);
//   };

//   // Clear all filters
//   const clearFilters = () => {
//     onFilterChange({ search: '', status: '', priority: '', storeId: '' });
//   };

//   const hasActiveFilters = filters.status || filters.priority || filters.storeId;

//   return (
//     <div className="conversation-list">


//       {/* Search */}
//       <div className="conversation-search">
//         <div className="search-wrapper">
//           <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
//             <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
//             <path d="M12.5 12.5L16.5 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
//           </svg>
//           <input
//             type="text"
//             className="search-input"
//             placeholder="Search or start new chat"
//             value={filters.search || ''}
//             onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
//           />
//           {filters.search && (
//             <button 
//               className="search-clear"
//               onClick={() => onFilterChange({ ...filters, search: '' })}
//               aria-label="Clear search"
//             >
//               ✕
//             </button>
//           )}
//         </div>
//       </div>

//       {/* Filters */}
//       <div className="conversation-filters">
//         {stores && stores.length > 0 && (
//           <select
//             className="filter-select"
//             value={filters.storeId || ''}
//             onChange={(e) => onFilterChange({ ...filters, storeId: e.target.value })}
//           >
//             <option value="">All Stores</option>
//             {stores.map((store) => (
//               <option key={store.id} value={store.storeIdentifier}>
//                 {store.brandName}
//               </option>
//             ))}
//           </select>
//         )}

//         {hasActiveFilters && (
//           <button className="filter-clear" onClick={clearFilters}>
//             Clear
//           </button>
//         )}
//       </div>

//       {/* Conversation List */}
//       <div className="conversation-items">
//         {loading ? (
//           <div className="loading-state">
//             <div className="spinner"></div>
//             <p>Loading chats...</p>
//           </div>
//         ) : filteredConversations.length === 0 ? (
//           <div className="empty-conversations">
//             <div className="empty-icon">💬</div>
//             <h3>No chats</h3>
//             <p>
//               {filters.search || hasActiveFilters
//                 ? 'No conversations match your search'
//                 : 'Start a new conversation'}
//             </p>
//           </div>
//         ) : (
//           filteredConversations.map((conversation) => {
//             const isActive = activeConversation?.id === conversation.id;
//             const hasUnread = conversation.unreadCount > 0;
//             const isUrgent = conversation.priority === 'urgent';

//             return (
//               <div
//                 key={conversation.id}
//                 className={`conversation-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
//                 onClick={() => onSelectConversation(conversation)}
//               >
//                 {/* Avatar */}
//                 <div className="conversation-avatar">
//                   {getInitials(conversation.customerName)}
//                 </div>
                
//                 {/* Content */}
//                 <div className="conversation-details">
//                   <div className="conversation-top">
//                     <div className="conversation-name-wrapper">
//                       <h3 className="conversation-name">
//                         {conversation.customerName || 'Guest'}
//                       </h3>
//                       {isUrgent && <span className="urgent-indicator">🔴</span>}
//                     </div>
//                     <span className="conversation-time">
//                       {formatTime(conversation.lastMessageAt)}
//                     </span>
//                   </div>
                  
//                   <div className="conversation-bottom">
//                     <p className="conversation-preview">
//                       {conversation.lastMessage || 'No messages yet'}
//                     </p>
//                     {hasUnread && (
//                       <span className="unread-badge">
//                         {conversation.unreadCount}
//                       </span>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             );
//           })
//         )}
//       </div>
//     </div>
//   );
// }

// export default ConversationList;


/**
 * ConversationList Component
 * WhatsApp-inspired conversation list with notifications
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';

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
  const previousConversationsRef = useRef(null);
  const audioRef = useRef(null);

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

  // Play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    
    try {
      // Create a simple notification sound using Web Audio API
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
      icon: '/notification-icon.png', // Add your icon path
      badge: '/notification-badge.png', // Add your badge path
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

      // Auto close after 5 seconds
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
          // Check if there's a new message (unread count increased or last message changed)
          const hasNewMessage = 
            (currentConv.unreadCount > previousConv.unreadCount) ||
            (currentConv.lastMessage !== previousConv.lastMessage && 
             currentConv.lastMessageAt !== previousConv.lastMessageAt);
          
          if (hasNewMessage && currentConv.id !== activeConversation?.id) {
            // Show notification for new message
            playNotificationSound();
            showNotification(currentConv, currentConv.lastMessage);
          }
        } else {
          // New conversation appeared
          if (currentConv.unreadCount > 0) {
            playNotificationSound();
            showNotification(currentConv, currentConv.lastMessage);
          }
        }
      });
    }

    previousConversationsRef.current = conversations;
  }, [conversations, activeConversation, loading, notificationsEnabled, soundEnabled]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];

    return conversations.filter((conv) => {
      const search = filters.search?.toLowerCase();
      if (search) {
        const matchesSearch =
          conv.customerName?.toLowerCase().includes(search) ||
          conv.customerEmail?.toLowerCase().includes(search) ||
          conv.customerId?.toLowerCase().includes(search) ||
          conv.lastMessage?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      if (filters.status && conv.status !== filters.status) return false;
      if (filters.storeId && conv.storeIdentifier !== filters.storeId) return false;
      if (filters.priority && conv.priority !== filters.priority) return false;

      return true;
    });
  }, [conversations, filters]);

  // Format time - WhatsApp style
  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const now = new Date();
      const messageDate = new Date(date);
      const diffInHours = (now - messageDate) / (1000 * 60 * 60);

      // Today - show time
      if (diffInHours < 24 && messageDate.getDate() === now.getDate()) {
        return messageDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
      
      // Yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (messageDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      
      // This week - show day
      if (diffInHours < 168) {
        return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
      }
      
      // This year - show date
      if (messageDate.getFullYear() === now.getFullYear()) {
        return messageDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }
      
      // Older - show year
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  // Get initials
  const getInitials = (name) => {
    if (!name) return 'G';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Clear all filters
  const clearFilters = () => {
    onFilterChange({ search: '', status: '', priority: '', storeId: '' });
  };

  const hasActiveFilters = filters.status || filters.priority || filters.storeId;

  return (
    <div className="conversation-list">
      {/* Header with notification settings */}
      <div className="conversation-list-header">
        <h2>Chats</h2>
        <div className="header-actions">
          <button
            className="notification-settings-btn"
            onClick={() => setShowNotificationSettings(!showNotificationSettings)}
            title="Notification settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C9.45 2 9 2.45 9 3V3.5C7.16 4.08 5.82 5.75 5.82 7.75V11.5L4.5 13V14H15.5V13L14.18 11.5V7.75C14.18 5.75 12.84 4.08 11 3.5V3C11 2.45 10.55 2 10 2ZM10 17C10.83 17 11.5 16.33 11.5 15.5H8.5C8.5 16.33 9.17 17 10 17Z" fill="currentColor"/>
            </svg>
            {notificationPermission === 'granted' && notificationsEnabled && (
              <span className="notification-active-indicator"></span>
            )}
          </button>
        </div>
      </div>

      {/* Notification Settings Dropdown */}
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
              <button 
                className="permission-request-btn"
                onClick={requestNotificationPermission}
              >
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
          <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12.5 12.5L16.5 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
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
        ) : filteredConversations.length === 0 ? (
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
          filteredConversations.map((conversation) => {
            const isActive = activeConversation?.id === conversation.id;
            const hasUnread = conversation.unreadCount > 0;
            const isUrgent = conversation.priority === 'urgent';

            // Get store name from stores array
            const storeName = stores?.find(s => 
              s.storeIdentifier === conversation.storeIdentifier || 
              s.id === conversation.shopId
            )?.brandName || conversation.storeName || 'Unknown Store';

            return (
              <div
                key={conversation.id}
                className={`conversation-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
                onClick={() => onSelectConversation(conversation)}
              >
                {/* Unread Indicator */}
                {hasUnread && <div className="unread-indicator"></div>}
                
                {/* Avatar */}
                <div className="conversation-avatar">
                  {getInitials(conversation.customerName)}
                  {hasUnread && (
                    <span className="avatar-badge">{conversation.unreadCount}</span>
                  )}
                </div>
                
                {/* Content */}
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
                  
                  {/* Store and Email */}
                  <div className="conversation-meta">
                    <span className="store-badge"> {storeName}</span>
                    {conversation.customerEmail && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="customer-email">{conversation.customerEmail}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Latest Message */}
                  <div className="conversation-bottom">
                    <p className="conversation-preview">
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                    {hasUnread && (
                      <span className="unread-badge">
                        {conversation.unreadCount}
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