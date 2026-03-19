// import React, { useState, useEffect, useRef } from 'react';
// import { formatDistanceToNow } from 'date-fns';
// import api from "../services/api";
// import MessageBubble from './MessageBubble';
// import CustomerInfo from './CustomerInfo';
// import AISuggestions from './Aisuggestions';
// import QuickReplies from './Quickreplies';
// import '../styles/ChatWindow.css';

// // ============ EMOJI DATA ============
// const EMOJI_CATEGORIES = [
//   {
//     label: '😊 Smileys',
//     emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
//   },
//   {
//     label: '👋 People',
//     emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄'],
//   },
//   {
//     label: '❤️ Hearts',
//     emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🔕'],
//   },
//   {
//     label: '🎉 Celebration',
//     emojis: ['🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'],
//   },
// ];

// function EmojiPicker({ onSelect, onClose }) {
//   const [activeCategory, setActiveCategory] = useState(0);
//   const [search, setSearch] = useState('');
//   const pickerRef = useRef(null);

//   const filteredEmojis = search.trim()
//     ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
//     : EMOJI_CATEGORIES[activeCategory].emojis;

//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [onClose]);

//   return (
//     <div className="emoji-picker" ref={pickerRef}>
//       <div className="emoji-picker-search">
//         <input
//           type="text"
//           placeholder="Search emoji..."
//           value={search}
//           onChange={e => setSearch(e.target.value)}
//           className="emoji-search-input"
//           autoFocus
//         />
//       </div>
//       {!search && (
//         <div className="emoji-category-tabs">
//           {EMOJI_CATEGORIES.map((cat, i) => (
//             <button
//               key={i}
//               type="button"
//               className={`emoji-cat-tab${activeCategory === i ? ' active' : ''}`}
//               onClick={() => setActiveCategory(i)}
//               title={cat.label}
//             >
//               {cat.emojis[0]}
//             </button>
//           ))}
//         </div>
//       )}
//       <div className="emoji-grid">
//         {filteredEmojis.length > 0
//           ? filteredEmojis.map((emoji, i) => (
//               <button
//                 key={i}
//                 type="button"
//                 className="emoji-btn"
//                 onClick={() => { onSelect(emoji); }}
//               >
//                 {emoji}
//               </button>
//             ))
//           : <div className="emoji-no-results">No results</div>
//         }
//       </div>
//     </div>
//   );
// }

// // ============ HELPER: parse fileData safely ============
// const parseFileData = (raw) => {
//   if (!raw) return null;
//   if (typeof raw === 'object') return raw;
//   try { return JSON.parse(raw); } catch { return null; }
// };

// // ============ HELPER: normalize messages from server ============
// const normalizeMessage = (msg) => ({
//   ...msg,
//   fileData: parseFileData(msg.fileData || msg.file_data),
// });

// function ChatWindow({
//   conversation,
//   onSendMessage,
//   onClose,
//   onTyping,
//   employeeName,
//   onMenuToggle,
//   stores,
//   isAdmin = false,
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
//   const [showAISuggestions, setShowAISuggestions] = useState(true);

//   // Message delete state
//   const [messageToDelete, setMessageToDelete] = useState(null);
//   const [deletingMessage, setDeletingMessage] = useState(false);

//   // File upload states
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [filePreview, setFilePreview] = useState(null);
//   const [uploading, setUploading] = useState(false);
//   const [uploadProgress, setUploadProgress] = useState(0);

//   // Emoji picker state
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);

//   // Template / Quick Reply states
//   const [templates, setTemplates] = useState([]);
//   const [templateLoading, setTemplateLoading] = useState(false);
//   const [showQuickReplies, setShowQuickReplies] = useState(false);

//   // ============ LEGAL THREAT STATE ============
//   const [legalAlert, setLegalAlert] = useState(null);
//   const legalDismissTimerRef = useRef(null);

//   const messagesEndRef = useRef(null);
//   const textareaRef = useRef(null);
//   const fileInputRef = useRef(null);
//   const typingTimeoutRef = useRef(null);
//   const wsRef = useRef(null);
//   const displayedMessageIds = useRef(new Set());
//   const reconnectTimeoutRef = useRef(null);
//   const reconnectAttempts = useRef(0);
//   const maxReconnectAttempts = 5;
//   const hasAuthenticated = useRef(false);
//   const hasJoined = useRef(false);
//   const activeNotificationsRef = useRef(new Map());
//   const pollIntervalRef = useRef(null);

//   const conversationRef = useRef(conversation);
//   const employeeNameRef = useRef(employeeName);
//   const handleWsMessageRef = useRef(null);

//   useEffect(() => { loadTemplates(); }, []);
//   useEffect(() => { conversationRef.current = conversation; }, [conversation]);
//   useEffect(() => { employeeNameRef.current = employeeName; }, [employeeName]);

//   // Cleanup legal dismiss timer on unmount
//   useEffect(() => {
//     return () => {
//       if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//     };
//   }, []);

//   const loadTemplates = async () => {
//     try {
//       const data = await api.getTemplates();
//       setTemplates(Array.isArray(data) ? data : []);
//     } catch (error) {
//       console.error('Failed to load templates:', error);
//       setTemplates([]);
//     }
//   };

//   // ============ QUICK REPLY HANDLERS ============
//   const handleUseTemplate = (content) => {
//     setMessageText(content);
//     if (textareaRef.current) textareaRef.current.focus();
//   };

//   const handleAddQuickReply = async ({ name, content }) => {
//     const newTemplate = await api.createTemplate({ name, content });
//     setTemplates(prev => [...prev, newTemplate]);
//   };

//   const handleSaveQuickReply = async (templateId, { name, content }) => {
//     const updated = await api.updateTemplate(templateId, { name, content });
//     setTemplates(prev => prev.map(t => t.id === templateId ? updated : t));
//   };

//   const handleDeleteQuickReply = async (templateId) => {
//     await api.deleteTemplate(templateId);
//     setTemplates(prev => prev.filter(t => t.id !== templateId));
//   };

//   // ============ EMOJI HANDLER ============
//   const handleEmojiSelect = (emoji) => {
//     const textarea = textareaRef.current;
//     if (textarea) {
//       const start = textarea.selectionStart;
//       const end = textarea.selectionEnd;
//       const newText = messageText.slice(0, start) + emoji + messageText.slice(end);
//       setMessageText(newText);
//       setTimeout(() => {
//         textarea.focus();
//         textarea.selectionStart = start + emoji.length;
//         textarea.selectionEnd = start + emoji.length;
//       }, 0);
//     } else {
//       setMessageText(prev => prev + emoji);
//     }
//   };

//   // ============ MESSAGE DELETE HANDLERS ============
//   const handleDeleteMessageClick = (message) => { setMessageToDelete(message); };
//   const handleCancelMessageDelete = () => { setMessageToDelete(null); };

//   const handleConfirmMessageDelete = async () => {
//     if (!messageToDelete) return;
//     try {
//       setDeletingMessage(true);
//       await api.deleteMessage(messageToDelete.id);
//       displayedMessageIds.current.delete(String(messageToDelete.id));
//       setMessages(prev => prev.filter(m => String(m.id) !== String(messageToDelete.id)));
//       setMessageToDelete(null);
//     } catch (error) {
//       console.error('Failed to delete message:', error);
//       alert(`Failed to delete message: ${error.message}`);
//     } finally {
//       setDeletingMessage(false);
//     }
//   };

//   // ============ FILE HANDLING ============
//   const handleAttachClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

//   const handleFileSelect = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const maxSize = 10 * 1024 * 1024;
//     if (file.size > maxSize) { alert('File size must be less than 10MB'); return; }
//     setSelectedFile(file);
//     if (file.type.startsWith('image/')) {
//       const reader = new FileReader();
//       reader.onload = (e) => setFilePreview({ type: 'image', url: e.target.result, name: file.name });
//       reader.readAsDataURL(file);
//     } else {
//       setFilePreview({ type: 'file', name: file.name, size: formatFileSize(file.size) });
//     }
//   };

//   const handleRemoveFile = () => {
//     setSelectedFile(null);
//     setFilePreview(null);
//     if (fileInputRef.current) fileInputRef.current.value = '';
//   };

//   const formatFileSize = (bytes) => {
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
//   };

//   const uploadFileToBunny = async (file) => {
//     try {
//       setUploading(true);
//       setUploadProgress(0);
//       const formData = new FormData();
//       formData.append('file', file);
//       const response = await api.uploadFile(formData, (progressEvent) => {
//         setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
//       });
//       return response;
//     } catch (error) {
//       console.error('❌ File upload failed:', error);
//       throw error;
//     } finally {
//       setUploading(false);
//       setUploadProgress(0);
//     }
//   };

//   const handleSelectSuggestion = (suggestion) => {
//     setMessageText(suggestion);
//     if (textareaRef.current) {
//       textareaRef.current.focus();
//       setTimeout(() => {
//         if (textareaRef.current) {
//           textareaRef.current.style.height = 'auto';
//           textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
//         }
//       }, 0);
//     }
//   };

//   // ============ WEBSOCKET IMPLEMENTATION ============
//   const getWsUrl = () => {
//     let baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//     if (!baseUrl) baseUrl = window.location.origin;
//     baseUrl = baseUrl.replace(/\/$/, '');
//     return baseUrl.replace(/^http/, 'ws') + '/ws';
//   };

//   const connectWebSocket = () => {
//     disconnectWebSocket();
//     if (!conversationRef.current?.id) return;
//     const token = localStorage.getItem('token');
//     if (!token) { console.error('❌ [WS] No auth token found'); return; }
//     try {
//       const wsUrl = getWsUrl();
//       hasAuthenticated.current = false;
//       hasJoined.current = false;
//       const ws = new WebSocket(wsUrl);
//       wsRef.current = ws;
//       ws.onopen = () => {
//         reconnectAttempts.current = 0;
//         ws.send(JSON.stringify({ type: 'auth', token, clientType: 'agent' }));
//       };
//       ws.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
//           if (handleWsMessageRef.current) handleWsMessageRef.current(data);
//         } catch (error) { console.error('❌ [WS] Parse error:', error); }
//       };
//       ws.onerror = () => setWsConnected(false);
//       ws.onclose = (event) => {
//         setWsConnected(false);
//         hasAuthenticated.current = false;
//         hasJoined.current = false;
//         wsRef.current = null;
//         if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && conversationRef.current?.id) {
//           reconnectAttempts.current++;
//           const delay = Math.min(2000 * reconnectAttempts.current, 10000);
//           reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
//         }
//       };
//     } catch (error) {
//       console.error('❌ [WS] Connection failed:', error);
//       setWsConnected(false);
//     }
//   };

//   const disconnectWebSocket = () => {
//     if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
//     if (wsRef.current) {
//       const ws = wsRef.current;
//       wsRef.current = null;
//       hasAuthenticated.current = false;
//       hasJoined.current = false;
//       if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000, 'Component unmounting');
//     }
//     setWsConnected(false);
//   };

//   // ============ LEGAL ALERT HELPERS ============
//   const showLegalAlert = (alert) => {
//     // Clear any existing dismiss timer
//     if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//     setLegalAlert(alert);
//     // Auto-dismiss after 15 seconds
//     legalDismissTimerRef.current = setTimeout(() => setLegalAlert(null), 15000);
//   };

//   const dismissLegalAlert = () => {
//     if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//     setLegalAlert(null);
//   };

//   const handleWebSocketMessage = (data) => {
//     const currentConv = conversationRef.current;
//     const currentEmployeeName = employeeNameRef.current;

//     switch (data.type) {
//       case 'connected': break;

//       case 'auth_ok':
//         hasAuthenticated.current = true;
//         if (currentConv?.id && wsRef.current?.readyState === WebSocket.OPEN) {
//           wsRef.current.send(JSON.stringify({
//             type: 'join_conversation',
//             conversationId: parseInt(currentConv.id),
//             role: 'agent',
//             employeeName: currentEmployeeName || 'Agent'
//           }));
//         }
//         break;

//       case 'joined':
//         hasJoined.current = true;
//         setWsConnected(true);
//         break;

//       case 'new_message':
//         if (data.message) handleIncomingMessage(data.message, currentConv, currentEmployeeName);
//         break;

//       case 'message_confirmed':
//         if (data.tempId && data.message) {
//           const confirmedMsg = normalizeMessage(data.message);
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId)
//               ? { ...confirmedMsg, fileData: confirmedMsg.fileData || msg.fileData, fileUrl: confirmedMsg.fileUrl || msg.fileUrl, sending: false, _optimistic: false }
//               : msg
//           ));
//           if (data.message.id) displayedMessageIds.current.add(String(data.message.id));
//         }
//         break;

//       case 'message_failed':
//         if (data.tempId) {
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId)
//               ? { ...msg, sending: false, failed: true, _optimistic: false }
//               : msg
//           ));
//         }
//         break;

//       case 'message_deleted':
//         if (data.messageId) {
//           displayedMessageIds.current.delete(String(data.messageId));
//           setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
//         }
//         break;

//       case 'legal_threat_detected': {
//         const alert = data.alert;
//         if (!alert) break;

//         console.warn(`🚨 [LEGAL] ${alert.severity?.toUpperCase()} — "${alert.matchedTerm}" in conv #${alert.conversationId}`);

//         // Always play urgent double-ping for legal alerts
//         playNotificationSound();
//         setTimeout(() => playNotificationSound(), 400);

//         // Only show banner if currently viewing that conversation
//         if (String(alert.conversationId) === String(currentConv?.id)) {
//           showLegalAlert(alert);
//         } else {
//           // Show a browser notification for conversations not currently open
//           if (Notification.permission === 'granted') {
//             const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : '🔔';
//             try {
//               const n = new Notification(`${emoji} Legal Threat — Conv #${alert.conversationId}`, {
//                 body: `${alert.severity?.toUpperCase()}: "${alert.matchedTerm}" from ${alert.senderName}`,
//                 icon: '/favicon.ico',
//                 requireInteraction: alert.severity === 'critical',
//                 tag: `legal-${alert.conversationId}`,
//               });
//               n.onclick = () => { window.focus(); n.close(); };
//               if (alert.severity !== 'critical') setTimeout(() => n.close(), 8000);
//             } catch (e) {}
//           }
//         }
//         break;
//       }

//       case 'typing': handleTypingIndicator(data); break;

//       case 'customer_left': setTypingUsers(new Set()); break;

