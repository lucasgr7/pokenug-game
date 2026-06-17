import { getPlayer, savePlayer } from '$lib/db/player';
import { addPokemon, getAllPokemon } from '$lib/db/pokemon';
import { ensurePokemonNatures } from '$lib/data/natures';
import { clamp } from '$lib/utils/math';
import { now } from '$lib/utils/time';
import type { CapturedPokemon, Player, Theme } from './types';

interface GameStore {
	player: Player | null;
	roster: CapturedPokemon[];
	ready: boolean;
}

// Estado global runed do jogo.
export const game = $state<GameStore>({
	player: null,
	roster: [],
	ready: false
});

// ---- Persistência com debounce ----
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePersist(delay = 600): void {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistTimer = null;
		void persistNow();
	}, delay);
}

export async function persistNow(): Promise<void> {
	if (persistTimer) {
		clearTimeout(persistTimer);
		persistTimer = null;
	}
	if (game.player) await savePlayer($state.snapshot(game.player));
}

// ---- Mutações do jogador ----
function requirePlayer(): Player {
	if (!game.player) throw new Error('Player não carregado');
	return game.player;
}

export function addMoney(amount: number): void {
	const p = requirePlayer();
	p.money = Math.max(0, p.money + amount);
	schedulePersist();
}

export function spendMoney(amount: number): boolean {
	const p = requirePlayer();
	if (p.money < amount) return false;
	p.money -= amount;
	schedulePersist();
	return true;
}

// ---- Platinum (premium market currency) ----

export function addPlatinum(n: number): void {
	const p = requirePlayer();
	p.platinum = Math.max(0, p.platinum + n);
	schedulePersist();
}

export function spendPlatinum(n: number): boolean {
	const p = requirePlayer();
	if (p.platinum < n) return false;
	p.platinum -= n;
	schedulePersist();
	return true;
}

export function getPlatinum(): number {
	return game.player?.platinum ?? 0;
}

export function setActivePokemon(id: string | null): void {
	requirePlayer().activePokemonId = id;
	schedulePersist();
}

export function setTheme(theme: Theme): void {
	requirePlayer().theme = theme;
	applyThemeToDom(theme);
	schedulePersist();
}

export function setMusicMuted(muted: boolean): void {
	requirePlayer().musicMuted = muted;
	schedulePersist();
}

export function applyThemeToDom(theme: Theme): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function unlockRegion(regionId: string): void {
	const p = requirePlayer();
	if (!p.unlockedRegions.includes(regionId)) {
		p.unlockedRegions.push(regionId);
		schedulePersist();
	}
}

export function recordDefeat(regionId: string, total: number): void {
	const p = requirePlayer();
	p.defeatedByRegion[regionId] = total;
	schedulePersist();
}

export function normalizedPokemonHp(pokemon: CapturedPokemon): number {
	return clamp(pokemon.currentHp ?? pokemon.maxHp, 0, pokemon.maxHp);
}

export async function setPokemonCurrentHp(pokemonId: string, hp: number): Promise<void> {
	const pokemon = game.roster.find((p) => p.id === pokemonId);
	if (!pokemon) return;
	const next = clamp(hp, 0, pokemon.maxHp);
	if (Math.abs((pokemon.currentHp ?? pokemon.maxHp) - next) < 0.0001) return;
	pokemon.currentHp = next;
	await addPokemon($state.snapshot(pokemon));
}

export async function persistPokemonById(pokemonId: string): Promise<void> {
	const pokemon = game.roster.find((p) => p.id === pokemonId);
	if (!pokemon) return;
	await addPokemon($state.snapshot(pokemon));
}

// ---- Roster ----
export function addToRoster(pokemon: CapturedPokemon): void {
	pokemon.currentHp = clamp(pokemon.currentHp ?? pokemon.maxHp, 0, pokemon.maxHp);
	game.roster.push(pokemon);
}

export function activePokemon(): CapturedPokemon | undefined {
	if (!game.player) return undefined;
	return game.roster.find((p) => p.id === game.player!.activePokemonId);
}

