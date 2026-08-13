

// import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
// import '../styles/ConversationList.css';

// function hexToTriple(hex) {
//   if (!hex || typeof hex !== 'string') return null;
//   const clean = hex.replace('#', '');
//   if (clean.length !== 6) return null;
//   const r = parseInt(clean.slice(0, 2), 16);
//   const g = parseInt(clean.slice(2, 4), 16);
//   const b = parseInt(clean.slice(4, 6), 16);
//   if ([r, g, b].some(Number.isNaN)) return null;
//   return `${r}, ${g}, ${b}`;
// }

// // "#rrggbb" + alpha → "rgba(r, g, b, a)" (or null when the hex can't be parsed).
// function hexToRgba(hex, alpha) {
//   const triple = hexToTriple(hex);
//   return triple ? `rgba(${triple}, ${alpha})` : null;
// }

// function ConversationList({
//   conversations,
//   activeConversation,
//   onSelectConversation,
//   onMarkAsRead,
//   onMarkAsUnread,
//   onArchive,
//   onBlock,
//   filters,
//   onFilterChange,
//   stores,
//   loading,
//   groupColor,            // ← store group's color, passed down from App
//   storeGroups,           // ← list of { storeGroup, storeGroupName, color } from App
//   loadMore,              // ← fetch the next page of older conversations
//   hasMore = false,       // ← server has more beyond what's loaded
//   loadingMore = false,   // ← a page fetch is in flight
//   isServerSearch = false, // ← rows came from /api/conversations/search (message-body match)
// }) {
//   const [notificationPermission, setNotificationPermission] = useState('default');
//   const [notificationsEnabled, setNotificationsEnabled] = useState(true);
//   const [soundEnabled, setSoundEnabled] = useState(true);
//   const [showNotificationSettings, setShowNotificationSettings] = useState(false);
//   const [toast, setToast] = useState(null);
//   const toastTimeoutRef = useRef(null);
//   const previousConversationsRef = useRef(null);
//   const [contextMenu, setContextMenu] = useState(null);
//   const contextMenuRef = useRef(null);
//   const [confirmModal, setConfirmModal] = useState(null);
//   const [dismissTick, setDismissTick] = useState(0);
//   const acknowledgedGroupsRef = useRef(new Set());
//   const audioCtxRef = useRef(null);
//   const storeIndex = useMemo(() => {
//     const byIdentifier = new Map();
//     const byId = new Map();
//     (stores || []).forEach((s) => {
//       if (s.storeIdentifier) byIdentifier.set(s.storeIdentifier, s);
//       if (s.id != null)      byId.set(String(s.id), s);
//       if (s.shop_id != null) byId.set(String(s.shop_id), s);
//     });
//     return { byIdentifier, byId };
//   }, [stores]);

//   const findStore = useCallback((conv) => {
//     return (conv.storeIdentifier && storeIndex.byIdentifier.get(conv.storeIdentifier))
//         || (conv.shopId != null   && storeIndex.byId.get(String(conv.shopId)))
//         || null;
//   }, [storeIndex]);


//   const storeGroupMap = useMemo(() => {
//     const m = new Map();
//     (storeGroups || []).forEach((g) => {
//       const slug = g.storeGroup || g.store_group || g.slug;
//       if (!slug) return;
//       m.set(slug, {
//         name: g.storeGroupName || g.store_group_name || g.name || slug,
//         color: g.color || null,
//       });
//     });
//     return m;
//   }, [storeGroups]);

//   const resolveStoreGroup = useCallback((conv) => {
//     const store = findStore(conv);
//     const slug =
//       store?.storeGroup ||
//       store?.store_group ||
//       store?.groupSlug ||
//       store?.group ||
//       conv.storeGroup ||
//       conv.store_group ||
//       null;
//     return (slug && storeGroupMap.get(slug)) || null;
//   }, [findStore, storeGroupMap]);

//   useEffect(() => {
//     if ('Notification' in window) {
//       setNotificationPermission(Notification.permission);
//     }
//   }, []);

//   useEffect(() => {
//     if ('Notification' in window) {
//       setNotificationPermission(Notification.permission);
//     }
//   }, []);

//   useEffect(() => {
//     const unlock = () => {
//       try {
//         if (!audioCtxRef.current)
//           audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
//         if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
//       } catch {}
//     };
//     window.addEventListener('pointerdown', unlock, { once: true });
//     window.addEventListener('keydown',     unlock, { once: true });
//     return () => {
//       window.removeEventListener('pointerdown', unlock);
//       window.removeEventListener('keydown', unlock);
//     };
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
//         setContextMenu(null);
//       }
//     };
//     if (contextMenu) document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, [contextMenu]);

//   useEffect(() => {
//     const handleScroll = () => setContextMenu(null);
//     if (contextMenu) document.addEventListener('scroll', handleScroll, true);
//     return () => document.removeEventListener('scroll', handleScroll, true);
//   }, [contextMenu]);

//   useEffect(() => {
//     const handleKey = (e) => {
//       if (e.key === 'Escape') setConfirmModal(null);
//     };
//     if (confirmModal) document.addEventListener('keydown', handleKey);
//     return () => document.removeEventListener('keydown', handleKey);
//   }, [confirmModal]);

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
//       let ctx = audioCtxRef.current;
//       if (!ctx) {
//         ctx = new (window.AudioContext || window.webkitAudioContext)();
//         audioCtxRef.current = ctx;        // create ONCE, reuse for the component's life
//       }
//       const beep = () => {
//         const oscillator = ctx.createOscillator();
//         const gainNode   = ctx.createGain();
//         oscillator.connect(gainNode);
//         gainNode.connect(ctx.destination);
//         oscillator.frequency.value = 600;
//         oscillator.type = 'sine';
//         gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
//         gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
//         oscillator.start(ctx.currentTime);
//         oscillator.stop(ctx.currentTime + 0.3);
//       };
//       if (ctx.state === 'suspended') ctx.resume().then(beep).catch(() => {});
//       else beep();
//     } catch (error) {
//       console.error('Error playing notification sound:', error);
//     }
//   };



