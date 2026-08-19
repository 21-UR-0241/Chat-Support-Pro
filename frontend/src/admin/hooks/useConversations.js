


// import { useState, useEffect, useCallback, useRef } from 'react';
// import api from '../services/api';

// // NOTE: `ws` is now passed in from the single useWebSocket() owner (App).
// // This hook no longer calls useWebSocket() itself, so there is exactly ONE
// // socket connection in the tree — no more connect/disconnect stomping.
// export function useConversations(employeeId, ws, initialFilters = {}) {
//   const [conversations, setConversations] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [hasMore, setHasMore]         = useState(true);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [filters, setFilters] = useState({
//     status: 'open',
//     storeId: '',
//     priority: '',
//     search: '',
//     storeGroup: '',
//     limit: 50,
//     ...initialFilters,
//   });

//   const activeConversationIdRef = useRef(null);
//   const offsetRef = useRef(0);   // rows loaded so far = offset for the next page

//   const loadConversations = useCallback(async (showLoading = true) => {
//     try {
//       if (showLoading) setLoading(true);
//       setError(null);
//       const pageSize = filters.limit || 50;
//       const data = await api.getConversations({ ...filters, offset: 0 });
//       console.log('📥 [useConversations] Loaded conversations:', data.length);
//       setConversations(data);
//       offsetRef.current = data.length;
//       setHasMore(data.length >= pageSize);   // full page back → assume more exists
//     } catch (err) {
//       console.error('Failed to load conversations:', err);
//       setError(err.message);
//     } finally {
//       if (showLoading) setLoading(false);
//     }
//   }, [filters]);

//   const loadMore = useCallback(async () => {
//     if (loadingMore || !hasMore) return;
//     try {
//       setLoadingMore(true);
//       setError(null);
//       const pageSize = filters.limit || 50;
//       const data = await api.getConversations({ ...filters, offset: offsetRef.current });
//       console.log('📥 [useConversations] Loaded more:', data.length, 'at offset', offsetRef.current);
//       setConversations(prev => {
//         const seen = new Set(prev.map(c => c.id));
//         const fresh = data.filter(c => !seen.has(c.id));   // drop dups from live-insert drift
//         return [...prev, ...fresh].sort((a, b) =>
//           new Date(b.lastMessageAt || b.updatedAt || 0) -
//           new Date(a.lastMessageAt || a.updatedAt || 0)
//         );
//       });
//       offsetRef.current += data.length;
//       setHasMore(data.length >= pageSize);
//     } catch (err) {
//       console.error('Failed to load more conversations:', err);
//       setError(err.message);
//     } finally {
//       setLoadingMore(false);
//     }
//   }, [filters, hasMore, loadingMore]);

//   useEffect(() => {
//     loadConversations(true);
//   }, [loadConversations]);

//   const refetchTimer = useRef(null);
//   const scheduleRefetch = useCallback(() => {
//     clearTimeout(refetchTimer.current);
//     refetchTimer.current = setTimeout(() => loadConversations(false), 1500);
//   }, [loadConversations]);

//   const updateConversationFromData = useCallback((conversationData) => {
//     setConversations(prev => {
//       const index = prev.findIndex(c => c.id === conversationData.id);
//       if (index > -1) {
//         const updated = [...prev];
//         const incoming = { ...conversationData };
//         if (incoming.id === activeConversationIdRef.current) {
//           delete incoming.unreadCount;
//           delete incoming.unread_count;
//           delete incoming.unread;
//         }
//         updated[index] = { ...updated[index], ...incoming };
//         console.log('✅ [useConversations] Updated conversation:', {
//           id: updated[index].id,
//           unreadCount: updated[index].unreadCount || updated[index].unread_count,
//           lastMessage: updated[index].lastMessage?.substring(0, 30)
//         });
//         return updated.sort((a, b) =>
//           new Date(b.lastMessageAt || b.updatedAt || 0) -
//           new Date(a.lastMessageAt || a.updatedAt || 0)
//         );
//       } else {
//         console.log('🆕 [useConversations] Adding new conversation to list:', conversationData.id);
//         return [conversationData, ...prev].sort((a, b) =>
//           new Date(b.lastMessageAt || b.updatedAt || 0) -
//           new Date(a.lastMessageAt || a.updatedAt || 0)
//         );
//       }
//     });
//   }, []);

