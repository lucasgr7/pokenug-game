import { defineStatus } from '../registry';
import { statusLabel, statusTitle } from '$lib/i18n/game';
import { getTemplate } from '$lib/data/cards';
import { applyCardEffect } from '../../cards/apply';

defineStatus({
  id: 'auto_jogar',
  scope: 'player',
  hooks: {
    onTurnStart: (ctx) => {
      const maxPlays = 3;
      ctx.self.data = { used: 0 };
      const fightingCards = ctx.s.hand.filter(
        (c) => getTemplate(c.templateId)?.element === 'fighting'
      );
      const toAutoPlay = fightingCards.slice(0, maxPlays);
      let played = 0;
      for (const autoCard of toAutoPlay) {
        if (ctx.s.status !== 'active') break;
        const autoTpl = getTemplate(autoCard.templateId);
        if (!autoTpl) continue;
        const idx = ctx.s.hand.findIndex((c) => c.id === autoCard.id);
        if (idx < 0) continue;
        ctx.s.hand.splice(idx, 1);
        const autoCtx = { s: ctx.s, self: ctx.self, dealToEnemy: ctx.dealToEnemy, dealToPlayer: ctx.dealToPlayer, draw: ctx.draw };
        applyCardEffect(autoCtx, autoTpl, autoCard);
        const shouldExhaust = (() => {
          if (autoTpl.exhaust === 'combat' || autoTpl.exhaust === 'run') return true;
          if (autoTpl.kind === 'capture' && autoTpl.rarity !== 'starter') return true;
          if (autoTpl.element !== null && autoTpl.element !== ctx.s.player.pokemon.element) return true;
          return false;
        })();
        if (shouldExhaust) {
          ctx.s.exhausted.push(autoCard);
        } else {
          ctx.s.discard.push(autoCard);
        }
        played++;
      }
      ctx.self.data = { used: played };
    },
    emblem: () => ({
      icon: '🤖',
      label: statusLabel('auto_jogar'),
      title: statusTitle('auto_jogar'),
      color: '#f472b6',
      bg: 'rgba(244,114,182,0.15)'
    })
  }
});

