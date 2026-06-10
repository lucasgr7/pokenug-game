import { describe, expect, it } from 'vitest';
import { testBattle } from '$lib/testing/battle';

/**
 * Turno inimigo (endTurnOn): resolução de intenção, debuffs, escudos
 * reativos e ciclo de turno.
 */

describe('intenção de ataque', () => {
	it('dano tipado: ataque super efetivo contra o jogador', () => {
		const b = testBattle({
			player: { element: 'fire' },
			enemy: { element: 'water', intent: { kind: 'attack', damage: 10, element: 'water' } }
		});
		const r = b.endTurn();
		expect(r.kind).toBe('attack');
		expect(b.player.damageTaken).toBe(20); // água vs fogo = 2×
		expect(r.effectiveness).toBe(2);
	});

	it('escudo absorve antes do HP', () => {
		const b = testBattle({
			player: { block: 6 },
			enemy: { intent: { kind: 'attack', damage: 10 } }
		});
		const r = b.endTurn();
		expect(r.absorbed).toBe(6);
		expect(b.player.damageTaken).toBe(4);
	});

	it('IMOBILIZADO corta o dano pela metade e decai no fim do turno', () => {
		const b = testBattle({
			enemy: { intent: { kind: 'attack', damage: 10 }, statuses: [['imobilizado', 2]] }
		});
		b.endTurn();
		expect(b.player.damageTaken).toBe(5);
		expect(b.enemy.stacks('imobilizado')).toBe(1); // decaiu 1
	});

	it('INTIMIDATE reduz o dano pela porcentagem configurada', () => {
		const b = testBattle({ enemy: { intent: { kind: 'attack', damage: 10 } } });
		b.addEnemyStatus('intimidate', 2, { reduction: 0.3 });
		b.endTurn();
		expect(b.player.damageTaken).toBe(7); // round(10 × 0.7)
	});

	it('debuff permanente de Alma Penada reduz o dano', () => {
		const b = testBattle({ enemy: { intent: { kind: 'attack', damage: 10 } } });
		b.state.player.ghostPermDebuff = 3;
		b.endTurn();
		expect(b.player.damageTaken).toBe(7);
	});

	it('GHOST_FORM reduz qualquer dano recebido a 1', () => {
		const b = testBattle({
			player: { statuses: ['ghost_form'] },
			enemy: { intent: { kind: 'attack', damage: 50 } }
		});
		b.endTurn();
		expect(b.player.damageTaken).toBe(1);
	});

	it('jogador com 0 de HP → derrota', () => {
		const b = testBattle({
			player: { hp: 5 },
			enemy: { intent: { kind: 'attack', damage: 10 } }
		});
		b.endTurn();
		expect(b.status).toBe('defeat');
	});
});

describe('intenção de defesa e buff', () => {
	it('defend: inimigo ganha o escudo da intenção', () => {
		const b = testBattle({ enemy: { intent: { kind: 'defend', block: 8 } } });
		const r = b.endTurn();
		expect(r.enemyBlock).toBe(8);
		expect(b.enemy.block).toBe(8);
	});

	it('CANCEL_ESCUDO anula a ação de defesa', () => {
		const b = testBattle({
			enemy: { intent: { kind: 'defend', block: 8 }, statuses: ['shield_cancelled'] }
		});
		const r = b.endTurn();
		expect(r.enemyBlock).toBe(0);
		expect(b.enemy.block).toBe(0);
	});

	it('REDUZ_SHIELD corta o escudo inimigo pela metade', () => {
		const b = testBattle({
			enemy: { intent: { kind: 'defend', block: 9 }, statuses: ['shield_reduced'] }
		});
		const r = b.endTurn();
		expect(r.enemyBlock).toBe(4); // floor(9 × 0.5)
	});

	it('buff acumula em nextDamageBonus e soma no próximo ataque', () => {
		const b = testBattle({ enemy: { intent: { kind: 'buff', nextDamage: 5 } } });
		const r = b.endTurn();
		expect(r.buffAmount).toBe(5);
		expect(b.state.enemy.nextDamageBonus).toBe(5);

		b.setEnemyIntent({ kind: 'attack', damage: 10 });
		b.endTurn();
		expect(b.player.damageTaken).toBe(15);
	});

	it('REDUZ_BUFF corta o buff inimigo pela metade', () => {
		const b = testBattle({
			enemy: { intent: { kind: 'buff', nextDamage: 9 }, statuses: ['buff_reduced'] }
		});
		const r = b.endTurn();
		expect(r.buffAmount).toBe(4);
	});
});

