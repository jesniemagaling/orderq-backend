import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderDetails,
} from '../controllers/orderController.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/', getAllOrders);
router.get('/:id', getOrderDetails);

export default router;
