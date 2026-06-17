import { addToInventory, getActiveDeck, getInventory, removeFromInventory } from '$lib/db/cards';
import { resetDeckToStarters } from '$lib/db/cards';
import { browser } from '$app/environment';
import posthog from 'posthog-js';
import { addPokemon } from '$lib/db/pokemon';
import {
	canFightBoss,
	getRegionProgress,
	incrementDefeat,
	markBossDefeated,
	markBossFightDone
} from '$lib/db/regions';
import { clearSavedBattle, getSavedBattle, saveBattle } from '$lib/db/battle';
import { CATALOG, getTemplate } from '$lib/data/cards';
import { savePlayer } from '$lib/db/player';
import { getRegion, nextRegion, getRegionScaling } from '$lib/data/regions';
import { fetchPokemon } from '$lib/api/pokeapi';
import { ensurePokemonNatures } from '$lib/data/natures';
import {
	HAND_SIZE,
	START_MANA,
	drawCards,
	endTurnOn,
	playCardOn,
	playRelicOn,
	sanitizeBattleStateCards,
	wireCombat,
	type CombatIO,
	type EnemyTurnResult,
	type PlayCardResult
} from './combat';
import { dispatchOnBattleStart, dispatchOnBattleStartAfterDraw } from './status/pipeline';
import { pick, randomInt, shuffle, weightedPick } from '$lib/utils/rng';
import { now } from '$lib/utils/time';
import {
	activePokemon,
	addMoney,
	addToRoster,
	game,
	normalizedPokemonHp,
	recordDefeat,
	setPokemonCurrentHp,
	setActivePokemon,
	unlockRegion
} from './state.svelte';
import type {
	BattleMode,
	BossCardReward,
	BattleReward,
	BattleState,
	CardRarity,
	CardTemplate,
	CapturedPokemon,
	Element,
	EnemyIntent,
	SavedBattle
} from './types';
import { ELEMENTS } from './types';
import { MISSINGNO_MAX_HP, MISSINGNO_ACT1_DAMAGE, MISSINGNO_TURN_DAMAGE } from '$lib/data/missingno';

// The combat engine itself lives in `./combat.ts` (pure, unit-testable).
// This module wraps it with the Svelte store, persistence and analytics.
export { effectiveCardCost } from './combat';
export type { EnemyTurnResult, PlayCardResult } from './combat';

// Callback hook for MissingNo mode — called when player HP hits 0 instead of defeat.
let onPlayerDefeatedInMissingNo: (() => void) | null = null;
export function setOnMissingNoDefeat(fn: () => void): void {
	onPlayerDefeatedInMissingNo = fn;
}

interface BattleStore {
	state: BattleState | null;
	reward: BattleReward | null;
	settled: boolean;
	// Toggled each hit to drive Svelte #key animations in the battle UI.
	enemyHurt: number;
	playerHurt: number;
	introPending: boolean; // sinaliza batalha nova (não retomada) para tocar intro
}

export const battle = $state<BattleStore>({
	state: null,
	reward: null,
	settled: false,
	enemyHurt: 0,
	playerHurt: 0,
	introPending: false
});

// Engine side effects bound to the UI store.
const uiIO: CombatIO = {
	onEnemyHurt: () => battle.enemyHurt++,
	onPlayerHurt: () => battle.playerHurt++,
	onPlayerDefeated: () => {
		const s = battle.state;
		if (s?.mode === 'missingno' && onPlayerDefeatedInMissingNo) {
			onPlayerDefeatedInMissingNo();
			return true;
		}
		return false;
	}
};

const BOSS_HP_MULTIPLIER = 3;

type BossRewardBucket = 'common' | 'rare' | 'epicPlus';

// ── Enemy intent ──────────────────────────────────────────────────────────

function rollIntent(enemyHp: number, enemyMaxHp: number, turnNumber: number, scaling: number, enemyElement: Element): EnemyIntent {
	const ratio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 1;
	// Enemy is more defensive when low on HP.
	const defendWeight = ratio < 0.35 ? 0.4 : 0.2;
	const kind = weightedPick(['attack', 'defend', 'buff'] as const, [0.6, defendWeight, 0.15]);
	if (kind === 'attack') {
		const baseDmg = randomInt(5, 9) + Math.floor(enemyMaxHp / (20 * scaling)) + Math.floor(turnNumber * 0.5);
		return { kind: 'attack', damage: Math.ceil(baseDmg * scaling), element: enemyElement };
	}
	if (kind === 'defend') return { kind: 'defend', block: Math.ceil(randomInt(4, 8) * scaling) };
	return { kind: 'buff', nextDamage: Math.ceil(randomInt(3, 6) * scaling) };
}

