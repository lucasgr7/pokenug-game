import { describe, expect, it } from 'vitest';
import type { PokemonRelationship, CapturedPokemon } from '../types';
import {
	classifyEmoji,
	firstEmoji,
	keywordFallback,
	shouldRollEvent,
	applyRelationshipDelta,
	resolveUnlocks,
	recomputeMaxHp,
	countUnlockedThresholds,
	SENTIMENT_DELTA,
	UNLOCK_THRESHOLDS,
	HP_PER_UNLOCK,
	EVENT_COOLDOWN_MS,
	EVENT_CHANCE
} from '../relationship';

// ── classifyEmoji ──────────────────────────────────────────────────────────

describe('classifyEmoji', () => {
	it('classifica emoji de bom como good', () => {
		expect(classifyEmoji('❤️')).toBe('good');
		expect(classifyEmoji('😊')).toBe('good');
		expect(classifyEmoji('👍')).toBe('good');
	});

	it('classifica emoji de neutro como neutral', () => {
		expect(classifyEmoji('😐')).toBe('neutral');
		expect(classifyEmoji('🤔')).toBe('neutral');
	});

	it('classifica emoji de ruim como bad', () => {
		expect(classifyEmoji('😠')).toBe('bad');
		expect(classifyEmoji('💢')).toBe('bad');
	});

	it('retorna neutral para emojis desconhecidos', () => {
		expect(classifyEmoji('🦄')).toBe('neutral');
		expect(classifyEmoji('')).toBe('neutral');
	});
});

// ── firstEmoji ─────────────────────────────────────────────────────────────

describe('firstEmoji', () => {
	it('extrai o primeiro emoji de uma string', () => {
		expect(firstEmoji('❤️ obrigado')).toBe('❤️');
	});

	it('retorna undefined se não há emoji', () => {
		expect(firstEmoji('só texto')).toBeUndefined();
	});

	it('retorna undefined para string vazia', () => {
		expect(firstEmoji('')).toBeUndefined();
	});
});

// ── keywordFallback ────────────────────────────────────────────────────────

describe('keywordFallback', () => {
	it('detecta palavras-chave boas em pt-BR', () => {
		expect(keywordFallback('obrigado amigo')).toBe('good');
		expect(keywordFallback('Você é incrível')).toBe('good');
		expect(keywordFallback('Bom trabalho!')).toBe('good');
	});

	it('detecta palavras-chave ruins em pt-BR', () => {
		expect(keywordFallback('que chato')).toBe('bad');
		expect(keywordFallback('estou cansado')).toBe('bad');
		expect(keywordFallback('você é fraco')).toBe('bad');
	});

	it('retorna neutral para texto sem palavras-chave', () => {
		expect(keywordFallback('olá')).toBe('neutral');
		expect(keywordFallback('como vai?')).toBe('neutral');
	});
});

// ── shouldRollEvent ────────────────────────────────────────────────────────

describe('shouldRollEvent', () => {
	it('retorna false se estiver em cooldown', () => {
		const nowMs = 100_000;
		const lastEventAt = 90_000;
		expect(shouldRollEvent('idle', lastEventAt, nowMs, 100_000)).toBe(false);
	});

	it('retorna false se exhausted (não implementado)', () => {
		expect(shouldRollEvent('exhausted', 0, 100_000)).toBe(false);
	});

	it('usa rng injetada para decidir', () => {
		const always = () => 0;
		const never = () => 1;
		expect(shouldRollEvent('victory', 0, 100_000, 0, 0.5, always)).toBe(true);
		expect(shouldRollEvent('victory', 0, 100_000, 0, 0.5, never)).toBe(false);
	});

	it('usa chance padrão se chanceOverride não for fornecido', () => {
		// EVENT_CHANCE['victory'] = 0.40, rng = 0.3 → true
		expect(shouldRollEvent('victory', 0, 100_000, 0, undefined, () => 0.3)).toBe(true);
		// rng = 0.5 → false (0.5 >= 0.40)
		expect(shouldRollEvent('victory', 0, 100_000, 0, undefined, () => 0.5)).toBe(false);
	});
});

// ── countUnlockedThresholds ────────────────────────────────────────────────

describe('countUnlockedThresholds', () => {
	it('conta quantos thresholds foram atingidos', () => {
		expect(countUnlockedThresholds(0)).toBe(0);
		expect(countUnlockedThresholds(29)).toBe(0);
		expect(countUnlockedThresholds(30)).toBe(1);
		expect(countUnlockedThresholds(79)).toBe(1);
		expect(countUnlockedThresholds(80)).toBe(2);
		expect(countUnlockedThresholds(149)).toBe(2);
		expect(countUnlockedThresholds(150)).toBe(3);
		expect(countUnlockedThresholds(999)).toBe(3);
	});
});

// ── applyRelationshipDelta ────────────────────────────────────────────────

describe('applyRelationshipDelta', () => {
	function makeRel(pts: number): PokemonRelationship {
		return { points: pts, memories: [], lastEventAt: 0 };
	}

	it('adiciona pontos para sentimento good', () => {
		const rel = makeRel(0);
		applyRelationshipDelta(rel, 'good');
		expect(rel.points).toBe(SENTIMENT_DELTA.good);
	});

	it('adiciona pontos para sentimento neutral', () => {
		const rel = makeRel(0);
		applyRelationshipDelta(rel, 'neutral');
		expect(rel.points).toBe(SENTIMENT_DELTA.neutral);
	});

	it('subtrai pontos para sentimento bad', () => {
		const rel = makeRel(50);
		applyRelationshipDelta(rel, 'bad');
		expect(rel.points).toBe(50 + SENTIMENT_DELTA.bad);
	});

	it('não deixa points ficar abaixo de 0', () => {
		const rel = makeRel(0);
		applyRelationshipDelta(rel, 'bad');
		expect(rel.points).toBe(0);
	});

	it('retorna newlyUnlocked quando cruza threshold', () => {
		const rel = makeRel(UNLOCK_THRESHOLDS[0] - 1);
		const result = applyRelationshipDelta(rel, 'good');
		expect(result.newlyUnlocked).toEqual([0]);
	});

	it('não retorna unlock se não cruza threshold', () => {
		const rel = makeRel(0);
		const result = applyRelationshipDelta(rel, 'good');
		expect(result.newlyUnlocked).toEqual([]);
	});
});

