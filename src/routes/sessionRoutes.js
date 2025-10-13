import express from 'express';
import {
  createSession,
  verifySession,
} from '../controllers/sessionController.js';

const router = express.Router();

router.post('/', createSession);
router.get('/:token', verifySession);

export default router;
