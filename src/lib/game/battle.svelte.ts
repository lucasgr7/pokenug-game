import { getActiveDeck, getInventory, removeFromDeck, removeFromInventory } from '$lib/db/cards';
import { resetDeckToStarters } from '$lib/db/cards';
import { addPokemon } from '$lib/db/pokemon';
import { incrementDefeat } from '$lib/db/regions';
import { clearSavedBattle, getSavedBattle, saveBattle } from '$lib/db/battle';
import { getTemplate } from '$lib/data/cards';
import { getRegion, nextRegion, getRegionScaling } from '$lib/data/regions';
import { fetchPokemon } from '$lib/api/pokeapi';
import { effectiveness } from './type-chart';
import { pick, randomInt, shuffle, weightedPick } from '$lib/utils/rng';
import { clamp } from '$lib/utils/math';
import { now } from '$lib/utils/time';
import {
	activePokemon,
	addElementPoints,
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
	BattleReward,
	BattleState,
	Card,
	CardKind,
	CardTemplate,
	CapturedPokemon,
	EnemyIntent,
	SavedBattle
} from './types';

interface BattleStore {
	state: BattleState | null;
	reward: BattleReward | null;
	settled: boolean;
	// Toggled each hit to drive Svelte #key animations in the battle UI.
	enemyHurt: number;
	playerHurt: number;
}

export const battle = $state<BattleStore>({
	state: null,
	reward: null,
	settled: false,
	enemyHurt: 0,
	playerHurt: 0
});

const HAND_SIZE = 5;
const START_MANA = 3;
// NGU scaling constants — tune here if balancing is needed.
const GLOBAL_DAMAGE_PER_LEVEL = 3;
const DAMAGE_PER_POKEMON_BUFF = 2;
const ELEMENT_POINTS_PER_MAX_HP = 15; // floor(enemyMaxHp / this) = element points awarded

export interface PlayCardResult {
	played: boolean;
	exhausted: boolean;
	kind: CardKind;
}

// ── Enemy intent ──────────────────────────────────────────────────────────

function rollIntent(enemyHp: number, enemyMaxHp: number, turnNumber: number, scaling: number): EnemyIntent {
	const ratio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 1;
	// Enemy is more defensive when low on HP.
	const defendWeight = ratio < 0.35 ? 0.4 : 0.2;
	const kind = weightedPick(['attack', 'defend', 'buff'] as const, [0.6, defendWeight, 0.15]);
	if (kind === 'attack') {
		const baseDmg = randomInt(5, 9) + Math.floor(enemyMaxHp / (20 * scaling)) + Math.floor(turnNumber * 0.5);
		return { kind: 'attack', damage: Math.ceil(baseDmg * scaling) };
	}
	if (kind === 'defend') return { kind: 'defend', block: Math.ceil(randomInt(4, 8) * scaling) };
	return { kind: 'buff', nextDamage: Math.ceil(randomInt(3, 6) * scaling) };
}

// ── Card draw ─────────────────────────────────────────────────────────────

function drawCards(count: number): void {
	const s = battle.state;
	if (!s) return;
	for (let i = 0; i < count; i++) {
		if (s.deck.length === 0) {
			if (s.discard.length === 0) break;
			s.deck = shuffle(s.discard);
			s.discard = [];
		}
		const card = s.deck.pop();
		if (card) s.hand.push(card);
	}
}

// ── Damage ────────────────────────────────────────────────────────────────

function dealToEnemy(amount: number): void {
	const e = battle.state!.enemy;
	const afterBlock = amount - e.block;
	e.block = Math.max(0, e.block - amount);
	if (afterBlock > 0) {
		e.hp = Math.max(0, e.hp - afterBlock);
		battle.enemyHurt++;
	}
}

function dealToPlayer(amount: number): void {
	const p = battle.state!.player;
	if (p.ghostForm) amount = 1;
	const afterBlock = amount - p.block;
	p.block = Math.max(0, p.block - amount);
	if (afterBlock > 0) {
		p.hp = Math.max(0, p.hp - afterBlock);
		battle.playerHurt++;
	}
}

