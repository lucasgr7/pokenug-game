import type { Element } from '$lib/game/types';

export interface Challenge {
	id: string;
	name: string;
	desc: string;
	enemies: Element[];
	deckType: Element | 'size';
	deckLabel: string;
	deckEmoji: string;
	difficulty: number;
	reward: string;
	stripe: string;
	unlockRegionId: string | null;
}

export const CHALLENGES: Challenge[] = [
	{
		id: 'arena-lutador',
		name: 'Arena dos Lutadores',
		desc: 'Pokémons de luta dominam cada corredor. Traga o que os neutraliza.',
		enemies: ['fighting'],
		deckType: 'psychic',
		deckLabel: 'Deck de Psíquico',
		deckEmoji: '🔮',
		difficulty: 4,
		reward: 'Pedra ×200',
		stripe: '#ff4757',
		unlockRegionId: null
	},
	{
		id: 'maratona-35',
		name: 'Maratona das 35',
		desc: 'Deck limitado a 35 cartas. Cada slot conta. Nada de gordura.',
		enemies: ['normal', 'rock'],
		deckType: 'size',
		deckLabel: 'Máx. 35 Cartas',
		deckEmoji: '🃏',
		difficulty: 3,
		reward: 'XP Duplo',
		stripe: '#ffc24a',
		unlockRegionId: null
	},
	{
		id: 'purgatorio',
		name: 'Purgatório das Chamas',
		desc: 'Apenas pokémons de fogo. Somente água apaga essa fornalha.',
		enemies: ['fire'],
		deckType: 'water',
		deckLabel: 'Deck de Água',
		deckEmoji: '💧',
		difficulty: 5,
		reward: 'Água ×80',
		stripe: '#ff6b35',
		unlockRegionId: 'crystal_lake'
	},
	{
		id: 'monotype-psiquico',
		name: 'Mente Contra Matéria',
		desc: '35 cartas contra puro poder psíquico. Sem margens de erro.',
		enemies: ['psychic'],
		deckType: 'size',
		deckLabel: 'Máx. 35 Cartas',
		deckEmoji: '🃏',
		difficulty: 5,
		reward: 'Psíquico ×50',
		stripe: '#a86bff',
		unlockRegionId: 'psychic_tower'
	}
];
