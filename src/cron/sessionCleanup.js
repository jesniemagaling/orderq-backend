// src/cron/sessionCleanup.js
import cron from 'node-cron';
import { db } from '../config/db.js';
import { notifyTableStatus } from '../../index.js';

export function startSessionCleanup() {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      console.log('[SessionCleanup] Running cleanup job...');

      try {
        // Mark expired sessions as inactive
        const [expired] = await db.query(`
          SELECT table_id FROM sessions
          WHERE expires_at < NOW() AND is_active = 1
        `);

        await db.query(`
          UPDATE sessions
          SET is_active = 0
          WHERE expires_at < NOW() AND is_active = 1
        `);

        // Free up tables that no longer have active sessions
        const [freedTables] = await db.query(`
          SELECT t.id
          FROM tables t
          WHERE NOT EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.table_id = t.id AND s.is_active = 1 AND s.expires_at > NOW()
          )
          AND t.status != 'available'
        `);

        await db.query(`
          UPDATE tables t
          SET t.status = 'available'
          WHERE NOT EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.table_id = t.id AND s.is_active = 1 AND s.expires_at > NOW()
          )
        `);

        // Notify frontend for freed tables
        for (const table of freedTables) {
          notifyTableStatus(table.id, 'available');
        }

        console.log(
          `[SessionCleanup] Completed successfully at ${new Date().toISOString()}`
        );
      } catch (error) {
        console.error('[SessionCleanup] Error:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Manila',
    }
  );
}
