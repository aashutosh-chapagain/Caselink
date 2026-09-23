# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Caselink is a case management platform for emergency services / social work teams. It is a monorepo with two independently-run packages:

- `server/` — Express 5 + TypeScript + MongoDB (Mongoose) REST API with Socket.IO
- `client/` — Vue 3 + TypeScript SPA with Vite, Pinia, Vue Router, and Tailwind CSS v4

---

## Project Status & Timeline

### What is built (production-ready features)

| Feature | Status | Notes |
|---|---|---|
| Auth — login | Done | JWT, 7-day expiry, stateless |
| Auth — workspace registration | Done | Admin-only, unique workspace name enforced |
| Auth — caseworker invite flow | Done | UUID token, 7-day expiry, single-use |
| Team management | Done | Member list, invite modal, pending invites, revoke |
| Profile page | Done | View account details, edit name, change password |
| Case CRUD | Done | Create, read, update; soft-closed via status |
| Case list — filter tabs | Done | All / Open / In Progress / Closed (paginated) |
| Case search | Done | Keyword search across title, description, region, address; composes with tab filters |
| Case list — map tab | Done | Active cases with coords, priority-coloured pins |
| Case detail | Done | Header, status buttons, edit mode, activity timeline |
| Case activity timeline | Done | Notes, status changes, reassignments, field edits |
| Case auto-activity logging | Done | Title and address changes create audit entries |
| Case priority ordering | Done | Critical → High → Medium → Low, then by updatedAt |
| Case reassignment | Done | Admin only; activity logged |
| Alerts — admin management | Done | Create, toggle active/inactive, Socket.IO live |
| Alerts — public page | Done | No auth, polls every 30s, workspace scoped |
| Alerts — in-app banners | Done | Critical + High banners, per-alert dismissable |
| Dashboard | Done | Stat cards, charts, stale cases, workload, activity feed |
| Location picker | Done | Nominatim search + interactive map, suburb auto-fill |
| Maps — case detail | Done | Single-pin Leaflet map when case has coordinates |
| Maps — alerts | Done | Multi-pin map on manage page and dashboard |
| Maps — case list | Done | Map tab showing all active pinned cases |
| Real-time updates | Done | Socket.IO for cases, activities, alerts workspace-wide |
| Multi-tenant isolation | Done | All queries scoped to workspaceId from JWT |
| Role-based access | Done | Admin vs caseworker; server-enforced |

### What is not yet built

| Feature | Priority | Notes |
|---|---|---|
| User deactivation | Medium | `isActive` field exists on User model, middleware check not wired |
| Email sending | Low | Invite links are copy-paste for now; Resend/Nodemailer when needed |
| Notifications | Low | In-app or push notifications for case assignments |
| File attachments on cases | Low | Evidence photos, documents |
| Mobile app | Future | API is REST + bearer token, ready for React Native |

---

## Test Infrastructure

### Overview

Tests run against an in-memory MongoDB instance (`mongodb-memory-server`) — the real Atlas database is never touched. `JWT_SECRET` is set directly in `setup.ts`; no `.env` file is required to run tests.

### Files

```
server/
  vitest.config.mts          # Vitest config — globals, node env, singleFork, 20s timeout
  src/tests/
    setup.ts                 # Starts in-memory MongoDB, mounts mock Socket.IO, wipes DB after each test
    helpers.ts               # registerAdmin(), registerCaseworker(), createCase() — shared test utilities
    auth.test.ts             # 14 tests — register, login, full invite flow
    cases.test.ts            # 17 tests — CRUD, role enforcement, workspaceId isolation
    users.test.ts            # 10 tests — profile, password change, workspace scoping
```

### Key decisions

- **`app.ts` factory** — `createApp()` returns the Express app without connecting to MongoDB or starting a listener. Tests import `app.ts`; the real server imports it too from `index.ts`. This is the standard pattern for making Express apps testable.
- **`singleFork: true`** — all three test files share one process and one in-memory MongoDB instance. Without this, Vitest would spin up three separate MongoDB instances (one per file), wasting RAM and time.
- **`afterEach` wipe** — every collection is wiped after each test so no test can depend on another's side effects (test isolation).
- **Mock Socket.IO** — routes call `req.app.get('io').to(...).emit(...)`. Tests set a no-op mock: `app.set('io', { to: () => ({ emit: () => {} }) })`. Without this, any route that emits a socket event would throw in tests.
- **`vitest.config.mts`** — `.mts` extension marks the config file as ESM. The server package uses `"type": "commonjs"`, so without `.mts` Vite would try to load the config as CommonJS and warn about ESM syntax.
- **`"types": ["node", "vitest/globals"]` in `tsconfig.json`** — makes `beforeAll`, `afterEach`, `describe`, `it`, `expect` etc. available as globals without explicit imports in test files.

