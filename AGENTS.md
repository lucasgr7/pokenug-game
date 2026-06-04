# Pokengu — Agent instructions

## Prerequisites

- Node 20+. **Node 18 crashes Vite 8** (`CustomEvent is not defined`).
- Yarn classic.

## Commands

| Command | Purpose |
|---|---|
| `yarn dev` | Dev server at `http://localhost:5173` |
| `yarn build` | Static SPA build → `build/` |
| `yarn check` | Type-check (`svelte-check`). Must pass before PR. |
| `yarn preview` | Preview production build |

CI (Drone): `yarn check && yarn build`, then `docker compose up --build -d` on main branch pushes.

## Architecture

- **SPA mode** — no SSR, no prerender (`+layout.ts`: `ssr=false, prerender=false`). Full client-side rendering.
- **All state client-side** in IndexedDB via `idb` library. No server, no accounts.
- **Svelte 5 Runes** (`$state`, `$derived`, `$effect`). Force-enabled for project files via `svelte.config.js`.
- **UI language** is **Portuguese (pt-BR)**.
- **15 elements** with gen-1 type chart in `src/lib/game/type-chart.ts`.

## Project layout

```
src/lib/
  game/         Domain logic — battle engine, shop, jobs, state, status, card-effects
  data/         Static data — cards, regions, starters
  db/           IndexedDB adapters (one file per context: player, cards, pokemon, etc.)
  components/   Svelte UI components
  api/          PokéAPI calls + sprite cache
  utils/        Math, RNG, time helpers
src/routes/
  /onboarding   Onboarding flow (new player creation)
  /             Region map + battle entry (redirects to /onboarding if no player)
  /battle       Card battle arena
  /deck         Deck builder
  /jobs         Idle job assignments
  /shop         Daily card shop
  /market       Element point marketplace
  /catalog      Full card catalog
```

## Status system — circular dependency

The status registry (`STATUS_REGISTRY`) is a top-level `const` in `src/lib/game/status/registry.ts`. Definition files in `definitions/` call `defineStatus()` at module top level. This creates a circular dep chain if definitions are imported from registry directly:

```
registry → definitions → powers/rock → pipeline → registry  ← TDZ crash
```

**Always import status exports through `src/lib/game/status/index.ts` (the barrel)**, not from `./registry` directly. The barrel evaluates registry first, then loads definitions safely. This is already wired for the main entry point (`battle.svelte.ts`). If adding new files that need `getStatusDef`, import from `'./status'` (relative) or `'$lib/game/status'`.

**Status IDs must be unique** across all `definitions/*.ts` files — there is no per-file namespace.

## Gotchas

- **IDB proxy clone bug**: Never `put()` a Svelte `$state` proxy into IndexedDB. Always snapshot first: `$state.snapshot(game.player)`.
- **Card template IDs** use snake_case with kind prefix: `atk_`, `def_`, `heal_`, `buff_`, `cap_`, `energy_`, `combo_`, `power_`, `relic_`.
- **Design tokens** are CSS variables in `src/app.css`. Element/rarity colors are hardcoded in `src/lib/game/elements.ts` and `Card.svelte` — intentional.
- **No test framework** in project deps. Playwright E2E smoke tests live in `.claude/skills/run-pokengu/` (separate `node_modules`). Run via `node driver.mjs smoke`.
- **Docker deploy**: nginx serves `build/` with SPA fallback (`try_files $uri /index.html`). Also deployable to Vercel.
- **`yarn prepare`** runs `svelte-kit sync` to generate types. Run it after pulling or switching branches.
