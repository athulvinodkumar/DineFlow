import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './routes/auth';
import staffRoutes from './routes/staff';
import menuRoutes from './routes/menu';
import tableRoutes from './routes/tables';
import orderRoutes from './routes/orders';
import billRoutes from './routes/bills';
import reportRoutes from './routes/reports';
import settingRoutes from './routes/settings';
import displayRoutes from './routes/display';
import { setupSocketHandlers } from './sockets';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

app.set('io', io);
setupSocketHandlers(io);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/display', displayRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DineFlow Server',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend build if present (for unified single-command deployment)
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexHtml = path.join(clientDistPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.status(200).send('DineFlow API is running. Start the Vite client for frontend UI.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 DineFlow Server running on port ${PORT}`);
  console.log(`📡 Socket.IO initialized`);
});
