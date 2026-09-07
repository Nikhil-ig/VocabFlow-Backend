import { Router } from 'express';
import { getWorlds } from '../controllers/worlds.controller';
import { AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vocabflow-super-secret-key-change-in-production';

// Optional auth middleware: user can be unauthenticated or authenticated
const optionalAuth = (req: AuthRequest, res: any, next: any) => {
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }
  if (token) {
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (!err && user) {
        req.user = user;
      }
      next();
    });
  } else {
    next();
  }
};

const router = Router();

router.get('/', optionalAuth, getWorlds);

export default router;
