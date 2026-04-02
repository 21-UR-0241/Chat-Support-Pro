
// import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
// import '../styles/ConversationList.css';

// function ConversationList({
//   conversations,
//   activeConversation,
//   onSelectConversation,
//   onMarkAsRead,
//   onMarkAsUnread,
//   filters,
//   onFilterChange,
//   stores,
//   loading,
// }) {
//   const [notificationPermission, setNotificationPermission] = useState('default');
//   const [notificationsEnabled, setNotificationsEnabled] = useState(true);
//   const [soundEnabled, setSoundEnabled] = useState(true);
//   const [showNotificationSettings, setShowNotificationSettings] = useState(false);

//   const [toast, setToast] = useState(null);
//   const toastTimeoutRef = useRef(null);

//   const previousConversationsRef = useRef(null);

//   // Context menu state
//   const [contextMenu, setContextMenu] = useState(null); // { x, y, group }
//   const contextMenuRef = useRef(null);
//   // Once an agent replies to a group, it stays acknowledged — even if the
//   // customer sends another message afterward (which would flip lastSenderType back).
//   const acknowledgedGroupsRef = useRef(new Set());

//   useEffect(() => {
//     if ('Notification' in window) {
//       setNotificationPermission(Notification.permission);
//     }
//   }, []);

//   // Close context menu on outside click
//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
//         setContextMenu(null);
//       }
//     };
//     if (contextMenu) document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [contextMenu]);

//   // Close context menu on scroll
//   useEffect(() => {
//     const handleScroll = () => setContextMenu(null);
//     if (contextMenu) document.addEventListener('scroll', handleScroll, true);
//     return () => document.removeEventListener('scroll', handleScroll, true);
//   }, [contextMenu]);

//   const requestNotificationPermission = async () => {
//     if ('Notification' in window && Notification.permission === 'default') {
//       const permission = await Notification.requestPermission();
//       setNotificationPermission(permission);
//     }
//   };

//   const showToast = (text, type = 'default') => {
//     setToast({ text, type });
//     if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
//     toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
//   };

//   const playNotificationSound = () => {
//     if (!soundEnabled) return;
//     try {
//       const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//       const oscillator = audioContext.createOscillator();
//       const gainNode = audioContext.createGain();
//       oscillator.connect(gainNode);
//       gainNode.connect(audioContext.destination);
//       oscillator.frequency.value = 600;
//       oscillator.type = 'sine';
//       gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
//       gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
//       oscillator.start(audioContext.currentTime);
//       oscillator.stop(audioContext.currentTime + 0.3);
//     } catch (error) {
//       console.error('Error playing notification sound:', error);
//     }
//   };

//   const showNotification = (conversation, newMessage) => {
//     if (!notificationsEnabled || notificationPermission !== 'granted') return;
//     const title = conversation.customerName || 'New Message';
//     const options = {
//       body: newMessage || conversation.lastMessage || 'You have a new message',
//       icon: '/notification-icon.png',
//       badge: '/notification-badge.png',
//       tag: `conversation-${conversation.id}`,
//       requireInteraction: false,
//       silent: !soundEnabled,
//       data: { conversationId: conversation.id, url: window.location.href }
//     };
//     try {
//       const notification = new Notification(title, options);
//       notification.onclick = () => {
//         window.focus();
//         onSelectConversation(conversation);
//         notification.close();
//       };
//       setTimeout(() => notification.close(), 5000);
//     } catch (error) {
//       console.error('Error showing notification:', error);
//     }
//   };

//   // Detect new messages for notifications
//   useEffect(() => {
//     if (!conversations || loading) return;
//     const previousConversations = previousConversationsRef.current;

//     if (previousConversations) {
//       conversations.forEach((currentConv) => {
//         const previousConv = previousConversations.find(c => c.id === currentConv.id);
//         if (previousConv) {
//           const hasNewMessage =
//             (currentConv.unreadCount > previousConv.unreadCount) ||
//             (currentConv.lastMessage !== previousConv.lastMessage &&
//               currentConv.lastMessageAt !== previousConv.lastMessageAt);
//           if (hasNewMessage && currentConv.id !== activeConversation?.id) {
//             playNotificationSound();
//             showNotification(currentConv, currentConv.lastMessage);
//             if (currentConv.legalFlag) {
//               showToast(`🚨 Legal threat from ${currentConv.customerName || 'Guest'}`, 'legal');
//             } else {
//               showToast(`New message from ${currentConv.customerName || 'Guest'}`, 'default');
//             }
//           }
//         } else {
//           if (currentConv.unreadCount > 0) {
//             playNotificationSound();
//             showNotification(currentConv, currentConv.lastMessage);
//             showToast(`New conversation from ${currentConv.customerName || 'Guest'}`, 'default');
//           }
//         }
//       });
//     }

//     previousConversationsRef.current = conversations;
//   }, [conversations, activeConversation, loading, notificationsEnabled, soundEnabled]);

//   // Group conversations by email + store (name-independent)
//   const groupedConversations = useMemo(() => {
//     if (!conversations) return [];
//     const grouped = new Map();
//     conversations.forEach((conv) => {
//       // Skip archived and blacklisted at the grouping stage too
//       if (
//         conv.status === 'archived' ||
//         conv.status === 'blacklisted' ||
//         conv.status === 'blacklist'
//       ) return;

//       const email = (conv.customerEmail || '').toLowerCase().trim();
//       const storeId = conv.storeIdentifier || conv.shopId || '';
//       if (!email) {
//         const uniqueKey = `no-email-${conv.id}`;
//         grouped.set(uniqueKey, { conversations: [conv], mostRecent: conv, groupKey: uniqueKey });
//         return;
//       }
//       const groupKey = `${email}-${storeId}`;
//       if (grouped.has(groupKey)) {
//         const group = grouped.get(groupKey);
//         group.conversations.push(conv);
//         const currentTime = new Date(conv.lastMessageAt || 0);
//         const mostRecentTime = new Date(group.mostRecent.lastMessageAt || 0);
//         if (currentTime > mostRecentTime) group.mostRecent = conv;
//       } else {
//         grouped.set(groupKey, { conversations: [conv], mostRecent: conv, groupKey });
//       }
//     });
//     // return Array.from(grouped.values()).sort((a, b) => {
//     //   const aLegal = a.conversations.some(c => c.legalFlag);
//     //   const bLegal = b.conversations.some(c => c.legalFlag);
//     //   if (aLegal && !bLegal) return -1;
//     //   if (!aLegal && bLegal) return 1;

//     //   const aUrgent = a.conversations.some(c => c.priority === 'urgent');
//     //   const bUrgent = b.conversations.some(c => c.priority === 'urgent');
//     //   if (aUrgent && !bUrgent) return -1;
//     //   if (!aUrgent && bUrgent) return 1;

//     //   const timeA = new Date(a.mostRecent.lastMessageAt || 0);
//     //   const timeB = new Date(b.mostRecent.lastMessageAt || 0);
//     //   return timeB - timeA;
//     // });
//     return Array.from(grouped.values()).sort((a, b) => {
//   const timeA = new Date(a.mostRecent.lastMessageAt || 0);
//   const timeB = new Date(b.mostRecent.lastMessageAt || 0);
//   return timeB - timeA;
// });
//   }, [conversations]);

