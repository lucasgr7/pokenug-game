import type { Card, CardTemplate, CardKind } from '$lib/game/types';
import type { CardEffectCtx } from './types';
import {
	addStatus,
	hasStatus,
	removeStatus,
	getStatus,
	resolveAttackElement,
	runAttackBase,
	runAttackFinal,
	runOutgoingBlock
} from '$lib/game/status/pipeline';
import { resolveTypedDamage, playerAttackBonus, isPermanentlyConsumed } from '$lib/game/damage';
import { clamp } from '$lib/utils/math';
import { pushToast } from '$lib/stores/toast.svelte';
import { CARD_HOOKS } from './card-hooks';

type KindHandler = (ctx: CardEffectCtx, tpl: CardTemplate, card?: Card) => void;

function handleAttack(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	const attackElement = resolveAttackElement(s, (() => {
		let el = tpl.element;
		if (hasStatus(s.player, 'dragonize') && (!el || el === 'normal')) el = 'dragon';
		if (hasStatus(s.player, 'specialize') && tpl.rarity === 'starter' && !el)
			el = s.player.pokemon.element;
		return el;
	})(), tpl);
	const hook = CARD_HOOKS[tpl.id]?.onBeforeDamage;
	let base = playerAttackBonus(s);
	if (hook) {
		base += hook(ctx, tpl);
	} else {
		base += tpl.damage ?? 0;
	}

	const withBaseMods = runAttackBase(s, base, tpl, attackElement);
	const attackTyped = resolveTypedDamage(withBaseMods, attackElement, s.enemy.pokemon.element);
	let finalDamage = runAttackFinal(s, attackTyped.damage, tpl, attackElement);

	if (attackElement === 'ice') {
		addStatus(s.player, 'ice_count', 1);
	}

	const hits = 1 + (hasStatus(s.player, 'attack_repeat') ? (getStatus(s.player, 'attack_repeat')?.stacks ?? 0) : 0);
	removeStatus(s.player, 'attack_repeat');
	for (let i = 0; i < hits; i++) ctx.dealToEnemy(finalDamage);

	ctx.lastAttackSummary = { ...attackTyped, hits };

	CARD_HOOKS[tpl.id]?.onAfterAttack?.(ctx, tpl);

	s.player.turnFlags.firstAttackThisTurn = false;
}

function handleDefense(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void {
	const { s } = ctx;
	const baseBlock = tpl.block ?? 0;
	const cardModifier = card?.modifier ?? 0;
	const rawBlock = Math.max(0, baseBlock + cardModifier);
	const block = runOutgoingBlock(s, rawBlock);
	s.player.block += block;

	CARD_HOOKS[tpl.id]?.onPlay?.(ctx, tpl, card);
}

function handleHeal(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	s.player.hp = Math.min(s.player.pokemon.maxHp, s.player.hp + (tpl.healHp ?? 0));
}

function handleBuff(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.buffAmount) addStatus(s.player, 'empowered', tpl.buffAmount);
	CARD_HOOKS[tpl.id]?.onPlay?.(ctx, tpl);
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
	CARD_HOOKS[tpl.id]?.onPlay?.(ctx, tpl);
}

function handleRelic(ctx: CardEffectCtx): void {
	addStatus(ctx.s.player, 'ghost_form');
}

function handleEnergy(_ctx: CardEffectCtx): void {
}

function handleCombo(ctx: CardEffectCtx, tpl: CardTemplate): void {
	addStatus(ctx.s.player, 'attack_repeat', tpl.attackRepeat ?? 1);
}

function handleDebuff(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.debuffDuration && tpl.debuffAmount) {
		addStatus(s.enemy, 'intimidate', tpl.debuffDuration, { reduction: tpl.debuffAmount });
	}
}

export const KIND_EMITTERS: Record<CardKind, KindHandler> = {
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