describe('escudos reativos do jogador', () => {
	it('REFLEXO devolve 50% do dano absorvido', () => {
		const b = testBattle({
			hand: ['psychic_espelho'],
			player: { mana: 3 },
			enemy: { intent: { kind: 'attack', damage: 10 } }
		});
		b.play('psychic_espelho'); // 18 de escudo + reflexo
		b.endTurn();
		expect(b.player.damageTaken).toBe(0); // tudo absorvido
		expect(b.enemy.damageTaken).toBe(5); // floor(10 × 0.5) refletido
	});

	it('GLACIAÇÃO: escudo destruído devolve o dano acumulado', () => {
		const b = testBattle({
			hand: ['ice_glaciacao'],
			player: { mana: 3 },
			enemy: { intent: { kind: 'attack', damage: 30 } }
		});
		b.play('ice_glaciacao'); // 20 de escudo + revenge_shield(20)
		b.endTurn();
		expect(b.player.damageTaken).toBe(10); // 30 - 20 de escudo
		expect(b.enemy.damageTaken).toBe(20); // vingança
		expect(b.player.has('revenge_shield')).toBe(false);
	});
});

describe('ciclo de turno', () => {
	it('reseta mana, limpa escudo, compra 5 cartas e avança o turno', () => {
		const b = testBattle({
			player: { mana: 0, block: 7 },
			deck: ['neu_atk_preciso', 'neu_atk_preciso', 'neu_def_bloqueio', 'pokeball_basic', 'heal_spray_cura', 'neu_atk_preciso'],
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		expect(b.state.turnNumber).toBe(1);
		b.endTurn();
		expect(b.player.mana).toBe(3);
		expect(b.player.block).toBe(0);
		expect(b.state.hand).toHaveLength(5);
		expect(b.state.turnNumber).toBe(2);
		expect(b.state.turn).toBe('player');
	});

	it('a mão é descartada no fim do turno', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso', 'neu_def_bloqueio'],
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		b.endTurn();
		// sem deck: as cartas descartadas são reembaralhadas e recompradas
		expect(b.state.hand).toHaveLength(2);
		expect(b.state.discard).toHaveLength(0);
	});

	it('emite evento reshuffle quando o descarte volta ao deck', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso'],
			discard: ['neu_def_bloqueio', 'pokeball_basic'],
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		const r = b.endTurn();
		// 1 da mão descartada + 2 já no descarte → 3 cartas reembaralhadas
		expect(r.events).toContainEqual({ kind: 'reshuffle', source: 'discard', count: 3 });
		expect(b.state.hand).toHaveLength(3);
	});

	it('emite evento reshuffle ao reciclar exaustas quando o descarte está vazio', () => {
		const b = testBattle({
			exhausted: ['neu_atk_preciso', 'neu_def_bloqueio'],
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		const r = b.endTurn();
		expect(r.events).toContainEqual({ kind: 'reshuffle', source: 'exhausted', count: 2 });
		expect(b.state.hand).toHaveLength(2);
		expect(b.exhaustedPile).toHaveLength(0);
	});

	it('statuses com decay turnStart somem no início do turno seguinte', () => {
		const b = testBattle({
			player: { statuses: ['reflexo'] },
			enemy: { intent: { kind: 'defend', block: 0 } }
		});
		expect(b.player.has('reflexo')).toBe(true);
		b.endTurn();
		expect(b.player.has('reflexo')).toBe(false);
	});
});
