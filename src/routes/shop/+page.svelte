<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
	import {
		shop,
		ensureShopLoaded,
		paidRefresh,
		paidRefreshCost,
		buySlot,
		canAfford
	} from '$lib/game/shop.svelte';
	import { ELEMENT_EMOJI } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import { pushToast } from '$lib/stores/toast.svelte';
	import type { Element } from '$lib/game/types';

	let refreshing = $state(false);

	onMount(async () => {
		await ensureShopLoaded();
	});

	async function buy(i: number) {
		const slot = shop.slots[i];
		const ok = await buySlot(i);
		if (ok) pushToast(`Comprou ${slot.name}!`, 'success');
		else pushToast('Recursos insuficientes.', 'error');
	}

	async function refresh() {
		refreshing = true;
		const ok = await paidRefresh();
		if (!ok) pushToast('Dinheiro insuficiente para atualizar.', 'error');
		refreshing = false;
	}
</script>

<Hud />

<main class="px-4 py-4">
	<div class="mb-3 flex items-center justify-between">
		<h1 class="text-xl font-bold">Loja</h1>
		<button
			class="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
			disabled={refreshing}
			onclick={refresh}
		>
			🔄 Atualizar · 💰{formatNumber(paidRefreshCost())}
		</button>
	</div>
	<p class="mb-3 text-xs text-[var(--text-muted)]">Os itens renovam automaticamente todo dia.</p>

	{#if !shop.loaded}
		<p class="text-sm text-[var(--text-muted)]">Carregando…</p>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each shop.slots as slot, i (i)}
				<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<Card templateId={slot.id} playable={false} dimmed={slot.sold} showcase />
					{#if slot.sold}
						<div class="rounded-lg bg-[var(--surface-2)] py-1.5 text-center text-xs font-bold text-[var(--text-muted)]">
							Comprado
						</div>
					{:else}
						<button
							class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
							style="background: var(--accent);"
							disabled={!canAfford(slot)}
							onclick={() => buy(i)}
						>
							💰{slot.price?.money ?? 0}{#if slot.price?.element}
								· {ELEMENT_EMOJI[slot.price.element.type as Element]}{slot.price.element.amount}{/if}
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</main>
