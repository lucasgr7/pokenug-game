# Implementation Plan: Job Exhaustion Mechanic

> Standalone, self-contained spec. **Implement this BEFORE the relationship feature** (`docs/relationship-feature-plan.md`). This plan introduces the minimal shared memory shape that the relationship plan later builds on — see §10 (Cross-plan coordination).

## 0. Context for the implementing agent (read first)

**Project:** Pokengu — browser-based offline-first Pokémon card-battler + idle game. SvelteKit 5 SPA, Svelte 5 Runes (force-enabled; use `$state`/`$derived`/`$effect` freely in `src/`), Tailwind v4, all state in IndexedDB via `idb`. **UI language is Portuguese (pt-BR)** — all user-facing strings must be pt-BR.

**Non-negotiable conventions:**
- **Pure/side-effect split:** game rules go in plain `.ts` (unit-testable); side effects (state store, IDB, timers) go in `.svelte.ts`. Mirror `combat.ts` (pure) vs `battle.svelte.ts` (wrapper).
- **IDB proxy clone bug:** NEVER `put()` a Svelte `$state` proxy into IndexedDB. Always `$state.snapshot(obj)` first. Every existing DB write does this.
- **Tests are a CI gate:** `yarn run check` must report 0 errors and `yarn test` must be 100% green before done. (Use `yarn run check`, not `yarn check`.) New pure logic needs a Vitest spec under a `__tests__` dir.
- **Persistence pattern:** mutate the global `game` store directly, then `schedulePersist()` (debounced player write) or `addPokemon($state.snapshot(p))` (per-pokemon write).
- Node 20+ required.

**Relevant existing code:**
- Jobs are continuous idle-money producers. `src/lib/game/jobs.svelte.ts`: `tick()` runs every 1s (`jobs.svelte.ts:101`), `assignJob`/`stopJob` (L56/L71), `ActiveJob { pokemonId, jobType, startedAt, lastTickAt }`. Offline catch-up: `applyOfflineProgress()` + `applyOfflineHpRecovery()` (L151/L178), both called from `initApp` in `state.svelte.ts:223`. There is already a `dirtyPokemon` set + `flush()` for batched per-pokemon persistence.
- Idle HP recovery is `IDLE_HP_RESTORE_PER_MINUTE = 0.05` (5%/min), only for pokemon NOT on a job (`jobs.svelte.ts:132`). Mirror its structure.
- Jobs page `src/routes/jobs/+page.svelte`: idle/main pokemon grid, an "active jobs" section with **worker tiles** (tap to go idle via `stopJob`), an assignment `Modal`. Uses `Sprite`, `ProgressBar`, `Modal`, `NatureIcon` components.
- `CapturedPokemon` (`src/lib/game/types.ts:73`): `{ id, speciesId, name, element, maxHp, currentHp, capturedAt, hpBuffs?, damageBuffs?, natures?, corrupted? }`.
- Natures: `PokemonNatures { assigned: [NatureId,NatureId,NatureId]; unlocked: [bool,bool,bool] }`. 15 nature ids in `src/lib/data/natures.ts`.
- DB: `DB_VERSION = 6` in `src/lib/db/index.ts:62`. Pokemon store CRUD in `src/lib/db/pokemon.ts` (`removePokemon(id)` exists). Jobs store CRUD in `src/lib/db/jobs.ts`.

---

## 1. Feature summary

Each working pokemon drains a **purple exhaustion meter** (a reversed/depleting bar). When it empties, a **red rage meter** begins draining; if the rage meter empties while still working, the pokemon **flees** (is deleted from the roster) and the player is notified. Resting (pulling the pokemon off its job to idle) **refills** the meters and can rescue a raging pokemon. The mechanic runs **offline**, so returning players get a popup summarizing any pokemon that fled. Fled pokemon are listed in a new **"Fugiram"** section. When a pokemon enters rage, a **negative memory** is recorded on it.

**Decided design choices (do not revisit):**
- Capacity (work time before exhausted) = `maxHp × jobMultiplier × X`, floored at **6h**.
- `jobMultiplier` is decided by the **first** assigned nature (`natures.assigned[0]`): good ×3, bad ×0.5, neutral ×1.
- **Rage is rescuable by resting** — going idle stops the rage bar and recovers it; fully recovering returns the pokemon to normal.
- **Exhaustion recovers while idle; no job-output penalty** — output stays full until depletion; it's purely a timer.
- A negative memory is written **once**, at the normal→rage transition. This plan defines the minimal shared memory shape (§10).

