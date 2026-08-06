

import { useEffect, useRef, useCallback, useMemo } from 'react';
import websocketService from '../services/websocket';

export function useWebSocket(employeeId) {
  const isConnectedRef = useRef(false);
  const pendingDisconnectRef = useRef(null);

  useEffect(() => {
    if (pendingDisconnectRef.current) {
      clearTimeout(pendingDisconnectRef.current);
      pendingDisconnectRef.current = null;
    }

    if (employeeId && !isConnectedRef.current) {
      websocketService.connect(employeeId);
      isConnectedRef.current = true;
    }

    return () => {
      if (isConnectedRef.current) {
        pendingDisconnectRef.current = setTimeout(() => {
          websocketService.disconnect();
          isConnectedRef.current = false;
          pendingDisconnectRef.current = null;
        }, 0);
      }
    };
  }, [employeeId]);

  const on = useCallback((event, callback) => {
    return websocketService.on(event, callback);
  }, []);

  const send = useCallback((data) => {
    websocketService.send(data);
  }, []);

  const joinConversation = useCallback((conversationId) => {
    websocketService.joinConversation(conversationId);
  }, []);

  const leaveConversation = useCallback(() => {
    websocketService.leaveConversation();
  }, []);

  const sendTyping = useCallback((conversationId, isTyping, senderName) => {
    websocketService.sendTyping(conversationId, isTyping, senderName);
  }, []);

  const isConnected = useCallback(() => {
    return websocketService.isConnected();
  }, []);

  return useMemo(() => ({
    on,
    send,
    joinConversation,
    leaveConversation,
    sendTyping,
    isConnected,
  }), [on, send, joinConversation, leaveConversation, sendTyping, isConnected]);
}