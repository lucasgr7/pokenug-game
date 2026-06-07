import type { BattleState } from './types';
import { getElementInteraction } from './type-chart';
import { hasStatus, getStatus } from './status/pipeline';

/** Enemy attack damage after debuffs but before type multiplier. */
export function enemyAttackDamageAfterDebuffs(s: BattleState): number {
	const it = s.enemy.intent;
	if (it.kind !== 'attack') return 0;
	let dmg = it.damage + s.enemy.nextDamageBonus;

	if (hasStatus(s.enemy, 'imobilizado')) {
		dmg = Math.floor(dmg * 0.5);
	}

	if (hasStatus(s.enemy, 'intimidate')) {
		const reduction = getStatus(s.enemy, 'intimidate')!.data?.reduction ?? 0;
		dmg = Math.round(dmg * (1 - reduction));
	}

	if (s.player.ghostPermDebuff > 0) {
		dmg = Math.max(0, dmg - s.player.ghostPermDebuff);
	}

	return dmg;
}

/** Projected enemy attack damage after debuffs + type multiplier. */
export function projectedEnemyDamage(s: BattleState): number {
	const it = s.enemy.intent;
	if (it.kind !== 'attack') return 0;
	const dmg = enemyAttackDamageAfterDebuffs(s);
	if (dmg === 0) return 0;
	const attackElement = it.element ?? s.enemy.pokemon.element;
	const interaction = getElementInteraction(attackElement, s.player.pokemon.element);
	return Math.max(0, Math.round(dmg * interaction.multiplier));
}
