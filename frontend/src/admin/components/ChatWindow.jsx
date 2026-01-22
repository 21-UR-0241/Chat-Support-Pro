


// //frontend/src/admin/components/ChatWindow.jsx
// /**
//  * ChatWindow Component
//  * Modern chat interface with WhatsApp-inspired design
//  */

// import React, { useState, useEffect, useRef } from 'react';
// import { formatDistanceToNow } from 'date-fns';
// import api from '../services/api';
// import MessageBubble from './MessageBubble';
// import CustomerInfo from './CustomerInfo';

// function ChatWindow({
//   conversation,
//   onSendMessage,
//   onClose,
//   onTyping,
//   employeeName,
// }) {
//   const [messages, setMessages] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [messageText, setMessageText] = useState('');
//   const [sending, setSending] = useState(false);
//   const [typingUsers, setTypingUsers] = useState(new Set());
//   const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  
//   const messagesEndRef = useRef(null);
//   const textareaRef = useRef(null);
//   const typingTimeoutRef = useRef(null);

//   // Load messages when conversation changes
//   useEffect(() => {
//     if (conversation) {
//       loadMessages();
//     }
//   }, [conversation?.id]);

//   // Auto-scroll to bottom
//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   // Auto-resize textarea
//   useEffect(() => {
//     if (textareaRef.current) {
//       textareaRef.current.style.height = 'auto';
//       textareaRef.current.style.height = 
//         Math.min(textareaRef.current.scrollHeight, 120) + 'px';
//     }
//   }, [messageText]);

//   // Load messages
//   const loadMessages = async () => {
//     try {
//       setLoading(true);
//       const data = await api.getMessages(conversation.id);
//       setMessages(data);
//     } catch (error) {
//       console.error('Failed to load messages:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Scroll to bottom
//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   // Handle send message
//   const handleSend = async () => {
//     if (!messageText.trim() || sending) return;

//     const text = messageText.trim();
//     setMessageText('');
//     setSending(true);

//     // Reset textarea height
//     if (textareaRef.current) {
//       textareaRef.current.style.height = 'auto';
//     }

//     // Optimistic UI update
//     const optimisticMessage = {
//       id: Date.now(),
//       conversationId: conversation.id,
//       senderType: 'agent',
//       senderName: employeeName,
//       content: text,
//       createdAt: new Date().toISOString(),
//       _optimistic: true,
//     };

//     setMessages(prev => [...prev, optimisticMessage]);

//     try {
//       // Send to backend
//       const sentMessage = await onSendMessage(conversation, text);
      
//       // Replace optimistic message with real one
//       setMessages(prev =>
//         prev.map(msg =>
//           msg._optimistic && msg.content === text ? sentMessage : msg
//         )
//       );
//     } catch (error) {
//       console.error('Failed to send message:', error);
      
//       // Remove optimistic message on error
//       setMessages(prev => prev.filter(msg => !msg._optimistic));
      
//       // Restore text
//       setMessageText(text);
      
//       alert('Failed to send message. Please try again.');
//     } finally {
//       setSending(false);
//     }
//   };

//   // Handle typing
//   const handleTyping = (e) => {
//     setMessageText(e.target.value);

//     // Send typing indicator
//     if (onTyping) {
//       onTyping(true);

//       // Clear previous timeout
//       if (typingTimeoutRef.current) {
//         clearTimeout(typingTimeoutRef.current);
//       }

//       // Set timeout to send "stopped typing"
//       typingTimeoutRef.current = setTimeout(() => {
//         onTyping(false);
//       }, 2000);
//     }
//   };

//   // Handle key press
//   const handleKeyPress = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       handleSend();
//     }
//   };

//   // Handle close conversation
//   const handleCloseConversation = async () => {
//     if (window.confirm('Are you sure you want to close this conversation?')) {
//       try {
//         await api.closeConversation(conversation.id);
//         onClose();
//       } catch (error) {
//         console.error('Failed to close conversation:', error);
//         alert('Failed to close conversation');
//       }
//     }
//   };

