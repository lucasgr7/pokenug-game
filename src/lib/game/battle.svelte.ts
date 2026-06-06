import { addToInventory, getActiveDeck, getInventory, removeFromDeck, removeFromInventory } from '$lib/db/cards';
import { resetDeckToStarters } from '$lib/db/cards';
import { addPokemon } from '$lib/db/pokemon';
import {
	canFightBoss,
	getRegionProgress,
	incrementDefeat,
	markBossDefeated,
	markBossFightDone
} from '$lib/db/regions';
import { clearSavedBattle, getSavedBattle, saveBattle } from '$lib/db/battle';
import { CATALOG, getTemplate } from '$lib/data/cards';
import { savePlayer } from '$lib/db/player';
import { getRegion, nextRegion, getRegionScaling } from '$lib/data/regions';
import { fetchPokemon } from '$lib/api/pokeapi';
import { ensurePokemonNatures } from '$lib/data/natures';
import { applyCardEffect } from './cards/apply';
import { isPermanentlyConsumed, resolveTypedDamage } from './damage';
import type { CardEffectCtx } from './cards/types';
import {
	addStatus,
	hasStatus,
	removeStatus,
	getStatus,
	collectEmblems,
	setMutationApi,
	setBattleState,
	runIncomingDamage,
	dispatchOnCardPlayed,
	dispatchOnTurnStart,
	dispatchOnTurnEnd,
	dispatchOnBattleStart,
	dispatchOnBattleStartAfterDraw,
	runCardCost,
	runModifyHandSize,
	runShouldExhaust,
	dispatchOnCardExhausted,
	decayStatuses,
	logEvent,
	drainEvents
} from './status/pipeline';
import { getStatusDef } from './status';
import type { ActiveStatus, BattleEvent } from './status/types';
import { pick, randomInt, shuffle, weightedPick } from '$lib/utils/rng';
import { now } from '$lib/utils/time';
import {
	activePokemon,
	addElementPoints,
	addMoney,
	addToRoster,
	applyElementalHpBonusToPokemon,
	game,
	normalizedPokemonHp,
	recordDefeat,
	setPokemonCurrentHp,
	setActivePokemon,
	unlockRegion
} from './state.svelte';
import type {
	BattleMode,
	BossCardReward,
	BattleReward,
	BattleState,
	Card,
	CardKind,
	CardRarity,
	CardTemplate,
	CapturedPokemon,
	Element,
	EnemyIntent,
	SavedBattle
} from './types';
import { ELEMENTS } from './types';
import { MISSINGNO_MAX_HP, MISSINGNO_ACT1_DAMAGE, MISSINGNO_TURN_DAMAGE } from '$lib/data/missingno';

// Callback hook for MissingNo mode — called when player HP hits 0 instead of defeat.
let onPlayerDefeatedInMissingNo: (() => void) | null = null;
export function setOnMissingNoDefeat(fn: () => void): void {
	onPlayerDefeatedInMissingNo = fn;
}

interface BattleStore {
	state: BattleState | null;
	reward: BattleReward | null;
	settled: boolean;
	// Toggled each hit to drive Svelte #key animations in the battle UI.
	enemyHurt: number;
	playerHurt: number;
	introPending: boolean; // sinaliza batalha nova (não retomada) para tocar intro
}

export const battle = $state<BattleStore>({
	state: null,
	reward: null,
	settled: false,
	enemyHurt: 0,
	playerHurt: 0,
	introPending: false
});

const HAND_SIZE = 5;
const START_MANA = 3;
const ELEMENT_POINTS_PER_MAX_HP = 15; // floor(enemyMaxHp / this) = element points awarded
const BOSS_HP_MULTIPLIER = 3;

type BossRewardBucket = 'common' | 'rare' | 'epicPlus';

export interface PlayCardResult {
	played: boolean;
	exhausted: boolean;
	kind: CardKind;
	// populated on a successful play:
	element?: Element | null;
	damage?: number;        // net HP damage dealt to enemy
	effectiveness?: number; // type multiplier (0.5 | 1 | 2 …)
	damageModifier?: number;
	damageModifierText?: string;
	healed?: number;        // HP restored to player
	blocked?: number;       // block gained by player this play
	manaGained?: number;    // mana recovered (energy cards)
	drawCount?: number;     // cards drawn immediately after the card resolves
	events?: BattleEvent[];
}

export interface EnemyTurnResult {
	kind: 'attack' | 'defend' | 'buff';
	element?: Element;
	damage?: number;     // net HP damage dealt to player (after block)
	absorbed?: number;   // damage absorbed by player block
	effectiveness?: number;
	damageModifier?: number;
	damageModifierText?: string;
	enemyBlock?: number; // block the enemy gained
	buffAmount?: number; // next-damage bonus added
	events?: BattleEvent[];
}

// ── Enemy intent ──────────────────────────────────────────────────────────

