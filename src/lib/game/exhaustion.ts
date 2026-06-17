import type { CapturedPokemon, NatureId, WorkPhase, WorkState } from './types';

// ── Nature → job tier ─────────────────────────────────────────────────────

export type JobTier = 'good' | 'bad' | 'neutral';

export const NATURE_JOB_TIER: Record<NatureId, JobTier> = {
	hardy: 'good', lonely: 'good', brave: 'good', adamant: 'good', bold: 'good', serious: 'good',
	naughty: 'bad', docile: 'bad', relaxed: 'bad', lax: 'bad', timid: 'bad', hasty: 'bad',
	quirky: 'neutral', sassy: 'neutral', modest: 'neutral'
};

export const TIER_MULTIPLIER: Record<JobTier, number> = { good: 3, bad: 0.5, neutral: 1 };

export function jobMultiplier(p: CapturedPokemon): number {
	const first = p.natures?.assigned[0];
	return first ? TIER_MULTIPLIER[NATURE_JOB_TIER[first]] : 1;
}

// ── Capacity ──────────────────────────────────────────────────────────────

// Estimated median gen-1 base HP: ~65. Target: neutral nature × median HP ≈ 8h.
// X = 8h_in_ms / 65 ≈ 443_077
export const EXHAUSTION_X = 443_077;
export const EXHAUSTION_MIN_CAPACITY_MS = 6 * 60 * 60 * 1000; // 6h floor
export const RECOVERY_HOURS = 4;

export function capacityMs(p: CapturedPokemon): number {
	const raw = p.maxHp * jobMultiplier(p) * EXHAUSTION_X;
	return Math.max(EXHAUSTION_MIN_CAPACITY_MS, raw);
}

// ── Create fresh state ────────────────────────────────────────────────────

export function freshWorkState(p: CapturedPokemon): WorkState {
	const cap = capacityMs(p);
	return { exhaustionRemainingMs: cap, phase: 'normal', rageRemainingMs: cap };
}

// ── Step function ─────────────────────────────────────────────────────────

export interface StepResult {
	next: WorkState;
	enteredRage: boolean;
	fled: boolean;
}

export function stepWork(
	w: WorkState,
	capacity: number,
	elapsedMs: number,
	onJob: boolean
): StepResult {
	let { exhaustionRemainingMs, phase, rageRemainingMs } = w;

	// Clamp to [0, capacity]
	exhaustionRemainingMs = clamp(exhaustionRemainingMs, 0, capacity);
	rageRemainingMs = clamp(rageRemainingMs, 0, capacity);

	let enteredRage = false;
	let fled = false;

	if (onJob) {
		if (phase === 'normal') {
			exhaustionRemainingMs -= elapsedMs;
			if (exhaustionRemainingMs <= 0) {
				const overflow = -exhaustionRemainingMs;
				exhaustionRemainingMs = 0;
				phase = 'rage';
				enteredRage = true;
				rageRemainingMs = capacity - overflow;
				// Continue into rage processing with the same elapsedMs
			}
		}

		if (phase === 'rage') {
			rageRemainingMs -= enteredRage ? 0 : elapsedMs;
			if (rageRemainingMs <= 0) {
				rageRemainingMs = 0;
				fled = true;
			}
		}
	} else {
		// Idle recovery
		const recoveryRate = capacity / (RECOVERY_HOURS * 3600 * 1000);
		const recovered = elapsedMs * recoveryRate;

		if (phase === 'normal') {
			exhaustionRemainingMs = Math.min(capacity, exhaustionRemainingMs + recovered);
		} else {
			// phase === 'rage'
			rageRemainingMs = Math.min(capacity, rageRemainingMs + recovered);
			if (rageRemainingMs >= capacity) {
				phase = 'normal';
				exhaustionRemainingMs = capacity;
			}
		}
	}

	const next: WorkState = {
		exhaustionRemainingMs: clamp(exhaustionRemainingMs, 0, capacity),
		phase,
		rageRemainingMs: clamp(rageRemainingMs, 0, capacity)
	};

	return { next, enteredRage, fled };
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}
