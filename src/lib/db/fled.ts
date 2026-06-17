import { getDb } from './index';
import type { FledPokemon } from '$lib/game/types';

export async function addFled(p: FledPokemon): Promise<void> {
	const db = await getDb();
	await db.put('fled', p, p.id);
}

export async function getAllFled(): Promise<FledPokemon[]> {
	const db = await getDb();
	return db.getAll('fled');
}

export async function removeFled(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('fled', id);
}
