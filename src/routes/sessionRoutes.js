import express from 'express';
import {
  createSession,
  verifySession,
  endSession,
  scanSessionFromQR,
} from '../controllers/sessionController.js';

const router = express.Router();

router.get('/scan/:table_number', scanSessionFromQR);
router.post('/', createSession);
router.get('/:token', verifySession);
router.post('/end/:token', endSession);

export default router;
