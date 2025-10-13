// src/cron/sessionCleanup.js
import cron from 'node-cron';
import { db } from '../config/db.js';

/**
 * This job runs every 5 minutes.
 * It automatically:
 *  1. Marks expired sessions (older than expires_at) as inactive.
 *  2. Frees up tables that no longer have an active session.
 */
export function startSessionCleanup() {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      console.log('[SessionCleanup] Running cleanup job...');

      try {
        // Mark expired sessions as inactive
        await db.query(`
        UPDATE sessions
        SET is_active = 0
        WHERE expires_at < NOW() AND is_active = 1
      `);

        // Set tables to available if they have no active sessions
        await db.query(`
        UPDATE tables t
        SET t.status = 'available'
        WHERE NOT EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.table_id = t.id AND s.is_active = 1 AND s.expires_at > NOW()
        )
      `);

        console.log(
          '[SessionCleanup] Completed successfully at',
          new Date().toISOString()
        );
      } catch (error) {
        console.error('[SessionCleanup] Error:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Manila', // you can change this if your server is in a different timezone
    }
  );
}
