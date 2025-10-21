import { db } from '../config/db.js';
import { notifyNewOrder, notifyTableStatus } from '../../index.js';

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

    // Insert new order
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
    }

    // Set table status to "in_progress"
    await connection.query(
      `UPDATE tables 
    SET status = 'in_progress' 
    WHERE id = ? AND status IN ('available', 'occupied')`,
      [table_id]
    );

    await connection.commit();

    // Emit live update via WebSocket
    notifyNewOrder(table_id, {
      id: orderId,
      table_id,
      total_amount,
      items,
      status: 'pending',
    });

    notifyTableStatus(table_id, 'in_progress');

    res.status(201).json({
      message: 'Order created successfully',
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
    const [orders] = await db.query(`
      SELECT 
        o.id,
        o.table_id,
        o.status,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.created_at,
        t.table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      ORDER BY o.created_at DESC
    `);

    if (orders.length === 0) {
      return res.status(200).json([]);
    }

    // Get order items
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

    // Attach items to each order
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
    console.error('Error fetching orders with items:', error);
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
          t.table_number
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        WHERE o.session_id = ?
        ORDER BY o.created_at DESC`,
      [session_id]
    );

    // Fetch and attach items for each order
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
        SET payment_status = 'paid', status = 'paid'
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
