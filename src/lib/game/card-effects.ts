import { removeFromDeck, removeFromInventory } from '$lib/db/cards';
import { getTemplate } from '$lib/data/cards';
import { getElementInteraction } from './type-chart';
import { getElementalDamageLevel } from './state.svelte';
import { clamp } from '$lib/utils/math';
import { pushToast } from '$lib/stores/toast.svelte';
import type { BattleState, Card, CardKind, CardTemplate, Element } from './types';

// ── Constants ─────────────────────────────────────────────────────────────

const GLOBAL_DAMAGE_PER_LEVEL = 3;
const DAMAGE_PER_POKEMON_BUFF = 2;

// ── Types ─────────────────────────────────────────────────────────────────

export interface TypedDamageSummary {
	damage: number;
	effectiveness: number;
	modifierAmount: number;
	modifierText: string;
	hits?: number; // set by handleAttack for playCard result-building
}

/**
 * Injected by battle.svelte.ts so card-effects.ts never imports the reactive store.
 * `lastAttackSummary` is written by handleAttack and read by playCard for result metadata.
 */
export interface CardEffectCtx {
	s: BattleState;
	dealToEnemy(amount: number): void;
	dealToPlayer(amount: number): number;
	draw(count: number): void;
	lastAttackSummary?: TypedDamageSummary;
}

// ── Pure helpers ──────────────────────────────────────────────────────────

export function isPermanentlyConsumed(tpl: CardTemplate | null | undefined): boolean {
	if (!tpl) return false;
	if (tpl.exhaust === 'run') return true;
	if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
	return false;
}

