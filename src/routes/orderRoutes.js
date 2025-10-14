import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderDetails,
  getOrdersBySession,
  markOrderAsPaid,
} from '../controllers/orderController.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/', getAllOrders);
router.get('/by-session', getOrdersBySession);
router.get('/:id', getOrderDetails);
router.put('/:id/pay', markOrderAsPaid);

export default router;
