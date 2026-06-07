# Pokengu — Implementation Plan (for external AI implementation)

This document describes three independent features to implement in the **Pokengu** codebase
(SvelteKit 5 SPA, Svelte 5 Runes, Tailwind v4, IndexedDB via `idb`, UI language **pt-BR**).

> **Hard rules for whoever implements this**
> - Treat `$state` / `$derived` / `$effect` as available everywhere under `src/` (Runes force-enabled).
> - **Never `put()` a Svelte `$state` proxy into IndexedDB.** Always snapshot first: `$state.snapshot(...)`.
> - The CI gate is `yarn check` (svelte-check). It **must report 0 errors** before the work is considered done. Also run `yarn build`.
> - All user-facing strings are **Portuguese (pt-BR)**.
> - Element colors come from `ELEMENT_COLOR[element]` (`src/lib/game/elements.ts`). Do not hardcode element hex.
> - Card art / rarity colors are intentional game data; reuse existing components, don't reinvent.

---

## Feature 1 — "Pick 1 of 3" card reward after a wild victory

### Current behavior (what exists today)

- When a battle is settled (`settleBattle` in `src/lib/game/battle.svelte.ts`, around lines **1028–1054**),
  a **single** reward card is rolled with `pickVictoryRewardCard(...)` and **immediately added to inventory**:
  ```ts
  let bossCardReward: BossCardReward | null = null;
  if (s.status === 'victory') {
      bossCardReward = pickVictoryRewardCard(s.enemy.pokemon.element, isBossFight);
      if (bossCardReward) {
          await addToInventory({ id: crypto.randomUUID(), templateId: bossCardReward.templateId });
      }
  }
  ...
  battle.reward = { money, elementPoints, captured, unlockedRegionName, cardReward: bossCardReward };
  ```
- `pickVictoryRewardCard(defeatedElement, isBoss)` (lines **475–500**) already implements:
  - 75% chance same element as the defeated Pokémon, 25% a random different element (keep this).
  - Boss: epic/secret only.
  - Wild: rarity bucket via `rollWildRewardBucket()` = 60% common / 30% rare / 10% epicPlus (`epicPlus` currently includes **secret**).
  - Respects `game.player.bannedTemplateIds`.
- Helpers already present: `cardMatchesBossBucket`, `rollWildRewardBucket`, `toCardReward`, `BossRewardBucket` type.
- The reward is rendered by `src/lib/components/BattleResultModal.svelte`. The card block is lines **279–287**
  (`reward.cardReward` → one `<Card>`). The modal is shown from `src/routes/battle/+page.svelte` lines **364–374**,
  and dismissed via `onDismiss={leave}` (the ✕ button, the backdrop click, and the CTA all call `onDismiss`).
- Types live in `src/lib/game/types.ts`:
  - `BossCardReward` (lines **210–215**): `{ templateId, rarity, element, name }`.
  - `BattleReward` (lines **222–228**): includes `cardReward: BossCardReward | null`.
  - `SavedBattle` (lines **230–234**) persists `reward`. Resume restore: `battle.svelte.ts` line **705**.

### Desired behavior

After a **victory** (both wild and boss), instead of auto-granting one card, present **3 distinct card
options** in the result modal. The player taps one to claim it; only the chosen card is added to inventory.

Decisions (already confirmed):
- **Wild rarity:** common (most) + rare (some) + **epic (small chance, ~8%)**, **never secret**.
  Boss keeps epic/secret only.
- **No-pick case:** if the player dismisses the result screen (✕ / backdrop / Continue) **without picking,
  the card is forfeited** (money and element points are still granted; no card is added). No auto-pick.
- The 3 options **must not repeat** (3 distinct `templateId`s).
- Each option independently rolls the 75%/25% element split. Rarity caps per the rule above.

### Implementation steps

#### 1.1 Types (`src/lib/game/types.ts`)

- In `BattleReward`, **add** a field for the choices and **keep** `cardReward` for backward compatibility
  with persisted/saved battles:
  ```ts
  export interface BattleReward {
      money: number;
      elementPoints: { type: Element; amount: number };
      captured: CapturedPokemon | null;
      unlockedRegionName: string | null;
      cardReward: BossCardReward | null;     // legacy/back-compat (the *claimed* card, or null)
      cardChoices: BossCardReward[];          // NEW: up to 3 distinct options to pick from
  }
  ```