// ── Card exhaustion ───────────────────────────────────────────────────────

function shouldExhaust(card: Card): boolean {
	const s = battle.state!;
	const tpl = getTemplate(card.templateId);
	if (!tpl) return false;
	if (tpl.kind === 'heal') return true;
	// Power, relic, and debuff cards are never exhausted via the normal play path.
	if (tpl.kind === 'power' || tpl.kind === 'relic' || tpl.kind === 'debuff') return false;
	// Non-starter Pokéballs are single-use.
	if (tpl.kind === 'capture' && tpl.rarity !== 'starter') return true;
	// Off-element cards burn out — no affinity, no staying power.
	if (tpl.element !== null && tpl.element !== s.player.pokemon.element) return true;
	return false;
}

function discardOrExhaust(card: Card): boolean {
	const s = battle.state!;
	if (shouldExhaust(card)) {
		s.exhausted.push(card);
		void removeFromDeck(card.id);
		void removeFromInventory(card.id);
		return true;
	}
	s.discard.push(card);
	return false;
}

// ── Card effect ───────────────────────────────────────────────────────────

function playerAttackBonus(): number {
	const s = battle.state!;
	return (
		(game.player?.ngu.globalDamageLevel ?? 0) * GLOBAL_DAMAGE_PER_LEVEL +
		(s.player.pokemon.damageBuffs ?? 0) * DAMAGE_PER_POKEMON_BUFF
	);
}

function applyCardEffect(s: BattleState, tpl: CardTemplate): void {
	switch (tpl.kind) {
		case 'attack': {
			const base = (tpl.damage ?? 0) + s.player.nextDamageBonus + playerAttackBonus();
			s.player.nextDamageBonus = 0;
			let atkElement = tpl.element;
			if (s.player.dragonize && (!atkElement || atkElement === 'normal')) atkElement = 'dragon';
			const mult = atkElement ? effectiveness(atkElement, s.enemy.pokemon.element) : 1;
			const berserkMult = s.player.berserk ? 2 : 1;
			const hits = 1 + s.player.attackRepeat;
			s.player.attackRepeat = 0;
			for (let i = 0; i < hits; i++) dealToEnemy(Math.round(base * mult * berserkMult));
			break;
		}
		case 'defense': {
			const block = tpl.block ?? 0;
			s.player.block += s.player.berserk ? Math.max(1, Math.floor(block / 2)) : block;
			break;
		}
		case 'heal':
			s.player.hp = Math.min(s.player.pokemon.maxHp, s.player.hp + (tpl.healHp ?? 0));
			break;
		case 'buff':
			s.player.nextDamageBonus += tpl.buffAmount ?? 0;
			break;
		case 'capture': {
			const ratio = s.enemy.pokemon.maxHp > 0 ? s.enemy.hp / s.enemy.pokemon.maxHp : 0;
			const chance = clamp(1 - ratio + (tpl.captureBonus ?? 0), 0, 1);
			if (Math.random() < chance) s.status = 'captured';
			break;
		}
		case 'power':
			if (tpl.id === 'power_berserk') s.player.berserk = true;
			if (tpl.id === 'power_dragonize') s.player.dragonize = true;
			break;
		case 'relic':
			s.player.ghostForm = true;
			break;
		case 'energy':
			s.player.mana = Math.min(s.player.mana + (tpl.manaGain ?? 0), 6);
			break;
		case 'combo':
			s.player.attackRepeat = tpl.attackRepeat ?? 1;
			break;
		case 'debuff':
			s.enemy.intimidateTurnsLeft = tpl.debuffDuration ?? 2;
			s.enemy.intimidateDamageReduction = tpl.debuffAmount ?? 0.5;
			break;
	}
}

// ── Persistence ───────────────────────────────────────────────────────────

