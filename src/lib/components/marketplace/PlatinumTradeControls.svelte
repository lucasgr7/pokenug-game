<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { PLATINUM_GROWTH, getPlatinumPrice, estimatePlatinumCost, buyPlatinum, platinumDiscount } from '$lib/game/market.svelte';
	import { formatNumber } from '$lib/utils/math';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { getPlatinum as getPlatinumBalance } from '$lib/game/state.svelte';

	interface Props {
		playerMoney: number;
		busy: boolean;
	}

	let { playerMoney, busy }: Props = $props();

	const PLATINUM_QTY_STEPS = [1, 5, 10, 25];
	let quantity = $state(1);

	let platinumPrice = $derived(getPlatinumPrice());
	let totalCost = $derived(estimatePlatinumCost(quantity));
	let hasEnough = $derived(!busy && playerMoney >= getPlatinumPrice());
	let platinumBalance = $derived(getPlatinumBalance());

	let discountActive = $derived(platinumDiscount.value && Date.now() < platinumDiscount.value.endsAt);
	let discountPct = $derived(platinumDiscount.value ? Math.round(platinumDiscount.value.pct * 100) : 0);

	async function handleBuy() {
		if (busy) return;
		busy = true;
		try {
			const result = await buyPlatinum(quantity);
			pushToast(result.message, result.success ? 'success' : 'error');
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Current price display -->
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

	<!-- Quantity selector pills -->
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

	<!-- Player balances -->
	<div class="grid grid-cols-2 gap-3">
		<div class="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
			<p class="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-1">{$_('market.yourBalance')}</p>
			<p class="text-base font-black text-[var(--text)]">💰 {formatNumber(playerMoney)}</p>
		</div>
		<div class="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
			<p class="text-[10px] uppercase tracking-wider font-bold mb-1" style="color: #a78bfa99;">
				⬡ {$_('market.platinum')}
			</p>
			<p class="text-base font-black text-[var(--text)]">{formatNumber(platinumBalance)}</p>
		</div>
	</div>

	<!-- Total cost preview -->
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

	<!-- Buy button (no sell) -->
	<button
		onclick={handleBuy}
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