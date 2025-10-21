import { db } from '../config/db.js';
import crypto from 'crypto';

// Create or reuse active session when QR is scanned
export const createSession = async (req, res) => {
  const { table_number } = req.body;

  if (!table_number) {
    return res.status(400).json({ message: 'table_number is required' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Find the table
    const [tables] = await connection.query(
      'SELECT * FROM tables WHERE table_number = ?',
      [table_number]
    );

    if (tables.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Table not found' });
    }

    const table = tables[0];

    // Check for active session (reuse if exists)
    const [activeSession] = await connection.query(
      `SELECT * FROM sessions 
        WHERE table_id = ? 
        AND is_active = 1 
        AND expires_at > NOW() 
        LIMIT 1`,
      [table.id]
    );

    if (activeSession.length > 0) {
      // Reuse same session token
      await connection.commit();
      return res.status(200).json({
        message: 'Session already active',
        table_id: table.id,
        table_number: table.table_number,
        token: activeSession[0].token,
        expires_at: activeSession[0].expires_at,
      });
    }

    // No active session → create new one
    const token = crypto.randomBytes(24).toString('hex');

    await connection.query(
      `INSERT INTO sessions (table_id, token, created_at, expires_at, is_active)
        VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR), 1)`,
      [table.id, token]
    );

    // Update table status to occupied
    if (table.status === 'available') {
      await connection.query('UPDATE tables SET status = ? WHERE id = ?', [
        'occupied',
        table.id,
      ]);

      // Emit WebSocket update
      notifyTableStatus(table.id, 'occupied');
    }

    await connection.commit();

    res.status(201).json({
      message: 'New session created',
      table_id: table.id,
      table_number: table.table_number,
      token,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
};

// Verify session token (used before placing orders)
export const verifySession = async (req, res) => {
  const { token } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT s.*, t.table_number, t.status
        FROM sessions s
        JOIN tables t ON s.table_id = t.id
        WHERE s.token = ? AND s.is_active = 1 AND s.expires_at > NOW()
        LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Invalid or expired session' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
