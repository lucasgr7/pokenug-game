<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Card from './Card.svelte';
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_LABEL } from '$lib/game/elements';

	let {
		templateId,
		open = false,
		onclose,
		onplay,
		playable = false,
		hidePrice = true,
		actionLabel = '',
		disabledLabel = ''
	}: {
		templateId: string | null;
		open?: boolean;
		onclose: () => void;
		onplay?: () => void;
		playable?: boolean;
		hidePrice?: boolean;
		actionLabel?: string;
		disabledLabel?: string;
	} = $props();

	let tpl = $derived(templateId ? getTemplate(templateId) : null);

	let priceLabel = $derived.by(() => {
		if (!tpl?.price) return null;
		const money = `${tpl.price.money} ouro`;
		if (!tpl.price.element) return money;
		const element = tpl.price.element;
		return `${money} + ${element.amount} ${$_('elements.' + element.type)}`;
	});
</script>

{#if open && tpl}
	<div class="overlay" role="presentation">
		<div class="backdrop" onclick={onclose} role="presentation"></div>
		<div class="card-stage" role="dialog" aria-modal="true" aria-label={tpl.name} tabindex="-1">
			<div class="card-wrap">
				<Card templateId={tpl.id} playable={false} description={tpl.description} showcase />
			</div>
		</div>

		{#if (!hidePrice && priceLabel) || onplay}
			<div class="bottom-float">
				{#if !hidePrice && priceLabel}
					<p class="price">{@html $_('cardDetails.priceLabel', { values: { price: priceLabel } })}</p>
				{/if}
				{#if onplay}
					<button class="play-btn" disabled={!playable} onclick={onplay}>
						{playable ? (actionLabel || $_('cardDetails.playCard')) : (disabledLabel || $_('cardDetails.actionUnavailable'))}
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 18px;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, #000 72%, transparent);
		backdrop-filter: blur(8px);
	}

	.card-stage {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding-bottom: 100px;
	}

	.card-wrap {
		width: min(360px, 84vw);
		filter: drop-shadow(0 26px 36px rgba(0, 0, 0, 0.55));
	}

	.bottom-float {
		position: fixed;
		left: 50%;
		bottom: 18px;
		transform: translateX(-50%);
		z-index: 102;
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: min(540px, calc(100vw - 24px));
		padding: 10px;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: color-mix(in srgb, var(--surface, #11141b) 86%, #000 14%);
		box-shadow: 0 16px 30px rgba(0, 0, 0, 0.45);
	}

	.price {
		margin: 0;
		padding: 0 4px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text, #f3f3f7);
		white-space: nowrap;
	}

	.play-btn {
		border: 0;
		border-radius: 10px;
		padding: 10px 14px;
		font-size: 13px;
		font-weight: 900;
		color: #f8f9ff;
		background: linear-gradient(135deg, #ff8d2a, #ff5b2d);
		cursor: pointer;
	}

	.play-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.card-wrap {
			width: min(320px, 86vw);
		}

		.bottom-float {
			width: calc(100vw - 24px);
			justify-content: space-between;
		}
	}
</style>