// ── resolveUnlocks ─────────────────────────────────────────────────────────

describe('resolveUnlocks', () => {
	function makePkm(points: number, unlockedFlags: [boolean, boolean, boolean] = [false, false, false]): CapturedPokemon {
		return {
			id: 'test',
			speciesId: 25,
			name: 'Test',
			element: 'electric',
			maxHp: 100,
			currentHp: 100,
			capturedAt: 0,
			natures: {
				assigned: ['hardy', 'lonely', 'brave'],
				unlocked: [...unlockedFlags] as [boolean, boolean, boolean]
			},
			relationship: { points, memories: [], lastEventAt: 0 },
			baseMaxHp: 100
		};
	}

	it('desbloqueia primeira natureza ao atingir threshold T1', () => {
		const pkm = makePkm(UNLOCK_THRESHOLDS[0]);
		const result = resolveUnlocks(pkm);
		expect(result.hpGained).toBe(HP_PER_UNLOCK);
		expect(pkm.natures!.unlocked[0]).toBe(true);
		expect(pkm.hpBuffs).toBe(HP_PER_UNLOCK);
	});

	it('desbloqueia segunda natureza ao atingir threshold T2', () => {
		const pkm = makePkm(UNLOCK_THRESHOLDS[1], [true, false, false]);
		const result = resolveUnlocks(pkm);
		expect(result.hpGained).toBe(HP_PER_UNLOCK);
		expect(pkm.natures!.unlocked[1]).toBe(true);
	});

	it('desbloqueia terceira natureza ao atingir threshold T3', () => {
		const pkm = makePkm(UNLOCK_THRESHOLDS[2], [true, true, false]);
		const result = resolveUnlocks(pkm);
		expect(result.hpGained).toBe(HP_PER_UNLOCK);
		expect(pkm.natures!.unlocked[2]).toBe(true);
	});

	it('é idempotente: não concede HP repetido para mesmos thresholds', () => {
		const pkm = makePkm(UNLOCK_THRESHOLDS[2], [true, true, true]);
		pkm.hpBuffs = HP_PER_UNLOCK * 3;
		const result = resolveUnlocks(pkm);
		expect(result.hpGained).toBe(0);
		expect(pkm.hpBuffs).toBe(HP_PER_UNLOCK * 3);
	});

	it('concede HP cumulativo ao cruzar múltiplos thresholds de uma vez', () => {
		const pkm = makePkm(UNLOCK_THRESHOLDS[2]);
		const result = resolveUnlocks(pkm);
		expect(result.hpGained).toBe(HP_PER_UNLOCK * 3);
		expect(pkm.natures!.unlocked).toEqual([true, true, true]);
	});

	it('retorna 0 hpGained se não tem natures', () => {
		const pkm = makePkm(50);
		pkm.natures = undefined;
		const result = resolveUnlocks(pkm);
		expect(result.hpGained).toBe(0);
	});

	it('retorna 0 hpGained se não tem relationship', () => {
		const pkm = makePkm(50);
		pkm.relationship = undefined;
		const result = resolveUnlocks(pkm);
		expect(result.hpGained).toBe(0);
	});
});

// ── recomputeMaxHp ─────────────────────────────────────────────────────────

describe('recomputeMaxHp', () => {
	it('recalcula maxHp = baseMaxHp + hpBuffs', () => {
		const pkm: CapturedPokemon = {
			id: 'test', speciesId: 25, name: 'Test', element: 'electric',
			maxHp: 100, currentHp: 80, capturedAt: 0,
			baseMaxHp: 100, hpBuffs: 30
		};
		recomputeMaxHp(pkm);
		expect(pkm.maxHp).toBe(130);
	});

	it('clampa currentHp ≤ maxHp', () => {
		const pkm: CapturedPokemon = {
			id: 'test', speciesId: 25, name: 'Test', element: 'electric',
			maxHp: 100, currentHp: 90, capturedAt: 0,
			baseMaxHp: 100, hpBuffs: 30
		};
		recomputeMaxHp(pkm);
		expect(pkm.maxHp).toBe(130);
		expect(pkm.currentHp).toBe(90); // 90 < 130, no clamp
	});

	it('clampa currentHp quando excede novo maxHp (se hpBuffs reduzir)', () => {
		const pkm: CapturedPokemon = {
			id: 'test', speciesId: 25, name: 'Test', element: 'electric',
			maxHp: 100, currentHp: 100, capturedAt: 0,
			baseMaxHp: 80, hpBuffs: -20
		};
		recomputeMaxHp(pkm);
		expect(pkm.maxHp).toBe(60);
		expect(pkm.currentHp).toBe(60);
	});

	it('não faz nada se baseMaxHp é undefined', () => {
		const pkm: CapturedPokemon = {
			id: 'test', speciesId: 25, name: 'Test', element: 'electric',
			maxHp: 100, currentHp: 100, capturedAt: 0
		};
		recomputeMaxHp(pkm);
		expect(pkm.maxHp).toBe(100);
	});
});
