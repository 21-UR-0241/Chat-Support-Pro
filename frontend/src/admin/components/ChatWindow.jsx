

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
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🔕'],
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
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

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

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    }
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
      // Restore cursor position after emoji insert
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = start + emoji.length;
        textarea.selectionEnd = start + emoji.length;
      }, 0);
    } else {
      setMessageText(prev => prev + emoji);
    }
    // Keep picker open for multi-select
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

  const handleWebSocketMessage = (data) => {
    const currentConv = conversationRef.current;
    const currentEmployeeName = employeeNameRef.current;
    switch (data.type) {
      case 'connected': break;
      case 'auth_ok':
        hasAuthenticated.current = true;
        if (currentConv?.id && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'join_conversation', conversationId: parseInt(currentConv.id), role: 'agent', employeeName: currentEmployeeName || 'Agent' }));
        }
        break;
      case 'joined': hasJoined.current = true; setWsConnected(true); break;
      case 'new_message':
        if (data.message) handleIncomingMessage(data.message, currentConv, currentEmployeeName);
        break;
      case 'message_confirmed':
        if (data.tempId && data.message) {
          setMessages(prev => prev.map(msg =>
            String(msg.id) === String(data.tempId)
              ? { ...data.message, fileData: data.message.fileData || msg.fileData, fileUrl: data.message.fileUrl || msg.fileUrl, sending: false, _optimistic: false }
              : msg
          ));
          if (data.message.id) displayedMessageIds.current.add(String(data.message.id));
        }
        break;
      case 'message_failed':
        if (data.tempId) {
          setMessages(prev => prev.map(msg =>
            String(msg.id) === String(data.tempId) ? { ...msg, sending: false, failed: true, _optimistic: false } : msg
          ));
        }
        break;
      case 'typing': handleTypingIndicator(data); break;
      case 'customer_left': setTypingUsers(new Set()); break;
      case 'error':
        console.error('❌ [WS] Server error:', data.message);
        if (data.message?.includes('token') || data.message?.includes('auth')) {
          hasAuthenticated.current = false; hasJoined.current = false; setWsConnected(false);
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
    if (message.senderType === 'agent' && message.senderName === currentEmployeeName) {
      if (msgId) displayedMessageIds.current.add(String(msgId));
      return;
    }
    if (msgId) displayedMessageIds.current.add(String(msgId));
    setMessages(prev => {
      if (prev.some(m => String(m.id) === String(msgId))) return prev;
      return [...prev, { ...message, sending: false, _optimistic: false }];
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
      const notification = new Notification(`New message from ${senderName}`, { body: content.substring(0, 100), icon: '/favicon.ico', tag: `msg-${message.id || Date.now()}`, requireInteraction: false });
      notification.onclick = () => { window.focus(); notification.close(); };
      setTimeout(() => notification.close(), 5000);
    } catch (error) { console.warn('Notification failed:', error); }
  };

  const clearAllNotifications = (conversationId) => {
    const notifications = activeNotificationsRef.current.get(conversationId);
    if (notifications) { notifications.forEach(n => { try { n.close(); } catch (e) {} }); activeNotificationsRef.current.delete(conversationId); }
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode); gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800; oscillator.type = 'sine'; gainNode.gain.value = 0.1;
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
      setTimeout(() => setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; }), 5000);
    } else {
      setTypingUsers(prev => { const next = new Set(prev); next.delete(senderName); return next; });
    }
  };

  const sendTypingIndicator = (isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && conversationRef.current?.id && hasJoined.current) {
      wsRef.current.send(JSON.stringify({ type: 'typing', conversationId: parseInt(conversationRef.current.id), isTyping, senderType: 'agent', senderName: employeeNameRef.current || 'Agent' }));
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
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }, 30000);
    return () => clearInterval(pingInterval);
  }, []);

  useEffect(() => {
    if (!conversation?.id) { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); return; }
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await api.getMessages(conversation.id);
        const serverMessages = Array.isArray(data) ? data : [];
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const newMessages = serverMessages.filter(m => m.id && !existingIds.has(String(m.id)) && !displayedMessageIds.current.has(String(m.id)));
          if (newMessages.length === 0) return prev;
          newMessages.forEach(m => { if (m.id) displayedMessageIds.current.add(String(m.id)); });
          let updated = prev.map(existing => {
            if (!String(existing.id).startsWith('temp-')) return existing;
            const confirmed = serverMessages.find(s => s.content === existing.content && s.senderType === existing.senderType && !existingIds.has(String(s.id)));
            if (confirmed) { displayedMessageIds.current.add(String(confirmed.id)); return { ...confirmed, sending: false, _optimistic: false }; }
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
      const messageArray = Array.isArray(data) ? data : [];
      messageArray.forEach(msg => { if (msg.id) displayedMessageIds.current.add(msg.id); });
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
      const optimisticMessage = { id: `temp-${Date.now()}`, conversationId: conversation.id, senderType: 'agent', senderName: employeeName || 'Agent', content: text || '', fileUrl, fileData, createdAt: new Date().toISOString(), _optimistic: true, sending: true };
      setMessages(prev => [...prev, optimisticMessage]);
      clearAllNotifications(conversation.id);
      const sentMessage = await onSendMessage(conversation, text, fileData);
      if (sentMessage.id) displayedMessageIds.current.add(sentMessage.id);
      const mergedMessage = { ...sentMessage, fileUrl: sentMessage.fileUrl || fileUrl, fileData: sentMessage.fileData || fileData, sending: false };
      setMessages(prev => prev.map(msg => msg._optimistic && msg.id === optimisticMessage.id ? mergedMessage : msg));
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
      return { ...message, isFirstInGroup: !prevMessage || prevMessage.senderType !== message.senderType, isLastInGroup: !nextMessage || nextMessage.senderType !== message.senderType };
    });
  };

  const getStoreDetails = () => {
    if (!stores || !conversation) return null;
    return stores.find(s => s.storeIdentifier === conversation.storeIdentifier || s.id === conversation.shopId || s.id === conversation.shop_id || s.storeIdentifier === conversation.store_identifier) || null;
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

  return (
    <div className="chat-window" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="chat-back-btn-mobile" onClick={handleBackClick} aria-label="Back to conversations" type="button">←</button>
          <div className="chat-header-avatar">{getInitials(conversation.customerName)}</div>
          <div className="chat-header-info">
            <h3>{conversation.customerName || 'Guest'}</h3>
            <div className="chat-header-subtitle">
              {storeName && <span className="store-info"><strong>{storeName}</strong>{storeDomain && ` • ${storeDomain}`}</span>}
              <span className="customer-email-desktop">{storeName && ' • '}{conversation.customerEmail || 'No email'}</span>
              <span style={{ color: wsConnected ? '#48bb78' : '#fc8181', marginLeft: '8px' }} title={wsConnected ? 'Connected' : 'Disconnected'}>●</span>
            </div>
          </div>
        </div>
        <div className="chat-actions">
          <button className="icon-btn" onClick={() => setShowAISuggestions(!showAISuggestions)} title={showAISuggestions ? 'Hide AI suggestions' : 'Show AI suggestions'} type="button" style={{ color: showAISuggestions ? '#00a884' : undefined, fontStyle: 'normal' }}>✦</button>
          <button className="icon-btn" onClick={() => setShowCustomerInfo(!showCustomerInfo)} title="Customer info" type="button">ℹ️</button>
          <button className="icon-btn delete-btn" onClick={handleDeleteClick} title="Delete conversation" type="button">🗑️</button>
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
                      >
                        🗑️
                      </button>
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

          {showCustomerInfo && <CustomerInfo conversation={conversation} onClose={() => setShowCustomerInfo(false)} stores={stores} />}
        </div>

        {showAISuggestions && <AISuggestions conversation={conversation} messages={messages} onSelectSuggestion={handleSelectSuggestion} />}
      </div>

      {/* File Preview */}
      {filePreview && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f5f6f6', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <button onClick={handleRemoveFile} disabled={uploading} type="button" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: uploading ? 'not-allowed' : 'pointer', color: '#667781', padding: '4px 8px' }}>✕</button>
        </div>
      )}

      {/* Quick Replies */}
      <QuickReplies templates={templates} onUseTemplate={handleUseTemplate} onAddTemplate={handleAddQuickReply} onDeleteTemplate={handleDeleteQuickReply} onSaveTemplate={handleSaveQuickReply} loading={templateLoading} isOpen={showQuickReplies} onToggle={() => setShowQuickReplies(!showQuickReplies)} />

      {/* Input */}
      <div style={{
        background: '#f0f2f5', padding: '12px 16px', borderTop: '1px solid #e9edef',
        display: 'flex', alignItems: 'flex-end', gap: '8px',
        flexShrink: 0, boxShadow: '0 -1px 2px rgba(11,20,26,0.05)', position: 'relative',
      }}>
        {/* Quick replies */}
        <button
          type="button" title="Quick replies"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQuickReplies(!showQuickReplies); }}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: showQuickReplies ? '#00a884' : '#54656f',
          }}
        >⚡</button>

        {/* Textarea — emoji picker anchors here */}
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
          <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
          {showEmojiPicker && (
            <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
          )}
        </div>

        {/* Emoji */}
        <button
          type="button" title="Emoji"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowEmojiPicker(v => !v); }}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: showEmojiPicker ? '#00a884' : '#54656f',
          }}
        >😊</button>

        {/* Attach */}
        <button
          type="button" title="Attach file"
          onClick={handleAttachClick} disabled={uploading}
          style={{
            width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
            border: 'none', borderRadius: '50%', background: 'transparent',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', padding: 0,
            color: '#54656f',
          }}
        >{uploading ? '⏳' : '📎'}</button>

        {/* Send */}
        <button
          type="button" title="Send message (Enter)"
          onClick={handleSend}
          disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
          style={{
            width: '44px', height: '44px', minWidth: '44px', flexShrink: 0,
            border: 'none', borderRadius: '50%',
            background: (!messageText.trim() && !selectedFile) || sending || uploading ? 'rgba(0,168,132,0.4)' : '#00a884',
            cursor: (!messageText.trim() && !selectedFile) || sending || uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', padding: 0, color: 'white',
            boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
          }}
        >{sending ? '⏳' : '➤'}</button>
      </div>
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
//   {
//     label: '🐶 Animals',
//     emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗','🪳','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🪸','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🫏','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🫎','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔'],
//   },
//   {
//     label: '🍔 Food',
//     emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🍠','🫘','🥜','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾'],
//   },
//   {
//     label: '✈️ Travel',
//     emojis: ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','🛞','⛽','🚨','🚥','🚦','🛑','🚧','⚓','🛟','⛵','🚤','🛥','🛳','⛴','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰','🚀','🛸','🌍','🌎','🌏','🗺','🧭','🗻','🏔','❄️','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🧱','🪨','🪵','🛖','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩','🕋','⛲','⛺','🌁','🌃','🏙','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🎡','🎢','💈','🎪'],
//   },
//   {
//     label: '💼 Objects',
//     emojis: ['⌚','📱','📲','💻','⌨️','🖥','🖨','🖱','🖲','💾','💿','📀','🧮','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏱','⏲','⏰','🕰','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯','🪔','🧯','🛢','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','📌','📍','📎','🖇','📏','📐','✂️','🗃','🗄','🗑','🔒','🔓','🔏','🔐','🔑','🗝','🔨','🪓','⛏','⚒','🛠','🗡','⚔️','🔫','🪃','🏹','🛡','🪚','🔧','🪛','🔩','⚙️','🗜','⚖️','🦯','🔗','⛓','🪝','🧲','🪜','⚗️','🧪','🧫','🧬','🔭','🔬','🩺','🩻','💊','🩹','🩼','🩺','🩻','🏧','⛮','🚪','🛗','🪞','🪟','🛏','🛋','🪑','🚽','🪠','🚿','🛁','🪤','🪒','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🧯','🛒','🚪'],
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

