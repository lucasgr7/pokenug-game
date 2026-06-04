import type { BattleState, Card, CardTemplate, Element } from '$lib/game/types';

export interface ActiveStatus {
  defId: string;
  stacks: number;
  data?: Record<string, number>;
}

export type StatusScope = 'player' | 'enemy';

export type StatusDecay = 'permanent' | 'turnStart' | 'turnEnd';

export interface Emblem {
  icon: string; label: string; title: string; color: string; bg: string;
}

export interface StatusCtx {
  s: BattleState;
  self: ActiveStatus;
  dealToEnemy(amount: number): void;
  dealToPlayer(amount: number): number;
  draw(count: number): void;
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
  emblem?(self: ActiveStatus, s: BattleState): Emblem | null;
}

export interface StatusDefinition {
  id: string;
  scope: StatusScope;
  decay?: StatusDecay;
  priority?: number;
  hooks: StatusHooks;
}
