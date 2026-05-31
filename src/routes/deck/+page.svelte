<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { getInventory, getActiveDeck, addToDeck, removeFromDeck } from '$lib/db/cards';
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENTS, type Card as CardT, type CardKind, type Element } from '$lib/game/types';
	import { ELEMENT_LABEL } from '$lib/game/elements';
	import { pushToast } from '$lib/stores/toast.svelte';

	const MAX_DECK = 35;
	const MIN_DECK = 8;

	let inventory = $state<CardT[]>([]);
	let deckIds = $state<string[]>([]);
	let loaded = $state(false);

	let inspectingTemplateId = $state<string | null>(null);
	let isInspectingInDeck = $state(false);
	
	let inspectedGroup = $derived(inspectingTemplateId ? groupCards(inventory).find(g => g.templateId === inspectingTemplateId) : null);
	let inspectedTemplate = $derived(inspectingTemplateId ? getTemplate(inspectingTemplateId) : null);

	// Filtros
	let fElement = $state<'all' | Element>('all');
	let fKind = $state<'all' | CardKind>('all');
	let fCost = $state<'all' | number>('all');

	const kinds: CardKind[] = ['attack', 'defense', 'heal', 'capture', 'buff'];
	const kindLabel: Record<CardKind, string> = {
		attack: 'Ataque',
		power: 'Poder',
		defense: 'Defesa',
		heal: 'Cura',
		capture: 'Captura',
		buff: 'Buff',
		relic: 'Relíquia',
		energy: 'Energia',
		combo: 'Combo'
	};

	onMount(async () => {
		inventory = await getInventory();
		deckIds = (await getActiveDeck()).map((c) => c.id);
		loaded = true;
	});

	let deckSet = $derived(new Set(deckIds));

	interface Group {
		templateId: string;
		total: number;
		inDeck: number;
	}

	function groupCards(cards: CardT[]): Group[] {
		const map = new Map<string, Group>();
		for (const c of cards) {
			const g = map.get(c.templateId) ?? { templateId: c.templateId, total: 0, inDeck: 0 };
			g.total++;
			if (deckSet.has(c.id)) g.inDeck++;
			map.set(c.templateId, g);
		}
		return [...map.values()].sort((a, b) => {
			const ta = getTemplate(a.templateId);
			const tb = getTemplate(b.templateId);
			if (!ta || !tb) return 0;
			return ta.cost - tb.cost || ta.name.localeCompare(tb.name);
		});
	}

	function passesFilter(templateId: string): boolean {
		const t = getTemplate(templateId);
		if (!t) return false;
		if (fElement !== 'all' && t.element !== fElement) return false;
		if (fKind !== 'all' && t.kind !== fKind) return false;
		if (fCost !== 'all' && t.cost !== fCost) return false;
		return true;
	}

	let invGroups = $derived(groupCards(inventory).filter((g) => passesFilter(g.templateId)));
	let deckGroups = $derived(groupCards(inventory.filter((c) => deckSet.has(c.id))));

	async function addOne(templateId: string) {
		if (deckIds.length >= MAX_DECK) {
			pushToast(`Deck cheio (${MAX_DECK}).`, 'error');
			return;
		}
		const card = inventory.find((c) => c.templateId === templateId && !deckSet.has(c.id));
		if (!card) {
			pushToast('Todas as cópias já estão no deck.', 'info');
			return;
		}
		await addToDeck(card);
		deckIds = [...deckIds, card.id];
	}

	function removeOne(templateId: string) {
		const id = deckIds.find((cid) => inventory.find((c) => c.id === cid)?.templateId === templateId);
		if (!id) return;
		removeFromDeck(id).then(() => {
			deckIds = deckIds.filter((x) => x !== id);
			if (inspectedGroup && inspectedGroup.inDeck <= 1) {
			    inspectingTemplateId = null;
			}
		});
	}

	function inspectCard(templateId: string, fromDeck: boolean) {
		inspectingTemplateId = templateId;
		isInspectingInDeck = fromDeck;
	}
</script>

<Hud />

