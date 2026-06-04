<script lang="ts">
	import type { Element } from '$lib/game/types';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import { MARKET_UNIT, QUANTITY_STEPS, estimateBuyCost, estimateSellGain } from '$lib/game/market.svelte';

	interface Props {
		element: Element;
		currentPrice: number;
		epBalance: number;
		playerMoney: number;
		quantity: number;
		onquantitychange: (q: number) => void;
		onbuy: () => void;
		onsell: () => void;
		busy: boolean;
	}

	let {
		element,
		currentPrice,
		epBalance,
		playerMoney,
		quantity,
		onquantitychange,
		onbuy,
		onsell,
		busy
	}: Props = $props();

	let color = $derived(ELEMENT_COLOR[element]);
	let units = $derived(quantity / MARKET_UNIT);
	let buyCost = $derived(estimateBuyCost(element, units));
	let sellGain = $derived(estimateSellGain(element, units));
	let canBuy = $derived(!busy && playerMoney >= buyCost);
	let canSell = $derived(!busy && epBalance >= quantity);
	let impactPct = $derived((units * 2.5).toFixed(0));
</script>

<div class="flex flex-col gap-4">
	<!-- Current price display -->
	<div
		class="rounded-2xl p-4 border"
		style="background: {color}11; border-color: {color}33;"
	>
		<p class="text-xs uppercase tracking-widest font-black mb-1" style="color: {color}99;">
			Preço atual por {MARKET_UNIT} pontos
		</p>
		<p class="text-3xl font-black" style="color: {color};">
			💰 {currentPrice.toLocaleString('pt-BR')}
		</p>
		<p class="text-xs text-[var(--text-muted)] mt-1">
			±2.5%+ por transação (escala com sequência) · reset a cada 2h · taxa 1%
		</p>
	</div>

	<!-- Quantity selector pills -->
	<div class="overflow-x-auto flex gap-1.5 pb-1 scrollbar-hide">
		{#each QUANTITY_STEPS as step (step)}
			<button
				onclick={() => onquantitychange(step)}
				class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black border-2 transition-all duration-150"
				style={step === quantity
					? `background: ${color}33; border-color: ${color}88; color: ${color};`
					: `background: transparent; border-color: var(--border); color: var(--text-muted);`}
			>
				{step >= 1000 ? `${step / 1000}k` : step}
			</button>
		{/each}
	</div>

	<!-- Player balances -->
	<div class="grid grid-cols-2 gap-3">
		<div class="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
			<p class="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-1">Seu saldo</p>
			<p class="text-base font-black text-[var(--text)]">💰 {formatNumber(playerMoney)}</p>
		</div>
		<div class="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
			<p class="text-[10px] uppercase tracking-wider font-bold mb-1" style="color: {color}99;">
				{ELEMENT_EMOJI[element]} {ELEMENT_LABEL[element]}
			</p>
			<p class="text-base font-black text-[var(--text)]">{formatNumber(epBalance)} pts</p>
		</div>
	</div>

	<!-- Buy / Sell buttons -->
	<div class="grid grid-cols-2 gap-3">
		<button
			onclick={onbuy}
			disabled={!canBuy}
			class="flex flex-col items-center gap-1 rounded-2xl py-4 px-3 font-black text-sm transition-all duration-150 border-2 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
			style={canBuy
				? `background: #22c55e22; border-color: #22c55e55; color: #22c55e;`
				: `background: #22c55e11; border-color: #22c55e22; color: #22c55e88;`}
		>
			{#if busy}
				<span class="animate-pulse">⏳</span>
			{:else}
				<span class="text-xl">📈</span>
				<span>Comprar {formatNumber(quantity)}</span>
				<span class="text-xs font-medium opacity-80">💰 {formatNumber(buyCost)}</span>
			{/if}
		</button>

		<button
			onclick={onsell}
			disabled={!canSell}
			class="flex flex-col items-center gap-1 rounded-2xl py-4 px-3 font-black text-sm transition-all duration-150 border-2 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
			style={canSell
				? `background: #ef444422; border-color: #ef444455; color: #ef4444;`
				: `background: #ef444411; border-color: #ef444422; color: #ef444488;`}
		>
			{#if busy}
				<span class="animate-pulse">⏳</span>
			{:else}
				<span class="text-xl">📉</span>
				<span>Vender {formatNumber(quantity)}</span>
				<span class="text-xs font-medium opacity-80">+💰 {formatNumber(sellGain)}</span>
			{/if}
		</button>
	</div>

	<!-- Impact estimate -->
	<p class="text-[10px] text-[var(--text-muted)] text-center">
		Impacto estimado: ~{impactPct}% no preço
	</p>

	{#if !canBuy && !busy && playerMoney < buyCost}
		<p class="text-xs text-[var(--text-muted)] text-center">
			Faltam 💰 {formatNumber(buyCost - playerMoney)} para comprar
		</p>
	{/if}
</div>
