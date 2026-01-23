/**
 * useConversations Hook
 * Manages conversation list and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useWebSocket } from './useWebSocket';

export function useConversations(employeeId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true); // Only for initial load
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
    loadConversations(true); // Show loading on initial load
  }, [loadConversations]);

  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!ws) return;

    const unsubscribe = ws.on('new_message', (data) => {
      console.log('📨 New message notification:', data);
      
      // Update conversation locally (no loading state)
      updateConversationFromMessage(data);

      // Play notification sound
      playNotificationSound();
    });

    return unsubscribe;
  }, [ws]);

  // Update conversation from WebSocket message
  const updateConversationFromMessage = useCallback((data) => {
    setConversations(prev => {
      const conversationId = data.conversationId || data.conversation_id;
      const messageContent = data.message?.content || data.content || '';
      const messageTime = data.message?.createdAt || data.createdAt || new Date().toISOString();
      
      const index = prev.findIndex(c => c.id === conversationId);
      
      if (index > -1) {
        // Update existing conversation
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessage: messageContent,
          lastMessageAt: messageTime,
          totalMessageCount: (updated[index].totalMessageCount || 0) + 1,
        };
        
        // Move to top and sort by most recent
        return updated.sort((a, b) => 
          new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        );
      } else {
        // New conversation detected - silently refresh in background
        console.log('🆕 New conversation detected, refreshing...');
        loadConversations(false); // false = don't show loading spinner
        return prev;
      }
    });
  }, [loadConversations]);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Manual refresh (shows loading)
  const refresh = useCallback(() => {
    loadConversations(true); // true = show loading spinner
  }, [loadConversations]);

  // Update conversation locally (without API call)
  const updateConversation = useCallback((id, updates) => {
    setConversations(prev => {
      const updated = prev.map(conv =>
        conv.id === id ? { ...conv, ...updates } : conv
      );
      
      // Re-sort if lastMessageAt was updated
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
      // Ignore errors (user might not have interacted with page yet)
      console.log('Could not play notification:', err.message);
    });
  } catch (error) {
    // Ignore
  }
}