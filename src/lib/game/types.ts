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
	activePokemonId: string | null;
	defeatedByRegion: Record<RegionId, number>;
	unlockedRegions: RegionId[];
	theme: Theme;
	lastShopRefresh: number;
	paidRefreshCountToday: number;
	lastBoosterPackPurchaseAt: number;
	ngu: {
		moneyMultiplierLevel: number;
	};
	// Campos de run persistentes (GDD)
	pilhaExaurir: number;          // ART-19 — contador de cartas Inseto exauridas nesta run
	bannedTemplateIds: string[];   // ART-20 — templateIds banidos nesta run
	ghostPermDebuff: number;       // Alma Penada — redução permanente acumulada de dano inimigo
	platinum: number;              // premium currency, market-only
	musicMuted?: boolean;          // persistência do mute de música
	lastSeenAt?: number;           // epoch ms, for offline HP catch-up
}

export type NatureId =
	| 'hardy' | 'lonely' | 'brave' | 'adamant' | 'naughty' | 'bold' | 'docile'
	| 'relaxed' | 'lax' | 'timid' | 'serious' | 'hasty' | 'quirky' | 'sassy' | 'modest';

export interface PokemonNatures {
	assigned: [NatureId, NatureId, NatureId];
	unlocked: [boolean, boolean, boolean];
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
	natures?: PokemonNatures;
	corrupted?: boolean;
}

export interface ActiveStatus {
  defId: string;
  stacks: number;
  data?: Record<string, number>;
}

export type StatusScope = 'player' | 'enemy';

export type CardRarity = 'starter' | 'common' | 'rare' | 'epic' | 'secret';
export type CardKind = 'attack' | 'defense' | 'heal' | 'capture' | 'buff' | 'power' | 'relic' | 'energy' | 'combo' | 'debuff';

export interface CardTemplate {
	id: string;
	name: string;
	description: string;
	cost: number;
	kind: CardKind;
	element: Element | null;
	rarity: CardRarity;
	tier?: number;
	damage?: number;
	block?: number;
	healHp?: number;
	buffAmount?: number;
	captureBonus?: number;
	poisonAmount?: number;
	manaGain?: number;
	attackRepeat?: number;
	drawCount?: number;
	debuffAmount?: number;
	debuffDuration?: number;
	shieldEffect?: 'fire_thorns' | 'ice_reflect' | 'rock_persist';
	price?: { money: number };

	// --- Campos do GDD ---

	exhaust?: 'combat' | 'run';
	isPower?: boolean;
	selfDamage?: number;
	selfMaxHpReduction?: number;
	endsTurn?: boolean;
	generatesTokens?: { templateId: string; count: number };
	appliesStatuses?: { id: string; stacks?: number; target?: StatusScope; data?: Record<string, number> }[];
}

export interface Card {
	id: string;
	templateId: string;
	modifier?: number;   // transient battle adjustment (e.g. Espinhos -1 block/use). NOT persisted.
	upgrades?: number;    // persisted permanent upgrade count (+N to damage/block). Default 0.
}

export type JobType = 'money';

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
	pool: number[]; // species IDs para encontros comuns
	bossPool: [number, number, number]; // apenas evolucoes finais da regiao
	requiredDefeats: number; // default 10
	unlockAfter: RegionId | null;

	// Display metadata
	color: string;
	emoji: string;
	types: Element[];
	bossType: Element;
	bossName: string;
	bossDesc: string;
}

export type BattleMode = 'normal' | 'boss' | 'missingno';

export interface BossCardReward {
	templateId: string;
	rarity: Exclude<CardRarity, 'starter'>;
	element: Element | null;
	name: string;
}

export type EnemyIntent =
	| { kind: 'attack'; damage: number; element?: Element }
	| { kind: 'defend'; block: number }
	| { kind: 'buff'; nextDamage: number };

export interface BattleReward {
	money: number;
	captured: CapturedPokemon | null;
	unlockedRegionName: string | null;
	cardReward: BossCardReward | null;
	cardChoices: BossCardReward[];
}

export interface SavedBattle {
	state: BattleState;
	reward: BattleReward | null;
	settled: boolean;
}

export interface BattleState {
	regionId: RegionId;
	mode: BattleMode;
	bossFirstFightBlockedCapture: boolean;
	player: {
		pokemon: CapturedPokemon;
		hp: number;
		block: number;
		mana: number;
		maxMana: 3;
		poisonCounter: number;
		ghostPermDebuff: number;
		statuses: ActiveStatus[];
		turnFlags: {
			firstAttackThisTurn: boolean;
			damageSufferedThisTurn: boolean;
			damageReceivedLastTurn: number;
			cardsPlayedThisTurn: number;
		};
	};
	enemy: {
		pokemon: CapturedPokemon;
		hp: number;
		block: number;
		intent: EnemyIntent;
		nextDamageBonus: number;
		poisonCounter: number;
		statuses: ActiveStatus[];
	};
	deck: Card[];
	hand: Card[];
	discard: Card[];
	exhausted: Card[];
	relicSlots: Card[];
	turn: 'player' | 'enemy';
	turnNumber: number;
	status: 'active' | 'victory' | 'defeat' | 'captured';
	usedPowerIds: string[];       // ART-03 — templateIds de POWER já jogadas neste combate
	bannedTemplateIds: string[];  // ART-20 — templateIds banidos (sincronizado com Player)
	pilhaExaurir: number;         // ART-19 — contador sincronizado com Player (persiste entre combates)
}
