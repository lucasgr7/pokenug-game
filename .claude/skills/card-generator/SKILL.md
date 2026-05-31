---
name: card-generator
description: Add a new card to Pokengu. Validates the card design (scalability, balance, kind), generates the SVG icon, wires it into the catalog (shop-ready), and verifies battle rules apply correctly.
---

You are implementing a new card for Pokengu. Follow every step in order. Do not skip validation checks — they prevent silent bugs in battle and the shop.

---

## Step 0 — Understand the request

Decide which **card kind** the new card belongs to:

| Kind | Effect | Exhaustion rule |
|---|---|---|
| `attack` | Deals damage; optional element for type-effectiveness | Exhausted if element ≠ player's Pokémon element |
| `defense` | Adds block this turn (resets each turn) | Discarded (reusable) |
| `heal` | Restores player HP, capped at maxHp | Always exhausted (single-use) |
| `buff` | Adds `buffAmount` to next attack (stacks) | Discarded (reusable) |
| `capture` | Capture-chance increase; starter Pokébola never exhausts | Non-starter = exhausted after one attempt |

**Match vs. persistent effect distinction:**
- "Match effect" (lasts the battle) → use `buff` kind or extend `BattleState` with a new per-battle flag.
- "Passive buff" (permanent upgrade) → these belong in NGU (shop upgrades), not a card.
- "One-shot power" (unique mechanic) → must map to an existing `CardKind` OR require a new kind (see Step 1b).

---

## Step 1a — Design the card template

Fill in all fields for `CardTemplate` (defined in `src/lib/game/types.ts`):

```ts
{
  id: string,          // snake_case, prefix by kind: atk_ / def_ / heal_ / buff_ / cap_
  name: string,        // PT-BR, max ~18 chars (fits card footer)
  description: string, // PT-BR, max ~45 chars
  cost: number,        // 1–5 mana (most cards cost 1–3)
  kind: CardKind,
  element: Element | null,   // null = no element (no exhaustion risk)
  rarity: CardRarity,  // starter | common | rare | epic
  // Only fill the field that matches the kind:
  damage?: number,
  block?: number,
  healHp?: number,
  buffAmount?: number,
  captureBonus?: number,   // fraction 0..1
  price?: { money: number; element?: { type: Element; amount: number } }
  // Starter cards have no price (not sold in shop)
}
```

**Balance reference:**

| Rarity | Damage | Block | Heal | Buff | Price (money) |
|---|---|---|---|---|---|
| common | 8–12 | 8–12 | 8–15 | 8 | 50–600 |
| rare | 18–45 | 25–45 | 25–50 | 15 | 100–1,200 |
| epic | 70–400 | 90–300 | 100–400 | — | 500–2,000 |

Element attack cards cost element points too (see ATTACK_TIERS in `src/lib/data/card-constants.ts`).

---

## Step 1b — New kind? (optional, skip if using existing)

Only proceed here if the card cannot map to any existing kind (attack / defense / heal / buff / capture).

1. Add the new kind string to `CardKind` in `src/lib/game/types.ts`:
   ```ts
   export type CardKind = 'attack' | 'defense' | 'heal' | 'capture' | 'buff' | 'YOUR_KIND';
   ```
2. Add the battle effect case in `applyCardEffect()` in `src/lib/game/battle.svelte.ts`.
3. Add an exhaustion rule in `shouldExhaust()` in the same file.
4. Add a footer badge in `src/lib/components/Card.svelte` (look for the stat badges section — ⚔️/🛡️/❤️/✨/●%).
5. Add an SVG icon branch in `src/lib/components/CardKindIcon.svelte` (see Step 3).

---

## Step 2 — Add to the catalog

Open `src/lib/data/cards.ts`.

**Option A — one-off card** (not part of a tier system):
Add it directly inside `buildCatalog()` before the `return out` line:

```ts
out.push({
  id: 'YOUR_ID',
  name: 'YOUR_NAME',
  description: 'YOUR_DESC',
  cost: X,
  kind: 'YOUR_KIND',
  element: null,
  rarity: 'common',
  // kind-specific stat:
  damage: X,
  price: { money: X }
});
```

**Option B — tier-based card** (fits a scaling series):
Add the tier data in `src/lib/data/card-constants.ts` and loop over it in `buildCatalog()` following the existing ATTACK_TIERS / DEF_TIERS / HEAL_TIERS patterns.

