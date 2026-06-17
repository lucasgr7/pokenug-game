import { now } from '$lib/utils/time';
import { shuffle } from '$lib/utils/rng';
import { addPokemon } from '$lib/db/pokemon';
import { game, schedulePersist } from './state.svelte';
import { pushToast } from '$lib/stores/toast.svelte';
import { jobsState } from './jobs.svelte';
import { EVENT_REGISTRY, ANSWER_HOOKS } from './relationship/index';
import type { AnswerHookApi, EventContext } from './relationship/index';
import type {
	CapturedPokemon,
	PokemonMemory,
	RelationshipEvent,
	RelationshipTrigger,
	ResolvedAnswer,
	Sentiment
} from './types';
import {
	ALERT_TIMER_MS,
	MAX_ACTIVE_EVENTS,
	EVENT_COOLDOWN_MS,
	shouldRollEvent,
	eligibleEvents,
	pickWeightedEvent,
	applyRelationshipDelta,
	resolveUnlocks,
	recomputeMaxHp,
	resolveAnswerDef,
	findConflictingPair,
	naturesConflict
} from './relationship';
import { ensureRelationship } from './memory';
import { REGIONS, getRegionScaling } from '$lib/data/regions';

// ── Runtime state ─────────────────────────────────────────────────────────

export const relationshipState = $state<{ events: RelationshipEvent[] }>({ events: [] });

// Fator de progressão do player: fibonacci da região mais avançada desbloqueada.
// Escala thresholds, ganhos e HP do sistema de relacionamento (acompanha o jogo).
export function progressionScale(): { scaling: number; regionIndex: number } {
	const unlocked = game.player?.unlockedRegions ?? [];
	let regionIndex = 0;
	for (const id of unlocked) {
		const idx = REGIONS.findIndex((r) => r.id === id);
		if (idx > regionIndex) regionIndex = idx;
	}
	const regionId = REGIONS[regionIndex]?.id;
	return { scaling: regionId ? getRegionScaling(regionId) : 1, regionIndex };
}

export function ensureBaseMaxHp(p: CapturedPokemon): boolean {
	if (p.baseMaxHp !== undefined) return false;
	p.baseMaxHp = p.maxHp;
	return true;
}

// ── Event creation ────────────────────────────────────────────────────────

export function maybeRollEvent(trigger: RelationshipTrigger, pokemon: CapturedPokemon): void {
	if (!pokemon.relationship) return;

	if (relationshipState.events.length >= MAX_ACTIVE_EVENTS) return;
	if (relationshipState.events.some((e) => e.pokemonId === pokemon.id)) return;

	const t = now();
	if (t - pokemon.relationship.lastEventAt < EVENT_COOLDOWN_MS) return;

	const isOnJob = pokemonIsOnJob(pokemon.id);
	const isActive = pokemon.id === game.player?.activePokemonId;
	const ctx: EventContext = { pokemon, trigger, isOnJob, isActive };

	const eligible = eligibleEvents(trigger, ctx);
	if (eligible.length === 0) return;

	const def = pickWeightedEvent(eligible);
	if (!def) return;

	const chanceOverride = def.chance;
	if (!shouldRollEvent(trigger, pokemon.relationship.lastEventAt, t, EVENT_COOLDOWN_MS, chanceOverride)) return;

	// Shuffle so the good/neutral/bad option is not always in the same slot.
	const answers = shuffle(def.answers.map((a) => resolveAnswerDef(a, ctx))) as [
		ResolvedAnswer,
		ResolvedAnswer,
		ResolvedAnswer
	];

	const event: RelationshipEvent = {
		id: crypto.randomUUID(),
		pokemonId: pokemon.id,
		defId: def.id,
		trigger,
		promptPt: def.prompt(ctx),
		answers,
		createdAt: t,
		expiresAt: t + ALERT_TIMER_MS
	};

	relationshipState.events.push(event);
}

function pokemonIsOnJob(pokemonId: string): boolean {
	return jobsState.list.some((j) => j.pokemonId === pokemonId);
}