//       case 'error':
//         console.error('❌ [WS] Server error:', data.message);
//         if (data.message?.includes('token') || data.message?.includes('auth')) {
//           hasAuthenticated.current = false;
//           hasJoined.current = false;
//           setWsConnected(false);
//         }
//         break;

//       default: break;
//     }
//   };

//   handleWsMessageRef.current = handleWebSocketMessage;

//   const handleIncomingMessage = (message, currentConv, currentEmployeeName) => {
//     const msgId = message.id;
//     const convId = message.conversationId || message.conversation_id;

//     if (convId && String(convId) !== String(currentConv?.id)) { showNotification(message); return; }
//     if (msgId && displayedMessageIds.current.has(String(msgId))) return;

//     if (message.senderType === 'agent' && currentEmployeeName && message.senderName === currentEmployeeName) {
//       if (msgId) displayedMessageIds.current.add(String(msgId));
//       return;
//     }

//     if (msgId) displayedMessageIds.current.add(String(msgId));

//     const normalized = normalizeMessage(message);

//     setMessages(prev => {
//       if (prev.some(m => String(m.id) === String(msgId))) return prev;
//       return [...prev, { ...normalized, sending: false, _optimistic: false }];
//     });

//     if (message.senderType === 'customer') showNotification(message);
//   };

//   const showNotification = (message) => {
//     if (!message || message.senderType === 'agent') return;
//     playNotificationSound();
//     if (Notification.permission === 'granted') createNotification(message);
//     else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') createNotification(message); });
//   };

//   const createNotification = (message) => {
//     try {
//       const senderName = message.senderName || message.customerName || 'Customer';
//       const content = message.content || (message.fileData ? '📎 Sent a file' : 'New message');
//       const notification = new Notification(`New message from ${senderName}`, {
//         body: content.substring(0, 100),
//         icon: '/favicon.ico',
//         tag: `msg-${message.id || Date.now()}`,
//         requireInteraction: false
//       });
//       notification.onclick = () => { window.focus(); notification.close(); };
//       setTimeout(() => notification.close(), 5000);
//     } catch (error) { console.warn('Notification failed:', error); }
//   };

//   const clearAllNotifications = (conversationId) => {
//     const notifications = activeNotificationsRef.current.get(conversationId);
//     if (notifications) {
//       notifications.forEach(n => { try { n.close(); } catch (e) {} });
//       activeNotificationsRef.current.delete(conversationId);
//     }
//   };

//   const playNotificationSound = () => {
//     try {
//       const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//       const oscillator = audioContext.createOscillator();
//       const gainNode = audioContext.createGain();
//       oscillator.connect(gainNode);
//       gainNode.connect(audioContext.destination);
//       oscillator.frequency.value = 800;
//       oscillator.type = 'sine';
//       gainNode.gain.value = 0.1;
//       oscillator.start();
//       gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
//       oscillator.stop(audioContext.currentTime + 0.3);
//     } catch (error) {}
//   };

//   const handleTypingIndicator = (data) => {
//     if (data.senderType === 'agent') return;
//     const senderName = data.senderName || 'Customer';
//     if (data.isTyping) {
//       setTypingUsers(prev => new Set([...prev, senderName]));
//       setTimeout(() => setTypingUsers(prev => {
//         const next = new Set(prev); next.delete(senderName); return next;
//       }), 5000);
//     } else {
//       setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; });
//     }
//   };

//   const sendTypingIndicator = (isTyping) => {
//     if (wsRef.current?.readyState === WebSocket.OPEN && conversationRef.current?.id && hasJoined.current) {
//       wsRef.current.send(JSON.stringify({
//         type: 'typing',
//         conversationId: parseInt(conversationRef.current.id),
//         isTyping,
//         senderType: 'agent',
//         senderName: employeeNameRef.current || 'Agent'
//       }));
//     }
//   };

//   // ============ EFFECTS ============
//   useEffect(() => {
//     if (!conversation) { disconnectWebSocket(); return; }
//     connectWebSocket();
//     return () => disconnectWebSocket();
//   }, [conversation?.id, employeeName]);

//   useEffect(() => {
//     return () => { if (conversation?.id) clearAllNotifications(conversation.id); };
//   }, [conversation?.id]);

//   useEffect(() => {
//     if (conversation) { displayedMessageIds.current.clear(); loadMessages(); }
//     else { setMessages([]); setLoading(false); }
//     // Dismiss legal alert when switching conversations
//     dismissLegalAlert();
//   }, [conversation?.id]);

//   useEffect(() => { scrollToBottom(); }, [messages]);

//   useEffect(() => {
//     if (textareaRef.current) {
//       textareaRef.current.style.height = 'auto';
//       textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
//     }
//   }, [messageText]);

//   useEffect(() => {
//     const pingInterval = setInterval(() => {
//       if (wsRef.current?.readyState === WebSocket.OPEN) {
//         wsRef.current.send(JSON.stringify({ type: 'ping' }));
//       }
//     }, 30000);
//     return () => clearInterval(pingInterval);
//   }, []);

//   useEffect(() => {
//     if (!conversation?.id) { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); return; }
//     pollIntervalRef.current = setInterval(async () => {
//       try {
//         const data = await api.getMessages(conversation.id);
//         const serverMessages = (Array.isArray(data) ? data : []).map(normalizeMessage);
//         setMessages(prev => {
//           const existingIds = new Set(prev.map(m => String(m.id)));
//           const newMessages = serverMessages.filter(m => m.id && !existingIds.has(String(m.id)) && !displayedMessageIds.current.has(String(m.id)));
//           if (newMessages.length === 0) return prev;
//           newMessages.forEach(m => { if (m.id) displayedMessageIds.current.add(String(m.id)); });
//           let updated = prev.map(existing => {
//             if (!String(existing.id).startsWith('temp-')) return existing;
//             const confirmed = serverMessages.find(s =>
//               s.content === existing.content &&
//               s.senderType === existing.senderType &&
//               !existingIds.has(String(s.id))
//             );
//             if (confirmed) {
//               displayedMessageIds.current.add(String(confirmed.id));
//               return { ...confirmed, sending: false, _optimistic: false };
//             }
//             return existing;
//           });
//           return [...updated, ...newMessages.map(m => ({ ...m, sending: false, _optimistic: false }))];
//         });
//       } catch (error) {}
//     }, 5000);
//     return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
//   }, [conversation?.id]);

//   const loadMessages = async () => {
//     try {
//       setLoading(true);
//       const data = await api.getMessages(conversation.id);
//       const messageArray = (Array.isArray(data) ? data : []).map(normalizeMessage);
//       messageArray.forEach(msg => { if (msg.id) displayedMessageIds.current.add(String(msg.id)); });
//       setMessages(messageArray);
//     } catch (error) {
//       console.error('Failed to load messages:', error);
//       setMessages([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

//   const handleSend = async (e) => {
//     if (e) { e.preventDefault(); e.stopPropagation(); }
//     const hasText = messageText.trim();
//     const hasFile = selectedFile;
//     if ((!hasText && !hasFile) || sending || uploading) return;
//     const text = messageText.trim();
//     try {
//       setSending(true);
//       let fileUrl = null;
//       let fileData = null;
//       if (selectedFile) {
//         const uploadResult = await uploadFileToBunny(selectedFile);
//         fileUrl = uploadResult.url;
//         fileData = { url: uploadResult.url, name: selectedFile.name, type: selectedFile.type, size: selectedFile.size };
//       }
//       setMessageText('');
//       handleRemoveFile();
//       setShowEmojiPicker(false);
//       if (textareaRef.current) textareaRef.current.style.height = 'auto';
//       sendTypingIndicator(false);
//       const optimisticMessage = {
//         id: `temp-${Date.now()}`,
//         conversationId: conversation.id,
//         senderType: 'agent',
//         senderName: employeeName || 'Agent',
//         content: text || '',
//         fileUrl,
//         fileData,
//         createdAt: new Date().toISOString(),
//         _optimistic: true,
//         sending: true,
//       };
//       setMessages(prev => [...prev, optimisticMessage]);
//       clearAllNotifications(conversation.id);
//       const sentMessage = await onSendMessage(conversation, text, fileData);
//       if (sentMessage.id) displayedMessageIds.current.add(String(sentMessage.id));
//       const normalizedSent = normalizeMessage(sentMessage);
//       const mergedMessage = {
//         ...normalizedSent,
//         fileUrl: normalizedSent.fileUrl || fileUrl,
//         fileData: normalizedSent.fileData || fileData,
//         sending: false,
//       };
//       setMessages(prev => prev.map(msg => msg._optimistic && msg.id === optimisticMessage.id ? mergedMessage : msg));
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
//     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
//     typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 2000);
//   };

//   const handleKeyPress = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
//   };

//   const handleDeleteClick = () => setShowDeleteModal(true);
//   const handleCancelDelete = () => setShowDeleteModal(false);

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

//   const handleBackClick = () => { if (onClose) onClose(); };

//   const getInitials = (name) => {
//     if (!name) return 'G';
//     return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
//   };

//   const getGroupedMessages = () => {
//     if (!messages || messages.length === 0) return [];
//     return messages.map((message, index) => {
//       const prevMessage = index > 0 ? messages[index - 1] : null;
//       const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
//       return {
//         ...message,
//         isFirstInGroup: !prevMessage || prevMessage.senderType !== message.senderType,
//         isLastInGroup: !nextMessage || nextMessage.senderType !== message.senderType,
//       };
//     });
//   };

//   const getStoreDetails = () => {
//     if (!stores || !conversation) return null;
//     return stores.find(s =>
//       s.storeIdentifier === conversation.storeIdentifier ||
//       s.id === conversation.shopId ||
//       s.id === conversation.shop_id ||
//       s.storeIdentifier === conversation.store_identifier
//     ) || null;
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

//   const storeDetails = getStoreDetails();
//   const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
//   const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || storeDetails?.shopDomain || storeDetails?.myshopify_domain || conversation.domain || conversation.storeDomain || null;
//   const groupedMessages = getGroupedMessages();

//   // ============ LEGAL ALERT BANNER STYLES ============
//   const legalBannerBg = legalAlert?.severity === 'critical' ? '#dc2626'
//     : legalAlert?.severity === 'high' ? '#d97706'
//     : '#2563eb';

//   const legalBannerEmoji = legalAlert?.severity === 'critical' ? '🚨'
//     : legalAlert?.severity === 'high' ? '⚠️'
//     : '🔔';

//   return (
//     <div className="chat-window" style={{ position: 'relative' }}>

//       {/* ============ LEGAL THREAT ALERT BANNER ============ */}
//       {legalAlert && (
//         <div style={{
//           position: 'absolute',
//           top: 0, left: 0, right: 0,
//           zIndex: 9999,
//           background: legalBannerBg,
//           color: 'white',
//           padding: '10px 16px',
//           display: 'flex',
//           alignItems: 'center',
//           gap: '10px',
//           boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
//           animation: 'legalSlideDown 0.3s ease',
//         }}>
//           {/* Icon */}
//           <span style={{ fontSize: '22px', flexShrink: 0 }}>{legalBannerEmoji}</span>

