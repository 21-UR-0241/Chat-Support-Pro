
// import React, { useState, useEffect, useRef } from 'react';
// import { formatDistanceToNow } from 'date-fns';
// import api from "../services/api";
// import MessageBubble from './MessageBubble';
// import CustomerInfo from './CustomerInfo';
// import '../styles/ChatWindow.css';

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
//   const [showDeleteModal, setShowDeleteModal] = useState(false);
//   const [deleting, setDeleting] = useState(false);
  
//   // Template states
//   const [showTemplates, setShowTemplates] = useState(false);
//   const [templates, setTemplates] = useState([]);
//   const [showTemplateModal, setShowTemplateModal] = useState(false);
//   const [editingTemplate, setEditingTemplate] = useState(null);
//   const [templateName, setTemplateName] = useState('');
//   const [templateContent, setTemplateContent] = useState('');
//   const [templateLoading, setTemplateLoading] = useState(false);
//   const [dropdownPosition, setDropdownPosition] = useState({ bottom: 70, left: 16, right: 16 });
  
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
//   const activeNotificationsRef = useRef(new Map());
//   const inputContainerRef = useRef(null); // Add ref for input container

//   // Load templates from database on mount
//   useEffect(() => {
//     console.log('🔄 ChatWindow mounted, loading templates...');
//     loadTemplates();
//   }, []);

//   // Calculate dropdown position when it opens
//   useEffect(() => {
//     if (showTemplates && inputContainerRef.current) {
//       const rect = inputContainerRef.current.getBoundingClientRect();
//       setDropdownPosition({
//         bottom: window.innerHeight - rect.top + 8, // 8px gap above input
//         left: Math.max(16, rect.left),
//         right: Math.max(16, window.innerWidth - rect.right),
//       });
//     }
//   }, [showTemplates]);

//   const loadTemplates = async () => {
//     try {
//       console.log('📋 [loadTemplates] Fetching templates from API...');
//       const data = await api.getTemplates();
//       console.log('✅ [loadTemplates] Templates received:', data);
//       setTemplates(Array.isArray(data) ? data : []);
//     } catch (error) {
//       console.error('❌ [loadTemplates] Failed to load templates:', error);
//       setTemplates([]);
//     }
//   };

//   // ... (keep all your existing functions - I'll only show the return statement changes)

//   const handleAddTemplate = (e) => {
//     if (e) {
//       e.preventDefault();
//       e.stopPropagation();
//     }
//     console.log('📝 [handleAddTemplate] Opening modal');
//     setEditingTemplate(null);
//     setTemplateName('');
//     setTemplateContent('');
//     setShowTemplates(false);
//     setShowTemplateModal(true);
//   };

//   const handleEditTemplate = (template, e) => {
//     if (e) {
//       e.preventDefault();
//       e.stopPropagation();
//     }
//     console.log('✏️ [handleEditTemplate] Editing template:', template);
//     setEditingTemplate(template);
//     setTemplateName(template.name || '');
//     setTemplateContent(template.content || '');
//     setShowTemplates(false);
//     setShowTemplateModal(true);
//   };

//   const handleSaveTemplate = async (e) => {
//     if (e) {
//       e.preventDefault();
//       e.stopPropagation();
//     }

//     console.log('💾 [handleSaveTemplate] Saving...');

//     const trimmedName = templateName.trim();
//     const trimmedContent = templateContent.trim();

//     if (!trimmedName || !trimmedContent) {
//       alert('Please fill in both template name and content');
//       return;
//     }

//     try {
//       setTemplateLoading(true);
      
//       if (editingTemplate) {
//         const updated = await api.updateTemplate(editingTemplate.id, {
//           name: trimmedName,
//           content: trimmedContent,
//         });
        
//         setTemplates(prev =>
//           prev.map(t => t.id === editingTemplate.id ? updated : t)
//         );
//       } else {
//         const newTemplate = await api.createTemplate({
//           name: trimmedName,
//           content: trimmedContent,
//         });
        
//         setTemplates(prev => [...prev, newTemplate]);
//       }

//       setShowTemplateModal(false);
//       setTemplateName('');
//       setTemplateContent('');
//       setEditingTemplate(null);
      
//       console.log('✅ [handleSaveTemplate] Template saved successfully');
      
//     } catch (error) {
//       console.error('❌ [handleSaveTemplate] Error:', error);
//       alert(`Failed to save template: ${error.message || 'Please try again.'}`);
//     } finally {
//       setTemplateLoading(false);
//     }
//   };

