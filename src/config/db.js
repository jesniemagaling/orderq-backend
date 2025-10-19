// src/config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

let db;

async function createPool() {
  try {
    db = mysql.createPool({
      host: process.env.DB_HOST || 'mysql',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    const connection = await db.getConnection();
    console.log(`Connected to MySQL database (${process.env.DB_NAME})`);
    connection.release();

    // Handle connection-level errors gracefully
    db.on('error', (err) => {
      console.error('MySQL connection error:', err.message);
      if (
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'ECONNREFUSED'
      ) {
        console.log('Attempting to reconnect to MySQL...');
        setTimeout(createPool, 2000);
      }
    });

    return db;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.log('Retrying in 3 seconds...');
    setTimeout(createPool, 3000);
  }
}

await createPool();

export { db };
