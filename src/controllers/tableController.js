import { db } from '../config/db.js';
import { notifyTableStatus, notifyNewOrder } from '../../index.js';

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

// Update a table's status manually (admin or cashier)
export const updateTableStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['available', 'occupied', 'in_progress', 'served'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid table status' });
  }

  try {
    const [result] = await db.query(
      'UPDATE tables SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }

    // Emit WebSocket notification for table update
    notifyTableStatus(id, status);

    res.status(200).json({ message: `Table status updated to ${status}` });
  } catch (error) {
    console.error('Error updating table status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get table details including current session, orders, and items
export const getTableDetails = async (req, res) => {
  const { table_id } = req.params;

  try {
    // Find table
    const [tableRows] = await db.query(
      'SELECT id, table_number, status FROM tables WHERE id = ?',
      [table_id]
    );

    if (tableRows.length === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }

    const table = tableRows[0];

    // Get the most recent active session for this table
    const [sessionRows] = await db.query(
      `SELECT id, token 
        FROM sessions 
        WHERE table_id = ? AND is_active = 1 
        ORDER BY created_at DESC 
        LIMIT 1`,
      [table_id]
    );

    if (sessionRows.length === 0) {
      return res.status(200).json({
        table,
        session: null,
        orders: [],
        has_additional_order: false,
      });
    }

    const session = sessionRows[0];

    // Get all orders under this session
    const [orders] = await db.query(
      `SELECT 
          o.id,
          o.total_amount,
          o.status,
          o.payment_status,
          o.payment_method,
          o.created_at
        FROM orders o
        WHERE o.session_id = ?
        ORDER BY o.created_at ASC`,
      [session.id]
    );

    if (orders.length === 0) {
      return res.status(200).json({
        table,
        session,
        orders: [],
        has_additional_order: false,
      });
    }

    // Get all order items
    const orderIds = orders.map((o) => o.id);
    let items = [];

    if (orderIds.length > 0) {
      [items] = await db.query(
        `SELECT 
            oi.order_id,
            m.id AS menu_id,
            m.name AS menu_name,
            oi.quantity,
            oi.price
          FROM order_items oi
          JOIN menu m ON oi.menu_id = m.id
          WHERE oi.order_id IN (?)`,
        [orderIds]
      );
    }

    // Attach items to their respective orders
    const firstOrderTime = new Date(orders[0].created_at);

    const formattedOrders = orders.map((order) => {
      const orderTime = new Date(order.created_at);
      const diffMinutes = (orderTime - firstOrderTime) / (1000 * 60);

      return {
        ...order,
        is_additional: diffMinutes >= 1, // mark as additional if 5+ mins apart
        items: items
          .filter((i) => i.order_id === order.id)
          .map((i) => ({
            id: i.menu_id,
            name: i.menu_name,
            quantity: i.quantity,
            price: i.price,
          })),
      };
    });

    // Detect if multiple unpaid orders exist (used for red badge indicator)
    const unpaidOrders = formattedOrders.filter(
      (o) => o.payment_status === 'unpaid'
    );
    const has_additional_order = unpaidOrders.length > 1;

    // emit live update if table has new unpaid orders
    if (has_additional_order) {
      notifyNewOrder(table.id, { has_additional_order: true });
    }

    res.status(200).json({
      table,
      session,
      orders: formattedOrders,
      has_additional_order,
    });
  } catch (error) {
    console.error('Error fetching table details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
