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

	async function reload() {
		cards = (await getInventory()).filter((c) => isUpgradeable(getTemplate(c.templateId)));
	}
	onMount(reload);

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
			{#each cards as c (c.id)}
				<button class="relative upgrade-card-btn" onclick={() => (selected = c)}>
					<Card templateId={c.templateId} compact iconOnlyBadge upgradeLevel={c.upgrades ?? 0} playable />
				</button>
			{/each}
		</div>
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
</style>
