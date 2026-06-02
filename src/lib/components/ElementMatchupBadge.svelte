<script lang="ts">
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import type { Element } from '$lib/game/types';

	let {
		element,
		compact = true,
		iconOnly = false
	}: {
		element: Element;
		compact?: boolean;
		iconOnly?: boolean;
	} = $props();
</script>

<span
	class="type-chip"
	class:icon-only={iconOnly}
	style="--chip-color: {ELEMENT_COLOR[element]};"
	title={ELEMENT_LABEL[element]}
>
	<span class="glyph" aria-hidden="true">{ELEMENT_EMOJI[element]}</span>
	{#if !iconOnly}
		<span class="label">{compact ? 'tipo' : ELEMENT_LABEL[element]}</span>
	{/if}
</span>

<style>
	.type-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 7px;
		border-radius: 7px;
		border: 1px solid color-mix(in srgb, var(--chip-color) 55%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--chip-color) 18%, transparent),
			color-mix(in srgb, var(--chip-color) 10%, transparent)
		);
		color: var(--chip-color);
		font-size: 9.5px;
		font-weight: 800;
		letter-spacing: 0.7px;
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1;
	}
	.type-chip.icon-only {
		padding: 4px;
		gap: 0;
	}
	.glyph {
		font-size: 10px;
		line-height: 1;
	}
	.label {
		opacity: 0.9;
	}
</style>

