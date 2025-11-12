import { db } from '../config/db.js';
import {
  notifyNewOrder,
  notifyTableStatus,
  notifyMenuUpdate,
} from '../../index.js';

// Create a new order
export const createOrder = async (req, res) => {
  const { table_id, session_token, items, payment_method } = req.body;

  if (!table_id || !session_token || !items || items.length === 0) {
    return res.status(400).json({ message: 'Missing order details' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Verify valid session
    const [sessionRows] = await connection.query(
      'SELECT id FROM sessions WHERE token = ? AND is_active = 1 AND expires_at > NOW()',
      [session_token]
    );

    if (sessionRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid or expired session' });
    }

    const session_id = sessionRows[0].id;

    // Compute total amount
    const total_amount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Insert new order — status = 'unserved' by default
    const [orderResult] = await connection.query(
      `INSERT INTO orders (table_id, session_id, status, payment_method, payment_status, total_amount)
        VALUES (?, ?, 'pending', ?, ?, ?)`,
      [
        table_id,
        session_id,
        payment_method,
        payment_method === 'online' ? 'paid' : 'unpaid',
        total_amount,
      ]
    );

    const orderId = orderResult.insertId;

    // Insert order items and update stocks
    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items (order_id, menu_id, quantity, price)
          VALUES (?, ?, ?, ?)`,
        [orderId, item.menu_id, item.quantity, item.price]
      );

      await connection.query(
        `UPDATE menu 
          SET stocks = GREATEST(stocks - ?, 0),
              status = CASE WHEN stocks - ? <= 0 THEN 'out_of_stock' ELSE 'in_stock' END
          WHERE id = ?`,
        [item.quantity, item.quantity, item.menu_id]
      );

      const [updatedMenuItem] = await connection.query(
        'SELECT * FROM menu WHERE id = ?',
        [item.menu_id]
      );

      notifyMenuUpdate({
        type: 'update',
        item: updatedMenuItem[0],
      });
    }

    await connection.commit();

    // Fetch table number
    const [tableRows] = await connection.query(
      'SELECT table_number FROM tables WHERE id = ?',
      [table_id]
    );
    const table_number = tableRows.length
      ? tableRows[0].table_number
      : `T${table_id}`;

    // Notify frontend
    notifyNewOrder(table_id, {
      id: orderId,
      table_id,
      table_number,
      total_amount,
      items,
      status: 'pending',
      confirmed: false,
    });

    res.status(201).json({
      message: 'Order created successfully (awaiting confirmation)',
      orderId,
      table_id,
      total_amount,
      items,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
};

// Get all orders with their items
export const getAllOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || null;
    const sort = req.query.sort === 'asc' ? 'ASC' : 'DESC';

    const limitClause = limit ? `LIMIT ${limit}` : '';

    const [orders] = await db.query(`
      SELECT 
        o.id,
        o.table_id,
        o.status,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.created_at,
        COALESCE(t.table_number, CONCAT('T', o.table_id)) AS table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      ORDER BY o.created_at ${sort}
      ${limitClause}
    `);

    if (orders.length === 0) return res.status(200).json([]);

    const [items] = await db.query(`
      SELECT 
        oi.order_id,
        m.id AS menu_id,
        m.name AS name,
        oi.quantity,
        oi.price
      FROM order_items oi
      JOIN menu m ON oi.menu_id = m.id
    `);

    const formattedOrders = orders.map((order) => ({
      ...order,
      items: items
        .filter((item) => item.order_id === order.id)
        .map((item) => ({
          id: item.menu_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
    }));

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get specific order with items
export const getOrderDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [orderRows] = await db.query(`SELECT * FROM orders WHERE id = ?`, [
      id,
    ]);

    if (orderRows.length === 0)
      return res.status(404).json({ message: 'Order not found' });

    const order = orderRows[0];

    const [items] = await db.query(
      `SELECT 
          oi.menu_id,
          m.name AS menu_name,
          oi.quantity,
          oi.price,
          m.image_url
        FROM order_items oi
        JOIN menu m ON oi.menu_id = m.id
        WHERE oi.order_id = ?`,
      [id]
    );

    res.status(200).json({
      ...order,
      items: items.map((i) => ({
        id: i.menu_id,
        name: i.menu_name,
        quantity: i.quantity,
        price: i.price,
        image_url: i.image_url,
      })),
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all orders for a session
export const getOrdersBySession = async (req, res) => {
  const { token } = req.query;

  if (!token)
    return res.status(400).json({ message: 'Session token is required' });

  try {
    const [session] = await db.query(
      'SELECT id, table_id FROM sessions WHERE token = ? AND is_active = 1 AND expires_at > NOW()',
      [token]
    );

    if (session.length === 0)
      return res.status(404).json({ message: 'Invalid or expired session' });

    const session_id = session[0].id;

    const [orders] = await db.query(
      `SELECT 
      o.id, o.status, o.payment_status, o.payment_method,
      o.total_amount, o.created_at,
      COALESCE(t.table_number, CONCAT('T', o.table_id)) AS table_number
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE o.session_id = ?
        ORDER BY o.created_at DESC`,
      [session_id]
    );

    const [items] = await db.query(`
      SELECT 
        oi.order_id, m.name AS name, oi.quantity, oi.price
      FROM order_items oi
      JOIN menu m ON oi.menu_id = m.id
    `);

    const result = orders.map((o) => ({
      ...o,
      items: items
        .filter((i) => i.order_id === o.id)
        .map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching orders by session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark order as paid
export const markOrderAsPaid = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `UPDATE orders 
        SET payment_status = 'paid'
        WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Order not found' });

    res.status(200).json({ message: 'Order marked as paid' });
  } catch (error) {
    console.error('Error marking order as paid:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Confirm an order
export const confirmOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const [orders] = await db.query(
      'SELECT table_id FROM orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (orders.length === 0)
      return res.status(404).json({ message: 'Order not found' });

    const tableId = orders[0].table_id;

    await db.query(
      `UPDATE orders SET status = 'unserved' WHERE id = ? AND status = 'pending'`,
      [id]
    );

    await db.query(
      `UPDATE tables 
    SET status = 'in_progress'
    WHERE id = ?`,
      [tableId]
    );

    notifyTableStatus(tableId, 'in_progress');
    notifyNewOrder(tableId, { tableId, orderId: id, confirmed: true });

    res.status(200).json({
      message: `Order #${id} confirmed successfully.`,
      table_id: tableId,
      order_id: id,
    });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark order as served (kitchen action)
export const markOrderAsServed = async (req, res) => {
  const { id } = req.params;

  try {
    const [orders] = await db.query(
      'SELECT table_id FROM orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (orders.length === 0)
      return res.status(404).json({ message: 'Order not found' });

    const tableId = orders[0].table_id;

    // Mark all unserved orders for the same table as served
    await db.query(
      `UPDATE orders 
        SET status = 'served'
        WHERE table_id = ? AND status = 'unserved'`,
      [tableId]
    );

    // If none left unserved, mark table as served
    const [remaining] = await db.query(
      `SELECT COUNT(*) AS unserved_count 
        FROM orders WHERE table_id = ? AND status = 'unserved'`,
      [tableId]
    );

    if (remaining[0].unserved_count === 0) {
      console.log(`All orders served for Table #${tableId}`);
      await db.query(`UPDATE tables SET status = 'served' WHERE id = ?`, [
        tableId,
      ]);
      notifyTableStatus(tableId, 'served');
    }

    res.status(200).json({
      message: `Orders for Table #${tableId} marked as served.`,
      table_id: tableId,
    });
  } catch (error) {
    console.error('Error marking order as served:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get sales graph data
export const getSalesGraph = async (req, res) => {
  try {
    const { interval = 'hourly' } = req.query;
    let query = '';

    if (interval === 'hourly') {
      query = `
    SELECT DATE_FORMAT(MIN(created_at), '%H:00') AS time, 
            SUM(total_amount) AS value
    FROM orders
    WHERE created_at >= NOW() - INTERVAL 1 DAY
      AND status IN ('served', 'completed')
    GROUP BY HOUR(created_at)
    ORDER BY HOUR(created_at);
  `;
    } else if (interval === 'weekly') {
      query = `
    SELECT DATE_FORMAT(MIN(created_at), '%a') AS time, 
            SUM(total_amount) AS value
    FROM orders
    WHERE created_at >= NOW() - INTERVAL 7 DAY
      AND status IN ('served', 'completed')
    GROUP BY DAYOFWEEK(created_at)
    ORDER BY DAYOFWEEK(created_at);
  `;
    } else if (interval === 'monthly') {
      query = `
    SELECT DATE_FORMAT(MIN(created_at), '%b %Y') AS time,
            SUM(total_amount) AS value
    FROM orders
    WHERE created_at >= NOW() - INTERVAL 6 MONTH
      AND status IN ('served', 'completed')
    GROUP BY YEAR(created_at), MONTH(created_at)
    ORDER BY YEAR(created_at), MONTH(created_at);
  `;
    }

    const [rows] = await db.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching sales graph:', err);
    res.status(500).json({ message: 'Failed to fetch sales graph data' });
  }
};

// Get today's total revenue
export const getRevenueByRange = async (req, res) => {
  const { start, end } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT DATE(created_at) AS date, SUM(total_amount) AS total
        FROM orders
        WHERE created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC`,
      [start, end]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching range revenue:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