//   // Email modal state
//   const [showEmailModal, setShowEmailModal] = useState(false);
//   const [emailSubject, setEmailSubject] = useState('');
//   const [emailBody, setEmailBody] = useState('');
//   const [sendingEmail, setSendingEmail] = useState(false);
//   const [emailSent, setEmailSent] = useState(false);

//   // Message delete state
//   const [messageToDelete, setMessageToDelete] = useState(null);
//   const [deletingMessage, setDeletingMessage] = useState(false);
//   const [hoveredMessageId, setHoveredMessageId] = useState(null);

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
//       // Restore cursor position after emoji insert
//       setTimeout(() => {
//         textarea.focus();
//         textarea.selectionStart = start + emoji.length;
//         textarea.selectionEnd = start + emoji.length;
//       }, 0);
//     } else {
//       setMessageText(prev => prev + emoji);
//     }
//     // Keep picker open for multi-select
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
//       case 'joined': hasJoined.current = true; setWsConnected(true); break;
//       case 'new_message':
//         if (data.message) handleIncomingMessage(data.message, currentConv, currentEmployeeName);
//         break;
//       case 'message_confirmed':
//         if (data.tempId && data.message) {
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId)
//               ? { ...data.message, fileData: data.message.fileData || msg.fileData, fileUrl: data.message.fileUrl || msg.fileUrl, sending: false, _optimistic: false }
//               : msg
//           ));
//           if (data.message.id) displayedMessageIds.current.add(String(data.message.id));
//         }
//         break;
//       case 'message_failed':
//         if (data.tempId) {
//           setMessages(prev => prev.map(msg =>
//             String(msg.id) === String(data.tempId) ? { ...msg, sending: false, failed: true, _optimistic: false } : msg
//           ));
//         }
//         break;
//       case 'typing': handleTypingIndicator(data); break;
//       case 'customer_left': setTypingUsers(new Set()); break;
//       case 'error':
//         console.error('❌ [WS] Server error:', data.message);
//         if (data.message?.includes('token') || data.message?.includes('auth')) {
//           hasAuthenticated.current = false; hasJoined.current = false; setWsConnected(false);
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
//     if (message.senderType === 'agent' && message.senderName === currentEmployeeName) {
//       if (msgId) displayedMessageIds.current.add(String(msgId));
//       return;
//     }
//     if (msgId) displayedMessageIds.current.add(String(msgId));
//     setMessages(prev => {
//       if (prev.some(m => String(m.id) === String(msgId))) return prev;
//       return [...prev, { ...message, sending: false, _optimistic: false }];
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
//       const notification = new Notification(`New message from ${senderName}`, { body: content.substring(0, 100), icon: '/favicon.ico', tag: `msg-${message.id || Date.now()}`, requireInteraction: false });
//       notification.onclick = () => { window.focus(); notification.close(); };
//       setTimeout(() => notification.close(), 5000);
//     } catch (error) { console.warn('Notification failed:', error); }
//   };

