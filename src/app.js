import express from 'express';
import cors from 'cors';
import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('OrderQ backend is running!');
});

// API routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);

export default app;
