# Plan: Remove Elemental Points

Goal: strip **all** elemental-points mechanics from Pokengu. Keep only **money** and **platinum**.
Hobby game — favor clean deletion over compatibility shims, but keep IndexedDB clean and avoid runtime crashes.

## Locked decisions

1. **Elemental damage/HP upgrades → removed entirely** (clean). Drop the `ngu.elementalDamageLevels` / `elementalHpLevels` / `globalDamageLevel` fields, the buy functions, **and** the combat-damage + max-HP bonuses they granted. Veterans lose that invested power — acceptable.
2. **Nature-unlock shop → removed.** Natures are still rolled and existing unlocked natures keep working in combat, but there is no unlock UI/flow (priced only in EP). A future system will replace it.
3. **Element market (buy/sell EP) → removed.** Platinum market stays (platinum is bought with money).
4. **Element jobs → removed.** Money job stays. On migration, any pokémon currently working an element job is moved to **idle** (its job is deleted).
5. **Card prices with an element component → keep money, drop the element part** (cards stay buyable for money). Same for card upgrades.

## Acceptance gate

- `yarn run check` → 0 errors (the CI gate).
- `yarn test` → 100% green (update specs that assert EP rewards / elemental damage).
- App boots for both a fresh player and a migrated legacy save without console errors; HUD shows only 💰 and ⬡.

---

## 1. Data model — `src/lib/game/types.ts`

- `Player`: delete `elementPoints`.
- `Player.ngu`: reduce to `{ moneyMultiplierLevel: number }` — delete `elementalDamageLevels`, `elementalHpLevels`, `globalDamageLevel`. Drop `ElementLevelMap` if now unused.
- `JobType`: change `'money' | Element` → `'money'`.
- `BattleReward`: delete the `elementPoints: { type; amount }` field.
- `CardTemplate.price`: change to `{ money: number }` (drop the optional `element`).
- Market types: delete `MarketPriceEntry`, `ElementMarketData`; reduce `MarketState` to `{ platinum: { price: number; candles: MarketCandle[] }; lastUpdatedAt: number }`. Keep `MarketCandle` (used by platinum).

## 2. Global state — `src/lib/game/state.svelte.ts`

- Delete `addElementPoints`, `spendElementPoints`, `getElementPoints`.
- Delete `getElementalDamageLevel`, `getElementalHpLevel`, `getElementalHpBonus`, `applyElementalHpBonusToPokemon`, `applyElementalHpUpgradeToRoster`, and the `HP_PER_ELEMENT_LEVEL` const.
- Delete `migrateLegacyNguProgress` and its call in `doInit` (it only migrates elemental damage/HP levels).
- `OfflineSummary`: drop `elementPoints`. Keep `money` + `elapsedMs`.
- Keep all platinum helpers untouched.

## 3. Jobs — `src/lib/game/jobs.svelte.ts`

- `creditPlayer`: keep only the `money` branch; delete the element branch.
- `applyOfflineProgress`: drop `elementPoints` from the summary; only accumulate money.
- **Migration (idle transfer):** add a one-time cleanup so any persisted job with `jobType !== 'money'` is removed (pokémon falls back to idle). Easiest: do it in the DB v5 upgrade (see §11). Also defensively filter in `loadJobs()` so a stale element job never renders.

## 4. Battle — `src/lib/game/battle.svelte.ts`

- Remove the `addElementPoints` import and its call (~L621); remove `ELEMENT_POINTS_PER_MAX_HP` and `elementAmount`.
- Remove `applyElementalHpBonusToPokemon` import + call on captured pokémon (~L631).
- `battle.reward`: delete the `elementPoints` field.
- Keep money reward + `moneyMultiplierLevel`.

## 5. Combat damage — `src/lib/game/damage.ts`

- Remove the `getElementalDamageLevel(...) * GLOBAL_DAMAGE_PER_LEVEL` term from the damage formula and delete the now-unused `GLOBAL_DAMAGE_PER_LEVEL` const + import.

## 6. Card display — `src/lib/components/Card.svelte`

- Remove `getElementalDamageLevel` import and the `... * 3` elemental term in the displayed-damage calc (~L109). Keep `upgradedDamage` + `damageBuffs`.

## 7. Shop logic — `src/lib/game/shop.svelte.ts`

- Drop imports `spendElementPoints`, `applyElementalHpUpgradeToRoster`.
- Delete `buyElementalDamage` and `buyElementalVitamins`.
- `NGU_COSTS`: keep `incomeMultiplier`; delete `elementalDamage` + `elementalVitamins`.
- `canAfford`: remove the `price.element` check.
- `buySlot`: remove the `slot.price.element` payment branch (money-only).

## 8. Card upgrades — `src/lib/game/upgrades.svelte.ts`

- Drop `spendElementPoints` import and `ELEMENT_BASE`.
- `cardUpgradeCost` → return `{ money }` only.
- `canAffordUpgrade` / `upgradeCardCopy` → money-only (remove element spend + the refund branch).

## 9. Natures

- Delete `src/lib/game/natures.svelte.ts` (`unlockNature`, `natureAffordable`, `canUnlockNature`) and all its imports.
- `src/lib/data/natures.ts`: remove `NATURE_UNLOCK_COSTS` + `natureUnlockCost` (only the deleted shop used them). **Keep** `NATURES`, `NATURE_IDS`, `rollNatures`, `ensurePokemonNatures`.
- Jobs page nature chips stay (read-only locked/unlocked display) and keep working.