function rollIntent(enemyHp: number, enemyMaxHp: number, turnNumber: number, scaling: number, enemyElement: Element): EnemyIntent {
	const ratio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 1;
	// Enemy is more defensive when low on HP.
	const defendWeight = ratio < 0.35 ? 0.4 : 0.2;
	const kind = weightedPick(['attack', 'defend', 'buff'] as const, [0.6, defendWeight, 0.15]);
	if (kind === 'attack') {
		const baseDmg = randomInt(5, 9) + Math.floor(enemyMaxHp / (20 * scaling)) + Math.floor(turnNumber * 0.5);
		return { kind: 'attack', damage: Math.ceil(baseDmg * scaling), element: enemyElement };
	}
	if (kind === 'defend') return { kind: 'defend', block: Math.ceil(randomInt(4, 8) * scaling) };
	return { kind: 'buff', nextDamage: Math.ceil(randomInt(3, 6) * scaling) };
}

// ── Card draw ─────────────────────────────────────────────────────────────

function dropInvalidCards(cards: Card[]): { validCards: Card[]; removedCount: number } {
	const validCards: Card[] = [];
	let removedCount = 0;

	for (const card of cards) {
		if (getTemplate(card.templateId)) {
			validCards.push(card);
			continue;
		}

		removedCount++;
		void removeFromDeck(card.id);
		void removeFromInventory(card.id);
	}

	return { validCards, removedCount };
}

function sanitizeBattleStateCards(s: BattleState): { removedFromHand: number; changed: boolean } {
	let changed = false;

	const hand = dropInvalidCards(s.hand);
	if (hand.removedCount > 0) {
		s.hand = hand.validCards;
		changed = true;
	}

	for (const pile of ['deck', 'discard', 'exhausted', 'relicSlots'] as const) {
		const sanitized = dropInvalidCards(s[pile]);
		if (sanitized.removedCount > 0) {
			s[pile] = sanitized.validCards;
			changed = true;
		}
	}

	return { removedFromHand: hand.removedCount, changed };
}

function reshuffleDiscardIntoDeck(s: BattleState): boolean {
	if (s.discard.length === 0) return false;
	s.deck = shuffle(s.discard);
	s.discard = [];
	return s.deck.length > 0;
}

function isExhaustCombatOnly(card: Card, s: BattleState): boolean {
	const tpl = getTemplate(card.templateId);
	if (!tpl) return false;
	if (tpl.exhaust === 'combat') return true;
	// Misalignment → EXHAUST_COMBATE (returns next combat, not this one)
	if (tpl.element !== null && tpl.element !== s.player.pokemon.element) return true;
	return false;
}

function recycleBattleExhaustedIntoDeck(s: BattleState): boolean {
	const recyclable = s.exhausted.filter(
		(card) => !isPermanentlyConsumed(getTemplate(card.templateId)) && !isExhaustCombatOnly(card, s)
	);
	if (recyclable.length === 0) return false;

	const recycledIds = new Set(recyclable.map((card) => card.id));
	s.exhausted = s.exhausted.filter((card) => !recycledIds.has(card.id));
	s.deck = shuffle(recyclable);
	return s.deck.length > 0;
}

function drawCards(count: number, turnStart = false): void {
	const s = battle.state;
	if (!s) return;

	if (turnStart) {
		// Reset per-turn tracking flags
		s.player.turnFlags.firstAttackThisTurn = true;
		s.player.turnFlags.damageSufferedThisTurn = false;
		s.player.turnFlags.damageReceivedLastTurn = 0;

		// Dispatch onTurnStart for status hooks (assombracao++, next_turn_bonus, auto_jogar, etc.)
		dispatchOnTurnStart(s);

		// Decay turnStart statuses (reflexo, next_turn_bonus, enraizado, fraqueza)
		decayStatuses(s, 'turnStart');
	}

	const { removedFromHand } = sanitizeBattleStateCards(s);
	const maxHand = runModifyHandSize(s, HAND_SIZE);
	const targetHandSize = Math.min(maxHand, s.hand.length + Math.max(0, count) + removedFromHand);
	while (s.hand.length < targetHandSize) {
		if (s.deck.length === 0) {
			const recycledDiscard = reshuffleDiscardIntoDeck(s);
			const recycledExhausted = recycledDiscard ? false : recycleBattleExhaustedIntoDeck(s);
			if (!recycledDiscard && !recycledExhausted) break;
		}

		const card = s.deck.pop();
		if (!card) break;
		if (!getTemplate(card.templateId)) {
			void removeFromDeck(card.id);
			void removeFromInventory(card.id);
			continue;
		}
		s.hand.push(card);
	}
}

// ── Damage ────────────────────────────────────────────────────────────────

