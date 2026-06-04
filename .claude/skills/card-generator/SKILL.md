---
name: card-generator
description: Add a new card to Pokengu. Validates the card design (scalability, balance, kind), generates the SVG icon, wires it into the catalog (shop-ready), and verifies battle rules apply correctly.
---

You are implementing a new card for Pokengu. Follow every step in order.

---

## Step 0 — Pick the card kind

**Kinds (all registered in `src/lib/game/types.ts` → `CardKind`):**

| Kind | Effect | Exhaustion rule | Key template field |
|---|---|---|---|
| `attack` | Deals damage × element effectiveness × berserk | Exhausted if element ≠ player Pokémon's element | `damage` |
| `defense` | Adds `block` this turn (resets each turn) | Discarded (reusable) | `block` |
| `heal` | Restores player HP, capped at `maxHp` | Always exhausted — set `exhaust:'combat'` | `healHp` |
| `buff` | Adds `empowered` status (next attack +N) | Discarded (reusable) | `buffAmount` |
| `capture` | Capture-chance increase; starter Pokébola is reusable | Non-starter = exhausted after one attempt | `captureBonus` |
| `power` | Battle-long effect — use `appliesStatuses` or `CARD_HOOKS` | Never exhausted during play; exhausted on **defeat** via `finalizeBattle()` | `isPower:true` |
| `relic` | Consumable from a separate slot (`relicSlots`), not drawn | Exhausted immediately on play via `playRelicCard()` | custom |
| `energy` | Restores `manaGain` mana this turn (capped at 6) | Discarded (reusable) | `manaGain` |
| `combo` | Next attack fires extra hits via `attack_repeat` status | Discarded (reusable); consumed by next attack | `attackRepeat` |
| `debuff` | Applies a debuff status to the enemy (`intimidate` by default) | Discarded (reusable) | `debuffDuration`,`debuffAmount` |

**If the new card fits an existing kind, skip Step 1b.** If it needs a new kind, do Step 1b.

**How to choose the right mechanism for a new effect:**

| If you want... | Use... |
|---|---|
| A reusable stat bonus/penalty | `appliesStatuses` on the template + a `StatusDefinition` in `status/definitions/*.ts` |
| A complex one-off effect (unique to 1-2 cards) | `CARD_HOOKS` entry in `game/cards/card-hooks.ts` |
| A simple resource change (mana, draw, self-damage) | Template fields `manaGain`, `drawCount`, `selfDamage`, `selfMaxHpReduction` |
| A card that bypasses the deck entirely | `relic` kind |

---

## Step 1a — Design the `CardTemplate`

All fields in `CardTemplate` (`src/lib/game/types.ts`):

```ts
{
  id: string,            // snake_case, prefix by kind: atk_ / def_ / heal_ / buff_ / cap_ / energy_ / combo_ / power_ / relic_
  name: string,          // PT-BR, max ~18 chars (fits card footer)
  description: string,   // PT-BR, max ~45 chars
  cost: number,          // mana cost 0–5
  kind: CardKind,
  element: Element | null,
  rarity: CardRarity,    // 'starter' | 'common' | 'rare' | 'epic'
  tier?: number,
  // stat fields — fill only the one(s) relevant to this card:
  damage?: number,
  block?: number,
  healHp?: number,
  buffAmount?: number,
  captureBonus?: number,
  poisonAmount?: number,
  manaGain?: number,
  attackRepeat?: number,   // extra hits for combo kind (1 = double, 2 = triple)
  drawCount?: number,
  debuffAmount?: number,   // intimidate reduction (0-1)
  debuffDuration?: number, // intimidate turns
  shieldEffect?: 'fire_thorns' | 'ice_reflect' | 'rock_persist',  // unused, reserved
  price?: { money: number; element?: { type: Element; amount: number } },
  // GDD fields:
  exhaust?: 'combat' | 'run',
  isPower?: boolean,
  selfDamage?: number,
  selfMaxHpReduction?: number,
  endsTurn?: boolean,         // Evasão Total — ends player turn immediately
  generatesTokens?: { templateId: string; count: number },
  appliesStatuses?: { id: string; stacks?: number; target?: StatusScope; data?: Record<string, number> }[];
}
```

**Balance reference:**

| Rarity | Damage | Block | Heal | Buff | Price (money) |
|---|---|---|---|---|---|
| common | 8–12 | 8–12 | 8–15 | 8 | 50–600 |
| rare | 18–45 | 25–45 | 25–50 | 15 | 100–1,200 |
| epic | 70–400 | 90–300 | 100–400 | — | 500–2,000 |

