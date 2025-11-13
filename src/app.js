import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import tableRoutes from './routes/tableRoutes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

// Important when running behind Docker / reverse proxy
app.set('trust proxy', 1);

// Security middlewares
app.use(
  cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(helmet());
app.use(express.json());

// rate limiter only in production
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS
      ? Number(process.env.RATE_LIMIT_WINDOW_MS)
      : 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 300, // allow more requests in production
    standardHeaders: true, // return rate limit info in headers
    legacyHeaders: false,
    message: {
      status: 429,
      error: 'Too many requests, please try again later.',
    },
  });
  app.use(limiter);
}

app.get('/', (req, res) => {
  res.send('OrderQ backend is running securely!');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/tables', tableRoutes);

export default app;
