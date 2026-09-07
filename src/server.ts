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
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'VocabVerse API' });
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

// VocabVerse Gamification Routes
import userProfileRoutes from './routes/user-profile.routes';
import xpRoutes from './routes/xp.routes';
import questRoutes from './routes/quest.routes';
import wordMasteryRoutes from './routes/word-mastery.routes';
import worddexRoutes from './routes/worddex.routes';
import gardenRoutes from './routes/garden.routes';
import worldsRoutes from './routes/worlds.routes';
import chatRoutes from './routes/chat.routes';

// Core routes
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/columns', columnsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// Gamification routes
app.use('/api/user-profile', userProfileRoutes);
app.use('/api/xp', xpRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/mastery', wordMasteryRoutes);
app.use('/api/worddex', worddexRoutes);
app.use('/api/garden', gardenRoutes);
app.use('/api/worlds', worldsRoutes);

app.listen(port, () => {
  console.log(`VocabVerse backend server is running on http://localhost:${port}`);
});
