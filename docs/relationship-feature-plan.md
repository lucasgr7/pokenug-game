# Implementation Plan: Pokémon Relationship Mechanic

> Self-contained spec for an agent starting cold. Includes codebase conventions, exact anchor points, the decided design, concrete balance numbers, and acceptance criteria.

## 0. Context for the implementing agent (read first)

**Project:** Pokengu — browser-based offline-first Pokémon card-battler + idle game. SvelteKit 5 SPA, Svelte 5 Runes (force-enabled, use `$state`/`$derived`/`$effect` freely in `src/`), Tailwind v4, all state in IndexedDB via `idb`. **UI language is Portuguese (pt-BR)** — all user-facing strings must be pt-BR.

**Non-negotiable conventions:**
- **Pure/side-effect split:** game rules go in plain `.ts` (unit-testable), side effects (state store, IDB, network) go in `.svelte.ts`. Mirror `combat.ts` (pure) vs `battle.svelte.ts` (wrapper).
- **IDB proxy clone bug:** NEVER `put()` a Svelte `$state` proxy into IndexedDB. Always snapshot: `$state.snapshot(obj)`. Every existing DB write does this.
- **Status imports:** only import status exports through the barrel `$lib/game/status` — never from `./registry`.
- **Tests are a CI gate:** `yarn run check` must report 0 errors and `yarn test` must be 100% green before the work is considered done. (Use `yarn run check`, not `yarn check`.) New pure logic requires a Vitest spec under a `__tests__` dir.
- **Persistence pattern:** mutate the global `game` store directly, then call `schedulePersist()` (debounced player write) or `addPokemon($state.snapshot(p))` (per-pokemon write).
- Node 20+ required.

**Critical existing fact:** Natures already exist (`src/lib/data/natures.ts`, `PokemonNatures` in `src/lib/game/types.ts:68`). Every captured pokemon has 3 `assigned` natures and an `unlocked: [false,false,false]` flag array. **Nothing currently flips those flags to `true`.** The combat buffs for unlocked natures are already wired at `src/lib/game/battle.svelte.ts:132-143` (`applyNatureStatuses` reads `natures.unlocked[i]`). This feature is the missing unlock driver — do **not** rebuild the nature combat effects.

---

## 1. Feature summary

Pokémon raise events asking the player to communicate with them, triggered by gameplay (victory, defeat, idle, new day). Each event offers 3 pre-classified canned answers (good/neutral/bad) plus a free-text input (≤50 chars) that is sent to a hosted Ollama LLM, which returns a single emoji. The emoji is classified into a sentiment, which adjusts that pokemon's `relationship.points`. Crossing point thresholds unlocks the 3 natures (granting existing combat buffs) and increases max HP. Memories of interactions are stored per-pokemon (last 3 sent to the LLM as context). Canned answers may carry **side-effect hooks** (e.g. "take a rest" pulls the pokemon off its job into idle).

**Decided design choices (do not revisit):**
- Ollama = **hosted proxy** at `/ollama/api/generate` (Nginx in prod; Vite proxy in dev). Free-text degrades gracefully to a deterministic fallback when unreachable.
- **No "job completed" trigger** — jobs are continuous idle producers, so that trigger is dropped.
- Relationship points unlock **both** the 3 natures **and** increase max HP.
- Memory system and work-exhaustion system: **define the data fields/registry hooks now, defer the numeric logic.**

### 1.1 Interaction & presentation rules (hard requirements)

- **Never interrupt battle.** Events may still be *created* while the player is in a battle, but they must never steal focus or block input. They surface only as the passive corner indicator below.
- **Bottom-left corner indicator.** Pending events appear as small floating badges in the bottom-left corner, each showing the pokemon's sprite and a countdown ring. They stack; they do not cover the play area or capture battle input.
- **5-minute timer to react.** Each event lives for `ALERT_TIMER_MS = 5 minutes`. On expiry it auto-resolves as **neutral** and the badge disappears.
- **Max 3 concurrent events** (`MAX_ACTIVE_EVENTS = 3`). While at the cap, new rolls are dropped (not queued past 3). Example: during a 5-minute battle, 3 different pokemon can each raise a "calling for help" event; all 3 sit in the corner and the player handles them after/around the fight.
- **Clicking a badge opens a dedicated pokemon page** (a route, not a battle overlay) where the situation is narrated using `src/lib/components/battle/SpeechBubble.svelte`, with the 3 canned answers + free-text input.

