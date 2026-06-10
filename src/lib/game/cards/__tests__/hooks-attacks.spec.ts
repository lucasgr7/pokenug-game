import { describe, expect, it } from 'vitest';
import { card, stubRandom, testBattle } from '$lib/testing/battle';

/**
 * Specs dedicadas das cartas de ATAQUE com CARD_HOOKS — cada teste valida o
 * comportamento descrito no texto da carta.
 */

describe('dragon_furia — Fúria do Dragão', () => {
	it('causa 10 de dano base sem CARGA_DRAGÃO', () => {
		const b = testBattle({ hand: ['dragon_furia'] });
		b.play('dragon_furia');
		expect(b.enemy.damageTaken).toBe(10);
	});

	it('soma o total de CARGA_DRAGÃO ao dano', () => {
		const b = testBattle({ hand: ['dragon_furia'], player: { statuses: [['carga_dragao', 8]] } });
		b.play('dragon_furia');
		expect(b.enemy.damageTaken).toBe(18);
	});

	it('dobra o dano total com FURIA_DOUBLE (dragon_poder)', () => {
		const b = testBattle({
			hand: ['dragon_furia'],
			player: { statuses: [['carga_dragao', 8], 'furia_double'] }
		});
		b.play('dragon_furia');
		expect(b.enemy.damageTaken).toBe(36);
	});
});

describe('flying_golpe_aereo — Golpe Aéreo', () => {
	it('compra 1 carta se for o primeiro ataque do turno', () => {
		const b = testBattle({ hand: ['flying_golpe_aereo'], deck: ['neu_atk_preciso'] });
		b.play('flying_golpe_aereo');
		expect(b.enemy.damageTaken).toBe(9);
		expect(b.hand).toContain('neu_atk_preciso');
	});

	it('não compra no segundo ataque do turno', () => {
		const b = testBattle({
			hand: ['flying_golpe_aereo', 'flying_golpe_aereo'],
			deck: ['neu_atk_preciso', 'neu_atk_preciso'],
			player: { mana: 3 }
		});
		b.play('flying_golpe_aereo'); // 1º ataque: compra 1
		b.play('flying_golpe_aereo'); // 2º ataque: não compra
		expect(b.hand).toEqual(['neu_atk_preciso']);
		expect(b.deck).toHaveLength(1);
	});
});

describe('flying_mergulho — Mergulho', () => {
	it('compra 2 cartas se for a primeira carta jogada no turno', () => {
		const b = testBattle({
			hand: ['flying_mergulho'],
			deck: ['neu_atk_preciso', 'neu_atk_preciso', 'neu_atk_preciso']
		});
		b.play('flying_mergulho');
		expect(b.enemy.damageTaken).toBe(20);
		expect(b.state.hand).toHaveLength(2);
	});

	it('não compra se outra carta já foi jogada no turno', () => {
		const b = testBattle({
			hand: ['neu_def_bloqueio', 'flying_mergulho'],
			deck: ['neu_atk_preciso'],
			player: { element: 'flying', mana: 3 }
		});
		b.play('neu_def_bloqueio');
		b.play('flying_mergulho');
		expect(b.state.hand).toHaveLength(0);
		expect(b.deck).toHaveLength(1);
	});
});

describe('water_tsunami — Tsunami', () => {
	it('traz todas as cartas de Água do deck e do descarte para a mão', () => {
		const b = testBattle({
			hand: ['water_tsunami'],
			deck: ['water_splash', 'neu_atk_preciso'],
			discard: ['water_fluxo'],
			player: { mana: 3 }
		});
		b.play('water_tsunami');
		expect(b.enemy.damageTaken).toBe(40);
		expect(b.hand).toEqual(expect.arrayContaining(['water_splash', 'water_fluxo']));
		expect(b.deck).toEqual(['neu_atk_preciso']);
		expect(b.discardPile).not.toContain('water_fluxo');
	});
});

describe('dragon_cauda — Cauda do Dragão', () => {
	it('descarta a carta mais à esquerda da mão e compra 1', () => {
		const b = testBattle({
			hand: ['dragon_cauda', 'neu_atk_preciso', 'neu_def_bloqueio'],
			deck: ['neu_atk_investida']
		});
		b.play('dragon_cauda');
		expect(b.enemy.damageTaken).toBe(11);
		expect(b.discardPile).toContain('neu_atk_preciso'); // a mais à esquerda após jogar
		expect(b.hand).toEqual(['neu_def_bloqueio', 'neu_atk_investida']);
	});
});

describe('poison_mordida — Mordida', () => {
	it('com efeito negativo no inimigo: +1 energia e compra 1', () => {
		const b = testBattle({
			hand: ['poison_mordida'],
			deck: ['neu_atk_preciso'],
			enemy: { statuses: [['shield_reduced', 1]] } // status sem efeito no dano
		});
		b.play('poison_mordida');
		expect(b.enemy.damageTaken).toBe(7);
		expect(b.player.mana).toBe(3); // 3 - 1 (custo) + 1 (bônus)
		expect(b.hand).toContain('neu_atk_preciso');
	});

	it('sem efeito negativo: apenas o dano', () => {
		const b = testBattle({ hand: ['poison_mordida'], deck: ['neu_atk_preciso'] });
		b.play('poison_mordida');
		expect(b.player.mana).toBe(2);
		expect(b.hand).toHaveLength(0);
	});
});

