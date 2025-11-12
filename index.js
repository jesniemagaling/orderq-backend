import http from 'http';
import dotenv from 'dotenv';
import app from './src/app.js';
import { Server } from 'socket.io';
import { startSessionCleanup } from './src/cron/sessionCleanup.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

export const notifyNewOrder = (tableId, data = {}) => {
  io.emit('newOrder', { tableId, ...data });
  console.log(`New order event emitted for Table ${tableId}`);
};

export const notifyTableStatus = (tableId, status) => {
  io.emit('tableStatusUpdate', { tableId, status });
  console.log(`Table ${tableId} status updated → ${status}`);
};

export const notifyMenuUpdate = (menuItem) => {
  io.emit('menuUpdated', menuItem);
};

export const notifySessionUpdate = (sessionData) => {
  io.emit('sessionUpdate', sessionData);
};

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

startSessionCleanup();