After adding, verify the card appears in `CARD_TEMPLATES`:
- It is exported via `CATALOG` → merged into `CARD_TEMPLATES` automatically.
- `getTemplate(id)` must return the new template.

---

## Step 3 — Generate the SVG icon

All card icons live in `src/lib/components/CardKindIcon.svelte` as inline SVG branches keyed on `kind`.

**Rules (from design-pokengu skill):**
- ViewBox always `0 0 48 48`.
- Accept `color` prop (passed in as hex from element/rarity system). Never hardcode element colors.
- Two-layer style: filled shape at `opacity: 0.22–0.25` (glow), then stroked outline at full opacity.
- `stroke-width: 3`, `stroke-linecap: round`, `stroke-linejoin: round`.
- Optional white accent path at `opacity: 0.55` for depth.
- `aria-hidden="true"` on the outer `<svg>`.
- Icon renders at 65px / 86px — keep paths readable at small sizes.

**Adding the branch:**
Open `src/lib/components/CardKindIcon.svelte` and add an `{:else if kind === 'YOUR_KIND'}` block following the existing pattern.

If the card uses an **existing kind** (e.g., another `buff` card), no icon change is needed — it reuses the existing icon for that kind.

**Icon design guidance by card theme:**

| Theme | Suggested shapes |
|---|---|
| Poison / DoT | Skull: circle + eye-circles + jaw path |
| Shield break | Cracked shield: shield path + diagonal slash |
| Energy drain | Lightning bolt + downward arrow |
| Stun / Freeze | Snowflake or circles with radiating lines |
| Double hit | Two overlapping sword shapes offset |
| Lifesteal | Sword overlapping heart |

---

## Step 4 — Shop wiring (automatic, verify anyway)

The shop in `src/lib/game/shop.svelte.ts` picks from `CATALOG` filtered by rarity weights:
- 60% common, 30% rare, 10% epic

Cards with `price` defined and `rarity !== 'starter'` are automatically eligible for the shop. **No manual registration required.**

Verify by checking your card has:
- `price` field set (otherwise it won't appear in shop)
- `rarity` is `common`, `rare`, or `epic` (starter cards never appear in shop)

---

## Step 5 — Battle rules verification checklist

Read `src/lib/game/battle.svelte.ts` and confirm:

- [ ] `applyCardEffect()` has a case for this card's `kind` that uses the correct stat field.
- [ ] `shouldExhaust()` handles this card's exhaustion rule (or falls through to `false` for reusable cards).
- [ ] If the card has an element: type-effectiveness via `effectiveness(tpl.element, enemy.element)` is already applied for all `attack` cards — no extra code needed.
- [ ] If the card introduces a new per-battle state field (e.g., a poison counter): add it to `BattleState` in `src/lib/game/types.ts` AND initialize it in `startBattle()`.
- [ ] If the card should trigger something at end-of-turn: add the logic in `endPlayerTurn()` in `battle.svelte.ts`.

---

## Step 6 — Smoke test

Run the dev server and screenshot the shop and deck:

```bash
export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"
yarn dev > /tmp/pokengu-dev.log 2>&1 &
until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done

node .claude/skills/run-pokengu/driver.mjs ss shop
node .claude/skills/run-pokengu/driver.mjs ss deck
```

Screenshots land in `.claude/skills/run-pokengu/screenshots/`. Read them with the `Read` tool to confirm:
- New card icon renders (correct color and shape).
- Card appears in the shop slots after a refresh (may need several refreshes depending on rarity weight).
- Footer badges show the correct stat.

If a new `CardKind` was added, also screenshot battle to confirm the effect tooltip or badge is visible:
```bash
node .claude/skills/run-pokengu/driver.mjs ss battle
```

---

## Quick checklist before marking done

- [ ] `CardTemplate` added to `buildCatalog()` in `cards.ts` with valid `id`, `price`, and all required fields.
- [ ] `id` is unique — search `CARD_TEMPLATES` to confirm no collision.
- [ ] SVG icon added (or existing kind reused) in `CardKindIcon.svelte`.
- [ ] If new kind: `CardKind` type updated, `applyCardEffect` case added, `shouldExhaust` rule added, footer badge added.
- [ ] Shop eligibility confirmed: has `price`, non-starter rarity.
- [ ] Battle effect confirmed in `applyCardEffect`.
- [ ] No TypeScript errors (`yarn check` or check the Svelte LS).
- [ ] Screenshot confirms visual render.
