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

// ---- Marketplace ----

export interface MarketPriceEntry {
	timestamp: number;
	price: number; // money per 100 element points
}

export interface ElementMarketData {
	currentPrice: number;
	lastRandomizedAt: number;
	lastDriftAt: number; // when hourly drift was last applied
	lastSnapshotAt: number;
	history: MarketPriceEntry[]; // max 17 entries (~4h of 15-min snapshots)
}

export interface MarketState {
	elements: Record<Element, ElementMarketData>;
	lastUpdatedAt: number;
}

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
	lastShopRefresh: number;
	paidRefreshCountToday: number;
	lastBoosterPackPurchaseAt: number;
	ngu: {
		moneyMultiplierLevel: number;
		elementalDamageLevels: ElementLevelMap;
		elementalHpLevels: ElementLevelMap;
		globalDamageLevel?: number;
	};
	// Campos de run persistentes (GDD)
	pilhaExaurir: number;          // ART-19 — contador de cartas Inseto exauridas nesta run
	bannedTemplateIds: string[];   // ART-20 — templateIds banidos nesta run
	ghostPermDebuff: number;       // Alma Penada — redução permanente acumulada de dano inimigo
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
	price?: { money: number; element?: { type: Element; amount: number } };

	// --- Novos campos do GDD ---

	// Exhaust behavior (ART-01/02)
	exhaust?: 'combat' | 'run';

	// POWER tag — só pode ser jogada uma vez por combate (ART-03)
	isPower?: boolean;

	// Efeitos de dano/status diretos
	selfDamage?: number;            // auto-dano (Fogo)
	cargaDragaoGain?: number;       // ART-07 — adiciona CARGA_DRAGAO
	imobilizadoTurns?: number;      // ART-04 — aplica IMOBILIZADO(X)
	fraquezaStacks?: number;        // ART-05 — aplica FRAQUEZA(X)
	enraizadoTurns?: number;        // ART-06 — aplica ENRAIZADO(X)
	selfMaxHpReduction?: number;    // Fantasma — reduz maxHp permanentemente

	// Artefatos booleanos/numéricos
	artReflexo?: boolean;           // ART-09 — ativa REFLEXO este turno
	artDuplicarCarta?: boolean;     // ART-10 — próxima carta não-POWER é executada duas vezes
	artDanoEletrico?: number;       // ART-11 — ativa DANO_ELETRICO com este valor por carta
	artCancelEscudo?: boolean;      // ART-12 — cancela escudo do inimigo este turno
	artReduzShield?: boolean;       // ART-13 — escudo do inimigo reduzido a 50% este turno
	artReduzBuff?: boolean;         // ART-14 — buff do inimigo reduzido a 50% este turno
	artAmplifica?: boolean;         // ART-15 — dobra todos os debuffs ativos no inimigo
	artCopiaDescarte?: number;      // ART-16 — cria cópia no descarte, valor = limite de cópias
	artSequencia?: boolean;         // ART-17 — ativa sistema SEQUENCIA (Punho Sincronizado)
	artAutoJogar?: boolean;         // ART-18 — ativa AUTO_JOGAR para cartas Lutador
	artPilhaExaurir?: number;       // ART-19 — delta adicionado à PILHA_EXAURIR
	artBanido?: boolean;            // ART-20 — carta é banida da run ao ser jogada
	artPrisaoEterna?: boolean;      // duplica duração do IMOBILIZADO ativo no inimigo
	artBlockDecrement?: boolean;    // Espinhos — o block desta carta decresce -1 a cada uso
	artFuriaDragao?: boolean;       // Fúria do Dragão — dano = 10 + cargaDragao
	artDuplicarDragao?: boolean;    // Poder Canalizado — Fúria do Dragão causa dobro esta luta
	artCongelamento?: boolean;      // Congelamento Progressivo — dano = 3 × cartas Gelo jogadas
	artRevengeShield?: number;      // Glaciação — causa este dano ao inimigo se escudo destruído
	artEndsTurn?: boolean;          // Evasão Total — termina turno do jogador imediatamente
	nextTurnBonusDraw?: number;     // bônus de compra no próximo turno
	nextTurnBonusMana?: number;     // bônus de mana no próximo turno
	artGrassDoubleIfEnraizado?: boolean; // Brotos Ofensivos — dobra dano se ENRAIZADO ativo
	artGhostPermDebuff?: boolean;   // Alma Penada — reduz dano do inimigo em 1 permanentemente
	generatesTokens?: { templateId: string; count: number }; // Nuvem de Insetos
}