//   // ── Single source of truth for "admin already replied" ──────────────────
//   // Uses a persistent ref so a group stays acknowledged even after the customer
//   // sends another message (which would flip lastSenderType back to 'customer').
//   const adminHasReplied = useCallback((group) => {
//     // Already acknowledged this session — stays acknowledged
//     if (acknowledgedGroupsRef.current.has(group.groupKey)) return true;

//     const replied = group.conversations.some(conv => {
//       const senderType =
//         conv.lastSenderType ||
//         conv.lastMessageSenderType ||
//         conv.last_sender_type ||
//         conv.last_message_sender_type ||
//         '';
//       return senderType === 'agent';
//     });

//     if (replied) acknowledgedGroupsRef.current.add(group.groupKey);
//     return replied;
//   }, []);

//   // Build a set of ALL conversation IDs in the same group as the active conversation
//   const activeGroupConversationIds = useMemo(() => {
//     if (!activeConversation || !groupedConversations) return new Set();
//     const activeGroup = groupedConversations.find(group =>
//       group.conversations.some(c => c.id === activeConversation.id)
//     );
//     if (!activeGroup) return new Set([activeConversation.id]);
//     return new Set(activeGroup.conversations.map(c => c.id));
//   }, [activeConversation, groupedConversations]);

//   const getEffectiveUnread = useCallback((conv) => {
//     if (activeGroupConversationIds.has(conv.id)) return 0;
//     return conv.unreadCount || conv.unread_count || conv.unread || 0;
//   }, [activeGroupConversationIds]);

//   const getGroupUnread = useCallback((group) => {
//     return group.conversations.reduce((sum, c) => sum + getEffectiveUnread(c), 0);
//   }, [getEffectiveUnread]);

//   // Auto-mark ALL conversations in active group as read
//   useEffect(() => {
//     if (!activeConversation || !conversations || !onMarkAsRead) return;
//     if (activeGroupConversationIds.size === 0) return;
//     activeGroupConversationIds.forEach((convId) => {
//       const conv = conversations.find(c => c.id === convId);
//       if (!conv) return;
//       const unreadCount = conv.unreadCount || conv.unread_count || conv.unread || 0;
//       if (unreadCount > 0) onMarkAsRead(convId);
//     });
//   }, [activeConversation, conversations, onMarkAsRead, activeGroupConversationIds]);

//   // Filter grouped conversations
//   const filteredGroupedConversations = useMemo(() => {
//     if (!groupedConversations) return [];
//     return groupedConversations.filter((group) => {
//       const conv = group.mostRecent;
//       const search = filters.search?.toLowerCase();
//       if (search) {
//         const storeName = stores?.find(s =>
//           s.storeIdentifier === conv.storeIdentifier || s.id === conv.shopId
//         )?.name || conv.storeName || '';
//         const matchesSearch =
//           group.conversations.some(c => c.customerName?.toLowerCase().includes(search)) ||
//           conv.customerEmail?.toLowerCase().includes(search) ||
//           conv.customerId?.toLowerCase().includes(search) ||
//           conv.lastMessage?.toLowerCase().includes(search) ||
//           storeName.toLowerCase().includes(search) ||
//           conv.storeIdentifier?.toLowerCase().includes(search) ||
//           conv.shopId?.toString().toLowerCase().includes(search);
//         if (!matchesSearch) return false;
//       }
//       if (filters.status) {
//         if (!group.conversations.some(c => c.status === filters.status)) return false;
//       }
//       if (filters.storeId) {
//         const matchesStore = stores?.find(s =>
//           (s.storeIdentifier === filters.storeId) &&
//           (s.storeIdentifier === conv.storeIdentifier || s.id === conv.shopId)
//         );
//         if (!matchesStore) return false;
//       }
//       if (filters.priority) {
//         if (!group.conversations.some(c => c.priority === filters.priority)) return false;
//       }
//       if (filters.readStatus) {
//         const totalUnread = getGroupUnread(group);
//         const hasUnread = totalUnread > 0;
//         if (filters.readStatus === 'unread' && !hasUnread) return false;
//         if (filters.readStatus === 'read' && hasUnread) return false;
//       }
//       return true;
//     });
//   }, [groupedConversations, filters, stores, getGroupUnread]);

//   // Total unread — excludes active group
//   const totalUnread = useMemo(() => {
//     if (!conversations) return 0;
//     return conversations.reduce((sum, c) => sum + getEffectiveUnread(c), 0);
//   }, [conversations, getEffectiveUnread]);

//   // Urgent count in header — only groups where admin hasn't replied yet
//   const urgentCount = useMemo(() => {
//     if (!groupedConversations) return 0;
//     return groupedConversations.filter(g =>
//       !adminHasReplied(g) &&
//       g.conversations.some(c => c.legalFlag || c.priority === 'urgent')
//     ).length;
//   }, [groupedConversations, adminHasReplied]);

//   const formatTime = (date) => {
//     if (!date) return '';
//     try {
//       const now = new Date();
//       const messageDate = new Date(date);
//       const diffInHours = (now - messageDate) / (1000 * 60 * 60);
//       if (diffInHours < 24 && messageDate.getDate() === now.getDate()) {
//         return messageDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
//       }
//       const yesterday = new Date(now);
//       yesterday.setDate(yesterday.getDate() - 1);
//       if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
//       if (diffInHours < 168) return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
//       if (messageDate.getFullYear() === now.getFullYear()) {
//         return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
//       }
//       return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
//     } catch (e) {
//       return '';
//     }
//   };

//   const UserIcon = () => (
//     <svg viewBox="0 0 212 212" width="50" height="50">
//       <path fill="#DFE5E7" d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z" />
//       <g fill="#FFF">
//         <path d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.678 0 52.761-11.103 71.055-29.095v-.289s-.619-1.45-1.992-3.778a58.346 58.346 0 0 0-1.446-2.322zM106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-1.215-5.494 36.68 36.68 0 0 0-3.648-8.298 35.923 35.923 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342z" />
//       </g>
//     </svg>
//   );

//   const clearFilters = () => {
//     onFilterChange({ search: '', status: '', priority: '', storeId: '', readStatus: '' });
//   };

//   const handleGroupClick = (group) => {
//     onSelectConversation(group.mostRecent);
//     if (onMarkAsRead) {
//       group.conversations.forEach((conv) => {
//         const unread = conv.unreadCount || conv.unread_count || conv.unread || 0;
//         if (unread > 0) onMarkAsRead(conv.id);
//       });
//     }
//   };

//   const handleContextMenu = (e, group) => {
//     e.preventDefault();
//     e.stopPropagation();
//     // Clamp to viewport so menu never goes off-screen
//     const menuWidth = 200;
//     const menuHeight = 120;
//     const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
//     const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
//     setContextMenu({ x, y, group });
//   };

//   const hasActiveFilters = filters.status || filters.priority || filters.storeId || filters.readStatus;

