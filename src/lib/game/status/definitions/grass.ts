import { defineStatus } from '../registry';

defineStatus({
  id: 'enraizado',
  scope: 'enemy',
  decay: 'turnStart',
  hooks: {
    modifyAttackFinal: (v, ctx) => {
      if (ctx.tpl?.element === 'grass') return v * 2;
      return v;
    }
  }
});
