import type { CapturedPokemon, PokemonMemory, PokemonRelationship } from './types';

export function ensureRelationship(p: CapturedPokemon): boolean {
	if (p.relationship) return false;
	p.relationship = { points: 0, memories: [], lastEventAt: 0 };
	return true;
}

export function pushMemory(p: CapturedPokemon, m: PokemonMemory): void {
	if (!p.relationship) {
		p.relationship = { points: 0, memories: [], lastEventAt: 0 };
	}
	p.relationship.memories.push(m);
}
