import { defineStatus } from '../registry';
import { removeStatus } from '../pipeline';


defineStatus({
  id: 'berserk',
  scope: 'player',
  decay: 'permanent',
  priority: 100,
  hooks: {
    modifyAttackBase: (v) => v * 2,
    modifyOutgoingBlock: (b) => Math.max(1, Math.floor(b / 2)),
    emblem: () => ({
      icon: '⚡',
      label: 'Fúria',
      title: 'ATQ×2, DEF÷2 — toda a batalha',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.15)'
    })
  }
});

defineStatus({
  id: 'specialize',
  scope: 'player',
  hooks: {
    resolveAttackElement: (el, ctx) => (!el && ctx.tpl?.rarity === 'starter' ? ctx.s.player.pokemon.element : el),
    emblem: () => ({
      icon: '🎯',
      label: 'Especialização',
      title: 'Cartas starter → tipo do seu Pokémon',
      color: '#818cf8',
      bg: 'rgba(79,70,229,0.15)'
    })
  }
});

defineStatus({
  id: 'empowered',
  scope: 'player',
  hooks: {
    modifyAttackBase: (v, ctx) => {
      const bonus = ctx.self.stacks;
      removeStatus(ctx.s.player, 'empowered');
      return v + bonus;
    },
    emblem: (self) => ({
      icon: '✨',
      label: `+${self.stacks}`,
      title: `Próximo ataque +${self.stacks}`,
      color: '#c084fc',
      bg: 'rgba(192,132,252,0.15)'
    })
  }
});

defineStatus({
  id: 'sequencia',
  scope: 'player',
  hooks: {
    modifyAttackBase: (v, ctx) => {
      if (ctx.element === 'fighting') {
        return v + (ctx.self.data?.count ?? 0) * 2;
      }
      return v;
    },
    onCardPlayed: (ctx, tpl) => {
      if (tpl.element === 'fighting') {
        ctx.self.data = { count: (ctx.self.data?.count ?? 0) + 1 };
      } else {
        ctx.self.data = { count: 0 };
      }
    },
    emblem: () => ({
      icon: '👊',
      label: 'Sequência',
      title: 'Golpes Lutador consecutivos acumulam bônus',
      color: '#f97316',
      bg: 'rgba(249,115,22,0.15)'
    })
  }
});

defineStatus({
  id: 'assombracao',
  scope: 'player',
  hooks: {
    modifyAttackBase: (v, ctx) => {
      if (ctx.element === 'ghost') return v + ctx.self.stacks;
      return v;
    },
    onTurnStart: (ctx) => {
      ctx.self.stacks++;
    },
    emblem: (self) => ({
      icon: '👻',
      label: `Assombração +${self.stacks}`,
      title: `Cartas Fantasma +${self.stacks} dano`,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.15)'
    })
  }
});

