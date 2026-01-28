
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
//   onMenuToggle,
//   stores,
// }) {
//   const [messages, setMessages] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [messageText, setMessageText] = useState('');
//   const [sending, setSending] = useState(false);
//   const [typingUsers, setTypingUsers] = useState(new Set());
//   const [showCustomerInfo, setShowCustomerInfo] = useState(false);
//   const [wsConnected, setWsConnected] = useState(false);
  
//   const messagesEndRef = useRef(null);
//   const textareaRef = useRef(null);
//   const typingTimeoutRef = useRef(null);
//   const wsRef = useRef(null);
//   const displayedMessageIds = useRef(new Set());
//   const reconnectTimeoutRef = useRef(null);
//   const reconnectAttempts = useRef(0);
//   const maxReconnectAttempts = 5;
//   const hasAuthenticated = useRef(false);
//   const hasJoined = useRef(false);

//   // 🔌 WebSocket Connection
//   useEffect(() => {
//     if (!conversation) {
//       disconnectWebSocket();
//       return;
//     }

//     console.log('🔌 [ChatWindow] Setting up WebSocket for conversation:', conversation.id);
//     connectWebSocket();

//     return () => {
//       console.log('🧹 [ChatWindow] Cleaning up WebSocket');
//       disconnectWebSocket();
//     };
//   }, [conversation?.id, employeeName]);

//   // Connect to WebSocket
//   const connectWebSocket = () => {
//     if (!conversation) {
//       console.log('❌ [connectWebSocket] No conversation, aborting');
//       return;
//     }

//     try {
//       // Close existing connection
//       if (wsRef.current) {
//         console.log('🔌 [connectWebSocket] Closing existing connection');
//         wsRef.current.close();
//         wsRef.current = null;
//       }

//       // Reset flags
//       hasAuthenticated.current = false;
//       hasJoined.current = false;

//       // Get WebSocket URL from environment variable
//       const WS_URL = import.meta.env.VITE_WS_URL || 
//                      (import.meta.env.PROD 
//                        ? 'wss://chat-support-pro.onrender.com'
//                        : 'ws://localhost:3000');
      
//       console.log('🔌 [connectWebSocket] Connecting to:', WS_URL);
      
//       const ws = new WebSocket(WS_URL);
      
//       ws.onopen = () => {
//         console.log('✅ [WebSocket] Connection opened');
        
//         // Get auth token
//         const token = localStorage.getItem('token');
//         if (!token) {
//           console.error('❌ [WebSocket] No auth token found in localStorage');
//           ws.close();
//           return;
//         }
        
//         // Send authentication
//         const authMessage = {
//           type: 'auth',
//           token: token,
//           clientType: 'agent'
//         };
        
//         console.log('📤 [WebSocket] Sending auth message');
//         ws.send(JSON.stringify(authMessage));
//       };
      
//       ws.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
//           console.log('📨 [WebSocket] Message received:', data);
          
//           if (data.type === 'auth_ok') {
//             if (hasAuthenticated.current) {
//               console.log('⚠️ [WebSocket] Already authenticated, ignoring duplicate auth_ok');
//               return;
//             }
            
//             console.log('✅ [WebSocket] Authentication successful');
//             hasAuthenticated.current = true;
//             setWsConnected(true);
//             reconnectAttempts.current = 0;
            
//             // Send join message IMMEDIATELY (no timeout)
//             if (!hasJoined.current && conversation) {
//               const joinMessage = {
//                 type: 'join_conversation',
//                 conversationId: parseInt(conversation.id),
//                 role: 'agent',
//                 employeeName: employeeName || 'Agent'
//               };
              
//               console.log('📤 [WebSocket] Sending join_conversation message:', JSON.stringify(joinMessage));
//               ws.send(JSON.stringify(joinMessage));
//             }
            
//             return;
//           }
          
//           // Handle join confirmation
//           if (data.type === 'joined' || data.type === 'join_ok') {
//             if (hasJoined.current) {
//               console.log('⚠️ [WebSocket] Already joined, ignoring duplicate join confirmation');
//               return;
//             }
            
//             console.log('✅ [WebSocket] Successfully joined conversation:', conversation.id);
//             hasJoined.current = true;
//             return;
//           }
          
//           // Handle other messages
//           handleWebSocketMessage(data);
          
