/**
 * MessageBubble Component
 * Individual message display
 */

import React from 'react';
import { format } from 'date-fns';

function MessageBubble({ message, showAvatar }) {
  const { senderType, senderName, content, createdAt, _optimistic } = message;
  
  const isAgent = senderType === 'agent';
  const time = format(new Date(createdAt), 'HH:mm');

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
        
        <div className="message-time">
          {time}
          {_optimistic && <span className="sending-indicator">Sending...</span>}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;