---

## 2. Nature → job multiplier (`src/lib/game/exhaustion.ts`, pure)

```ts
export type JobTier = 'good' | 'bad' | 'neutral';

// good ×3 | bad ×0.5 | neutral ×1
export const NATURE_JOB_TIER: Record<NatureId, JobTier> = {
  hardy: 'good', lonely: 'good', brave: 'good', adamant: 'good', bold: 'good', serious: 'good',
  naughty: 'bad', docile: 'bad', relaxed: 'bad', lax: 'bad', timid: 'bad', hasty: 'bad',
  quirky: 'neutral', sassy: 'neutral', modest: 'neutral'
};
export const TIER_MULTIPLIER: Record<JobTier, number> = { good: 3, bad: 0.5, neutral: 1 };

// FIRST nature defines the multiplier. No natures => neutral.
export function jobMultiplier(p: CapturedPokemon): number {
  const first = p.natures?.assigned[0];
  return first ? TIER_MULTIPLIER[NATURE_JOB_TIER[first]] : 1;
}
```
(6 good + 6 bad + 3 neutral = all 15 natures.) Multiplier uses `assigned[0]` regardless of `unlocked` state.

---

## 3. Capacity & the `X` constant

```ts
export const EXHAUSTION_MIN_CAPACITY_MS = 6 * 60 * 60 * 1000;   // 6h floor
export const EXHAUSTION_X = /* see calibration */ ;             // ms of work per HP per multiplier-unit
export const RECOVERY_HOURS = 4;                               // full idle refill time (tunable)

export function capacityMs(p: CapturedPokemon): number {
  const raw = p.maxHp * jobMultiplier(p) * EXHAUSTION_X;
  return Math.max(EXHAUSTION_MIN_CAPACITY_MS, raw);
}
```

**Calibrating `X` (phase-1 task):** the target is that a *neutral-nature* pokemon at the *median species HP* lasts ~**8h**. In phase 1, compute the median `maxHp` across the species pool (or the actual roster), then set `EXHAUSTION_X = (8h in ms) / medianHp`. Consequences with that value: good natures → ~24h, neutral → ~8h, bad → ~4h (floored up to the 6h minimum). These are the playtest knobs — `X` and `RECOVERY_HOURS` are expected to be tuned. Keep them named constants in one place.

---

## 4. Work state & step function (`src/lib/game/exhaustion.ts`, pure + tested)

Per-pokemon work state, persisted on the pokemon:
```ts
export type WorkPhase = 'normal' | 'rage';
export interface WorkState {
  exhaustionRemainingMs: number;  // 0..capacity; drains while working
  phase: WorkPhase;
  rageRemainingMs: number;        // 0..capacity; only meaningful in 'rage'
}
export function freshWorkState(p: CapturedPokemon): WorkState {
  const cap = capacityMs(p);
  return { exhaustionRemainingMs: cap, phase: 'normal', rageRemainingMs: cap };
}
```

One step function handles BOTH the 1s real-time tick and the big-`elapsedMs` offline catch-up (it cascades phases within a single call):
```ts
export interface StepResult { next: WorkState; enteredRage: boolean; fled: boolean; }

export function stepWork(
  w: WorkState, capacity: number, elapsedMs: number, onJob: boolean
): StepResult;
```
Logic:
- Clamp `w.exhaustionRemainingMs` and `w.rageRemainingMs` to `[0, capacity]` (capacity can change if `maxHp` changes).
- **On job:**
  - `normal`: subtract `elapsedMs` from `exhaustionRemainingMs`. If it crosses ≤0, set it to 0, `phase='rage'`, `enteredRage=true`, carry the overflow into the rage bar: `rageRemainingMs = capacity − overflow`. Then continue: if `rageRemainingMs ≤ 0` → `fled=true`.
  - `rage`: subtract `elapsedMs` from `rageRemainingMs`; if ≤0 → `fled=true`.
- **Idle (off job):** recover at `recoveryPerMs = capacity / (RECOVERY_HOURS·3600·1000)`.
  - `normal`: `exhaustionRemainingMs = min(capacity, +elapsedMs·rate)`.
  - `rage`: refill `rageRemainingMs`; if it reaches `capacity`, set `phase='normal'` and `exhaustionRemainingMs = capacity` (fully rescued + rested).

