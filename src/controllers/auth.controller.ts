import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../server';
import { generateToken } from '../middleware/auth';
import { updateDailyStreak } from '../services/gamification.service';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  organizationId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const { name, email, password, organizationId } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ success: false, error: 'Email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        organizationId: organizationId || null,
        role: 'USER', // Default role
      },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      }
    });
  } catch (error: any) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.format() });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      subscriptionTier: user.subscriptionTier,
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        subscriptionTier: user.subscriptionTier,
      }
    });
  } catch (error: any) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const me = async (req: any, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        subscriptionTier: true,
      }
    });
    
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * Telegram Bot Authentication Endpoint
 * Auto-registers or authenticates Telegram users and returns a JWT token.
 */
export const telegramAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramId, firstName, lastName, username, languageCode } = req.body;
    if (!telegramId) {
      res.status(400).json({ success: false, error: 'telegramId is required' });
      return;
    }

    const email = `tg_${telegramId}@vocabverse.app`;
    let user = await prisma.user.findFirst({
      where: { email },
      include: { profile: true, streak: true, statistics: true },
    });

    const todayStr = new Date().toISOString().split('T')[0];

    if (!user) {
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const displayName = username ? `@${username}` : fullName || 'Cosmic Learner';

      user = await prisma.user.create({
        data: {
          email,
          name: fullName || 'Telegram Explorer',
          displayName,
          avatar: 'explorer',
          role: 'USER',
          xp: 50,
          level: 1,
          onboardingComplete: true,
          profile: {
            create: {
              englishLevel: 'INTERMEDIATE',
              nativeLanguage: languageCode || 'en',
              dailyGoalMinutes: 15,
              targetWordsPerDay: 5,
              preferredWorld: 'everyday-realm',
            },
          },
          streak: {
            create: {
              currentStreak: 1,
              longestStreak: 1,
              lastActiveDate: todayStr,
            },
          },
          statistics: {
            create: {
              totalCards: 0,
              masteredCards: 0,
              learningCards: 0,
              toLearnCards: 0,
              masteryPercentage: 0,
              totalReviewsToday: 0,
              streakDays: 1,
            },
          },
        },
        include: {
          profile: true,
          streak: true,
          statistics: true,
        },
      });
      console.log(`[Auth API] 🌟 Registered new Telegram user: ${user.name} (${user.id})`);
    } else {
      if (user.streak && user.streak.lastActiveDate !== todayStr) {
        await updateDailyStreak(user.id);
      }
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      subscriptionTier: user.subscriptionTier,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        xp: user.xp,
        level: user.level,
      },
    });
  } catch (error: any) {
    console.error('Telegram Auth Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};