//   const updateConversationFromMessage = useCallback((data) => {
//     const conversationId = data.conversationId || data.conversation_id;
//     const messageContent = data.message?.content || data.content || '';
//     const messageTime = data.message?.createdAt || data.createdAt || new Date().toISOString();

//     setConversations(prev => {
//       const index = prev.findIndex(c => c.id === conversationId);
//       if (index > -1) {
//         const updated = [...prev];
//         updated[index] = {
//           ...updated[index],
//           lastMessage: messageContent,
//           lastMessageAt: messageTime,
//           totalMessageCount: (updated[index].totalMessageCount || 0) + 1,
//         };
//         return updated.sort((a, b) =>
//           new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
//         );
//       } else {
//         console.log('🆕 [useConversations] New conversation detected, refreshing...');
//         scheduleRefetch();
//         return prev;
//       }
//     });
//   }, [scheduleRefetch]);

//   const addNewConversation = useCallback((conversationData) => {
//     setConversations(prev => {
//       if (prev.find(c => c.id === conversationData.id)) {
//         console.log('⚠️ [useConversations] Conversation already exists, updating');
//         return prev.map(c =>
//           c.id === conversationData.id ? { ...c, ...conversationData } : c
//         );
//       }
//       console.log('➕ [useConversations] Adding new conversation:', conversationData.id);
//       return [conversationData, ...prev].sort((a, b) =>
//         new Date(b.lastMessageAt || b.updatedAt || 0) -
//         new Date(a.lastMessageAt || a.updatedAt || 0)
//       );
//     });
//   }, []);

//   useEffect(() => {
//     if (!ws) return;

//     console.log('👂 [useConversations] Setting up WebSocket listeners...');

//     // Collect every unsubscribe here. Teardown iterates whatever's in the array,
//     // so adding/removing a listener is a single push() with no separate teardown
//     // line to keep in sync — this structurally prevents the "off() references an
//     // undeclared handler" ReferenceError.
//     const subs = [];

//     subs.push(ws.on('new_message', (data) => {
//       // Skip preview update for auto-replies — conversation_updated corrects it
//       if (data.message?.isAutoReply === true) {
//         console.log('🤖 [useConversations] Auto-reply skipped, waiting for conversation_updated');
//         return;
//       }

//       console.log('📨 [useConversations] New message:', {
//         conversationId: data.conversationId,
//         hasConversation: !!data.conversation,
//         hasMessage: !!data.message
//       });

//       if (data.conversation) {
//         console.log('🔄 [useConversations] Updating with full conversation data:', {
//           id: data.conversation.id,
//           unreadCount: data.conversation.unreadCount || data.conversation.unread_count
//         });
//         updateConversationFromData(data.conversation);
//       } else {
//         console.log('⚠️ [useConversations] No conversation data, using message fallback');
//         updateConversationFromMessage(data);
//       }

//       playNotificationSound();
//     }));

//     subs.push(ws.on('conversation_read', (data) => {
//       console.log('📖 [useConversations] Conversation read:', { conversationId: data.conversationId });
//       if (data.conversation) {
//         const readConversation = {
//           ...data.conversation,
//           unreadCount: 0,
//           unread_count: 0,
//           unread: 0,
//         };
//         updateConversationFromData(readConversation);
//       } else {
//         updateConversation(data.conversationId, {
//           unreadCount: 0,
//           unread_count: 0,
//           unread: 0,
//           lastReadAt: new Date().toISOString(),
//         });
//       }
//     }));

