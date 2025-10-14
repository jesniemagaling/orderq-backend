import express from 'express';
import {
  getAllTables,
  updateTableStatus,
} from '../controllers/tableController.js';

const router = express.Router();

router.get('/', getAllTables);
router.put('/:id/status', updateTableStatus);

export default router;