//   const handleDeleteTemplate = async (templateId, e) => {
//     if (e) {
//       e.preventDefault();
//       e.stopPropagation();
//     }

//     if (!window.confirm('Are you sure you want to delete this template?')) {
//       return;
//     }

//     try {
//       await api.deleteTemplate(templateId);
//       setTemplates(prev => prev.filter(t => t.id !== templateId));
//       console.log('✅ Template deleted');
//     } catch (error) {
//       console.error('❌ Failed to delete template:', error);
//       alert('Failed to delete template. Please try again.');
//     }
//   };

//   const handleUseTemplate = (template) => {
//     console.log('✨ Using template:', template.name);
//     setMessageText(template.content);
//     setShowTemplates(false);
//     if (textareaRef.current) {
//       textareaRef.current.focus();
//     }
//   };

//   const handleCancelTemplateModal = () => {
//     if (!templateLoading) {
//       setShowTemplateModal(false);
//       setTemplateName('');
//       setTemplateContent('');
//       setEditingTemplate(null);
//     }
//   };

//   // ... (keep all your WebSocket and other functions - they remain unchanged)
//   // I'm skipping them for brevity, but keep everything from connectWebSocket to getGroupedMessages

//   // ... (all other functions remain the same)

//   // Keeping only the essential WebSocket functions for brevity
//   const connectWebSocket = () => {
//     // ... keep your existing code
//   };

//   const disconnectWebSocket = () => {
//     // ... keep your existing code
//   };

//   const handleWebSocketMessage = (data) => {
//     // ... keep your existing code
//   };

//   const handleIncomingMessage = (message) => {
//     // ... keep your existing code
//   };

//   const showNotification = (message) => {
//     // ... keep your existing code
//   };

//   const createNotification = (message) => {
//     // ... keep your existing code
//   };

//   const removeNotificationFromTracking = (conversationId, notification) => {
//     // ... keep your existing code
//   };

//   const clearAllNotifications = (conversationId) => {
//     // ... keep your existing code
//   };

//   const playNotificationSound = () => {
//     // ... keep your existing code
//   };

//   const handleTypingIndicator = (data) => {
//     // ... keep your existing code
//   };

//   const sendTypingIndicator = (isTyping) => {
//     // ... keep your existing code
//   };

//   // Keep all useEffect hooks
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

//   useEffect(() => {
//     return () => {
//       if (conversation?.id) {
//         clearAllNotifications(conversation.id);
//       }
//     };
//   }, [conversation?.id]);

//   useEffect(() => {
//     if (conversation) {
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
//     clearAllNotifications(conversation.id);

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

//   const handleDeleteClick = () => {
//     setShowDeleteModal(true);
//   };

//   const handleCancelDelete = () => {
//     setShowDeleteModal(false);
//   };

//   const handleConfirmDelete = async () => {
//     try {
//       setDeleting(true);
//       await api.closeConversation(conversation.id);
//       setShowDeleteModal(false);
//       if (onClose) onClose();
//     } catch (error) {
//       console.error('Failed to delete conversation:', error);
//       alert('Failed to delete conversation. Please try again.');
//     } finally {
//       setDeleting(false);
//     }
//   };

//   const handleBackClick = () => {
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
//       {/* ... Header remains the same ... */}
//       <div className="chat-header">
//         <div className="chat-header-left">
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
//               {storeName && (
//                 <span className="store-info">
//                   <strong>{storeName}</strong>
//                   <span className="store-domain-mobile">
//                     {storeDomain && ` • ${storeDomain}`}
//                   </span>
//                 </span>
//               )}
//               <span className="customer-email-desktop">
//                 {storeName && ' • '}
//                 {conversation.customerEmail || 'No email'}
//               </span>
//               <span 
//                 style={{ 
//                   color: wsConnected ? '#48bb78' : '#fc8181', 
//                   marginLeft: '8px' 
//                 }} 
//                 title={wsConnected ? 'Connected' : 'Disconnected'}
//               >
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
//             className="icon-btn delete-btn"
//             onClick={handleDeleteClick}
//             title="Delete conversation"
//             type="button"
//           >
//             🗑️
//           </button>
//         </div>
//       </div>

