import { db } from '../config/db.js';

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

    // Insert order
    const [orderResult] = await connection.query(
      `INSERT INTO orders (table_id, session_id, status, serve_status, payment_method, payment_status, total_amount)
        VALUES (?, ?, 'pending', 'unserved', ?, ?, ?)`,
      [
        table_id,
        session_id,
        payment_method,
        payment_method === 'online' ? 'paid' : 'unpaid',
        total_amount,
      ]
    );

    const orderId = orderResult.insertId;

    // Insert items and update stock
    for (const item of items) {
      // Insert order item
      await connection.query(
        `INSERT INTO order_items (order_id, menu_id, quantity, price)
          VALUES (?, ?, ?, ?)`,
        [orderId, item.menu_id, item.quantity, item.price]
      );

      // Deduct from menu stocks
      await connection.query(
        `UPDATE menu 
          SET stocks = GREATEST(stocks - ?, 0),
              status = CASE WHEN stocks - ? <= 0 THEN 'out_of_stock' ELSE 'in_stock' END
          WHERE id = ?`,
        [item.quantity, item.quantity, item.menu_id]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Order created successfully', orderId });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
};

// Get all orders
export const getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT 
        o.id,
        o.table_id,
        o.session_token,
        o.status,
        o.serve_status,
        o.payment_method,
        o.payment_status,
        o.total_amount,
        o.created_at,
        s.token AS session_token
      FROM orders o
      LEFT JOIN sessions s ON o.session_id = s.id
      ORDER BY o.created_at DESC
    `);

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get specific order with its items
export const getOrderDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [order] = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (order.length === 0)
      return res.status(404).json({ message: 'Order not found' });

    const [items] = await db.query(
      `SELECT 
        oi.id,
        oi.menu_id,
        oi.quantity,
        oi.subtotal,
        m.name AS menu_name,
        m.price,
        m.image_url
      FROM order_items oi
      JOIN menu m ON oi.menu_id = m.id
      WHERE oi.order_id = ?`,
      [id]
    );

    res.status(200).json({ order: order[0], items });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all orders for a session (shared across devices)
export const getOrdersBySession = async (req, res) => {
  const { token } = req.query;

  if (!token)
    return res.status(400).json({ message: 'Session token is required' });

  try {
    // Validate session
    const [session] = await db.query(
      'SELECT id, table_id FROM sessions WHERE token = ? AND is_active = 1 AND expires_at > NOW()',
      [token]
    );

    if (session.length === 0)
      return res.status(404).json({ message: 'Invalid or expired session' });

    const session_id = session[0].id;

    // Fetch orders linked to this session
    const [orders] = await db.query(
      `SELECT 
          o.id, o.status, o.payment_status, o.payment_method,
          o.total_amount, o.created_at,
          t.table_number
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        WHERE o.session_id = ?
        ORDER BY o.created_at DESC`,
      [session_id]
    );

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders by session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
