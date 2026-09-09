# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Caselink is a case management platform for emergency services / social work teams. It is a monorepo with two independently-run packages:

- `server/` — Express 5 + TypeScript + MongoDB (Mongoose) REST API with Socket.IO
- `client/` — Vue 3 + TypeScript SPA with Vite, Pinia, Vue Router, and Tailwind CSS v4

## Commands

### Server (`cd server`)
```bash
npm run dev      # Start with tsx watch (hot-reload)
npm run seed     # Wipe DB and insert demo workspace + users + cases
```

### Client (`cd client`)
```bash
npm run dev      # Vite dev server (hot-reload)
npm run build    # Type-check then production build
npm run preview  # Serve production build locally
```

There are no test scripts configured in either package.

## Environment Variables

**`server/.env`**
```
PORT=5001
MONGO_URI=<mongodb-atlas-connection-string>
JWT_SECRET=<secret>
```

**`client/.env`**
```
VITE_API_URL=http://localhost:5001/api/v1
```

## Architecture

### Multi-tenant scoping

Every resource (Case, Activity, Alert) carries a `workspaceId` field. The JWT payload encodes `{ userId, workspaceId, role }`, and all API queries filter by `workspaceId` derived from the token — never from the request body. This is the primary authorization boundary.

Role logic:
- `admin` — sees all cases in workspace, can reassign cases, create/deactivate alerts
- `caseworker` — sees only cases where `assignedTo === userId`; can create/update cases and add activity notes

### Critical invariant

Every new query, route, or feature touching Case, Activity, or Alert **must** filter by `workspaceId` derived from the verified JWT — never from the request body or query params. This is the sole authorization boundary in the app. Any code change that reads or writes these collections without this filter is a security bug, not a style issue.

### Server structure

```
server/src/
  index.ts            # Express app setup, Socket.IO init, route registration
  middleware/auth.ts  # requireAuth / requireAdmin middleware; extends Request with userId/workspaceId/role
  utils/jwt.ts        # signToken / verifyToken helpers (7-day expiry)
  models/             # Mongoose schemas: User, Workspace, Case, Activity, Alert
  routes/
    auth.ts           # POST /register, POST /login (creates workspace if name is new)
    cases.ts          # CRUD under /api/v1/cases — emits case:created / case:updated via Socket.IO
    activities.ts     # GET/POST /api/v1/cases/:caseId/activities — emits activity:added
  scripts/
    seed.ts           # Demo data seeder (destructive — clears all collections)
    socket-test-client.ts  # Manual Socket.IO test harness
```

Socket.IO rooms: each connected socket joins `workspace:<workspaceId>` and `user:<userId>`. Events are broadcast to the workspace room so all workspace members receive live updates. The `io` instance is attached to the Express app via `app.set('io', io)` and retrieved in routes with `req.app.get('io')`.

### Client structure

```
client/src/
  main.ts             # App bootstrap: Pinia, Vue Router, mount
  api/
    client.ts         # Axios instance with auth interceptor (auto-attaches Bearer token, redirects to / on 401)
    publicClient.ts   # Axios instance without auth (for unauthenticated routes)
    cases.ts          # Typed API functions: getCases, createCase, getCase, updateCaseStatus
    socket.ts         # Socket.IO factory — derives server URL from VITE_API_URL, passes JWT in handshake
  stores/
    auth.ts           # Pinia auth store — persists token + user to localStorage; exposes isAdmin getter
    cases.ts          # Pinia cases store — cases[], loading, error; fetchCases / addCase / updateCase actions
  router/index.ts     # Route definitions; requiresAuth meta guard redirects to /login
  views/
    LoginView.vue       # Login form — uses publicClient, stores token+user in auth store on success
    CaseListView.vue    # Case list with status filter tabs, create modal, Socket.IO live updates
    CaseDetailView.vue  # (stub/WIP — placeholder div)
    DashboardView.vue   # (stub/WIP — placeholder div)
    PublicAlertsView.vue # (stub/WIP — placeholder div; no auth guard)
```

The auth store token is read from `localStorage` on page load. The axios `client.ts` interceptor always reads the latest token from the store, so no manual header management is needed in views.

### CaseListView behaviour

- Fetches all cases once on mount (no status param); filters client-side by tab — instant switching, no extra API calls
- Socket.IO connects on mount with JWT auth; listens for `case:created` (filtered by active tab) and `case:updated` (always patches in-place); disconnects on unmount
- Create case modal is available to all authenticated users (both admin and caseworker)
- `case:created` socket event carries fully populated `assignedTo` and `createdBy` (name + email) — same shape as GET response

### API base URL

All authenticated API calls go through `client/src/api/client.ts`. The base URL comes from `VITE_API_URL` (set in `client/.env`). Public calls use `publicClient.ts` which shares the same base URL but no auth header.

## Design notes

The REST API is intentionally structured for reuse by a future React Native client (versioned routes, bearer-token auth, no cookie/session assumptions). Keep this in mind when adding new endpoints — avoid anything that only makes sense for a browser context.

## Known gotchas

- **`server/` uses TypeScript `^5.9.3`, `client/` uses `~6.0.2`.** The project uses `tsx` instead of `ts-node-dev` because `ts-node-dev` has compatibility issues with newer TypeScript versions. Don't swap the runner without checking tsx compatibility first.
- **Port 5000 is reserved by macOS AirPlay Receiver.** The server runs on 5001 for this reason — don't default back to 5000.
- **Socket.IO event names use colons, not underscores** (`case:updated`, not `case_updated`). A client/server mismatch here fails silently — no error, the listener just never fires.
- **Case status updates are a no-op if the new status matches the current one** — the PATCH handler returns early before creating an Activity log entry, to avoid meaningless "changed from X to X" audit entries.
- **`server/tsconfig.json` uses `module: commonjs` + `esModuleInterop: true`** — changed from the original `nodenext` because `nodenext` + `type: commonjs` in `package.json` caused TypeScript 5.9 to reject ESM import syntax. Do not switch back to `nodenext` without also changing `package.json` `type` to `module`.
- **`case:created` socket payload is fully populated** — the POST route calls `.populate()` before emitting so `assignedTo.name` is available on the client. If you add new routes that create cases, remember to populate before emitting.
- **Tab filtering is client-side** — `fetchCases()` in the cases store always fetches all cases with no status filter. The `?status=` query param on `GET /cases` still works for future use but is not called by the UI during tab switches.


## Seed Credentials

After running `npm run seed` in `server/`:

| Role        | Email                       | Password    |
|-------------|-----------------------------|-------------|
| admin       | admin@caselink.test         | password123 |
| caseworker  | caseworker@caselink.test    | password123 |
| Workspace   | DFES Perth Metro            | —           |
