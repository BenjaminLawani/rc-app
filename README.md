# RC Stock — The Right Choice

An offline-first Progressive Web App for daily stock taking. Staff count items on their
phones; the app calculates quantity sold (opening − closing) and syncs to the cloud when a
network is available. It keeps working with no connection and syncs automatically on reconnect.

## Stack

- **Next.js (App Router)** — front end + API route handlers
- **Turso / libSQL** — cloud database, via **Drizzle ORM**
- **IndexedDB (Dexie)** — offline-first local mirror; the UI reads/writes here first
- **Custom sync engine** — an outbox of local edits + a pull cursor, last-write-wins
- **Service worker** (`public/sw.js`) — caches the app shell for offline / installable PWA
- **JWT auth** (`jose` + `bcryptjs`) — email/password login that survives offline

## How it works

- **Shared dataset:** one catalog and one set of daily sessions for the whole shop; every
  logged-in device contributes to the same numbers.
- **Daily sessions:** each day is a session (id = the date, e.g. `2026-09-28`). A new day's
  opening stock carries over from the previous day's closing.
- **Deterministic IDs:** sessions use the date; entries use `${sessionId}:${itemId}`. This lets
  offline edits from multiple devices converge without server-side de-duplication.
- **Sync:** local edits queue in an `outbox`; the client pushes them, then pulls changes newer
  than its cursor (`server_rev`). Conflicts resolve last-write-wins on a client `updatedAt`.
  A full snapshot is just a pull from cursor 0, so first load hydrates the whole catalog.

## Setup

### 1. Environment

`.env` is created for local development (a local SQLite file stands in for Turso):

```
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=
JWT_SECRET=<generated>
ADMIN_EMAIL=...
ADMIN_NAME=...
ADMIN_PASSWORD=...
```

For **production**, create a Turso database and set the URL + token:

```bash
turso db create rc-stock
turso db show rc-stock --url          # -> TURSO_DATABASE_URL
turso db tokens create rc-stock       # -> TURSO_AUTH_TOKEN
```

Generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 2. Create tables & seed

```bash
npm run db:push     # create tables from lib/db/schema.ts
npm run db:seed     # seed 5 categories, ~87 items, and the admin user
```

> The item catalog in `lib/items.seed.ts` was built from the feature list (opening quantities
> default to 0). Replace that file with the real Excel data and re-run `npm run db:seed`.

### 3. Run

```bash
npm run dev         # development (no service worker)
```

Open http://localhost:3000 and sign in with the seeded admin.

## Testing offline / the PWA

The service worker is only registered in a **production** build:

```bash
npm run build
npm start
```

Then, in the browser: load the app once, open DevTools → Network → **Offline**, and reload.
The app shell and your data load from cache; edits queue in the outbox and sync when you go
back online (watch the status pill in the header, or Settings → Sync).

## Scripts

| Script            | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Dev server                                     |
| `npm run build`   | Production build                               |
| `npm start`       | Serve the production build (enables the PWA)    |
| `npm run db:push` | Apply the schema to the database               |
| `npm run db:seed` | Seed categories, items, and the admin user     |
| `npm run db:studio` | Drizzle Studio (browse the database)         |

## Key files

- `lib/db/schema.ts` — Drizzle schema (users, categories, items, sessions, entries, counter)
- `lib/db/sync-server.ts` — server push (LWW + `server_rev`) and pull
- `lib/local/db.ts` / `queries.ts` — Dexie mirror + mutation helpers
- `lib/sync/engine.ts` — client push/pull/outbox
- `app/(app)/` — Count, Sessions, Stats, Settings screens
- `public/sw.js`, `public/manifest.webmanifest` — PWA