Starter cards have no `price`. Relic cards can have element costs (e.g., `{ money: 15000, element: { type: 'ghost', amount: 500 } }`).

---

## Step 1b — New kind (only if needed)

Do this ONLY if the card cannot map to any existing kind above.

### 1. Add to `CardKind` in `src/lib/game/types.ts`
```ts
export type CardKind = '...' | 'YOUR_KIND';
```

### 2. Add the stat field to `CardTemplate` (if needed)
Add `yourField?: number` to the `CardTemplate` interface in the same file.

### 3. Add the kind handler in `game/cards/kinds.ts`
Open `src/lib/game/cards/kinds.ts`. Add a function matching the `KindHandler` signature:

```ts
function handleYourKind(ctx: CardEffectCtx, tpl: CardTemplate): void {
  const { s } = ctx;
  // your logic here — use s.player, s.enemy, addStatus, etc.
}
```

Then register it in `KIND_EMITTERS`:
```ts
export const KIND_EMITTERS: Record<CardKind, KindHandler> = {
  // ...
  your: handleYourKind,
};
```

### 4. Add exhaustion rule
If your kind needs a special exhaust rule, add it in `shouldExhaust()` at `src/lib/game/battle.svelte.ts:315`:
```ts
if (tpl.kind === 'YOUR_KIND') return true;   // always exhausted
```

Otherwise the default rules apply: `exhaust` field, capture misalignment, element misalignment.

### 5. For `power` kind: defeat cleanup is already handled
Power cards are removed from inventory on defeat automatically — the `isPower` flag on the template triggers cleanup in `finalizeBattle()`. No extra code needed.

---

## Step 2 — Add to the catalog

Open `src/lib/data/cards.ts`. Find the `CATALOG` array and push your card:

**One-off card:**
```ts
{
  id: 'YOUR_ID',
  name: 'YOUR NAME',
  description: 'YOUR DESC.',
  cost: X,
  kind: 'YOUR_KIND',
  element: null,
  rarity: 'common',
  yourField: X,
  price: { money: X }
}
```

**Tier-based card (3 rarities):** push each level separately.

**Card with status effects:** use the `appliesStatuses` field:
```ts
appliesStatuses: [
  { id: 'some_status', stacks: 2 }           // default target: 'player'
  { id: 'enemy_debuff', stacks: 1, target: 'enemy' },
  { id: 'status_with_data', stacks: 1, data: { draw: 2, mana: 1 } }
]
```

**Card with complex one-off effect:** add a `CARD_HOOKS` entry (see Step 6.3) and reference it by `id`. No extra template field needed.

Cards are auto-indexed into `CARD_TEMPLATES` and auto-eligible for the shop when they have `price` and a non-starter rarity.

---

## Step 3 — SVG icon

All icons live in `src/lib/components/CardKindIcon.svelte` as `{:else if kind === 'X'}` branches.

**Rules (non-negotiable):**
- ViewBox `0 0 48 48` always.
- Accept `color` prop (a CSS value like `var(--theme-color)` or a hex string). Never hardcode colors.
- Two-layer style: filled shape at `opacity: 0.22–0.25` (glow), then stroked outline at full opacity.
- `stroke-width: 3`, `stroke-linecap: round`, `stroke-linejoin: round`.
- Optional white accent path at `opacity: 0.55`.
- Icon is rendered at 65px (normal) and 86px (showcase). Keep shapes readable at 65px.

