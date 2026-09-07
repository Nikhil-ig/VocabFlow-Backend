import { Router } from 'express';
import {
  enhanceMessage,
  getChatQuickPrompts,
  getChatGardenWords,
  addWordToLearning,
} from '../controllers/chat.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Send message to AI conversational coach to get word replacement suggestions & enhanced sentences
router.post('/enhance', optionalAuth, enhanceMessage);

// Get quick daily conversation prompts
router.get('/prompts', optionalAuth, getChatQuickPrompts);

// Get user's living garden words for chat practice and memory
router.get('/garden-words', optionalAuth, getChatGardenWords);

// Add word to learning list directly from chat
router.post('/add-to-learning', optionalAuth, addWordToLearning);

export default router;
