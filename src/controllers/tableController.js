import { db } from '../config/db.js';

// Get all tables with their current status and total unpaid amount
export const getAllTables = async (req, res) => {
  try {
    const [tables] = await db.query(`
      SELECT 
        t.id,
        t.table_number,
        t.status,
        COALESCE(SUM(
          CASE 
            WHEN o.payment_status = 'unpaid' THEN o.total_amount 
            ELSE 0 
          END
        ), 0) AS total_unpaid
      FROM tables t
      LEFT JOIN orders o ON t.id = o.table_id
      GROUP BY t.id
      ORDER BY t.table_number ASC
    `);

    res.status(200).json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a tables status manually (admin/cashier)
export const updateTableStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['available', 'occupied', 'in_progress', 'served'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid table status' });
  }

  try {
    await db.query('UPDATE tables SET status = ? WHERE id = ?', [status, id]);
    res.status(200).json({ message: `Table status updated to ${status}` });
  } catch (error) {
    console.error('Error updating table status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
