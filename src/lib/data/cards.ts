import { ELEMENTS, type CardTemplate, type Element } from '$lib/game/types';
import { ATTACK_TIERS, DEF_TIERS, HEAL_TIERS } from './card-constants';

// Todos os elementos do jogo usados na geração de cartas compráveis.
const SHOP_ATTACK_ELEMENTS: Element[] = ELEMENTS;

// Nomes temáticos por elemento, indexados pelo tier (0 = mais fraco, 4 = mais forte).
const elementAttackNames: Partial<Record<Element, [string, string, string, string, string]>> = {
	fire:     ['Brasa',      'Chamas',             'Labareda',         'Inferno',              'Apocalipse'],
	water:    ['Gota',       "Jato d'Água",         'Maré Alta',        'Tsunami',              'Dilúvio'],
	grass:    ['Espinho',    'Chicote Trepadeira',  'Explosão Floral',  'Fúria da Selva',       'Colapso Natural'],
	electric: ['Centelha',   'Descarga',            'Trovão',           'Relâmpago',            'Tempestade Elétrica'],
	psychic:  ['Onda Mental','Telecinese',          'Choque Psíquico',  'Explosão Psiônica',    'Singularidade'],
	rock:     ['Pedrada',    'Rochedão',            'Avalanche',        'Terremoto',            'Colapso Geológico'],
};

const elementLabel: Record<Element, string> = {
	fire: 'Fogo',
	water: 'Água',
	grass: 'Planta',
	electric: 'Elétrico',
	normal: 'Normal',
	fighting: 'Lutador',
	psychic: 'Psíquico',
	rock: 'Pedra',
	ground: 'Terra',
	flying: 'Voador',
	bug: 'Inseto',
	poison: 'Veneno',
	ghost: 'Fantasma',
	ice: 'Gelo',
	dragon: 'Dragão'
};

// ---- Cartas iniciais (não compráveis, base do deck do jogador) ----
export const STARTER_TEMPLATES: CardTemplate[] = [
	{
		id: 'atk_basic',
		name: 'Ataque Básico',
		description: 'Causa 6 de dano.',
		cost: 1,
		kind: 'attack',
		element: null,
		rarity: 'starter',
		damage: 6
	},
	{
		id: 'def_basic',
		name: 'Defesa Básica',
		description: 'Ganha 5 de bloqueio.',
		cost: 1,
		kind: 'defense',
		element: null,
		rarity: 'starter',
		block: 5
	},
	{
		id: 'pokeball_basic',
		name: 'Pokébola',
		description: 'Tenta capturar o pokémon selvagem.',
		cost: 2,
		kind: 'capture',
		element: null,
		rarity: 'starter',
		captureBonus: 0
	}
];

// Composição do deck inicial: [templateId, quantidade]
export const STARTER_DECK: Array<[string, number]> = [
	['atk_basic', 5],
	['def_basic', 5],
	['pokeball_basic', 2]
];

