---
name: card-generator
description: Add a new card to Pokengu. Validates the card design (scalability, balance, kind), generates the SVG icon, wires it into the catalog (shop-ready), and verifies battle rules apply correctly.
---

You are implementing a new card for Pokengu. Follow every step in order.

---

## Step 0 — Pick the card kind

**Current kinds (all registered in `src/lib/game/types.ts` → `CardKind`):**

| Kind | Effect | Exhaustion rule | Key template field |
|---|---|---|---|
| `attack` | Deals damage × element effectiveness × berserk | Exhausted if element ≠ player Pokémon's element | `damage` |
| `defense` | Adds `block` this turn (resets each turn) | Discarded (reusable) | `block` |
| `heal` | Restores player HP, capped at `maxHp` | Always exhausted (single-use) | `healHp` |
| `buff` | Adds `buffAmount` to next attack damage (stacks with `nextDamageBonus`) | Discarded (reusable) | `buffAmount` |
| `capture` | Capture-chance increase; starter Pokébola is reusable | Non-starter = exhausted after one attempt | `captureBonus` |
| `power` | Battle-long stat modifier (e.g., attack ×2, defense ÷2) — sets a flag on `BattleState.player` | Never exhausted during play; exhausted on **defeat** via defeat-cleanup in `finalizeBattle()` | custom flag |
| `relic` | Consumable played from a **separate slot outside the deck** (`relicSlots`), not drawn into hand | Exhausted immediately on play via `playRelicCard()` | custom flag |
| `energy` | Restores `manaGain` mana this turn (capped at 6) | Discarded (reusable) | `manaGain` |
| `combo` | Sets `attackRepeat` on the player — next attack card fires that many extra hits | Discarded (reusable); `attackRepeat` consumed by next attack | `attackRepeat` |

**If the new card fits an existing kind, skip Step 1b.** If it needs a new kind, do Step 1b.

**Match-scoped vs. persistent distinction:**
- Effect lasts one turn → use existing state fields or `buff`/`energy`/`combo`
- Effect lasts the whole battle → add a `boolean` flag to `BattleState.player` (like `berserk`, `ghostForm`)
- Card bypasses the deck entirely (played from a side slot) → use `relic` pattern

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
  // stat fields — only fill the one(s) relevant to this card:
  damage?: number,
  block?: number,
  healHp?: number,
  buffAmount?: number,
  captureBonus?: number,
  poisonAmount?: number,
  manaGain?: number,
  attackRepeat?: number,   // extra hits for combo kind (1 = double, 2 = triple)
  price?: { money: number; element?: { type: Element; amount: number } }
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

### 3. Add the player state flag (if battle-long)

If the card sets a flag that lasts the whole battle, add it to `BattleState.player`:

```ts
// In BattleState.player:
yourFlag: boolean;   // or number
```

**Current `BattleState.player` fields** — always re-read `src/lib/game/types.ts` before adding a new one to get the latest list, then update here:
```ts
pokemon: CapturedPokemon
hp: number
block: number
mana: number
maxMana: 3
nextDamageBonus: number
poisonCounter: number
berserk: boolean       // set by power_berserk — ATK ×2, DEF ÷2
dragonize: boolean     // set by power_dragonize — normal/null attacks become dragon-typed
ghostForm: boolean     // set by relic_ghost_form — all incoming damage capped at 1
attackRepeat: number   // set by combo cards, consumed by next attack
```

### 4. Initialize in `startBattle()`

Find the `player: { ... }` block inside `startBattle()` in `battle.svelte.ts` and add the initial value:

```ts
yourFlag: false,   // or 0
```

**Do the same if you add a flag to `enemy` state** — there is a parallel `enemy: { ... }` block.

### 5. Add the effect case in `applyCardEffect()`

The switch is in `battle.svelte.ts`. Add your case **before** the closing `}` of the switch, after the `'combo'` case:

