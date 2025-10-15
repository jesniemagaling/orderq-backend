import express from 'express';
import { loginUser } from '../controllers/authController.js';
import { body } from 'express-validator';

const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 4 }).withMessage('Password is required'),
  ],
  loginUser
);

export default router;
