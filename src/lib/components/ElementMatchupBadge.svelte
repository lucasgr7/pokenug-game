<script lang="ts">
	import Modal from './Modal.svelte';
	import ElementMatchupDetails from './ElementMatchupDetails.svelte';
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

	let open = $state(false);

	function showDetails(event: MouseEvent) {
		event.stopPropagation();
		open = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		open = true;
	}
</script>

<div class="pointer-events-auto">
	<span
		role="button"
		tabindex="0"
		class="matchup-badge inline-flex items-center rounded-full border text-[10px] font-black uppercase tracking-[0.14em]"
		class:gap-1={!iconOnly}
		class:px-2={!iconOnly}
		class:py-1={!iconOnly}
		class:p-1={iconOnly}
		style={`--badge-color:${ELEMENT_COLOR[element]};`}
		onclick={showDetails}
		onkeydown={handleKeydown}
		aria-label={`Abrir matchups de ${ELEMENT_LABEL[element]}`}
	>
		<span class="text-xs" class:text-[10px]={iconOnly}>{ELEMENT_EMOJI[element]}</span>
		{#if !iconOnly}
			<span>{compact ? 'tipo' : ELEMENT_LABEL[element]}</span>
		{/if}
	</span>
</div>

<Modal open={open} title={`${ELEMENT_EMOJI[element]} ${ELEMENT_LABEL[element]}`} onclose={() => (open = false)}>
	<ElementMatchupDetails {element} />
</Modal>

<style>
	.matchup-badge {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: color-mix(in srgb, var(--badge-color) 72%, white);
		border-color: color-mix(in srgb, var(--badge-color) 44%, transparent);
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--badge-color) 18%, rgba(15, 23, 42, 0.92)), rgba(15, 23, 42, 0.84)),
			rgba(15, 23, 42, 0.82);
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.28);
	}

	.matchup-badge:hover,
	.matchup-badge:focus-visible {
		outline: none;
		transform: translateY(-1px);
		box-shadow: 0 10px 22px rgba(15, 23, 42, 0.34);
	}
	</style>
