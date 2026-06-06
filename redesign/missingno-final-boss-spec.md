# MissingNo Final Boss — Implementation Spec

## Context

Secret endgame encounter unlocked after all 6 regions are completed. Only accessible in the
first 15 minutes of each real-world hour. A three-act scripted fight that puts the player's
20 strongest Pokémon at stake. Fallen Pokémon are soft-deleted in memory and purged from
IndexedDB only if the fight is lost. Victory restores all party members with a permanent
**Corrompido** nature (cards never exhaust). Lose all 20 and they are gone forever.

## Stack context

- **Svelte 5 Runes** — `$state`, `$derived`, `$effect` (no SSR, no prerender).
- **IndexedDB** via `idb` library. All state is client-side.
- **SvelteKit SPA** — `/battle` route is the battle shell.
- **UI language** — Portuguese (pt-BR).
- **CSS** — Tailwind utility classes + scoped `<style>` blocks.
- **Music** — `src/lib/game/music.svelte.ts` with `playCategory()`, `stopMusic()`, `playResultSfx()`.

---

## Constants (hardcoded, tunable)

In `src/lib/data/missingno.ts`:

| Constant | Value | Meaning |
|---|---|---|
| `MISSINGNO_MAX_HP` | `600` | Boss HP — beatable across ~20 Pokémon |
| `MISSINGNO_ACT1_DAMAGE` | `9999` | Act 1 one-shot on the active Pokémon |
| `MISSINGNO_TURN_DAMAGE` | `18` | Fixed Act 3 per-turn damage |
| `AT_STAKE_COUNT` | `20` | Pokémon put at stake |
| `PICK_COUNT` | `3` | Options shown in the cycle pick popup |
| `ACT2_DEFEAT_HOLD_MS` | `2000` | Defeat screen hold before shatter |
| `ACT2_SILENCE_MS` | `1000` | Full silence before battle music |

Also export:
- `MISSINGNO_REGION` descriptor — `{ id: 'missingno', name: '???', color: '#1a0033', emoji: '👾' }`
- `selectAtStake(roster: CapturedPokemon[]): CapturedPokemon[]` — sort by `maxHp` desc, take 20 (or all if fewer), shuffle

---

## Files to create

### `src/lib/data/missingno.ts`

Constants + `MISSINGNO_REGION` + `selectAtStake()`. Keep region OUT of `REGIONS` array.

### `src/lib/game/missingno.svelte.ts`

Orchestration store + act flow:

```ts
export const mn = $state({
  active: false,
  act: 0,                         // 0 idle, 1 intro/deckwipe/oneshot, 2 defeat-shatter, 3 cycle
  party: [] as CapturedPokemon[], // shuffled top-20, the cycle order
  snapshots: [] as CapturedPokemon[], // pristine copies for restore
  fallen: [] as string[],         // ids soft-deleted this fight
  pickOptions: [] as CapturedPokemon[],
  awaitingPick: false,
  speech: null as null | { speaker: string; text: string; isAlly: boolean; key: number },
});
```

Functions:
- `startMissingNo()` — `selectAtStake()`, snapshot, build `battle.state`, kick Act 1
- `runAct1()` — intro speech → deck-wipe → one-shot KO on current active
- `runAct2()` — defeat screen → hold → shatter → silence → final-boss-battle.mp3 → 5 ally bubbles
- `enterCycle()` / `presentPick()` — populate `pickOptions`, `awaitingPick = true`
- `choosePokemon(id)` — swap fighter, entry speech + boss reaction
- `eliminateActive()` — soft-delete → `presentPick()` or `loseMissingNo()`
- `winMissingNo()` — restore all with `corrupted = true`
- `loseMissingNo()` — purge all fallen from IDB

`speech` consumed by `SpeechBubble.svelte`; bumping `.key` forces typewriter restart.

### `src/lib/components/battle/SpeechBubble.svelte`

Typing effect from style guide §4:
- MissingNo lines: 30ms/char, glitch cursor
- Ally lines: instant text
- Auto-dismiss via `mn.speech = null` after ~5.2s (set timeout in the caller)
- CSS: speech bubble with tail, `.ally` variant
- `key` prop forces remount

