import express from 'express';
import {
  createSession,
  verifySession,
  endSession,
} from '../controllers/sessionController.js';

const router = express.Router();

router.post('/', createSession);
router.get('/:token', verifySession);
router.post('/end/:token', endSession);

export default router;