//   const clearAllNotifications = (conversationId) => {
//     const notifications = activeNotificationsRef.current.get(conversationId);
//     if (notifications) { notifications.forEach(n => { try { n.close(); } catch (e) {} }); activeNotificationsRef.current.delete(conversationId); }
//   };

//   const playNotificationSound = () => {
//     try {
//       const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//       const oscillator = audioContext.createOscillator();
//       const gainNode = audioContext.createGain();
//       oscillator.connect(gainNode); gainNode.connect(audioContext.destination);
//       oscillator.frequency.value = 800; oscillator.type = 'sine'; gainNode.gain.value = 0.1;
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
//       if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'ping' }));
//     }, 30000);
//     return () => clearInterval(pingInterval);
//   }, []);

//   useEffect(() => {
//     if (!conversation?.id) { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); return; }
//     pollIntervalRef.current = setInterval(async () => {
//       try {
//         const data = await api.getMessages(conversation.id);
//         const serverMessages = Array.isArray(data) ? data : [];
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
//       const messageArray = Array.isArray(data) ? data : [];
//       messageArray.forEach(msg => { if (msg.id) displayedMessageIds.current.add(msg.id); });
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
//       const optimisticMessage = { id: `temp-${Date.now()}`, conversationId: conversation.id, senderType: 'agent', senderName: employeeName || 'Agent', content: text || '', fileUrl, fileData, createdAt: new Date().toISOString(), _optimistic: true, sending: true };
//       setMessages(prev => [...prev, optimisticMessage]);
//       clearAllNotifications(conversation.id);
//       const sentMessage = await onSendMessage(conversation, text, fileData);
//       if (sentMessage.id) displayedMessageIds.current.add(sentMessage.id);
//       const mergedMessage = { ...sentMessage, fileUrl: sentMessage.fileUrl || fileUrl, fileData: sentMessage.fileData || fileData, sending: false };
//       setMessages(prev => prev.map(msg => msg._optimistic && msg.id === optimisticMessage.id ? mergedMessage : msg));
//     } catch (error) {
//       console.error('❌ Failed to send message:', error);
//       setMessages(prev => prev.filter(msg => !msg._optimistic));
//       setMessageText(messageText);
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