```ts
case 'YOUR_KIND':
    s.player.yourFlag = true;
    break;
```

### 6. Add exhaustion rule in `shouldExhaust()`

`shouldExhaust()` in `battle.svelte.ts` has fast-exit guards at the top. Add yours there:

```ts
if (tpl.kind === 'YOUR_KIND') return false;   // reusable
// or:
if (tpl.kind === 'YOUR_KIND') return true;    // always exhausted
```

**Current fast-exit rules in `shouldExhaust()`** (for reference):
```ts
if (tpl.kind === 'heal') return true;
if (tpl.kind === 'power' || tpl.kind === 'relic') return false;
if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
if (tpl.element !== null && tpl.element !== s.player.pokemon.element) return true;
return false;
```

### 7. For `power` kind: add defeat cleanup in `finalizeBattle()`

Power cards survive victories but exhaust on defeat. Find the defeat branch in `finalizeBattle()` and add:

```ts
const allCards = [...s.deck, ...s.hand, ...s.discard, ...s.exhausted];
for (const card of allCards) {
    if (getTemplate(card.templateId)?.kind === 'YOUR_KIND') {
        await removeFromInventory(card.id);
    }
}
```

### 8. For `relic` kind: use the existing `playRelicCard()` flow

Relic cards are loaded from inventory into `state.relicSlots` at battle start (already handled in `startBattle()`). The battle UI shows them in a separate row. The `relic_ghost_form` implementation is the reference — don't duplicate the plumbing, just add a new card template with `kind: 'relic'` and handle its specific effect in `case 'relic'` (or add a new sub-case if needed).

---

## Step 2 — Add to the catalog

Open `src/lib/data/cards.ts`. Add inside `buildCatalog()` before `return out`.

**One-off card:**
```ts
out.push({
  id: 'YOUR_ID',
  name: 'YOUR NAME',
  description: 'YOUR DESC.',
  cost: X,
  kind: 'YOUR_KIND',
  element: null,
  rarity: 'common',
  yourField: X,
  price: { money: X }
});
```

**Tier-based card (3 rarities):**
```ts
const myTiers = [
  { id: 'my_common', name: '...', value: X, cost: 1, rarity: 'common' as const, money: 120 },
  { id: 'my_rare',   name: '...', value: Y, cost: 2, rarity: 'rare'   as const, money: 350 },
  { id: 'my_epic',   name: '...', value: Z, cost: 1, rarity: 'epic'   as const, money: 600 }
];
for (const t of myTiers) {
  out.push({ id: t.id, name: t.name, ..., kind: 'YOUR_KIND', yourField: t.value, price: { money: t.money } });
}
```

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

- [ ] `applyCardEffect()` has a `case 'YOUR_KIND'` that uses the correct stat field.
- [ ] `shouldExhaust()` has the correct fast-exit rule for this kind.
- [ ] If a new `BattleState.player` field was added: it's initialized in `startBattle()`.
- [ ] If a new `BattleState.enemy` field was added: also initialized in the `enemy: { ... }` block of `startBattle()`.
- [ ] If a battle-long flag was added: it resets at the right time in `endTurn()` (end of enemy attack phase = before `s.turn = 'player'`).
- [ ] For `power` cards: defeat cleanup in `finalizeBattle()` removes them from inventory.

---

## Step 7 — Smoke test

```bash
export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"
# Start dev server if not running:
yarn dev > /tmp/pokengu-dev.log 2>&1 &
until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done

# Onboard if no player exists:
node .claude/skills/run-pokengu/driver.mjs onboard Ash Charmander

# Screenshot shop and deck in one session (smoke runs onboard + all routes):
node .claude/skills/run-pokengu/driver.mjs smoke
```

Screenshots land in `.claude/skills/run-pokengu/screenshots/`. Read them with the `Read` tool.

Also run a build to catch TypeScript errors:
```bash
yarn build 2>&1 | tail -8
```
