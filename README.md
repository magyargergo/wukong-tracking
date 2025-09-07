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


