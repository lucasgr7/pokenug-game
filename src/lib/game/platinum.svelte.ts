import type { Element, CardTemplate } from './types';
import { ELEMENT_LABEL } from '$lib/game/elements';
import { addPlatinum, spendPlatinum, spendMoney, game } from './state.svelte';
import { CATALOG } from '$lib/data/cards';
import { addManyToInventory } from '$lib/db/cards';
import { addPokemon } from '$lib/db/pokemon';
import { fetchPokemon } from '$lib/api/pokeapi';

// ---- Constants ----

export const PLATINUM_BASE_PRICE = 1_000_000;
export const PLATINUM_GROWTH = 1.10;
export const PLATINUM_PACK_COST = 3;
export const PLATINUM_PACK_SIZE = 3;

// ---- Reactive state ----

export const platinumDiscount = $state<{ value: { endsAt: number; pct: number } | null }>({ value: null });
export const platinumDiscountTick = $state<{ value: number }>({ value: 0 });

let platinumPrice = $state(PLATINUM_BASE_PRICE);
let nextPlatinumDiscountAt = 0;

const EVENT_MIN_INTERVAL_MS = 20 * 60_000;
const EVENT_MAX_INTERVAL_MS = 40 * 60_000;
const EVENT_MIN_DURATION_MS = 10 * 60_000;
const EVENT_MAX_DURATION_MS = 20 * 60_000;

// ---- Discount events ----

function checkPlatinumDiscount(now: number): void {
	if (nextPlatinumDiscountAt === 0) {
		nextPlatinumDiscountAt = now + EVENT_MIN_INTERVAL_MS + Math.random() * (EVENT_MAX_INTERVAL_MS - EVENT_MIN_INTERVAL_MS);
		return;
	}
	if (now < nextPlatinumDiscountAt) return;

	const pct = 0.15 + Math.random() * 0.10;
	const duration = EVENT_MIN_DURATION_MS + Math.random() * (EVENT_MAX_DURATION_MS - EVENT_MIN_DURATION_MS);
	platinumDiscount.value = { endsAt: now + duration, pct };
	platinumDiscountTick.value++;
	nextPlatinumDiscountAt = now + EVENT_MIN_INTERVAL_MS + Math.random() * (EVENT_MAX_INTERVAL_MS - EVENT_MIN_INTERVAL_MS);
}

export function initPlatinum(): void {
	// no DB persistence — price resets to base per session
	platinumPrice = PLATINUM_BASE_PRICE;
}

export function tickPlatinum(): void {
	const now = Date.now();
	checkPlatinumDiscount(now);
	if (platinumDiscount.value && now >= platinumDiscount.value.endsAt) {
		platinumDiscount.value = null;
	}
}

export function getPlatinumPrice(now = Date.now()): number {
	const discount = platinumDiscount.value && now < platinumDiscount.value.endsAt ? platinumDiscount.value.pct : 0;
	return Math.round(platinumPrice * (1 - discount));
}

export function estimatePlatinumCost(qty: number): number {
	const base = getPlatinumPrice();
	const r = PLATINUM_GROWTH;
	return Math.round(base * (Math.pow(r, qty) - 1) / (r - 1));
}

export interface TradeResult {
	success: boolean;
	message: string;
	total?: number;
}

export function buyPlatinum(qty = 1): TradeResult {
	if (qty <= 0) return { success: false, message: 'Quantidade inválida.' };

	const now = Date.now();
	let totalSpent = 0;
	let bought = 0;

	for (let i = 0; i < qty; i++) {
		const unit = getPlatinumPrice(now);
		if (game.player && game.player.money < unit) break;
		spendMoney(unit);
		addPlatinum(1);
		totalSpent += unit;
		bought++;
		platinumPrice = Math.round(platinumPrice * PLATINUM_GROWTH);
	}

	if (bought === 0) {
		return {
			success: false,
			message: `Dinheiro insuficiente. Necessário: 💰 ${getPlatinumPrice(now).toLocaleString('pt-BR')}`
		};
	}

	return {
		success: true,
		message: `⬡ +${bought} Platinum adquirido${bought > 1 ? 's' : ''}!`,
		total: totalSpent
	};
}

// ---- Platinum store ----

export async function buyElementPack(
	el: Element
): Promise<{ success: boolean; message: string; cards?: CardTemplate[] }> {
	const pool = CATALOG.filter((c) => c.element === el && c.rarity !== 'starter');
	if (pool.length === 0) {
		return { success: false, message: 'Nenhuma carta disponível para este elemento.' };
	}

	if (!spendPlatinum(PLATINUM_PACK_COST)) {
		return { success: false, message: 'Platinum insuficiente.' };
	}

	const weighted: CardTemplate[] = [];
	for (const c of pool) {
		const w = c.rarity === 'epic' ? 4 : c.rarity === 'rare' ? 3 : c.rarity === 'secret' ? 5 : 1;
		for (let i = 0; i < w; i++) weighted.push(c);
	}

	const picks: CardTemplate[] = [];
	for (let i = 0; i < PLATINUM_PACK_SIZE; i++) {
		picks.push(weighted[Math.floor(Math.random() * weighted.length)]);
	}

	const cards = picks.map((t) => ({ id: crypto.randomUUID(), templateId: t.id }));
	await addManyToInventory(cards);

	return { success: true, message: `${PLATINUM_PACK_SIZE} cartas de ${ELEMENT_LABEL[el]} adquiridas!`, cards: picks };
}

export const PLATINUM_POKEMON: { speciesId: number; name: string; element: Element; cost: number }[] = [
	{ speciesId: 151, name: 'Mew', element: 'psychic', cost: 10 },
	{ speciesId: 144, name: 'Articuno', element: 'ice', cost: 8 },
	{ speciesId: 145, name: 'Zapdos', element: 'electric', cost: 8 },
	{ speciesId: 146, name: 'Moltres', element: 'fire', cost: 8 },
	{ speciesId: 149, name: 'Dragonite', element: 'dragon', cost: 8 }
];

export async function buyPlatinumPokemon(speciesId: number): Promise<{ success: boolean; message: string }> {
	const entry = PLATINUM_POKEMON.find((p) => p.speciesId === speciesId);
	if (!entry) return { success: false, message: 'Pokémon não encontrado.' };
	if (!spendPlatinum(entry.cost)) return { success: false, message: 'Platinum insuficiente.' };

	let maxHp = 45;
	try {
		const data = await fetchPokemon(speciesId);
		maxHp = data.maxHp;
	} catch {
		// fallback
	}

	const pokemon = {
		id: crypto.randomUUID(),
		speciesId,
		name: entry.name,
		element: entry.element,
		maxHp,
		currentHp: maxHp,
		capturedAt: Date.now()
	};
	await addPokemon(pokemon);

	return { success: true, message: `${entry.name} capturado!` };
}