async function persistBattle(): Promise<void> {
	if (!battle.state) return;
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

// ── Battle lifecycle ──────────────────────────────────────────────────────

export async function startBattle(regionId: string): Promise<void> {
	const region = getRegion(regionId);
	const mine = activePokemon();
	if (!region || !mine) throw new Error('Região ou pokémon ativo inválido');

	const speciesId = pick(region.pool);
	let enemyData;
	try {
		enemyData = await fetchPokemon(speciesId);
	} catch {
		enemyData = { id: speciesId, name: `#${speciesId}`, element: 'normal' as const, maxHp: 40, artworkUrl: '' };
	}

	const scaling = getRegionScaling(regionId);
	const enemy: CapturedPokemon = {
		id: crypto.randomUUID(),
		speciesId,
		name: enemyData.name,
		element: enemyData.element,
		maxHp: enemyData.maxHp * scaling,
		currentHp: enemyData.maxHp * scaling,
		capturedAt: now()
	};

	battle.state = {
		regionId,
		player: {
			pokemon: { ...mine },
			hp: normalizedPokemonHp(mine),
			block: 0,
			mana: START_MANA,
			maxMana: 3,
			nextDamageBonus: 0,
			poisonCounter: 0,
			berserk: false,
			dragonize: false,
			ghostForm: false,
			attackRepeat: 0
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: rollIntent(enemy.maxHp, enemy.maxHp, 1, scaling),
			nextDamageBonus: 0,
			poisonCounter: 0,
			intimidateTurnsLeft: 0,
			intimidateDamageReduction: 0
		},
		deck: shuffle(await getActiveDeck()),
		hand: [],
		discard: [],
		exhausted: [],
		relicSlots: (await getInventory()).filter((c) => getTemplate(c.templateId)?.kind === 'relic'),
		turn: 'player',
		turnNumber: 1,
		status: 'active'
	};
	battle.reward = null;
	battle.settled = false;
	battle.enemyHurt = 0;
	battle.playerHurt = 0;

	drawCards(HAND_SIZE);
	void persistBattle();
}

export async function enterBattle(regionId: string): Promise<void> {
	const saved = await getSavedBattle();
	if (saved?.state.status === 'active') {
		battle.state = saved.state;
		battle.reward = saved.reward;
		battle.settled = saved.settled;
		battle.enemyHurt = 0;
		battle.playerHurt = 0;
		return;
	}
	if (saved) await clearSavedBattle();
	await startBattle(regionId);
}

export async function hasSavedBattle(): Promise<boolean> {
	const saved = await getSavedBattle();
	return !!saved && saved.state.status === 'active';
}

export async function endBattleCleanup(): Promise<void> {
	battle.state = null;
	battle.reward = null;
	battle.settled = false;
	await clearSavedBattle();
}

// ── Player actions ────────────────────────────────────────────────────────

export function playCard(cardId: string): PlayCardResult {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') {
		return { played: false, exhausted: false, kind: 'attack' };
	}
	const idx = s.hand.findIndex((c) => c.id === cardId);
	if (idx < 0) return { played: false, exhausted: false, kind: 'attack' };

	const card = s.hand[idx];
	const tpl = getTemplate(card.templateId);
	if (!tpl || s.player.mana < tpl.cost) return { played: false, exhausted: false, kind: 'attack' };

	s.player.mana -= tpl.cost;
	s.hand.splice(idx, 1);

	applyCardEffect(s, tpl);

	const exhausted = discardOrExhaust(card);

	if (s.enemy.hp <= 0 && s.status === 'active') s.status = 'victory';
	if (tpl.kind === 'heal') void syncPlayerHp();

	void persistBattle();
	return { played: true, exhausted, kind: tpl.kind };
}

