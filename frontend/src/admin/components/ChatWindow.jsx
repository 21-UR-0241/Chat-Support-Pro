


// // //frontend/src/admin/components/ChatWindow.jsx
// // /**
// //  * ChatWindow Component
// //  * Modern chat interface with WhatsApp-inspired design
// //  */

// // import React, { useState, useEffect, useRef } from 'react';
// // import { formatDistanceToNow } from 'date-fns';
// // import api from '../services/api';
// // import MessageBubble from './MessageBubble';
// // import CustomerInfo from './CustomerInfo';

// // function ChatWindow({
// //   conversation,
// //   onSendMessage,
// //   onClose,
// //   onTyping,
// //   employeeName,
// // }) {
// //   const [messages, setMessages] = useState([]);
// //   const [loading, setLoading] = useState(true);
// //   const [messageText, setMessageText] = useState('');
// //   const [sending, setSending] = useState(false);
// //   const [typingUsers, setTypingUsers] = useState(new Set());
// //   const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  
// //   const messagesEndRef = useRef(null);
// //   const textareaRef = useRef(null);
// //   const typingTimeoutRef = useRef(null);

// //   // Load messages when conversation changes
// //   useEffect(() => {
// //     if (conversation) {
// //       loadMessages();
// //     }
// //   }, [conversation?.id]);

// //   // Auto-scroll to bottom
// //   useEffect(() => {
// //     scrollToBottom();
// //   }, [messages]);

// //   // Auto-resize textarea
// //   useEffect(() => {
// //     if (textareaRef.current) {
// //       textareaRef.current.style.height = 'auto';
// //       textareaRef.current.style.height = 
// //         Math.min(textareaRef.current.scrollHeight, 120) + 'px';
// //     }
// //   }, [messageText]);

// //   // Load messages
// //   const loadMessages = async () => {
// //     try {
// //       setLoading(true);
// //       const data = await api.getMessages(conversation.id);
// //       setMessages(data);
// //     } catch (error) {
// //       console.error('Failed to load messages:', error);
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   // Scroll to bottom
// //   const scrollToBottom = () => {
// //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
// //   };

// //   // Handle send message
// //   const handleSend = async () => {
// //     if (!messageText.trim() || sending) return;

// //     const text = messageText.trim();
// //     setMessageText('');
// //     setSending(true);

// //     // Reset textarea height
// //     if (textareaRef.current) {
// //       textareaRef.current.style.height = 'auto';
// //     }

// //     // Optimistic UI update
// //     const optimisticMessage = {
// //       id: Date.now(),
// //       conversationId: conversation.id,
// //       senderType: 'agent',
// //       senderName: employeeName,
// //       content: text,
// //       createdAt: new Date().toISOString(),
// //       _optimistic: true,
// //     };

// //     setMessages(prev => [...prev, optimisticMessage]);

// //     try {
// //       // Send to backend
// //       const sentMessage = await onSendMessage(conversation, text);
      
// //       // Replace optimistic message with real one
// //       setMessages(prev =>
// //         prev.map(msg =>
// //           msg._optimistic && msg.content === text ? sentMessage : msg
// //         )
// //       );
// //     } catch (error) {
// //       console.error('Failed to send message:', error);
      
// //       // Remove optimistic message on error
// //       setMessages(prev => prev.filter(msg => !msg._optimistic));
      
// //       // Restore text
// //       setMessageText(text);
      
// //       alert('Failed to send message. Please try again.');
// //     } finally {
// //       setSending(false);
// //     }
// //   };

// //   // Handle typing
// //   const handleTyping = (e) => {
// //     setMessageText(e.target.value);

// //     // Send typing indicator
// //     if (onTyping) {
// //       onTyping(true);

// //       // Clear previous timeout
// //       if (typingTimeoutRef.current) {
// //         clearTimeout(typingTimeoutRef.current);
// //       }

// //       // Set timeout to send "stopped typing"
// //       typingTimeoutRef.current = setTimeout(() => {
// //         onTyping(false);
// //       }, 2000);
// //     }
// //   };

