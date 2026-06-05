<script lang="ts">
	import { onMount } from 'svelte';
	import Card from './Card.svelte';
	import Modal from './Modal.svelte';
	import { getInventory } from '$lib/db/cards';
	import { getTemplate } from '$lib/data/cards';
	import { isUpgradeable, cardUpgradeCost, canAffordUpgrade, upgradeCardCopy } from '$lib/game/upgrades.svelte';
	import { ELEMENT_EMOJI } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import { pushToast } from '$lib/stores/toast.svelte';
	import type { Card as CardT, CardTemplate } from '$lib/game/types';

	let cards = $state<CardT[]>([]);
	let selected = $state<CardT | null>(null);
	let page = $state(0);
	const PAGE_SIZE = 9;

	async function reload() {
		const raw = (await getInventory()).filter((c) => isUpgradeable(getTemplate(c.templateId)));
		raw.sort((a, b) => {
			const ta = getTemplate(a.templateId);
			const tb = getTemplate(b.templateId);
			const ea = ta?.element ? 0 : 1;
			const eb = tb?.element ? 0 : 1;
			return ea - eb;
		});
		cards = raw;
		page = 0;
	}
	onMount(reload);

	let pageCount = $derived(Math.max(1, Math.ceil(cards.length / PAGE_SIZE)));
	let paged = $derived(cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));

	let selTpl = $derived(selected ? getTemplate(selected.templateId) : null);
	let selLevel = $derived(selected?.upgrades ?? 0);
	let selCost = $derived(selTpl ? cardUpgradeCost(selTpl, selLevel) : null);
	let selAffordable = $derived(selTpl ? canAffordUpgrade(selTpl, selLevel) : false);

	function statLabel(tpl: CardTemplate, level: number): string {
		if (tpl.kind === 'attack') return `⚔ ${(tpl.damage ?? 0) + level} → ${(tpl.damage ?? 0) + level + 1}`;
		return `🛡 ${(tpl.block ?? 0) + level} → ${(tpl.block ?? 0) + level + 1}`;
	}

	async function doUpgrade() {
		if (!selected) return;
		const id = selected.id;
		const res = await upgradeCardCopy(id);
		if (res == null) { pushToast('Recursos insuficientes.', 'error'); return; }
		pushToast('Carta aprimorada!', 'success');
		await reload();
		selected = cards.find((c) => c.id === id) ?? null;
	}
</script>

<section class="mt-6">
	<h2 class="mb-2 text-base font-bold">Aprimorar Cartas</h2>
	<p class="mb-2 text-[10px] text-[var(--text-muted)]">+1 de dano/escudo por nível. Preço sobe na escala Fibonacci.</p>
	{#if cards.length === 0}
		<p class="text-sm text-[var(--text-muted)]">Nenhuma carta de ataque/defesa no inventário.</p>
	{:else}
		<div class="grid grid-cols-3 gap-1.5">
			{#each paged as c (c.id)}
				<button class="relative upgrade-card-btn" onclick={() => (selected = c)}>
					<Card templateId={c.templateId} compact iconOnlyBadge upgradeLevel={c.upgrades ?? 0} playable />
				</button>
			{/each}
		</div>
		{#if pageCount > 1}
			<div class="mt-2 flex items-center justify-center gap-3">
				<button class="pag-btn" disabled={page === 0} onclick={() => page--}>←</button>
				<span class="text-[11px] font-bold text-[var(--text-muted)]">{page + 1} / {pageCount}</span>
				<button class="pag-btn" disabled={page >= pageCount - 1} onclick={() => page++}>→</button>
			</div>
		{/if}
	{/if}
</section>

<Modal open={!!selected} title="Aprimorar carta" onclose={() => (selected = null)}>
	{#if selected && selTpl && selCost}
		<div class="flex flex-col items-center gap-3">
			<div class="w-40"><Card templateId={selTpl.id} showcase upgradeLevel={selLevel} /></div>
			<p class="text-sm font-bold">{statLabel(selTpl, selLevel)}</p>
			<p class="text-xs text-[var(--text-muted)]">
				💰 {formatNumber(selCost.money)}{#if selCost.element > 0 && selTpl.element} · {ELEMENT_EMOJI[selTpl.element]} {formatNumber(selCost.element)}{/if}
			</p>
			<button class="w-full rounded-xl bg-[var(--accent)] py-2.5 font-bold text-white disabled:opacity-40"
				disabled={!selAffordable} onclick={doUpgrade}>
				Aprimorar (+1)
			</button>
		</div>
	{/if}
</Modal>

<style>
	.upgrade-card-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.pag-btn {
		background: var(--surface-2, #292524);
		border: 1px solid var(--border, #3f3f46);
		border-radius: 8px;
		padding: 4px 12px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text, #f5f5f4);
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.pag-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
