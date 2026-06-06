import {
	battle,
	startMissingNoBattle,
	swapActiveFighter,
	setOnMissingNoDefeat
} from './battle.svelte';
import { clearSavedBattle } from '$lib/db/battle';
import { game, removeFromRosterMemory, restorePokemon, purgePokemon } from './state.svelte';
import { playMissingNoIntro, playMissingNoBattle, stopMusic, playSfx } from './music.svelte';
import { selectAtStake, AT_STAKE_COUNT, PICK_COUNT, ACT2_DEFEAT_HOLD_MS } from '$lib/data/missingno';
import type { CapturedPokemon } from './types';

let speechKey = 0;

type Beat =
	| { kind: 'speech'; text: string; speaker: string; isAlly: boolean }
	| { kind: 'action'; run: () => void };

let beats: Beat[] = [];

function speech(text: string, speaker = 'M1SS1NGN0.', isAlly = false): Beat {
	return { kind: 'speech', text, speaker, isAlly };
}

function action(run: () => void): Beat {
	return { kind: 'action', run };
}

export function advance(): void {
	while (beats.length) {
		const b = beats.shift()!;
		if (b.kind === 'action') { b.run(); continue; }
		mn.speech = { text: b.text, speaker: b.speaker, isAlly: b.isAlly, key: ++speechKey };
		return;
	}
	mn.speech = null;
}

function queue(newBeats: Beat[]): void {
	beats = newBeats;
	advance();
}

function wipeDeck(): void {
	const s = battle.state;
	if (!s) return;
	s.deck = [];
	s.hand = [];
	s.discard = [];
	s.exhausted = [];
}

export type Act2Phase = 'none' | 'defeat' | 'shatter' | 'bubbles';

export const mn = $state({
	active: false,
	act: 0,
	party: [] as CapturedPokemon[],
	snapshots: [] as CapturedPokemon[],
	fallen: [] as string[],
	pickOptions: [] as CapturedPokemon[],
	awaitingPick: false,
	speech: null as null | { speaker: string; text: string; isAlly: boolean; key: number },
	act2Phase: 'none' as Act2Phase
});

export async function startMissingNo(): Promise<void> {
	if (battle.state) return;

	const roster = [...game.roster];
	const party = selectAtStake(roster);
	const snapshots = party.map((p) => $state.snapshot(p) as CapturedPokemon);

	mn.active = true;
	mn.act = 0;
	mn.party = party;
	mn.snapshots = snapshots;
	mn.fallen = [];
	mn.awaitingPick = false;
	mn.pickOptions = [];
	mn.act2Phase = 'none';

	setOnMissingNoDefeat(() => eliminateActive());

	// Garante que nenhuma batalha salva anterior interfira
	await clearSavedBattle();

	stopMusic();

	await startMissingNoBattle(party[0]);

	playMissingNoIntro();

	void startAct1();
}

function startAct1(): void {
	mn.act = 1;

	queue([
		speech('V0CÊ 0US0U V1R 4TÉ 4QU1?'),
		speech('S3U D3ST1N0 É S3R 4P4G4D0.'),
		action(() => { playSfx('/mp3/card-sweep.mp3'); wipeDeck(); }),
		speech('S3US D4D0S F0R4M 4P4G4D0S.'),
		action(() => {
			if (battle.state) {
				battle.state.player.hp = 0;
				battle.playerHurt++;
			}
		}),
		speech('J4 4C4B0U?'),
		action(runAct2),
	]);
}

function runAct2(): void {
	mn.act = 2;
	mn.act2Phase = 'defeat';
	mn.speech = null;
	stopMusic();

	setTimeout(() => {
		mn.act2Phase = 'shatter';
		setTimeout(() => {
			mn.act2Phase = 'bubbles';
			playMissingNoBattle();
			const allies = mn.party.slice(0, 5);
			queue([
				speech('...4IND4 NÃO 4C4B0U.', '', false),
				...allies.map((a) => speech(`${a.name}: É a minha vez.`, a.name, true)),
				action(() => enterCycle()),
			]);
		}, 700);
	}, ACT2_DEFEAT_HOLD_MS);
}

function enterCycle(): void {
	mn.act = 3;
	presentPick();
}

function presentPick(): void {
	const available = mn.party.filter((p) => !mn.fallen.includes(p.id));
	const pickCount = Math.min(PICK_COUNT, available.length);
	const picked: CapturedPokemon[] = [];
	const pool = [...available];
	for (let i = 0; i < pickCount; i++) {
		if (pool.length === 0) break;
		const idx = Math.floor(Math.random() * pool.length);
		picked.push(pool.splice(idx, 1)[0]);
	}
	mn.pickOptions = picked;
	mn.awaitingPick = true;
}

export async function choosePokemon(pkm: CapturedPokemon): Promise<void> {
	mn.awaitingPick = false;
	mn.pickOptions = [];

	await swapActiveFighter(pkm);

	queue([
		speech(`${pkm.name}... D3L3T1NG.`),
	]);
}

function eliminateActive(): void {
	const s = battle.state;
	if (!s) return;

	const currentId = s.player.pokemon.id;

	playSfx('/mp3/pokemon-delete.mp3');

	removeFromRosterMemory(currentId);
	mn.fallen = [...mn.fallen, currentId];

	if (mn.fallen.length >= AT_STAKE_COUNT || mn.fallen.length >= mn.party.length) {
		queue([
			speech(`${s.player.pokemon.name} foi corrompido.`, 'SISTEMA', false),
			action(() => { void loseMissingNo(); }),
		]);
	} else {
		queue([
			speech(`${s.player.pokemon.name} foi corrompido.`, 'SISTEMA', false),
			action(() => { presentPick(); }),
		]);
	}
}

export async function winMissingNo(): Promise<void> {
	const s = battle.state;
	if (!s) return;

	mn.active = false;
	mn.act = 0;
	mn.awaitingPick = false;
	mn.pickOptions = [];
	beats = [];
	mn.speech = null;

	// Restore only fallen Pokémon — survivors were never removed
	for (const id of mn.fallen) {
		const snapshot = mn.snapshots.find((p) => p.id === id);
		if (snapshot) await restorePokemon(snapshot);
	}
	// Apply Corrompido to survivors too (they need the mark even though they never fell)
	for (const snap of mn.snapshots) {
		if (!mn.fallen.includes(snap.id)) {
			snap.corrupted = true;
		}
	}

	mn.act2Phase = 'none';
	playSfx('/mp3/battle-victory.mp3');
	s.status = 'victory';
}

async function loseMissingNo(): Promise<void> {
	const s = battle.state;
	if (!s) return;

	mn.active = false;
	mn.act = 0;
	mn.awaitingPick = false;
	mn.pickOptions = [];
	beats = [];
	mn.speech = null;
	mn.act2Phase = 'none';

	for (const id of mn.fallen) {
		await purgePokemon(id);
	}

	playSfx('/mp3/battle-lost.mp3');
	s.status = 'defeat';
}
