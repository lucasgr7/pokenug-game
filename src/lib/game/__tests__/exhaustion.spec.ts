import { describe, expect, it } from 'vitest';
import type { CapturedPokemon, WorkState } from '../types';
import {
	NATURE_JOB_TIER,
	TIER_MULTIPLIER,
	EXHAUSTION_X,
	EXHAUSTION_MIN_CAPACITY_MS,
	RECOVERY_HOURS,
	jobMultiplier,
	capacityMs,
	freshWorkState,
	stepWork
} from '../exhaustion';

// ── Nature → job tier ─────────────────────────────────────────────────────

describe('jobMultiplier', () => {
	function makePkm(assigned0: string, maxHp = 100): CapturedPokemon {
		return {
			id: 't', speciesId: 1, name: 'T', element: 'normal',
			maxHp, currentHp: maxHp, capturedAt: 0,
			natures: { assigned: [assigned0 as any, 'docile', 'lax'], unlocked: [false, false, false] }
		};
	}

	it('good natures → 3', () => {
		expect(jobMultiplier(makePkm('hardy'))).toBe(3);
		expect(jobMultiplier(makePkm('lonely'))).toBe(3);
		expect(jobMultiplier(makePkm('brave'))).toBe(3);
		expect(jobMultiplier(makePkm('adamant'))).toBe(3);
		expect(jobMultiplier(makePkm('bold'))).toBe(3);
		expect(jobMultiplier(makePkm('serious'))).toBe(3);
	});

	it('bad natures → 0.5', () => {
		expect(jobMultiplier(makePkm('naughty'))).toBe(0.5);
		expect(jobMultiplier(makePkm('docile'))).toBe(0.5);
		expect(jobMultiplier(makePkm('relaxed'))).toBe(0.5);
		expect(jobMultiplier(makePkm('lax'))).toBe(0.5);
		expect(jobMultiplier(makePkm('timid'))).toBe(0.5);
		expect(jobMultiplier(makePkm('hasty'))).toBe(0.5);
	});

	it('neutral natures → 1', () => {
		expect(jobMultiplier(makePkm('quirky'))).toBe(1);
		expect(jobMultiplier(makePkm('sassy'))).toBe(1);
		expect(jobMultiplier(makePkm('modest'))).toBe(1);
	});

	it('sem natures → 1', () => {
		const p: CapturedPokemon = {
			id: 't', speciesId: 1, name: 'T', element: 'normal',
			maxHp: 100, currentHp: 100, capturedAt: 0
		};
		expect(jobMultiplier(p)).toBe(1);
	});
});

// ── capacityMs ────────────────────────────────────────────────────────────

describe('capacityMs', () => {
	function makePkm(assigned0: string, maxHp: number): CapturedPokemon {
		return {
			id: 't', speciesId: 1, name: 'T', element: 'normal',
			maxHp, currentHp: maxHp, capturedAt: 0,
			natures: { assigned: [assigned0 as any, 'docile', 'lax'], unlocked: [false, false, false] }
		};
	}

	it('neutral nature at median HP (~65) ≈ 8h', () => {
		const cap = capacityMs(makePkm('quirky', 65));
		const expected = 65 * 1 * EXHAUSTION_X;
		expect(cap).toBeCloseTo(expected, -2); // within ~100ms
		expect(cap).toBeGreaterThanOrEqual(EXHAUSTION_MIN_CAPACITY_MS);
	});

	it('good nature lasts longer', () => {
		const neutral = capacityMs(makePkm('quirky', 100));
		const good = capacityMs(makePkm('hardy', 100));
		expect(good).toBeCloseTo(neutral * 3, -2);
	});

	it('bad nature floors at minimum', () => {
		const cap = capacityMs(makePkm('naughty', 30));
		expect(cap).toBe(EXHAUSTION_MIN_CAPACITY_MS);
	});

	it('bad nature above threshold is above floor', () => {
		const cap = capacityMs(makePkm('naughty', 100));
		expect(cap).toBeGreaterThan(EXHAUSTION_MIN_CAPACITY_MS);
	});
});

// ── freshWorkState ────────────────────────────────────────────────────────

describe('freshWorkState', () => {
	it('inicia com exhaustion cheio, normal, rage cheio', () => {
		const p: CapturedPokemon = {
			id: 't', speciesId: 1, name: 'T', element: 'normal',
			maxHp: 100, currentHp: 100, capturedAt: 0,
			natures: { assigned: ['hardy', 'docile', 'lax'], unlocked: [false, false, false] }
		};
		const ws = freshWorkState(p);
		const cap = capacityMs(p);
		expect(ws.exhaustionRemainingMs).toBe(cap);
		expect(ws.phase).toBe('normal');
		expect(ws.rageRemainingMs).toBe(cap);
	});
});

// ── stepWork ──────────────────────────────────────────────────────────────

