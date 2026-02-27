/**
 * Socket Connection Hook
 * Provides access to socket context with convenient helpers
 */

import { useCallback, useEffect } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { ClientToServerMessage, ServerToClientMessage } from '@hyper-fairy-chess/shared';

export function useSocket() {
  const { socket, isConnected, connectionError, sendMessage, addMessageListener } = useSocketContext();

  return {
    socket,
    isConnected,
    connectionError,
    sendMessage,
    addMessageListener,
  };
}

/**
 * Hook that listens for specific message types
 */
export function useMessageListener<T extends ServerToClientMessage['type']>(
  messageType: T,
  handler: (message: Extract<ServerToClientMessage, { type: T }>) => void
) {
  const { addMessageListener } = useSocketContext();

  useEffect(() => {
    const unsubscribe = addMessageListener((message) => {
      if (message.type === messageType) {
        handler(message as Extract<ServerToClientMessage, { type: T }>);
      }
    });

    return unsubscribe;
  }, [addMessageListener, messageType, handler]);
}

/**
 * Hook for sending typed messages
 */
export function useSendMessage() {
  const { sendMessage, isConnected } = useSocketContext();

  const send = useCallback(<T extends ClientToServerMessage>(message: T) => {
    if (!isConnected) {
      console.warn('Cannot send message - not connected');
      return false;
    }
    sendMessage(message);
    return true;
  }, [sendMessage, isConnected]);

  return send;
}
