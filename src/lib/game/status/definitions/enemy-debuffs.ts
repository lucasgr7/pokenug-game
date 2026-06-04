import { defineStatus } from '../registry';

defineStatus({
  id: 'imobilizado',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn enemy attack branch — halve damage
  }
});

defineStatus({
  id: 'fraqueza',
  scope: 'enemy',
  decay: 'turnStart',
  hooks: {
    modifyAttackFinal: (v, ctx) => Math.floor(v * (1 + 0.25 * ctx.self.stacks))
  }
});

defineStatus({
  id: 'intimidate',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn enemy attack branch — reduce damage by reduction%
  }
});

defineStatus({
  id: 'shield_cancelled',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn defend branch — block set to 0
  }
});

defineStatus({
  id: 'shield_reduced',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn defend branch — block ×0.5
  }
});

defineStatus({
  id: 'buff_reduced',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn buff branch — buff ×0.5
  }
});