function nextIntentFor(s: BattleState): EnemyIntent {
	if (s.mode === 'missingno') return { kind: 'attack', damage: MISSINGNO_TURN_DAMAGE };
	const scaling = getRegionScaling(s.regionId);
	return rollIntent(s.enemy.hp, s.enemy.pokemon.maxHp, s.turnNumber, scaling, s.enemy.pokemon.element);
}

// ── Nature statuses ──────────────────────────────────────────────────────

function applyNatureStatuses(s: BattleState): void {
	const natures = s.player.pokemon.natures;
	if (!natures) return;
	for (let i = 0; i < 3; i++) {
		if (natures.unlocked[i]) {
			s.player.statuses.push({ defId: 'nature_' + natures.assigned[i], stacks: 1, data: {} });
		}
	}
	if (s.player.pokemon.corrupted) {
		s.player.statuses.push({ defId: 'nature_corrompido', stacks: 1, data: {} });
	}
}

// ── Persistence ───────────────────────────────────────────────────────────

async function persistBattle(): Promise<void> {
	if (!battle.state) return;
	if (battle.state.mode === 'missingno') return; // never persist MissingNo
	const snapshot = $state.snapshot({
		state: battle.state,
		reward: battle.reward,
		settled: battle.settled
	}) as SavedBattle;
	await saveBattle(snapshot);
}

async function syncPlayerHp(): Promise<void> {
	const s = battle.state;
	if (!s) return;
	await setPokemonCurrentHp(s.player.pokemon.id, s.player.hp);
}

export function repairActiveBattleState(): void {
	const s = battle.state;
	if (!s || s.status !== 'active') return;

	const { removedFromHand, changed: cardsChanged } = sanitizeBattleStateCards(s);
	let changed = cardsChanged;
	if (!s.mode) {
		s.mode = 'normal';
		changed = true;
	}
	if (typeof s.bossFirstFightBlockedCapture !== 'boolean') {
		s.bossFirstFightBlockedCapture = false;
		changed = true;
	}
	if (s.turn === 'player' && removedFromHand > 0) {
		drawCards(s, removedFromHand);
	}

	if (!s.player.statuses) {
		s.player.statuses = [];
		changed = true;
	}
	if (!s.enemy.statuses) {
		s.enemy.statuses = [];
		changed = true;
	}
	if (!s.player.turnFlags) {
		s.player.turnFlags = { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0, cardsPlayedThisTurn: 0 };
		changed = true;
	}

	if (changed || removedFromHand > 0) {
		void persistBattle();
	}
}

// ── Battle lifecycle ──────────────────────────────────────────────────────

function cardMatchesBossBucket(rarity: CardRarity, bucket: BossRewardBucket): boolean {
	if (rarity === 'starter') return false;
	if (bucket === 'common') return rarity === 'common';
	if (bucket === 'rare') return rarity === 'rare';
	return rarity === 'epic' || rarity === 'secret';
}

function rollWildRewardBucket(): BossRewardBucket {
	const roll = Math.random();
	if (roll <= 0.62) return 'common';
	if (roll <= 0.92) return 'rare';
	return 'epicPlus';
}

function cardMatchesWildBucket(rarity: CardRarity, bucket: BossRewardBucket): boolean {
	if (rarity === 'starter' || rarity === 'secret') return false;
	if (bucket === 'common') return rarity === 'common';
	if (bucket === 'rare') return rarity === 'rare';
	return rarity === 'epic';
}

function toCardReward(c: CardTemplate): BossCardReward {
	return {
		templateId: c.id,
		rarity: c.rarity as Exclude<CardRarity, 'starter'>,
		element: c.element,
		name: c.name
	};
}