//         } catch (error) {
//           console.error('❌ [WebSocket] Failed to parse message:', error, event.data);
//         }
//       };
      
//       ws.onerror = (error) => {
//         console.error('❌ [WebSocket] Error:', error);
//         setWsConnected(false);
//       };
      
//       ws.onclose = (event) => {
//         console.log('🔌 [WebSocket] Disconnected - Code:', event.code, 'Reason:', event.reason);
//         setWsConnected(false);
//         wsRef.current = null;
//         hasAuthenticated.current = false;
//         hasJoined.current = false;
        
//         // Attempt to reconnect
//         if (conversation && reconnectAttempts.current < maxReconnectAttempts) {
//           reconnectAttempts.current++;
//           const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
//           console.log(`🔄 [WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
//           reconnectTimeoutRef.current = setTimeout(() => {
//             connectWebSocket();
//           }, delay);
//         } else if (reconnectAttempts.current >= maxReconnectAttempts) {
//           console.error('❌ [WebSocket] Max reconnection attempts reached');
//         }
//       };
      
//       wsRef.current = ws;
//       console.log('✅ [connectWebSocket] WebSocket reference stored');
      
//     } catch (error) {
//       console.error('❌ [connectWebSocket] Failed to create connection:', error);
//       setWsConnected(false);
//     }
//   };

//   // Disconnect WebSocket
//   const disconnectWebSocket = () => {
//     console.log('🔌 [disconnectWebSocket] Called');
    
//     if (reconnectTimeoutRef.current) {
//       clearTimeout(reconnectTimeoutRef.current);
//       reconnectTimeoutRef.current = null;
//     }
    
//     if (wsRef.current) {
//       const currentState = wsRef.current.readyState;
//       console.log('🔌 [disconnectWebSocket] Current WebSocket state:', currentState);
      
//       if (currentState === WebSocket.OPEN) {
//         console.log('📤 [disconnectWebSocket] Sending leave message');
//         try {
//           wsRef.current.send(JSON.stringify({
//             type: 'leave_conversation',
//             conversationId: conversation?.id
//           }));
//         } catch (error) {
//           console.error('❌ [disconnectWebSocket] Error sending leave message:', error);
//         }
        
//         setTimeout(() => {
//           if (wsRef.current) {
//             console.log('🔌 [disconnectWebSocket] Closing WebSocket');
//             wsRef.current.close();
//             wsRef.current = null;
//           }
//         }, 100);
//       } else {
//         wsRef.current.close();
//         wsRef.current = null;
//       }
//     }
    
//     setWsConnected(false);
//     reconnectAttempts.current = 0;
//     hasAuthenticated.current = false;
//     hasJoined.current = false;
//   };

//   // Handle WebSocket messages
//   const handleWebSocketMessage = (data) => {
//     switch (data.type) {
//       case 'connected':
//         console.log('✅ [handleWebSocketMessage] Connected');
//         break;
        
//       case 'new_message':
//         if (data.message) {
//           console.log('💬 [handleWebSocketMessage] New message:', data.message);
//           handleIncomingMessage(data.message);
//         }
//         break;
        
//       case 'typing':
//         handleTypingIndicator(data);
//         break;
        
//       case 'error':
//         console.error('❌ [handleWebSocketMessage] Error:', data.message);
//         break;
        
//       default:
//         console.log('📨 [handleWebSocketMessage] Unhandled type:', data.type);
//     }
//   };

//   // Handle incoming message
// const handleIncomingMessage = (message) => {
//   // ✅ ADD THIS DEBUG
//   console.log('🔍 [handleIncomingMessage] Raw message:', message);
//   console.log('🔍 [handleIncomingMessage] Current conversation.id:', conversation?.id);
//   console.log('🔍 [handleIncomingMessage] Employee name:', employeeName);
  
//   const normalizedMessage = {
//     id: message.id,
//     conversationId: message.conversationId || message.conversation_id,
//     senderType: message.senderType || message.sender_type,
//     senderName: message.senderName || message.sender_name,
//     content: message.content,
//     createdAt: message.createdAt || message.created_at || message.sentAt || message.sent_at,
//   };
  
//   // ✅ ADD THIS DEBUG
//   console.log('🔍 [handleIncomingMessage] Normalized message:', normalizedMessage);
//   console.log('🔍 [handleIncomingMessage] Conversation ID match?', normalizedMessage.conversationId === conversation.id);
  
