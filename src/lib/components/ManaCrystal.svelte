<script lang="ts">
	let { mana, max = 3 }: { mana: number; max?: number } = $props();
	let pips = $derived(Array.from({ length: max }, (_, i) => i < mana));
</script>

<div class="flex items-center gap-1.5" aria-label="{mana} de {max} mana">
	{#each pips as filled, i (i)}
		<span class="pip" class:on={filled}></span>
	{/each}
</div>

<style>
	.pip {
		width: 15px;
		height: 15px;
		transform: rotate(45deg);
		border-radius: 3px;
		background: linear-gradient(135deg, #2a2640, #1a1828);
		border: 1px solid #3a3550;
		transition: 0.25s;
	}
	.pip.on {
		background: linear-gradient(135deg, var(--mana-2), var(--mana) 60%, #6d3fd6);
		border-color: var(--mana-2);
		box-shadow:
			0 0 8px rgba(140, 90, 255, 0.7),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
		animation: pip-pop 0.35s ease;
	}
	@keyframes pip-pop {
		0% { transform: rotate(45deg) scale(1.4); filter: brightness(1.7); }
		100% { transform: rotate(45deg) scale(1); }
	}
</style>
