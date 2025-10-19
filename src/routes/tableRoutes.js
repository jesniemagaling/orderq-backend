import express from 'express';
import {
  getAllTables,
  updateTableStatus,
  getTableDetails,
} from '../controllers/tableController.js';

const router = express.Router();

router.get('/', getAllTables);
router.get('/:table_id/details', getTableDetails);
router.put('/:id/status', updateTableStatus);

export default router;