/**
 * Victory card reward. 75% chance the card matches the defeated Pokémon's element,
 * 25% a different element. Bosses ALWAYS drop epic rarity or higher (epic/secret);
 * wild victories use the 60/30/10 rarity roll.
 */
function pickVictoryRewardCard(defeatedElement: Element, isBoss: boolean): BossCardReward | null {
	const sameType = Math.random() < 0.75;
	let element: Element = defeatedElement;
	if (!sameType) {
		const others = ELEMENTS.filter((e) => e !== defeatedElement);
		element = others.length ? pick(others) : defeatedElement;
	}
	const banned = game.player?.bannedTemplateIds ?? [];
	const ok = (c: CardTemplate) => !banned.includes(c.id);

	if (isBoss) {
		const epicPlus = (c: CardTemplate) => (c.rarity === 'epic' || c.rarity === 'secret') && ok(c);
		let pool = CATALOG.filter((c) => c.element === element && epicPlus(c));
		if (pool.length === 0) pool = CATALOG.filter(epicPlus);
		if (pool.length === 0) return null;
		return toCardReward(pick(pool));
	}

	const bucket = rollWildRewardBucket();
	let pool = CATALOG.filter((c) => c.element === element && cardMatchesWildBucket(c.rarity, bucket) && ok(c));
	if (pool.length === 0) pool = CATALOG.filter((c) => c.element === element && c.rarity !== 'starter' && c.rarity !== 'secret' && ok(c));
	if (pool.length === 0) pool = CATALOG.filter((c) => cardMatchesWildBucket(c.rarity, bucket) && ok(c));
	if (pool.length === 0) pool = CATALOG.filter((c) => c.rarity !== 'starter' && c.rarity !== 'secret' && ok(c));
	if (pool.length === 0) return null;
	return toCardReward(pick(pool));
}

function pickVictoryRewardChoices(defeatedElement: Element, isBoss: boolean, count = 3): BossCardReward[] {
	const banned = game.player?.bannedTemplateIds ?? [];
	const chosenIds = new Set<string>();
	const result: BossCardReward[] = [];

	for (let i = 0; i < count; i++) {
		const sameType = Math.random() < 0.75;
		let element: Element = defeatedElement;
		if (!sameType) {
			const others = ELEMENTS.filter((e) => e !== defeatedElement);
			element = others.length ? pick(others) : defeatedElement;
		}

		const ok = (c: CardTemplate) => !banned.includes(c.id) && !chosenIds.has(c.id);

		if (isBoss) {
			const epicPlus = (c: CardTemplate) => (c.rarity === 'epic' || c.rarity === 'secret') && ok(c);
			let pool = CATALOG.filter((c) => c.element === element && epicPlus(c));
			if (pool.length === 0) pool = CATALOG.filter(epicPlus);
			if (pool.length === 0) continue;
			const chosen = toCardReward(pick(pool));
			chosenIds.add(chosen.templateId);
			result.push(chosen);
		} else {
			const bucket = rollWildRewardBucket();
			let pool = CATALOG.filter((c) => c.element === element && cardMatchesWildBucket(c.rarity, bucket) && ok(c));
			if (pool.length === 0) pool = CATALOG.filter((c) => c.element === element && c.rarity !== 'starter' && c.rarity !== 'secret' && ok(c));
			if (pool.length === 0) pool = CATALOG.filter((c) => cardMatchesWildBucket(c.rarity, bucket) && ok(c));
			if (pool.length === 0) pool = CATALOG.filter((c) => c.rarity !== 'starter' && c.rarity !== 'secret' && ok(c));
			if (pool.length === 0) continue;
			const chosen = toCardReward(pick(pool));
			chosenIds.add(chosen.templateId);
			result.push(chosen);
		}
	}

	return result;
}

