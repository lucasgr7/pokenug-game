<script lang="ts">
	import type { MarketCandle } from '$lib/game/types';
	import { formatNumber } from '$lib/utils/math';

	interface Props {
		candles: MarketCandle[];
		color: string;
	}

	let { candles, color }: Props = $props();

	const MIN_VISIBLE_BARS = 4;

	let padded = $derived<MarketCandle[]>(
		candles.length < MIN_VISIBLE_BARS
			? [
					...Array.from({ length: MIN_VISIBLE_BARS - candles.length }, (_, i) => ({
						t: (candles[0]?.t ?? Date.now()) - (MIN_VISIBLE_BARS - candles.length - i) * 5 * 60 * 1000,
						o: candles[0]?.c ?? 1000,
						h: candles[0]?.c ?? 1000,
						l: candles[0]?.c ?? 1000,
						c: candles[0]?.c ?? 1000
					})),
					...candles
				]
			: candles
	);

	let maxP = $derived(Math.max(...padded.map((c) => c.h)));
	let minP = $derived(Math.min(...padded.map((c) => c.l)));
	let range = $derived(Math.max(maxP - minP, maxP * 0.05));

	function pctFromBottom(val: number): number {
		return ((val - minP) / range) * 100;
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
	}

	function shouldShowLabel(i: number, total: number): boolean {
		return i === 0 || i === Math.floor(total / 2) || i === total - 1;
	}

	let hovered = $state<number | null>(null);
</script>

<div class="flex flex-col gap-1">
	<!-- Candlestick chart (horizontally scrollable) -->
	<div class="overflow-x-auto rounded-lg">
		<div
			class="relative flex items-end gap-0.5"
			style="height: 140px; min-width: {padded.length * 20}px;"
		>
			<!-- Y-axis guide lines -->
			{#each [25, 50, 75] as pct}
				<div
					class="absolute left-0 right-0 border-t border-white/5"
					style="bottom: {pct}%;"
				></div>
			{/each}

			{#each padded as candle, i (candle.t)}
				{@const bullish = candle.c >= candle.o}
				{@const bodyTop = pctFromBottom(Math.max(candle.o, candle.c))}
				{@const bodyBottom = pctFromBottom(Math.min(candle.o, candle.c))}
				{@const bodyHeight = Math.max(2, bodyTop - bodyBottom)}
				{@const wickTop = pctFromBottom(candle.h)}
				{@const wickBottom = pctFromBottom(candle.l)}
				{@const wickHeight = Math.max(1, wickTop - wickBottom)}
				{@const green = '#22c55e'}
				{@const red = '#ef4444'}
				{@const candleColor = bullish ? green : red}

				<div
					class="relative flex-1 flex flex-col items-center cursor-pointer"
					style="min-width: 14px; height: 100%;"
					onmouseenter={() => (hovered = i)}
					onmouseleave={() => (hovered = null)}
					role="presentation"
				>
					<!-- Wick (thin vertical line from low to high) -->
					<div
						class="absolute w-px rounded-full"
						style="background: {candleColor}88; bottom: {wickBottom}%; height: {wickHeight}%;"
					></div>

					<!-- Body (rect from open to close) -->
					<div
						class="absolute w-[8px] rounded-sm transition-all duration-200"
						style="background: {candleColor}{hovered === i ? 'ff' : 'aa'}; bottom: {bodyBottom}%; height: {bodyHeight}%;"
					></div>

					<!-- Tooltip -->
					{#if hovered === i}
						<div
							class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none"
						>
							<div
								class="rounded-lg px-2.5 py-1.5 text-[10px] font-black text-white whitespace-nowrap shadow-lg space-y-0.5"
								style="background: {candleColor}ee;"
							>
								<div>O: 💰{formatNumber(candle.o)}</div>
								<div>H: 💰{formatNumber(candle.h)}</div>
								<div>L: 💰{formatNumber(candle.l)}</div>
								<div>C: 💰{formatNumber(candle.c)}</div>
							</div>
							<div class="w-1.5 h-1.5 rotate-45 mx-auto" style="background: {candleColor};"></div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- X-axis time labels -->
	<div class="flex px-1 gap-0.5">
		{#each padded as candle, i (candle.t)}
			<div class="flex-1 text-center">
				{#if shouldShowLabel(i, padded.length)}
					<span class="text-[9px] text-[var(--text-muted)] font-medium">{formatTime(candle.t)}</span>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Price range legend -->
	<div class="flex justify-between px-1 mt-1">
		<span class="text-[10px] text-[var(--text-muted)]">Min: 💰{formatNumber(minP)}</span>
		<span class="text-[10px] text-[var(--text-muted)]">Máx: 💰{formatNumber(maxP)}</span>
	</div>
</div>
