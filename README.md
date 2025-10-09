## CompCalc Web

Model and compare compensation packages over time. Enter offers and assumptions (base, bonus, equity grants/vesting, raises, cost of living) to project total compensation, visualize equity value, and compare scenarios side‑by‑side. Data is stored locally in your browser. https://cbangera2.github.io/compensation-calculator/

You can now share anonymized scenarios by copying a URL that encodes your current offers and settings.

Next.js app (App Router) with React 19, Tailwind CSS 4, and Vitest.
<img width="1512" height="633" alt="image" src="https://github.com/user-attachments/assets/f27a9816-68e8-4670-8030-713fff307bdb" />
<img width="1147" height="809" alt="image" src="https://github.com/user-attachments/assets/62a14b14-a470-4d91-a101-b3a08d696a62" />
<img width="995" height="827" alt="image" src="https://github.com/user-attachments/assets/a238d752-8b79-43c6-82d6-8c7c82a01212" />


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
