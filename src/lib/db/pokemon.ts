import { getDb } from './index';
import type { CapturedPokemon } from '$lib/game/types';

export async function addPokemon(p: CapturedPokemon): Promise<void> {
	const db = await getDb();
	await db.put('pokemon', p, p.id);
}

export async function getPokemon(id: string): Promise<CapturedPokemon | undefined> {
	const db = await getDb();
	return db.get('pokemon', id);
}

export async function getAllPokemon(): Promise<CapturedPokemon[]> {
	const db = await getDb();
	return db.getAll('pokemon');
}

export async function removePokemon(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('pokemon', id);
}