//           {/* Text */}
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <div style={{
//               fontWeight: 700,
//               fontSize: '12px',
//               textTransform: 'uppercase',
//               letterSpacing: '0.6px',
//               marginBottom: '2px',
//             }}>
//               Legal Threat Detected — {legalAlert.severity?.toUpperCase()}
//               {legalAlert.fromAttachment && (
//                 <span style={{
//                   marginLeft: '8px',
//                   background: 'rgba(255,255,255,0.2)',
//                   padding: '1px 6px',
//                   borderRadius: '4px',
//                   fontSize: '10px',
//                 }}>
//                   📎 FROM FILE
//                 </span>
//               )}
//             </div>
//             <div style={{ fontSize: '12px', opacity: 0.92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {legalAlert.documentType
//                 ? `Document: ${legalAlert.documentType}`
//                 : `Matched: "${legalAlert.matchedTerm}"`}
//               {legalAlert.snippet && (
//                 <span style={{ marginLeft: '8px', fontStyle: 'italic', opacity: 0.8 }}>
//                   · "{legalAlert.snippet.substring(0, 70)}{legalAlert.snippet.length > 70 ? '…' : ''}"
//                 </span>
//               )}
//             </div>
//           </div>

//           {/* Right side */}
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
//             <span style={{
//               fontSize: '11px',
//               background: 'rgba(255,255,255,0.2)',
//               padding: '3px 8px',
//               borderRadius: '4px',
//               whiteSpace: 'nowrap',
//             }}>
//               Priority → URGENT
//             </span>
//             <button
//               type="button"
//               onClick={dismissLegalAlert}
//               title="Dismiss"
//               style={{
//                 background: 'rgba(255,255,255,0.2)',
//                 border: 'none',
//                 borderRadius: '50%',
//                 width: '26px',
//                 height: '26px',
//                 cursor: 'pointer',
//                 color: 'white',
//                 fontSize: '14px',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 flexShrink: 0,
//                 transition: 'background 0.15s',
//               }}
//               onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
//               onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
//             >
//               ✕
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Header */}
//       <div className="chat-header" style={legalAlert ? { marginTop: '56px' } : {}}>
//         <div className="chat-header-left">
//           <button className="chat-back-btn-mobile" onClick={handleBackClick} aria-label="Back to conversations" type="button">←</button>
//           <div className="chat-header-avatar">{getInitials(conversation.customerName)}</div>
//           <div className="chat-header-info">
//             <h3>
//               {conversation.customerName || 'Guest'}
//               {/* Legal flag indicator on customer name */}
//               {conversation.legalFlag && (
//                 <span title={`Legal flag: ${conversation.legalFlagSeverity}`} style={{ marginLeft: '6px', fontSize: '14px' }}>
//                   {conversation.legalFlagSeverity === 'critical' ? '🚨' : '⚠️'}
//                 </span>
//               )}
//             </h3>
//             <div className="chat-header-subtitle">
//               {storeName && (
//                 <span className="store-info">
//                   <strong>{storeName}</strong>
//                   {storeDomain && ` • ${storeDomain}`}
//                 </span>
//               )}
//               <span className="customer-email-desktop">{storeName && ' • '}{conversation.customerEmail || 'No email'}</span>
//               <span
//                 style={{ color: wsConnected ? '#48bb78' : '#fc8181', marginLeft: '8px' }}
//                 title={wsConnected ? 'Connected' : 'Disconnected'}
//               >●</span>
//             </div>
//           </div>
//         </div>
//         <div className="chat-actions">
//           <button
//             className="icon-btn"
//             onClick={() => setShowAISuggestions(!showAISuggestions)}
//             title={showAISuggestions ? 'Hide AI suggestions' : 'Show AI suggestions'}
//             type="button"
//             style={{ color: showAISuggestions ? '#00a884' : undefined, fontStyle: 'normal' }}
//           >✦</button>
//           <button
//             className="icon-btn"
//             onClick={() => setShowCustomerInfo(!showCustomerInfo)}
//             title="Customer info"
//             type="button"
//           >ℹ️</button>
//           <button
//             className="icon-btn delete-btn"
//             onClick={handleDeleteClick}
//             title="Delete conversation"
//             type="button"
//           >🗑️</button>
//         </div>
//       </div>

//       {/* Conversation Delete Modal */}
//       {showDeleteModal && (
//         <div className="modal-overlay" onClick={handleCancelDelete}>
//           <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🗑️ Delete Conversation</h3></div>
//             <div className="modal-body">
//               <p>Are you sure you want to delete this conversation?</p>
//               <div className="delete-warning">
//                 <p><strong>Customer:</strong> {conversation.customerName || 'Guest'}</p>
//                 <p><strong>Store:</strong> {storeName}</p>
//                 <p className="warning-text">⚠️ This action cannot be undone. All messages will be permanently deleted.</p>
//               </div>
//             </div>
//             <div className="modal-footer">
//               <button className="btn-cancel" onClick={handleCancelDelete} disabled={deleting} type="button">Cancel</button>
//               <button className="btn-delete" onClick={handleConfirmDelete} disabled={deleting} type="button">{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Message Delete Confirmation Modal */}
//       {messageToDelete && (
//         <div className="modal-overlay" onClick={handleCancelMessageDelete}>
//           <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🗑️ Delete Message</h3></div>
//             <div className="modal-body">
//               <p>Remove this message permanently?</p>
//               {messageToDelete.content && (
//                 <div className="delete-warning">
//                   <p style={{ fontStyle: 'italic', color: '#667781', marginTop: 4 }}>
//                     "{messageToDelete.content.length > 120 ? messageToDelete.content.slice(0, 120) + '…' : messageToDelete.content}"
//                   </p>
//                 </div>
//               )}
//               <p className="warning-text" style={{ marginTop: 8 }}>⚠️ This cannot be undone.</p>
//             </div>
//             <div className="modal-footer">
//               <button className="btn-cancel" onClick={handleCancelMessageDelete} disabled={deletingMessage} type="button">Cancel</button>
//               <button className="btn-delete" onClick={handleConfirmMessageDelete} disabled={deletingMessage} type="button">{deletingMessage ? 'Deleting...' : 'Delete'}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Content */}
//       <div className="chat-content" style={{ display: 'flex', flexDirection: 'row' }}>
//         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
//           <div className="chat-messages" style={{ flex: 1 }}>
//             {loading ? (
//               <div className="empty-state"><div className="spinner"></div></div>
//             ) : messages.length === 0 ? (
//               <div className="empty-state">
//                 <div className="empty-state-icon">💬</div>
//                 <h3>No messages yet</h3>
//                 <p>Start the conversation by sending a message</p>
//               </div>
//             ) : (
//               <>
//                 {groupedMessages.map((message, index) => (
//                   <MessageBubble
//                     key={message.id || `msg-${index}`}
//                     message={message}
//                     nextMessage={index < groupedMessages.length - 1 ? groupedMessages[index + 1] : null}
//                     isAgent={message.senderType === 'agent'}
//                     isCustomer={message.senderType === 'customer'}
//                     showAvatar={true}
//                     isFirstInGroup={message.isFirstInGroup}
//                     isLastInGroup={message.isLastInGroup}
//                     sending={message.sending || message._optimistic}
//                     actionButton={
//                       isAdmin && !message._optimistic && message.senderType === 'agent' ? (
//                         <button
//                           type="button"
//                           onClick={() => handleDeleteMessageClick(message)}
//                           title="Delete message"
//                           style={{
//                             background: 'none', border: 'none', cursor: 'pointer',
//                             fontSize: 13, color: '#ccc', padding: 0, lineHeight: 1,
//                             transition: 'color 0.15s',
//                           }}
//                           onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
//                           onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
//                         >
//                           🗑️
//                         </button>
//                       ) : null
//                     }
//                   />
//                 ))}
//                 {typingUsers.size > 0 && (
//                   <div className="typing-indicator">
//                     <div className="typing-indicator-avatar">{getInitials(Array.from(typingUsers)[0])}</div>
//                     <div className="typing-indicator-bubble">
//                       <div className="typing-dot"></div>
//                       <div className="typing-dot"></div>
//                       <div className="typing-dot"></div>
//                     </div>
//                   </div>
//                 )}
//                 <div ref={messagesEndRef} />
//               </>
//             )}
//           </div>

//           {showCustomerInfo && (
//             <CustomerInfo
//               conversation={conversation}
//               onClose={() => setShowCustomerInfo(false)}
//               stores={stores}
//             />
//           )}
//         </div>

//         {showAISuggestions && (
//           <AISuggestions
//             conversation={conversation}
//             messages={messages}
//             onSelectSuggestion={handleSelectSuggestion}
//           />
//         )}
//       </div>

//       {/* File Preview */}
//       {filePreview && (
//         <div style={{
//           padding: '12px 16px',
//           backgroundColor: '#f5f6f6',
//           borderTop: '1px solid #e9edef',
//           display: 'flex',
//           alignItems: 'center',
//           gap: '12px',
//         }}>
//           {filePreview.type === 'image' ? (
//             <img src={filePreview.url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
//           ) : (
//             <div style={{
//               width: '60px', height: '60px',
//               backgroundColor: '#00a884',
//               borderRadius: '8px',
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//               fontSize: '24px',
//             }}>📎</div>
//           )}
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.name}</div>
//             {filePreview.size && <div style={{ fontSize: '12px', color: '#667781' }}>{filePreview.size}</div>}
//           </div>
//           {uploading && <div style={{ fontSize: '12px', color: '#00a884' }}>{uploadProgress}%</div>}
//           <button
//             onClick={handleRemoveFile}
//             disabled={uploading}
//             type="button"
//             style={{
//               background: 'none', border: 'none', fontSize: '20px',
//               cursor: uploading ? 'not-allowed' : 'pointer',
//               color: '#667781', padding: '4px 8px',
//             }}
//           >✕</button>
//         </div>
//       )}

//       {/* Quick Replies */}
//       <QuickReplies
//         templates={templates}
//         onUseTemplate={handleUseTemplate}
//         onAddTemplate={handleAddQuickReply}
//         onDeleteTemplate={handleDeleteQuickReply}
//         onSaveTemplate={handleSaveQuickReply}
//         loading={templateLoading}
//         isOpen={showQuickReplies}
//         onToggle={() => setShowQuickReplies(!showQuickReplies)}
//       />

//       {/* Input */}
//       <div style={{
//         background: '#f0f2f5',
//         padding: '12px 16px',
//         borderTop: '1px solid #e9edef',
//         display: 'flex',
//         alignItems: 'flex-end',
//         gap: '8px',
//         flexShrink: 0,
//         boxShadow: '0 -1px 2px rgba(11,20,26,0.05)',
//         position: 'relative',
//       }}>
//         {/* Quick replies toggle */}
//         <button
//           type="button"
//           title="Quick replies"
//           onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQuickReplies(!showQuickReplies); }}
//           style={{
//             width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
//             border: 'none', borderRadius: '50%', background: 'transparent',
//             cursor: 'pointer', display: 'flex', alignItems: 'center',
//             justifyContent: 'center', fontSize: '20px', padding: 0,
//             color: showQuickReplies ? '#00a884' : '#54656f',
//           }}
//         >⚡</button>

//         {/* Textarea */}
//         <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
//           <textarea
//             ref={textareaRef}
//             className="chat-input"
//             placeholder="Type a message..."
//             value={messageText}
//             onChange={handleTyping}
//             onKeyDown={handleKeyPress}
//             rows="1"
//             disabled={sending || uploading}
//           />
//           <input
//             ref={fileInputRef}
//             type="file"
//             accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
//             onChange={handleFileSelect}
//             style={{ display: 'none' }}
//           />
//           {showEmojiPicker && (
//             <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
//           )}
//         </div>

//         {/* Emoji */}
//         <button
//           type="button"
//           title="Emoji"
//           onClick={e => { e.preventDefault(); e.stopPropagation(); setShowEmojiPicker(v => !v); }}
//           style={{
//             width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
//             border: 'none', borderRadius: '50%', background: 'transparent',
//             cursor: 'pointer', display: 'flex', alignItems: 'center',
//             justifyContent: 'center', fontSize: '20px', padding: 0,
//             color: showEmojiPicker ? '#00a884' : '#54656f',
//           }}
//         >😊</button>

//         {/* Attach */}
//         <button
//           type="button"
//           title="Attach file"
//           onClick={handleAttachClick}
//           disabled={uploading}
//           style={{
//             width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
//             border: 'none', borderRadius: '50%', background: 'transparent',
//             cursor: uploading ? 'not-allowed' : 'pointer',
//             display: 'flex', alignItems: 'center',
//             justifyContent: 'center', fontSize: '20px', padding: 0,
//             color: '#54656f',
//           }}
//         >{uploading ? '⏳' : '📎'}</button>

//         {/* Send */}
//         <button
//           type="button"
//           title="Send message (Enter)"
//           onClick={handleSend}
//           disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
//           style={{
//             width: '44px', height: '44px', minWidth: '44px', flexShrink: 0,
//             border: 'none', borderRadius: '50%',
//             background: (!messageText.trim() && !selectedFile) || sending || uploading
//               ? 'rgba(0,168,132,0.4)'
//               : '#00a884',
//             cursor: (!messageText.trim() && !selectedFile) || sending || uploading
//               ? 'not-allowed'
//               : 'pointer',
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//             fontSize: '20px', padding: 0, color: 'white',
//             boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
//           }}
//         >{sending ? '⏳' : '➤'}</button>
//       </div>

//       {/* ============ LEGAL ALERT ANIMATION STYLE ============ */}
//       <style>{`
//         @keyframes legalSlideDown {
//           from { transform: translateY(-100%); opacity: 0; }
//           to   { transform: translateY(0);     opacity: 1; }
//         }
//       `}</style>
//     </div>
//   );
// }

// export default ChatWindow;





//WAG BURAHIN

import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import api from "../services/api";
import MessageBubble from './MessageBubble';
import CustomerInfo from './CustomerInfo';
import AISuggestions from './Aisuggestions';
import QuickReplies from './Quickreplies';
import '../styles/ChatWindow.css';

// ============ EMOJI DATA ============
const EMOJI_CATEGORIES = [
  {
    label: '😊 Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  },
  {
    label: '👋 People',
    emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄'],
  },
  {
    label: '❤️ Hearts',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'],
  },
  {
    label: '🎉 Celebration',
    emojis: ['🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'],
  },
];

function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const pickerRef = useRef(null);

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <div className="emoji-picker-search">
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="emoji-search-input"
          autoFocus
        />
      </div>
      {!search && (
        <div className="emoji-category-tabs">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={i}
              type="button"
              className={`emoji-cat-tab${activeCategory === i ? ' active' : ''}`}
              onClick={() => setActiveCategory(i)}
              title={cat.label}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>
      )}
      <div className="emoji-grid">
        {filteredEmojis.length > 0
          ? filteredEmojis.map((emoji, i) => (
              <button
                key={i}
                type="button"
                className="emoji-btn"
                onClick={() => { onSelect(emoji); }}
              >
                {emoji}
              </button>
            ))
          : <div className="emoji-no-results">No results</div>
        }
      </div>
    </div>
  );
}

// ============ SEND EMAIL MODAL ============

