import express from 'express';
import { getMenu, addMenuItem } from '../controllers/menuController.js';

const router = express.Router();

router.get('/', getMenu);
router.post('/', addMenuItem);

export default router;
