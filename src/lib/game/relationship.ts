import type {
	CapturedPokemon,
	PokemonMemory,
	PokemonRelationship,
	RelationshipTrigger,
	Sentiment
} from './types';
import { EVENT_REGISTRY } from './relationship/index';
import type { EventAnswerDef, EventContext, EventDefinition } from './relationship/index';

// ── Balance constants ─────────────────────────────────────────────────────

export const SENTIMENT_DELTA: Record<Sentiment, number> = { good: 10, neutral: 3, bad: -6 };
export const UNLOCK_THRESHOLDS = [30, 80, 150] as const;
export const HP_PER_UNLOCK = 15;
export const ALERT_TIMER_MS = 5 * 60_000;
export const MAX_ACTIVE_EVENTS = 3;
export const EVENT_COOLDOWN_MS = 10 * 60_000;
export const MAX_INPUT_CHARS = 50;
export const MEMORIES_SENT_TO_LLM = 3;

export const EVENT_CHANCE: Record<RelationshipTrigger, number> = {
	victory: 0.40, defeat: 0.60, idle: 0.30, newDay: 0.70, exhausted: 0
};

// ── Emoji classification ──────────────────────────────────────────────────

const EMOJI_SENTIMENT_MAP: Record<string, Sentiment> = {
	'❤️': 'good', '💖': 'good', '😊': 'good', '😄': 'good', '😁': 'good', '🥰': 'good',
	'😍': 'good', '👍': 'good', '🙌': 'good', '🎉': 'good', '💪': 'good', '🔥': 'good',
	'✨': 'good', '🌟': 'good', '💯': 'good', '👏': 'good', '😌': 'good', '🥳': 'good',
	'😤': 'bad', '😠': 'bad', '😡': 'bad', '💢': 'bad', '👎': 'bad', '😢': 'bad',
	'😭': 'bad', '😞': 'bad', '😔': 'bad', '😒': 'bad', '😏': 'bad', '😣': 'bad',
	'😖': 'bad', '😫': 'bad', '🤬': 'bad', '💀': 'bad', '😑': 'bad', '😐': 'neutral',
	'🤔': 'neutral', '😶': 'neutral', '🤷': 'neutral', '😮': 'neutral', '😲': 'neutral',
	'🤨': 'neutral', '😕': 'neutral', '🙄': 'neutral', '❓': 'neutral', '💤': 'neutral',
	'😴': 'neutral', '🤗': 'good', '🥺': 'neutral', '😳': 'neutral',
	'😇': 'good', '😈': 'bad', '👿': 'bad', '💔': 'bad',
	'❣️': 'good', '💕': 'good', '💗': 'good', '💛': 'good', '💚': 'good',
	'💙': 'good', '💜': 'good', '🩷': 'good', '🧡': 'good',
};

export function classifyEmoji(emoji: string): Sentiment {
	return EMOJI_SENTIMENT_MAP[emoji] ?? 'neutral';
}

// emoji regex that matches most emoji sequences (including skin tones, ZWJ)
const EMOJI_RE = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji}\u200D\p{Emoji})/gu;

export function firstEmoji(text: string): string | undefined {
	const matches = text.match(EMOJI_RE);
	if (matches && matches.length > 0) {
		// Return first complete emoji grapheme cluster
		return matches[0];
	}
	// Fallback: try Intl.Segmenter for grapheme-aware extraction
	if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
		try {
			const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
			const segments = [...segmenter.segment(text)];
			for (const seg of segments) {
				if (seg.segment.match(EMOJI_RE)) return seg.segment;
			}
		}
		catch { /* ignore */ }
	}
	return undefined;
}

// ── Offline keyword fallback (pt-BR) ──────────────────────────────────────

