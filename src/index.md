# AI Context Index (src)

Purpose: fast project orientation for any AI agent with minimal token usage.
Scope: only the `src/` tree.

## 1) 30-second mental model

- App type: SvelteKit SPA game (no SSR/prerender).
- Core loop: choose region -> battle -> rewards/capture -> jobs/shop/deck progression.
- Persistence: IndexedDB (`idb`) for player, cards, roster, jobs, battle snapshot, shop, sprites, regions.
- State style: Svelte runes (`$state`, `$derived`, `$effect`) in domain modules.
- Route guard: player required for all routes except onboarding.

## 2) Read order (fastest understanding)

1. `routes/+layout.svelte` (global shell, startup, route guard)
2. `lib/game/state.svelte.ts` (global game state and persistence hooks)
3. `lib/game/types.ts` (domain contracts)
4. `routes/+page.svelte` (region map flow)
5. `lib/game/battle.svelte.ts` + `routes/battle/+page.svelte` (combat engine + UI)
6. `lib/game/jobs.svelte.ts` + `routes/jobs/+page.svelte` (idle production)
7. `lib/game/shop.svelte.ts` + `routes/shop/+page.svelte` (economy/shop)
8. `routes/deck/+page.svelte` + `lib/db/cards.ts` (deck builder and inventory)

## 3) Source-of-truth by concern

- App bootstrap and navigation guard:
  - `routes/+layout.ts`
  - `routes/+layout.svelte`
- Onboarding and first-time setup:
  - `routes/onboarding/+page.svelte`
  - `lib/game/onboarding.ts`
  - `lib/data/starters.ts`
- Battle system:
  - `lib/game/battle.svelte.ts` (engine, turn flow, reward settlement)
  - `lib/game/type-chart.ts` (element multipliers)
  - `routes/battle/+page.svelte` (battle screen)
- Economy and jobs:
  - `lib/game/jobs.svelte.ts` (tick, offline gain, assignment)
  - `lib/game/shop.svelte.ts` (daily/paid refresh, purchase)
- Persistence adapters:
  - `lib/db/index.ts` (DB schema + object stores)
  - `lib/db/*.ts` (one file per bounded context)
- Card system:
  - `lib/data/cards.ts` (templates/catalog/prices/starter deck)
  - `lib/db/cards.ts` (inventory + active deck)
- Regions/progression:
  - `lib/data/regions.ts`
  - `lib/db/regions.ts`
- API/network and sprite cache:
  - `lib/api/pokeapi.ts`
  - `lib/api/sprites.ts`

## 4) File map (every file in src)

### Root app files

- `app.css`: global theme variables, dark/light palette, app-shell sizing.
- `app.d.ts`: SvelteKit ambient types placeholder.
- `app.html`: HTML template, default `dark` class, viewport/meta.

### Routes

- `routes/+layout.ts`: SPA flags (`ssr=false`, `prerender=false`, `csr=true`).
- `routes/+layout.svelte`: app bootstrap (`initApp`), route guard, offline summary modal, global nav/toast.
- `routes/+page.svelte`: regions list, continue-battle CTA, deck-size guard before entering battle.
- `routes/battle/+page.svelte`: battle arena UI, hand controls, end-of-battle modal, resume/start flow.
- `routes/deck/+page.svelte`: deck builder (filters, grouped copies, add/remove cards, min/max constraints).
- `routes/jobs/+page.svelte`: roster assignment to jobs, production panel, smooth progress animation.
- `routes/onboarding/+page.svelte`: trainer name + starter selection, creates initial player state.
- `routes/shop/+page.svelte`: shop screen, paid refresh, purchase buttons.

### lib entry

- `lib/index.ts`: placeholder barrel note; currently no shared exports.

### lib/api

- `lib/api/pokeapi.ts`: fetches pokemon data, maps primary type to game `Element`, in-memory promise cache.
- `lib/api/sprites.ts`: loads/stores sprite blobs in IndexedDB and returns object URLs.

### lib/assets

- `lib/assets/favicon.svg`: app favicon asset.

