

/**
 * ConversationList Component
 * Modern sidebar with conversations and filters
 */

import React, { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation,
  filters,
  onFilterChange,
  stores,
  loading,
}) {
  // Filter conversations based on filters
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];

    return conversations.filter((conv) => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch =
          conv.customerName?.toLowerCase().includes(search) ||
          conv.customerEmail?.toLowerCase().includes(search) ||
          conv.customerId?.toLowerCase().includes(search) ||
          conv.lastMessage?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && filters.status !== '') {
        if (conv.status !== filters.status) return false;
      }

      // Store filter
      if (filters.storeId && filters.storeId !== '') {
        if (conv.storeIdentifier !== filters.storeId) return false;
      }

      // Priority filter
      if (filters.priority && filters.priority !== '') {
        if (conv.priority !== filters.priority) return false;
      }

      return true;
    });
  }, [conversations, filters]);

  // Format time
  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const now = new Date();
      const messageDate = new Date(date);
      const diffInHours = (now - messageDate) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return messageDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      } else if (diffInHours < 168) {
        return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
      } else {
        return messageDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }
    } catch (e) {
      return '';
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return 'G';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="conversation-list">
      {/* Header */}
      <div className="conversation-list-header">
        <h2>
          Conversations
          <span className="conversation-count">{filteredConversations.length}</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="conversation-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search conversations..."
          value={filters.search || ''}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
        />
        
        <div className="filter-row">
          <select
            className="filter-select"
            value={filters.status || ''}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
          
          <select
            className="filter-select"
            value={filters.priority || ''}
            onChange={(e) => onFilterChange({ ...filters, priority: e.target.value })}
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        
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
      </div>

      {/* Conversation Items */}
      <div className="conversation-items">
        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="no-conversations">
            <div className="empty-state-icon">💬</div>
            <h3>No conversations found</h3>
            <p>
              {filters.search || filters.status || filters.storeId || filters.priority
                ? 'Try adjusting your filters'
                : 'New customer messages will appear here'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                activeConversation?.id === conversation.id ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conversation)}
            >
              <div className="customer-info">
                <div className="customer-avatar">
                  {getInitials(conversation.customerName)}
                </div>
                
                <div className="customer-details">
                  <div className="conversation-item-header">
                    <span className="customer-name">
                      {conversation.customerName || 'Guest'}
                    </span>
                    <span className="conversation-time">
                      {formatTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  
                  <div className="last-message">
                    {conversation.lastMessage || 'No messages yet'}
                  </div>
                  
                  <div className="conversation-meta">
                    <span className={`status-tag ${conversation.status}`}>
                      {conversation.status}
                    </span>
                    {conversation.priority && conversation.priority !== 'normal' && (
                      <span className={`priority-tag ${conversation.priority}`}>
                        {conversation.priority}
                      </span>
                    )}
                    {conversation.storeIdentifier && (
                      <span className="store-tag">
                        {conversation.storeIdentifier}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {conversation.unreadCount > 0 && (
                <span className="unread-badge">{conversation.unreadCount}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConversationList;