import { getElementInteraction } from './type-chart';
import { getElementalDamageLevel } from './state.svelte';
import type { BattleState, CardTemplate, Element } from './types';

const GLOBAL_DAMAGE_PER_LEVEL = 3;
const DAMAGE_PER_POKEMON_BUFF = 2;

export interface TypedDamageSummary {
	damage: number;
	effectiveness: number;
	modifierAmount: number;
	modifierText: string;
	hits?: number;
}

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

export function playerAttackBonus(s: BattleState): number {
	return (
		getElementalDamageLevel(s.player.pokemon.element) * GLOBAL_DAMAGE_PER_LEVEL +
		(s.player.pokemon.damageBuffs ?? 0) * DAMAGE_PER_POKEMON_BUFF
	);
}
