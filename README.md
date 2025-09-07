# Wukong 100% — Guide & Tracker

A modern, responsive checklist + guide for **Black Myth: Wukong** collectibles. Built with **Next.js 14 + TypeScript + Tailwind + Zustand**. Includes authentication, session cookies, and Postgres‑backed per‑user progress (Neon/Vercel Postgres).

## Quick start
```bash
# (required) database URL (Neon/Vercel Postgres)
$env:DATABASE_URL = "postgres://USER:PASS@HOST:PORT/wukong-tracker?sslmode=require"
# system admin credentials (env-based, not stored in DB)
$env:AUTH_USER = "admin"
$env:AUTH_PASS = "secret"
# optional: allowed CORS origins (comma-separated)
# $env:CORS_ORIGINS = "https://yourdomain.com,https://staging.yourdomain.com"

pnpm install
pnpm dev
# then open http://localhost:3000
```

### Scripts
```bash
# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Data utilities
pnpm split:data
pnpm crawl:powerpyx
pnpm normalize:data
```

### Tech stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Zustand for state, `next-themes` for dark mode
- Postgres via `@neondatabase/serverless` (Vercel/Neon) for sessions and per‑user progress

## Data sources referenced
- PowerPyx lists for weapons, vessels, spells, drinks, seeds, gourds, formulas: `https://www.powerpyx.com`
- Game8 formulas page: `https://game8.co/games/Black-Myth-Wukong/archives/468470`
- Fextralife seeds list: `https://blackmythwukong.wiki.fextralife.com/Seeds`


## License
MIT — see `LICENSE` for details.

## Authentication

- Login at `/login`. Middleware protects all routes except `/login` and static assets.
- System Admin: signs in using env credentials (`AUTH_USER`/`AUTH_PASS`). Not stored in DB; has access only to `/admin/users` and related admin APIs. Cannot view/use Tracker/Settings or progress APIs.
- Regular users: managed by the System Admin via `/admin/users` and stored in Postgres.
- On login, a `session` HttpOnly cookie is issued (7 days). CSRF uses a double‑submit token (`csrfToken` cookie + `x-csrf-token` header). Logout clears cookies.

## Persistence (Postgres on Neon/Vercel)

- Uses `@neondatabase/serverless` with `DATABASE_URL`.
- Schema (simplified):
  - `users(id serial primary key, username text unique, name text, password_hash text)`
  - `progress(user_id integer, item_id text, done boolean, note text, primary key(user_id, item_id))`
  - `sessions(id serial primary key, token text unique, user_id integer, created_at integer, expires_at integer, last_used_at integer, user_agent text, ip text, revoked boolean)`

### Seeding / managing users

- System Admin is env-based (not in DB) and cannot be edited/deleted.
- Use `/admin/users` to create, update, delete regular users (passwords are stored as bcrypt hashes).

```bash
# Credentials
$env:AUTH_USER = "myuser"
$env:AUTH_PASS = "mypassword"

pnpm dev
```

## Security

- CSRF: double‑submit token on mutating API requests (`x-csrf-token`).
- CORS: configurable allowed origins via `CORS_ORIGINS`; same‑origin always allowed.
- Headers: HSTS (prod), basic CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, COOP/CORP, `Permissions-Policy`.
- SQLi: all queries are parameterized; `itemId` is strictly validated.

## API (summary)

- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET/POST/PUT/DELETE /api/progress`
- `GET/POST/PUT/DELETE /api/admin/users` (admins only)
