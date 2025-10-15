# OrderQ Backend API

**A QR Code-Based Ordering System for Dine-In Restaurants**

---

## Overview

This backend powers **OrderQ**, a web-based restaurant qr code ordering system that allows dine-in customers to scan a table QR code, order food, and track order status — all without creating an account.

---

## Tech Stack

- **Node.js + Express.js** – Handles API routing, business logic, and server-side functionality.
- **MySQL 8** – Stores all persistent data including menu items, orders, sessions, and user roles.
- **Docker & Docker Compose** – Simplifies setup by running MySQL, phpMyAdmin, and the backend in isolated containers.
- **phpMyAdmin** – A web-based management panel for viewing and editing database tables.

---

## Setup Instructions

### Clone the repository

```bash
git clone https://github.com/jesniemagaling/orderq-backend.git
cd orderq-backend
```

---

For detailed API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
