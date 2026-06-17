<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import Hud from '$lib/components/Hud.svelte';
	import MarketChart from '$lib/components/marketplace/MarketChart.svelte';
	import PlatinumTradeControls from '$lib/components/marketplace/PlatinumTradeControls.svelte';
	import {
		marketState,
		initMarket,
		tickAllElements,
		platinumDiscount,
		platinumDiscountTick,
		getPlatinumPrice
	} from '$lib/game/market.svelte';
	import { game } from '$lib/game/state.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { t } from '$lib/i18n';

	// ---- State ----
	let busy = $state(false);

	// ---- Derived ----
	let playerMoney = $derived(game.player?.money ?? 0);

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

	// ---- Watch for platinum discount ----
	$effect(() => {
		const _tick = platinumDiscountTick.value;
		if (_tick > 0 && platinumDiscount.value) {
			const pct = Math.round(platinumDiscount.value.pct * 100);
			pushToast(t('market.platinumDiscount', { pct }), 'success');
		}
	});

	// ---- Platinum discount countdown ----
	let discountActive = $derived(platinumDiscount.value && Date.now() < platinumDiscount.value.endsAt);
	let discountMinutes = $derived(
		platinumDiscount.value ? Math.max(0, Math.floor((platinumDiscount.value.endsAt - Date.now()) / 60_000)) : 0
	);
	let discountPct = $derived(platinumDiscount.value ? Math.round(platinumDiscount.value.pct * 100) : 0);
</script>

<Hud />

<div class="flex h-[calc(100dvh-56px-env(safe-area-inset-bottom)-49px)] overflow-hidden">
	<!-- Main area -->
	<div class="flex-1 overflow-y-auto px-4 py-4 space-y-5">
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
	</div>
</div>
