<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { t } from '$lib/i18n';
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
	import { notifyHudTrade } from '$lib/stores/hud.svelte';
	import posthog from 'posthog-js';

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
			pushToast(t('market.platinumDiscount', { pct }), 'success');
		}
	});

	// ---- Trade handlers ----
	async function handleBuy() {
		if (busy || isPlatinum) return;
		busy = true;
		try {
			const result = await buyElementPoints(el, tradeQty);
			if (!result.success) pushToast(result.message, 'error');
			if (result.success) {
				posthog.capture('element_points_purchased', {
					element: el,
					quantity: tradeQty,
					great_deal: result.greatDeal ?? false
				});
				notifyHudTrade(el, 'buy');
				if (result.greatDeal) {
					burstMessage = t('market.greatBuy');
					burstTrigger++;
				}
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
			if (result.success) {
				notifyHudTrade(el, 'sell');
				if (result.greatDeal) {
					burstMessage = t('market.profit');
					burstTrigger++;
				}
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
					<h1 class="text-base font-black" style="color: #a78bfa;">{$_('market.platinum')}</h1>
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
						aria-label={$_('market.howTo')}
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
					<span>{$_('market.platinumDiscount', { values: { pct: discountPct } })}</span>
					<span class="ml-auto text-xs opacity-80">{$_('market.minutesLeft', { values: { min: discountMinutes } })}</span>
				</div>
			{/if}

			<!-- Platinum chart -->
			{#if marketState.value?.platinum?.candles && marketState.value.platinum.candles.length > 0}
				<div class="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
					<div class="flex items-center justify-between mb-3">
						<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">
							{$_('market.priceChart')}
						</p>
					</div>
					<MarketChart candles={marketState.value.platinum.candles} color="#a78bfa" />
				</div>
			{:else}
				<div
					class="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] flex items-center justify-center"
				>
					<span class="animate-pulse text-sm text-[var(--text-muted)]">{$_('market.carregando')}</span>
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
						{$_('elements.' + el)}
					</h1>
					<span class="text-xs font-bold text-green-400">{trend.up}↑</span>
					<span class="text-xs font-bold text-red-400">{trend.down}↓</span>
					<!-- Oracle badge -->
					{#if oracle === 'up'}
						<span class="text-xs font-black text-green-400">{$_('market.oracleUp')}</span>
					{:else if oracle === 'down'}
						<span class="text-xs font-black text-red-400">{$_('market.oracleDown')}</span>
					{:else}
						<span class="text-xs font-black text-[var(--text-muted)]">{$_('market.oracleUncertain')}</span>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={() => (infoOpen = true)}
						class="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] text-sm font-black hover:text-[var(--text)] transition-colors flex items-center justify-center"
						aria-label={$_('market.howTo')}
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
						<span>{$_('market.surgeEvent')}</span>
					{:else}
						<span class="animate-pulse">💀</span>
						<span>{$_('market.crashEvent')}</span>
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
					<span>{$_('market.marketCrash', { values: { element: $_('elements.' + el) } })}</span>
					<span class="ml-auto text-xs opacity-80">{$_('market.reopensIn')}</span>
				</div>
			{/if}

			<!-- Price chart -->
			{#if selectedData && selectedData.candles && selectedData.candles.length > 0}
				<div class="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
					<div class="flex items-center justify-between mb-3">
						<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">
							{$_('market.priceChartCandles')}
						</p>
						<span class="text-[10px] text-[var(--text-muted)]">{$_('market.resetIn', { values: { min: resetMinutes } })}</span>
					</div>
					<MarketChart candles={selectedData.candles} color={selectedColor} />
				</div>
			{:else}
				<div
					class="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] flex items-center justify-center"
				>
					<span class="animate-pulse text-sm text-[var(--text-muted)]">{$_('market.carregandoMercado')}</span>
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

<Modal open={infoOpen} onclose={() => (infoOpen = false)} title={$_('market.infoModalTitle')}>
	<div class="space-y-3 text-sm">
		<p class="text-[var(--text-muted)] leading-relaxed">
			{$_('market.infoIntro')}
		</p>
		<ul class="space-y-2 text-[var(--text)]">
			<li class="flex gap-2">
				<span>📦</span><span>{@html $_('market.infoBuySell')}</span>
			</li>
			<li class="flex gap-2">
				<span>📈</span><span>{@html $_('market.infoBuyImpact')}</span>
			</li>
			<li class="flex gap-2">
				<span>📉</span><span>{@html $_('market.infoSellImpact')}</span>
			</li>
			<li class="flex gap-2">
				<span>🔄</span><span>{@html $_('market.infoReset')}</span>
			</li>
			<li class="flex gap-2">
				<span>🔥</span><span>{@html $_('market.infoSurge')}</span>
			</li>
			<li class="flex gap-2">
				<span>💀</span><span>{@html $_('market.infoCrash')}</span>
			</li>
			<li class="flex gap-2">
				<span>🔮</span><span>{@html $_('market.infoOracle')}</span>
			</li>
			<li class="flex gap-2">
				<span>✨</span><span>{@html $_('market.infoProfitTip')}</span>
			</li>
			<li class="flex gap-2">
				<span>⬡</span><span>{@html $_('market.infoPlatinum')}</span>
			</li>
			<li class="flex gap-2">
				<span>💸</span><span>{@html $_('market.infoFee')}</span>
			</li>
			<li class="flex gap-2">
				<span>🟢</span><span>{@html $_('market.infoCandles')}</span>
			</li>
		</ul>
	</div>
</Modal>