---

## 2. Data model

> **If the exhaustion feature (`docs/exhaustion-feature-plan.md`) shipped first**, then `Sentiment`, `RelationshipTrigger`, `PokemonMemory`, `PokemonRelationship`, the `relationship?` field, and `ensureRelationship`/`pushMemory` **already exist** — do not redefine them. This feature then only *uses* `points`/`lastEventAt`/`memories`. The block below is the definition of record for whichever plan lands first.

Add to `src/lib/game/types.ts`:

```ts
export type Sentiment = 'good' | 'neutral' | 'bad';

export type RelationshipTrigger = 'victory' | 'defeat' | 'idle' | 'newDay' | 'exhausted';

export interface PokemonMemory {
  at: number;                  // epoch ms
  trigger: RelationshipTrigger;
  playerMessage: string;       // canned answer text OR free input (≤50 chars)
  emoji: string;
  sentiment: Sentiment;
}

export interface PokemonRelationship {
  points: number;              // ≥ 0
  memories: PokemonMemory[];   // append-only; only last 3 sent to Ollama
  lastEventAt: number;         // cooldown guard
}
```

Extend `CapturedPokemon`:
```ts
relationship?: PokemonRelationship;  // lazily backfilled, like natures
exhaustion?: number;                 // META-DESIGN ONLY this phase; reserved, not yet wired
baseMaxHp?: number;                  // PokeAPI base, see §3.1
```

A runtime event object (lives in the `.svelte.ts` store, not persisted long-term):
```ts
export interface RelationshipEvent {
  id: string;
  pokemonId: string;
  defId: string;               // which EventDefinition produced this (see §5b)
  trigger: RelationshipTrigger;
  promptPt: string;            // resolved pt-BR narration shown via SpeechBubble
  answers: ResolvedAnswer[];   // 3 canned, pt-BR, with optional hook ids
  createdAt: number;
  expiresAt: number;           // createdAt + ALERT_TIMER_MS
}

// An answer as shown to the player; hookId references a side-effect in the registry.
export interface ResolvedAnswer {
  text: string;                // pt-BR
  sentiment: Sentiment;
  hookId?: string;             // e.g. 'restFromJob' — resolved at apply time
}
```

---

## 3. Pure engine — `src/lib/game/relationship.ts` (new, unit-tested)

No Svelte, no IDB, no network. Exports:

```ts
// --- balance constants (tune here) ---
export const SENTIMENT_DELTA: Record<Sentiment, number> = { good: 10, neutral: 3, bad: -6 };
export const UNLOCK_THRESHOLDS = [30, 80, 150] as const;  // T1, T2, T3
export const HP_PER_UNLOCK = 15;
export const ALERT_TIMER_MS = 5 * 60_000;                 // 5 minutes to react; expiry => neutral
export const MAX_ACTIVE_EVENTS = 3;                       // hard cap; drop new rolls while at cap
export const EVENT_COOLDOWN_MS = 10 * 60_000;             // min gap between events per pokemon
export const MAX_INPUT_CHARS = 50;
export const MEMORIES_SENT_TO_LLM = 3;

export const EVENT_CHANCE: Record<RelationshipTrigger, number> = {
  victory: 0.40, defeat: 0.60, idle: 0.30, newDay: 0.70
};

// emoji → sentiment lookup
export function classifyEmoji(emoji: string): Sentiment;
// offline fallback: pt-BR keyword scan → sentiment (default neutral)
export function keywordFallback(message: string): Sentiment;

// roll whether an event fires (uses an injected rng for testability)
export function shouldRollEvent(
  trigger: RelationshipTrigger, lastEventAt: number, nowMs: number, rng?: () => number
): boolean;

// apply a resolved interaction: returns new points + which nature indices newly unlocked
export function applyRelationshipDelta(
  rel: PokemonRelationship, sentiment: Sentiment
): { points: number; newlyUnlocked: number[] };

// flips natures.unlocked flags + returns hp delta to add to hpBuffs
export function resolveUnlocks(
  pokemon: CapturedPokemon, points: number
): { hpGained: number };

// recompute maxHp from base + hpBuffs (see §3.1)
export function recomputeMaxHp(pokemon: CapturedPokemon): void;
```

