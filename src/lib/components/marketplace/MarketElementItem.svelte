<script lang="ts">
	import type { Element } from '$lib/game/types';
	import { ELEMENT_COLOR, ELEMENT_EMOJI } from '$lib/game/elements';

	interface Props {
		element: Element;
		price: number;
		prevPrice: number | undefined;
		selected: boolean;
		onclick: () => void;
		event?: { kind: 'surge' | 'crash' } | null;
		crashed?: boolean;
	}

	let { element, price, prevPrice, selected, onclick, event = null, crashed = false }: Props = $props();

	let trend = $derived<'up' | 'down' | 'flat'>(
		prevPrice === undefined || price === prevPrice
			? 'flat'
			: price > prevPrice
				? 'up'
				: 'down'
	);
	let color = $derived(ELEMENT_COLOR[element]);
</script>

<button
	{onclick}
	title="{element}"
	class="relative w-full flex items-center justify-center py-1.5 rounded-lg transition-all duration-150 border"
	style={selected
		? `background: ${color}22; border-color: ${color}66;`
		: 'border-color: transparent; background: transparent;'}
>
	<span class="text-lg leading-none">{ELEMENT_EMOJI[element]}</span>
	<!-- Trend dot -->
	<span
		class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
		class:bg-green-400={trend === 'up'}
		class:bg-red-400={trend === 'down'}
		class:hidden={trend === 'flat'}
	></span>
	<!-- Crash badge -->
	{#if crashed}
		<span class="absolute bottom-0.5 right-0.5 text-[8px] leading-none animate-pulse drop-shadow-[0_0_4px_#ef4444]">
			🚫
		</span>
	{:else if event}
		<span
			class="absolute bottom-0.5 right-0.5 text-[8px] leading-none animate-pulse"
			class:drop-shadow-[0_0_4px_#eab308]={event.kind === 'surge'}
			class:drop-shadow-[0_0_4px_#ef4444]={event.kind === 'crash'}
		>
			{event.kind === 'surge' ? '🔥' : '💀'}
		</span>
	{/if}
</button>