// ── Conflict events (two pokemon fighting) ────────────────────────────────

export function maybeRollConflict(trigger: RelationshipTrigger, force = false): void {
	debugger;
	if (relationshipState.events.length >= MAX_ACTIVE_EVENTS) return;
	const conflictEvents = EVENT_REGISTRY.filter(
		(e) => e.trigger === trigger && e.id.startsWith('conflict_')
	);
	if (conflictEvents.length === 0) return;

	const pair = findConflictingPair(game.roster, (id) => jobsState.list.some((j) => j.pokemonId === id));
	if (!pair) return;

	const t = now();
	const pokemonA = game.roster.find((p) => p.id === pair.a);
	const pokemonB = game.roster.find((p) => p.id === pair.b);
	if (!pokemonA || !pokemonB) return;
	if (!pokemonA.relationship || !pokemonB.relationship) return;
	if (t - pokemonA.relationship.lastEventAt < EVENT_COOLDOWN_MS) return;
	if (t - pokemonB.relationship.lastEventAt < EVENT_COOLDOWN_MS) return;
	if (relationshipState.events.some((e) => e.pokemonId === pair.a || e.pokemonId === pair.b)) return;
	if (!force && Math.random() >= 0.10) return;

	const def = conflictEvents[Math.floor(Math.random() * conflictEvents.length)];
	const ctxWithPeer = {
		pokemon: pokemonA,
		trigger,
		isOnJob: jobsState.list.some((j) => j.pokemonId === pair.a),
		isActive: pokemonA.id === game.player?.activePokemonId,
		peerName: pokemonB.name
	} as any;

	const answers = def.answers.map((a) => resolveAnswerDef(a, ctxWithPeer)) as [ResolvedAnswer, ResolvedAnswer, ResolvedAnswer];

	const event: RelationshipEvent = {
		id: crypto.randomUUID(),
		pokemonId: pair.a,
		secondaryPokemonId: pair.b,
		defId: def.id,
		trigger,
		promptPt: def.prompt(ctxWithPeer),
		answers,
		createdAt: t,
		expiresAt: t + ALERT_TIMER_MS
	};

	relationshipState.events.push(event);
}

// ── Resolution: shared pipeline ───────────────────────────────────────────

async function applyResolution(
	event: RelationshipEvent,
	sentiment: Sentiment,
	hookId?: string,
	playerMessage?: string,
	emoji = '',
	peerSentiment?: Sentiment
): Promise<number> {
	const pokemon = game.roster.find((p) => p.id === event.pokemonId);
	if (!pokemon || !pokemon.relationship) return 0;

	const t = now();

	if (hookId) {
		const hookFn = ANSWER_HOOKS[hookId];
		if (hookFn) {
			const { stopJob } = await import('./jobs.svelte');
			const api: AnswerHookApi = { pokemon, stopJob };
			await hookFn(api);
		}
	}

	const message = playerMessage ?? event.answers[0]?.text ?? '';
	const recent = pokemon.relationship.memories.slice();

	const memory: PokemonMemory = {
		at: t, trigger: event.trigger, playerMessage: message, emoji, sentiment
	};
	pokemon.relationship.memories.push(memory);

	const { scaling, regionIndex } = progressionScale();
	const result = applyRelationshipDelta(pokemon.relationship, sentiment, message, recent, scaling);
	const unlockResult = resolveUnlocks(pokemon, scaling, regionIndex);
	recomputeMaxHp(pokemon);
	pokemon.relationship.lastEventAt = t;

	// Apply peer sentiment to secondary pokemon (conflict events)
	if (event.secondaryPokemonId && peerSentiment) {
		const peerPkm = game.roster.find((p) => p.id === event.secondaryPokemonId);
		if (peerPkm?.relationship) {
			const peerRecent = peerPkm.relationship.memories.slice();
			applyRelationshipDelta(peerPkm.relationship, peerSentiment, message + ' (conflito)', peerRecent, scaling);
			resolveUnlocks(peerPkm, scaling, regionIndex);
			recomputeMaxHp(peerPkm);
			peerPkm.relationship.lastEventAt = t;
			peerPkm.relationship.memories.push({
				at: t, trigger: event.trigger, playerMessage: message + ' (conflito)', emoji, sentiment: peerSentiment
			});
			await addPokemon($state.snapshot(peerPkm));
		}
	}

	if (unlockResult.newlyUnlocked.length > 0) {
		const { NATURES } = await import('$lib/data/natures');
		const natureNames = unlockResult.newlyUnlocked
			.map((i) => pokemon.natures?.assigned[i])
			.filter((id): id is import('./types').NatureId => id !== undefined)
			.map((id) => NATURES[id]?.namePt ?? id);
		pushToast(`${pokemon.name} desbloqueou a natureza ${natureNames.join(', ')}!`, 'success');
	}

	if (unlockResult.hpGained > 0) {
		pushToast(`${pokemon.name} ganhou +${unlockResult.hpGained} de HP máximo!`, 'success');
	}

	if (sentiment === 'good' && result.delta <= 0) {
		pushToast(`${pokemon.name} parece entediado com a repetição...`);
	}

	removeEvent(event.id);
	await addPokemon($state.snapshot(pokemon));
	schedulePersist();
	return result.delta;
}

