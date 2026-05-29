<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
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

	// Filtros
	let fElement = $state<'all' | Element>('all');
	let fKind = $state<'all' | CardKind>('all');
	let fCost = $state<'all' | number>('all');

	const kinds: CardKind[] = ['attack', 'defense', 'heal', 'capture', 'buff'];
	const kindLabel: Record<CardKind, string> = {
		attack: 'Ataque',
		defense: 'Defesa',
		heal: 'Cura',
		capture: 'Captura',
		buff: 'Buff'
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

	async function removeOne(templateId: string) {
		const id = deckIds.find((cid) => inventory.find((c) => c.id === cid)?.templateId === templateId);
		if (!id) return;
		await removeFromDeck(id);
		deckIds = deckIds.filter((x) => x !== id);
	}
</script>

<Hud />

<main class="px-4 py-4">
	<!-- Deck ativo -->
	<div class="mb-1 flex items-center justify-between">
		<h1 class="text-xl font-bold">Deck ativo</h1>
		<span
			class="text-sm font-semibold"
			class:text-[var(--danger)]={deckIds.length < MIN_DECK}
			class:text-[var(--text-muted)]={deckIds.length >= MIN_DECK}
		>
			{deckIds.length}/{MAX_DECK}
		</span>
	</div>
	{#if deckIds.length < MIN_DECK}
		<p class="mb-2 text-xs text-[var(--danger)]">Mínimo de {MIN_DECK} cartas para batalhar.</p>
	{/if}

	<p class="mb-2 text-xs text-[var(--text-muted)]">
		Toque em uma carta do <strong>inventário</strong> para adicionar, ou no <strong>deck</strong> para remover.
	</p>

	{#if deckGroups.length === 0}
		<p class="mb-4 text-sm text-[var(--text-muted)]">Toque em cartas do inventário para adicioná-las.</p>
	{:else}
		<div class="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
			{#each deckGroups as g (g.templateId)}
				<Card templateId={g.templateId} count={g.inDeck} badge="remover" onclick={() => removeOne(g.templateId)} />
			{/each}
		</div>
	{/if}

	<!-- Filtros -->
	<h2 class="mb-2 text-lg font-bold">Inventário</h2>
	<div class="mb-3 flex flex-wrap gap-2 text-xs">
		<select
			bind:value={fElement}
			class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
		>
			<option value="all">Todos elementos</option>
			{#each ELEMENTS as el (el)}
				<option value={el}>{ELEMENT_LABEL[el]}</option>
			{/each}
		</select>
		<select
			bind:value={fKind}
			class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
		>
			<option value="all">Todos tipos</option>
			{#each kinds as k (k)}
				<option value={k}>{kindLabel[k]}</option>
			{/each}
		</select>
		<select
			bind:value={fCost}
			class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
		>
			<option value="all">Todo custo</option>
			{#each [1, 2, 3, 4] as c (c)}
				<option value={c}>Custo {c}</option>
			{/each}
		</select>
	</div>

	{#if !loaded}
		<p class="text-sm text-[var(--text-muted)]">Carregando…</p>
	{:else if invGroups.length === 0}
		<p class="text-sm text-[var(--text-muted)]">Nenhuma carta encontrada.</p>
	{:else}
		<div class="grid grid-cols-3 gap-2 pb-4 sm:grid-cols-4">
			{#each invGroups as g (g.templateId)}
				{@const available = g.total - g.inDeck}
				<Card
					templateId={g.templateId}
					count={g.total}
					dimmed={available === 0}
					badge={available > 0 ? `+${available}` : 'no deck'}
					onclick={() => addOne(g.templateId)}
				/>
			{/each}
		</div>
	{/if}
</main>