// //   // Handle key press
// //   const handleKeyPress = (e) => {
// //     if (e.key === 'Enter' && !e.shiftKey) {
// //       e.preventDefault();
// //       handleSend();
// //     }
// //   };

// //   // Handle close conversation
// //   const handleCloseConversation = async () => {
// //     if (window.confirm('Are you sure you want to close this conversation?')) {
// //       try {
// //         await api.closeConversation(conversation.id);
// //         onClose();
// //       } catch (error) {
// //         console.error('Failed to close conversation:', error);
// //         alert('Failed to close conversation');
// //       }
// //     }
// //   };

// //   // Get initials from name
// //   const getInitials = (name) => {
// //     if (!name) return 'G';
// //     return name
// //       .split(' ')
// //       .map((n) => n[0])
// //       .join('')
// //       .toUpperCase()
// //       .slice(0, 2);
// //   };

// //   // Show empty state if no conversation selected
// //   if (!conversation) {
// //     return (
// //       <div className="chat-window">
// //         <div className="empty-state">
// //           <div className="empty-state-icon">💬</div>
// //           <h3>No conversation selected</h3>
// //           <p>Select a conversation from the list to start chatting</p>
// //         </div>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div className="chat-window">
// //       {/* Header */}
// //       <div className="chat-header">
// //         <div className="chat-header-left">
// //           <div className="chat-header-avatar">
// //             {getInitials(conversation.customerName)}
// //           </div>
// //           <div className="chat-header-info">
// //             <h3>{conversation.customerName || 'Guest'}</h3>
// //             <div className="chat-header-subtitle">
// //               {conversation.storeIdentifier} • {conversation.customerEmail || 'No email'}
// //             </div>
// //           </div>
// //         </div>
// //         <div className="chat-actions">
// //           <button
// //             className="icon-btn"
// //             onClick={() => setShowCustomerInfo(!showCustomerInfo)}
// //             title="Customer info"
// //           >
// //             ℹ️
// //           </button>
// //           <button
// //             className="icon-btn"
// //             onClick={handleCloseConversation}
// //             title="Close conversation"
// //           >
// //             ✓
// //           </button>
// //           <button className="icon-btn" title="More options">⋮</button>
// //         </div>
// //       </div>

// //       {/* Main Content */}
// //       <div className="chat-content">
// //         {/* Messages Area */}
// //         <div className="chat-messages" style={{ flex: showCustomerInfo ? '1' : 'auto' }}>
// //           {loading ? (
// //             <div className="empty-state">
// //               <div className="spinner"></div>
// //             </div>
// //           ) : messages.length === 0 ? (
// //             <div className="empty-state">
// //               <div className="empty-state-icon">💬</div>
// //               <h3>No messages yet</h3>
// //               <p>Start the conversation by sending a message</p>
// //             </div>
// //           ) : (
// //             <>
// //               {messages.map((message, index) => {
// //                 const showAvatar = 
// //                   index === 0 || 
// //                   messages[index - 1].senderType !== message.senderType;
                
// //                 return (
// //                   <MessageBubble
// //                     key={message.id}
// //                     message={message}
// //                     showAvatar={showAvatar}
// //                   />
// //                 );
// //               })}
              
// //               {/* Typing Indicator */}
// //               {typingUsers.size > 0 && (
// //                 <div className="message-bubble customer">
// //                   <div className="message-avatar">C</div>
// //                   <div className="message-content">
// //                     <div className="message-text">
// //                       <span>typing</span>
// //                       <span className="typing-dots">
// //                         <span>.</span>
// //                         <span>.</span>
// //                         <span>.</span>
// //                       </span>
// //                     </div>
// //                   </div>
// //                 </div>
// //               )}
              
// //               <div ref={messagesEndRef} />
// //             </>
// //           )}
// //         </div>

// //         {/* Customer Info Sidebar */}
// //         {showCustomerInfo && (
// //           <CustomerInfo
// //             conversation={conversation}
// //             onClose={() => setShowCustomerInfo(false)}
// //           />
// //         )}
// //       </div>

