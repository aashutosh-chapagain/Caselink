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
  App.vue             # Root component — nav bar + urgent alert banners; watches authStore.token (not isAuthenticated) to handle account switches; calls destroySocket + alertsStore.reset on token removal
  api/
    client.ts         # Axios instance with auth interceptor (auto-attaches Bearer token, redirects to / on 401)
    publicClient.ts   # Axios instance without auth (for unauthenticated routes)
    cases.ts          # getCases, createCase, getCase, updateCase, getActivities, addActivity
    alerts.ts         # getAlerts, getPublicAlerts, createAlert, toggleAlert; Alert / CreateAlertPayload types
    users.ts          # getUsers() — returns WorkspaceUser[] for the reassign dropdown
    socket.ts         # Socket.IO singleton — getSocket() creates one connection per session; destroySocket() tears it down on logout
  stores/
    auth.ts           # Pinia auth store — persists token + user to localStorage; exposes isAdmin getter
    cases.ts          # activeCases[] (open/in_progress, fully fetched) + closedCases[] (paginated); fetchActiveCases / fetchClosedCases / loadMoreClosed / addCase / updateCase
    alerts.ts         # Pinia alerts store — fetches once (loaded flag); activeAlerts / urgentAlerts getters; connectSocket() is idempotent (guards against duplicate listeners); reset() clears state on logout
  router/index.ts     # Route definitions; guards redirect unauthenticated users to /login and authenticated users away from /login to /dashboard
  views/
    LoginView.vue         # Login form — uses publicClient, stores token+user in auth store on success
    CaseListView.vue      # Case list with status filter tabs, create modal, Socket.IO live updates
    CaseDetailView.vue    # Case header, status buttons, activity timeline, add note form
    DashboardView.vue     # Dashboard: stat cards, charts, stale cases, workload, activity feed, active alerts + map
    AlertsManageView.vue  # Admin-only alert management: create/toggle alerts, Socket.IO live updates
    PublicAlertsView.vue  # Public page (no auth) — polls every 30s; reads workspaceId from ?workspace= query param
```

The auth store token is read from `localStorage` on page load. The axios `client.ts` interceptor always reads the latest token from the store, so no manual header management is needed in views.

### Authentication and logout

Logout is entirely client-side — the auth store is cleared, localStorage is wiped, and the user is redirected to `/`. The server uses stateless JWTs so there is nothing to invalidate server-side. The token remains cryptographically valid until its 7-day expiry but the client has no way to send it. A server-side token blacklist is not implemented; add one if forcible session revocation (e.g. admin deactivating an account) is required.

### Case fields

Each case carries classification and location fields alongside the core status/region/description:

- **`priority`** — `critical | high | medium | low` (default `medium`). Displayed as a colour-coded badge in both the list and detail views. Red=critical, orange=high, yellow=medium, green=low.
- **`type`** — `fire | medical | welfare_check | missing_person | hazmat | rescue | other` (required). Displayed as plain text in the list and as a metadata row in the detail view.
- **`address`** — optional free-text address string from Nominatim (e.g. "14 Stirling Street, Perth, Western Australia, 6000, Australia"). Only stored when the user picks from the autocomplete.
- **`lat` / `lng`** — optional coordinates (Number) stored alongside the address. Always present if `address` is present.

`type` is required in `CreateCasePayload`; `priority` defaults to `medium`; `address/lat/lng` are optional. The POST route validates `type` and `priority` against their enum lists and returns 400 for unknown values. The seed script uses varied types/priorities and real Perth coordinates across its 5 demo cases.

### Address autocomplete

`client/src/components/AddressAutocomplete.vue` — self-contained component that:
- Debounces user input (300ms) before querying Nominatim
- Fetches from `https://nominatim.openstreetmap.org/search` with `countrycodes=au&limit=5`
- Shows a dropdown of suggestions; `@mousedown.prevent` on items prevents the input blur from closing the dropdown before selection registers
- Emits `select: { address, lat, lng }` to the parent on pick; emits empty values on clear
- Cleans up the debounce timer and click-outside listener in `onUnmounted`
- Requires `User-Agent: Caselink/1.0` header per Nominatim's terms

