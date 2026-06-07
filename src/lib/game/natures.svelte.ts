import { addPokemon } from '$lib/db/pokemon';
import { ensurePokemonNatures, natureUnlockCost } from '$lib/data/natures';
import { game, spendElementPoints, getElementPoints } from './state.svelte';
import type { CapturedPokemon } from './types';

export function canUnlockNature(p: CapturedPokemon, index: number): boolean {
	if (!p.natures) return false;
	if (p.natures.unlocked[index]) return false;
	if (index > 0 && !p.natures.unlocked[index - 1]) return false;
	return true;
}

export function natureAffordable(p: CapturedPokemon, index: number): boolean {
	return getElementPoints(p.element) >= natureUnlockCost(index);
}

export async function unlockNature(pokemonId: string, index: number): Promise<boolean> {
	const p = game.roster.find((p) => p.id === pokemonId);
	if (!p) return false;
	if (!canUnlockNature(p, index)) return false;
	ensurePokemonNatures(p);
	if (!spendElementPoints(p.element, natureUnlockCost(index))) return false;
	p.natures!.unlocked[index] = true;
	await addPokemon($state.snapshot(p));
	return true;
}
