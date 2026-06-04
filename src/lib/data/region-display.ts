import type { Element } from '$lib/game/types';

export interface RegionDisplayInfo {
	color: string;
	emoji: string;
	types: Element[];
	bossType: Element;
	bossName: string;
	bossDesc: string;
}

export const REGION_DISPLAY: Record<string, RegionDisplayInfo> = {
	verdant_forest: {
		color: '#46c45f',
		emoji: '🌿',
		types: ['bug', 'grass'],
		bossType: 'grass',
		bossName: 'Venusaur Ancestral',
		bossDesc: 'O guardião secular da floresta. Veneno que corrói e raízes que prendem.'
	},
	ember_cave: {
		color: '#ff6b35',
		emoji: '🔥',
		types: ['fire', 'rock'],
		bossType: 'fire',
		bossName: 'Charizard das Profundezas',
		bossDesc: 'Chamas que derretem pedra. Um rugido que apaga as tochas.'
	},
	crystal_lake: {
		color: '#3ad6c2',
		emoji: '💧',
		types: ['water'],
		bossType: 'water',
		bossName: 'Blastoise das Marés',
		bossDesc: 'Senhor das correntes. Canhões que disparam a pressão do oceano.'
	},
	thunder_plant: {
		color: '#ffc24a',
		emoji: '⚡',
		types: ['electric'],
		bossType: 'electric',
		bossName: 'Raichu Overcharge',
		bossDesc: 'Descarga de dez mil volts.'
	},
	rocky_ridge: {
		color: '#c9a55a',
		emoji: '🏔️',
		types: ['rock', 'ground'],
		bossType: 'rock',
		bossName: 'Golem Titânico',
		bossDesc: 'Uma montanha que respira.'
	},
	psychic_tower: {
		color: '#a86bff',
		emoji: '🔮',
		types: ['psychic', 'ghost'],
		bossType: 'psychic',
		bossName: 'Mewtwo Prime',
		bossDesc: 'Poder que transcende a matéria.'
	}
};