//   if (normalizedMessage.conversationId && 
//       normalizedMessage.conversationId !== conversation.id) {
//     console.log('⏭️ [handleIncomingMessage] Wrong conversation - Expected:', conversation.id, 'Got:', normalizedMessage.conversationId);
//     return;
//   }
  
//   if (displayedMessageIds.current.has(normalizedMessage.id)) {
//     console.log('⏭️ [handleIncomingMessage] Duplicate message:', normalizedMessage.id);
//     return;
//   }
  
//   if (normalizedMessage.senderType === 'agent' && 
//       normalizedMessage.senderName === employeeName) {
//     console.log('⏭️ [handleIncomingMessage] Own message - senderName:', normalizedMessage.senderName, 'employeeName:', employeeName);
//     displayedMessageIds.current.add(normalizedMessage.id);
//     return;
//   }
  
//   console.log('✅ [handleIncomingMessage] Adding message to state');
//   displayedMessageIds.current.add(normalizedMessage.id);
  
//   setMessages(prev => {
//     const exists = prev.some(m => m.id === normalizedMessage.id);
//     if (exists) return prev;
//     return [...prev, normalizedMessage];
//   });
  
//   if (normalizedMessage.senderType === 'customer') {
//     setTypingUsers(new Set());
//   }
// };

//   // Handle typing indicator
//   const handleTypingIndicator = (data) => {
//     const isTyping = data.isTyping;
//     const senderName = data.senderName || data.sender_name || 'Customer';
    
//     console.log('⌨️ [handleTypingIndicator]:', { senderName, isTyping });
    
//     setTypingUsers(prev => {
//       const newSet = new Set(prev);
//       if (isTyping) {
//         newSet.add(senderName);
//       } else {
//         newSet.delete(senderName);
//       }
//       return newSet;
//     });
//   };

//   // Send typing indicator
//   const sendTypingIndicator = (isTyping) => {
//     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !hasJoined.current) {
//       console.log('⚠️ [sendTypingIndicator] Cannot send - wsState:', wsRef.current?.readyState, 'hasJoined:', hasJoined.current);
//       return;
//     }
    
//     const typingMessage = {
//       type: 'typing',
//       conversationId: conversation.id,
//       senderType: 'agent',
//       senderName: employeeName || 'Agent',
//       isTyping
//     };
    
//     console.log('📤 [sendTypingIndicator]:', typingMessage);
//     wsRef.current.send(JSON.stringify(typingMessage));
//   };

