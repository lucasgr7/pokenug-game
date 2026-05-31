<script lang="ts">
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { CATALOG, getTemplate } from '$lib/data/cards';
	import { ELEMENTS, type CardKind, type Element } from '$lib/game/types';
	import { ELEMENT_LABEL } from '$lib/game/elements';

	let fElement = $state<'all' | Element>('all');
	let fKind = $state<'all' | CardKind>('all');
	let fCost = $state<'all' | number>('all');

	const kinds: CardKind[] = ['attack', 'defense', 'heal', 'capture', 'buff', 'power', 'debuff', 'energy', 'combo', 'relic'];
	const kindLabel: Record<CardKind, string> = {
		attack: 'Ataque',
		power: 'Poder',
		defense: 'Defesa',
		heal: 'Cura',
		capture: 'Captura',
		buff: 'Buff',
		debuff: 'Debuff',
		relic: 'Relíquia',
		energy: 'Energia',
		combo: 'Combo'
	};

	let inspectingTemplateId = $state<string | null>(null);
	let inspectedTemplate = $derived(inspectingTemplateId ? getTemplate(inspectingTemplateId) : null);

	function passesFilter(tpl: typeof CATALOG[0]): boolean {
		if (fElement !== 'all' && tpl.element !== fElement) return false;
		if (fKind !== 'all' && tpl.kind !== fKind) return false;
		if (fCost !== 'all' && tpl.cost !== fCost) return false;
		return true;
	}

	let filteredCatalog = $derived(CATALOG.filter(passesFilter));
</script>

<Hud />

<main class="px-4 py-4 max-w-6xl mx-auto">
	<div class="mb-4 flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-3">
		<h1 class="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Glossário</h1>
	</div>

	<div class="mb-6 text-sm font-medium text-[var(--text-muted)] bg-[var(--surface)] p-3 rounded-xl border border-white/5 shadow-sm">
		💡 Explore todas as cartas que existem no universo de Pokengu. Toque para inspecionar seus detalhes e efeitos.
	</div>

	<!-- Filtros -->
	<div class="sticky top-0 z-10 -mx-4 px-4 py-4 mb-4 backdrop-blur-xl bg-[#0f172a]/80 border-b border-white/10">
		<div class="flex flex-wrap md:flex-nowrap gap-2 text-sm">
			<select
				bind:value={fElement}
				class="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2.5 font-semibold shadow-sm focus:border-[var(--accent)] outline-none"
			>
				<option value="all">⭐ Todos elementos</option>
				{#each ELEMENTS as el (el)}
					<option value={el}>{ELEMENT_LABEL[el]}</option>
				{/each}
			</select>
			<select
				bind:value={fKind}
				class="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2.5 font-semibold shadow-sm focus:border-[var(--accent)] outline-none"
			>
				<option value="all">⚔️ Todos tipos</option>
				{#each kinds as k (k)}
					<option value={k}>{kindLabel[k]}</option>
				{/each}
			</select>
			<select
				bind:value={fCost}
				class="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2.5 font-semibold shadow-sm focus:border-[var(--accent)] outline-none"
			>
				<option value="all">💎 Todo custo</option>
				{#each [1, 2, 3, 4, 5, 0] as c}
					<option value={c}>Custo {c}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if filteredCatalog.length === 0}
		<div class="flex flex-col items-center justify-center py-12 opacity-60">
			<span class="text-4xl mb-4 grayscale">🔍</span>
			<p class="text-base font-bold text-[var(--text-muted)]">Nenhuma carta encontrada para esses filtros.</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 pb-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each filteredCatalog as card (card.id)}
				<Card
					templateId={card.id}
					onclick={() => inspectingTemplateId = card.id}
				/>
			{/each}
		</div>
	{/if}
</main>

<Modal open={!!inspectingTemplateId} onclose={() => { inspectingTemplateId = null; }} title="Inspecionar Carta">
	{#if inspectedTemplate}
		<div class="flex flex-col items-center">
			<div class="w-48 mb-4">
				<Card templateId={inspectedTemplate.id} showcase={true} />
			</div>
			<div class="bg-[var(--surface-overlay)] w-full rounded-xl p-4 text-center border border-white/10">
				<p class="text-xs uppercase font-black text-[var(--text-muted)] mb-1 tracking-widest">Efeito da Carta</p>
				<p class="text-[var(--text)] italic leading-relaxed text-sm">
					"{inspectedTemplate.description}"
				</p>
			</div>
			<div class="mt-4 grid grid-cols-3 gap-2 w-full text-center text-xs">
				<div class="bg-[var(--surface)] rounded-xl py-2 border border-white/10">
					<div class="text-[var(--text-muted)] font-black uppercase mb-1">Custo</div>
					<div class="text-[var(--text)] font-semibold">{inspectedTemplate.cost} MP</div>
				</div>
				<div class="bg-[var(--surface)] rounded-xl py-2 border border-white/10">
					<div class="text-[var(--text-muted)] font-black uppercase mb-1">Raridade</div>
					<div class="font-bold uppercase {inspectedTemplate.rarity === 'common' ? 'text-slate-400' : inspectedTemplate.rarity === 'rare' ? 'text-blue-400' : inspectedTemplate.rarity === 'epic' ? 'text-purple-400' : inspectedTemplate.rarity === 'secret' ? 'text-amber-300' : 'text-amber-500'}">{inspectedTemplate.rarity}</div>
				</div>
				<div class="bg-[var(--surface)] rounded-xl py-2 border border-white/10">
					<div class="text-[var(--text-muted)] font-black uppercase mb-1">Elemento</div>
					<div class="text-[var(--text)] font-semibold">{inspectedTemplate.element ? ELEMENT_LABEL[inspectedTemplate.element] : 'Neutro'}</div>
				</div>
			</div>
		</div>
	{/if}
</Modal>
