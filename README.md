## CompCalc Web

Model and compare compensation packages over time. Enter offers and assumptions (base, bonus, equity grants/vesting, raises, cost of living) to project total compensation, visualize equity value, and compare scenarios side‑by‑side. Data is stored locally in your browser.

Next.js app (App Router) with React 19, Tailwind CSS 4, and Vitest.

### Requirements
- Node.js 18+ (recommended LTS)
- pnpm

### Install
```bash
pnpm install
```

### Develop
```bash
pnpm dev
```
Open http://localhost:3000

### Build & Run (production)
```bash
pnpm build
pnpm start
```

### Test
```bash
pnpm test        # run once
pnpm test:watch  # watch mode
```

### Lint
```bash
pnpm lint
```

### Project structure
- `src/app` — routes and server functions
- `src/components` — UI components
- `public` — static assets