### What the tests cover

Tests focus on **security invariants** (workspaceId isolation, role enforcement) and **validation boundaries** — not implementation details or response shapes.

- `workspaceId isolation` — admin from Workspace A cannot see cases or users from Workspace B
- `role enforcement` — caseworker gets 403 on admin-only operations (reassign, create invites)
- `single-use invite` — replaying an accepted invite token returns 400
- `auth validation` — short passwords, duplicate emails, wrong credentials all return correct status codes

---

## Git workflow and CI

### Branch strategy

- `dev` — active development branch; all feature work goes here
- `main` — protected; only receives merges from `dev` via pull request

### Pre-push hook (Husky)

Installed at the git root. Running `npm install` at the repo root wires it up automatically via the `prepare` script.

```
git push  →  .husky/pre-push runs  →  cd server && npm test
           →  push blocked if any test fails
```

The hook lives at `.husky/pre-push`. It provides fast local feedback before code leaves the machine.

### GitHub Actions CI (`.github/workflows/ci.yml`)

Triggers on every push to `dev` and every PR targeting `dev` or `main`. Runs two parallel jobs:

| Job | Command | What it checks |
|---|---|---|
| `server-tests` | `npm test` in `server/` | All 41 Vitest tests pass |
| `client-typecheck` | `npm run build` in `client/` | `vue-tsc` type-check + Vite build succeeds |

Both jobs use `npm ci` (not `npm install`) for reproducible, lockfile-exact installs. npm cache is keyed per sub-package lockfile so a client dependency change doesn't invalidate the server cache.

To enforce CI as a required gate on PRs: **Settings → Branches → Branch protection rule for `main`** → enable "Require status checks" → select `Server tests` and `Client type-check`.

---

## Commands

### Root (git root — `Caselink/`)
```bash
npm install      # Installs husky and wires up the pre-push hook
```

### Server (`cd server`)
```bash
npm run dev      # Start with tsx watch (hot-reload)
npm run seed     # Wipe DB and insert demo workspace + users + cases
npm test         # Run all tests (vitest, in-memory MongoDB, no .env needed)
```

### Client (`cd client`)
```bash
npm run dev      # Vite dev server (hot-reload)
npm run build    # Type-check then production build
npm run preview  # Serve production build locally
```

---

## Environment Variables

**`server/.env`**
```
PORT=5001
MONGO_URI=<mongodb-atlas-connection-string>
JWT_SECRET=<secret>
CLIENT_URL=http://localhost:5173
```

**`client/.env`**
```
VITE_API_URL=http://localhost:5001/api/v1
```

`CLIENT_URL` is used by the invite route to build the `/accept-invite?token=` URL returned to the admin.

---

## Architecture

### Multi-tenant scoping

Every resource (Case, Activity, Alert, Invite) carries a `workspaceId` field. The JWT payload encodes `{ userId, workspaceId, role }`, and all API queries filter by `workspaceId` derived from the token — never from the request body. This is the primary authorization boundary.

Role logic:
- `admin` — sees all cases in workspace; can reassign cases, create/deactivate alerts, invite caseworkers
- `caseworker` — sees only cases where `assignedTo === userId`; can create/update cases and add activity notes

### Critical invariant

Every new query, route, or feature touching Case, Activity, Alert, or Invite **must** filter by `workspaceId` derived from the verified JWT — never from the request body or query params. Any code change that reads or writes these collections without this filter is a security bug, not a style issue.

### Server structure

