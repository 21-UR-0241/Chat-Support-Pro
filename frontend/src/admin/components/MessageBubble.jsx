/**
 * MessageBubble Component
 * iOS/WhatsApp-inspired design
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';

function MessageBubble({
  message,
  isAgent = false,
  isCustomer = false,
  showAvatar = true,
  showSender = false,
  sending = false,
}) {
  // Format time - WhatsApp style
  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const messageDate = new Date(date);
      return messageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  // Get initials from sender name
  const getInitials = (name) => {
    if (!name) return isAgent ? 'A' : 'C';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get avatar color
  const getAvatarColor = (name, isAgent) => {
    if (isAgent) return '#007AFF';
    
    if (!name) return '#8E8E93';
    const colors = [
      '#FF3B30', '#FF9500', '#FFCC00', '#34C759', 
      '#00C7BE', '#30B0C7', '#007AFF', '#5856D6', 
      '#AF52DE', '#FF2D55'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const senderName = message.senderName || (isAgent ? 'Agent' : 'Customer');
  const avatarColor = getAvatarColor(senderName, isAgent);

  return (
    <div className={`message-bubble ${isAgent ? 'agent' : 'customer'} ${sending ? 'sending' : ''}`}>
      {/* Avatar - Only show for customer messages */}
      {!isAgent && showAvatar && (
        <div className="message-avatar-container">
          <div 
            className="message-avatar"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(senderName)}
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className="message-content">
        {showSender && (
          <div className="message-sender">
            {senderName}
          </div>
        )}
        
        <div className="message-bubble-wrapper">
          <div className="message-text">
            {message.text || message.content}
          </div>
          
          <div className="message-meta">
            <span className="message-time">
              {formatTime(message.timestamp || message.createdAt)}
            </span>
            
            {isAgent && message.status && (
              <span className="message-status">
                {message.status === 'sent' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {message.status === 'delivered' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8L5 11L10 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 8L9 11L14 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {message.status === 'read' && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8L5 11L10 5" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 8L9 11L14 5" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            )}
            
            {sending && (
              <span className="sending-indicator">
                <svg width="12" height="12" viewBox="0 0 12 12" className="spinner-small">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.4" strokeDashoffset="10" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;