### lib/components

- `lib/components/BottomNav.svelte`: bottom tab navigation.
- `lib/components/Card.svelte`: card tile renderer (cost/type/stats/count/badges/playable state).
- `lib/components/CardKindIcon.svelte`: SVG icon set per card kind.
- `lib/components/HpBar.svelte`: HP+block bar with low-health pulse.
- `lib/components/Hud.svelte`: top sticky player HUD (money, element points, theme toggle).
- `lib/components/ManaCrystal.svelte`: mana pip indicator.
- `lib/components/Modal.svelte`: reusable modal with transitions and closable behavior.
- `lib/components/ProgressBar.svelte`: generic progress bar component.
- `lib/components/Sprite.svelte`: pokemon sprite loader (via sprite cache API) with loading/fallback states.
- `lib/components/Toast.svelte`: toast list UI with transitions.

### lib/data

- `lib/data/cards.ts`: card templates, starter templates/deck, shop catalog, lookup helper.
- `lib/data/regions.ts`: region progression chain, encounter pools, query helpers.
- `lib/data/starters.ts`: starter pokemon definitions for onboarding.

### lib/db

- `lib/db/index.ts`: IndexedDB schema and store creation (player, pokemon, cards, deck, jobs, regions, sprites, shop, battle).
- `lib/db/battle.ts`: save/load/clear active battle snapshot.
- `lib/db/cards.ts`: inventory and active deck CRUD, reset-to-starters on defeat.
- `lib/db/jobs.ts`: job assignment persistence CRUD.
- `lib/db/player.ts`: player read/write and existence check.
- `lib/db/pokemon.ts`: roster pokemon CRUD.
- `lib/db/regions.ts`: region defeat progress persistence.
- `lib/db/shop.ts`: persisted shop state read/write.

### lib/game

- `lib/game/battle.svelte.ts`: full battle engine, intent logic, card resolution, turn progression, rewards, capture, persistence.
- `lib/game/elements.ts`: element labels/colors/emojis and card kind icon map.
- `lib/game/jobs.svelte.ts`: job worker math, ticker, offline crediting, flush/persist strategy.
- `lib/game/onboarding.ts`: create player + starter pokemon + starter deck bootstrap.
- `lib/game/shop.svelte.ts`: shop slot generation, daily refresh rule, paid refresh scaling, purchase affordability/transaction.
- `lib/game/state.svelte.ts`: global game store, money/element/theme mutations, app init, offline summary plumbing.
- `lib/game/type-chart.ts`: simplified gen1-style effectiveness resolver and labels.
- `lib/game/types.ts`: all domain types/interfaces.

### lib/stores

- `lib/stores/toast.svelte.ts`: global toast state and push/dismiss helpers.

### lib/utils

- `lib/utils/math.ts`: clamp + compact number formatter.
- `lib/utils/rng.ts`: random helpers (pick, shuffle, weighted).
- `lib/utils/time.ts`: timestamps/day comparisons/duration formatting.

## 5) Practical search shortcuts (for agents)

- Battle bugs: `lib/game/battle.svelte.ts`, `routes/battle/+page.svelte`
- Route/boot issues: `routes/+layout.svelte`, `lib/game/state.svelte.ts`
- Deck/card behavior: `routes/deck/+page.svelte`, `lib/data/cards.ts`, `lib/db/cards.ts`
- Shop pricing/refresh: `lib/game/shop.svelte.ts`, `routes/shop/+page.svelte`
- Offline gains/jobs: `lib/game/jobs.svelte.ts`, `routes/jobs/+page.svelte`
- Region unlock/progression: `lib/data/regions.ts`, `lib/db/regions.ts`, `lib/game/battle.svelte.ts`
- Persistence corruption: `lib/db/index.ts` + affected `lib/db/*.ts`

## 6) Update rule for this index

When adding/changing files in `src/`, update this index in the same PR:
- Add/rename/remove file entries in section 4.
- If behavior ownership changed, update section 3.
- Keep summaries short and factual; no implementation noise.
