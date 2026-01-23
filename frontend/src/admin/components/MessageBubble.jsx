/**
 * MessageBubble Component
 * WhatsApp-style conversation bubbles
 */

import React from 'react';

function MessageBubble({
  message,
  isAgent = false,
  showAvatar = true,
  showSender = false,
  sending = false,
  isFirstInGroup = true,
  isLastInGroup = true,
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

  const senderName = message.senderName || (isAgent ? 'Agent' : 'Customer');
  const messageText = message.text || message.content || '';
  const messageTime = formatTime(message.timestamp || message.createdAt);

  return (
    <div className={`message-row ${isAgent ? 'agent' : 'customer'} ${isFirstInGroup ? 'first-in-group' : ''} ${isLastInGroup ? 'last-in-group' : ''}`}>
      <div className="message-container">
        {/* Avatar - only show for first message in group */}
        {!isAgent && isFirstInGroup && (
          <div className="message-avatar">
            {getInitials(senderName)}
          </div>
        )}
        
        {/* Spacer when no avatar */}
        {!isAgent && !isFirstInGroup && (
          <div className="message-avatar-spacer"></div>
        )}

        {/* Message Bubble */}
        <div className={`message-bubble ${isAgent ? 'agent' : 'customer'} ${sending ? 'sending' : ''} ${isFirstInGroup ? 'first' : ''} ${isLastInGroup ? 'last' : ''}`}>
          <div className="message-text">{messageText}</div>
          <div className="message-time-row">
            <span className="message-time">{messageTime}</span>
            
            {/* Status indicators for agent messages */}
            {isAgent && (
              <span className="message-status">
                {sending ? (
                  <svg className="spinner-icon" width="12" height="12" viewBox="0 0 12 12">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25"/>
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="15.7" strokeDashoffset="15.7" className="spinner-circle"/>
                  </svg>
                ) : (
                  <>
                    {(!message.status || message.status === 'sent') && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4.5 8.5L6.5 10.5L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {message.status === 'delivered' && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8.5L4 10.5L9 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 8.5L8 10.5L13 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {message.status === 'read' && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 8.5L4 10.5L9 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 8.5L8 10.5L13 5.5" stroke="#34B7F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;