import { vi } from 'vitest';
import {
	HAND_SIZE,
	START_MANA,
	drawCards,
	effectiveCardCost,
	endTurnOn,
	playCardOn,
	playRelicOn,
	wireCombat,
	type EnemyTurnResult,
	type PlayCardResult
} from '$lib/game/combat';
import { getTemplate } from '$lib/data/cards';
import { addStatus, getStatus, hasStatus } from '$lib/game/status/pipeline';
import { getElementInteraction } from '$lib/game/type-chart';
import type {
	ActiveStatus,
	BattleMode,
	BattleState,
	Card,
	CapturedPokemon,
	Element,
	EnemyIntent
} from '$lib/game/types';
import { ELEMENTS } from '$lib/game/types';

/**
 * Harness de testes do motor de combate. Monta um `BattleState` mínimo e
 * dirige o motor real (`$lib/game/combat`) — nada é reimplementado aqui.
 *
 * Uso típico:
 *
 *   const b = testBattle({ hand: ['water_splash'] });
 *   b.play('water_splash');
 *   expect(b.enemy.damageTaken).toBe(4);
 *   expect(b.hand).toHaveLength(1); // comprou 1 carta? não — deck vazio
 *
 * Defaults pensados para DX:
 * - O elemento do pokémon do jogador é derivado da primeira carta elemental
 *   da mão (evita exhaust por desalinhamento sem configuração extra).
 * - O elemento do inimigo é escolhido com efetividade neutra (1x) contra o
 *   elemento do jogador, então `damageTaken === tpl.damage` por padrão.
 *   Para testar fraqueza/resistência, passe `enemy: { element: ... }`.
 */

let cardSeq = 0;

/** Cria uma instância de carta para a mão/deck. Aceita upgrades/modifier. */
export function card(templateId: string, extra: Partial<Omit<Card, 'templateId'>> = {}): Card {
	if (!getTemplate(templateId)) {
		throw new Error(`Template de carta desconhecido: "${templateId}"`);
	}
	return { id: `test-card-${++cardSeq}`, templateId, ...extra };
}

function toCards(refs: Array<string | Card> = []): Card[] {
	return refs.map((r) => (typeof r === 'string' ? card(r) : r));
}

export interface FighterOptions {
	element?: Element;
	maxHp?: number;
	hp?: number;
}

export interface TestBattleOptions {
	player?: FighterOptions & {
		mana?: number;
		block?: number;
		corrupted?: boolean;
		/** Statuses iniciais, ex.: [['empowered', 5]] ou ['berserk'] */
		statuses?: Array<string | [id: string, stacks: number]>;
	};
	enemy?: FighterOptions & {
		block?: number;
		intent?: EnemyIntent;
		statuses?: Array<string | [id: string, stacks: number]>;
	};
	hand?: Array<string | Card>;
	deck?: Array<string | Card>;
	discard?: Array<string | Card>;
	exhausted?: Array<string | Card>;
	relics?: Array<string | Card>;
	mode?: BattleMode;
	bossFirstFightBlockedCapture?: boolean;
}

function makePokemon(element: Element, maxHp: number, name: string): CapturedPokemon {
	return {
		id: `test-pkm-${name}`,
		speciesId: 1,
		name,
		element,
		maxHp,
		currentHp: maxHp,
		capturedAt: 0
	};
}

/** Primeiro elemento com efetividade neutra (1x) nos dois sentidos contra `el`. */
function neutralElementAgainst(el: Element): Element {
	const neutral = ELEMENTS.find(
		(candidate) =>
			getElementInteraction(el, candidate).multiplier === 1 &&
			getElementInteraction(candidate, el).multiplier === 1
	);
	return neutral ?? 'normal';
}

function deriveHandElement(hand: Card[]): Element {
	for (const c of hand) {
		const el = getTemplate(c.templateId)?.element;
		if (el) return el;
	}
	return 'normal';
}

function applyStatuses(
	holder: { statuses: ActiveStatus[] },
	statuses: Array<string | [id: string, stacks: number]> = []
): void {
	for (const st of statuses) {
		if (typeof st === 'string') addStatus(holder, st);
		else addStatus(holder, st[0], st[1]);
	}
}

interface FighterView {
	hp: number;
	maxHp: number;
	block: number;
	/** Dano líquido de HP sofrido desde o início do teste. */
	damageTaken: number;
	statuses: ActiveStatus[];
	has(statusId: string): boolean;
	/** Stacks do status (0 quando ausente). */
	stacks(statusId: string): number;
	statusData(statusId: string): Record<string, number> | undefined;
}

