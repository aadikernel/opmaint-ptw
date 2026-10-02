# Opmaint PTW: Permit to Work module for a CMMS

A safety-critical Permit to Work (PTW) workflow: request, approve, activate, suspend, expire, close and verify permits for **Hot Work**, **Confined Space Entry**, **Working at Height** and **Electrical / Isolation (LOTO)**. All rules are enforced **on the server**. The React app only shows what the server says is allowed.

> Built for the Opmaint Web Development Intern assignment. See [AI usage](#22-ai-usage) for an honest account of how it was made.

---

## 1. Project overview

- One shared `Permit` model plus a **permit type registry**. Adding a fifth type (EXCAVATION) does not need a rewrite.
- A **state machine** (`server/src/stateMachine`) is the single source of truth for legal status changes.
- A **policy layer** (`server/src/policies`) decides who may do what. The same functions build the `allowedActions` list the UI renders, so buttons and server can never disagree.
- An **immutable audit trail** (insert-only in code, and UPDATE/DELETE blocked by a PostgreSQL trigger).
- **Automatic expiry** via a cron job every minute **and** a lazy check on every read/write.

## 2. What is a Permit to Work?

A PTW is a written safety authorisation required before dangerous work starts (for example welding on a pipe rack). The job, place and time window are recorded, hazards and precautions are listed, the right people approve it, and only then can work become ACTIVE, and only inside the approved window. If conditions change the permit is suspended. After the work, the area is inspected and the permit is closed and verified.

## 3. Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS v4, Lucide icons |
| Backend | Node.js, Express 5, TypeScript, Zod, JWT (`jsonwebtoken`), `bcryptjs`, `node-cron` |
| Database | PostgreSQL + Prisma 6 (migrations + seed) |
| Tests | Vitest + Supertest (real PostgreSQL test database) |

## 4. Architecture

```
React (Vite)  ──JSON/HTTPS──▶  Express
                                 ├─ routes        URL → controller
                                 ├─ controllers   HTTP in/out + Zod parsing
                                 ├─ validators    Zod schemas
                                 ├─ services      business rules, transactions, audit
                                 ├─ policies      WHO may do WHAT (pure functions)
                                 ├─ stateMachine  WHICH status changes are legal (pure)
                                 ├─ permitTypes   registry of type-specific schemas + safety checks
                                 └─ jobs          expiry cron
                                          │
                                   Prisma ▼  PostgreSQL
```

Every workflow action runs: **authenticate (JWT) → load user from DB → policy (403) → state machine (409) → business rules (409/400) → write + audit in one transaction**. The permit row is locked (`SELECT … FOR UPDATE`) so two requests can't change it at once.

## 5. Folder structure

```
opmaint-ptw/
├─ README.md
├─ docs/COMMIT_PLAN.md
├─ server/
│  ├─ prisma/ schema.prisma, migrations/, seed.ts
│  ├─ src/
│  │  ├─ app.ts, server.ts
│  │  ├─ config/ (env, pick-lists)   db/   middleware/ (auth, errors)
│  │  ├─ routes/  controllers/  validators/
│  │  ├─ services/ (permit, workflow, audit, expiry, view)
│  │  ├─ policies/  stateMachine/  permitTypes/  jobs/  utils/
│  └─ tests/ (stateMachine, permissions, api)
└─ client/
   └─ src/
      ├─ api/  auth/  lib/
      ├─ components/ (ui, StatusBadge, Countdown, permit/, permit-form/)
      ├─ permitTypes/ (registry + one config file per type)
      └─ pages/ (Login, Dashboard, PermitForm, PermitDetail, Approvals, Admin)
```

## 6. Database setup

You need PostgreSQL 14+. Easiest with Docker:

```bash
docker run --name ptw-db -e POSTGRES_USER=ptw -e POSTGRES_PASSWORD=ptw -e POSTGRES_DB=ptw -p 5432:5432 -d postgres:16
docker exec ptw-db psql -U ptw -c "CREATE DATABASE ptw_test;"   # for the tests
```

No Docker? Use a free hosted Postgres (Neon, Supabase, Render) and put its URL in `DATABASE_URL`.

## 7. Environment variables

`server/.env` (copy from `server/.env.example`):

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign tokens (never commit it) |
| `PORT` | API port (default 4000) |
| `CORS_ORIGIN` | Allowed browser origin(s), comma separated |
| `RUN_EXPIRY_JOB` | `false` disables the cron job (lazy expiry still works) |
| `TEST_DATABASE_URL` | (optional) test database; default `postgresql://ptw:ptw@localhost:5432/ptw_test` |

`client/.env`: `VITE_API_URL=http://localhost:4000/api`

## 8. Migration instructions

```bash
cd server
npm install
npx prisma migrate deploy      # applies the committed migrations
```

Two migrations: `init` (tables) and `audit_immutable_and_checks` (audit UPDATE/DELETE trigger + `plannedEnd > plannedStart` check).

## 9. Seed instructions

```bash
npm run db:seed
```

Creates 4 users, 2 plants, 4 areas, 6 equipment and 12 permits in every status (times are relative to "now", so ACTIVE permits are really active). Safe to re-run: it wipes and recreates the data.

## 10. Local setup (about 2 minutes)

```bash
git clone <repo> && cd opmaint-ptw
cd server && cp .env.example .env && npm install && npx prisma migrate deploy && npm run db:seed
npm run dev                # API on http://localhost:4000
# in a second terminal
cd client && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
```

## 11. Run the frontend
`cd client && npm run dev` (build: `npm run build`).

## 12. Run the backend
`cd server && npm run dev` (production: `npm run build && npm start`).

## 13. Test commands

```bash
cd server
npm test            # runs migrations on the test DB, then 42 tests
npm run typecheck
cd ../client && npm run typecheck
```

- `stateMachine.test.ts`: pure transition rules, expiry, terminal states, cancellation.
- `permissions.test.ts`: pure policies, including "nobody approves their own permit" for **every** role.
- `api.test.ts`: Supertest against the real Express app and a real PostgreSQL DB: auth, 401/403/404/409, own-permit approval attempts, all-approvers-required, activation rules, suspend stops work, expiry without a browser, closure flow, audit immutability, conflict warning.

## 14. Demo login credentials

Password for every seeded user: **`Ptw@12345`**

| Role | Email | Notes |
|---|---|---|
| Requester | `requester@opmaint.test` | Rahul Verma, owns all seeded permits |
| Area Owner | `areaowner@opmaint.test` | Meera Iyer, assigned to *Pipe Rack Area* only |
| Safety Officer | `safety@opmaint.test` | Priya Nair |
| Admin | `admin@opmaint.test` | Arjun Admin |

Change these before any real use.

## 15. State machine

```
DRAFT ─submit→ PENDING_APPROVAL ─all approve→ APPROVED ─activate→ ACTIVE ⇄ SUSPENDED
                    │ any reject → REJECTED                         │ complete → CLOSED ─verify→ CLOSED_VERIFIED
 APPROVED/ACTIVE/SUSPENDED ─window ends→ EXPIRED          any live state ─cancel→ CANCELLED
```

Terminal: REJECTED, EXPIRED, CLOSED_VERIFIED, CANCELLED. Rules implemented:

1. Activation needs **every** approval (`409 Permit cannot be activated because required approval is missing.`).
2. Not before `plannedStart` (`409 … before its planned start time.`).
3. Expiry is automatic (cron + lazy check). 4. EXPIRED can never be reactivated (`409 Expired permits cannot be reactivated.`).
5. Work logs only while ACTIVE. 6. Illegal transitions return clear 409s. 7. Cancel is server-enforced.
8. Suspend flips to SUSPENDED immediately; nothing can be logged. 9. Resume re-checks approvals, window and safety readings.

## 16. Permission model

| Action | Requester | Area Owner | Safety Officer | Admin |
|---|---|---|---|---|
| Create / edit own draft / submit | ✅ own | ❌ | ❌ | ✅ |
| Approve / reject | ❌ | ✅ own area only | ✅ any | ✅ any |
| Approve **own** permit | ❌ | ❌ | ❌ | ❌ |
| Activate | ✅ own | ❌ | ✅ | ✅ |
| Suspend / resume | ❌ | ❌ | ✅ | ✅ |
| Mark work complete | ✅ own | ❌ | ✅ | ✅ |
| Verify closure | ❌ | ❌ | ✅ (not own) | ✅ (not own) |
| Cancel | ✅ own | ❌ | ✅ | ✅ |
| Edit after submission | ❌ | ❌ | ✅ | ✅ |
| Manage users/plants/areas/equipment | ❌ | ❌ | ❌ | ✅ |

Identity comes only from the signed JWT. The user (role, area) is **re-read from the database** on every request. Nothing about role, status or user id is trusted from the client.

## 17. Permit type abstraction decision

**Shared `Permit` table + `typeSpecificData` JSONB column + a Zod schema per type, chosen from a registry.**

Why: four normalized tables would mean a new table, migration and join for every new type. Raw unvalidated JSON would be unsafe. JSONB + Zod gives flexibility *and* server-side validation (`validateTypeData(permitType, data, "draft" | "full")`). Drafts accept partial data, submitted permits need complete data. Trade-off: type-specific fields can't be queried with plain SQL columns and there's no foreign-key integrity inside the JSON.

**Add EXCAVATION in four small steps**
1. Add `EXCAVATION` to the `PermitType` enum (+ a migration).
2. Server: create `permitTypes/excavation.ts` (Zod schema, `risk`, `activationIssues`, suggested precautions) and add it to `registry.ts`.
3. Client: create `permitTypes/excavation.tsx` (field config) and add one line to `permitTypes/registry.tsx`.
4. Add the value to the type filter list in `DashboardPage`.

The form, review, detail, validation, approvals and audit all work without further changes.

## 18. Decisions where the specification was silent

- **Approver slots.** The server always requires an **Area Owner** slot, plus a **Safety Officer** slot for HIGH-risk types (Hot Work, Confined Space). The requester can add a Safety Officer but never remove required ones. A Safety Officer or Admin can fill the Area Owner slot (so permits in an area with no owner are not stuck). One person can fill only **one** slot per permit.
- **Admins also cannot approve their own permits**, and nobody can verify closure of their own permit.
- **CLOSED is not cancellable**: finished work must be verified, not cancelled. (This deviates slightly from "any non-terminal state".)
- **Expiry** applies to APPROVED, ACTIVE and SUSPENDED permits. A suspended permit past its window must not be resumable.
- **Editing after submission**: requesters cannot. Safety Officer/Admin may edit safety information (description, hazards, PPE, precautions, type data such as a new gas test) only while ACTIVE/SUSPENDED, and every change is audited with old and new values. Permits under approval cannot be edited (cancel and recreate). Time window, location and type are locked.
- **Gas/safety limits** are enforced at activation and resume: hot work LEL ≤ 5%, O₂ 19.5–23.5%, combustibles cleared ≥ 11 m; confined space also H₂S ≤ 10 ppm, CO ≤ 25 ppm; height needs anchor point checked and barricading in place; LOTO needs earthing applied. **These numbers are illustrative defaults, not a legal standard.** Check your site rules.
- **Entry/exit log** for confined space is stored as time-stamped work-log rows (`ENTRY`/`EXIT`), only writable while ACTIVE.
- **Precautions**: every ticked precaution counts as confirmed by the requester; all must be confirmed to submit.
- **Visibility**: requesters see their own permits; area owners see non-draft permits in their area plus their own; safety officers and admins see all. Reads of a permit you can't see return 404 (existence is not leaked). Write attempts return 403 with a clear reason.
- **Conflict detection (optional feature)**: HOT_WORK vs CONFINED_SPACE overlapping in time **in the same area** (same equipment is flagged). It warns, it does not block.
- Dates are stored in UTC and shown in the browser's local time.

## 19. What I would build next

Extension requests (+N hours, capped, re-approval), blocking conflict rules, QR code and mobile-first field view, digital signatures, notifications (a real queue instead of a stub), rate-limiting login, refresh tokens/cookie auth, pagination, a shared Zod package used by both client and server, e2e browser tests.

## 20. What I knowingly left broken / incomplete

- **Extension requests, QR code and digital signature are not built** (conflict detection is).
- **No login rate limiting / account lockout.** JWT is kept in `localStorage` (simple, but XSS-sensitive). Production would use httpOnly cookies.
- **No pagination** on the permit list.
- Client and server validate separately (the client mostly checks "is it filled", the server is the real authority). Zod schemas are not shared.
- The admin screen is intentionally minimal (create/disable users, add plants/areas/equipment; no delete/edit forms).
- The frontend has **no automated tests**.
- Free-tier hosting may sleep. The first request can be slow, and the cron job does not run while asleep. The lazy expiry check covers this.
- The migrations were written by hand (see AI usage). If `npx prisma migrate dev` reports drift on your machine, create a follow-up migration with it and commit that.

## 21. Deployment links

- Frontend (Vercel): _add link after deploying_
- Backend (Render/Railway): _add link after deploying_
- Database: _provider name_

Deploy steps:
1. **Database**: create a Postgres on Neon/Render; copy its connection string.
2. **Backend (Render Web Service, root `server`)**: Build `npm install --include=dev && npm run build` (TypeScript is a dev dependency). Start `npx prisma migrate deploy && node dist/server.js`. Env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=<your vercel URL>`, `NODE_ENV=production`. Then run `npm run db:seed` once (Render shell).
3. **Frontend (Vercel, root `client`)**: env `VITE_API_URL=https://<backend>/api`. `vercel.json` already rewrites all routes to `index.html`.
4. Check `https://<backend>/api/health`, then log in with the demo credentials.

## 22. AI usage

_Edit this section so it is true for you._ This project was built with substantial help from an AI assistant (Claude, Anthropic): architecture planning, the initial implementation of the server, tests and client, and this README. The AI could run the server code, the type checks, the production client build and the test suite against a local PostgreSQL. It could **not** run Prisma's own migration engine (so the SQL migrations were hand-written and applied with `psql`), did **not** view the UI in a browser, and did **not** deploy anything. I reviewed, ran and take responsibility for everything submitted. [Add what you personally changed, tested and learned.]
