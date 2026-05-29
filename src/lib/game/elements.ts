import type { Element } from './types';

export const ELEMENT_LABEL: Record<Element, string> = {
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

export const ELEMENT_COLOR: Record<Element, string> = {
	fire: '#ef4444',
	water: '#3b82f6',
	grass: '#16a34a',
	electric: '#eab308',
	normal: '#a8a29e',
	fighting: '#c2410c',
	psychic: '#db2777',
	rock: '#a16207',
	ground: '#b45309',
	flying: '#60a5fa',
	bug: '#84cc16',
	poison: '#9333ea',
	ghost: '#6d28d9',
	ice: '#22d3ee',
	dragon: '#4f46e5'
};

export const ELEMENT_EMOJI: Record<Element, string> = {
	fire: '🔥',
	water: '💧',
	grass: '🌿',
	electric: '⚡',
	normal: '⭐',
	fighting: '🥊',
	psychic: '🔮',
	rock: '🪨',
	ground: '⛰️',
	flying: '🪶',
	bug: '🐛',
	poison: '☠️',
	ghost: '👻',
	ice: '❄️',
	dragon: '🐉'
};

export const KIND_ICON: Record<string, string> = {
	attack: '⚔️',
	defense: '🛡️',
	heal: '❤️',
	capture: '🔴',
	buff: '✨'
};
