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
    users.ts          # GET /api/v1/users — workspace-scoped user list (name, email, role); auth required
  scripts/
    seed.ts           # Demo data seeder (destructive — clears all collections)
    socket-test-client.ts  # Manual Socket.IO test harness
```

Socket.IO rooms: each connected socket joins `workspace:<workspaceId>` and `user:<userId>`. Events are broadcast to the workspace room so all workspace members receive live updates. The `io` instance is attached to the Express app via `app.set('io', io)` and retrieved in routes with `req.app.get('io')`.

### Client structure

```
client/src/
  main.ts             # App bootstrap: Pinia, Vue Router, mount
  App.vue             # Root component — nav bar (name, role badge, logout) shown when authenticated
  api/
    client.ts         # Axios instance with auth interceptor (auto-attaches Bearer token, redirects to / on 401)
    publicClient.ts   # Axios instance without auth (for unauthenticated routes)
    cases.ts          # getCases, createCase, getCase, updateCase, getActivities, addActivity
    users.ts          # getUsers() — returns WorkspaceUser[] for the reassign dropdown
    socket.ts         # Socket.IO factory — derives server URL from VITE_API_URL, passes JWT in handshake
  stores/
    auth.ts           # Pinia auth store — persists token + user to localStorage; exposes isAdmin getter
    cases.ts          # activeCases[] (open/in_progress, fully fetched) + closedCases[] (paginated); fetchActiveCases / fetchClosedCases / loadMoreClosed / addCase / updateCase
  router/index.ts     # Route definitions; requiresAuth meta guard redirects to /login
  views/
    LoginView.vue       # Login form — uses publicClient, stores token+user in auth store on success
    CaseListView.vue    # Case list with status filter tabs, create modal, Socket.IO live updates
    CaseDetailView.vue  # Case header, status buttons, activity timeline, add note form
    DashboardView.vue   # (stub/WIP — placeholder div)
    PublicAlertsView.vue # (stub/WIP — placeholder div; no auth guard)
```

The auth store token is read from `localStorage` on page load. The axios `client.ts` interceptor always reads the latest token from the store, so no manual header management is needed in views.

### Authentication and logout

Logout is entirely client-side — the auth store is cleared, localStorage is wiped, and the user is redirected to `/`. The server uses stateless JWTs so there is nothing to invalidate server-side. The token remains cryptographically valid until its 7-day expiry but the client has no way to send it. A server-side token blacklist is not implemented; add one if forcible session revocation (e.g. admin deactivating an account) is required.

### Case fields

Each case carries two classification fields added alongside the core status/region/description:

- **`priority`** — `critical | high | medium | low` (default `medium`). Displayed as a colour-coded badge in both the list and detail views. Red=critical, orange=high, yellow=medium, green=low.
- **`type`** — `fire | medical | welfare_check | missing_person | hazmat | rescue | other` (required). Displayed as plain text in the list and as a metadata row in the detail view.

Both fields are required in `CreateCasePayload`. The POST route validates both against their enum lists and returns 400 for unknown values. The seed script uses varied types/priorities across its 5 demo cases.

### Case reassignment

- Admin-only: server returns 403 if `assignedTo` is present in the PATCH body and `req.role !== 'admin'`
- PATCH `/cases/:id` handles both `status` and `assignedTo` in a single request; each changed field creates its own Activity log entry
- `case:updated` payload is fully populated (`assignedTo.name`, `createdBy.name`) before emitting
- Reassign dropdown only renders when `authStore.isAdmin` is true; all workspace users are fetched in parallel with the case and activities on CaseDetailView mount

### CaseDetailView behaviour

- Fetches case + activities (last 20) + workspace users in parallel via `Promise.all` on mount — one round trip
- Activities paginated: "Load older activity" button at top prepends earlier entries using `before` cursor (oldest visible `_id`)
- Status change buttons call `PATCH /cases/:id`; local state updated from server response (source of truth)
- Socket.IO `case:updated` patches the case header live; `activity:added` appends to the bottom of the timeline
- Both socket listeners filter by `_id === id` / `caseId === id` to avoid cross-case pollution
- Add note form clears on success; socket handles appending — no manual push to activities array
- `getActivities` and `addActivity` are in `client/src/api/cases.ts` (case-scoped routes, kept in same file)

### CaseListView behaviour

- On mount fetches `status=open,in_progress` into `activeCases` — All/Open/In Progress tabs filter this client-side (instant, no extra requests)
- Closed tab is paginated: triggers `fetchClosedCases()` on first visit, "Load more" button appends next page via `loadMoreClosed()`
- Socket.IO `case:created` adds to `activeCases`; `case:updated` patches in-place and removes from `activeCases` if status becomes closed
- Create case modal available to all authenticated users; includes Type (required, select) and Priority (required, default medium) fields
- `case:created` socket event carries fully populated `assignedTo` and `createdBy` — same shape as GET response

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
- **Status change emits two socket events** — `case:updated` (for the status badge) AND `activity:added` (for the timeline entry). Both must be emitted; missing one means either the badge or the timeline goes stale for other connected users.
- **`activity:added` payload must have `authorId` populated** — both the activities POST route and the cases PATCH route call `.populate('authorId', 'name email')` before emitting. Raw ObjectId will silently show "System" in the timeline instead of the author name.
- **`GET /cases` response shape changed** — now returns `{ cases: Case[], hasMore: boolean }` instead of a plain array. All client code must destructure `res.data.cases`.
- **Pagination uses the `limit+1` trick** — server fetches `limit+1` records; if count exceeds limit, `hasMore=true` and the extra record is popped. No COUNT query needed.
- **Activity cursor is the oldest visible `_id`** — `loadMoreActivities` passes `activities[0]._id` as the `before` param. Server sorts DESC, limits, then reverses for chronological display.
- **`GET /cases?status=` supports comma-separated values** — e.g. `status=open,in_progress` fetches both in one query using Mongoose `$in`. Single value still works as a plain equality filter.


## Seed Credentials

After running `npm run seed` in `server/`:

| Role        | Email                       | Password    |
|-------------|-----------------------------|-------------|
| admin       | admin@caselink.test         | password123 |
| caseworker  | caseworker@caselink.test    | password123 |
| Workspace   | DFES Perth Metro            | —           |
