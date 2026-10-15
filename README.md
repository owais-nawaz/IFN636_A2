# Bug Tracking System

A role-based bug tracking system built for **IFN636 — Software Lifecycle Management** (Assessment 1). Testers report bugs, Developers claim and resolve them, and QA Leads verify or re-open fixes - enforced end-to-end with JWT-authenticated, role-gated APIs.

## Tech Stack

Frontend  | React 19, Vite 8, plain CSS (design tokens)   
Backend   | Node.js, Express 5                          
Database  | MongoDB Atlas (Mongoose ODM)                  
Auth      | JWT (jsonwebtoken) + bcryptjs password hashing

## Features

- **Role-based workspaces**: Tester, Developer, QA Lead
- **BTS-0** — Secure authentication with signed JWTs and bcrypt-hashed passwords
- **BTS-1** — Bug submission form with client + server-side validation
- **BTS-2** — Filterable bug dashboard (status, priority, search)
- **BTS-3** — Developer ticket claiming (Open → In Progress)
- **BTS-4** — Developer resolution workflow with classification + notes
- **BTS-5 / BTS-6** — QA verification: close resolved tickets or re-open with mandatory regression notes

## Backend Setup

```bash
cd backend
npm install
```

Create 'backend/.env':

MONGO_URL=your_mongodb_atlas_connection_string
JWT_SECRET=a_long_random_secret_string
PORT=3000

Run the server:
```bash
npm start
```

## Testing

Tests use Mocha, Chai 4, Sinon and Supertest. Run them with `npm test` from `backend/`. No database or running server is needed. See `backend/test/claim.test.js` for the example pattern.

- Put the requirement ID in each test name, e.g. `FR-4a (409): rejects verify on Open`.
- One test file per feature in `backend/test/` (e.g. `verify.test.js`).
- Stub models with Sinon instead of hitting MongoDB, and call `sinon.restore()` in `afterEach`.
- For HTTP-level tests, import `src/app.js` into Supertest (never `server.js`).

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5001` and proxies `/api/*` requests to the backend on `http://localhost:3000` (configured in `vite.config.js`).

## Demo Accounts

On first run, three demo users are automatically seeded:

| Username       | Password      | Role       |
|----------------|---------------|------------|
| `tester_sarah` | `password123` | Tester     |
| `dev_alex`     | `password123` | Developer  |
| `qa_lead`      | `password123` | QA Lead    |

Use the **Quick Demo Login** buttons on the sign-in screen, or register a new account.

## Security

- Passwords are hashed with **bcrypt** (10 salt rounds) before storage.
- Role authorization is enforced server-side via a `requireRole` middleware that verifies a **signed JWT** — client-supplied headers cannot forge a role.
- Tokens expire after 2 hours.
- Write requests (POST, PATCH, PUT) under `/api` are limited to **60 per minute per client IP**; the 61st returns `429 Too many requests`. Reads are not limited. Counts are kept per server instance, so with two EC2 instances behind the ALB the effective limit is about 120 per minute.

## Author

Syed Owais Nawaz
