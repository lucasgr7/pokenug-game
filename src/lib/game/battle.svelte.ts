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
import { CATALOG, SECRET_TEMPLATES, getTemplate } from '$lib/data/cards';
import { getRegion, nextRegion, getRegionScaling } from '$lib/data/regions';
import { fetchPokemon } from '$lib/api/pokeapi';
import { getElementInteraction } from './type-chart';
import { pick, randomInt, shuffle, weightedPick } from '$lib/utils/rng';
import { clamp } from '$lib/utils/math';
import { now } from '$lib/utils/time';
import { pushToast } from '$lib/stores/toast.svelte';
import {
	activePokemon,
	addElementPoints,
	addMoney,
	addToRoster,
	applyElementalHpBonusToPokemon,
	game,
	getElementalDamageLevel,
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

interface BattleStore {
	state: BattleState | null;
	reward: BattleReward | null;
	settled: boolean;
	// Toggled each hit to drive Svelte #key animations in the battle UI.
	enemyHurt: number;
	playerHurt: number;
}

export const battle = $state<BattleStore>({
	state: null,
	reward: null,
	settled: false,
	enemyHurt: 0,
	playerHurt: 0
});

const HAND_SIZE = 5;
const START_MANA = 3;
// NGU scaling constants — tune here if balancing is needed.
const GLOBAL_DAMAGE_PER_LEVEL = 3;
const DAMAGE_PER_POKEMON_BUFF = 2;
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
	shockDamage?: number;   // bonus static shock damage dealt after the card resolves
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
}

