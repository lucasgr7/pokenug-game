<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ELEMENTS, type Element } from '$lib/game/types';
	import { marketState, getActiveEvent, getPlatinumPrice, platinumDiscount } from '$lib/game/market.svelte';
	import MarketElementItem from './MarketElementItem.svelte';

	interface Props {
		selected: Element | 'platinum';
		onselect: (el: Element | 'platinum') => void;
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

	function isCrashed(el: Element): boolean {
		return currentPrice(el) <= 0;
	}

	// Sort elements by current price descending for a "leaderboard" feel
	let sorted = $derived(
		[...ELEMENTS].sort((a, b) => currentPrice(b) - currentPrice(a))
	);

	let discountActive = $derived(platinumDiscount.value && Date.now() < platinumDiscount.value.endsAt);
</script>

<aside class="flex flex-col h-full overflow-hidden bg-[var(--surface)] border-r border-[var(--border)] w-11">
	<div class="flex-1 overflow-y-auto px-1 py-1.5 space-y-0.5">
		<!-- Pinned Platinum entry -->
		<button
			onclick={() => onselect('platinum')}
			class="relative w-full flex items-center justify-center py-1.5 rounded-lg transition-all duration-150 border"
			style={selected === 'platinum'
				? 'background: #a78bfa22; border-color: #a78bfa66;'
				: 'border-color: transparent; background: transparent;'}
			title={$_('market.platinum')}
		>
			<span class="text-lg leading-none">⬡</span>
			{#if discountActive}
				<span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
			{/if}
		</button>

		{#each sorted as el (el)}
			<MarketElementItem
				element={el}
				price={currentPrice(el)}
				prevPrice={prevPrice(el)}
				selected={el === selected}
				onclick={() => onselect(el)}
				event={getActiveEvent(el)}
				crashed={isCrashed(el)}
			/>
		{/each}
	</div>
</aside>
