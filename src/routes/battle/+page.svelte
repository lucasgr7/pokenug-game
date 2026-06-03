<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Sprite from '$lib/components/Sprite.svelte';
	import Card from '$lib/components/Card.svelte';
	import HpBar from '$lib/components/HpBar.svelte';
	import BattleHandControls from '$lib/components/BattleHandControls.svelte';
	import BattleLogs from '$lib/components/BattleLogs.svelte';
	import ManaCrystal from '$lib/components/ManaCrystal.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import TypeAdvantageAlert from '$lib/components/TypeAdvantageAlert.svelte';
	import {
		battle,
		enterBattle,
		hasSavedBattle,
		playCard,
		playRelicCard,
		repairActiveBattleState,
		type PlayCardResult,
		endTurn,
		finalizeBattle,
		endBattleCleanup
	} from '$lib/game/battle.svelte';
	import { buildEndTurnLog, buildPlayLog, type BattleLogEntry, type LogPart } from '$lib/game/battle-log';
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_LABEL, ELEMENT_EMOJI } from '$lib/game/elements';
	import { getElementInteraction, interactionLabel } from '$lib/game/type-chart';
	import type { BattleMode } from '$lib/game/types';

	let loading = $state(true);
	let error = $state<string | null>(null);

	interface PlayedFx {
		id: string;
		templateId: string;
		exhausted: boolean;
		kind: PlayCardResult['kind'];
	}

	let playedFx = $state<PlayedFx | null>(null);
	let autoConfirm = $state(false);

	// ── Damage / block floats ─────────────────────────────────────────────
	let enemyDmgFloat = $state<{ id: string; amount: number; block?: boolean } | null>(null);
	let playerDmgFloat = $state<{ id: string; amount: number; block?: boolean } | null>(null);

	// ── Turn flash ────────────────────────────────────────────────────────
	let showTurnFlash = $state(false);
	let prevTurn = $state<'player' | 'enemy' | null>(null);

	$effect(() => {
		const turn = s?.turn ?? null;
		if (turn === 'player' && prevTurn === 'enemy') {
			showTurnFlash = true;
			setTimeout(() => { showTurnFlash = false; }, 1100);
		}
		prevTurn = turn;
	});

	let battleLogs = $state<BattleLogEntry[]>([]);

	function addLog(line: LogPart[]) {
		battleLogs = [...battleLogs, { id: crypto.randomUUID(), line }];
		if (battleLogs.length > 3) battleLogs.shift();
	}

	onMount(async () => {
		const regionId = page.url.searchParams.get('region');
		const modeParam = page.url.searchParams.get('mode');
		const mode: BattleMode = modeParam === 'boss' ? 'boss' : 'normal';
		try {
			if (regionId) {
				await enterBattle(regionId, mode);
			} else if (await hasSavedBattle()) {
				// Sem região na URL, mas há uma batalha em andamento: retoma.
				await enterBattle('', 'normal');
			} else {
				await goto('/');
				return;
			}
		} catch (e) {
			console.error(e);
			error = 'Não foi possível iniciar a batalha.';
		}
		loading = false;
	});

	// Liquida recompensas quando a batalha termina.
	$effect(() => {
		const st = battle.state?.status;
		if (st && st !== 'active' && !battle.settled) {
			void finalizeBattle();
		}
	});

	$effect(() => {
		if (battle.state?.status === 'active') {
			repairActiveBattleState();
		}
	});

	let s = $derived(battle.state);
	let ended = $derived(!!s && s.status !== 'active');
	let isBossBattle = $derived(s?.mode === 'boss');

	function intentText(): string {
		if (!s) return '';
		const it = s.enemy.intent;
		if (it.kind === 'attack') {
			const attackElement = it.element ?? s.enemy.pokemon.element;
			const interaction = getElementInteraction(attackElement, s.player.pokemon.element);
			const projectedDamage = Math.max(0, Math.round((it.damage + s.enemy.nextDamageBonus) * interaction.multiplier));
			return `${ELEMENT_EMOJI[attackElement]} ⚔️ ${projectedDamage}`;
		}
		if (it.kind === 'defend') return `🛡️ ${it.block}`;
		return `✨ +${it.nextDamage}`;
	}

	function canPlay(templateId: string): boolean {
		if (!s || s.turn !== 'player' || s.status !== 'active') return false;
		const tpl = getTemplate(templateId);
		return !!tpl && s.player.mana >= tpl.cost;
	}

	function matchupHint(): string {
		if (!s) return '';
		return interactionLabel(s.player.pokemon.element, s.enemy.pokemon.element);
	}

	function onPlayRelic(cardId: string, templateId: string) {
		const res = playRelicCard(cardId);
		if (!res.played) return;
		const fxId = crypto.randomUUID();
		playedFx = { id: fxId, templateId, exhausted: true, kind: 'relic' };
		const tpl = getTemplate(templateId);
		if (tpl) addLog([{ text: `💎 ${tpl.name}`, color: '#6d28d9' }]);
		setTimeout(() => { if (playedFx?.id === fxId) playedFx = null; }, 620);
	}

	function onPlay(cardId: string, templateId: string) {
		const res = playCard(cardId);
		if (!res.played) return;

		const fxId = crypto.randomUUID();
		const tpl = getTemplate(templateId);
		if (tpl) addLog(buildPlayLog(res, tpl.name));
		playedFx = { id: fxId, templateId, exhausted: res.exhausted, kind: res.kind };
		setTimeout(() => {
			if (playedFx?.id === fxId) playedFx = null;
		}, 620);

		// Damage float on enemy sprite
		if (res.damage && res.damage > 0) {
			const floatId = crypto.randomUUID();
			enemyDmgFloat = { id: floatId, amount: res.damage };
			setTimeout(() => { if (enemyDmgFloat?.id === floatId) enemyDmgFloat = null; }, 1000);
		}
	}

	function onCardTap(cardId: string, templateId: string) {
		if (!canPlay(templateId)) return;
		onPlay(cardId, templateId);
	}

	function setAutoConfirm(enabled: boolean) {
		autoConfirm = enabled;
	}

	function handleEndTurn() {
		const res = endTurn();
		if (res) {
			addLog(buildEndTurnLog(res));
			// Damage float on player sprite
			if (res.damage && res.damage > 0) {
				const floatId = crypto.randomUUID();
				playerDmgFloat = { id: floatId, amount: res.damage };
				setTimeout(() => { if (playerDmgFloat?.id === floatId) playerDmgFloat = null; }, 1000);
			} else if (res.absorbed && res.absorbed > 0 && (!res.damage || res.damage === 0)) {
				const floatId = crypto.randomUUID();
				playerDmgFloat = { id: floatId, amount: res.absorbed, block: true };
				setTimeout(() => { if (playerDmgFloat?.id === floatId) playerDmgFloat = null; }, 1000);
			}
		}
	}

	async function leave() {
		await endBattleCleanup();
		await goto('/');
	}