//   // Get initials from name
//   const getInitials = (name) => {
//     if (!name) return 'G';
//     return name
//       .split(' ')
//       .map((n) => n[0])
//       .join('')
//       .toUpperCase()
//       .slice(0, 2);
//   };

//   // Show empty state if no conversation selected
//   if (!conversation) {
//     return (
//       <div className="chat-window">
//         <div className="empty-state">
//           <div className="empty-state-icon">💬</div>
//           <h3>No conversation selected</h3>
//           <p>Select a conversation from the list to start chatting</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="chat-window">
//       {/* Header */}
//       <div className="chat-header">
//         <div className="chat-header-left">
//           <div className="chat-header-avatar">
//             {getInitials(conversation.customerName)}
//           </div>
//           <div className="chat-header-info">
//             <h3>{conversation.customerName || 'Guest'}</h3>
//             <div className="chat-header-subtitle">
//               {conversation.storeIdentifier} • {conversation.customerEmail || 'No email'}
//             </div>
//           </div>
//         </div>
//         <div className="chat-actions">
//           <button
//             className="icon-btn"
//             onClick={() => setShowCustomerInfo(!showCustomerInfo)}
//             title="Customer info"
//           >
//             ℹ️
//           </button>
//           <button
//             className="icon-btn"
//             onClick={handleCloseConversation}
//             title="Close conversation"
//           >
//             ✓
//           </button>
//           <button className="icon-btn" title="More options">⋮</button>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="chat-content">
//         {/* Messages Area */}
//         <div className="chat-messages" style={{ flex: showCustomerInfo ? '1' : 'auto' }}>
//           {loading ? (
//             <div className="empty-state">
//               <div className="spinner"></div>
//             </div>
//           ) : messages.length === 0 ? (
//             <div className="empty-state">
//               <div className="empty-state-icon">💬</div>
//               <h3>No messages yet</h3>
//               <p>Start the conversation by sending a message</p>
//             </div>
//           ) : (
//             <>
//               {messages.map((message, index) => {
//                 const showAvatar = 
//                   index === 0 || 
//                   messages[index - 1].senderType !== message.senderType;
                
//                 return (
//                   <MessageBubble
//                     key={message.id}
//                     message={message}
//                     showAvatar={showAvatar}
//                   />
//                 );
//               })}
              
//               {/* Typing Indicator */}
//               {typingUsers.size > 0 && (
//                 <div className="message-bubble customer">
//                   <div className="message-avatar">C</div>
//                   <div className="message-content">
//                     <div className="message-text">
//                       <span>typing</span>
//                       <span className="typing-dots">
//                         <span>.</span>
//                         <span>.</span>
//                         <span>.</span>
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               )}
              
//               <div ref={messagesEndRef} />
//             </>
//           )}
//         </div>

//         {/* Customer Info Sidebar */}
//         {showCustomerInfo && (
//           <CustomerInfo
//             conversation={conversation}
//             onClose={() => setShowCustomerInfo(false)}
//           />
//         )}
//       </div>

//       {/* Input Area */}
//       <div className="chat-input-container">
//         <div className="chat-input-wrapper">
//           <textarea
//             ref={textareaRef}
//             className="chat-input"
//             placeholder="Type a message..."
//             value={messageText}
//             onChange={handleTyping}
//             onKeyDown={handleKeyPress}
//             rows="1"
//             disabled={sending}
//           />
//           <button className="attach-btn" title="Attach file">
//             📎
//           </button>
//         </div>
//         <button
//           className="send-btn"
//           onClick={handleSend}
//           disabled={!messageText.trim() || sending}
//           title="Send message (Enter)"
//         >
//           {sending ? '⏳' : '➤'}
//         </button>
//       </div>
//     </div>
//   );
// }

// export default ChatWindow;


//frontend/src/admin/components/ChatWindow.jsx
/**
 * ChatWindow Component
 * Modern chat interface with WhatsApp-inspired design
 */

import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import MessageBubble from './MessageBubble';
import CustomerInfo from './CustomerInfo';