function dealToEnemy(amount: number): void {
	const e = battle.state!.enemy;
	const afterBlock = amount - e.block;
	e.block = Math.max(0, e.block - amount);
	if (afterBlock > 0) {
		e.hp = Math.max(0, e.hp - afterBlock);
		battle.enemyHurt++;
	}
}

function dealToPlayer(amount: number): number {
	const s = battle.state!;
	const p = s.player;
	amount = runIncomingDamage(s, amount);
	const blockBefore = p.block;
	const afterBlock = amount - p.block;
	p.block = Math.max(0, p.block - amount);
	const absorbed = Math.min(blockBefore, amount);

	// REFLEXO (ART-09): reflect 50% of absorbed damage to enemy (via status check)
	if (hasStatus(p, 'reflexo') && absorbed > 0) {
		const reflected = Math.floor(absorbed * 0.5);
		dealToEnemy(reflected);
		logEvent({ kind: 'bonus_dmg', source: 'reflexo', amount: reflected });
	}

	// GLACIAÇÃO (revenge_shield): deal damage to enemy when shield fully destroyed
	if (hasStatus(p, 'revenge_shield') && blockBefore > 0 && p.block === 0) {
		const revengeSt = getStatus(p, 'revenge_shield')!;
		dealToEnemy(revengeSt.stacks);
		logEvent({ kind: 'bonus_dmg', source: 'revenge_shield', amount: revengeSt.stacks });
		removeStatus(p, 'revenge_shield');
	}

	// Shield effects (fire_thorns / ice_reflect)
	if (absorbed > 0) {
		if (hasStatus(p, 'shield_fire_thorns')) {
			dealToEnemy(10);
			logEvent({ kind: 'bonus_dmg', source: 'shield_fire_thorns', amount: 10 });
		} else if (hasStatus(p, 'shield_ice_reflect')) {
			dealToEnemy(absorbed);
			logEvent({ kind: 'bonus_dmg', source: 'shield_ice_reflect', amount: absorbed });
		}
	}

	if (afterBlock > 0) {
		p.hp = Math.max(0, p.hp - afterBlock);
		p.turnFlags.damageSufferedThisTurn = true;
		p.turnFlags.damageReceivedLastTurn += afterBlock;
		battle.playerHurt++;
	}
	return absorbed;
}

function createCtx(s: BattleState): CardEffectCtx {
	// Wire the pipeline mutation API so status hooks can call dealToEnemy/dealToPlayer/draw
	setMutationApi(
		(amount) => dealToEnemy(amount),
		(amount) => dealToPlayer(amount),
		(count) => drawCards(count)
	);
	setBattleState(s);
	return {
		s,
		dealToEnemy: (amount) => dealToEnemy(amount),
		dealToPlayer: (amount) => dealToPlayer(amount),
		draw: (count) => drawCards(count)
	};
}

// ── Nature statuses ──────────────────────────────────────────────────────

function applyNatureStatuses(s: BattleState): void {
	const natures = s.player.pokemon.natures;
	if (!natures) return;
	for (let i = 0; i < 3; i++) {
		if (natures.unlocked[i]) {
			s.player.statuses.push({ defId: 'nature_' + natures.assigned[i], stacks: 1, data: {} });
		}
	}
	if (s.player.pokemon.corrupted) {
		s.player.statuses.push({ defId: 'nature_corrompido', stacks: 1, data: {} });
	}
}

export function effectiveCardCost(s: BattleState, card: { templateId: string }): number {
	const tpl = getTemplate(card.templateId);
	if (!tpl) return 0;
	return Math.max(0, runCardCost(s, tpl.cost, tpl, card as Card));
}

// ── Card exhaustion ───────────────────────────────────────────────────────

function shouldExhaust(card: Card): boolean {
	const s = battle.state!;
	if (s.player.pokemon.corrupted) return false;
	const tpl = getTemplate(card.templateId);
	if (!tpl) return false;
	// Explicit exhaust tag on card
	if (tpl.exhaust === 'combat' || tpl.exhaust === 'run') return true;
	// Non-starter pokéballs are single-use
	if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
	// Misalignment: off-element → EXHAUST_COMBATE (returns next combat, no permanent deletion)
	let result = tpl.element !== null && tpl.element !== s.player.pokemon.element;
	return runShouldExhaust(s, card, tpl, result);
}

function discardOrExhaust(card: Card): boolean {
	const s = battle.state!;
	if (shouldExhaust(card)) {
		s.exhausted.push(card);
		const tpl = getTemplate(card.templateId);
		if (tpl) dispatchOnCardExhausted(s, card, tpl);
		if (isPermanentlyConsumed(tpl)) {
			void removeFromDeck(card.id);
			void removeFromInventory(card.id);
		}
		return true;
	}
	s.discard.push(card);
	return false;
}

function discardHand(s: BattleState): void {
	if (s.hand.length === 0) return;
	s.discard.push(...s.hand);
	s.hand = [];
}

