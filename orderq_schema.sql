-- ORDERQ DATABASE INITIAL SETUP

-- Create and select database
CREATE DATABASE IF NOT EXISTS orderq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE orderq_db;

-- MENU TABLE
CREATE TABLE IF NOT EXISTS menu (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(50),
  stocks INT DEFAULT 0,
  status ENUM('in_stock','out_of_stock') DEFAULT 'in_stock',
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO menu (name, description, price, category, stocks, status, image_url) VALUES
('Americano', 'A bold and smooth espresso diluted with hot water, giving a rich coffee flavor with a lighter body.', 150.00, 'Iced', 20, 'in_stock', 'https://via.placeholder.com/150'),
('Blueberry', 'A refreshing blueberry-flavored drink that blends sweetness and tang for a delightful fruity taste.', 120.00, 'Fruity', 40, 'in_stock', 'https://via.placeholder.com/150'),
('Caramel Macchiato', 'Espresso combined with milk, vanilla flavor, and caramel drizzle for a sweet, smooth coffee treat.', 180.00, 'Coffee', 15, 'in_stock', 'https://via.placeholder.com/150');

-- TABLES TABLE (RESTAURANT TABLES)
CREATE TABLE IF NOT EXISTS tables (
  id INT NOT NULL AUTO_INCREMENT,
  table_number VARCHAR(10) NOT NULL UNIQUE,
  status ENUM('available','occupied','in_progress','served') DEFAULT 'available',
  qr_code VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tables (table_number, status) VALUES
('1', 'available'),
('2', 'available'),
('3', 'available'),
('4', 'available'),
('5', 'available'),
('6', 'available'),
('7', 'available'),
('8', 'available'),
('9', 'available'),
('10', 'available');

-- SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
  id INT NOT NULL AUTO_INCREMENT,
  table_id INT NOT NULL,
  token VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 2 HOUR),
  is_active BOOLEAN DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id INT NOT NULL AUTO_INCREMENT,
  session_id INT NOT NULL,
  table_id INT NOT NULL,
  status ENUM('pending', 'unserved', 'served', 'cancelled') DEFAULT 'pending',
  payment_method ENUM('cash', 'online') DEFAULT 'cash',
  payment_status ENUM('unpaid', 'paid') DEFAULT 'unpaid',
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  menu_id INT NOT NULL,
  quantity INT DEFAULT 1,
  price DECIMAL(10,2),
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * price) STORED,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menu(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','cashier','kitchen') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@orderq.com', 'admin123', 'admin'),
('cashier1', 'cashier@orderq.com', 'cashier123', 'cashier'),
('kitchen1', 'kitchen@orderq.com', 'kitchen123', 'kitchen');
