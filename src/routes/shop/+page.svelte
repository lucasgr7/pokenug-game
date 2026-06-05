<script lang="ts">
	import { onMount } from 'svelte';
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
	import CardDetailsModal from '$lib/components/CardDetailsModal.svelte';
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
	import Sprite from '$lib/components/Sprite.svelte';
	import NatureIcon from '$lib/components/NatureIcon.svelte';
	import { NATURES, NATURE_UNLOCK_COST } from '$lib/data/natures';
	import { canUnlockNature, natureAffordable, unlockNature } from '$lib/game/natures.svelte';
	import { activePokemon, game, getElementPoints, getElementalDamageLevel, getElementalHpLevel } from '$lib/game/state.svelte';
	import { ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import { pushToast } from '$lib/stores/toast.svelte';
	import PlatinumShop from '$lib/components/marketplace/PlatinumShop.svelte';

	let refreshing = $state(false);
	let inspectingCard: string | null = $state(null);

	async function handleUnlockNature(pokemonId: string, index: number) {
		const ok = await unlockNature(pokemonId, index);
		if (ok) {
			const p = game.roster.find((x) => x.id === pokemonId);
			const name = p?.natures?.assigned[index] ? NATURES[p.natures.assigned[index]].namePt : '';
			pushToast(`Natureza ${name} desbloqueada!`, 'success');
		} else {
			pushToast('Não foi possível desbloquear.', 'error');
		}
	}

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

<main class="px-2 py-3">
	<div class="mb-2 flex items-center justify-between">
		<h1 class="text-lg font-bold">Loja</h1>
		<button
			class="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40"
			disabled={refreshing}
			onclick={refresh}
		>
			🔄 💰{formatNumber(paidRefreshCost())}
		</button>
	</div>
	<p class="mb-2 text-[10px] text-[var(--text-muted)]">Renovam todo dia automaticamente.</p>

	{#if !shop.loaded}
		<p class="text-sm text-[var(--text-muted)]">Carregando…</p>
	{:else}
		<!-- Platinum shop - only shows if user has platinum currency -->
		 {#if (game.player?.platinum ?? 0) > 0}
		<div class="mt-6 mb-6">
			<h2 class="mb-2 text-base font-bold">🜲 Loja Platinum</h2>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
				<PlatinumShop />
			</div>
		</div>
		{/if}

		<div class="grid grid-cols-3 gap-1.5">
			{#each shop.slots as slot, i (i)}
				<div class="shop-card-wrapper relative">
					<Card 
						templateId={slot.id} 
						playable={!slot.sold} 
						dimmed={slot.sold} 
						compact 
						iconOnlyBadge 
						onclick={() => inspectingCard = slot.id}
					/>
					{#if slot.sold}
						<div class="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/85 py-1 text-center text-[10px] font-bold text-gray-400">
							✓ Comprado
						</div>
					{:else}
						<button
							class="absolute inset-x-0 bottom-0 rounded-b-lg py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
							style="background: linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.82)); backdrop-filter: blur(4px);"
							disabled={!canAfford(slot)}
							onclick={() => buy(i)}
						>
							💰{formatNumber(slot.price?.money ?? 0)}{#if slot.price?.element}<span class="text-[9px]">·{ELEMENT_EMOJI[slot.price.element.type]}{formatNumber(slot.price.element.amount)}</span>{/if}
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if game.player}
		<div class="mt-6">
			<h2 class="mb-2 text-base font-bold">Aprimoramentos Permanentes</h2>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				
				<!-- Income Multiplier -->
				<div class="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
					<div class="flex-1">
						<h3 class="text-sm font-bold">Multiplicador de Renda</h3>
						<p class="text-[10px] text-[var(--text-muted)]">+50% ganhos idle</p>
						<p class="mt-1 text-xs font-bold text-[var(--accent)]">Nv. {formatNumber(game.player.ngu.moneyMultiplierLevel)}</p>
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
				<div class="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
					<div class="flex-1">
						<h3 class="text-sm font-bold">{activePkm ? `Dano ${ELEMENT_LABEL[activePkm.element]}` : 'Dano Elemental'}</h3>
						<p class="text-[10px] text-[var(--text-muted)]">+3 dano/nível tipo ativo</p>
						{#if activePkm}
							<p class="mt-1 text-xs font-bold text-[var(--accent)]">Nv. {formatNumber(getElementalDamageLevel(activePkm.element))} · {ELEMENT_EMOJI[activePkm.element]}{formatNumber(getElementPoints(activePkm.element))}</p>
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
				<div class="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
					<div class="flex-1">
						<h3 class="text-sm font-bold">{activePkm ? `Vitaminas ${ELEMENT_LABEL[activePkm.element]}` : 'Vitaminas Elementais'}</h3>
						<p class="text-[10px] text-[var(--text-muted)]">+20 HP/nível tipo ativo</p>
						{#if activePkm}
							<p class="mt-1 text-xs font-bold text-[var(--accent)]">Nv. {formatNumber(getElementalHpLevel(activePkm.element))} · {ELEMENT_EMOJI[activePkm.element]}{formatNumber(getElementPoints(activePkm.element))}</p>
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

		<div class="mt-6">
			<h2 class="mb-2 text-base font-bold">Booster Packs Secretos</h2>
			<p class="mb-2 text-[10px] text-[var(--text-muted)]">1x por dia cada pack</p>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{#each BOOSTER_PACKS as pack (pack.id)}
					<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-sm">
						<div class="mb-1.5 flex items-start justify-between gap-2">
							<div>
								<h3 class="text-sm font-bold text-amber-300">🜲 {pack.name}</h3>
								<p class="text-[10px] text-[var(--text-muted)]">{pack.description}</p>
							</div>
							<span class="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">{pack.cardCount}x</span>
						</div>
						<p class="mb-2 text-[9px] text-[var(--text-muted)]">Somente ouro. Não entra no refresh diário.</p>
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

		{#if activePokemon()}
			{@const p = activePokemon()!}
			<div class="mt-6">
				<h2 class="mb-2 text-base font-bold">Naturezas — {p.name}</h2>
				<p class="mb-2 text-[10px] text-(--text-muted)">Desbloqueie em sequência por {formatNumber(NATURE_UNLOCK_COST)} de pontos de {ELEMENT_LABEL[p.element]}.</p>
				<div class="rounded-xl border border-(--border) bg-(--surface) p-4">
					<div class="mb-3 flex items-center gap-2">
						<Sprite speciesId={p.speciesId} size={48} alt={p.name} />
						<div>
							<p class="text-sm font-bold">{p.name}</p>
							<p class="text-[10px] text-(--text-muted)">{ELEMENT_EMOJI[p.element]} {ELEMENT_LABEL[p.element]}</p>
						</div>
					</div>
					{#if p.natures}
						<div class="space-y-2">
							{#each [0, 1, 2] as i}
								{@const id = p.natures.assigned[i]}
								{@const unlocked = p.natures.unlocked[i]}
								{@const meta = NATURES[id]}
								{@const canBuy = canUnlockNature(p, i)}
								<div class="flex items-center gap-3 rounded-lg border border-(--border)/50 p-2.5">
									<NatureIcon {id} locked={!unlocked} size={32} />
									<div class="min-w-0 flex-1">
										<p class="text-sm font-bold">{meta.namePt}</p>
										<p class="text-xs text-(--text-muted)">{meta.description}</p>
									</div>
									{#if unlocked}
										<span class="shrink-0 rounded-full bg-(--success)/20 px-2.5 py-0.5 text-[10px] font-bold text-(--success)">✓ Ativa</span>
									{:else if canBuy}
										<button
											class="shrink-0 rounded-lg bg-(--accent) px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
											disabled={!natureAffordable(p)}
											onclick={() => handleUnlockNature(p.id, i)}
										>
											{ELEMENT_EMOJI[p.element]}{formatNumber(NATURE_UNLOCK_COST)}
										</button>
									{:else}
										<span class="shrink-0 text-[11px] text-(--text-muted)">🔒 Bloqueada</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</main>

<CardDetailsModal templateId={inspectingCard} open={!!inspectingCard} hidePrice={false} onclose={() => inspectingCard = null} />

<style>
	.shop-card-wrapper {
		position: relative;
		isolation: isolate;
	}
	
	.shop-card-wrapper :global(.card-root) {
		border-width: 2px;
	}
	
	.shop-card-wrapper :global(.card-root .card-cost) {
		width: 18px;
		height: 18px;
		font-size: 11px;
	}
	
	.shop-card-wrapper :global(.icon-wrap) {
		padding: 2px;
		transform: scale(0.8);
	}
	
	.shop-card-wrapper :global(.card-root .px-2) {
		padding-left: 0.375rem;
		padding-right: 0.375rem;
	}
	
	.shop-card-wrapper :global(.card-root .pb-2) {
		padding-bottom: 0.375rem;
	}
	
	@media (max-width: 640px) {
		.shop-card-wrapper :global(.card-root) {
			font-size: 10px;
		}
		
		.shop-card-wrapper :global(.card-root .truncate) {
			font-size: 10px;
		}
		
		.shop-card-wrapper :global(.icon-wrap) {
			transform: scale(0.7);
		}
	}
</style>
