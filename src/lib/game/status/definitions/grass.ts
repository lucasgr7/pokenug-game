import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'enraizado',
  scope: 'enemy',
  decay: 'turnStart',
  hooks: {
    modifyAttackFinal: (v, ctx) => {
      if (ctx.tpl?.element === 'grass') return v * 2;
      return v;
    },
    emblem: (self) => ({
      icon: '🌿',
      label: statusLabel('enraizado', { stacks: self.stacks }),
      title: statusTitle('enraizado'),
      color: '#4ade80',
      bg: 'rgba(74,222,128,0.15)'
    })
  }
});