```
server/src/
  app.ts              # createApp() factory — Express app + all routes, no DB/server I/O (imported by tests and index.ts)
  index.ts            # Server startup only — calls createApp(), connects MongoDB, starts Socket.IO + listener
  middleware/auth.ts  # requireAuth / requireAdmin middleware; extends Request with userId/workspaceId/role
  utils/jwt.ts        # signToken / verifyToken helpers (7-day expiry)
  models/
    User.ts           # name, email, passwordHash, role, workspaceId, isActive (default true)
    Workspace.ts      # name
    Case.ts           # title, description, status, priority, type, region, address, lat, lng, assignedTo, createdBy, workspaceId
    Activity.ts       # caseId, authorId, note, type (note|status_change|assignment|update), workspaceId
    Alert.ts          # message, severity, region, lat, lng, isActive, createdBy, workspaceId
    Invite.ts         # email, workspaceId, token (UUID), expiresAt (7d), used, createdBy
  routes/
    auth.ts           # POST /register (admin + new workspace), POST /login,
                      # GET /invite/:token (public, pre-fill), POST /accept-invite (public, create caseworker)
    cases.ts          # CRUD under /api/v1/cases — emits case:created / case:updated via Socket.IO
    activities.ts     # GET/POST /api/v1/cases/:caseId/activities — emits activity:added
    users.ts          # GET /users (workspace list), GET /users/me, PATCH /users/me (name), PATCH /users/me/password
    invites.ts        # POST / GET / DELETE /api/v1/invites — admin only (requireAuth + requireAdmin at router level)
    dashboard.ts      # GET /stats, GET /activity — aggregated workspace data
    alerts.ts         # GET /public (no auth), GET / POST / PATCH — alert management
  scripts/
    seed.ts           # Demo data seeder (destructive — clears all collections)
    socket-test-client.ts  # Manual Socket.IO test harness
```

Socket.IO rooms: each connected socket joins `workspace:<workspaceId>` and `user:<userId>`. Events are broadcast to the workspace room so all workspace members receive live updates. The `io` instance is attached to the Express app via `app.set('io', io)` and retrieved in routes with `req.app.get('io')`.

### Client structure

```
client/src/
  main.ts             # App bootstrap: Pinia, Vue Router, mount
  App.vue             # Root component — nav bar (Team link admin-only) + urgent alert banners;
                      # watches authStore.token (not isAuthenticated) to handle account switches;
                      # calls destroySocket + alertsStore.reset on token removal
  api/
    client.ts         # Axios instance with auth interceptor (auto-attaches Bearer token, redirects to / on 401)
    publicClient.ts   # Axios instance without auth (for unauthenticated routes)
    cases.ts          # getCases, createCase, getCase, updateCase, getActivities, addActivity; Activity type includes 'update'
    alerts.ts         # getAlerts, getPublicAlerts, createAlert, toggleAlert; Alert / CreateAlertPayload types
    users.ts          # getUsers(), getMyProfile(), updateMyProfile(name), changePassword(current, new)
    invites.ts        # createInvite, getInvites, revokeInvite (authed); getInvitePreview, acceptInvite (public)
    socket.ts         # Socket.IO singleton — getSocket() creates one connection per session; destroySocket() tears it down on logout
  stores/
    auth.ts           # Pinia auth store — persists token + user to localStorage; exposes isAdmin getter
    cases.ts          # activeCases[] (open/in_progress) + closedCases[] (paginated)
    alerts.ts         # fetches once (loaded flag); activeAlerts / urgentAlerts getters; connectSocket() idempotent; reset() on logout
  router/index.ts     # guestOnlyRoutes = ['login', 'register', 'accept-invite'] redirected to /dashboard if authenticated;
                      # requiresAuth and requiresAdmin meta guards
  views/
    LoginView.vue         # Login form + "Create a workspace" link to /register
    RegisterView.vue      # New workspace + admin account creation
    AcceptInviteView.vue  # Public; validates token on mount, pre-fills email; creates caseworker account
    TeamManageView.vue    # Admin-only: member list, invite modal (generates link), pending invites + revoke
    ProfileView.vue       # Account details (read-only) + inline name edit + change password form
    CaseListView.vue      # Filter tabs (All/Open/In Progress/Closed/Map) + create modal + Socket.IO
    CaseDetailView.vue    # Case header, status buttons, activity timeline, edit mode, add note form
    DashboardView.vue     # Stat cards, charts, stale cases, workload, activity feed, active alerts + map
    AlertsManageView.vue  # Admin-only alert management: create/toggle alerts, active alerts map
    PublicAlertsView.vue  # Public page (no auth) — polls every 30s; reads workspaceId from ?workspace=
  components/
    PasswordInput.vue     # Reusable password field with show/hide toggle (used on Login, Register, AcceptInvite)
    LocationPicker.vue    # Nominatim search + interactive Leaflet map; emits { address, lat, lng, region }
    PinMap.vue            # Generic reusable multi-pin Leaflet map; accepts MapPin[]; emits pin-click
    AlertsMap.vue         # Thin wrapper over PinMap — maps Alert[] → MapPin[] with severity colours
    CasesMap.vue          # Thin wrapper over PinMap — maps Case[] → MapPin[] with priority colours; hover shows popup
    CaseMap.vue           # Single-pin Leaflet map for CaseDetailView
    StatCard.vue          # Summary stat card (label + number + colour)
    BreakdownBar.vue      # Labelled CSS progress bar (exists, not currently used)
```

