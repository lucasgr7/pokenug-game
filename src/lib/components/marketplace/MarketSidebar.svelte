<script lang="ts">
	import { ELEMENTS, type Element } from '$lib/game/types';
	import { marketState } from '$lib/game/market.svelte';
	import MarketElementItem from './MarketElementItem.svelte';

	interface Props {
		selected: Element;
		onselect: (el: Element) => void;
	}

	let { selected, onselect }: Props = $props();

	/** Previous price per element (second-to-last history entry). */
	function prevPrice(el: Element): number | undefined {
		const data = marketState.value?.elements[el];
		if (!data || data.history.length < 2) return undefined;
		return data.history[data.history.length - 2].price;
	}

	function currentPrice(el: Element): number {
		return marketState.value?.elements[el]?.currentPrice ?? 0;
	}

	// Sort elements by current price descending for a "leaderboard" feel
	let sorted = $derived(
		[...ELEMENTS].sort((a, b) => currentPrice(b) - currentPrice(a))
	);
</script>

<aside class="flex flex-col h-full overflow-hidden bg-[var(--surface)] border-r border-[var(--border)] w-11">
	<div class="flex-1 overflow-y-auto px-1 py-1.5 space-y-0.5">
		{#each sorted as el (el)}
			<MarketElementItem
				element={el}
				price={currentPrice(el)}
				prevPrice={prevPrice(el)}
				selected={el === selected}
				onclick={() => onselect(el)}
			/>
		{/each}
	</div>
</aside>
