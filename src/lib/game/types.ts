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

export type ElementLevelMap = Partial<Record<Element, number>>;

export interface Player {
	id: 'me';
	name: string;
	createdAt: number;
	money: number;
	elementPoints: Partial<Record<Element, number>>;
	activePokemonId: string | null;
	defeatedByRegion: Record<RegionId, number>;
	unlockedRegions: RegionId[];
	theme: Theme;
	lastShopRefresh: number; // timestamp do último refresh diário
	paidRefreshCountToday: number; // contador para custo crescente
	ngu: {
		moneyMultiplierLevel: number;
		elementalDamageLevels: ElementLevelMap;
		elementalHpLevels: ElementLevelMap;
		globalDamageLevel?: number; // legado, migrado para o elemento do pokémon ativo
	};
}

export interface CapturedPokemon {
	id: string; // uuid local (crypto.randomUUID)
	speciesId: number; // 1..151
	name: string;
	element: Element; // tipo primário (gen 1)
	maxHp: number; // base stat da PokeAPI
	currentHp: number; // HP persistente fora de batalha
	capturedAt: number;
	hpBuffs?: number;
	damageBuffs?: number;
}

export type CardRarity = 'starter' | 'common' | 'rare' | 'epic' | 'secret';
export type CardKind = 'attack' | 'defense' | 'heal' | 'capture' | 'buff' | 'power' | 'relic' | 'energy' | 'combo' | 'debuff';

export interface CardTemplate {
        id: string; // identificador estável (ex: 'atk_fire_12')
        name: string;
        description: string;
        cost: number; // mana
        kind: CardKind;
        element: Element | null; // null = sem elemento, não exaure por elemento
        rarity: CardRarity;
        tier?: number; // Nível em que a carta aparece na loja
        damage?: number;
        block?: number;
        healHp?: number;
        buffAmount?: number; // bônus somado ao próximo dano (cartas de buff)
        captureBonus?: number; // soma à chance base (0..1)
        poisonAmount?: number; // dano de veneno aplicado por turno
        manaGain?: number; // mana restaurado neste turno (cartas de energia)
        attackRepeat?: number; // golpes extras no próximo ataque (1 = dobra, 2 = triplica)
		drawCount?: number; // cartas compradas imediatamente ao jogar esta carta
        debuffAmount?: number; // redução de dano do inimigo (cartas de debuff)
        debuffDuration?: number; // turnos que o debuff dura
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
	| { kind: 'attack'; damage: number; element?: Element }
	| { kind: 'defend'; block: number }
	| { kind: 'buff'; nextDamage: number };

export interface BattleReward {
	money: number;
	elementPoints: { type: Element; amount: number };
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
		poisonCounter: number;
		berserk: boolean;
		dragonize: boolean;
		staticShockDamage: number;
		ghostForm: boolean;
		attackRepeat: number;
	};
	enemy: {
		pokemon: CapturedPokemon;
		hp: number;
		block: number;
		intent: EnemyIntent;
		nextDamageBonus: number;
		poisonCounter: number;
		intimidateTurnsLeft: number;
		intimidateDamageReduction: number;
	};
	deck: Card[];
	hand: Card[];
	discard: Card[];
	exhausted: Card[];
	relicSlots: Card[];
	turn: 'player' | 'enemy';
	turnNumber: number;
	status: 'active' | 'victory' | 'defeat' | 'captured';
}
