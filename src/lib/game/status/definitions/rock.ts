import { defineStatus } from '../registry';
import { addStatus } from '../pipeline';

defineStatus({
  id: 'reflexo',
  scope: 'player',
  decay: 'turnStart',
  hooks: {
    emblem: () => ({
      icon: '🛡️',
      label: 'Reflexo',
      title: '50% do dano absorvido é devolvido',
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
      label: `Glaciação ${self.stacks}`,
      title: `Cause ${self.stacks} de dano se escudo destruído`,
      color: '#67e8f9',
      bg: 'rgba(103,232,249,0.15)'
    })
  }
});

defineStatus({
  id: 'rocha_imovel',
  scope: 'player',
  hooks: {
    onTurnEnd: (ctx) => {
      if (ctx.s.player.block > 0) {
        addStatus(ctx.s.player, 'next_turn_bonus', 1, { mana: 1 });
      }
    }
  }
});