<main class="px-4 py-4 max-w-6xl mx-auto">
	<!-- Deck ativo -->
	<div class="mb-4 flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-3">
		<h1 class="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Deck Ativo</h1>
		<div class="flex items-center gap-2 mt-2 md:mt-0">
			<span class="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Cartas selecionadas:</span>
			<span
				class="rounded-full px-2.5 py-0.5 text-sm font-bold shadow-inner"
				class:bg-red-500={deckIds.length < MIN_DECK}
				class:text-white={deckIds.length < MIN_DECK}
				class:bg-[var(--surface-overlay)]={deckIds.length >= MIN_DECK}
				class:text-[var(--text)]={deckIds.length >= MIN_DECK}
			>
				{deckIds.length} <span class="opacity-50">/ {MAX_DECK}</span>
			</span>
		</div>
	</div>

	{#if deckIds.length < MIN_DECK}
		<div class="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 font-semibold shadow-sm flex items-center gap-3">
			<span class="text-xl">⚠️</span>
			<p>Mínimo de {MIN_DECK} cartas exigido para batalhar. Faltam {MIN_DECK - deckIds.length}.</p>
		</div>
	{/if}

	<div class="mb-6 text-sm font-medium text-[var(--text-muted)] bg-[var(--surface)] p-3 rounded-xl border border-white/5 shadow-sm">
		💡 Toque em uma carta para <strong class="text-[var(--text)]">inspecionar detalhes</strong> e adicioná-la ou removê-la.
	</div>

	{#if deckGroups.length === 0}
		<div class="mb-8 flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-[var(--surface)] opacity-70">
			<span class="text-4xl mb-3">🎴</span>
			<p class="text-base font-bold text-[var(--text-muted)]">Seu deck está completamente vazio.</p>
		</div>
	{:else}
		<div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each deckGroups as g (g.templateId)}
				<Card templateId={g.templateId} count={g.inDeck} badge="no deck" onclick={() => inspectCard(g.templateId, true)} />
			{/each}
		</div>
	{/if}

	<!-- Filtros -->
	<div class="sticky top-0 z-10 -mx-4 px-4 py-4 mb-4 backdrop-blur-xl bg-[#0f172a]/80 border-b border-white/10">
		<h2 class="mb-3 flex items-center gap-2 text-xl font-black tracking-tight">
			<span class="text-2xl">🎒</span> Seu Inventário
		</h2>
		<div class="flex flex-wrap md:flex-nowrap gap-2 text-sm">
			<select
				bind:value={fElement}
				class="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2.5 font-semibold shadow-sm hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors outline-none"
			>
				<option value="all">⭐ Todos elementos</option>
				{#each ELEMENTS as el (el)}
					<option value={el}>{ELEMENT_LABEL[el]}</option>
				{/each}
			</select>
			<select
				bind:value={fKind}
				class="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2.5 font-semibold shadow-sm hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors outline-none"
			>
				<option value="all">⚔️ Todos tipos</option>
				{#each kinds as k (k)}
					<option value={k}>{kindLabel[k]}</option>
				{/each}
			</select>
			<select
				bind:value={fCost}
				class="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2.5 font-semibold shadow-sm hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors outline-none"
			>
				<option value="all">💎 Todo custo</option>
				{#each [1, 2, 3, 4] as c (c)}
					<option value={c}>Custo {c}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if !loaded}
		<div class="flex items-center justify-center py-12 opacity-60">
			<span class="animate-pulse text-lg font-bold flex items-center gap-2"><span>⏳</span> Carregando inventário...</span>
		</div>
	{:else if invGroups.length === 0}
		<div class="flex flex-col items-center justify-center py-12 opacity-60">
			<span class="text-4xl mb-4 grayscale">🔍</span>
			<p class="text-base font-bold text-[var(--text-muted)]">Nenhuma carta atende aos filtros.</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 pb-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each invGroups as g (g.templateId)}
				{@const available = g.total - g.inDeck}
				<Card
					templateId={g.templateId}
					count={g.total}
					dimmed={available === 0}
					badge={available > 0 ? `+${available}` : 'no deck'}
					onclick={() => inspectCard(g.templateId, false)}
				/>
			{/each}
		</div>
	{/if}
</main>

<Modal open={!!inspectingTemplateId} onclose={() => { inspectingTemplateId = null; }} title="Inspecionar Carta">
	{#if inspectedTemplate && inspectedGroup}
		<div class="flex flex-col items-center">
			<div class="w-48 mb-4">
				<Card templateId={inspectedTemplate.id} showcase={true} />
			</div>
			<div class="bg-[var(--surface-overlay)] w-full rounded-xl p-4 mb-4 text-center">
				<p class="text-sm font-medium text-[var(--text-muted)] mb-1">Efeito</p>
				<p class="text-[var(--text)] italic leading-relaxed text-sm">
					"{inspectedTemplate.description}"
				</p>
			</div>
			<div class="flex items-center gap-3 w-full">
				{#if inspectedGroup.inDeck > 0}
					<button
						onclick={() => removeOne(inspectedTemplate.id)}
						class="flex-1 py-3 px-4 rounded-xl font-bold bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
					>
						Remover (-1)
					</button>
				{/if}
				{#if inspectedGroup.total - inspectedGroup.inDeck > 0}
					<button
						onclick={() => addOne(inspectedTemplate.id)}
						disabled={deckIds.length >= MAX_DECK}
						class="flex-1 py-3 px-4 rounded-xl font-bold bg-[var(--accent)] text-white hover:brightness-110 transition-colors disabled:opacity-50 disabled:grayscale"
					>
						Adicionar Deck (+1)
					</button>
				{/if}
			</div>
			{#if deckIds.length >= MAX_DECK && inspectedGroup.total - inspectedGroup.inDeck > 0}
				<p class="text-xs text-red-400 mt-3 text-center">Deck cheio ({MAX_DECK}/{MAX_DECK}). Remova uma carta para adicionar.</p>
			{/if}
		</div>
	{/if}
</Modal>
