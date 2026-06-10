import { describe, expect, it } from 'vitest';
import { CATALOG, STARTER_TEMPLATES, TOKEN_TEMPLATES } from '$lib/data/cards';
import { CARD_HOOKS } from '$lib/game/cards/card-hooks';
import type { CardTemplate } from '$lib/game/types';
import { stubRandom, testBattle, type TestBattle } from '$lib/testing/battle';

/**
 * Spec gerada por tabela: TODA carta do jogo é jogada uma vez num estado
 * controlado e precisa respeitar invariantes básicos + o valor declarado no
 * template. Cartas com CARD_HOOKS têm specs dedicadas em card-hooks.spec.ts —
 * aqui só validamos que jogam sem quebrar o estado.
 */

const ALL_TEMPLATES: CardTemplate[] = [...STARTER_TEMPLATES, ...CATALOG, ...TOKEN_TEMPLATES];

const PLAYER_START_HP = 100;

function battleFor(tpl: CardTemplate): TestBattle {
	return testBattle({
		hand: [tpl.id],
		player: { mana: Math.max(3, tpl.cost), maxHp: PLAYER_START_HP },
		// intenção inerte para não interferir em hooks que leem a intenção
		enemy: { intent: { kind: 'defend', block: 0 } }
	});
}

function expectStateSane(b: TestBattle, tpl: CardTemplate): void {
	const s = b.state;
	expect(Number.isFinite(s.player.hp), `${tpl.id}: hp do jogador virou NaN`).toBe(true);
	expect(Number.isFinite(s.enemy.hp), `${tpl.id}: hp do inimigo virou NaN`).toBe(true);
	expect(Number.isFinite(s.player.mana), `${tpl.id}: mana virou NaN`).toBe(true);
	expect(s.player.hp).toBeGreaterThanOrEqual(0);
	expect(s.enemy.hp).toBeGreaterThanOrEqual(0);
	expect(s.player.block).toBeGreaterThanOrEqual(0);
	expect(s.player.mana).toBeGreaterThanOrEqual(0);
	expect(s.player.mana).toBeLessThanOrEqual(6);
	expect(s.player.hp).toBeLessThanOrEqual(s.player.pokemon.maxHp);
}

function expectedExhaust(tpl: CardTemplate): boolean {
	if (tpl.exhaust === 'combat' || tpl.exhaust === 'run') return true;
	if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
	return false; // harness alinha o elemento do jogador → sem misalignment
}