describe('stepWork', () => {
	const CAP = 100_000;

	function makeState(overrides: Partial<WorkState> = {}): WorkState {
		return { exhaustionRemainingMs: CAP, phase: 'normal', rageRemainingMs: CAP, ...overrides };
	}

	it('no trabalho: depleta exhaustion', () => {
		const w = makeState();
		const r = stepWork(w, CAP, 10_000, true);
		expect(r.next.exhaustionRemainingMs).toBe(CAP - 10_000);
		expect(r.next.phase).toBe('normal');
		expect(r.enteredRage).toBe(false);
		expect(r.fled).toBe(false);
	});

	it('no trabalho: normal→rage no limite', () => {
		const w = makeState({ exhaustionRemainingMs: 5_000 });
		const r = stepWork(w, CAP, 10_000, true);
		expect(r.next.exhaustionRemainingMs).toBe(0);
		expect(r.next.phase).toBe('rage');
		expect(r.enteredRage).toBe(true);
		// overflow: 10_000 - 5_000 = 5_000; rage = CAP - 5_000
		expect(r.next.rageRemainingMs).toBe(CAP - 5_000);
	});

	it('no trabalho: rage depleta rageRemainingMs', () => {
		const w = makeState({ phase: 'rage', exhaustionRemainingMs: 0, rageRemainingMs: 50_000 });
		const r = stepWork(w, CAP, 10_000, true);
		expect(r.next.rageRemainingMs).toBe(40_000);
		expect(r.next.phase).toBe('rage');
		expect(r.fled).toBe(false);
	});

	it('no trabalho: rage→fled quando esgota', () => {
		const w = makeState({ phase: 'rage', exhaustionRemainingMs: 0, rageRemainingMs: 5_000 });
		const r = stepWork(w, CAP, 10_000, true);
		expect(r.next.rageRemainingMs).toBe(0);
		expect(r.next.phase).toBe('rage');
		expect(r.fled).toBe(true);
	});

	it('no trabalho: cascade normal→rage→fled em um passo (elapsed grande)', () => {
		// exhaustion sobra 3s, rage capacity é 100s, elapsed é 200s
		const w = makeState({ exhaustionRemainingMs: 3_000 });
		const r = stepWork(w, CAP, 200_000, true);
		expect(r.next.exhaustionRemainingMs).toBe(0);
		expect(r.next.rageRemainingMs).toBe(0);
		expect(r.next.phase).toBe('rage');
		expect(r.enteredRage).toBe(true);
		expect(r.fled).toBe(true);
	});

	it('ocioso: recupera exhaustion normal', () => {
		const w = makeState({ exhaustionRemainingMs: 50_000 });
		// 1 hora de recuperação (menos que as 2h necessárias para encher 50k)
		const r = stepWork(w, CAP, 3600 * 1000, false);
		expect(r.next.exhaustionRemainingMs).toBeGreaterThan(50_000);
		expect(r.next.exhaustionRemainingMs).toBeLessThan(CAP);
		expect(r.next.phase).toBe('normal');
	});

	it('ocioso: rage recupera e volta a normal ao encher', () => {
		const w = makeState({ phase: 'rage', exhaustionRemainingMs: 0, rageRemainingMs: 1_000 });
		// recuperação total: rage enche, vira normal, exhaustion enche
		const r = stepWork(w, CAP, RECOVERY_HOURS * 3600 * 1000, false);
		expect(r.next.rageRemainingMs).toBe(CAP);
		expect(r.next.phase).toBe('normal');
		expect(r.next.exhaustionRemainingMs).toBe(CAP);
	});

	it('ocioso (normal): não entra em rage', () => {
		const w = makeState({ exhaustionRemainingMs: 0 });
		const r = stepWork(w, CAP, 10_000, false);
		expect(r.next.phase).toBe('normal');
		expect(r.next.exhaustionRemainingMs).toBeGreaterThan(0);
		expect(r.enteredRage).toBe(false);
	});

	it('não depleta nada se idle com full exhaustion', () => {
		const w = makeState();
		const r = stepWork(w, CAP, 10_000, false);
		expect(r.next.exhaustionRemainingMs).toBe(CAP); // já cheio
		expect(r.next.phase).toBe('normal');
	});

	it('clampa valores negativos a 0', () => {
		const w = makeState({ exhaustionRemainingMs: -100, rageRemainingMs: -200 });
		const r = stepWork(w, CAP, 0, false);
		expect(r.next.exhaustionRemainingMs).toBe(0);
		expect(r.next.rageRemainingMs).toBe(0);
	});

	it('clampa valores acima de capacity', () => {
		const w = makeState({ exhaustionRemainingMs: CAP + 1000, rageRemainingMs: CAP + 2000 });
		const r = stepWork(w, CAP, 0, false);
		expect(r.next.exhaustionRemainingMs).toBe(CAP);
		expect(r.next.rageRemainingMs).toBe(CAP);
	});
});
