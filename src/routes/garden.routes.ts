import { Router } from 'express';
import {
  getGarden,
  getNourishChallenge,
  plantWord,
  waterPlant,
  waterAllPlants,
  removePlant,
  harvestPlant,
  getHarvestedWords,
  evaluateSentence,
} from '../controllers/garden.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuth, getGarden);
router.get('/harvested', optionalAuth, getHarvestedWords);
router.get('/nourish-challenge/:slotIndex', optionalAuth, getNourishChallenge);
router.post('/evaluate-sentence', optionalAuth, evaluateSentence);
router.post('/plant', optionalAuth, plantWord);
router.post('/water-all', optionalAuth, waterAllPlants);
router.post('/water/:slotIndex', optionalAuth, waterPlant);
router.delete('/plot/:slotIndex', optionalAuth, removePlant);
router.delete('/:slotIndex', optionalAuth, removePlant);
router.post('/harvest/:slotIndex', optionalAuth, harvestPlant);

export default router;
