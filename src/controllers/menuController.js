import { db } from '../config/db.js';

// Fetch all menu items
export const getMenu = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM menu');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add new menu item
export const addMenuItem = async (req, res) => {
  try {
    const { name, description, price, category, stocks, status, image_url } =
      req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    await db.query(
      'INSERT INTO menu (name, description, price, category, stocks, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, price, category, stocks, status, image_url]
    );

    res.status(201).json({ message: 'Menu item added successfully!' });
  } catch (error) {
    console.error('Error adding menu item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