//     subs.push(ws.on('new_conversation', (data) => {
//       console.log('🆕 [useConversations] New conversation:', data);
//       if (data.conversation) {
//         addNewConversation(data.conversation);
//       } else {
//         scheduleRefetch();
//       }
//     }));

//     // ── Gap recovery for the LIST ─────────────────────────────────────────
//     // While the socket was dead (inactive tab, sleep, edge drop), customers may
//     // have messaged conversations that weren't open. Reconnect resumes the live
//     // stream but does NOT replay the gap — so re-pull the list to refresh unread
//     // badges, previews, and ordering. Debounced (scheduleRefetch) + no spinner
//     // (loadConversations(false)), so it's invisible to the agent.
//     subs.push(ws.on('connected', () => {
//       console.log('🔌 [useConversations] Reconnected — refreshing list to backfill gap');
//       scheduleRefetch();
//     }));

//     return () => {
//       console.log('🔇 [useConversations] Cleaning up WebSocket listeners');
//       subs.forEach(unsub => { try { unsub && unsub(); } catch (e) {} });
//       clearTimeout(refetchTimer.current);
//     };
//   }, [ws, updateConversationFromData, updateConversationFromMessage, addNewConversation, scheduleRefetch]);

//   const updateFilters = useCallback((newFilters) => {
//     setFilters(prev => ({ ...prev, ...newFilters }));
//   }, []);

//   const refresh = useCallback(() => {
//     console.log('🔄 [useConversations] Manual refresh triggered');
//     loadConversations(true);
//   }, [loadConversations]);

//   const updateConversation = useCallback((id, updates) => {
//     console.log('🔄 [useConversations] Manual update:', { id, updates });
//     setConversations(prev => {
//       const updated = prev.map(conv =>
//         conv.id === id ? { ...conv, ...updates } : conv
//       );
//       if (updates.lastMessageAt) {
//         return updated.sort((a, b) =>
//           new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
//         );
//       }
//       return updated;
//     });
//   }, []);

//   const optimisticUpdate = useCallback((conversationId, message) => {
//     updateConversation(conversationId, {
//       lastMessage: message,
//       lastMessageAt: new Date().toISOString(),
//     });
//   }, [updateConversation]);

//   const setActiveConversationId = useCallback((id) => {
//     activeConversationIdRef.current = id;
//   }, []);

//   return {
//     conversations,
//     loading,
//     error,
//     hasMore,
//     loadingMore,
//     loadMore,
//     filters,
//     updateFilters,
//     refresh,
//     updateConversation,
//     optimisticUpdate,
//     setActiveConversationId,
//   };
// }

// function playNotificationSound() {
//   try {
//     const audio = new Audio('/notification.mp3');
//     audio.volume = 0.5;
//     audio.play().catch(() => {});
//   } catch (error) {
//     // Ignore
//   }
// }




import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

