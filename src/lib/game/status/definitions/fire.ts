import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'aproximacao',
  scope: 'player',
  hooks: {
    emblem: () => ({
      icon: '🔥',
      label: statusLabel('aproximacao'),
      title: statusTitle('aproximacao'),
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.15)'
    })
  }
});

defineStatus({
  id: 'fire_fury',
  scope: 'player',
  hooks: {
    emblem: (self) => ({
      icon: '🔥',
      label: statusLabel('fire_fury', { stacks: self.stacks }),
      title: statusTitle('fire_fury'),
      color: '#f97316',
      bg: 'rgba(249,115,22,0.15)'
    })
  }
});
