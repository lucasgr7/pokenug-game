# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Pokengu is a browser-based, offline-first Pokémon card-battler + idle game: SvelteKit 5 (SPA mode), Svelte 5 Runes, Tailwind v4, all state in IndexedDB. UI language is **Portuguese (pt-BR)**.

## Commands

| Command | Purpose |
|---|---|
| `yarn dev` | Dev server at `http://localhost:5173` |
| `yarn build` | Static SPA build → `build/` |
| `yarn check` | Type-check via `svelte-check`. **The CI gate — must report 0 errors before any PR.** |
| `yarn test` | Vitest unit tests (combat engine + every card). **Must be 100% green before any PR.** |
| `yarn test:watch` | Vitest in watch mode |
| `yarn preview` | Preview the production build |
| `yarn prepare` | `svelte-kit sync` — regenerates `$lib`/route types. Run after pulling or switching branches. |

- **Node 20+ required. Node 18 crashes Vite 8** (`CustomEvent is not defined`).
- Unit tests use **Vitest** (`vitest.config.ts`, NOT in `vite.config.ts` — vitest 3 / vite 8 type clash). Specs live in `src/lib/game/cards/__tests__/*.spec.ts` and drive the pure engine through the harness **`$lib/testing/battle`** (`testBattle(...)`, `b.play(id)`, `b.enemy.damageTaken`, …). IndexedDB adapters are mocked in `src/lib/testing/setup.ts`. Known engine/design bugs are documented as `it.fails(...)` tests — don't "fix" a red `it.fails` by deleting it.
- There is also a Playwright smoke driver inside the `run-pokengu` skill (separate `node_modules`): `node .claude/skills/run-pokengu/driver.mjs smoke`. Visual/runtime smoke tests are optional — run only when explicitly requested.
- CI (Drone): `yarn check && yarn build`, then `docker compose up --build -d` on `main`.

## Architecture

- **SPA, no SSR/prerender** — set in `src/routes/+layout.ts` (`ssr=false, prerender=false, csr=true`).
- **Svelte 5 Runes are force-enabled** for project files (not `node_modules`) via `svelte.config.js`. Treat `$state`/`$derived`/`$effect` as available everywhere in `src/`.
- **All state is client-side in IndexedDB** (`pokengu` DB) via the `idb` library. No server, no accounts.

### Global game state & persistence (`src/lib/game/state.svelte.ts`)

- `game` is a single global `$state` store: `{ player, roster, ready }`. Import and mutate it directly.
- Mutations go through exported helpers (`addMoney`, `spendElementPoints`, `setActivePokemon`, …) that call `schedulePersist()` (debounced 600ms write).
- **IDB proxy clone bug:** never `put()` a Svelte `$state` proxy into IndexedDB — always snapshot first: `$state.snapshot(game.player)`. Every db write in this codebase does this; follow the pattern.
- `initApp()` bootstraps (load player + roster, run migrations, apply offline job progress). The route guard in `+layout.svelte` redirects to `/onboarding` when there is no player.

### Persistence layer (`src/lib/db/`)

- One adapter file per bounded context (`player.ts`, `cards.ts`, `pokemon.ts`, `jobs.ts`, `market.ts`, …).
- The schema and **`DB_VERSION`** live in `src/lib/db/index.ts`. Bumping the version runs the `upgrade()` migration (e.g. v4 wiped `cardInventory`/`activeDeck` for a new card catalog). Add new stores there.

### Battle engine (`src/lib/game/combat.ts` + `src/lib/game/battle.svelte.ts`)

The combat core is **pure and unit-testable** in `combat.ts`: `playCardOn(state, cardId, io)`, `endTurnOn(state, nextIntent, io)`, `dealToEnemy`/`dealToPlayer`/`drawCards` — all operate on an explicit `BattleState` plus a small `CombatIO` callback interface (hurt animations, MissingNo defeat). `battle.svelte.ts` is the thin wrapper that owns the `battle` $state store, IndexedDB persistence, PostHog and enemy-intent rolling. Put game rules in `combat.ts` (testable), side effects in `battle.svelte.ts`.

When a card is played, `applyCardEffect` (`game/cards/apply.ts`) runs in order:
1. `KIND_EMITTERS[tpl.kind]` — generic per-kind handler (`game/cards/kinds.ts`)
2. Resource effects (mana, draw, selfDamage)
3. `appliesStatuses` — declarative status application
4. `CARD_HOOKS[tpl.id]?.onPlay` — card-specific one-off hook (`game/cards/card-hooks.ts`)
5. Card manipulation (`generatesTokens`)

15 elements with the gen-1 type chart in `src/lib/game/type-chart.ts`.

### Cards

- Card definitions are `CardTemplate`s in `src/lib/data/cards.ts` (catalog + pricing). `CardKind` and `CardTemplate` types are in `src/lib/game/types.ts`.
- Template IDs are snake_case, prefixed by kind: `atk_`, `def_`, `heal_`, `buff_`, `cap_`, `energy_`, `combo_`, `power_`, `relic_`.
- To add a card, use the **`card-generator` skill** — it covers kind selection, balance reference, catalog wiring, the `CardKindIcon.svelte` SVG, the mandatory unit-test spec, and battle-rule validation.

### Status system — circular-dependency hazard (`src/lib/game/status/`)

- `STATUS_REGISTRY` is a top-level const in `status/registry.ts`; definition files call `defineStatus()` at module load. Importing definitions straight from `registry` creates a TDZ crash chain.
- **Always import status exports through the barrel `src/lib/game/status/index.ts`** (or `'./status'` / `'$lib/game/status'`), never from `./registry` directly. Status IDs must be globally unique across all `definitions/*.ts`.

## Visual / design conventions

- Design tokens are CSS variables in `src/app.css` — never hardcode structural hex colors.
- **Exception (intentional):** element and rarity colors are hardcoded game data in `src/lib/game/elements.ts` and `Card.svelte`. Pull element colors from `ELEMENT_COLOR[element]`.
- Mobile-first shell: max width 480px. Card art is inline SVG in `CardKindIcon.svelte` (viewBox `0 0 48 48`). See the **`design-pokengu` skill** before adding any SVG, icon, color, or animation.

## Deploy

Docker → Nginx serves `build/` with SPA fallback (`try_files $uri /index.html`); also deployable to Vercel. See `Dockerfile`, `docker-compose.yml`, `nginx.conf`.
