
// import { useState, useEffect, useCallback, useRef } from 'react';
// import api from '../services/api';
// import { useWebSocket } from './useWebSocket';

// export function useConversations(employeeId) {
//   const [conversations, setConversations] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [filters, setFilters] = useState({
//     status: 'open',
//     storeId: '',
//     priority: '',
//     search: '',
//   });

//   // ✅ Track which conversation the admin is currently viewing
//   // so WebSocket updates don't overwrite unreadCount=0 on the active conversation
//   const activeConversationIdRef = useRef(null);

//   const ws = useWebSocket(employeeId);

//   // Load conversations
//   const loadConversations = useCallback(async (showLoading = true) => {
//     try {
//       if (showLoading) {
//         setLoading(true);
//       }
//       setError(null);

//       const data = await api.getConversations(filters);
//       console.log('📥 [useConversations] Loaded conversations:', data.length);
//       setConversations(data);
//     } catch (err) {
//       console.error('Failed to load conversations:', err);
//       setError(err.message);
//     } finally {
//       if (showLoading) {
//         setLoading(false);
//       }
//     }
//   }, [filters]);

//   // Initial load
//   useEffect(() => {
//     loadConversations(true);
//   }, [loadConversations]);

//   // ✅ Update conversation with full data (includes unreadCount)
//   const updateConversationFromData = useCallback((conversationData) => {
//     setConversations(prev => {
//       const index = prev.findIndex(c => c.id === conversationData.id);

//       if (index > -1) {
//         const updated = [...prev];
//         const incoming = { ...conversationData };

//         // ✅ KEY FIX: If this is the conversation the admin is currently viewing,
//         // do NOT let the server's unreadCount overwrite our local 0.
//         // The server may not have processed our mark-as-read yet.
//         if (incoming.id === activeConversationIdRef.current) {
//           delete incoming.unreadCount;
//           delete incoming.unread_count;
//           delete incoming.unread;
//         }

//         updated[index] = {
//           ...updated[index],
//           ...incoming,
//         };

//         console.log('✅ [useConversations] Updated conversation:', {
//           id: updated[index].id,
//           unreadCount: updated[index].unreadCount || updated[index].unread_count,
//           lastMessage: updated[index].lastMessage?.substring(0, 30)
//         });

//         // Sort by most recent
//         return updated.sort((a, b) =>
//           new Date(b.lastMessageAt || b.updatedAt || 0) -
//           new Date(a.lastMessageAt || a.updatedAt || 0)
//         );
//       } else {
//         // New conversation not in list - add it
//         console.log('🆕 [useConversations] Adding new conversation to list:', conversationData.id);
//         return [conversationData, ...prev].sort((a, b) =>
//           new Date(b.lastMessageAt || b.updatedAt || 0) -
//           new Date(a.lastMessageAt || a.updatedAt || 0)
//         );
//       }
//     });
//   }, []);

//   // ✅ Fallback: Update conversation from message only
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
//         loadConversations(false);
//         return prev;
//       }
//     });
//   }, [loadConversations]);

//   // ✅ Add new conversation to list
//   const addNewConversation = useCallback((conversationData) => {
//     setConversations(prev => {
//       // Check if already exists
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

//   // ✅ Listen for WebSocket events (SINGLE listener setup, no duplicates)
//   useEffect(() => {
//     if (!ws) return;

//     console.log('👂 [useConversations] Setting up WebSocket listeners...');

//     // Handle new messages
//     const unsubMessage = ws.on('new_message', (data) => {
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
//     });

//     // Handle conversation read events
//     const unsubRead = ws.on('conversation_read', (data) => {
//       console.log('📖 [useConversations] Conversation read:', {
//         conversationId: data.conversationId,
//       });

//       if (data.conversation) {
//         // ✅ Force unreadCount to 0 for read events (don't rely on server data alone)
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
//     });

//     // Handle new conversations
//     const unsubNewConv = ws.on('new_conversation', (data) => {
//       console.log('🆕 [useConversations] New conversation:', data);

//       if (data.conversation) {
//         addNewConversation(data.conversation);
//       } else {
//         loadConversations(false);
//       }
//     });

//     return () => {
//       console.log('🔇 [useConversations] Cleaning up WebSocket listeners');
//       unsubMessage();
//       unsubRead();
//       unsubNewConv();
//     };
//   }, [ws, updateConversationFromData, updateConversationFromMessage, addNewConversation, loadConversations]);

//   // Update filters
//   const updateFilters = useCallback((newFilters) => {
//     setFilters(prev => ({ ...prev, ...newFilters }));
//   }, []);

//   // Manual refresh
//   const refresh = useCallback(() => {
//     console.log('🔄 [useConversations] Manual refresh triggered');
//     loadConversations(true);
//   }, [loadConversations]);

//   // Update conversation locally
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

//   // Optimistically update conversation when sending a message
//   const optimisticUpdate = useCallback((conversationId, message) => {
//     updateConversation(conversationId, {
//       lastMessage: message,
//       lastMessageAt: new Date().toISOString(),
//     });
//   }, [updateConversation]);

//   // ✅ Set which conversation is currently being viewed
//   const setActiveConversationId = useCallback((id) => {
//     activeConversationIdRef.current = id;
//   }, []);

//   return {
//     conversations,
//     loading,
//     error,
//     filters,
//     updateFilters,
//     refresh,
//     updateConversation,
//     optimisticUpdate,
//     setActiveConversationId, // ✅ NEW: expose this so App.js can tell us which conv is active
//   };
// }

// // Helper: Play notification sound
// function playNotificationSound() {
//   try {
//     const audio = new Audio('/notification.mp3');
//     audio.volume = 0.5;
//     audio.play().catch(err => {
//       // Ignore errors
//     });
//   } catch (error) {
//     // Ignore
//   }
// }




import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useWebSocket } from './useWebSocket';

export function useConversations(employeeId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'open',
    storeId: '',
    priority: '',
    search: '',
  });

  const activeConversationIdRef = useRef(null);
  const ws = useWebSocket(employeeId);

  const loadConversations = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const data = await api.getConversations(filters);
      console.log('📥 [useConversations] Loaded conversations:', data.length);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadConversations(true);
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
        loadConversations(false);
        return prev;
      }
    });
  }, [loadConversations]);

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

    const unsubMessage = ws.on('new_message', (data) => {
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

      playNotificationSound();
    });

    const unsubRead = ws.on('conversation_read', (data) => {
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
    });

    const unsubNewConv = ws.on('new_conversation', (data) => {
      console.log('🆕 [useConversations] New conversation:', data);
      if (data.conversation) {
        addNewConversation(data.conversation);
      } else {
        loadConversations(false);
      }
    });

    return () => {
      console.log('🔇 [useConversations] Cleaning up WebSocket listeners');
      unsubMessage();
      unsubRead();
      unsubNewConv();
    };
  }, [ws, updateConversationFromData, updateConversationFromMessage, addNewConversation, loadConversations]);

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
    filters,
    updateFilters,
    refresh,
    updateConversation,
    optimisticUpdate,
    setActiveConversationId,
  };
}

function playNotificationSound() {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (error) {
    // Ignore
  }
}