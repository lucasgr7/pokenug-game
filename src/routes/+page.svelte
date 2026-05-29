<script lang="ts">
	import { goto } from '$app/navigation';
	import Hud from '$lib/components/Hud.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { REGIONS } from '$lib/data/regions';
	import { game } from '$lib/game/state.svelte';
	import { getActiveDeck } from '$lib/db/cards';
	import { pushToast } from '$lib/stores/toast.svelte';

	const MIN_DECK = 8;

	function isUnlocked(id: string): boolean {
		return game.player?.unlockedRegions.includes(id) ?? false;
	}

	function defeats(id: string): number {
		return game.player?.defeatedByRegion[id] ?? 0;
	}

	async function enter(regionId: string) {
		if (!isUnlocked(regionId)) return;
		const deck = await getActiveDeck();
		if (deck.length < MIN_DECK) {
			pushToast(`Seu deck precisa de ao menos ${MIN_DECK} cartas.`, 'error');
			await goto('/deck');
			return;
		}
		await goto(`/battle?region=${regionId}`);
	}
</script>

<Hud />

<main class="px-4 py-4">
	<h1 class="mb-3 text-xl font-bold">Regiões</h1>
	<div class="grid grid-cols-1 gap-3">
		{#each REGIONS as region (region.id)}
			{@const unlocked = isUnlocked(region.id)}
			{@const done = defeats(region.id)}
			<button
				class="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-transform active:scale-[0.99]"
				class:opacity-40={!unlocked}
				disabled={!unlocked}
				onclick={() => enter(region.id)}
			>
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
			</button>
		{/each}
	</div>
</main>