//   // Helper: get legal severity for a group
//   const getGroupLegalSeverity = (group) => {
//     const severityOrder = ['critical', 'high', 'medium'];
//     for (const sev of severityOrder) {
//       if (group.conversations.some(c => c.legalFlag && c.legalFlagSeverity === sev)) return sev;
//     }
//     if (group.conversations.some(c => c.legalFlag)) return 'high';
//     return null;
//   };

//   // Helper: resolve store name from stores list
//   const resolveStoreName = (conv) => {
//     if (!stores || !stores.length) return conv.storeName || '';
//     const match = stores.find(s =>
//       s.storeIdentifier === conv.storeIdentifier ||
//       s.id === conv.shopId ||
//       s.shop_id === conv.shopId ||
//       String(s.id) === String(conv.shopId)
//     );
//     return (
//       match?.name ||
//       match?.storeName ||
//       match?.store_name ||
//       match?.brandName ||
//       match?.shopName ||
//       conv.storeName ||
//       ''
//     );
//   };

//   return (
//     <div className="conversation-list">
//       {/* ── Injected urgent styles ── */}
//       <style>{`
//         .urgent-section-header {
//           display: flex;
//           align-items: center;
//           gap: 6px;
//           padding: 6px 16px 4px;
//           font-size: 10px;
//           font-weight: 700;
//           letter-spacing: 0.8px;
//           text-transform: uppercase;
//           color: #dc2626;
//           background: #fff5f5;
//           border-bottom: 1px solid #fecaca;
//           border-top: 1px solid #fecaca;
//         }
//         .urgent-section-header .pulse-dot {
//           width: 7px;
//           height: 7px;
//           border-radius: 50%;
//           background: #dc2626;
//           animation: urgentPulse 1.4s ease-in-out infinite;
//           flex-shrink: 0;
//         }
//         @keyframes urgentPulse {
//           0%, 100% { opacity: 1; transform: scale(1); }
//           50% { opacity: 0.4; transform: scale(0.7); }
//         }

//         .conversation-item.legal-flag {
//           border-left: 3px solid #dc2626 !important;
//           background: linear-gradient(90deg, #fff5f5 0%, #ffffff 60%) !important;
//           position: relative;
//         }
//         .conversation-item.legal-flag::before {
//           content: '';
//           position: absolute;
//           left: 0; top: 0; bottom: 0;
//           width: 3px;
//           background: #dc2626;
//           animation: legalBorderPulse 2s ease-in-out infinite;
//         }
//         @keyframes legalBorderPulse {
//           0%, 100% { opacity: 1; }
//           50% { opacity: 0.5; }
//         }
//         .conversation-item.legal-flag.active {
//           background: linear-gradient(90deg, #fee2e2 0%, #fef2f2 60%) !important;
//         }

//         .conversation-item.urgent-flag {
//           border-left: 3px solid #f59e0b !important;
//           background: linear-gradient(90deg, #fffbeb 0%, #ffffff 60%) !important;
//         }
//         .conversation-item.urgent-flag.active {
//           background: linear-gradient(90deg, #fef3c7 0%, #fffbeb 60%) !important;
//         }

//         .legal-avatar-badge {
//           position: absolute;
//           top: -4px;
//           right: -4px;
//           font-size: 13px;
//           line-height: 1;
//           filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
//           animation: legalBadgePop 2s ease-in-out infinite;
//         }
//         @keyframes legalBadgePop {
//           0%, 100% { transform: scale(1); }
//           50% { transform: scale(1.18); }
//         }

//         .legal-tag-pill {
//           display: inline-flex;
//           align-items: center;
//           gap: 3px;
//           padding: 2px 7px;
//           border-radius: 4px;
//           font-size: 10px;
//           font-weight: 700;
//           letter-spacing: 0.4px;
//           text-transform: uppercase;
//           flex-shrink: 0;
//         }
//         .legal-tag-pill.critical { background: #dc2626; color: #fff; }
//         .legal-tag-pill.high     { background: #f59e0b; color: #fff; }
//         .legal-tag-pill.medium   { background: #2563eb; color: #fff; }

//         .urgent-tag-pill {
//           display: inline-flex;
//           align-items: center;
//           gap: 3px;
//           padding: 2px 7px;
//           border-radius: 4px;
//           font-size: 10px;
//           font-weight: 700;
//           letter-spacing: 0.4px;
//           text-transform: uppercase;
//           background: #f59e0b;
//           color: #fff;
//           flex-shrink: 0;
//         }

//         .toast-notice {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           padding: 10px 14px;
//           font-size: 13px;
//           font-weight: 500;
//           border-radius: 0;
//           animation: toastSlide 0.3s ease;
//         }
//         .toast-notice.legal   { background: #dc2626; color: #fff; font-weight: 600; }
//         .toast-notice.default { background: #f0f2f5; color: #111b21; border-bottom: 1px solid #e9edef; }
//         @keyframes toastSlide {
//           from { opacity: 0; transform: translateY(-8px); }
//           to   { opacity: 1; transform: translateY(0); }
//         }

//         .urgent-header-badge {
//           display: inline-flex;
//           align-items: center;
//           gap: 4px;
//           background: #dc2626;
//           color: #fff;
//           font-size: 10px;
//           font-weight: 700;
//           padding: 2px 7px;
//           border-radius: 10px;
//           margin-left: 6px;
//           letter-spacing: 0.3px;
//           animation: urgentPulse 1.4s ease-in-out infinite;
//         }

//         .conversation-top-row {
//           display: flex;
//           align-items: center;
//           justify-content: space-between;
//           gap: 6px;
//           flex-wrap: nowrap;
//         }
//         .conversation-name-badges {
//           display: flex;
//           align-items: center;
//           gap: 5px;
//           flex: 1;
//           min-width: 0;
//           overflow: hidden;
//         }
//         .conversation-name-badges h3 {
//           margin: 0;
//           white-space: nowrap;
//           overflow: hidden;
//           text-overflow: ellipsis;
//         }

//         /* ── Context menu ── */
//         .conv-context-menu {
//           position: fixed;
//           z-index: 9999;
//           background: #fff;
//           border: 1px solid #e9edef;
//           border-radius: 8px;
//           box-shadow: 0 4px 20px rgba(11,20,26,0.15);
//           min-width: 190px;
//           overflow: hidden;
//           animation: ctxFadeIn 0.12s ease;
//         }
//         @keyframes ctxFadeIn {
//           from { opacity: 0; transform: scale(0.96); }
//           to   { opacity: 1; transform: scale(1); }
//         }
//         .conv-context-menu button {
//           width: 100%;
//           text-align: left;
//           padding: 10px 16px;
//           border: none;
//           background: none;
//           cursor: pointer;
//           color: #111b21;
//           font-size: 13.5px;
//           display: flex;
//           align-items: center;
//           gap: 10px;
//           transition: background 0.1s;
//         }
//         .conv-context-menu button:hover {
//           background: #f0f2f5;
//         }
//         .conv-context-menu button.danger:hover {
//           background: #fff5f5;
//           color: #dc2626;
//         }
//         .conv-context-menu .ctx-divider {
//           height: 1px;
//           background: #e9edef;
//           margin: 3px 0;
//         }
//       `}</style>

