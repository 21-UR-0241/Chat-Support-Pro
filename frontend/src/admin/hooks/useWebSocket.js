

import { useEffect, useRef, useCallback, useMemo } from 'react';
import websocketService from '../services/websocket';

export function useWebSocket(employeeId) {
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (employeeId && !isConnectedRef.current) {
      websocketService.connect(employeeId);
      isConnectedRef.current = true;
    }

    return () => {
      if (isConnectedRef.current) {
        websocketService.disconnect();
        isConnectedRef.current = false;
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

  // Stable identity: every method is useCallback([]) so this object never
  // changes for the life of the component. This is what makes `[ws]` effect
  // dependencies actually stable instead of churning on every render.
  return useMemo(() => ({
    on,
    send,
    joinConversation,
    leaveConversation,
    sendTyping,
    isConnected,
  }), [on, send, joinConversation, leaveConversation, sendTyping, isConnected]);
}