// ── Persistence ───────────────────────────────────────────────────────────

async function persistBattle(): Promise<void> {
	if (!battle.state) return;
	if (battle.state.mode === 'missingno') return; // never persist MissingNo
	const snapshot = $state.snapshot({
		state: battle.state,
		reward: battle.reward,
		settled: battle.settled
	}) as SavedBattle;
	await saveBattle(snapshot);
}

async function syncPlayerHp(): Promise<void> {
	const s = battle.state;
	if (!s) return;
	await setPokemonCurrentHp(s.player.pokemon.id, s.player.hp);
}

export function repairActiveBattleState(): void {
	const s = battle.state;
	if (!s || s.status !== 'active') return;

	const { removedFromHand, changed: cardsChanged } = sanitizeBattleStateCards(s);
	let changed = cardsChanged;
	if (!s.mode) {
		s.mode = 'normal';
		changed = true;
	}
	if (typeof s.bossFirstFightBlockedCapture !== 'boolean') {
		s.bossFirstFightBlockedCapture = false;
		changed = true;
	}
	if (s.turn === 'player' && removedFromHand > 0) {
		drawCards(removedFromHand);
	}

	if (!s.player.statuses) {
		s.player.statuses = [];
		changed = true;
	}
	if (!s.enemy.statuses) {
		s.enemy.statuses = [];
		changed = true;
	}
	if (!s.player.turnFlags) {
		s.player.turnFlags = { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0 };
		changed = true;
	}

	if (changed || removedFromHand > 0) {
		void persistBattle();
	}
}

// ── Battle lifecycle ──────────────────────────────────────────────────────

function cardMatchesBossBucket(rarity: CardRarity, bucket: BossRewardBucket): boolean {
	if (rarity === 'starter') return false;
	if (bucket === 'common') return rarity === 'common';
	if (bucket === 'rare') return rarity === 'rare';
	return rarity === 'epic' || rarity === 'secret';
}

function rollWildRewardBucket(): BossRewardBucket {
	const roll = Math.random();
	if (roll <= 0.6) return 'common';
	if (roll <= 0.9) return 'rare';
	return 'epicPlus';
}

function toCardReward(c: CardTemplate): BossCardReward {
	return {
		templateId: c.id,
		rarity: c.rarity as Exclude<CardRarity, 'starter'>,
		element: c.element,
		name: c.name
	};
}

/**
 * Victory card reward. 75% chance the card matches the defeated Pokémon's element,
 * 25% a different element. Bosses ALWAYS drop epic rarity or higher (epic/secret);
 * wild victories use the 60/30/10 rarity roll.
 */
function pickVictoryRewardCard(defeatedElement: Element, isBoss: boolean): BossCardReward | null {
	const sameType = Math.random() < 0.75;
	let element: Element = defeatedElement;
	if (!sameType) {
		const others = ELEMENTS.filter((e) => e !== defeatedElement);
		element = others.length ? pick(others) : defeatedElement;
	}
	const banned = game.player?.bannedTemplateIds ?? [];
	const ok = (c: CardTemplate) => !banned.includes(c.id);

	if (isBoss) {
		const epicPlus = (c: CardTemplate) => (c.rarity === 'epic' || c.rarity === 'secret') && ok(c);
		let pool = CATALOG.filter((c) => c.element === element && epicPlus(c));
		if (pool.length === 0) pool = CATALOG.filter(epicPlus);
		if (pool.length === 0) return null;
		return toCardReward(pick(pool));
	}

	const bucket = rollWildRewardBucket();
	let pool = CATALOG.filter((c) => c.element === element && cardMatchesBossBucket(c.rarity, bucket) && ok(c));
	if (pool.length === 0) pool = CATALOG.filter((c) => c.element === element && c.rarity !== 'starter' && ok(c));
	if (pool.length === 0) pool = CATALOG.filter((c) => cardMatchesBossBucket(c.rarity, bucket) && ok(c));
	if (pool.length === 0) pool = CATALOG.filter((c) => c.rarity !== 'starter' && ok(c));
	if (pool.length === 0) return null;
	return toCardReward(pick(pool));
}