**§3.1 maxHp handling:** `maxHp` is currently stored flat (PokeAPI base stat) and `hpBuffs` exists but is unused. The agent must:
1. Confirm there is no existing place that mutates `maxHp` from buffs (grep `hpBuffs`, `damageBuffs`).
2. Store the PokeAPI base separately (add `baseMaxHp?: number`, backfilled to current `maxHp` on migration). `recomputeMaxHp` sets `maxHp = baseMaxHp + (hpBuffs ?? 0)` and clamps `currentHp ≤ maxHp`.

**§3.2 Threshold/HP idempotency:** `resolveUnlocks` must be safe to call repeatedly — only grant HP for indices that flip from `false`→`true` this call. Count of `true` flags must match count of crossed thresholds.

**Spec file** (`src/lib/game/__tests__/relationship.spec.ts`): cover `classifyEmoji` for good/neutral/bad/unknown emojis; `keywordFallback`; delta math floored at 0; threshold crossing flips exactly the right flags and grants `HP_PER_UNLOCK` each (idempotent on re-call); `shouldRollEvent` respects cooldown and uses injected rng deterministically.

---

## 4. Ollama client — `src/lib/api/ollama.ts` (new)

Use the provided pattern verbatim:

```ts
const OLLAMA_ENDPOINT = '/ollama/api/generate';
const OLLAMA_MODEL = 'llama3.1:8b-instruct-q5_K_M';
export const DEFAULT_ITEM_EMOJI = '❓';

async function ollamaGenerate(prompt: string, timeoutMs: number, opts: { temperature?: number } = {}): Promise<string> {
  const res = await fetch(OLLAMA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: { temperature: opts.temperature ?? 0.4 } }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await res.json();
  return (data.response as string | undefined)?.trim() ?? '';
}

export async function classifyMessage(
  memories: PokemonMemory[], userMessage: string, pokemon: CapturedPokemon
): Promise<{ emoji: string; sentiment: Sentiment }> {
  try {
    const prompt = buildPrompt(memories.slice(-MEMORIES_SENT_TO_LLM), userMessage, pokemon);
    const raw = await ollamaGenerate(prompt, 8000, { temperature: 0.4 });
    const emoji = firstEmoji(raw) ?? DEFAULT_ITEM_EMOJI;   // extract first emoji grapheme
    return { emoji, sentiment: classifyEmoji(emoji) };
  } catch {
    return { emoji: '😐', sentiment: keywordFallback(userMessage) };
  }
}
```

**Nginx proxy (prod, already configured):**
```
location /ollama/ {
    proxy_pass http://192.168.100.81:11434/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

**Prompt design (`buildPrompt`)**: pt-BR system framing. Instruct the model: *"You are {pokemon.name}, a {element} Pokémon. Based on your recent memories and the trainer's message, respond with EXACTLY ONE emoji representing your emotional reaction and NOTHING else."* Include the last 3 memories as `trainer said "X" → you felt {emoji}` lines, then the new message. Keep it short. `firstEmoji` must robustly extract one emoji (use `Intl.Segmenter` or a unicode emoji regex; strip any words the model leaks).

**Dev proxy** — add to `vite.config.ts`:
```ts
server: { proxy: { '/ollama': { target: 'http://192.168.100.81:11434', rewrite: p => p.replace(/^\/ollama/, ''), changeOrigin: true } } }
```
The `try/catch` guarantees the loop is fully playable when the endpoint is unreachable — keep that invariant.

---

## 5. Event store + side effects — `src/lib/game/relationship.svelte.ts` (new)

Owns the runtime list of pending events and all impure work:

```ts
// up to MAX_ACTIVE_EVENTS live at once; rendered as corner badges
export const relationshipState = $state<{ events: RelationshipEvent[] }>({ events: [] });

// called from the trigger sites (§6). Picks an eligible EventDefinition, resolves it
// against the pokemon, and pushes a RelationshipEvent — IF not at cap and cooldown ok.
export function maybeRollEvent(trigger: RelationshipTrigger, pokemon: CapturedPokemon): void;

// player picks a canned answer (no network). Runs the answer's hook (§5b) then applies sentiment.
export async function resolveWithCanned(eventId: string, answerIndex: number): Promise<void>;

// player submits free text (≤50 chars) → Ollama
export async function resolveWithFreeText(eventId: string, text: string): Promise<void>;