export interface Card {
	id: string;
	templateId: string;
	modifier?: number; // ajuste permanente aplicado ao card (ex: Espinhos reduz block -1/uso)
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
	pool: number[]; // species IDs para encontros comuns
	bossPool: [number, number, number]; // apenas evolucoes finais da regiao
	requiredDefeats: number; // default 10
	unlockAfter: RegionId | null;
}

export type BattleMode = 'normal' | 'boss';

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
	elementPoints: { type: Element; amount: number };
	captured: CapturedPokemon | null;
	unlockedRegionName: string | null;
	bossCardReward: BossCardReward | null;
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
		nextDamageBonus: number;
		poisonCounter: number;
		berserk: boolean;
		dragonize: boolean;
		staticShockDamage: number;
		ghostForm: boolean;
		shieldEffect: 'none' | 'fire_thorns' | 'ice_reflect' | 'rock_persist';
		attackRepeat: number;
		specialize: boolean;
		// GDD artefatos
		shieldPersists: boolean;        // ART-08 — escudo não zera no início do próximo turno
		reflexoActive: boolean;         // ART-09 — ativo neste turno
		duplicarCartaActive: boolean;   // ART-10 — próxima carta não-POWER executa duas vezes
		danoEletricoBonus: number;      // ART-11 — dano bônus por carta jogada
		sequenciaActive: boolean;       // ART-17 — sistema de cadeia Lutador ativo
		sequenciaCount: number;         // ART-17 — contador de cartas Lutador consecutivas
		autoJogarActive: boolean;       // ART-18 — auto-play Lutador ativo
		cargaDragao: number;            // ART-07 — recurso acumulável Dragão
		cargaDragaoEnergyGranted: number; // ART-07 — grants de energia já concedidos (cada 4 pts)
		furiaDragaoDouble: boolean;     // Poder Canalizado — Fúria do Dragão causa dobro
		iceCardsPlayedThisCombat: number; // Congelamento Progressivo — contador de cartas Gelo
		nextTurnBonusDraw: number;      // Evasão Total — compra extra no próximo turno
		nextTurnBonusMana: number;      // Evasão Total — mana extra no próximo turno
		damageReceivedLastTurn: number; // Refluxo Mental — dano sofrido no turno anterior
		revengeShieldDamage: number;    // Glaciação — dano ao inimigo se escudo destruído
		firstAttackThisTurn: boolean;   // Golpe Aéreo — primeiro ataque do turno
		damageSufferedThisTurn: boolean; // Evasão — se sofreu dano neste turno
		autoJogarUsedThisTurn: number;  // ART-18 — cartas auto-jogadas neste turno (limite 3)
		assombracaoActive: boolean;     // Assombração Progressiva (POWER) ativa
		assombracaoBonus: number;       // bônus crescente (+1/turno) para cartas Fantasma
		rochaImovelPending: boolean;    // Rocha Imóvel — checar escudo no fim do turno
		ghostPermDebuff: number;        // Alma Penada — reduz dano inimigo em N flat (persiste na run)
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
		// GDD artefatos
		imobilizadoTurns: number;  // ART-04 — dano reduzido a 50% por X turnos
		enraizadoTurns: number;    // ART-06 — cartas Grama causam dobro
		fraquezaStacks: number;    // ART-05 — +25% dano recebido por stack
		shieldCancelled: boolean;  // ART-12 — reset a cada turno
		shieldReduced: boolean;    // ART-13 — reset a cada turno
		buffReduced: boolean;      // ART-14 — reset a cada turno
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