export async function startBattle(regionId: string, mode: BattleMode = 'normal'): Promise<void> {
	const region = getRegion(regionId);
	const mine = activePokemon();
	if (!region || !mine) throw new Error('Região ou pokémon ativo inválido');
	const progress = await getRegionProgress(regionId);

	if (mode === 'boss') {
		if (progress.defeats < region.requiredDefeats) {
			throw new Error('Boss indisponivel: derrote mais inimigos comuns nesta regiao.');
		}
		if (!canFightBoss(progress, now())) {
			throw new Error('Boss em cooldown de 24h para esta regiao.');
		}
	}

	const speciesId = mode === 'boss' ? pick(region.bossPool) : pick(region.pool);
	let enemyData;
	try {
		enemyData = await fetchPokemon(speciesId);
	} catch {
		enemyData = { id: speciesId, name: `#${speciesId}`, element: 'normal' as const, maxHp: 40, artworkUrl: '' };
	}

	const scaling = getRegionScaling(regionId);
	const hpMultiplier = mode === 'boss' ? BOSS_HP_MULTIPLIER : 1;
	const enemy: CapturedPokemon = {
		id: crypto.randomUUID(),
		speciesId,
		name: enemyData.name,
		element: enemyData.element,
		maxHp: enemyData.maxHp * scaling * hpMultiplier,
		currentHp: enemyData.maxHp * scaling * hpMultiplier,
		capturedAt: now()
	};

	setMutationApi(
		(amount) => dealToEnemy(amount),
		(amount) => dealToPlayer(amount),
		(count) => drawCards(count)
	);
	battle.state = {
		regionId,
		mode,
		bossFirstFightBlockedCapture: mode === 'boss' && !progress.bossFirstFightDone,
		player: {
			pokemon: { ...mine },
			hp: normalizedPokemonHp(mine),
			block: 0,
			mana: START_MANA,
			maxMana: 3,
			poisonCounter: 0,
			ghostPermDebuff: game.player?.ghostPermDebuff ?? 0,
			statuses: [],
			turnFlags: { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0 }
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: rollIntent(enemy.maxHp, enemy.maxHp, 1, scaling, enemy.element),
			nextDamageBonus: 0,
			poisonCounter: 0,
			statuses: []
		},
		deck: shuffle(await getActiveDeck()),
		hand: [],
		discard: [],
		exhausted: [],
		relicSlots: (await getInventory()).filter((c) => getTemplate(c.templateId)?.kind === 'relic'),
		turn: 'player',
		turnNumber: 1,
		status: 'active',
		usedPowerIds: [],
		bannedTemplateIds: [...(game.player?.bannedTemplateIds ?? [])],
		pilhaExaurir: game.player?.pilhaExaurir ?? 0
	};
	setBattleState(battle.state);
	battle.reward = null;
	battle.settled = false;
	battle.enemyHurt = 0;
	battle.playerHurt = 0;

	applyNatureStatuses(battle.state);
	dispatchOnBattleStart(battle.state);

	drawCards(HAND_SIZE);
	dispatchOnBattleStartAfterDraw(battle.state);
	battle.introPending = true;
	void persistBattle();
}

export async function startMissingNoBattle(initialPkm: CapturedPokemon): Promise<void> {
	const enemy: CapturedPokemon = {
		id: 'missingno',
		speciesId: 0,
		name: 'MissingNo.',
		element: 'normal',
		maxHp: MISSINGNO_MAX_HP,
		currentHp: MISSINGNO_MAX_HP,
		capturedAt: 0
	};

	setMutationApi(
		(amount) => dealToEnemy(amount),
		(amount) => dealToPlayer(amount),
		(count) => drawCards(count)
	);
	battle.state = {
		regionId: 'missingno',
		mode: 'missingno',
		bossFirstFightBlockedCapture: false,
		player: {
			pokemon: { ...initialPkm },
			hp: initialPkm.maxHp,
			block: 0,
			mana: START_MANA,
			maxMana: 3,
			poisonCounter: 0,
			ghostPermDebuff: 0,
			statuses: [],
			turnFlags: { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0 }
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: { kind: 'attack', damage: MISSINGNO_ACT1_DAMAGE },
			nextDamageBonus: 0,
			poisonCounter: 0,
			statuses: []
		},
		deck: shuffle(await getActiveDeck()),
		hand: [],
		discard: [],
		exhausted: [],
		relicSlots: (await getInventory()).filter((c) => getTemplate(c.templateId)?.kind === 'relic'),
		turn: 'player',
		turnNumber: 1,
		status: 'active',
		usedPowerIds: [],
		bannedTemplateIds: [...(game.player?.bannedTemplateIds ?? [])],
		pilhaExaurir: game.player?.pilhaExaurir ?? 0
	};
	setBattleState(battle.state);
	battle.reward = null;
	battle.settled = false;
	battle.enemyHurt = 0;
	battle.playerHurt = 0;

	applyNatureStatuses(battle.state);
	dispatchOnBattleStart(battle.state);

	drawCards(HAND_SIZE);
	dispatchOnBattleStartAfterDraw(battle.state);
}