//   // ============ EMAIL HANDLER ============
//   const handleSendEmail = async () => {
//     if (!emailSubject.trim() || !emailBody.trim()) return;
//     try {
//       setSendingEmail(true);
//       await api.post('/email/send', {
//         to: conversation.customerEmail,
//         subject: emailSubject,
//         body: emailBody,
//         conversationId: conversation.id,
//         customerName: conversation.customerName,
//       });
//       setEmailSent(true);
//       setTimeout(() => {
//         setShowEmailModal(false);
//         setEmailSent(false);
//         setEmailSubject('');
//         setEmailBody('');
//       }, 1500);
//     } catch (err) {
//       alert('Failed to send email: ' + err.message);
//     } finally {
//       setSendingEmail(false);
//     }
//   };

//   const getInitials = (name) => {
//     if (!name) return 'G';
//     return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
//   };

//   const getGroupedMessages = () => {
//     if (!messages || messages.length === 0) return [];
//     return messages.map((message, index) => {
//       const prevMessage = index > 0 ? messages[index - 1] : null;
//       const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
//       return { ...message, isFirstInGroup: !prevMessage || prevMessage.senderType !== message.senderType, isLastInGroup: !nextMessage || nextMessage.senderType !== message.senderType };
//     });
//   };

//   const getStoreDetails = () => {
//     if (!stores || !conversation) return null;
//     return stores.find(s => s.storeIdentifier === conversation.storeIdentifier || s.id === conversation.shopId || s.id === conversation.shop_id || s.storeIdentifier === conversation.store_identifier) || null;
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

