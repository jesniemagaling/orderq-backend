import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderDetails,
  getOrdersBySession,
  markOrderAsPaid,
  confirmOrder,
  markOrderAsServed,
  getSalesGraph,
} from '../controllers/orderController.js';

const router = express.Router();

router.post('/', createOrder);
router.post('/:id/confirm', confirmOrder);
router.get('/', getAllOrders);
router.get('/sales-graph', getSalesGraph);
router.get('/by-session', getOrdersBySession);
router.get('/:id', getOrderDetails);
router.put('/:id/pay', markOrderAsPaid);
router.put('/:id/serve', markOrderAsServed);

export default router;