export async function swapActiveFighter(pkm: CapturedPokemon): Promise<void> {
	const s = battle.state;
	if (!s) return;

	s.player.pokemon = { ...pkm };
	s.player.hp = pkm.maxHp;
	s.player.block = 0;
	s.player.mana = START_MANA;
	s.player.poisonCounter = 0;
	s.player.ghostPermDebuff = 0;
	s.player.statuses = [];
	s.player.turnFlags = { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0 };

	s.deck = shuffle(await getActiveDeck());
	s.hand = [];
	s.discard = [];
	s.exhausted = [];

	applyNatureStatuses(s);
	dispatchOnBattleStart(s);

	drawCards(HAND_SIZE);
	dispatchOnBattleStartAfterDraw(s);

	s.enemy.block = 0;
	s.enemy.nextDamageBonus = 0;
	s.enemy.poisonCounter = 0;
	s.enemy.statuses = [];
	s.enemy.intent = { kind: 'attack', damage: MISSINGNO_TURN_DAMAGE };

	s.turn = 'player';
	s.turnNumber = 1;

	setBattleState(s);
	void persistBattle();
}

export async function enterBattle(regionId: string, mode: BattleMode = 'normal'): Promise<void> {
	const saved = await getSavedBattle();
	if (saved?.state.status === 'active') {
		battle.state = saved.state;
		setMutationApi(
			(amount) => dealToEnemy(amount),
			(amount) => dealToPlayer(amount),
			(count) => drawCards(count)
		);
		setBattleState(battle.state);
		battle.reward = saved.reward ? { ...saved.reward, cardReward: saved.reward.cardReward ?? null } : null;
		battle.settled = saved.settled;
		battle.enemyHurt = 0;
		battle.playerHurt = 0;
		repairActiveBattleState();
		return;
	}
	if (saved) await clearSavedBattle();
	await startBattle(regionId, mode);
}

export async function hasSavedBattle(): Promise<boolean> {
	const saved = await getSavedBattle();
	return !!saved && saved.state.status === 'active';
}

export async function endBattleCleanup(): Promise<void> {
	battle.state = null;
	battle.reward = null;
	battle.settled = false;
	battle.introPending = false;
	await clearSavedBattle();
}

// ── Player actions ────────────────────────────────────────────────────────

export function playCard(cardId: string): PlayCardResult {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') {
		return { played: false, exhausted: false, kind: 'attack' };
	}
	const idx = s.hand.findIndex((c) => c.id === cardId);
	if (idx < 0) return { played: false, exhausted: false, kind: 'attack' };

	const card = s.hand[idx];
	const tpl = getTemplate(card.templateId);
	if (!tpl) return { played: false, exhausted: false, kind: 'attack' };
	const cost = effectiveCardCost(s, card);
	if (s.player.mana < cost) return { played: false, exhausted: false, kind: 'attack' };

	// ART-03 POWER: can only be played once per combat
	if (tpl.isPower) {
		if (s.usedPowerIds.includes(tpl.id)) return { played: false, exhausted: false, kind: tpl.kind };
		s.usedPowerIds.push(tpl.id);
	}

	s.player.mana -= cost;
	s.hand.splice(idx, 1);
	const attackElement = tpl.kind === 'attack' ? (() => {
		let el = tpl.element;
		if (hasStatus(s.player, 'dragonize') && (!el || el === 'normal')) el = 'dragon';
		if (hasStatus(s.player, 'specialize') && tpl.rarity === 'starter' && !el)
			el = s.player.pokemon.element;
		return el;
	})() : null;

	// Snapshot pre-effect state for delta logging
	const enemyHpBefore = s.enemy.hp;
	const playerHpBefore = s.player.hp;
	const playerBlockBefore = s.player.block;
	const duplicarWasActive = hasStatus(s.player, 'duplicar');

	const ctx = createCtx(s);
	applyCardEffect(ctx, tpl, card);

	// ART-10 DUPLICAR_CARTA: execute effect again if flag was active before this card
	const isDuplicarCard = tpl.id === 'psychic_paradoxo' || tpl.id === 'ice_cristal';
	if (duplicarWasActive && !tpl.isPower && !isDuplicarCard) {
		removeStatus(s.player, 'duplicar');
		applyCardEffect(ctx, tpl, card);
	} else if (duplicarWasActive && isDuplicarCard) {
		// Playing a duplicar card while another is active: consume both but don't double
		removeStatus(s.player, 'duplicar');
	}

	// Dispatch onCardPlayed for status hooks (static_shock, dano_eletrico, etc.)
	dispatchOnCardPlayed(s, tpl, card);

	const exhausted = discardOrExhaust(card);

	// Build enriched result
	const result: PlayCardResult = { played: true, exhausted, kind: tpl.kind };
	if (tpl.kind === 'attack' && ctx.lastAttackSummary) {
		result.element = attackElement;
		result.damage = Math.max(0, enemyHpBefore - s.enemy.hp);
		result.effectiveness = ctx.lastAttackSummary.effectiveness;
		if (ctx.lastAttackSummary.modifierAmount !== 0) {
			result.damageModifier = ctx.lastAttackSummary.modifierAmount * (ctx.lastAttackSummary.hits ?? 1);
			result.damageModifierText = ctx.lastAttackSummary.modifierText;
		}
	} else if (tpl.kind === 'heal') {
		result.healed = Math.max(0, s.player.hp - playerHpBefore);
	} else if (tpl.kind === 'defense') {
		result.blocked = Math.max(0, s.player.block - playerBlockBefore);
	} else if (tpl.kind === 'energy') {
		result.manaGained = tpl.manaGain;
	}
	if ((tpl.drawCount ?? 0) > 0) result.drawCount = tpl.drawCount;

	result.events = drainEvents();

	if (s.enemy.hp <= 0 && s.status === 'active') s.status = 'victory';
	if (tpl.kind === 'heal') void syncPlayerHp();

	// endsTurn (Evasão Total): trigger enemy turn immediately
	if (tpl.endsTurn && s.status === 'active') {
		void persistBattle();
		endTurn();
		return result;
	}

	void persistBattle();
	return result;
}

