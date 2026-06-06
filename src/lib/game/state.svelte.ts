import { getPlayer, savePlayer } from '$lib/db/player';
import { addPokemon, getAllPokemon } from '$lib/db/pokemon';
import { ensurePokemonNatures } from '$lib/data/natures';
import { clamp } from '$lib/utils/math';
import type { CapturedPokemon, Element, Player, Theme } from './types';

const HP_PER_ELEMENT_LEVEL = 20;

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

export function addElementPoints(element: Element, amount: number): void {
	const p = requirePlayer();
	p.elementPoints[element] = Math.max(0, (p.elementPoints[element] ?? 0) + amount);
	schedulePersist();
}

export function spendElementPoints(element: Element, amount: number): boolean {
	const p = requirePlayer();
	const have = p.elementPoints[element] ?? 0;
	if (have < amount) return false;
	p.elementPoints[element] = have - amount;
	schedulePersist();
	return true;
}

export function getElementPoints(element: Element): number {
	return game.player?.elementPoints[element] ?? 0;
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

export function getElementalDamageLevel(element: Element | null | undefined): number {
	if (!element) return 0;
	return game.player?.ngu.elementalDamageLevels[element] ?? 0;
}

export function getElementalHpLevel(element: Element | null | undefined): number {
	if (!element) return 0;
	return game.player?.ngu.elementalHpLevels[element] ?? 0;
}

export function getElementalHpBonus(element: Element | null | undefined): number {
	return getElementalHpLevel(element) * HP_PER_ELEMENT_LEVEL;
}

export function applyElementalHpBonusToPokemon(pokemon: CapturedPokemon): void {
	const bonusHp = getElementalHpBonus(pokemon.element);
	if (bonusHp <= 0) return;
	pokemon.maxHp += bonusHp;
	pokemon.currentHp += bonusHp;
}

export async function applyElementalHpUpgradeToRoster(element: Element, addedLevels = 1): Promise<void> {
	if (addedLevels <= 0) return;

	const bonusHp = addedLevels * HP_PER_ELEMENT_LEVEL;
	let rosterChanged = false;
	for (const pokemon of game.roster) {
		if (pokemon.element !== element) continue;
		pokemon.maxHp += bonusHp;
		pokemon.currentHp = clamp((pokemon.currentHp ?? pokemon.maxHp) + bonusHp, 0, pokemon.maxHp);
		rosterChanged = true;
	}

	if (rosterChanged) {
		await Promise.all(game.roster.map((pokemon) => addPokemon($state.snapshot(pokemon))));
	}
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

async function migrateLegacyNguProgress(player: Player): Promise<void> {
	let playerChanged = false;
	let rosterChanged = false;

	const active = game.roster.find((pokemon) => pokemon.id === player.activePokemonId);
	if (!active) return;

	const legacyDamageLevel = player.ngu.globalDamageLevel ?? 0;
	if (legacyDamageLevel > 0) {
		const currentDamageLevel = player.ngu.elementalDamageLevels[active.element] ?? 0;
		player.ngu.elementalDamageLevels[active.element] = Math.max(currentDamageLevel, legacyDamageLevel);
		player.ngu.globalDamageLevel = 0;
		playerChanged = true;
	}

	const legacyHpLevel = active.hpBuffs ?? 0;
	if (legacyHpLevel > 0) {
		const currentHpLevel = player.ngu.elementalHpLevels[active.element] ?? 0;
		const targetHpLevel = Math.max(currentHpLevel, legacyHpLevel);
		const deltaLevels = targetHpLevel - currentHpLevel;
		player.ngu.elementalHpLevels[active.element] = targetHpLevel;
		playerChanged = true;

		if (deltaLevels > 0) {
			const bonusHp = deltaLevels * HP_PER_ELEMENT_LEVEL;
			for (const pokemon of game.roster) {
				if (pokemon.id === active.id || pokemon.element !== active.element) continue;
				pokemon.maxHp += bonusHp;
				pokemon.currentHp += bonusHp;
				rosterChanged = true;
			}
		}
	}

	for (const pokemon of game.roster) {
		if ((pokemon.hpBuffs ?? 0) !== 0) {
			pokemon.hpBuffs = 0;
			rosterChanged = true;
		}
	}

	if (playerChanged) {
		await savePlayer($state.snapshot(player));
	}
	if (rosterChanged) {
		await Promise.all(game.roster.map((pokemon) => addPokemon($state.snapshot(pokemon))));
	}
}

// ---- Bootstrap ----
export interface OfflineSummary {
	money: number;
	elementPoints: Partial<Record<Element, number>>;
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
	await migrateLegacyNguProgress(player);

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

	applyThemeToDom(player.theme);

	// Progresso offline é calculado no módulo de jobs (carregado dinamicamente
	// para evitar dependência circular em tempo de avaliação).
	const { applyOfflineProgress } = await import('./jobs.svelte');
	const offline = await applyOfflineProgress();

	game.ready = true;
	return { hasPlayer: true, offline };
}

// Helper para clamp de HP, reexportado por conveniência.
export { clamp };
