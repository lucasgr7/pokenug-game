import type { CardTemplate, Element } from '$lib/game/types';

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
	const atkTiers: Array<{ damage: number; cost: number; rarity: CardTemplate['rarity']; money: number; elemAmount: number }> = [
		{ damage: 8, cost: 1, rarity: 'common', money: 440, elemAmount: 100 },
		{ damage: 12, cost: 1, rarity: 'common', money: 860, elemAmount: 300 },
		{ damage: 18, cost: 2, rarity: 'rare', money: 1200, elemAmount: 900 },
		{ damage: 25, cost: 3, rarity: 'epic', money: 1700, elemAmount: 2500 }
	];
	for (const el of MAIN_ELEMENTS) {
		for (const t of atkTiers) {
			out.push({
				id: `atk_${el}_${t.damage}`,
				name: `Golpe de ${elementLabel[el]} ${t.damage}`,
				description: `Causa ${t.damage} de dano de ${elementLabel[el].toLowerCase()}.`,
				cost: t.cost,
				kind: 'attack',
				element: el,
				rarity: t.rarity,
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
		damage: 28,
		price: { money: 180 }
	});

	// Defesas.
	const defTiers: Array<{ block: number; cost: number; rarity: CardTemplate['rarity']; money: number }> = [
		{ block: 5, cost: 1, rarity: 'common', money: 350 },
		{ block: 8, cost: 1, rarity: 'common', money: 550 },
		{ block: 12, cost: 2, rarity: 'rare', money: 950 }
	];
	for (const t of defTiers) {
		out.push({
			id: `def_${t.block}`,
			name: `Escudo ${t.block}`,
			description: `Ganha ${t.block} de bloqueio.`,
			cost: t.cost,
			kind: 'defense',
			element: null,
			rarity: t.rarity,
			block: t.block,
			price: { money: t.money }
		});
	}

	// Cura.
	const healTiers: Array<{ heal: number; cost: number; rarity: CardTemplate['rarity']; money: number }> = [
		{ heal: 8, cost: 1, rarity: 'common', money: 450 },
		{ heal: 15, cost: 2, rarity: 'rare', money: 950 },
		{ heal: 25, cost: 3, rarity: 'epic', money: 1650 }
	];
	for (const t of healTiers) {
		out.push({
			id: `heal_${t.heal}`,
			name: `Cura ${t.heal}`,
			description: `Restaura ${t.heal} de HP do pokémon ativo.`,
			cost: t.cost,
			kind: 'heal',
			element: null,
			rarity: t.rarity,
			healHp: t.heal,
			price: { money: t.money }
		});
	}

	// Pokébolas aprimoradas.
	const ballTiers: Array<{ id: string; bonus: number; rarity: CardTemplate['rarity']; money: number }> = [
		{ id: 'pokeball_great', bonus: 0.15, rarity: 'common', money: 600 },
		{ id: 'pokeball_ultra', bonus: 0.3, rarity: 'rare', money: 1200 },
		{ id: 'pokeball_master', bonus: 0.5, rarity: 'epic', money: 2000 }
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
			captureBonus: t.bonus,
			price: { money: t.money }
		});
	}

	// Buffs de próximo dano.
	const buffTiers: Array<{ next: number; cost: number; rarity: CardTemplate['rarity']; money: number }> = [
		{ next: 8, cost: 1, rarity: 'common', money: 50 },
		{ next: 15, cost: 2, rarity: 'rare', money: 100 }
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
			buffAmount: t.next,
			price: { money: t.money }
		});
	}

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
