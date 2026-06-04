import {
	ELEMENTS,
	type Element,
	type ElementMarketData,
	type MarketCandle,
	type MarketPriceEntry,
	type MarketState,
	type CardTemplate
} from './types';
import { ELEMENT_LABEL } from '$lib/game/elements';
import { loadMarket, saveMarket } from '$lib/db/market';
import {
	addMoney,
	spendMoney,
	addElementPoints,
	spendElementPoints,
	addPlatinum,
	spendPlatinum,
	getElementPoints,
	game
} from './state.svelte';
import { CATALOG } from '$lib/data/cards';
import { addManyToInventory } from '$lib/db/cards';
import { addPokemon } from '$lib/db/pokemon';
import { fetchPokemon } from '$lib/api/pokeapi';

// ---- Constants ----

/** Element points per transaction unit (buy or sell). */
const UNIT = 100;
/** Starting price reference (money per UNIT). */
const BASE_PRICE = 1000;
const PRICE_FLOOR = 0;
const PRICE_CEILING = 50_000;
/** Price multiplier applied once per elapsed hour (neutral — no inflation). */
const HOURLY_DRIFT = 1.0;
/** Price multiplier applied on each buy unit (+2.5%). */
const BASE_BUY_IMPACT = 1.025;
/** Price multiplier applied on each sell unit (-2.5%). */
const BASE_SELL_IMPACT = 0.975;
/** How often the market fully randomizes (ms). */
const RANDOMIZE_INTERVAL_MS = 2 * 60 * 60 * 1_000;
/** How often an automatic price snapshot / candle is recorded (ms). */
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1_000;
/** Maximum history entries kept per element. */
const MAX_HISTORY = 17;
/** Maximum candle entries kept per element. */
const MAX_CANDLES = 24;
/** +1% extra impact per consecutive same-side unit. */
const STREAK_STEP = 0.01;
/** Cap extra impact at +15%. */
const STREAK_MAX_BONUS = 0.15;
/** Streak resets if no same-side trade within 30s. */
const STREAK_WINDOW_MS = 30_000;
/** Sells can crash up to -15% per unit at max streak. */
const SELL_IMPACT_FLOOR = 0.85;
/** Transaction fee burned on every trade (1%). */
export const TRADE_FEE_RATE = 0.01;
/** Events: min/max interval between events. */
const EVENT_MIN_INTERVAL_MS = 20 * 60_000;
const EVENT_MAX_INTERVAL_MS = 40 * 60_000;
/** Events: min/max duration. */
const EVENT_MIN_DURATION_MS = 10 * 60_000;
const EVENT_MAX_DURATION_MS = 20 * 60_000;
/** Surge: hourly drift x3. */
const SURGE_DRIFT_MULTIPLIER = 3;
/** Crash: -1.5%/min passive decay. */
const CRASH_DECAY_PER_MINUTE = 0.985;
/** Quantity step options for the UI. */
export const QUANTITY_STEPS = [100, 500, 1000, 5000, 10000, 50000, 100000];

// ---- Helpers ----

function clampPrice(p: number): number {
	return Math.max(PRICE_FLOOR, Math.min(PRICE_CEILING, Math.trunc(p)));
}

function randMultiplier(): number {
	// Symmetric: [0.80, 1.20], mean 1.0
	return 0.8 + Math.random() * 0.4;
}