export function playRelicCard(cardId: string): PlayCardResult {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') {
		return { played: false, exhausted: false, kind: 'relic' };
	}
	const idx = s.relicSlots.findIndex((c) => c.id === cardId);
	if (idx < 0) return { played: false, exhausted: false, kind: 'relic' };

	const card = s.relicSlots[idx];
	const tpl = getTemplate(card.templateId);
	if (!tpl) return { played: false, exhausted: false, kind: 'relic' };

	s.relicSlots.splice(idx, 1);
	applyCardEffect(createCtx(s), tpl);
	dispatchOnCardPlayed(s, tpl, card);
	void removeFromInventory(card.id);
	if (s.enemy.hp <= 0 && s.status === 'active') s.status = 'victory';

	void persistBattle();
	return { played: true, exhausted: true, kind: 'relic' };
}

export function endTurn(): EnemyTurnResult | null {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') return null;

	// Dispatch onTurnEnd for status hooks (rocha_imovel, shield_persist)
	dispatchOnTurnEnd(s);

	discardHand(s);
	s.turn = 'enemy';
	s.enemy.block = 0;

	// Reset per-turn damage tracking (the old value is in turnFlags)
	s.player.turnFlags.damageReceivedLastTurn = 0;

	const intent = s.enemy.intent;
	let turnResult: EnemyTurnResult;

	if (intent.kind === 'attack') {
		const attackElement = intent.element ?? s.enemy.pokemon.element;
		let dmg = intent.damage + s.enemy.nextDamageBonus;

		// IMOBILIZADO (ART-04): halve enemy damage
		if (hasStatus(s.enemy, 'imobilizado')) {
			dmg = Math.floor(dmg * 0.5);
		}

		// INTIMIDATE: reduce damage by stored reduction
		if (hasStatus(s.enemy, 'intimidate')) {
			const intimidateSt = getStatus(s.enemy, 'intimidate')!;
			const reduction = intimidateSt.data?.reduction ?? 0;
			dmg = Math.round(dmg * (1 - reduction));
		}

		// Alma Penada permanent damage reduction
		if (s.player.ghostPermDebuff > 0) {
			dmg = Math.max(0, dmg - s.player.ghostPermDebuff);
		}

		const typedDamage = resolveTypedDamage(dmg, attackElement, s.player.pokemon.element);
		s.enemy.nextDamageBonus = 0;
		const absorbed = dealToPlayer(typedDamage.damage);
		turnResult = {
			kind: 'attack',
			element: attackElement,
			damage: Math.max(0, typedDamage.damage - absorbed),
			absorbed,
			effectiveness: typedDamage.effectiveness,
			damageModifier: typedDamage.modifierAmount,
			damageModifierText: typedDamage.modifierText
		};
		if (s.enemy.hp <= 0 && s.status === 'active') {
			s.status = 'victory';
			void persistBattle();
			return turnResult;
		}
	} else if (intent.kind === 'defend') {
		// CANCEL_ESCUDO (ART-12): cancel enemy shield action
		if (hasStatus(s.enemy, 'shield_cancelled')) {
			turnResult = { kind: 'defend', enemyBlock: 0 };
		} else {
			let blockGain = intent.block;
			// REDUZ_SHIELD (ART-13): halve enemy block gain
			if (hasStatus(s.enemy, 'shield_reduced')) blockGain = Math.floor(blockGain * 0.5);
			s.enemy.block += blockGain;
			turnResult = { kind: 'defend', enemyBlock: blockGain };
		}
	} else {
		let buffAmount = intent.nextDamage;
		// REDUZ_BUFF (ART-14): halve enemy buff
		if (hasStatus(s.enemy, 'buff_reduced')) buffAmount = Math.floor(buffAmount * 0.5);
		s.enemy.nextDamageBonus += buffAmount;
		turnResult = { kind: 'buff', buffAmount };
	}

	if (intent.kind === 'attack') {
		s.player.turnFlags.damageSufferedThisTurn = true;
	}
	else{
		s.player.turnFlags.damageSufferedThisTurn = false;
	}

	turnResult.events = drainEvents();

	if (s.player.hp <= 0) {
		if (s.mode === 'missingno' && onPlayerDefeatedInMissingNo) {
			onPlayerDefeatedInMissingNo();
			void persistBattle();
			return turnResult;
		}
		s.status = 'defeat';
		void setPokemonCurrentHp(s.player.pokemon.id, 0);
		void persistBattle();
		return turnResult;
	}

	// Decay turnEnd statuses (imobilizado, intimidate, ghost_form, shield_fire_thorns, etc.)
	decayStatuses(s, 'turnEnd');

	if (s.mode === 'missingno') {
		s.enemy.intent = { kind: 'attack', damage: MISSINGNO_TURN_DAMAGE };
	} else {
		const scaling = getRegionScaling(s.regionId);
		s.enemy.intent = rollIntent(s.enemy.hp, s.enemy.pokemon.maxHp, s.turnNumber, scaling, s.enemy.pokemon.element);
	}
	s.turnNumber++;

	// ESCUDO_PERSISTE (ART-08): don't clear player block if shieldPersists
	if (!hasStatus(s.player, 'shield_persist')) {
		s.player.block = 0;
	}

	s.player.mana = START_MANA;
	s.turn = 'player';
	drawCards(HAND_SIZE, true);
	void persistBattle();
	return turnResult;
}



