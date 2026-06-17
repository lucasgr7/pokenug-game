import { getAllJobs, removeJob, setJob, saveJobs } from '$lib/db/jobs';
import { getSavedBattle } from '$lib/db/battle';
import { now } from '$lib/utils/time';
import {
	game,
	normalizedPokemonHp,
	persistNow,
	persistPokemonById,
	type OfflineSummary
} from './state.svelte';
import type { ActiveJob, JobType } from './types';

const SECONDS_PER_POINT = 3;
const PERSIST_EVERY_TICKS = 5;
const IDLE_HP_RESTORE_PER_MINUTE = 0.05;

// Estado runed dos jobs ativos.
export const jobsState = $state<{ list: ActiveJob[] }>({ list: [] });

export async function loadJobs(): Promise<void> {
	const all = await getAllJobs();
	jobsState.list = all.filter((j) => j.jobType === 'money');
}

// ---- Produção ----
export function workersInJob(type: JobType): number {
	return jobsState.list.filter((j) => j.jobType === type).length;
}

export function activeJobTypes(): JobType[] {
	const set = new Set<JobType>();
	for (const j of jobsState.list) set.add(j.jobType);
	return [...set];
}

/** Diminishing returns: cada worker acima de 5 conta 0.4. */
export function effectiveWorkers(workers: number): number {
	if (workers <= 5) return workers;
	return 5 + (workers - 5) * 0.4;
}

/** Pontos por segundo de um tipo de job, considerando todos os workers. */
export function ratePerSecond(type: JobType): number {
	const workers = workersInJob(type);
	if (workers === 0) return 0;
	const baseRate = effectiveWorkers(workers) / SECONDS_PER_POINT;
	const moneyMultiplier = 1 + ((game.player?.ngu.moneyMultiplierLevel ?? 0) * 0.5);
	return baseRate * moneyMultiplier;
}

export function jobForPokemon(pokemonId: string): ActiveJob | undefined {
	return jobsState.list.find((j) => j.pokemonId === pokemonId);
}

// ---- Atribuição ----
export async function assignJob(pokemonId: string, jobType: JobType): Promise<void> {
	const t = now();
	const existing = jobsState.list.find((j) => j.pokemonId === pokemonId);
	const job: ActiveJob = {
		pokemonId,
		jobType,
		startedAt: existing?.startedAt ?? t,
		lastTickAt: t
	};
	const idx = jobsState.list.findIndex((j) => j.pokemonId === pokemonId);
	if (idx >= 0) jobsState.list[idx] = job;
	else jobsState.list.push(job);
	await setJob(job);
}

export async function stopJob(pokemonId: string): Promise<void> {
	jobsState.list = jobsState.list.filter((j) => j.pokemonId !== pokemonId);
	await removeJob(pokemonId);
}

// ---- Aplicação de produção (sem persistir) ----
function creditPlayer(type: JobType, amount: number): void {
	if (!game.player || amount <= 0) return;
	game.player.money += amount;
}

// ---- Tick em tempo real ----
let interval: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;
const dirtyPokemon = new Set<string>();

export function startTicker(): void {
	if (interval) return;
	interval = setInterval(() => void tick(), 1000);
}

export function stopTicker(): void {
	if (interval) {
		clearInterval(interval);
		interval = null;
	}
	// Garante que o progresso recente seja salvo ao parar.
	void flush();
}

async function tick(): Promise<void> {
	if (!game.player) return;

	const t = now();

	if (jobsState.list.length > 0) {
		for (const type of activeJobTypes()) {
			creditPlayer(type, ratePerSecond(type)); // 1 segundo
		}
		for (const job of jobsState.list) job.lastTickAt = t;
	}

	await restoreIdleHpOutOfBattle();

	tickCount++;
	if (tickCount >= PERSIST_EVERY_TICKS) {
		tickCount = 0;
		await flush();
	}
}

async function flush(): Promise<void> {
	if (jobsState.list.length > 0) await saveJobs($state.snapshot(jobsState.list) as ActiveJob[]);
	if (dirtyPokemon.size > 0) {
		const ids = [...dirtyPokemon];
		dirtyPokemon.clear();
		await Promise.all(ids.map((id) => persistPokemonById(id)));
	}
	await persistNow();
}

async function restoreIdleHpOutOfBattle(): Promise<void> {
	if (game.roster.length === 0) return;
	const saved = await getSavedBattle();
	if (saved?.state.status === 'active') return;

	const healRatioPerSecond = IDLE_HP_RESTORE_PER_MINUTE / 60;
	for (const p of game.roster) {
		if (jobForPokemon(p.id)) continue;
		const hp = normalizedPokemonHp(p);
		if (hp >= p.maxHp) continue;
		const heal = p.maxHp * healRatioPerSecond;
		p.currentHp = Math.min(p.maxHp, hp + heal);
		dirtyPokemon.add(p.id);
	}
}

/** Offline HP recovery: heal at 5%/min capped at 8h. */
const MAX_OFFLINE_MIN = 8 * 60;

export async function applyOfflineHpRecovery(): Promise<void> {
	if (!game.player) return;
	const saved = await getSavedBattle();
	if (saved?.state.status === 'active') return;

	const last = game.player.lastSeenAt ?? now();
	const elapsedMs = Math.max(0, now() - last);
	if (elapsedMs <= 0) { game.player.lastSeenAt = now(); return; }

	const elapsedMin = Math.min(elapsedMs / 60000, MAX_OFFLINE_MIN);
	const healRatio = IDLE_HP_RESTORE_PER_MINUTE * elapsedMin;
	for (const p of game.roster) {
		if (jobForPokemon(p.id)) continue;
		const hp = normalizedPokemonHp(p);
		if (hp >= p.maxHp) continue;
		p.currentHp = Math.min(p.maxHp, hp + p.maxHp * healRatio);
		dirtyPokemon.add(p.id);
	}
	game.player.lastSeenAt = now();
	await flush();
}

// ---- Progresso offline ----
/**
 * Aplica a produção acumulada enquanto o app esteve fechado, usando o snapshot
 * atual do número de workers por tipo de job (simplificação razoável).
 */
export async function applyOfflineProgress(): Promise<OfflineSummary | null> {
	await loadJobs();
	if (!game.player) return null;

	const t = now();
	const summary: OfflineSummary = { money: 0, elapsedMs: 0 };

	for (const type of activeJobTypes()) {
		const jobsOfType = jobsState.list.filter((j) => j.jobType === type);
		const since = Math.min(...jobsOfType.map((j) => j.lastTickAt));
		const elapsedMs = Math.max(0, t - since);
		summary.elapsedMs = Math.max(summary.elapsedMs, elapsedMs);
		const elapsedSec = elapsedMs / 1000;
		const gained = ratePerSecond(type) * elapsedSec;
		if (gained <= 0) continue;
		creditPlayer(type, gained);
		summary.money += gained;
	}

	for (const job of jobsState.list) job.lastTickAt = t;
	await flush();

	return summary.money > 0 ? summary : null;
}