// ---- Catálogo comprável ----
function buildCatalog(): CardTemplate[] {
	const out: CardTemplate[] = [];

	// Ataques com elemento: dano x elemento.
	for (const el of SHOP_ATTACK_ELEMENTS) {
		const names = elementAttackNames[el];
		for (let i = 0; i < ATTACK_TIERS.length; i++) {
			const t = ATTACK_TIERS[i];
			const name = names ? names[i] : `Golpe de ${elementLabel[el]} ${t.damage}`;
			out.push({
				id: `atk_${el}_${t.damage}`,
				name,
				description: `Causa ${t.damage} de dano de ${elementLabel[el].toLowerCase()}.`,
				cost: t.cost,
				kind: 'attack',
				element: el,
				rarity: t.rarity,
				tier: t.tier,
				damage: t.damage,
				price:
					t.elemAmount > 0
						? { money: t.money, element: { type: el, amount: t.elemAmount } }
						: { money: t.money }
			});
		}
	}

	// Ataques pesados sem elemento.
	out.push({
		id: 'atk_heavy_20',
		name: 'Pancada Pesada',
		description: 'Causa 20 de dano. Sem elemento.',
		cost: 3,
		kind: 'attack',
		element: null,
		rarity: 'rare',
		tier: 2,
		damage: 20,
		price: { money: 110 }
	});
	out.push({
		id: 'atk_heavy_28',
		name: 'Esmagamento',
		description: 'Causa 100 de dano. Sem elemento.',
		cost: 4,
		kind: 'attack',
		element: null,
		rarity: 'epic',
		tier: 2,
		damage: 100,
		price: { money: 180 }
	});

	// Defesas.
	for (const t of DEF_TIERS) {
		out.push({
			id: `def_${t.block}`,
			name: `Escudo ${t.block}`,
			description: `Ganha ${t.block} de bloqueio.`,
			cost: t.cost,
			kind: 'defense',
			element: null,
			rarity: t.rarity,
			tier: t.tier,
			block: t.block,
			price: { money: t.money }
		});
	}

	out.push({
		id: 'def_fire_barriage',
		name: 'Fire Barriage',
		description: 'Ganha 20 de bloqueio. Reflete 10 de dano ao quebrar a barreira.',
		cost: 2,
		kind: 'defense',
		element: 'fire',
		rarity: 'common',
		tier: 1,
		block: 20,
		shieldEffect: 'fire_thorns',
		price: { money: 10000, element: { type: 'fire', amount: 1000 } }
	});

	out.push({
		id: 'def_ice_barriage',
		name: 'Ice Barriage',
		description: 'Ganha 30 de bloqueio. O dano inimigo é refletido enquanto houver barreira.',
		cost: 2,
		kind: 'defense',
		element: 'ice',
		rarity: 'epic',
		tier: 3,
		block: 30,
		shieldEffect: 'ice_reflect',
		price: { money: 100000, element: { type: 'ice', amount: 10000 } }
	});

	out.push({
		id: 'def_rock_barriage',
		name: 'Rock Barriage',
		description: 'Ganha 30 de bloqueio. A barreira permanece até o próximo turno inimigo.',
		cost: 1,
		kind: 'defense',
		element: 'rock',
		rarity: 'rare',
		tier: 2,
		block: 30,
		shieldEffect: 'rock_persist',
		price: { money: 50000, element: { type: 'rock', amount: 10000 } }
	});

	out.push({
		id: 'def_psyche_barriage',
		name: 'Psyche Barriage',
		description: 'Ganha 20 de bloqueio.',
		cost: 0,
		kind: 'defense',
		element: 'psychic',
		rarity: 'rare',
		tier: 2,
		block: 20,
		price: { money: 100000, element: { type: 'psychic', amount: 10000 } }
	});

	// Cura.
	for (const t of HEAL_TIERS) {
		out.push({
			id: `heal_${t.heal}`,
			name: `Cura ${t.heal}`,
			description: `Restaura ${t.heal} de HP do pokémon ativo.`,
			cost: t.cost,
			kind: 'heal',
			element: null,
			rarity: t.rarity,
			tier: t.tier,
			healHp: t.heal,
			price: { money: t.money }
		});
	}

	// Pokébolas aprimoradas.
	const ballTiers: Array<{ id: string; bonus: number; rarity: CardTemplate['rarity']; money: number; tier: number }> = [
		{ id: 'pokeball_great', bonus: 0.15, rarity: 'common', money: 600, tier: 1 },
		{ id: 'pokeball_ultra', bonus: 0.3, rarity: 'rare', money: 1200, tier: 2 },
		{ id: 'pokeball_master', bonus: 0.5, rarity: 'epic', money: 2000, tier: 3 }
	];
	for (const t of ballTiers) {
		out.push({
			id: t.id,
			name:
				t.id === 'pokeball_great'
					? 'Great Ball'
					: t.id === 'pokeball_ultra'
						? 'Ultra Ball'
						: 'Master Ball',
			description: `Captura com +${Math.round(t.bonus * 100)}% de chance.`,
			cost: 2,
			kind: 'capture',
			element: null,
			rarity: t.rarity,
			tier: t.tier,
			captureBonus: t.bonus,
			price: { money: t.money }
		});
	}

	// Buffs de próximo dano.
	const buffTiers: Array<{ next: number; cost: number; rarity: CardTemplate['rarity']; money: number; tier: number }> = [
		{ next: 8, cost: 1, rarity: 'common', money: 50, tier: 1 },
		{ next: 15, cost: 2, rarity: 'rare', money: 100, tier: 2 }
	];
	for (const t of buffTiers) {
		out.push({
			id: `buff_${t.next}`,
			name: `Foco +${t.next}`,
			description: `Aumenta o próximo ataque em ${t.next}.`,
			cost: t.cost,
			kind: 'buff',
			element: null,
			rarity: t.rarity,
			tier: t.tier,
			buffAmount: t.next,
			price: { money: t.money }
		});
	}

	// Vínculo Parental: próximo ataque acerta múltiplas vezes
	const parentalBondTiers: Array<{ id: string; name: string; hits: number; cost: number; rarity: CardTemplate['rarity']; money: number }> = [
		{ id: 'combo_double',       name: 'Vínculo Parental',  hits: 2, cost: 1, rarity: 'common', money: 120 },
		{ id: 'combo_triple_rare',  name: 'Vínculo Supremo',   hits: 3, cost: 2, rarity: 'rare',   money: 350 },
		{ id: 'combo_triple_epic',  name: 'Vínculo Supremo+',  hits: 3, cost: 1, rarity: 'epic',   money: 600 }
	];
	for (const t of parentalBondTiers) {
		out.push({
			id: t.id,
			name: t.name,
			description: `Próximo ataque acerta ${t.hits === 2 ? 'duas' : 'três'} vezes.`,
			cost: t.cost,
			kind: 'combo',
			element: null,
			rarity: t.rarity,
			attackRepeat: t.hits - 1,
			price: { money: t.money }
		});
	}

	// Estamina: recupera mana neste turno
	const staminaTiers: Array<{ id: string; name: string; mana: number; cost: number; rarity: CardTemplate['rarity']; money: number }> = [
		{ id: 'energy_common', name: 'Estamina',    mana: 2, cost: 1, rarity: 'common', money: 150 },
		{ id: 'energy_rare',   name: 'Estamina II', mana: 3, cost: 1, rarity: 'rare',   money: 300 },
		{ id: 'energy_epic',   name: 'Estamina III',mana: 3, cost: 0, rarity: 'epic',   money: 500 }
	];
	for (const t of staminaTiers) {
		out.push({
			id: t.id,
			name: t.name,
			description: `Recupera ${t.mana} de energia neste turno.`,
			cost: t.cost,
			kind: 'energy',
			element: null,
			rarity: t.rarity,
			manaGain: t.mana,
			price: { money: t.money }
		});
	}

	// Splash: ataque leve que repõe a carta jogada.
	out.push({
		id: 'atk_splash',
		name: 'Splash',
		description: 'Causa 5 de dano de água. Compre 1 carta.',
		cost: 0,
		kind: 'attack',
		element: 'water',
		rarity: 'rare',
		tier: 1,
		damage: 5,
		drawCount: 1,
		price: { money: 220, element: { type: 'water', amount: 30 } }
	});

	// Relíquia: Forma Fantasma — usada uma vez na batalha, fora do deck
	out.push({
		id: 'relic_ghost_form',
		name: 'Forma Fantasma',
		description: 'Todo dano recebido neste turno é reduzido a 1.',
		cost: 0,
		kind: 'relic',
		element: 'ghost',
		rarity: 'epic',
		price: { money: 15000, element: { type: 'ghost', amount: 500 } }
	});

	// Carta de poder: Fúria (Berserk)
	out.push({
		id: 'power_berserk',
		name: 'Fúria',
		description: 'Ataque ×2 e defesa ÷2 por toda a batalha.',
		cost: 3,
		kind: 'power',
		element: null,
		rarity: 'epic',
		price: { money: 1500 }
	});

	// Carta de poder: Dragonize
	out.push({
		id: 'power_dragonize',
		name: 'Dragonize',
		description: 'Seus ataques comuns passam a ser do elemento dragão por toda a batalha.',
		cost: 3,
		kind: 'power',
		element: 'dragon',
		rarity: 'rare',
		price: { money: 100000, element: { type: 'dragon', amount: 2000 } }
	});

	// Carta de poder: Especializar
	out.push({
		id: 'power_specialize',
		name: 'Especializar',
		description: 'Iniciais ganham o tipo do seu pokémon ativo.',
		cost: 4,
		kind: 'power',
		element: null,
		rarity: 'rare',
		price: { money: 800 }
	});

	// Carta de poder: Choque Elétrico
	out.push({
		id: 'power_electric_shock',
		name: 'Choque Elétrico',
		description: 'Cada carta jogada causa 2 de dano elétrico.',
		cost: 2,
		kind: 'power',
		element: 'electric',
		rarity: 'rare',
		tier: 2,
		price: { money: 2200, element: { type: 'electric', amount: 350 } }
	});

	// Carta de debuff: Intimidate
	out.push({
		id: 'debuff_intimidate',
		name: 'Intimidate',
		description: 'Reduz o dano do inimigo em 50% pelos próximos 2 turnos.',
		cost: 2,
		kind: 'debuff',
		element: null,
		rarity: 'common',
		debuffAmount: 0.5,
		debuffDuration: 2,
		price: { money: 300 }
	});

	return out;
}

