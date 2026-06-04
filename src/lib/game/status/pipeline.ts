import { getStatusDef } from './registry';
import type { BattleState, Card, CardTemplate, Element } from '../types';
import type {
  ActiveStatus,
  StatusCtx,
  DamageCtx,
  StatusDecay,
  StatusHooks,
  StatusDefinition,
  Emblem,
  StatusScope,
  BattleEvent
} from './types';

// ── Helpers ─────────────────────────────────────────────────────────

interface StatusEntry {
  def: StatusDefinition;
  st: ActiveStatus;
}

// ── CRUD ────────────────────────────────────────────────────────────

export function getStatus(holder: { statuses: ActiveStatus[] }, defId: string): ActiveStatus | undefined {
  return holder.statuses.find((st: ActiveStatus) => st.defId === defId);
}

export function hasStatus(holder: { statuses: ActiveStatus[] }, defId: string): boolean {
  return holder.statuses.some((st: ActiveStatus) => st.defId === defId);
}

let _dealToEnemy: ((amount: number) => void) | null = null;
let _dealToPlayer: ((amount: number) => number) | null = null;
let _draw: ((count: number) => void) | null = null;
let _battleState: BattleState | null = null;
let _events: BattleEvent[] = [];

export function setMutationApi(
  dealToEnemy: (amount: number) => void,
  dealToPlayer: (amount: number) => number,
  draw: (count: number) => void
): void {
  _dealToEnemy = dealToEnemy;
  _dealToPlayer = dealToPlayer;
  _draw = draw;
}

export function setBattleState(s: BattleState): void {
  _battleState = s;
}

export function logEvent(e: BattleEvent): void {
  _events.push(e);
}

export function drainEvents(): BattleEvent[] {
  const e = _events;
  _events = [];
  return e;
}

function makeCtx(self: ActiveStatus): StatusCtx {
  return {
    s: _battleState!,
    self,
    dealToEnemy: (amount) => { if (_dealToEnemy) _dealToEnemy(amount); },
    dealToPlayer: (amount) => _dealToPlayer ? _dealToPlayer(amount) : 0,
    draw: (count) => { if (_draw) _draw(count); },
    log: (e) => logEvent(e)
  };
}

function makeDCtx(self: ActiveStatus, element: Element | null, tpl: CardTemplate | null): DamageCtx {
  return { ...makeCtx(self), element, tpl };
}

const _internalStatuses = new Set(['ice_count']);

export function addStatus(
  holder: { statuses: ActiveStatus[] },
  defId: string,
  stacks = 1,
  data?: Record<string, number>
): ActiveStatus {
  const existing = getStatus(holder, defId);
  if (existing) {
    existing.stacks += stacks;
    if (data) existing.data = { ...(existing.data ?? {}), ...data };
    const def = getStatusDef(defId);
    if (def?.hooks.onApply && _battleState) {
      def.hooks.onApply(makeCtx(existing));
    }
    return existing;
  }
  const status: ActiveStatus = { defId, stacks, ...(data ? { data } : {}) };
  holder.statuses.push(status);
  const def = getStatusDef(defId);
  if (def?.hooks.onApply && _battleState) {
    def.hooks.onApply(makeCtx(status));
  }
  if (!_internalStatuses.has(defId) && _battleState) {
    const target = holder === _battleState.player ? 'player' : 'enemy';
    logEvent({ kind: 'status_applied', id: defId, target, stacks });
  }
  return status;
}

export function removeStatus(holder: { statuses: ActiveStatus[] }, defId: string): void {
  const idx = holder.statuses.findIndex((st: ActiveStatus) => st.defId === defId);
  if (idx >= 0) holder.statuses.splice(idx, 1);
}

function collectStatuses(s: BattleState, scope: StatusScope): StatusEntry[] {
  const holder = scope === 'player' ? s.player : s.enemy;
  const result: StatusEntry[] = [];
  for (const st of holder.statuses) {
    const def = getStatusDef(st.defId);
    if (def) result.push({ def, st });
  }
  return result;
}

