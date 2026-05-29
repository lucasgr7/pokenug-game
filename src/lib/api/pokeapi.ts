import { ELEMENTS, type Element } from '$lib/game/types';

const BASE_URL = 'https://pokeapi.co/api/v2';

export interface PokemonData {
	id: number;
	name: string;
	element: Element; // tipo primário, mapeado de types[0]
	maxHp: number; // stats[0] (hp)
	artworkUrl: string; // sprites.other['official-artwork'].front_default
}

interface RawPokemon {
	id: number;
	name: string;
	types: Array<{ slot: number; type: { name: string } }>;
	stats: Array<{ base_stat: number; stat: { name: string } }>;
	sprites: {
		front_default: string | null;
		other?: { 'official-artwork'?: { front_default: string | null } };
	};
}

const elementSet = new Set<string>(ELEMENTS);

function mapElement(typeName: string): Element {
	return elementSet.has(typeName) ? (typeName as Element) : 'normal';
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// Cache em memória para evitar refetch da mesma espécie na sessão.
const cache = new Map<number, Promise<PokemonData>>();

export function fetchPokemon(id: number): Promise<PokemonData> {
	const cached = cache.get(id);
	if (cached) return cached;

	const p = (async (): Promise<PokemonData> => {
		const res = await fetch(`${BASE_URL}/pokemon/${id}`);
		if (!res.ok) throw new Error(`PokeAPI ${id}: ${res.status}`);
		const raw = (await res.json()) as RawPokemon;

		const primary = raw.types.find((t) => t.slot === 1) ?? raw.types[0];
		const hpStat = raw.stats.find((s) => s.stat.name === 'hp');
		const artworkUrl =
			raw.sprites.other?.['official-artwork']?.front_default ??
			raw.sprites.front_default ??
			'';

		return {
			id: raw.id,
			name: capitalize(raw.name),
			element: mapElement(primary?.type.name ?? 'normal'),
			maxHp: hpStat?.base_stat ?? 30,
			artworkUrl
		};
	})();

	cache.set(id, p);
	// Em caso de erro, remove do cache para permitir nova tentativa.
	p.catch(() => cache.delete(id));
	return p;
}