interface TypedDamageSummary {
	damage: number;
	effectiveness: number;
	modifierAmount: number;
	modifierText: string;
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

function isPermanentlyConsumed(tpl: CardTemplate | null | undefined): boolean {
	return !!tpl && (tpl.kind === 'heal' || tpl.kind === 'power' || (tpl.kind === 'capture' && tpl.rarity !== 'starter'));
}

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

function recycleBattleExhaustedIntoDeck(s: BattleState): boolean {
	const recyclable = s.exhausted.filter((card) => !isPermanentlyConsumed(getTemplate(card.templateId)));
	if (recyclable.length === 0) return false;

	const recycledIds = new Set(recyclable.map((card) => card.id));
	s.exhausted = s.exhausted.filter((card) => !recycledIds.has(card.id));
	s.deck = shuffle(recyclable);
	return s.deck.length > 0;
}

function drawCards(count: number): void {
	const s = battle.state;
	if (!s) return;

	const { removedFromHand } = sanitizeBattleStateCards(s);
	const targetHandSize = Math.min(HAND_SIZE, s.hand.length + Math.max(0, count) + removedFromHand);
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

function dealToPlayer(amount: number): void {
	const p = battle.state!.player;
	if (p.ghostForm) amount = 1;
	const afterBlock = amount - p.block;
	p.block = Math.max(0, p.block - amount);
	if (afterBlock > 0) {
		p.hp = Math.max(0, p.hp - afterBlock);
		battle.playerHurt++;
	}
}

// ── Card exhaustion ───────────────────────────────────────────────────────

function shouldExhaust(card: Card): boolean {
	const s = battle.state!;
	const tpl = getTemplate(card.templateId);
	if (!tpl) return false;
	if (tpl.kind === 'heal') return true;
	// Power cards are single-use per run — permanently consumed on play.
	if (tpl.kind === 'power') return true;
	// Relic and debuff cards are never exhausted via the normal play path.
	if (tpl.kind === 'relic' || tpl.kind === 'debuff') return false;
	// Non-starter Pokéballs are single-use.
	if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
	// Off-element cards are exhausted for this battle only — they return next battle.
	if (tpl.element !== null && tpl.element !== s.player.pokemon.element) return true;
	return false;
}

function discardOrExhaust(card: Card): boolean {
	const s = battle.state!;
	if (shouldExhaust(card)) {
		s.exhausted.push(card);
		const tpl = getTemplate(card.templateId);
		// Heals and non-starter pokéballs are consumed permanently.
		// Off-element cards are exhausted for this battle only — they return next battle.
		const permanent = isPermanentlyConsumed(tpl);
		if (permanent) {
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

// ── Card effect ───────────────────────────────────────────────────────────

function playerAttackBonus(): number {
	const s = battle.state!;
	return (
		getElementalDamageLevel(s.player.pokemon.element) * GLOBAL_DAMAGE_PER_LEVEL +
		(s.player.pokemon.damageBuffs ?? 0) * DAMAGE_PER_POKEMON_BUFF
	);
}

function resolveTypedDamage(
	baseDamage: number,
	attackerElement: Element | null | undefined,
	defenderElement: Element
): TypedDamageSummary {
	const neutralDamage = Math.max(0, Math.round(baseDamage));
	if (!attackerElement) {
		return {
			damage: neutralDamage,
			effectiveness: 1,
			modifierAmount: 0,
			modifierText: ''
		};
	}

	const interaction = getElementInteraction(attackerElement, defenderElement);
	const damage = Math.max(0, Math.round(neutralDamage * interaction.multiplier));

	return {
		damage,
		effectiveness: interaction.multiplier,
		modifierAmount: damage - neutralDamage,
		modifierText: interaction.modifierText
	};
}

function resolvePlayerAttackElement(s: BattleState, tpl: CardTemplate): Element | null {
	let attackElement = tpl.element;
	if (s.player.dragonize && (!attackElement || attackElement === 'normal')) attackElement = 'dragon';
	if (s.player.specialize && tpl.rarity === 'starter' && !attackElement) attackElement = s.player.pokemon.element;
	return attackElement;
}

function applyStaticShock(s: BattleState): number {
	if (s.status !== 'active' || s.player.staticShockDamage <= 0) return 0;
	const shockDamage = resolveTypedDamage(s.player.staticShockDamage, 'electric', s.enemy.pokemon.element).damage;
	if (shockDamage <= 0) return 0;
	const enemyHpBefore = s.enemy.hp;
	dealToEnemy(shockDamage);
	return Math.max(0, enemyHpBefore - s.enemy.hp);
}

function applyCardEffect(s: BattleState, tpl: CardTemplate): void {
	switch (tpl.kind) {
		case 'attack': {
			const attackElement = resolvePlayerAttackElement(s, tpl);
			const base = (tpl.damage ?? 0) + s.player.nextDamageBonus + playerAttackBonus();
			s.player.nextDamageBonus = 0;
			const berserkMult = s.player.berserk ? 2 : 1;
			const attackDamage = resolveTypedDamage(base * berserkMult, attackElement, s.enemy.pokemon.element);
			const hits = 1 + s.player.attackRepeat;
			s.player.attackRepeat = 0;
			for (let i = 0; i < hits; i++) dealToEnemy(attackDamage.damage);
			if ((tpl.drawCount ?? 0) > 0) drawCards(tpl.drawCount ?? 0);
			break;
		}
		case 'defense': {
			const block = tpl.block ?? 0;
			s.player.block += s.player.berserk ? Math.max(1, Math.floor(block / 2)) : block;
			break;
		}
		case 'heal':
			s.player.hp = Math.min(s.player.pokemon.maxHp, s.player.hp + (tpl.healHp ?? 0));
			break;
		case 'buff':
			s.player.nextDamageBonus += tpl.buffAmount ?? 0;
			break;
		case 'capture': {
			if (s.mode === 'boss' && s.bossFirstFightBlockedCapture) {
				pushToast('Primeira luta contra este boss nao permite captura.', 'error');
				break;
			}
			const ratio = s.enemy.pokemon.maxHp > 0 ? s.enemy.hp / s.enemy.pokemon.maxHp : 0;
			const chance = clamp(1 - ratio + (tpl.captureBonus ?? 0), 0, 1);
			if (Math.random() < chance) s.status = 'captured';
			break;
		}
		case 'power':
			if (tpl.id === 'power_berserk') s.player.berserk = true;
			if (tpl.id === 'power_dragonize') s.player.dragonize = true;
			if (tpl.id === 'power_electric_shock') s.player.staticShockDamage += 2;
			if (tpl.id === 'power_specialize') s.player.specialize = true;
			break;
		case 'relic':
			s.player.ghostForm = true;
			break;
		case 'energy':
			s.player.mana = Math.min(s.player.mana + (tpl.manaGain ?? 0), 6);
			break;
		case 'combo':
			s.player.attackRepeat = tpl.attackRepeat ?? 1;
			break;
		case 'debuff':
			s.enemy.intimidateTurnsLeft = tpl.debuffDuration ?? 2;
			s.enemy.intimidateDamageReduction = tpl.debuffAmount ?? 0.5;
			break;
	}
}

// ── Persistence ───────────────────────────────────────────────────────────

async function persistBattle(): Promise<void> {
	if (!battle.state) return;
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

	if (changed || removedFromHand > 0) {
		void persistBattle();
	}
}

// ── Battle lifecycle ──────────────────────────────────────────────────────

function rollBossRewardBucket(): BossRewardBucket {
	const roll = Math.random();
	if (roll <= 0.6) return 'common';
	if (roll <= 0.9) return 'rare';
	return 'epicPlus';
}

function cardMatchesBossBucket(rarity: CardRarity, bucket: BossRewardBucket): boolean {
	if (rarity === 'starter') return false;
	if (bucket === 'common') return rarity === 'common';
	if (bucket === 'rare') return rarity === 'rare';
	return rarity === 'epic' || rarity === 'secret';
}

function pickBossRewardCard(element: Element): BossCardReward | null {
	const all = [...CATALOG, ...SECRET_TEMPLATES];
	const bucket = rollBossRewardBucket();
	let pool = all.filter((c) => c.element === element && cardMatchesBossBucket(c.rarity, bucket));
	if (pool.length === 0) {
		pool = all.filter((c) => c.element === element && c.rarity !== 'starter');
	}
	if (pool.length === 0) {
		pool = all.filter((c) => cardMatchesBossBucket(c.rarity, bucket));
	}
	if (pool.length === 0) {
		pool = all.filter((c) => c.rarity !== 'starter');
	}
	if (pool.length === 0) return null;

	const chosen = pick(pool);
	return {
		templateId: chosen.id,
		rarity: chosen.rarity as Exclude<CardRarity, 'starter'>,
		element: chosen.element,
		name: chosen.name
	};
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
			nextDamageBonus: 0,
			poisonCounter: 0,
			berserk: false,
			dragonize: false,
			staticShockDamage: 0,
			ghostForm: false,
			attackRepeat: 0,
			specialize: false
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: rollIntent(enemy.maxHp, enemy.maxHp, 1, scaling, enemy.element),
			nextDamageBonus: 0,
			poisonCounter: 0,
			intimidateTurnsLeft: 0,
			intimidateDamageReduction: 0
		},
		deck: shuffle(await getActiveDeck()),
		hand: [],
		discard: [],
		exhausted: [],
		relicSlots: (await getInventory()).filter((c) => getTemplate(c.templateId)?.kind === 'relic'),
		turn: 'player',
		turnNumber: 1,
		status: 'active'
	};
	battle.reward = null;
	battle.settled = false;
	battle.enemyHurt = 0;
	battle.playerHurt = 0;

	drawCards(HAND_SIZE);
	void persistBattle();
}

export async function enterBattle(regionId: string, mode: BattleMode = 'normal'): Promise<void> {
	const saved = await getSavedBattle();
	if (saved?.state.status === 'active') {
		battle.state = saved.state;
		battle.reward = saved.reward ? { ...saved.reward, bossCardReward: saved.reward.bossCardReward ?? null } : null;
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
	if (!tpl || s.player.mana < tpl.cost) return { played: false, exhausted: false, kind: 'attack' };

	s.player.mana -= tpl.cost;
	s.hand.splice(idx, 1);
	const attackElement = tpl.kind === 'attack' ? resolvePlayerAttackElement(s, tpl) : null;
	const attackHits = tpl.kind === 'attack' ? 1 + s.player.attackRepeat : 0;
	const attackDamage =
		tpl.kind === 'attack'
			? resolveTypedDamage(
					((tpl.damage ?? 0) + s.player.nextDamageBonus + playerAttackBonus()) * (s.player.berserk ? 2 : 1),
					attackElement,
					s.enemy.pokemon.element
				)
			: null;

	// Capture pre-effect state so we can compute deltas for the log.
	const enemyHpBefore = s.enemy.hp;
	const playerHpBefore = s.player.hp;
	const playerBlockBefore = s.player.block;

	applyCardEffect(s, tpl);
	const shockDamage = applyStaticShock(s);

	const exhausted = discardOrExhaust(card);

	// Build enriched result.
	const result: PlayCardResult = { played: true, exhausted, kind: tpl.kind };
	if (tpl.kind === 'attack' && attackDamage) {
		result.element = attackElement;
		result.damage = Math.max(0, enemyHpBefore - s.enemy.hp);
		result.effectiveness = attackDamage.effectiveness;
		if (attackDamage.modifierAmount !== 0) {
			result.damageModifier = attackDamage.modifierAmount * attackHits;
			result.damageModifierText = attackDamage.modifierText;
		}
	} else if (tpl.kind === 'heal') {
		result.healed = Math.max(0, s.player.hp - playerHpBefore);
	} else if (tpl.kind === 'defense') {
		result.blocked = Math.max(0, s.player.block - playerBlockBefore);
	} else if (tpl.kind === 'energy') {
		result.manaGained = tpl.manaGain;
	}
	if ((tpl.drawCount ?? 0) > 0) result.drawCount = tpl.drawCount;
	if (shockDamage > 0) result.shockDamage = shockDamage;

	if (s.enemy.hp <= 0 && s.status === 'active') s.status = 'victory';
	if (tpl.kind === 'heal') void syncPlayerHp();

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
	applyCardEffect(s, tpl);
	const shockDamage = applyStaticShock(s);
	void removeFromInventory(card.id);
	if (s.enemy.hp <= 0 && s.status === 'active') s.status = 'victory';

	void persistBattle();
	return { played: true, exhausted: true, kind: 'relic', shockDamage };
}

export function endTurn(): EnemyTurnResult | null {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') return null;

	discardHand(s);
	s.turn = 'enemy';
	s.enemy.block = 0;

	const intent = s.enemy.intent;
	let turnResult: EnemyTurnResult;
	if (intent.kind === 'attack') {
		const attackElement = intent.element ?? s.enemy.pokemon.element;
		let dmg = intent.damage + s.enemy.nextDamageBonus;
		// Apply intimidate reduction if active
		if (s.enemy.intimidateTurnsLeft > 0) {
			dmg = Math.round(dmg * (1 - s.enemy.intimidateDamageReduction));
			s.enemy.intimidateTurnsLeft--;
		}
		const typedDamage = resolveTypedDamage(dmg, attackElement, s.player.pokemon.element);
		s.enemy.nextDamageBonus = 0;
		const absorbed = Math.min(s.player.block, typedDamage.damage);
		dealToPlayer(typedDamage.damage);
		turnResult = {
			kind: 'attack',
			element: attackElement,
			damage: Math.max(0, typedDamage.damage - absorbed),
			absorbed,
			effectiveness: typedDamage.effectiveness,
			damageModifier: typedDamage.modifierAmount,
			damageModifierText: typedDamage.modifierText
		};
	} else if (intent.kind === 'defend') {
		s.enemy.block += intent.block;
		turnResult = { kind: 'defend', enemyBlock: intent.block };
	} else {
		s.enemy.nextDamageBonus += intent.nextDamage;
		turnResult = { kind: 'buff', buffAmount: intent.nextDamage };
	}

	if (s.player.hp <= 0) {
		s.status = 'defeat';
		void setPokemonCurrentHp(s.player.pokemon.id, 0);
		void persistBattle();
		return turnResult;
	}

	const scaling = getRegionScaling(s.regionId);
	s.enemy.intent = rollIntent(s.enemy.hp, s.enemy.pokemon.maxHp, s.turnNumber, scaling, s.enemy.pokemon.element);
	s.turnNumber++;
	s.player.block = 0;
	s.player.mana = START_MANA;
	s.player.ghostForm = false;
	s.turn = 'player';
	drawCards(HAND_SIZE);
	void persistBattle();
	return turnResult;
}

// ── Reward settlement ─────────────────────────────────────────────────────

export async function finalizeBattle(): Promise<void> {
	const s = battle.state;
	if (!s || battle.settled || s.status === 'active') return;
	battle.settled = true;
	await clearSavedBattle();

	const isBossFight = s.mode === 'boss';
	if (isBossFight && s.bossFirstFightBlockedCapture) {
		await markBossFightDone(s.regionId);
	}

	if (s.status === 'defeat') {
		await setPokemonCurrentHp(s.player.pokemon.id, 0);
		setActivePokemon(null);
		// On defeat: permanently delete all non-starter cards from deck and inventory.
		const allInventory = await getInventory();
		for (const card of allInventory) {
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
	if (isBossFight) {
		bossCardReward = pickBossRewardCard(s.enemy.pokemon.element);
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
		bossCardReward
	};
}