---

### Authentication, registration, and invite flow

**Workspace registration** (`POST /auth/register`):
- Creates a new workspace + admin user in one step
- Workspace name must be unique — returns 409 if taken (does not silently join)
- `role` is never accepted from the request body — first user is always `admin`

**Caseworker invite flow**:
1. Admin: `POST /api/v1/invites { email }` — creates `Invite` with UUID token + 7-day expiry; upserts (replaces existing invite for same email in same workspace); returns `{ inviteUrl }`
2. Admin copies link and shares out-of-band (no email infrastructure required)
3. Caseworker opens `/accept-invite?token=<uuid>` — `GET /auth/invite/:token` validates and returns `{ email, workspaceName }` for pre-fill
4. Caseworker submits name + password — `POST /auth/accept-invite` re-validates token, creates user with `role: 'caseworker'` hardcoded, marks invite `used: true`, returns JWT
5. Invite is single-use — replaying the same token returns 400

**Logout** is entirely client-side — auth store cleared, localStorage wiped, redirect to `/`. JWTs remain cryptographically valid until 7-day expiry but client can't send them.

**`isActive` on User model**: field exists (default `true`), but the middleware check is not yet wired. Add it to `requireAuth` when user deactivation is needed.

---

### Profile page

`GET /users/me` — returns the authenticated user's `name`, `email`, `role`, plus `workspaceName` (joined from Workspace collection). Used only by `ProfileView` on mount.

`PATCH /users/me` — updates `name`. Returns the updated user document. After saving, `authStore.updateUser({ name })` is called to patch the in-memory store and re-persist to `localStorage` so the nav bar name updates immediately without a reload.

`PATCH /users/me/password` — requires `{ currentPassword, newPassword }`. Verifies `currentPassword` against the stored bcrypt hash before accepting the new one; returns 401 if incorrect. Min 8 chars enforced server-side.

The profile page uses the `PasswordInput` component for both password fields. Name editing is inline — the name row shows an "Edit" link; clicking it replaces the text with an input + Save/Cancel on the line below (stacked layout to avoid overflow on small screens). Enter saves, Escape cancels.

### Case fields

- **`priority`** — `critical | high | medium | low` (default `medium`). Red=critical, orange=high, yellow=medium, green=low.
- **`type`** — `fire | medical | welfare_check | missing_person | hazmat | rescue | other` (required).
- **`address`** — optional free-text string from Nominatim. Only stored when user picks from LocationPicker.
- **`lat` / `lng`** — optional coordinates, always present if `address` is present.

### Case activity auto-logging

The PATCH `/cases/:id` handler creates Activity entries automatically for:
- **Status change** — `"Status changed from open to in_progress"` (type: `status_change`)
- **Reassignment** — `"Case reassigned"` (type: `assignment`)
- **Title change** — `"Title changed from "X" to "Y""` (type: `update`)
- **Address change** — `"Address updated to "..."` or `"Address removed"` (type: `update`)
- **Description change** — saved silently, no activity log (too noisy)

Activity `type` enum: `note | status_change | assignment | update`. Client `Activity` interface in `cases.ts` must stay in sync with this.

Activity badge colours in CaseDetailView: note=slate, status_change=blue, assignment=purple, update=amber.

### Address autocomplete / LocationPicker

`client/src/components/LocationPicker.vue` — reusable component combining Nominatim address search with an interactive Leaflet map.
- Debounces input (300ms), queries Nominatim with `addressdetails=1&countrycodes=au&limit=5`
- Emits `select: { address, lat, lng, region }` — `region` extracted from Nominatim's structured `address` object (`suburb → city → town → village → county`)
- Map click drops a draggable pin; drag end reverse-geocodes (`addressdetails=1` required)
- Accepts `initialAddress / initialLat / initialLng` props to restore existing pin (edit mode)
- `User-Agent: Caselink/1.0` header required by Nominatim's terms

### Map components