**Spec (`src/lib/game/__tests__/exhaustion.spec.ts`):** multiplier tiers per nature; capacity floor; neutral@medianHP ≈ 8h with the chosen `X`; `stepWork` depletes only while on job; normal→rage transition flips phase + sets `enteredRage` exactly once; overflow carry; `fled` when rage empties; idle recovery refills and a full rage refill returns to `normal`; a single large-`elapsedMs` offline step can cascade normal→rage→fled.

---

## 5. Tick & offline integration (`src/lib/game/jobs.svelte.ts`)

Add a `work` field to each pokemon (lazily backfilled, like natures):
```ts
// CapturedPokemon (types.ts):
work?: WorkState;
```
`ensureWorkState(p)` initializes it via `freshWorkState(p)` when missing (call during `initApp`, alongside the existing HP/nature backfills in `state.svelte.ts:197-215`).

- **Real-time tick** (`tick()` ~L101): for every pokemon, call `stepWork(p.work, capacityMs(p), 1000, onJob)` where `onJob = !!jobForPokemon(p.id)`. Apply `next`, add to `dirtyPokemon`. If `enteredRage` → `recordExhaustionMemory(p)` (§8) + a pt-BR toast. If `fled` → `handleFlee(p)` (§7).
- **Offline catch-up:** add `applyOfflineExhaustion()` mirroring `applyOfflineHpRecovery()` (`jobs.svelte.ts:151`). Use `lastSeenAt`/`lastTickAt` to compute `elapsedMs` (no 8h cap here — exhaustion must resolve over long absences; or cap consistently with offline-progress policy — pick one and document). For each pokemon: one `stepWork` call with the full elapsed. Collect every `fled` pokemon into a list and return it so the UI can show the return popup (§7). Call it from `initApp` after `applyOfflineProgress()`.

> Exhaustion only accrues while a pokemon is on a job. The active/battling pokemon does not drain exhaustion from battling.

---

## 6. UI — jobs page (`src/routes/jobs/+page.svelte`)

**Consult the `design-pokengu` skill before adding bars/colors/icons/animations.**

### 6a. Meters on working pokemon
Under each **worker tile** (and optionally in the assignment `Modal`), render a thin **reversed/depleting** bar:
- **Phase `normal`:** purple bar, `width = exhaustionRemainingMs / capacity · 100%`. Drains toward 0. (Spec said "blue"; the help modal calls it the *purple* bar — use a cool blue→purple hue and keep it consistent with the legend.)
- **Phase `rage`:** red bar, `width = rageRemainingMs / capacity · 100%`. A pulse/urgent animation. Worker tile reads as "about to flee."
- Use a `requestAnimationFrame` smoothing pass like the existing production-bar loop (`jobs.svelte.ts:30-46`) so depletion animates between ticks.

### 6b. Help button + legend modal
A small "?" button near the meters opens a `Modal` (component already used on this page) explaining, in pt-BR, the two states with their emoji/colors:
- 😴 **purple** = cansaço (exhaustion): tempo restante de trabalho; descansar recupera.
- 😡 **red** = fúria (rage): se esvaziar, o Pokémon foge. Tire-o do trabalho para acalmá-lo.

### 6c. "Fugiram" section
A new section on the jobs page listing fled pokemon (from the `fled` store, §7), each showing sprite + name + when it fled, and a **"Remover"** button that purges that tombstone (`removeFled(id)`). Empty section is hidden.

---

## 7. Fleeing & the return popup

When a pokemon flees (rage empties while working):
1. `handleFlee(p)`: write a tombstone to a new `fled` IDB store, then `stopJob(p.id)` + `removeFromRosterMemory(p.id)` + `removePokemon(p.id)`. If it was the active pokemon, `setActivePokemon(null)`.
2. Tombstone shape (new store `fled`, key = id):
```ts
export interface FledPokemon { id: string; name: string; speciesId: number; element: Element; fledAt: number; }
```
DB adapter `src/lib/db/fled.ts`: `addFled`, `getAllFled`, `removeFled`.

**Return popup** (`src/lib/components/FledModal.svelte`, mounted in `src/routes/+layout.svelte`): after `applyOfflineExhaustion()` returns its fled list (non-empty), show **one** modal:
- 1 pokemon: "{Nome} cansou de esperar e fugiu."
- N pokemon: "{N} Pokémon foram exauridos e fugiram." + the list of sprites/names.
- A single dismiss button. (The persistent record stays in the "Fugiram" section until the player removes it there.)

---

## 8. Negative memory at normal→rage (minimal shared memory shape)