//       <div className="conversation-list-header">
//         <h2>
//           Chats
//           {totalUnread > 0 && <span className="total-unread-badge">{totalUnread}</span>}
//           {urgentCount > 0 && (
//             <span className="urgent-header-badge">
//               🚨 {urgentCount} urgent
//             </span>
//           )}
//         </h2>
//         <div className="header-actions">
//           <button
//             className="notification-settings-btn"
//             onClick={() => setShowNotificationSettings(!showNotificationSettings)}
//             title="Notification settings"
//           >
//             <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
//               <path d="M10 2C9.45 2 9 2.45 9 3V3.5C7.16 4.08 5.82 5.75 5.82 7.75V11.5L4.5 13V14H15.5V13L14.18 11.5V7.75C14.18 5.75 12.84 4.08 11 3.5V3C11 2.45 10.55 2 10 2ZM10 17C10.83 17 11.5 16.33 11.5 15.5H8.5C8.5 16.33 9.17 17 10 17Z" fill="currentColor" />
//             </svg>
//             {notificationPermission === 'granted' && notificationsEnabled && (
//               <span className="notification-active-indicator"></span>
//             )}
//           </button>
//         </div>
//       </div>

//       {toast && (
//         <div className={`toast-notice ${toast.type || 'default'}`}>
//           <span className="toast-icon">{toast.type === 'legal' ? '🚨' : '🔔'}</span>
//           <span>{toast.text}</span>
//         </div>
//       )}

//       {showNotificationSettings && (
//         <div className="notification-settings-panel">
//           <div className="notification-setting-item">
//             <span>Browser Notifications</span>
//             {notificationPermission === 'granted' ? (
//               <label className="toggle-switch">
//                 <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />
//                 <span className="toggle-slider"></span>
//               </label>
//             ) : notificationPermission === 'denied' ? (
//               <span className="permission-status denied">Blocked</span>
//             ) : (
//               <button className="permission-request-btn" onClick={requestNotificationPermission}>Enable</button>
//             )}
//           </div>
//           <div className="notification-setting-item">
//             <span>Notification Sound</span>
//             <label className="toggle-switch">
//               <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
//               <span className="toggle-slider"></span>
//             </label>
//           </div>
//           {notificationPermission === 'denied' && (
//             <div className="permission-help">
//               <small>Notifications are blocked. Click the lock icon 🔒 in your browser's address bar, then change Notifications to "Allow" and reload.</small>
//             </div>
//           )}
//         </div>
//       )}

//       <div className="conversation-search">
//         <div className="search-wrapper">
//           <input
//             type="text"
//             className="search-input"
//             placeholder="Search or start new chat"
//             value={filters.search || ''}
//             onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
//           />
//           {filters.search && (
//             <button className="search-clear" onClick={() => onFilterChange({ ...filters, search: '' })} aria-label="Clear search">✕</button>
//           )}
//         </div>
//       </div>

//       <div className="read-status-tabs">
//         <button className={`read-status-tab ${!filters.readStatus ? 'active' : ''}`} onClick={() => onFilterChange({ ...filters, readStatus: '' })}>All</button>
//         <button className={`read-status-tab ${filters.readStatus === 'unread' ? 'active' : ''}`} onClick={() => onFilterChange({ ...filters, readStatus: 'unread' })}>
//           Unread
//           {totalUnread > 0 && <span className="tab-badge">{totalUnread}</span>}
//         </button>
//         <button className={`read-status-tab ${filters.readStatus === 'read' ? 'active' : ''}`} onClick={() => onFilterChange({ ...filters, readStatus: 'read' })}>Read</button>
//       </div>

//       <div className="conversation-filters">
//         {stores && stores.length > 0 && (
//           <select className="filter-select" value={filters.storeId || ''} onChange={(e) => onFilterChange({ ...filters, storeId: e.target.value })}>
//             <option value="">All Stores</option>
//             {stores.map((store) => (
//               <option key={store.id} value={store.storeIdentifier}>
//                 {store.name || store.storeName || store.brandName || store.shopName || store.storeIdentifier || store.id}
//               </option>
//             ))}
//           </select>
//         )}
//         {hasActiveFilters && <button className="filter-clear" onClick={clearFilters}>Clear</button>}
//       </div>

//       <div className="conversation-items">
//         {loading ? (
//           <div className="loading-state">
//             <div className="spinner"></div>
//             <p>Loading chats...</p>
//           </div>
//         ) : filteredGroupedConversations.length === 0 ? (
//           <div className="empty-conversations">
//             <div className="empty-icon">💬</div>
//             <h3>No chats</h3>
//             <p>{filters.search || hasActiveFilters ? 'No conversations match your search' : 'Start a new conversation'}</p>
//           </div>
//         ) : (
//           (() => {
//             const urgentGroups = filteredGroupedConversations.filter(g =>
//               !adminHasReplied(g) &&
//               g.conversations.some(c => c.legalFlag || c.priority === 'urgent')
//             );
//             const normalGroups = filteredGroupedConversations.filter(g =>
//               adminHasReplied(g) ||
//               !g.conversations.some(c => c.legalFlag || c.priority === 'urgent')
//             );

//             const renderGroup = (group) => {
//               const conversation = group.mostRecent;
//               const isActive = group.conversations.some(c => c.id === activeConversation?.id);
//               const totalGroupUnread = getGroupUnread(group);
//               const hasUnread = totalGroupUnread > 0;

//               const replied = adminHasReplied(group);

//               const legalSeverity = getGroupLegalSeverity(group);
//               const isLegal   = !!legalSeverity && !replied;
//               const isUrgent  = !isLegal && !replied && group.conversations.some(c => c.priority === 'urgent');

//               const storeName = resolveStoreName(conversation);

//               const displayName = group.conversations
//                 .map(c => (c.customerName || '').trim())
//                 .filter(Boolean)
//                 .sort((a, b) => b.length - a.length)[0] || 'Guest';

//               const itemClass = [
//                 'conversation-item',
//                 isActive  ? 'active'      : '',
//                 hasUnread ? 'unread'      : '',
//                 isLegal   ? 'legal-flag'  : '',
//                 isUrgent  ? 'urgent-flag' : '',
//               ].filter(Boolean).join(' ');

//               return (
//                 <div
//                   key={group.groupKey}
//                   className={itemClass}
//                   onClick={() => handleGroupClick(group)}
//                   onContextMenu={(e) => handleContextMenu(e, group)}
//                 >
//                   <div className="conversation-avatar" style={{ position: 'relative' }}>
//                     <UserIcon />
//                     {isLegal && (
//                       <span className="legal-avatar-badge">
//                         {legalSeverity === 'critical' ? '🚨' : '⚠️'}
//                       </span>
//                     )}
//                     {!isLegal && hasUnread && (
//                       <span className="avatar-badge">{totalGroupUnread}</span>
//                     )}
//                     {isLegal && hasUnread && (
//                       <span className="avatar-badge" style={{ background: '#dc2626' }}>{totalGroupUnread}</span>
//                     )}
//                   </div>

