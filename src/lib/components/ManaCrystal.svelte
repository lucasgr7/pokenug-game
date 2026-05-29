<script lang="ts">
	let { mana, max = 3 }: { mana: number; max?: number } = $props();
	let pips = $derived(Array.from({ length: max }, (_, i) => i < mana));
</script>

<div class="flex items-center gap-1" aria-label="{mana} de {max} mana">
	{#each pips as filled, i (i)}
		<span
			class="inline-block h-4 w-4 rotate-45 rounded-sm border transition-colors"
			style={filled
				? 'background: var(--accent); border-color: var(--accent);'
				: 'background: transparent; border-color: var(--border);'}
		></span>
	{/each}
</div>
