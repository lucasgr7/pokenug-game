import type { Element } from './types';

export type Effectiveness = 0.5 | 1 | 2;

// Pares super efetivos (2x), matchups clássicos da gen 1 simplificados.
const SUPER_EFFECTIVE: Array<[Element, Element]> = [
	['fire', 'grass'],
	['fire', 'bug'],
	['fire', 'ice'],
	['water', 'fire'],
	['water', 'rock'],
	['water', 'ground'],
	['grass', 'water'],
	['grass', 'rock'],
	['grass', 'ground'],
	['electric', 'water'],
	['electric', 'flying'],
	['fighting', 'normal'],
	['fighting', 'rock'],
	['fighting', 'ice'],
	['psychic', 'fighting'],
	['psychic', 'poison'],
	['rock', 'fire'],
	['rock', 'flying'],
	['rock', 'bug'],
	['rock', 'ice'],
	['ground', 'fire'],
	['ground', 'electric'],
	['ground', 'poison'],
	['ground', 'rock'],
	['ice', 'grass'],
	['ice', 'ground'],
	['ice', 'flying'],
	['ice', 'dragon'],
	['bug', 'grass'],
	['bug', 'psychic'],
	['poison', 'grass'],
	['ghost', 'psychic'],
	['ghost', 'ghost'],
	['dragon', 'dragon']
];

const key = (a: Element, d: Element) => `${a}>${d}`;

const superSet = new Set(SUPER_EFFECTIVE.map(([a, d]) => key(a, d)));

// Não muito efetivo (0.5x): inverso dos pares super efetivos, ignorando os que
// já são super efetivos (ex.: ghost>ghost, dragon>dragon).
const notVerySet = new Set<string>();
for (const [a, d] of SUPER_EFFECTIVE) {
	const inverse = key(d, a);
	if (!superSet.has(inverse)) notVerySet.add(inverse);
}

export function effectiveness(attacker: Element, defender: Element): Effectiveness {
	const k = key(attacker, defender);
	if (superSet.has(k)) return 2;
	if (notVerySet.has(k)) return 0.5;
	return 1;
}

export function effectivenessLabel(value: Effectiveness): string {
	if (value === 2) return 'Super efetivo!';
	if (value === 0.5) return 'Pouco efetivo...';
	return '';
}