export function resolveTypedDamage(
	baseDamage: number,
	attackerElement: Element | null | undefined,
	defenderElement: Element
): TypedDamageSummary {
	const neutralDamage = Math.max(0, Math.round(baseDamage));
	if (!attackerElement) {
		return { damage: neutralDamage, effectiveness: 1, modifierAmount: 0, modifierText: '' };
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

export function resolvePlayerAttackElement(s: BattleState, tpl: CardTemplate): Element | null {
	let attackElement = tpl.element;
	if (s.player.dragonize && (!attackElement || attackElement === 'normal')) attackElement = 'dragon';
	if (s.player.specialize && tpl.rarity === 'starter' && !attackElement)
		attackElement = s.player.pokemon.element;
	return attackElement;
}

export function playerAttackBonus(s: BattleState): number {
	return (
		getElementalDamageLevel(s.player.pokemon.element) * GLOBAL_DAMAGE_PER_LEVEL +
		(s.player.pokemon.damageBuffs ?? 0) * DAMAGE_PER_POKEMON_BUFF
	);
}

function countCardCopies(s: BattleState, templateId: string): number {
	return [...s.deck, ...s.hand, ...s.discard].filter((c) => c.templateId === templateId).length;
}

// ── Kind handlers ─────────────────────────────────────────────────────────

type KindHandler = (ctx: CardEffectCtx, tpl: CardTemplate, card?: Card) => void;

function handleAttack(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	const attackElement = resolvePlayerAttackElement(s, tpl);
	let base = s.player.nextDamageBonus + playerAttackBonus(s);

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
	for (let i = 0; i < hits; i++) ctx.dealToEnemy(finalDamage);

	// Store typed damage + hit count for result-building in playCard
	ctx.lastAttackSummary = { ...attackTyped, hits };

	// Golpe Aéreo: draw 1 if first attack this turn
	if (tpl.id === 'flying_golpe_aereo' && s.player.firstAttackThisTurn) ctx.draw(1);
	s.player.firstAttackThisTurn = false;

	// Descarga Elétrica: discard hand, deal 2 per card discarded
	if (tpl.id === 'electric_descarga') {
		const discardCount = s.hand.length;
		s.discard.push(...s.hand);
		s.hand = [];
		if (discardCount > 0) ctx.dealToEnemy(discardCount * 2);
	}

	// Refluxo Mental: deal back damage received last turn (max 30)
	if (tpl.id === 'psychic_refluxo') {
		const refluxo = Math.min(s.player.damageReceivedLastTurn, 30);
		if (refluxo > 0) ctx.dealToEnemy(refluxo);
	}

	// Enxame Voraz: 2 × PILHA_EXAURIR
	if (tpl.id === 'bug_enxame' && s.pilhaExaurir > 0) ctx.dealToEnemy(2 * s.pilhaExaurir);

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
}

function handleDefense(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void {
	const { s } = ctx;
	const baseBlock = tpl.block ?? 0;
	const cardModifier = card?.modifier ?? 0;
	let block = Math.max(0, baseBlock + cardModifier);
	if (s.player.berserk) block = Math.max(1, Math.floor(block / 2));
	s.player.block += block;

	if (tpl.id === 'rock_muralha') {
		s.player.shieldPersists = true;
	} else if (tpl.shieldEffect) {
		s.player.shieldEffect = tpl.shieldEffect;
	}

	if (tpl.artRevengeShield) s.player.revengeShieldDamage = tpl.artRevengeShield;

	// Evasão: +4 block if no damage taken this turn
	if (tpl.id === 'flying_evasao' && !s.player.damageSufferedThisTurn) s.player.block += 4;

	// Fortaleza de Silex: double current total block
	if (tpl.id === 'rock_fortaleza') s.player.block *= 2;

	// Rocha Imóvel: mark to check at end of turn
	if (tpl.id === 'rock_rocha_imovel') s.player.rochaImovelPending = true;
}

function handleHeal(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	s.player.hp = Math.min(s.player.pokemon.maxHp, s.player.hp + (tpl.healHp ?? 0));
}

function handleBuff(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.buffAmount) s.player.nextDamageBonus += tpl.buffAmount;
}

function handleCapture(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (s.mode === 'boss' && s.bossFirstFightBlockedCapture) {
		pushToast('Primeira luta contra este boss nao permite captura.', 'error');
		return;
	}
	const ratio = s.enemy.pokemon.maxHp > 0 ? s.enemy.hp / s.enemy.pokemon.maxHp : 0;
	const chance = clamp(1 - ratio + (tpl.captureBonus ?? 0), 0, 1);
	if (Math.random() < chance) s.status = 'captured';
}

function handlePower(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.id === 'power_berserk') s.player.berserk = true;
	if (tpl.id === 'power_dragonize') s.player.dragonize = true;
	if (tpl.id === 'power_electric_shock') s.player.staticShockDamage += 2;
	if (tpl.id === 'power_specialize') s.player.specialize = true;
	if (tpl.id === 'ghost_assombracao') {
		s.player.assombracaoActive = true;
		s.player.assombracaoBonus = 0;
	}

	// Congelamento Progressivo: deal 3 × ice cards played
	if (tpl.artCongelamento) {
		const congDmg = 3 * s.player.iceCardsPlayedThisCombat;
		if (congDmg > 0) ctx.dealToEnemy(congDmg);
		s.player.iceCardsPlayedThisCombat++;
	}
	// artEndsTurn (Evasão Total) is handled in playCard after applyCardEffect returns
}

function handleRelic(ctx: CardEffectCtx): void {
	ctx.s.player.ghostForm = true;
}

function handleEnergy(_ctx: CardEffectCtx): void {
	// manaGain is applied universally by applyResourceEffects
}

function handleCombo(ctx: CardEffectCtx, tpl: CardTemplate): void {
	ctx.s.player.attackRepeat = tpl.attackRepeat ?? 1;
}

function handleDebuff(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.debuffDuration && tpl.debuffAmount) {
		s.enemy.intimidateTurnsLeft = tpl.debuffDuration;
		s.enemy.intimidateDamageReduction = tpl.debuffAmount;
	}
}

const kindHandlers: Record<CardKind, KindHandler> = {
	attack: handleAttack,
	defense: handleDefense,
	heal: handleHeal,
	buff: handleBuff,
	capture: handleCapture,
	power: handlePower,
	relic: handleRelic,
	energy: handleEnergy,
	combo: handleCombo,
	debuff: handleDebuff
};

// ── Universal effects ─────────────────────────────────────────────────────

function applyResourceEffects(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.manaGain) s.player.mana = clamp(s.player.mana + tpl.manaGain, 0, 6);
	if ((tpl.drawCount ?? 0) > 0) ctx.draw(tpl.drawCount ?? 0);
	if (tpl.selfDamage) s.player.hp = Math.max(0, s.player.hp - tpl.selfDamage);
	if (tpl.selfMaxHpReduction) {
		s.player.pokemon.maxHp = Math.max(1, s.player.pokemon.maxHp - tpl.selfMaxHpReduction);
		s.player.hp = Math.min(s.player.hp, s.player.pokemon.maxHp);
	}
}

