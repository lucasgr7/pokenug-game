import { addManyToInventory, addToInventory } from '$lib/db/cards';
import { getShop, saveShop } from '$lib/db/shop';
import type { ShopState } from '$lib/db/index';
import { CATALOG, SECRET_TEMPLATES } from '$lib/data/cards';
import { pick } from '$lib/utils/rng';
import { isDifferentDay, now } from '$lib/utils/time';
import {
	activePokemon,
	applyElementalHpUpgradeToRoster,
	game,
	schedulePersist,
	spendElementPoints,
	spendMoney
} from './state.svelte';
import type { Card, CardTemplate, Element } from './types';

const SLOT_COUNT = 6;
type ShopSlot = CardTemplate & { sold?: boolean };

export interface BoosterPackOffer {
	id: 'secret_single' | 'secret_triple';
	name: string;
	description: string;
	price: number;
	cardCount: number;
}

export const shop = $state<{ slots: ShopSlot[]; loaded: boolean }>({ slots: [], loaded: false });

export const BOOSTER_PACKS: BoosterPackOffer[] = [
	{
		id: 'secret_single',
		name: 'Booster Secreto I',
		description: 'Abre 1 carta secreta aleatória.',
		price: 5000,
		cardCount: 1
	},
	{
		id: 'secret_triple',
		name: 'Booster Secreto II',
		description: 'Abre 3 cartas secretas aleatórias.',
		price: 12500,
		cardCount: 3
	}
];

export const NGU_COSTS = {
	incomeMultiplier: (level: number) => Math.floor(1000 * Math.pow(2.5, level)),
	elementalDamage: (level: number) => Math.floor(30 * Math.pow(2, level)),
	elementalVitamins: (level: number) => Math.floor(20 * Math.pow(2, level))
};
function rollSpecificSlot(level: number, filter: (c: CardTemplate) => boolean): ShopSlot {
	let pool = CATALOG.filter((c) => (c.tier ?? 1) <= level && filter(c));
	if (pool.length === 0) pool = CATALOG.filter(filter); // fallback
	if (pool.length === 0) pool = CATALOG; // ultimate fallback
	return { ...pick(pool), sold: false };
}

function generateSlots(): ShopSlot[] {
	const level = Math.max(1, game.player?.unlockedRegions.length ?? 1);
	const slots: ShopSlot[] = [];
	slots.push(rollSpecificSlot(level, c => c.kind === 'power' && c.rarity !== 'starter'));
	slots.push(rollSpecificSlot(level, c => c.kind === 'defense' && c.rarity !== 'starter'));
	for (let i = 0; i < 3; i++) {
		slots.push(rollSpecificSlot(level, c => c.kind === 'attack' && c.element != null && c.rarity !== 'starter'));
	}
	slots.push(rollSpecificSlot(level, c => c.rarity === 'rare' || c.rarity === 'epic'));
	return slots;
}

async function persistShop(): Promise<void> {
	const state: ShopState = { slots: $state.snapshot(shop.slots) as ShopSlot[], refreshedAt: now() };
	await saveShop(state);
}

/** Garante o refresh diário automático ao entrar na loja. */
export async function ensureShopLoaded(): Promise<void> {
	const stored = await getShop();
	const player = game.player;
	const needsDaily =
		!stored || !player || player.lastShopRefresh === 0 || isDifferentDay(player.lastShopRefresh, now());

	if (needsDaily) {
		shop.slots = generateSlots();
		if (player) {
			player.lastShopRefresh = now();
			player.paidRefreshCountToday = 0;
			schedulePersist();
		}
		await persistShop();
	} else {
		shop.slots = stored.slots;
	}
	shop.loaded = true;
}

export function paidRefreshCost(): number {
	const count = game.player?.paidRefreshCountToday ?? 0;
	return 50 * (count + 1) ** 2;
}

export async function paidRefresh(): Promise<boolean> {
	const cost = paidRefreshCost();
	if (!spendMoney(cost)) return false;
	shop.slots = generateSlots();
	if (game.player) {
		game.player.paidRefreshCountToday += 1;
		schedulePersist();
	}
	await persistShop();
	return true;
}

export function canAfford(slot: ShopSlot): boolean {
	const price = slot.price;
	if (!price) return false;
	const p = game.player;
	if (!p) return false;
	if (p.money < price.money) return false;
	if (price.element && (p.elementPoints[price.element.type] ?? 0) < price.element.amount) return false;
	return true;
}

export async function buySlot(index: number): Promise<boolean> {
	const slot = shop.slots[index];
	if (!slot || slot.sold || !slot.price || !canAfford(slot)) return false;

	if (!spendMoney(slot.price.money)) return false;
	if (slot.price.element) {
		if (!spendElementPoints(slot.price.element.type, slot.price.element.amount)) {
			// devolve o dinheiro se o pagamento por elemento falhar
			if (game.player) game.player.money += slot.price.money;
			return false;
		}
	}

	await addToInventory({ id: crypto.randomUUID(), templateId: slot.id });
	shop.slots[index] = { ...slot, sold: true };
	await persistShop();
	return true;
}

export async function buyIncomeMultiplier(): Promise<boolean> {
	if (!game.player) return false;
	const cost = NGU_COSTS.incomeMultiplier(game.player.ngu.moneyMultiplierLevel);
	if (!canAffordDirect(cost)) return false;

	if (!spendMoney(cost)) return false;
	game.player.ngu.moneyMultiplierLevel += 1;
	schedulePersist();
	return true;
}

function activeUpgradeElement(): Element | null {
	return activePokemon()?.element ?? null;
}

export async function buyElementalDamage(): Promise<boolean> {
	if (!game.player) return false;
	const element = activeUpgradeElement();
	if (!element) return false;

	const currentLevel = game.player.ngu.elementalDamageLevels[element] ?? 0;
	const cost = NGU_COSTS.elementalDamage(currentLevel);
	if (!spendElementPoints(element, cost)) return false;

	game.player.ngu.elementalDamageLevels[element] = currentLevel + 1;
	schedulePersist();
	return true;
}

export async function buyElementalVitamins(): Promise<boolean> {
	if (!game.player) return false;
	const element = activeUpgradeElement();
	if (!element) return false;

	const currentLevel = game.player.ngu.elementalHpLevels[element] ?? 0;
	const cost = NGU_COSTS.elementalVitamins(currentLevel);
	if (!spendElementPoints(element, cost)) return false;

	game.player.ngu.elementalHpLevels[element] = currentLevel + 1;
	await applyElementalHpUpgradeToRoster(element, 1);
	schedulePersist();

	return true;
}

export async function buyBoosterPack(packId: BoosterPackOffer['id']): Promise<CardTemplate[] | null> {
	const pack = BOOSTER_PACKS.find((entry) => entry.id === packId);
	if (!pack) return null;
	if (!spendMoney(pack.price)) return null;

	const rewards = Array.from({ length: pack.cardCount }, () => pick(SECRET_TEMPLATES));
	const rewardCards: Card[] = rewards.map((tpl) => ({ id: crypto.randomUUID(), templateId: tpl.id }));
	await addManyToInventory(rewardCards);
	return rewards;
}

function canAffordDirect(money: number): boolean {
	return (game.player?.money ?? 0) >= money;
}
