import express from 'express';
import {
  getMenu,
  getMenuById,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getTopSellingItems,
} from '../controllers/menuController.js';
import { verifyToken, verifyRole } from '../middleware/authMiddleware.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

router.get('/', getMenu);
router.get('/top-selling', getTopSellingItems);
router.get('/:id', getMenuById);
router.post(
  '/',
  // verifyToken,
  // verifyRole(['admin']), // Uncomment to protect
  [body('name').notEmpty(), body('price').isFloat({ gt: 0 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    addMenuItem(req, res);
  }
);

router.put(
  '/:id',
  // verifyToken,
  // verifyRole(['admin']), // Uncomment to protect
  [body('name').notEmpty(), body('price').isFloat({ gt: 0 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    updateMenuItem(req, res);
  }
);

router.delete(
  '/:id',
  // verifyToken,
  // verifyRole(['admin']), // Uncomment to protect
  async (req, res) => {
    deleteMenuItem(req, res);
  }
);

export default router;
