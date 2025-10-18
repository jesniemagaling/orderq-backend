import express from 'express';
import { login } from '../controllers/authController.js';
import { body } from 'express-validator';

const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 4 }).withMessage('Password is required'),
  ],
  login
);

export default router;