### `src/lib/components/battle/MissingNoOverlay.svelte`

Orchestrates act visuals:
- Act 1: speech bubble → deck-wipe fx → one-shot KO animation
- Act 2: defeat screen → shake + clip-path shatter (style guide §6) → speech bubbles
- Act 3: speech bubble → pick popup (3 cards) → deletion pixel-scatter (style guide §5) → next pick
- Victory: glitch explode, "M1SS1NGN0... D3F34T3D"
- Loss: "D4T4 S4LV4... C0RRUPT3D"
- Fog layer + vignette + flicker (style guide §3, §6)
- `.boss-theme` class on `.arena` overriding background to deep-red/near-black

Rendered by `src/routes/battle/+page.svelte` when `mode === 'missingno'`.

### `src/lib/game/status/definitions/corrompido.ts`

```ts
defineStatus({
  id: 'nature_corrompido',
  scope: 'player',
  decay: 'permanent',
  hooks: {
    shouldExhaust: () => false,
    emblem: () => ({
      icon: '☠',
      label: 'Corrompido',
      title: 'Cartas nunca exaurem',
      color: '#ff1a1a',
      bg: '#3a0008',
    }),
  },
});
```

Registered via barrel (see modifications below).

### `src/lib/components/CorruptedBadge.svelte`

Small red/glitch badge shown wherever natures render when `pokemon.corrupted` is true.
Reuses the `☠` icon and `#ff1a1a` color from the status emblem.

---

## Files to modify

### `src/lib/game/types.ts`

```diff
- export type BattleMode = 'normal' | 'boss';
+ export type BattleMode = 'normal' | 'boss' | 'missingno';

  export interface CapturedPokemon {
    // ... existing fields ...
+   corrupted?: boolean;
  }
```

No `DB_VERSION` bump — optional field is backward compatible with IndexedDB.

### `src/lib/game/status/definitions/index.ts`

```diff
  import './natures';
+ import './corrompido';
```

### `src/lib/data/regions.ts`

Extend `getRegion()` to resolve `'missingno'`:

```ts
export function getRegion(id: string): Region | undefined {
  if (id === 'missingno') return MISSINGNO_REGION;
  return REGIONS.find((r) => r.id === id);
}
```

### `src/lib/utils/time.ts`

```ts
export function isMissingNoWindowOpen(ts = Date.now()): boolean {
  return new Date(ts).getMinutes() < 15;
}
```

### `src/routes/+page.svelte`

After the zone-path block, when `allRegionsCompleted() && windowOpen`:
- Render a secret glitch-styled MissingNo card
- `$state` for `windowOpen` with 1s `$effect` interval (pattern from `jobs.svelte.ts`)
- Button → `goto('/battle?region=missingno&mode=missingno')`

`allRegionsCompleted()`: every region in `REGIONS` has `defeats >= requiredDefeats` AND `progress(id).bossLastDefeatedAt > 0`.

### `src/lib/game/battle.svelte.ts`

**New export — `startMissingNoBattle()`:**
- Build `battle.state` like `startBattle` but with:
  - Synthetic enemy `{ id: 'missingno', speciesId: 0, name: 'MissingNo.', element: 'normal', maxHp: MISSINGNO_MAX_HP, currentHp: MISSINGNO_MAX_HP, capturedAt: 0 }`
  - `mode: 'missingno'`
  - No `getRegionScaling`, no PokeAPI fetch
  - Region lookup returns `MISSINGNO_REGION`
  - Do NOT save to `saved battle` store

**In `endTurn()` — guard with `s.mode === 'missingno'`:**
- Force boss intent to `{ kind: 'attack', damage: MISSINGNO_TURN_DAMAGE }` (skip `rollIntent`)
- When player HP hits 0 → do NOT set `s.status = 'defeat'`; call `mn.eliminateActive()` instead

**In `applyNatureStatuses()` — after existing loop:**
```ts
if (s.player.pokemon.corrupted) {
  s.player.statuses.push({ defId: 'nature_corrompido', stacks: 1, data: {} });
}
```