- Saved-battle restore must default `cardChoices` to `[]` if missing (see step 1.4).

#### 1.2 Roll 3 distinct options (`src/lib/game/battle.svelte.ts`)

- Add a new function `pickVictoryRewardChoices(defeatedElement: Element, isBoss: boolean, count = 3): BossCardReward[]`
  that returns up to `count` **distinct** (`templateId`) cards. Reuse the existing element-split and banned-card
  logic from `pickVictoryRewardCard`. Algorithm:
  1. Build the eligible pool (respect `bannedTemplateIds`).
  2. Loop up to `count` times; each iteration roll element (75% same / 25% other) and a rarity bucket,
     filter the pool, then `pick` one card **not already chosen**. Skip/retry if the chosen `templateId`
     is a duplicate. Use a `Set<string>` of already-picked `templateId`s.
  3. Apply the same fallback widening that `pickVictoryRewardCard` uses when a pool is empty, but always
     exclude already-picked ids. If fewer than `count` distinct cards exist, return however many were found
     (the modal must handle 1–3 gracefully).
- **Wild rarity change:** introduce a wild epic cap that excludes `secret`. Two clean options:
  - Adjust `rollWildRewardBucket()` so `epicPlus` is hit ~8% (e.g. `roll <= 0.62` common, `<= 0.92` rare,
    else epicPlus), **and** when building the wild pool, filter out `secret` (only `epic` allowed at the top).
    Concretely, in the wild branch use a predicate like
    `(c) => c.rarity !== 'starter' && c.rarity !== 'secret'` combined with the bucket filter, so wild can
    reach `epic` but never `secret`.
  - Keep boss branch unchanged (`epic || secret`).
- Keep `pickVictoryRewardCard` if still referenced elsewhere; otherwise it can be removed once
  `settleBattle` no longer uses it. (Grep for usages before deleting.)

#### 1.3 Defer the inventory grant in `settleBattle` (`src/lib/game/battle.svelte.ts` ~1028–1054)

- Replace the single-roll-and-grant block with **roll-only** (do NOT call `addToInventory` here):
  ```ts
  let cardChoices: BossCardReward[] = [];
  if (s.status === 'victory') {
      cardChoices = pickVictoryRewardChoices(s.enemy.pokemon.element, isBossFight, 3);
  }
  ```
- Set both fields on `battle.reward`:
  ```ts
  battle.reward = {
      money,
      elementPoints: { type: s.enemy.pokemon.element, amount: elementAmount },
      captured,
      unlockedRegionName,
      cardReward: null,        // becomes set when the player claims one (see 1.5)
      cardChoices
  };
  ```
- Make sure the new `battle.reward` is persisted (the existing settle flow already persists the battle/reward;
  confirm `cardChoices` is included in the snapshot that gets written).

#### 1.4 Add a "claim" action (`src/lib/game/battle.svelte.ts`)

- Export a new function that grants the chosen card and records it on the reward:
  ```ts
  export async function claimRewardCard(templateId: string): Promise<void> {
      if (!battle.reward) return;
      if (battle.reward.cardReward) return;                 // already claimed → no double-grant
      const chosen = battle.reward.cardChoices.find((c) => c.templateId === templateId);
      if (!chosen) return;
      await addToInventory({ id: crypto.randomUUID(), templateId: chosen.templateId });
      battle.reward.cardReward = chosen;                    // mark as claimed (idempotent guard above)
      // persist updated reward so a reload can't re-grant
      await persistBattle();   // or whatever the existing persist helper is named
  }
  ```
  - **Idempotency is critical:** the `if (battle.reward.cardReward) return;` guard prevents double-granting
    if the user double-taps or if the component re-mounts. Verify the persist call writes the updated
    `cardReward` so a page reload sees the claim.
- On saved-battle restore (line ~705), default `cardChoices` when absent:
  ```ts
  battle.reward = saved.reward
      ? { ...saved.reward, cardReward: saved.reward.cardReward ?? null, cardChoices: saved.reward.cardChoices ?? [] }
      : null;
  ```

#### 1.5 Modal UI — "pick 1 of 3" (`src/lib/components/BattleResultModal.svelte`)

