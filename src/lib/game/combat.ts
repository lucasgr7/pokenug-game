// Carrega o barrel de status ANTES do pipeline: é ele que registra as
// definições (defineStatus) — sem isso os hooks de status não existem.
import './status';
import { removeFromDeck, removeFromInventory } from '$lib/db/cards';
import { getTemplate } from '$lib/data/cards';
import { applyCardEffect } from './cards/apply';
import { isPermanentlyConsumed, resolveTypedDamage } from './damage';
import { enemyAttackDamageAfterDebuffs } from './enemy-intent';
import type { CardEffectCtx } from './cards/types';
import {
	hasStatus,
	removeStatus,
	getStatus,
	setMutationApi,
	setBattleState,
	runIncomingDamage,
	dispatchOnCardPlayed,
	dispatchOnTurnStart,
	dispatchOnTurnEnd,
	runCardCost,
	runModifyHandSize,
	runShouldExhaust,
	dispatchOnCardExhausted,
	decayStatuses,
	logEvent,
	drainEvents
} from './status/pipeline';
import type { BattleEvent } from './status/types';
import { shuffle } from '$lib/utils/rng';
import type { BattleState, Card, CardKind, Element, EnemyIntent } from './types';

/**
 * Pure combat engine. Every function operates on an explicit `BattleState` and
 * knows nothing about the Svelte `battle` store, IndexedDB persistence,
 * analytics, or the UI — those live in `battle.svelte.ts`, which wraps this
 * module. Unit tests drive the engine through `$lib/testing/battle`.
 */

export const HAND_SIZE = 5;
export const START_MANA = 3;

/** Side-effect callbacks the host environment may plug into the engine. */
export interface CombatIO {
	/** Enemy lost HP — drives the hurt flash animation. */
	onEnemyHurt?(): void;
	/** Player lost HP — drives the hurt flash animation. */
	onPlayerHurt?(): void;
	/**
	 * Player HP reached 0 during the enemy turn. Return true when defeat was
	 * handled externally (MissingNo swap) to keep the battle out of 'defeat'.
	 */
	onPlayerDefeated?(): boolean;
}

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

export function sanitizeBattleStateCards(s: BattleState): { removedFromHand: number; changed: boolean } {
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
	logEvent({ kind: 'reshuffle', source: 'discard', count: s.deck.length });
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
	logEvent({ kind: 'reshuffle', source: 'exhausted', count: s.deck.length });
	return s.deck.length > 0;
}

