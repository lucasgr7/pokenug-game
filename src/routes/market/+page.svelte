<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import MarketSidebar from '$lib/components/marketplace/MarketSidebar.svelte';
	import MarketChart from '$lib/components/marketplace/MarketChart.svelte';
	import MarketTradeControls from '$lib/components/marketplace/MarketTradeControls.svelte';
	import PlatinumTradeControls from '$lib/components/marketplace/PlatinumTradeControls.svelte';
	import GreatDealBurst from '$lib/components/marketplace/GreatDealBurst.svelte';
	import { ELEMENTS, type Element } from '$lib/game/types';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import {
		marketState,
		initMarket,
		tickAllElements,
		buyElementPoints,
		sellElementPoints,
		getActiveEvent,
		getOracle,
		msUntilNextReset,
		platinumDiscount,
		platinumDiscountTick,
		getPlatinumPrice
	} from '$lib/game/market.svelte';
	import { game, getElementPoints } from '$lib/game/state.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';

	// ---- State ----
	let selectedCommodity = $state<Element | 'platinum'>('fire');
	let busy = $state(false);
	let infoOpen = $state(false);
	let tradeQty = $state(100);
	let burstTrigger = $state(0);
	let burstMessage = $state('LUCRO!');

	// ---- Derived (element-specific) ----
	let isPlatinum = $derived(selectedCommodity === 'platinum');
	let el = $derived(selectedCommodity as Element);
	let selectedData = $derived(marketState.value?.elements?.[el]);
	let selectedColor = $derived(isPlatinum ? '#a78bfa' : ELEMENT_COLOR[el]);
	let playerMoney = $derived(game.player?.money ?? 0);
	let epBalance = $derived(getElementPoints(el));
	let activeEvent = $derived(isPlatinum ? null : getActiveEvent(el));
	let oracle = $derived(isPlatinum ? 'neutral' : getOracle(el));
	let resetMs = $derived(isPlatinum ? 0 : msUntilNextReset(el));
	let resetMinutes = $derived(Math.floor(resetMs / 60_000));
	let isCrashed = $derived(!!marketState.value?.elements?.[el]?.crashedAt);

	// ---- Lifecycle ----
	onMount(() => {
		let tickInterval: ReturnType<typeof setInterval> | null = null;

		(async () => {
			await initMarket();
			await tickAllElements();

			tickInterval = setInterval(async () => {
				await tickAllElements();
			}, 30_000);
		})();

		return () => {
			if (tickInterval) clearInterval(tickInterval);
		};
	});

	// ---- Watch for platinum discount (the only popup) ----
	$effect(() => {
		const _tick = platinumDiscountTick.value;
		if (_tick > 0 && platinumDiscount.value) {
			const pct = Math.round(platinumDiscount.value.pct * 100);
			pushToast(`✨ Platinum em promoção! ~${pct}% OFF`, 'success');
		}
	});

	// ---- Trade handlers ----
	async function handleBuy() {
		if (busy || isPlatinum) return;
		busy = true;
		try {
			const result = await buyElementPoints(el, tradeQty);
			if (!result.success) pushToast(result.message, 'error');
			if (result.success && result.greatDeal) {
				burstMessage = 'ÓTIMA COMPRA!';
				burstTrigger++;
			}
		} finally {
			busy = false;
		}
	}

	async function handleSell() {
		if (busy || isPlatinum) return;
		busy = true;
		try {
			const result = await sellElementPoints(el, tradeQty);
			if (!result.success) pushToast(result.message, 'error');
			if (result.success && result.greatDeal) {
				burstMessage = 'LUCRO!';
				burstTrigger++;
			}
		} finally {
			busy = false;
		}
	}

	// ---- Trend helper ----
	function globalTrendSummary(): { up: number; down: number } {
		if (!marketState.value) return { up: 0, down: 0 };
		let up = 0,
			down = 0;
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

	// ---- Event countdown ----
	let eventMinutes = $derived(
		activeEvent ? Math.max(0, Math.floor((activeEvent.endsAt - Date.now()) / 60_000)) : 0
	);

	// ---- Platinum discount countdown ----
	let discountActive = $derived(platinumDiscount.value && Date.now() < platinumDiscount.value.endsAt);
	let discountMinutes = $derived(
		platinumDiscount.value ? Math.max(0, Math.floor((platinumDiscount.value.endsAt - Date.now()) / 60_000)) : 0
	);
	let discountPct = $derived(platinumDiscount.value ? Math.round(platinumDiscount.value.pct * 100) : 0);
</script>

<Hud />

<GreatDealBurst trigger={burstTrigger} message={burstMessage} />

<div class="flex h-[calc(100dvh-56px-env(safe-area-inset-bottom)-49px)] overflow-hidden">
	<!-- Sidebar (commodity selector) -->
	<div class="flex-shrink-0">
		<MarketSidebar selected={selectedCommodity} onselect={(el) => (selectedCommodity = el)} />
	</div>

	<!-- Main area -->
	<div class="flex-1 overflow-y-auto px-4 py-4 space-y-5">
		{#if isPlatinum}
			<!-- Platinum header -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="text-lg">⬡</span>
					<h1 class="text-base font-black" style="color: #a78bfa;">Platinum</h1>
					{#if discountActive}
						<span
							class="text-xs font-black px-2 py-0.5 rounded-full"
							style="background: #a78bfa33; color: #a78bfa;"
						>
							-{discountPct}%
						</span>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={() => (infoOpen = true)}
						class="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] text-sm font-black hover:text-[var(--text)] transition-colors flex items-center justify-center"
						aria-label="Como funciona"
					>
						?
					</button>
				</div>
			</div>

			<!-- Platinum discount banner -->
			{#if discountActive}
				<div
					class="rounded-xl px-4 py-2.5 flex items-center gap-2 border text-sm font-bold"
					style="background: #a78bfa11; border-color: #a78bfa44; color: #a78bfa;"
				>
					<span class="animate-pulse">✨</span>
					<span>Platinum em promoção! -{discountPct}%</span>
					<span class="ml-auto text-xs opacity-80">~{discountMinutes}min restantes</span>
				</div>
			{/if}

			<!-- Platinum chart -->
			{#if marketState.value?.platinum?.candles && marketState.value.platinum.candles.length > 0}
				<div class="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
					<div class="flex items-center justify-between mb-3">
						<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">
							Gráfico de Preços (Platinum)
						</p>
					</div>
					<MarketChart candles={marketState.value.platinum.candles} color="#a78bfa" />
				</div>
			{:else}
				<div
					class="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] flex items-center justify-center"
				>
					<span class="animate-pulse text-sm text-[var(--text-muted)]">Carregando...</span>
				</div>
			{/if}

			<!-- Platinum trade controls -->
			<PlatinumTradeControls {playerMoney} {busy} />
		{:else}
			<!-- Element market header -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="text-lg">{ELEMENT_EMOJI[el]}</span>
					<h1 class="text-base font-black" style="color: {selectedColor};">
						{ELEMENT_LABEL[el]}
					</h1>
					<span class="text-xs font-bold text-green-400">{trend.up}↑</span>
					<span class="text-xs font-bold text-red-400">{trend.down}↓</span>
					<!-- Oracle badge -->
					{#if oracle === 'up'}
						<span class="text-xs font-black text-green-400">🔮 ALTA ↑</span>
					{:else if oracle === 'down'}
						<span class="text-xs font-black text-red-400">🔮 BAIXA ↓</span>
					{:else}
						<span class="text-xs font-black text-[var(--text-muted)]">🔮 incerta</span>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={() => (infoOpen = true)}
						class="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] text-sm font-black hover:text-[var(--text)] transition-colors flex items-center justify-center"
						aria-label="Como funciona"
					>
						?
					</button>
				</div>
			</div>

			<!-- Event banner -->
			{#if activeEvent}
				<div
					class="rounded-xl px-4 py-2.5 flex items-center gap-2 border text-sm font-bold"
					style={activeEvent.kind === 'surge'
						? 'background: #eab30811; border-color: #eab30844; color: #eab308;'
						: 'background: #ef444411; border-color: #ef444444; color: #ef4444;'}
				>
					{#if activeEvent.kind === 'surge'}
						<span class="animate-pulse">🔥</span>
						<span>ALTA! Preço subindo 3x mais rápido</span>
					{:else}
						<span class="animate-pulse">💀</span>
						<span>QUEDA! Preço caindo 1.5%/min</span>
					{/if}
					<span class="ml-auto text-xs opacity-80">~{eventMinutes}min restantes</span>
				</div>
			{/if}

			<!-- Crash banner -->
			{#if isCrashed}
				<div
					class="rounded-xl px-4 py-2.5 flex items-center gap-2 border text-sm font-bold"
					style="background: #00000022; border-color: #ef444488; color: #ef4444;"
				>
					<span class="animate-pulse">🚫</span>
					<span>MERCADO EM CRASH! {ELEMENT_LABEL[el]} congelado</span>
					<span class="ml-auto text-xs opacity-80">Reabre em ~2h</span>
				</div>
			{/if}

			<!-- Price chart -->
			{#if selectedData && selectedData.candles && selectedData.candles.length > 0}
				<div class="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
					<div class="flex items-center justify-between mb-3">
						<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">
							Gráfico de Preços (velas de 5min)
						</p>
						<span class="text-[10px] text-[var(--text-muted)]">Reset em ~{resetMinutes}min</span>
					</div>
					<MarketChart candles={selectedData.candles} color={selectedColor} />
				</div>
			{:else}
				<div
					class="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] flex items-center justify-center"
				>
					<span class="animate-pulse text-sm text-[var(--text-muted)]">Carregando mercado...</span>
				</div>
			{/if}

			<!-- Trade controls -->
			{#if selectedData}
				<MarketTradeControls
					element={el}
					currentPrice={selectedData.currentPrice}
					{epBalance}
					{playerMoney}
					quantity={tradeQty}
					onquantitychange={(q) => (tradeQty = q)}
					onbuy={handleBuy}
					onsell={handleSell}
					{busy}
				/>
			{/if}
		{/if}
	</div>
</div>

<Modal open={infoOpen} onclose={() => (infoOpen = false)} title="Como funciona">
	<div class="space-y-3 text-sm">
		<p class="text-[var(--text-muted)] leading-relaxed">
			O Mercado de Pontos Elementares funciona como uma bolsa de valores em tempo real:
		</p>
		<ul class="space-y-2 text-[var(--text)]">
			<li class="flex gap-2">
				<span>📦</span><span>Compra e venda em lotes de <strong>100 a 100.000 pontos</strong></span>
			</li>
			<li class="flex gap-2">
				<span>📈</span><span>Cada <strong>compra</strong> aumenta o preço em <strong>2.5%+</strong> (escala com sequência)</span>
			</li>
			<li class="flex gap-2">
				<span>📉</span><span>Cada <strong>venda</strong> reduz o preço em <strong>2.5%+</strong> (vendas consecutivas drenam o preço)</span>
			</li>
			<li class="flex gap-2">
				<span>🔄</span><span>A cada <strong>2 horas</strong> os preços são reajustados com novo patamar</span>
			</li>
			<li class="flex gap-2">
				<span>🔥</span><span><strong>Eventos de ALTA</strong> aceleram o preço 3x por ~10-20min</span>
			</li>
			<li class="flex gap-2">
				<span>💀</span><span><strong>Eventos de QUEDA</strong> drenam o preço 1.5%/min por ~10-20min</span>
			</li>
			<li class="flex gap-2">
				<span>🔮</span><span><strong>Oráculo</strong> dá dicas sobre a direção do preço (60% precisão)</span>
			</li>
			<li class="flex gap-2">
				<span>✨</span><span>Compre durante QUEDA ou venda durante ALTA para <strong>lucro extra!</strong></span>
			</li>
			<li class="flex gap-2">
				<span>⬡</span><span><strong>Platinum</strong> é comprado com dinheiro a preço crescente. Compre na promoção!</span>
			</li>
			<li class="flex gap-2">
				<span>💸</span><span>Taxa de <strong>1%</strong> em cada compra e venda (dinheiro destruído)</span>
			</li>
			<li class="flex gap-2">
				<span>🟢</span><span>Velas verdes = preço subiu; velas vermelhos = caiu</span>
			</li>
		</ul>
	</div>
</Modal>
