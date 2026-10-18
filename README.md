# Bug Tracking System

A role-based bug tracking system for **IFN636 Software Life Cycle Management**. Testers report bugs, Developers claim and resolve them, and QA Leads verify or re-open fixes. The APIs are role-gated and authenticated with JWTs.

Assessment 1 (v1.0.0) delivered the core workflow. **Assessment 2** adds an audit trail, notifications, analytics and export, a workflow state machine with SLA escalation, rate limiting, automated tests, CI/CD and a two-instance deployment behind an AWS Application Load Balancer.

## Links

| | |
|---|---|
| Jira (project BTS2) | https://connect-team-b13nh2zd.atlassian.net/jira/software/projects/BTS2 |
| GitHub | https://github.com/owais-nawaz/IFN636_A2 |
| Postman | Team workspace collection *Bug Tracking System A2*; exported collections are in `backend/postman/` |
| Deployment | Two EC2 instances (NodeA, NodeB) behind an AWS ALB. Instance addresses are in the report, not in this public repo. |

## Team

| Member | Requirements | Design pattern | Other |
|---|---|---|---|
| Saroj Shrestha | FR-1 Audit trail, NFR-1 Audit integrity | Decorator (`AuditedBugService`) | CD pipeline, EC2 deployment |
| Syed Owais Nawaz | FR-2 Notifications, NFR-2 Rate limiting | Observer (`BugEventSubject` and notifiers) | Test harness, functional testing |
| Avinandan Powdyel | FR-3 Analytics and report export, NFR-3 Export throughput and formula neutralisation | Strategy (`ExportContext` with CSV and JSON exporters) | Requirements, traceability, Postman workspace |
| Alvin Sachie Paulson | FR-4a Workflow state machine, FR-4b SLA escalation, NFR-4 High availability | State (`bugStates`) | ALB and load testing |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, plain CSS (design tokens) |
| Backend | Node.js 20, Express 5 |
| Database | MongoDB Atlas (Mongoose 9) |
| Auth | JWT (jsonwebtoken) and bcryptjs password hashing |
| Testing | Mocha, Chai 4, Sinon, Supertest; Postman and Newman for API tests |
| CI/CD | GitHub Actions; pm2 on AWS EC2 |
| Hosting | Two EC2 instances behind an AWS Application Load Balancer |

## Requirements

### Assessment 2 (new)

| ID | Requirement | Jira |
|---|---|---|
| FR-1 | Every status change (claim, resolve, close, re-open) is recorded with who, what, old and new value and when. `GET /api/bugs/:id/history` returns a bug's history, oldest first. | BTS2-6 |
| NFR-1 | Audit entries cannot be modified after they are written, and history queries use the `{ bugId, timestamp }` index. | BTS2-7 |
| FR-2 | Users are notified of changes to bugs they are involved in: the reporter on claim; the reporter and all QA Leads on resolve; the assigned developer on re-open. Notifications appear in the navbar bell and can be marked read. A console email notifier receives the same events. | BTS2-8 |
| NFR-2 | Write requests (POST, PATCH, PUT) under `/api` are limited to 60 per minute per client IP; the 61st returns `429`. | BTS2-9 |
| FR-3 | QA Leads can see summary metrics and export all bugs as CSV or JSON. | BTS2-10 |
| NFR-3 | Exports complete quickly for the full bug list, and CSV cells that start with `=`, `+`, `-` or `@` are neutralised so spreadsheets don't run them as formulas. | BTS2-11 |
| FR-4a | Only valid status transitions are allowed (Open → In Progress → Resolved → Closed or Re-opened); an invalid one returns `409`. | BTS2-12 |
| FR-4b | Active bugs past their SLA window (Critical 4 h, High 12 h, Medium 24 h, Low 72 h) are escalated one priority level, once. Runs every 15 minutes, or on demand with `POST /api/sla/run`. | BTS2-13 |
| NFR-4 | The app runs on two EC2 instances behind an ALB. `GET /api/health` reports which instance answered (`X-Served-By` header). | BTS2-14 |

### Assessment 1

- **BTS-0**: Secure authentication with signed JWTs and bcrypt-hashed passwords
- **BTS-1**: Bug submission form with client and server-side validation
- **BTS-2**: Filterable bug dashboard (status, priority, search)
- **BTS-3**: Developer ticket claiming (Open → In Progress)
- **BTS-4**: Developer resolution workflow with classification and notes
- **BTS-5 / BTS-6**: QA verification: close resolved tickets or re-open them with mandatory regression notes

## Design Patterns

| Pattern | Where | Requirement |
|---|---|---|
| Observer | `backend/src/notifications/`: `BugEventSubject` notifies `InAppNotifier` and `EmailNotifier` (both extend the abstract `BaseNotifier`). `bugService` publishes an event only after the database update succeeds. | FR-2 |
| Decorator | `backend/src/services/AuditedBugService.js` wraps `bugService` and records an audit entry for each successful transition. | FR-1 |
| Strategy | `backend/src/exporters/`: `ExportContext` picks `CsvExportStrategy` or `JsonExportStrategy` (both extend `ReportExporter`) from the `format` query parameter. | FR-3 |
| State | `backend/src/services/bugStates.js` defines the allowed actions for each status; `bugService.applyTransition` enforces them. | FR-4a |

Every event published to the observers has the shape `{ type, bugId, actingUser, fieldChanged, oldValue, newValue, timestamp }` (agreed in BTS2-48).

## API

All endpoints except signup, login and health need an `Authorization: Bearer <token>` header.

