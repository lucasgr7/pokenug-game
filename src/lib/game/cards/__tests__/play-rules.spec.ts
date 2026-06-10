import { describe, expect, it, vi } from 'vitest';
import { removeFromDeck, removeFromInventory } from '$lib/db/cards';
import { card, testBattle } from '$lib/testing/battle';

/**
 * Regras transversais de jogada: mana, POWER única, DUPLICAR, exaustão por
 * desalinhamento, upgrades e statuses genéricos de ataque.
 */

describe('custo de mana', () => {
	it('recusa a jogada sem mana suficiente', () => {
		const b = testBattle({ hand: ['heal_spray_cura'], player: { mana: 1 } }); // custo 2
		const r = b.tryPlay('heal_spray_cura');
		expect(r.played).toBe(false);
		expect(b.hand).toContain('heal_spray_cura');
		expect(b.player.mana).toBe(1);
	});

	it('deduz exatamente o custo da carta', () => {
		const b = testBattle({ hand: ['heal_spray_cura'], player: { mana: 3 } });
		b.play('heal_spray_cura');
		expect(b.player.mana).toBe(1);
	});

	it('energia não passa de 6 (clamp)', () => {
		const b = testBattle({ hand: ['grass_sementes'], player: { mana: 6 } }); // custo 0, +1 mana
		b.play('grass_sementes');
		expect(b.player.mana).toBe(6);
	});

	it('manaGain negativo não deixa a mana abaixo de 0', () => {
		const b = testBattle({ hand: ['ground_peso'], player: { mana: 0 } }); // custo 0, -1 mana
		b.play('ground_peso');
		expect(b.player.mana).toBe(0);
	});
});

describe('POWER — uma vez por combate', () => {
	it('a mesma POWER não pode ser jogada duas vezes', () => {
		const b = testBattle({ hand: ['ghost_assombracao'], player: { mana: 6 } });
		b.play('ghost_assombracao');
		// devolve a carta à mão (simula tê-la de volta) e tenta de novo
		b.giveCard('ghost_assombracao');
		const r = b.tryPlay('ghost_assombracao');
		expect(r.played).toBe(false);
		expect(b.state.usedPowerIds).toEqual(['ghost_assombracao']);
	});
});

describe('DUPLICAR_CARTA', () => {
	it('psychic_paradoxo: a próxima carta é executada duas vezes', () => {
		const b = testBattle({
			hand: ['psychic_paradoxo', 'neu_atk_preciso'],
			player: { mana: 6 }
		});
		b.play('psychic_paradoxo');
		expect(b.player.has('duplicar')).toBe(true);

		b.play('neu_atk_preciso'); // 4 de dano × 2
		expect(b.enemy.damageTaken).toBe(8);
		expect(b.player.has('duplicar')).toBe(false);
	});

	it('ice_cristal também ativa DUPLICAR', () => {
		const b = testBattle({ hand: ['ice_cristal', 'neu_atk_preciso'], player: { mana: 6 } });
		b.play('ice_cristal');
		expect(b.player.has('duplicar')).toBe(true);
		b.play('neu_atk_preciso');
		expect(b.enemy.damageTaken).toBe(11 + 8); // cristal 11 + preciso 4×2
	});

	it('jogar uma carta DUPLICAR com outra ativa consome ambas sem dobrar', () => {
		const b = testBattle({
			hand: ['psychic_paradoxo', 'ice_cristal'],
			player: { mana: 6 },
			enemy: { element: 'normal' } // neutro p/ gelo E psíquico
		});
		b.play('psychic_paradoxo');
		b.play('ice_cristal');
		expect(b.enemy.damageTaken).toBe(11); // não duplica o cristal
		expect(b.player.has('duplicar')).toBe(false);
	});
});

describe('exaustão e desalinhamento', () => {
	it('carta de elemento diferente do pokémon ativo é exaurida (EXHAUST_COMBATE)', () => {
		const b = testBattle({ hand: ['water_splash'], player: { element: 'fire' } });
		const r = b.play('water_splash');
		expect(r.exhausted).toBe(true);
		expect(b.exhaustedPile).toContain('water_splash');
		// combate-apenas: NÃO remove do banco
		expect(vi.mocked(removeFromDeck)).not.toHaveBeenCalled();
	});

	it('carta alinhada vai para o descarte', () => {
		const b = testBattle({ hand: ['water_splash'], player: { element: 'water' } });
		const r = b.play('water_splash');
		expect(r.exhausted).toBe(false);
		expect(b.discardPile).toContain('water_splash');
	});

	it('pokémon corrompido nunca exaure cartas', () => {
		const b = testBattle({
			hand: ['water_splash'],
			player: { element: 'fire', corrupted: true }
		});
		const r = b.play('water_splash');
		expect(r.exhausted).toBe(false);
	});

	it('EXHAUST_RUN remove a carta permanentemente do deck e inventário', () => {
		const alma = card('ghost_alma_penada');
		const b = testBattle({ hand: [alma], player: { element: 'ghost' } });
		b.play('ghost_alma_penada');
		expect(vi.mocked(removeFromDeck)).toHaveBeenCalledWith(alma.id);
		expect(vi.mocked(removeFromInventory)).toHaveBeenCalledWith(alma.id);
	});

	it('pokébola não-starter é exaurida após o uso', () => {
		const b = testBattle({ hand: ['pokeball_great'] });
		const r = b.play('pokeball_great');
		expect(r.exhausted).toBe(true);
	});
});