//       {/* Delete Modal - remains the same */}
//       {showDeleteModal && (
//         <div className="modal-overlay" onClick={handleCancelDelete}>
//           <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
//             <div className="modal-header">
//               <h3>🗑️ Delete Conversation</h3>
//             </div>
//             <div className="modal-body">
//               <p>Are you sure you want to delete this conversation?</p>
//               <div className="delete-warning">
//                 <p><strong>Customer:</strong> {conversation.customerName || 'Guest'}</p>
//                 <p><strong>Store:</strong> {storeName}</p>
//                 <p className="warning-text">⚠️ This action cannot be undone. All messages will be permanently deleted.</p>
//               </div>
//             </div>
//             <div className="modal-footer">
//               <button 
//                 className="btn-cancel" 
//                 onClick={handleCancelDelete}
//                 disabled={deleting}
//                 type="button"
//               >
//                 Cancel
//               </button>
//               <button 
//                 className="btn-delete" 
//                 onClick={handleConfirmDelete}
//                 disabled={deleting}
//                 type="button"
//               >
//                 {deleting ? 'Deleting...' : 'Yes, Delete'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Template Modal - remains the same */}
//       {showTemplateModal && (
//         <div 
//           className="modal-overlay" 
//           onClick={handleCancelTemplateModal}
//           style={{ 
//             position: 'fixed',
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             backgroundColor: 'rgba(0, 0, 0, 0.5)',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             zIndex: 10000
//           }}
//         >
//           <div 
//             className="modal-content template-modal" 
//             onClick={(e) => e.stopPropagation()}
//             style={{
//               backgroundColor: 'white',
//               padding: '20px',
//               borderRadius: '8px',
//               maxWidth: '500px',
//               width: '90%',
//               maxHeight: '90vh',
//               overflow: 'auto'
//             }}
//           >
//             <div className="modal-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//               <h3 style={{ margin: 0 }}>📝 {editingTemplate ? 'Edit Template' : 'New Template'}</h3>
//               <button
//                 onClick={handleCancelTemplateModal}
//                 disabled={templateLoading}
//                 type="button"
//                 style={{
//                   background: 'none',
//                   border: 'none',
//                   fontSize: '24px',
//                   cursor: 'pointer',
//                   padding: '0 8px'
//                 }}
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="modal-body" style={{ marginBottom: '20px' }}>
//               <div className="form-group" style={{ marginBottom: '15px' }}>
//                 <label htmlFor="template-name" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
//                   Template Name
//                 </label>
//                 <input
//                   id="template-name"
//                   type="text"
//                   placeholder="e.g., Greeting, Shipping Info"
//                   value={templateName}
//                   onChange={(e) => setTemplateName(e.target.value)}
//                   disabled={templateLoading}
//                   autoFocus
//                   style={{
//                     width: '100%',
//                     padding: '8px 12px',
//                     border: '1px solid #ccc',
//                     borderRadius: '4px',
//                     fontSize: '14px'
//                   }}
//                 />
//               </div>
//               <div className="form-group">
//                 <label htmlFor="template-content" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
//                   Template Content
//                 </label>
//                 <textarea
//                   id="template-content"
//                   placeholder="Enter your message template..."
//                   value={templateContent}
//                   onChange={(e) => setTemplateContent(e.target.value)}
//                   disabled={templateLoading}
//                   rows="6"
//                   style={{
//                     width: '100%',
//                     padding: '8px 12px',
//                     border: '1px solid #ccc',
//                     borderRadius: '4px',
//                     fontSize: '14px',
//                     resize: 'vertical',
//                     fontFamily: 'inherit'
//                   }}
//                 />
//               </div>
//             </div>
//             <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
//               <button 
//                 onClick={handleCancelTemplateModal}
//                 disabled={templateLoading}
//                 type="button"
//                 style={{
//                   padding: '8px 16px',
//                   border: '1px solid #ccc',
//                   backgroundColor: 'white',
//                   borderRadius: '4px',
//                   cursor: 'pointer'
//                 }}
//               >
//                 Cancel
//               </button>
//               <button 
//                 onClick={handleSaveTemplate}
//                 disabled={templateLoading || !templateName.trim() || !templateContent.trim()}
//                 type="button"
//                 style={{
//                   padding: '8px 16px',
//                   border: 'none',
//                   backgroundColor: (templateLoading || !templateName.trim() || !templateContent.trim()) ? '#ccc' : '#00a884',
//                   color: 'white',
//                   borderRadius: '4px',
//                   cursor: (templateLoading || !templateName.trim() || !templateContent.trim()) ? 'not-allowed' : 'pointer'
//                 }}
//               >
//                 {templateLoading ? 'Saving...' : (editingTemplate ? 'Update' : 'Save')} Template
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Content - remains the same */}
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

//         {showCustomerInfo && (
//           <CustomerInfo
//             conversation={conversation}
//             onClose={() => setShowCustomerInfo(false)}
//             stores={stores}
//           />
//         )}
//       </div>