function SendEmailModal({ conversation, onClose, onSend }) {
  const customerEmail = conversation?.customerEmail || '';
  const customerName = conversation?.customerName || 'Customer';

  const [to, setTo] = useState(customerEmail);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  const handleSend = async () => {
    if (!to.trim()) { setError('Recipient email is required.'); return; }
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!body.trim()) { setError('Message body is required.'); return; }
    setError('');
    try {
      setSending(true);
      await onSend({ to: to.trim(), subject: subject.trim(), body: body.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(11,20,26,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          background: '#00a884',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>✉️</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Send Email</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{customerName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: '30px', height: '30px',
              cursor: 'pointer', color: '#fff', fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {sent ? (
          /* Success state */
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#111b21', marginBottom: '6px' }}>Email Sent!</div>
            <div style={{ fontSize: '13px', color: '#667781', marginBottom: '24px' }}>Your message was sent to <strong>{to}</strong></div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#00a884', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 28px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >Close</button>
          </div>
        ) : (
          /* Form */
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* To */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>
                To
              </label>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="customer@example.com"
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e9edef', borderRadius: '8px',
                  fontSize: '14px', color: '#111b21', outline: 'none',
                  boxSizing: 'border-box', background: '#f9fafb',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#00a884'}
                onBlur={e => e.target.style.borderColor = '#e9edef'}
              />
            </div>

            {/* Subject */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Your order tracking update"
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e9edef', borderRadius: '8px',
                  fontSize: '14px', color: '#111b21', outline: 'none',
                  boxSizing: 'border-box', background: '#f9fafb',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#00a884'}
                onBlur={e => e.target.style.borderColor = '#e9edef'}
              />
            </div>

            {/* Body */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>
                Message
              </label>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here..."
                rows={6}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e9edef', borderRadius: '8px',
                  fontSize: '14px', color: '#111b21', outline: 'none',
                  boxSizing: 'border-box', background: '#f9fafb',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#00a884'}
                onBlur={e => e.target.style.borderColor = '#e9edef'}
              />
              <div style={{ fontSize: '11px', color: '#aab8c2', textAlign: 'right', marginTop: '3px' }}>
                {body.length} chars
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#fff5f5', border: '1px solid #fed7d7',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#c53030',
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                style={{
                  background: '#f0f2f5', border: '1px solid #e9edef',
                  borderRadius: '8px', padding: '10px 20px',
                  fontSize: '14px', fontWeight: 500,
                  cursor: sending ? 'not-allowed' : 'pointer', color: '#3b4a54',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                style={{
                  background: sending || !to.trim() || !subject.trim() || !body.trim()
                    ? 'rgba(0,168,132,0.45)' : '#00a884',
                  border: 'none', borderRadius: '8px',
                  padding: '10px 24px', fontSize: '14px',
                  fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
                  color: '#fff', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
                }}
              >
                {sending ? (
                  <>⏳ Sending…</>
                ) : (
                  <>✉️ Send Email</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ HELPER: parse fileData safely ============
const parseFileData = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

// ============ HELPER: normalize messages from server ============
const normalizeMessage = (msg) => ({
  ...msg,
  fileData: parseFileData(msg.fileData || msg.file_data),
});

function ChatWindow({
  conversation,
  onSendMessage,
  onClose,
  onTyping,
  employeeName,
  onMenuToggle,
  stores,
  isAdmin = false,
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
  const [showAISuggestions, setShowAISuggestions] = useState(true);

  // Message delete state
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Template / Quick Reply states
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // ============ SEND EMAIL STATE ============
  const [showEmailModal, setShowEmailModal] = useState(false);

  // ============ LEGAL THREAT STATE ============
  const [legalAlert, setLegalAlert] = useState(null);
  const legalDismissTimerRef = useRef(null);

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
  const pollIntervalRef = useRef(null);

  const conversationRef = useRef(conversation);
  const employeeNameRef = useRef(employeeName);
  const handleWsMessageRef = useRef(null);

  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { employeeNameRef.current = employeeName; }, [employeeName]);

  // Cleanup legal dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
    };
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    }
  };

  // ============ SEND EMAIL HANDLER ============
  const handleSendEmail = async ({ to, subject, body }) => {
    // Calls your API — adjust endpoint name to match your api service
    await api.sendEmail({
      to,
      subject,
      body,
      conversationId: conversation?.id,
      customerName: conversation?.customerName,
    });
  };

  // ============ QUICK REPLY HANDLERS ============
  const handleUseTemplate = (content) => {
    setMessageText(content);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleAddQuickReply = async ({ name, content }) => {
    const newTemplate = await api.createTemplate({ name, content });
    setTemplates(prev => [...prev, newTemplate]);
  };

  const handleSaveQuickReply = async (templateId, { name, content }) => {
    const updated = await api.updateTemplate(templateId, { name, content });
    setTemplates(prev => prev.map(t => t.id === templateId ? updated : t));
  };

  const handleDeleteQuickReply = async (templateId) => {
    await api.deleteTemplate(templateId);
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  // ============ EMOJI HANDLER ============
  const handleEmojiSelect = (emoji) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = messageText.slice(0, start) + emoji + messageText.slice(end);
      setMessageText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = start + emoji.length;
        textarea.selectionEnd = start + emoji.length;
      }, 0);
    } else {
      setMessageText(prev => prev + emoji);
    }
  };

  // ============ MESSAGE DELETE HANDLERS ============
  const handleDeleteMessageClick = (message) => { setMessageToDelete(message); };
  const handleCancelMessageDelete = () => { setMessageToDelete(null); };

  const handleConfirmMessageDelete = async () => {
    if (!messageToDelete) return;
    try {
      setDeletingMessage(true);
      await api.deleteMessage(messageToDelete.id);
      displayedMessageIds.current.delete(String(messageToDelete.id));
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageToDelete.id)));
      setMessageToDelete(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert(`Failed to delete message: ${error.message}`);
    } finally {
      setDeletingMessage(false);
    }
  };

  // ============ FILE HANDLING ============
  const handleAttachClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { alert('File size must be less than 10MB'); return; }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview({ type: 'image', url: e.target.result, name: file.name });
      reader.readAsDataURL(file);
    } else {
      setFilePreview({ type: 'file', name: file.name, size: formatFileSize(file.size) });
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
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

  const handleSelectSuggestion = (suggestion) => {
    setMessageText(suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
      }, 0);
    }
  };

  // ============ WEBSOCKET IMPLEMENTATION ============
  const getWsUrl = () => {
    let baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
    if (!baseUrl) baseUrl = window.location.origin;
    baseUrl = baseUrl.replace(/\/$/, '');
    return baseUrl.replace(/^http/, 'ws') + '/ws';
  };

  const connectWebSocket = () => {
    disconnectWebSocket();
    if (!conversationRef.current?.id) return;
    const token = localStorage.getItem('token');
    if (!token) { console.error('❌ [WS] No auth token found'); return; }
    try {
      const wsUrl = getWsUrl();
      hasAuthenticated.current = false;
      hasJoined.current = false;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttempts.current = 0;
        ws.send(JSON.stringify({ type: 'auth', token, clientType: 'agent' }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (handleWsMessageRef.current) handleWsMessageRef.current(data);
        } catch (error) { console.error('❌ [WS] Parse error:', error); }
      };
      ws.onerror = () => setWsConnected(false);
      ws.onclose = (event) => {
        setWsConnected(false);
        hasAuthenticated.current = false;
        hasJoined.current = false;
        wsRef.current = null;
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && conversationRef.current?.id) {
          reconnectAttempts.current++;
          const delay = Math.min(2000 * reconnectAttempts.current, 10000);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        }
      };
    } catch (error) {
      console.error('❌ [WS] Connection failed:', error);
      setWsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      hasAuthenticated.current = false;
      hasJoined.current = false;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000, 'Component unmounting');
    }
    setWsConnected(false);
  };

  // ============ LEGAL ALERT HELPERS ============
  const showLegalAlert = (alert) => {
    if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
    setLegalAlert(alert);
    legalDismissTimerRef.current = setTimeout(() => setLegalAlert(null), 15000);
  };

  const dismissLegalAlert = () => {
    if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
    setLegalAlert(null);
  };

  const handleWebSocketMessage = (data) => {
    const currentConv = conversationRef.current;
    const currentEmployeeName = employeeNameRef.current;

    switch (data.type) {
      case 'connected': break;

      case 'auth_ok':
        hasAuthenticated.current = true;
        if (currentConv?.id && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join_conversation',
            conversationId: parseInt(currentConv.id),
            role: 'agent',
            employeeName: currentEmployeeName || 'Agent'
          }));
        }
        break;

      case 'joined':
        hasJoined.current = true;
        setWsConnected(true);
        break;

      case 'new_message':
        if (data.message) handleIncomingMessage(data.message, currentConv, currentEmployeeName);
        break;

      case 'message_confirmed':
        if (data.tempId && data.message) {
          const confirmedMsg = normalizeMessage(data.message);
          setMessages(prev => prev.map(msg =>
            String(msg.id) === String(data.tempId)
              ? { ...confirmedMsg, fileData: confirmedMsg.fileData || msg.fileData, fileUrl: confirmedMsg.fileUrl || msg.fileUrl, sending: false, _optimistic: false }
              : msg
          ));
          if (data.message.id) displayedMessageIds.current.add(String(data.message.id));
        }
        break;

      case 'message_failed':
        if (data.tempId) {
          setMessages(prev => prev.map(msg =>
            String(msg.id) === String(data.tempId)
              ? { ...msg, sending: false, failed: true, _optimistic: false }
              : msg
          ));
        }
        break;

      case 'message_deleted':
        if (data.messageId) {
          displayedMessageIds.current.delete(String(data.messageId));
          setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
        }
        break;

      case 'legal_threat_detected': {
        const alert = data.alert;
        if (!alert) break;
        console.warn(`🚨 [LEGAL] ${alert.severity?.toUpperCase()} — "${alert.matchedTerm}" in conv #${alert.conversationId}`);
        playNotificationSound();
        setTimeout(() => playNotificationSound(), 400);
        if (String(alert.conversationId) === String(currentConv?.id)) {
          showLegalAlert(alert);
        } else {
          if (Notification.permission === 'granted') {
            const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : '🔔';
            try {
              const n = new Notification(`${emoji} Legal Threat — Conv #${alert.conversationId}`, {
                body: `${alert.severity?.toUpperCase()}: "${alert.matchedTerm}" from ${alert.senderName}`,
                icon: '/favicon.ico',
                requireInteraction: alert.severity === 'critical',
                tag: `legal-${alert.conversationId}`,
              });
              n.onclick = () => { window.focus(); n.close(); };
              if (alert.severity !== 'critical') setTimeout(() => n.close(), 8000);
            } catch (e) {}
          }
        }
        break;
      }

      case 'typing': handleTypingIndicator(data); break;
      case 'customer_left': setTypingUsers(new Set()); break;

      case 'error':
        console.error('❌ [WS] Server error:', data.message);
        if (data.message?.includes('token') || data.message?.includes('auth')) {
          hasAuthenticated.current = false;
          hasJoined.current = false;
          setWsConnected(false);
        }
        break;

      default: break;
    }
  };

  handleWsMessageRef.current = handleWebSocketMessage;

  const handleIncomingMessage = (message, currentConv, currentEmployeeName) => {
    const msgId = message.id;
    const convId = message.conversationId || message.conversation_id;
    if (convId && String(convId) !== String(currentConv?.id)) { showNotification(message); return; }
    if (msgId && displayedMessageIds.current.has(String(msgId))) return;
    if (message.senderType === 'agent' && currentEmployeeName && message.senderName === currentEmployeeName) {
      if (msgId) displayedMessageIds.current.add(String(msgId));
      return;
    }
    if (msgId) displayedMessageIds.current.add(String(msgId));
    const normalized = normalizeMessage(message);
    setMessages(prev => {
      if (prev.some(m => String(m.id) === String(msgId))) return prev;
      return [...prev, { ...normalized, sending: false, _optimistic: false }];
    });
    if (message.senderType === 'customer') showNotification(message);
  };

  const showNotification = (message) => {
    if (!message || message.senderType === 'agent') return;
    playNotificationSound();
    if (Notification.permission === 'granted') createNotification(message);
    else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') createNotification(message); });
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
      notification.onclick = () => { window.focus(); notification.close(); };
      setTimeout(() => notification.close(), 5000);
    } catch (error) { console.warn('Notification failed:', error); }
  };

  const clearAllNotifications = (conversationId) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications) {
      notifications.forEach(n => { try { n.close(); } catch (e) {} });
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
    } catch (error) {}
  };

  const handleTypingIndicator = (data) => {
    if (data.senderType === 'agent') return;
    const senderName = data.senderName || 'Customer';
    if (data.isTyping) {
      setTypingUsers(prev => new Set([...prev, senderName]));
      setTimeout(() => setTypingUsers(prev => {
        const next = new Set(prev); next.delete(senderName); return next;
      }), 5000);
    } else {
      setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; });
    }
  };

  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && conversationRef.current?.id && hasJoined.current) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversationId: parseInt(conversationRef.current.id),
        isTyping,
        senderType: 'agent',
        senderName: employeeNameRef.current || 'Agent'
      }));
    }
  };

  // ============ EFFECTS ============
  useEffect(() => {
    if (!conversation) { disconnectWebSocket(); return; }
    connectWebSocket();
    return () => disconnectWebSocket();
  }, [conversation?.id, employeeName]);

  useEffect(() => {
    return () => { if (conversation?.id) clearAllNotifications(conversation.id); };
  }, [conversation?.id]);

  useEffect(() => {
    if (conversation) { displayedMessageIds.current.clear(); loadMessages(); }
    else { setMessages([]); setLoading(false); }
    dismissLegalAlert();
    setShowEmailModal(false); // close email modal on conversation switch
  }, [conversation?.id]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    return () => clearInterval(pingInterval);
  }, []);

  useEffect(() => {
    if (!conversation?.id) { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); return; }
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await api.getMessages(conversation.id);
        const serverMessages = (Array.isArray(data) ? data : []).map(normalizeMessage);
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const newMessages = serverMessages.filter(m => m.id && !existingIds.has(String(m.id)) && !displayedMessageIds.current.has(String(m.id)));
          if (newMessages.length === 0) return prev;
          newMessages.forEach(m => { if (m.id) displayedMessageIds.current.add(String(m.id)); });
          let updated = prev.map(existing => {
            if (!String(existing.id).startsWith('temp-')) return existing;
            const confirmed = serverMessages.find(s =>
              s.content === existing.content &&
              s.senderType === existing.senderType &&
              !existingIds.has(String(s.id))
            );
            if (confirmed) {
              displayedMessageIds.current.add(String(confirmed.id));
              return { ...confirmed, sending: false, _optimistic: false };
            }
            return existing;
          });
          return [...updated, ...newMessages.map(m => ({ ...m, sending: false, _optimistic: false }))];
        });
      } catch (error) {}
    }, 5000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [conversation?.id]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await api.getMessages(conversation.id);
      const messageArray = (Array.isArray(data) ? data : []).map(normalizeMessage);
      messageArray.forEach(msg => { if (msg.id) displayedMessageIds.current.add(String(msg.id)); });
      setMessages(messageArray);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

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
        fileData = { url: uploadResult.url, name: selectedFile.name, type: selectedFile.type, size: selectedFile.size };
      }
      setMessageText('');
      handleRemoveFile();
      setShowEmojiPicker(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      sendTypingIndicator(false);
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversationId: conversation.id,
        senderType: 'agent',
        senderName: employeeName || 'Agent',
        content: text || '',
        fileUrl,
        fileData,
        createdAt: new Date().toISOString(),
        _optimistic: true,
        sending: true,
      };
      setMessages(prev => [...prev, optimisticMessage]);
      clearAllNotifications(conversation.id);
      const sentMessage = await onSendMessage(conversation, text, fileData);
      if (sentMessage.id) displayedMessageIds.current.add(String(sentMessage.id));
      const normalizedSent = normalizeMessage(sentMessage);
      const mergedMessage = {
        ...normalizedSent,
        fileUrl: normalizedSent.fileUrl || fileUrl,
        fileData: normalizedSent.fileData || fileData,
        sending: false,
      };
      setMessages(prev => prev.map(msg => msg._optimistic && msg.id === optimisticMessage.id ? mergedMessage : msg));
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
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
  };

  const handleDeleteClick = () => setShowDeleteModal(true);
  const handleCancelDelete = () => setShowDeleteModal(false);

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

  const handleBackClick = () => { if (onClose) onClose(); };

  const getInitials = (name) => {
    if (!name) return 'G';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getGroupedMessages = () => {
    if (!messages || messages.length === 0) return [];
    return messages.map((message, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      return {
        ...message,
        isFirstInGroup: !prevMessage || prevMessage.senderType !== message.senderType,
        isLastInGroup: !nextMessage || nextMessage.senderType !== message.senderType,
      };
    });
  };

  const getStoreDetails = () => {
    if (!stores || !conversation) return null;
    return stores.find(s =>
      s.storeIdentifier === conversation.storeIdentifier ||
      s.id === conversation.shopId ||
      s.id === conversation.shop_id ||
      s.storeIdentifier === conversation.store_identifier
    ) || null;
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

  const storeDetails = getStoreDetails();
  const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
  const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || storeDetails?.shopDomain || storeDetails?.myshopify_domain || conversation.domain || conversation.storeDomain || null;
  const groupedMessages = getGroupedMessages();

  const legalBannerBg = legalAlert?.severity === 'critical' ? '#dc2626'
    : legalAlert?.severity === 'high' ? '#d97706'
    : '#2563eb';
  const legalBannerEmoji = legalAlert?.severity === 'critical' ? '🚨'
    : legalAlert?.severity === 'high' ? '⚠️'
    : '🔔';

  return (
    <div className="chat-window" style={{ position: 'relative' }}>

      {/* ============ SEND EMAIL MODAL ============ */}
      {showEmailModal && (
        <SendEmailModal
          conversation={conversation}
          onClose={() => setShowEmailModal(false)}
          onSend={handleSendEmail}
        />
      )}

      {/* ============ LEGAL THREAT ALERT BANNER ============ */}
      {legalAlert && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          zIndex: 9999,
          background: legalBannerBg,
          color: 'white',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          animation: 'legalSlideDown 0.3s ease',
        }}>
          <span style={{ fontSize: '22px', flexShrink: 0 }}>{legalBannerEmoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>
              Legal Threat Detected — {legalAlert.severity?.toUpperCase()}
              {legalAlert.fromAttachment && (
                <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
                  📎 FROM FILE
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {legalAlert.documentType ? `Document: ${legalAlert.documentType}` : `Matched: "${legalAlert.matchedTerm}"`}
              {legalAlert.snippet && (
                <span style={{ marginLeft: '8px', fontStyle: 'italic', opacity: 0.8 }}>
                  · "{legalAlert.snippet.substring(0, 70)}{legalAlert.snippet.length > 70 ? '…' : ''}"
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
              Priority → URGENT
            </span>
            <button
              type="button"
              onClick={dismissLegalAlert}
              title="Dismiss"
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                width: '26px', height: '26px', cursor: 'pointer', color: 'white',
                fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="chat-header" style={legalAlert ? { marginTop: '56px' } : {}}>
        <div className="chat-header-left">
          <button className="chat-back-btn-mobile" onClick={handleBackClick} aria-label="Back to conversations" type="button">←</button>
          <div className="chat-header-avatar">{getInitials(conversation.customerName)}</div>
          <div className="chat-header-info">
            <h3>
              {conversation.customerName || 'Guest'}
              {conversation.legalFlag && (
                <span title={`Legal flag: ${conversation.legalFlagSeverity}`} style={{ marginLeft: '6px', fontSize: '14px' }}>
                  {conversation.legalFlagSeverity === 'critical' ? '🚨' : '⚠️'}
                </span>
              )}
            </h3>
            <div className="chat-header-subtitle">
              {storeName && (
                <span className="store-info">
                  <strong>{storeName}</strong>
                  {storeDomain && ` • ${storeDomain}`}
                </span>
              )}
              <span className="customer-email-desktop">{storeName && ' • '}{conversation.customerEmail || 'No email'}</span>
              <span
                style={{ color: wsConnected ? '#48bb78' : '#fc8181', marginLeft: '8px' }}
                title={wsConnected ? 'Connected' : 'Disconnected'}
              >●</span>
            </div>
          </div>
        </div>
        <div className="chat-actions">
          {/* Send Email button */}
          <button
            className={`send-email-btn${!conversation.customerEmail ? ' send-email-btn--no-email' : ''}`}
            onClick={() => setShowEmailModal(true)}
            title={conversation.customerEmail ? `Send email to ${conversation.customerEmail}` : 'Send email (no email on file)'}
            type="button"
          >
            <svg className="send-email-btn__icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4.5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 7l7.293 4.707a1 1 0 001.414 0L18 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="send-email-btn__label">Send Email</span>
            {!conversation.customerEmail && (
              <span className="send-email-btn__dot" />
            )}
          </button>

          <button
            className="icon-btn"
            onClick={() => setShowAISuggestions(!showAISuggestions)}
            title={showAISuggestions ? 'Hide AI suggestions' : 'Show AI suggestions'}
            type="button"
            style={{ color: showAISuggestions ? '#00a884' : undefined, fontStyle: 'normal' }}
          >✦</button>
          <button
            className="icon-btn"
            onClick={() => setShowCustomerInfo(!showCustomerInfo)}
            title="Customer info"
            type="button"
          >ℹ️</button>
          <button
            className="icon-btn delete-btn"
            onClick={handleDeleteClick}
            title="Delete conversation"
            type="button"
          >🗑️</button>
        </div>
      </div>

      {/* Conversation Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>🗑️ Delete Conversation</h3></div>
            <div className="modal-body">
              <p>Are you sure you want to delete this conversation?</p>
              <div className="delete-warning">
                <p><strong>Customer:</strong> {conversation.customerName || 'Guest'}</p>
                <p><strong>Store:</strong> {storeName}</p>
                <p className="warning-text">⚠️ This action cannot be undone. All messages will be permanently deleted.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelDelete} disabled={deleting} type="button">Cancel</button>
              <button className="btn-delete" onClick={handleConfirmDelete} disabled={deleting} type="button">{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Message Delete Confirmation Modal */}
      {messageToDelete && (
        <div className="modal-overlay" onClick={handleCancelMessageDelete}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>🗑️ Delete Message</h3></div>
            <div className="modal-body">
              <p>Remove this message permanently?</p>
              {messageToDelete.content && (
                <div className="delete-warning">
                  <p style={{ fontStyle: 'italic', color: '#667781', marginTop: 4 }}>
                    "{messageToDelete.content.length > 120 ? messageToDelete.content.slice(0, 120) + '…' : messageToDelete.content}"
                  </p>
                </div>
              )}
              <p className="warning-text" style={{ marginTop: 8 }}>⚠️ This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelMessageDelete} disabled={deletingMessage} type="button">Cancel</button>
              <button className="btn-delete" onClick={handleConfirmMessageDelete} disabled={deletingMessage} type="button">{deletingMessage ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="chat-content" style={{ display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="chat-messages" style={{ flex: 1 }}>
            {loading ? (
              <div className="empty-state"><div className="spinner"></div></div>
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
                    nextMessage={index < groupedMessages.length - 1 ? groupedMessages[index + 1] : null}
                    isAgent={message.senderType === 'agent'}
                    isCustomer={message.senderType === 'customer'}
                    showAvatar={true}
                    isFirstInGroup={message.isFirstInGroup}
                    isLastInGroup={message.isLastInGroup}
                    sending={message.sending || message._optimistic}
                    actionButton={
                      isAdmin && !message._optimistic && message.senderType === 'agent' ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessageClick(message)}
                          title="Delete message"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 13, color: '#ccc', padding: 0, lineHeight: 1,
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
                          onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
                        >🗑️</button>
                      ) : null
                    }
                  />
                ))}
                {typingUsers.size > 0 && (
                  <div className="typing-indicator">
                    <div className="typing-indicator-avatar">{getInitials(Array.from(typingUsers)[0])}</div>
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

        {showAISuggestions && (
          <AISuggestions
            conversation={conversation}
            messages={messages}
            onSelectSuggestion={handleSelectSuggestion}
          />
        )}
      </div>

      {/* File Preview */}
      {filePreview && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f5f6f6',
          borderTop: '1px solid #e9edef',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {filePreview.type === 'image' ? (
            <img src={filePreview.url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
          ) : (
            <div style={{ width: '60px', height: '60px', backgroundColor: '#00a884', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📎</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.name}</div>
            {filePreview.size && <div style={{ fontSize: '12px', color: '#667781' }}>{filePreview.size}</div>}
          </div>
          {uploading && <div style={{ fontSize: '12px', color: '#00a884' }}>{uploadProgress}%</div>}
          <button
            onClick={handleRemoveFile}
            disabled={uploading}
            type="button"
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: uploading ? 'not-allowed' : 'pointer', color: '#667781', padding: '4px 8px' }}
          >✕</button>
        </div>
      )}

      {/* Quick Replies */}
      <QuickReplies
        templates={templates}
        onUseTemplate={handleUseTemplate}
        onAddTemplate={handleAddQuickReply}
        onDeleteTemplate={handleDeleteQuickReply}
        onSaveTemplate={handleSaveQuickReply}
        loading={templateLoading}
        isOpen={showQuickReplies}
        onToggle={() => setShowQuickReplies(!showQuickReplies)}
      />

      {/* Input */}
      <div style={{
        background: '#f0f2f5',
        padding: '12px 16px',
        borderTop: '1px solid #e9edef',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        flexShrink: 0,
        boxShadow: '0 -1px 2px rgba(11,20,26,0.05)',
        position: 'relative',
      }}>
        <button
          type="button"
          title="Quick replies"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQuickReplies(!showQuickReplies); }}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: showQuickReplies ? '#00a884' : '#54656f',
          }}
        >⚡</button>

        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
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
          {showEmojiPicker && (
            <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
          )}
        </div>

        <button
          type="button"
          title="Emoji"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowEmojiPicker(v => !v); }}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: showEmojiPicker ? '#00a884' : '#54656f',
          }}
        >😊</button>

        <button
          type="button"
          title="Attach file"
          onClick={handleAttachClick}
          disabled={uploading}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: '#54656f',
          }}
        >{uploading ? '⏳' : '📎'}</button>

        <button
          type="button"
          title="Send message (Enter)"
          onClick={handleSend}
          disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
          style={{
            width: '44px', height: '44px', minWidth: '44px', flexShrink: 0,
            border: 'none', borderRadius: '50%',
            background: (!messageText.trim() && !selectedFile) || sending || uploading
              ? 'rgba(0,168,132,0.4)'
              : '#00a884',
            cursor: (!messageText.trim() && !selectedFile) || sending || uploading
              ? 'not-allowed'
              : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', padding: 0, color: 'white',
            boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
          }}
        >{sending ? '⏳' : '➤'}</button>
      </div>

      <style>{`
        @keyframes legalSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default ChatWindow;








// import React, { useState, useEffect, useRef } from 'react';
// import { formatDistanceToNow } from 'date-fns';
// import api from "../services/api";
// import MessageBubble from './MessageBubble';
// import CustomerInfo from './CustomerInfo';
// import AISuggestions from './Aisuggestions';
// import QuickReplies from './Quickreplies';
// import CrossStoreHistory from './CrossStoreHistory';
// import '../styles/ChatWindow.css';

// // ============ EMOJI DATA ============
// const EMOJI_CATEGORIES = [
//   {
//     label: '😊 Smileys',
//     emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
//   },
//   {
//     label: '👋 People',
//     emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄'],
//   },
//   {
//     label: '❤️ Hearts',
//     emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'],
//   },
//   {
//     label: '🎉 Celebration',
//     emojis: ['🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'],
//   },
// ];

// function EmojiPicker({ onSelect, onClose }) {
//   const [activeCategory, setActiveCategory] = useState(0);
//   const [search, setSearch] = useState('');
//   const pickerRef = useRef(null);

//   const filteredEmojis = search.trim()
//     ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
//     : EMOJI_CATEGORIES[activeCategory].emojis;

//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [onClose]);

//   return (
//     <div className="emoji-picker" ref={pickerRef}>
//       <div className="emoji-picker-search">
//         <input type="text" placeholder="Search emoji..." value={search} onChange={e => setSearch(e.target.value)} className="emoji-search-input" autoFocus />
//       </div>
//       {!search && (
//         <div className="emoji-category-tabs">
//           {EMOJI_CATEGORIES.map((cat, i) => (
//             <button key={i} type="button" className={`emoji-cat-tab${activeCategory === i ? ' active' : ''}`} onClick={() => setActiveCategory(i)} title={cat.label}>
//               {cat.emojis[0]}
//             </button>
//           ))}
//         </div>
//       )}
//       <div className="emoji-grid">
//         {filteredEmojis.length > 0
//           ? filteredEmojis.map((emoji, i) => (
//               <button key={i} type="button" className="emoji-btn" onClick={() => { onSelect(emoji); }}>{emoji}</button>
//             ))
//           : <div className="emoji-no-results">No results</div>
//         }
//       </div>
//     </div>
//   );
// }

// // ============ SEND EMAIL MODAL ============
// function SendEmailModal({ conversation, onClose, onSend }) {
//   const customerEmail = conversation?.customerEmail || '';
//   const customerName = conversation?.customerName || 'Customer';
//   const [to, setTo] = useState(customerEmail);
//   const [subject, setSubject] = useState('');
//   const [body, setBody] = useState('');
//   const [sending, setSending] = useState(false);
//   const [sent, setSent] = useState(false);
//   const [error, setError] = useState('');
//   const bodyRef = useRef(null);

//   const handleSend = async () => {
//     if (!to.trim()) { setError('Recipient email is required.'); return; }
//     if (!subject.trim()) { setError('Subject is required.'); return; }
//     if (!body.trim()) { setError('Message body is required.'); return; }
//     setError('');
//     try {
//       setSending(true);
//       await onSend({ to: to.trim(), subject: subject.trim(), body: body.trim() });
//       setSent(true);
//     } catch (err) {
//       setError(err.message || 'Failed to send email. Please try again.');
//     } finally {
//       setSending(false);
//     }
//   };

//   return (
//     <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(11,20,26,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
//       <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
//         <div style={{ background: '#00a884', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//             <span style={{ fontSize: '20px' }}>✉️</span>
//             <div>
//               <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Send Email</div>
//               <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{customerName}</div>
//             </div>
//           </div>
//           <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: '#fff', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
//         </div>
//         {sent ? (
//           <div style={{ padding: '40px 24px', textAlign: 'center' }}>
//             <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
//             <div style={{ fontSize: '17px', fontWeight: 700, color: '#111b21', marginBottom: '6px' }}>Email Sent!</div>
//             <div style={{ fontSize: '13px', color: '#667781', marginBottom: '24px' }}>Your message was sent to <strong>{to}</strong></div>
//             <button type="button" onClick={onClose} style={{ background: '#00a884', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 28px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
//           </div>
//         ) : (
//           <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
//             <div>
//               <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>To</label>
//               <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="customer@example.com" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e9edef', borderRadius: '8px', fontSize: '14px', color: '#111b21', outline: 'none', boxSizing: 'border-box', background: '#f9fafb' }} onFocus={e => e.target.style.borderColor = '#00a884'} onBlur={e => e.target.style.borderColor = '#e9edef'} />
//             </div>
//             <div>
//               <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>Subject</label>
//               <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Your order tracking update" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e9edef', borderRadius: '8px', fontSize: '14px', color: '#111b21', outline: 'none', boxSizing: 'border-box', background: '#f9fafb' }} onFocus={e => e.target.style.borderColor = '#00a884'} onBlur={e => e.target.style.borderColor = '#e9edef'} />
//             </div>
//             <div>
//               <label style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54', display: 'block', marginBottom: '5px' }}>Message</label>
//               <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message here..." rows={6} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e9edef', borderRadius: '8px', fontSize: '14px', color: '#111b21', outline: 'none', boxSizing: 'border-box', background: '#f9fafb', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} onFocus={e => e.target.style.borderColor = '#00a884'} onBlur={e => e.target.style.borderColor = '#e9edef'} />
//               <div style={{ fontSize: '11px', color: '#aab8c2', textAlign: 'right', marginTop: '3px' }}>{body.length} chars</div>
//             </div>
//             {error && <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c53030' }}>⚠️ {error}</div>}
//             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
//               <button type="button" onClick={onClose} disabled={sending} style={{ background: '#f0f2f5', border: '1px solid #e9edef', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 500, cursor: sending ? 'not-allowed' : 'pointer', color: '#3b4a54' }}>Cancel</button>
//               <button type="button" onClick={handleSend} disabled={sending || !to.trim() || !subject.trim() || !body.trim()} style={{ background: sending || !to.trim() || !subject.trim() || !body.trim() ? 'rgba(0,168,132,0.45)' : '#00a884', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(0,168,132,0.3)' }}>{sending ? <>⏳ Sending…</> : <>✉️ Send Email</>}</button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ============ HELPERS ============
// const parseFileData = (raw) => {
//   if (!raw) return null;
//   if (typeof raw === 'object') return raw;
//   try { return JSON.parse(raw); } catch { return null; }
// };

// const normalizeMessage = (msg) => ({
//   ...msg,
//   fileData: parseFileData(msg.fileData || msg.file_data),
// });

// // ============ CROSS-STORE BANNER ============
// function CrossStoreBanner({ linkedData, currentStoreIdentifier, onViewHistory }) {
//   const [dismissed, setDismissed] = useState(false);

//   const otherStores = linkedData?.linkedConversations?.filter(
//     g => g.storeIdentifier !== currentStoreIdentifier
//   ) || [];

//   if (dismissed || otherStores.length === 0) return null;

//   const storeNames = otherStores.map(g => g.storeName || g.storeIdentifier);
//   const label = storeNames.length === 1
//     ? storeNames[0]
//     : storeNames.length === 2
//       ? `${storeNames[0]} & ${storeNames[1]}`
//       : `${storeNames[0]} +${storeNames.length - 1} more`;

//   return (
//     <div style={{
//       background: 'linear-gradient(90deg, #0f4c3a 0%, #1a6b52 100%)',
//       padding: '7px 14px',
//       display: 'flex', alignItems: 'center', gap: '10px',
//       animation: 'bannerFadeIn 0.3s ease',
//       flexShrink: 0,
//     }}>
//       <span style={{ fontSize: '14px', flexShrink: 0 }}>🏪</span>
//       <div style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'rgba(255,255,255,0.92)' }}>
//         <strong style={{ color: '#fff' }}>Returning customer</strong>
//         {' · also chatted from '}
//         <strong style={{ color: '#6ee7b7' }}>{label}</strong>
//       </div>
//       <button
//         type="button"
//         onClick={onViewHistory}
//         style={{ background: 'rgba(110,231,183,0.18)', border: '1px solid rgba(110,231,183,0.4)', borderRadius: '6px', color: '#6ee7b7', fontSize: '11px', fontWeight: 600, padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}
//         onMouseEnter={e => e.currentTarget.style.background = 'rgba(110,231,183,0.28)'}
//         onMouseLeave={e => e.currentTarget.style.background = 'rgba(110,231,183,0.18)'}
//       >
//         View history
//       </button>
//       <button type="button" onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '14px', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }} title="Dismiss">✕</button>
//     </div>
//   );
// }

// // ============ STORE JOURNEY BADGE ============
// // Shows previous store(s) → current store beside the customer name in header
// function StoreJourneyBadge({ linkedData, currentStoreIdentifier }) {
//   if (!linkedData || !linkedData.linkedConversations?.length) return null;

//   const otherStores = linkedData.linkedConversations
//     .filter(g => g.storeIdentifier !== currentStoreIdentifier)
//     .map(g => g.storeName || g.storeIdentifier);

//   if (otherStores.length === 0) return null;

//   return (
//     <span style={{
//       marginLeft: '10px',
//       fontSize: '11px',
//       fontWeight: 500,
//       display: 'inline-flex',
//       alignItems: 'center',
//       gap: '4px',
//       verticalAlign: 'middle',
//       flexWrap: 'wrap',
//     }}>
//       {/* Previous store(s) — yellow */}
//       {otherStores.map((store) => (
//         <span key={store} style={{
//           background: '#fff8e1',
//           border: '1px solid #ffe082',
//           borderRadius: '4px',
//           padding: '1px 6px',
//           color: '#b45309',
//           fontSize: '10px',
//           fontWeight: 600,
//           whiteSpace: 'nowrap',
//         }}>
//           {store}
//         </span>
//       ))}
//       {/* Arrow */}
//       <span style={{ color: '#aab8c2', fontSize: '12px', lineHeight: 1 }}>→</span>
//       {/* Current store — green */}
//       <span style={{
//         background: '#dcfce7',
//         border: '1px solid #86efac',
//         borderRadius: '4px',
//         padding: '1px 6px',
//         color: '#16a34a',
//         fontSize: '10px',
//         fontWeight: 600,
//         whiteSpace: 'nowrap',
//       }}>
//         {currentStoreIdentifier || 'current'}
//       </span>
//     </span>
//   );
// }

// // ============ MAIN COMPONENT ============
// function ChatWindow({
//   conversation,
//   onSendMessage,
//   onClose,
//   onTyping,
//   employeeName,
//   onMenuToggle,
//   stores,
//   isAdmin = false,
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
//   const [showAISuggestions, setShowAISuggestions] = useState(true);
//   const [messageToDelete, setMessageToDelete] = useState(null);
//   const [deletingMessage, setDeletingMessage] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [filePreview, setFilePreview] = useState(null);
//   const [uploading, setUploading] = useState(false);
//   const [uploadProgress, setUploadProgress] = useState(0);
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [templates, setTemplates] = useState([]);
//   const [templateLoading, setTemplateLoading] = useState(false);
//   const [showQuickReplies, setShowQuickReplies] = useState(false);
//   const [showEmailModal, setShowEmailModal] = useState(false);
//   const [legalAlert, setLegalAlert] = useState(null);
//   const legalDismissTimerRef = useRef(null);

//   // ── Cross-store state ──────────────────────────────────────────────────────
//   const [linkedData, setLinkedData] = useState(null);
//   const [showCrossStoreHistory, setShowCrossStoreHistory] = useState(false);

//   const messagesEndRef = useRef(null);
//   const textareaRef = useRef(null);
//   const fileInputRef = useRef(null);
//   const typingTimeoutRef = useRef(null);
//   const wsRef = useRef(null);
//   const displayedMessageIds = useRef(new Set());
//   const reconnectTimeoutRef = useRef(null);
//   const reconnectAttempts = useRef(0);
//   const maxReconnectAttempts = 5;
//   const hasAuthenticated = useRef(false);
//   const hasJoined = useRef(false);
//   const activeNotificationsRef = useRef(new Map());
//   const pollIntervalRef = useRef(null);
//   const conversationRef = useRef(conversation);
//   const employeeNameRef = useRef(employeeName);
//   const handleWsMessageRef = useRef(null);

//   useEffect(() => { loadTemplates(); }, []);
//   useEffect(() => { conversationRef.current = conversation; }, [conversation]);
//   useEffect(() => { employeeNameRef.current = employeeName; }, [employeeName]);
//   useEffect(() => {
//     return () => { if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current); };
//   }, []);

//   // ── Fetch cross-store history whenever conversation/email changes ──────────
//   useEffect(() => {
//     setLinkedData(null);
//     setShowCrossStoreHistory(false);
//     if (!conversation?.customerEmail) return;
//     let cancelled = false;
//     (async () => {
//       try {
//         const result = await api.getLinkedConversations(
//           conversation.customerEmail,
//           conversation.id
//         );
//         if (!cancelled) setLinkedData(result);
//       } catch (err) {
//         console.warn('[CrossStore] Failed to load:', err);
//       }
//     })();
//     return () => { cancelled = true; };
//   }, [conversation?.id, conversation?.customerEmail]);

//   const loadTemplates = async () => {
//     try {
//       const data = await api.getTemplates();
//       setTemplates(Array.isArray(data) ? data : []);
//     } catch (error) {
//       console.error('Failed to load templates:', error);
//       setTemplates([]);
//     }
//   };

//   const handleSendEmail = async ({ to, subject, body }) => {
//     await api.sendEmail({ to, subject, body, conversationId: conversation?.id, customerName: conversation?.customerName });
//   };

//   const handleUseTemplate = (content) => {
//     setMessageText(content);
//     if (textareaRef.current) textareaRef.current.focus();
//   };

//   const handleAddQuickReply = async ({ name, content }) => {
//     const newTemplate = await api.createTemplate({ name, content });
//     setTemplates(prev => [...prev, newTemplate]);
//   };

//   const handleSaveQuickReply = async (templateId, { name, content }) => {
//     const updated = await api.updateTemplate(templateId, { name, content });
//     setTemplates(prev => prev.map(t => t.id === templateId ? updated : t));
//   };

//   const handleDeleteQuickReply = async (templateId) => {
//     await api.deleteTemplate(templateId);
//     setTemplates(prev => prev.filter(t => t.id !== templateId));
//   };

//   const handleEmojiSelect = (emoji) => {
//     const textarea = textareaRef.current;
//     if (textarea) {
//       const start = textarea.selectionStart;
//       const end = textarea.selectionEnd;
//       const newText = messageText.slice(0, start) + emoji + messageText.slice(end);
//       setMessageText(newText);
//       setTimeout(() => {
//         textarea.focus();
//         textarea.selectionStart = start + emoji.length;
//         textarea.selectionEnd = start + emoji.length;
//       }, 0);
//     } else {
//       setMessageText(prev => prev + emoji);
//     }
//   };

//   const handleDeleteMessageClick = (message) => { setMessageToDelete(message); };
//   const handleCancelMessageDelete = () => { setMessageToDelete(null); };

//   const handleConfirmMessageDelete = async () => {
//     if (!messageToDelete) return;
//     try {
//       setDeletingMessage(true);
//       await api.deleteMessage(messageToDelete.id);
//       displayedMessageIds.current.delete(String(messageToDelete.id));
//       setMessages(prev => prev.filter(m => String(m.id) !== String(messageToDelete.id)));
//       setMessageToDelete(null);
//     } catch (error) {
//       console.error('Failed to delete message:', error);
//       alert(`Failed to delete message: ${error.message}`);
//     } finally {
//       setDeletingMessage(false);
//     }
//   };

//   const handleAttachClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

//   const handleFileSelect = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     if (file.size > 10 * 1024 * 1024) { alert('File size must be less than 10MB'); return; }
//     setSelectedFile(file);
//     if (file.type.startsWith('image/')) {
//       const reader = new FileReader();
//       reader.onload = (e) => setFilePreview({ type: 'image', url: e.target.result, name: file.name });
//       reader.readAsDataURL(file);
//     } else {
//       setFilePreview({ type: 'file', name: file.name, size: formatFileSize(file.size) });
//     }
//   };

//   const handleRemoveFile = () => {
//     setSelectedFile(null);
//     setFilePreview(null);
//     if (fileInputRef.current) fileInputRef.current.value = '';
//   };

//   const formatFileSize = (bytes) => {
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
//   };

//   const uploadFileToBunny = async (file) => {
//     try {
//       setUploading(true);
//       setUploadProgress(0);
//       const formData = new FormData();
//       formData.append('file', file);
//       const response = await api.uploadFile(formData, (progressEvent) => {
//         setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
//       });
//       return response;
//     } catch (error) {
//       console.error('❌ File upload failed:', error);
//       throw error;
//     } finally {
//       setUploading(false);
//       setUploadProgress(0);
//     }
//   };

//   const handleSelectSuggestion = (suggestion) => {
//     setMessageText(suggestion);
//     if (textareaRef.current) {
//       textareaRef.current.focus();
//       setTimeout(() => {
//         if (textareaRef.current) {
//           textareaRef.current.style.height = 'auto';
//           textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
//         }
//       }, 0);
//     }
//   };

//   // ============ WEBSOCKET ============
//   const getWsUrl = () => {
//     let baseUrl = api.baseUrl || import.meta.env.VITE_API_URL || '';
//     if (!baseUrl) baseUrl = window.location.origin;
//     baseUrl = baseUrl.replace(/\/$/, '');
//     return baseUrl.replace(/^http/, 'ws') + '/ws';
//   };

//   const connectWebSocket = () => {
//     disconnectWebSocket();
//     if (!conversationRef.current?.id) return;
//     const token = localStorage.getItem('token');
//     if (!token) { console.error('❌ [WS] No auth token found'); return; }
//     try {
//       const wsUrl = getWsUrl();
//       hasAuthenticated.current = false;
//       hasJoined.current = false;
//       const ws = new WebSocket(wsUrl);
//       wsRef.current = ws;
//       ws.onopen = () => {
//         reconnectAttempts.current = 0;
//         ws.send(JSON.stringify({ type: 'auth', token, clientType: 'agent' }));
//       };
//       ws.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
//           if (handleWsMessageRef.current) handleWsMessageRef.current(data);
//         } catch (error) { console.error('❌ [WS] Parse error:', error); }
//       };
//       ws.onerror = () => setWsConnected(false);
//       ws.onclose = (event) => {
//         setWsConnected(false);
//         hasAuthenticated.current = false;
//         hasJoined.current = false;
//         wsRef.current = null;
//         if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && conversationRef.current?.id) {
//           reconnectAttempts.current++;
//           const delay = Math.min(2000 * reconnectAttempts.current, 10000);
//           reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
//         }
//       };
//     } catch (error) {
//       console.error('❌ [WS] Connection failed:', error);
//       setWsConnected(false);
//     }
//   };

//   const disconnectWebSocket = () => {
//     if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
//     if (wsRef.current) {
//       const ws = wsRef.current;
//       wsRef.current = null;
//       hasAuthenticated.current = false;
//       hasJoined.current = false;
//       if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000, 'Component unmounting');
//     }
//     setWsConnected(false);
//   };

//   const showLegalAlert = (alert) => {
//     if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//     setLegalAlert(alert);
//     legalDismissTimerRef.current = setTimeout(() => setLegalAlert(null), 15000);
//   };

//   const dismissLegalAlert = () => {
//     if (legalDismissTimerRef.current) clearTimeout(legalDismissTimerRef.current);
//     setLegalAlert(null);
//   };

//   const handleWebSocketMessage = (data) => {
//     const currentConv = conversationRef.current;
//     const currentEmployeeName = employeeNameRef.current;
//     switch (data.type) {
//       case 'connected': break;
//       case 'auth_ok':
//         hasAuthenticated.current = true;
//         if (currentConv?.id && wsRef.current?.readyState === WebSocket.OPEN) {
//           wsRef.current.send(JSON.stringify({ type: 'join_conversation', conversationId: parseInt(currentConv.id), role: 'agent', employeeName: currentEmployeeName || 'Agent' }));
//         }
//         break;
//       case 'joined':
//         hasJoined.current = true;
//         setWsConnected(true);
//         break;
//       case 'new_message':
//         if (data.message) handleIncomingMessage(data.message, currentConv, currentEmployeeName);
//         break;
//       case 'message_confirmed':
//         if (data.tempId && data.message) {
//           const confirmedMsg = normalizeMessage(data.message);
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId)
//               ? { ...confirmedMsg, fileData: confirmedMsg.fileData || msg.fileData, fileUrl: confirmedMsg.fileUrl || msg.fileUrl, sending: false, _optimistic: false }
//               : msg
//           ));
//           if (data.message.id) displayedMessageIds.current.add(String(data.message.id));
//         }
//         break;
//       case 'message_failed':
//         if (data.tempId) {
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId)
//               ? { ...msg, sending: false, failed: true, _optimistic: false }
//               : msg
//           ));
//         }
//         break;
//       case 'message_deleted':
//         if (data.messageId) {
//           displayedMessageIds.current.delete(String(data.messageId));
//           setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
//         }
//         break;
//       case 'legal_threat_detected': {
//         const alert = data.alert;
//         if (!alert) break;
//         console.warn(`🚨 [LEGAL] ${alert.severity?.toUpperCase()} — "${alert.matchedTerm}" in conv #${alert.conversationId}`);
//         playNotificationSound();
//         setTimeout(() => playNotificationSound(), 400);
//         if (String(alert.conversationId) === String(currentConv?.id)) {
//           showLegalAlert(alert);
//         } else {
//           if (Notification.permission === 'granted') {
//             const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : '🔔';
//             try {
//               const n = new Notification(`${emoji} Legal Threat — Conv #${alert.conversationId}`, {
//                 body: `${alert.severity?.toUpperCase()}: "${alert.matchedTerm}" from ${alert.senderName}`,
//                 icon: '/favicon.ico', requireInteraction: alert.severity === 'critical', tag: `legal-${alert.conversationId}`,
//               });
//               n.onclick = () => { window.focus(); n.close(); };
//               if (alert.severity !== 'critical') setTimeout(() => n.close(), 8000);
//             } catch (e) {}
//           }
//         }
//         break;
//       }
//       case 'typing': handleTypingIndicator(data); break;
//       case 'customer_left': setTypingUsers(new Set()); break;
//       case 'error':
//         console.error('❌ [WS] Server error:', data.message);
//         if (data.message?.includes('token') || data.message?.includes('auth')) {
//           hasAuthenticated.current = false;
//           hasJoined.current = false;
//           setWsConnected(false);
//         }
//         break;
//       default: break;
//     }
//   };

//   handleWsMessageRef.current = handleWebSocketMessage;

//   const handleIncomingMessage = (message, currentConv, currentEmployeeName) => {
//     const msgId = message.id;
//     const convId = message.conversationId || message.conversation_id;
//     if (convId && String(convId) !== String(currentConv?.id)) { showNotification(message); return; }
//     if (msgId && displayedMessageIds.current.has(String(msgId))) return;
//     if (message.senderType === 'agent' && currentEmployeeName && message.senderName === currentEmployeeName) {
//       if (msgId) displayedMessageIds.current.add(String(msgId));
//       return;
//     }
//     if (msgId) displayedMessageIds.current.add(String(msgId));
//     const normalized = normalizeMessage(message);
//     setMessages(prev => {
//       if (prev.some(m => String(m.id) === String(msgId))) return prev;
//       return [...prev, { ...normalized, sending: false, _optimistic: false }];
//     });
//     if (message.senderType === 'customer') showNotification(message);
//   };

//   const showNotification = (message) => {
//     if (!message || message.senderType === 'agent') return;
//     playNotificationSound();
//     if (Notification.permission === 'granted') createNotification(message);
//     else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') createNotification(message); });
//   };

//   const createNotification = (message) => {
//     try {
//       const senderName = message.senderName || message.customerName || 'Customer';
//       const content = message.content || (message.fileData ? '📎 Sent a file' : 'New message');
//       const notification = new Notification(`New message from ${senderName}`, {
//         body: content.substring(0, 100), icon: '/favicon.ico', tag: `msg-${message.id || Date.now()}`, requireInteraction: false
//       });
//       notification.onclick = () => { window.focus(); notification.close(); };
//       setTimeout(() => notification.close(), 5000);
//     } catch (error) { console.warn('Notification failed:', error); }
//   };

//   const clearAllNotifications = (conversationId) => {
//     const notifications = activeNotificationsRef.current.get(conversationId);
//     if (notifications) {
//       notifications.forEach(n => { try { n.close(); } catch (e) {} });
//       activeNotificationsRef.current.delete(conversationId);
//     }
//   };

//   const playNotificationSound = () => {
//     try {
//       const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//       const oscillator = audioContext.createOscillator();
//       const gainNode = audioContext.createGain();
//       oscillator.connect(gainNode);
//       gainNode.connect(audioContext.destination);
//       oscillator.frequency.value = 800;
//       oscillator.type = 'sine';
//       gainNode.gain.value = 0.1;
//       oscillator.start();
//       gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
//       oscillator.stop(audioContext.currentTime + 0.3);
//     } catch (error) {}
//   };

//   const handleTypingIndicator = (data) => {
//     if (data.senderType === 'agent') return;
//     const senderName = data.senderName || 'Customer';
//     if (data.isTyping) {
//       setTypingUsers(prev => new Set([...prev, senderName]));
//       setTimeout(() => setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; }), 5000);
//     } else {
//       setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; });
//     }
//   };

//   const sendTypingIndicator = (isTyping) => {
//     if (wsRef.current?.readyState === WebSocket.OPEN && conversationRef.current?.id && hasJoined.current) {
//       wsRef.current.send(JSON.stringify({ type: 'typing', conversationId: parseInt(conversationRef.current.id), isTyping, senderType: 'agent', senderName: employeeNameRef.current || 'Agent' }));
//     }
//   };

//   // ============ EFFECTS ============
//   useEffect(() => {
//     if (!conversation) { disconnectWebSocket(); return; }
//     connectWebSocket();
//     return () => disconnectWebSocket();
//   }, [conversation?.id, employeeName]);

//   useEffect(() => {
//     return () => { if (conversation?.id) clearAllNotifications(conversation.id); };
//   }, [conversation?.id]);

//   useEffect(() => {
//     if (conversation) { displayedMessageIds.current.clear(); loadMessages(); }
//     else { setMessages([]); setLoading(false); }
//     dismissLegalAlert();
//     setShowEmailModal(false);
//   }, [conversation?.id]);

//   useEffect(() => { scrollToBottom(); }, [messages]);

//   useEffect(() => {
//     if (textareaRef.current) {
//       textareaRef.current.style.height = 'auto';
//       textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
//     }
//   }, [messageText]);

//   useEffect(() => {
//     const pingInterval = setInterval(() => {
//       if (wsRef.current?.readyState === WebSocket.OPEN) {
//         wsRef.current.send(JSON.stringify({ type: 'ping' }));
//       }
//     }, 30000);
//     return () => clearInterval(pingInterval);
//   }, []);

//   useEffect(() => {
//     if (!conversation?.id) { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); return; }
//     pollIntervalRef.current = setInterval(async () => {
//       try {
//         const data = await api.getMessages(conversation.id);
//         const serverMessages = (Array.isArray(data) ? data : []).map(normalizeMessage);
//         setMessages(prev => {
//           const existingIds = new Set(prev.map(m => String(m.id)));
//           const newMessages = serverMessages.filter(m => m.id && !existingIds.has(String(m.id)) && !displayedMessageIds.current.has(String(m.id)));
//           if (newMessages.length === 0) return prev;
//           newMessages.forEach(m => { if (m.id) displayedMessageIds.current.add(String(m.id)); });
//           let updated = prev.map(existing => {
//             if (!String(existing.id).startsWith('temp-')) return existing;
//             const confirmed = serverMessages.find(s => s.content === existing.content && s.senderType === existing.senderType && !existingIds.has(String(s.id)));
//             if (confirmed) { displayedMessageIds.current.add(String(confirmed.id)); return { ...confirmed, sending: false, _optimistic: false }; }
//             return existing;
//           });
//           return [...updated, ...newMessages.map(m => ({ ...m, sending: false, _optimistic: false }))];
//         });
//       } catch (error) {}
//     }, 5000);
//     return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
//   }, [conversation?.id]);

//   const loadMessages = async () => {
//     try {
//       setLoading(true);
//       const data = await api.getMessages(conversation.id);
//       const messageArray = (Array.isArray(data) ? data : []).map(normalizeMessage);
//       messageArray.forEach(msg => { if (msg.id) displayedMessageIds.current.add(String(msg.id)); });
//       setMessages(messageArray);
//     } catch (error) {
//       console.error('Failed to load messages:', error);
//       setMessages([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

//   const handleSend = async (e) => {
//     if (e) { e.preventDefault(); e.stopPropagation(); }
//     const hasText = messageText.trim();
//     const hasFile = selectedFile;
//     if ((!hasText && !hasFile) || sending || uploading) return;
//     const text = messageText.trim();
//     try {
//       setSending(true);
//       let fileUrl = null;
//       let fileData = null;
//       if (selectedFile) {
//         const uploadResult = await uploadFileToBunny(selectedFile);
//         fileUrl = uploadResult.url;
//         fileData = { url: uploadResult.url, name: selectedFile.name, type: selectedFile.type, size: selectedFile.size };
//       }
//       setMessageText('');
//       handleRemoveFile();
//       setShowEmojiPicker(false);
//       if (textareaRef.current) textareaRef.current.style.height = 'auto';
//       sendTypingIndicator(false);
//       const optimisticMessage = {
//         id: `temp-${Date.now()}`,
//         conversationId: conversation.id,
//         senderType: 'agent',
//         senderName: employeeName || 'Agent',
//         content: text || '',
//         fileUrl, fileData,
//         createdAt: new Date().toISOString(),
//         _optimistic: true, sending: true,
//       };
//       setMessages(prev => [...prev, optimisticMessage]);
//       clearAllNotifications(conversation.id);
//       const sentMessage = await onSendMessage(conversation, text, fileData);
//       if (sentMessage.id) displayedMessageIds.current.add(String(sentMessage.id));
//       const normalizedSent = normalizeMessage(sentMessage);
//       const mergedMessage = { ...normalizedSent, fileUrl: normalizedSent.fileUrl || fileUrl, fileData: normalizedSent.fileData || fileData, sending: false };
//       setMessages(prev => prev.map(msg => msg._optimistic && msg.id === optimisticMessage.id ? mergedMessage : msg));
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
//     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
//     typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 2000);
//   };

//   const handleKeyPress = (e) => {
//     if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
//   };

//   const handleDeleteClick = () => setShowDeleteModal(true);
//   const handleCancelDelete = () => setShowDeleteModal(false);

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

//   const handleBackClick = () => { if (onClose) onClose(); };

//   const getInitials = (name) => {
//     if (!name) return 'G';
//     return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
//   };

//   const getGroupedMessages = () => {
//     if (!messages || messages.length === 0) return [];
//     return messages.map((message, index) => {
//       const prevMessage = index > 0 ? messages[index - 1] : null;
//       const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
//       return {
//         ...message,
//         isFirstInGroup: !prevMessage || prevMessage.senderType !== message.senderType,
//         isLastInGroup: !nextMessage || nextMessage.senderType !== message.senderType,
//       };
//     });
//   };

//   const getStoreDetails = () => {
//     if (!stores || !conversation) return null;
//     return stores.find(s =>
//       s.storeIdentifier === conversation.storeIdentifier ||
//       s.id === conversation.shopId ||
//       s.id === conversation.shop_id ||
//       s.storeIdentifier === conversation.store_identifier
//     ) || null;
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

//   const storeDetails = getStoreDetails();
//   const storeName = storeDetails?.brandName || conversation.storeName || conversation.storeIdentifier;
//   const storeDomain = storeDetails?.domain || storeDetails?.url || storeDetails?.storeDomain || storeDetails?.shopDomain || storeDetails?.myshopify_domain || conversation.domain || conversation.storeDomain || null;
//   const groupedMessages = getGroupedMessages();
//   const currentStoreId = conversation.storeIdentifier || conversation.store_identifier || storeName;

//   const legalBannerBg = legalAlert?.severity === 'critical' ? '#dc2626' : legalAlert?.severity === 'high' ? '#d97706' : '#2563eb';
//   const legalBannerEmoji = legalAlert?.severity === 'critical' ? '🚨' : legalAlert?.severity === 'high' ? '⚠️' : '🔔';

//   return (
//     <div className="chat-window" style={{ position: 'relative' }}>

//       {/* Send Email Modal */}
//       {showEmailModal && (
//         <SendEmailModal conversation={conversation} onClose={() => setShowEmailModal(false)} onSend={handleSendEmail} />
//       )}

//       {/* Cross-Store Banner */}
//       {linkedData && (
//         <CrossStoreBanner
//           linkedData={linkedData}
//           currentStoreIdentifier={currentStoreId}
//           onViewHistory={() => setShowCrossStoreHistory(v => !v)}
//         />
//       )}

//       {/* Legal Threat Banner */}
//       {legalAlert && (
//         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, background: legalBannerBg, color: 'white', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', animation: 'legalSlideDown 0.3s ease' }}>
//           <span style={{ fontSize: '22px', flexShrink: 0 }}>{legalBannerEmoji}</span>
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>
//               Legal Threat Detected — {legalAlert.severity?.toUpperCase()}
//               {legalAlert.fromAttachment && <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>📎 FROM FILE</span>}
//             </div>
//             <div style={{ fontSize: '12px', opacity: 0.92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {legalAlert.documentType ? `Document: ${legalAlert.documentType}` : `Matched: "${legalAlert.matchedTerm}"`}
//               {legalAlert.snippet && <span style={{ marginLeft: '8px', fontStyle: 'italic', opacity: 0.8 }}>· "{legalAlert.snippet.substring(0, 70)}{legalAlert.snippet.length > 70 ? '…' : ''}"</span>}
//             </div>
//           </div>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
//             <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>Priority → URGENT</span>
//             <button type="button" onClick={dismissLegalAlert} title="Dismiss" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>✕</button>
//           </div>
//         </div>
//       )}

//       {/* Header */}
//       <div className="chat-header" style={legalAlert ? { marginTop: '56px' } : {}}>
//         <div className="chat-header-left">
//           <button className="chat-back-btn-mobile" onClick={handleBackClick} aria-label="Back to conversations" type="button">←</button>
//           <div className="chat-header-avatar">{getInitials(conversation.customerName)}</div>
//           <div className="chat-header-info">
//             <h3>
//               {conversation.customerName || 'Guest'}

//               {/* Legal flag */}
//               {conversation.legalFlag && (
//                 <span title={`Legal flag: ${conversation.legalFlagSeverity}`} style={{ marginLeft: '6px', fontSize: '14px' }}>
//                   {conversation.legalFlagSeverity === 'critical' ? '🚨' : '⚠️'}
//                 </span>
//               )}

//               {/* Store journey: [abc.shop.com] → [pep.cs] */}
//               <StoreJourneyBadge linkedData={linkedData} currentStoreIdentifier={currentStoreId} />

//               {/* Cross-store toggle badge */}
//               {linkedData && linkedData.storeCount > 1 && (
//                 <span
//                   title={`This customer has conversations across ${linkedData.storeCount} stores`}
//                   onClick={() => setShowCrossStoreHistory(v => !v)}
//                   style={{
//                     marginLeft: '8px', fontSize: '11px',
//                     background: showCrossStoreHistory ? '#00a884' : '#e9edef',
//                     color: showCrossStoreHistory ? '#fff' : '#667781',
//                     padding: '2px 7px', borderRadius: '10px',
//                     cursor: 'pointer', fontWeight: 600,
//                     transition: 'all 0.15s', verticalAlign: 'middle',
//                   }}
//                 >
//                   🏪 {linkedData.storeCount} stores
//                 </span>
//               )}
//             </h3>
//             <div className="chat-header-subtitle">
//               {storeName && (
//                 <span className="store-info">
//                   <strong>{storeName}</strong>
//                   {storeDomain && ` • ${storeDomain}`}
//                 </span>
//               )}
//               <span className="customer-email-desktop">{storeName && ' • '}{conversation.customerEmail || 'No email'}</span>
//               <span style={{ color: wsConnected ? '#48bb78' : '#fc8181', marginLeft: '8px' }} title={wsConnected ? 'Connected' : 'Disconnected'}>●</span>
//             </div>
//           </div>
//         </div>
//         <div className="chat-actions">
//           <button className={`send-email-btn${!conversation.customerEmail ? ' send-email-btn--no-email' : ''}`} onClick={() => setShowEmailModal(true)} title={conversation.customerEmail ? `Send email to ${conversation.customerEmail}` : 'Send email (no email on file)'} type="button">
//             <svg className="send-email-btn__icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
//               <rect x="2" y="4.5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
//               <path d="M2 7l7.293 4.707a1 1 0 001.414 0L18 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
//             </svg>
//             <span className="send-email-btn__label">Send Email</span>
//             {!conversation.customerEmail && <span className="send-email-btn__dot" />}
//           </button>
//           <button className="icon-btn" onClick={() => setShowAISuggestions(!showAISuggestions)} title={showAISuggestions ? 'Hide AI suggestions' : 'Show AI suggestions'} type="button" style={{ color: showAISuggestions ? '#00a884' : undefined, fontStyle: 'normal' }}>✦</button>
//           <button className="icon-btn" onClick={() => setShowCustomerInfo(!showCustomerInfo)} title="Customer info" type="button">ℹ️</button>
//           <button className="icon-btn delete-btn" onClick={handleDeleteClick} title="Delete conversation" type="button">🗑️</button>
//         </div>
//       </div>

//       {/* Conversation Delete Modal */}
//       {showDeleteModal && (
//         <div className="modal-overlay" onClick={handleCancelDelete}>
//           <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🗑️ Delete Conversation</h3></div>
//             <div className="modal-body">
//               <p>Are you sure you want to delete this conversation?</p>
//               <div className="delete-warning">
//                 <p><strong>Customer:</strong> {conversation.customerName || 'Guest'}</p>
//                 <p><strong>Store:</strong> {storeName}</p>
//                 <p className="warning-text">⚠️ This action cannot be undone. All messages will be permanently deleted.</p>
//               </div>
//             </div>
//             <div className="modal-footer">
//               <button className="btn-cancel" onClick={handleCancelDelete} disabled={deleting} type="button">Cancel</button>
//               <button className="btn-delete" onClick={handleConfirmDelete} disabled={deleting} type="button">{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Message Delete Modal */}
//       {messageToDelete && (
//         <div className="modal-overlay" onClick={handleCancelMessageDelete}>
//           <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
//             <div className="modal-header"><h3>🗑️ Delete Message</h3></div>
//             <div className="modal-body">
//               <p>Remove this message permanently?</p>
//               {messageToDelete.content && (
//                 <div className="delete-warning">
//                   <p style={{ fontStyle: 'italic', color: '#667781', marginTop: 4 }}>
//                     "{messageToDelete.content.length > 120 ? messageToDelete.content.slice(0, 120) + '…' : messageToDelete.content}"
//                   </p>
//                 </div>
//               )}
//               <p className="warning-text" style={{ marginTop: 8 }}>⚠️ This cannot be undone.</p>
//             </div>
//             <div className="modal-footer">
//               <button className="btn-cancel" onClick={handleCancelMessageDelete} disabled={deletingMessage} type="button">Cancel</button>
//               <button className="btn-delete" onClick={handleConfirmMessageDelete} disabled={deletingMessage} type="button">{deletingMessage ? 'Deleting...' : 'Delete'}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Main content */}
//       <div className="chat-content" style={{ display: 'flex', flexDirection: 'row' }}>
//         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

//           {/* Cross-Store History Panel */}
//           {showCrossStoreHistory && conversation.customerEmail && (
//             <div style={{ borderBottom: '1px solid #e9edef', maxHeight: '340px', overflowY: 'auto', background: '#fafbfc', animation: 'historySlideDown 0.2s ease' }}>
//               <CrossStoreHistory
//                 customerEmail={conversation.customerEmail}
//                 currentConversationId={conversation.id}
//                 currentStoreIdentifier={currentStoreId}
//                 onOpenConversation={(convId, storeIdentifier) => {
//                   console.log('[CrossStore] Open conv', convId, 'from store', storeIdentifier);
//                 }}
//               />
//             </div>
//           )}

//           <div className="chat-messages" style={{ flex: 1 }}>
//             {loading ? (
//               <div className="empty-state"><div className="spinner"></div></div>
//             ) : messages.length === 0 ? (
//               <div className="empty-state">
//                 <div className="empty-state-icon">💬</div>
//                 <h3>No messages yet</h3>
//                 <p>Start the conversation by sending a message</p>
//               </div>
//             ) : (
//               <>
//                 {groupedMessages.map((message, index) => (
//                   <MessageBubble
//                     key={message.id || `msg-${index}`}
//                     message={message}
//                     nextMessage={index < groupedMessages.length - 1 ? groupedMessages[index + 1] : null}
//                     isAgent={message.senderType === 'agent'}
//                     isCustomer={message.senderType === 'customer'}
//                     showAvatar={true}
//                     isFirstInGroup={message.isFirstInGroup}
//                     isLastInGroup={message.isLastInGroup}
//                     sending={message.sending || message._optimistic}
//                     actionButton={
//                       isAdmin && !message._optimistic && message.senderType === 'agent' ? (
//                         <button type="button" onClick={() => handleDeleteMessageClick(message)} title="Delete message" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: 0, lineHeight: 1, transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'} onMouseLeave={e => e.currentTarget.style.color = '#ccc'}>🗑️</button>
//                       ) : null
//                     }
//                   />
//                 ))}
//                 {typingUsers.size > 0 && (
//                   <div className="typing-indicator">
//                     <div className="typing-indicator-avatar">{getInitials(Array.from(typingUsers)[0])}</div>
//                     <div className="typing-indicator-bubble">
//                       <div className="typing-dot"></div>
//                       <div className="typing-dot"></div>
//                       <div className="typing-dot"></div>
//                     </div>
//                   </div>
//                 )}
//                 <div ref={messagesEndRef} />
//               </>
//             )}
//           </div>

//           {showCustomerInfo && (
//             <CustomerInfo conversation={conversation} onClose={() => setShowCustomerInfo(false)} stores={stores} />
//           )}
//         </div>

//         {showAISuggestions && (
//           <AISuggestions conversation={conversation} messages={messages} onSelectSuggestion={handleSelectSuggestion} />
//         )}
//       </div>

//       {/* File Preview */}
//       {filePreview && (
//         <div style={{ padding: '12px 16px', backgroundColor: '#f5f6f6', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '12px' }}>
//           {filePreview.type === 'image'
//             ? <img src={filePreview.url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
//             : <div style={{ width: '60px', height: '60px', backgroundColor: '#00a884', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📎</div>
//           }
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.name}</div>
//             {filePreview.size && <div style={{ fontSize: '12px', color: '#667781' }}>{filePreview.size}</div>}
//           </div>
//           {uploading && <div style={{ fontSize: '12px', color: '#00a884' }}>{uploadProgress}%</div>}
//           <button onClick={handleRemoveFile} disabled={uploading} type="button" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: uploading ? 'not-allowed' : 'pointer', color: '#667781', padding: '4px 8px' }}>✕</button>
//         </div>
//       )}

//       {/* Quick Replies */}
//       <QuickReplies
//         templates={templates}
//         onUseTemplate={handleUseTemplate}
//         onAddTemplate={handleAddQuickReply}
//         onDeleteTemplate={handleDeleteQuickReply}
//         onSaveTemplate={handleSaveQuickReply}
//         loading={templateLoading}
//         isOpen={showQuickReplies}
//         onToggle={() => setShowQuickReplies(!showQuickReplies)}
//       />

//       {/* Input */}
//       <div style={{ background: '#f0f2f5', padding: '12px 16px', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'flex-end', gap: '8px', flexShrink: 0, boxShadow: '0 -1px 2px rgba(11,20,26,0.05)', position: 'relative' }}>
//         <button type="button" title="Quick replies" onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQuickReplies(!showQuickReplies); }} style={{ width: '40px', height: '40px', minWidth: '40px', flexShrink: 0, border: 'none', borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', padding: 0, color: showQuickReplies ? '#00a884' : '#54656f' }}>⚡</button>
//         <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
//           <textarea ref={textareaRef} className="chat-input" placeholder="Type a message..." value={messageText} onChange={handleTyping} onKeyDown={handleKeyPress} rows="1" disabled={sending || uploading} />
//           <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
//           {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
//         </div>
//         <button type="button" title="Emoji" onClick={e => { e.preventDefault(); e.stopPropagation(); setShowEmojiPicker(v => !v); }} style={{ width: '40px', height: '40px', minWidth: '40px', flexShrink: 0, border: 'none', borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', padding: 0, color: showEmojiPicker ? '#00a884' : '#54656f' }}>😊</button>
//         <button type="button" title="Attach file" onClick={handleAttachClick} disabled={uploading} style={{ width: '40px', height: '40px', minWidth: '40px', flexShrink: 0, border: 'none', borderRadius: '50%', background: 'transparent', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', padding: 0, color: '#54656f' }}>{uploading ? '⏳' : '📎'}</button>
//         <button type="button" title="Send message (Enter)" onClick={handleSend} disabled={(!messageText.trim() && !selectedFile) || sending || uploading} style={{ width: '44px', height: '44px', minWidth: '44px', flexShrink: 0, border: 'none', borderRadius: '50%', background: (!messageText.trim() && !selectedFile) || sending || uploading ? 'rgba(0,168,132,0.4)' : '#00a884', cursor: (!messageText.trim() && !selectedFile) || sending || uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', padding: 0, color: 'white', boxShadow: '0 2px 6px rgba(0,168,132,0.3)' }}>{sending ? '⏳' : '➤'}</button>
//       </div>

//       <style>{`
//         @keyframes legalSlideDown {
//           from { transform: translateY(-100%); opacity: 0; }
//           to   { transform: translateY(0);     opacity: 1; }
//         }
//         @keyframes bannerFadeIn {
//           from { opacity: 0; transform: translateY(-6px); }
//           to   { opacity: 1; transform: translateY(0); }
//         }
//         @keyframes historySlideDown {
//           from { opacity: 0; max-height: 0; }
//           to   { opacity: 1; max-height: 340px; }
//         }
//         @keyframes spin {
//           to { transform: rotate(360deg); }
//         }
//       `}</style>
//     </div>
//   );
// }

// export default ChatWindow;