// NOTE: `ws` is now passed in from the single useWebSocket() owner (App).
// This hook no longer calls useWebSocket() itself, so there is exactly ONE
// socket connection in the tree — no more connect/disconnect stomping.
//
// NOTE (notifications): this hook NO LONGER plays any sound. App is the single
// owner of both the audible beep and the OS notification — it notifies straight
// off the raw WS event, before any list filtering/search/group scoping. Leaving
// a second sound here would double-fire (and beep on agent echoes + the open
// conversation). This hook's only job is keeping the list data in sync.
export function useConversations(employeeId, ws, initialFilters = {}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState({
    status: 'open',
    storeId: '',
    priority: '',
    search: '',
    storeGroup: '',
    limit: 50,
    ...initialFilters,
  });

  const activeConversationIdRef = useRef(null);
  const offsetRef = useRef(0);   // rows loaded so far = offset for the next page

  const loadConversations = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const pageSize = filters.limit || 50;
      const data = await api.getConversations({ ...filters, offset: 0 });
      console.log('📥 [useConversations] Loaded conversations:', data.length);
      setConversations(data);
      offsetRef.current = data.length;
      setHasMore(data.length >= pageSize);   // full page back → assume more exists
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      setError(null);
      const pageSize = filters.limit || 50;
      const data = await api.getConversations({ ...filters, offset: offsetRef.current });
      console.log('📥 [useConversations] Loaded more:', data.length, 'at offset', offsetRef.current);
      setConversations(prev => {
        const seen = new Set(prev.map(c => c.id));
        const fresh = data.filter(c => !seen.has(c.id));   // drop dups from live-insert drift
        return [...prev, ...fresh].sort((a, b) =>
          new Date(b.lastMessageAt || b.updatedAt || 0) -
          new Date(a.lastMessageAt || a.updatedAt || 0)
        );
      });
      offsetRef.current += data.length;
      setHasMore(data.length >= pageSize);
    } catch (err) {
      console.error('Failed to load more conversations:', err);
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [filters, hasMore, loadingMore]);

  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  const refetchTimer = useRef(null);
  const scheduleRefetch = useCallback(() => {
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => loadConversations(false), 1500);
  }, [loadConversations]);

  const updateConversationFromData = useCallback((conversationData) => {
    setConversations(prev => {
      const index = prev.findIndex(c => c.id === conversationData.id);
      if (index > -1) {
        const updated = [...prev];
        const incoming = { ...conversationData };
        if (incoming.id === activeConversationIdRef.current) {
          delete incoming.unreadCount;
          delete incoming.unread_count;
          delete incoming.unread;
        }
        updated[index] = { ...updated[index], ...incoming };
        console.log('✅ [useConversations] Updated conversation:', {
          id: updated[index].id,
          unreadCount: updated[index].unreadCount || updated[index].unread_count,
          lastMessage: updated[index].lastMessage?.substring(0, 30)
        });
        return updated.sort((a, b) =>
          new Date(b.lastMessageAt || b.updatedAt || 0) -
          new Date(a.lastMessageAt || a.updatedAt || 0)
        );
      } else {
        console.log('🆕 [useConversations] Adding new conversation to list:', conversationData.id);
        return [conversationData, ...prev].sort((a, b) =>
          new Date(b.lastMessageAt || b.updatedAt || 0) -
          new Date(a.lastMessageAt || a.updatedAt || 0)
        );
      }
    });
  }, []);

  const updateConversationFromMessage = useCallback((data) => {
    const conversationId = data.conversationId || data.conversation_id;
    const messageContent = data.message?.content || data.content || '';
    const messageTime = data.message?.createdAt || data.createdAt || new Date().toISOString();

    setConversations(prev => {
      const index = prev.findIndex(c => c.id === conversationId);
      if (index > -1) {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessage: messageContent,
          lastMessageAt: messageTime,
          totalMessageCount: (updated[index].totalMessageCount || 0) + 1,
        };
        return updated.sort((a, b) =>
          new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        );
      } else {
        console.log('🆕 [useConversations] New conversation detected, refreshing...');
        scheduleRefetch();
        return prev;
      }
    });
  }, [scheduleRefetch]);

  const addNewConversation = useCallback((conversationData) => {
    setConversations(prev => {
      if (prev.find(c => c.id === conversationData.id)) {
        console.log('⚠️ [useConversations] Conversation already exists, updating');
        return prev.map(c =>
          c.id === conversationData.id ? { ...c, ...conversationData } : c
        );
      }
      console.log('➕ [useConversations] Adding new conversation:', conversationData.id);
      return [conversationData, ...prev].sort((a, b) =>
        new Date(b.lastMessageAt || b.updatedAt || 0) -
        new Date(a.lastMessageAt || a.updatedAt || 0)
      );
    });
  }, []);

  useEffect(() => {
    if (!ws) return;

    console.log('👂 [useConversations] Setting up WebSocket listeners...');

    // Collect every unsubscribe here. Teardown iterates whatever's in the array,
    // so adding/removing a listener is a single push() with no separate teardown
    // line to keep in sync — this structurally prevents the "off() references an
    // undeclared handler" ReferenceError.
    const subs = [];

    subs.push(ws.on('new_message', (data) => {
      // Skip preview update for auto-replies — conversation_updated corrects it
      if (data.message?.isAutoReply === true) {
        console.log('🤖 [useConversations] Auto-reply skipped, waiting for conversation_updated');
        return;
      }

      console.log('📨 [useConversations] New message:', {
        conversationId: data.conversationId,
        hasConversation: !!data.conversation,
        hasMessage: !!data.message
      });

      if (data.conversation) {
        console.log('🔄 [useConversations] Updating with full conversation data:', {
          id: data.conversation.id,
          unreadCount: data.conversation.unreadCount || data.conversation.unread_count
        });
        updateConversationFromData(data.conversation);
      } else {
        console.log('⚠️ [useConversations] No conversation data, using message fallback');
        updateConversationFromMessage(data);
      }

      // NO sound here — App owns the audible cue + OS notification (single owner).
    }));

    subs.push(ws.on('conversation_read', (data) => {
      console.log('📖 [useConversations] Conversation read:', { conversationId: data.conversationId });
      if (data.conversation) {
        const readConversation = {
          ...data.conversation,
          unreadCount: 0,
          unread_count: 0,
          unread: 0,
        };
        updateConversationFromData(readConversation);
      } else {
        updateConversation(data.conversationId, {
          unreadCount: 0,
          unread_count: 0,
          unread: 0,
          lastReadAt: new Date().toISOString(),
        });
      }
    }));

    subs.push(ws.on('new_conversation', (data) => {
      console.log('🆕 [useConversations] New conversation:', data);
      if (data.conversation) {
        addNewConversation(data.conversation);
      } else {
        scheduleRefetch();
      }
    }));

    // ── Gap recovery for the LIST ─────────────────────────────────────────
    // While the socket was dead (inactive tab, sleep, edge drop), customers may
    // have messaged conversations that weren't open. Reconnect resumes the live
    // stream but does NOT replay the gap — so re-pull the list to refresh unread
    // badges, previews, and ordering. Debounced (scheduleRefetch) + no spinner
    // (loadConversations(false)), so it's invisible to the agent.
    subs.push(ws.on('connected', () => {
      console.log('🔌 [useConversations] Reconnected — refreshing list to backfill gap');
      scheduleRefetch();
    }));

    return () => {
      console.log('🔇 [useConversations] Cleaning up WebSocket listeners');
      subs.forEach(unsub => { try { unsub && unsub(); } catch (e) {} });
      clearTimeout(refetchTimer.current);
    };
  }, [ws, updateConversationFromData, updateConversationFromMessage, addNewConversation, scheduleRefetch]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => {
    console.log('🔄 [useConversations] Manual refresh triggered');
    loadConversations(true);
  }, [loadConversations]);

  const updateConversation = useCallback((id, updates) => {
    console.log('🔄 [useConversations] Manual update:', { id, updates });
    setConversations(prev => {
      const updated = prev.map(conv =>
        conv.id === id ? { ...conv, ...updates } : conv
      );
      if (updates.lastMessageAt) {
        return updated.sort((a, b) =>
          new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        );
      }
      return updated;
    });
  }, []);

  const optimisticUpdate = useCallback((conversationId, message) => {
    updateConversation(conversationId, {
      lastMessage: message,
      lastMessageAt: new Date().toISOString(),
    });
  }, [updateConversation]);

  const setActiveConversationId = useCallback((id) => {
    activeConversationIdRef.current = id;
  }, []);

  return {
    conversations,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    filters,
    updateFilters,
    refresh,
    updateConversation,
    optimisticUpdate,
    setActiveConversationId,
  };
}