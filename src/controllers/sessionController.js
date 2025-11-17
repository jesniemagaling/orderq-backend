import { db } from '../config/db.js';
import crypto from 'crypto';
import { notifyTableStatus, notifySessionUpdate } from '../../index.js';

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
      await connection.commit();

      // Notify realtime update even for reused session
      notifySessionUpdate({
        table_id: table.id,
        table_number: table.table_number,
        status: 'active',
        reused: true,
      });

      return res.status(200).json({
        message: 'Session already active',
        table_id: table.id,
        table_number: table.table_number,
        token: activeSession[0].token,
        expires_at: activeSession[0].expires_at,
      });
    }

    // No active session -> create new one
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

      // Emit WebSocket update to all dashboards
      notifyTableStatus(table.id, 'occupied');
    }

    await connection.commit();

    // Notify realtime update for dashboards / admins
    notifySessionUpdate({
      table_id: table.id,
      table_number: table.table_number,
      token,
      status: 'created',
    });

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

// End an active session
export const endSession = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ message: 'Session token is required' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get session and table info
    const [sessions] = await connection.query(
      `SELECT s.id, s.table_id, t.status 
        FROM sessions s
        JOIN tables t ON s.table_id = t.id
        WHERE s.token = ? AND s.is_active = 1
        LIMIT 1`,
      [token]
    );

    if (sessions.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Active session not found' });
    }

    const session = sessions[0];

    // Deactivate the session
    await connection.query(
      `UPDATE sessions 
        SET is_active = 0, expires_at = NOW()
        WHERE id = ?`,
      [session.id]
    );

    // Set table to available again
    await connection.query(
      `UPDATE tables 
        SET status = 'available'
        WHERE id = ?`,
      [session.table_id]
    );

    // Notify via WebSocket
    notifyTableStatus(session.table_id, 'available');

    await connection.commit();

    res.status(200).json({
      message: `Session for Table #${session.table_id} has been ended.`,
      table_id: session.table_id,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error ending session:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
};

// QR SCANNING
export const scanSessionFromQR = async (req, res) => {
  const { table_number } = req.params;

  try {
    const FE = process.env.FRONTEND_URL.replace(/\/$/, '');

    // Redirect to frontend where frontend will call /createSession
    return res.redirect(`${FE}/order?table=${table_number}`);
  } catch (err) {
    console.error('QR Scan Error:', err);
    return res.status(500).send('Server error');
  }
};