function ChatWindow({
  conversation,
  onSendMessage,
  onClose,
  onTyping,
  employeeName,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation) {
      loadMessages();
    }
  }, [conversation?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = 
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  // Load messages
  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await api.getMessages(conversation.id);
      setMessages(data || []); // Ensure it's always an array
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle send message
  const handleSend = async (e) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('🚀 Sending message...', { messageText, sending, conversation });

    if (!messageText.trim() || sending) {
      console.log('❌ Message empty or already sending');
      return;
    }

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Optimistic UI update
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      senderType: 'agent',
      senderName: employeeName || 'Agent',
      content: text,
      timestamp: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };

    console.log('📝 Adding optimistic message:', optimisticMessage);
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      console.log('📤 Calling onSendMessage...');
      
      // Send to backend
      const sentMessage = await onSendMessage(conversation, text);
      
      console.log('✅ Message sent successfully:', sentMessage);
      
      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(msg =>
          msg._optimistic && msg.content === text ? sentMessage : msg
        )
      );
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg._optimistic));
      
      // Restore text
      setMessageText(text);
      
      // Show user-friendly error
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to send message: ${errorMessage}. Please try again.`);
    } finally {
      setSending(false);
      console.log('🏁 Send complete');
    }
  };

  // Handle typing
  const handleTyping = (e) => {
    setMessageText(e.target.value);

    // Send typing indicator
    if (onTyping) {
      onTyping(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to send "stopped typing"
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSend(e);
    }
  };

  // Handle close conversation
  const handleCloseConversation = async () => {
    if (window.confirm('Are you sure you want to close this conversation?')) {
      try {
        await api.closeConversation(conversation.id);
        if (onClose) onClose();
      } catch (error) {
        console.error('Failed to close conversation:', error);
        alert('Failed to close conversation');
      }
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

  // Show empty state if no conversation selected
  if (!conversation) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <h3>No conversation selected</h3>
          <p>Select a conversation from the list to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-avatar">
            {getInitials(conversation.customerName)}
          </div>
          <div className="chat-header-info">
            <h3>{conversation.customerName || 'Guest'}</h3>
            <div className="chat-header-subtitle">
              {conversation.storeIdentifier} • {conversation.customerEmail || 'No email'}
            </div>
          </div>
        </div>
        <div className="chat-actions">
          <button
            className="icon-btn"
            onClick={() => setShowCustomerInfo(!showCustomerInfo)}
            title="Customer info"
            type="button"
          >
            ℹ️
          </button>
          <button
            className="icon-btn"
            onClick={handleCloseConversation}
            title="Close conversation"
            type="button"
          >
            ✓
          </button>
          <button className="icon-btn" title="More options" type="button">
            ⋮
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="chat-content">
        {/* Messages Area */}
        <div className="chat-messages" style={{ flex: showCustomerInfo ? '1' : 'auto' }}>
          {loading ? (
            <div className="empty-state">
              <div className="spinner"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3>No messages yet</h3>
              <p>Start the conversation by sending a message</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const showAvatar = 
                  index === 0 || 
                  messages[index - 1].senderType !== message.senderType;
                
                return (
                  <MessageBubble
                    key={message.id || `msg-${index}`}
                    message={message}
                    showAvatar={showAvatar}
                  />
                );
              })}
              
              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="message-bubble customer">
                  <div className="message-avatar">C</div>
                  <div className="message-content">
                    <div className="message-text">
                      <span>typing</span>
                      <span className="typing-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Customer Info Sidebar */}
        {showCustomerInfo && (
          <CustomerInfo
            conversation={conversation}
            onClose={() => setShowCustomerInfo(false)}
          />
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Type a message..."
            value={messageText}
            onChange={handleTyping}
            onKeyDown={handleKeyPress}
            rows="1"
            disabled={sending}
          />
          <button className="attach-btn" title="Attach file" type="button">
            📎
          </button>
        </div>
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!messageText.trim() || sending}
          title="Send message (Enter)"
          type="button"
        >
          {sending ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;