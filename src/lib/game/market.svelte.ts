import { ELEMENTS, type Element, type ElementMarketData, type MarketPriceEntry, type MarketState } from './types';
import { ELEMENT_LABEL } from '$lib/game/elements';
import { loadMarket, saveMarket } from '$lib/db/market';
import { addMoney, spendMoney, addElementPoints, spendElementPoints } from './state.svelte';

// ---- Constants ----

/** Element points per transaction (buy or sell). */
const UNIT = 100;
/** Starting price reference (money per UNIT). */
const BASE_PRICE = 1000;
const PRICE_FLOOR = 50;
const PRICE_CEILING = 50_000;
/** Price multiplier applied once per elapsed hour (natural inflation). */
const HOURLY_DRIFT = 1.01;
/** Price multiplier applied on each buy (+1%). */
const BUY_IMPACT = 1.01;
/** Price multiplier applied on each sell (-1%). */
const SELL_IMPACT = 0.99;
/** How often the market fully randomizes (ms). */
const RANDOMIZE_INTERVAL_MS = 4 * 60 * 60 * 1_000;
/** How often an automatic price snapshot is recorded (ms). */
const SNAPSHOT_INTERVAL_MS = 15 * 60 * 1_000;
/** Maximum history entries kept per element. */
const MAX_HISTORY = 17;

// ---- Helpers ----

function clampPrice(p: number): number {
	return Math.max(PRICE_FLOOR, Math.min(PRICE_CEILING, Math.round(p)));
}

function randMultiplier(): number {
	// Uniform in [0.70, 1.30]
	return 0.7 + Math.random() * 0.6;
}

function pushSnapshot(data: ElementMarketData, price: number, timestamp: number): void {
	data.history.push({ timestamp, price });
	if (data.history.length > MAX_HISTORY) {
		data.history.splice(0, data.history.length - MAX_HISTORY);
	}
}

function makeFreshElement(now: number): ElementMarketData {
	const price = clampPrice(BASE_PRICE * randMultiplier());
	return {
		currentPrice: price,
		lastRandomizedAt: now,
		lastDriftAt: now,
		lastSnapshotAt: now,
		history: [{ timestamp: now, price }]
	};
}

// ---- Core state ----

export const marketState = $state<{ value: MarketState | null }>({ value: null });

export async function initMarket(): Promise<void> {
	if (marketState.value) return;
	const saved = await loadMarket();
	if (saved) {
		marketState.value = saved;
	} else {
		const now = Date.now();
		const elements = {} as Record<Element, ElementMarketData>;
		for (const el of ELEMENTS) {
			elements[el] = makeFreshElement(now);
		}
		marketState.value = { elements, lastUpdatedAt: now };
		await saveMarket(structuredClone(marketState.value));
	}
}

// ---- Tick ----

/** Apply all pending time-based changes to a single element. */
function tickElement(el: Element, now: number): void {
	if (!marketState.value) return;
	const data = marketState.value.elements[el];

	const elapsedSinceReset = now - data.lastRandomizedAt;

	if (elapsedSinceReset >= RANDOMIZE_INTERVAL_MS) {
		// Apply drift up to the reset boundary first.
		const resetBoundary = data.lastRandomizedAt + RANDOMIZE_INTERVAL_MS;
		applyHourlyDrift(data, resetBoundary);

		// Snapshot before the jump (continuity).
		pushSnapshot(data, data.currentPrice, resetBoundary);

		// Randomize: new price stays close to current for "realism".
		const newPrice = clampPrice(data.currentPrice * randMultiplier());
		data.currentPrice = newPrice;
		data.lastRandomizedAt = now;
		data.lastDriftAt = now;
		data.lastSnapshotAt = now;
		pushSnapshot(data, newPrice, now);
	} else {
		applyHourlyDrift(data, now);

		// Auto-snapshot every 15 min.
		if (now - data.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
			pushSnapshot(data, data.currentPrice, now);
			data.lastSnapshotAt = now;
		}
	}
}

function applyHourlyDrift(data: ElementMarketData, targetTime: number): void {
	const elapsedMs = targetTime - data.lastDriftAt;
	const elapsedHours = Math.floor(elapsedMs / (60 * 60 * 1_000));
	if (elapsedHours <= 0) return;
	data.currentPrice = clampPrice(data.currentPrice * Math.pow(HOURLY_DRIFT, elapsedHours));
	data.lastDriftAt += elapsedHours * 60 * 60 * 1_000;
}

/** Tick all elements and persist. Should be called on mount and periodically. */
export async function tickAllElements(): Promise<void> {
	if (!marketState.value) return;
	const now = Date.now();
	for (const el of ELEMENTS) {
		tickElement(el, now);
	}
	marketState.value.lastUpdatedAt = now;
	await saveMarket(structuredClone(marketState.value));
}

// ---- Transactions ----

export interface TradeResult {
	success: boolean;
	message: string;
}

/** Buy 100 EP of `element` at current price. Increases price by 1%. */
export async function buyElementPoints(el: Element): Promise<TradeResult> {
	if (!marketState.value) return { success: false, message: 'Mercado não carregado.' };

	const data = marketState.value.elements[el];
	const cost = data.currentPrice;

	if (!spendMoney(cost)) {
		return {
			success: false,
			message: `Dinheiro insuficiente. Necessário: 💰 ${cost.toLocaleString('pt-BR')}`
		};
	}

	addElementPoints(el, UNIT);
	data.currentPrice = clampPrice(data.currentPrice * BUY_IMPACT);

	const now = Date.now();
	pushSnapshot(data, data.currentPrice, now);
	data.lastSnapshotAt = now;
	marketState.value.lastUpdatedAt = now;

	await saveMarket(structuredClone(marketState.value));
	return {
		success: true,
		message: `+100 pontos de ${ELEMENT_LABEL[el]} adquiridos!`
	};
}

/** Sell 100 EP of `element` at current price. Decreases price by 1%. */
export async function sellElementPoints(el: Element): Promise<TradeResult> {
	if (!marketState.value) return { success: false, message: 'Mercado não carregado.' };

	const data = marketState.value.elements[el];
	const gain = data.currentPrice;

	if (!spendElementPoints(el, UNIT)) {
		return {
			success: false,
			message: `Pontos insuficientes. Necessário: 100 pontos de ${ELEMENT_LABEL[el]}.`
		};
	}

	addMoney(gain);
	data.currentPrice = clampPrice(data.currentPrice * SELL_IMPACT);

	const now = Date.now();
	pushSnapshot(data, data.currentPrice, now);
	data.lastSnapshotAt = now;
	marketState.value.lastUpdatedAt = now;

	await saveMarket(structuredClone(marketState.value));
	return {
		success: true,
		message: `💰 ${gain.toLocaleString('pt-BR')} recebidos!`
	};
}

/** Next 4-hour reset countdown in ms (for the selected element). */
export function msUntilNextReset(el: Element): number {
	if (!marketState.value) return 0;
	const data = marketState.value.elements[el];
	return Math.max(0, RANDOMIZE_INTERVAL_MS - (Date.now() - data.lastRandomizedAt));
}

export { UNIT as MARKET_UNIT };