| Method | Path | Roles | Requirement |
|---|---|---|---|
| POST | `/api/auth/signup`, `/api/auth/login` | Public | BTS-0 |
| GET | `/api/bugs` | Any | BTS-2 |
| POST | `/api/bugs` | Tester, QA Lead | BTS-1 |
| PATCH | `/api/bugs/:id/claim` | Developer | BTS-3, FR-4a |
| PATCH | `/api/bugs/:id/resolve` | Developer | BTS-4, FR-4a |
| PATCH | `/api/bugs/:id/verify` | QA Lead | BTS-5/6, FR-4a |
| GET | `/api/bugs/:id/history` | Any | FR-1 |
| GET | `/api/notifications` | Any | FR-2 |
| PATCH | `/api/notifications/:id/read` | Any (own notifications only) | FR-2 |
| GET | `/api/reports/summary` | QA Lead | FR-3 |
| GET | `/api/reports/export?format=csv\|json` | QA Lead | FR-3, NFR-3 |
| POST | `/api/sla/run` | QA Lead | FR-4b |
| GET | `/api/health` | Public | NFR-4 |

Errors use the shape `{ "success": false, "errors": ["..."] }`.

## Local Setup

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```
MONGO_URL=your_mongodb_atlas_connection_string
JWT_SECRET=a_long_random_secret_string
PORT=3000
INSTANCE_NAME=local          # optional; shown by /api/health
```

Run the server:

```bash
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5001` and proxies `/api/*` requests to the backend on `http://localhost:3000` (configured in `vite.config.js`). After `npm run build`, the backend also serves the built frontend from `frontend/dist`.

### Demo Accounts

On first run, three demo users are seeded:

| Username | Password | Role |
|---|---|---|
| `tester_sarah` | `password123` | Tester |
| `dev_alex` | `password123` | Developer |
| `qa_lead` | `password123` | QA Lead |

Use the **Quick Demo Login** buttons on the sign-in screen, or register a new account.

## Testing

### Functional tests (white-box)

```bash
cd backend
npm test             # 230 tests
npm run test:report  # also writes an HTML report to backend/test-report/index.html (not committed)
```

No database or running server is needed: models are stubbed with Sinon, and HTTP tests run the Express app in-process with Supertest. There is one test file per feature in `backend/test/` (for example `notifications.test.js`, `history.test.js`, `exportReport.test.js`, `bugStates.test.js`, `sla.test.js`, `rateLimit.test.js`).

Conventions for new tests:

- Put the requirement ID in each test name, e.g. `FR-4a (409): rejects verify on Open`.
- Stub models with Sinon instead of hitting MongoDB, and call `sinon.restore()` in `afterEach`.
- For HTTP-level tests, import `src/app.js` into Supertest (never `server.js`).
- `npm test` runs with `NODE_ENV=test` (set in `test/setup.js`). The write rate limiter is off there, except in `rateLimit.test.js`, and a model call you forgot to stub fails immediately instead of hanging.

### API tests (black-box)

Postman collections and environments are in `backend/postman/`, one collection per feature (for example `03 Notifications FR-2/NFR-2`), merged into the team's master collection in the shared workspace. Set `baseUrl` in the environment you select (local, EC2 or ALB). Requests check status codes and response bodies, including error cases such as 401, 403, 404, 409 and 429. Run them from the Postman app or with Newman:

```bash
npx newman run backend/postman/03-notifications.postman_collection.json \
  -e backend/postman/03-notifications-local.postman_environment.json
```

Wait a minute between runs, because the rate-limit test uses up the write quota.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): on every pull request and push to `main`, installs the backend on Node 20 and runs `npm test`. `main` is protected: changes reach it only through reviewed pull requests.
- **CD** (`.github/workflows/cd.yml`): after CI passes on `main`, connects to the EC2 instances over SSH, pulls the commit that passed CI, builds the frontend, installs backend production dependencies and restarts the pm2 processes. It reads `EC2_HOST` (one or more hosts, comma-separated), `EC2_USER`, `EC2_APP_DIR`, `EC2_SSH_KEY` and optionally `EC2_KNOWN_HOSTS` from repository secrets.

On each instance, pm2 runs the backend API on port 3000 and the frontend on port 5001. Don't set `NODE_ENV=test` on a server, because that turns the rate limiter off.

## Load Balancing

The ALB sends traffic to both instances and uses `GET /api/health` as its health check. To see traffic alternate between instances:

```bash
for i in $(seq 1 6); do curl -s http://<ALB DNS name>/api/health; echo; done
```

Each response names the instance that served it (`INSTANCE_NAME` in that server's `.env`, e.g. `EC2-NodeA`). Load tests use Apache Benchmark (`ab`); results are in the report.

## Security

- Passwords are hashed with **bcrypt** (10 salt rounds) before storage.
- Role authorization is enforced server-side by a `requireRole` middleware that verifies a **signed JWT**, so client-supplied headers cannot forge a role.
- Tokens expire after 2 hours.
- Write requests (POST, PATCH, PUT) under `/api` are limited to **60 per minute per client IP**; the 61st returns `429 Too many requests`. Reads are not limited. Counts are kept per server instance, so with two instances behind the ALB the effective limit is about 120 per minute. The app trusts one proxy hop (`trust proxy` = 1) to read the client IP from the ALB's `X-Forwarded-For` header, so the instances should accept app traffic only from the ALB.
- CSV exports neutralise formula-like cells (NFR-3).
- Secrets live in `.env` files and GitHub repository secrets, never in the repository.

## Releases

- `v1.0.0`: Assessment 1 submission
- `v2.0.0`: Assessment 2 submission