function normalize(str: string): string {
	return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const GOOD_KEYWORDS = ['obrigado', 'obrigada', 'bom', 'boa', 'legal', 'incrivel', 'parabens',
	'perfeito', 'amo', 'adoro', 'gosto', 'maravilha', 'show', 'otimo', 'excelente',
	'carinho', 'amigo', 'amiga', 'descansar', 'descansa', 'relaxar', 'forca', 'torcendo',
	'orgulho', 'orgulhosa', 'juntos'];

const BAD_KEYWORDS = ['ruim', 'pessimo', 'horrivel', 'odeio', 'detesto', 'cansado', 'cansaco',
	'chato', 'chata', 'para', 'pare', 'chega', 'basta', 'nao', 'nunca', 'fraco', 'fraca',
	'medo', 'medroso', 'covarde', 'lento', 'lerdo', 'idiota', 'burro', 'droga'];

export function keywordFallback(message: string): Sentiment {
	const lower = normalize(message);
	for (const kw of GOOD_KEYWORDS) {
		if (lower.includes(kw)) return 'good';
	}
	for (const kw of BAD_KEYWORDS) {
		if (lower.includes(kw)) return 'bad';
	}
	return 'neutral';
}

// ── Event roll logic ──────────────────────────────────────────────────────

export function shouldRollEvent(
	trigger: RelationshipTrigger,
	lastEventAt: number,
	nowMs: number,
	cooldownMs: number = EVENT_COOLDOWN_MS,
	chanceOverride?: number,
	rng: () => number = Math.random
): boolean {
	if (trigger === 'exhausted') return false; // not wired yet
	if (nowMs - lastEventAt < cooldownMs) return false;
	const chance = chanceOverride ?? EVENT_CHANCE[trigger];
	return rng() < chance;
}

// ── Event selection pipeline ──────────────────────────────────────────────

export function eligibleEvents(
	trigger: RelationshipTrigger,
	ctx: EventContext,
	registry?: EventDefinition[]
): EventDefinition[] {
	const reg = registry ?? EVENT_REGISTRY;
	return reg.filter(
		(def) => def.trigger === trigger && (def.condition?.(ctx) ?? true)
	);
}

export function pickWeightedEvent(
	candidates: EventDefinition[],
	rng: () => number = Math.random
): EventDefinition | undefined {
	if (candidates.length === 0) return undefined;
	const totalWeight = candidates.reduce((sum, d) => sum + (d.weight ?? 1), 0);
	let roll = rng() * totalWeight;
	for (const def of candidates) {
		roll -= def.weight ?? 1;
		if (roll < 0) return def;
	}
	return candidates[candidates.length - 1];
}

// ── Delta application ─────────────────────────────────────────────────────

export function countUnlockedThresholds(points: number): number {
	let count = 0;
	for (const t of UNLOCK_THRESHOLDS) {
		if (points >= t) count++;
		else break;
	}
	return count;
}

// ── Habituação (retornos decrescentes) ────────────────────────────────────
// Repetir a mesma fala/tom cansa o Pokémon: o ganho cai e pode ficar negativo.

export const HABIT_WINDOW = 5; // quantas interações recentes contam
export const REPEAT_STEP = 0.6; // penalidade por frase idêntica recente
export const SENTIMENT_STEP = 0.2; // penalidade por repetir o mesmo tom
export const MIN_SENTIMENT_MULT = 0.3; // piso para o decaimento por tom

export function normalizeMessage(msg: string): string {
	return msg
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Quanto a interação rende, dado o histórico recente. Só ganhos positivos são
 * reduzidos pela habituação — respostas neutras/ruins não são "aliviadas".
 * Repetir a MESMA frase derruba rápido (e pode irritar); repetir o mesmo TOM
 * variando as palavras tem decaimento mais suave.
 */
export function computeAffinityDelta(
	sentiment: Sentiment,
	message: string,
	recentMemories: PokemonMemory[]
): number {
	const base = SENTIMENT_DELTA[sentiment];
	if (base <= 0) return base;

	const window = recentMemories.slice(-HABIT_WINDOW);
	const norm = normalizeMessage(message);

	const sameMessage =
		norm.length > 0
			? window.filter((m) => normalizeMessage(m.playerMessage) === norm).length
			: 0;
	const sameSentiment = window.filter((m) => m.sentiment === sentiment).length;

	const repeatMult = 1 - REPEAT_STEP * sameMessage; // 1 → 0.4 → -0.2 → ...
	const sentimentMult = Math.max(MIN_SENTIMENT_MULT, 1 - SENTIMENT_STEP * sameSentiment);

	return Math.round(base * Math.min(repeatMult, sentimentMult));
}

export function applyRelationshipDelta(
	rel: PokemonRelationship,
	sentiment: Sentiment,
	message = '',
	recentMemories: PokemonMemory[] = rel.memories
): { points: number; newlyUnlocked: number[]; delta: number } {
	const prevPoints = rel.points;
	const delta = computeAffinityDelta(sentiment, message, recentMemories);
	rel.points = Math.max(0, rel.points + delta);

	const prevUnlocked = countUnlockedThresholds(prevPoints);
	const nowUnlocked = countUnlockedThresholds(rel.points);

	const newlyUnlocked: number[] = [];
	for (let i = prevUnlocked; i < nowUnlocked; i++) {
		if (i < 3) newlyUnlocked.push(i);
	}
	return { points: rel.points, newlyUnlocked, delta };
}

export function resolveUnlocks(pokemon: CapturedPokemon): { hpGained: number } {
	const rel = pokemon.relationship;
	const natures = pokemon.natures;
	if (!rel || !natures) return { hpGained: 0 };

	const thresholdsCrossed = countUnlockedThresholds(rel.points);
	let hpGained = 0;

	for (let i = 0; i < 3; i++) {
		if (i < thresholdsCrossed && !natures.unlocked[i]) {
			natures.unlocked[i] = true;
			hpGained += HP_PER_UNLOCK;
		}
	}

	if (hpGained > 0) {
		pokemon.hpBuffs = (pokemon.hpBuffs ?? 0) + hpGained;
	}

	return { hpGained };
}

export function recomputeMaxHp(pokemon: CapturedPokemon): void {
	if (pokemon.baseMaxHp === undefined) return;
	pokemon.maxHp = pokemon.baseMaxHp + (pokemon.hpBuffs ?? 0);
	if (pokemon.currentHp > pokemon.maxHp) {
		pokemon.currentHp = pokemon.maxHp;
	}
}

// ── Resolve an answer into an EventAnswerDef (for building events) ─────────

export function resolveAnswerDef(def: EventAnswerDef, ctx: EventContext): { text: string; sentiment: Sentiment; hookId?: string } {
	return {
		text: def.text(ctx),
		sentiment: def.sentiment,
		hookId: def.hookId
	};
}
