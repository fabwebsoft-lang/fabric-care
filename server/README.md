# Fabric Care API

Node.js + Express + tRPC backend for the Fabric Care frontend, backed by MongoDB (Mongoose).

## Stack
- Express 5 + tRPC v11 (`/trpc` mounted via `createExpressMiddleware`)
- Mongoose v9 models: User, Shop, Worker, Customer, Order, Expense, Device
- JWT session auth (`auth.login`) + bcrypt-hashed passwords/worker PINs
- Server-side permission enforcement (see "Roles & permissions" below)

## Local setup

```bash
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET
npm run dev
```

Health check: `GET http://localhost:4000/health`

### Seed the first admin account

There's no public signup route — the shop owner account is created via the seed script:

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=changeme SEED_ADMIN_NAME="Your Name" npm run seed
```

This also ensures a `Shop` document and an `admin`-role `Worker` profile exist.

## Roles & permissions

- Logging in via `auth.login` always authenticates as the shop admin (there's one owner account per shop).
- The "Roles & Access" simulator in the frontend calls `workers.verifyPin(workerId, pin)`. On success it returns a short-lived `roleToken` (12h) that the client must send back as the `x-role-token` header on subsequent requests.
- Every procedure that needs permission-gating uses `requirePermission("canX")` (see `src/lib/permissions.ts`), which reads the *active* role from `x-role-token` (falling back to `admin` if absent) and rejects with `FORBIDDEN` if the role lacks that permission — this is enforced server-side, not just hidden in the UI.
- `src/contexts/AccessControlContext.tsx` on the frontend should be treated as display-only from here on; it must not be the only thing standing between a "staff" user and a privileged mutation.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Express port (default 4000) |
| `MONGODB_URI` | MongoDB Atlas (or other) connection string |
| `JWT_SECRET` | Signing secret for both session and role tokens |
| `CORS_ORIGIN` | Allowed frontend origin (Vercel URL in production) |

## Deploying to Render

1. Push this repo to GitHub (already done for the monorepo).
2. New Web Service on Render → connect the repo → set **Root Directory** to `server`.
3. Build command: `npm install && npm run build`. Start command: `npm start`.
4. Add the env vars above (`MONGODB_URI` from your Atlas cluster, a long random `JWT_SECRET`, `CORS_ORIGIN` set to your Vercel domain).
5. Once deployed, run the seed script once (Render Shell, or locally pointed at the Atlas URI) to create the admin account.
