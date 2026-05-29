import { addToInventory } from '$lib/db/cards';
import { getShop, saveShop } from '$lib/db/shop';
import type { ShopState } from '$lib/db/index';
import { CATALOG } from '$lib/data/cards';
import { pick, weightedPick } from '$lib/utils/rng';
import { isDifferentDay, now } from '$lib/utils/time';
import { game, schedulePersist, spendElementPoints, spendMoney } from './state.svelte';
import type { CardRarity, CardTemplate } from './types';

const SLOT_COUNT = 6;
type ShopSlot = CardTemplate & { sold?: boolean };

export const shop = $state<{ slots: ShopSlot[]; loaded: boolean }>({ slots: [], loaded: false });

const byRarity: Record<CardRarity, CardTemplate[]> = {
	starter: [],
	common: CATALOG.filter((c) => c.rarity === 'common'),
	rare: CATALOG.filter((c) => c.rarity === 'rare'),
	epic: CATALOG.filter((c) => c.rarity === 'epic')
};

function rollSlot(): ShopSlot {
	const rarity = weightedPick(['common', 'rare', 'epic'] as const, [60, 30, 10]);
	const poolForRarity = byRarity[rarity].length > 0 ? byRarity[rarity] : CATALOG;
	return { ...pick(poolForRarity), sold: false };
}

function generateSlots(): ShopSlot[] {
	return Array.from({ length: SLOT_COUNT }, rollSlot);
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
