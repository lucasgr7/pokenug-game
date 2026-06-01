<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
	import {
		BOOSTER_PACKS,
		shop,
		ensureShopLoaded,
		paidRefresh,
		paidRefreshCost,
		buySlot,
		buyBoosterPack,
		hasPurchasedBoosterToday,
		canAfford,
		buyElementalDamage,
		buyIncomeMultiplier,
		buyElementalVitamins,
		NGU_COSTS
	} from '$lib/game/shop.svelte';
	import { activePokemon, game, getElementPoints, getElementalDamageLevel, getElementalHpLevel } from '$lib/game/state.svelte';
	import { ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import { pushToast } from '$lib/stores/toast.svelte';

	let refreshing = $state(false);

	onMount(async () => {
		await ensureShopLoaded();
	});

	async function buy(i: number) {
		const slot = shop.slots[i];
		const ok = await buySlot(i);
		if (ok) pushToast(`Comprou ${slot.name}!`, 'success');
		else pushToast('Recursos insuficientes.', 'error');
	}

	async function performNguBuy(action: () => Promise<boolean>, name: string) {
		const ok = await action();
		if (ok) pushToast(`Aprimoramento ${name} comprado!`, 'success');
		else pushToast('Recursos insuficientes.', 'error');
	}

	async function refresh() {
		refreshing = true;
		const ok = await paidRefresh();
		if (!ok) pushToast('Dinheiro insuficiente para atualizar.', 'error');
		refreshing = false;
	}

	async function buyPack(packId: (typeof BOOSTER_PACKS)[number]['id']) {
		const rewards = await buyBoosterPack(packId);
		if (!rewards) {
			if (hasPurchasedBoosterToday()) {
				pushToast('Booster diário já comprado.', 'error');
			} else {
				pushToast('Dinheiro insuficiente.', 'error');
			}
			return;
		}
		pushToast(`Pack aberto: ${rewards.map((card) => card.name).join(', ')}`, 'success');
	}

	let activePkm = $derived(activePokemon());
</script>

<Hud />

<main class="px-4 py-4">
	<div class="mb-3 flex items-center justify-between">
		<h1 class="text-xl font-bold">Loja</h1>
		<button
			class="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
			disabled={refreshing}
			onclick={refresh}
		>
			🔄 Atualizar · 💰{formatNumber(paidRefreshCost())}
		</button>
	</div>
	<p class="mb-3 text-xs text-[var(--text-muted)]">Os itens renovam automaticamente todo dia.</p>

	{#if !shop.loaded}
		<p class="text-sm text-[var(--text-muted)]">Carregando…</p>
	{:else}
		<div class="grid grid-cols-3 gap-3">
			{#each shop.slots as slot, i (i)}
				<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<Card templateId={slot.id} playable={false} dimmed={slot.sold} showcase />
					{#if slot.sold}
						<div class="rounded-lg bg-[var(--surface-2)] py-1.5 text-center text-xs font-bold text-[var(--text-muted)]">
							Comprado
						</div>
					{:else}
						<button
							class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
							style="background: var(--accent);"
							disabled={!canAfford(slot)}
							onclick={() => buy(i)}
						>
							💰{formatNumber(slot.price?.money ?? 0)}{#if slot.price?.element}
								· {ELEMENT_EMOJI[slot.price.element.type]}{formatNumber(slot.price.element.amount)}{/if}
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if game.player}
		<div class="mt-8">
			<h2 class="mb-3 text-lg font-bold">Aprimoramentos Permanentes</h2>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				
				<!-- Income Multiplier -->
				<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<div class="flex-1">
						<h3 class="font-bold">Multiplicador de Renda</h3>
						<p class="text-xs text-[var(--text-muted)]">Aumenta todos os ganhos dos Trabalhos idle em 50%.</p>
						<p class="mt-1 text-sm font-bold text-[var(--accent)]">Nível atual: {formatNumber(game.player.ngu.moneyMultiplierLevel)}</p>
					</div>
					<button
						class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
						style="background: var(--accent);"
						disabled={game.player.money < NGU_COSTS.incomeMultiplier(game.player.ngu.moneyMultiplierLevel)}
						onclick={() => performNguBuy(buyIncomeMultiplier, 'Multiplicador de Renda')}
					>
						💰{formatNumber(NGU_COSTS.incomeMultiplier(game.player.ngu.moneyMultiplierLevel))}
					</button>
				</div>

				<!-- Elemental Damage -->
				<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<div class="flex-1">
						<h3 class="font-bold">{activePkm ? `Dano ${ELEMENT_LABEL[activePkm.element]}` : 'Dano Elemental'}</h3>
						<p class="text-xs text-[var(--text-muted)]">Aumenta o dano de todos os pokémons do tipo ativo em +3 por nível.</p>
						{#if activePkm}
							<p class="mt-1 text-sm font-bold text-[var(--accent)]">Nível atual: {formatNumber(getElementalDamageLevel(activePkm.element))}</p>
							<p class="mt-1 text-xs text-[var(--text-muted)]">Saldo: {ELEMENT_EMOJI[activePkm.element]}{formatNumber(getElementPoints(activePkm.element))}</p>
						{/if}
					</div>
					{#if activePkm}
					<button
						class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
						style="background: var(--accent);"
						disabled={getElementPoints(activePkm.element) < NGU_COSTS.elementalDamage(getElementalDamageLevel(activePkm.element))}
						onclick={() => performNguBuy(buyElementalDamage, `Dano ${ELEMENT_LABEL[activePkm.element]}`)}
					>
						{ELEMENT_EMOJI[activePkm.element]}{formatNumber(NGU_COSTS.elementalDamage(getElementalDamageLevel(activePkm.element)))}
					</button>
					{:else}
						<button disabled class="rounded-lg bg-gray-600/50 py-1.5 text-xs font-bold text-white opacity-40">
							Selecione um Pokémon
						</button>
					{/if}
				</div>

				<!-- Vitamins (HP per element) -->
				<div class="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<div class="flex-1">
						<h3 class="font-bold">{activePkm ? `Vitaminas ${ELEMENT_LABEL[activePkm.element]}` : 'Vitaminas Elementais'}</h3>
						<p class="text-xs text-[var(--text-muted)]">Aumenta em +20 o HP máximo de todos os pokémons do tipo ativo por nível.</p>
						{#if activePkm}
							<p class="mt-1 text-sm font-bold text-[var(--accent)]">Nível atual: {formatNumber(getElementalHpLevel(activePkm.element))}</p>
							<p class="mt-1 text-xs text-[var(--text-muted)]">Saldo: {ELEMENT_EMOJI[activePkm.element]}{formatNumber(getElementPoints(activePkm.element))}</p>
						{/if}
					</div>
					{#if activePkm}
						<button
							class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
							style="background: var(--accent);"
							disabled={getElementPoints(activePkm.element) < NGU_COSTS.elementalVitamins(getElementalHpLevel(activePkm.element))}
							onclick={() => performNguBuy(buyElementalVitamins, `Vitaminas ${ELEMENT_LABEL[activePkm.element]}`)}
						>
							{ELEMENT_EMOJI[activePkm.element]}{formatNumber(NGU_COSTS.elementalVitamins(getElementalHpLevel(activePkm.element)))}
						</button>
					{:else}
						<button disabled class="rounded-lg bg-gray-600/50 py-1.5 text-xs font-bold text-white opacity-40">
							Selecione um Pokémon
						</button>
					{/if}
				</div>

			</div>
		</div>

		<div class="mt-8">
			<h2 class="mb-3 text-lg font-bold">Booster Packs Secretos</h2>
			<p class="mb-3 text-xs text-[var(--text-muted)]">Cada booster pode ser comprado apenas 1 vez por dia.</p>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each BOOSTER_PACKS as pack (pack.id)}
					<div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
						<div class="mb-2 flex items-start justify-between gap-3">
							<div>
								<h3 class="font-bold text-amber-300">🜲 {pack.name}</h3>
								<p class="text-xs text-[var(--text-muted)]">{pack.description}</p>
							</div>
							<span class="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">{pack.cardCount} segredo{pack.cardCount > 1 ? 's' : ''}</span>
						</div>
						<p class="mb-3 text-xs text-[var(--text-muted)]">Somente ouro. Não entra no refresh diário da loja.</p>
						<button
							class="w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-40"
							style="background: linear-gradient(135deg, #f59e0b, #d97706);"
							disabled={(game.player?.money ?? 0) < pack.price || hasPurchasedBoosterToday()}
							onclick={() => buyPack(pack.id)}
						>
							{#if hasPurchasedBoosterToday()}
								Comprado hoje
							{:else}
								💰{formatNumber(pack.price)}
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</main>