export async function startBattle(regionId: string, mode: BattleMode = 'normal'): Promise<void> {
	const region = getRegion(regionId);
	const mine = activePokemon();
	if (!region || !mine) throw new Error('Região ou pokémon ativo inválido');
	const progress = await getRegionProgress(regionId);

	if (mode === 'boss') {
		if (progress.defeats < region.requiredDefeats) {
			throw new Error('Boss indisponivel: derrote mais inimigos comuns nesta regiao.');
		}
		if (!canFightBoss(progress, now())) {
			throw new Error('Boss em cooldown de 24h para esta regiao.');
		}
	}

	const speciesId = mode === 'boss' ? pick(region.bossPool) : pick(region.pool);
	let enemyData;
	try {
		enemyData = await fetchPokemon(speciesId);
	} catch {
		enemyData = { id: speciesId, name: `#${speciesId}`, element: 'normal' as const, maxHp: 40, artworkUrl: '' };
	}

	const scaling = getRegionScaling(regionId);
	const hpMultiplier = mode === 'boss' ? BOSS_HP_MULTIPLIER : 1;
	const enemy: CapturedPokemon = {
		id: crypto.randomUUID(),
		speciesId,
		name: enemyData.name,
		element: enemyData.element,
		maxHp: enemyData.maxHp * scaling * hpMultiplier,
		currentHp: enemyData.maxHp * scaling * hpMultiplier,
		capturedAt: now()
	};

	battle.state = {
		regionId,
		mode,
		bossFirstFightBlockedCapture: mode === 'boss' && !progress.bossFirstFightDone,
		player: {
			pokemon: { ...mine },
			hp: normalizedPokemonHp(mine),
			block: 0,
			mana: START_MANA,
			maxMana: 3,
			poisonCounter: 0,
			ghostPermDebuff: game.player?.ghostPermDebuff ?? 0,
			statuses: [],
			turnFlags: { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0, cardsPlayedThisTurn: 0 }
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: rollIntent(enemy.maxHp, enemy.maxHp, 1, scaling, enemy.element),
			nextDamageBonus: 0,
			poisonCounter: 0,
			statuses: []
		},
		deck: shuffle(await getActiveDeck()),
		hand: [],
		discard: [],
		exhausted: [],
		relicSlots: (await getInventory()).filter((c) => getTemplate(c.templateId)?.kind === 'relic'),
		turn: 'player',
		turnNumber: 1,
		status: 'active',
		usedPowerIds: [],
		bannedTemplateIds: [...(game.player?.bannedTemplateIds ?? [])],
		pilhaExaurir: game.player?.pilhaExaurir ?? 0
	};
	wireCombat(battle.state, uiIO);
	battle.reward = null;
	battle.settled = false;
	battle.enemyHurt = 0;
	battle.playerHurt = 0;

	applyNatureStatuses(battle.state);
	dispatchOnBattleStart(battle.state);

	drawCards(battle.state, HAND_SIZE);
	dispatchOnBattleStartAfterDraw(battle.state);
	battle.introPending = true;
	void persistBattle();
}

export async function startMissingNoBattle(initialPkm: CapturedPokemon): Promise<void> {
	const enemy: CapturedPokemon = {
		id: 'missingno',
		speciesId: 0,
		name: 'MissingNo.',
		element: 'normal',
		maxHp: MISSINGNO_MAX_HP,
		currentHp: MISSINGNO_MAX_HP,
		capturedAt: 0
	};

	battle.state = {
		regionId: 'missingno',
		mode: 'missingno',
		bossFirstFightBlockedCapture: false,
		player: {
			pokemon: { ...initialPkm },
			hp: initialPkm.maxHp,
			block: 0,
			mana: START_MANA,
			maxMana: 3,
			poisonCounter: 0,
			ghostPermDebuff: 0,
			statuses: [],
			turnFlags: { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0, cardsPlayedThisTurn: 0 }
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: { kind: 'attack', damage: MISSINGNO_ACT1_DAMAGE },
			nextDamageBonus: 0,
			poisonCounter: 0,
			statuses: []
		},
		deck: shuffle(await getActiveDeck()),
		hand: [],
		discard: [],
		exhausted: [],
		relicSlots: (await getInventory()).filter((c) => getTemplate(c.templateId)?.kind === 'relic'),
		turn: 'player',
		turnNumber: 1,
		status: 'active',
		usedPowerIds: [],
		bannedTemplateIds: [...(game.player?.bannedTemplateIds ?? [])],
		pilhaExaurir: game.player?.pilhaExaurir ?? 0
	};
	wireCombat(battle.state, uiIO);
	battle.reward = null;
	battle.settled = false;
	battle.enemyHurt = 0;
	battle.playerHurt = 0;

	applyNatureStatuses(battle.state);
	dispatchOnBattleStart(battle.state);

	drawCards(battle.state, HAND_SIZE);
	dispatchOnBattleStartAfterDraw(battle.state);
}