**`PinMap.vue`** — generic reusable Leaflet map. All Leaflet boilerplate lives here.
- Props: `pins: MapPin[]` (id, lat, lng, color, popup HTML), `height?: string` (Tailwind class, default `h-64`)
- Emits: `pin-click: [id]`
- Hover opens popup (`mouseover` → `openPopup`, `mouseout` → `closePopup`); `autoPan: false` prevents map jumping on hover
- Click emits `pin-click` for navigation
- `fitBounds` auto-zooms to show all pins; falls back to Perth if empty
- `await nextTick(); map.invalidateSize()` in `onMounted` — required when map is inside a `v-if`

**`AlertsMap.vue`** — maps `Alert[]` → `MapPin[]` with severity colours (critical=red, high=orange, medium=yellow, info=blue). No Leaflet code.

**`CasesMap.vue`** — maps `Case[]` → `MapPin[]` with priority colours (critical=red, high=orange, medium=yellow, low=green). Emits `pin-click`. No Leaflet code.

**`CaseMap.vue`** — single-pin map for CaseDetailView. Separate from PinMap as it has different behaviour (standard marker, watch on props, no click events).

### Case list — Map tab

`CaseListView` has a **Map** tab alongside All/Open/In Progress/Closed. When active:
- Shows `CasesMap` with all active cases that have coordinates (`mappableCases` computed)
- `pin-click` navigates to `/cases/:id`
- Pin count and priority legend shown in card header/footer
- Cases without coordinates are excluded silently (only appear in list tabs)

### Case search

`GET /cases?search=<query>` — composes with all existing filters (`status`, role scoping, `workspaceId`). The `search` param adds a `$or` regex match across `title`, `description`, `region`, and `address` fields. User input is regex-escaped before use to prevent unexpected behaviour.

Client behaviour in `CaseListView`:
- Search input sits above the filter tabs and affects all tabs simultaneously
- 300ms debounce — request fires only after the user stops typing
- When `searchQuery` is non-empty, results are fetched directly from the server (bypassing the Pinia store) and stored in a local `searchResults` ref; tab filtering is then applied client-side on those results
- When `searchQuery` is cleared, the view reverts to the normal store-backed display
- "Load more" (closed tab pagination) is hidden while searching
- Map tab shows mappable cases from `searchResults` when searching

### Case list ordering

`GET /cases` uses a MongoDB aggregation pipeline:
1. `$match` — workspace/role/status filters (ObjectIds must be explicitly cast in aggregation)
2. `$addFields` — `priorityOrder` (critical=0, high=1, medium=2, low=3) via `$switch`
3. `$sort` — `priorityOrder asc`, then `updatedAt desc`
4. `$limit` — for closed-case pagination
5. `CaseModel.populate()` — static populate after aggregation (aggregate returns plain objects)

### Case reassignment

- Admin-only: 403 if `assignedTo` in PATCH body and `req.role !== 'admin'`
- `case:updated` payload is fully populated before emitting
- Reassign dropdown only renders when `authStore.isAdmin`

### CaseDetailView behaviour

- Fetches case + activities (last 20) + workspace users in parallel via `Promise.all`
- Activities paginated: "Load older activity" button prepends via `before` cursor (oldest visible `_id`)
- Socket.IO `case:updated` patches header live; `activity:added` appends to timeline
- Both socket listeners filter by case ID to avoid cross-case pollution

### CaseListView behaviour

- All/Open/In Progress tabs filter `activeCases` client-side (no extra requests)
- Closed tab: paginated, triggers fetch on first visit, "Load more" appends
- Map tab: `CasesMap` over `mappableCases` (active cases with coordinates)
- Socket.IO `case:created` / `case:updated` keep all tabs live

### Dashboard

`GET /api/v1/dashboard/stats` — all aggregated data in one round trip:
- Counts by status, priority, type
- Per-assignee workload (open/inProgress split)
- Closed-this-month count
- Unassigned active cases (admin only)
- Stale cases: no activity in 7+ days (up to 5)
- 7-day creation trend (missing days filled with 0 server-side)

`GET /api/v1/dashboard/activity` — last 10 activities, workspace-wide (admin) or own cases (caseworker).

Charts use `computed(): ApexOptions` — the explicit return type is required or TypeScript widens `'donut'` to `string`, failing ApexCharts' type check.

### Alerts

**Model**: `message`, `severity` (critical/high/medium/info), `region`, `lat/lng`, `isActive`, `createdBy`, `workspaceId`.