// const showNotification = (conversation, newMessage) => {
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
//         if (!activeConversation) onSelectConversation(conversation);
//         notification.close();
//       };
//       setTimeout(() => notification.close(), 5000);
//     } catch (error) {
//       console.error('Error showing notification:', error);
//     }
//   };


//   useEffect(() => {
//     if (!conversations || loading) return;
//     if (isServerSearch) { previousConversationsRef.current = conversations; return; }
//     const previousConversations = previousConversationsRef.current;

//     if (previousConversations) {
//       const prevById = new Map(previousConversations.map(c => [c.id, c]));
//       conversations.forEach((currentConv) => {
//         const previousConv = prevById.get(currentConv.id);
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
//   }, [conversations, activeConversation, loading, notificationsEnabled, soundEnabled, isServerSearch]);

//   const resolveStoreId = useCallback((conv) => {
//     const match = findStore(conv);
//     if (match) return match.storeIdentifier || String(match.id);
//     return conv.storeIdentifier || String(conv.shopId || '') || '';
//   }, [findStore]);


//   const resolveStoreColor = useCallback((conv) => {
//     const grp = resolveStoreGroup(conv);
//     if (grp?.color) return grp.color;
//     const match = findStore(conv);
//     return (
//       match?.color ||
//       match?.groupColor ||
//       match?.storeGroupColor ||
//       match?.store_group_color ||
//       groupColor ||
//       null
//     );
//   }, [resolveStoreGroup, findStore, groupColor]);

//   const groupedConversations = useMemo(() => {
//     if (!conversations) return [];
//     const grouped = new Map();
//     conversations.forEach((conv) => {
//       if (
//         conv.status === 'archived' ||
//         conv.status === 'blacklisted' ||
//         conv.status === 'blacklist'
//       ) return;

//       const email = (conv.customerEmail || '').toLowerCase().trim();
//       const storeId = resolveStoreId(conv); // ← FIX 1 applied here
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

//     return Array.from(grouped.values()).sort((a, b) => {
//       const timeA = new Date(a.mostRecent.lastMessageAt || 0);
//       const timeB = new Date(b.mostRecent.lastMessageAt || 0);
//       return timeB - timeA;
//     });
//   }, [conversations, resolveStoreId]);

//   const adminHasReplied = useCallback((group) => {
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
//   }, [dismissTick]);

//   const handleDismissUrgent = useCallback((e, groupKey) => {
//     e.stopPropagation();
//     acknowledgedGroupsRef.current.add(groupKey);
//     setDismissTick(t => t + 1);
//   }, []);

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

//   const filteredGroupedConversations = useMemo(() => {
//     if (!groupedConversations) return [];
//     return groupedConversations.filter((group) => {
//       const conv = group.mostRecent;
//       const search = !isServerSearch && filters.search?.toLowerCase();
//       if (search) {
//         const matchesSearch = group.conversations.some((c) => {
//           const storeName = findStore(c)?.name || c.storeName || '';
//           return (
//             c.customerName?.toLowerCase().includes(search) ||
//             c.customerEmail?.toLowerCase().includes(search) ||
//             c.customerId?.toLowerCase().includes(search) ||
//             c.lastMessage?.toLowerCase().includes(search) ||
//             c.lastCustomerMessage?.toLowerCase().includes(search) ||
//             storeName.toLowerCase().includes(search) ||
//             c.storeIdentifier?.toLowerCase().includes(search) ||
//             c.shopId?.toString().toLowerCase().includes(search)
//           );
//         });
//         if (!matchesSearch) return false;
//       }
//       if (filters.status) {
//         if (!group.conversations.some(c => c.status === filters.status)) return false;
//       }
//       if (filters.storeId) {
//         const match = findStore(conv);
//         if (!match || match.storeIdentifier !== filters.storeId) return false;
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
//   }, [groupedConversations, filters, findStore, getGroupUnread, isServerSearch]);

//   const totalUnread = useMemo(() => {
//     if (!conversations) return 0;
//     return conversations.reduce((sum, c) => sum + getEffectiveUnread(c), 0);
//   }, [conversations, getEffectiveUnread]);

//   const urgentCount = useMemo(() => {
//     if (!groupedConversations) return 0;
//     return groupedConversations.filter(g =>
//       !adminHasReplied(g) &&
//       g.conversations.some(c => c.legalFlag || c.priority === 'urgent')
//     ).length;
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [groupedConversations, adminHasReplied, dismissTick]);

//   const { urgentGroups, normalGroups } = useMemo(() => {
//     const u = [], n = [];
//     (filteredGroupedConversations || []).forEach((g) => {
//       const isUrgent = !adminHasReplied(g) && g.conversations.some(c => c.legalFlag || c.priority === 'urgent');
//       (isUrgent ? u : n).push(g);
//     });
//     return { urgentGroups: u, normalGroups: n };
//   }, [filteredGroupedConversations, adminHasReplied, dismissTick]);

//   const NORMAL_CHUNK = 60;
//   const itemsScrollRef = useRef(null);
//   const [visibleNormal, setVisibleNormal] = useState(NORMAL_CHUNK);
//   const searchActive = !isServerSearch && (filters.search || '').trim().length > 0;

