/**
 * Socket.io Context Provider
 * Manages WebSocket connection to game server
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerMessage, ServerToClientMessage } from '@hyper-fairy-chess/shared';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  sendMessage: (message: ClientToServerMessage) => void;
  addMessageListener: (handler: (message: ServerToClientMessage) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

// Get server URL from environment or default to same host
const getServerUrl = (): string | undefined => {
  // Check for Vite env variable
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // In development, try localhost:3001
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  // For LAN play, assume server is on same host but port 3001
  return `http://${window.location.hostname}:3001`;
};

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const messageHandlers = useRef<Set<(message: ServerToClientMessage) => void>>(new Set());

  useEffect(() => {
    const serverUrl = getServerUrl();
    console.log('Connecting to server:', serverUrl);

    const socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    socketInstance.on('message', (message: ServerToClientMessage) => {
      messageHandlers.current.forEach(handler => handler(message));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const sendMessage = useCallback((message: ClientToServerMessage) => {
    if (socket && isConnected) {
      socket.emit('message', message);
    } else {
      console.warn('Cannot send message - socket not connected');
    }
  }, [socket, isConnected]);

  const addMessageListener = useCallback((handler: (message: ServerToClientMessage) => void) => {
    messageHandlers.current.add(handler);
    return () => {
      messageHandlers.current.delete(handler);
    };
  }, []);

  const value: SocketContextValue = {
    socket,
    isConnected,
    connectionError,
    sendMessage,
    addMessageListener,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