//       {/* Templates Dropdown - UPDATED with dynamic positioning */}
//       {showTemplates && (
//         <div 
//           style={{
//             position: 'fixed',
//             bottom: `${dropdownPosition.bottom}px`,
//             left: `${dropdownPosition.left}px`,
//             right: `${dropdownPosition.right}px`,
//             maxWidth: '500px',
//             maxHeight: '400px',
//             background: 'white',
//             borderRadius: '12px',
//             boxShadow: '0 4px 20px rgba(11, 20, 26, 0.2)',
//             zIndex: 1000,
//             pointerEvents: 'auto',
//             overflowY: 'auto'
//           }}
//         >
//           <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9edef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
//             <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Quick Replies</h4>
//             <button
//               onClick={(e) => {
//                 e.preventDefault();
//                 e.stopPropagation();
//                 setShowTemplates(false);
//               }}
//               type="button"
//               style={{
//                 background: 'none',
//                 border: 'none',
//                 fontSize: '20px',
//                 cursor: 'pointer',
//                 padding: '4px 8px',
//                 color: '#54656f'
//               }}
//             >
//               ✕
//             </button>
//           </div>
//           <div style={{ padding: '8px' }}>
//             {templates.length === 0 ? (
//               <div style={{ padding: '40px 20px', textAlign: 'center' }}>
//                 <p style={{ marginBottom: '16px', color: '#667781' }}>No templates yet</p>
//                 <button
//                   onClick={(e) => {
//                     e.preventDefault();
//                     e.stopPropagation();
//                     handleAddTemplate(e);
//                   }}
//                   type="button"
//                   style={{
//                     padding: '10px 20px',
//                     border: 'none',
//                     background: '#00a884',
//                     color: 'white',
//                     borderRadius: '8px',
//                     fontSize: '14px',
//                     fontWeight: 600,
//                     cursor: 'pointer'
//                   }}
//                 >
//                   + Create First Template
//                 </button>
//               </div>
//             ) : (
//               <>
//                 {templates.map(template => (
//                   <div 
//                     key={template.id} 
//                     style={{
//                       display: 'flex',
//                       gap: '8px',
//                       padding: '12px',
//                       borderRadius: '8px',
//                       marginBottom: '4px',
//                       cursor: 'pointer',
//                       transition: 'background 0.2s'
//                     }}
//                     onMouseEnter={(e) => e.currentTarget.style.background = '#f5f6f6'}
//                     onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
//                   >
//                     <div 
//                       style={{ flex: 1, minWidth: 0 }}
//                       onClick={() => handleUseTemplate(template)}
//                     >
//                       <div style={{ fontSize: '14px', fontWeight: 600, color: '#111b21', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                         {template.name}
//                       </div>
//                       <div style={{ fontSize: '13px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                         {template.content}
//                       </div>
//                     </div>
//                     <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
//                       <button
//                         onClick={(e) => handleEditTemplate(template, e)}
//                         title="Edit template"
//                         type="button"
//                         style={{
//                           width: '32px',
//                           height: '32px',
//                           border: 'none',
//                           background: 'transparent',
//                           borderRadius: '50%',
//                           cursor: 'pointer',
//                           fontSize: '16px'
//                         }}
//                       >
//                         ✏️
//                       </button>
//                       <button
//                         onClick={(e) => handleDeleteTemplate(template.id, e)}
//                         title="Delete template"
//                         type="button"
//                         style={{
//                           width: '32px',
//                           height: '32px',
//                           border: 'none',
//                           background: 'transparent',
//                           borderRadius: '50%',
//                           cursor: 'pointer',
//                           fontSize: '16px',
//                           color: '#ff4444'
//                         }}
//                       >
//                         🗑️
//                       </button>
//                     </div>
//                   </div>
//                 ))}
//                 <button
//                   onClick={(e) => {
//                     e.preventDefault();
//                     e.stopPropagation();
//                     handleAddTemplate(e);
//                   }}
//                   type="button"
//                   style={{
//                     padding: '12px',
//                     border: '2px dashed #e9edef',
//                     background: 'transparent',
//                     color: '#00a884',
//                     borderRadius: '8px',
//                     fontSize: '14px',
//                     fontWeight: 600,
//                     cursor: 'pointer',
//                     width: '100%',
//                     marginTop: '8px'
//                   }}
//                 >
//                   + Add New Template
//                 </button>
//               </>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Input - ADD REF HERE */}
//       <div className="chat-input-container" ref={inputContainerRef}>
//         <button
//           className="template-btn"
//           onClick={(e) => {
//             e.preventDefault();
//             e.stopPropagation();
//             console.log('📋 Template button clicked');
//             setShowTemplates(!showTemplates);
//           }}
//           title="Quick replies"
//           type="button"
//         >
//           📋
//         </button>
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
import api from "../services/api";
import MessageBubble from './MessageBubble';
import CustomerInfo from './CustomerInfo';
import '../styles/ChatWindow.css';

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // File upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Template states
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ bottom: 70, left: 16, right: 16 });
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const wsRef = useRef(null);
  const displayedMessageIds = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const hasAuthenticated = useRef(false);
  const hasJoined = useRef(false);
  const activeNotificationsRef = useRef(new Map());
  const inputContainerRef = useRef(null);

  // Load templates from database on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (showTemplates && inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect();
      setDropdownPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(16, rect.left),
        right: Math.max(16, window.innerWidth - rect.right),
      });
    }
  }, [showTemplates]);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    }
  };

  // File handling functions
  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview({
          type: 'image',
          url: e.target.result,
          name: file.name,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview({
        type: 'file',
        name: file.name,
        size: formatFileSize(file.size),
      });
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const uploadFileToBunny = async (file) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.uploadFile(formData, (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(percentCompleted);
      });

      return response;
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAddTemplate = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateContent('');
    setShowTemplates(false);
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setEditingTemplate(template);
    setTemplateName(template.name || '');
    setTemplateContent(template.content || '');
    setShowTemplates(false);
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const trimmedName = templateName.trim();
    const trimmedContent = templateContent.trim();

    if (!trimmedName || !trimmedContent) {
      alert('Please fill in both template name and content');
      return;
    }

    try {
      setTemplateLoading(true);
      
      if (editingTemplate) {
        const updated = await api.updateTemplate(editingTemplate.id, {
          name: trimmedName,
          content: trimmedContent,
        });
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t));
      } else {
        const newTemplate = await api.createTemplate({
          name: trimmedName,
          content: trimmedContent,
        });
        setTemplates(prev => [...prev, newTemplate]);
      }

      setShowTemplateModal(false);
      setTemplateName('');
      setTemplateContent('');
      setEditingTemplate(null);
    } catch (error) {
      console.error('Failed to save template:', error);
      alert(`Failed to save template: ${error.message || 'Please try again.'}`);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template. Please try again.');
    }
  };

  const handleUseTemplate = (template) => {
    setMessageText(template.content);
    setShowTemplates(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleCancelTemplateModal = () => {
    if (!templateLoading) {
      setShowTemplateModal(false);
      setTemplateName('');
      setTemplateContent('');
      setEditingTemplate(null);
    }
  };

  // ============ WEBSOCKET IMPLEMENTATION ============

  const getWsUrl = () => {
    const baseUrl = api.getBaseUrl ? api.getBaseUrl() : (process.env.REACT_APP_API_URL || window.location.origin);
    return baseUrl.replace(/^http/, 'ws') + '/ws';
  };

  const connectWebSocket = () => {
    // Clean up any existing connection
    disconnectWebSocket();
    
    if (!conversation?.id) return;

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ [WS] No auth token found');
      return;
    }

    try {
      const wsUrl = getWsUrl();
      console.log(`🔌 [WS] Connecting to ${wsUrl} for conversation ${conversation.id}...`);
      
      hasAuthenticated.current = false;
      hasJoined.current = false;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ [WS] Connected, authenticating...');
        reconnectAttempts.current = 0;
        
        // Step 1: Authenticate as agent
        ws.send(JSON.stringify({
          type: 'auth',
          token: token,
          clientType: 'agent'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('❌ [WS] Parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [WS] Error:', error);
        setWsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`🔌 [WS] Closed: ${event.code}`);
        setWsConnected(false);
        hasAuthenticated.current = false;
        hasJoined.current = false;
        wsRef.current = null;

        // Auto-reconnect if not intentional close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && conversation?.id) {
          reconnectAttempts.current++;
          const delay = Math.min(2000 * reconnectAttempts.current, 10000);
          console.log(`🔄 [WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('❌ [WS] Connection failed:', error);
      setWsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      hasAuthenticated.current = false;
      hasJoined.current = false;
      
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Component unmounting');
      }
    }
    
    setWsConnected(false);
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'connected':
        console.log('🔌 [WS] Server acknowledged connection');
        break;

      case 'auth_ok':
        console.log('✅ [WS] Authenticated as', data.role);
        hasAuthenticated.current = true;
        
        // Step 2: Join the conversation
        if (conversation?.id && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join_conversation',
            conversationId: parseInt(conversation.id),
            role: 'agent',
            employeeName: employeeName || 'Agent'
          }));
        }
        break;

      case 'joined':
        console.log('✅ [WS] Joined conversation', data.conversationId);
        hasJoined.current = true;
        setWsConnected(true);
        break;

      case 'new_message':
        if (data.message) {
          handleIncomingMessage(data.message);
        }
        break;

      case 'message_confirmed':
        if (data.tempId && data.message) {
          // Update optimistic message with confirmed data
          setMessages(prev => prev.map(msg => {
            if (msg.id === data.tempId || (msg._optimistic && msg.id === data.tempId)) {
              return {
                ...data.message,
                fileData: data.message.fileData || msg.fileData,
                fileUrl: data.message.fileUrl || msg.fileUrl,
                sending: false,
                _optimistic: false
              };
            }
            return msg;
          }));
          
          if (data.message.id) {
            displayedMessageIds.current.add(data.message.id);
          }
        }
        break;

      case 'message_failed':
        if (data.tempId) {
          setMessages(prev => prev.map(msg =>
            msg.id === data.tempId
              ? { ...msg, sending: false, failed: true, _optimistic: false }
              : msg
          ));
        }
        break;

      case 'typing':
        handleTypingIndicator(data);
        break;

      case 'customer_joined':
        console.log('👤 [WS] Customer joined:', data.customerName);
        break;

      case 'customer_left':
        console.log('👤 [WS] Customer left');
        setTypingUsers(new Set());
        break;

      case 'agent_joined':
        console.log('👤 [WS] Agent joined:', data.agentName);
        break;

      case 'conversation_read':
        console.log('✅ [WS] Conversation marked as read');
        break;

      case 'error':
        console.error('❌ [WS] Server error:', data.message);
        if (data.message && (data.message.includes('token') || data.message.includes('auth'))) {
          hasAuthenticated.current = false;
          hasJoined.current = false;
          setWsConnected(false);
        }
        break;

      case 'pong':
        break;

      default:
        console.log(`ℹ️ [WS] Unhandled message type: ${data.type}`);
    }
  };

  const handleIncomingMessage = (message) => {
    const msgId = message.id;
    const convId = message.conversationId || message.conversation_id;

    // Only handle messages for the current conversation
    if (convId && convId !== parseInt(conversation?.id)) {
      // Message is for a different conversation — show notification
      showNotification(message);
      return;
    }

    // Skip if already displayed
    if (msgId && displayedMessageIds.current.has(msgId)) {
      return;
    }

    // Skip our own agent messages (we already show them optimistically)
    if (message.senderType === 'agent' && message.senderName === employeeName) {
      if (msgId) displayedMessageIds.current.add(msgId);
      return;
    }

    if (msgId) displayedMessageIds.current.add(msgId);

    console.log('📨 [WS] New message from', message.senderType, ':', (message.content || '').substring(0, 50));

    setMessages(prev => {
      // Double-check it's not already in the list
      if (prev.some(m => m.id === msgId)) return prev;
      return [...prev, {
        ...message,
        sending: false,
        _optimistic: false
      }];
    });

    // Show notification if message is from customer
    if (message.senderType === 'customer') {
      showNotification(message);
    }
  };

  const showNotification = (message) => {
    if (!message || message.senderType === 'agent') return;

    // Play sound
    playNotificationSound();

    // Browser notification
    if (Notification.permission === 'granted') {
      createNotification(message);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          createNotification(message);
        }
      });
    }
  };

  const createNotification = (message) => {
    try {
      const senderName = message.senderName || message.customerName || 'Customer';
      const content = message.content || (message.fileData ? '📎 Sent a file' : 'New message');
      
      const notification = new Notification(`New message from ${senderName}`, {
        body: content.substring(0, 100),
        icon: '/favicon.ico',
        tag: `msg-${message.id || Date.now()}`,
        requireInteraction: false
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.warn('Notification failed:', error);
    }
  };

  const clearAllNotifications = (conversationId) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications) {
      notifications.forEach(n => {
        try { n.close(); } catch (e) {}
      });
      activeNotificationsRef.current.delete(conversationId);
    }
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      // Audio not available
    }
  };

  const handleTypingIndicator = (data) => {
    // Only show typing for customers, not other agents
    if (data.senderType === 'agent') return;
    
    const senderName = data.senderName || 'Customer';

    if (data.isTyping) {
      setTypingUsers(prev => new Set([...prev, senderName]));
      
      // Auto-clear after 5 seconds in case we miss the stop event
      setTimeout(() => {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(senderName);
          return next;
        });
      }, 5000);
    } else {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(senderName);
        return next;
      });
    }
  };

  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && conversation?.id && hasJoined.current) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversationId: parseInt(conversation.id),
        isTyping,
        senderType: 'agent',
        senderName: employeeName || 'Agent'
      }));
    }
  };

  // ============ EFFECTS ============

  useEffect(() => {
    if (!conversation) {
      disconnectWebSocket();
      return;
    }
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [conversation?.id, employeeName]);

  useEffect(() => {
    return () => {
      if (conversation?.id) {
        clearAllNotifications(conversation.id);
      }
    };
  }, [conversation?.id]);

  useEffect(() => {
    if (conversation) {
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

  // Keep-alive ping every 30 seconds
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    return () => clearInterval(pingInterval);
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await api.getMessages(conversation.id);
      const messageArray = Array.isArray(data) ? data : [];
      
      messageArray.forEach(msg => {
        if (msg.id) displayedMessageIds.current.add(msg.id);
      });
      
      setMessages(messageArray);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const hasText = messageText.trim();
    const hasFile = selectedFile;

    if ((!hasText && !hasFile) || sending || uploading) return;

    const text = messageText.trim();
    
    try {
      setSending(true);
      let fileUrl = null;
      let fileData = null;

      if (selectedFile) {
        const uploadResult = await uploadFileToBunny(selectedFile);
        fileUrl = uploadResult.url;
        fileData = {
          url: uploadResult.url,
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
        };
      }

      setMessageText('');
      handleRemoveFile();

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      sendTypingIndicator(false);

      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'agent',
        senderName: employeeName || 'Agent',
        content: text || '',
        fileUrl: fileUrl,
        fileData: fileData,
        createdAt: new Date().toISOString(),
        _optimistic: true,
        sending: true,
      };

      setMessages(prev => [...prev, optimisticMessage]);
      clearAllNotifications(conversation.id);

      const sentMessage = await onSendMessage(conversation, text, fileData);
      
      if (sentMessage.id) {
        displayedMessageIds.current.add(sentMessage.id);
      }
      
      const mergedMessage = {
        ...sentMessage,
        fileUrl: sentMessage.fileUrl || fileUrl,
        fileData: sentMessage.fileData || fileData,
        sending: false
      };
      
      setMessages(prev =>
        prev.map(msg =>
          msg._optimistic && msg.id === optimisticMessage.id
            ? mergedMessage
            : msg
        )
      );
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setMessages(prev => prev.filter(msg => !msg._optimistic));
      setMessageText(messageText);
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

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await api.closeConversation(conversation.id);
      setShowDeleteModal(false);
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBackClick = () => {
    if (onClose) onClose();
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

  const getGroupedMessages = () => {
    if (!messages || messages.length === 0) return [];

    return messages.map((message, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      
      const isFirstInGroup = !prevMessage || prevMessage.senderType !== message.senderType;
      const isLastInGroup = !nextMessage || nextMessage.senderType !== message.senderType;
      
      return { ...message, isFirstInGroup, isLastInGroup };
    });
  };

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
              {storeName && (
                <span className="store-info">
                  <strong>{storeName}</strong>
                  <span className="store-domain-mobile">
                    {storeDomain && ` • ${storeDomain}`}
                  </span>
                </span>
              )}
              <span className="customer-email-desktop">
                {storeName && ' • '}
                {conversation.customerEmail || 'No email'}
              </span>
              <span 
                style={{ 
                  color: wsConnected ? '#48bb78' : '#fc8181', 
                  marginLeft: '8px' 
                }} 
                title={wsConnected ? 'Connected' : 'Disconnected'}
              >
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
            className="icon-btn delete-btn"
            onClick={handleDeleteClick}
            title="Delete conversation"
            type="button"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑️ Delete Conversation</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this conversation?</p>
              <div className="delete-warning">
                <p><strong>Customer:</strong> {conversation.customerName || 'Guest'}</p>
                <p><strong>Store:</strong> {storeName}</p>
                <p className="warning-text">⚠️ This action cannot be undone. All messages will be permanently deleted.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelDelete} disabled={deleting} type="button">
                Cancel
              </button>
              <button className="btn-delete" onClick={handleConfirmDelete} disabled={deleting} type="button">
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div 
          className="modal-overlay" 
          onClick={handleCancelTemplateModal}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
        >
          <div 
            className="modal-content template-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}
          >
            <div className="modal-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>📝 {editingTemplate ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={handleCancelTemplateModal} disabled={templateLoading} type="button" style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0 8px' }}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ marginBottom: '20px' }}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label htmlFor="template-name" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Template Name
                </label>
                <input
                  id="template-name"
                  type="text"
                  placeholder="e.g., Greeting, Shipping Info"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  disabled={templateLoading}
                  autoFocus
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="template-content" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Template Content
                </label>
                <textarea
                  id="template-content"
                  placeholder="Enter your message template..."
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  disabled={templateLoading}
                  rows="6"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={handleCancelTemplateModal} disabled={templateLoading} type="button" style={{ padding: '8px 16px', border: '1px solid #ccc', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button 
                onClick={handleSaveTemplate}
                disabled={templateLoading || !templateName.trim() || !templateContent.trim()}
                type="button"
                style={{ padding: '8px 16px', border: 'none', backgroundColor: (templateLoading || !templateName.trim() || !templateContent.trim()) ? '#ccc' : '#00a884', color: 'white', borderRadius: '4px', cursor: (templateLoading || !templateName.trim() || !templateContent.trim()) ? 'not-allowed' : 'pointer' }}
              >
                {templateLoading ? 'Saving...' : (editingTemplate ? 'Update' : 'Save')} Template
              </button>
            </div>
          </div>
        </div>
      )}

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

        {showCustomerInfo && (
          <CustomerInfo
            conversation={conversation}
            onClose={() => setShowCustomerInfo(false)}
            stores={stores}
          />
        )}
      </div>

      {/* Templates Dropdown */}
      {showTemplates && (
        <div 
          style={{ position: 'fixed', bottom: `${dropdownPosition.bottom}px`, left: `${dropdownPosition.left}px`, right: `${dropdownPosition.right}px`, maxWidth: '500px', maxHeight: '400px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(11, 20, 26, 0.2)', zIndex: 1000, pointerEvents: 'auto', overflowY: 'auto' }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9edef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Quick Replies</h4>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTemplates(false); }} type="button" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', color: '#54656f' }}>
              ✕
            </button>
          </div>
          <div style={{ padding: '8px' }}>
            {templates.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ marginBottom: '16px', color: '#667781' }}>No templates yet</p>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddTemplate(e); }} type="button" style={{ padding: '10px 20px', border: 'none', background: '#00a884', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  + Create First Template
                </button>
              </div>
            ) : (
              <>
                {templates.map(template => (
                  <div 
                    key={template.id} 
                    style={{ display: 'flex', gap: '8px', padding: '12px', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f6f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => handleUseTemplate(template)}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111b21', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {template.name}
                      </div>
                      <div style={{ fontSize: '13px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {template.content}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                      <button onClick={(e) => handleEditTemplate(template, e)} title="Edit template" type="button" style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>
                        ✏️
                      </button>
                      <button onClick={(e) => handleDeleteTemplate(template.id, e)} title="Delete template" type="button" style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', color: '#ff4444' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddTemplate(e); }} type="button" style={{ padding: '12px', border: '2px dashed #e9edef', background: 'transparent', color: '#00a884', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: '8px' }}>
                  + Add New Template
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* File Preview */}
      {filePreview && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f5f6f6', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {filePreview.type === 'image' ? (
            <img src={filePreview.url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
          ) : (
            <div style={{ width: '60px', height: '60px', backgroundColor: '#00a884', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
              📎
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filePreview.name}
            </div>
            {filePreview.size && (
              <div style={{ fontSize: '12px', color: '#667781' }}>{filePreview.size}</div>
            )}
          </div>
          {uploading && (
            <div style={{ fontSize: '12px', color: '#00a884' }}>{uploadProgress}%</div>
          )}
          <button onClick={handleRemoveFile} disabled={uploading} type="button" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: uploading ? 'not-allowed' : 'pointer', color: '#667781', padding: '4px 8px' }}>
            ✕
          </button>
        </div>
      )}

      {/* Input Container */}
      <div className="chat-input-container" ref={inputContainerRef}>
        <button className="template-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTemplates(!showTemplates); }} title="Quick replies" type="button">
          📋
        </button>
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Type a message..."
            value={messageText}
            onChange={handleTyping}
            onKeyDown={handleKeyPress}
            rows="1"
            disabled={sending || uploading}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button className="attach-btn" onClick={handleAttachClick} disabled={uploading} title="Attach file" type="button">
            {uploading ? '⏳' : '📎'}
          </button>
        </div>
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
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