//   useEffect(() => {
//     setVisibleNormal(NORMAL_CHUNK);
//     if (itemsScrollRef.current) itemsScrollRef.current.scrollTop = 0;
//   }, [filters.search, filters.status, filters.priority, filters.storeId, filters.readStatus]);

//   const handleItemsScroll = (e) => {
//     const el = e.currentTarget;
//     if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
//       if (!searchActive && visibleNormal < normalGroups.length) {
//         setVisibleNormal((v) => v + NORMAL_CHUNK);          // reveal already-fetched rows first
//       } else if (hasMore && !loadingMore && typeof loadMore === 'function') {
//         loadMore();                                          // then pull the next page from the server
//       }
//     }
//   };

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
//     const menuWidth = 210;
//     const menuHeight = 220;
//     const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
//     const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
//     setContextMenu({ x, y, group });
//   };

//   const handleArchiveConfirm = () => {
//     const { group } = confirmModal;
//     if (onArchive) group.conversations.forEach(c => onArchive(c.id));
//     showToast('📦 Conversation archived', 'default');
//     setConfirmModal(null);
//   };

//   const handleBlockConfirm = () => {
//     const { group, displayName } = confirmModal;
//     if (onBlock) group.conversations.forEach(c => onBlock(c.id));
//     showToast(`🚫 ${displayName} has been blocked`, 'default');
//     setConfirmModal(null);
//   };

//   const hasActiveFilters = filters.status || filters.priority || filters.storeId || filters.readStatus;

//   const getGroupLegalSeverity = (group) => {
//     const severityOrder = ['critical', 'high', 'medium'];
//     for (const sev of severityOrder) {
//       if (group.conversations.some(c => c.legalFlag && c.legalFlagSeverity === sev)) return sev;
//     }
//     if (group.conversations.some(c => c.legalFlag)) return 'high';
//     return null;
//   };

//   const resolveStoreName = (conv) => {
//     const match = findStore(conv);
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

//   // ── FIX 2: Preview text — skip auto-replies, fall back to last real customer message ──
//   const AUTO_REPLY_PREFIX = 'We received your message and will answer you ASAP';

//   const getPreviewText = useCallback((group) => {
//     const allConvsSorted = [...group.conversations].sort(
//       (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
//     );
//     for (const c of allConvsSorted) {
//       const msg = c.lastMessage || c.last_message || '';
//       if (msg && !msg.startsWith(AUTO_REPLY_PREFIX)) return { text: msg, conv: c };
//       const customerMsg = c.lastCustomerMessage || c.last_customer_message || '';
//       if (customerMsg) return { text: customerMsg, conv: c };
//     }
//     return { text: group.mostRecent.lastMessage || '', conv: group.mostRecent };
//   }, []);

//   // Expose the group color (and its rgb triple, for translucent tints) as CSS
//   // vars on the list root so the styles below — and any child CSS — can key off it.
//   const accentTriple = hexToTriple(groupColor);
//   const listStyle = groupColor
//     ? (accentTriple
//         ? { '--group-accent': groupColor, '--group-accent-rgb': accentTriple }
//         : { '--group-accent': groupColor })
//     : undefined;

//   return (
//     <div className="conversation-list" style={listStyle}>
//       {/* Group-color theming for the list. Parent-class prefixes out-specify the
//           base stylesheet (no !important needed); solids use var(--group-accent),
//           translucent washes use var(--group-accent-rgb). Everything falls back to
//           the original teal when no group color is set. Legal/urgent rows set their
//           border + background with !important in the base sheet, so they keep their
//           red/amber regardless. */}
//       <style>{`
//         .conversation-list .conversation-item.active {
//           border-left-color: var(--group-accent, #00a884);
//           background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.12);
//         }
//         .conversation-list .conversation-item.unread {
//           border-left-color: var(--group-accent, #00a884);
//           background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.07);
//         }
//         .conversation-list .conversation-item.unread:hover {
//           background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.12);
//         }
//         .conversation-list .conversation-item.unread .conversation-time,
//         .conversation-list .conversation-item.unread .you-label {
//           color: var(--group-accent, #00a884);
//         }
//         .conversation-list .conversation-item.unread .conversation-avatar::after {
//           border-color: rgba(var(--group-accent-rgb, 0, 168, 132), 0.5);
//         }

//         /* Read-status tabs (All / Unread / Read) */
//         .conversation-list .read-status-tabs .read-status-tab:hover {
//           color: var(--group-accent, #00a884);
//         }
//         .conversation-list .read-status-tabs .read-status-tab.active {
//           color: var(--group-accent, #00a884);
//           border-bottom-color: var(--group-accent, #00a884);
//           background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.08);
//         }
//         .conversation-list .read-status-tabs .read-status-tab .tab-badge {
//           background: var(--group-accent, #00a884);
//           color: #fff;
//         }
//         .conversation-list .read-status-tabs .read-status-tab.active .tab-badge {
//           background: #fff;
//           color: var(--group-accent, #00a884);
//         }

//         /* Store filter dropdown */
//         .conversation-list .conversation-filters .filter-select:hover,
//         .conversation-list .conversation-filters .filter-select:focus {
//           border-color: var(--group-accent, #00a884);
//         }
//         .conversation-list .conversation-filters .filter-select:focus {
//           box-shadow: 0 0 0 3px rgba(var(--group-accent-rgb, 0, 168, 132), 0.1);
//         }

