<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { t } from '$lib/i18n';
	import Hud from '$lib/components/Hud.svelte';
	import CardUpgradePanel from '$lib/components/CardUpgradePanel.svelte';
	import {
		BOOSTER_PACKS,
		buyBoosterPack,
		hasPurchasedBoosterToday,
		buyIncomeMultiplier,
		NGU_COSTS
	} from '$lib/game/shop.svelte';
	import { game } from '$lib/game/state.svelte';
	import { initPlatinum, tickPlatinum } from '$lib/game/platinum.svelte';
	import { formatNumber } from '$lib/utils/math';
	import { pushToast } from '$lib/stores/toast.svelte';
	import PlatinumShop from '$lib/components/marketplace/PlatinumShop.svelte';
	import posthog from 'posthog-js';

	onMount(() => {
		initPlatinum();
		tickPlatinum();
		const iv = setInterval(tickPlatinum, 30_000);
		return () => clearInterval(iv);
	});

	async function performNguBuy(action: () => Promise<boolean>, name: string) {
		const ok = await action();
		if (!ok) pushToast(t('shop.insufficientResources'), 'error');
		if (ok) {
			posthog.capture('income_multiplier_purchased', {
				upgrade_name: name,
				new_level: game.player?.ngu.moneyMultiplierLevel
			});
			pushToast(t('shop.upgradePurchased', { name }), 'success');
		}
	}

	async function buyPack(packId: (typeof BOOSTER_PACKS)[number]['id']) {
		const pack = BOOSTER_PACKS.find((p) => p.id === packId);
		const rewards = await buyBoosterPack(packId);
		if (!rewards) {
			if (hasPurchasedBoosterToday()) {
				pushToast(t('shop.boosterBought'), 'error');
			} else {
				pushToast(t('shop.insufficientResources'), 'error');
			}
			return;
		}
		posthog.capture('booster_pack_purchased', {
			pack_id: packId,
			pack_name: pack?.name,
			price: pack?.price,
			cards_received: rewards.map((c) => c.name)
		});
		pushToast(`Pack aberto: ${rewards.map((card) => card.name).join(', ')}`, 'success');
	}
</script>

<Hud />

<main class="px-2 py-3">
	<div class="mb-2 flex items-center">
		<h1 class="text-lg font-bold">{$_('shop.title')}</h1>
	</div>

	<!-- Platinum shop — buy & spend platinum -->
	<div class="mt-6 mb-6">
		<h2 class="mb-2 text-base font-bold">{$_('shop.platinumShop')}</h2>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
			<PlatinumShop />
		</div>
	</div>

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

	{/if}
</main>

<style>
</style>
