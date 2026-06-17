import type { CapturedPokemon, RelationshipTrigger, Sentiment } from '../types';

// ── Context passed to event definitions at resolution time ─────────────────

export interface EventContext {
	pokemon: CapturedPokemon;
	trigger: RelationshipTrigger;
	isOnJob: boolean;
	isActive: boolean;
}

// ── Answer definition inside an event ──────────────────────────────────────

export interface EventAnswerDef {
	text: (ctx: EventContext) => string;
	sentiment: Sentiment;
	hookId?: string;
}

// ── Event definition (registered at module load) ───────────────────────────

export interface EventDefinition {
	id: string;
	trigger: RelationshipTrigger;
	weight?: number;
	chance?: number;
	condition?: (ctx: EventContext) => boolean;
	prompt: (ctx: EventContext) => string;
	answers: [EventAnswerDef, EventAnswerDef, EventAnswerDef];
}

// ── Answer hook API (side-effect mechanism) ────────────────────────────────

export interface AnswerHookApi {
	pokemon: CapturedPokemon;
	stopJob(pokemonId: string): Promise<void>;
}

// ── Registry ───────────────────────────────────────────────────────────────

export const EVENT_REGISTRY: EventDefinition[] = [];

export function defineEvent(def: EventDefinition): void {
	if (EVENT_REGISTRY.some((e) => e.id === def.id)) {
		throw new Error(`Event "${def.id}" já registrado`);
	}
	EVENT_REGISTRY.push(def);
}

export const ANSWER_HOOKS: Record<string, (api: AnswerHookApi) => void | Promise<void>> = {};

export function defineAnswerHook(id: string, fn: (api: AnswerHookApi) => void | Promise<void>): void {
	if (ANSWER_HOOKS[id]) throw new Error(`Answer hook "${id}" já registrado`);
	ANSWER_HOOKS[id] = fn;
}
