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
- `admin` — sees all cases in their workspace
- `caseworker` — sees only cases where `assignedTo === userId`

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
  stores/
    auth.ts           # Pinia auth store — persists token + user to localStorage
  router/index.ts     # Route definitions; requiresAuth meta guard redirects to /login
  views/
    LoginView.vue     # Login + register form
    CaseListView.vue  # Filterable case list with real-time Socket.IO updates
    CaseDetailView.vue # Case detail + activity timeline with real-time Socket.IO updates
    DashboardView.vue  # (stub/WIP)
    PublicAlertsView.vue # Unauthenticated alerts view
```

The auth store token is read from `localStorage` on page load. The axios `client.ts` interceptor always reads the latest token from the store, so no manual header management is needed in views.

### API base URL

All authenticated API calls go through `client/src/api/client.ts`. The base URL comes from `VITE_API_URL` (set in `client/.env`). Public calls use `publicClient.ts` which shares the same base URL but no auth header.

## Seed Credentials

After running `npm run seed` in `server/`:

| Role        | Email                       | Password    |
|-------------|-----------------------------|-------------|
| admin       | admin@caselink.test         | password123 |
| caseworker  | caseworker@caselink.test    | password123 |
| Workspace   | DFES Perth Metro            | —           |
