/**
 * useConversations Hook
 * Manages conversation list and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
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

  const ws = useWebSocket(employeeId);

  // Load conversations
  const loadConversations = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const data = await api.getConversations(filters);
      console.log('📥 [useConversations] Loaded conversations:', data.length);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  // ✅ Listen for ALL WebSocket events
  useEffect(() => {
    if (!ws) return;

    console.log('👂 [useConversations] Setting up WebSocket listeners...');

    // ✅ Handle new messages
    const unsubscribe1 = ws.on('new_message', (data) => {
      console.log('📨 [useConversations] New message:', {
        conversationId: data.conversationId,
        hasConversation: !!data.conversation,
        hasMessage: !!data.message
      });
      
      // Use full conversation data if available
      if (data.conversation) {
        console.log('🔄 [useConversations] Updating with full conversation data:', {
          id: data.conversation.id,
          unreadCount: data.conversation.unreadCount || data.conversation.unread_count
        });
        updateConversationFromData(data.conversation);
      } else {
        // Fallback: update from message only
        console.log('⚠️ [useConversations] No conversation data, using message fallback');
        updateConversationFromMessage(data);
      }

      // Play notification sound
      playNotificationSound();
    });

    // ✅ Handle conversation read events
    const unsubscribe2 = ws.on('conversation_read', (data) => {
      console.log('📖 [useConversations] Conversation read:', {
        conversationId: data.conversationId,
        hasConversation: !!data.conversation
      });
      
      if (data.conversation) {
        console.log('🔄 [useConversations] Updating read conversation:', {
          id: data.conversation.id,
          unreadCount: data.conversation.unreadCount || data.conversation.unread_count
        });
        updateConversationFromData(data.conversation);
      } else {
        // Fallback: manually set unread to 0
        updateConversation(data.conversationId, {
          unreadCount: 0,
          unread_count: 0,
          lastReadAt: new Date().toISOString()
        });
      }
    });

    // ✅ Handle new conversations
    const unsubscribe3 = ws.on('new_conversation', (data) => {
      console.log('🆕 [useConversations] New conversation:', data);
      
      if (data.conversation) {
        addNewConversation(data.conversation);
      } else {
        // Fallback: refresh list
        loadConversations(false);
      }
    });

    return () => {
      console.log('🔇 [useConversations] Cleaning up WebSocket listeners');
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, [ws]);

  // ✅ Update conversation with full data (includes unreadCount)
  const updateConversationFromData = useCallback((conversationData) => {
    setConversations(prev => {
      const index = prev.findIndex(c => c.id === conversationData.id);
      
      if (index > -1) {
        // Update existing conversation with full data
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          ...conversationData, // ✅ Merge all fields including unreadCount
        };
        
        console.log('✅ [useConversations] Updated conversation:', {
          id: updated[index].id,
          unreadCount: updated[index].unreadCount || updated[index].unread_count,
          lastMessage: updated[index].lastMessage?.substring(0, 30)
        });
        
        // Sort by most recent
        return updated.sort((a, b) => 
          new Date(b.lastMessageAt || b.updatedAt || 0) - 
          new Date(a.lastMessageAt || a.updatedAt || 0)
        );
      } else {
        // New conversation not in list - add it
        console.log('🆕 [useConversations] Adding new conversation to list:', conversationData.id);
        return [conversationData, ...prev].sort((a, b) => 
          new Date(b.lastMessageAt || b.updatedAt || 0) - 
          new Date(a.lastMessageAt || a.updatedAt || 0)
        );
      }
    });
  }, []);

  const unsubscribe1 = ws.on('new_message', (data) => {
  console.log('📨 [useConversations] New message:', {
    conversationId: data.conversationId,
    hasConversation: !!data.conversation,
    hasMessage: !!data.message,
    currentFilter: filters.storeId, // ✅ ADD THIS
    conversationStoreId: data.conversation?.storeIdentifier || data.conversation?.shopId // ✅ ADD THIS
  });
  
  // ✅ ADD THIS SPECIAL CHECK FOR GUELPH
  if (data.conversation?.storeIdentifier?.includes('guelph') || 
      data.conversation?.shopId === 'guelph' ||
      data.conversationId === 48) {
    console.log('🔍 [GUELPH DEBUG] Full conversation data:', data.conversation);
    console.log('🔍 [GUELPH DEBUG] Current filter:', filters);
  }
  
  if (data.conversation) {
    updateConversationFromData(data.conversation);
  } else {
    updateConversationFromMessage(data);
  }

  playNotificationSound();
});

  // ✅ Fallback: Update conversation from message only
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

  // ✅ Add new conversation to list
  const addNewConversation = useCallback((conversationData) => {
    setConversations(prev => {
      // Check if already exists
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

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    console.log('🔄 [useConversations] Manual refresh triggered');
    loadConversations(true);
  }, [loadConversations]);

  // Update conversation locally
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

  // Optimistically update conversation when sending a message
  const optimisticUpdate = useCallback((conversationId, message) => {
    updateConversation(conversationId, {
      lastMessage: message,
      lastMessageAt: new Date().toISOString(),
    });
  }, [updateConversation]);

  return {
    conversations,
    loading,
    error,
    filters,
    updateFilters,
    refresh,
    updateConversation,
    optimisticUpdate,
  };
}

// Helper: Play notification sound
function playNotificationSound() {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => {
      // Ignore errors
    });
  } catch (error) {
    // Ignore
  }
}