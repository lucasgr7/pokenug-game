<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { t } from '$lib/i18n';
	import Hud from '$lib/components/Hud.svelte';
	import Card from '$lib/components/Card.svelte';
	import CardUpgradePanel from '$lib/components/CardUpgradePanel.svelte';
	import CardDetailsModal from '$lib/components/CardDetailsModal.svelte';
	import {
		BOOSTER_PACKS,
		buyBoosterPack,
		hasPurchasedBoosterToday,
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
	import CorruptedBadge from '$lib/components/CorruptedBadge.svelte';

	let inspectingCard: string | null = $state(null);

	async function handleUnlockNature(pokemonId: string, index: number) {
		const ok = await unlockNature(pokemonId, index);
		if (ok) {
			const p = game.roster.find((x) => x.id === pokemonId);
			const id = p?.natures?.assigned[index];
			const name = id ? t('natures.' + id + '.name') : '';
			pushToast(t('shop.natureUnlocked', { name }), 'success');
		} else {
			pushToast(t('shop.naturesUnlockFail'), 'error');
		}
	}

	async function performNguBuy(action: () => Promise<boolean>, name: string) {
		const ok = await action();
		if (!ok) pushToast(t('shop.insufficientResources'), 'error');
	}

	async function buyPack(packId: (typeof BOOSTER_PACKS)[number]['id']) {
		const rewards = await buyBoosterPack(packId);
		if (!rewards) {
			if (hasPurchasedBoosterToday()) {
				pushToast(t('shop.boosterBought'), 'error');
			} else {
				pushToast(t('shop.insufficientResources'), 'error');
			}
			return;
		}
		pushToast(`Pack aberto: ${rewards.map((card) => card.name).join(', ')}`, 'success');
	}

	let activePkm = $derived(activePokemon());
</script>

<Hud />

<main class="px-2 py-3">
	<div class="mb-2 flex items-center">
		<h1 class="text-lg font-bold">{$_('shop.title')}</h1>
	</div>

	<!-- Platinum shop - only shows if user has platinum currency -->
	 {#if (game.player?.platinum ?? 0) > 0}
	<div class="mt-6 mb-6">
		<h2 class="mb-2 text-base font-bold">{$_('shop.platinumShop')}</h2>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
			<PlatinumShop />
		</div>
	</div>
	{/if}

	<CardUpgradePanel />

	{#if game.player}
		<div class="mt-6">
			<h2 class="mb-2 text-base font-bold">{$_('shop.permanentUpgrades')}</h2>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				
				<!-- Income Multiplier -->
				<div class="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
					<div class="flex-1">
						<h3 class="text-sm font-bold">{$_('shop.incomeMultiplier')}</h3>
						<p class="text-[10px] text-[var(--text-muted)]">{$_('shop.incomeMultiplierDesc')}</p>
						<p class="mt-1 text-xs font-bold text-[var(--accent)]">{$_('shop.lv')} {formatNumber(game.player.ngu.moneyMultiplierLevel)}</p>
					</div>
					<button
						class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
						style="background: var(--accent);"
						disabled={game.player.money < NGU_COSTS.incomeMultiplier(game.player.ngu.moneyMultiplierLevel)}
						onclick={() => performNguBuy(buyIncomeMultiplier, t('shop.incomeMultiplier'))}
					>
						💰{formatNumber(NGU_COSTS.incomeMultiplier(game.player.ngu.moneyMultiplierLevel))}
					</button>
				</div>

				<!-- Vitamins (HP per element) -->
				<div class="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
					<div class="flex-1">
						<h3 class="text-sm font-bold">{activePkm ? $_('shop.vitamins', { values: { element: $_('elements.' + activePkm.element) } }) : $_('shop.vitaminsGeneric')}</h3>
						<p class="text-[10px] text-[var(--text-muted)]">{$_('shop.vitaminsDesc')}</p>
						{#if activePkm}
							<p class="mt-1 text-xs font-bold text-[var(--accent)]">{$_('shop.lv')} {formatNumber(getElementalHpLevel(activePkm.element))} · {ELEMENT_EMOJI[activePkm.element]}{formatNumber(getElementPoints(activePkm.element))}</p>
						{/if}
					</div>
					{#if activePkm}
						<button
							class="rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-40"
							style="background: var(--accent);"
							disabled={getElementPoints(activePkm.element) < NGU_COSTS.elementalVitamins(getElementalHpLevel(activePkm.element))}
							onclick={() => performNguBuy(buyElementalVitamins, t('shop.vitamins', { element: t('elements.' + activePkm.element) }))}
						>
							{ELEMENT_EMOJI[activePkm.element]}{formatNumber(NGU_COSTS.elementalVitamins(getElementalHpLevel(activePkm.element)))}
						</button>
					{:else}
						<button disabled class="rounded-lg bg-gray-600/50 py-1.5 text-xs font-bold text-white opacity-40">
							{$_('shop.vitaminsDisabled')}
						</button>
					{/if}
				</div>

			</div>
		</div>

		<div class="mt-6">
			<h2 class="mb-2 text-base font-bold">{$_('shop.boosterPacks')}</h2>
			<p class="mb-2 text-[10px] text-[var(--text-muted)]">{$_('shop.boosterPacksDesc')}</p>
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
						<p class="mb-2 text-[9px] text-[var(--text-muted)]">{$_('shop.boosterOnlyGold')}</p>
						<button
							class="w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-40"
							style="background: linear-gradient(135deg, #f59e0b, #d97706);"
							disabled={(game.player?.money ?? 0) < pack.price || hasPurchasedBoosterToday()}
							onclick={() => buyPack(pack.id)}
						>
							{#if hasPurchasedBoosterToday()}
								{$_('shop.boosterBought')}
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
				<h2 class="mb-2 text-base font-bold">{$_('shop.naturesTitle', { values: { name: p.name } })}</h2>
				<p class="mb-2 text-[10px] text-(--text-muted)">{$_('shop.naturesDesc', { values: { cost: formatNumber(NATURE_UNLOCK_COST), element: $_('elements.' + p.element) } })}</p>
				<div class="rounded-xl border border-(--border) bg-(--surface) p-4">
					<div class="mb-3 flex items-center gap-2">
						<Sprite speciesId={p.speciesId} size={48} alt={p.name} />
						<div>
							<p class="text-sm font-bold flex items-center gap-1.5">
								{p.name}
								{#if p.corrupted}<CorruptedBadge size={16} />{/if}
							</p>
							<p class="text-[10px] text-(--text-muted)">{ELEMENT_EMOJI[p.element]} {$_('elements.' + p.element)}</p>
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
										<p class="text-sm font-bold">{$_('natures.' + id + '.name')}</p>
										<p class="text-xs text-(--text-muted)">{$_('natures.' + id + '.description')}</p>
									</div>
									{#if unlocked}
										<span class="shrink-0 rounded-full bg-(--success)/20 px-2.5 py-0.5 text-[10px] font-bold text-(--success)">{$_('shop.naturesActive')}</span>
									{:else if canBuy}
										<button
											class="shrink-0 rounded-lg bg-(--accent) px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
											disabled={!natureAffordable(p)}
											onclick={() => handleUnlockNature(p.id, i)}
										>
											{ELEMENT_EMOJI[p.element]}{formatNumber(NATURE_UNLOCK_COST)}
										</button>
									{:else}
										<span class="shrink-0 text-[11px] text-(--text-muted)">{$_('shop.naturesLocked')}</span>
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

<style>
</style>
