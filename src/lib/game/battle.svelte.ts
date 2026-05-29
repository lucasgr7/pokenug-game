import { getActiveDeck } from '$lib/db/cards';
import { resetDeckToStarters } from '$lib/db/cards';
import { addPokemon } from '$lib/db/pokemon';
import { incrementDefeat } from '$lib/db/regions';
import { clearSavedBattle, getSavedBattle, saveBattle } from '$lib/db/battle';
import { getTemplate } from '$lib/data/cards';
import { getRegion, nextRegion } from '$lib/data/regions';
import { fetchPokemon } from '$lib/api/pokeapi';
import { effectiveness } from './type-chart';
import { pick, randomInt, shuffle, weightedPick } from '$lib/utils/rng';
import { clamp } from '$lib/utils/math';
import { now } from '$lib/utils/time';
import {
	activePokemon,
	addMoney,
	addToRoster,
	game,
	recordDefeat,
	unlockRegion
} from './state.svelte';
import type {
	BattleReward,
	BattleState,
	Card,
	CapturedPokemon,
	EnemyIntent,
	SavedBattle
} from './types';

interface BattleStore {
	state: BattleState | null;
	reward: BattleReward | null;
	settled: boolean;
	// Sinaliza animações para a UI.
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

// ---- Intents do inimigo ----
function rollIntent(enemyHp: number, enemyMaxHp: number, turnNumber: number): EnemyIntent {
	const ratio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 1;
	// Inimigo defende mais quando está com pouca vida.
	const defendWeight = ratio < 0.35 ? 0.4 : 0.2;
	const kind = weightedPick(['attack', 'defend', 'buff'] as const, [0.6, defendWeight, 0.15]);
	if (kind === 'attack') {
		return { kind: 'attack', damage: randomInt(5, 9) + Math.floor(enemyMaxHp / 20) + Math.floor(turnNumber * 0.5) };
	}
	if (kind === 'defend') {
		return { kind: 'defend', block: randomInt(4, 8) };
	}
	return { kind: 'buff', nextDamage: randomInt(3, 6) };
}

// ---- Início ----
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

	const enemy: CapturedPokemon = {
		id: crypto.randomUUID(),
		speciesId,
		name: enemyData.name,
		element: enemyData.element,
		maxHp: enemyData.maxHp,
		capturedAt: now()
	};

	const deckCards = shuffle(await getActiveDeck());

	const state: BattleState = {
		regionId,
		player: {
			pokemon: { ...mine },
			hp: mine.maxHp, // HP não persiste entre batalhas
			block: 0,
			mana: START_MANA,
			maxMana: 3,
			nextDamageBonus: 0
		},
		enemy: {
			pokemon: enemy,
			hp: enemy.maxHp,
			block: 0,
			intent: rollIntent(enemy.maxHp, enemy.maxHp, 1),
			nextDamageBonus: 0
		},
		deck: deckCards,
		hand: [],
		discard: [],
		exhausted: [],
		turn: 'player',
		turnNumber: 1,
		status: 'active'
	};

	battle.state = state;
	battle.reward = null;
	battle.settled = false;
	battle.enemyHurt = 0;
	battle.playerHurt = 0;

	drawCards(HAND_SIZE);
	void persistBattle();
}

/**
 * Ponto de entrada da página: retoma uma batalha ativa salva, ou inicia uma
 * nova para a região. Assim o jogador pode sair e voltar sem perder o estado.
 */
