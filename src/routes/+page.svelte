<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Hud from '$lib/components/Hud.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { REGIONS } from '$lib/data/regions';
	import { canFightBoss, getBossCooldownRemainingMs, getRegionProgress } from '$lib/db/regions';
	import { game, normalizedPokemonHp } from '$lib/game/state.svelte';
	import { hasSavedBattle } from '$lib/game/battle.svelte';
	import { getActiveDeck } from '$lib/db/cards';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { formatDuration } from '$lib/utils/time';
	import type { BattleMode } from '$lib/game/types';
	import type { RegionProgress } from '$lib/db/index';

	const MIN_DECK = 8;

	let battleInProgress = $state(false);
	let progressByRegion = $state<Record<string, RegionProgress>>({});

	onMount(async () => {
		battleInProgress = await hasSavedBattle();
		const entries = await Promise.all(REGIONS.map(async (region) => [region.id, await getRegionProgress(region.id)] as const));
		progressByRegion = Object.fromEntries(entries);
	});

	function isUnlocked(id: string): boolean {
		return game.player?.unlockedRegions.includes(id) ?? false;
	}

	function defeats(id: string): number {
		return progressByRegion[id]?.defeats ?? game.player?.defeatedByRegion[id] ?? 0;
	}

	function progress(id: string): RegionProgress {
		return progressByRegion[id] ?? { defeats: 0, bossLastDefeatedAt: 0, bossFirstFightDone: false };
	}

	function bossReady(regionId: string): boolean {
		const region = REGIONS.find((entry) => entry.id === regionId);
		if (!region) return false;
		const p = progress(regionId);
		if (p.defeats < region.requiredDefeats) return false;
		return canFightBoss(p, Date.now());
	}

	function bossCooldown(regionId: string): number {
		return getBossCooldownRemainingMs(progress(regionId), Date.now());
	}

	function bossStatus(regionId: string): string {
		const region = REGIONS.find((entry) => entry.id === regionId);
		if (!region) return '';
		if (!isUnlocked(regionId)) return 'Região bloqueada.';
		const done = defeats(regionId);
		if (done < region.requiredDefeats) {
			return `Derrote ${region.requiredDefeats - done} inimigos comuns para liberar o boss.`;
		}
		const remaining = bossCooldown(regionId);
		if (remaining > 0) return `Boss em cooldown: ${formatDuration(remaining)}.`;
		return 'Boss disponível.';
	}

	async function enter(regionId: string, mode: BattleMode = 'normal') {
		if (!isUnlocked(regionId)) return;
		const region = REGIONS.find((entry) => entry.id === regionId);
		if (!region) return;

		const latestProgress = await getRegionProgress(regionId);
		progressByRegion[regionId] = latestProgress;
		if (mode === 'boss') {
			if (latestProgress.defeats < region.requiredDefeats) {
				pushToast('Derrote mais inimigos comuns nesta região antes do boss.', 'error');
				return;
			}
			if (!canFightBoss(latestProgress, Date.now())) {
				const remaining = getBossCooldownRemainingMs(latestProgress, Date.now());
				pushToast(`Boss em cooldown: ${formatDuration(remaining)}.`, 'error');
				return;
			}
		}

		if (!game.player?.activePokemonId) {
			pushToast(`Selecione um Pokémon principal na aba Pokémons primeiro.`, 'error');
			return;
		}
		const activePkm = game.roster.find((p) => p.id === game.player?.activePokemonId);
		if (activePkm && normalizedPokemonHp(activePkm) <= 0) {
			pushToast(`Seu Pokémon principal está desmaiado. Selecione outro ou aguarde a recuperação.`, 'error');
			return;
		}
		const deck = await getActiveDeck();
		if (deck.length < MIN_DECK) {
			pushToast(`Seu deck precisa de ao menos ${MIN_DECK} cartas.`, 'error');
			await goto('/deck');
			return;
		}
		await goto(`/battle?region=${regionId}&mode=${mode}`);
	}
</script>

<Hud />

<main class="px-4 py-4">
	{#if battleInProgress}
		<button
			class="mb-3 flex w-full items-center justify-between rounded-2xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-left"
			onclick={() => goto('/battle')}
		>
			<span class="font-bold">⚔️ Batalha em andamento</span>
			<span class="text-sm font-semibold text-[var(--accent)]">Continuar →</span>
		</button>
	{/if}

	<h1 class="mb-3 text-xl font-bold">Regiões</h1>
	<div class="grid grid-cols-1 gap-3">
		{#each REGIONS as region (region.id)}
			{@const unlocked = isUnlocked(region.id)}
			{@const done = defeats(region.id)}
			{@const bossCanStart = bossReady(region.id)}
			{@const bossHint = bossStatus(region.id)}
			<div
				class="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
				class:opacity-40={!unlocked}
			>
				<div class="mb-2 flex items-center gap-3">
				<div class="shrink-0">
					<Sprite speciesId={region.pool[0]} size={64} alt={region.name} />
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<h2 class="truncate font-bold">{region.name}</h2>
						{#if !unlocked}<span aria-hidden="true">🔒</span>{/if}
					</div>
					<p class="mb-1.5 truncate text-xs text-[var(--text-muted)]">{region.description}</p>
					{#if unlocked}
						<ProgressBar
							value={Math.min(done, region.requiredDefeats)}
							max={region.requiredDefeats}
							height={6}
						/>
						<div class="mt-1 text-[11px] text-[var(--text-muted)]">
							{Math.min(done, region.requiredDefeats)}/{region.requiredDefeats} derrotados
						</div>
					{:else}
						<div class="text-[11px] text-[var(--text-muted)]">Complete a região anterior.</div>
					{/if}
				</div>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<button
						class="rounded-xl border border-[var(--border)] bg-black/10 px-3 py-2 text-xs font-semibold transition-transform active:scale-[0.99] disabled:opacity-40"
						disabled={!unlocked}
						onclick={() => enter(region.id, 'normal')}
					>
						Explorar região
					</button>
					<button
						class="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)] transition-transform active:scale-[0.99] disabled:opacity-40"
						disabled={!bossCanStart}
						onclick={() => enter(region.id, 'boss')}
						title={bossHint}
					>
						Fight Boss
					</button>
				</div>
				<div class="mt-1 text-[11px] text-[var(--text-muted)]">{bossHint}</div>
			</div>
		{/each}
	</div>
</main>
