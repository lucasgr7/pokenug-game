export type Element =
	| 'fire'
	| 'water'
	| 'grass'
	| 'electric'
	| 'normal'
	| 'fighting'
	| 'psychic'
	| 'rock'
	| 'ground'
	| 'flying'
	| 'bug'
	| 'poison'
	| 'ghost'
	| 'ice'
	| 'dragon';

export const ELEMENTS: Element[] = [
	'fire',
	'water',
	'grass',
	'electric',
	'normal',
	'fighting',
	'psychic',
	'rock',
	'ground',
	'flying',
	'bug',
	'poison',
	'ghost',
	'ice',
	'dragon'
];

export type Theme = 'dark' | 'light';

export type RegionId = string;

export interface Player {
	id: 'me';
	name: string;
	createdAt: number;
	money: number;
	elementPoints: Partial<Record<Element, number>>;
	activePokemonId: string;
	defeatedByRegion: Record<RegionId, number>;
	unlockedRegions: RegionId[];
	theme: Theme;
	lastShopRefresh: number; // timestamp do último refresh diário
	paidRefreshCountToday: number; // contador para custo crescente
}

export interface CapturedPokemon {
	id: string; // uuid local (crypto.randomUUID)
	speciesId: number; // 1..151
	name: string;
	element: Element; // tipo primário (gen 1)
	maxHp: number; // base stat da PokeAPI
	currentHp: number; // HP persistente fora de batalha
	capturedAt: number;
}

export type CardRarity = 'starter' | 'common' | 'rare' | 'epic';
export type CardKind = 'attack' | 'defense' | 'heal' | 'capture' | 'buff';

export interface CardTemplate {
	id: string; // identificador estável (ex: 'atk_fire_12')
	name: string;
	description: string;
	cost: number; // mana
	kind: CardKind;
	element: Element | null; // null = sem elemento, não exaure por elemento
	rarity: CardRarity;
	damage?: number;
	block?: number;
	healHp?: number;
	buffAmount?: number; // bônus somado ao próximo dano (cartas de buff)
	captureBonus?: number; // soma à chance base (0..1)
	price?: { money: number; element?: { type: Element; amount: number } };
}

export interface Card {
	id: string; // uuid da instância
	templateId: string;
}

export type JobType = 'money' | Element;

export interface ActiveJob {
	pokemonId: string;
	jobType: JobType;
	startedAt: number;
	lastTickAt: number;
}

export interface Region {
	id: RegionId;
	name: string;
	description: string;
	pool: number[]; // species IDs
	requiredDefeats: number; // default 10
	unlockAfter: RegionId | null;
}

export type EnemyIntent =
	| { kind: 'attack'; damage: number }
	| { kind: 'defend'; block: number }
	| { kind: 'buff'; nextDamage: number };

export interface BattleReward {
	money: number;
	captured: CapturedPokemon | null;
	unlockedRegionName: string | null;
}

export interface SavedBattle {
	state: BattleState;
	reward: BattleReward | null;
	settled: boolean;
}

export interface BattleState {
	regionId: RegionId;
	player: {
		pokemon: CapturedPokemon;
		hp: number;
		block: number;
		mana: number;
		maxMana: 3;
		nextDamageBonus: number;
	};
	enemy: {
		pokemon: CapturedPokemon;
		hp: number;
		block: number;
		intent: EnemyIntent;
		nextDamageBonus: number;
	};
	deck: Card[];
	hand: Card[];
	discard: Card[];
	exhausted: Card[];
	turn: 'player' | 'enemy';
	turnNumber: number;
	status: 'active' | 'victory' | 'defeat' | 'captured';
}