export function removeFromRosterMemory(id: string): void {
	const idx = game.roster.findIndex((p) => p.id === id);
	if (idx < 0) return;
	game.roster.splice(idx, 1);
	// Cancel active job if any — lazy import to avoid circular deps
	void (async () => {
		const { getJob, removeJob } = await import('$lib/db/jobs');
		if (await getJob(id)) await removeJob(id);
		const { loadJobs } = await import('./jobs.svelte');
		await loadJobs();
	})();
}

export async function restorePokemon(snapshot: CapturedPokemon): Promise<void> {
	snapshot.corrupted = true;
	game.roster.push(snapshot);
	await addPokemon($state.snapshot(snapshot));
}

export async function purgePokemon(id: string): Promise<void> {
	const { removePokemon } = await import('$lib/db/pokemon');
	await removePokemon(id);
}

// ---- Bootstrap ----
export interface OfflineSummary {
	money: number;
	elapsedMs: number;
}

export interface InitResult {
	hasPlayer: boolean;
	offline: OfflineSummary | null;
}

let initPromise: Promise<InitResult> | null = null;

export function initApp(): Promise<InitResult> {
	if (!initPromise) initPromise = doInit();
	return initPromise;
}

async function doInit(): Promise<InitResult> {
	const player = await getPlayer();
	if (!player) {
		game.ready = true;
		return { hasPlayer: false, offline: null };
	}

	game.player = player;
	game.roster = await getAllPokemon();

	let rosterNeedsFix = false;
	for (const p of game.roster) {
		const fixedHp = clamp(p.currentHp ?? p.maxHp, 0, p.maxHp);
		if (p.currentHp !== fixedHp) {
			p.currentHp = fixedHp;
			rosterNeedsFix = true;
		}
	}
	if (rosterNeedsFix) {
		await Promise.all(game.roster.map((p) => addPokemon($state.snapshot(p))));
	}

	let naturesChanged = false;
	for (const p of game.roster) {
		if (ensurePokemonNatures(p)) naturesChanged = true;
	}
	if (naturesChanged) {
		await Promise.all(game.roster.map((p) => addPokemon($state.snapshot(p))));
	}

	let relationshipChanged = false;
	for (const p of game.roster) {
		const { ensureRelationship } = await import('./memory');
		if (ensureRelationship(p)) relationshipChanged = true;
	}
	for (const p of game.roster) {
		const { ensureBaseMaxHp } = await import('./relationship.svelte');
		if (ensureBaseMaxHp(p)) relationshipChanged = true;
	}
	if (relationshipChanged) {
		await Promise.all(game.roster.map((p) => addPokemon($state.snapshot(p))));
	}

	applyThemeToDom(player.theme);

	player.lastSeenAt ??= now();

	// ── Exhaustion: work state backfill ──
	let workChanged = false;
	for (const p of game.roster) {
		const { ensureWorkState } = await import('./jobs.svelte');
		if (ensureWorkState(p)) workChanged = true;
	}
	if (workChanged) {
		await Promise.all(game.roster.map((p) => addPokemon($state.snapshot(p))));
	}

	// Progresso offline é calculado no módulo de jobs (carregado dinamicamente
	// para evitar dependência circular em tempo de avaliação).
	const { applyOfflineProgress, applyOfflineHpRecovery, applyOfflineExhaustion } = await import('./jobs.svelte');
	const offline = await applyOfflineProgress();
	const fled = await applyOfflineExhaustion();
	await applyOfflineHpRecovery();

	// Flee summary for the return popup — the fled list is available via getAllFled()

	// ── Relationship: newDay trigger ──
	const todayKey = new Date().toISOString().slice(0, 10);
	if (player.lastDayKey !== todayKey) {
		player.lastDayKey = todayKey;
		const relMod = await import('./relationship.svelte');
		const activePkm = activePokemon();
		if (activePkm) relMod.maybeRollEvent('newDay', activePkm);
		for (const p of game.roster) {
			if (relMod.relationshipState.events.length >= 3) break;
			if (p.id !== player.activePokemonId) {
				relMod.maybeRollEvent('newDay', p);
			}
		}
		await savePlayer($state.snapshot(player));
	}

	// ── Start relationship ticker ──
	const relMod2 = await import('./relationship.svelte');
	relMod2.startRelationshipTicker();

	game.ready = true;
	return { hasPlayer: true, offline };
}

// Helper para clamp de HP, reexportado por conveniência.
export { clamp };