// //       {/* Input Area */}
// //       <div className="chat-input-container">
// //         <div className="chat-input-wrapper">
// //           <textarea
// //             ref={textareaRef}
// //             className="chat-input"
// //             placeholder="Type a message..."
// //             value={messageText}
// //             onChange={handleTyping}
// //             onKeyDown={handleKeyPress}
// //             rows="1"
// //             disabled={sending}
// //           />
// //           <button className="attach-btn" title="Attach file">
// //             📎
// //           </button>
// //         </div>
// //         <button
// //           className="send-btn"
// //           onClick={handleSend}
// //           disabled={!messageText.trim() || sending}
// //           title="Send message (Enter)"
// //         >
// //           {sending ? '⏳' : '➤'}
// //         </button>
// //       </div>
// //     </div>
// //   );
// // }

// // export default ChatWindow;


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

//   // 🐛 DEBUG: Log messages data
//   useEffect(() => {
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('📊 Messages state updated');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('Total messages:', messages?.length);
    
//     if (messages && messages.length > 0) {
//       messages.forEach((msg, i) => {
//         console.log(`\n📨 Message ${i}:`, {
//           id: msg.id,
//           createdAt: msg.createdAt,
//           sentAt: msg.sentAt,
//           timestamp: msg.timestamp,
//           content: msg.content?.substring(0, 50) + '...',
//           senderType: msg.senderType,
//           hasAllFields: {
//             id: !!msg.id,
//             content: !!msg.content,
//             createdAt: !!msg.createdAt,
//             sentAt: !!msg.sentAt,
//             timestamp: !!msg.timestamp,
//             senderType: !!msg.senderType
//           }
//         });
//       });
//     } else {
//       console.log('⚠️ No messages in state');
//     }
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
//   }, [messages]);

//   // Load messages when conversation changes
//   useEffect(() => {
//     if (conversation) {
//       console.log('🔄 Loading messages for conversation:', conversation.id);
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
//       setMessages(data || []); // Ensure it's always an array
//     } catch (error) {
//       console.error('Failed to load messages:', error);
//       setMessages([]); // Set empty array on error
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Scroll to bottom
//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   // Handle send message
//   const handleSend = async (e) => {
//     // Prevent any default behavior
//     if (e) {
//       e.preventDefault();
//       e.stopPropagation();
//     }

//     console.log('🚀 Sending message...', { messageText, sending, conversation });

//     if (!messageText.trim() || sending) {
//       console.log('❌ Message empty or already sending');
//       return;
//     }

//     const text = messageText.trim();
//     setMessageText('');
//     setSending(true);

//     // Reset textarea height
//     if (textareaRef.current) {
//       textareaRef.current.style.height = 'auto';
//     }

//     // Optimistic UI update
//     const optimisticMessage = {
//       id: `temp-${Date.now()}`,
//       conversationId: conversation.id,
//       senderType: 'agent',
//       senderName: employeeName || 'Agent',
//       content: text,
//       timestamp: new Date().toISOString(),
//       sentAt: new Date().toISOString(),
//       createdAt: new Date().toISOString(),
//       _optimistic: true,
//     };

//     console.log('📝 Adding optimistic message:', optimisticMessage);
//     setMessages(prev => [...prev, optimisticMessage]);

//     try {
//       console.log('📤 Calling onSendMessage...');
      
//       // Send to backend
//       const sentMessage = await onSendMessage(conversation, text);
      
//       console.log('✅ Message sent successfully:', sentMessage);
      
//       // Replace optimistic message with real one
//       setMessages(prev =>
//         prev.map(msg =>
//           msg._optimistic && msg.content === text ? sentMessage : msg
//         )
//       );
//     } catch (error) {
//       console.error('❌ Failed to send message:', error);
//       console.error('Error details:', {
//         message: error.message,
//         response: error.response,
//         stack: error.stack
//       });
      
//       // Remove optimistic message on error
//       setMessages(prev => prev.filter(msg => !msg._optimistic));
      
//       // Restore text
//       setMessageText(text);
      
//       // Show user-friendly error
//       const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
//       alert(`Failed to send message: ${errorMessage}. Please try again.`);
//     } finally {
//       setSending(false);
//       console.log('🏁 Send complete');
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
//       e.stopPropagation();
//       handleSend(e);
//     }
//   };

