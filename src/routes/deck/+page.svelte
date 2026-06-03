<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { getInventory, getActiveDeck, addToDeck, removeFromDeck } from '$lib/db/cards';
	import { getTemplate, CATALOG } from '$lib/data/cards';
	import { ELEMENTS, type Card as CardT, type CardKind, type Element } from '$lib/game/types';
	import { ELEMENT_LABEL } from '$lib/game/elements';

	// Tabs
	let activeTab = $state<'deck' | 'catalog'>('deck');
	import { pushToast } from '$lib/stores/toast.svelte';
  import CardDetailsModal from '$lib/components/CardDetailsModal.svelte';

	// ---- Catalog tab state ----
	let catElement = $state<'all' | Element>('all');
	let catKind = $state<'all' | CardKind>('all');
	let catCost = $state<'all' | number>('all');
	let catalogInspectingId = $state<string | null>(null);
	let catalogInspectedTemplate = $derived(catalogInspectingId ? getTemplate(catalogInspectingId) : null);
	let filteredCatalog = $derived(
		CATALOG.filter((t) => {
			if (catElement !== 'all' && t.element !== catElement) return false;
			if (catKind !== 'all' && t.kind !== catKind) return false;
			if (catCost !== 'all' && t.cost !== catCost) return false;
			return true;
		})
	);

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

	let inspectActionLabel = $derived.by(() => {
		if (!inspectedGroup) return 'Adicionar ao deck';
		if (isInspectingInDeck) return 'Remover do deck';
		return 'Adicionar ao deck';
	});

	let inspectActionPlayable = $derived.by(() => {
		if (!inspectedGroup) return false;
		if (isInspectingInDeck) return inspectedGroup.inDeck > 0;
		const available = inspectedGroup.total - inspectedGroup.inDeck;
		return available > 0 && deckIds.length < MAX_DECK;
	});

	let inspectActionDisabledLabel = $derived.by(() => {
		if (!inspectedGroup) return 'Acao indisponivel';
		if (isInspectingInDeck) return 'Sem carta no deck';
		if (deckIds.length >= MAX_DECK) return `Deck cheio (${MAX_DECK})`;
		return 'Sem copias livres';
	});

	async function handleInspectAction() {
		if (!inspectingTemplateId || !inspectedGroup) return;
		if (isInspectingInDeck) {
			removeOne(inspectingTemplateId);
			return;
		}
		await addOne(inspectingTemplateId);
	}
</script>

<Hud />

<!-- Tab switcher -->
<div class="sticky top-0 z-20 flex border-b border-[var(--border)] bg-[var(--bg)]">
	<button
		class="flex-1 py-3 text-sm font-bold transition-colors"
		class:text-[var(--accent)]={activeTab === 'deck'}
		class:border-b-2={activeTab === 'deck'}
		class:border-[var(--accent)]={activeTab === 'deck'}
		class:text-[var(--text-muted)]={activeTab !== 'deck'}
		onclick={() => activeTab = 'deck'}
	>🃏 Meu Deck</button>
	<button
		class="flex-1 py-3 text-sm font-bold transition-colors"
		class:text-[var(--accent)]={activeTab === 'catalog'}
		class:border-b-2={activeTab === 'catalog'}
		class:border-[var(--accent)]={activeTab === 'catalog'}
		class:text-[var(--text-muted)]={activeTab !== 'catalog'}
		onclick={() => activeTab = 'catalog'}
	>📖 Catálogo</button>
</div>

{#if activeTab === 'deck'}
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
		<div class="mb-10 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
			{#each deckGroups as g (g.templateId)}
				<Card templateId={g.templateId} count={g.inDeck} badge="no deck" compact={true} onclick={() => inspectCard(g.templateId, true)} />
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
		<div class="grid grid-cols-3 gap-2 pb-12 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
			{#each invGroups as g (g.templateId)}
				{@const available = g.total - g.inDeck}
				<Card
					templateId={g.templateId}
					count={g.total}
					dimmed={available === 0}
					badge={available > 0 ? `+${available}` : 'no deck'}
					compact={true}
					onclick={() => inspectCard(g.templateId, false)}
				/>
			{/each}
		</div>
	{/if}
</main>

{:else}
<!-- Catalog tab -->
<main class="px-4 py-4 max-w-6xl mx-auto">
	<div class="mb-4">
		<h1 class="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Catálogo</h1>
		<p class="text-sm text-[var(--text-muted)] mt-1">Todas as cartas do universo Pokengu.</p>
	</div>

	<!-- Catalog filters -->
	<div class="sticky top-[49px] z-10 -mx-4 px-4 py-3 mb-4 backdrop-blur-xl bg-[#0f172a]/80 border-b border-white/10">
		<div class="flex flex-wrap gap-2 text-sm">
			<select bind:value={catElement}
				class="flex-1 min-w-[130px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2 font-semibold focus:border-[var(--accent)] outline-none">
				<option value="all">⭐ Elementos</option>
				{#each ELEMENTS as el (el)}<option value={el}>{ELEMENT_LABEL[el]}</option>{/each}
			</select>
			<select bind:value={catKind}
				class="flex-1 min-w-[130px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2 font-semibold focus:border-[var(--accent)] outline-none">
				<option value="all">⚔️ Tipos</option>
				{#each kinds as k (k)}<option value={k}>{kindLabel[k]}</option>{/each}
			</select>
			<select bind:value={catCost}
				class="flex-1 min-w-[100px] rounded-xl border border-white/10 bg-[var(--surface)] px-3 py-2 font-semibold focus:border-[var(--accent)] outline-none">
				<option value="all">💎 Custo</option>
				{#each [1,2,3,4,5] as c}<option value={c}>Custo {c}</option>{/each}
			</select>
		</div>
	</div>

	{#if filteredCatalog.length === 0}
		<div class="flex flex-col items-center justify-center py-12 opacity-60">
			<span class="text-4xl mb-4 grayscale">🔍</span>
			<p class="text-base font-bold text-[var(--text-muted)]">Nenhuma carta encontrada.</p>
		</div>
	{:else}
		<div class="grid grid-cols-3 gap-2 pb-12 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
			{#each filteredCatalog as card (card.id)}
				<Card templateId={card.id} onclick={() => (catalogInspectingId = card.id)} />
			{/each}
		</div>
	{/if}
</main>
{/if}

<CardDetailsModal
	templateId={inspectingTemplateId}
	open={!!inspectingTemplateId}
	onclose={() => { inspectingTemplateId = null; }}
	onplay={handleInspectAction}
	playable={inspectActionPlayable}
	actionLabel={inspectActionLabel}
	disabledLabel={inspectActionDisabledLabel}
	/>


<Modal open={!!catalogInspectingId} onclose={() => { catalogInspectingId = null; }} title="Inspecionar Carta">
	{#if catalogInspectedTemplate}
		<div class="flex flex-col items-center">
			<div class="w-48 mb-4">
				<Card templateId={catalogInspectedTemplate.id} compact={true} showcase={true} />
			</div>
			<div class="bg-[var(--surface-overlay)] w-full rounded-xl p-4 text-center border border-white/10">
				<p class="text-xs uppercase font-black text-[var(--text-muted)] mb-1 tracking-widest">Efeito da Carta</p>
				<p class="text-[var(--text)] italic leading-relaxed text-sm">"{catalogInspectedTemplate.description}"</p>
			</div>
		</div>
	{/if}
</Modal>