//   return (
//     <div className="chat-window" style={{ position: 'relative' }}>
//       {/* Header */}
//       <div className="chat-header">
//         <div className="chat-header-left">
//           <button className="chat-back-btn-mobile" onClick={handleBackClick} aria-label="Back to conversations" type="button">←</button>
//           <div className="chat-header-avatar">{getInitials(conversation.customerName)}</div>
//           <div className="chat-header-info">
//             <h3>{conversation.customerName || 'Guest'}</h3>
//             <div className="chat-header-subtitle">
//               {storeName && <span className="store-info"><strong>{storeName}</strong>{storeDomain && ` • ${storeDomain}`}</span>}
//               <span className="customer-email-desktop">{storeName && ' • '}{conversation.customerEmail || 'No email'}</span>
//               <span style={{ color: wsConnected ? '#48bb78' : '#fc8181', marginLeft: '8px' }} title={wsConnected ? 'Connected' : 'Disconnected'}>●</span>
//             </div>
//           </div>
//         </div>
//         <div className="chat-actions">
//           {isAdmin && conversation.customerEmail && (
//             <button
//               type="button"
//               onClick={() => { setShowEmailModal(true); setEmailSubject('Re: Your inquiry'); setEmailBody(''); }}
//               title={`Send email to ${conversation.customerEmail}`}
//               style={{
//                 display: 'flex', alignItems: 'center', gap: '5px',
//                 padding: '6px 12px', border: '1.5px solid #00a884',
//                 borderRadius: '20px', background: 'transparent',
//                 color: '#00a884', cursor: 'pointer', fontSize: '13px',
//                 fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s',
//                 flexShrink: 0,
//               }}
//               onMouseEnter={e => { e.currentTarget.style.background = '#00a884'; e.currentTarget.style.color = 'white'; }}
//               onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00a884'; }}
//             >
//               ✉️ <span>Send Email</span>
//             </button>
//           )}
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

