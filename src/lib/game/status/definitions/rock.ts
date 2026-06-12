import { defineStatus } from '../registry';
import { addStatus } from '../pipeline';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'reflexo',
  scope: 'player',
  decay: 'turnStart',
  hooks: {
    emblem: () => ({
      icon: '🛡️',
      label: statusLabel('reflexo'),
      title: statusTitle('reflexo'),
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.15)'
    })
  }
});

defineStatus({
  id: 'revenge_shield',
  scope: 'player',
  hooks: {
    emblem: (self) => ({
      icon: '🧊',
      label: statusLabel('revenge_shield', { stacks: self.stacks }),
      title: statusTitle('revenge_shield', { stacks: self.stacks }),
      color: '#67e8f9',
      bg: 'rgba(103,232,249,0.15)'
    })
  }
});

defineStatus({
  id: 'rocha_imovel',
  scope: 'player',
  hooks: {
    emblem: () => ({
      icon: '🪨',
      label: statusLabel('rocha_imovel'),
      title: statusTitle('rocha_imovel'),
      color: '#a8a29e',
      bg: 'rgba(168,162,158,0.15)'
    })
  }
});
