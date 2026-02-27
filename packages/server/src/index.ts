/**
 * Hyper Fairy Chess - Multiplayer Server
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/socketServer';
import { RoomManager } from './rooms/RoomManager';

const PORT = process.env.PORT || 3001;
// Allow all origins in development for LAN play
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Create Express app
const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Room stats endpoint
app.get('/stats', (_req, res) => {
  const stats = roomManager.getStats();
  res.json(stats);
});

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Create room manager
const roomManager = new RoomManager();

// Setup socket handlers
setupSocketHandlers(io, roomManager);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Hyper Fairy Chess server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