- Add an `onClaimCard?: (templateId: string) => void` prop and a local `claimedId` state.
- Replace the single card block (lines ~279–287) with a 3-card chooser shown when
  `variant !== 'defeat'` and `reward.cardChoices.length > 0` and nothing claimed yet:
  - Header text (pt-BR): **"Escolha uma carta"**.
  - Render `reward.cardChoices` in a horizontal row of 3 using the existing `<Card templateId={...} compact />`.
    Make each card a button; on tap call `onClaimCard(choice.templateId)` and set `claimedId`.
  - After a card is claimed, collapse the row to show only the chosen card with a "claimed" affirmation
    (pt-BR e.g. **"Carta adicionada ao inventário!"**), matching the existing reward-row visual language.
  - If `cardChoices.length === 0` (rare/no eligible pool), show nothing for the card section.
- Keep money / element-points / region rows exactly as they are.
- **Forfeit-on-dismiss:** do not change `onDismiss`; if the user closes/continues without tapping a card,
  no `onClaimCard` fires, so nothing is granted. (Per decision.) Optionally show a subtle hint near the CTA
  that an unclaimed card will be lost — pt-BR e.g. **"Cartas não escolhidas serão perdidas."** (nice-to-have).
- Follow the existing animation/spacing idiom in this file (`.reward-row`, `.reward-card`, `slideUp`).
  See the **`design-pokengu` skill** before adding any new SVG/animation/color.

#### 1.6 Wire it in the battle page (`src/routes/battle/+page.svelte` ~364–374)

- Import `claimRewardCard` from `$lib/game/battle.svelte`.
- Pass `onClaimCard={(id) => claimRewardCard(id)}` to `<BattleResultModal>`.
- `onDismiss={leave}` stays as-is.

#### 1.7 Edge cases to verify

- Boss victory still presents 3 epic/secret options (not just one).
- Wild victory never shows `secret`; epic appears only occasionally.
- Capture and defeat variants are unaffected (defeat shows no card chooser).
- Resuming a saved battle whose reward predates this change (no `cardChoices`) does not crash.
- Double-tapping a card grants exactly one copy.

---

## Feature 2 — Battle hand controls: "click to use, hold to inspect" (match the deck page)

### Current behavior

- `src/lib/components/BattleHandControls.svelte`:
  - The hand fan wraps each card in a `<div role="button">` (lines ~156–168). A single tap calls
    `handleCardTap` (lines ~52–60), which — **only when `autoConfirm` is on** — plays the card; otherwise it
    opens the inspector (`CardDetailsModal`).
  - There is an **AUTO toggle** (lines ~93–110 markup, ~250–292 styles) controlling that behavior.
  - Relics (lines ~124–144): click plays, right-click (`oncontextmenu`) inspects.
- The **deck page** (`src/routes/deck/+page.svelte`) uses the `<Card>` component's built-in interaction:
  `onclick` = add/remove (use), `onlongpress` = inspect (lines ~189, ~243–251). The hint text reads
  **"Toque para adicionar/remover • Segure para inspecionar."**
- The `<Card>` component (`src/lib/components/Card.svelte` lines ~46–78) already implements a long-press
  timer (300ms) via `onpointerdown`/`onpointerup`, plus `oncontextmenu`, and exposes `onclick` / `onlongpress`
  props. **Important:** the Card root is a `<button disabled={!playable}>`, so when a card is **not playable**
  its built-in handlers won't fire — but we still want unplayable hand cards to be **inspectable**.

### Desired behavior

In the battle hand, **click = use the card immediately** (if playable), **hold (long-press) = inspect**.
Same mental model as the deck page. Remove the AUTO toggle entirely (confirmed decision).

### Implementation steps (`src/lib/components/BattleHandControls.svelte`)

