import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

export const prisma = new PrismaClient();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

import authRoutes from './routes/auth.routes';
import cardsRoutes from './routes/cards.routes';
import columnsRoutes from './routes/columns.routes';
import historyRoutes from './routes/history.routes';
import organizationsRoutes from './routes/organizations.routes';
import statisticsRoutes from './routes/statistics.routes';
import aiRoutes from './routes/ai.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminRoutes from './routes/admin.routes';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/columns', columnsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});
