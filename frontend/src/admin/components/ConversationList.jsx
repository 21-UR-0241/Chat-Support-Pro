/**
 * ConversationList Component
 * WhatsApp-inspired conversation list
 */

import React, { useMemo } from 'react';

function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation,
  filters,
  onFilterChange,
  stores,
  loading,
}) {
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

            return (
              <div
                key={conversation.id}
                className={`conversation-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
                onClick={() => onSelectConversation(conversation)}
              >
                {/* Avatar */}
                <div className="conversation-avatar">
                  {getInitials(conversation.customerName)}
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