describe('captura', () => {
	it('primeira luta de boss bloqueia captura', () => {
		const b = testBattle({
			hand: ['pokeball_master'],
			mode: 'boss',
			bossFirstFightBlockedCapture: true,
			enemy: { hp: 1 }
		});
		b.play('pokeball_master');
		expect(b.status).toBe('active');
	});
});

describe('statuses genéricos de ataque', () => {
	it('EMPOWERED soma o bônus uma única vez', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso', 'neu_atk_preciso'],
			player: { statuses: [['empowered', 5]], mana: 6 }
		});
		b.play(0);
		expect(b.enemy.damageTaken).toBe(9); // 4 + 5
		expect(b.player.has('empowered')).toBe(false);

		b.play(0);
		expect(b.enemy.damageTaken).toBe(13); // segundo ataque sem bônus
	});

	it('BERSERK dobra o ataque e corta o escudo pela metade', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso', 'neu_def_bloqueio'],
			player: { statuses: ['berserk'], mana: 6 }
		});
		b.play('neu_atk_preciso');
		expect(b.enemy.damageTaken).toBe(8); // 4 × 2

		const r = b.play('neu_def_bloqueio');
		expect(r.blocked).toBe(3); // floor(6 / 2)
	});

	it('DRAGONIZE converte ataques sem elemento para dragão', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso'],
			player: { statuses: ['dragonize'] },
			enemy: { element: 'normal' }
		});
		const r = b.play('neu_atk_preciso');
		expect(r.element).toBe('dragon');
		expect(b.enemy.damageTaken).toBe(4); // dragão vs normal = 1×
	});

	it('SPECIALIZE dá o elemento do pokémon a cartas starter', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso'],
			player: { element: 'fire', statuses: ['specialize'] },
			enemy: { element: 'grass' }
		});
		const r = b.play('neu_atk_preciso');
		expect(r.element).toBe('fire');
		expect(b.enemy.damageTaken).toBe(8); // 4 × 2 (fogo vs grama)
	});

	it('ATTACK_REPEAT repete o ataque e é consumido', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso'],
			player: { statuses: [['attack_repeat', 1]] }
		});
		b.play('neu_atk_preciso');
		expect(b.enemy.damageTaken).toBe(8); // 2 golpes de 4
		expect(b.player.has('attack_repeat')).toBe(false);
	});

	it('FRAQUEZA no inimigo aumenta o dano recebido em 25% por stack', () => {
		const b = testBattle({
			hand: ['neu_atk_preciso'],
			enemy: { statuses: [['fraqueza', 1]] }
		});
		b.play('neu_atk_preciso');
		expect(b.enemy.damageTaken).toBe(5); // floor(4 × 1.25)
	});

	it('STATIC_SHOCK causa dano elétrico a cada carta jogada', () => {
		const b = testBattle({
			hand: ['neu_def_bloqueio'],
			player: { statuses: [['static_shock', 2]] },
			enemy: { element: 'normal' }
		});
		b.play('neu_def_bloqueio');
		expect(b.enemy.damageTaken).toBe(2);
	});
});

describe('upgrades de carta (+1 por nível)', () => {
	it('ataque com upgrades causa dano extra', () => {
		const b = testBattle({ hand: [card('neu_atk_preciso', { upgrades: 2 })] });
		b.play('neu_atk_preciso');
		expect(b.enemy.damageTaken).toBe(6); // 4 + 2
	});

	it('defesa com upgrades gera escudo extra', () => {
		const b = testBattle({ hand: [card('neu_def_bloqueio', { upgrades: 3 })] });
		const r = b.play('neu_def_bloqueio');
		expect(r.blocked).toBe(9); // 6 + 3
	});
});

describe('efetividade de tipos', () => {
	it('ataque super efetivo causa dano dobrado', () => {
		const b = testBattle({
			hand: ['fire_chama_ardente'],
			enemy: { element: 'grass' }
		});
		const r = b.play('fire_chama_ardente');
		expect(b.enemy.damageTaken).toBe(16); // 8 × 2
		expect(r.effectiveness).toBe(2);
	});

	it('ataque resistido causa metade do dano', () => {
		const b = testBattle({
			hand: ['fire_chama_ardente'],
			enemy: { element: 'water' }
		});
		const r = b.play('fire_chama_ardente');
		expect(b.enemy.damageTaken).toBe(4); // 8 × 0.5
		expect(r.effectiveness).toBe(0.5);
	});
});

describe('fim de batalha por dano', () => {
	it('reduzir o HP do inimigo a 0 vence a batalha', () => {
		const b = testBattle({ hand: ['neu_atk_preciso'], enemy: { hp: 3 } });
		b.play('neu_atk_preciso');
		expect(b.status).toBe('victory');
	});
});