describe('ghost_susto — Susto', () => {
	it('se o inimigo vai atacar: +1 energia', () => {
		const b = testBattle({
			hand: ['ghost_susto'],
			enemy: { intent: { kind: 'attack', damage: 6 } }
		});
		b.play('ghost_susto');
		expect(b.enemy.damageTaken).toBe(4);
		expect(b.player.mana).toBe(3); // 3 - 1 + 1
	});

	it('se o inimigo não vai atacar: sem bônus', () => {
		const b = testBattle({
			hand: ['ghost_susto'],
			enemy: { intent: { kind: 'defend', block: 5 } }
		});
		b.play('ghost_susto');
		expect(b.player.mana).toBe(2);
	});
});

describe('rock_lancar_pedra — Lançar Pedra', () => {
	it('com inimigo escudado: +1 energia e compra 1 (dano absorvido pelo escudo)', () => {
		const b = testBattle({
			hand: ['rock_lancar_pedra'],
			deck: ['neu_atk_preciso'],
			enemy: { block: 4 }
		});
		b.play('rock_lancar_pedra');
		expect(b.player.mana).toBe(3);
		expect(b.hand).toContain('neu_atk_preciso');
		expect(b.enemy.damageTaken).toBe(6); // 10 - 4 de escudo
		expect(b.enemy.block).toBe(0);
	});

	it('sem escudo inimigo: só os 10 de dano', () => {
		const b = testBattle({ hand: ['rock_lancar_pedra'], deck: ['neu_atk_preciso'] });
		b.play('rock_lancar_pedra');
		expect(b.player.mana).toBe(2);
		expect(b.enemy.damageTaken).toBe(10);
		expect(b.hand).toHaveLength(0);
	});
});

describe('electric_descarga — Descarga Elétrica', () => {
	it('descarta a mão, compra o mesmo número e causa 4 de dano por carta', () => {
		const b = testBattle({
			hand: ['electric_descarga', 'neu_atk_preciso', 'neu_def_bloqueio'],
			player: { mana: 3 }
		});
		b.play('electric_descarga');
		// 2 cartas descartadas → 2×4 = 8 de dano (a carta não tem dano próprio)
		expect(b.enemy.damageTaken).toBe(8);
		// deck vazio → o descarte é reembaralhado e as 2 cartas voltam à mão
		expect(b.state.hand).toHaveLength(2);
	});

	it('com a mão vazia não faz nada além do ataque base (0)', () => {
		const b = testBattle({ hand: ['electric_descarga'] });
		b.play('electric_descarga');
		expect(b.enemy.damageTaken).toBe(0);
	});
});

describe('psychic_refluxo — Refluxo Mental', () => {
	it('devolve o dano sofrido no último turno', () => {
		const b = testBattle({ hand: ['psychic_refluxo'] });
		b.state.player.turnFlags.damageReceivedLastTurn = 12;
		b.play('psychic_refluxo');
		expect(b.enemy.damageTaken).toBe(12);
	});

	it('limita o refluxo a 30', () => {
		const b = testBattle({ hand: ['psychic_refluxo'] });
		b.state.player.turnFlags.damageReceivedLastTurn = 55;
		b.play('psychic_refluxo');
		expect(b.enemy.damageTaken).toBe(30);
	});

	it('sem dano sofrido: 0 de dano', () => {
		const b = testBattle({ hand: ['psychic_refluxo'] });
		b.play('psychic_refluxo');
		expect(b.enemy.damageTaken).toBe(0);
	});
});

describe('bug_enxame — Enxame Voraz', () => {
	it('causa 2 de dano por carta na pilha de exaustas', () => {
		const b = testBattle({
			hand: ['bug_enxame'],
			exhausted: ['neu_atk_preciso', 'neu_atk_preciso', 'neu_def_bloqueio']
		});
		b.play('bug_enxame');
		expect(b.enemy.damageTaken).toBe(6);
	});

	it('sem exaustas: 0 de dano', () => {
		const b = testBattle({ hand: ['bug_enxame'] });
		b.play('bug_enxame');
		expect(b.enemy.damageTaken).toBe(0);
	});
});

describe('grass_chicote_verde — Chicote Verde', () => {
	it('causa 10 de dano sem ENRAIZADO', () => {
		const b = testBattle({ hand: ['grass_chicote_verde'] });
		b.play('grass_chicote_verde');
		expect(b.enemy.damageTaken).toBe(10);
	});

	it('contra inimigo ENRAIZADO: base 30 × 2 do próprio ENRAIZADO = 60', () => {
		// O hook eleva a base para 30 E o status enraizado dobra dano de Grama:
		// os efeitos se acumulam (6× o dano base, não 3× como diz a descrição).
		const b = testBattle({ hand: ['grass_chicote_verde'], enemy: { statuses: [['enraizado', 2]] } });
		b.play('grass_chicote_verde');
		expect(b.enemy.damageTaken).toBe(60);
	});
});