describe.each(ALL_TEMPLATES.map((tpl) => [tpl.id, tpl] as const))('%s', (_id, tpl) => {
	it(`joga sem corromper o estado (${tpl.kind}, ${tpl.rarity})`, () => {
		const b = battleFor(tpl);
		// Sorteios (captura, exauridas aleatórias) ficam determinísticos
		const restore = stubRandom(0.999);
		try {
			const r = b.play(tpl.id);
			expect(r.played).toBe(true);
			expect(r.kind).toBe(tpl.kind);
			expect(b.hand).not.toContain(tpl.id);
			expect(r.exhausted, `${tpl.id}: regra de exaustão divergente`).toBe(expectedExhaust(tpl));
			expectStateSane(b, tpl);
		} finally {
			restore();
		}
	});

	const hasHook = Boolean(CARD_HOOKS[tpl.id]);

	if (tpl.kind === 'attack' && tpl.damage && !hasHook) {
		it(`causa exatamente ${tpl.damage} de dano em matchup neutro`, () => {
			const b = battleFor(tpl);
			b.play(tpl.id);
			expect(b.enemy.damageTaken).toBe(tpl.damage);
		});
	}

	if (tpl.kind === 'defense' && tpl.block && !hasHook) {
		it(`gera exatamente ${tpl.block} de escudo`, () => {
			const b = battleFor(tpl);
			const r = b.play(tpl.id);
			expect(r.blocked).toBe(tpl.block);
		});
	}

	if (tpl.kind === 'heal' && tpl.healHp) {
		it(`cura até ${tpl.healHp} de HP sem passar do máximo`, () => {
			const b = testBattle({ hand: [tpl.id], player: { hp: 50, mana: Math.max(3, tpl.cost) } });
			const r = b.play(tpl.id);
			expect(r.healed).toBe(Math.min(tpl.healHp!, PLAYER_START_HP - 50));
		});
	}

	if (tpl.selfDamage) {
		it(`aplica ${tpl.selfDamage} de dano em si mesmo`, () => {
			const b = battleFor(tpl);
			b.play(tpl.id);
			expect(b.player.damageTaken).toBeGreaterThanOrEqual(tpl.selfDamage!);
		});
	}

	if (tpl.selfMaxHpReduction) {
		it(`reduz o HP máximo em ${tpl.selfMaxHpReduction}`, () => {
			const b = battleFor(tpl);
			b.play(tpl.id);
			expect(b.player.maxHp).toBe(PLAYER_START_HP - tpl.selfMaxHpReduction!);
			expect(b.player.hp).toBeLessThanOrEqual(b.player.maxHp);
		});
	}

	if ((tpl.drawCount ?? 0) > 0 && !hasHook) {
		it(`compra ${tpl.drawCount} carta(s)`, () => {
			const b = testBattle({
				hand: [tpl.id],
				deck: ['neu_atk_preciso', 'neu_atk_preciso', 'neu_atk_preciso'],
				player: { mana: Math.max(3, tpl.cost) }
			});
			const handBefore = b.state.hand.length;
			b.play(tpl.id);
			// -1 carta jogada, +drawCount compradas
			expect(b.state.hand.length).toBe(handBefore - 1 + tpl.drawCount!);
		});
	}

	if (tpl.appliesStatuses) {
		it('aplica os statuses declarados no template', () => {
			const b = battleFor(tpl);
			b.play(tpl.id);
			for (const st of tpl.appliesStatuses!) {
				const holder = st.target === 'enemy' ? b.enemy : b.player;
				expect(holder.has(st.id), `${tpl.id}: status ${st.id} ausente`).toBe(true);
				expect(holder.stacks(st.id)).toBe(st.stacks ?? 1);
			}
		});
	}

	if (tpl.generatesTokens) {
		it(`gera ${tpl.generatesTokens.count}x ${tpl.generatesTokens.templateId} na mão`, () => {
			const b = battleFor(tpl);
			b.play(tpl.id);
			const tokens = b.hand.filter((id) => id === tpl.generatesTokens!.templateId);
			expect(tokens).toHaveLength(tpl.generatesTokens!.count);
		});
	}

	if (tpl.kind === 'capture') {
		it('não captura quando o sorteio falha, captura quando sucede', () => {
			// Inimigo cheio → chance = captureBonus (máx 0.5); 0.99 sempre falha
			const failed = testBattle({ hand: [tpl.id] });
			const restoreFail = stubRandom(0.99);
			try {
				failed.play(tpl.id);
				expect(failed.status).toBe('active');
			} finally {
				restoreFail();
			}

			// Inimigo com 30% de HP → chance ≥ 0.7; 0.01 sempre captura
			const captured = testBattle({ hand: [tpl.id], enemy: { hp: 30 } });
			const restoreOk = stubRandom(0.01);
			try {
				captured.play(tpl.id);
				expect(captured.status).toBe('captured');
			} finally {
				restoreOk();
			}
		});
	}
});

describe('heal_spray_cura — Spray de Cura', () => {
	const TPL_ID = 'heal_spray_cura';

	it('cura 25 de HP quando está com HP baixo', () => {
		const b = testBattle({ hand: [TPL_ID], player: { hp: 30, mana: 3 } });
		const r = b.play(TPL_ID);
		expect(r.healed).toBe(25);
		expect(b.player.hp).toBe(55);
	});

	it('não ultrapassa o HP máximo (cap em 100)', () => {
		const b = testBattle({ hand: [TPL_ID], player: { hp: 90, mana: 3 } });
		const r = b.play(TPL_ID);
		expect(r.healed).toBe(10);
		expect(b.player.hp).toBe(100);
	});

	it('exaure após o uso (exhaust: combat)', () => {
		const b = testBattle({ hand: [TPL_ID], player: { mana: 3 } });
		const r = b.play(TPL_ID);
		expect(r.exhausted).toBe(true);
		expect(b.exhaustedPile).toContain(TPL_ID);
	});

	it('custa 2 de mana e consome corretamente', () => {
		const b = testBattle({ hand: [TPL_ID], player: { mana: 2 } });
		const r = b.play(TPL_ID);
		expect(r.played).toBe(true);
		expect(b.player.mana).toBe(0);
	});

	it('recusa jogar com mana insuficiente', () => {
		const b = testBattle({ hand: [TPL_ID], player: { mana: 1 } });
		const r = b.tryPlay(TPL_ID);
		expect(r.played).toBe(false);
	});
});