export function playRelicCard(cardId: string): PlayCardResult {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') {
		return { played: false, exhausted: false, kind: 'relic' };
	}
	const idx = s.relicSlots.findIndex((c) => c.id === cardId);
	if (idx < 0) return { played: false, exhausted: false, kind: 'relic' };

	const card = s.relicSlots[idx];
	const tpl = getTemplate(card.templateId);
	if (!tpl) return { played: false, exhausted: false, kind: 'relic' };

	s.relicSlots.splice(idx, 1);
	applyCardEffect(s, tpl);
	void removeFromInventory(card.id);

	void persistBattle();
	return { played: true, exhausted: true, kind: 'relic' };
}

export function endTurn(): void {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') return;

	s.turn = 'enemy';
	s.enemy.block = 0;

	const intent = s.enemy.intent;
	if (intent.kind === 'attack') {
		let dmg = intent.damage + s.enemy.nextDamageBonus;
		// Apply intimidate reduction if active
		if (s.enemy.intimidateTurnsLeft > 0) {
			dmg = Math.round(dmg * (1 - s.enemy.intimidateDamageReduction));
			s.enemy.intimidateTurnsLeft--;
		}
		s.enemy.nextDamageBonus = 0;
		dealToPlayer(dmg);
	} else if (intent.kind === 'defend') {
		s.enemy.block += intent.block;
	} else {
		s.enemy.nextDamageBonus += intent.nextDamage;
	}

	if (s.player.hp <= 0) {
		s.status = 'defeat';
		void setPokemonCurrentHp(s.player.pokemon.id, 0);
		void persistBattle();
		return;
	}

	const scaling = getRegionScaling(s.regionId);
	s.enemy.intent = rollIntent(s.enemy.hp, s.enemy.pokemon.maxHp, s.turnNumber, scaling);
	s.turnNumber++;
	s.player.block = 0;
	s.player.mana = START_MANA;
	s.player.ghostForm = false;
	s.turn = 'player';
	drawCards(HAND_SIZE - s.hand.length);
	void persistBattle();
}

// ── Reward settlement ─────────────────────────────────────────────────────

export async function finalizeBattle(): Promise<void> {
	const s = battle.state;
	if (!s || battle.settled || s.status === 'active') return;
	battle.settled = true;
	await clearSavedBattle();

	if (s.status === 'defeat') {
		await setPokemonCurrentHp(s.player.pokemon.id, 0);
		setActivePokemon(null);
		// Power cards exhaust on defeat — remove from inventory across all zones.
		const allCards = [...s.deck, ...s.hand, ...s.discard, ...s.exhausted];
		for (const card of allCards) {
			if (getTemplate(card.templateId)?.kind === 'power') {
				await removeFromInventory(card.id);
			}
		}
		await resetDeckToStarters();
		return;
	}

	await syncPlayerHp();

	const moneyMultiplier = 1 + (game.player?.ngu.moneyMultiplierLevel ?? 0) * 0.5;
	const money = Math.floor((s.enemy.pokemon.maxHp * 0.5 + randomInt(5, 15)) * moneyMultiplier);
	addMoney(money);

	const elementAmount = Math.max(1, Math.floor(s.enemy.pokemon.maxHp / ELEMENT_POINTS_PER_MAX_HP));
	addElementPoints(s.enemy.pokemon.element, elementAmount);

	let captured: CapturedPokemon | null = null;
	if (s.status === 'captured') {
		captured = {
			...s.enemy.pokemon,
			id: crypto.randomUUID(),
			capturedAt: now(),
			currentHp: s.enemy.pokemon.maxHp
		};
		await addPokemon(captured);
		addToRoster(captured);
	}

	const total = await incrementDefeat(s.regionId);
	recordDefeat(s.regionId, total);

	let unlockedRegionName: string | null = null;
	const region = getRegion(s.regionId);
	if (region && total >= region.requiredDefeats) {
		const next = nextRegion(s.regionId);
		if (next && !(game.player?.unlockedRegions.includes(next.id) ?? false)) {
			unlockRegion(next.id);
			unlockedRegionName = next.name;
		}
	}

	battle.reward = {
		money,
		elementPoints: { type: s.enemy.pokemon.element, amount: elementAmount },
		captured,
		unlockedRegionName
	};
}
