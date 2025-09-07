# Wukong 100% — Guide & Tracker (Cursor-ready)

A modern, responsive checklist + guide for **Black Myth: Wukong** collectibles. Built with **Next.js 14 + TypeScript + Tailwind + Zustand**. Includes authentication, session cookies, and SQLite-backed per‑user progress (with optional JSON export/import).

## Quick start
```bash
# (optional) set env vars for dev
# Windows PowerShell examples:
$env:AUTH_USER = "admin"
$env:AUTH_PASS = "secret"
# optional CORS and custom DB path
# $env:CORS_ORIGINS = "https://yourdomain.com,https://staging.yourdomain.com"
# $env:SQLITE_FILE = "D:\\path\\to\\app.db"

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
- SQLite via `better-sqlite3` for sessions and per‑user progress

## Data sources referenced
- PowerPyx lists for weapons, vessels, spells, drinks, seeds, gourds, formulas: `https://www.powerpyx.com`
- Game8 formulas page: `https://game8.co/games/Black-Myth-Wukong/archives/468470`
- Fextralife seeds list: `https://blackmythwukong.wiki.fextralife.com/Seeds`


## License
MIT — see `LICENSE` for details.

## Authentication

- Login at `/login`. Middleware protects all routes except `/login` and static assets.
- Initial admin can sign in using env credentials:
  - `AUTH_USER` (default: `admin`)
  - `AUTH_PASS` (default: `secret`)
- On login, a `session` HttpOnly cookie is issued (7 days). CSRF uses a double‑submit token (`csrfToken` cookie + `x-csrf-token` header).
- Logout clears the session and CSRF cookies.
- Admin user management UI is available at `/admin/users` (visible only to admins).

## Persistence (SQLite)

- Uses `better-sqlite3` and stores the database at `.data/app.db` by default.
- Override location with `SQLITE_FILE` env var.
- Schema (simplified):
  - `users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, name TEXT, password_hash TEXT, is_admin INTEGER DEFAULT 0)`
  - `progress(user_id INTEGER, item_id TEXT, done INTEGER, note TEXT, PRIMARY KEY(user_id,item_id))`
  - `sessions(id INTEGER PRIMARY KEY, token TEXT UNIQUE, user_id INTEGER, created_at INTEGER, expires_at INTEGER, last_used_at INTEGER, user_agent TEXT, ip TEXT, revoked INTEGER DEFAULT 0)`

### Seeding / managing users

- The env user signs in first and appears as a user record automatically.
- Use `/admin/users` to create, update, delete users (passwords are stored as bcrypt hashes) and grant admin.

```bash
# Optional: specify a custom DB path
set SQLITE_FILE=D:\\path\\to\\app.db  # Windows PowerShell
$env:SQLITE_FILE = "D:\\path\\to\\app.db" # alt syntax

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