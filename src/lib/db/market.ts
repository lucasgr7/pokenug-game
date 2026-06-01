import { getDb } from './index';
import type { MarketState } from '$lib/game/types';

const MARKET_KEY = 'market';

export async function loadMarket(): Promise<MarketState | undefined> {
	const db = await getDb();
	return db.get('market', MARKET_KEY);
}

export async function saveMarket(state: MarketState): Promise<void> {
	const db = await getDb();
	await db.put('market', state, MARKET_KEY);
}