**Routes**: public GET before `requireAuth`; toggle is server-side (`!alert.isActive`) — client sends no value.

**Pinia store**: `loaded` flag prevents double-fetch; `connectSocket()` idempotent via module-level `_registeredSocket` guard; `reset()` on logout.

**Banners**: critical + high alerts render below nav bar; per-alert dismiss is session-local.

---

## Design notes

The REST API is intentionally structured for reuse by a future React Native client (versioned routes, bearer-token auth, no cookie/session assumptions).

---

## Known gotchas

- **`server/` uses TypeScript `^5.9.3`, `client/` uses `~6.0.2`.** Uses `tsx` not `ts-node-dev` — don't swap without checking compatibility.
- **Port 5000 is reserved by macOS AirPlay Receiver.** Server runs on 5001.
- **Socket.IO event names use colons** (`case:updated`, not `case_updated`). Mismatch fails silently.
- **`server/tsconfig.json` uses `module: commonjs` + `esModuleInterop: true`** — do not switch back to `nodenext`.
- **Case status no-op guard** — PATCH returns early if new status equals current, preventing duplicate activity entries.
- **`case:created` socket payload is fully populated** — call `.populate()` before emitting on any new case creation route.
- **Status change emits two socket events** — `case:updated` AND `activity:added`. Missing one leaves badge or timeline stale.
- **`activity:added` payload must have `authorId` populated** — raw ObjectId silently shows "System" in timeline.
- **`GET /cases` returns `{ cases, hasMore }`** — not a plain array. All client code must destructure `res.data.cases`.
- **Pagination uses `limit+1` trick** — fetches one extra; if count exceeds limit, `hasMore=true` and extra is popped.
- **Activity cursor is oldest visible `_id`** — `loadMoreActivities` passes `activities[0]._id` as `before` param.
- **`GET /cases?status=` supports comma-separated values** — e.g. `status=open,in_progress` uses Mongoose `$in`.
- **Socket.IO is a singleton** — views use `socket.on/off` with named handlers. Only `destroySocket()` disconnects.
- **`alertsStore.connectSocket()` is idempotent** — module-level `_registeredSocket` prevents duplicate listeners.
- **Watch `authStore.token`, not `authStore.isAuthenticated`** — handles account switches without logout.
- **`guestOnlyRoutes`** in `beforeEach` covers `login`, `register`, and `accept-invite` — all redirect authenticated users to `/dashboard`.
- **`overflow-hidden` must be on a wrapper div, not the Leaflet map element** — putting it directly on the map container clips Leaflet controls. Only the tile area wrapper gets `overflow-hidden rounded-lg`.
- **`PinMap` hover popup uses `autoPan: false`** — without this, hovering near map edge causes a distracting pan animation.
- **Activity `type` enum must stay in sync** — server `Activity.ts` model enum, client `Activity` interface in `cases.ts`, `activityTypeStyles` record, and badge label expression in `CaseDetailView` all reference the same values. Adding a new type requires updating all four.
- **`authStore.updateUser(fields)` must be called after any server-side profile update** — the JWT does not carry the user's name, so the store is the source of truth for what the nav bar shows. Forgetting this means the nav bar shows the old name until next login.
- **`POST /auth/register` creates workspace + admin only** — it no longer joins existing workspaces. Caseworkers join via the invite flow exclusively.
- **Invite token is a UUID stored in DB** — not a JWT. This allows revocation via `DELETE /invites/:id`. A JWT-based token could not be revoked without a blacklist.
- **`findOneAndUpdate` / `findByIdAndUpdate` use `returnDocument: 'after'`** — Mongoose 9 deprecated `{ new: true }`; use `{ returnDocument: 'after' }` instead. Both options return the updated document, but `new: true` logs a deprecation warning.
- **`process.env.JWT_SECRET` is not loaded in tests** — `dotenv.config()` only runs in `index.ts`, which tests never import. `setup.ts` sets `process.env.JWT_SECRET = 'test-secret'` directly. Any new env variable used in routes must be set in `setup.ts` if tests call those routes.

---

## Seed Credentials

After running `npm run seed` in `server/`:

| Role        | Email                       | Password    |
|-------------|-----------------------------|-------------|
| admin       | admin@caselink.test         | password123 |
| caseworker  | caseworker@caselink.test    | password123 |
| Workspace   | DFES Perth Metro            | —           |
