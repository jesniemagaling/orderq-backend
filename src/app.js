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

// Security Middlewares
app.use(cors({ origin: '*' })); // frontend domain
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('OrderQ backend is running securely!');
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/tables', tableRoutes);

export default app;
