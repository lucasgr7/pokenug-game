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
	resolveAnswerDef
} from './relationship';
import { ensureRelationship } from './memory';

// ── Runtime state ─────────────────────────────────────────────────────────

export const relationshipState = $state<{ events: RelationshipEvent[] }>({ events: [] });

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

// ── Resolution: shared pipeline ───────────────────────────────────────────

async function applyResolution(
	event: RelationshipEvent,
	sentiment: Sentiment,
	hookId?: string,
	playerMessage?: string,
	emoji = ''
): Promise<void> {
	const pokemon = game.roster.find((p) => p.id === event.pokemonId);
	if (!pokemon || !pokemon.relationship) return;

	const t = now();

	if (hookId) {
		const hookFn = ANSWER_HOOKS[hookId];
		if (hookFn) {
			const { stopJob } = await import('./jobs.svelte');
			const api: AnswerHookApi = { pokemon, stopJob };
			await hookFn(api);
		}
	}

	const memory: PokemonMemory = {
		at: t,
		trigger: event.trigger,
		playerMessage: playerMessage ?? event.answers[0]?.text ?? '',
		emoji,
		sentiment
	};
	pokemon.relationship.memories.push(memory);

	const delta = applyRelationshipDelta(pokemon.relationship, sentiment);
	const unlockResult = resolveUnlocks(pokemon);
	recomputeMaxHp(pokemon);

	pokemon.relationship.lastEventAt = t;

	if (delta.newlyUnlocked.length > 0) {
		const { NATURES } = await import('$lib/data/natures');
		const natureNames = delta.newlyUnlocked
			.map((i) => pokemon.natures?.assigned[i])
			.filter((id): id is import('./types').NatureId => id !== undefined)
			.map((id) => NATURES[id]?.namePt ?? id);
		pushToast(`${pokemon.name} desbloqueou a natureza ${natureNames.join(', ')}!`, 'success');
	}

	if (unlockResult.hpGained > 0) {
		pushToast(`${pokemon.name} ganhou +${unlockResult.hpGained} de HP máximo!`, 'success');
	}

	removeEvent(event.id);
	await addPokemon($state.snapshot(pokemon));
	schedulePersist();
}

function removeEvent(eventId: string): void {
	relationshipState.events = relationshipState.events.filter((e) => e.id !== eventId);
}

// ── Unified resolution: ALWAYS ask the LLM (canned + free text) ─────────────

export interface LlmResolution {
	emoji: string;
	sentiment: Sentiment;
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
	hookId?: string
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
			pokemon
		);
		emoji = result.emoji;
		sentiment = result.sentiment;
	} catch (err) {
		console.error('[relationship] classify failed — using keyword fallback:', err);
		const { keywordFallback } = await import('./relationship');
		sentiment = keywordFallback(text);
		emoji = sentiment === 'good' ? '😊' : sentiment === 'bad' ? '😢' : '😐';
	}

	await applyResolution(event, sentiment, hookId, text, emoji);
	return { emoji, sentiment };
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