**In `shouldExhaust()` — early return:**
```ts
if (battle.state?.player.pokemon.corrupted) return false;
```

**New export — `swapActiveFighter(pkm: CapturedPokemon)`:**
- Set `s.player.pokemon = { ...pkm }`, `hp` to full
- Reset block/statuses/mana
- Rebuild fresh deck: `shuffle(await getActiveDeck())`
- Clear hand/discard/exhausted
- `applyNatureStatuses()`, `drawCards(HAND_SIZE)`

### `src/lib/game/state.svelte.ts`

New functions:

```ts
export function removeFromRosterMemory(id: string): void {
  const idx = game.roster.findIndex(p => p.id === id);
  if (idx >= 0) game.roster.splice(idx, 1);
  // cancel active job if any
  // (job cancellation logic imported lazily to avoid circular deps)
}

export async function restorePokemon(snapshot: CapturedPokemon): Promise<void> {
  snapshot.corrupted = true;
  game.roster.push(snapshot);
  await addPokemon($state.snapshot(snapshot));
}

export async function purgePokemon(id: string): Promise<void> {
  await removePokemon(id); // already exists in db/pokemon.ts
}
```

### `src/lib/game/music.svelte.ts`

```ts
export function playMissingNoIntro(): void {
  // Single-play intro track (not looped)
  if (typeof Audio === 'undefined') return;
  if (game.player?.musicMuted) return;
  const el = new Audio('/mp3/final-boss-intro.mp3');
  el.volume = 1;
  el.play().catch(() => {});
}

export function playMissingNoBattle(): void {
  // Looped battle track
  const el = ensureAudio();
  if (!el) return;
  currentCategory = 'boss'; // reuse boss category
  el.src = '/mp3/final-boss-battle.mp3';
  el.muted = game.player?.musicMuted ?? false;
  el.currentTime = 0;
  el.play().then(() => startFadeIn()).catch(registerUnlock);
}
```

Also add `delete` SFX helper (one-shot `new Audio(...)`):
```ts
export function playSfx(path: string): void {
  if (typeof Audio === 'undefined') return;
  if (game.player?.musicMuted) return;
  new Audio(path).play().catch(() => {});
}
```

### `src/routes/battle/+page.svelte`

- Import `mn` from `$lib/game/missingno`
- In `onMount`: when `mode === 'missingno'`, call `startMissingNo()` instead of `enterBattle()`
- Render `<MissingNoOverlay>` when `mode === 'missingno'`
- Guard the `$effect` that triggers `finalizeBattle()` — skip when `mode === 'missingno'`:
```ts
$effect(() => {
  const st = battle.state?.status;
  if (st && st !== 'active' && !battle.settled && battle.state?.mode !== 'missingno') {
    stopMusic();
    void finalizeBattle();
  }
});
```

### Jobs / shop — nature surfaces

Add `{#if pokemon.corrupted}` → `<CorruptedBadge />` wherever natures render.
Check `src/lib/components/NatureShopItem.svelte` and any modals that display natures.

---

## Soft-delete / restore lifecycle

| Event | Memory (game.roster) | IndexedDB |
|---|---|---|
| Fight starts | All 20 present | All present |
| Pokémon falls in Act 3 | Splice from roster | Keep record |
| Reload mid-fight | Re-read from IDB → all back | All present (no loss) |
| Victory | Re-add fallen + mark corrupted | Update all with corrupted flag |
| Total loss | Already removed | `purgePokemon(id)` deletes permanently |

---

## Act flow detail

### Act 1 — "Falso Combate"
1. `mn.active = true`, `mn.act = 1`
2. Speech: MissingNo intro lines (typed)
3. Deck-wipe: clear deck/hand/discard with per-card wipe animation + SFX
4. One-shot: `dealToPlayer(MISSINGNO_ACT1_DAMAGE)` on the current active Pokémon
5. Current active HP hits 0 → cosmetic KO (no deletion, no `status='defeat'`)
6. Transition to Act 2