//       {/* Email Modal */}
//       {showEmailModal && (
//         <div className="modal-overlay" onClick={() => { setShowEmailModal(false); setEmailSent(false); }}>
//           <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
//             <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//               <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111b21' }}>
//                 ✉️ Email to {conversation.customerName || 'Customer'}
//               </h3>
//               <span style={{ fontSize: '12px', color: '#667781', background: '#f0f2f5', padding: '3px 10px', borderRadius: '12px' }}>
//                 {conversation.customerEmail}
//               </span>
//             </div>
//             <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
//               <div>
//                 <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#54656f', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</label>
//                 <input
//                   type="text"
//                   value={emailSubject}
//                   onChange={e => setEmailSubject(e.target.value)}
//                   placeholder="Email subject..."
//                   style={{
//                     width: '100%', padding: '10px 14px', border: '1px solid #e9edef',
//                     borderRadius: '8px', fontSize: '14px', color: '#111b21',
//                     outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
//                   }}
//                   onFocus={e => e.target.style.borderColor = '#00a884'}
//                   onBlur={e => e.target.style.borderColor = '#e9edef'}
//                 />
//               </div>
//               <div>
//                 <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#54656f', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</label>
//                 <textarea
//                   value={emailBody}
//                   onChange={e => setEmailBody(e.target.value)}
//                   placeholder="Write your message here..."
//                   rows={7}
//                   style={{
//                     width: '100%', padding: '10px 14px', border: '1px solid #e9edef',
//                     borderRadius: '8px', fontSize: '14px', color: '#111b21', resize: 'vertical',
//                     outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.5',
//                   }}
//                   onFocus={e => e.target.style.borderColor = '#00a884'}
//                   onBlur={e => e.target.style.borderColor = '#e9edef'}
//                 />
//               </div>
//             </div>
//             <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
//               <span style={{ fontSize: '12px', color: '#aab4bc' }}>
//                 From your support team
//               </span>
//               <div style={{ display: 'flex', gap: '10px' }}>
//                 <button className="btn-cancel" onClick={() => { setShowEmailModal(false); setEmailSent(false); }} disabled={sendingEmail} type="button">Cancel</button>
//                 <button
//                   type="button"
//                   onClick={handleSendEmail}
//                   disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
//                   style={{
//                     background: emailSent ? '#48bb78' : '#00a884',
//                     color: 'white', border: 'none', padding: '10px 24px',
//                     borderRadius: '8px', fontSize: '14px', fontWeight: 600,
//                     cursor: sendingEmail || !emailSubject.trim() || !emailBody.trim() ? 'not-allowed' : 'pointer',
//                     opacity: !emailSubject.trim() || !emailBody.trim() ? 0.5 : 1,
//                     transition: 'background 0.2s',
//                   }}
//                 >
//                   {emailSent ? '✓ Sent!' : sendingEmail ? 'Sending...' : 'Send Email'}
//                 </button>
//               </div>
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
//               {groupedMessages.map((message, index) => (
//                 <MessageBubble
//                   key={message.id || `msg-${index}`}
//                   message={message}
//                   nextMessage={index < groupedMessages.length - 1 ? groupedMessages[index + 1] : null}
//                   isAgent={message.senderType === 'agent'}
//                   isCustomer={message.senderType === 'customer'}
//                   showAvatar={true}
//                   isFirstInGroup={message.isFirstInGroup}
//                   isLastInGroup={message.isLastInGroup}
//                   sending={message.sending || message._optimistic}
//                   actionButton={
//                     isAdmin && !message._optimistic && message.senderType === 'agent' ? (
//                       <button
//                         type="button"
//                         onClick={() => handleDeleteMessageClick(message)}
//                         title="Delete message"
//                         style={{
//                           background: 'none', border: 'none', cursor: 'pointer',
//                           fontSize: 13, color: '#ccc', padding: 0, lineHeight: 1,
//                           transition: 'color 0.15s',
//                         }}
//                         onMouseEnter={e => e.currentTarget.style.color = '#e53e3e'}
//                         onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
//                       >
//                         🗑️
//                       </button>
//                     ) : null
//                   }
//                 />
//               ))}
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

