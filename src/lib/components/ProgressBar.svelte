<script lang="ts">
	import { clamp } from '$lib/utils/math';

	let {
		value = 0,
		max = 1,
		color = 'var(--accent)',
		height = 8,
		label = '',
		animate = true
	}: {
		value?: number;
		max?: number;
		color?: string;
		height?: number;
		label?: string;
		animate?: boolean;
	} = $props();

	let pct = $derived(max > 0 ? clamp((value / max) * 100, 0, 100) : 0);
</script>

<div class="w-full">
	{#if label}
		<div class="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
			<span>{label}</span>
		</div>
	{/if}
	<div
		class="w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
		style="height: {height}px;"
	>
		<div
			class="h-full rounded-full ease-out"
			class:transition-[width]={animate}
			class:duration-300={animate}
			style="width: {pct}%; background: {color};"
		></div>
	</div>
</div>
