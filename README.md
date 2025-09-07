# Wukong 100% — Guide & Tracker (Cursor-ready)

A modern, responsive checklist + guide for **Black Myth: Wukong** collectibles. Built with **Next.js 14 + TypeScript + Tailwind + Zustand**. No backend — progress is saved locally and can be exported/imported as JSON.

## Quick start
```bash
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

## Data sources referenced
- PowerPyx lists for weapons, vessels, spells, drinks, seeds, gourds, formulas: `https://www.powerpyx.com`
- Game8 formulas page: `https://game8.co/games/Black-Myth-Wukong/archives/468470`
- Fextralife seeds list: `https://blackmythwukong.wiki.fextralife.com/Seeds`


## License
MIT — see `LICENSE` for details.

## Authentication

- Credentials are defined by environment variables:
  - `AUTH_USER` (default: `admin`)
  - `AUTH_PASS` (default: `secret`)
- Auth is cookie-based via middleware; `/login` is public.

## Persistence (SQLite)

- Uses `better-sqlite3` and stores the database at `.data/app.db` by default.
- Override location with `SQLITE_FILE` env var.
- Schema:
  - `users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, name TEXT)`
  - `progress(user_id INTEGER, item_id TEXT, done INTEGER, note TEXT, PRIMARY KEY(user_id,item_id))`

### Seeding users

Users are created on first use based on the logged-in username. No manual seeding is required.

```bash
# Optional: specify a custom DB path
set SQLITE_FILE=D:\\path\\to\\app.db  # Windows PowerShell
$env:SQLITE_FILE = "D:\\path\\to\\app.db" # alt syntax

# Credentials
$env:AUTH_USER = "myuser"
$env:AUTH_PASS = "mypassword"

pnpm dev
```


