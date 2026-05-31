import type { CardTemplate, Element } from '$lib/game/types';
import { ATTACK_TIERS, DEF_TIERS, HEAL_TIERS } from './card-constants';

// Elementos principais usados na geração de cartas compráveis.
const MAIN_ELEMENTS: Element[] = ['fire', 'water', 'grass', 'electric', 'psychic', 'rock'];

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
	for (const el of MAIN_ELEMENTS) {
		for (const t of ATTACK_TIERS) {
			out.push({
				id: `atk_${el}_${t.damage}`,
				name: `Golpe de ${elementLabel[el]} ${t.damage}`,
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
		description: 'Causa 28 de dano. Sem elemento.',
		cost: 4,
		kind: 'attack',
		element: null,
		rarity: 'epic',
		tier: 2,
		damage: 28,
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

	return out;
}

export const CATALOG: CardTemplate[] = buildCatalog();

// Todos os templates (iniciais + compráveis) indexados por id.
export const CARD_TEMPLATES: Record<string, CardTemplate> = (() => {
	const map: Record<string, CardTemplate> = {};
	for (const t of [...STARTER_TEMPLATES, ...CATALOG]) map[t.id] = t;
	return map;
})();

export function getTemplate(id: string): CardTemplate | undefined {
	return CARD_TEMPLATES[id];
}