//                   <div className="conversation-details">
//                     <div className="conversation-top conversation-top-row">
//                       <div className="conversation-name-badges">
//                         <h3 className="conversation-name">{displayName}</h3>
//                         {isLegal && (
//                           <span className={`legal-tag-pill ${legalSeverity}`}>
//                             ⚖️ Legal
//                           </span>
//                         )}
//                         {isUrgent && !isLegal && (
//                           <span className="urgent-tag-pill">
//                             🔴 Urgent
//                           </span>
//                         )}
//                       </div>
//                       <span className="conversation-time">{formatTime(conversation.lastMessageAt)}</span>
//                     </div>

//                     {isLegal && conversation.legalFlagTerm && (
//                       <div style={{
//                         fontSize: '11px',
//                         color: legalSeverity === 'critical' ? '#dc2626' : '#d97706',
//                         fontWeight: 600,
//                         marginBottom: '2px',
//                         display: 'flex',
//                         alignItems: 'center',
//                         gap: '4px',
//                       }}>
//                         <span>⚠️</span>
//                         <span>Matched: "{conversation.legalFlagTerm}"</span>
//                       </div>
//                     )}

//                     <div className="conversation-meta">
//                       {storeName && <span className="store-badge">🏪 {storeName}</span>}
//                       {conversation.customerEmail && (
//                         <>
//                           {storeName && <span className="meta-separator">•</span>}
//                           <span className="customer-email">{conversation.customerEmail}</span>
//                         </>
//                       )}
//                       {hasUnread && <span className="meta-new-badge">NEW</span>}
//                     </div>

//                     <div className="conversation-bottom">
//                       <p className="conversation-preview">
//                         {(() => {
//                           if (conversation.lastMessage) {
//                             const isAgentMessage =
//                               conversation.lastSenderType === 'agent' ||
//                               conversation.lastMessageSenderType === 'agent' ||
//                               conversation.last_sender_type === 'agent' ||
//                               conversation.last_message_sender_type === 'agent';
//                             return (
//                               <>
//                                 {isAgentMessage && <span className="you-label">You: </span>}
//                                 {conversation.lastMessage}
//                               </>
//                             );
//                           }
//                           return 'No messages yet';
//                         })()}
//                       </p>
//                       {hasUnread && (
//                         <span
//                           className="unread-badge"
//                           style={isLegal ? { background: '#dc2626' } : undefined}
//                         >
//                           {totalGroupUnread}
//                         </span>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               );
//             };

//             return (
//               <>
//                 {urgentGroups.length > 0 && (
//                   <>
//                     <div className="urgent-section-header">
//                       <span className="pulse-dot" />
//                       Needs Immediate Attention ({urgentGroups.length})
//                     </div>
//                     {urgentGroups.map(renderGroup)}
//                     {normalGroups.length > 0 && (
//                       <div style={{
//                         padding: '5px 16px 4px',
//                         fontSize: '10px',
//                         fontWeight: 700,
//                         letterSpacing: '0.8px',
//                         textTransform: 'uppercase',
//                         color: '#8696a0',
//                         borderBottom: '1px solid #e9edef',
//                       }}>
//                         All Conversations
//                       </div>
//                     )}
//                   </>
//                 )}
//                 {normalGroups.map(renderGroup)}
//               </>
//             );
//           })()
//         )}
//       </div>

//       {/* ── Context Menu ── */}
//       {contextMenu && (
//         <div
//           ref={contextMenuRef}
//           className="conv-context-menu"
//           style={{ top: contextMenu.y, left: contextMenu.x }}
//         >
//           {(() => {
//             const group = contextMenu.group;
//             const totalUnreadInGroup = getGroupUnread(group);
//             const isRead = totalUnreadInGroup === 0;

//             return (
//               <>
//                 <button
//                   type="button"
//                   onClick={() => {
//                     handleGroupClick(group);
//                     setContextMenu(null);
//                   }}
//                 >
//                   <span style={{ fontSize: '15px' }}>💬</span> Open chat
//                 </button>

//                 <div className="ctx-divider" />

//                 {isRead ? (
//                   onMarkAsUnread && (
//                     <button
//                       type="button"
//                       onClick={() => {
//                         group.conversations.forEach(c => onMarkAsUnread(c.id));
//                         setContextMenu(null);
//                       }}
//                     >
//                       <span style={{ fontSize: '15px' }}>🔵</span> Mark as unread
//                     </button>
//                   )
//                 ) : (
//                   onMarkAsRead && (
//                     <button
//                       type="button"
//                       onClick={() => {
//                         group.conversations.forEach(c => onMarkAsRead(c.id));
//                         setContextMenu(null);
//                       }}
//                     >
//                       <span style={{ fontSize: '15px' }}>✓</span> Mark as read
//                     </button>
//                   )
//                 )}
//               </>
//             );
//           })()}
//         </div>
//       )}
//     </div>
//   );
// }

// export default ConversationList;





 


import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import '../styles/ConversationList.css';

