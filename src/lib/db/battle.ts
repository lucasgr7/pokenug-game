import { getDb } from './index';
import type { SavedBattle } from '$lib/game/types';

const KEY = 'current';

export async function getSavedBattle(): Promise<SavedBattle | undefined> {
	const db = await getDb();
	return db.get('battle', KEY);
}

export async function saveBattle(snapshot: SavedBattle): Promise<void> {
	const db = await getDb();
	await db.put('battle', snapshot, KEY);
}

export async function clearSavedBattle(): Promise<void> {
	const db = await getDb();
	await db.delete('battle', KEY);
}
