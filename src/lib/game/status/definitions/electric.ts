import { defineStatus } from '../registry';
import { resolveTypedDamage } from '../../damage';

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
      label: `Choque +${self.stacks}`,
      title: 'Cada carta jogada causa dano elétrico extra',
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
      label: `Elétrico +${self.stacks}`,
      title: 'Cada carta causa dano elétrico bonus',
      color: '#facc15',
      bg: 'rgba(250,204,21,0.16)'
    })
  }
});
