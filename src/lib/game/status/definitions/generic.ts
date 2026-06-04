import { defineStatus } from '../registry';

defineStatus({
  id: 'duplicar',
  scope: 'player',
  hooks: {
    emblem: () => ({
      icon: '🔁',
      label: 'Duplicar',
      title: 'Próxima carta executada duas vezes',
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
      label: `+${self.stacks} hit`,
      title: `Próximo ataque atinge +${self.stacks} vezes`,
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
      label: 'Espinhos',
      title: '10 de dano ao atacante ao absorver',
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
      label: 'Reflexo',
      title: 'Dano absorvido é refletido ao inimigo',
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
      label: 'Persiste',
      title: 'Escudo não decai no próximo turno',
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.15)'
    })
  }
});