export async function swapActiveFighter(pkm: CapturedPokemon): Promise<void> {
	const s = battle.state;
	if (!s) return;

	s.player.pokemon = { ...pkm };
	s.player.hp = pkm.maxHp;
	s.player.block = 0;
	s.player.mana = START_MANA;
	s.player.poisonCounter = 0;
	s.player.ghostPermDebuff = 0;
	s.player.statuses = [];
	s.player.turnFlags = { firstAttackThisTurn: true, damageSufferedThisTurn: false, damageReceivedLastTurn: 0, cardsPlayedThisTurn: 0 };

	s.deck = shuffle(await getActiveDeck());
	s.hand = [];
	s.discard = [];
	s.exhausted = [];

	applyNatureStatuses(s);
	dispatchOnBattleStart(s);

	drawCards(s, HAND_SIZE);
	dispatchOnBattleStartAfterDraw(s);

	s.enemy.block = 0;
	s.enemy.nextDamageBonus = 0;
	s.enemy.poisonCounter = 0;
	s.enemy.statuses = [];
	s.enemy.intent = { kind: 'attack', damage: MISSINGNO_TURN_DAMAGE };

	s.turn = 'player';
	s.turnNumber = 1;

	wireCombat(s, uiIO);
	void persistBattle();
}

export async function enterBattle(regionId: string, mode: BattleMode = 'normal'): Promise<void> {
	const saved = await getSavedBattle();
	if (saved?.state.status === 'active') {
		battle.state = saved.state;
		wireCombat(battle.state, uiIO);
		battle.reward = saved.reward
			? { ...saved.reward, cardReward: saved.reward.cardReward ?? null, cardChoices: saved.reward.cardChoices ?? [] }
			: null;
		battle.settled = saved.settled;
		battle.enemyHurt = 0;
		battle.playerHurt = 0;
		repairActiveBattleState();
		return;
	}
	if (saved) await clearSavedBattle();
	await startBattle(regionId, mode);
}

export async function hasSavedBattle(): Promise<boolean> {
	const saved = await getSavedBattle();
	return !!saved && saved.state.status === 'active';
}

export async function endBattleCleanup(): Promise<void> {
	battle.state = null;
	battle.reward = null;
	battle.settled = false;
	battle.introPending = false;
	await clearSavedBattle();
}

// ── Player actions ────────────────────────────────────────────────────────

export function playCard(cardId: string): PlayCardResult {
	const s = battle.state;
	if (!s) return { played: false, exhausted: false, kind: 'attack' };

	// Snapshot the template before the engine moves the card out of the hand.
	const templateId = s.hand.find((c) => c.id === cardId)?.templateId;

	const result = playCardOn(s, cardId, uiIO);
	if (!result.played) return result;

	if (result.kind === 'heal') void syncPlayerHp();

	// endsTurn (Evasão Total): trigger enemy turn immediately
	const tpl = templateId ? getTemplate(templateId) : null;
	if (tpl?.endsTurn && s.status === 'active') {
		void persistBattle();
		endTurn();
		return result;
	}

	void persistBattle();
	return result;
}

export function playRelicCard(cardId: string): PlayCardResult {
	const s = battle.state;
	if (!s) return { played: false, exhausted: false, kind: 'relic' };

	const result = playRelicOn(s, cardId, uiIO);
	if (result.played) void persistBattle();
	return result;
}

export function endTurn(): EnemyTurnResult | null {
	const s = battle.state;
	if (!s) return null;

	const result = endTurnOn(s, nextIntentFor, uiIO);
	if (!result) return null;

	if (s.status === 'defeat') void setPokemonCurrentHp(s.player.pokemon.id, 0);
	void persistBattle();
	return result;
}



// ── Reward settlement ─────────────────────────────────────────────────────

