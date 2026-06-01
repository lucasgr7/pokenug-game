<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import MarketSidebar from '$lib/components/marketplace/MarketSidebar.svelte';
	import MarketChart from '$lib/components/marketplace/MarketChart.svelte';
	import MarketTradeControls from '$lib/components/marketplace/MarketTradeControls.svelte';
	import { ELEMENTS, type Element } from '$lib/game/types';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { marketState, initMarket, tickAllElements, buyElementPoints, sellElementPoints } from '$lib/game/market.svelte';
	import { game, getElementPoints } from '$lib/game/state.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { formatNumber } from '$lib/utils/math';

	// ---- State ----
	let selectedElement = $state<Element>('fire');
	let busy = $state(false);
	let infoOpen = $state(false);

	// ---- Derived ----
	let selectedData = $derived(marketState.value?.elements[selectedElement]);
	let selectedColor = $derived(ELEMENT_COLOR[selectedElement]);
	let playerMoney = $derived(game.player?.money ?? 0);
	let epBalance = $derived(getElementPoints(selectedElement));

	// ---- Lifecycle ----
	onMount(() => {
		let tickInterval: ReturnType<typeof setInterval> | null = null;

		(async () => {
			await initMarket();
			await tickAllElements();

			tickInterval = setInterval(async () => {
				await tickAllElements();
			}, 60_000);
		})();

		return () => {
			if (tickInterval) clearInterval(tickInterval);
		};
	});

	// ---- Trade handlers ----
	async function handleBuy() {
		if (busy) return;
		busy = true;
		try {
			const result = await buyElementPoints(selectedElement);
			pushToast(result.message, result.success ? 'success' : 'error');
		} finally {
			busy = false;
		}
	}

	async function handleSell() {
		if (busy) return;
		busy = true;
		try {
			const result = await sellElementPoints(selectedElement);
			pushToast(result.message, result.success ? 'success' : 'error');
		} finally {
			busy = false;
		}
	}

	// ---- Trend helper ----
	function globalTrendSummary(): { up: number; down: number } {
		if (!marketState.value) return { up: 0, down: 0 };
		let up = 0, down = 0;
		for (const el of ELEMENTS) {
			const d = marketState.value.elements[el];
			if (d.history.length < 2) continue;
			const last = d.history[d.history.length - 1].price;
			const prev = d.history[d.history.length - 2].price;
			if (last > prev) up++;
			else if (last < prev) down++;
		}
		return { up, down };
	}
	let trend = $derived(globalTrendSummary());
</script>

<Hud />

<div class="flex h-[calc(100dvh-56px-env(safe-area-inset-bottom)-49px)] overflow-hidden">

	<!-- Sidebar (element selector) -->
	<div class="flex-shrink-0">
		<MarketSidebar selected={selectedElement} onselect={(el) => (selectedElement = el)} />
	</div>

	<!-- Main area -->
	<div class="flex-1 overflow-y-auto px-4 py-4 space-y-5">

		<!-- Market header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="text-lg">{ELEMENT_EMOJI[selectedElement]}</span>
				<h1 class="text-base font-black" style="color: {selectedColor};">
					{ELEMENT_LABEL[selectedElement]}
				</h1>
				<span class="text-xs font-bold text-green-400">{trend.up}↑</span>
				<span class="text-xs font-bold text-red-400">{trend.down}↓</span>
			</div>
			<button
				onclick={() => (infoOpen = true)}
				class="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] text-sm font-black hover:text-[var(--text)] transition-colors flex items-center justify-center"
				aria-label="Como funciona"
			>?</button>
		</div>

		<!-- Price chart -->
		{#if selectedData && selectedData.history.length > 0}
			<div class="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
				<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-3">
					Histórico de Preços (últimas 4h)
				</p>
				<MarketChart history={selectedData.history} color={selectedColor} />
			</div>
		{:else}
			<div class="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] flex items-center justify-center">
				<span class="animate-pulse text-sm text-[var(--text-muted)]">Carregando mercado...</span>
			</div>
		{/if}

		<!-- Trade controls -->
		{#if selectedData}
			<MarketTradeControls
				element={selectedElement}
				currentPrice={selectedData.currentPrice}
				{epBalance}
				{playerMoney}
				onbuy={handleBuy}
				onsell={handleSell}
				{busy}
			/>
		{/if}
	</div>
</div>

<Modal open={infoOpen} onclose={() => (infoOpen = false)} title="Como funciona">
	<div class="space-y-3 text-sm">
		<p class="text-[var(--text-muted)] leading-relaxed">O Mercado de Pontos Elementares funciona como uma bolsa de valores em tempo real:</p>
		<ul class="space-y-2 text-[var(--text)]">
			<li class="flex gap-2"><span>📦</span><span>Compra e venda em lotes de <strong>100 pontos</strong> por vez</span></li>
			<li class="flex gap-2"><span>📈</span><span>Cada <strong>compra</strong> aumenta o preço em <strong>1%</strong></span></li>
			<li class="flex gap-2"><span>📉</span><span>Cada <strong>venda</strong> reduz o preço em <strong>1%</strong></span></li>
			<li class="flex gap-2"><span>⏰</span><span>O preço sobe <strong>1% por hora</strong> automaticamente</span></li>
			<li class="flex gap-2"><span>🔄</span><span>A cada <strong>4 horas</strong> os preços são reajustados com novo patamar</span></li>
			<li class="flex gap-2"><span>🟢</span><span>Ponto verde = preço subindo; ponto vermelho = caindo</span></li>
		</ul>
	</div>
</Modal>