The `CaseListView` modal wires it up via `@select="onAddressSelect"` which sets `form.address/lat/lng`. On submit, address fields are only included in the payload if `address` is truthy — cases without an address are submitted cleanly without zero-value lat/lng.

The `CaseDetailView` edit mode also includes `AddressAutocomplete` — shows the current address as a label above the input. On save, `address` is always sent to the server; an empty string clears the field (server converts `""` to `undefined`).

### Map view

`client/src/components/CaseMap.vue` — Leaflet map component rendered on `CaseDetailView` when a case has `lat`/`lng`. Uses free OpenStreetMap tiles, no API key required.
- Leaflet marker icon URLs are fixed for Vite via `L.Icon.Default.mergeOptions()` — without this, markers render as broken images
- Map instance and marker are stored as module-level `let` vars; a `watch` on `lat`/`lng`/`label` props calls `map.setView()` and `marker.setLatLng()` so the map updates when address is edited and saved
- `map.remove()` called in `onUnmounted` to prevent "map container already initialized" errors on remount
- `z-0` on the container prevents Leaflet controls bleeding over modals/dropdowns

### Case list ordering

`GET /cases` now uses a MongoDB aggregation pipeline instead of `.find()`:
1. `$match` — workspace/role/status/cursor filters (ObjectIds must be explicitly cast — aggregation does not auto-cast strings unlike `find()`)
2. `$addFields` — adds a temporary `priorityOrder` field (critical=0, high=1, medium=2, low=3) via `$switch`
3. `$sort` — `priorityOrder asc`, then `updatedAt desc`
4. `$limit` — applied for closed-case pagination
5. `CaseModel.populate()` — static populate called after aggregation since `aggregate()` returns plain objects, not Mongoose documents

Result: Critical cases always appear at the top; within the same priority, most recently updated cases come first.

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
- Create case modal available to all authenticated users; includes Type (required), Priority (default medium), and Address (optional, Nominatim autocomplete) fields
- `case:created` socket event carries fully populated `assignedTo` and `createdBy` — same shape as GET response

### Dashboard

`GET /api/v1/dashboard/stats` — returns all aggregated data in one round trip using parallel MongoDB queries (`Promise.all`):
- Counts by status, priority, type (aggregation `$group`)
- Per-assignee workload with open/inProgress split (`$cond` in `$group`, then `$lookup` for user name)
- Closed-this-month count
- Unassigned active cases count (admin only)
- Stale cases: active cases with no activity in 7+ days — two-step query: `Activity.distinct('caseId')` for recently active cases, then `CaseModel.find({ _id: { $nin: ... } })` for the remainder. Returns up to 5, oldest first.
- 7-day trend: cases created per day via `$dateToString` group, then server-fills missing days with 0 using `Array.from({ length: 7 })`.

Caseworkers are scoped to their own cases throughout; admins see the full workspace.

`GET /api/v1/dashboard/activity` — last 10 activities workspace-wide (admin) or scoped to caseworker's assigned cases. Populates both `authorId` (name) and `caseId` (title).

Client components:
- `StatCard.vue` — summary card (label + number + optional sublabel + colour).
- `BreakdownBar.vue` — labelled CSS progress bar (kept, not currently used in dashboard).
- `AlertsMap.vue` — multi-pin Leaflet map; accepts `alerts: Alert[]` prop; renders active alerts that have lat/lng as `L.circleMarker` coloured by severity (red/orange/yellow/blue); popups show message + region; `watch` on prop syncs markers reactively; `fitBounds` auto-zooms to show all pins; defaults to Perth if no coords.
- `DashboardView.vue` — composes StatCard, VueApexCharts (donut + horizontal bar + area sparkline), active alerts section (list + AlertsMap), stale cases table, workload table (admin only), and activity feed. All chart options typed as `ApexOptions` to satisfy vue3-apexcharts prop types — `chart.type` requires `as const` or explicit `ApexOptions` return type annotation.

Charts use `computed(): ApexOptions` — without the explicit return type, TypeScript widens `'donut'` to `string`, which fails ApexCharts' union type check.

`DashboardView` is the post-login landing page. Nav bar links highlight the active route via `$route.path`. Login redirects to `/dashboard`.

