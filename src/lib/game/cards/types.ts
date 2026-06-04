import type { BattleState, Card, CardTemplate } from '$lib/game/types';
import type { TypedDamageSummary } from '$lib/game/damage';

export interface CardEffectCtx {
	s: BattleState;
	dealToEnemy(amount: number): void;
	dealToPlayer(amount: number): number;
	draw(count: number): void;
	lastAttackSummary?: TypedDamageSummary;
}
