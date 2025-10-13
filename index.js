import app from './src/app.js';
import dotenv from 'dotenv';
import { startSessionCleanup } from './src/cron/sessionCleanup.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

startSessionCleanup();