function randInterval(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function pushSnapshot(data: ElementMarketData, price: number, timestamp: number): void {
	data.history.push({ timestamp, price });
	if (data.history.length > MAX_HISTORY) {
		data.history.splice(0, data.history.length - MAX_HISTORY);
	}
}

// ---- Candle helpers ----

function updateCandle(data: ElementMarketData, price: number, now: number): void {
	if (!data.candles) data.candles = [];
	const cur = data.candles[data.candles.length - 1];
	if (!cur || now - cur.t >= SNAPSHOT_INTERVAL_MS) {
		data.candles.push({ t: now, o: price, h: price, l: price, c: price });
		if (data.candles.length > MAX_CANDLES) data.candles.splice(0, data.candles.length - MAX_CANDLES);
	} else {
		cur.h = Math.max(cur.h, price);
		cur.l = Math.min(cur.l, price);
		cur.c = price;
	}
}

function ensureCandles(data: ElementMarketData, now: number): void {
	if (data.candles?.length) return;
	data.candles = (data.history ?? []).map((e) => ({
		t: e.timestamp,
		o: e.price,
		h: e.price,
		l: e.price,
		c: e.price
	}));
	if (!data.candles.length)
		data.candles = [{ t: now, o: data.currentPrice, h: data.currentPrice, l: data.currentPrice, c: data.currentPrice }];
}

// ---- Momentum / streak helpers ----

function bumpStreak(data: ElementMarketData, side: 'buy' | 'sell', now: number): void {
	const sameSideRecent = data.lastTradeSide === side && (now - (data.lastTradeAt ?? 0)) < STREAK_WINDOW_MS;
	if (side === 'buy') {
		data.buyStreak = sameSideRecent ? (data.buyStreak ?? 0) + 1 : 1;
		data.sellStreak = 0;
	} else {
		data.sellStreak = sameSideRecent ? (data.sellStreak ?? 0) + 1 : 1;
		data.buyStreak = 0;
	}
	data.lastTradeSide = side;
	data.lastTradeAt = now;
}

function effBuyImpact(data: ElementMarketData): number {
	return BASE_BUY_IMPACT + Math.min((data.buyStreak ?? 0) * STREAK_STEP, STREAK_MAX_BONUS);
}

function effSellImpact(data: ElementMarketData): number {
	return Math.max(SELL_IMPACT_FLOOR, BASE_SELL_IMPACT - Math.min((data.sellStreak ?? 0) * STREAK_STEP, STREAK_MAX_BONUS));
}

// ---- Fresh element ----

function makeFreshElement(now: number): ElementMarketData {
	const price = clampPrice(BASE_PRICE * randMultiplier());
	return {
		currentPrice: price,
		lastRandomizedAt: now,
		lastDriftAt: now,
		lastSnapshotAt: now,
		history: [{ timestamp: now, price }],
		candles: [{ t: now, o: price, h: price, l: price, c: price }],
		buyStreak: 0,
		sellStreak: 0,
		oracle: 'neutral'
	};
}

// ---- Oracle ----

function setOracle(data: ElementMarketData, newPrice: number): void {
	const wentUp = newPrice >= data.currentPrice;
	const r = Math.random();
	data.oracle = r < 0.6 ? (wentUp ? 'up' : 'down') : r < 0.85 ? (wentUp ? 'down' : 'up') : 'neutral';
}

// ---- Core state ----

export const marketState = $state<{ value: MarketState | null }>({ value: null });
export const platinumDiscount = $state<{ value: { endsAt: number; pct: number } | null }>({ value: null });
export const platinumDiscountTick = $state<{ value: number }>({ value: 0 });

let nextEventAt = 0;
let nextPlatinumDiscountAt = 0;

export async function initMarket(): Promise<void> {
	if (marketState.value) return;
	const saved = await loadMarket();
	if (saved) {
		marketState.value = saved;
		// Ensure any element with crashedAt is frozen at price 0.
		for (const el of ELEMENTS) {
			const d = marketState.value.elements[el];
			if (d.crashedAt) {
				d.currentPrice = 0;
			}
		}
	} else {
		const now = Date.now();
		const elements = {} as Record<Element, ElementMarketData>;
		for (const el of ELEMENTS) {
			elements[el] = makeFreshElement(now);
		}
		marketState.value = {
			elements,
			platinum: { price: PLATINUM_BASE_PRICE, candles: [{ t: now, o: PLATINUM_BASE_PRICE, h: PLATINUM_BASE_PRICE, l: PLATINUM_BASE_PRICE, c: PLATINUM_BASE_PRICE }] },
			lastUpdatedAt: now
		};
		await saveMarket($state.snapshot(marketState.value));
	}
	// Ensure platinum exists (migration safeguard).
	if (!marketState.value.platinum) {
		const now = Date.now();
		marketState.value.platinum = { price: PLATINUM_BASE_PRICE, candles: [{ t: now, o: PLATINUM_BASE_PRICE, h: PLATINUM_BASE_PRICE, l: PLATINUM_BASE_PRICE, c: PLATINUM_BASE_PRICE }] };
	}
}

// ---- Tick ----

/** Apply all pending time-based changes to a single element. */
function tickElement(el: Element, now: number): void {
	if (!marketState.value) return;
	const data = marketState.value.elements[el];

	ensureCandles(data, now);

	// Clear expired events
	if (data.event && now >= data.event.endsAt) {
		data.event = undefined;
	}

	// Market crash recovery: after 2h, reinitialize price.
	if (data.crashedAt && (now - data.crashedAt) >= RANDOMIZE_INTERVAL_MS) {
		const newPrice = clampPrice(BASE_PRICE * randMultiplier());
		data.currentPrice = newPrice;
		data.crashedAt = undefined;
		data.lastRandomizedAt = now;
		data.lastDriftAt = now;
		data.lastSnapshotAt = now;
		setOracle(data, newPrice);
		pushSnapshot(data, newPrice, now);
		updateCandle(data, newPrice, now);
		return;
	}

	// While crashed, freeze price at 0 and skip all tick processing.
	if (data.crashedAt) {
		data.currentPrice = 0;
		return;
	}

	const elapsedSinceReset = now - data.lastRandomizedAt;

	if (elapsedSinceReset >= RANDOMIZE_INTERVAL_MS) {
		// Apply drift up to the reset boundary first.
		const resetBoundary = data.lastRandomizedAt + RANDOMIZE_INTERVAL_MS;
		applyHourlyDrift(data, resetBoundary);

		// Snapshot before the jump (continuity).
		pushSnapshot(data, data.currentPrice, resetBoundary);
		updateCandle(data, data.currentPrice, resetBoundary);

		// Pure symmetric random walk (martingale) — no mean-reversion.
		const newPrice = clampPrice(data.currentPrice * randMultiplier());
		setOracle(data, newPrice);
		data.currentPrice = newPrice;
		data.lastRandomizedAt = now;
		data.lastDriftAt = now;
		data.lastSnapshotAt = now;
		pushSnapshot(data, newPrice, now);
		updateCandle(data, newPrice, now);
	} else {
		applyHourlyDrift(data, now);

		// Auto-snapshot every SNAPSHOT_INTERVAL_MS.
		if (now - data.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
			pushSnapshot(data, data.currentPrice, now);
			updateCandle(data, data.currentPrice, now);
			data.lastSnapshotAt = now;
		}
	}
}

function applyHourlyDrift(data: ElementMarketData, targetTime: number): void {
	const elapsedMs = targetTime - data.lastDriftAt;
	const elapsedHours = Math.floor(elapsedMs / (60 * 60 * 1_000));
	if (elapsedHours <= 0) return;

	if (data.event?.kind === 'surge') {
		data.currentPrice = clampPrice(
			data.currentPrice * Math.pow(HOURLY_DRIFT * SURGE_DRIFT_MULTIPLIER, elapsedHours)
		);
	} else if (data.event?.kind === 'crash') {
		const elapsedMinutes = Math.floor(elapsedMs / 60_000);
		data.currentPrice = clampPrice(data.currentPrice * Math.pow(CRASH_DECAY_PER_MINUTE, elapsedMinutes));
	} else {
		data.currentPrice = clampPrice(data.currentPrice * Math.pow(HOURLY_DRIFT, elapsedHours));
	}
	data.lastDriftAt += elapsedHours * 60 * 60 * 1_000;
}

// ---- Events ----

function checkAndFireEvents(now: number): void {
	if (!marketState.value) return;
	if (nextEventAt === 0) {
		nextEventAt = now + randInterval(EVENT_MIN_INTERVAL_MS, EVENT_MAX_INTERVAL_MS);
		return;
	}
	if (now < nextEventAt) return;

	const el = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
	const kind: 'surge' | 'crash' = Math.random() < 0.5 ? 'surge' : 'crash';
	const duration = randInterval(EVENT_MIN_DURATION_MS, EVENT_MAX_DURATION_MS);
	const data = marketState.value.elements[el];

	data.event = { kind, startsAt: now, endsAt: now + duration };

	nextEventAt = now + randInterval(EVENT_MIN_INTERVAL_MS, EVENT_MAX_INTERVAL_MS);
}

// ---- Platinum Discount ----

function checkPlatinumDiscount(now: number): void {
	if (nextPlatinumDiscountAt === 0) {
		nextPlatinumDiscountAt = now + randInterval(EVENT_MIN_INTERVAL_MS, EVENT_MAX_INTERVAL_MS);
		return;
	}
	if (now < nextPlatinumDiscountAt) return;

	const pct = 0.15 + Math.random() * 0.10;
	const duration = randInterval(EVENT_MIN_DURATION_MS, EVENT_MAX_DURATION_MS);
	platinumDiscount.value = {
		endsAt: now + duration,
		pct
	};
	platinumDiscountTick.value++;
	nextPlatinumDiscountAt = now + randInterval(EVENT_MIN_INTERVAL_MS, EVENT_MAX_INTERVAL_MS);
}

/** Tick all elements and persist. Should be called on mount and periodically. */
export async function tickAllElements(): Promise<void> {
	if (!marketState.value) return;
	const now = Date.now();
	checkAndFireEvents(now);
	checkPlatinumDiscount(now);

	// Clear expired platinum discount
	if (platinumDiscount.value && now >= platinumDiscount.value.endsAt) {
		platinumDiscount.value = null;
	}

	for (const el of ELEMENTS) {
		tickElement(el, now);
	}
	// Safety: ensure crashed elements stay frozen at 0 before persisting.
	for (const el of ELEMENTS) {
		const d = marketState.value.elements[el];
		if (d.crashedAt) d.currentPrice = 0;
	}
	if (marketState.value.platinum) {
		updatePlatinumCandle(now);
	}
	marketState.value.lastUpdatedAt = now;
	await saveMarket($state.snapshot(marketState.value));
}

// ---- Transactions ----

export interface TradeResult {
	success: boolean;
	message: string;
	total?: number;
	fee?: number;
	greatDeal?: boolean;
}

/** Buy `qty` EP of `element` at current price. Default 100. */
export async function buyElementPoints(el: Element, qty = UNIT): Promise<TradeResult> {
	if (!marketState.value) return { success: false, message: 'Mercado não carregado.' };
	if (qty <= 0 || qty % UNIT !== 0) return { success: false, message: 'Quantidade inválida.' };

	const data = marketState.value.elements[el];
	if (data.crashedAt) {
		return { success: false, message: `🔴 Mercado em crash! Negociações suspensas para ${ELEMENT_LABEL[el]}. Reabre em ~2h.` };
	}
	const units = qty / UNIT;
	const now = Date.now();

	// Pre-simulate total cost (impact-first model + fee)
	let simPrice = data.currentPrice;
	let simBuyStreak = data.buyStreak ?? 0;
	let totalCost = 0;
	for (let i = 0; i < units; i++) {
		const sameSide = data.lastTradeSide === 'buy' && (now - (data.lastTradeAt ?? 0)) < STREAK_WINDOW_MS;
		simBuyStreak = sameSide ? simBuyStreak + 1 : 1;
		const impact = BASE_BUY_IMPACT + Math.min(simBuyStreak * STREAK_STEP, STREAK_MAX_BONUS);
		simPrice = clampPrice(simPrice * impact);
		totalCost += Math.ceil(simPrice * (1 + TRADE_FEE_RATE));
	}

	const p = game_player();
	if (!p || p.money < totalCost) {
		return {
			success: false,
			message: `Dinheiro insuficiente. Necessário: 💰 ${totalCost.toLocaleString('pt-BR')}`
		};
	}

	// Execute — bump streak first, compute premium price, then execute at that price
	let total = 0;
	let totalFee = 0;
	for (let i = 0; i < units; i++) {
		bumpStreak(data, 'buy', now);
		const buyPrice = clampPrice(data.currentPrice * effBuyImpact(data));
		const fee = Math.ceil(buyPrice * TRADE_FEE_RATE);
		spendMoney(buyPrice + fee);
		addElementPoints(el, UNIT);
		total += buyPrice;
		totalFee += fee;
		data.currentPrice = buyPrice;
		updateCandle(data, data.currentPrice, now);
	}

	pushSnapshot(data, data.currentPrice, now);
	data.lastSnapshotAt = now;
	marketState.value.lastUpdatedAt = now;

	const greatDeal = data.event?.kind === 'crash';

	await saveMarket($state.snapshot(marketState.value));
	return {
		success: true,
		message: `+${qty.toLocaleString('pt-BR')} pontos de ${ELEMENT_LABEL[el]} adquiridos!`,
		total,
		fee: totalFee,
		greatDeal
	};
}

/** Sell `qty` EP of `element` at current price. Default 100. */
export async function sellElementPoints(el: Element, qty = UNIT): Promise<TradeResult> {
	if (!marketState.value) return { success: false, message: 'Mercado não carregado.' };
	if (qty <= 0 || qty % UNIT !== 0) return { success: false, message: 'Quantidade inválida.' };

	const data = marketState.value.elements[el];
	if (data.crashedAt) {
		return { success: false, message: `🔴 Mercado em crash! Negociações suspensas para ${ELEMENT_LABEL[el]}. Reabre em ~2h.` };
	}
	const units = qty / UNIT;
	const now = Date.now();

	// Pre-check EP balance
	const ep = epBalance(el);
	if (ep < qty) {
		return {
			success: false,
			message: `Pontos insuficientes. Necessário: ${qty.toLocaleString('pt-BR')} pontos de ${ELEMENT_LABEL[el]}.`
		};
	}

	let total = 0;
	let totalFee = 0;
	for (let i = 0; i < units; i++) {
		bumpStreak(data, 'sell', now);
		const sellPrice = clampPrice(data.currentPrice * effSellImpact(data));
		const fee = Math.ceil(sellPrice * TRADE_FEE_RATE);
		spendElementPoints(el, UNIT);
		addMoney(sellPrice - fee);
		total += sellPrice;
		totalFee += fee;
		data.currentPrice = sellPrice;
		updateCandle(data, data.currentPrice, now);
	}

	pushSnapshot(data, data.currentPrice, now);
	data.lastSnapshotAt = now;
	// If price hit 0, mark crash so market stays frozen until next reset.
	if (data.currentPrice <= 0) {
		data.crashedAt = now;
	}
	marketState.value.lastUpdatedAt = now;

	const greatDeal = data.event?.kind === 'surge';

	await saveMarket($state.snapshot(marketState.value));
	return {
		success: true,
		message: `💰 ${total.toLocaleString('pt-BR')} recebidos!`,
		total,
		fee: totalFee,
		greatDeal
	};
}

// ---- Preview helpers (no mutation) ----

export function estimateBuyCost(el: Element, units: number): number {
	if (!marketState.value) return 0;
	const data = marketState.value.elements[el];
	if (data.crashedAt) return Infinity;
	let price = data.currentPrice;
	let total = 0;
	let streak = data.buyStreak ?? 0;
	const now = Date.now();
	for (let i = 0; i < units; i++) {
		const sameSide = data.lastTradeSide === 'buy' && (now - (data.lastTradeAt ?? 0)) < STREAK_WINDOW_MS;
		streak = sameSide ? streak + 1 : 1;
		const impact = BASE_BUY_IMPACT + Math.min(streak * STREAK_STEP, STREAK_MAX_BONUS);
		price = clampPrice(price * impact);
		total += Math.ceil(price * (1 + TRADE_FEE_RATE));
	}
	return total;
}

export function estimateSellGain(el: Element, units: number): number {
	if (!marketState.value) return 0;
	const data = marketState.value.elements[el];
	if (data.crashedAt) return 0;
	let price = data.currentPrice;
	let total = 0;
	let streak = data.sellStreak ?? 0;
	const now = Date.now();
	for (let i = 0; i < units; i++) {
		const sameSide = data.lastTradeSide === 'sell' && (now - (data.lastTradeAt ?? 0)) < STREAK_WINDOW_MS;
		streak = sameSide ? streak + 1 : 1;
		const impact = Math.max(SELL_IMPACT_FLOOR, BASE_SELL_IMPACT - Math.min(streak * STREAK_STEP, STREAK_MAX_BONUS));
		price = clampPrice(price * impact);
		total += Math.ceil(price * (1 - TRADE_FEE_RATE));
	}
	return total;
}

// ---- Event / oracle readers ----

export function getActiveEvent(el: Element): { kind: 'surge' | 'crash'; startsAt: number; endsAt: number } | null {
	const e = marketState.value?.elements[el]?.event;
	return e ?? null;
}

export function getOracle(el: Element): 'up' | 'down' | 'neutral' {
	return marketState.value?.elements[el]?.oracle ?? 'neutral';
}

/** Next reset countdown in ms (for the selected element). */
export function msUntilNextReset(el: Element): number {
	if (!marketState.value) return 0;
	const data = marketState.value.elements[el];
	return Math.max(0, RANDOMIZE_INTERVAL_MS - (Date.now() - data.lastRandomizedAt));
}

// ---- Platinum commodity (buy-only, escalating price) ----

export const PLATINUM_BASE_PRICE = 1_000_000;
export const PLATINUM_GROWTH = 1.10;

function updatePlatinumCandle(now: number): void {
	if (!marketState.value?.platinum) return;
	const candles = marketState.value.platinum.candles;
	const price = marketState.value.platinum.price;
	const cur = candles[candles.length - 1];
	if (!cur || now - cur.t >= SNAPSHOT_INTERVAL_MS) {
		candles.push({ t: now, o: price, h: price, l: price, c: price });
		if (candles.length > MAX_CANDLES) candles.splice(0, candles.length - MAX_CANDLES);
	} else {
		cur.h = Math.max(cur.h, price);
		cur.l = Math.min(cur.l, price);
		cur.c = price;
	}
}

export function getPlatinumPrice(now = Date.now()): number {
	if (!marketState.value?.platinum) return PLATINUM_BASE_PRICE;
	const p = marketState.value.platinum.price;
	const discount = platinumDiscount.value && now < platinumDiscount.value.endsAt ? platinumDiscount.value.pct : 0;
	return Math.round(p * (1 - discount));
}

export function estimatePlatinumCost(qty: number): number {
	if (!marketState.value?.platinum) return qty * PLATINUM_BASE_PRICE;
	const base = getPlatinumPrice();
	// Geometric sum: base * (1 + r + r^2 + ... + r^(qty-1)) where r = PLATINUM_GROWTH
	const r = PLATINUM_GROWTH;
	return Math.round(base * (Math.pow(r, qty) - 1) / (r - 1));
}

export async function buyPlatinum(qty = 1): Promise<TradeResult> {
	if (!marketState.value?.platinum) return { success: false, message: 'Mercado não carregado.' };
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
		marketState.value.platinum.price = Math.round(marketState.value.platinum.price * PLATINUM_GROWTH);
		updatePlatinumCandle(now);
	}

	if (bought === 0) {
		return { success: false, message: `Dinheiro insuficiente. Necessário: 💰 ${getPlatinumPrice(now).toLocaleString('pt-BR')}` };
	}

	marketState.value.lastUpdatedAt = now;
	await saveMarket($state.snapshot(marketState.value));
	return {
		success: true,
		message: `⬡ +${bought} Platinum adquirido${bought > 1 ? 's' : ''}!`,
		total: totalSpent
	};
}

// ---- Platinum store ----

export const PLATINUM_PACK_COST = 3;
export const PLATINUM_PACK_SIZE = 3;

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

	// Weight toward rare/epic
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

// ---- Internal helpers ----

function epBalance(el: Element): number {
	return getElementPoints(el);
}

function game_player() {
	return game.player;
}

export { UNIT as MARKET_UNIT };
