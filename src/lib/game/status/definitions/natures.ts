import { defineStatus } from '../registry';
import type { Card, CardTemplate } from '$lib/game/types';
import { getTemplate } from '$lib/data/cards';
import { CATALOG } from '$lib/data/cards';
import { statusLabel, statusTitle } from '$lib/i18n/game';

function getPokemonElement(s: { player: { pokemon: { element: string } } }): string {
	return s.player.pokemon.element;
}

// ── Hardy: extra card after draw, random attack of different element ──
defineStatus({
	id: 'nature_hardy',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onBattleStartAfterDraw(ctx) {
			const pokemonEl = getPokemonElement(ctx.s);
			const pool = CATALOG.filter(
				(t) => t.kind === 'attack' && t.element !== null && t.element !== pokemonEl
			);
			if (pool.length === 0) return;
			const tpl = pool[Math.floor(Math.random() * pool.length)];
			ctx.s.hand.push({ id: crypto.randomUUID(), templateId: tpl.id });
		},
		emblem() {
			return { icon: '🃏', label: statusLabel('nature_hardy'), title: statusTitle('nature_hardy'), color: '#f59e0b', bg: '#f59e0b22' };
		}
	}
});

// ── Lonely: heal 3 HP per turn start ──
defineStatus({
	id: 'nature_lonely',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onTurnStart(ctx) {
			const p = ctx.s.player;
			p.hp = Math.min(p.hp + 3, p.pokemon.maxHp);
		},
		emblem() {
			return { icon: '❤️', label: statusLabel('nature_lonely'), title: statusTitle('nature_lonely'), color: '#ef4444', bg: '#ef444422' };
		}
	}
});

// ── Brave: aligned cost-1, off-aligned cost+1 ──
defineStatus({
	id: 'nature_brave',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		modifyCardCost(cost: number, tpl: CardTemplate, _card: Card, ctx) {
			const pokemonEl = getPokemonElement(ctx.s);
			if (tpl.element === pokemonEl) return cost - 1;
			if (tpl.element !== null && tpl.element !== pokemonEl) return cost + 1;
			return cost;
		},
		emblem() {
			return { icon: '⚔️', label: statusLabel('nature_brave'), title: statusTitle('nature_brave'), color: '#c2410c', bg: '#c2410c22' };
		}
	}
});

// ── Adamant: reorder deck so aligned cards are at end (drawn first via pop) ──
defineStatus({
	id: 'nature_adamant',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onBattleStart(ctx) {
			const pokemonEl = getPokemonElement(ctx.s);
			const aligned: Card[] = [];
			const rest: Card[] = [];
			for (const card of ctx.s.deck) {
				const tpl = getTemplate(card.templateId);
				if (tpl && tpl.element === pokemonEl) {
					aligned.push(card);
				} else {
					rest.push(card);
				}
			}
			ctx.s.deck = [...rest, ...aligned];
		},
		emblem() {
			return { icon: '🔄', label: statusLabel('nature_adamant'), title: statusTitle('nature_adamant'), color: '#16a34a', bg: '#16a34a22' };
		}
	}
});

// ── Naughty: +1 mana on turn 1 ──
defineStatus({
	id: 'nature_naughty',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onBattleStart(ctx) {
			ctx.s.player.mana += 1;
		},
		emblem() {
			return { icon: '⚡', label: statusLabel('nature_naughty'), title: statusTitle('nature_naughty'), color: '#eab308', bg: '#eab30822' };
		}
	}
});

// ── Bold: shield card cost+1, block x2 ──
defineStatus({
	id: 'nature_bold',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		modifyCardCost(cost: number, tpl: CardTemplate) {
			if (tpl.kind === 'defense' || (tpl.block ?? 0) > 0) return cost + 1;
			return cost;
		},
		modifyOutgoingBlock(value: number) {
			return value * 2;
		},
		emblem() {
			return { icon: '🛡️', label: statusLabel('nature_bold'), title: statusTitle('nature_bold'), color: '#3b82f6', bg: '#3b82f622' };
		}
	}
});

// ── Docile: +30 maxHp, +30 hp, -1 mana (turn 1 only) ──
defineStatus({
	id: 'nature_docile',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onBattleStart(ctx) {
			ctx.s.player.pokemon.maxHp += 30;
			ctx.s.player.hp = Math.min(ctx.s.player.hp + 30, ctx.s.player.pokemon.maxHp);
			ctx.s.player.mana -= 1;
		},
		emblem() {
			return { icon: '💚', label: statusLabel('nature_docile'), title: statusTitle('nature_docile'), color: '#16a34a', bg: '#16a34a22' };
		}
	}
});

// ── Relaxed: +20 maxHp, +20 hp, hand size -1 ──
defineStatus({
	id: 'nature_relaxed',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onBattleStart(ctx) {
			ctx.s.player.pokemon.maxHp += 20;
			ctx.s.player.hp = Math.min(ctx.s.player.hp + 20, ctx.s.player.pokemon.maxHp);
		},
		modifyHandSize(size: number) {
			return size - 1;
		},
		emblem() {
			return { icon: '😌', label: statusLabel('nature_relaxed'), title: statusTitle('nature_relaxed'), color: '#60a5fa', bg: '#60a5fa22' };
		}
	}
});

