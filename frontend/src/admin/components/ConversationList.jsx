/**
 * ConversationList Component
 * Clean iOS/WhatsApp-inspired design
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

  // Format time - WhatsApp style
  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const now = new Date();
      const messageDate = new Date(date);
      const diffInHours = (now - messageDate) / (1000 * 60 * 60);
      const diffInDays = diffInHours / 24;

      if (diffInHours < 24) {
        return messageDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      } else if (diffInDays < 7) {
        return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
      } else if (diffInDays < 365) {
        return messageDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      } else {
        return messageDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
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

  // Get avatar color based on name
  const getAvatarColor = (name) => {
    if (!name) return '#8E8E93';
    const colors = [
      '#FF3B30', '#FF9500', '#FFCC00', '#34C759', 
      '#00C7BE', '#30B0C7', '#007AFF', '#5856D6', 
      '#AF52DE', '#FF2D55'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="conversation-list">
      {/* Header */}
      <div className="conversation-list-header">
        <h1 className="header-title">Messages</h1>
      </div>

      {/* Search Bar - iOS Style */}
      <div className="search-container">
        <div className="search-bar">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 14L11.1 11.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button 
              className="search-clear"
              onClick={() => onFilterChange({ ...filters, search: '' })}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      {(filters.status || filters.priority || filters.storeId) && (
        <div className="filter-pills">
          {filters.status && (
            <div className="filter-pill">
              <span>{filters.status}</span>
              <button onClick={() => onFilterChange({ ...filters, status: '' })}>×</button>
            </div>
          )}
          {filters.priority && (
            <div className="filter-pill">
              <span>{filters.priority}</span>
              <button onClick={() => onFilterChange({ ...filters, priority: '' })}>×</button>
            </div>
          )}
          {filters.storeId && (
            <div className="filter-pill">
              <span>{stores.find(s => s.storeIdentifier === filters.storeId)?.brandName || filters.storeId}</span>
              <button onClick={() => onFilterChange({ ...filters, storeId: '' })}>×</button>
            </div>
          )}
        </div>
      )}

      {/* Compact Filters */}
      <div className="compact-filters">
        <select
          className="compact-select"
          value={filters.status || ''}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
        </select>
        
        <select
          className="compact-select"
          value={filters.priority || ''}
          onChange={(e) => onFilterChange({ ...filters, priority: e.target.value })}
        >
          <option value="">Priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <select
          className="compact-select"
          value={filters.storeId || ''}
          onChange={(e) => onFilterChange({ ...filters, storeId: e.target.value })}
        >
          <option value="">Store</option>
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
          <div className="loading-state">
            <div className="spinner"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>No Messages</h3>
            <p>
              {filters.search || filters.status || filters.storeId || filters.priority
                ? 'No conversations match your filters'
                : 'New messages will appear here'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                activeConversation?.id === conversation.id ? 'active' : ''
              } ${conversation.unreadCount > 0 ? 'unread' : ''}`}
              onClick={() => onSelectConversation(conversation)}
            >
              <div className="avatar-container">
                <div 
                  className="avatar"
                  style={{ backgroundColor: getAvatarColor(conversation.customerName) }}
                >
                  {getInitials(conversation.customerName)}
                </div>
              </div>
              
              <div className="conversation-content">
                <div className="conversation-header">
                  <h3 className="customer-name">
                    {conversation.customerName || 'Guest'}
                  </h3>
                  <span className="time">
                    {formatTime(conversation.lastMessageAt)}
                  </span>
                </div>
                
                <div className="conversation-preview">
                  <p className="last-message">
                    {conversation.lastMessage || 'No messages yet'}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="unread-count">{conversation.unreadCount}</span>
                  )}
                </div>
                
                {/* Subtle badges */}
                {(conversation.priority === 'high' || conversation.priority === 'urgent' || conversation.storeIdentifier) && (
                  <div className="conversation-badges">
                    {(conversation.priority === 'high' || conversation.priority === 'urgent') && (
                      <span className="badge-priority">
                        {conversation.priority === 'urgent' ? '🔴' : '⚠️'}
                      </span>
                    )}
                    {conversation.storeIdentifier && (
                      <span className="badge-store">
                        {conversation.storeIdentifier}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConversationList;