
import { useEffect, useRef, useCallback } from 'react';
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

  return {
    on,
    send,
    joinConversation,
    leaveConversation,
    sendTyping,
    isConnected,
  };
}