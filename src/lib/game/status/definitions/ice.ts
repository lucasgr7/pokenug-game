import { defineStatus } from '../registry';

defineStatus({
  id: 'ice_count',
  scope: 'player',
  hooks: {
    onCardPlayed: (ctx, tpl) => {
      if (tpl.element === 'ice') ctx.self.stacks++;
    }
  }
});