function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,       // (conversationId) => void  — called for each conv in group
  onBlock,         // (conversationId) => void  — called for each conv in group
  filters,
  onFilterChange,
  stores,
  loading,
}) {
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const previousConversationsRef = useRef(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, group }
  const contextMenuRef = useRef(null);

  // Confirmation modal state — { type: 'archive'|'block', group, displayName }
  const [confirmModal, setConfirmModal] = useState(null);

  // Force re-render when a group is manually dismissed from urgent
  const [dismissTick, setDismissTick] = useState(0);

  const acknowledgedGroupsRef = useRef(new Set());

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  // Close context menu on scroll
  useEffect(() => {
    const handleScroll = () => setContextMenu(null);
    if (contextMenu) document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu]);

  // Close confirm modal on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setConfirmModal(null);
    };
    if (confirmModal) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [confirmModal]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const showToast = (text, type = 'default') => {
    setToast({ text, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
  };

  const playNotificationSound = () => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const showNotification = (conversation, newMessage) => {
    if (!notificationsEnabled || notificationPermission !== 'granted') return;
    const title = conversation.customerName || 'New Message';
    const options = {
      body: newMessage || conversation.lastMessage || 'You have a new message',
      icon: '/notification-icon.png',
      badge: '/notification-badge.png',
      tag: `conversation-${conversation.id}`,
      requireInteraction: false,
      silent: !soundEnabled,
      data: { conversationId: conversation.id, url: window.location.href }
    };
    try {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        onSelectConversation(conversation);
        notification.close();
      };
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  // Detect new messages for notifications
  useEffect(() => {
    if (!conversations || loading) return;
    const previousConversations = previousConversationsRef.current;

    if (previousConversations) {
      conversations.forEach((currentConv) => {
        const previousConv = previousConversations.find(c => c.id === currentConv.id);
        if (previousConv) {
          const hasNewMessage =
            (currentConv.unreadCount > previousConv.unreadCount) ||
            (currentConv.lastMessage !== previousConv.lastMessage &&
              currentConv.lastMessageAt !== previousConv.lastMessageAt);
          if (hasNewMessage && currentConv.id !== activeConversation?.id) {
            playNotificationSound();
            showNotification(currentConv, currentConv.lastMessage);
            if (currentConv.legalFlag) {
              showToast(`🚨 Legal threat from ${currentConv.customerName || 'Guest'}`, 'legal');
            } else {
              showToast(`New message from ${currentConv.customerName || 'Guest'}`, 'default');
            }
          }
        } else {
          if (currentConv.unreadCount > 0) {
            playNotificationSound();
            showNotification(currentConv, currentConv.lastMessage);
            showToast(`New conversation from ${currentConv.customerName || 'Guest'}`, 'default');
          }
        }
      });
    }

    previousConversationsRef.current = conversations;
  }, [conversations, activeConversation, loading, notificationsEnabled, soundEnabled]);

  // Group conversations by email + store — sorted purely by most recent
  const groupedConversations = useMemo(() => {
    if (!conversations) return [];
    const grouped = new Map();
    conversations.forEach((conv) => {
      if (
        conv.status === 'archived' ||
        conv.status === 'blacklisted' ||
        conv.status === 'blacklist'
      ) return;

      const email = (conv.customerEmail || '').toLowerCase().trim();
      const storeId = conv.storeIdentifier || conv.shopId || '';
      if (!email) {
        const uniqueKey = `no-email-${conv.id}`;
        grouped.set(uniqueKey, { conversations: [conv], mostRecent: conv, groupKey: uniqueKey });
        return;
      }
      const groupKey = `${email}-${storeId}`;
      if (grouped.has(groupKey)) {
        const group = grouped.get(groupKey);
        group.conversations.push(conv);
        const currentTime = new Date(conv.lastMessageAt || 0);
        const mostRecentTime = new Date(group.mostRecent.lastMessageAt || 0);
        if (currentTime > mostRecentTime) group.mostRecent = conv;
      } else {
        grouped.set(groupKey, { conversations: [conv], mostRecent: conv, groupKey });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const timeA = new Date(a.mostRecent.lastMessageAt || 0);
      const timeB = new Date(b.mostRecent.lastMessageAt || 0);
      return timeB - timeA;
    });
  }, [conversations]);

  const adminHasReplied = useCallback((group) => {
    if (acknowledgedGroupsRef.current.has(group.groupKey)) return true;
    const replied = group.conversations.some(conv => {
      const senderType =
        conv.lastSenderType ||
        conv.lastMessageSenderType ||
        conv.last_sender_type ||
        conv.last_message_sender_type ||
        '';
      return senderType === 'agent';
    });
    if (replied) acknowledgedGroupsRef.current.add(group.groupKey);
    return replied;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissTick]);

  const handleDismissUrgent = useCallback((e, groupKey) => {
    e.stopPropagation();
    acknowledgedGroupsRef.current.add(groupKey);
    setDismissTick(t => t + 1);
  }, []);

  const activeGroupConversationIds = useMemo(() => {
    if (!activeConversation || !groupedConversations) return new Set();
    const activeGroup = groupedConversations.find(group =>
      group.conversations.some(c => c.id === activeConversation.id)
    );
    if (!activeGroup) return new Set([activeConversation.id]);
    return new Set(activeGroup.conversations.map(c => c.id));
  }, [activeConversation, groupedConversations]);

  const getEffectiveUnread = useCallback((conv) => {
    if (activeGroupConversationIds.has(conv.id)) return 0;
    return conv.unreadCount || conv.unread_count || conv.unread || 0;
  }, [activeGroupConversationIds]);

  const getGroupUnread = useCallback((group) => {
    return group.conversations.reduce((sum, c) => sum + getEffectiveUnread(c), 0);
  }, [getEffectiveUnread]);

  useEffect(() => {
    if (!activeConversation || !conversations || !onMarkAsRead) return;
    if (activeGroupConversationIds.size === 0) return;
    activeGroupConversationIds.forEach((convId) => {
      const conv = conversations.find(c => c.id === convId);
      if (!conv) return;
      const unreadCount = conv.unreadCount || conv.unread_count || conv.unread || 0;
      if (unreadCount > 0) onMarkAsRead(convId);
    });
  }, [activeConversation, conversations, onMarkAsRead, activeGroupConversationIds]);

  const filteredGroupedConversations = useMemo(() => {
    if (!groupedConversations) return [];
    return groupedConversations.filter((group) => {
      const conv = group.mostRecent;
      const search = filters.search?.toLowerCase();
      if (search) {
        const storeName = stores?.find(s =>
          s.storeIdentifier === conv.storeIdentifier || s.id === conv.shopId
        )?.name || conv.storeName || '';
        const matchesSearch =
          group.conversations.some(c => c.customerName?.toLowerCase().includes(search)) ||
          conv.customerEmail?.toLowerCase().includes(search) ||
          conv.customerId?.toLowerCase().includes(search) ||
          conv.lastMessage?.toLowerCase().includes(search) ||
          storeName.toLowerCase().includes(search) ||
          conv.storeIdentifier?.toLowerCase().includes(search) ||
          conv.shopId?.toString().toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }
      if (filters.status) {
        if (!group.conversations.some(c => c.status === filters.status)) return false;
      }
      if (filters.storeId) {
        const matchesStore = stores?.find(s =>
          (s.storeIdentifier === filters.storeId) &&
          (s.storeIdentifier === conv.storeIdentifier || s.id === conv.shopId)
        );
        if (!matchesStore) return false;
      }
      if (filters.priority) {
        if (!group.conversations.some(c => c.priority === filters.priority)) return false;
      }
      if (filters.readStatus) {
        const totalUnread = getGroupUnread(group);
        const hasUnread = totalUnread > 0;
        if (filters.readStatus === 'unread' && !hasUnread) return false;
        if (filters.readStatus === 'read' && hasUnread) return false;
      }
      return true;
    });
  }, [groupedConversations, filters, stores, getGroupUnread]);

  const totalUnread = useMemo(() => {
    if (!conversations) return 0;
    return conversations.reduce((sum, c) => sum + getEffectiveUnread(c), 0);
  }, [conversations, getEffectiveUnread]);

  const urgentCount = useMemo(() => {
    if (!groupedConversations) return 0;
    return groupedConversations.filter(g =>
      !adminHasReplied(g) &&
      g.conversations.some(c => c.legalFlag || c.priority === 'urgent')
    ).length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedConversations, adminHasReplied, dismissTick]);

  const formatTime = (date) => {
    if (!date) return '';
    try {
      const now = new Date();
      const messageDate = new Date(date);
      const diffInHours = (now - messageDate) / (1000 * 60 * 60);
      if (diffInHours < 24 && messageDate.getDate() === now.getDate()) {
        return messageDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
      if (diffInHours < 168) return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
      if (messageDate.getFullYear() === now.getFullYear()) {
        return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const UserIcon = () => (
    <svg viewBox="0 0 212 212" width="50" height="50">
      <path fill="#DFE5E7" d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z" />
      <g fill="#FFF">
        <path d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.678 0 52.761-11.103 71.055-29.095v-.289s-.619-1.45-1.992-3.778a58.346 58.346 0 0 0-1.446-2.322zM106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-1.215-5.494 36.68 36.68 0 0 0-3.648-8.298 35.923 35.923 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342z" />
      </g>
    </svg>
  );

  const clearFilters = () => {
    onFilterChange({ search: '', status: '', priority: '', storeId: '', readStatus: '' });
  };

  const handleGroupClick = (group) => {
    onSelectConversation(group.mostRecent);
    if (onMarkAsRead) {
      group.conversations.forEach((conv) => {
        const unread = conv.unreadCount || conv.unread_count || conv.unread || 0;
        if (unread > 0) onMarkAsRead(conv.id);
      });
    }
  };

  const handleContextMenu = (e, group) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 210;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x, y, group });
  };

  // ── Archive confirm ─────────────────────────────────────────────────────
  const handleArchiveConfirm = () => {
    const { group } = confirmModal;
    if (onArchive) group.conversations.forEach(c => onArchive(c.id));
    showToast('📦 Conversation archived', 'default');
    setConfirmModal(null);
  };

  // ── Block confirm ───────────────────────────────────────────────────────
  const handleBlockConfirm = () => {
    const { group, displayName } = confirmModal;
    if (onBlock) group.conversations.forEach(c => onBlock(c.id));
    showToast(`🚫 ${displayName} has been blocked`, 'default');
    setConfirmModal(null);
  };

  const hasActiveFilters = filters.status || filters.priority || filters.storeId || filters.readStatus;

  const getGroupLegalSeverity = (group) => {
    const severityOrder = ['critical', 'high', 'medium'];
    for (const sev of severityOrder) {
      if (group.conversations.some(c => c.legalFlag && c.legalFlagSeverity === sev)) return sev;
    }
    if (group.conversations.some(c => c.legalFlag)) return 'high';
    return null;
  };

  const resolveStoreName = (conv) => {
    if (!stores || !stores.length) return conv.storeName || '';
    const match = stores.find(s =>
      s.storeIdentifier === conv.storeIdentifier ||
      s.id === conv.shopId ||
      s.shop_id === conv.shopId ||
      String(s.id) === String(conv.shopId)
    );
    return (
      match?.name ||
      match?.storeName ||
      match?.store_name ||
      match?.brandName ||
      match?.shopName ||
      conv.storeName ||
      ''
    );
  };

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>
          Chats
          {totalUnread > 0 && <span className="total-unread-badge">{totalUnread}</span>}
          {urgentCount > 0 && (
            <span className="urgent-header-badge">
              🚨 {urgentCount} urgent
            </span>
          )}
        </h2>
        <div className="header-actions">
          <button
            className="notification-settings-btn"
            onClick={() => setShowNotificationSettings(!showNotificationSettings)}
            title="Notification settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C9.45 2 9 2.45 9 3V3.5C7.16 4.08 5.82 5.75 5.82 7.75V11.5L4.5 13V14H15.5V13L14.18 11.5V7.75C14.18 5.75 12.84 4.08 11 3.5V3C11 2.45 10.55 2 10 2ZM10 17C10.83 17 11.5 16.33 11.5 15.5H8.5C8.5 16.33 9.17 17 10 17Z" fill="currentColor" />
            </svg>
            {notificationPermission === 'granted' && notificationsEnabled && (
              <span className="notification-active-indicator"></span>
            )}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`toast-notice ${toast.type || 'default'}`}>
          <span className="toast-icon">{toast.type === 'legal' ? '🚨' : '🔔'}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {showNotificationSettings && (
        <div className="notification-settings-panel">
          <div className="notification-setting-item">
            <span>Browser Notifications</span>
            {notificationPermission === 'granted' ? (
              <label className="toggle-switch">
                <input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            ) : notificationPermission === 'denied' ? (
              <span className="permission-status denied">Blocked</span>
            ) : (
              <button className="permission-request-btn" onClick={requestNotificationPermission}>Enable</button>
            )}
          </div>
          <div className="notification-setting-item">
            <span>Notification Sound</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>
          {notificationPermission === 'denied' && (
            <div className="permission-help">
              <small>Notifications are blocked. Click the lock icon 🔒 in your browser's address bar, then change Notifications to "Allow" and reload.</small>
            </div>
          )}
        </div>
      )}

      <div className="conversation-search">
        <div className="search-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search or start new chat"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button className="search-clear" onClick={() => onFilterChange({ ...filters, search: '' })} aria-label="Clear search">✕</button>
          )}
        </div>
      </div>

      <div className="read-status-tabs">
        <button className={`read-status-tab ${!filters.readStatus ? 'active' : ''}`} onClick={() => onFilterChange({ ...filters, readStatus: '' })}>All</button>
        <button className={`read-status-tab ${filters.readStatus === 'unread' ? 'active' : ''}`} onClick={() => onFilterChange({ ...filters, readStatus: 'unread' })}>
          Unread
          {totalUnread > 0 && <span className="tab-badge">{totalUnread}</span>}
        </button>
        <button className={`read-status-tab ${filters.readStatus === 'read' ? 'active' : ''}`} onClick={() => onFilterChange({ ...filters, readStatus: 'read' })}>Read</button>
      </div>

      <div className="conversation-filters">
        {stores && stores.length > 0 && (
          <select className="filter-select" value={filters.storeId || ''} onChange={(e) => onFilterChange({ ...filters, storeId: e.target.value })}>
            <option value="">All Stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.storeIdentifier}>
                {store.name || store.storeName || store.brandName || store.shopName || store.storeIdentifier || store.id}
              </option>
            ))}
          </select>
        )}
        {hasActiveFilters && <button className="filter-clear" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="conversation-items">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading chats...</p>
          </div>
        ) : filteredGroupedConversations.length === 0 ? (
          <div className="empty-conversations">
            <div className="empty-icon">💬</div>
            <h3>No chats</h3>
            <p>{filters.search || hasActiveFilters ? 'No conversations match your search' : 'Start a new conversation'}</p>
          </div>
        ) : (
          (() => {
            const urgentGroups = filteredGroupedConversations.filter(g =>
              !adminHasReplied(g) &&
              g.conversations.some(c => c.legalFlag || c.priority === 'urgent')
            );
            const normalGroups = filteredGroupedConversations.filter(g =>
              adminHasReplied(g) ||
              !g.conversations.some(c => c.legalFlag || c.priority === 'urgent')
            );

            const renderGroup = (group) => {
              const conversation = group.mostRecent;
              const isActive = group.conversations.some(c => c.id === activeConversation?.id);
              const totalGroupUnread = getGroupUnread(group);
              const hasUnread = totalGroupUnread > 0;

              const replied = adminHasReplied(group);
              const legalSeverity = getGroupLegalSeverity(group);
              const isLegal   = !!legalSeverity && !replied;
              const isUrgent  = !isLegal && !replied && group.conversations.some(c => c.priority === 'urgent');
              const isUrgentItem = isLegal || isUrgent;

              const storeName = resolveStoreName(conversation);
              const displayName = group.conversations
                .map(c => (c.customerName || '').trim())
                .filter(Boolean)
                .sort((a, b) => b.length - a.length)[0] || 'Guest';

              const itemClass = [
                'conversation-item',
                isActive  ? 'active'      : '',
                hasUnread ? 'unread'      : '',
                isLegal   ? 'legal-flag'  : '',
                isUrgent  ? 'urgent-flag' : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={group.groupKey}
                  className={itemClass}
                  style={{ position: 'relative' }}
                  onClick={() => handleGroupClick(group)}
                  onContextMenu={(e) => handleContextMenu(e, group)}
                >
                  {isUrgentItem && (
                    <button
                      className="urgent-dismiss-btn"
                      title="Dismiss from urgent"
                      onClick={(e) => handleDismissUrgent(e, group.groupKey)}
                    >
                      ✕
                    </button>
                  )}

                  <div className="conversation-avatar" style={{ position: 'relative' }}>
                    <UserIcon />
                    {isLegal && (
                      <span className="legal-avatar-badge">
                        {legalSeverity === 'critical' ? '🚨' : '⚠️'}
                      </span>
                    )}
                    {!isLegal && hasUnread && (
                      <span className="avatar-badge">{totalGroupUnread}</span>
                    )}
                    {isLegal && hasUnread && (
                      <span className="avatar-badge" style={{ background: '#dc2626' }}>{totalGroupUnread}</span>
                    )}
                  </div>

                  <div className="conversation-details">
                    <div className="conversation-top conversation-top-row">
                      <div className="conversation-name-badges">
                        <h3 className="conversation-name">{displayName}</h3>
                        {isLegal && (
                          <span className={`legal-tag-pill ${legalSeverity}`}>⚖️ Legal</span>
                        )}
                        {isUrgent && !isLegal && (
                          <span className="urgent-tag-pill">🔴 Urgent</span>
                        )}
                      </div>
                      <span className="conversation-time">{formatTime(conversation.lastMessageAt)}</span>
                    </div>

                    {isLegal && conversation.legalFlagTerm && (
                      <div style={{
                        fontSize: '11px',
                        color: legalSeverity === 'critical' ? '#dc2626' : '#d97706',
                        fontWeight: 600,
                        marginBottom: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <span>⚠️</span>
                        <span>Matched: "{conversation.legalFlagTerm}"</span>
                      </div>
                    )}

                    <div className="conversation-meta">
                      {storeName && <span className="store-badge">🏪 {storeName}</span>}
                      {conversation.customerEmail && (
                        <>
                          {storeName && <span className="meta-separator">•</span>}
                          <span className="customer-email">{conversation.customerEmail}</span>
                        </>
                      )}
                      {hasUnread && <span className="meta-new-badge">NEW</span>}
                    </div>

                    <div className="conversation-bottom">
                      <p className="conversation-preview">
                        {(() => {
                          if (conversation.lastMessage) {
                            const isAgentMessage =
                              conversation.lastSenderType === 'agent' ||
                              conversation.lastMessageSenderType === 'agent' ||
                              conversation.last_sender_type === 'agent' ||
                              conversation.last_message_sender_type === 'agent';
                            return (
                              <>
                                {isAgentMessage && <span className="you-label">You: </span>}
                                {conversation.lastMessage}
                              </>
                            );
                          }
                          return 'No messages yet';
                        })()}
                      </p>
                      {hasUnread && (
                        <span
                          className="unread-badge"
                          style={isLegal ? { background: '#dc2626' } : undefined}
                        >
                          {totalGroupUnread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            return (
              <>
                {urgentGroups.length > 0 && (
                  <>
                    <div className="urgent-section-header">
                      <span className="pulse-dot" />
                      Needs Immediate Attention ({urgentGroups.length})
                    </div>
                    {urgentGroups.map(renderGroup)}
                    {normalGroups.length > 0 && (
                      <div className="all-conversations-header">All Conversations</div>
                    )}
                  </>
                )}
                {normalGroups.map(renderGroup)}
              </>
            );
          })()
        )}
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="conv-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {(() => {
            const group = contextMenu.group;
            const totalUnreadInGroup = getGroupUnread(group);
            const isRead = totalUnreadInGroup === 0;
            const displayName =
              group.mostRecent.customerName ||
              group.mostRecent.customerEmail ||
              'this user';

            return (
              <>
                {/* Open chat */}
                <button
                  type="button"
                  onClick={() => { handleGroupClick(group); setContextMenu(null); }}
                >
                  <span className="ctx-icon">💬</span> Open chat
                </button>

                <div className="ctx-divider" />

                {/* Mark read / unread */}
                {isRead ? (
                  onMarkAsUnread && (
                    <button
                      type="button"
                      onClick={() => {
                        group.conversations.forEach(c => onMarkAsUnread(c.id));
                        setContextMenu(null);
                      }}
                    >
                      <span className="ctx-icon">🔵</span> Mark as unread
                    </button>
                  )
                ) : (
                  onMarkAsRead && (
                    <button
                      type="button"
                      onClick={() => {
                        group.conversations.forEach(c => onMarkAsRead(c.id));
                        setContextMenu(null);
                      }}
                    >
                      <span className="ctx-icon">✓</span> Mark as read
                    </button>
                  )
                )}

                <div className="ctx-divider" />

                {/* Archive */}
                {onArchive && (
                  <button
                    type="button"
                    onClick={() => {
                      setContextMenu(null);
                      setConfirmModal({ type: 'archive', group, displayName });
                    }}
                  >
                    <span className="ctx-icon">📦</span> Archive conversation
                  </button>
                )}

                {/* Block — always last, styled as danger */}
                {onBlock && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setContextMenu(null);
                      setConfirmModal({ type: 'block', group, displayName });
                    }}
                  >
                    <span className="ctx-icon">🚫</span> Block user
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div
          className="ctx-modal-overlay"
          onClick={() => setConfirmModal(null)}
        >
          <div className="ctx-modal" onClick={(e) => e.stopPropagation()}>
            {confirmModal.type === 'archive' ? (
              <>
                <div className="ctx-modal-icon">📦</div>
                <h4 className="ctx-modal-title">Archive conversation?</h4>
                <p className="ctx-modal-body">
                  The conversation with <strong>{confirmModal.displayName}</strong> will be moved to the archive and hidden from the main list.
                </p>
                <div className="ctx-modal-actions">
                  <button className="ctx-modal-cancel" onClick={() => setConfirmModal(null)}>
                    Cancel
                  </button>
                  <button className="ctx-modal-confirm" onClick={handleArchiveConfirm}>
                    Archive
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="ctx-modal-icon">🚫</div>
                <h4 className="ctx-modal-title">Block this user?</h4>
                <p className="ctx-modal-body">
                  <strong>{confirmModal.displayName}</strong> will be blocked and all their conversations moved to the blacklist. They will no longer be able to send messages.
                </p>
                <div className="ctx-modal-actions">
                  <button className="ctx-modal-cancel" onClick={() => setConfirmModal(null)}>
                    Cancel
                  </button>
                  <button className="ctx-modal-confirm danger" onClick={handleBlockConfirm}>
                    Block user
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationList;