import { db } from '../config/db.js';
import { notifyMenuUpdate } from '../../index.js';

// Fetch all menu items
export const getMenu = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu ORDER BY id DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch single menu item by ID
export const getMenuById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM menu WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMenuCategories = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DISTINCT category 
      FROM menu 
      WHERE category IS NOT NULL AND category != ''
    `);

    const categories = [
      { id: 'all', name: 'All', icon: 'images/all.png' },
      ...rows.map((row) => ({
        id: row.category.toLowerCase().replace(/\s+/g, '-'),
        name: row.category,
        icon: `images/${row.category.toLowerCase()}.png`,
      })),
    ];

    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add new menu item
export const addMenuItem = async (req, res) => {
  try {
    let { name, description, price, category, stocks, status, image_url } =
      req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    price = Number(price);
    stocks = Number(stocks);

    if (isNaN(price) || isNaN(stocks)) {
      return res
        .status(400)
        .json({ message: 'Price and stocks must be numeric' });
    }

    await db.query(
      `INSERT INTO menu (name, description, price, category, stocks, status, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        description || '',
        price,
        category || 'Uncategorized',
        stocks,
        status,
        image_url || null,
      ]
    );

    res.status(201).json({ message: 'Menu item added successfully!' });

    notifyMenuUpdate({
      type: 'add',
      item: { name, description, price, category, stocks, status, image_url },
    });
  } catch (error) {
    console.error('Error adding menu item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update existing menu item
export const updateMenuItem = async (req, res) => {
  const { id } = req.params;
  let { name, description, price, category, stocks, status, image_url } =
    req.body;

  try {
    // Validation
    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    price = Number(price);
    stocks = Number(stocks);

    if (isNaN(price) || isNaN(stocks)) {
      return res
        .status(400)
        .json({ message: 'Price and stocks must be numeric' });
    }

    // Check if item exists
    const [existing] = await db.query('SELECT * FROM menu WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    await db.query(
      `UPDATE menu
        SET name = ?, description = ?, price = ?, category = ?, stocks = ?, status = ?, image_url = ?
        WHERE id = ?`,
      [
        name.trim(),
        description || '',
        price,
        category || 'Uncategorized',
        stocks,
        status,
        image_url || null,
        id,
      ]
    );

    res.status(200).json({ message: 'Menu item updated successfully!' });

    notifyMenuUpdate({
      type: 'update',
      item: {
        id,
        name,
        description,
        price,
        category,
        stocks,
        status,
        image_url,
      },
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete menu item (optional, for admin UI)
export const deleteMenuItem = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM menu WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.status(200).json({ message: 'Menu item deleted successfully!' });
    notifyMenuUpdate({
      type: 'delete',
      item: { id },
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get top-selling menu items (by total quantity sold)
export const getTopSellingItems = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        m.id,
        m.name,
        IFNULL(SUM(oi.quantity), 0) AS total_sold
      FROM order_items oi
      JOIN menu m ON oi.menu_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status IN ('served', 'completed')  -- count only completed orders
      GROUP BY m.id
      ORDER BY total_sold DESC
      LIMIT 5
    `);

    const formatted = rows.map((r) => ({
      name: r.name,
      sold: Number(r.total_sold || 0),
      delta: Number((Math.random() * 2 - 1).toFixed(2)),
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching top-selling items:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
