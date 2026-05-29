import { getDb } from './index';
import { getTemplate } from '$lib/data/cards';
import type { Card } from '$lib/game/types';

// ---- Inventário ----
export async function getInventory(): Promise<Card[]> {
	const db = await getDb();
	return db.getAll('cardInventory');
}

export async function addToInventory(card: Card): Promise<void> {
	const db = await getDb();
	await db.put('cardInventory', card, card.id);
}

export async function addManyToInventory(cards: Card[]): Promise<void> {
	const db = await getDb();
	const tx = db.transaction('cardInventory', 'readwrite');
	for (const c of cards) tx.store.put(c, c.id);
	await tx.done;
}

// ---- Deck ativo ----
export async function getActiveDeck(): Promise<Card[]> {
	const db = await getDb();
	return db.getAll('activeDeck');
}

export async function addToDeck(card: Card): Promise<void> {
	const db = await getDb();
	await db.put('activeDeck', card, card.id);
}

export async function removeFromDeck(cardId: string): Promise<void> {
	const db = await getDb();
	await db.delete('activeDeck', cardId);
}

export async function setActiveDeck(cards: Card[]): Promise<void> {
	const db = await getDb();
	const tx = db.transaction('activeDeck', 'readwrite');
	await tx.store.clear();
	for (const c of cards) tx.store.put(c, c.id);
	await tx.done;
}

/**
 * Após derrota: mantém no deck ativo apenas as cartas de raridade 'starter'.
 * Inventário e pokémons permanecem intactos.
 */
export async function resetDeckToStarters(): Promise<void> {
	const deck = await getActiveDeck();
	const kept = deck.filter((c) => getTemplate(c.templateId)?.rarity === 'starter');
	await setActiveDeck(kept);
}
