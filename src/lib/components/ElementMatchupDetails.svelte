<script lang="ts">
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { getElementMatchup } from '$lib/game/type-chart';
	import type { Element } from '$lib/game/types';

	let { element }: { element: Element } = $props();

	let matchup = $derived(getElementMatchup(element));
	let strengths = $derived(matchup.strengths);
	let weaknesses = $derived(matchup.weaknesses);
</script>

<div class="space-y-4">
	<div
		class="rounded-2xl border px-4 py-3"
		style={`border-color:${ELEMENT_COLOR[element]}55;background:color-mix(in srgb, ${ELEMENT_COLOR[element]} 16%, var(--surface));`}
	>
		<div class="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Leitura elemental</div>
		<div class="mt-1 flex items-center gap-2 text-lg font-black" style={`color:${ELEMENT_COLOR[element]};`}>
			<span>{ELEMENT_EMOJI[element]}</span>
			<span>{ELEMENT_LABEL[element]}</span>
		</div>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			Ataques deste tipo causam mais dano contra os elementos fortes e menos dano contra os resistentes.
		</p>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		<section class="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-3">
			<div class="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Forte contra</div>
			<div class="mt-2 flex flex-wrap gap-2">
				{#if strengths.length > 0}
					{#each strengths as target (target)}
						<span class="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
							{ELEMENT_EMOJI[target]} {ELEMENT_LABEL[target]}
						</span>
					{/each}
				{:else}
					<span class="text-sm text-[var(--text-muted)]">Nenhuma vantagem direta.</span>
				{/if}
			</div>
		</section>

		<section class="rounded-2xl border border-sky-500/25 bg-sky-500/8 p-3">
			<div class="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Fraco contra</div>
			<div class="mt-2 flex flex-wrap gap-2">
				{#if weaknesses.length > 0}
					{#each weaknesses as target (target)}
						<span class="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-100">
							{ELEMENT_EMOJI[target]} {ELEMENT_LABEL[target]}
						</span>
					{/each}
				{:else}
					<span class="text-sm text-[var(--text-muted)]">Sem fraquezas cadastradas.</span>
				{/if}
			</div>
		</section>
	</div>
</div>