// ── Reward settlement ─────────────────────────────────────────────────────

export async function finalizeBattle(): Promise<void> {
	const s = battle.state;
	if (!s || battle.settled || s.status === 'active') return;
	battle.settled = true;
	await clearSavedBattle();

	// Sync run-persistent state back to player DB
	if (game.player) {
		game.player.pilhaExaurir = s.pilhaExaurir;
		game.player.bannedTemplateIds = [...s.bannedTemplateIds];
		game.player.ghostPermDebuff = s.player.ghostPermDebuff;
		await savePlayer($state.snapshot(game.player) as typeof game.player);
	}

	const isBossFight = s.mode === 'boss';
	if (isBossFight && s.bossFirstFightBlockedCapture) {
		await markBossFightDone(s.regionId);
	}

	if (s.status === 'defeat') {
		await setPokemonCurrentHp(s.player.pokemon.id, 0);
		setActivePokemon(null);
		// Lose ONLY the non-starter cards that were equipped in the active deck.
		// Inventory cards that were not in the deck are kept.
		const deck = await getActiveDeck();
		for (const card of deck) {
			if (getTemplate(card.templateId)?.rarity !== 'starter') {
				await removeFromInventory(card.id);
			}
		}
		await resetDeckToStarters();
		return;
	}

	await syncPlayerHp();

	const moneyMultiplier = 1 + (game.player?.ngu.moneyMultiplierLevel ?? 0) * 0.5;
	const money = Math.floor((s.enemy.pokemon.maxHp * 0.5 + randomInt(5, 15)) * moneyMultiplier);
	addMoney(money);

	const elementAmount = Math.max(1, Math.floor(s.enemy.pokemon.maxHp / ELEMENT_POINTS_PER_MAX_HP));
	addElementPoints(s.enemy.pokemon.element, elementAmount);

	let captured: CapturedPokemon | null = null;
	if (s.status === 'captured') {
		captured = {
			...s.enemy.pokemon,
			id: crypto.randomUUID(),
			capturedAt: now(),
			currentHp: s.enemy.pokemon.maxHp
		};
		applyElementalHpBonusToPokemon(captured);
		ensurePokemonNatures(captured);
		await addPokemon(captured);
		addToRoster(captured);
	}

	if (!isBossFight) {
		const total = await incrementDefeat(s.regionId);
		recordDefeat(s.regionId, total);
	} else {
		await markBossDefeated(s.regionId);
	}

	let bossCardReward: BossCardReward | null = null;
	if (s.status === 'victory') {
		bossCardReward = pickVictoryRewardCard(s.enemy.pokemon.element, isBossFight);
		if (bossCardReward) {
			await addToInventory({ id: crypto.randomUUID(), templateId: bossCardReward.templateId });
		}
	}

	let unlockedRegionName: string | null = null;
	const region = getRegion(s.regionId);
	const progress = await getRegionProgress(s.regionId);
	recordDefeat(s.regionId, progress.defeats);
	if (region && progress.defeats >= region.requiredDefeats && progress.bossLastDefeatedAt > 0) {
		const next = nextRegion(s.regionId);
		if (next && !(game.player?.unlockedRegions.includes(next.id) ?? false)) {
			unlockRegion(next.id);
			unlockedRegionName = next.name;
		}
	}

	battle.reward = {
		money,
		elementPoints: { type: s.enemy.pokemon.element, amount: elementAmount },
		captured,
		unlockedRegionName,
		cardReward: bossCardReward
	};
}
