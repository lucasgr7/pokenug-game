import { describe, expect, it } from 'vitest';
import { stubRandom, testBattle } from '$lib/testing/battle';

/**
 * Specs dedicadas das DEFESAS e POWERS com CARD_HOOKS.
 */

describe('rock_muralha — Muralha de Pedra', () => {
	it('o escudo atual persiste no próximo turno', () => {
		const b = testBattle({
			hand: ['rock_muralha'],
			player: { block: 10, mana: 3 },
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.play('rock_muralha');
		expect(b.player.has('shield_persist')).toBe(true);
		b.endTurn();
		expect(b.player.block).toBe(10);
	});
});

describe('flying_evasao — Evasão', () => {
	it('+4 de escudo extra se não sofreu dano neste turno', () => {
		const b = testBattle({ hand: ['flying_evasao'] });
		b.play('flying_evasao');
		expect(b.player.block).toBe(16);
	});

	it('só 12 de escudo se já sofreu dano neste turno', () => {
		const b = testBattle({ hand: ['flying_evasao'] });
		b.state.player.turnFlags.damageSufferedThisTurn = true;
		b.play('flying_evasao');
		expect(b.player.block).toBe(12);
	});
});

describe('rock_fortaleza — Fortaleza de Silex', () => {
	it('duplica o escudo atual', () => {
		const b = testBattle({ hand: ['rock_fortaleza'], player: { block: 13 } });
		b.play('rock_fortaleza');
		expect(b.player.block).toBe(26);
	});

	it('sem escudo: continua em 0', () => {
		const b = testBattle({ hand: ['rock_fortaleza'] });
		b.play('rock_fortaleza');
		expect(b.player.block).toBe(0);
	});
});

describe('rock_rocha_imovel — Rocha Imóvel', () => {
	it('com escudo no fim do turno: +1 de energia no próximo turno', () => {
		const b = testBattle({
			hand: ['rock_rocha_imovel'],
			player: { block: 5 },
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.play('rock_rocha_imovel');
		b.endTurn();
		expect(b.player.mana).toBe(4); // 3 base + 1 do bônus
	});

	it('sem escudo no fim do turno: energia normal', () => {
		const b = testBattle({
			hand: ['rock_rocha_imovel'],
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.play('rock_rocha_imovel');
		b.endTurn();
		expect(b.player.mana).toBe(3);
	});
});

describe('ghost_fantasmagoria — Fantasmagoria', () => {
	it('causa 8 de dano E ganha 8 de escudo', () => {
		const b = testBattle({ hand: ['ghost_fantasmagoria'] });
		b.play('ghost_fantasmagoria');
		expect(b.enemy.damageTaken).toBe(8);
		expect(b.player.block).toBe(8);
	});
});

describe('ice_espelho — Espelho de Gelo', () => {
	it('ganha escudo igual a 50% do dano pretendido do inimigo', () => {
		const b = testBattle({
			hand: ['ice_espelho'],
			enemy: { intent: { kind: 'attack', damage: 10 } }
		});
		b.play('ice_espelho');
		expect(b.player.block).toBe(5);
	});

	it('inimigo sem intenção de ataque: 0 de escudo', () => {
		const b = testBattle({
			hand: ['ice_espelho'],
			enemy: { intent: { kind: 'defend', block: 5 } }
		});
		b.play('ice_espelho');
		expect(b.player.block).toBe(0);
	});
});

describe('rock_barreira — Barreira Mineral', () => {
	it('cria cópia no descarte com -1 de escudo', () => {
		const b = testBattle({ hand: ['rock_barreira'] });
		b.play('rock_barreira');
		expect(b.player.block).toBe(8);
		const copy = b.state.discard.find((c) => c.templateId === 'rock_barreira' && c.modifier === -1);
		expect(copy).toBeDefined();
	});

	it('para de copiar quando o escudo da cópia chegaria a 0', () => {
		const b = testBattle({ hand: [{ id: 'barreira-fraca', templateId: 'rock_barreira', modifier: -7 }] });
		b.play('rock_barreira');
		expect(b.player.block).toBe(1); // 8 - 7
		// próxima cópia teria 8 - 8 = 0 → não é criada
		const copies = b.state.discard.filter((c) => c.templateId === 'rock_barreira' && c.id !== 'barreira-fraca');
		expect(copies).toHaveLength(0);
	});
});

describe('psychic_viagem_temporal — Viagem Temporal', () => {
	it('traz 3 cartas aleatórias das exaustas para o deck', () => {
		const restore = stubRandom(0);
		try {
			const b = testBattle({
				hand: ['psychic_viagem_temporal'],
				exhausted: ['neu_atk_preciso', 'neu_def_bloqueio', 'neu_atk_investida', 'pokeball_basic']
			});
			b.play('psychic_viagem_temporal');
			expect(b.deck).toHaveLength(3);
			expect(b.exhaustedPile).toHaveLength(2); // 1 restante + a própria viagem (EXHAUST_COMBATE)
		} finally {
			restore();
		}
	});

	it('com menos de 3 exaustas: traz o que houver', () => {
		const restore = stubRandom(0);
		try {
			const b = testBattle({ hand: ['psychic_viagem_temporal'], exhausted: ['neu_atk_preciso'] });
			b.play('psychic_viagem_temporal');
			expect(b.deck).toEqual(['neu_atk_preciso']);
		} finally {
			restore();
		}
	});
});

describe('electric_recarga — Recarga', () => {
	it('compra 2, ganha 1 de energia e perde 5% da vida máxima', () => {
		const b = testBattle({
			hand: ['electric_recarga'],
			deck: ['neu_atk_preciso', 'neu_def_bloqueio']
		});
		b.play('electric_recarga');
		expect(b.player.mana).toBe(4); // 3 - 0 + 1
		expect(b.state.hand).toHaveLength(2);
		expect(b.player.hp).toBe(95); // 100 - ceil(100 × 5%)
	});
});

describe('bug_picada — Picada Rápida (PILHA_EXAURIR)', () => {
	it('soma +1 à PILHA_EXAURIR e é exaurida do combate', () => {
		const b = testBattle({ hand: ['bug_picada'] });
		const r = b.play('bug_picada');
		expect(b.state.pilhaExaurir).toBe(1);
		expect(r.exhausted).toBe(true);
		expect(b.exhaustedPile).toContain('bug_picada');
	});

	it('o token (EXHAUST_RUN) é removido permanentemente do deck/inventário', async () => {
		const { removeFromDeck, removeFromInventory } = await import('$lib/db/cards');
		const b = testBattle({ hand: ['bug_picada_token'] });
		const tokenId = b.state.hand[0].id;
		b.play('bug_picada_token');
		expect(b.state.pilhaExaurir).toBe(1);
		expect(removeFromDeck).toHaveBeenCalledWith(tokenId);
		expect(removeFromInventory).toHaveBeenCalledWith(tokenId);
	});
});

describe('ghost_assombracao — Assombração Progressiva', () => {
	it('cartas Fantasma ganham +1 de dano por turno decorrido', () => {
		const b = testBattle({
			hand: ['ghost_assombracao'],
			deck: ['ghost_susto'],
			player: { mana: 6 },
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.play('ghost_assombracao');
		expect(b.player.has('assombracao')).toBe(true);
		expect(b.player.stacks('assombracao')).toBe(0); // começa em 0

		b.endTurn(); // onTurnStart: stacks → 1
		expect(b.player.stacks('assombracao')).toBe(1);

		b.play('ghost_susto');
		expect(b.enemy.damageTaken).toBe(5); // 4 base + 1 da assombração
	});
});

describe('ice_congelamento — Congelamento Progressivo', () => {
	// BUG: cada carta Gelo é contada DUAS vezes — handleAttack adiciona
	// ice_count(+1) e o hook onCardPlayed do próprio status incrementa de novo.
	// A descrição promete 3 de dano por carta Gelo jogada.
	it.fails('causa 3 de dano por carta Gelo jogada (hoje conta em dobro)', () => {
		const b = testBattle({
			hand: ['ice_cristal', 'ice_congelamento'],
			player: { mana: 6 }
		});
		b.play('ice_cristal'); // 1 carta Gelo jogada
		const enemyHpBefore = b.state.enemy.hp;
		b.play('ice_congelamento');
		expect(enemyHpBefore - b.state.enemy.hp).toBe(3); // real: 6
	});

	it('comportamento atual: 6 de dano após 1 carta Gelo (contagem dupla)', () => {
		const b = testBattle({
			hand: ['ice_cristal', 'ice_congelamento'],
			player: { mana: 6 }
		});
		b.play('ice_cristal');
		const enemyHpBefore = b.state.enemy.hp;
		b.play('ice_congelamento');
		expect(enemyHpBefore - b.state.enemy.hp).toBe(6);
	});
});

describe('fighting_punho — Punho Sincronizado (SEQUÊNCIA)', () => {
	it('cartas Lutador consecutivas acumulam +2 de dano por carta', () => {
		const b = testBattle({
			hand: ['fighting_punho', 'fighting_rajada', 'fighting_rajada'],
			player: { mana: 6 }
		});
		// o próprio Punho é Lutador e já conta na sequência (contagem 1)
		b.play('fighting_punho');

		b.play(0); // 1ª rajada: 6 + 1×2
		expect(b.enemy.damageTaken).toBe(8);

		b.play(0); // 2ª rajada: 6 + 2×2
		expect(b.enemy.damageTaken).toBe(8 + 10);
	});

	it('carta de outro elemento zera a sequência', () => {
		const b = testBattle({
			hand: ['fighting_punho', 'fighting_rajada', 'neu_def_bloqueio', 'fighting_rajada'],
			player: { element: 'fighting', mana: 6 }
		});
		b.play('fighting_punho'); // contagem 1
		b.play('fighting_rajada'); // 6 + 2, contagem 2
		b.play('neu_def_bloqueio'); // zera a contagem
		b.play('fighting_rajada'); // 6 + 0
		expect(b.enemy.damageTaken).toBe(14); // 8 + 6
	});
});

describe('electric_sobrecarga — Sobrecarga (DANO_ELÉTRICO)', () => {
	it('cada carta jogada causa +2 de dano elétrico', () => {
		const b = testBattle({
			hand: ['electric_sobrecarga', 'neu_def_bloqueio'],
			player: { mana: 6 }
		});
		b.play('electric_sobrecarga');
		// a própria Sobrecarga já dispara o status recém-aplicado
		expect(b.enemy.damageTaken).toBe(2);

		b.play('neu_def_bloqueio');
		expect(b.enemy.damageTaken).toBe(4);
	});
});

describe('flying_evasao_total — Evasão Total', () => {
	it('aplica o bônus de próximo turno e +1 de energia funciona', () => {
		const b = testBattle({
			hand: ['flying_evasao_total'],
			deck: Array(8).fill('neu_atk_preciso'),
			player: { mana: 3 },
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.play('flying_evasao_total');
		expect(b.player.has('next_turn_bonus')).toBe(true);
		b.endTurn();
		expect(b.player.mana).toBe(4); // 3 + 1 do bônus
	});

	// BUG: o "+2 cartas" não tem efeito — o draw do bônus acontece antes do
	// preenchimento normal da mão, que é limitado a 5 de qualquer forma.
	it.fails('próximo turno compra +2 cartas além das 5 (hoje fica em 5)', () => {
		const b = testBattle({
			hand: ['flying_evasao_total'],
			deck: Array(8).fill('neu_atk_preciso'),
			player: { mana: 3 },
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.play('flying_evasao_total');
		b.endTurn();
		expect(b.state.hand).toHaveLength(7); // real: 5
	});
});

describe('fighting_ritmo — Ritmo Implacável (AUTO_JOGAR)', () => {
	// BUG: auto_jogar roda no início do turno ANTES da compra de cartas —
	// a mão está sempre vazia nesse momento (descartada no fim do turno),
	// então o power nunca joga nada automaticamente.
	it.fails('joga cartas Lutador da mão automaticamente no início do turno', () => {
		const b = testBattle({
			hand: ['fighting_ritmo'],
			deck: Array(6).fill('fighting_rajada'),
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.play('fighting_ritmo');
		b.endTurn();
		// desejado: rajadas compradas seriam auto-jogadas causando dano
		expect(b.enemy.damageTaken).toBeGreaterThan(0); // real: 0
	});
});
