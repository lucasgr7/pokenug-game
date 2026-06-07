import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'ghost_form',
  scope: 'player',
  decay: 'turnEnd',
  hooks: {
    modifyIncomingDamage: () => 1,
    emblem: () => ({
      icon: '👻',
      label: statusLabel('ghost_form'),
      title: statusTitle('ghost_form'),
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.15)'
    })
  }
});
