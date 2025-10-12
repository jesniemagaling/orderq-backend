import { db } from '../config/db.js';

// Create a new order
export const createOrder = async (req, res) => {
  const { table_id, session_token, items, payment_method } = req.body;

  // Validate input
  if (!table_id || !session_token || !items || items.length === 0) {
    return res.status(400).json({ message: 'Missing order details' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Check if session exists
    const [session] = await connection.query(
      `SELECT id FROM sessions WHERE token = ? AND is_active = 1`,
      [session_token]
    );

    if (session.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid or expired session' });
    }

    // define session_id properly here
    const session_id = session[0].id;

    // Compute total amount
    const total_amount = items.reduce((sum, item) => sum + item.subtotal, 0);

    // Insert into orders
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
      (table_id, session_id, session_token, status, serve_status, payment_method, payment_status, total_amount) 
      VALUES (?, ?, ?, 'pending', 'unserved', ?, ?, ?)`,
      [
        table_id,
        session_id,
        session_token,
        payment_method,
        payment_method === 'online' ? 'paid' : 'unpaid',
        total_amount,
      ]
    );

    const orderId = orderResult.insertId;

    // Insert items
    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items (order_id, menu_id, quantity, subtotal)
        VALUES (?, ?, ?, ?)`,
        [orderId, item.menu_id, item.quantity, item.subtotal]
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
