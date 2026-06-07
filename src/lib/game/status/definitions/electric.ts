import { defineStatus } from '../registry';
import { resolveTypedDamage } from '../../damage';
import { statusLabel, statusTitle } from '$lib/i18n/game';

defineStatus({
  id: 'static_shock',
  scope: 'player',
  hooks: {
    onCardPlayed: (ctx, tpl, card) => {
      const dmg = resolveTypedDamage(ctx.self.stacks, 'electric', ctx.s.enemy.pokemon.element).damage;
      if (dmg > 0) {
        ctx.dealToEnemy(dmg);
        ctx.log({ kind: 'bonus_dmg', source: 'static_shock', amount: dmg });
      }
    },
    emblem: (self) => ({
      icon: '⚡',
      label: statusLabel('static_shock', { stacks: self.stacks }),
      title: statusTitle('static_shock', { stacks: self.stacks }),
      color: '#facc15',
      bg: 'rgba(250,204,21,0.16)'
    })
  }
});

defineStatus({
  id: 'dano_eletrico',
  scope: 'player',
  hooks: {
    onCardPlayed: (ctx, tpl, card) => {
      const dmg = resolveTypedDamage(ctx.self.stacks, 'electric', ctx.s.enemy.pokemon.element).damage;
      if (dmg > 0) {
        ctx.dealToEnemy(dmg);
      }
    },
    emblem: (self) => ({
      icon: '⚡',
      label: statusLabel('dano_eletrico', { stacks: self.stacks }),
      title: statusTitle('dano_eletrico', { stacks: self.stacks }),
      color: '#facc15',
      bg: 'rgba(250,204,21,0.16)'
    })
  }
});
