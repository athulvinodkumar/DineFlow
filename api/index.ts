import express from 'express';
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
import realtimeRoutes from './routes/realtime';
import cronRoutes from './routes/cron';

const app = express();

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
app.use('/api/realtime', realtimeRoutes);
app.use('/api/cron', cronRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DineFlow Serverless API',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString(),
  });
});

// Local dev static server helper (fallback when running standalone outside Vite/Vercel)
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

// For non-Vercel standalone execution, start HTTP server
const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 DineFlow API Server running locally on port ${PORT}`);
  });
}

// Default export as serverless handler for Vercel
export default app;