function removeEvent(eventId: string): void {
	relationshipState.events = relationshipState.events.filter((e) => e.id !== eventId);
}

// ── Unified resolution: ALWAYS ask the LLM (canned + free text) ─────────────

export interface LlmResolution {
	emoji: string;
	sentiment: Sentiment;
	delta: number;
}

/**
 * Resolve an event by sending `text` to the LLM regardless of whether it came
 * from a canned answer or the free-text input. The pokemon reacts with an emoji
 * (the LLM, or a keyword fallback when offline) which decides the sentiment.
 * `hookId` (from a canned answer) still runs its side effect (e.g. rest from job).
 * Returns the emoji + sentiment so the UI can show the pokemon's reaction.
 */
export async function resolveWithLLM(
	eventId: string,
	text: string,
	hookId?: string,
	peerSentiment?: Sentiment
): Promise<LlmResolution | null> {
	const event = relationshipState.events.find((e) => e.id === eventId);
	if (!event) return null;

	const pokemon = game.roster.find((p) => p.id === event.pokemonId);

	let emoji = '😐';
	let sentiment: Sentiment = 'neutral';

	try {
		const { classifyMessage } = await import('$lib/api/ollama');
		if (!pokemon) throw new Error('pokemon not found for classification: ' + event.pokemonId);
		const result = await classifyMessage(
			pokemon.relationship?.memories?.slice(-3) ?? [],
			text,
			pokemon,
			event.promptPt
		);
		emoji = result.emoji;
		sentiment = result.sentiment;
	} catch (err) {
		console.error('[relationship] classify failed — using keyword fallback:', err);
		const { keywordFallback } = await import('./relationship');
		sentiment = keywordFallback(text);
		emoji = sentiment === 'good' ? '😊' : sentiment === 'bad' ? '😢' : '😐';
	}

	const delta = await applyResolution(event, sentiment, hookId, text, emoji, peerSentiment);
	return { emoji, sentiment, delta };
}

// ── Expiry ────────────────────────────────────────────────────────────────

export async function expireEvent(eventId: string): Promise<void> {
	const event = relationshipState.events.find((e) => e.id === eventId);
	if (!event) return;
	await applyResolution(event, 'neutral');
}

// ── Timer loop ────────────────────────────────────────────────────────────

let expiryInterval: ReturnType<typeof setInterval> | null = null;

export function startRelationshipTicker(): void {
	if (expiryInterval) return;
	expiryInterval = setInterval(() => {
		const t = now();
		for (const event of [...relationshipState.events]) {
			if (t >= event.expiresAt) {
				void expireEvent(event.id);
			}
		}
	}, 1000);
}

export function stopRelationshipTicker(): void {
	if (expiryInterval) {
		clearInterval(expiryInterval);
		expiryInterval = null;
	}
}