//   // Load messages
//   useEffect(() => {
//     if (conversation) {
//       console.log('🔄 [useEffect] Loading messages for:', conversation.id);
//       displayedMessageIds.current.clear();
//       loadMessages();
//     } else {
//       setMessages([]);
//       setLoading(false);
//     }
//   }, [conversation?.id]);

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   useEffect(() => {
//     if (textareaRef.current) {
//       textareaRef.current.style.height = 'auto';
//       textareaRef.current.style.height = 
//         Math.min(textareaRef.current.scrollHeight, 120) + 'px';
//     }
//   }, [messageText]);

//   const loadMessages = async () => {
//     try {
//       setLoading(true);
//       const data = await api.getMessages(conversation.id);
//       const messageArray = Array.isArray(data) ? data : [];
      
//       messageArray.forEach(msg => {
//         if (msg.id) displayedMessageIds.current.add(msg.id);
//       });
      
//       setMessages(messageArray);
//        console.log('🔍 [loadMessages] Messages set to state:', messageArray.length);
//     } catch (error) {
//       console.error('❌ Failed to load messages:', error);
//       setMessages([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   };

//   const handleSend = async (e) => {
//     if (e) {
//       e.preventDefault();
//       e.stopPropagation();
//     }

//     if (!messageText.trim() || sending) return;

//     const text = messageText.trim();
//     setMessageText('');
//     setSending(true);

//     if (textareaRef.current) {
//       textareaRef.current.style.height = 'auto';
//     }

//     sendTypingIndicator(false);

//     const optimisticMessage = {
//       id: `temp-${Date.now()}`,
//       conversationId: conversation.id,
//       senderType: 'agent',
//       senderName: employeeName || 'Agent',
//       content: text,
//       createdAt: new Date().toISOString(),
//       _optimistic: true,
//       sending: true,
//     };

//     setMessages(prev => [...prev, optimisticMessage]);

//     try {
//       const sentMessage = await onSendMessage(conversation, text);
      
//       if (sentMessage.id) {
//         displayedMessageIds.current.add(sentMessage.id);
//       }
      
//       setMessages(prev =>
//         prev.map(msg =>
//           msg._optimistic && msg.content === text 
//             ? { ...sentMessage, sending: false } 
//             : msg
//         )
//       );
//     } catch (error) {
//       console.error('❌ Failed to send message:', error);
//       setMessages(prev => prev.filter(msg => !msg._optimistic));
//       setMessageText(text);
//       alert(`Failed to send message: ${error.message}`);
//     } finally {
//       setSending(false);
//     }
//   };

//   const handleTyping = (e) => {
//     setMessageText(e.target.value);
//     sendTypingIndicator(true);

//     if (typingTimeoutRef.current) {
//       clearTimeout(typingTimeoutRef.current);
//     }

//     typingTimeoutRef.current = setTimeout(() => {
//       sendTypingIndicator(false);
//     }, 2000);
//   };

//   const handleKeyPress = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       handleSend(e);
//     }
//   };

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

//   // Handle back button (mobile) - onClose will be called
//   const handleBackClick = () => {
//     console.log('⬅️ [ChatWindow] Back button clicked');
//     if (onClose) {
//       onClose();
//     }
//   };

//   const getInitials = (name) => {
//     if (!name) return 'G';
//     return name
//       .split(' ')
//       .map((n) => n[0])
//       .join('')
//       .toUpperCase()
//       .slice(0, 2);
//   };

//   // Group messages for proper bubble display
//   const getGroupedMessages = () => {
//     if (!messages || messages.length === 0) return [];

//     return messages.map((message, index) => {
//       const prevMessage = index > 0 ? messages[index - 1] : null;
//       const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      
//       const isFirstInGroup = !prevMessage || 
//                             prevMessage.senderType !== message.senderType;
//       const isLastInGroup = !nextMessage || 
//                            nextMessage.senderType !== message.senderType;
      
//       return {
//         ...message,
//         isFirstInGroup,
//         isLastInGroup,
//       };
//     });
//   };

//   // ✅ Early return if no conversation - BEFORE accessing conversation properties
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

//   // ✅ Get store details AFTER null check
//   const getStoreDetails = () => {
//     if (!stores || !conversation) return null;
    
//     const store = stores.find(s =>
//       s.storeIdentifier === conversation.storeIdentifier ||
//       s.id === conversation.shopId
//     );
    
//     return store || null;
//   };

//   const storeDetails = getStoreDetails();
//   const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
//   const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || null;

//   const groupedMessages = getGroupedMessages();

//   return (
//     <div className="chat-window">
//       {/* Header */}
//       <div className="chat-header">
//         <div className="chat-header-left">
//           {/* Back button for mobile */}
//           <button 
//             className="chat-back-btn-mobile"
//             onClick={handleBackClick}
//             aria-label="Back to conversations"
//             type="button"
//           >
//             ←
//           </button>
          
//           <div className="chat-header-avatar">
//             {getInitials(conversation.customerName)}
//           </div>
          
//           <div className="chat-header-info">
//             <h3>{conversation.customerName || 'Guest'}</h3>
//             <div className="chat-header-subtitle">
//               {/* ✅ Store Name and Domain */}
//               {storeName && (
//                 <span className="store-info">
//                   <strong>{storeName}</strong>
//                   {storeDomain && ` (${storeDomain})`}
//                 </span>
//               )}
//               {storeName && ' • '}
//               {conversation.customerEmail || 'No email'}
//               <span style={{ 
//                 color: wsConnected ? '#48bb78' : '#fc8181', 
//                 marginLeft: '8px' 
//               }} title={wsConnected ? 'Connected' : 'Disconnected'}>
//                 ●
//               </span>
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

//       {/* Content */}
//       <div className="chat-content">
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
//               {/* Render grouped messages */}
//               {groupedMessages.map((message, index) => (
//                 <MessageBubble
//                   key={message.id || `msg-${index}`}
//                   message={message}
//                   isAgent={message.senderType === 'agent'}
//                   isCustomer={message.senderType === 'customer'}
//                   showAvatar={true}
//                   isFirstInGroup={message.isFirstInGroup}
//                   isLastInGroup={message.isLastInGroup}
//                   sending={message.sending || message._optimistic}
//                 />
//               ))}
              
//               {/* Typing indicator */}
//               {typingUsers.size > 0 && (
//                 <div className="typing-indicator">
//                   <div className="typing-indicator-avatar">
//                     {getInitials(Array.from(typingUsers)[0])}
//                   </div>
//                   <div className="typing-indicator-bubble">
//                     <div className="typing-dot"></div>
//                     <div className="typing-dot"></div>
//                     <div className="typing-dot"></div>
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
//             stores={stores} // ✅ Pass stores prop
//           />
//         )}
//       </div>

//       {/* Input */}
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
  onMenuToggle,
  stores,
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
  const displayedMessageIds = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const hasAuthenticated = useRef(false);
  const hasJoined = useRef(false);
  const activeNotificationsRef = useRef(new Map()); // ✅ Track active notifications

  // 🔌 WebSocket Connection
  useEffect(() => {
    if (!conversation) {
      disconnectWebSocket();
      return;
    }

    console.log('🔌 [ChatWindow] Setting up WebSocket for conversation:', conversation.id);
    connectWebSocket();

    return () => {
      console.log('🧹 [ChatWindow] Cleaning up WebSocket');
      disconnectWebSocket();
    };
  }, [conversation?.id, employeeName]);

  // ✅ Cleanup notifications when conversation changes
  useEffect(() => {
    return () => {
      if (conversation?.id) {
        clearAllNotifications(conversation.id);
      }
    };
  }, [conversation?.id]);

  // Connect to WebSocket
  const connectWebSocket = () => {
    if (!conversation) {
      console.log('❌ [connectWebSocket] No conversation, aborting');
      return;
    }

    try {
      // Close existing connection
      if (wsRef.current) {
        console.log('🔌 [connectWebSocket] Closing existing connection');
        wsRef.current.close();
        wsRef.current = null;
      }

      // Reset flags
      hasAuthenticated.current = false;
      hasJoined.current = false;

      // Get WebSocket URL from environment variable
      const WS_URL = import.meta.env.VITE_WS_URL || 
                     (import.meta.env.PROD 
                       ? 'wss://chat-support-pro.onrender.com'
                       : 'ws://localhost:3000');
      
      console.log('🔌 [connectWebSocket] Connecting to:', WS_URL);
      
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('✅ [WebSocket] Connection opened');
        
        // Get auth token
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('❌ [WebSocket] No auth token found in localStorage');
          ws.close();
          return;
        }
        
        // Send authentication
        const authMessage = {
          type: 'auth',
          token: token,
          clientType: 'agent'
        };
        
        console.log('📤 [WebSocket] Sending auth message');
        ws.send(JSON.stringify(authMessage));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 [WebSocket] Message received:', data);
          
          if (data.type === 'auth_ok') {
            if (hasAuthenticated.current) {
              console.log('⚠️ [WebSocket] Already authenticated, ignoring duplicate auth_ok');
              return;
            }
            
            console.log('✅ [WebSocket] Authentication successful');
            hasAuthenticated.current = true;
            setWsConnected(true);
            reconnectAttempts.current = 0;
            
            // Send join message IMMEDIATELY (no timeout)
            if (!hasJoined.current && conversation) {
              const joinMessage = {
                type: 'join_conversation',
                conversationId: parseInt(conversation.id),
                role: 'agent',
                employeeName: employeeName || 'Agent'
              };
              
              console.log('📤 [WebSocket] Sending join_conversation message:', JSON.stringify(joinMessage));
              ws.send(JSON.stringify(joinMessage));
            }
            
            return;
          }
          
          // Handle join confirmation
          if (data.type === 'joined' || data.type === 'join_ok') {
            if (hasJoined.current) {
              console.log('⚠️ [WebSocket] Already joined, ignoring duplicate join confirmation');
              return;
            }
            
            console.log('✅ [WebSocket] Successfully joined conversation:', conversation.id);
            hasJoined.current = true;
            return;
          }
          
          // Handle other messages
          handleWebSocketMessage(data);
          
        } catch (error) {
          console.error('❌ [WebSocket] Failed to parse message:', error, event.data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ [WebSocket] Error:', error);
        setWsConnected(false);
      };
      
      ws.onclose = (event) => {
        console.log('🔌 [WebSocket] Disconnected - Code:', event.code, 'Reason:', event.reason);
        setWsConnected(false);
        wsRef.current = null;
        hasAuthenticated.current = false;
        hasJoined.current = false;
        
        // Attempt to reconnect
        if (conversation && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
          console.log(`🔄 [WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('❌ [WebSocket] Max reconnection attempts reached');
        }
      };
      
      wsRef.current = ws;
      console.log('✅ [connectWebSocket] WebSocket reference stored');
      
    } catch (error) {
      console.error('❌ [connectWebSocket] Failed to create connection:', error);
      setWsConnected(false);
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    console.log('🔌 [disconnectWebSocket] Called');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      const currentState = wsRef.current.readyState;
      console.log('🔌 [disconnectWebSocket] Current WebSocket state:', currentState);
      
      if (currentState === WebSocket.OPEN) {
        console.log('📤 [disconnectWebSocket] Sending leave message');
        try {
          wsRef.current.send(JSON.stringify({
            type: 'leave_conversation',
            conversationId: conversation?.id
          }));
        } catch (error) {
          console.error('❌ [disconnectWebSocket] Error sending leave message:', error);
        }
        
        setTimeout(() => {
          if (wsRef.current) {
            console.log('🔌 [disconnectWebSocket] Closing WebSocket');
            wsRef.current.close();
            wsRef.current = null;
          }
        }, 100);
      } else {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
    
    setWsConnected(false);
    reconnectAttempts.current = 0;
    hasAuthenticated.current = false;
    hasJoined.current = false;
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'connected':
        console.log('✅ [handleWebSocketMessage] Connected');
        break;
        
      case 'new_message':
        if (data.message) {
          console.log('💬 [handleWebSocketMessage] New message:', data.message);
          handleIncomingMessage(data.message);
        }
        break;
        
      case 'typing':
        handleTypingIndicator(data);
        break;
        
      case 'error':
        console.error('❌ [handleWebSocketMessage] Error:', data.message);
        break;
        
      default:
        console.log('📨 [handleWebSocketMessage] Unhandled type:', data.type);
    }
  };

  // ✅ Handle incoming message with notification support
  const handleIncomingMessage = (message) => {
    console.log('🔍 [handleIncomingMessage] Raw message:', message);
    console.log('🔍 [handleIncomingMessage] Current conversation.id:', conversation?.id);
    console.log('🔍 [handleIncomingMessage] Employee name:', employeeName);
    
    const normalizedMessage = {
      id: message.id,
      conversationId: message.conversationId || message.conversation_id,
      senderType: message.senderType || message.sender_type,
      senderName: message.senderName || message.sender_name,
      content: message.content,
      createdAt: message.createdAt || message.created_at || message.sentAt || message.sent_at,
    };
    
    console.log('🔍 [handleIncomingMessage] Normalized message:', normalizedMessage);
    
    // ✅ FIXED: Strict conversation ID check
    if (!normalizedMessage.conversationId) {
      console.log('⏭️ [handleIncomingMessage] Missing conversationId, rejecting message');
      return;
    }
    
    if (normalizedMessage.conversationId !== conversation.id) {
      console.log('⏭️ [handleIncomingMessage] Wrong conversation - Expected:', conversation.id, 'Got:', normalizedMessage.conversationId);
      return;
    }
    
    // Check for duplicates
    if (displayedMessageIds.current.has(normalizedMessage.id)) {
      console.log('⏭️ [handleIncomingMessage] Duplicate message:', normalizedMessage.id);
      return;
    }
    
    // Skip own messages
    if (normalizedMessage.senderType === 'agent' && 
        normalizedMessage.senderName === employeeName) {
      console.log('⏭️ [handleIncomingMessage] Own message - senderName:', normalizedMessage.senderName, 'employeeName:', employeeName);
      displayedMessageIds.current.add(normalizedMessage.id);
      return;
    }
    
    console.log('✅ [handleIncomingMessage] Adding message to state');
    displayedMessageIds.current.add(normalizedMessage.id);
    
    setMessages(prev => {
      const exists = prev.some(m => m.id === normalizedMessage.id);
      if (exists) {
        console.log('⏭️ [handleIncomingMessage] Message already exists in state');
        return prev;
      }
      return [...prev, normalizedMessage];
    });
    
    // ✅ Handle notifications based on sender type
    if (normalizedMessage.senderType === 'customer') {
      setTypingUsers(new Set());
      
      // Show browser notification for customer messages
      showNotification(normalizedMessage);
      
      // Play notification sound (optional)
      playNotificationSound();
    } else if (normalizedMessage.senderType === 'agent') {
      // ✅ CLEAR ALL NOTIFICATIONS when any agent replies
      clearAllNotifications(normalizedMessage.conversationId);
      setTypingUsers(new Set());
      console.log('🔕 Cleared notifications - agent replied');
    }
  };

  // ✅ Show browser notification (customer messages only)
  const showNotification = (message) => {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
      console.log('⚠️ Browser does not support notifications');
      return;
    }
    
    // Check notification permission
    if (Notification.permission === "granted") {
      createNotification(message);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          createNotification(message);
        }
      });
    }
  };

  // ✅ Create notification
  const createNotification = (message) => {
    const title = `New message from ${message.senderName || 'Customer'}`;
    const options = {
      body: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      icon: '/notification-icon.png', // Add your icon path
      badge: '/badge-icon.png', // Optional badge icon
      tag: `msg-${message.conversationId}`, // Use conversationId as tag to replace notifications
      requireInteraction: false,
      silent: false,
    };
    
    try {
      const notification = new Notification(title, options);
      
      // Store notification reference by conversation ID
      if (!activeNotificationsRef.current.has(message.conversationId)) {
        activeNotificationsRef.current.set(message.conversationId, []);
      }
      activeNotificationsRef.current.get(message.conversationId).push(notification);
      
      // Click to focus window
      notification.onclick = () => {
        window.focus();
        notification.close();
        removeNotificationFromTracking(message.conversationId, notification);
      };
      
      // Remove from tracking when closed
      notification.onclose = () => {
        removeNotificationFromTracking(message.conversationId, notification);
      };
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      console.log('🔔 Notification shown for customer message');
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
    }
  };

  // ✅ Remove notification from tracking
  const removeNotificationFromTracking = (conversationId, notification) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications) {
      const index = notifications.indexOf(notification);
      if (index > -1) {
        notifications.splice(index, 1);
      }
      if (notifications.length === 0) {
        activeNotificationsRef.current.delete(conversationId);
      }
    }
  };

  // ✅ Clear all notifications for a conversation
  const clearAllNotifications = (conversationId) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications && notifications.length > 0) {
      console.log(`🔕 Closing ${notifications.length} notification(s) for conversation ${conversationId}`);
      notifications.forEach(notification => {
        try {
          notification.close();
        } catch (error) {
          console.error('Error closing notification:', error);
        }
      });
      activeNotificationsRef.current.delete(conversationId);
    }
  };

  // ✅ Play notification sound (optional)
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification-sound.mp3'); // Add your sound file
      audio.volume = 0.5; // 50% volume
      audio.play().catch(err => {
        console.log('⚠️ Could not play notification sound:', err);
      });
    } catch (error) {
      console.error('❌ Error playing notification sound:', error);
    }
  };

  // Handle typing indicator
  const handleTypingIndicator = (data) => {
    const isTyping = data.isTyping;
    const senderName = data.senderName || data.sender_name || 'Customer';
    
    console.log('⌨️ [handleTypingIndicator]:', { senderName, isTyping });
    
    setTypingUsers(prev => {
      const newSet = new Set(prev);
      if (isTyping) {
        newSet.add(senderName);
      } else {
        newSet.delete(senderName);
      }
      return newSet;
    });
  };

  // Send typing indicator
  const sendTypingIndicator = (isTyping) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !hasJoined.current) {
      console.log('⚠️ [sendTypingIndicator] Cannot send - wsState:', wsRef.current?.readyState, 'hasJoined:', hasJoined.current);
      return;
    }
    
    const typingMessage = {
      type: 'typing',
      conversationId: conversation.id,
      senderType: 'agent',
      senderName: employeeName || 'Agent',
      isTyping
    };
    
    console.log('📤 [sendTypingIndicator]:', typingMessage);
    wsRef.current.send(JSON.stringify(typingMessage));
  };

  // Load messages
  useEffect(() => {
    if (conversation) {
      console.log('🔄 [useEffect] Loading messages for:', conversation.id);
      displayedMessageIds.current.clear();
      loadMessages();
    } else {
      setMessages([]);
      setLoading(false);
    }
  }, [conversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = 
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await api.getMessages(conversation.id);
      const messageArray = Array.isArray(data) ? data : [];
      
      messageArray.forEach(msg => {
        if (msg.id) displayedMessageIds.current.add(msg.id);
      });
      
      setMessages(messageArray);
      console.log('🔍 [loadMessages] Messages set to state:', messageArray.length);
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    sendTypingIndicator(false);

    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      senderType: 'agent',
      senderName: employeeName || 'Agent',
      content: text,
      createdAt: new Date().toISOString(),
      _optimistic: true,
      sending: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // ✅ Clear notifications immediately when agent sends message
    clearAllNotifications(conversation.id);
    console.log('🔕 Cleared notifications - you replied');

    try {
      const sentMessage = await onSendMessage(conversation, text);
      
      if (sentMessage.id) {
        displayedMessageIds.current.add(sentMessage.id);
      }
      
      setMessages(prev =>
        prev.map(msg =>
          msg._optimistic && msg.content === text 
            ? { ...sentMessage, sending: false } 
            : msg
        )
      );
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setMessages(prev => prev.filter(msg => !msg._optimistic));
      setMessageText(text);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    sendTypingIndicator(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

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

  // Handle back button (mobile) - onClose will be called
  const handleBackClick = () => {
    console.log('⬅️ [ChatWindow] Back button clicked');
    if (onClose) {
      onClose();
    }
  };

  const getInitials = (name) => {
    if (!name) return 'G';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group messages for proper bubble display
  const getGroupedMessages = () => {
    if (!messages || messages.length === 0) return [];

    return messages.map((message, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      
      const isFirstInGroup = !prevMessage || 
                            prevMessage.senderType !== message.senderType;
      const isLastInGroup = !nextMessage || 
                           nextMessage.senderType !== message.senderType;
      
      return {
        ...message,
        isFirstInGroup,
        isLastInGroup,
      };
    });
  };

  // ✅ Early return if no conversation - BEFORE accessing conversation properties
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

  // ✅ Get store details AFTER null check
  const getStoreDetails = () => {
    if (!stores || !conversation) return null;
    
    const store = stores.find(s =>
      s.storeIdentifier === conversation.storeIdentifier ||
      s.id === conversation.shopId
    );
    
    return store || null;
  };

  const storeDetails = getStoreDetails();
  const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
  const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || null;

  const groupedMessages = getGroupedMessages();

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          {/* Back button for mobile */}
          <button 
            className="chat-back-btn-mobile"
            onClick={handleBackClick}
            aria-label="Back to conversations"
            type="button"
          >
            ←
          </button>
          
          <div className="chat-header-avatar">
            {getInitials(conversation.customerName)}
          </div>
          
          <div className="chat-header-info">
            <h3>{conversation.customerName || 'Guest'}</h3>
            <div className="chat-header-subtitle">
              {/* ✅ Store Name and Domain */}
              {storeName && (
                <span className="store-info">
                  <strong>{storeName}</strong>
                  {storeDomain && ` (${storeDomain})`}
                </span>
              )}
              {storeName && ' • '}
              {conversation.customerEmail || 'No email'}
              <span style={{ 
                color: wsConnected ? '#48bb78' : '#fc8181', 
                marginLeft: '8px' 
              }} title={wsConnected ? 'Connected' : 'Disconnected'}>
                ●
              </span>
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

      {/* Content */}
      <div className="chat-content">
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
              {/* Render grouped messages */}
              {groupedMessages.map((message, index) => (
                <MessageBubble
                  key={message.id || `msg-${index}`}
                  message={message}
                  isAgent={message.senderType === 'agent'}
                  isCustomer={message.senderType === 'customer'}
                  showAvatar={true}
                  isFirstInGroup={message.isFirstInGroup}
                  isLastInGroup={message.isLastInGroup}
                  sending={message.sending || message._optimistic}
                />
              ))}
              
              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="typing-indicator">
                  <div className="typing-indicator-avatar">
                    {getInitials(Array.from(typingUsers)[0])}
                  </div>
                  <div className="typing-indicator-bubble">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
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
            stores={stores}
          />
        )}
      </div>

      {/* Input */}
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