//           {showCustomerInfo && <CustomerInfo conversation={conversation} onClose={() => setShowCustomerInfo(false)} stores={stores} />}
//         </div>

//         {showAISuggestions && <AISuggestions conversation={conversation} messages={messages} onSelectSuggestion={handleSelectSuggestion} />}
//       </div>

//       {/* File Preview */}
//       {filePreview && (
//         <div style={{ padding: '12px 16px', backgroundColor: '#f5f6f6', borderTop: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '12px' }}>
//           {filePreview.type === 'image' ? (
//             <img src={filePreview.url} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
//           ) : (
//             <div style={{ width: '60px', height: '60px', backgroundColor: '#00a884', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📎</div>
//           )}
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.name}</div>
//             {filePreview.size && <div style={{ fontSize: '12px', color: '#667781' }}>{filePreview.size}</div>}
//           </div>
//           {uploading && <div style={{ fontSize: '12px', color: '#00a884' }}>{uploadProgress}%</div>}
//           <button onClick={handleRemoveFile} disabled={uploading} type="button" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: uploading ? 'not-allowed' : 'pointer', color: '#667781', padding: '4px 8px' }}>✕</button>
//         </div>
//       )}

//       {/* Quick Replies */}
//       <QuickReplies templates={templates} onUseTemplate={handleUseTemplate} onAddTemplate={handleAddQuickReply} onDeleteTemplate={handleDeleteQuickReply} onSaveTemplate={handleSaveQuickReply} loading={templateLoading} isOpen={showQuickReplies} onToggle={() => setShowQuickReplies(!showQuickReplies)} />

//       {/* Input */}
//       <div style={{
//         background: '#f0f2f5', padding: '12px 16px', borderTop: '1px solid #e9edef',
//         display: 'flex', alignItems: 'flex-end', gap: '8px',
//         flexShrink: 0, boxShadow: '0 -1px 2px rgba(11,20,26,0.05)', position: 'relative',
//       }}>
//         {/* Quick replies */}
//         <button
//           type="button" title="Quick replies"
//           onClick={e => { e.preventDefault(); e.stopPropagation(); setShowQuickReplies(!showQuickReplies); }}
//           style={{
//             width: '40px', height: '40px', minWidth: '40px', flexShrink: 0,
//             border: 'none', borderRadius: '50%', background: 'transparent',
//             cursor: 'pointer', display: 'flex', alignItems: 'center',
//             justifyContent: 'center', fontSize: '20px', padding: 0,
//             color: showQuickReplies ? '#00a884' : '#54656f',
//           }}
//         >⚡</button>

//         {/* Textarea — emoji picker anchors here */}
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
//           <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
//           {showEmojiPicker && (
//             <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
//           )}
//         </div>

//         {/* Emoji */}
//         <button
//           type="button" title="Emoji"
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
//           type="button" title="Attach file"
//           onClick={handleAttachClick} disabled={uploading}
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
//           type="button" title="Send message (Enter)"
//           onClick={handleSend}
//           disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
//           style={{
//             width: '44px', height: '44px', minWidth: '44px', flexShrink: 0,
//             border: 'none', borderRadius: '50%',
//             background: (!messageText.trim() && !selectedFile) || sending || uploading ? 'rgba(0,168,132,0.4)' : '#00a884',
//             cursor: (!messageText.trim() && !selectedFile) || sending || uploading ? 'not-allowed' : 'pointer',
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//             fontSize: '20px', padding: 0, color: 'white',
//             boxShadow: '0 2px 6px rgba(0,168,132,0.3)',
//           }}
//         >{sending ? '⏳' : '➤'}</button>
//       </div>
//     </div>
//   );
// }

// export default ChatWindow;