**Existing kind icons** (don't duplicate these shapes):
| Kind | Shape |
|---|---|
| `attack` | Sword with diagonal blade |
| `defense` | Shield with checkmark |
| `heal` | Heart with cross |
| `capture` | Pokéball (circle + arc + center dot) |
| `buff` | Two upward chevrons + star |
| `combo` | Two diagonal slashes with guard marks |
| `energy` | Lightning bolt (Z-path) |
| `relic` | Ghost silhouette (arc head + wavy skirt + eyes) |
| `power` | Explosion burst (8 radial lines + center circle) |

---

## Step 4 — Card.svelte badge

Open `src/lib/components/Card.svelte`. Find the footer badge block (look for `tpl.damage`, `tpl.block`, etc.). Add your badge using the **current pattern**:

```svelte
{#if tpl.yourField}
  <span class="flex items-center gap-0.5 text-COLOR-400">
    <span class="text-sm">EMOJI</span> {tpl.yourField}
  </span>
{/if}
```

**Existing badge colors** (pick a distinct one):
| Kind | Color class | Emoji |
|---|---|---|
| damage | `text-red-400` | ⚔ |
| block | `text-blue-400` | 🛡 |
| heal | `text-green-400` | ❤ |
| buff | `text-purple-400` | ✨ |
| capture | `text-amber-500` | ● |
| power (⚔×2) | `text-red-500` | ⚔ |
| power (🛡÷2) | `text-blue-500` | 🛡 |
| relic | `text-purple-600` | 👻 |
| energy | `text-cyan-400` | ⚡ |
| combo | `text-orange-400` | ⚔ |

---

## Step 5 — Shop eligibility checklist

- [ ] `price` field is set on the template.
- [ ] `rarity` is `common`, `rare`, or `epic` (not `starter`).
- [ ] The card ID is unique — `grep -r 'YOUR_ID' src/` should find exactly one match.

---

## Step 6 — Battle rules checklist

### 6.1 Stat-only cards (attack/defense/heal/buff/energy/combo/debuff)
If your card only uses `damage`, `block`, `healHp`, `buffAmount`, `manaGain`, `attackRepeat`, `drawCount`, `selfDamage`, `selfMaxHpReduction`, or `debuffDuration`/`debuffAmount` — no further wiring needed. The generic kind handlers in `game/cards/kinds.ts` handle everything.

### 6.2 Status cards (appliesStatuses)
If your card sets `appliesStatuses`, verify:
- [ ] Each status `id` exists as a `defineStatus()` entry in `src/lib/game/status/definitions/*.ts`
- [ ] The status definition is imported in `status/definitions/index.ts`
- [ ] If the status needs an emblem, the definition has a `hooks.emblem()` function
- [ ] If the status has a `data` object, the hooks read from `self.data`

### 6.3 Complex one-off cards (CARD_HOOKS)
If your card has behavior that can't be expressed by the kind handler + `appliesStatuses`:

Open `src/lib/game/cards/card-hooks.ts` and add an entry:

```ts
your_card_id: {
  // Runs after the kind handler, resources, and appliesStatuses
  onPlay?: (ctx: CardEffectCtx, tpl: CardTemplate, card?: Card) => void;
  // Runs inside handleAttack — replaces tpl.damage in the base sum (return 0 if no extra)
  onBeforeDamage?: (ctx: CardEffectCtx, tpl: CardTemplate) => number;
  // Runs after the attack resolves (after hits are dealt)
  onAfterAttack?: (ctx: CardEffectCtx, tpl: CardTemplate) => void;
}
```

Available helpers inside hooks:
- `addStatus(holder, id, stacks?, data?)` — add a status
- `hasStatus(holder, id)` / `getStatus(holder, id)` — check/read statuses
- `ctx.s` — the `BattleState` (full mutation access)
- `ctx.dealToEnemy(n)` / `ctx.dealToPlayer(n)` — deal damage
- `ctx.draw(n)` — draw cards
- `logEvent({ kind:'bonus_dmg', source, amount })` — emit battle-log events
- `isPermanentlyConsumed(tpl)` from `$lib/game/damage`
- `removeFromDeck` / `removeFromInventory` from `$lib/db/cards`
- `getTemplate(id)` from `$lib/data/cards`

### 6.4 endsTurn cards (Evasão Total)
If the card should end the player's turn immediately (like `flying_evasao_total`), set `endsTurn: true` on the template. The `playCard()` function in `battle.svelte.ts` handles it automatically.

### 6.5 Full effect wiring flow (for reference)
When a card is played, `applyCardEffect` (in `game/cards/apply.ts`) runs in this order:
1. `KIND_EMITTERS[tpl.kind]` — generic kind handler (attack/defense/etc.)
2. `applyResourceEffects` — mana, draw, selfDamage, selfMaxHpReduction
3. `appliesStatuses` loop — declarative status application
4. `CARD_HOOKS[tpl.id]?.onPlay` — card-specific hook
5. `applyCardManipulation` — `generatesTokens`

---

## Step 7 — Validation

Run static validation after the change:

```bash
yarn run check
```

`svelte-check` must report **0 errors, 0 warnings**.

Visual or runtime smoke tests are optional and should be performed only when explicitly requested by the user.