### Act 2 — "Ressurgimento"
1. Show normal defeat screen for `ACT2_DEFEAT_HOLD_MS`
2. Screen shake + clip-path shatter animation
3. Blue speech bubble: "...ainda não acabou."
4. `stopMusic()` → `ACT2_SILENCE_MS` silence
5. `playMissingNoBattle()` (looped)
6. 5 ally speech bubbles (top-5 of party by maxHp, instant text):
   - `<name>: É a minha vez.`
7. Transition to Act 3

### Act 3 — "Ciclo de Sacrifício"
1. `enterCycle()`: pick the next Pokémon in the party to be the active fighter
2. Player plays cards to damage MissingNo (normal battle, `MISSINGNO_TURN_DAMAGE` per turn)
3. When active Pokémon HP hits 0 → `eliminateActive()`:
   a. Pixel-scatter sprite animation
   b. Toast/bubble `"<name> foi corrompido."`
   c. `removeFromRosterMemory(id)` + push to `mn.fallen` + deletion SFX
   d. If `mn.fallen.length === AT_STAKE_COUNT` → `loseMissingNo()`
   e. Else → `presentPick()` (3 random from remaining party)
4. Boss HP 0 → `winMissingNo()`

### Victory
- Glitch-explode boss sprite
- "M1SS1NGN0... D3F34T3D" banner
- Victory SFX
- For every party member (survivors + fallen): `restorePokemon(snap)`
- Return to map

### Total loss
- "D4T4 S4LV4... C0RRUPT3D" banner
- `purgePokemon(id)` for every fallen id
- Return to map
- MissingNo re-appears next hourly window

---

## MissingNo sprite

CSS glitch block — no PokeAPI artwork. A `<div>` with glitch animation in the `.sprite-wrap.enemy-sprite` position (top: 96px, right: 30px per style guide).

```css
.missingno-sprite {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #1a0033, #0a0018, #2a0050, #0a0018);
  border: 2px solid rgba(175, 0, 220, 0.4);
  animation: glitch 0.3s infinite;
  image-rendering: pixelated;
}
@keyframes glitch {
  0% { clip-path: inset(0 0 80% 0); transform: translate(-2px, 2px); }
  10% { clip-path: inset(20% 0 60% 0); transform: translate(2px, -2px); }
  20% { clip-path: inset(40% 0 40% 0); transform: translate(-1px, 1px); }
  30% { clip-path: inset(60% 0 20% 0); transform: translate(1px, -1px); }
  40% { clip-path: inset(80% 0 0 0); transform: translate(-3px, 0); }
  50% { clip-path: inset(0 0 80% 0); transform: translate(3px, 0); }
  60% { clip-path: inset(20% 0 60% 0); transform: translate(-2px, -2px); }
  70% { clip-path: inset(40% 0 40% 0); transform: translate(2px, 2px); }
  80% { clip-path: inset(60% 0 20% 0); transform: translate(-1px, 0); }
  90% { clip-path: inset(80% 0 0 0); transform: translate(1px, 0); }
  100% { clip-path: inset(0 0 80% 0); transform: translate(0); }
}
```

---

## Verification

```bash
yarn check    # 0 errors (CI gate)
yarn build    # succeeds
```

Manual checks via `run-pokengu` skill:
1. Seed save with all regions completed + 20+ Pokémon roster
2. Secret card appears only when `minutes < 15` and all regions done
3. Card vanishes live when window closes
4. Act 1: deck/hand → 0, one-shot KO, intro audio
5. Act 2: defeat screen holds 2s → shatter → silence → battle music → 5 ally bubbles
6. Act 3: pick 3, play cards, fallen Pokémon disappears from roster/jobs/shop instantly
7. Reload mid-fight → all party members back (IDB intact)
8. Win → Corrompido badge on all party members, cards never exhaust in battle
9. Total loss → permanent removal persists across reload
10. No regression to normal/boss battles (`mode === 'missingno'` guards are inert)

---

## Style guide reference

CSS variables, speech bubble, fog, vignette, shake, corruption ink, crack/shatter, intent chips, HP bars, turn banners — all from `redesign/final-boss-variant.md`. Only the React JSX is re-expressed as Svelte components.
