<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Sprite from '$lib/components/Sprite.svelte';
	import Card from '$lib/components/Card.svelte';
	import HpBar from '$lib/components/HpBar.svelte';
	import ManaCrystal from '$lib/components/ManaCrystal.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import {
		battle,
		enterBattle,
		hasSavedBattle,
		playCard,
		playRelicCard,
		type PlayCardResult,
		endTurn,
		finalizeBattle,
		endBattleCleanup
	} from '$lib/game/battle.svelte';
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_LABEL, ELEMENT_EMOJI } from '$lib/game/elements';
	import { effectiveness, effectivenessLabel } from '$lib/game/type-chart';

	let loading = $state(true);
	let error = $state<string | null>(null);

	interface PlayedFx {
		id: string;
		templateId: string;
		exhausted: boolean;
		kind: PlayCardResult['kind'];
	}

	let playedFx = $state<PlayedFx | null>(null);
	let selectedCardId = $state<string | null>(null);

	let battleLogs = $state<{id: string, msg: string}[]>([]);
	
	function addLog(msg: string) {
		battleLogs = [...battleLogs, { id: crypto.randomUUID(), msg }];
		if (battleLogs.length > 3) battleLogs.shift();
	}

	onMount(async () => {
		const regionId = page.url.searchParams.get('region');
		try {
			if (regionId) {
				await enterBattle(regionId);
			} else if (await hasSavedBattle()) {
				// Sem região na URL, mas há uma batalha em andamento: retoma.
				await enterBattle('');
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

	let s = $derived(battle.state);
	let ended = $derived(!!s && s.status !== 'active');
	let selectedCard = $derived(s?.hand.find((c) => c.id === selectedCardId) ?? null);

	function intentText(): string {
		if (!s) return '';
		const it = s.enemy.intent;
		if (it.kind === 'attack') return `⚔️ ${it.damage + s.enemy.nextDamageBonus}`;
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
		return effectivenessLabel(effectiveness(s.player.pokemon.element, s.enemy.pokemon.element));
	}

	function onPlayRelic(cardId: string, templateId: string) {
		const res = playRelicCard(cardId);
		if (!res.played) return;
		const fxId = crypto.randomUUID();
		playedFx = { id: fxId, templateId, exhausted: true, kind: 'relic' };
		const tpl = getTemplate(templateId);
		if (tpl) addLog(`Usou relíquia ${tpl.name}!`);
		setTimeout(() => { if (playedFx?.id === fxId) playedFx = null; }, 620);
	}

	function onPlay(cardId: string, templateId: string) {
		selectedCardId = null;
		const res = playCard(cardId);
		if (!res.played) return;

		const fxId = crypto.randomUUID();
		const tpl = getTemplate(templateId);
		if (tpl) addLog(`Jogou ${tpl.name}!`);
		playedFx = { id: fxId, templateId, exhausted: res.exhausted, kind: res.kind };
		setTimeout(() => {
			if (playedFx?.id === fxId) playedFx = null;
		}, 620);
	}

	function onCardTap(cardId: string, templateId: string) {
		if (!canPlay(templateId)) return;
		if (selectedCardId === cardId) {
			onPlay(cardId, templateId);
		} else {
			selectedCardId = cardId;
		}
	}

	function handleEndTurn() {
		selectedCardId = null;
		addLog(`Fim do turno.`);
		endTurn();
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
		<button class="rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white" onclick={leave}>
			Voltar
		</button>
	</div>
{:else if s}
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		<!-- ARENA -->
		<section
			class="relative flex-1 overflow-hidden"
			style="background:
				radial-gradient(120% 70% at 80% 0%, color-mix(in srgb, {`var(--accent)`} 20%, var(--bg)), var(--bg) 70%);"
		>
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
				Turno {s.turnNumber}
				{#if matchupHint()}<span class="ml-1 text-amber-300">· {matchupHint()}</span>{/if}
			</div>

			<!-- INFO INIMIGO (canto superior esquerdo) -->
			<div class="absolute left-2 top-2 z-10 w-[58%] max-w-[260px]">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)]/85 p-2 shadow-lg backdrop-blur">
					<div class="mb-1 flex items-center justify-between gap-1">
						<span class="truncate text-xs font-bold">{s.enemy.pokemon.name}</span>
						<span class="shrink-0 text-[10px] text-(--text-muted)"
							>{ELEMENT_EMOJI[s.enemy.pokemon.element]}</span
						>
					</div>
					<HpBar hp={s.enemy.hp} maxHp={s.enemy.pokemon.maxHp} block={s.enemy.block} />
					<div class="mt-1 flex items-center gap-1 text-[11px] font-bold text-[var(--danger)]">
						<span class="rounded bg-[var(--danger)]/15 px-1.5 py-0.5">Intenção {intentText()}</span>
					</div>
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
			</div>

			<!-- SPRITE JOGADOR (canto inferior esquerdo) -->
			<div class="absolute bottom-1 left-1 z-0">
				<div class="platform"></div>
				{#key battle.playerHurt}
					<div class="shake-host hit-host">
						<Sprite speciesId={s.player.pokemon.speciesId} size={120} alt={s.player.pokemon.name} />
					</div>
				{/key}
			</div>

			<!-- INFO JOGADOR (canto inferior direito) -->
			<div class="absolute bottom-2 right-2 z-10 w-[58%] max-w-[260px]">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)]/85 p-2 shadow-lg backdrop-blur">
					<div class="mb-1 flex items-center justify-between gap-1">
						<span class="truncate text-xs font-bold">{s.player.pokemon.name}</span>
						<ManaCrystal mana={s.player.mana} max={s.player.maxMana} />
					</div>
					<HpBar hp={s.player.hp} maxHp={s.player.pokemon.maxHp} block={s.player.block} />
					{#if s.player.nextDamageBonus > 0}
						<div class="mt-1 text-[10px] font-bold text-purple-400">
							✨ Próximo ataque +{s.player.nextDamageBonus}
						</div>
					{/if}
					{#if s.player.berserk}
						<div class="mt-1 text-[10px] font-bold text-red-400">⚡ Fúria — ATQ×2 DEF÷2</div>
					{/if}
					{#if s.player.ghostForm}
						<div class="mt-1 text-[10px] font-bold text-violet-300">👻 Forma Fantasma — DMG MAX 1</div>
					{/if}
				</div>
			</div>

		</section>

		<!-- LOGS DA BATALHA -->
		<section class="relative z-20 border-t border-[var(--border)] bg-[var(--surface-overlay)] h-[54px] flex flex-col justify-end overflow-hidden px-4 pb-1.5 shadow-inner">
			<div class="flex flex-col items-center justify-end w-full" aria-live="polite">
				{#each battleLogs.slice(-2) as log (log.id)}
					<div class="text-[11.5px] font-bold text-[var(--text-muted)] animate-fade-in-up text-center truncate w-full h-[18px]">
						{log.msg}
					</div>
				{/each}
				{#if battleLogs.length === 0}
					<div class="text-[11.5px] font-bold text-[var(--text-muted)]/50 text-center w-full h-[18px]">
						Início da batalha...
					</div>
				{/if}
			</div>
		</section>

		<!-- CONTROLES + MÃO -->
		<section class="border-t border-white/10 bg-[var(--surface)] px-2 pb-2 pt-2 flex flex-col justify-between" style="height: 40vh;">
			<div>
				<div class="mb-1 flex items-center justify-between px-1 text-[10px] text-(--text-muted) uppercase font-bold tracking-widest">
					<span>🂠 {s.deck.length} · ♻ {s.discard.length} · 💤 {s.exhausted.length}</span>
					<button
						class="rounded-xl bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-white hover:brightness-110 disabled:opacity-40 transition-colors"
						disabled={s.turn !== 'player' || ended}
						onclick={handleEndTurn}
					>
						Fim de turno ↦
					</button>
				</div>

				<!-- relíquias: cartas de uso único fora do deck -->
				{#if s.relicSlots && s.relicSlots.length > 0}
					<div class="mb-1.5 flex items-center gap-2 px-1">
						<span class="shrink-0 text-[10px] font-black uppercase tracking-widest text-purple-400">Relíquias</span>
						{#each s.relicSlots as relic (relic.id)}
							<div class="w-14 shrink-0">
								<Card
									templateId={relic.templateId}
									playable={s.turn === 'player' && !ended}
									onclick={() => onPlayRelic(relic.id, relic.templateId)}
								/>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- fan hand: wrapper div is for positioning only — Card's own button handles clicks -->
			<div class="hand-fan" role="group" aria-label="Mão de cartas">
				{#each s.hand as card, i (card.id)}
					{@const n = s.hand.length || 1}
					{@const mid = (n - 1) / 2}
					{@const offset = i - mid}
					{@const angle = offset * (n > 3 ? 6.5 : 9)}
					{@const xPos = offset * 90}
					{@const playable = canPlay(card.templateId)}
					{@const isSelected = selectedCardId === card.id}
					<div
						class="hand-card"
						class:hand-card--selected={isSelected}
						class:hand-card--muted={!playable}
						style="left: calc(50% + {xPos}px - 60px); --angle: {angle}deg; z-index: {isSelected ? 60 : i + 1};"
					>
						<Card
							templateId={card.templateId}
							flip
							playable={playable}
							onclick={() => onCardTap(card.id, card.templateId)}
						/>
					</div>
				{/each}
			</div>
		</section>

		<!-- CARTA SELECIONADA — overlay de confirmação.
		     Sits at the flex-container level (z-[100]) to beat hand card z-indices (max 60). -->
		{#if selectedCard && !ended}
			<div
				class="absolute inset-0 z-100 flex cursor-pointer flex-col items-center justify-center gap-3"
				style="background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);"
				onclick={() => (selectedCardId = null)}
				onkeydown={(e) => { if (e.key === 'Escape') selectedCardId = null; }}
				role="button"
				tabindex="0"
				aria-label="Desselecionar carta"
			>
				<div
					class="card-preview cursor-default"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="presentation"
				>
					<Card templateId={selectedCard.templateId} playable={false} showcase />
				</div>
				<button
					type="button"
					class="rounded-xl px-10 py-2.5 text-sm font-black tracking-wide text-white shadow-xl"
					style="background: var(--accent);"
					onclick={(e) => {
						e.stopPropagation();
						onPlay(selectedCard!.id, selectedCard!.templateId);
					}}
				>
					Jogar ▶
				</button>
			</div>
		{/if}
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
						<p class="font-semibold text-[var(--success)]">
							🗺️ Nova região desbloqueada: {battle.reward.unlockedRegionName}!
						</p>
					{/if}
				{:else}
					<p class="text-(--text-muted)">Calculando recompensa…</p>
				{/if}
			</div>
		{/if}
		<button
			class="mt-4 w-full rounded-xl bg-[var(--accent)] py-2.5 font-semibold text-white"
			onclick={leave}
		>
			Voltar ao mapa
		</button>
	</Modal>
{/if}

<style>
	/* ── Fan hand ──────────────────────────────────────────────────────────── */
	.hand-fan {
		position: relative;
		height: 100%;
		min-height: 160px;
		width: 100%;
		overflow: visible;
		margin-top: auto;
	}
	.hand-card {
		position: absolute;
		bottom: 30px;
		width: 120px;
		max-width: 25vh;
		transform-origin: bottom center;
		transform: rotate(var(--angle));
		transition:
			transform 180ms ease-out,
			filter 180ms ease-out;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
	}
	/* desktop hover — lifts and straightens the card */
	@media (hover: hover) {
		.hand-card:not(.hand-card--muted):hover {
			transform: rotate(calc(var(--angle) * 0.3)) translateY(-22px) scale(1.06);
			z-index: 50 !important;
		}
	}
	.hand-card--selected {
		transform: rotate(0deg) translateY(-40px) scale(1.08) !important;
		z-index: 60 !important;
		filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.75));
	}
	.hand-card--muted {
		opacity: 0.45;
		cursor: default;
	}
	/* ── Card preview overlay ───────────────────────────────────────────────── */
	.card-preview {
		width: 250px;
		max-width: 70vw;
		filter: drop-shadow(0 16px 40px rgba(0, 0, 0, 0.6));
		animation: preview-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
	}
	@keyframes preview-in {
		from { transform: scale(0.82) translateY(16px); opacity: 0; }
		to   { transform: scale(1) translateY(0);       opacity: 1; }
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
	@keyframes fade-in-up {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fade-in-up {
		animation: fade-in-up 250ms ease-out forwards;
	}
</style>
