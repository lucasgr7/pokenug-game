# Pokengu — Implementation Plan #2 (battle fixes + new cards)

For external AI implementation in the **Pokengu** codebase (SvelteKit 5 SPA, Svelte 5 Runes, Tailwind v4,
IndexedDB via `idb`, UI language **Portuguese / pt-BR**).

> **Hard rules**
> - `$state` / `$derived` / `$effect` are available everywhere under `src/`.
> - **Never `put()` a `$state` proxy into IndexedDB** — always `$state.snapshot(...)` first.
> - CI gate: `yarn check` must report **0 errors**; also run `yarn build`.
> - All user-facing strings in **pt-BR**.
> - Element colors come from `ELEMENT_COLOR[element]`; card art is per-**kind** SVG in
>   `CardKindIcon.svelte` (new cards of an existing kind need **no** new SVG).
> - Status registry hazard: import status helpers only through the barrel
>   `$lib/game/status` (or `./status`), never from `./registry` directly.

Four independent tasks:
1. Pokémon HP recovery must also work **offline**.
2. Enemy debuffs (e.g. damage reduction) must **live-update the displayed intent**, not only the logs.
3. `rock_barreira` copy chain is bugged — each copy must have **less** shield, decreasing until 0.
4. Implement the **new cards** from the `TODO`/`new card` comments in `src/lib/data/cards.ts`.

---

## Task 1 — Offline Pokémon HP recovery

### Current behavior

- Idle HP regen exists **only while the app is open**. `src/lib/game/jobs.svelte.ts`:
  - `tick()` runs every 1s (`setInterval`, line ~94) and calls `restoreIdleHpOutOfBattle()` (line ~118).
  - `restoreIdleHpOutOfBattle()` (lines ~137–151) heals each roster Pokémon by
    `maxHp * IDLE_HP_RESTORE_PER_MINUTE/60` per tick, **skipping** Pokémon that have an active job
    (`jobForPokemon(p.id)`) and skipping entirely if a saved battle is `active`.
  - `IDLE_HP_RESTORE_PER_MINUTE = 0.05` (5%/min), line ~15.
- Offline catch-up is `applyOfflineProgress()` (lines ~158–183), called from `initApp()`
  (`src/lib/game/state.svelte.ts` line ~331). It **only credits money / element points** from jobs.
  It uses each job's `lastTickAt` as the "since" timestamp. **It never restores HP.**
- **Consequence:** if the app was closed (or no jobs exist), Pokémon HP does not recover for that elapsed
  time. There is also **no player-level "last seen" timestamp** — offline time is derived only from job
  `lastTickAt`, so with zero jobs there is no elapsed reference at all.

### Desired behavior

While the app is closed, eligible Pokémon recover HP at the same rate as the idle (open-app) regen, applied
once on next launch. Must work even when the player has no active jobs.

### Implementation steps

1. **Add a player-level timestamp.** In `src/lib/game/types.ts`, add to `Player`:
   ```ts
   lastSeenAt?: number;   // epoch ms of last app activity, for offline HP catch-up
   ```
   - Keep it optional so existing saved players load without a migration. (DB schema/`DB_VERSION` bump
     is **not** required; patch on load — see step 4.)

2. **Keep it fresh while the app is open.** In `jobs.svelte.ts` `tick()` (or `flush()`), set
   `game.player.lastSeenAt = now()` each tick and persist it with the existing debounced/now persist
   (it rides along with the player snapshot already written by `persistNow()`). Use the module's existing
   `now()` helper.