export async function finalizeBattle(): Promise<void> {
	const s = battle.state;
	if (!s || battle.settled || s.status === 'active') return;
	battle.settled = true;
	await clearSavedBattle();

	// Sync run-persistent state back to player DB
	if (game.player) {
		game.player.pilhaExaurir = s.pilhaExaurir;
		game.player.bannedTemplateIds = [...s.bannedTemplateIds];
		game.player.ghostPermDebuff = s.player.ghostPermDebuff;
		await savePlayer($state.snapshot(game.player) as typeof game.player);
	}

	const isBossFight = s.mode === 'boss';
	if (isBossFight && s.bossFirstFightBlockedCapture) {
		await markBossFightDone(s.regionId);
	}

	if (s.status === 'defeat') {
		const defeatedPkm = s.player.pokemon;
		void import('./relationship.svelte').then((m) => m.maybeRollEvent('defeat', defeatedPkm));
		await setPokemonCurrentHp(s.player.pokemon.id, 0);
		setActivePokemon(null);
		// Lose ONLY the non-starter cards that were equipped in the active deck.
		// Inventory cards that were not in the deck are kept.
		const deck = await getActiveDeck();
		for (const card of deck) {
			if (getTemplate(card.templateId)?.rarity !== 'starter') {
				await removeFromInventory(card.id);
			}
		}
		await resetDeckToStarters();
		if (browser) {
			posthog.capture('battle_lost', {
				region_id: s.regionId,
				mode: s.mode,
				turn_number: s.turnNumber,
				player_element: s.player.pokemon.element,
				enemy_element: s.enemy.pokemon.element
			});
		}
		return;
	}

	await syncPlayerHp();

	const moneyMultiplier = 1 + (game.player?.ngu.moneyMultiplierLevel ?? 0) * 0.5;
	const money = Math.floor((s.enemy.pokemon.maxHp * 0.5 + randomInt(5, 15)) * moneyMultiplier);
	addMoney(money);

	let captured: CapturedPokemon | null = null;
	if (s.status === 'captured') {
		captured = {
			...s.enemy.pokemon,
			id: crypto.randomUUID(),
			capturedAt: now(),
			currentHp: s.enemy.pokemon.maxHp
		};
		ensurePokemonNatures(captured);
		await addPokemon(captured);
		addToRoster(captured);
	}

	if (!isBossFight) {
		const total = await incrementDefeat(s.regionId);
		recordDefeat(s.regionId, total);
	} else {
		await markBossDefeated(s.regionId);
	}

	let unlockedRegionName: string | null = null;
	const region = getRegion(s.regionId);
	const progress = await getRegionProgress(s.regionId);
	recordDefeat(s.regionId, progress.defeats);
	if (region && progress.defeats >= region.requiredDefeats && progress.bossLastDefeatedAt > 0) {
		const next = nextRegion(s.regionId);
		if (next && !(game.player?.unlockedRegions.includes(next.id) ?? false)) {
			unlockRegion(next.id);
			unlockedRegionName = next.name;
		}
	}

	const cardChoices: BossCardReward[] = s.status === 'victory'
		? pickVictoryRewardChoices(s.enemy.pokemon.element, isBossFight, 3)
		: [];

	battle.reward = {
		money,
		captured,
		unlockedRegionName,
		cardReward: null,
		cardChoices
	};

	const victorPkm = s.player.pokemon;
	void import('./relationship.svelte').then((m) => m.maybeRollEvent('victory', victorPkm));

	if (browser) {
		if (s.status === 'captured') {
			posthog.capture('pokemon_captured', {
				pokemon_name: s.enemy.pokemon.name,
				pokemon_element: s.enemy.pokemon.element,
				region_id: s.regionId
			});
		} else {
			posthog.capture('battle_won', {
				region_id: s.regionId,
				mode: s.mode,
				turn_number: s.turnNumber,
				player_element: s.player.pokemon.element,
				enemy_element: s.enemy.pokemon.element,
				money_earned: money
			});
		}
		if (unlockedRegionName) {
			posthog.capture('region_unlocked', { region_name: unlockedRegionName });
		}
	}
}

export async function claimRewardCard(templateId: string): Promise<void> {
	if (!battle.reward) return;
	if (battle.reward.cardReward) return;
	const chosen = battle.reward.cardChoices.find((c) => c.templateId === templateId);
	if (!chosen) return;
	await addToInventory({ id: crypto.randomUUID(), templateId: chosen.templateId });
	battle.reward.cardReward = chosen;
	void persistBattle();
}
