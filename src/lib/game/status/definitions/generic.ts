import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'duplicar',
  scope: 'player',
  hooks: {
    emblem: () => ({
      icon: '🔁',
      label: statusLabel('duplicar'),
      title: statusTitle('duplicar'),
      color: '#c084fc',
      bg: 'rgba(192,132,252,0.15)'
    })
  }
});

defineStatus({
  id: 'attack_repeat',
  scope: 'player',
  hooks: {
    // stacks = extra hits, consumed by handleAttack
    emblem: (self) => ({
      icon: '↻',
      label: statusLabel('attack_repeat', { stacks: self.stacks }),
      title: statusTitle('attack_repeat', { stacks: self.stacks }),
      color: '#fb923c',
      bg: 'rgba(251,146,60,0.15)'
    })
  }
});

defineStatus({
  id: 'next_turn_bonus',
  scope: 'player',
  decay: 'turnStart',
  hooks: {
    onTurnStart: (ctx) => {
      const draw = ctx.self.data?.draw ?? 0;
      const mana = ctx.self.data?.mana ?? 0;
      if (draw > 0) ctx.draw(draw);
      if (mana > 0) ctx.s.player.mana = Math.min(ctx.s.player.mana + mana, 6);
    }
  }
});

defineStatus({
  id: 'shield_fire_thorns',
  scope: 'player',
  decay: 'turnEnd',
  hooks: {
    emblem: () => ({
      icon: '🔥',
      label: statusLabel('shield_fire_thorns'),
      title: statusTitle('shield_fire_thorns'),
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.15)'
    })
  }
});

defineStatus({
  id: 'shield_ice_reflect',
  scope: 'player',
  decay: 'turnEnd',
  hooks: {
    emblem: () => ({
      icon: '🧊',
      label: statusLabel('shield_ice_reflect'),
      title: statusTitle('shield_ice_reflect'),
      color: '#67e8f9',
      bg: 'rgba(103,232,249,0.15)'
    })
  }
});

defineStatus({
  id: 'shield_persist',
  scope: 'player',
  hooks: {
    onTurnEnd: () => {},
    emblem: () => ({
      icon: '🪨',
      label: statusLabel('shield_persist'),
      title: statusTitle('shield_persist'),
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.15)'
    })
  }
});
