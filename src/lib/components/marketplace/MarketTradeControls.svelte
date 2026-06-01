<script lang="ts">
	import type { Element } from '$lib/game/types';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import { MARKET_UNIT } from '$lib/game/market.svelte';

	interface Props {
		element: Element;
		currentPrice: number;
		epBalance: number;
		playerMoney: number;
		onbuy: () => void;
		onsell: () => void;
		busy: boolean;
	}

	let { element, currentPrice, epBalance, playerMoney, onbuy, onsell, busy }: Props = $props();

	let color = $derived(ELEMENT_COLOR[element]);
	let canBuy = $derived(!busy && playerMoney >= currentPrice);
	let canSell = $derived(!busy && epBalance >= MARKET_UNIT);
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
			±1% por transação · +1% por hora · reset a cada 4h
		</p>
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
				<span>Comprar {MARKET_UNIT}</span>
				<span class="text-xs font-medium opacity-80">💰 {currentPrice.toLocaleString('pt-BR')}</span>
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
				<span>Vender {MARKET_UNIT}</span>
				<span class="text-xs font-medium opacity-80">+💰 {currentPrice.toLocaleString('pt-BR')}</span>
			{/if}
		</button>
	</div>

	{#if !canBuy && !busy}
		<p class="text-xs text-[var(--text-muted)] text-center">
			Faltam 💰 {formatNumber(currentPrice - playerMoney)} para comprar
		</p>
	{/if}
</div>
