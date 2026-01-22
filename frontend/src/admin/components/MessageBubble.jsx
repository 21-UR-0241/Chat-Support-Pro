/**
 * MessageBubble Component
 * Individual message display
 */

import React from 'react';
import { format, isValid } from 'date-fns';

function MessageBubble({ message, showAvatar = true }) {
  const { senderType, senderName, content, createdAt, sentAt, _optimistic } = message;
  
  const isAgent = senderType === 'agent';
  
  // Safe date formatting with fallback
  const formatTime = () => {
    try {
      const dateValue = createdAt || sentAt;
      if (!dateValue) return '';
      
      const date = new Date(dateValue);
      if (!isValid(date)) return '';
      
      return format(date, 'HH:mm');
    } catch (error) {
      console.error('Date formatting error:', error, { createdAt, sentAt });
      return '';
    }
  };

  const time = formatTime();

  return (
    <div className={`message-bubble ${isAgent ? 'agent' : 'customer'} ${_optimistic ? 'sending' : ''}`}>
      {showAvatar && (
        <div className="message-avatar">
          {senderName?.charAt(0)?.toUpperCase() || (isAgent ? 'A' : 'C')}
        </div>
      )}
      
      <div className="message-content">
        {showAvatar && (
          <div className="message-sender">{senderName || (isAgent ? 'Agent' : 'Customer')}</div>
        )}
        
        <div className="message-text">{content}</div>
        
        {time && (
          <div className="message-time">
            {time}
            {_optimistic && <span className="sending-indicator">Sending...</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;