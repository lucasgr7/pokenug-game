import { getDb, type ShopState } from './index';

const KEY = 'current';

export async function getShop(): Promise<ShopState | undefined> {
	const db = await getDb();
	return db.get('shop', KEY);
}

export async function saveShop(state: ShopState): Promise<void> {
	const db = await getDb();
	await db.put('shop', state, KEY);
}
