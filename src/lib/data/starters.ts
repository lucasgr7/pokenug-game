import type { Element } from '$lib/game/types';

export interface StarterDef {
	speciesId: number;
	name: string;
	element: Element;
}

export const STARTERS: StarterDef[] = [
	{ speciesId: 1, name: 'Bulbasaur', element: 'grass' },
	{ speciesId: 4, name: 'Charmander', element: 'fire' },
	{ speciesId: 7, name: 'Squirtle', element: 'water' },
	{ speciesId: 25, name: 'Pikachu', element: 'electric' }
];
