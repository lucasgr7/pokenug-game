<script lang="ts">
	import { clamp } from '$lib/utils/math';

	let {
		hp,
		maxHp,
		block = 0
	}: { hp: number; maxHp: number; block?: number } = $props();

	let total = $derived(maxHp + Math.max(0, block));
	let hpPct = $derived(total > 0 ? clamp((hp / total) * 100, 0, 100) : 0);
	let blockPct = $derived(total > 0 ? clamp((Math.max(0, block) / total) * 100, 0, 100) : 0);
	let low = $derived(maxHp > 0 && hp / maxHp < 0.25);
	let fill = $derived(
		low
			? 'linear-gradient(180deg,#f87171,#dc2626)'
			: hp / Math.max(1, maxHp) < 0.55
				? 'linear-gradient(180deg,#fbbf24,#f59e0b)'
				: 'linear-gradient(180deg,#4ade80,#16a34a)'
	);
</script>

<div class="w-full">
	<div class="relative h-4 w-full overflow-hidden rounded-full border border-black/40 bg-black/45 shadow-inner">
		<div
			class="h-full rounded-full transition-[width] duration-300 ease-out"
			class:hp-pulse={low}
			style="width: {hpPct}%; background: {fill};"
		></div>
		{#if block > 0}
			<div
				class="absolute top-0 h-full transition-[width,left] duration-300 ease-out"
				style="left: {hpPct}%; width: {blockPct}%; background: linear-gradient(180deg,#60a5fa,#2563eb);"
			></div>
		{/if}
		<!-- brilho superior -->
		<div class="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/15"></div>
		<!-- rótulo sobreposto -->
		<div
			class="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-white"
			style="text-shadow: 0 1px 2px rgba(0,0,0,0.9);"
		>
			{Math.ceil(hp)} / {maxHp}{#if block > 0}&nbsp;· 🛡{block}{/if}
		</div>
	</div>
</div>

<style>
	.hp-pulse {
		animation: hp-pulse 0.9s ease-in-out infinite;
	}
	@keyframes hp-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
