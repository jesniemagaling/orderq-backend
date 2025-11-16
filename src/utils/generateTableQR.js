import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { db } from '../config/db.js';

export const generateAllTableQR = async () => {
  try {
    const [tables] = await db.query('SELECT id, table_number FROM tables');

    for (const table of tables) {
      const qrData = `${process.env.BACKEND_URL.replace(
        /\/$/,
        ''
      )}/api/sessions/scan/${table.table_number}`;

      const outputDir = path.resolve('public/qrcodes');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = `${outputDir}/table-${table.table_number}.png`;

      await QRCode.toFile(filePath, qrData, {
        width: 300,
        errorCorrectionLevel: 'H',
      });

      const qrDbPath = `/qrcodes/table-${table.table_number}.png`;

      await db.query('UPDATE tables SET qr_code = ? WHERE id = ?', [
        qrDbPath,
        table.id,
      ]);

      console.log(`Generated QR for Table ${table.table_number}`);
    }

    console.log('All QR codes generated successfully.');
  } catch (err) {
    console.error('QR Generation Error:', err);
  }
};
