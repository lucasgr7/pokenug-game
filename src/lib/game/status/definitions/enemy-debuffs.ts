import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'imobilizado',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn enemy attack branch — halve damage
    emblem: (self) => ({
      icon: '⛓️',
      label: statusLabel('imobilizado', { stacks: self.stacks }),
      title: statusTitle('imobilizado'),
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.15)'
    })
  }
});

defineStatus({
  id: 'fraqueza',
  scope: 'enemy',
  decay: 'turnStart',
  hooks: {
    modifyAttackFinal: (v, ctx) => Math.floor(v * (1 + 0.25 * ctx.self.stacks)),
    emblem: (self) => ({
      icon: '💢',
      label: statusLabel('fraqueza', { stacks: self.stacks }),
      title: statusTitle('fraqueza'),
      color: '#f87171',
      bg: 'rgba(248,113,113,0.15)'
    })
  }
});

defineStatus({
  id: 'intimidate',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn enemy attack branch — reduce damage by reduction%
    emblem: (self) => ({
      icon: '😨',
      label: statusLabel('intimidate', { stacks: self.stacks }),
      title: statusTitle('intimidate'),
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.15)'
    })
  }
});

defineStatus({
  id: 'shield_cancelled',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn defend branch — block set to 0
    emblem: (self) => ({
      icon: '🚫',
      label: statusLabel('shield_cancelled', { stacks: self.stacks }),
      title: statusTitle('shield_cancelled'),
      color: '#fb7185',
      bg: 'rgba(251,113,133,0.15)'
    })
  }
});

defineStatus({
  id: 'shield_reduced',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn defend branch — block ×0.5
    emblem: (self) => ({
      icon: '🛡️',
      label: statusLabel('shield_reduced', { stacks: self.stacks }),
      title: statusTitle('shield_reduced'),
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.15)'
    })
  }
});

defineStatus({
  id: 'buff_reduced',
  scope: 'enemy',
  decay: 'turnEnd',
  hooks: {
    // Applied in endTurn buff branch — buff ×0.5
    emblem: (self) => ({
      icon: '📉',
      label: statusLabel('buff_reduced', { stacks: self.stacks }),
      title: statusTitle('buff_reduced'),
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.15)'
    })
  }
});
