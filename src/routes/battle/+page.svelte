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
		startBattle,
		playCard,
		endTurn,
		finalizeBattle,
		endBattleCleanup
	} from '$lib/game/battle.svelte';
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_LABEL, ELEMENT_EMOJI } from '$lib/game/elements';
	import { effectiveness, effectivenessLabel } from '$lib/game/type-chart';

	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		const regionId = page.url.searchParams.get('region');
		if (!regionId) {
			await goto('/');
			return;
		}
		try {
			await startBattle(regionId);
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

	async function leave() {
		endBattleCleanup();
		await goto('/');
	}
</script>

{#if loading}
	<div class="flex min-h-dvh items-center justify-center text-[var(--text-muted)]">
		Preparando batalha…
	</div>
{:else if error}
	<div class="flex min-h-dvh flex-col items-center justify-center gap-3 p-6">
		<p class="text-[var(--text-muted)]">{error}</p>
		<button class="rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white" onclick={leave}>
			Voltar
		</button>
	</div>
{:else if s}
	<div class="flex h-dvh flex-col overflow-hidden">
		<!-- ARENA -->
		<section
			class="relative flex-1 overflow-hidden"
			style="background:
				radial-gradient(120% 70% at 80% 0%, color-mix(in srgb, {`var(--accent)`} 20%, var(--bg)), var(--bg) 70%);"
		>
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
						<span class="shrink-0 text-[10px] text-[var(--text-muted)]"
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
				</div>
			</div>
		</section>

		<!-- CONTROLES + MÃO (encostado na arena, sem espaço) -->
		<section class="border-t border-[var(--border)] bg-[var(--surface)] px-2 pb-3 pt-2">
			<div class="mb-1.5 flex items-center justify-between px-1 text-[10px] text-[var(--text-muted)]">
				<span>🂠 {s.deck.length} · ♻ {s.discard.length} · 💤 {s.exhausted.length}</span>
				<button
					class="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
					disabled={s.turn !== 'player' || ended}
					onclick={endTurn}
				>
					Fim de turno ↦
				</button>
			</div>
			<div class="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
				{#each s.hand as card (card.id)}
					<Card
						templateId={card.templateId}
						flip
						playable={canPlay(card.templateId)}
						onclick={() => playCard(card.id)}
					/>
				{/each}
			</div>
		</section>
	</div>

	<!-- FIM DE BATALHA -->
	<Modal
		open={ended}
		closable={false}
		title={s.status === 'defeat' ? 'Derrota…' : s.status === 'captured' ? 'Capturado!' : 'Vitória!'}
	>
		{#if s.status === 'defeat'}
			<p class="text-sm text-[var(--text-muted)]">
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
					{#if battle.reward.unlockedRegionName}
						<p class="font-semibold text-[var(--success)]">
							🗺️ Nova região desbloqueada: {battle.reward.unlockedRegionName}!
						</p>
					{/if}
				{:else}
					<p class="text-[var(--text-muted)]">Calculando recompensa…</p>
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
	/* sombra elíptica de plataforma sob cada pokémon */
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
</style>
