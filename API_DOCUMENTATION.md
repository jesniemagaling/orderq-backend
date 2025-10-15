# OrderQ Backend API Documentation

## Overview

This backend provides RESTful APIs for the OrderQ restaurant ordering system.  
It handles tables, sessions (QR codes), menu items, and orders.  
The backend runs in Docker and connects to a MySQL database.

---

## Setup Instructions

### Requirements

- Docker & Docker Compose installed
- Node.js 18+ (optional, for local development)

### Start the backend

```bash
docker compose up -d
```

Then visit:

- **API Base URL:** http://localhost:5000
- **phpMyAdmin:** http://localhost:8080  
  (User: `root`, Password: `root`)

### Stop the backend

```bash
docker compose down
```

---

## Environment Variables (.env)

```env
PORT=5000

MYSQL_ROOT_PASSWORD=root
MYSQL_DATABASE=orderq_db
MYSQL_USER=orderq_user
MYSQL_PASSWORD=orderq_pass

DB_HOST=mysql
DB_PORT=3306
DB_USER=orderq_user
DB_PASSWORD=orderq_pass
DB_NAME=orderq_db
```

---

## API Endpoints

### - Menu

**GET** `/api/menu` — Fetch all menu items  
**Response:**

```json
[
  {
    "id": 1,
    "name": "Americano",
    "price": 150.0,
    "category": "Iced",
    "stocks": 20
  }
]
```

---

### - Tables

**GET** `/api/tables` — Fetch all restaurant tables  
**Response:**

```json
[
  {
    "id": 1,
    "table_number": "1",
    "status": "available",
    "total_unpaid": "0.00"
  }
]
```

---

### - Sessions

Used when a customer scans a table QR code.

**POST** `/api/sessions`  
**Body:**

```json
{
  "table_number": "1"
}
```

**Response:**

```json
{
  "message": "New session created",
  "token": "abc123xyz...",
  "expires_at": "2025-10-15T08:00:00Z"
}
```

**GET** `/api/sessions/:token` — Verify session validity

---

### - Orders

**POST** `/api/orders` — Create an order

```json
{
  "table_id": 1,
  "session_token": "abc123xyz...",
  "items": [{ "menu_id": 1, "quantity": 2, "price": 150.0 }],
  "payment_method": "cash"
}
```

**GET** `/api/orders` — List all orders (Admin/Cashier use)  
**GET** `/api/orders/by-session?token={session_token}` — Fetch orders per session  
**PUT** `/api/orders/:id/pay` — Mark an order as paid

---

## For Frontend Developers

### Base URL:

```
http://localhost:5000/api
```

### Example Fetch (React / Axios):

```js
import axios from 'axios';

const getTables = async () => {
  const res = await axios.get('http://localhost:5000/api/tables');
  console.log(res.data);
};
```

---

## Optional Tools

- **Postman** for API testing
- **phpMyAdmin** for database viewing
- **Docker Desktop** to view running containers

---

## Notes

- Sessions expire automatically after 2 hours.
- Expired sessions will free up tables via the cron job.
- Menu stock reduces automatically when orders are placed.