export function drawCards(s: BattleState, count: number, turnStart = false): void {
	if (turnStart) {
		// Reset per-turn tracking flags
		s.player.turnFlags.firstAttackThisTurn = true;
		s.player.turnFlags.damageSufferedThisTurn = false;
		s.player.turnFlags.damageReceivedLastTurn = 0;
		s.player.turnFlags.cardsPlayedThisTurn = 0;

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

export function dealToEnemy(s: BattleState, amount: number, io: CombatIO = {}): void {
	const e = s.enemy;
	const afterBlock = amount - e.block;
	e.block = Math.max(0, e.block - amount);
	if (afterBlock > 0) {
		e.hp = Math.max(0, e.hp - afterBlock);
		io.onEnemyHurt?.();
	}
}

export function dealToPlayer(s: BattleState, amount: number, io: CombatIO = {}): number {
	const p = s.player;
	amount = runIncomingDamage(s, amount);
	const blockBefore = p.block;
	const afterBlock = amount - p.block;
	p.block = Math.max(0, p.block - amount);
	const absorbed = Math.min(blockBefore, amount);

	// REFLEXO (ART-09): reflect 50% of absorbed damage to enemy (via status check)
	if (hasStatus(p, 'reflexo') && absorbed > 0) {
		const reflected = Math.floor(absorbed * 0.5);
		dealToEnemy(s, reflected, io);
		logEvent({ kind: 'bonus_dmg', source: 'reflexo', amount: reflected });
	}

	// GLACIAÇÃO (revenge_shield): deal damage to enemy when shield fully destroyed
	if (hasStatus(p, 'revenge_shield') && blockBefore > 0 && p.block === 0) {
		const revengeSt = getStatus(p, 'revenge_shield')!;
		dealToEnemy(s, revengeSt.stacks, io);
		logEvent({ kind: 'bonus_dmg', source: 'revenge_shield', amount: revengeSt.stacks });
		removeStatus(p, 'revenge_shield');
	}

	// Shield effects (fire_thorns / ice_reflect)
	if (absorbed > 0) {
		if (hasStatus(p, 'shield_fire_thorns')) {
			dealToEnemy(s, 10, io);
			logEvent({ kind: 'bonus_dmg', source: 'shield_fire_thorns', amount: 10 });
		} else if (hasStatus(p, 'shield_ice_reflect')) {
			dealToEnemy(s, absorbed, io);
			logEvent({ kind: 'bonus_dmg', source: 'shield_ice_reflect', amount: absorbed });
		}
	}

	if (afterBlock > 0) {
		p.hp = Math.max(0, p.hp - afterBlock);
		p.turnFlags.damageSufferedThisTurn = true;
		p.turnFlags.damageReceivedLastTurn += afterBlock;
		io.onPlayerHurt?.();
	}
	return absorbed;
}

/**
 * Wire the pipeline mutation API so status hooks can call
 * dealToEnemy/dealToPlayer/draw against this state.
 */
export function wireCombat(s: BattleState, io: CombatIO = {}): void {
	setMutationApi(
		(amount) => dealToEnemy(s, amount, io),
		(amount) => dealToPlayer(s, amount, io),
		(count) => drawCards(s, count)
	);
	setBattleState(s);
}

export function createCtx(s: BattleState, io: CombatIO = {}): CardEffectCtx {
	wireCombat(s, io);
	return {
		s,
		dealToEnemy: (amount) => dealToEnemy(s, amount, io),
		dealToPlayer: (amount) => dealToPlayer(s, amount, io),
		draw: (count) => drawCards(s, count)
	};
}

export function effectiveCardCost(s: BattleState, card: { templateId: string }): number {
	const tpl = getTemplate(card.templateId);
	if (!tpl) return 0;
	return Math.max(0, runCardCost(s, tpl.cost, tpl, card as Card));
}

// ── Card exhaustion ───────────────────────────────────────────────────────

export function shouldExhaust(s: BattleState, card: Card): boolean {
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

export function discardOrExhaust(s: BattleState, card: Card): boolean {
	if (shouldExhaust(s, card)) {
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

export function discardHand(s: BattleState): void {
	if (s.hand.length === 0) return;
	s.discard.push(...s.hand);
	s.hand = [];
}

// ── Player actions ────────────────────────────────────────────────────────

export function playCardOn(s: BattleState, cardId: string, io: CombatIO = {}): PlayCardResult {
	if (s.status !== 'active' || s.turn !== 'player') {
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

	const ctx = createCtx(s, io);
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

	s.player.turnFlags.cardsPlayedThisTurn++;

	const exhausted = discardOrExhaust(s, card);

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

	return result;
}

export function playRelicOn(s: BattleState, cardId: string, io: CombatIO = {}): PlayCardResult {
	if (s.status !== 'active' || s.turn !== 'player') {
		return { played: false, exhausted: false, kind: 'relic' };
	}
	const idx = s.relicSlots.findIndex((c) => c.id === cardId);
	if (idx < 0) return { played: false, exhausted: false, kind: 'relic' };

	const card = s.relicSlots[idx];
	const tpl = getTemplate(card.templateId);
	if (!tpl) return { played: false, exhausted: false, kind: 'relic' };

	s.relicSlots.splice(idx, 1);
	applyCardEffect(createCtx(s, io), tpl);
	dispatchOnCardPlayed(s, tpl, card);
	void removeFromInventory(card.id);
	if (s.enemy.hp <= 0 && s.status === 'active') s.status = 'victory';

	return { played: true, exhausted: true, kind: 'relic' };
}

// ── Enemy turn ────────────────────────────────────────────────────────────

/**
 * Resolve the end of the player's turn and the full enemy turn.
 * `nextIntent` rolls the enemy's next intent (random in the game,
 * deterministic in tests).
 */
export function endTurnOn(
	s: BattleState,
	nextIntent: (s: BattleState) => EnemyIntent,
	io: CombatIO = {}
): EnemyTurnResult | null {
	if (s.status !== 'active' || s.turn !== 'player') return null;

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
		const dmg = enemyAttackDamageAfterDebuffs(s);
		const typedDamage = resolveTypedDamage(dmg, attackElement, s.player.pokemon.element);
		s.enemy.nextDamageBonus = 0;
		const absorbed = dealToPlayer(s, typedDamage.damage, io);
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
		const handledExternally = io.onPlayerDefeated?.() ?? false;
		if (!handledExternally) s.status = 'defeat';
		return turnResult;
	}

	// Decay turnEnd statuses (imobilizado, intimidate, ghost_form, shield_fire_thorns, etc.)
	decayStatuses(s, 'turnEnd');

	s.enemy.intent = nextIntent(s);
	s.turnNumber++;

	// ESCUDO_PERSISTE (ART-08): don't clear player block if shieldPersists
	if (!hasStatus(s.player, 'shield_persist')) {
		s.player.block = 0;
	}

	s.player.mana = START_MANA;
	s.turn = 'player';
	drawCards(s, HAND_SIZE, true);
	// Eventos emitidos durante a compra do turno (reshuffle, hooks de
	// turnStart) pertencem a ESTE resultado — sem isso vazariam para a
	// próxima ação.
	turnResult.events = [...(turnResult.events ?? []), ...drainEvents()];
	return turnResult;
}
