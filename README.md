# Caselink

A full-stack case management platform built for emergency services and social work teams. Caseworkers manage incidents end-to-end — from creation through resolution — with real-time collaboration, location mapping, and automated escalation.

**Live demo:** https://caselink-neon.vercel.app

> Use the seed credentials below to explore the app without registering.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Vue 3 + TypeScript + Vite | Composition API with full type safety |
| Styling | Tailwind CSS v4 | Utility-first, no design system overhead |
| State | Pinia | Lightweight, devtools-friendly Vuex replacement |
| Backend | Express 5 + TypeScript | Minimal, flexible, easy to reason about |
| Database | MongoDB + Mongoose | Flexible schema fits evolving case data |
| Real-time | Socket.IO | Persistent connections for live case updates |
| Auth | JWT (stateless) | Portable — ready for a future mobile client |
| Maps | Leaflet + Nominatim | Open-source, no API key or billing required |
| Email | Resend | Transactional invite emails with minimal setup |
| Testing | Vitest + mongodb-memory-server | Fast, isolated tests without a real database |
| Deployment | Vercel (client) + Render (server) + MongoDB Atlas | All free tiers, zero infrastructure to manage |

---

## Features

### Case Management
- Create, update, and close cases with type, priority, region, and optional GPS coordinates
- Location picker with Nominatim address search and interactive Leaflet map
- Case linking — bidirectional related-case associations with inline search
- Due dates with colour-coded overdue badges and a dedicated Overdue tab
- Bulk status update — select multiple cases and update in one action
- CSV export respecting active tab and search filters
- Advanced filtering by case type and assigned caseworker

### Activity & Audit
- Full activity timeline on every case: notes, status changes, reassignments, field edits
- Auto-logged on every meaningful change — title, address, due date, priority, type
- Case history card — time spent in each status, with SLA assessment (Met / Missed / On Track / Overdue)

### Real-time Collaboration
- Socket.IO pushes case and activity updates to all connected workspace members instantly
- No polling — changes appear live without a page refresh

### Notifications & Escalation
- In-app notification bell for case assignments
- Daily automated escalation cron — when a due date passes, the assignee and all admins are notified automatically (fires once per case, resets if due date is updated)

### Workspace Alerts
- Admins publish critical/high/medium/info alerts to the workspace
- Urgent banners shown across the app for all active members
- Public alerts page (no auth) for broadcasting to the public
- Geo-pinned alerts on an interactive map

### Dashboard
- Stat cards: open, in progress, critical, overdue, closed in period
- Configurable date range: 7d / 30d / 90d
- Priority donut chart, case type bar chart, daily creation trend
- Stale cases table, caseworker workload breakdown, recent activity feed

### Auth & Teams
- Workspace registration creates an isolated tenant in one step
- Caseworker invite flow — admin generates a link, invite email sent via Resend
- Role-based access: admin vs caseworker, enforced server-side on every route
- User deactivation — takes effect immediately on all requests without waiting for JWT expiry
- Profile page — edit name, change password

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│   Vue 3 SPA (Vite)  ←──Socket.IO──→  Express 5 API         │
│   Pinia stores                        Mongoose models       │
│   Vue Router                          JWT middleware        │
│   Leaflet maps                        node-cron (08:00)     │
└──────────────┬──────────────────────────────┬──────────────┘
               │ HTTPS (Vercel)               │ HTTPS (Render)
               ▼                              ▼
        caselink-neon.vercel.app    caselink-raw9.onrender.com
                                              │
                                              ▼
                                    MongoDB Atlas M0
```

### Multi-tenancy
Every resource (Case, Activity, Alert, Notification, Invite) carries a `workspaceId`. The JWT payload encodes `{ userId, workspaceId, role }` and all queries filter by `workspaceId` derived from the verified token — never from the request body. Workspace A cannot read or write Workspace B's data.

### Real-time
Each Socket.IO connection joins two rooms on authentication: `workspace:<id>` for broadcast events (case updates, alerts) and `user:<id>` for personal events (notifications). The `io` instance is attached to the Express app via `app.set('io', io)` so route handlers can emit without importing a global.

### Overdue escalation
A `node-cron` job fires daily at 08:00. It queries for active cases where `dueAt < now` and `overdueNotifiedAt` is null, creates Notification records for the assignee and all workspace admins, emits `notification:new` to each personal Socket.IO room, logs an activity entry, and stamps `overdueNotifiedAt` to prevent duplicate notifications. Extending a due date resets the stamp so escalation fires again if the new date also passes.

---

## Local Development

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (or local MongoDB)

### Setup

```bash
# Install root dependencies (wires up Husky pre-push hook)
npm install

# Server
cd server
cp .env.example .env   # fill in your values
npm run dev            # starts on http://localhost:5001

# Client (separate terminal)
cd client
npm run dev            # starts on http://localhost:5173
```

### Environment Variables

**`server/.env`**
```
PORT=5001
MONGO_URI=<mongodb-atlas-connection-string>
JWT_SECRET=<long-random-string>
CLIENT_URL=http://localhost:5173
RESEND_API_KEY=<resend-api-key>
RESEND_FROM=onboarding@resend.dev
```

**`client/.env`**
```
VITE_API_URL=http://localhost:5001/api/v1
```

### Seed Data

```bash
cd server && npm run seed
```

Wipes the database and inserts a demo workspace with 4 caseworkers, 26 cases across Perth suburbs, 41 activities, and 4 alerts.

| Role | Email | Password |
|---|---|---|
| Admin | admin@caselink.test | password123 |
| Caseworker | sarah@caselink.test | password123 |
| Caseworker | marcus@caselink.test | password123 |
| Caseworker | priya@caselink.test | password123 |
| Caseworker | tom@caselink.test | password123 |

### Tests

```bash
cd server && npm test
```

61 Vitest tests covering auth, case CRUD, notifications, and workspace isolation. Runs against an in-memory MongoDB instance — no `.env` required.

---

## CI / CD

- **GitHub Actions** — runs server tests and client type-check on every push to `dev` and every PR targeting `main`
- **Husky pre-push hook** — blocks pushes if tests fail locally
- **Vercel** — auto-deploys `main` on merge
- **Render** — auto-deploys `main` on merge
