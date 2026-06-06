import type { CapturedPokemon, Region } from '$lib/game/types';
import { shuffle } from '$lib/utils/rng';

export const MISSINGNO_MAX_HP = 600;
export const MISSINGNO_ACT1_DAMAGE = 9999;
export const MISSINGNO_TURN_DAMAGE = 9999;
export const AT_STAKE_COUNT = 20;
export const ACT2_DEFEAT_HOLD_MS = 5000;
export const PICK_COUNT = 3;
export const MISSINGNO_REGION: Region = {
	id: 'missingno',
	name: '???',
	description: 'Uma distorção nos dados.',
	pool: [],
	bossPool: [0, 0, 0],
	requiredDefeats: 0,
	unlockAfter: null,
	color: '#1a0033',
	emoji: '👾',
	types: ['ghost'],
	bossType: 'ghost',
	bossName: 'MissingNo.',
	bossDesc: 'Um erro na matrix.'
};

export function selectAtStake(roster: CapturedPokemon[]): CapturedPokemon[] {
	const sorted = [...roster].sort((a, b) => b.maxHp - a.maxHp);
	const top = sorted.slice(0, AT_STAKE_COUNT);
	return shuffle(top);
}