//         /* Clear button — colored text at rest, filled on hover */
//         .conversation-list .conversation-filters .filter-clear {
//           color: var(--group-accent, #00a884);
//         }
//         .conversation-list .conversation-filters .filter-clear:hover {
//           background: var(--group-accent, #00a884);
//           border-color: var(--group-accent, #00a884);
//           color: #fff;
//         }

//         /* Search field focus */
//         .conversation-list .conversation-search .search-input:focus {
//           border-color: var(--group-accent, #00a884);
//           box-shadow: 0 0 0 3px rgba(var(--group-accent-rgb, 0, 168, 132), 0.1);
//         }

//         /* Unread count badges (header total + per-row) */
//         .conversation-list .total-unread-badge,
//         .conversation-list .unread-badge {
//           background: var(--group-accent, #00a884);
//         }

//         /* Keyboard focus rings in this cluster */
//         .conversation-list .read-status-tab:focus-visible,
//         .conversation-list .filter-clear:focus-visible,
//         .conversation-list .search-clear:focus-visible {
//           outline-color: var(--group-accent, #00a884);
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

//       <div className="conversation-items" ref={itemsScrollRef} onScroll={handleItemsScroll}>
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
//             const renderGroup = (group) => {
//               const conversation = group.mostRecent;
//               const isActive = group.conversations.some(c => c.id === activeConversation?.id);
//               const totalGroupUnread = getGroupUnread(group);
//               const hasUnread = totalGroupUnread > 0;

//               const replied = adminHasReplied(group);
//               const legalSeverity = getGroupLegalSeverity(group);
//               const isLegal   = !!legalSeverity && !replied;
//               const isUrgent  = !isLegal && !replied && group.conversations.some(c => c.priority === 'urgent');
//               const isUrgentItem = isLegal || isUrgent;

//               const storeName = resolveStoreName(conversation);
//               const storeGroupInfo = resolveStoreGroup(conversation); // { name, color } | null

//               // ── Store/group color applied to the badges ──
//               const storeColor = resolveStoreColor(conversation);
//               const storeBadgeStyle = storeColor
//                 ? {
//                     background: hexToRgba(storeColor, 0.12) || undefined,
//                     color: storeColor,
//                     border: `1px solid ${hexToRgba(storeColor, 0.35) || 'transparent'}`,
//                   }
//                 : undefined;

//               const displayName = group.conversations
//                 .map(c => (c.customerName || '').trim())
//                 .filter(Boolean)
//                 .sort((a, b) => b.length - a.length)[0] || 'Guest';

//               // ── FIX 2 applied ──
//               const { text: displayMessage, conv: previewConv } = getPreviewText(group);
//               const isAgentPreview =
//                 !!displayMessage &&
//                 !displayMessage.startsWith(AUTO_REPLY_PREFIX) && (
//                   previewConv.lastSenderType === 'agent' ||
//                   previewConv.lastMessageSenderType === 'agent' ||
//                   previewConv.last_sender_type === 'agent' ||
//                   previewConv.last_message_sender_type === 'agent'
//                 );

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
//                   style={{ position: 'relative' }}
//                   onClick={() => handleGroupClick(group)}
//                   onContextMenu={(e) => handleContextMenu(e, group)}
//                 >
//                   {isUrgentItem && (
//                     <button
//                       className="urgent-dismiss-btn"
//                       title="Dismiss from urgent"
//                       onClick={(e) => handleDismissUrgent(e, group.groupKey)}
//                     >
//                       ✕
//                     </button>
//                   )}

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
//                           <span className={`legal-tag-pill ${legalSeverity}`}>⚖️ Legal</span>
//                         )}
//                         {isUrgent && !isLegal && (
//                           <span className="urgent-tag-pill">🔴 Urgent</span>
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
//                       {storeName && <span className="store-badge" style={storeBadgeStyle}>🏪 {storeName}</span>}
//                       {storeGroupInfo?.name && (
//                         <span
//                           className="conv-group-pill"
//                           title={`Group: ${storeGroupInfo.name}`}
//                           style={{
//                             display: 'inline-flex',
//                             alignItems: 'center',
//                             gap: '4px',
//                             padding: '2px 7px',
//                             borderRadius: '8px',
//                             fontSize: '10px',
//                             fontWeight: 600,
//                             flexShrink: 0,
//                             maxWidth: '110px',
//                             overflow: 'hidden',
//                             textOverflow: 'ellipsis',
//                             whiteSpace: 'nowrap',
//                             color: storeColor || '#475569',
//                             background: hexToRgba(storeColor, 0.10) || '#f1f5f9',
//                             border: `1px solid ${hexToRgba(storeColor, 0.30) || '#e2e8f0'}`,
//                           }}
//                         >
//                           <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: storeColor || '#94a3b8', flexShrink: 0 }} />
//                           {storeGroupInfo.name}
//                         </span>
//                       )}
//                       {conversation.customerEmail && (
//                         <>
//                           {(storeName || storeGroupInfo?.name) && <span className="meta-separator">•</span>}
//                           <span className="customer-email">{conversation.customerEmail}</span>
//                         </>
//                       )}
//                       {hasUnread && <span className="meta-new-badge">NEW</span>}
//                     </div>

//                     <div className="conversation-bottom">
//                       <p className="conversation-preview">
//                         {!displayMessage ? (
//                           'No messages yet'
//                         ) : (
//                           <>
//                             {isAgentPreview && <span className="you-label">You: </span>}
//                             {displayMessage}
//                           </>
//                         )}
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

