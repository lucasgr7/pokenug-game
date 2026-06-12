import type { Card, CardKind, CardTemplate } from '$lib/game/types';
import type { CardEffectCtx } from './types';
import { addStatus, hasStatus } from '$lib/game/status/pipeline';
import { clamp } from '$lib/utils/math';
import { KIND_EMITTERS } from './kinds';
import { CARD_HOOKS } from './card-hooks';

/**
 * Kinds whose emitter already calls onPlay — skip the generic call for these
 * to avoid double-invocation.
 */
const KINDS_WITH_OWN_ONPLAY: Set<CardKind> = new Set(['defense', 'buff', 'power']);

function applyResourceEffects(ctx: CardEffectCtx, tpl: CardTemplate): void {
	const { s } = ctx;
	if (tpl.manaGain) s.player.mana = clamp(s.player.mana + tpl.manaGain, 0, 6);
	if ((tpl.drawCount ?? 0) > 0) ctx.draw(tpl.drawCount ?? 0);
	if (tpl.selfDamage) {
		if (hasStatus(s.player, 'aproximacao')) {
			ctx.dealToEnemy(tpl.selfDamage);
		} else {
			s.player.hp = Math.max(0, s.player.hp - tpl.selfDamage);
		}
	}
	if (tpl.selfMaxHpReduction) {
		s.player.pokemon.maxHp = Math.max(1, s.player.pokemon.maxHp - tpl.selfMaxHpReduction);
		s.player.hp = Math.min(s.player.hp, s.player.pokemon.maxHp);
	}
}

function applyCardManipulation(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void {
	const { s } = ctx;

	if (tpl.generatesTokens) {
		for (let i = 0; i < tpl.generatesTokens.count; i++) {
			s.hand.push({ id: crypto.randomUUID(), templateId: tpl.generatesTokens.templateId });
		}
	}
}

export function applyCardEffect(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void {
	const { s } = ctx;

	KIND_EMITTERS[tpl.kind](ctx, tpl, card);

	applyResourceEffects(ctx, tpl);

	if (tpl.appliesStatuses) {
		for (const a of tpl.appliesStatuses) {
			const holder = a.target === 'enemy' ? s.enemy : s.player;
			addStatus(holder, a.id, a.stacks ?? 1, a.data);
		}
	}

	if (!KINDS_WITH_OWN_ONPLAY.has(tpl.kind)) {
		CARD_HOOKS[tpl.id]?.onPlay?.(ctx, tpl, card);
	}

	applyCardManipulation(ctx, tpl, card);
}