Because unplayable cards must still be inspectable, **implement the long-press timer on the hand-fan wrapper
`<div>`** (don't rely on the disabled `<Card>` button). Mirror the exact logic in `Card.svelte`:

1. Add wrapper-level press handling (module-local to the component):
   ```ts
   let wasLongPress = $state(false);
   let pressTimer: ReturnType<typeof setTimeout> | null = null;

   function handlePointerDown(card: BattleCard) {
       pressTimer = setTimeout(() => {
           wasLongPress = true;
           inspecting = { templateId: card.templateId, cardId: card.id }; // inspect
           pressTimer = null;
       }, 300);
   }
   function handlePointerUp() {
       if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
   }
   function handleHandClick(card: BattleCard) {
       if (wasLongPress) { wasLongPress = false; return; }   // long-press already inspected
       if (ended) return;
       if (canPlay(card)) onPlayCard(card.id, card.templateId);  // click = use
       else inspecting = { templateId: card.templateId, cardId: card.id }; // not playable → inspect
   }
   ```
2. On the fan-card wrapper `<div>` (lines ~156–168), replace the current `onclick`/`onkeydown` with:
   - `onpointerdown={() => handlePointerDown(card)}`
   - `onpointerup={handlePointerUp}`
   - `onpointercancel={handlePointerUp}`
   - `oncontextmenu={(e) => { e.preventDefault(); inspecting = { templateId: card.templateId, cardId: card.id }; }}`
   - `onclick={() => handleHandClick(card)}`
   - `onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleHandClick(card); }}`
   - `aria-label` (pt-BR): **"Jogar carta (segure para inspecionar)"**.
3. **Remove the AUTO toggle:** delete the `autoConfirm` / `onAutoConfirmChange` props, the toggle markup
   (lines ~93–110), the `handleAutoConfirmToggle` function, and the toggle CSS (`.auto-toggle`, `.switch`,
   `.knob`, lines ~250–292). Update `src/routes/battle/+page.svelte` to stop passing `autoConfirm` /
   `onAutoConfirmChange` (lines ~351, ~357), and remove the now-unused `autoConfirm` / `setAutoConfirm`
   state there (grep first — confirm nothing else uses them; if `autoConfirm` is persisted in player settings,
   leave the persistence field but stop reading it in the hand, or remove cleanly).
4. The old `onCardTap` prop becomes unused for the hand. Either remove it from the component's props and from
   the battle page, or leave `onCardTap` wired to `onPlayCard` — prefer **removing** it to keep the API clean.
   Verify no other caller depends on it (grep `onCardTap`).
5. Keep `CardDetailsModal` and the pile-inspect `Modal` exactly as-is; `inspecting` already drives the
   inspector, including the play button when `cardId` is present and `inspectPlayable` is true.
6. Optionally add a one-line hint somewhere in the hand/action bar matching the deck page wording
   (pt-BR): **"Toque para jogar • Segure para inspecionar."**

### Verify

- Playable card: single tap plays it; the card leaves the hand.
- Unplayable card (insufficient mana, not player's turn): single tap opens the inspector (does not error).
- Long-press (300ms) on any card opens the inspector; releasing after a long-press does **not** also play it.
- Right-click still inspects.
- AUTO toggle is gone and the battle page still type-checks (`yarn check` = 0 errors).

---

## Feature 3 — Preload battle music so it starts instantly

### Current behavior (`src/lib/game/music.svelte.ts`)

- A single lazy `HTMLAudioElement` is created on first use (`ensureAudio`, lines ~11–19); `audio.preload`
  is **not** set, and the `src` is assigned **on demand** inside `playCategory` (lines ~71–80). The browser
  only starts fetching/decoding the (multi-MB) file at that moment → audible delay before playback.
- Track files are large: e.g. `static/mp3/battle-1.mp3` ≈ 4.8 MB, `battle-3.mp3` ≈ 4 MB, `boss.mp3` ≈ 8 MB.
- `chooseSrc(cat)` randomly picks from per-category pools:
  - menu: `menu-1.mp3`, `menu-2.mp3`
  - boss: `boss.mp3`, `boss-2.mp3`
  - battle: `battle-1.mp3`, `battle-2.mp3`, `battle-3.mp3`
- Music is started reactively by `src/lib/components/MusicController.svelte` (mounted in `+layout.svelte`):
  it calls `playCategory('battle' | 'boss')` when a battle becomes active, `playCategory('menu')` otherwise.
- Files are same-origin static assets (served from `static/` → `/mp3/...`), so no CORS concerns.

### Desired behavior

When the player is in the menu (and idle), warm up the likely-next tracks so that entering a battle starts
the music with little or no delay. Keep the random-track variety. Don't block the main thread or delay
initial app interactivity.

### Implementation steps (`src/lib/game/music.svelte.ts`)

Implement a small preload cache of `HTMLAudioElement`s keyed by `src`, and have `playCategory` reuse a
preloaded element when available.

1. Add an audio cache + preload helper:
   ```ts
   const ALL_SRCS = {
       menu:  ['/mp3/menu-1.mp3', '/mp3/menu-2.mp3'],
       boss:  ['/mp3/boss.mp3', '/mp3/boss-2.mp3'],
       battle:['/mp3/battle-1.mp3', '/mp3/battle-2.mp3', '/mp3/battle-3.mp3']
   } as const;

   const preloaded = new Map<string, HTMLAudioElement>();

   function warm(src: string): HTMLAudioElement {
       let el = preloaded.get(src);
       if (!el && typeof Audio !== 'undefined') {
           el = new Audio();
           el.preload = 'auto';
           el.src = src;
           el.load();              // begins buffering without playing
           preloaded.set(src, el);
       }
       return el!;
   }

   /** Preload the tracks the player is most likely to hear next. Safe to call repeatedly. */
   export function preloadMusic(cats: MusicCategory[] = ['battle', 'boss']): void {
       if (typeof Audio === 'undefined') return;
       const run = () => { for (const c of cats) for (const s of ALL_SRCS[c]) warm(s); };
       if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(run);
       else setTimeout(run, 0);
   }
   ```
   - Use `requestIdleCallback` (with `setTimeout` fallback) so preloading doesn't compete with first paint.
   - `el.load()` triggers buffering; browsers cache the response so the later real playback is fast.

2. Make `playCategory` reuse warmed buffers. Simplest safe approach: keep the single playback element
   `audio`, but when setting `el.src = chooseSrc(cat)`, the file is already in the browser HTTP cache from
   the preloaded element, so playback starts quickly. **No behavior change needed beyond setting
   `audio.preload = 'auto'` in `ensureAudio`** plus calling `preloadMusic()` at the right time.
   - In `ensureAudio` (line ~13), set `audio.preload = 'auto';` after `audio = new Audio();`.
   - (Optional, stronger) If you want zero-latency swap, refactor playback to *adopt* the preloaded element:
     when `playCategory` runs, pick a src, `const el = warm(src)`, then play that element and treat it as the
     current `audio`. This is more invasive (fade-in, mute, visibility handler, and `stopMusic` all reference
     the single `audio`), so only do this if the HTTP-cache approach proves insufficient. Prefer the simpler
     approach first.

3. Trigger preloading from the menu / app init. Best place: `MusicController.svelte` — when not in an active
   battle and a player exists (i.e. on the menu), call `preloadMusic(['battle', 'boss'])` once.
   ```ts
   // in MusicController.svelte $effect, on the menu branch:
   import { playCategory, stopMusic, preloadMusic } from '$lib/game/music.svelte';
   ...
   } else {
       playCategory('menu');
       preloadMusic(['battle', 'boss']);   // warm next tracks while idling in menu
   }
   ```
   - Guard so it only runs once (a module-level boolean inside `music.svelte.ts`'s `preloadMusic` is fine —
     `warm()` already dedupes via the `Map`, so repeated calls are cheap/no-ops).
   - Do **not** preload while a battle is active (network contention with gameplay assets).

4. (Optional) Also preload the short result SFX (`battle-victory.mp3`, etc.; all < 350 KB) via the same
   `warm()` so the win/defeat sting plays instantly. These are created ad-hoc in `playResultSfx` (lines
   ~113–119) — warming their `src` puts them in the HTTP cache.

### Verify

- From the menu, open DevTools → Network: the battle/boss mp3s should fetch during idle (status 200, then
  served from cache). Entering a battle should start music with negligible delay.
- Muted state still respected (`game.player.musicMuted`); preloading must **not** start playback or unmute.
- No regression to the autoplay-unlock flow (`registerUnlock`) or the visibility-pause handler.
- `yarn check` = 0 errors, `yarn build` succeeds.

---

## Final checklist (all three features)

- [ ] `yarn check` → **0 errors** (CI gate).
- [ ] `yarn build` → succeeds (static SPA build).
- [ ] All new strings are pt-BR.
- [ ] No `$state` proxy is `put()` into IndexedDB without `$state.snapshot(...)`.
- [ ] Wild reward: 3 distinct options, 75/25 element split, common/rare/epic only (no secret); epic rare.
- [ ] Boss reward: 3 distinct options, epic/secret only.
- [ ] Card only granted to inventory on explicit pick; dismiss forfeits; no double-grant.
- [ ] Hand: click=use, hold=inspect, right-click=inspect, unplayable cards still inspectable; AUTO toggle removed.
- [ ] Battle music starts promptly after idling in the menu; mute respected; no battle-time preloading.
