import type { Card, CardTemplate } from '$lib/game/types';
import type { CardEffectCtx } from './types';
import { addStatus, getStatus, hasStatus } from '$lib/game/status/pipeline';
import { logEvent } from '$lib/game/status/pipeline';
import { isPermanentlyConsumed } from '$lib/game/damage';
import { removeFromDeck, removeFromInventory } from '$lib/db/cards';
import { getTemplate } from '$lib/data/cards';

function countCardCopies(s: CardEffectCtx['s'], templateId: string): number {
	return [...s.deck, ...s.hand, ...s.discard].filter((c) => c.templateId === templateId).length;
}

export interface CardHook {
	onPlay?(ctx: CardEffectCtx, tpl: CardTemplate, card?: Card): void;
	onBeforeDamage?(ctx: CardEffectCtx, tpl: CardTemplate): number;
	onAfterAttack?(ctx: CardEffectCtx, tpl: CardTemplate): void;
}

export const CARD_HOOKS: Record<string, CardHook> = {
	// ── Ataques ──────────────────────────────────────────

	dragon_furia: {
		onBeforeDamage: (ctx) => {
			const cargaSt = hasStatus(ctx.s.player, 'carga_dragao') ? getStatus(ctx.s.player, 'carga_dragao')! : null;
			const cargaTotal = cargaSt?.stacks ?? 0;
			const doubleSt = hasStatus(ctx.s.player, 'furia_double');
			const dragBase = 10 + cargaTotal;
			return doubleSt ? dragBase * 2 : dragBase;
		}
	},

	flying_golpe_aereo: {
		onAfterAttack: (ctx) => {
			if (ctx.s.player.turnFlags.firstAttackThisTurn) ctx.draw(1);
		}
	},

	electric_descarga: {
		onAfterAttack: (ctx) => {
			const discardCount = ctx.s.hand.length;
			ctx.s.discard.push(...ctx.s.hand);
			ctx.s.hand = [];
			if (discardCount > 0) {
				ctx.dealToEnemy(discardCount * 2);
				logEvent({ kind: 'bonus_dmg', source: 'electric_descarga', amount: discardCount * 2 });
			}
		}
	},

	psychic_refluxo: {
		onAfterAttack: (ctx) => {
			const refluxo = Math.min(ctx.s.player.turnFlags.damageReceivedLastTurn, 30);
			if (refluxo > 0) {
				ctx.dealToEnemy(refluxo);
				logEvent({ kind: 'bonus_dmg', source: 'psychic_refluxo', amount: refluxo });
			}
		}
	},

	bug_enxame: {
		onAfterAttack: (ctx) => {
			if (ctx.s.pilhaExaurir > 0) {
				const enxameDmg = 2 * ctx.s.pilhaExaurir;
				ctx.dealToEnemy(enxameDmg);
				logEvent({ kind: 'bonus_dmg', source: 'bug_enxame', amount: enxameDmg });
			}
		}
	},

	grass_espinhos: {
		onPlay: (ctx, tpl, card) => {
			if (card) card.modifier = (card.modifier ?? 0) - 1;
		}
	},

	bug_corte: {
		onPlay: (ctx) => {
			ctx.s.pilhaExaurir += 1;
			const insectIdx = ctx.s.hand.findIndex((c) => getTemplate(c.templateId)?.element === 'bug');
			if (insectIdx >= 0) {
				const insectCard = ctx.s.hand.splice(insectIdx, 1)[0];
				const insectTpl = getTemplate(insectCard.templateId);
				ctx.s.exhausted.push(insectCard);
				if (isPermanentlyConsumed(insectTpl)) {
					void removeFromDeck(insectCard.id);
					void removeFromInventory(insectCard.id);
				}
				ctx.s.pilhaExaurir += 1;
			}
		}
	},

	// ── Defesas ──────────────────────────────────────────

	rock_muralha: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'shield_persist')
	},

	flying_evasao: {
		onPlay: (ctx) => {
			if (!ctx.s.player.turnFlags.damageSufferedThisTurn) ctx.s.player.block += 4;
		}
	},

	rock_fortaleza: {
		onPlay: (ctx) => { ctx.s.player.block *= 2; }
	},

	rock_rocha_imovel: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'rocha_imovel')
	},

	ghost_fantasmagoria: {
		onPlay: (ctx) => { ctx.s.player.block += 8; }
	},

	// ── Powers ───────────────────────────────────────────

	power_berserk: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'berserk')
	},

	power_dragonize: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'dragonize')
	},

	power_electric_shock: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'static_shock', 2)
	},

	power_specialize: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'specialize')
	},

	ghost_assombracao: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'assombracao', 0)
	},

	ice_congelamento: {
		onPlay: (ctx) => {
			const iceCount = getStatus(ctx.s.player, 'ice_count')?.stacks ?? 0;
			const congDmg = 3 * iceCount;
			if (congDmg > 0) {
				ctx.dealToEnemy(congDmg);
				logEvent({ kind: 'bonus_dmg', source: 'ice_congelamento', amount: congDmg });
			}
			addStatus(ctx.s.player, 'ice_count', 1);
		}
	},

	// ── Duplicar ─────────────────────────────────────────

	psychic_paradoxo: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'duplicar')
	},

	ice_cristal: {
		onPlay: (ctx) => addStatus(ctx.s.player, 'duplicar')
	},

	// ── Amplifica + Prisão (R1) ──────────────────────────

	poison_toxina: {
		onAfterAttack: (ctx) => {
			for (const st of ctx.s.enemy.statuses) {
				if (['imobilizado', 'fraqueza', 'enraizado', 'intimidate'].includes(st.defId)) {
					st.stacks *= 2;
				}
			}
		}
	},

	ground_prisao: {
		onAfterAttack: (ctx) => {
			const im = getStatus(ctx.s.enemy, 'imobilizado');
			if (im) im.stacks *= 2;
		}
	},

	// ── Cópia Descarte ───────────────────────────────────

	fighting_rajada: {
		onPlay: (ctx, tpl) => {
			const copies = countCardCopies(ctx.s, tpl.id);
			if (copies < 2) {
				ctx.s.discard.push({ id: crypto.randomUUID(), templateId: tpl.id });
			}
		}
	},

	rock_barreira: {
		onPlay: (ctx, tpl) => {
			const copies = countCardCopies(ctx.s, tpl.id);
			if (copies < 3) {
				ctx.s.discard.push({ id: crypto.randomUUID(), templateId: tpl.id });
			}
		}
	},

	// ── Pilha Exaurir ────────────────────────────────────

	bug_picada: {
		onPlay: (ctx) => { ctx.s.pilhaExaurir += 1; }
	},

	'bug_picada_token': {
		onPlay: (ctx) => { ctx.s.pilhaExaurir += 1; }
	},

	// ── Alma Penada ──────────────────────────────────────

	ghost_alma_penada: {
		onPlay: (ctx) => {
			ctx.s.player.ghostPermDebuff++;
			if (ctx.s.hand.length > 0) {
				const randIdx = Math.floor(Math.random() * ctx.s.hand.length);
				const exhaust = ctx.s.hand.splice(randIdx, 1)[0];
				ctx.s.exhausted.push(exhaust);
				void removeFromDeck(exhaust.id);
				void removeFromInventory(exhaust.id);
			}
		}
	}
};
