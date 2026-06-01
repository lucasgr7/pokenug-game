import type { Region } from '$lib/game/types';

export const REGIONS: Region[] = [
	{
		id: 'verdant_forest',
		name: 'Floresta Verdejante',
		description: 'Árvores antigas e pokémons herbívoros.',
		pool: [10, 11, 13, 14, 16, 17, 43, 46, 48, 69], // bug e grass (sem bosses)
		bossPool: [12, 45, 71],
		requiredDefeats: 10,
		unlockAfter: null
	},
	{
		id: 'ember_cave',
		name: 'Caverna das Brasas',
		description: 'Calor sufocante e criaturas de fogo e rocha.',
		pool: [4, 5, 37, 58, 74, 75, 77, 126].filter((id) => id <= 151), // fire/rock gen1 (sem bosses)
		bossPool: [6, 59, 76],
		requiredDefeats: 10,
		unlockAfter: 'verdant_forest'
	},
	{
		id: 'crystal_lake',
		name: 'Lago de Cristal',
		description: 'Águas claras repletas de pokémons aquáticos.',
		pool: [7, 8, 60, 61, 72, 90, 98, 118, 129, 147], // water (sem bosses)
		bossPool: [9, 62, 130],
		requiredDefeats: 10,
		unlockAfter: 'ember_cave'
	},
	{
		id: 'thunder_plant',
		name: 'Usina Trovão',
		description: 'Correntes elétricas zunindo entre as máquinas.',
		pool: [25, 81, 100, 101, 125], // electric (sem bosses)
		bossPool: [26, 82, 135],
		requiredDefeats: 10,
		unlockAfter: 'crystal_lake'
	},
	{
		id: 'rocky_ridge',
		name: 'Cordilheira Rochosa',
		description: 'Penhascos de pedra e terra batida.',
		pool: [27, 50, 74, 75, 95, 104, 105, 111], // rock/ground (sem bosses)
		bossPool: [28, 76, 112],
		requiredDefeats: 10,
		unlockAfter: 'thunder_plant'
	},
	{
		id: 'psychic_tower',
		name: 'Torre Psíquica',
		description: 'Energia mental e sombras inquietas.',
		pool: [63, 64, 92, 93, 96, 97, 122], // psychic/ghost (sem bosses)
		bossPool: [65, 94, 150],
		requiredDefeats: 10,
		unlockAfter: 'rocky_ridge'
	}
];

export function getRegion(id: string): Region | undefined {
	return REGIONS.find((r) => r.id === id);
}

export function nextRegion(id: string): Region | undefined {
	return REGIONS.find((r) => r.unlockAfter === id);
}

/** 
 * Returns a Fibonacci scaling multiplier for the given region index.
 * Region 0: 1x, Region 1: 2x, Region 2: 3x, Region 3: 5x, Region 4: 8x, Region 5: 13x
 */
export function getRegionScaling(regionId: string): number {
	const index = REGIONS.findIndex((r) => r.id === regionId);
	if (index <= 0) return 1;
	const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
	return fib[Math.min(index, fib.length - 1)];
}
