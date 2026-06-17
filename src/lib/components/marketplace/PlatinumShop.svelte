<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ELEMENTS, type Element } from '$lib/game/types';
	import { ELEMENT_COLOR, ELEMENT_EMOJI } from '$lib/game/elements';
	import {
		buyElementPack,
		buyPlatinum,
		PLATINUM_PACK_COST,
		PLATINUM_PACK_SIZE,
		PLATINUM_GROWTH,
		getPlatinumPrice,
		estimatePlatinumCost,
		platinumDiscount
	} from '$lib/game/platinum.svelte';
	import { game, getPlatinum } from '$lib/game/state.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { formatNumber } from '$lib/utils/math';

	let busy = $state(false);
	let selectedElement = $state<Element>('fire');

	let platinum = $derived(getPlatinum());

	const PLATINUM_QTY_STEPS = [1, 5, 10, 25];
	let quantity = $state(1);

	let playerMoney = $derived(game.player?.money ?? 0);
	let platinumPrice = $derived(getPlatinumPrice());
	let totalCost = $derived(estimatePlatinumCost(quantity));
	let hasEnough = $derived(!busy && playerMoney >= getPlatinumPrice());

	let discountActive = $derived(platinumDiscount.value && Date.now() < platinumDiscount.value.endsAt);
	let discountPct = $derived(platinumDiscount.value ? Math.round(platinumDiscount.value.pct * 100) : 0);

	async function handleBuyPack() {
		if (busy) return;
		busy = true;
		try {
			const result = await buyElementPack(selectedElement);
			if (result.success && result.cards) {
				const names = result.cards.map((c) => c.name).join(', ');
				pushToast(`${result.message} (${names})`, 'success');
			} else {
				pushToast(result.message, 'error');
			}
		} finally {
			busy = false;
		}
	}

	function handleBuyPlatinum() {
		if (busy) return;
		busy = true;
		try {
			const result = buyPlatinum(quantity);
			pushToast(result.message, result.success ? 'success' : 'error');
		} finally {
			busy = false;
		}
	}
</script>

<div class="space-y-5">
	<!-- ⬡ Buy Platinum (money → platinum) -->
	<div class="flex flex-col gap-4">
		<div
			class="rounded-2xl p-4 border"
			style="background: #a78bfa11; border-color: #a78bfa33;"
		>
			<p class="text-xs uppercase tracking-widest font-black mb-1" style="color: #a78bfa99;">
				{$_('market.currentPrice')}
			</p>
			<p class="text-3xl font-black" style="color: #a78bfa;">
				💰 {platinumPrice.toLocaleString('pt-BR')}
			</p>
			{#if discountActive}
				<p class="text-xs font-bold mt-1" style="color: #a78bfa;">
					{$_('market.platinumDiscountActive', { values: { pct: discountPct } })}
				</p>
			{/if}
			<p class="text-xs text-[var(--text-muted)] mt-1">
				{$_('market.priceRises', { values: { pct: ((PLATINUM_GROWTH - 1) * 100).toFixed(0) } })}
			</p>
		</div>

		<div class="overflow-x-auto flex gap-1.5 pb-1 scrollbar-hide">
			{#each PLATINUM_QTY_STEPS as step (step)}
				<button
					onclick={() => (quantity = step)}
					class="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-black border-2 transition-all duration-150"
					style={step === quantity
						? 'background: #a78bfa33; border-color: #a78bfa88; color: #a78bfa;'
						: 'background: transparent; border-color: var(--border); color: var(--text-muted);'}
				>
					{step}
				</button>
			{/each}
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div class="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
				<p class="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-1">{$_('market.yourBalance')}</p>
				<p class="text-base font-black text-[var(--text)]">💰 {formatNumber(playerMoney)}</p>
			</div>
			<div class="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
				<p class="text-[10px] uppercase tracking-wider font-bold mb-1" style="color: #a78bfa99;">
					⬡ {$_('market.platinum')}
				</p>
				<p class="text-base font-black text-[var(--text)]">{formatNumber(platinum)}</p>
			</div>
		</div>

		<div
			class="rounded-xl p-3 border"
			style="background: #a78bfa08; border-color: #a78bfa22;"
		>
			<p class="text-[10px] uppercase tracking-wider font-bold mb-1" style="color: #a78bfa99;">
				{$_('market.totalCost', { values: { qty: quantity, plural: quantity > 1 ? 's' : '' } })}
			</p>
			<p class="text-lg font-black" style="color: #a78bfa;">
				💰 {formatNumber(totalCost)}
			</p>
			<p class="text-[10px] text-[var(--text-muted)] mt-0.5">
				{$_('market.unitCostMore', { values: { pct: ((PLATINUM_GROWTH - 1) * 100).toFixed(0) } })}
			</p>
		</div>

		<button
			onclick={handleBuyPlatinum}
			disabled={!hasEnough}
			class="flex flex-col items-center gap-1 rounded-2xl py-4 px-3 font-black text-sm transition-all duration-150 border-2 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
			style={hasEnough
				? 'background: #a78bfa22; border-color: #a78bfa55; color: #a78bfa;'
				: 'background: #a78bfa11; border-color: #a78bfa22; color: #a78bfa88;'}
		>
			{#if busy}
				<span class="animate-pulse">⏳</span>
			{:else}
				<span class="text-xl">⬡</span>
				<span>{$_('market.buyPlatinum', { values: { qty: quantity } })}</span>
				<span class="text-xs font-medium opacity-80">💰 {formatNumber(totalCost)}</span>
			{/if}
		</button>

		{#if !hasEnough && !busy}
			<p class="text-xs text-[var(--text-muted)] text-center">
				{$_('market.missingMoneyPlat', { values: { amount: formatNumber(getPlatinumPrice() - playerMoney) } })}
			</p>
		{/if}
	</div>

	<hr class="border-[var(--border)]" />

	<!-- ⬡ Current platinum balance (spending section) -->
	<div>
		<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-2">
			{$_('shop.platinBalance')}
		</p>
		<p class="text-lg font-black" style="color: #a78bfa;">⬡ {formatNumber(platinum)}</p>
	</div>

	<!-- Element packs -->
	<div>
		<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-2">
			{$_('shop.elementPacks', { values: { cost: PLATINUM_PACK_COST, size: PLATINUM_PACK_SIZE } })}
		</p>
		<div class="grid grid-cols-5 gap-1.5 mb-3">
			{#each ELEMENTS as el (el)}
				<button
					onclick={() => (selectedElement = el)}
					class="flex items-center justify-center py-1.5 rounded-lg border-2 transition-all text-sm"
					style={el === selectedElement
						? `background: ${ELEMENT_COLOR[el]}22; border-color: ${ELEMENT_COLOR[el]}88;`
						: `border-color: var(--border);`}
				>
					{ELEMENT_EMOJI[el]}
				</button>
			{/each}
		</div>
		<button
			onclick={handleBuyPack}
			disabled={busy || platinum < PLATINUM_PACK_COST}
			class="w-full rounded-xl py-2.5 font-black text-sm border-2 transition-all disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
			style="background: #a78bfa22; border-color: #a78bfa55; color: #a78bfa;"
		>
			{$_('shop.buyPack', { values: { element: $_('elements.' + selectedElement), cost: PLATINUM_PACK_COST } })}
		</button>
	</div>
</div>
