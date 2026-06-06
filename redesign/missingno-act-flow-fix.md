# MissingNo — Act 1 → Act 2 freeze fix (plan for Deepseek)

## Symptom

After MissingNo's Act 1 attack the dialogue bubbles appear, the player clicks through
them, and **the game freezes — nothing else happens.**

## Root cause

The dialogue flow is a **hybrid of a click-driven queue and blind `setTimeout`s**, and
the two fight each other. The freeze is the dead window created by `runAct2()`.

In [src/lib/game/missingno.svelte.ts](src/lib/game/missingno.svelte.ts):

1. **The 5.3 s dead window (the freeze the user sees).** When the last Act 1 click runs
   `runAct2()`, it clears the speech and then waits on
   `setTimeout(advanceSpeech, ACT2_DEFEAT_HOLD_MS)` — and `ACT2_DEFEAT_HOLD_MS` is **5000**
   ([src/lib/data/missingno.ts:9](src/lib/data/missingno.ts#L9)). Its first step only
   *schedules* another `setTimeout(..., 300)` before the `...ainda não acabou` bubble shows.
   So for **~5.3 seconds after Act 1 there is no speech bubble and therefore no
   `.speech-click-area`** — clicks land on nothing and the screen looks frozen. Because the
   user expects click-to-progress, they conclude it is stuck and stop interacting before it
   silently resumes. The flow is non-deterministic and unclickable in every timer gap.

2. **`advanceSpeech` only works while a bubble is on screen.** The click handler lives on
   `.speech-click-area`, which is rendered `{#if mn.speech}`
   ([MissingNoOverlay.svelte:72](src/lib/components/battle/MissingNoOverlay.svelte#L72)).
   Whenever the queue is mid-`setTimeout` (speech cleared, next not shown yet) there is no
   click target, so "click to progress" does nothing.

These two are the reported bug. While fixing them, two **hard dead-ends further along**
must be fixed in the same pass or the player gets stuck again immediately:

3. **Victory is a dead-end — `winMissingNo()` is never called.** Confirmed: it is defined at
   [missingno.svelte.ts:205](src/lib/game/missingno.svelte.ts#L205) but has **no caller**.
   When the player drops MissingNo to 0 HP, `playCard`/`endTurn` set `s.status = 'victory'`
   directly ([battle.svelte.ts:816,846,903](src/lib/game/battle.svelte.ts#L816)). But the
   battle page's finalize `$effect` **skips missingno** ([battle/+page.svelte:113](src/routes/battle/+page.svelte#L113)),
   and the overlay's victory screen only renders when `status === 'victory' && !mn.active`
   ([MissingNoOverlay.svelte:115](src/lib/components/battle/MissingNoOverlay.svelte#L115)) —
   `mn.active` is never set false, so the win screen never shows and Pokémon are never restored.

4. **Replay is broken — `resetMissingNoOneShotFlag()` is never called.** Confirmed: defined at
   [battle.svelte.ts:89](src/lib/game/battle.svelte.ts#L89), no caller. `missingNoOneShotDone`
   stays `true` after the first encounter, so a second MissingNo run **skips Act 1 entirely**
   and routes the first KO straight to elimination.

## Fix — replace the speech logic with one click-driven queue

Rework the dialogue system in `missingno.svelte.ts` so **every** step is a "beat" in a
single ordered queue, advanced by one `advance()` function. **Delete all `setTimeout`-based
advancing.** Side effects (deck wipe, shatter trigger, music swap, `enterCycle`,
`presentPick`) become *action beats* in the same queue so they chain deterministically to
the next clickable line — no blind gaps.

```ts
type Beat =
  | { kind: 'speech'; text: string; speaker: string; isAlly: boolean }
  | { kind: 'action'; run: () => void };   // side effect, auto-chains to next beat

let beats: Beat[] = [];

export function advance(): void {
  // pop until we land on a speech beat (actions run + auto-continue)
  while (beats.length) {
    const b = beats.shift()!;
    if (b.kind === 'action') { b.run(); continue; }
    mn.speech = { text: b.text, speaker: b.speaker, isAlly: b.isAlly, key: ++speechKey };
    return;                                  // wait for the next click
  }
  mn.speech = null;                          // queue drained
}

function queue(newBeats: Beat[]): void { beats = newBeats; advance(); }
```

- The overlay click area keeps calling `advance` (rename the import from `advanceSpeech`).
- Optional polish: if the current line is still typing, the first click can complete the
  text instead of skipping to the next beat. Not required for the fix.

### Act 1 — make it a scripted cutscene, queued on start

Trigger Act 1 from `startMissingNo()` right after `startMissingNoBattle(...)` resolves —
**not** from the `endTurn` one-shot. Disable the hand controls while scripted (e.g. gate
`BattleHandControls` on `!(mn.active && mn.act < 3)` in
[battle/+page.svelte](src/routes/battle/+page.svelte)). Then remove the
`onMissingNoFirstTurn` hook and its early-return block in `endTurn`
([battle.svelte.ts:936-942](src/lib/game/battle.svelte.ts#L936)); the active-Pokémon KO
becomes a cosmetic action beat (set `s.player.hp = 0`, bump `battle.playerHurt` for the
shake). Order per the spec: intro lines → deck wipe → KO → `J4 4C4B0U?` → start Act 2.

```ts
mn.act = 1;
queue([
  speech('V0CÊ 0US0U V1R 4TÉ 4QU1?'),
  speech('S3U D3ST1N0 É S3R 4P4G4D0.'),
  action(() => { playSfx('/mp3/card-sweep.mp3'); wipeDeck(); }),
  speech('S3US D4D0S F0R4M 4P4G4D0S.'),
  action(() => { battle.state!.player.hp = 0; battle.playerHurt++; }),
  speech('J4 4C4B0U?'),
  action(runAct2),
]);
```

### Act 2 — queue it, no timers

```ts
function runAct2() {
  mn.act = 2;                       // overlay $effect plays the shatter animation
  const allies = mn.party.slice(0, 5);
  queue([
    speech('...4IND4 NÃO 4C4B0U.', { speaker: '', isAlly: false }),
    action(() => stopMusic()),
    ...allies.map(a => speech(`${a.name}: É a minha vez.`, { speaker: a.name, isAlly: true })),
    action(() => { playMissingNoBattle(); enterCycle(); }),
  ]);
}
```

If a cinematic pause before the shatter resolves is wanted, keep it **as a visible
animation only** — never as a gap that blocks the click. The shatter `$effect` in the
overlay ([MissingNoOverlay.svelte:31](src/lib/components/battle/MissingNoOverlay.svelte#L31))
already plays on `mn.act === 2`; leave it, just don't gate dialogue behind a bare timer.

### Act 3 entry / elimination — same queue

`choosePokemon` and `eliminateActive` already use one-shot step arrays; convert them to the
`queue([...])` form so the `D3L3T1NG` / `foi corrompido` lines are click-dismissed
consistently, then `presentPick()` (or `loseMissingNo()`).

## Additional required fixes (same pass)

- **Wire victory.** Export `winMissingNo` and trigger it from the overlay (it is a real
  component and can use `$effect`):
  ```ts
  $effect(() => {
    if (mn.active && battle.state?.mode === 'missingno' && battle.state.status === 'victory') {
      void winMissingNo();
    }
  });
  ```
  In `winMissingNo`, set `mn.active = false` (so the win screen's `!mn.active` passes) and
  **only restore the fallen** — iterate `mn.fallen` and restore from `mn.snapshots`, and
  apply the Corrompido mark to every party member. Restoring *all* snapshots as written today
  ([missingno.svelte.ts:215](src/lib/game/missingno.svelte.ts#L215)) **duplicates survivors**
  that were never removed from the roster — fix that.
- **Reset replay state.** Call `resetMissingNoOneShotFlag()` at the top of `startMissingNo()`
  (only still needed if you keep the endTurn one-shot path; if you move Act 1 to a cutscene as
  above, delete the flag and `onMissingNoFirstTurn` entirely).

## Files to touch

- `src/lib/game/missingno.svelte.ts` — queue refactor, Act 1 cutscene trigger, win wiring,
  restore-only-fallen.
- `src/lib/components/battle/MissingNoOverlay.svelte` — rename `advanceSpeech`→`advance`,
  add the victory `$effect`.
- `src/lib/game/battle.svelte.ts` — export `winMissingNo` is in the orchestrator; here remove
  the `onMissingNoFirstTurn` early-return (if moving Act 1 to a cutscene) and keep
  `onPlayerDefeatedInMissingNo` for Act 3.
- `src/routes/battle/+page.svelte` — disable hand controls while `mn.active && mn.act < 3`.
- `src/lib/data/missingno.ts` — `ACT2_DEFEAT_HOLD_MS`/`ACT2_SILENCE_MS` become unused; remove
  or repurpose as the shatter animation duration only.

## Acceptance criteria

1. `yarn check` reports **0 errors**.
2. Start MissingNo → Act 1 plays as a scripted sequence; **every** click advances the next
   line with no frozen gap between Act 1 and Act 2.
3. Act 2 ally lines play in order and lead into the Act 3 pick popup.
4. Reduce MissingNo to 0 HP → win screen shows; fallen Pokémon are restored once (no
   duplicates) with the Corrompido mark.
5. Lose all 20 → loss screen shows; fallen are purged.
6. Run MissingNo a second time → Act 1 plays again (replay not skipped).

---

# Follow-up: Act 2 defeat screen (flash + music)

## Symptom
At Act 2 the defeat moment just **flashes** (the 0.6 s `shatter-overlay`) and the
MissingNo intro **song keeps playing**. There is no real defeat screen.

## Desired
The **standard defeat screen opens, silently (no song), holds 5 s**, then shatters and the
Pokémon ally bubbles appear (final-boss music starts with the bubbles).

## Root cause
- `runAct2()` ([missingno.svelte.ts:112](src/lib/game/missingno.svelte.ts#L112)) queues the
  bubbles immediately; the only Act 2 visual is the brief `shatter-overlay`. No defeat screen
  is ever shown, and `stopMusic()` is only the *second* beat, so the intro song plays over it.
- The real defeat screen `BattleResultModal` self-plays SFX in
  `onMount(() => playResultSfx(variant))` ([BattleResultModal.svelte:163](src/lib/components/BattleResultModal.svelte#L163)),
  so it must be made silent to reuse here.

## Changes

**1. `src/lib/components/BattleResultModal.svelte`** — add a `silent` prop:
```ts
let { variant, reward, captured, enemyName, onDismiss, silent = false }:
  { variant: 'win'|'boss'|'capture'|'defeat'; reward: BattleReward|null;
    captured: CapturedPokemon|null; enemyName: string; onDismiss: () => void;
    silent?: boolean } = $props();
...
onMount(() => { if (!silent) playResultSfx(variant); });
```

**2. `src/lib/game/missingno.svelte.ts`** — add an Act 2 sub-phase and a 5 s silent hold.
Import `ACT2_DEFEAT_HOLD_MS` (already = 5000 in `data/missingno.ts`). Add `act2Phase` to the
`mn` `$state` (`'none' | 'defeat' | 'shatter' | 'bubbles'`), reset it to `'none'` in
`startMissingNo`, `winMissingNo`, `loseMissingNo`. Replace `runAct2`:
```ts
function runAct2(): void {
  mn.act = 2;
  mn.act2Phase = 'defeat';
  mn.speech = null;          // no bubble during the defeat screen
  stopMusic();               // silence — defeat screen has no song

  setTimeout(() => {
    mn.act2Phase = 'shatter';                 // 0.6–0.7 s shatter animation
    setTimeout(() => {
      mn.act2Phase = 'bubbles';
      playMissingNoBattle();                  // final-boss music starts with the dialogue
      const allies = mn.party.slice(0, 5);
      queue([
        speech('...4IND4 NÃO 4C4B0U.', '', false),
        ...allies.map((a) => speech(`${a.name}: É a minha vez.`, a.name, true)),
        action(() => enterCycle()),
      ]);
    }, 700);
  }, ACT2_DEFEAT_HOLD_MS);
}
```
(The setTimeouts are fine here — unlike the old freeze, every phase shows something:
defeat screen → shatter animation → click-driven bubbles.)

**3. `src/lib/components/battle/MissingNoOverlay.svelte`**
- `import BattleResultModal from '$lib/components/BattleResultModal.svelte';`
- Delete the `showShatter` `$state` + its `$effect` (lines ~28-37).
- Gate the shatter overlay on the phase: `{#if mn.act2Phase === 'shatter'}` (was
  `mn.act === 2 && showShatter`).
- Add the silent defeat screen:
```svelte
{#if mn.act === 2 && mn.act2Phase === 'defeat'}
  <BattleResultModal variant="defeat" reward={null} captured={null}
    enemyName="MissingNo." onDismiss={() => {}} silent />
{/if}
```
`onDismiss={() => {}}` makes the screen non-dismissable during the cinematic hold; it
auto-advances after 5 s.

## Acceptance
- Entering Act 2: intro song stops instantly; the standard defeat screen shows silently and
  stays ~5 s (no flash, no sound).
- After 5 s it shatters, final-boss music starts, and the ally bubbles play (click-driven).
- Optional polish: pass a `descOverride`/`hideActions` prop if the default defeat copy
  ("Seu deck ativo foi perdido…") or the "Voltar ao mapa" button feels off in this context.
