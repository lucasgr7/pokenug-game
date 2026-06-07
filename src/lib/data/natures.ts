import { shuffle } from '$lib/utils/rng';
import type { CapturedPokemon, NatureId, PokemonNatures } from '$lib/game/types';

// Custo progressivo por slot: 1º, 2º e último (unlock é sequencial).
export const NATURE_UNLOCK_COSTS = import.meta.env.DEV
	? [1, 1, 1]
	: [250_000, 500_000, 1_000_000];

export function natureUnlockCost(index: number): number {
	return NATURE_UNLOCK_COSTS[index] ?? NATURE_UNLOCK_COSTS[NATURE_UNLOCK_COSTS.length - 1];
}

export const NATURE_IDS: NatureId[] = [
	'hardy', 'lonely', 'brave', 'adamant', 'naughty', 'bold', 'docile',
	'relaxed', 'lax', 'timid', 'serious', 'hasty', 'quirky', 'sassy', 'modest'
];

export interface NatureMeta {
	id: NatureId;
	namePt: string;
	nameEn: string;
	description: string;
}

export const NATURES: Record<NatureId, NatureMeta> = {
	hardy:    { id: 'hardy',    namePt: 'Hardy',     nameEn: 'Hardy',     description: 'Começa com 6 cartas (a extra é de outro tipo).' },
	lonely:   { id: 'lonely',   namePt: 'Solitário', nameEn: 'Lonely',   description: 'Recupera 3 de HP no início de cada turno.' },
	brave:    { id: 'brave',    namePt: 'Bravo',     nameEn: 'Brave',    description: 'Cartas do seu tipo custam 1 a menos.' },
	adamant:  { id: 'adamant',  namePt: 'Adamante',  nameEn: 'Adamant',  description: 'Cartas do seu tipo são compradas primeiro.' },
	naughty:  { id: 'naughty',  namePt: 'Travesso',  nameEn: 'Naughty',  description: 'Começa com +1 de mana.' },
	bold:     { id: 'bold',     namePt: 'Ousado',    nameEn: 'Bold',     description: 'Escudo dobra; cartas de escudo custam +1.' },
	docile:   { id: 'docile',   namePt: 'Dócil',     nameEn: 'Docile',   description: '+30 de HP máximo; começa com 2 de mana.' },
	relaxed:  { id: 'relaxed',  namePt: 'Relaxado',  nameEn: 'Relaxed',  description: '+20 de HP; mão máxima reduzida em 1.' },
	lax:      { id: 'lax',      namePt: 'Folgado',   nameEn: 'Lax',      description: '-10 de HP; começa com +4 de mana.' },
	timid:    { id: 'timid',    namePt: 'Tímido',    nameEn: 'Timid',    description: 'Cartas de outro tipo custam +1; não exaurem.' },
	serious:  { id: 'serious',  namePt: 'Sério',     nameEn: 'Serious',  description: '+1 de Mana máxima a partir do turno 4.' },
	hasty:    { id: 'hasty',    namePt: 'Apressado', nameEn: 'Hasty',    description: 'A 1ª carta jogada na batalha custa 0.' },
	quirky:   { id: 'quirky',   namePt: 'Excêntrico',nameEn: 'Quirky',   description: 'A cada 3 cartas exauridas, +1 de mana.' },
	sassy:    { id: 'sassy',    namePt: 'Audacioso', nameEn: 'Sassy',    description: 'Mana restante vira 5 de escudo no fim do turno.' },
	modest:   { id: 'modest',   namePt: 'Modesto',   nameEn: 'Modest',   description: 'Mana não gasta vira +1 de mana no turno seguinte.' }
};

export function rollNatures(): PokemonNatures {
	const pool = shuffle(NATURE_IDS);
	return {
		assigned: [pool[0], pool[1], pool[2]],
		unlocked: [false, false, false]
	};
}

export function ensurePokemonNatures(p: CapturedPokemon): boolean {
	if (p.natures) return false;
	p.natures = rollNatures();
	return true;
}