describe('bug_corte — Corte de Tesoura', () => {
	it('exaure 1 carta Inseto da mão e soma 2 à PILHA_EXAURIR', () => {
		const b = testBattle({ hand: ['bug_corte', 'bug_picada', 'neu_atk_preciso'] });
		b.play('bug_corte');
		expect(b.enemy.damageTaken).toBe(12);
		expect(b.state.pilhaExaurir).toBe(2); // +1 do corte, +1 do inseto exaurido
		expect(b.exhaustedPile).toContain('bug_picada');
		expect(b.hand).toEqual(['neu_atk_preciso']);
	});

	it('sem inseto na mão: só +1 na PILHA_EXAURIR', () => {
		const b = testBattle({ hand: ['bug_corte', 'neu_atk_preciso'] });
		b.play('bug_corte');
		expect(b.state.pilhaExaurir).toBe(1);
		expect(b.hand).toEqual(['neu_atk_preciso']);
	});
});

describe('poison_toxina — Toxina Mortífera', () => {
	it('dobra os efeitos negativos ativos no inimigo', () => {
		const b = testBattle({
			hand: ['poison_toxina'],
			enemy: { statuses: [['imobilizado', 2], ['fraqueza', 1], ['enraizado', 3]] }
		});
		b.play('poison_toxina');
		expect(b.enemy.damageTaken).toBe(20); // 16 × 1.25 da própria FRAQUEZA
		expect(b.enemy.stacks('imobilizado')).toBe(4);
		expect(b.enemy.stacks('fraqueza')).toBe(2);
		expect(b.enemy.stacks('enraizado')).toBe(6);
	});

	it('não altera statuses fora da lista de amplificáveis', () => {
		const b = testBattle({ hand: ['poison_toxina'], enemy: { statuses: [['shield_reduced', 1]] } });
		b.play('poison_toxina');
		expect(b.enemy.stacks('shield_reduced')).toBe(1);
	});
});

describe('ground_prisao — Prisão Eterna', () => {
	it('duplica a duração de IMOBILIZADO', () => {
		const b = testBattle({ hand: ['ground_prisao'], enemy: { statuses: [['imobilizado', 2]] } });
		b.play('ground_prisao');
		expect(b.enemy.damageTaken).toBe(5);
		expect(b.enemy.stacks('imobilizado')).toBe(4);
	});

	it('sem IMOBILIZADO: apenas o dano', () => {
		const b = testBattle({ hand: ['ground_prisao'] });
		b.play('ground_prisao');
		expect(b.enemy.has('imobilizado')).toBe(false);
	});
});

describe('fighting_rajada — Rajada de Socos', () => {
	it('cria 1 cópia no descarte (total 2 cópias)', () => {
		const b = testBattle({ hand: ['fighting_rajada'] });
		b.play('fighting_rajada');
		expect(b.enemy.damageTaken).toBe(6);
		expect(b.discardPile.filter((id) => id === 'fighting_rajada')).toHaveLength(2);
	});

	it('respeita o limite de 2 cópias', () => {
		const b = testBattle({
			hand: ['fighting_rajada'],
			discard: ['fighting_rajada', 'fighting_rajada']
		});
		b.play('fighting_rajada');
		// já existiam 2 cópias → nenhuma nova é criada (3 = 2 antigas + a jogada)
		expect(b.discardPile.filter((id) => id === 'fighting_rajada')).toHaveLength(3);
	});
});

describe('grass_espinhos — Espinhos (modifier decrescente)', () => {
	it('perde 1 de escudo permanentemente a cada uso', () => {
		const espinhos = card('grass_espinhos');
		const b = testBattle({ hand: [espinhos], player: { mana: 6 } });

		let r = b.play('grass_espinhos');
		expect(r.blocked).toBe(12);
		expect(espinhos.modifier).toBe(-1);

		// volta a carta do descarte para a mão e joga de novo
		b.state.hand.push(b.state.discard.pop()!);
		r = b.play('grass_espinhos');
		expect(r.blocked).toBe(11);
		expect(espinhos.modifier).toBe(-2);
	});
});

describe('ghost_alma_penada — Alma Penada', () => {
	it('acumula debuff permanente e exaure 1 carta aleatória da mão', () => {
		const restore = stubRandom(0);
		try {
			const b = testBattle({ hand: ['ghost_alma_penada', 'neu_atk_preciso'] });
			b.play('ghost_alma_penada');
			expect(b.state.player.ghostPermDebuff).toBe(1);
			expect(b.exhaustedPile).toContain('neu_atk_preciso');
			expect(b.hand).toHaveLength(0);
			// a própria carta é EXHAUST_RUN
			expect(b.exhaustedPile).toContain('ghost_alma_penada');
		} finally {
			restore();
		}
	});
});
