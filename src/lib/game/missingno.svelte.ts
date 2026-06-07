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

function narrate(text: string): Beat {
	return { kind: 'speech', text, speaker: 'NARRADOR', isAlly: false };
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

			const first = mn.party[0];
			const act2Beats: Beat[] = [
				speech('...41ND4 N40 4C4B0U?', 'M1SS1NGN0.', false),
				narrate('O treinador foi apagado. Mas a equipe dele não se desfez.'),
				narrate(`${first?.name ?? 'O primeiro'} avança sozinho, sem esperar nenhuma ordem.`),
				speech('0S D4D0S F0R4M 4P4G4D0S. P0R QU3 41ND4 R3S1ST3M?', 'M1SS1NGN0.', false),
				narrate(
					'Um a um, os outros tomam a frente — dispostos a se apagar para que ele continue existindo.'
				),
				speech('3RR0. 3RR0. 1ST0 N40 D3V3R14 4C0NT3C3R.', 'M1SS1NGN0.', false),
				narrate('Cada escolha agora custa um deles. Resista enquanto houver quem fique de pé.'),
				action(() => enterCycle())
			];

			queue(act2Beats);
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
