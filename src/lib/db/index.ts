import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
	ActiveJob,
	Card,
	CapturedPokemon,
	CardTemplate,
	Player,
	SavedBattle,
	MarketState
} from '$lib/game/types';

export interface ShopState {
	slots: Array<CardTemplate & { sold?: boolean }>;
	refreshedAt: number;
}

export interface RegionProgress {
	defeats: number;
	bossLastDefeatedAt: number;
	bossFirstFightDone: boolean;
}

export interface PokenguDB extends DBSchema {
	player: {
		key: string;
		value: Player;
	};
	pokemon: {
		key: string;
		value: CapturedPokemon;
	};
	cardInventory: {
		key: string;
		value: Card;
	};
	activeDeck: {
		key: string;
		value: Card;
	};
	jobs: {
		key: string; // pokemonId
		value: ActiveJob;
	};
	regions: {
		key: string; // regionId
		value: RegionProgress;
	};
	sprites: {
		key: number; // speciesId
		value: Blob;
	};
	shop: {
		key: string;
		value: ShopState;
	};
	battle: {
		key: string;
		value: SavedBattle;
	};
	market: {
		key: string;
		value: MarketState;
	};
}

const DB_NAME = 'pokengu';
const DB_VERSION = 4; // v4: novo catálogo de cartas (GDD) — wipe de inventory/deck

let dbPromise: Promise<IDBPDatabase<PokenguDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PokenguDB>> {
	if (!dbPromise) {
		dbPromise = openDB<PokenguDB>(DB_NAME, DB_VERSION, {
			upgrade(db, oldVersion, _newVersion, transaction) {
				if (!db.objectStoreNames.contains('player')) db.createObjectStore('player');
				if (!db.objectStoreNames.contains('pokemon')) db.createObjectStore('pokemon');
				if (!db.objectStoreNames.contains('cardInventory'))
					db.createObjectStore('cardInventory');
				if (!db.objectStoreNames.contains('activeDeck')) db.createObjectStore('activeDeck');
				if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs');
				if (!db.objectStoreNames.contains('regions')) db.createObjectStore('regions');
				if (!db.objectStoreNames.contains('sprites')) db.createObjectStore('sprites');
				if (!db.objectStoreNames.contains('shop')) db.createObjectStore('shop');
				if (!db.objectStoreNames.contains('battle')) db.createObjectStore('battle');
				if (!db.objectStoreNames.contains('market')) db.createObjectStore('market');

				// Migração v4: IDs de cartas antigos são incompatíveis com o novo catálogo
				if (oldVersion < 4) {
					transaction.objectStore('cardInventory').clear();
					transaction.objectStore('activeDeck').clear();
				}
			}
		});
	}
	return dbPromise;
}
