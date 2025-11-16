import express from 'express';
import {
  getAllTables,
  updateTableStatus,
  getTableDetails,
  getTableQR,
  getAllTableQR,
} from '../controllers/tableController.js';

const router = express.Router();

router.get('/', getAllTables);
router.get('/qr/all', getAllTableQR);
router.get('/:table_id/details', getTableDetails);
router.get('/:id/qr', getTableQR);
router.put('/:id/status', updateTableStatus);

export default router;
