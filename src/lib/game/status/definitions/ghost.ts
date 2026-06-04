import { defineStatus } from '../registry';

defineStatus({
  id: 'ghost_form',
  scope: 'player',
  decay: 'turnEnd',
  hooks: {
    modifyIncomingDamage: () => 1,
    emblem: () => ({
      icon: '👻',
      label: 'Fantasma',
      title: 'Dano máximo 1 neste turno',
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.15)'
    })
  }
});
