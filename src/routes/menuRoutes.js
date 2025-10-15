import express from 'express';
import { getMenu, addMenuItem } from '../controllers/menuController.js';
import { verifyToken, verifyRole } from '../middleware/authMiddleware.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

router.get('/', getMenu);

router.post(
  '/',
  verifyToken,
  verifyRole(['admin']),
  [body('name').notEmpty(), body('price').isFloat({ gt: 0 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    addMenuItem(req, res);
  }
);

export default router;
