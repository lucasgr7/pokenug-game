<script lang="ts">
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { getElementInteraction } from '$lib/game/type-chart';
	import type { Element } from '$lib/game/types';

	let {
		attacker,
		defender
	}: {
		attacker: Element;
		defender: Element;
	} = $props();

	let interaction = $derived(getElementInteraction(attacker, defender));
</script>

{#if interaction.strongAgainst}
	<div
		class="rounded-xl border px-2 py-1.5"
		style={`border-color:${ELEMENT_COLOR[attacker]}55;background:color-mix(in srgb, ${ELEMENT_COLOR[attacker]} 14%, var(--surface));`}
	>
		<div class="text-[9px] font-black uppercase tracking-[0.16em] text-(--text-muted)">Perigo elemental</div>
		<div class="mt-1 text-[11px] font-bold" style={`color:${ELEMENT_COLOR[attacker]};`}>
			{ELEMENT_EMOJI[attacker]} {ELEMENT_LABEL[attacker]} é forte contra seu
			{ELEMENT_EMOJI[defender]} {ELEMENT_LABEL[defender]}
		</div>
	</div>
{/if}
