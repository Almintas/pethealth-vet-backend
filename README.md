# PetHealth — Clinic API

Backend for **PetHealth Vet**, the clinic workspace of PetHealth (a pet health
record system, like e-sveikata.lt but for pets). Veterinarians use it to manage
their clinic's patients and to record medical history, vaccinations,
medications and appointments.

- **NestJS 12**, **GraphQL** (Apollo, code-first) at `/graphql`, **MongoDB** (Mongoose) with its own database.
- Stores clinic-side data: vet accounts and profiles, clinics, memberships and
  clinic ↔ pet access grants.
- Pet and health data live in the **owner API** (`pethealth-backend`). This
  service reads and writes them through the owner API's internal GraphQL
  (`src/owner-integration/`), sending `x-pethealth-service-secret:
  OWNER_SERVICE_SECRET`. Errors reported by the owner system (for example "owner
  account already exists") are passed through to the clinic user.
- Exposes `internal*` operations to the owner API (with the same secret) so
  owners can see and revoke which clinics can access their pets.

**Access rules.** Vets register with a licence number and stay *pending* until
approved (`npm run vet:approve`). A clinic can work with a pet only if it
registered the pet (creating an owner account the owner activates by email) or
the owner gave it a one-time share code. Clinics cannot edit or take over owner
accounts that have been claimed.

## Environment variables

Copy `.env.example` to `.env`. Outside production every variable has a working
development default.

| Variable | Required in production | Description |
|----------|------------------------|-------------|
| `NODE_ENV` | | `development` (default), `production` or `test`. |
| `PORT` | | HTTP port, default `3001`. |
| `MONGODB_URI` | yes | Clinic database, default `mongodb://localhost:27017/pethealth_vet_dev`. |
| `JWT_SECRET` | yes (32+ chars) | Access-token signing secret. |
| `JWT_EXPIRES_IN` | | Token lifetime, default `7d`. |
| `OWNER_GRAPHQL_URL` | yes | Owner API GraphQL URL, default `http://localhost:3000/graphql`. |
| `OWNER_SERVICE_SECRET` | yes (32+ chars) | Shared secret with the owner API (must match its `OWNER_SERVICE_SECRET`). |
| `CORS_ORIGIN` | yes | Comma-separated browser origins. Defaults to the clinic app on `localhost:5174` in development. |

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run start:dev` | Start with watch mode on port 3001. |
| `npm run build` / `npm run start:prod` | Build to `dist/` and run it. |
| `npm test` | Unit tests (Jest). |
| `npm run test:e2e` | End-to-end tests. |
| `npm run lint` | Oxlint. |
| `npm run vet:approve -- --list` | List vet accounts awaiting approval (with licence numbers). |
| `npm run vet:approve -- <email> [--reject]` | Approve or reject a vet account. |
| `node scripts/seed-demo-clinic.mjs` | Create the demo clinic for the first registered vet (see below). |
| `node scripts/probe-owner-integration.mjs` | Integration smoke test: registers a test pet (owner `probe-integration@test.pethealth`) through the owner API. **Writes data** — local development only. |

The test scripts run Jest with `--experimental-vm-modules` because NestJS 12
ships as ES modules.

CI (`.github/workflows/vet-backend-ci.yml`) lints, runs unit and e2e tests and
builds on every push and pull request to `dev`.

## Run the whole system locally

PetHealth is four repositories that run side by side:

| Repo | What it is | Local URL |
|------|------------|-----------|
| [`pethealth-backend`](https://github.com/Almintas/pethealth-backend) | Owner API (NestJS, GraphQL, MongoDB) | http://localhost:3000/graphql |
| [`pethealth-vet-backend`](https://github.com/Almintas/pethealth-vet-backend) | Clinic API, own database | http://localhost:3001/graphql |
| [`pethealth-frontend`](https://github.com/Almintas/pethealth-frontend) | Owner portal (React, Vite) | http://localhost:5173 |
| [`pethealth-vet-frontend`](https://github.com/Almintas/pethealth-vet-frontend) | Clinic app (React, Vite) | http://localhost:5174 |

The owner API owns all pet health data. The clinic API keeps clinics, vets and
access grants in its own database and reads/writes owner data through the owner
API's internal GraphQL, authenticated with the `x-pethealth-service-secret`
header (`OWNER_SERVICE_SECRET`, same value in both backends).

### 1. Prerequisites

- Node.js 22 or newer and npm.
- MongoDB 7 on `localhost:27017`. With Docker:

  ```bash
  docker run -d --name pethealth-mongo -p 27017:27017 mongo:7
  ```

### 2. Install and configure

Clone the four repositories next to each other, then in **each** one:

```bash
cp .env.example .env
npm install
```

The example files already point the services at each other and share the same
development `OWNER_SERVICE_SECRET`, so no edits are needed for local use.

### 3. Start everything (four terminals, in this order)

```bash
# pethealth-backend
npm run start:dev        # owner API on :3000

# pethealth-vet-backend
npm run start:dev        # clinic API on :3001

# pethealth-frontend
npm run dev              # owner portal on :5173

# pethealth-vet-frontend
npm run dev              # clinic app on :5174
```

The frontends use fixed ports (`strictPort`); if a port is taken, Vite stops
instead of silently moving, because CORS and email links expect these ports.

### 4. Create and approve a veterinarian

1. Open http://localhost:5174/register and sign up with a licence number.
   The app shows the *pending approval* screen.
2. In `pethealth-vet-backend`, list pending accounts and approve one after
   checking the licence number against the official register:

   ```bash
   npm run vet:approve -- --list
   npm run vet:approve -- vet@clinic.lt            # approve
   npm run vet:approve -- vet@clinic.lt --reject   # reject
   ```

3. Back in the clinic app, press **Check again** (or sign in again).

### 5. Seed the demo clinic

There is no "create clinic" screen yet. To give the vet a clinic, run in
`pethealth-vet-backend`:

```bash
node scripts/seed-demo-clinic.mjs
```

It takes the **first registered** veterinarian profile, approves that account,
creates *PetHealth Vet Demo Clinic* and an active membership. It is safe to run
again. Register your vet before running it.

Both scripts use `MONGODB_URI` from the shell environment (they do not read
`.env`) and default to `mongodb://localhost:27017/pethealth_vet_dev`. Prefix the
command if your database differs, e.g.
`MONGODB_URI=mongodb://… node scripts/seed-demo-clinic.mjs`.

### 6. Try the main flows

- **Clinic registers a new owner and pet** (clinic app → Patients → *Add patient*).
  The owner gets an activation email. Without `RESEND_API_KEY`, the owner API
  prints the activation link in its console instead (development only); open
  it to set a password at `/activate-account`.
- **Existing owner shares a pet**: in the owner portal open a pet →
  *Clinic access* → *Create code for clinic*. In the clinic app use
  *Add by owner code*. Codes are single-use and valid for 15 minutes; the
  owner can revoke access at any time.
- Records, vaccinations, medications and appointments added by the clinic
  appear in the owner portal.
