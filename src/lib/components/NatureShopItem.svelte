<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { t } from '$lib/i18n';
	import Sprite from '$lib/components/Sprite.svelte';
	import NatureIcon from '$lib/components/NatureIcon.svelte';
	import { NATURES, natureUnlockCost } from '$lib/data/natures';
	import { ELEMENT_EMOJI } from '$lib/game/elements';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { canUnlockNature, natureAffordable, unlockNature } from '$lib/game/natures.svelte';
	import { formatNumber } from '$lib/utils/math';
	import type { CapturedPokemon } from '$lib/game/types';

	let {
		pokemon
	}: {
		pokemon: CapturedPokemon;
	} = $props();

	async function handleUnlock(index: number) {
		const ok = await unlockNature(pokemon.id, index);
		if (ok) {
			const id = pokemon.natures!.assigned[index];
			const name = t('natures.' + id + '.name');
			pushToast(t('shop.natureUnlocked', { name }), 'success');
		} else {
			pushToast(t('shop.naturesUnlockFail'), 'error');
		}
	}
</script>

<div class="rounded-xl border border-(--border) bg-(--surface) p-3">
	<div class="mb-2 flex items-center gap-2">
		<Sprite speciesId={pokemon.speciesId} size={40} alt={pokemon.name} />
		<div>
			<p class="text-sm font-bold">{pokemon.name}</p>
			<p class="text-[10px] text-(--text-muted)">{ELEMENT_EMOJI[pokemon.element]} {$_('elements.' + pokemon.element)}</p>
		</div>
	</div>
	<div class="space-y-1.5">
		{#if pokemon.natures}
			{#each [0, 1, 2] as i}
				{@const id = pokemon.natures.assigned[i]}
				{@const unlocked = pokemon.natures.unlocked[i]}
				{@const meta = NATURES[id]}
				{@const canBuy = canUnlockNature(pokemon, i)}
				<div class="flex items-center gap-2 rounded-lg border border-(--border)/50 p-1.5">
					<NatureIcon {id} locked={!unlocked} size={28} />
					<div class="min-w-0 flex-1">
						<p class="text-[11px] font-bold">{$_('natures.' + id + '.name')}</p>
						<p class="truncate text-[9px] text-(--text-muted)">{$_('natures.' + id + '.description')}</p>
					</div>
					{#if unlocked}
						<span class="shrink-0 rounded-full bg-(--success)/20 px-2 py-0.5 text-[9px] font-bold text-(--success)">{$_('shop.naturesActive')}</span>
					{:else if canBuy}
						<button
							class="shrink-0 rounded-lg bg-(--accent) px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
							disabled={!natureAffordable(pokemon, i)}
							onclick={() => handleUnlock(i)}
						>
							{ELEMENT_EMOJI[pokemon.element]}{formatNumber(natureUnlockCost(i))}
						</button>
					{:else}
						<span class="shrink-0 text-[10px] text-(--text-muted)">{$_('shop.naturesLocked')}</span>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