export class TestBattle {
	readonly state: BattleState;
	/** Resultado da última jogada (play/playRelic/endTurn). */
	lastResult: PlayCardResult | EnemyTurnResult | null = null;

	private playerStartHp: number;
	private enemyStartHp: number;

	constructor(opts: TestBattleOptions = {}) {
		const hand = toCards(opts.hand);
		const playerElement = opts.player?.element ?? deriveHandElement(hand);
		const enemyElement = opts.enemy?.element ?? neutralElementAgainst(playerElement);
		const playerMaxHp = opts.player?.maxHp ?? 100;
		const enemyMaxHp = opts.enemy?.maxHp ?? 100;

		const playerPokemon = makePokemon(playerElement, playerMaxHp, 'Atacante');
		if (opts.player?.corrupted) playerPokemon.corrupted = true;

		this.state = {
			regionId: 'test-region',
			mode: opts.mode ?? 'normal',
			bossFirstFightBlockedCapture: opts.bossFirstFightBlockedCapture ?? false,
			player: {
				pokemon: playerPokemon,
				hp: opts.player?.hp ?? playerMaxHp,
				block: opts.player?.block ?? 0,
				mana: opts.player?.mana ?? START_MANA,
				maxMana: 3,
				poisonCounter: 0,
				ghostPermDebuff: 0,
				statuses: [],
				turnFlags: {
					firstAttackThisTurn: true,
					damageSufferedThisTurn: false,
					damageReceivedLastTurn: 0,
					cardsPlayedThisTurn: 0
				}
			},
			enemy: {
				pokemon: makePokemon(enemyElement, enemyMaxHp, 'Defensor'),
				hp: opts.enemy?.hp ?? enemyMaxHp,
				block: opts.enemy?.block ?? 0,
				intent: opts.enemy?.intent ?? { kind: 'attack', damage: 6, element: enemyElement },
				nextDamageBonus: 0,
				poisonCounter: 0,
				statuses: []
			},
			deck: toCards(opts.deck),
			hand,
			discard: toCards(opts.discard),
			exhausted: toCards(opts.exhausted),
			relicSlots: toCards(opts.relics),
			turn: 'player',
			turnNumber: 1,
			status: 'active',
			usedPowerIds: [],
			bannedTemplateIds: [],
			pilhaExaurir: 0
		};

		this.playerStartHp = this.state.player.hp;
		this.enemyStartHp = this.state.enemy.hp;

		wireCombat(this.state);
		applyStatuses(this.state.player, opts.player?.statuses);
		applyStatuses(this.state.enemy, opts.enemy?.statuses);
	}

	// ── Leitura ───────────────────────────────────────────────────────────

	get player(): FighterView & { mana: number } {
		const p = this.state.player;
		const startHp = this.playerStartHp;
		return {
			get hp() { return p.hp; },
			get maxHp() { return p.pokemon.maxHp; },
			get block() { return p.block; },
			get mana() { return p.mana; },
			get damageTaken() { return Math.max(0, startHp - p.hp); },
			get statuses() { return p.statuses; },
			has: (id) => hasStatus(p, id),
			stacks: (id) => getStatus(p, id)?.stacks ?? 0,
			statusData: (id) => getStatus(p, id)?.data
		};
	}

	get enemy(): FighterView {
		const e = this.state.enemy;
		const startHp = this.enemyStartHp;
		return {
			get hp() { return e.hp; },
			get maxHp() { return e.pokemon.maxHp; },
			get block() { return e.block; },
			get damageTaken() { return Math.max(0, startHp - e.hp); },
			get statuses() { return e.statuses; },
			has: (id) => hasStatus(e, id),
			stacks: (id) => getStatus(e, id)?.stacks ?? 0,
			statusData: (id) => getStatus(e, id)?.data
		};
	}

	/** Template ids das cartas na mão, na ordem. */
	get hand(): string[] {
		return this.state.hand.map((c) => c.templateId);
	}

	get deck(): string[] {
		return this.state.deck.map((c) => c.templateId);
	}

	get discardPile(): string[] {
		return this.state.discard.map((c) => c.templateId);
	}

	get exhaustedPile(): string[] {
		return this.state.exhausted.map((c) => c.templateId);
	}

	get status(): BattleState['status'] {
		return this.state.status;
	}

	// ── Ações ─────────────────────────────────────────────────────────────