// ── Pipeline runners ────────────────────────────────────────────────

export function resolveAttackElement(s: BattleState, baseEl: Element | null, tpl: CardTemplate | null): Element | null {
  let el = baseEl;
  const entries = collectStatuses(s, 'player').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.resolveAttackElement;
    if (hook) {
      const dctx = makeDCtx(st, el, tpl);
      el = hook(el, dctx) ?? el;
    }
  }
  return el;
}

export function runAttackBase(s: BattleState, value: number, tpl: CardTemplate | null, element: Element | null): number {
  let v = value;
  const entries = collectStatuses(s, 'player').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.modifyAttackBase;
    if (hook) {
      const dctx = makeDCtx(st, element, tpl);
      v = hook(v, dctx);
    }
  }
  return v;
}

export function runAttackFinal(s: BattleState, value: number, tpl: CardTemplate | null, element: Element | null): number {
  let v = value;
  const entries = collectStatuses(s, 'enemy').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.modifyAttackFinal;
    if (hook) {
      const dctx = makeDCtx(st, element, tpl);
      v = hook(v, dctx);
    }
  }
  return v;
}

export function runOutgoingBlock(s: BattleState, value: number): number {
  let v = value;
  const entries = collectStatuses(s, 'player').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.modifyOutgoingBlock;
    if (hook) {
      const ctx = makeCtx(st);
      v = hook(v, ctx);
    }
  }
  return v;
}

export function runIncomingDamage(s: BattleState, value: number): number {
  let v = value;
  const entries = collectStatuses(s, 'player').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.modifyIncomingDamage;
    if (hook) {
      const ctx = makeCtx(st);
      v = hook(v, ctx);
    }
  }
  return v;
}

export function dispatchOnCardPlayed(s: BattleState, tpl: CardTemplate, card: Card): void {
  const entries = collectStatuses(s, 'player').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.onCardPlayed;
    if (hook) {
      const ctx = makeCtx(st);
      hook(ctx, tpl, card);
    }
  }
}

export function dispatchOnAfterAttack(s: BattleState, element: Element | null, tpl: CardTemplate | null): void {
  const entries = [...collectStatuses(s, 'player'), ...collectStatuses(s, 'enemy')]
    .sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.onAfterAttack;
    if (hook) {
      const dctx = makeDCtx(st, element, tpl);
      hook(dctx);
    }
  }
}

export function dispatchOnTurnStart(s: BattleState): void {
  const entries = collectStatuses(s, 'player').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.onTurnStart;
    if (hook) {
      const ctx = makeCtx(st);
      hook(ctx);
    }
  }
}

export function dispatchOnTurnEnd(s: BattleState): void {
  const entries = collectStatuses(s, 'player').sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0));
  for (const { def, st } of entries) {
    const hook = def.hooks.onTurnEnd;
    if (hook) {
      const ctx = makeCtx(st);
      hook(ctx);
    }
  }
}

export function decayStatuses(s: BattleState, when: StatusDecay): void {
  for (const holder of [s.player, s.enemy]) {
    const toRemove: string[] = [];
    for (const st of holder.statuses) {
      const def = getStatusDef(st.defId);
      if (!def || (def.decay ?? 'permanent') !== when) continue;
      st.stacks--;
      if (st.stacks <= 0) toRemove.push(st.defId);
    }
    for (const id of toRemove) removeStatus(holder, id);
  }
}

export function collectEmblems(holder: { statuses: ActiveStatus[] }, s: BattleState): Emblem[] {
  const emblems: Emblem[] = [];
  for (const st of holder.statuses) {
    const def = getStatusDef(st.defId);
    if (!def?.hooks.emblem) continue;
    const e = def.hooks.emblem(st, s);
    if (e) emblems.push(e);
  }
  return emblems;
}
