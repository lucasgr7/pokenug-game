import { getAllJobs, removeJob, setJob, saveJobs } from '$lib/db/jobs';
import { now } from '$lib/utils/time';
import { game, persistNow, type OfflineSummary } from './state.svelte';
import type { ActiveJob, Element, JobType } from './types';

const SECONDS_PER_POINT = 3;
const PERSIST_EVERY_TICKS = 5;

// Estado runed dos jobs ativos.
export const jobsState = $state<{ list: ActiveJob[] }>({ list: [] });

export async function loadJobs(): Promise<void> {
	jobsState.list = await getAllJobs();
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
	return effectiveWorkers(workers) / SECONDS_PER_POINT;
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
	const p = game.player;
	if (!p || amount <= 0) return;
	if (type === 'money') {
		p.money += amount;
	} else {
		const el = type as Element;
		p.elementPoints[el] = (p.elementPoints[el] ?? 0) + amount;
	}
}

// ---- Tick em tempo real ----
let interval: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

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
	if (!game.player || jobsState.list.length === 0) return;
	const t = now();
	for (const type of activeJobTypes()) {
		creditPlayer(type, ratePerSecond(type)); // 1 segundo
	}
	for (const job of jobsState.list) job.lastTickAt = t;

	tickCount++;
	if (tickCount >= PERSIST_EVERY_TICKS) {
		tickCount = 0;
		await flush();
	}
}

async function flush(): Promise<void> {
	if (jobsState.list.length > 0) await saveJobs($state.snapshot(jobsState.list) as ActiveJob[]);
	await persistNow();
}

// ---- Progresso offline ----
/**
 * Aplica a produção acumulada enquanto o app esteve fechado, usando o snapshot
 * atual do número de workers por tipo de job (simplificação razoável).
 */
export async function applyOfflineProgress(): Promise<OfflineSummary | null> {
	await loadJobs();
	if (!game.player || jobsState.list.length === 0) return null;

	const t = now();
	const summary: OfflineSummary = { money: 0, elementPoints: {}, elapsedMs: 0 };

	for (const type of activeJobTypes()) {
		const jobsOfType = jobsState.list.filter((j) => j.jobType === type);
		const since = Math.min(...jobsOfType.map((j) => j.lastTickAt));
		const elapsedMs = Math.max(0, t - since);
		summary.elapsedMs = Math.max(summary.elapsedMs, elapsedMs);
		const elapsedSec = elapsedMs / 1000;
		const gained = ratePerSecond(type) * elapsedSec;
		if (gained <= 0) continue;
		creditPlayer(type, gained);
		if (type === 'money') summary.money += gained;
		else summary.elementPoints[type as Element] = (summary.elementPoints[type as Element] ?? 0) + gained;
	}

	for (const job of jobsState.list) job.lastTickAt = t;
	await flush();

	const total = summary.money + Object.values(summary.elementPoints).reduce((a, b) => a + (b ?? 0), 0);
	return total > 0 ? summary : null;
}
