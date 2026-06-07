import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'dragonize',
  scope: 'player',
  hooks: {
    resolveAttackElement: (el) => (!el || el === 'normal' ? 'dragon' : el),
    emblem: () => ({
      icon: '🐉',
      label: statusLabel('dragonize'),
      title: statusTitle('dragonize'),
      color: '#818cf8',
      bg: 'rgba(79,70,229,0.15)'
    })
  }
});

defineStatus({
  id: 'carga_dragao',
  scope: 'player',
  hooks: {
    onApply: (ctx) => {
      const newGrants = Math.floor(ctx.self.stacks / 4);
      const prevGrants = ctx.self.data?.granted ?? 0;
      if (newGrants > prevGrants) {
        const diff = newGrants - prevGrants;
        ctx.s.player.mana = Math.min(ctx.s.player.mana + diff * 2, 6);
        ctx.self.data = { ...ctx.self.data, granted: newGrants };
      }
    },
    emblem: (self) => ({
      icon: '🐉',
      label: statusLabel('carga_dragao', { stacks: self.stacks }),
      title: statusTitle('carga_dragao', { stacks: self.stacks }),
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.15)'
    })
  }
});

defineStatus({
  id: 'furia_double',
  scope: 'player',
  hooks: {
    emblem: () => ({
      icon: '🐉',
      label: statusLabel('furia_double'),
      title: statusTitle('furia_double'),
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.15)'
    })
  }
});
