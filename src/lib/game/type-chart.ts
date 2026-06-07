import { t } from '$lib/i18n';
import type { Element } from './types';

export type Effectiveness = 0.5 | 1 | 2;

export interface ElementMatchup {
	element: Element;
	strengths: Element[];
	weaknesses: Element[];
}

export interface ElementInteraction {
	attacker: Element;
	defender: Element;
	multiplier: Effectiveness;
	strongAgainst: boolean;
	weakAgainst: boolean;
	modifierText: string;
	shortLabel: string;
}

const MATCHUPS: Record<Element, ElementMatchup> = {
	fire: { element: 'fire', strengths: ['grass', 'bug', 'ice'], weaknesses: ['water', 'rock', 'ground'] },
	water: { element: 'water', strengths: ['fire', 'rock', 'ground'], weaknesses: ['grass', 'electric'] },
	grass: { element: 'grass', strengths: ['water', 'rock', 'ground'], weaknesses: ['fire', 'bug', 'ice', 'poison', 'flying'] },
	electric: { element: 'electric', strengths: ['water', 'flying'], weaknesses: ['ground'] },
	normal: { element: 'normal', strengths: [], weaknesses: ['fighting'] },
	fighting: { element: 'fighting', strengths: ['normal', 'rock', 'ice'], weaknesses: ['psychic', 'flying'] },
	psychic: { element: 'psychic', strengths: ['fighting', 'poison'], weaknesses: ['bug', 'ghost'] },
	rock: { element: 'rock', strengths: ['fire', 'flying', 'bug', 'ice'], weaknesses: ['water', 'grass', 'fighting', 'ground'] },
	ground: { element: 'ground', strengths: ['fire', 'electric', 'poison', 'rock'], weaknesses: ['water', 'grass', 'ice'] },
	flying: { element: 'flying', strengths: ['grass', 'fighting', 'bug'], weaknesses: ['electric', 'rock', 'ice'] },
	bug: { element: 'bug', strengths: ['grass', 'psychic'], weaknesses: ['fire', 'rock', 'flying'] },
	poison: { element: 'poison', strengths: ['grass'], weaknesses: ['ground', 'psychic'] },
	ghost: { element: 'ghost', strengths: ['psychic', 'ghost'], weaknesses: ['ghost'] },
	ice: { element: 'ice', strengths: ['grass', 'ground', 'flying', 'dragon'], weaknesses: ['fire', 'fighting', 'rock'] },
	dragon: { element: 'dragon', strengths: ['dragon'], weaknesses: ['ice', 'dragon'] }
};

export function getElementMatchup(element: Element): ElementMatchup {
	return MATCHUPS[element];
}

export function getElementInteraction(attacker: Element, defender: Element): ElementInteraction {
	const matchup = getElementMatchup(attacker);
	const strongAgainst = matchup.strengths.includes(defender);
	const weakAgainst = matchup.weaknesses.includes(defender);
	const multiplier: Effectiveness = strongAgainst ? 2 : weakAgainst ? 0.5 : 1;

	return {
		attacker,
		defender,
		multiplier,
		strongAgainst,
		weakAgainst,
		modifierText: strongAgainst ? t('typeChart.plus100') : weakAgainst ? t('typeChart.minus50') : '',
		shortLabel: strongAgainst ? t('typeChart.superEffective') : weakAgainst ? t('typeChart.notVery') : ''
	};
}

export function effectiveness(attacker: Element, defender: Element): Effectiveness {
	return getElementInteraction(attacker, defender).multiplier;
}

export function effectivenessLabel(value: Effectiveness): string {
	if (value === 2) return t('typeChart.superEffective');
	if (value === 0.5) return t('typeChart.notVery');
	return '';
}

export function interactionLabel(attacker: Element, defender: Element): string {
	return getElementInteraction(attacker, defender).shortLabel;
}
