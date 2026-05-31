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
		canAfford,
		buyGlobalDamage,
		buyIncomeMultiplier,
		buyVitamins,
		NGU_COSTS
	} from '$lib/game/shop.svelte';
	import { game } from '$lib/game/state.svelte';
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

	async function performNguBuy(action: () => Promise<boolean>, name: string) {
		const ok = await action();
		if (ok) pushToast(`Aprimoramento ${name} comprado!`, 'success');
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

	{#if game.player}
		<div class="mt-8">
			<h2 class="mb-3 text-lg font-bold">Aprimoramentos Permanentes</h2>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				
				<!-- Income Multiplier -->
				<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<div class="flex-1">
						<h3 class="font-bold">Multiplicador de Renda</h3>
						<p class="text-xs text-[var(--text-muted)]">Aumenta todos os ganhos dos Trabalhos idle em 50%.</p>
						<p class="mt-1 text-sm font-bold text-[var(--accent)]">Nível atual: {game.player.ngu.moneyMultiplierLevel}</p>
					</div>
					<button
						class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
						style="background: var(--accent);"
						disabled={game.player.money < NGU_COSTS.incomeMultiplier(game.player.ngu.moneyMultiplierLevel)}
						onclick={() => performNguBuy(buyIncomeMultiplier, 'Multiplicador de Renda')}
					>
						💰{formatNumber(NGU_COSTS.incomeMultiplier(game.player.ngu.moneyMultiplierLevel))}
					</button>
				</div>

				<!-- Global Damage -->
				<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<div class="flex-1">
						<h3 class="font-bold">Dano Global</h3>
						<p class="text-xs text-[var(--text-muted)]">Adiciona +1 de dano base estático em todos os ataques.</p>
						<p class="mt-1 text-sm font-bold text-[var(--accent)]">Nível atual: {game.player.ngu.globalDamageLevel}</p>
					</div>
					<button
						class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
						style="background: var(--accent);"
						disabled={game.player.money < NGU_COSTS.globalDamage(game.player.ngu.globalDamageLevel).money}
						onclick={() => performNguBuy(buyGlobalDamage, 'Dano Global')}
					>
						💰{formatNumber(NGU_COSTS.globalDamage(game.player.ngu.globalDamageLevel).money)}
					</button>
				</div>

				<!-- Vitamins (HP for active Pokemon) -->
				{#if true}
					{@const activePkm = game.roster.find((p) => p.id === game.player!.activePokemonId)}
					<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
						<div class="flex-1">
							<h3 class="font-bold">Vitaminas (HP)</h3>
							<p class="text-xs text-[var(--text-muted)]">Dá +20 de HP Máximo permanente ao Pokémon principal.</p>
							{#if activePkm}
								<p class="mt-1 text-sm font-bold text-[var(--accent)]">Buffs em {activePkm.name}: {activePkm.hpBuffs ?? 0}</p>
							{/if}
						</div>
						{#if activePkm}
							<button
								class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
								style="background: var(--accent);"
								disabled={game.player.money < NGU_COSTS.vitamins(activePkm.hpBuffs ?? 0)}
								onclick={() => performNguBuy(buyVitamins, 'Vitaminas de HP')}
							>
								💰{formatNumber(NGU_COSTS.vitamins(activePkm.hpBuffs ?? 0))}
							</button>
						{:else}
							<button disabled class="rounded-lg bg-gray-600/50 py-1.5 text-xs font-bold text-white opacity-40">
								Selecione um Pokémon
							</button>
						{/if}
					</div>
				{/if}

			</div>
		</div>
	{/if}
</main>