// ── Lax: -10 hp, +4 mana (turn 1 only) ──
defineStatus({
	id: 'nature_lax',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onBattleStart(ctx) {
			ctx.s.player.hp = Math.max(1, ctx.s.player.hp - 10);
			ctx.s.player.mana += 4;
		},
		emblem() {
			return { icon: '😅', label: statusLabel('nature_lax'), title: statusTitle('nature_lax'), color: '#a8a29e', bg: '#a8a29e22' };
		}
	}
});

// ── Timid: off-aligned cost+1, don't exhaust off-aligned ──
defineStatus({
	id: 'nature_timid',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		modifyCardCost(cost: number, tpl: CardTemplate, _card: Card, ctx) {
			const pokemonEl = getPokemonElement(ctx.s);
			if (tpl.element && tpl.element !== pokemonEl) return cost + 1;
			return cost;
		},
		shouldExhaust(_card: Card, tpl: CardTemplate, current: boolean, ctx) {
			if (!current) return false;
			const pokemonEl = getPokemonElement(ctx.s);
			const isOnlyMisalign = tpl.element !== null && tpl.element !== pokemonEl;
			if (isOnlyMisalign && !tpl.exhaust && !tpl.isPower && tpl.kind !== 'capture') {
				return false;
			}
			return current;
		},
		emblem() {
			return { icon: '👻', label: statusLabel('nature_timid'), title: statusTitle('nature_timid'), color: '#6d28d9', bg: '#6d28d922' };
		}
	}
});

// ── Serious: hand size +1 from turn 4 ──
defineStatus({
	id: 'nature_serious',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		modifyHandSize(size: number, ctx) {
			return ctx.s.turnNumber >= 4 ? size + 1 : size;
		},
		emblem() {
			return { icon: '📐', label: statusLabel('nature_serious'), title: statusTitle('nature_serious'), color: '#9333ea', bg: '#9333ea22' };
		}
	}
});

// ── Hasty: first card costs 0 (high priority to override others) ──
defineStatus({
	id: 'nature_hasty',
	scope: 'player',
	decay: 'permanent',
	priority: 1000,
	hooks: {
		modifyCardCost(cost: number, _tpl: CardTemplate, _card: Card, ctx) {
			const st = ctx.self;
			if (!st.data) st.data = {};
			if (!st.data.used) return 0;
			return cost;
		},
		onCardPlayed(ctx) {
			const st = ctx.self;
			if (!st.data) st.data = {};
			st.data.used = 1;
		},
		emblem() {
			return { icon: '⚡', label: statusLabel('nature_hasty'), title: statusTitle('nature_hasty'), color: '#eab308', bg: '#eab30822' };
		}
	}
});

// ── Quirky: every 3 exhausted cards → +1 mana ──
defineStatus({
	id: 'nature_quirky',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onCardExhausted(ctx) {
			const st = ctx.self;
			if (!st.data) st.data = { counter: 0, manaBonus: 0 };
			st.data.counter = (st.data.counter ?? 0) + 1;
			if (st.data.counter % 3 === 0) {
				st.data.manaBonus = (st.data.manaBonus ?? 0) + 1;
				ctx.s.player.mana += 1;
			}
		},
		onTurnStart(ctx) {
			const st = ctx.self;
			if (st.data?.manaBonus) {
				ctx.s.player.mana += st.data.manaBonus;
			}
		},
		emblem() {
			return { icon: '⚙️', label: statusLabel('nature_quirky'), title: statusTitle('nature_quirky'), color: '#84cc16', bg: '#84cc1622' };
		}
	}
});

// ── Sassy: leftover mana → 5 block at end of turn ──
defineStatus({
	id: 'nature_sassy',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onTurnEnd(ctx) {
			if (ctx.s.player.mana > 0) {
				ctx.s.player.block += 5;
			}
		},
		emblem() {
			return { icon: '✨', label: statusLabel('nature_sassy'), title: statusTitle('nature_sassy'), color: '#db2777', bg: '#db277722' };
		}
	}
});

// ── Modest: unspent mana carries to next turn ──
defineStatus({
	id: 'nature_modest',
	scope: 'player',
	decay: 'permanent',
	priority: 0,
	hooks: {
		onTurnEnd(ctx) {
			const st = ctx.self;
			if (ctx.s.player.mana > 0) {
				if (!st.data) st.data = {};
				st.data.pending = 1;
			}
		},
		onTurnStart(ctx) {
			const st = ctx.self;
			if (st.data?.pending) {
				ctx.s.player.mana += 1;
				st.data.pending = 0;
			}
		},
		emblem() {
			return { icon: '💎', label: statusLabel('nature_modest'), title: statusTitle('nature_modest'), color: '#22d3ee', bg: '#22d3ee22' };
		}
	}
});