3. **Restore HP on launch.** Add a function in `jobs.svelte.ts` and call it from `initApp()`
   (alongside / right after `applyOfflineProgress()`), so it runs regardless of jobs:
   ```ts
   export async function applyOfflineHpRecovery(): Promise<void> {
       if (!game.player) return;
       const saved = await getSavedBattle();
       if (saved?.state.status === 'active') return;          // mid-battle: don't heal

       const last = game.player.lastSeenAt ?? now();
       const elapsedMs = Math.max(0, now() - last);
       if (elapsedMs <= 0) { game.player.lastSeenAt = now(); return; }

       const elapsedMin = elapsedMs / 60000;
       const healRatio = IDLE_HP_RESTORE_PER_MINUTE * elapsedMin;   // same 5%/min rate
       for (const p of game.roster) {
           if (jobForPokemon(p.id)) continue;                  // working pokémon don't idle-heal (parity)
           const hp = normalizedPokemonHp(p);
           if (hp >= p.maxHp) continue;
           p.currentHp = Math.min(p.maxHp, hp + p.maxHp * healRatio);
           dirtyPokemon.add(p.id);                             // reuse the existing dirty-flush mechanism
       }
       game.player.lastSeenAt = now();
       await flush();
   }
   ```
   - Reuse the existing `normalizedPokemonHp`, `jobForPokemon`, `dirtyPokemon`, `flush`, `getSavedBattle`,
     `IDLE_HP_RESTORE_PER_MINUTE`, and `now()` already in this module (no new imports beyond what's there).
   - **Cap the offline window** (recommended) to avoid surprising full-heals after long absences — e.g.
     `const elapsedMin = Math.min(elapsedMs / 60000, MAX_OFFLINE_MIN)` with `MAX_OFFLINE_MIN = 8 * 60`
     (8h → at 5%/min that already saturates to full; choose any cap ≥ 20 min). At 5%/min, 20 min = full HP,
     so the cap mostly bounds nothing functionally but documents intent. Keeping the rate means HP is full
     after ~20 min offline, which matches the open-app behavior.

4. **Patch the field on load.** In `initApp()` (`state.svelte.ts`, around the existing currentHp clamp at
   lines ~308–310), default `p.lastSeenAt ??= now()` for the loaded player **before** calling
   `applyOfflineHpRecovery()`, so a first run after deploying this change doesn't dump a huge heal from a
   missing timestamp.

5. **Order of operations in `initApp()`:** load player+roster → run migrations/clamps → set
   `lastSeenAt` default → `applyOfflineProgress()` → `applyOfflineHpRecovery()`. Ensure the OfflineSummary
   modal (if any) is unaffected (HP recovery doesn't need to surface in it; optional).

### Verify

- Close the app with a damaged Pokémon (not on a job, no active battle), reopen after a few minutes →
  HP increased ~5%/min of max.
- A Pokémon assigned to a job does **not** idle-heal offline (parity with open-app behavior).
- Reopening mid-battle does not heal.
- `yarn check` = 0 errors.

---

## Task 2 — Live enemy intent / debuff feedback

### Current behavior

- The enemy's shown intent is computed in `src/lib/components/battle/EnemyHud.svelte` `intentText()`
  (lines ~13–24): for an attack it shows
  `Math.round((it.damage + s.enemy.nextDamageBonus) * interaction.multiplier)` — i.e. **only the type
  multiplier** is applied to the displayed number.
- The **actual** enemy attack (`enemyTurn` in `battle.svelte.ts`, lines ~904–929) additionally reduces
  the damage by, in order:
  1. `imobilizado` → `dmg = floor(dmg * 0.5)` (line ~913),
  2. `intimidate` → `dmg = round(dmg * (1 - reduction))` (lines ~917–921),
  3. `ghostPermDebuff` (Alma Penada) → `dmg = max(0, dmg - ghostPermDebuff)` (lines ~924–926),
  then applies the type multiplier via `resolveTypedDamage`.
- **Consequence:** when the player applies a damage-reduction debuff, the on-screen "Intenção ⚔️ N"
  does **not** change — the reduced value only appears in the battle log when the enemy attacks. No live
  feedback that the debuff worked.

### Desired behavior

The displayed intent number reflects all currently-active enemy damage-reduction debuffs **immediately**
when they are applied, so the player gets clear feedback. (Defend/buff intents are unaffected, though
`shield_reduced`/`buff_reduced` could optionally be reflected too — see optional note.)

### Implementation steps

1. **Single source of truth.** In `src/lib/game/battle.svelte.ts`, extract the attack-damage reduction
   math (currently inline in `enemyTurn`) into an exported pure helper, and make `enemyTurn` call it so the
   displayed value and the real hit can never drift:
   ```ts
   /** Projected enemy attack damage after debuffs + type multiplier (display + actual share this). */
   export function projectedEnemyDamage(s: BattleState): number {
       const it = s.enemy.intent;
       if (it.kind !== 'attack') return 0;
       let dmg = it.damage + s.enemy.nextDamageBonus;
       if (hasStatus(s.enemy, 'imobilizado')) dmg = Math.floor(dmg * 0.5);
       if (hasStatus(s.enemy, 'intimidate')) {
           const reduction = getStatus(s.enemy, 'intimidate')!.data?.reduction ?? 0;
           dmg = Math.round(dmg * (1 - reduction));
       }
       if (s.player.ghostPermDebuff > 0) dmg = Math.max(0, dmg - s.player.ghostPermDebuff);
       const attackElement = it.element ?? s.enemy.pokemon.element;
       const interaction = getElementInteraction(attackElement, s.player.pokemon.element);
       return Math.max(0, Math.round(dmg * interaction.multiplier));
   }
   ```
   - Refactor `enemyTurn` (lines ~907–928) to use the same reduction chain (either call a shared
     internal that returns the pre-type-multiplier value, or compute via this helper before
     `resolveTypedDamage`). The key requirement: **no duplicated/independent formula**. Keep MissingNo's
     `???` display special-case in the HUD (don't reveal numbers in `missingno` mode).

2. **Use it in the HUD.** In `EnemyHud.svelte` `intentText()`, replace the attack branch's manual
   calculation with `projectedEnemyDamage(s)`:
   ```ts
   if (it.kind === 'attack') {
       const attackElement = it.element ?? s.enemy.pokemon.element;
       if (s.mode === 'missingno') return `${ELEMENT_EMOJI[attackElement]} ⚔️ ???`;
       return `${ELEMENT_EMOJI[attackElement]} ⚔️ ${projectedEnemyDamage(s)}`;
   }
   ```
   Import `projectedEnemyDamage` from `$lib/game/battle.svelte`. Because `s` is reactive (`$state`),
   the HUD re-derives whenever enemy statuses / `nextDamageBonus` / `ghostPermDebuff` change → **live update**.

3. **Optional, stronger feedback (nice-to-have):** when a reduction is active, render the number with a
   subtle "reduced" treatment — e.g. show the reduced value in the debuff color, or show
   `~~base~~ reduced`. Keep it minimal and within the existing `.danger` chip styling; consult the
   **design-pokengu skill** before adding visuals.

4. **Optional:** mirror `shield_reduced` (defend intent ×0.5) and `buff_reduced` (buff intent ×0.5) in the
   respective HUD branches so those debuffs also give immediate visual feedback, using the same
   enemyTurn formulas (lines ~952, ~959). Only do this if desired; the primary ask is the attack number.

### Verify

- Apply `Imobilização Total` / `Intimidação`-type debuff or Alma Penada → the "Intenção ⚔️ N" number
  drops immediately, and the number shown equals the damage actually dealt next enemy turn (check the log).
- MissingNo battles still show `???`.
- `yarn check` = 0 errors.

---

## Task 3 — Fix `rock_barreira` decreasing-shield copies

### Current behavior

- `rock_barreira` (`src/lib/data/cards.ts` lines ~718–728): "Ganha 10 de escudo. **[COPIA_DESCARTE] Cria 1
  cópia com -1 de defesa no descarte. (Limite: 3)**", `block: 10`, cost 0, kind `defense`.
- Its hook (`src/lib/game/cards/card-hooks.ts` lines ~199–206) pushes a copy into the discard pile with the
  **same** `templateId` and **no modifier**:
  ```ts
  rock_barreira: {
      onPlay: (ctx, tpl) => {
          const copies = countCardCopies(ctx.s, tpl.id);
          if (copies < 3) ctx.s.discard.push({ id: crypto.randomUUID(), templateId: tpl.id });
      }
  };
  ```
- **Bug:** every copy grants the full 10 shield (no decay), and it's gated by an arbitrary `< 3` count
  instead of decaying to zero. The card text promises "-1 de defesa" per copy.

### The mechanism that already exists

- `Card.modifier` (`types.ts` line ~177): *"transient battle adjustment (e.g. Espinhos -1 block/use)"*.
- `handleDefense` (`cards/kinds.ts` lines ~58–66) already applies it:
  `rawBlock = max(0, (tpl.block ?? 0) + (card?.modifier ?? 0) + upgrades)`.
- `grass_espinhos` uses the same idea by decrementing the played card's own modifier
  (`card-hooks.ts` lines ~72–75).

So the fix is to **carry a decreasing `modifier` onto each generated copy**, and stop generating when the
copy would grant 0 (or less) shield.

### Implementation steps

1. **Rewrite the hook** (`card-hooks.ts`) to read the current card's modifier and create the next copy with
   `modifier - 1`, only while the resulting effective block stays positive:
   ```ts
   rock_barreira: {
       onPlay: (ctx, tpl, card) => {
           const baseBlock = tpl.block ?? 0;             // 10
           const nextMod = (card?.modifier ?? 0) - 1;    // each copy is 1 weaker than the one played
           if (baseBlock + nextMod > 0) {                // stop once a copy would give 0 shield
               ctx.s.discard.push({ id: crypto.randomUUID(), templateId: tpl.id, modifier: nextMod });
           }
       }
   };
   ```
   - The handler signature already receives `card` (it's passed from `handleDefense` →
     `CARD_HOOKS[tpl.id]?.onPlay?.(ctx, tpl, card)`). Note: `applyCardEffect` in `apply.ts` *also* calls
     `onPlay`, but **without** `card` for non-defense paths — for `defense` kind the call inside
     `handleDefense` runs first **with** `card`. **Verify there is no double-invocation** of this hook for
     `rock_barreira`: `handleDefense` calls `onPlay(ctx, tpl, card)` AND `applyCardEffect` calls
     `onPlay(ctx, tpl, card)` again at its end. **This is a pre-existing double-call risk** (it would push
     two copies per play). Resolve it by ensuring the hook runs exactly once — preferred fix: in
     `apply.ts`, do **not** re-invoke `CARD_HOOKS[...].onPlay` for kinds whose emitter already invokes it
     (`defense`, `buff`, `power`). Check current behavior first (the old `< 3` cap may have masked it);
     implement so exactly one copy is produced per play. **This single-invocation guarantee is the most
     important correctness point of this task.**

2. **Update the card text** (`cards.ts`) to match the new behavior, pt-BR, e.g.:
   `'Ganha 10 de escudo. [COPIA_DESCARTE] Cria 1 cópia com -1 de escudo no descarte, até chegar a 0.'`
   Remove the `(Limite: 3)`.

3. **Balance note (decide a definition):** base `block: 10` with -1 decay yields a 10-card chain
   (10+9+…+1 = 55 total shield from one 0-cost card over a combat) — likely too strong and the practical
   reason this felt "bugged." Recommended: lower the base to **`block: 6`** (chain 6+5+…+1 = 21) or keep
   cost 0 but set `block: 8`. Pick one and update both the field and the description number. (This is the
   "missing definition" you're asked to decide.)

4. Confirm `Card.modifier` survives the discard→draw→play round-trip in battle (it lives on the in-memory
   battle card object; it is intentionally **not** persisted to inventory, which is correct here).

### Verify

- Play `rock_barreira` → gain N shield, exactly **one** copy appears in discard with N-1 effective shield.
- Drawing and playing successive copies yields strictly decreasing shield, and the chain terminates at 0
  (no infinite copies, no full-value copies).
- `yarn check` = 0 errors.

---

## Task 4 — Implement the new cards (from the `TODO` comments in `cards.ts`)

Add each card below to `src/lib/data/cards.ts` in its element section, **replacing** the corresponding
`// TODO`/`// new card` comment. `CARD_TEMPLATES` auto-indexes everything in
`STARTER_TEMPLATES + CATALOG + TOKEN_TEMPLATES`, so no registry edits are needed beyond adding the objects.
Tokens go in `TOKEN_TEMPLATES`. Hooks go in `src/lib/game/cards/card-hooks.ts`.

Reused `CardTemplate` fields: `damage`, `block`, `manaGain`, `drawCount`, `selfDamage`, `exhaust`
(`'combat' | 'run'`), `isPower`, `generatesTokens`, `appliesStatuses`, `price`. Rarities: `common | rare |
epic | secret` (there is **no** `special`; map "special" → `secret`). Pricing convention in this file:
common ≈ `{ money: 40 }`, rare ≈ `{ money: 90 }`, epic ≈ `{ money: 180, element: {...50} }`,
secret ≈ `{ money: 300, element: {...60–80} }`.

### 4.0 Shared engine prerequisites

Some cards need a "first card played this turn" signal:

- **Add `cardsPlayedThisTurn: number` to `turnFlags`** (`types.ts` `BattleState.player.turnFlags`,
  line ~250). Initialize it to `0` everywhere `turnFlags` is constructed/reset in `battle.svelte.ts`
  (lines ~227–229, ~436, ~601, ~668, ~715).
- In `playCard` (`battle.svelte.ts` ~779), **increment it after** `applyCardEffect` (e.g. right after
  `dispatchOnCardPlayed`, line ~829), so that during a card's hooks the value still reflects the count
  **before** this card. Then "is first card this turn" ⇔ `s.player.turnFlags.cardsPlayedThisTurn === 0`
  inside the hook.

"Enemy has any debuff" detection: enemy-held statuses are debuffs by construction, so use
`s.enemy.statuses.length > 0` (simple and correct for current content). If you prefer a stricter check,
filter to known debuff defIds, but the simple form is acceptable.

### 4.1 Water — `water_tsunami` ("Tsunami")

- Spec: cost 3, damage 40, bring all your Water cards into your hand, rarity "special".
- Definition (replace TODO at line ~128):
  ```ts
  {
      id: 'water_tsunami',
      name: 'Tsunami',
      description: 'Cause 40 de dano. Traz todas as suas cartas de Água para a mão.',
      cost: 3,
      kind: 'attack',
      element: 'water',
      rarity: 'secret',
      damage: 40,
      price: { money: 300, element: { type: 'water', amount: 80 } }
  }
  ```
- Hook (`card-hooks.ts`), `onAfterAttack` — move all Water cards from deck + discard into hand:
  ```ts
  water_tsunami: {
      onAfterAttack: (ctx) => {
          const s = ctx.s;
          const isWater = (c) => getTemplate(c.templateId)?.element === 'water';
          const pulled = [...s.deck.filter(isWater), ...s.discard.filter(isWater)];
          s.deck = s.deck.filter((c) => !isWater(c));
          s.discard = s.discard.filter((c) => !isWater(c));
          s.hand.push(...pulled);
      }
  }
  ```
  (`getTemplate` is already imported in `card-hooks.ts`.)

### 4.2 Fire — `fire_escudo_ardente` ("Escudo Ardente")

- Spec: gain 16 shield, lose 4 HP, 1 energy. (No hook needed — `block` + `selfDamage` are native.)
- Definition (replace TODO line ~167):
  ```ts
  {
      id: 'fire_escudo_ardente',
      name: 'Escudo Ardente',
      description: 'Ganha 16 de escudo. Você sofre 4 de dano.',
      cost: 1,
      kind: 'defense',
      element: 'fire',
      rarity: 'rare',
      block: 16,
      selfDamage: 4,
      price: { money: 90 }
  }
  ```

### 4.3 Dragon — `dragon_cauda` ("Cauda do Dragão")

- Spec: cost 1, damage 11, discard leftmost hand card + draw 1, +6 CARGA_DRAGÃO.
- Definition (replace TODO line ~277):
  ```ts
  {
      id: 'dragon_cauda',
      name: 'Cauda do Dragão',
      description: 'Cause 11 de dano. Descarta a carta mais à esquerda da mão e compra 1. Adiciona +6 em CARGA_DRAGÃO.',
      cost: 1,
      kind: 'attack',
      element: 'dragon',
      rarity: 'rare',
      damage: 11,
      appliesStatuses: [{ id: 'carga_dragao', stacks: 6 }],
      price: { money: 90 }
  }
  ```
- Hook (`onAfterAttack`): discard `hand[0]` then draw 1.
  ```ts
  dragon_cauda: {
      onAfterAttack: (ctx) => {
          const s = ctx.s;
          if (s.hand.length > 0) { s.discard.push(s.hand.shift()!); }
          ctx.draw(1);
      }
  }
  ```

### 4.4 Psychic — `psychic_viagem_temporal` ("Viagem Temporal")

- Spec: cost 3, power, bring 3 random cards from the exhaust pile into the draw pile.
- Definition (replace TODO line ~324):
  ```ts
  {
      id: 'psychic_viagem_temporal',
      name: 'Viagem Temporal',
      description: '[POWER] Traz 3 cartas aleatórias da pilha de exaustas para a pilha de compra. [EXHAUST_COMBATE]',
      cost: 3,
      kind: 'power',
      element: 'psychic',
      rarity: 'epic',
      isPower: true,
      exhaust: 'combat',
      price: { money: 180, element: { type: 'psychic', amount: 50 } }
  }
  ```
- Hook (`onPlay`): move up to 3 random cards from `s.exhausted` to `s.deck`.
  ```ts
  psychic_viagem_temporal: {
      onPlay: (ctx) => {
          const s = ctx.s;
          for (let i = 0; i < 3 && s.exhausted.length > 0; i++) {
              const idx = Math.floor(Math.random() * s.exhausted.length);
              s.deck.push(s.exhausted.splice(idx, 1)[0]);
          }
      }
  }
  ```
  - Note: cards exhausted via `exhaust: 'run'` were also removed from inventory/deck DB; bringing them back
    into the in-battle draw pile is fine (they only need to exist for this combat). No DB re-add needed.

### 4.5 Ground — `ground_esmagar` ("Esmagar")

- Spec: cost 1, damage 15. (No hook.)
  ```ts
  {
      id: 'ground_esmagar',
      name: 'Esmagar',
      description: 'Cause 15 de dano.',
      cost: 1,
      kind: 'attack',
      element: 'ground',
      rarity: 'rare',
      damage: 15,
      price: { money: 90 }
  }
  ```
  (Replace TODO line ~373.)

### 4.6 Flying — `flying_chute_aereo` ("Chute Aéreo")

- Spec: cost 1, damage 12. (No hook.)
  ```ts
  {
      id: 'flying_chute_aereo',
      name: 'Chute Aéreo',
      description: 'Cause 12 de dano.',
      cost: 1,
      kind: 'attack',
      element: 'flying',
      rarity: 'common',
      damage: 12,
      price: { money: 40 }
  }
  ```
  (Replace TODO line ~423.)

### 4.7 Flying — `flying_mergulho` ("Mergulho")

- Spec: cost 2, damage 20, draw 2 if it's the **first card played this turn**. Needs §4.0 flag.
  ```ts
  {
      id: 'flying_mergulho',
      name: 'Mergulho',
      description: 'Cause 20 de dano. Se for a primeira carta jogada no turno, compre 2 cartas.',
      cost: 2,
      kind: 'attack',
      element: 'flying',
      rarity: 'rare',
      damage: 20,
      price: { money: 90 }
  }
  ```
  Hook:
  ```ts
  flying_mergulho: {
      onAfterAttack: (ctx) => {
          if (ctx.s.player.turnFlags.cardsPlayedThisTurn === 0) ctx.draw(2);
      }
  }
  ```
  (Replace TODO line ~460.)

### 4.8 Bug — `bug_infestacao` ("Infestação") + token `bug_ovos_podres_token` ("Ovos Podres")

- Spec: cost 1, damage 14, creates one junk card "Ovos Podres" in hand; the junk costs 1 and exhausts
  doing nothing.
  ```ts
  {
      id: 'bug_infestacao',
      name: 'Infestação',
      description: 'Cause 14 de dano. Gera 1 carta "Ovos Podres" inútil na sua mão.',
      cost: 1,
      kind: 'attack',
      element: 'bug',
      rarity: 'rare',
      damage: 14,
      generatesTokens: { templateId: 'bug_ovos_podres_token', count: 1 },
      price: { money: 90 }
  }
  ```
  (Replace TODO line ~507.) `generatesTokens` is handled natively in `apply.ts` `applyCardManipulation`.
- Token — add to `TOKEN_TEMPLATES` (bottom of `cards.ts`). Junk card: costs 1, does nothing, exhausts on
  use. Use kind `buff` with no `buffAmount` (→ `handleBuff` does nothing) and `exhaust: 'run'`:
  ```ts
  {
      id: 'bug_ovos_podres_token',
      name: 'Ovos Podres',
      description: 'Carta inútil. Gasta 1 de energia e é exaurida.',
      cost: 1,
      kind: 'buff',
      element: 'bug',
      rarity: 'common',
      exhaust: 'run'
  }
  ```
  - Art: kind-based SVG means it reuses the `buff` icon automatically. The original comment says
    "new design required" — if a distinct "rotten eggs" look is wanted, that's a separate visual task;
    consult the **design-pokengu skill** before adding any custom SVG. Functionally the token works without
    new art.

### 4.9 Poison — `poison_mordida` ("Mordida")

- Spec: cost 1, damage 7, if enemy has any debuff → +1 energy and draw 1.
  ```ts
  {
      id: 'poison_mordida',
      name: 'Mordida',
      description: 'Cause 7 de dano. Se o inimigo tiver algum efeito negativo, ganha +1 de energia e compra 1 carta.',
      cost: 1,
      kind: 'attack',
      element: 'poison',
      rarity: 'rare',
      damage: 7,
      price: { money: 90 }
  }
  ```
  Hook:
  ```ts
  poison_mordida: {
      onAfterAttack: (ctx) => {
          if (ctx.s.enemy.statuses.length > 0) {
              ctx.s.player.mana = Math.min(6, ctx.s.player.mana + 1);
              ctx.draw(1);
          }
      }
  }
  ```
  (Replace comment line ~556. Mana cap is 6, matching `apply.ts`.)

### 4.10 Ghost — `ghost_susto` ("Susto")

- Spec: cost 1, damage 4, if the enemy intends to attack → +1 energy this turn.
  ```ts
  {
      id: 'ghost_susto',
      name: 'Susto',
      description: 'Cause 4 de dano. Se o inimigo for atacar, ganha +1 de energia neste turno.',
      cost: 1,
      kind: 'attack',
      element: 'ghost',
      rarity: 'common',
      damage: 4,
      price: { money: 40 }
  }
  ```
  Hook:
  ```ts
  ghost_susto: {
      onAfterAttack: (ctx) => {
          if (ctx.s.enemy.intent.kind === 'attack') {
              ctx.s.player.mana = Math.min(6, ctx.s.player.mana + 1);
          }
      }
  }
  ```
  (Replace comment line ~619.)

### 4.11 Ice — `ice_espelho` ("Espelho de Gelo")

- Spec: cost 2, gain shield = 50% of the enemy's intended damage, single use per combat (exhaust).
  Reuses `projectedEnemyDamage` from **Task 2** (implement Task 2 first, or at least that helper).
  ```ts
  {
      id: 'ice_espelho',
      name: 'Espelho de Gelo',
      description: 'Ganha escudo igual a 50% do dano pretendido do inimigo. [EXHAUST_COMBATE]',
      cost: 2,
      kind: 'defense',
      element: 'ice',
      rarity: 'rare',
      exhaust: 'combat',
      price: { money: 90 }
  }
  ```
  Hook (`onPlay`, runs for `defense` kind via `handleDefense`):
  ```ts
  ice_espelho: {
      onPlay: (ctx) => {
          const projected = projectedEnemyDamage(ctx.s);   // import from battle.svelte
          ctx.s.player.block += Math.floor(projected * 0.5);
      }
  }
  ```
  - **Import note / circular-import caution:** `card-hooks.ts` importing `projectedEnemyDamage` from
    `battle.svelte.ts` may create an import cycle (battle → cards/apply → card-hooks → battle). To stay
    safe, either (a) place `projectedEnemyDamage` in a leaf module (e.g. a small `enemy-intent.ts` that
    both `battle.svelte.ts` and `card-hooks.ts` import), or (b) inline the same reduction math in the hook
    using `s.enemy.intent`. **Prefer (a)** to keep a single source of truth with Task 2.
  - If you choose to also reflect defend-intent here, note this only matters when the enemy intent is
    `attack`; for non-attack intents `projectedEnemyDamage` returns 0 (no shield), which is acceptable.
  (Replace TODO line ~668.)

### 4.12 Electric — `electric_recarga` ("Recarga")

- Spec: cost 0, draw 2, +1 energy, lose 5% of max HP.
  ```ts
  {
      id: 'electric_recarga',
      name: 'Recarga',
      description: 'Compre 2 cartas. Ganha +1 de energia. Você perde 5% da vida máxima.',
      cost: 0,
      kind: 'energy',
      element: 'electric',
      rarity: 'rare',
      manaGain: 1,
      drawCount: 2,
      price: { money: 90 }
  }
  ```
  - `manaGain` and `drawCount` are applied natively (`applyResourceEffects`). The percent self-damage needs
    a hook (flat `selfDamage` can't express a percentage). `energy` kind's `handleEnergy` does nothing and
    does **not** call `onPlay`, but `apply.ts` calls `CARD_HOOKS[...].onPlay` after the emitter, so the
    hook below will run:
  ```ts
  electric_recarga: {
      onPlay: (ctx) => {
          const s = ctx.s;
          s.player.hp = Math.max(0, s.player.hp - Math.ceil(s.player.pokemon.maxHp * 0.05));
      }
  }
  ```
  (Replace TODO line ~704.)

### 4.13 Rock — `rock_lancar_pedra` ("Lançar Pedra")

- Spec: cost 1, damage 10, if the enemy has any shield → +1 energy and draw 1. The "has shield" check must
  read the enemy block **before** this attack consumes it.
  ```ts
  {
      id: 'rock_lancar_pedra',
      name: 'Lançar Pedra',
      description: 'Cause 10 de dano. Se o inimigo tiver escudo, ganha +1 de energia e compra 1 carta.',
      cost: 1,
      kind: 'attack',
      element: 'rock',
      rarity: 'rare',
      damage: 10,
      price: { money: 90 }
  }
  ```
  - Hook: use `onBeforeDamage` (runs while `s.enemy.block` is still intact). It must **return the base
    damage** (because when an `onBeforeDamage` hook exists, `handleAttack` uses its return value *instead
    of* `tpl.damage`), and may perform side effects:
  ```ts
  rock_lancar_pedra: {
      onBeforeDamage: (ctx) => {
          if (ctx.s.enemy.block > 0) {
              ctx.s.player.mana = Math.min(6, ctx.s.player.mana + 1);
              ctx.draw(1);
          }
          return 10;   // base damage (handleAttack adds upgrades/bonuses around this)
      }
  }
  ```
  (Replace TODO line ~750.)

### Catalog hygiene

- Remove every `// TODO` / `// new card` comment you implement.
- Keep cards grouped under their existing element headers, following the formatting of neighbors.
- Confirm all new `id`s are unique and snake_case with the correct kind/element prefix.
- New cards have `price`, so they appear in the shop automatically (the shop reads `CATALOG`); tokens have
  **no** `price` (never purchasable), matching `bug_picada_token`.

### Verify

- `yarn check` = 0 errors; `yarn build` succeeds.
- Each new card: cost/damage/shield/draw/energy behave per spec; conditional effects fire only when their
  condition holds (enemy debuff / enemy shield / enemy attacking / first card of turn).
- `Tsunami` pulls all Water cards into hand; `Viagem Temporal` recovers up to 3 from exhausted;
  `Recarga` costs ~5% max HP; `Espelho de Gelo` grants shield = 50% of the (debuff-adjusted) projected
  enemy damage and exhausts; `Infestação` adds one inert `Ovos Podres` to hand.
- No card double-applies its hook (watch the `handleX` + `apply.ts` double `onPlay` interaction — see
  Task 3 step 1; the same single-invocation rule must hold for the new `onPlay` hooks in §4.4, §4.11,
  §4.12).

---

## Global checklist

- [ ] `yarn check` → **0 errors**; `yarn build` succeeds.
- [ ] Offline HP recovery works with and without jobs; respects job-assigned and mid-battle exclusions.
- [ ] Enemy intent number live-updates with debuffs and equals the damage actually dealt.
- [ ] `rock_barreira` produces exactly one decreasing-shield copy per play, terminating at 0.
- [ ] All 13 new cards/token implemented, TODO comments removed, hooks wired, no double-invocation.
- [ ] All new strings pt-BR; no `$state` proxy written to IDB without `$state.snapshot`.