// return (
//               <>
//                 {urgentGroups.length > 0 && (
//                   <>
//                     <div className="urgent-section-header">
//                       <span className="pulse-dot" />
//                       Needs Immediate Attention ({urgentGroups.length})
//                     </div>
//                     {urgentGroups.map(renderGroup)}
//                     {normalGroups.length > 0 && (
//                       <div className="all-conversations-header">All Conversations</div>
//                     )}
//                   </>
//                 )}
//                 {/* When a local search is active, lift the window cap so EVERY match
//                     renders at once instead of 60-at-a-time behind scroll. */}
//                 {(searchActive ? normalGroups : normalGroups.slice(0, visibleNormal)).map(renderGroup)}
//                 {!searchActive && (() => {
//                   const moreWindowed = normalGroups.length > visibleNormal;       // fetched, not yet shown
//                   const canFetch     = hasMore && typeof loadMore === 'function';  // server has older pages
//                   if (!moreWindowed && !canFetch && !loadingMore) return null;

//                   const onLoadMore = () => {
//                     if (loadingMore) return;
//                     if (moreWindowed) setVisibleNormal((v) => v + NORMAL_CHUNK);
//                     else if (canFetch) loadMore();
//                   };

//                   const label = loadingMore
//                     ? 'Loading older chats…'
//                     : moreWindowed
//                       ? `Load more (${visibleNormal} of ${normalGroups.length})`
//                       : 'Load older chats';

//                   return (
//                     <div className="conv-load-more-wrap">
//                       <button
//                         type="button"
//                         className="conv-load-more-btn"
//                         onClick={onLoadMore}
//                         disabled={loadingMore}
//                       >
//                         {loadingMore && <span className="conv-load-more-spinner" />}
//                         {label}
//                       </button>
//                     </div>
//                   );
//                 })()}
//               </>
//             );
//           })()
//         )}
//       </div>

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
//             const displayName =
//               group.mostRecent.customerName ||
//               group.mostRecent.customerEmail ||
//               'this user';

//             return (
//               <>
//                 <button
//                   type="button"
//                   onClick={() => { handleGroupClick(group); setContextMenu(null); }}
//                 >
//                   <span className="ctx-icon">💬</span> Open chat
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
//                       <span className="ctx-icon">🔵</span> Mark as unread
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
//                       <span className="ctx-icon">✓</span> Mark as read
//                     </button>
//                   )
//                 )}

//                 <div className="ctx-divider" />

//                 {onArchive && (
//                   <button
//                     type="button"
//                     onClick={() => {
//                       setContextMenu(null);
//                       setConfirmModal({ type: 'archive', group, displayName });
//                     }}
//                   >
//                     <span className="ctx-icon">📦</span> Archive conversation
//                   </button>
//                 )}

//                 {onBlock && (
//                   <button
//                     type="button"
//                     className="danger"
//                     onClick={() => {
//                       setContextMenu(null);
//                       setConfirmModal({ type: 'block', group, displayName });
//                     }}
//                   >
//                     <span className="ctx-icon">🚫</span> Block user
//                   </button>
//                 )}
//               </>
//             );
//           })()}
//         </div>
//       )}

//       {confirmModal && (
//         <div
//           className="ctx-modal-overlay"
//           onClick={() => setConfirmModal(null)}
//         >
//           <div className="ctx-modal" onClick={(e) => e.stopPropagation()}>
//             {confirmModal.type === 'archive' ? (
//               <>
//                 <div className="ctx-modal-icon">📦</div>
//                 <h4 className="ctx-modal-title">Archive conversation?</h4>
//                 <p className="ctx-modal-body">
//                   The conversation with <strong>{confirmModal.displayName}</strong> will be moved to the archive and hidden from the main list.
//                 </p>
//                 <div className="ctx-modal-actions">
//                   <button className="ctx-modal-cancel" onClick={() => setConfirmModal(null)}>
//                     Cancel
//                   </button>
//                   <button className="ctx-modal-confirm" onClick={handleArchiveConfirm}>
//                     Archive
//                   </button>
//                 </div>
//               </>
//             ) : (
//               <>
//                 <div className="ctx-modal-icon">🚫</div>
//                 <h4 className="ctx-modal-title">Block this user?</h4>
//                 <p className="ctx-modal-body">
//                   <strong>{confirmModal.displayName}</strong> will be blocked and all their conversations moved to the blacklist. They will no longer be able to send messages.
//                 </p>
//                 <div className="ctx-modal-actions">
//                   <button className="ctx-modal-cancel" onClick={() => setConfirmModal(null)}>
//                     Cancel
//                   </button>
//                   <button className="ctx-modal-confirm danger" onClick={handleBlockConfirm}>
//                     Block user
//                   </button>
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default React.memo(ConversationList);






import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import '../styles/ConversationList.css';

function hexToTriple(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return `${r}, ${g}, ${b}`;
}

// "#rrggbb" + alpha → "rgba(r, g, b, a)" (or null when the hex can't be parsed).
function hexToRgba(hex, alpha) {
  const triple = hexToTriple(hex);
  return triple ? `rgba(${triple}, ${alpha})` : null;
}

