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
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getConversations(filters);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Listen for new messages
  useEffect(() => {
    if (!ws) return; // ← ADD THIS NULL CHECK

    const unsubscribe = ws.on('new_message', (data) => {
      console.log('New message notification:', data);
      
      // Update conversation in list
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === data.conversationId);
        
        if (index > -1) {
          // Update existing conversation
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            lastMessage: data.message?.content || '', // ← ADD SAFE ACCESS
            lastMessageAt: data.message?.createdAt || new Date().toISOString(),
            totalMessageCount: (updated[index].totalMessageCount || 0) + 1,
          };
          
          // Move to top
          const conversation = updated.splice(index, 1)[0];
          return [conversation, ...updated];
        } else {
          // New conversation - reload
          loadConversations();
          return prev;
        }
      });

      // Play notification sound
      playNotificationSound();
    });

    return unsubscribe;
  }, [ws, loadConversations]);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Refresh conversations
  const refresh = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  // Update conversation locally
  const updateConversation = useCallback((id, updates) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, ...updates } : conv
      )
    );
  }, []);

  return {
    conversations,
    loading,
    error,
    filters,
    updateFilters,
    refresh,
    updateConversation,
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