export const CATALOG: CardTemplate[] = buildCatalog();

export const SECRET_TEMPLATES: CardTemplate[] = [
	{
		id: 'atk_secret_judgement',
		name: 'Juízo Final',
		description: 'Causa 64 de dano elétrico.',
		cost: 1,
		kind: 'attack',
		element: 'electric',
		rarity: 'secret',
		damage: 64
	},
	{
		id: 'buff_secret_prophecy',
		name: 'Profecia',
		description: 'Aumenta o próximo ataque em 40.',
		cost: 0,
		kind: 'buff',
		element: 'psychic',
		rarity: 'secret',
		buffAmount: 40
	},
	{
		id: 'energy_secret_core',
		name: 'Núcleo Z',
		description: 'Recupera 5 de energia neste turno.',
		cost: 0,
		kind: 'energy',
		element: 'dragon',
		rarity: 'secret',
		manaGain: 5
	},
	{
		id: 'combo_secret_hydra',
		name: 'Hidra Prime',
		description: 'Próximo ataque acerta quatro vezes.',
		cost: 1,
		kind: 'combo',
		element: 'water',
		rarity: 'secret',
		attackRepeat: 3
	},
	{
		id: 'def_secret_aegis',
		name: 'Aegis Total',
		description: 'Ganha 60 de bloqueio.',
		cost: 1,
		kind: 'defense',
		element: 'ghost',
		rarity: 'secret',
		block: 60
	}
];

// Todos os templates (iniciais + compráveis) indexados por id.
export const CARD_TEMPLATES: Record<string, CardTemplate> = (() => {
	const map: Record<string, CardTemplate> = {};
	for (const t of [...STARTER_TEMPLATES, ...CATALOG, ...SECRET_TEMPLATES]) map[t.id] = t;
	return map;
})();

export function getTemplate(id: string): CardTemplate | undefined {
	return CARD_TEMPLATES[id];
}