export async function enterBattle(regionId: string): Promise<void> {
	const saved = await getSavedBattle();
	if (saved && saved.state.status === 'active') {
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

async function persistBattle(): Promise<void> {
	if (!battle.state) return;
	const snapshot = $state.snapshot({
		state: battle.state,
		reward: battle.reward,
		settled: battle.settled
	}) as SavedBattle;
	await saveBattle(snapshot);
}

export async function endBattleCleanup(): Promise<void> {
	battle.state = null;
	battle.reward = null;
	battle.settled = false;
	await clearSavedBattle();
}

// ---- Compra de cartas ----
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

// ---- Dano ----
function dealToEnemy(amount: number): void {
	const s = battle.state!;
	const e = s.enemy;
	const afterBlock = amount - e.block;
	e.block = Math.max(0, e.block - amount);
	if (afterBlock > 0) {
		e.hp = Math.max(0, e.hp - afterBlock);
		battle.enemyHurt++;
	}
}

function dealToPlayer(amount: number): void {
	const s = battle.state!;
	const p = s.player;
	const afterBlock = amount - p.block;
	p.block = Math.max(0, p.block - amount);
	if (afterBlock > 0) {
		p.hp = Math.max(0, p.hp - afterBlock);
		battle.playerHurt++;
	}
}

// ---- Exaustão ----
function discardOrExhaust(card: Card): void {
	const s = battle.state!;
	const tpl = getTemplate(card.templateId);
	const playerElement = s.player.pokemon.element;
	const recyclable =
		!tpl ||
		tpl.rarity === 'starter' ||
		tpl.element === null ||
		tpl.element === playerElement;
	if (recyclable) s.discard.push(card);
	else s.exhausted.push(card);
}

// ---- Jogar carta ----
export function playCard(cardId: string): void {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') return;
	const idx = s.hand.findIndex((c) => c.id === cardId);
	if (idx < 0) return;
	const card = s.hand[idx];
	const tpl = getTemplate(card.templateId);
	if (!tpl || s.player.mana < tpl.cost) return;

	s.player.mana -= tpl.cost;

	switch (tpl.kind) {
		case 'attack': {
			const base = (tpl.damage ?? 0) + s.player.nextDamageBonus;
			s.player.nextDamageBonus = 0;
			const mult = tpl.element
				? effectiveness(tpl.element, s.enemy.pokemon.element)
				: 1;
			dealToEnemy(Math.round(base * mult));
			break;
		}
		case 'defense':
			s.player.block += tpl.block ?? 0;
			break;
		case 'heal':
			s.player.hp = Math.min(s.player.pokemon.maxHp, s.player.hp + (tpl.healHp ?? 0));
			break;
		case 'buff':
			s.player.nextDamageBonus += tpl.buffAmount ?? 0;
			break;
		case 'capture': {
			const ratio = s.enemy.pokemon.maxHp > 0 ? s.enemy.hp / s.enemy.pokemon.maxHp : 0;
			const chance = clamp(1 - ratio + (tpl.captureBonus ?? 0), 0, 1);
			if (Math.random() < chance) {
				s.status = 'captured';
			}
			break;
		}
	}

	// Remove a carta da mão e a recicla/exaure.
	s.hand.splice(idx, 1);
	discardOrExhaust(card);

	if (s.status === 'captured') {
		void persistBattle();
		return;
	}
	if (s.enemy.hp <= 0) {
		s.status = 'victory';
	}
	void persistBattle();
}

// ---- Fim de turno do jogador / turno do inimigo ----
export function endTurn(): void {
	const s = battle.state;
	if (!s || s.status !== 'active' || s.turn !== 'player') return;

	s.turn = 'enemy';
	s.enemy.block = 0; // bloqueio reseta no início do próprio turno

	const intent = s.enemy.intent;
	if (intent.kind === 'attack') {
		const dmg = intent.damage + s.enemy.nextDamageBonus;
		s.enemy.nextDamageBonus = 0;
		dealToPlayer(dmg);
	} else if (intent.kind === 'defend') {
		s.enemy.block += intent.block;
	} else {
		s.enemy.nextDamageBonus += intent.nextDamage;
	}

	if (s.player.hp <= 0) {
		s.status = 'defeat';
		void persistBattle();
		return;
	}

	// Próximo intent.
	s.enemy.intent = rollIntent(s.enemy.hp, s.enemy.pokemon.maxHp, s.turnNumber);

	// Início do turno do jogador.
	s.turnNumber++;
	s.player.block = 0;
	s.player.mana = START_MANA;
	s.turn = 'player';
	drawCards(HAND_SIZE - s.hand.length);
	void persistBattle();
}

// ---- Liquidação de recompensas ----
export async function finalizeBattle(): Promise<void> {
	const s = battle.state;
	if (!s || battle.settled) return;
	if (s.status === 'active') return;
	battle.settled = true;
	// A batalha foi decidida; remove o estado salvo para não retomar uma luta encerrada.
	await clearSavedBattle();

	if (s.status === 'defeat') {
		await resetDeckToStarters();
		return;
	}

	// Vitória ou captura.
	const money = Math.floor(s.enemy.pokemon.maxHp * 0.5 + randomInt(5, 15));
	addMoney(money);

	let captured: CapturedPokemon | null = null;
	if (s.status === 'captured') {
		captured = { ...s.enemy.pokemon, id: crypto.randomUUID(), capturedAt: now() };
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

	battle.reward = { money, captured, unlockedRegionName };
}