function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,
  onBlock,
  filters,
  onFilterChange,
  stores,
  loading,
  groupColor,            // ← store group's color, passed down from App
  storeGroups,           // ← list of { storeGroup, storeGroupName, color } from App
  loadMore,              // ← fetch the next page of older conversations
  hasMore = false,       // ← server has more beyond what's loaded
  loadingMore = false,   // ← a page fetch is in flight
  isServerSearch = false, // ← rows came from /api/conversations/search (message-body match)
}) {
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const previousConversationsRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [dismissTick, setDismissTick] = useState(0);
  const acknowledgedGroupsRef = useRef(new Set());
  const audioCtxRef = useRef(null);
  const storeIndex = useMemo(() => {
    const byIdentifier = new Map();
    const byId = new Map();
    (stores || []).forEach((s) => {
      if (s.storeIdentifier) byIdentifier.set(s.storeIdentifier, s);
      if (s.id != null)      byId.set(String(s.id), s);
      if (s.shop_id != null) byId.set(String(s.shop_id), s);
    });
    return { byIdentifier, byId };
  }, [stores]);

  const findStore = useCallback((conv) => {
    return (conv.storeIdentifier && storeIndex.byIdentifier.get(conv.storeIdentifier))
        || (conv.shopId != null   && storeIndex.byId.get(String(conv.shopId)))
        || null;
  }, [storeIndex]);


  const storeGroupMap = useMemo(() => {
    const m = new Map();
    (storeGroups || []).forEach((g) => {
      const slug = g.storeGroup || g.store_group || g.slug;
      if (!slug) return;
      m.set(slug, {
        name: g.storeGroupName || g.store_group_name || g.name || slug,
        color: g.color || null,
      });
    });
    return m;
  }, [storeGroups]);

  const resolveStoreGroup = useCallback((conv) => {
    const store = findStore(conv);
    const slug =
      store?.storeGroup ||
      store?.store_group ||
      store?.groupSlug ||
      store?.group ||
      conv.storeGroup ||
      conv.store_group ||
      null;
    return (slug && storeGroupMap.get(slug)) || null;
  }, [findStore, storeGroupMap]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // ── AudioContext unlock (resilient) ────────────────────────────────────────
  // Browsers only let a *user gesture* move a suspended AudioContext to
  // "running". A resume() triggered later from a WebSocket message handler is
  // ignored, so the beep silently fails. This effect keeps re-arming on every
  // gesture until the context is genuinely running (a single {once:true}
  // listener could fire before the context is ready and then never retry), and
  // re-resumes whenever the tab comes back to the foreground — which covers the
  // support-dashboard-in-a-background-tab case where Chrome suspends the context.
  useEffect(() => {
    const ensureRunning = () => {
      try {
        if (!audioCtxRef.current)
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      } catch {}
    };

    const onGesture = () => {
      ensureRunning();
      // Only stop listening once the context has actually reached "running".
      if (audioCtxRef.current?.state === 'running') {
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') ensureRunning();
    };

    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  useEffect(() => {
    const handleScroll = () => setContextMenu(null);
    if (contextMenu) document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu]);

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
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;        // create ONCE, reuse for the component's life
      }
      const beep = () => {
        const oscillator = ctx.createOscillator();
        const gainNode   = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      };
      if (ctx.state === 'suspended') ctx.resume().then(beep).catch(() => {});
      else beep();
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
        if (!activeConversation) onSelectConversation(conversation);
        notification.close();
      };
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };


  useEffect(() => {
    if (!conversations || loading) return;
    if (isServerSearch) { previousConversationsRef.current = conversations; return; }
    const previousConversations = previousConversationsRef.current;

    if (previousConversations) {
      const prevById = new Map(previousConversations.map(c => [c.id, c]));
      conversations.forEach((currentConv) => {
        const previousConv = prevById.get(currentConv.id);
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
  }, [conversations, activeConversation, loading, notificationsEnabled, soundEnabled, isServerSearch]);

  const resolveStoreId = useCallback((conv) => {
    const match = findStore(conv);
    if (match) return match.storeIdentifier || String(match.id);
    return conv.storeIdentifier || String(conv.shopId || '') || '';
  }, [findStore]);


  const resolveStoreColor = useCallback((conv) => {
    const grp = resolveStoreGroup(conv);
    if (grp?.color) return grp.color;
    const match = findStore(conv);
    return (
      match?.color ||
      match?.groupColor ||
      match?.storeGroupColor ||
      match?.store_group_color ||
      groupColor ||
      null
    );
  }, [resolveStoreGroup, findStore, groupColor]);

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
      const storeId = resolveStoreId(conv); // ← FIX 1 applied here
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
  }, [conversations, resolveStoreId]);

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
  }, [dismissTick]);

  const handleDismissUrgent = useCallback((e, groupKey) => {
    e.stopPropagation();
    acknowledgedGroupsRef.current.add(groupKey);
    setDismissTick(t => t + 1);
  }, []);

  // Unread now reflects ONLY the conversation that is actually open — never the
  // whole email+store group. Opening one thread no longer silently zeroes (and
  // marks-read in the DB) a customer's sibling threads, so a new message on a
  // sibling keeps its badge until that thread is itself opened.
  const getEffectiveUnread = useCallback((conv) => {
    if (conv.id === activeConversation?.id) return 0;
    return conv.unreadCount || conv.unread_count || conv.unread || 0;
  }, [activeConversation]);

  const getGroupUnread = useCallback((group) => {
    return group.conversations.reduce((sum, c) => sum + getEffectiveUnread(c), 0);
  }, [getEffectiveUnread]);

  // Auto-mark-read is scoped to the OPEN conversation only. Sibling threads in
  // the same group are left untouched (they clear on explicit click via
  // handleGroupClick, not on message arrival).
  useEffect(() => {
    if (!activeConversation || !conversations || !onMarkAsRead) return;
    const conv = conversations.find(c => c.id === activeConversation.id);
    if (!conv) return;
    const unreadCount = conv.unreadCount || conv.unread_count || conv.unread || 0;
    if (unreadCount > 0) onMarkAsRead(activeConversation.id);
  }, [activeConversation, conversations, onMarkAsRead]);

  const filteredGroupedConversations = useMemo(() => {
    if (!groupedConversations) return [];
    return groupedConversations.filter((group) => {
      const conv = group.mostRecent;
      const search = !isServerSearch && filters.search?.toLowerCase();
      if (search) {
        const matchesSearch = group.conversations.some((c) => {
          const storeName = findStore(c)?.name || c.storeName || '';
          return (
            c.customerName?.toLowerCase().includes(search) ||
            c.customerEmail?.toLowerCase().includes(search) ||
            c.customerId?.toLowerCase().includes(search) ||
            c.lastMessage?.toLowerCase().includes(search) ||
            c.lastCustomerMessage?.toLowerCase().includes(search) ||
            storeName.toLowerCase().includes(search) ||
            c.storeIdentifier?.toLowerCase().includes(search) ||
            c.shopId?.toString().toLowerCase().includes(search)
          );
        });
        if (!matchesSearch) return false;
      }
      if (filters.status) {
        if (!group.conversations.some(c => c.status === filters.status)) return false;
      }
      if (filters.storeId) {
        const match = findStore(conv);
        if (!match || match.storeIdentifier !== filters.storeId) return false;
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
  }, [groupedConversations, filters, findStore, getGroupUnread, isServerSearch]);

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

  const { urgentGroups, normalGroups } = useMemo(() => {
    const u = [], n = [];
    (filteredGroupedConversations || []).forEach((g) => {
      const isUrgent = !adminHasReplied(g) && g.conversations.some(c => c.legalFlag || c.priority === 'urgent');
      (isUrgent ? u : n).push(g);
    });
    return { urgentGroups: u, normalGroups: n };
  }, [filteredGroupedConversations, adminHasReplied, dismissTick]);

  const NORMAL_CHUNK = 60;
  const itemsScrollRef = useRef(null);
  const [visibleNormal, setVisibleNormal] = useState(NORMAL_CHUNK);
  const searchActive = !isServerSearch && (filters.search || '').trim().length > 0;

  useEffect(() => {
    setVisibleNormal(NORMAL_CHUNK);
    if (itemsScrollRef.current) itemsScrollRef.current.scrollTop = 0;
  }, [filters.search, filters.status, filters.priority, filters.storeId, filters.readStatus]);

  const handleItemsScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
      if (!searchActive && visibleNormal < normalGroups.length) {
        setVisibleNormal((v) => v + NORMAL_CHUNK);          // reveal already-fetched rows first
      } else if (hasMore && !loadingMore && typeof loadMore === 'function') {
        loadMore();                                          // then pull the next page from the server
      }
    }
  };

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

  const handleArchiveConfirm = () => {
    const { group } = confirmModal;
    if (onArchive) group.conversations.forEach(c => onArchive(c.id));
    showToast('📦 Conversation archived', 'default');
    setConfirmModal(null);
  };

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
    const match = findStore(conv);
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

  // ── FIX 2: Preview text — skip auto-replies, fall back to last real customer message ──
  const AUTO_REPLY_PREFIX = 'We received your message and will answer you ASAP';

  const getPreviewText = useCallback((group) => {
    const allConvsSorted = [...group.conversations].sort(
      (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
    );
    for (const c of allConvsSorted) {
      const msg = c.lastMessage || c.last_message || '';
      if (msg && !msg.startsWith(AUTO_REPLY_PREFIX)) return { text: msg, conv: c };
      const customerMsg = c.lastCustomerMessage || c.last_customer_message || '';
      if (customerMsg) return { text: customerMsg, conv: c };
    }
    return { text: group.mostRecent.lastMessage || '', conv: group.mostRecent };
  }, []);

  // Expose the group color (and its rgb triple, for translucent tints) as CSS
  // vars on the list root so the styles below — and any child CSS — can key off it.
  const accentTriple = hexToTriple(groupColor);
  const listStyle = groupColor
    ? (accentTriple
        ? { '--group-accent': groupColor, '--group-accent-rgb': accentTriple }
        : { '--group-accent': groupColor })
    : undefined;

  return (
    <div className="conversation-list" style={listStyle}>
      {/* Group-color theming for the list. Parent-class prefixes out-specify the
          base stylesheet (no !important needed); solids use var(--group-accent),
          translucent washes use var(--group-accent-rgb). Everything falls back to
          the original teal when no group color is set. Legal/urgent rows set their
          border + background with !important in the base sheet, so they keep their
          red/amber regardless. */}
      <style>{`
        .conversation-list .conversation-item.active {
          border-left-color: var(--group-accent, #00a884);
          background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.12);
        }
        .conversation-list .conversation-item.unread {
          border-left-color: var(--group-accent, #00a884);
          background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.07);
        }
        .conversation-list .conversation-item.unread:hover {
          background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.12);
        }
        .conversation-list .conversation-item.unread .conversation-time,
        .conversation-list .conversation-item.unread .you-label {
          color: var(--group-accent, #00a884);
        }
        .conversation-list .conversation-item.unread .conversation-avatar::after {
          border-color: rgba(var(--group-accent-rgb, 0, 168, 132), 0.5);
        }

        /* Read-status tabs (All / Unread / Read) */
        .conversation-list .read-status-tabs .read-status-tab:hover {
          color: var(--group-accent, #00a884);
        }
        .conversation-list .read-status-tabs .read-status-tab.active {
          color: var(--group-accent, #00a884);
          border-bottom-color: var(--group-accent, #00a884);
          background: rgba(var(--group-accent-rgb, 0, 168, 132), 0.08);
        }
        .conversation-list .read-status-tabs .read-status-tab .tab-badge {
          background: var(--group-accent, #00a884);
          color: #fff;
        }
        .conversation-list .read-status-tabs .read-status-tab.active .tab-badge {
          background: #fff;
          color: var(--group-accent, #00a884);
        }

        /* Store filter dropdown */
        .conversation-list .conversation-filters .filter-select:hover,
        .conversation-list .conversation-filters .filter-select:focus {
          border-color: var(--group-accent, #00a884);
        }
        .conversation-list .conversation-filters .filter-select:focus {
          box-shadow: 0 0 0 3px rgba(var(--group-accent-rgb, 0, 168, 132), 0.1);
        }

        /* Clear button — colored text at rest, filled on hover */
        .conversation-list .conversation-filters .filter-clear {
          color: var(--group-accent, #00a884);
        }
        .conversation-list .conversation-filters .filter-clear:hover {
          background: var(--group-accent, #00a884);
          border-color: var(--group-accent, #00a884);
          color: #fff;
        }

        /* Search field focus */
        .conversation-list .conversation-search .search-input:focus {
          border-color: var(--group-accent, #00a884);
          box-shadow: 0 0 0 3px rgba(var(--group-accent-rgb, 0, 168, 132), 0.1);
        }

        /* Unread count badges (header total + per-row) */
        .conversation-list .total-unread-badge,
        .conversation-list .unread-badge {
          background: var(--group-accent, #00a884);
        }

        /* Keyboard focus rings in this cluster */
        .conversation-list .read-status-tab:focus-visible,
        .conversation-list .filter-clear:focus-visible,
        .conversation-list .search-clear:focus-visible {
          outline-color: var(--group-accent, #00a884);
        }
      `}</style>

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

      <div className="conversation-items" ref={itemsScrollRef} onScroll={handleItemsScroll}>
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
              const storeGroupInfo = resolveStoreGroup(conversation); // { name, color } | null

              // ── Store/group color applied to the badges ──
              const storeColor = resolveStoreColor(conversation);
              const storeBadgeStyle = storeColor
                ? {
                    background: hexToRgba(storeColor, 0.12) || undefined,
                    color: storeColor,
                    border: `1px solid ${hexToRgba(storeColor, 0.35) || 'transparent'}`,
                  }
                : undefined;

              const displayName = group.conversations
                .map(c => (c.customerName || '').trim())
                .filter(Boolean)
                .sort((a, b) => b.length - a.length)[0] || 'Guest';

              // ── FIX 2 applied ──
              const { text: displayMessage, conv: previewConv } = getPreviewText(group);
              const isAgentPreview =
                !!displayMessage &&
                !displayMessage.startsWith(AUTO_REPLY_PREFIX) && (
                  previewConv.lastSenderType === 'agent' ||
                  previewConv.lastMessageSenderType === 'agent' ||
                  previewConv.last_sender_type === 'agent' ||
                  previewConv.last_message_sender_type === 'agent'
                );

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
                      {storeName && <span className="store-badge" style={storeBadgeStyle}>🏪 {storeName}</span>}
                      {storeGroupInfo?.name && (
                        <span
                          className="conv-group-pill"
                          title={`Group: ${storeGroupInfo.name}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 7px',
                            borderRadius: '8px',
                            fontSize: '10px',
                            fontWeight: 600,
                            flexShrink: 0,
                            maxWidth: '110px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: storeColor || '#475569',
                            background: hexToRgba(storeColor, 0.10) || '#f1f5f9',
                            border: `1px solid ${hexToRgba(storeColor, 0.30) || '#e2e8f0'}`,
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: storeColor || '#94a3b8', flexShrink: 0 }} />
                          {storeGroupInfo.name}
                        </span>
                      )}
                      {conversation.customerEmail && (
                        <>
                          {(storeName || storeGroupInfo?.name) && <span className="meta-separator">•</span>}
                          <span className="customer-email">{conversation.customerEmail}</span>
                        </>
                      )}
                      {hasUnread && <span className="meta-new-badge">NEW</span>}
                    </div>

                    <div className="conversation-bottom">
                      <p className="conversation-preview">
                        {!displayMessage ? (
                          'No messages yet'
                        ) : (
                          <>
                            {isAgentPreview && <span className="you-label">You: </span>}
                            {displayMessage}
                          </>
                        )}
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
                {/* When a local search is active, lift the window cap so EVERY match
                    renders at once instead of 60-at-a-time behind scroll. */}
                {(searchActive ? normalGroups : normalGroups.slice(0, visibleNormal)).map(renderGroup)}
                {!searchActive && (() => {
                  const moreWindowed = normalGroups.length > visibleNormal;       // fetched, not yet shown
                  const canFetch     = hasMore && typeof loadMore === 'function';  // server has older pages
                  if (!moreWindowed && !canFetch && !loadingMore) return null;

                  const onLoadMore = () => {
                    if (loadingMore) return;
                    if (moreWindowed) setVisibleNormal((v) => v + NORMAL_CHUNK);
                    else if (canFetch) loadMore();
                  };

                  const label = loadingMore
                    ? 'Loading older chats…'
                    : moreWindowed
                      ? `Load more (${visibleNormal} of ${normalGroups.length})`
                      : 'Load older chats';

                  return (
                    <div className="conv-load-more-wrap">
                      <button
                        type="button"
                        className="conv-load-more-btn"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore && <span className="conv-load-more-spinner" />}
                        {label}
                      </button>
                    </div>
                  );
                })()}
              </>
            );
          })()
        )}
      </div>

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
                <button
                  type="button"
                  onClick={() => { handleGroupClick(group); setContextMenu(null); }}
                >
                  <span className="ctx-icon">💬</span> Open chat
                </button>

                <div className="ctx-divider" />

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

export default React.memo(ConversationList);