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
	if (!tpl) return false;
	if (tpl.exhaust === 'run') return true;
	if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
	return false;
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
		// Evasão Total bonus draw/mana from previous turn
		const bonusDraw = s.player.nextTurnBonusDraw;
		const bonusMana = s.player.nextTurnBonusMana;
		s.player.nextTurnBonusDraw = 0;
		s.player.nextTurnBonusMana = 0;
		if (bonusMana > 0) s.player.mana = Math.min(s.player.mana + bonusMana, 6);
		count += bonusDraw;

		// Per-turn state resets
		s.player.firstAttackThisTurn = true;
		s.player.damageSufferedThisTurn = false;
		s.player.autoJogarUsedThisTurn = 0;
		s.player.reflexoActive = false;

		// Assombração Progressiva: +1 damage bonus per turn for ghost cards
		if (s.player.assombracaoActive) s.player.assombracaoBonus++;

		// Decay ENRAIZADO and FRAQUEZA stacks
		if (s.enemy.enraizadoTurns > 0) s.enemy.enraizadoTurns--;
		if (s.enemy.fraquezaStacks > 0) s.enemy.fraquezaStacks--;

		// Rocha Imóvel: if player had block when turn ended, grant +1 mana
		if (s.player.rochaImovelPending) {
			s.player.rochaImovelPending = false;
			// block was checked at end of endTurn — bonus already applied via nextTurnBonusMana
		}

		// AUTO_JOGAR: auto-play fighter cards (Ritmo Implacável)
		if (s.player.autoJogarActive) {
			const fightingCards = s.hand.filter((c) => getTemplate(c.templateId)?.element === 'fighting');
			const toAutoPlay = fightingCards.slice(0, 3 - s.player.autoJogarUsedThisTurn);
			for (const autoCard of toAutoPlay) {
				if (s.status !== 'active') break;
				const autoTpl = getTemplate(autoCard.templateId);
				if (!autoTpl) continue;
				const idx = s.hand.findIndex((c) => c.id === autoCard.id);
				if (idx < 0) continue;
				// Auto-play without mana cost
				s.hand.splice(idx, 1);
				applyCardEffect(s, autoTpl, autoCard);
				discardOrExhaust(autoCard);
				s.player.autoJogarUsedThisTurn++;
			}
		}
	}

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

function dealToPlayer(amount: number): number {
	const p = battle.state!.player;
	if (p.ghostForm) amount = 1;
	const blockBefore = p.block;
	const afterBlock = amount - p.block;
	p.block = Math.max(0, p.block - amount);

	// REFLEXO (ART-09): reflect 50% of absorbed damage to enemy
	if (p.reflexoActive && blockBefore > 0) {
		const absorbed = Math.min(blockBefore, amount);
		dealToEnemy(Math.floor(absorbed * 0.5));
	}

	// GLACIAÇÃO (artRevengeShield): deal damage to enemy when shield fully destroyed
	if (p.revengeShieldDamage > 0 && blockBefore > 0 && p.block === 0) {
		dealToEnemy(p.revengeShieldDamage);
		p.revengeShieldDamage = 0;
	}

	if (afterBlock > 0) {
		p.hp = Math.max(0, p.hp - afterBlock);
		p.damageSufferedThisTurn = true;
		p.damageReceivedLastTurn += afterBlock;
		battle.playerHurt++;
	}
	return Math.min(blockBefore, amount);
}

// ── Card exhaustion ───────────────────────────────────────────────────────

function shouldExhaust(card: Card): boolean {
	const s = battle.state!;
	const tpl = getTemplate(card.templateId);
	if (!tpl) return false;
	// Explicit exhaust tag on card
	if (tpl.exhaust === 'combat' || tpl.exhaust === 'run') return true;
	// Non-starter pokéballs are single-use
	if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
	// Misalignment: off-element → EXHAUST_COMBATE (returns next combat, no permanent deletion)
	if (tpl.element !== null && tpl.element !== s.player.pokemon.element) return true;
	return false;
}