**Gotcha:** `/dashboard` must be registered in `router/index.ts` — Vue Router silently renders nothing for unknown paths rather than throwing an error.

### Alerts

**Model** (`server/src/models/Alert.ts`): `message`, `severity` (critical/high/medium/info), `region` (optional free text), `lat`/`lng` (optional coordinates), `isActive` (boolean, default true), `createdBy`, `workspaceId`. Compound index on `{ workspaceId, isActive }`.

**Routes** (`server/src/routes/alerts.ts`):
- `GET /alerts/public?workspaceId=<id>` — no auth; returns active alerts for a workspace. Public route must be registered **before** `router.use(requireAuth)`.
- `GET /alerts` — authenticated; returns all alerts (active + inactive), sorted active-first.
- `POST /alerts` — admin only; accepts `{ message, severity, region?, lat?, lng? }`. Uses `...(lat !== undefined && lng !== undefined && { lat, lng })` spread pattern. Emits `alert:created` via Socket.IO.
- `PATCH /alerts/:id` — admin only; toggles `isActive` server-side (`!alert.isActive`) — does not accept a value from the client. Emits `alert:updated`.

**Pinia store** (`client/src/stores/alerts.ts`):
- `loaded` flag prevents double-fetch when both the banner and dashboard use the store
- `activeAlerts` getter: `isActive === true`
- `urgentAlerts` getter: active + severity is critical or high
- `fetchAlerts()` — idempotent; skips if already loaded
- `connectSocket()` — subscribes to `alert:created` / `alert:updated`; returns the socket so the caller can disconnect it in `onUnmounted`

**In-app banner** (`App.vue`): watches `authStore.isAuthenticated`; on login calls `fetchAlerts()` + `connectSocket()`. Critical and High active alerts render as colored banners below the nav bar. Each banner is individually dismissable (dismissed set is session-local, not persisted). Socket disconnects on logout/unmount.

**Admin view** (`AlertsManageView.vue`): table of all alerts with toggle buttons. Create modal includes `AddressAutocomplete` for optional lat/lng — on selection, `form.region` is set to the address string and `form.lat`/`form.lng` are stored. Per-row toggle state uses `Set<string>` to avoid a single boolean blocking multiple rows. Socket is the source of truth — no manual array push after create.

**Public view** (`PublicAlertsView.vue`): no JWT available so Socket.IO auth is not possible; polls `getPublicAlerts()` every 30 seconds instead. Reads `workspaceId` from `route.query.workspace`. `clearInterval` in `onUnmounted`.

**Dashboard alerts section**: shown at the top of `DashboardView` when `alertsStore.activeAlerts.length > 0`. Lists up to 5 active alerts with severity dot + badge; shows `AlertsMap` alongside if any alert has coordinates.

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
- **Socket.IO is a singleton** — `getSocket()` in `api/socket.ts` creates one connection for the entire authenticated session and returns the same instance on every subsequent call. Views call `socket.on(event, namedHandler)` in `onMounted` and `socket.off(event, namedHandler)` in `onUnmounted` — they never call `socket.disconnect()`. Only `destroySocket()` (called from App.vue on logout) tears down the connection.
- **`alertsStore.connectSocket()` is idempotent** — it tracks the socket instance it last registered listeners on (`_registeredSocket` module var). Calling it again for the same socket is a no-op. This prevents duplicate listeners if the watch in App.vue ever fires multiple times (e.g., Vite HMR re-running setup).
- **Watch `authStore.token`, not `authStore.isAuthenticated`** — `isAuthenticated` is `!!token`, so it stays `true` when a user switches accounts without logging out. Watching the token directly ensures the socket is destroyed and recreated with the new token on account switch.
- **Router redirects authenticated users away from `/`** — `beforeEach` checks `to.name === 'login' && isAuthenticated` first and redirects to `/dashboard`. Without this, a user with a saved token who reopens the app sees the login form with the nav bar already showing.


## Seed Credentials

After running `npm run seed` in `server/`:

| Role        | Email                       | Password    |
|-------------|-----------------------------|-------------|
| admin       | admin@caselink.test         | password123 |
| caseworker  | caseworker@caselink.test    | password123 |
| Workspace   | DFES Perth Metro            | —           |