// timer expiry → auto-resolve as neutral (no hook runs)
export async function expireEvent(eventId: string): Promise<void>;
```

**Cap & non-interruption rules (enforce in `maybeRollEvent`):**
- If `relationshipState.events.length >= MAX_ACTIVE_EVENTS` → **drop** the roll (do nothing).
- If an event for this `pokemonId` is already pending → drop (one event per pokemon at a time).
- If `now - pokemon.relationship.lastEventAt < EVENT_COOLDOWN_MS` → drop.
- Rolling/creating an event during a battle is allowed; it only ever adds a corner badge. **Never** mutate battle state or focus.

**A timer loop** (a `setInterval` in this module, or reuse the jobs ticker) checks `expiresAt` each second and calls `expireEvent` for any past-due event so badges self-clear even if the player ignores them.

Resolution flow (shared by canned/free/expire):
1. If a canned answer with `hookId`, run the hook via the action API (§5b) — e.g. move pokemon to idle.
2. Build `PokemonMemory`, push to `pokemon.relationship.memories` (keep full history; only last 3 are sent to the LLM).
3. `applyRelationshipDelta` + `resolveUnlocks` + `recomputeMaxHp`.
4. Set `lastEventAt = now`, remove the event from `relationshipState.events`.
5. Persist via `addPokemon($state.snapshot(pokemon))`. Show a pt-BR toast on nature unlock / HP gain (`src/lib/stores/toast.svelte.ts`).

Backfill helper (called in `initApp`, mirrors `ensurePokemonNatures`):
```ts
export function ensureRelationship(p: CapturedPokemon): boolean; // inits {points:0, memories:[], lastEventAt:0}
```

---

## 5b. Event definitions — registry meta-design (`src/lib/game/relationship/`)

**Goal: authoring a new event is editing one small, readable data file — no engine changes.** This mirrors the existing status system (`STATUS_REGISTRY` + `defineStatus()` + `definitions/*.ts` + barrel), so follow that pattern, including the **barrel-only import rule** to avoid TDZ crashes.

### Files
```
src/lib/game/relationship/
  registry.ts        # EVENT_REGISTRY + defineEvent() + ANSWER_HOOKS + defineAnswerHook()
  events/
    battle.ts        # victory / defeat events
    idle.ts          # idle "calling for help" events
    daily.ts         # new-day events
    index.ts         # imports every events/*.ts so defineEvent() runs at load
  index.ts           # barrel: re-exports registry + imports ./events/index.ts. IMPORT FROM HERE ONLY.
```

### Definition shape
```ts
export interface EventContext {
  pokemon: CapturedPokemon;
  trigger: RelationshipTrigger;
  isOnJob: boolean;          // jobForPokemon(pokemon.id) != null
  isActive: boolean;         // is the active/battling pokemon
}

export interface EventAnswerDef {
  text: (ctx: EventContext) => string;   // pt-BR (function so it can use the pokemon name)
  sentiment: Sentiment;
  hookId?: string;                        // key into ANSWER_HOOKS
}

export interface EventDefinition {
  id: string;                             // globally unique, snake/kebab
  trigger: RelationshipTrigger;
  weight?: number;                        // relative pick weight among eligible defs (default 1)
  chance?: number;                        // optional per-def override of EVENT_CHANCE[trigger]
  condition?: (ctx: EventContext) => boolean;   // eligibility filter (default: always)
  prompt: (ctx: EventContext) => string;        // pt-BR narration shown in SpeechBubble
  answers: [EventAnswerDef, EventAnswerDef, EventAnswerDef];  // exactly 3
}

export const EVENT_REGISTRY: EventDefinition[] = [];
export function defineEvent(def: EventDefinition): void { /* push + assert unique id */ }
```

### How current events are triggered (the selection pipeline — keep this in `relationship.ts`, pure & tested)
1. A trigger site calls `maybeRollEvent(trigger, pokemon)`.
2. `shouldRollEvent` rolls against `EVENT_CHANCE[trigger]` (after cap/cooldown checks pass).
3. Build `EventContext` for the pokemon.
4. `eligibleEvents(trigger, ctx)` = registry entries where `def.trigger === trigger && (def.condition?.(ctx) ?? true)`.
5. Weighted-random pick one def (use the injected rng for testability).
6. Resolve it into a `RelationshipEvent`: call `def.prompt(ctx)` and each `answer.text(ctx)`, copy `sentiment`/`hookId`.

This means **adding an event = appending one `defineEvent({...})`** in the relevant `events/*.ts`. Tuning = editing its `weight`/`chance`/`condition`. No other file changes.

### Answer hooks (side-effect mechanism)
Hooks are impure (touch jobs/idle/etc.), so they are **registered separately** and referenced by id from definitions — definitions stay declarative and testable.

```ts
export interface AnswerHookApi {
  pokemon: CapturedPokemon;
  stopJob(pokemonId: string): Promise<void>;   // from jobs.svelte.ts → moves pokemon to idle
  // future: feed(), reduceExhaustion(n), assignJob(), ...
}
export const ANSWER_HOOKS: Record<string, (api: AnswerHookApi) => void | Promise<void>> = {};
export function defineAnswerHook(id: string, fn: (api: AnswerHookApi) => void | Promise<void>): void;
```

`resolveWithCanned` builds the `AnswerHookApi` (injecting `stopJob` etc. — imported lazily to avoid circular deps, as `state.svelte.ts` already does for jobs) and runs `ANSWER_HOOKS[hookId]` before applying sentiment.

### Worked example — the "exhausted worker calls for help" idle event (`events/idle.ts`)
```ts
defineAnswerHook('restFromJob', async ({ pokemon, stopJob }) => {
  await stopJob(pokemon.id);           // pulls it off the job → idle position
});

defineEvent({
  id: 'idle_calling_for_help',
  trigger: 'idle',
  weight: 2,
  condition: (ctx) => ctx.isOnJob,     // only working pokemon "call for help"
  prompt: (ctx) => `${ctx.pokemon.name} parece exausto do trabalho e está te chamando...`,
  answers: [
    { text: () => 'Bom trabalho, vá descansar.', sentiment: 'good',    hookId: 'restFromJob' },
    { text: () => 'Como você está se sentindo?',  sentiment: 'neutral' },
    { text: () => 'Vamos lá, aguenta mais!',       sentiment: 'bad'     }
  ]
});
```
The free-text answer (`<input>`) is always available in the UI in addition to these 3; its sentiment is decided by Ollama (or `keywordFallback`) and it carries no hook.

> **Note on exhaustion:** the *numeric* exhaustion system is deferred (§9). This event uses `isOnJob` as a stand-in condition so it is fully implementable now with the existing job/idle system; when exhaustion lands, change `condition` to gate on an exhaustion threshold — a one-line edit, no engine change.

---

## 6. Trigger wiring

| Trigger | Site | Detail |
|---|---|---|
| `victory` / `defeat` | `battle.svelte.ts` `finalizeBattle()` ~L587/L611 | After settlement branches, call `maybeRollEvent('victory'\|'defeat', activePokemon())`. Defeat sets active pokemon to null — capture the pokemon ref **before** that. Targets the **battler**. |
| `idle` | `jobs.svelte.ts` `tick()` L101 | Once per cooldown window, for each pokemon idle ≥ 2 min OR on a job ≥ 2 min, call `maybeRollEvent('idle', pokemon)`. This is what lets multiple working pokemon "call for help" while the player battles (the cap of 3 limits the pile-up). Respect `EVENT_COOLDOWN_MS` per pokemon. |
| `newDay` | `state.svelte.ts` `doInit()` L187 | Store `lastDayKey` (e.g. `new Date().toISOString().slice(0,10)`) on player. On rollover, roll for the active pokemon (and optionally a few roster pokemon, capped at `MAX_ACTIVE_EVENTS`). Add `lastDayKey?: string` to `Player`. |

Unlike the first draft, events are **not** limited to the active pokemon — idle/new-day events can target any roster pokemon (notably workers). `victory`/`defeat` still target the battler. The `MAX_ACTIVE_EVENTS` cap and per-pokemon cooldown keep volume sane.

---

## 7. UI

**Consult the `design-pokengu` skill before adding any SVG/color/animation.** Mobile-first, max-width 480px shell. Two pieces:

### 7a. Corner indicator — `src/lib/components/RelationshipDock.svelte` (new)

A **non-blocking** floating stack pinned to the **bottom-left corner** (`position: fixed; left; bottom;` clear of the bottom nav). Mounted once in the global shell (`src/routes/+layout.svelte`) so it shows over every screen, **including battle, without capturing input** (`pointer-events` only on the badges themselves; the play area stays interactive).

- Renders up to `MAX_ACTIVE_EVENTS` badges from `relationshipState.events`.
- Each badge = the pokemon **sprite** (load via `src/lib/api/sprites.ts`) + a **countdown ring** computed from `expiresAt` (5-minute window) + a subtle "!" / pulse to read as "wants attention".
- Badges **stack** (vertically). They never auto-open; they never pause battle.
- **Tapping a badge navigates** to the pokemon page (§7b): `goto('/relationship/' + event.pokemonId)` (or `?event=<id>`). It does not resolve the event by itself.
- A badge auto-disappears when its event expires (`expireEvent` already removed it from state).

### 7b. Pokemon conversation page — `src/routes/relationship/[id]/+page.svelte` (new route)

A real route (SPA fallback handles `[id]`; if Vercel/static rewrites need it, add the param like the existing dynamic routes). Layout:

- A scene/portrait area showing the pokemon's sprite.
- The situation is **narrated using `src/lib/components/battle/SpeechBubble.svelte`** — reuse it with `text={event.promptPt}` and `speaker={pokemon.name}`, `isAlly={true}` (the ally/teal variant reads as a friendly pokemon rather than the red M1SS1NGN0 enemy variant). Note: `SpeechBubble` uses `position: absolute`, so wrap it in a `position: relative` container on this page.
- The 3 canned answer buttons (`event.answers`, pt-BR) → `resolveWithCanned(eventId, i)`. If the chosen answer has a `hookId`, the page should reflect the consequence (e.g. a toast "Pikachu voltou a descansar.").
- A free-text `<input maxlength={50}>` + send button → `resolveWithFreeText`; show a spinner while awaiting Ollama; on result, briefly reveal the returned **emoji** (and resulting sentiment) in a closing SpeechBubble before navigating back.
- After any resolution, navigate back (e.g. `history.back()` or to `/`).
- If the page is opened for a pokemon whose event already expired/was resolved, show a gentle empty state and a back link.

---

## 8. Persistence / migration

- **DB version:** if the exhaustion feature already took `DB_VERSION = 7` (it adds a `fled` store), this feature needs **no further bump** — `relationship`, `baseMaxHp` are optional fields requiring no migration. If this ships *first*, bump `DB_VERSION` 6 → 7 instead. Either way: **no store wipe.**
- `relationship`, `baseMaxHp` are optional and lazily backfilled (`ensureRelationship` + base-HP backfill in `doInit`, exactly how `ensurePokemonNatures` works at `state.svelte.ts:209-215`). `ensureRelationship` may already be provided by the exhaustion plan's `src/lib/game/memory.ts`.
- Add `lastDayKey?: string` to `Player` (`types.ts:40`).

---

## 9. Meta-design fields (reserved, NOT wired this phase)

- `PokemonRelationship.memories` shape is forward-compatible; richer memory (decay/weighting/summarization) is future work. Only "append + send last 3" is implemented now.
- `CapturedPokemon.exhaustion?: number` is declared and backfilled to 0 but unused. Future work-exhaustion system will increment it on job ticks and let positive relationship interactions reduce it. Do not wire it now; just don't let `yarn run check` complain about it.

---

## 10. Phasing & acceptance

1. **Types + pure `relationship.ts` (selection pipeline, classifier, deltas, unlocks) + spec.** Gate: `yarn test` green, `yarn run check` 0 errors.
2. **Event registry (`relationship/` dir, `defineEvent`/`defineAnswerHook`, barrel) + a few seed events.** Gate: `eligibleEvents`/weighted pick covered by tests; barrel-only imports (no TDZ).
3. **Store + triggers + corner dock + conversation route, canned answers only.** Gate: events surface as corner badges, never interrupt battle, cap of 3 enforced, 5-min timer auto-resolves neutral, the "take a rest" hook moves the pokemon to idle (`stopJob`), points/natures/HP update and persist across reload. Fully offline.
4. **Ollama free-text + Vite proxy.** Gate: free text returns an emoji online; `try/catch` fallback verified by blocking the endpoint (still resolves via `keywordFallback`).
5. **Polish:** SpeechBubble narration + emoji reveal, unlock toasts, nature reveal, countdown-ring animation (per `design-pokengu`).

**Definition of done:** `yarn run check` = 0 errors, `yarn test` = 100% green, all UI strings pt-BR, no `$state` proxy written to IDB, status/registry imports via barrel only, events never interrupt or block battle, at most 3 concurrent events with a 5-minute react timer, and the whole loop is playable with Ollama unreachable. Adding a new event must require editing only a `relationship/events/*.ts` file.

---

## 11. Open variables to playtest

The balance constants in §3 (deltas, thresholds, HP-per-unlock, timer, cooldown) are defensible defaults so the agent isn't blocked, but they are the main thing to tune during playtest.