function discardOrExhaust(card: Card): boolean {
	const s = battle.state!;
	if (shouldExhaust(card)) {
		s.exhausted.push(card);
		if (isPermanentlyConsumed(getTemplate(card.templateId))) {
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

function countCardCopies(s: BattleState, templateId: string): number {
	return [...s.deck, ...s.hand, ...s.discard].filter((c) => c.templateId === templateId).length;
}

function applyCardEffect(s: BattleState, tpl: CardTemplate, card?: Card): void {
	// ── Kind-specific behavior ─────────────────────────────────────────
	switch (tpl.kind) {
		case 'attack': {
			const attackElement = resolvePlayerAttackElement(s, tpl);
			let base = s.player.nextDamageBonus + playerAttackBonus();

			// Fúria do Dragão: special damage formula
			if (tpl.artFuriaDragao) {
				const dragBase = 10 + s.player.cargaDragao;
				base += s.player.furiaDragaoDouble ? dragBase * 2 : dragBase;
			} else {
				base += tpl.damage ?? 0;
			}

			// SEQUENCIA (ART-17): bonus for consecutive fighter cards
			if (s.player.sequenciaActive) {
				if (attackElement === 'fighting') {
					base += s.player.sequenciaCount * 2;
					s.player.sequenciaCount++;
				} else {
					s.player.sequenciaCount = 0;
				}
			}

			// Assombração Progressiva: bonus for ghost attack cards
			if (s.player.assombracaoActive && attackElement === 'ghost') {
				base += s.player.assombracaoBonus;
			}

			s.player.nextDamageBonus = 0;
			const berserkMult = s.player.berserk ? 2 : 1;
			const attackTyped = resolveTypedDamage(base * berserkMult, attackElement, s.enemy.pokemon.element);
			let finalDamage = attackTyped.damage;

			// ENRAIZADO (ART-06): grass cards deal double
			if (tpl.artGrassDoubleIfEnraizado && s.enemy.enraizadoTurns > 0) finalDamage *= 2;

			// FRAQUEZA (ART-05): +25% per stack
			if (s.enemy.fraquezaStacks > 0)
				finalDamage = Math.floor(finalDamage * (1 + 0.25 * s.enemy.fraquezaStacks));

			// Congelamento Progressivo: track ice cards played
			if (attackElement === 'ice') s.player.iceCardsPlayedThisCombat++;

			const hits = 1 + s.player.attackRepeat;
			s.player.attackRepeat = 0;
			for (let i = 0; i < hits; i++) dealToEnemy(finalDamage);

			// Golpe Aéreo: draw 1 if first attack this turn
			if (tpl.id === 'flying_golpe_aereo' && s.player.firstAttackThisTurn) drawCards(1);
			s.player.firstAttackThisTurn = false;

			// Descarga Elétrica: discard hand, deal 2 per card discarded
			if (tpl.id === 'electric_descarga') {
				const discardCount = s.hand.length;
				s.discard.push(...s.hand);
				s.hand = [];
				if (discardCount > 0) dealToEnemy(discardCount * 2);
			}

			// Refluxo Mental: deal back damage received last turn (max 30)
			if (tpl.id === 'psychic_refluxo') {
				const refluxo = Math.min(s.player.damageReceivedLastTurn, 30);
				if (refluxo > 0) dealToEnemy(refluxo);
			}

			// Enxame Voraz: 2 × PILHA_EXAURIR
			if (tpl.id === 'bug_enxame' && s.pilhaExaurir > 0) dealToEnemy(2 * s.pilhaExaurir);

			// Corte de Tesoura: exhaust 1 insect card from hand
			if (tpl.id === 'bug_corte') {
				const insectIdx = s.hand.findIndex((c) => getTemplate(c.templateId)?.element === 'bug');
				if (insectIdx >= 0) {
					const insectCard = s.hand.splice(insectIdx, 1)[0];
					const insectTpl = getTemplate(insectCard.templateId);
					s.exhausted.push(insectCard);
					if (isPermanentlyConsumed(insectTpl)) {
						void removeFromDeck(insectCard.id);
						void removeFromInventory(insectCard.id);
					}
					if (insectTpl?.artPilhaExaurir) {
						s.pilhaExaurir += insectTpl.artPilhaExaurir;
					}
				}
			}
			break;
		}

		case 'defense': {
			// Effective block with per-instance modifier (Espinhos artBlockDecrement)
			const baseBlock = tpl.block ?? 0;
			const cardModifier = card?.modifier ?? 0;
			let block = Math.max(0, baseBlock + cardModifier);
			if (s.player.berserk) block = Math.max(1, Math.floor(block / 2));
			s.player.block += block;

			// Shield effects
			if (tpl.id === 'rock_muralha') {
				s.player.shieldPersists = true;
			} else if (tpl.shieldEffect) {
				s.player.shieldEffect = tpl.shieldEffect;
			}

			// artRevengeShield (Glaciação)
			if (tpl.artRevengeShield) s.player.revengeShieldDamage = tpl.artRevengeShield;

			// Evasão: +4 block if no damage taken this turn
			if (tpl.id === 'flying_evasao' && !s.player.damageSufferedThisTurn) s.player.block += 4;

			// Fortaleza de Silex: double current total block
			if (tpl.id === 'rock_fortaleza') s.player.block *= 2;

			// Rocha Imóvel: mark to check at end of turn
			if (tpl.id === 'rock_rocha_imovel') s.player.rochaImovelPending = true;
			break;
		}

		case 'heal':
			s.player.hp = Math.min(s.player.pokemon.maxHp, s.player.hp + (tpl.healHp ?? 0));
			break;

		case 'buff':
			if (tpl.buffAmount) s.player.nextDamageBonus += tpl.buffAmount;
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
			// Legacy power cards (saves compatibility)
			if (tpl.id === 'power_berserk') s.player.berserk = true;
			if (tpl.id === 'power_dragonize') s.player.dragonize = true;
			if (tpl.id === 'power_electric_shock') s.player.staticShockDamage += 2;
			if (tpl.id === 'power_specialize') s.player.specialize = true;
			// Assombração Progressiva
			if (tpl.id === 'ghost_assombracao') { s.player.assombracaoActive = true; s.player.assombracaoBonus = 0; }
			// Congelamento Progressivo: deal 3 × ice cards played
			if (tpl.artCongelamento) {
				const congDmg = 3 * s.player.iceCardsPlayedThisCombat;
				if (congDmg > 0) dealToEnemy(congDmg);
				// Also track this ice card itself
				s.player.iceCardsPlayedThisCombat++;
			}
			// artEndsTurn (Evasão Total): handled in playCard after applyCardEffect
			break;

		case 'relic':
			s.player.ghostForm = true;
			break;

		case 'energy':
			// manaGain applied universally below
			break;

		case 'combo':
			s.player.attackRepeat = tpl.attackRepeat ?? 1;
			break;

		case 'debuff':
			// Legacy intimidate
			if (tpl.debuffDuration && tpl.debuffAmount) {
				s.enemy.intimidateTurnsLeft = tpl.debuffDuration;
				s.enemy.intimidateDamageReduction = tpl.debuffAmount;
			}
			break;
	}

	// ── Universal effects (apply for any kind) ─────────────────────────

	// Mana gain/loss
	if (tpl.manaGain) {
		s.player.mana = clamp(s.player.mana + tpl.manaGain, 0, 6);
	}

	// Draw cards from card effect
	if ((tpl.drawCount ?? 0) > 0) drawCards(tpl.drawCount ?? 0);

	// Self-damage (Fogo cards)
	if (tpl.selfDamage) {
		s.player.hp = Math.max(0, s.player.hp - tpl.selfDamage);
	}

	// Max HP reduction (Fantasma cards)
	if (tpl.selfMaxHpReduction) {
		s.player.pokemon.maxHp = Math.max(1, s.player.pokemon.maxHp - tpl.selfMaxHpReduction);
		s.player.hp = Math.min(s.player.hp, s.player.pokemon.maxHp);
	}

	// IMOBILIZADO (ART-04)
	if (tpl.imobilizadoTurns) s.enemy.imobilizadoTurns += tpl.imobilizadoTurns;

	// FRAQUEZA (ART-05) — stacks added via card
	if (tpl.fraquezaStacks) s.enemy.fraquezaStacks += tpl.fraquezaStacks;

	// ENRAIZADO (ART-06)
	if (tpl.enraizadoTurns) s.enemy.enraizadoTurns += tpl.enraizadoTurns;

	// CARGA_DRAGAO (ART-07)
	if (tpl.cargaDragaoGain) {
		s.player.cargaDragao += tpl.cargaDragaoGain;
		const newGrants = Math.floor(s.player.cargaDragao / 4);
		const grantDiff = newGrants - s.player.cargaDragaoEnergyGranted;
		if (grantDiff > 0) {
			s.player.mana = Math.min(s.player.mana + grantDiff * 2, 6);
			s.player.cargaDragaoEnergyGranted = newGrants;
		}
	}

	// REFLEXO (ART-09)
	if (tpl.artReflexo) s.player.reflexoActive = true;

	// DUPLICAR_CARTA (ART-10): set flag — handled in playCard
	if (tpl.artDuplicarCarta) s.player.duplicarCartaActive = true;

	// DANO_ELETRICO (ART-11)
	if (tpl.artDanoEletrico) s.player.danoEletricoBonus += tpl.artDanoEletrico;

	// CANCEL_ESCUDO (ART-12)
	if (tpl.artCancelEscudo) s.enemy.shieldCancelled = true;

	// REDUZ_SHIELD (ART-13)
	if (tpl.artReduzShield) s.enemy.shieldReduced = true;

	// REDUZ_BUFF (ART-14)
	if (tpl.artReduzBuff) s.enemy.buffReduced = true;

	// AMPLIFICA (ART-15): double all active debuffs on enemy
	if (tpl.artAmplifica) {
		s.enemy.imobilizadoTurns *= 2;
		s.enemy.fraquezaStacks *= 2;
		s.enemy.enraizadoTurns *= 2;
		s.enemy.intimidateTurnsLeft *= 2;
	}

	// COPIA_DESCARTE (ART-16)
	if (tpl.artCopiaDescarte && card) {
		const copies = countCardCopies(s, tpl.id);
		if (copies < tpl.artCopiaDescarte) {
			const modifier = tpl.artBlockDecrement ? (card.modifier ?? 0) - 1 : undefined;
			const newCard: Card = { id: crypto.randomUUID(), templateId: tpl.id, ...(modifier !== undefined ? { modifier } : {}) };
			s.discard.push(newCard);
		}
	}

	// SEQUENCIA (ART-17): activated by Punho Sincronizado
	if (tpl.artSequencia) s.player.sequenciaActive = true;

	// AUTO_JOGAR (ART-18): activated by Ritmo Implacável
	if (tpl.artAutoJogar) s.player.autoJogarActive = true;

	// PILHA_EXAURIR (ART-19)
	if (tpl.artPilhaExaurir) s.pilhaExaurir += tpl.artPilhaExaurir;

	// BANIDO (ART-20)
	if (tpl.artBanido) {
		if (!s.bannedTemplateIds.includes(tpl.id)) s.bannedTemplateIds.push(tpl.id);
	}

	// Prisão Eterna: double active IMOBILIZADO duration
	if (tpl.artPrisaoEterna && s.enemy.imobilizadoTurns > 0) s.enemy.imobilizadoTurns *= 2;

	// artBlockDecrement (Espinhos): decrement this card's modifier for next use
	if (tpl.artBlockDecrement && card) {
		card.modifier = (card.modifier ?? 0) - 1;
	}

	// artDuplicarDragao (Poder Canalizado): Fúria do Dragão causes double this fight
	if (tpl.artDuplicarDragao) s.player.furiaDragaoDouble = true;

	// GHOST_PERM_DEBUFF (Alma Penada): reduce enemy damage permanently, exhaust random hand card
	if (tpl.artGhostPermDebuff) {
		s.player.ghostPermDebuff++;
		if (s.hand.length > 0) {
			const randIdx = Math.floor(Math.random() * s.hand.length);
			const exhaust = s.hand.splice(randIdx, 1)[0];
			s.exhausted.push(exhaust);
			// EXHAUST_RUN for the random card (consumed permanently)
			void removeFromDeck(exhaust.id);
			void removeFromInventory(exhaust.id);
		}
	}

	// generatesTokens (Nuvem de Insetos)
	if (tpl.generatesTokens) {
		for (let i = 0; i < tpl.generatesTokens.count; i++) {
			s.hand.push({ id: crypto.randomUUID(), templateId: tpl.generatesTokens.templateId });
		}
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
		if (!s.player.shieldEffect) {
			s.player.shieldEffect = 'none';
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
	const bucket = rollBossRewardBucket();
	let pool = CATALOG.filter((c) => c.element === element && cardMatchesBossBucket(c.rarity, bucket));
	if (pool.length === 0) pool = CATALOG.filter((c) => c.element === element && c.rarity !== 'starter');
	if (pool.length === 0) pool = CATALOG.filter((c) => cardMatchesBossBucket(c.rarity, bucket));
	if (pool.length === 0) pool = CATALOG.filter((c) => c.rarity !== 'starter');
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
			shieldEffect: 'none',
			attackRepeat: 0,
			specialize: false,
			// GDD artifact state
			shieldPersists: false,
			reflexoActive: false,
			duplicarCartaActive: false,
			danoEletricoBonus: 0,
			sequenciaActive: false,
			sequenciaCount: 0,
			autoJogarActive: false,
			autoJogarUsedThisTurn: 0,
			cargaDragao: 0,
			cargaDragaoEnergyGranted: 0,
			furiaDragaoDouble: false,
			iceCardsPlayedThisCombat: 0,
			nextTurnBonusDraw: 0,
			nextTurnBonusMana: 0,
			damageReceivedLastTurn: 0,
			revengeShieldDamage: 0,
			firstAttackThisTurn: true,
			damageSufferedThisTurn: false,
			assombracaoActive: false,
			assombracaoBonus: 0,
			rochaImovelPending: false,
			ghostPermDebuff: game.player?.ghostPermDebuff ?? 0
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: rollIntent(enemy.maxHp, enemy.maxHp, 1, scaling, enemy.element),
			nextDamageBonus: 0,
			poisonCounter: 0,
			intimidateTurnsLeft: 0,
			intimidateDamageReduction: 0,
			imobilizadoTurns: 0,
			enraizadoTurns: 0,
			fraquezaStacks: 0,
			shieldCancelled: false,
			shieldReduced: false,
			buffReduced: false
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

	// ART-03 POWER: can only be played once per combat
	if (tpl.isPower) {
		if (s.usedPowerIds.includes(tpl.id)) return { played: false, exhausted: false, kind: tpl.kind };
		s.usedPowerIds.push(tpl.id);
	}

	s.player.mana -= tpl.cost;
	s.hand.splice(idx, 1);
	const attackElement = tpl.kind === 'attack' ? resolvePlayerAttackElement(s, tpl) : null;
	const attackHits = tpl.kind === 'attack' ? 1 + s.player.attackRepeat : 0;
	const attackDamage =
		tpl.kind === 'attack'
			? resolveTypedDamage(
					((tpl.artFuriaDragao ? (10 + s.player.cargaDragao) * (s.player.furiaDragaoDouble ? 2 : 1) : (tpl.damage ?? 0)) + s.player.nextDamageBonus + playerAttackBonus()) * (s.player.berserk ? 2 : 1),
					attackElement,
					s.enemy.pokemon.element
				)
			: null;

	// Snapshot pre-effect state for delta logging
	const enemyHpBefore = s.enemy.hp;
	const playerHpBefore = s.player.hp;
	const playerBlockBefore = s.player.block;
	const duplicarWasActive = s.player.duplicarCartaActive;

	applyCardEffect(s, tpl, card);

	// ART-10 DUPLICAR_CARTA: execute effect again if flag was active before this card
	if (duplicarWasActive && !tpl.isPower && !tpl.artDuplicarCarta) {
		s.player.duplicarCartaActive = false;
		applyCardEffect(s, tpl, card);
	} else if (duplicarWasActive && tpl.artDuplicarCarta) {
		// Playing a duplicar card while another is active: consume both but don't double
		s.player.duplicarCartaActive = false;
	}

	// ART-11 DANO_ELETRICO: deal bonus electric damage after any card play
	if (s.player.danoEletricoBonus > 0 && s.status === 'active') {
		const elecDmg = resolveTypedDamage(s.player.danoEletricoBonus, 'electric', s.enemy.pokemon.element).damage;
		if (elecDmg > 0) dealToEnemy(elecDmg);
	}

	const shockDamage = applyStaticShock(s);

	const exhausted = discardOrExhaust(card);

	// Build enriched result
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

	// artEndsTurn (Evasão Total): trigger enemy turn immediately
	if (tpl.artEndsTurn && s.status === 'active') {
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

	// Rocha Imóvel: if player has block when turn ends, grant +1 mana next turn
	if (s.player.rochaImovelPending) {
		s.player.rochaImovelPending = false;
		if (s.player.block > 0) s.player.nextTurnBonusMana++;
	}

	discardHand(s);
	s.turn = 'enemy';
	s.enemy.block = 0;

	// Reset per-turn damage tracking
	s.player.damageReceivedLastTurn = 0;

	const intent = s.enemy.intent;
	let turnResult: EnemyTurnResult;

	if (intent.kind === 'attack') {
		const attackElement = intent.element ?? s.enemy.pokemon.element;
		let dmg = intent.damage + s.enemy.nextDamageBonus;

		// IMOBILIZADO (ART-04): halve enemy damage
		if (s.enemy.imobilizadoTurns > 0) {
			dmg = Math.floor(dmg * 0.5);
			s.enemy.imobilizadoTurns--;
		}

		// Legacy intimidate
		if (s.enemy.intimidateTurnsLeft > 0) {
			dmg = Math.round(dmg * (1 - s.enemy.intimidateDamageReduction));
			s.enemy.intimidateTurnsLeft--;
		}

		// Alma Penada permanent damage reduction
		if (s.player.ghostPermDebuff > 0) {
			dmg = Math.max(0, dmg - s.player.ghostPermDebuff);
		}

		const typedDamage = resolveTypedDamage(dmg, attackElement, s.player.pokemon.element);
		s.enemy.nextDamageBonus = 0;
		const absorbed = dealToPlayer(typedDamage.damage);
		if (absorbed > 0) {
			if (s.player.shieldEffect === 'fire_thorns') dealToEnemy(10);
			else if (s.player.shieldEffect === 'ice_reflect') dealToEnemy(absorbed);
		}
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
		if (s.enemy.shieldCancelled) {
			turnResult = { kind: 'defend', enemyBlock: 0 };
		} else {
			let blockGain = intent.block;
			// REDUZ_SHIELD (ART-13): halve enemy block gain
			if (s.enemy.shieldReduced) blockGain = Math.floor(blockGain * 0.5);
			s.enemy.block += blockGain;
			turnResult = { kind: 'defend', enemyBlock: blockGain };
		}
	} else {
		let buffAmount = intent.nextDamage;
		// REDUZ_BUFF (ART-14): halve enemy buff
		if (s.enemy.buffReduced) buffAmount = Math.floor(buffAmount * 0.5);
		s.enemy.nextDamageBonus += buffAmount;
		turnResult = { kind: 'buff', buffAmount };
	}

	if (s.player.hp <= 0) {
		s.status = 'defeat';
		void setPokemonCurrentHp(s.player.pokemon.id, 0);
		void persistBattle();
		return turnResult;
	}

	// Reset per-turn enemy flags
	s.enemy.shieldCancelled = false;
	s.enemy.shieldReduced = false;
	s.enemy.buffReduced = false;

	const scaling = getRegionScaling(s.regionId);
	s.enemy.intent = rollIntent(s.enemy.hp, s.enemy.pokemon.maxHp, s.turnNumber, scaling, s.enemy.pokemon.element);
	s.turnNumber++;

	// ESCUDO_PERSISTE (ART-08): don't clear player block if shieldPersists
	if (s.player.shieldPersists) {
		s.player.shieldPersists = false;
	} else {
		s.player.block = 0;
	}

	s.player.shieldEffect = 'none';
	s.player.mana = START_MANA;
	s.player.ghostForm = false;
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