//   // Handle close conversation
//   const handleCloseConversation = async () => {
//     if (window.confirm('Are you sure you want to close this conversation?')) {
//       try {
//         await api.closeConversation(conversation.id);
//         if (onClose) onClose();
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
//             type="button"
//           >
//             ℹ️
//           </button>
//           <button
//             className="icon-btn"
//             onClick={handleCloseConversation}
//             title="Close conversation"
//             type="button"
//           >
//             ✓
//           </button>
//           <button className="icon-btn" title="More options" type="button">
//             ⋮
//           </button>
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
//                     key={message.id || `msg-${index}`}
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
//           <button className="attach-btn" title="Attach file" type="button">
//             📎
//           </button>
//         </div>
//         <button
//           className="send-btn"
//           onClick={handleSend}
//           disabled={!messageText.trim() || sending}
//           title="Send message (Enter)"
//           type="button"
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
 * Now with WebSocket support for real-time messaging
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
  const [wsConnected, setWsConnected] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const wsRef = useRef(null);
  const displayedMessageIds = useRef(new Set()); // Track displayed messages
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // 🔌 WebSocket Connection
  useEffect(() => {
    if (!conversation) {
      // Clean up WebSocket if no conversation
      disconnectWebSocket();
      return;
    }

    console.log('🔌 Setting up WebSocket for conversation:', conversation.id);
    connectWebSocket();

    // Cleanup on unmount or conversation change
    return () => {
      console.log('🧹 Cleaning up WebSocket');
      disconnectWebSocket();
    };
  }, [conversation?.id]);

  // Connect to WebSocket
  const connectWebSocket = () => {
    if (!conversation) return;

    try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setWsConnected(true);
        reconnectAttempts.current = 0;
        
        // Join conversation room
        const joinMessage = {
          type: 'join_conversation',
          conversationId: conversation.id,
          role: 'agent',
          employeeName: employeeName
        };
        
        console.log('📤 Sending join message:', joinMessage);
        ws.send(JSON.stringify(joinMessage));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error, event.data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setWsConnected(false);
      };
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', event.code, event.reason);
        setWsConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect if conversation still exists
        if (conversation && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached');
        }
      };
      
      wsRef.current = ws;
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setWsConnected(false);
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      console.log('🔌 Closing WebSocket connection');
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setWsConnected(false);
    reconnectAttempts.current = 0;
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    console.log('🔍 Processing WebSocket message type:', data.type);
    
    switch (data.type) {
      case 'connected':
      case 'auth_ok':
      case 'authenticated':
        console.log('✅ WebSocket authenticated');
        break;
        
      case 'joined':
      case 'join_ok':
        console.log('✅ Joined conversation room');
        break;
        
      case 'new_message':
        if (data.message) {
          handleIncomingMessage(data.message);
        }
        break;
        
      case 'typing':
      case 'customer_typing':
        if (data.senderType === 'customer' || data.isTyping !== undefined) {
          handleTypingIndicator(data);
        }
        break;
        
      case 'error':
        console.error('❌ WebSocket error:', data.message);
        break;
        
      default:
        console.log('📨 Unhandled WebSocket message type:', data.type);
    }
  };

  // Handle incoming message from WebSocket
  const handleIncomingMessage = (message) => {
    console.log('💬 Handling incoming message:', message);
    
    // Normalize message format (handle both camelCase and snake_case)
    const normalizedMessage = {
      id: message.id,
      conversationId: message.conversationId || message.conversation_id,
      senderType: message.senderType || message.sender_type,
      senderName: message.senderName || message.sender_name,
      senderId: message.senderId || message.sender_id,
      content: message.content,
      createdAt: message.createdAt || message.created_at || message.sentAt || message.sent_at,
      messageType: message.messageType || message.message_type || 'text'
    };
    
    // Verify this message belongs to current conversation
    if (normalizedMessage.conversationId && 
        normalizedMessage.conversationId !== conversation.id) {
      console.log('⏭️ Message is for different conversation, skipping');
      return;
    }
    
    // Check if we've already displayed this message
    if (displayedMessageIds.current.has(normalizedMessage.id)) {
      console.log('⏭️ Message already displayed, skipping duplicate');
      return;
    }
    
    // Don't add agent's own messages (already shown optimistically)
    if (normalizedMessage.senderType === 'agent' && 
        normalizedMessage.senderName === employeeName) {
      console.log('⏭️ Skipping own message (already displayed optimistically)');
      displayedMessageIds.current.add(normalizedMessage.id);
      return;
    }
    
    console.log('✅ Adding new message to state');
    
    // Mark as displayed
    displayedMessageIds.current.add(normalizedMessage.id);
    
    // Add to messages state
    setMessages(prev => {
      // Check if message already exists (double-check)
      const exists = prev.some(m => m.id === normalizedMessage.id);
      if (exists) {
        console.log('⏭️ Message already in state');
        return prev;
      }
      return [...prev, normalizedMessage];
    });
    
    // Hide typing indicator if customer sent a message
    if (normalizedMessage.senderType === 'customer') {
      setTypingUsers(new Set());
    }
  };

  // Handle typing indicator
  const handleTypingIndicator = (data) => {
    const isTyping = data.isTyping !== undefined ? data.isTyping : data.typing;
    const senderName = data.senderName || data.sender_name || 'Customer';
    
    console.log('⌨️ Typing indicator:', { senderName, isTyping });
    
    setTypingUsers(prev => {
      const newSet = new Set(prev);
      if (isTyping) {
        newSet.add(senderName);
      } else {
        newSet.delete(senderName);
      }
      return newSet;
    });
    
    // Auto-hide typing indicator after 5 seconds
    if (isTyping) {
      setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(senderName);
          return newSet;
        });
      }, 5000);
    }
  };

  // Send typing indicator via WebSocket
  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversationId: conversation.id,
        senderType: 'agent',
        senderName: employeeName,
        isTyping
      }));
    }
  };

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation) {
      console.log('🔄 Loading messages for conversation:', conversation.id);
      displayedMessageIds.current.clear(); // Clear tracking when loading new conversation
      loadMessages();
    } else {
      setMessages([]);
      setLoading(false);
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
      const messageArray = Array.isArray(data) ? data : [];
      
      console.log(`✅ Loaded ${messageArray.length} messages`);
      
      // Track all loaded message IDs
      messageArray.forEach(msg => {
        if (msg.id) {
          displayedMessageIds.current.add(msg.id);
        }
      });
      
      setMessages(messageArray);
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      setMessages([]);
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

    console.log('🚀 Sending message...', { messageText, sending });

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

    // Stop typing indicator
    sendTypingIndicator(false);

    // Optimistic UI update
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      senderType: 'agent',
      senderName: employeeName || 'Agent',
      content: text,
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      _optimistic: true,
    };

    console.log('📝 Adding optimistic message');
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      console.log('📤 Calling onSendMessage...');
      
      // Send to backend
      const sentMessage = await onSendMessage(conversation, text);
      
      console.log('✅ Message sent successfully:', sentMessage);
      
      // Mark real message as displayed
      if (sentMessage.id) {
        displayedMessageIds.current.add(sentMessage.id);
      }
      
      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(msg =>
          msg._optimistic && msg.content === text ? sentMessage : msg
        )
      );
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      
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

    // Send typing indicator via WebSocket
    sendTypingIndicator(true);

    // Also send via onTyping prop if provided
    if (onTyping) {
      onTyping(true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to send "stopped typing"
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
      if (onTyping) {
        onTyping(false);
      }
    }, 2000);
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
              {wsConnected && (
                <span style={{ color: '#48bb78', marginLeft: '8px' }} title="WebSocket connected">
                  ●
                </span>
              )}
              {!wsConnected && conversation && (
                <span style={{ color: '#fc8181', marginLeft: '8px' }} title="WebSocket disconnected">
                  ●
                </span>
              )}
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
                      <span>{Array.from(typingUsers).join(', ')} typing</span>
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