</script>

{#if loading}
	<div class="flex min-h-dvh items-center justify-center text-(--text-muted)">
		Preparando batalha…
	</div>
{:else if error}
	<div class="flex min-h-dvh flex-col items-center justify-center gap-3 p-6">
		<p class="text-(--text-muted)">{error}</p>
		<button class="rounded-xl bg-(--accent) px-4 py-2 font-semibold text-white" onclick={leave}>
			Voltar
		</button>
	</div>
{:else if s}
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		{#if isBossBattle}
			<div class="mx-2 mb-1 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300">
				⚔️ Boss Battle
				{#if s.bossFirstFightBlockedCapture}
					· Primeira luta: captura bloqueada.
				{/if}
			</div>
		{/if}

		<!-- ARENA -->
		<section
			class="arena relative flex-1 overflow-hidden"
		>
			<!-- arena floor glows -->
			<div class="floor enemy" aria-hidden="true"></div>
			<div class="floor player" aria-hidden="true"></div>

			{#if playedFx}
				<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
					<div class="played-card-fx" class:vaporize={playedFx.exhausted}>
						<Card
							templateId={playedFx.templateId}
							playable={false}
							shiny={playedFx.kind === 'defense'}
						/>
					</div>
					{#if playedFx.kind === 'attack'}
						<div class="hit-spark">✦</div>
					{/if}
					{#if playedFx.exhausted}
						<div class="vapor-label">EXAUSTA</div>
					{/if}
				</div>
			{/if}

			<!-- turno -->
			<div
				class="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold text-white backdrop-blur"
			>
				{#if isBossBattle}<span class="mr-1 text-amber-300">BOSS</span>{/if}
				Turno {s.turnNumber}
				{#if matchupHint()}<span class="ml-1 text-amber-300">· {matchupHint()}</span>{/if}
			</div>

			<!-- SEU TURNO flash -->
			{#if showTurnFlash}
				<div class="turn-flash" aria-hidden="true">
					<span class="turn-flash-text">SEU TURNO</span>
				</div>
			{/if}

			<!-- INFO INIMIGO (canto superior esquerdo) -->
			<div class="absolute left-2 top-2 z-10 w-[58%] max-w-65">
				<div class="rounded-xl border border-(--border) bg-(--surface)/85 p-2 shadow-lg backdrop-blur">
					<div class="mb-1 flex items-center justify-between gap-1">
						<span class="truncate text-xs font-bold">{s.enemy.pokemon.name}</span>
						<span class="shrink-0 text-[10px] text-(--text-muted)"
							>{ELEMENT_EMOJI[s.enemy.pokemon.element]}</span
						>
					</div>
					<HpBar hp={s.enemy.hp} maxHp={s.enemy.pokemon.maxHp} block={s.enemy.block} />
					<div class="mt-1 flex items-center gap-1 text-[11px] font-bold text-(--danger)">
						<span class="rounded bg-(--danger)/15 px-1.5 py-0.5">Intenção {intentText()}</span>
					</div>
					<TypeAdvantageAlert attacker={s.enemy.pokemon.element} defender={s.player.pokemon.element} />
					{#if s.enemy.intimidateTurnsLeft > 0}
						<div class="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-400">
							<span class="rounded bg-red-400/15 px-1.5 py-0.5">👤 Intimidado {s.enemy.intimidateTurnsLeft}t</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- SPRITE INIMIGO (canto superior direito) -->
			<div class="absolute right-1 top-12 z-0">
				<div class="platform"></div>
				{#key battle.enemyHurt}
					<div class="shake-host hit-host">
						<Sprite speciesId={s.enemy.pokemon.speciesId} size={120} alt={s.enemy.pokemon.name} />
					</div>
				{/key}
				{#if enemyDmgFloat}
					{#key enemyDmgFloat.id}
						<div class="dmg-float" style="color: #ff6e5a; right: 10px; top: 20px;">
							{enemyDmgFloat.amount}
						</div>
					{/key}
				{/if}
			</div>

			<!-- SPRITE JOGADOR (canto inferior esquerdo) -->
			<div class="absolute bottom-1 left-1 z-0">
				<div class="platform"></div>
				{#key battle.playerHurt}
					<div class="shake-host hit-host">
						<Sprite speciesId={s.player.pokemon.speciesId} size={120} alt={s.player.pokemon.name} />
					</div>
				{/key}
				{#if playerDmgFloat}
					{#key playerDmgFloat.id}
						<div
							class="dmg-float"
							style="color: {playerDmgFloat.block ? '#6fe6d4' : '#ff6e5a'}; left: 10px; top: 20px;"
						>
							{#if playerDmgFloat.block}BLOQUEADO{:else}{playerDmgFloat.amount}{/if}
						</div>
					{/key}
				{/if}
			</div>

			<!-- INFO JOGADOR (canto inferior direito) -->
			<div class="absolute bottom-2 right-2 z-10 w-[58%] max-w-65">
				<div class="rounded-xl border border-(--border) bg-(--surface)/85 p-2 shadow-lg backdrop-blur">
					<div class="mb-1 flex items-center justify-between gap-1">
						<span class="truncate text-xs font-bold">{s.player.pokemon.name}</span>
						<ManaCrystal mana={s.player.mana} max={s.player.mana ?? s.player.maxMana} />
					</div>
					<HpBar hp={s.player.hp} maxHp={s.player.pokemon.maxHp} block={s.player.block} />
					{#if s.player.nextDamageBonus > 0 || s.player.berserk || s.player.dragonize || s.player.staticShockDamage > 0 || s.player.ghostForm}
						<div class="mt-1.5 flex flex-wrap gap-1">
							{#if s.player.berserk}
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-black" style="color:#ef4444;background:rgba(239,68,68,0.15)" title="ATQ×2, DEF÷2 — toda a batalha">⚡ Fúria</span>
							{/if}
							{#if s.player.dragonize}
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-black" style="color:#818cf8;background:rgba(79,70,229,0.15)" title="Ataques comuns → tipo Dragão — toda a batalha">🐉 Dragão</span>
							{/if}
							{#if s.player.staticShockDamage > 0}
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-black" style="color:#facc15;background:rgba(250,204,21,0.16)" title="Cada carta jogada causa dano elétrico extra">⚡ Choque +{s.player.staticShockDamage}</span>
							{/if}
							{#if s.player.ghostForm}
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-black" style="color:#a78bfa;background:rgba(167,139,250,0.15)" title="Dano máximo 1 neste turno">👻 Fantasma</span>
							{/if}
							{#if s.player.nextDamageBonus > 0}
								<span class="rounded-full px-1.5 py-0.5 text-[9px] font-black" style="color:#c084fc;background:rgba(192,132,252,0.15)" title="Próximo ataque +{s.player.nextDamageBonus}">✨ +{s.player.nextDamageBonus}</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>

		</section>

		<!-- LOGS DA BATALHA -->
		<BattleLogs logs={battleLogs} />

		<!-- CONTROLES + MÃO -->
		<BattleHandControls
			state={s}
			ended={ended}
			autoConfirm={autoConfirm}
			canPlay={canPlay}
			onCardTap={onCardTap}
			onPlayCard={onPlay}
			onPlayRelic={onPlayRelic}
			onEndTurn={handleEndTurn}
			onAutoConfirmChange={setAutoConfirm}
		/>

	</div>

	<!-- FIM DE BATALHA -->
	<Modal
		open={ended}
		closable={false}
		title={s.status === 'defeat' ? 'Derrota…' : s.status === 'captured' ? 'Capturado!' : 'Vitória!'}
	>
		{#if s.status === 'defeat'}
			<p class="text-sm text-(--text-muted)">
				Seu pokémon foi derrotado. Seu deck ativo foi redefinido para as cartas iniciais — mas seu
				inventário e pokémons continuam com você.
			</p>
		{:else}
			<div class="space-y-2 text-sm">
				{#if s.status === 'captured'}
					<p class="font-semibold">Você capturou {s.enemy.pokemon.name}! 🎉</p>
				{/if}
				{#if battle.reward}
					<p>💰 Recompensa: <strong>{battle.reward.money}</strong></p>
					<p>
						{ELEMENT_EMOJI[battle.reward.elementPoints.type]}
						+{battle.reward.elementPoints.amount}
						{ELEMENT_LABEL[battle.reward.elementPoints.type]}
					</p>
					{#if battle.reward.unlockedRegionName}
						<p class="font-semibold text-(--success)">
							🗺️ Nova região desbloqueada: {battle.reward.unlockedRegionName}!
						</p>
					{/if}
					{#if battle.reward.bossCardReward}
						<p class="font-semibold text-amber-300">
							🃏 Recompensa do boss: {battle.reward.bossCardReward.name}
							({battle.reward.bossCardReward.rarity})
						</p>
					{/if}
				{:else}
					<p class="text-(--text-muted)">Calculando recompensa…</p>
				{/if}
			</div>
		{/if}
		<button
			class="mt-4 w-full rounded-xl bg-(--accent) py-2.5 font-semibold text-white"
			onclick={leave}
		>
			Voltar ao mapa
		</button>
	</Modal>
{/if}

<style>
	/* ── arena ──────────────────────────────────────────────────────────── */
	.arena {
		background:
			radial-gradient(95% 55% at 70% 12%, rgba(255, 110, 90, 0.22), transparent 60%),
			radial-gradient(80% 50% at 22% 78%, rgba(58, 214, 194, 0.14), transparent 62%),
			radial-gradient(120% 60% at 50% 50%, rgba(168, 107, 255, 0.06), transparent 70%),
			linear-gradient(180deg, #161018 0%, #0d0d12 42%, #0a0e10 100%);
	}
	.floor {
		position: absolute;
		left: 50%;
		width: 150%;
		height: 240px;
		transform: translateX(-50%);
		border-radius: 50%;
		pointer-events: none;
	}
	.floor.enemy {
		top: 88px;
		background: radial-gradient(50% 60% at 50% 50%, rgba(255, 140, 120, 0.1), transparent 70%);
	}
	.floor.player {
		bottom: 128px;
		background: radial-gradient(50% 60% at 50% 50%, rgba(80, 210, 190, 0.1), transparent 70%);
	}

	/* ── turn flash ─────────────────────────────────────────────────────── */
	.turn-flash {
		position: absolute;
		inset: 0;
		z-index: 55;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.turn-flash-text {
		font-family: 'Russo One', sans-serif;
		font-size: 30px;
		letter-spacing: 1px;
		color: #fff;
		text-shadow:
			0 4px 16px rgba(58, 214, 194, 0.7),
			0 0 24px rgba(168, 107, 255, 0.5);
		animation: turnB 1.1s ease forwards;
		opacity: 0;
	}
	@keyframes turnB {
		0%   { opacity: 0; transform: scale(0.8); }
		25%  { opacity: 1; transform: scale(1);   }
		75%  { opacity: 1; }
		100% { opacity: 0; transform: scale(1.05); }
	}

	/* ── damage float ───────────────────────────────────────────────────── */
	.dmg-float {
		position: absolute;
		z-index: 30;
		font-family: 'Russo One', sans-serif;
		font-size: 34px;
		font-weight: 900;
		pointer-events: none;
		animation: dmgFloat 1s ease forwards;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
		white-space: nowrap;
	}
	@keyframes dmgFloat {
		0%   { opacity: 0; transform: translateY(0) scale(0.6); }
		20%  { opacity: 1; transform: translateY(-10px) scale(1.15); }
		100% { opacity: 0; transform: translateY(-58px) scale(0.95); }
	}

	/* ── sombra elíptica de plataforma sob cada pokémon ──────────────────── */
	.platform {
		position: absolute;
		left: 50%;
		bottom: 6px;
		width: 96px;
		height: 22px;
		transform: translateX(-50%);
		border-radius: 9999px;
		background: radial-gradient(ellipse, rgba(0, 0, 0, 0.35), transparent 70%);
		z-index: -1;
	}
	.shake-host :global(img) {
		animation: shake 320ms ease-in-out;
	}
	.hit-host {
		position: relative;
	}
	.hit-host :global(img) {
		filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.35));
	}
	.played-card-fx {
		width: 120px;
		animation: play-to-center 520ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}
	.played-card-fx.vaporize {
		animation:
			play-to-center 520ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards,
			vaporize 620ms ease-in forwards;
	}
	.hit-spark {
		position: absolute;
		left: calc(50% + 56px);
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: 22px;
		color: #facc15;
		text-shadow: 0 0 14px rgba(250, 204, 21, 0.8);
		animation: hit-spark 280ms ease-out forwards;
	}
	.vapor-label {
		position: absolute;
		left: 50%;
		top: calc(50% + 66px);
		transform: translateX(-50%);
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.08em;
		color: #fca5a5;
		text-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
		animation: vapor-label 620ms ease-out forwards;
	}
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-7px) rotate(-2deg);
		}
		40% {
			transform: translateX(7px) rotate(2deg);
		}
		60% {
			transform: translateX(-5px);
		}
		80% {
			transform: translateX(5px);
		}
	}
	@keyframes play-to-center {
		0% {
			transform: translate(-8px, 120px) scale(0.72) rotate(-5deg);
			opacity: 0.2;
		}
		72% {
			transform: translate(10px, 0) scale(1.02) rotate(1deg);
			opacity: 1;
		}
		100% {
			transform: translate(24px, 0) scale(1) rotate(0deg);
			opacity: 1;
		}
	}
	@keyframes hit-spark {
		from {
			opacity: 0;
			transform: translate(-60%, -50%) scale(0.5);
		}
		to {
			opacity: 0;
			transform: translate(-30%, -50%) scale(1.4);
		}
	}
	@keyframes vaporize {
		0% {
			filter: saturate(1);
		}
		60% {
			filter: saturate(0.2) blur(0.8px);
			opacity: 0.7;
		}
		100% {
			filter: saturate(0) blur(2.5px);
			opacity: 0;
			transform: translate(36px, -14px) scale(0.7);
		}
	}
	@keyframes vapor-label {
		0% {
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-10px);
		}
	}
</style>