	/**
	 * Joga uma carta da mão (por templateId ou índice). Lança erro legível
	 * quando a jogada é recusada — use `tryPlay` para testar recusas.
	 */
	play(ref: string | number, opts: { expectFail?: false } = {}): PlayCardResult {
		void opts;
		const cardInHand = this.findInHand(ref);
		if (!cardInHand) {
			throw new Error(
				`Carta "${ref}" não está na mão. Mão atual: [${this.hand.join(', ') || 'vazia'}]`
			);
		}
		const result = playCardOn(this.state, cardInHand.id);
		if (!result.played) {
			throw new Error(this.diagnoseRefusal(cardInHand));
		}
		this.lastResult = result;
		return result;
	}

	/** Tenta jogar sem lançar erro — para testar recusas (mana, power repetida…). */
	tryPlay(ref: string | number): PlayCardResult {
		const cardInHand = this.findInHand(ref);
		if (!cardInHand) return { played: false, exhausted: false, kind: 'attack' };
		const result = playCardOn(this.state, cardInHand.id);
		this.lastResult = result;
		return result;
	}

	playRelic(templateId: string): PlayCardResult {
		const relic = this.state.relicSlots.find((c) => c.templateId === templateId);
		if (!relic) {
			throw new Error(
				`Relíquia "${templateId}" não está nos slots. Slots: [${this.state.relicSlots.map((c) => c.templateId).join(', ') || 'vazios'}]`
			);
		}
		const result = playRelicOn(this.state, relic.id);
		this.lastResult = result;
		return result;
	}

	/**
	 * Encerra o turno do jogador e resolve o turno inimigo usando a intenção
	 * atual (`state.enemy.intent`). A próxima intenção é determinística:
	 * `nextIntent` ou um buff inerte de 0.
	 */
	endTurn(nextIntent: EnemyIntent = { kind: 'buff', nextDamage: 0 }): EnemyTurnResult {
		const result = endTurnOn(this.state, () => nextIntent);
		if (!result) {
			throw new Error(`endTurn recusado: status=${this.state.status}, turn=${this.state.turn}`);
		}
		this.lastResult = result;
		return result;
	}

	/** Define a intenção do inimigo para o próximo endTurn. */
	setEnemyIntent(intent: EnemyIntent): void {
		this.state.enemy.intent = intent;
	}

	draw(count: number): void {
		drawCards(this.state, count);
	}

	giveCard(templateId: string, extra: Partial<Omit<Card, 'templateId'>> = {}): Card {
		const c = card(templateId, extra);
		this.state.hand.push(c);
		return c;
	}

	addPlayerStatus(id: string, stacks = 1, data?: Record<string, number>): void {
		addStatus(this.state.player, id, stacks, data);
	}

	addEnemyStatus(id: string, stacks = 1, data?: Record<string, number>): void {
		addStatus(this.state.enemy, id, stacks, data);
	}

	costOf(templateId: string): number {
		return effectiveCardCost(this.state, { templateId });
	}

	// ── Internos ──────────────────────────────────────────────────────────

	private findInHand(ref: string | number): Card | undefined {
		if (typeof ref === 'number') return this.state.hand[ref];
		return this.state.hand.find((c) => c.templateId === ref);
	}

	private diagnoseRefusal(c: Card): string {
		const s = this.state;
		const tpl = getTemplate(c.templateId)!;
		if (s.status !== 'active') return `Jogada recusada: batalha já terminou (status=${s.status}).`;
		if (s.turn !== 'player') return `Jogada recusada: não é o turno do jogador.`;
		const cost = effectiveCardCost(s, c);
		if (s.player.mana < cost) {
			return `Jogada recusada: mana insuficiente para "${c.templateId}" (custo ${cost}, mana ${s.player.mana}).`;
		}
		if (tpl.isPower && s.usedPowerIds.includes(tpl.id)) {
			return `Jogada recusada: POWER "${tpl.id}" já foi usada neste combate.`;
		}
		return `Jogada recusada para "${c.templateId}" por motivo desconhecido — investigue playCardOn.`;
	}
}

export function testBattle(opts: TestBattleOptions = {}): TestBattle {
	return new TestBattle(opts);
}

/**
 * Substitui Math.random pelos valores dados (em sequência; o último se
 * repete). Retorna função de restauração — ou use dentro de um teste e deixe
 * o `vi.restoreAllMocks` do afterEach limpar.
 *
 *   stubRandom(0); // captura sempre sucede, sorteios pegam o primeiro item
 */
export function stubRandom(...values: number[]): () => void {
	let i = 0;
	const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
		const v = values[Math.min(i, values.length - 1)];
		i++;
		return v;
	});
	return () => spy.mockRestore();
}
