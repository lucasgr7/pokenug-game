import type { BattleState, Card, CardTemplate, Element } from '$lib/game/types';

export interface ActiveStatus {
  defId: string;
  stacks: number;
  data?: Record<string, number>;
}

export type StatusScope = 'player' | 'enemy';

export type StatusDecay = 'permanent' | 'turnStart' | 'turnEnd';

export type BattleEvent =
  | { kind: 'bonus_dmg'; source: string; amount: number }
  | { kind: 'status_applied'; id: string; target: StatusScope; stacks: number }
  | { kind: 'reshuffle'; source: 'discard' | 'exhausted'; count: number }
  | { kind: 'rocha_imovel_ativada' };

export interface Emblem {
  icon: string; label: string; title: string; color: string; bg: string;
}

export interface StatusCtx {
  s: BattleState;
  self: ActiveStatus;
  dealToEnemy(amount: number): void;
  dealToPlayer(amount: number): number;
  draw(count: number): void;
  log(e: BattleEvent): void;
}

export interface DamageCtx extends StatusCtx {
  element: Element | null;
  tpl: CardTemplate | null;
}

export interface StatusHooks {
	onApply?(ctx: StatusCtx): void;
	resolveAttackElement?(el: Element | null, ctx: DamageCtx): Element | null;
	modifyAttackBase?(value: number, ctx: DamageCtx): number;
	modifyAttackFinal?(value: number, ctx: DamageCtx): number;
	modifyOutgoingBlock?(value: number, ctx: StatusCtx): number;
	modifyIncomingDamage?(value: number, ctx: StatusCtx): number;
	onCardPlayed?(ctx: StatusCtx, tpl: CardTemplate, card: Card): void;
	onAfterAttack?(ctx: DamageCtx): void;
	onTurnStart?(ctx: StatusCtx): void;
	onTurnEnd?(ctx: StatusCtx): void;
	onBattleStart?(ctx: StatusCtx): void;
	onBattleStartAfterDraw?(ctx: StatusCtx): void;
	modifyCardCost?(cost: number, tpl: CardTemplate, card: Card, ctx: StatusCtx): number;
	modifyHandSize?(size: number, ctx: StatusCtx): number;
	shouldExhaust?(card: Card, tpl: CardTemplate, current: boolean, ctx: StatusCtx): boolean;
	onCardExhausted?(ctx: StatusCtx, card: Card, tpl: CardTemplate): void;
	emblem?(self: ActiveStatus, s: BattleState): Emblem | null;
}

export interface StatusDefinition {
  id: string;
  scope: StatusScope;
  decay?: StatusDecay;
  priority?: number;
  hooks: StatusHooks;
}
