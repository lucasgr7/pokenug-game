import type { Region } from '$lib/game/types';

export const REGIONS: Region[] = [
	{
		id: 'verdant_forest',
		name: 'Floresta Verdejante',
		description: 'Árvores antigas e pokémons herbívoros.',
		pool: [10, 11, 13, 14, 16, 17, 43, 46, 48, 69],
		bossPool: [12, 45, 71],
		requiredDefeats: 10,
		unlockAfter: null,
		color: '#46c45f',
		emoji: '🌿',
		types: ['bug', 'grass'],
		bossType: 'grass',
		bossName: 'Venusaur Ancestral',
		bossDesc: 'O guardião secular da floresta. Veneno que corrói e raízes que prendem.'
	},
	{
		id: 'ember_cave',
		name: 'Caverna das Brasas',
		description: 'Calor sufocante e criaturas de fogo e rocha.',
		pool: [4, 5, 37, 58, 74, 75, 77, 126].filter((id) => id <= 151),
		bossPool: [6, 59, 76],
		requiredDefeats: 10,
		unlockAfter: 'verdant_forest',
		color: '#ff6b35',
		emoji: '🔥',
		types: ['fire', 'rock'],
		bossType: 'fire',
		bossName: 'Charizard das Profundezas',
		bossDesc: 'Chamas que derretem pedra. Um rugido que apaga as tochas.'
	},
	{
		id: 'crystal_lake',
		name: 'Lago de Cristal',
		description: 'Águas claras repletas de pokémons aquáticos.',
		pool: [7, 8, 60, 61, 72, 90, 98, 118, 129, 147],
		bossPool: [9, 62, 130],
		requiredDefeats: 10,
		unlockAfter: 'ember_cave',
		color: '#3ad6c2',
		emoji: '💧',
		types: ['water'],
		bossType: 'water',
		bossName: 'Blastoise das Marés',
		bossDesc: 'Senhor das correntes. Canhões que disparam a pressão do oceano.'
	},
	{
		id: 'thunder_plant',
		name: 'Usina Trovão',
		description: 'Correntes elétricas zunindo entre as máquinas.',
		pool: [25, 81, 100, 101, 125],
		bossPool: [26, 82, 135],
		requiredDefeats: 10,
		unlockAfter: 'crystal_lake',
		color: '#ffc24a',
		emoji: '⚡',
		types: ['electric'],
		bossType: 'electric',
		bossName: 'Raichu Overcharge',
		bossDesc: 'Descarga de dez mil volts.'
	},
	{
		id: 'rocky_ridge',
		name: 'Cordilheira Rochosa',
		description: 'Penhascos de pedra e terra batida.',
		pool: [27, 50, 74, 75, 95, 104, 105, 111],
		bossPool: [28, 76, 112],
		requiredDefeats: 10,
		unlockAfter: 'thunder_plant',
		color: '#c9a55a',
		emoji: '🏔️',
		types: ['rock', 'ground'],
		bossType: 'rock',
		bossName: 'Golem Titânico',
		bossDesc: 'Uma montanha que respira.'
	},
	{
		id: 'psychic_tower',
		name: 'Torre Psíquica',
		description: 'Energia mental e sombras inquietas.',
		pool: [63, 64, 92, 93, 96, 97, 122],
		bossPool: [65, 94, 150],
		requiredDefeats: 10,
		unlockAfter: 'rocky_ridge',
		color: '#a86bff',
		emoji: '🔮',
		types: ['psychic', 'ghost'],
		bossType: 'psychic',
		bossName: 'Mewtwo Prime',
		bossDesc: 'Poder que transcende a matéria.'
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