function applyDebuffApplications(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.imobilizadoTurns) s.enemy.imobilizadoTurns += tpl.imobilizadoTurns;
	if (tpl.fraquezaStacks) s.enemy.fraquezaStacks += tpl.fraquezaStacks;
	if (tpl.enraizadoTurns) s.enemy.enraizadoTurns += tpl.enraizadoTurns;
}

function applyBuffApplications(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;

	if (tpl.cargaDragaoGain) {
		s.player.cargaDragao += tpl.cargaDragaoGain;
		const newGrants = Math.floor(s.player.cargaDragao / 4);
		const grantDiff = newGrants - s.player.cargaDragaoEnergyGranted;
		if (grantDiff > 0) {
			s.player.mana = Math.min(s.player.mana + grantDiff * 2, 6);
			s.player.cargaDragaoEnergyGranted = newGrants;
		}
	}

	if (tpl.artReflexo) s.player.reflexoActive = true;
	if (tpl.artDanoEletrico) s.player.danoEletricoBonus += tpl.artDanoEletrico;
	if (tpl.artSequencia) s.player.sequenciaActive = true;
	if (tpl.artAutoJogar) s.player.autoJogarActive = true;
}

function applyEnemyDebuffModifiers(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.artCancelEscudo) s.enemy.shieldCancelled = true;
	if (tpl.artReduzShield) s.enemy.shieldReduced = true;
	if (tpl.artReduzBuff) s.enemy.buffReduced = true;
	if (tpl.artAmplifica) {
		s.enemy.imobilizadoTurns *= 2;
		s.enemy.fraquezaStacks *= 2;
		s.enemy.enraizadoTurns *= 2;
		s.enemy.intimidateTurnsLeft *= 2;
	}
	if (tpl.artPrisaoEterna && s.enemy.imobilizadoTurns > 0) s.enemy.imobilizadoTurns *= 2;
}

function applyCardManipulation(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void {
	const { s } = ctx;

	// DUPLICAR_CARTA (ART-10): set flag — double-execution is orchestrated in playCard
	if (tpl.artDuplicarCarta) s.player.duplicarCartaActive = true;

	// COPIA_DESCARTE (ART-16)
	if (tpl.artCopiaDescarte && card) {
		const copies = countCardCopies(s, tpl.id);
		if (copies < tpl.artCopiaDescarte) {
			const modifier = tpl.artBlockDecrement ? (card.modifier ?? 0) - 1 : undefined;
			const newCard: Card = {
				id: crypto.randomUUID(),
				templateId: tpl.id,
				...(modifier !== undefined ? { modifier } : {})
			};
			s.discard.push(newCard);
		}
	}

	// artBlockDecrement (Espinhos): decrement this card's modifier for next use
	if (tpl.artBlockDecrement && card) card.modifier = (card.modifier ?? 0) - 1;

	// BANIDO (ART-20)
	if (tpl.artBanido && !s.bannedTemplateIds.includes(tpl.id)) s.bannedTemplateIds.push(tpl.id);

	// PILHA_EXAURIR (ART-19)
	if (tpl.artPilhaExaurir) s.pilhaExaurir += tpl.artPilhaExaurir;

	// artDuplicarDragao (Poder Canalizado)
	if (tpl.artDuplicarDragao) s.player.furiaDragaoDouble = true;

	// GHOST_PERM_DEBUFF (Alma Penada): reduce enemy damage, exhaust random hand card
	if (tpl.artGhostPermDebuff) {
		s.player.ghostPermDebuff++;
		if (s.hand.length > 0) {
			const randIdx = Math.floor(Math.random() * s.hand.length);
			const exhaust = s.hand.splice(randIdx, 1)[0];
			s.exhausted.push(exhaust);
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

function applyUniversalEffects(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void {
	applyResourceEffects(ctx, tpl);
	applyDebuffApplications(ctx, tpl);
	applyBuffApplications(ctx, tpl);
	applyEnemyDebuffModifiers(ctx, tpl);
	applyCardManipulation(ctx, tpl, card);
}

// ── Main export ───────────────────────────────────────────────────────────

export function applyCardEffect(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void {
	kindHandlers[tpl.kind](ctx, tpl, card);
	applyUniversalEffects(ctx, tpl, card);
}
