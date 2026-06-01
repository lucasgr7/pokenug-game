<script lang="ts">
	import type { MarketPriceEntry } from '$lib/game/types';
	import { formatNumber } from '$lib/utils/math';

	interface Props {
		history: MarketPriceEntry[];
		color: string;
	}

	let { history, color }: Props = $props();

	const MIN_VISIBLE_BARS = 4;

	let padded = $derived<MarketPriceEntry[]>(
		history.length < MIN_VISIBLE_BARS
			? [
					...Array.from({ length: MIN_VISIBLE_BARS - history.length }, (_, i) => ({
						timestamp: (history[0]?.timestamp ?? Date.now()) - (MIN_VISIBLE_BARS - history.length - i) * 15 * 60 * 1000,
						price: history[0]?.price ?? 1000
					})),
					...history
				]
			: history
	);

	let maxP = $derived(Math.max(...padded.map((e) => e.price)));
	let minP = $derived(Math.min(...padded.map((e) => e.price)));
	let range = $derived(Math.max(maxP - minP, maxP * 0.05)); // at least 5% range for visual spread

	function barHeight(price: number): number {
		return Math.max(4, ((price - minP) / range) * 100);
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
	}

	// Show time labels at first, middle, and last bar
	function shouldShowLabel(i: number, total: number): boolean {
		return i === 0 || i === Math.floor(total / 2) || i === total - 1;
	}
</script>

<div class="flex flex-col gap-1">
	<!-- Bars (horizontally scrollable, fixed bar width) -->
	<div class="overflow-x-auto rounded-lg">
		<div
			class="relative flex items-end gap-1.5"
			style="height: 120px; min-width: {padded.length * 22}px;"
		>
			<!-- Y-axis guide lines -->
			{#each [25, 50, 75] as pct}
				<div
					class="absolute left-0 right-0 border-t border-white/5"
					style="bottom: {pct}%;"
				></div>
			{/each}

			{#each padded as entry, i (entry.timestamp)}
				{@const isLast = i === padded.length - 1}
				{@const h = barHeight(entry.price)}
				<div
					class="relative group flex-1 rounded-t transition-all duration-500"
					style="height: {h}%; background: {isLast ? color : color + '55'}; min-width: 14px; min-height: 4px;"
				>
					<!-- Tooltip on hover -->
					<div
						class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none"
					>
						<div
							class="rounded-lg px-2 py-1 text-[10px] font-black text-white whitespace-nowrap shadow-lg"
							style="background: {color}ee;"
						>
							💰 {formatNumber(entry.price)}
						</div>
						<div class="w-1.5 h-1.5 rotate-45" style="background: {color};"></div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- X-axis time labels -->
	<div class="flex px-1 gap-0.5">
		{#each padded as entry, i (entry.timestamp)}
			<div class="flex-1 text-center">
				{#if shouldShowLabel(i, padded.length)}
					<span class="text-[9px] text-[var(--text-muted)] font-medium">{formatTime(entry.timestamp)}</span>
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
