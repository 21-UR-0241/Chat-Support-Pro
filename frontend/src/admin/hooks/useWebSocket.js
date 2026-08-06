

// import { useEffect, useRef, useCallback, useMemo } from 'react';
// import websocketService from '../services/websocket';

// export function useWebSocket(employeeId) {
//   const isConnectedRef = useRef(false);

//   useEffect(() => {
//     if (employeeId && !isConnectedRef.current) {
//       websocketService.connect(employeeId);
//       isConnectedRef.current = true;
//     }

//     return () => {
//       if (isConnectedRef.current) {
//         websocketService.disconnect();
//         isConnectedRef.current = false;
//       }
//     };
//   }, [employeeId]);

//   const on = useCallback((event, callback) => {
//     return websocketService.on(event, callback);
//   }, []);

//   const send = useCallback((data) => {
//     websocketService.send(data);
//   }, []);

//   const joinConversation = useCallback((conversationId) => {
//     websocketService.joinConversation(conversationId);
//   }, []);

//   const leaveConversation = useCallback(() => {
//     websocketService.leaveConversation();
//   }, []);

//   const sendTyping = useCallback((conversationId, isTyping, senderName) => {
//     websocketService.sendTyping(conversationId, isTyping, senderName);
//   }, []);

//   const isConnected = useCallback(() => {
//     return websocketService.isConnected();
//   }, []);

//   // Stable identity: every method is useCallback([]) so this object never
//   // changes for the life of the component. This is what makes `[ws]` effect
//   // dependencies actually stable instead of churning on every render.
//   return useMemo(() => ({
//     on,
//     send,
//     joinConversation,
//     leaveConversation,
//     sendTyping,
//     isConnected,
//   }), [on, send, joinConversation, leaveConversation, sendTyping, isConnected]);
// }




import { useEffect, useRef, useCallback, useMemo } from 'react';
import websocketService from '../services/websocket';

export function useWebSocket(employeeId) {
  const isConnectedRef = useRef(false);
  const pendingDisconnectRef = useRef(null);

  useEffect(() => {
    // If a disconnect from a StrictMode "phantom" cleanup is still pending
    // (scheduled below), cancel it — we're mounting again right away, so
    // the connection should survive rather than being torn down and reopened.
    if (pendingDisconnectRef.current) {
      clearTimeout(pendingDisconnectRef.current);
      pendingDisconnectRef.current = null;
    }

    if (employeeId && !isConnectedRef.current) {
      websocketService.connect(employeeId);
      isConnectedRef.current = true;
    }

    return () => {
      // Defer the actual disconnect instead of calling it synchronously.
      // In React 18 StrictMode dev double-invoke, the immediate re-mount's
      // effect (above) runs before this timeout fires and cancels it — so
      // the real underlying WebSocket survives the phantom unmount/remount
      // instead of being closed mid-handshake. On a genuine unmount (e.g.
      // logout, switching groups), nothing cancels it, so it disconnects
      // normally after 0ms.
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