## 10. Market

### `src/lib/game/market.svelte.ts`
- Delete all element-market code: `buyElementPoints`, `sellElementPoints`, `estimateBuyCost`, `estimateSellGain`, `getActiveEvent`, `getOracle`, `msUntilNextReset`, `makeFreshElement`, `tickElement`, the events/oracle/streak/drift helpers, and the per-element loop in `tickAllElements`. Remove EP-related imports (`addElementPoints`, `spendElementPoints`, `getElementPoints`, `ELEMENTS`, EP constants).
- **Keep platinum:** `buyPlatinum`, `getPlatinumPrice`, `estimatePlatinumCost`, `updatePlatinumCandle`, platinum discount logic, `buyElementPack` (platinum→cards, themed by element but paid in platinum), `buyPlatinumPokemon`, `PLATINUM_POKEMON`.
- `initMarket` builds platinum-only state; `tickAllElements` (rename optional) only ticks the platinum discount + platinum candle.

### `src/routes/market/+page.svelte`
- Make platinum-only: remove the element branch, the commodity selector, EP balance/handlers (`handleBuy`/`handleSell`, `epBalance`, `getElementPoints`, oracle/event/reset/trend derivations). Render the platinum chart + `PlatinumTradeControls` directly. Trim the info modal to platinum-relevant bullets.

### Components
- Delete `MarketSidebar.svelte`, `MarketElementItem.svelte`, `MarketTradeControls.svelte`.
- Keep `MarketChart.svelte`, `PlatinumTradeControls.svelte`, `PlatinumShop.svelte`. Verify `PlatinumShop.svelte` references no EP (it should only use platinum). Remove `GreatDealBurst.svelte` if no longer referenced.

## 11. Persistence / migration

### `src/lib/db/player.ts` (`ensureNgu`)
- On load, delete `player.elementPoints` and the elemental ngu fields; normalize `player.ngu` to `{ moneyMultiplierLevel }`. This cleans every legacy record the next time it's saved.

### `src/lib/db/index.ts`
- Bump `DB_VERSION` 4 → 5. In `upgrade()` for `oldVersion < 5`:
  - `transaction.objectStore('market').clear()` (rebuilds platinum-only on next load).
  - Iterate the `jobs` store and delete any entry whose `jobType !== 'money'` (the idle-transfer migration).
- `ShopState` / catalog types already money-only after §1.

## 12. UI cleanup

- **`src/lib/components/Hud.svelte`:** remove element chips (`elementChips`, `displayChips`, `elementEmoji`, expand toggle, `tradeEvent`/`hudTrades`). Keep 💰 money + ⬡ platinum.
- **`src/lib/stores/hud.svelte.ts`:** delete if only the HUD + element market used it (remove `notifyHudTrade` call sites first).
- **`src/lib/components/BattleResultModal.svelte`:** remove the `reward.elementPoints` reward row (~L279-284).
- **`src/routes/shop/+page.svelte`:** remove the Vitamins upgrade card, the entire nature-unlock section, and the dead imports (`getElementPoints`, `getElementalDamageLevel`, `getElementalHpLevel`, `buyElementalVitamins`, natures.svelte funcs, `NATURE_UNLOCK_COSTS`, `natureUnlockCost`). Keep income multiplier, booster packs, `PlatinumShop`, `CardUpgradePanel`.
- **`src/routes/jobs/+page.svelte`:** remove the "work element" button and simplify `jobLabel`/`jobColor` to money-only.
- **`src/routes/+layout.svelte`:** remove `applyElementalHpBonusToPokemon` import + call (~L160); update the offline-summary modal to stop rendering element-point gains (`OfflineSummary` no longer has them).

## 13. Catalog — `src/lib/data/cards.ts`

- Strip the `element: { type, amount }` part from every `price` (≈18 entries), keeping `{ money }`. (e.g. `price: { money: 300, element: { type: 'water', amount: 80 } }` → `price: { money: 300 }`.)

## 14. i18n (optional but requested "clean")

- In `src/lib/i18n/locales/pt-BR.json` + `en.json`, remove now-dead keys: `jobs.workElement`, `shop.vitamins*`, `shop.natures*`, and the element-market keys (`market.surge*`, `market.crash*`, `market.oracle*`, `market.infoBuySell/BuyImpact/SellImpact/Reset/...`). **Keep** all platinum keys. Don't remove keys still referenced — grep each before deleting.

## 15. Tests

- Update/remove specs asserting `reward.elementPoints`, elemental damage bonuses, or element jobs. Run `yarn test` and fix fallout. Don't delete `it.fails(...)` cases unless they were specifically about EP.

---

## Suggested order

1. Types (§1) → 2. state/jobs/battle/damage/Card (§2-6) → 3. shop/upgrades/natures (§7-9) → 4. market (§10) → 5. persistence (§11) → 6. UI + catalog (§12-13) → 7. i18n + tests (§14-15).
2. Run `yarn run check` after each cluster; finish with `yarn test` and a manual boot of a legacy save to confirm element jobs became idle and the HUD is clean.
