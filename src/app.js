import express from 'express';
import cors from 'cors';
import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import tableRoutes from './routes/tableRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('OrderQ backend is running!');
});

// API routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/tables', tableRoutes);

export default app;