This plan introduces the **minimal** memory primitive that the relationship feature later extends. Add to `types.ts`:
```ts
export type Sentiment = 'good' | 'neutral' | 'bad';
export type RelationshipTrigger = 'victory' | 'defeat' | 'idle' | 'newDay' | 'exhausted';

export interface PokemonMemory {
  at: number;
  trigger: RelationshipTrigger;
  playerMessage: string;   // '' for system-generated memories like exhaustion
  emoji: string;           // e.g. '😡'
  sentiment: Sentiment;
}
export interface PokemonRelationship {
  points: number;          // 0 here; used by the relationship feature
  memories: PokemonMemory[];
  lastEventAt: number;     // 0 here; used by the relationship feature
}
// CapturedPokemon:
relationship?: PokemonRelationship;
```
Helper `src/lib/game/memory.ts` (pure-ish; no network):
```ts
export function ensureRelationship(p: CapturedPokemon): boolean;   // inits {points:0, memories:[], lastEventAt:0}
export function pushMemory(p: CapturedPokemon, m: PokemonMemory): void;  // appends to p.relationship.memories
```
`recordExhaustionMemory(p)` (in `jobs.svelte.ts`) calls `ensureRelationship(p)` + `pushMemory(p, { at: now(), trigger: 'exhausted', playerMessage: '', emoji: '😡', sentiment: 'bad' })`, then persists. Written **once** per rage entry (guarded by the `enteredRage` flag from `stepWork`).

---

## 9. Persistence / migration

- Bump `DB_VERSION` 6 → 7 in `src/lib/db/index.ts`. Add the `fled` object store in `upgrade()` (`if (!db.objectStoreNames.contains('fled')) db.createObjectStore('fled')`). Declare `fled` in the `PokenguDB` schema interface.
- `work`, `relationship` are optional fields lazily backfilled (`ensureWorkState` / `ensureRelationship` in `initApp`) — no destructive migration. Mirror `ensurePokemonNatures` at `state.svelte.ts:209-215`.

---

## 10. Cross-plan coordination with the relationship feature

- **Shared types live here now.** `Sentiment`, `RelationshipTrigger` (including `'exhausted'`), `PokemonMemory`, `PokemonRelationship`, `relationship?` on `CapturedPokemon`, and `ensureRelationship`/`pushMemory` are introduced by THIS plan. The relationship plan must **not** redefine them — it consumes them (and uses `points`/`lastEventAt`, which exhaustion leaves at 0).
- **DB version:** this plan takes `DB_VERSION = 7` (adds the `fled` store). The relationship feature adds only optional fields → it needs **no further version bump** (delete the "bump 6→7" step from `relationship-feature-plan.md §8` once this ships, or make it a no-op).
- **The "take a rest" answer hook** in the relationship plan (`restFromJob` → `stopJob`) becomes a true rescue once this ships: pulling a raging pokemon off its job now recovers the rage meter. No extra wiring needed beyond `stopJob`, which already exists.
- The relationship plan's `idle_calling_for_help` event currently gates on `isOnJob`; after this ships it can additionally gate on exhaustion phase/threshold (a one-line `condition` change).

---

## 11. Phasing & acceptance

1. **Pure `exhaustion.ts` (`jobMultiplier`, `capacityMs`, `stepWork`) + spec + calibrate `X`.** Gate: `yarn test` green, `yarn run check` 0 errors.
2. **Shared memory types + `memory.ts` + `work` field + backfills.** Gate: types compile; `ensure*` idempotent.
3. **Tick + offline integration.** Gate: meters drain while working, recover while idle; rage entry writes the negative memory once; offline catch-up resolves correctly (incl. cascade to flee). 
4. **`fled` store + flee handling + jobs-page meters + help legend + "Fugiram" section + return popup.** Gate: a pokemon that hits rage-empty is removed, tomb-stoned, surfaced in the section and the return modal; "Remover" purges it; bars render and animate (per `design-pokengu`).

**Definition of done:** `yarn run check` = 0 errors, `yarn test` = 100% green, all UI strings pt-BR, no `$state` proxy written to IDB, exhaustion drains only while on a job and recovers while idle, rage is rescuable by resting, fleeing works offline with a single summary popup, fled pokemon appear in "Fugiram" with a remove action, and a negative memory is recorded exactly once at the normal→rage transition.

---

## 12. Open variables to playtest

`EXHAUSTION_X` (work-time scaling), `RECOVERY_HOURS` (idle refill speed), the 6h floor, and whether offline elapsed should be capped. Starting values are defensible; tune against real play.
