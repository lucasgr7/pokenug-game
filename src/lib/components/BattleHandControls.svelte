<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import CardInspector from '$lib/components/CardInspector.svelte';
	import type { Card as BattleCard, BattleState } from '$lib/game/types';

	let {
		state: battleState,
		ended = false,
		selectedCardId = null,
		autoConfirm = false,
		canPlay,
		onCardTap,
		onPlayRelic,
		onEndTurn,
		onAutoConfirmChange
	}: {
		state: BattleState;
		ended?: boolean;
		selectedCardId?: string | null;
		autoConfirm?: boolean;
		canPlay: (templateId: string) => boolean;
		onCardTap: (cardId: string, templateId: string) => void;
		onPlayRelic: (cardId: string, templateId: string) => void;
		onEndTurn: () => void;
		onAutoConfirmChange: (enabled: boolean) => void;
	} = $props();

	type PileKind = 'deck' | 'discard' | 'exhausted';

	let openPile: PileKind | null = $state(null);
	let inspectingCard: string | null = $state(null);
	let longPressTimer: number | null = null;
	const pileKinds: PileKind[] = ['deck', 'discard', 'exhausted'];

	const PILE_META: Record<PileKind, { icon: string; label: string }> = {
		deck: { icon: '🂠', label: 'Pilha de compra' },
		discard: { icon: '♻', label: 'Pilha de descarte' },
		exhausted: { icon: '💤', label: 'Cartas exaustas' }
	};

	function handleAutoConfirmToggle(event: Event) {
		onAutoConfirmChange((event.currentTarget as HTMLInputElement).checked);
	}

	function openPileModal(pile: PileKind) {
		openPile = pile;
	}

	function closePileModal() {
		openPile = null;
	}

	function getPileCards(pile: PileKind | null): BattleCard[] {
		if (!pile) return [];
		return battleState[pile];
	}

	function handleCardLongPress(cardId: string, templateId: string) {
		longPressTimer = window.setTimeout(() => {
			inspectingCard = templateId;
			longPressTimer = null;
		}, 500);
	}

	function handleCardRelease(cardId: string, templateId: string) {
		if (longPressTimer) {
			window.clearTimeout(longPressTimer);
			longPressTimer = null;
			onCardTap(cardId, templateId);
		}
	}

	function handleCardCancel() {
		if (longPressTimer) {
			window.clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}
</script>

<section class="flex flex-col justify-between border-t border-white/10 bg-(--surface) px-2 pb-2 pt-2" style="height: 40vh;">
	<div>
		<div class="mb-1 flex items-center justify-between gap-2 px-1">
			<div class="flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-(--text-muted)">
				{#each pileKinds as pile (pile)}
					<button
						type="button"
						class="rounded-full bg-black/15 px-2 py-1 transition-colors hover:bg-black/25"
						onclick={() => openPileModal(pile)}
						aria-label={`Abrir ${PILE_META[pile].label}`}
					>
						{PILE_META[pile].icon} {battleState[pile].length}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-2">
				<label
					class="flex cursor-pointer select-none items-center gap-2 rounded-full bg-black/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-(--text-muted)"
					title="Usa a carta imediatamente com um toque ou clique"
				>
					<input
						type="checkbox"
						class="peer sr-only"
						checked={autoConfirm}
						onchange={handleAutoConfirmToggle}
						aria-label="Auto confirmação"
					/>
					<span class="relative h-4 w-7 rounded-full bg-white/15 transition-colors peer-checked:bg-(--accent)">
						<span class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3"></span>
					</span>
					Auto
				</label>
				<button
					class="rounded-xl bg-(--accent) px-4 py-1.5 text-xs font-black text-white transition-colors hover:brightness-110 disabled:opacity-40"
					disabled={battleState.turn !== 'player' || ended}
					onclick={onEndTurn}
				>
					Fim de turno ↦
				</button>
			</div>
		</div>

		{#if battleState.relicSlots.length > 0}
			<div class="mb-1.5 flex items-center gap-2 px-1">
				<span class="shrink-0 text-[10px] font-black uppercase tracking-widest text-purple-400">Relíquias</span>
				{#each battleState.relicSlots as relic (relic.id)}
					<div 
						role="button"
						tabindex="0"
						class="w-14 shrink-0"
						oncontextmenu={(e) => { e.preventDefault(); inspectingCard = relic.templateId; }}
						aria-label="Clique direito para inspecionar relíquia"
					>
						<Card
							templateId={relic.templateId}
							playable={battleState.turn === 'player' && !ended}
							onclick={() => onPlayRelic(relic.id, relic.templateId)}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="hand-fan" role="group" aria-label="Mão de cartas">
		{#each battleState.hand as card, i (card.id)}
			{@const n = battleState.hand.length || 1}
			{@const mid = (n - 1) / 2}
			{@const offset = i - mid}
			{@const angle = offset * (n > 3 ? 6.5 : 9)}
			{@const xPos = offset * 90}
			{@const playable = canPlay(card.templateId)}
			{@const isSelected = selectedCardId === card.id}
			<div
				role="button"
				tabindex="0"
				class="hand-card"
				class:hand-card--selected={isSelected}
				class:hand-card--muted={!playable}
				style="left: calc(50% + {xPos}px - 47.5px); --angle: {angle}deg; z-index: {isSelected ? 60 : i + 1};"
				onmousedown={() => handleCardLongPress(card.id, card.templateId)}
				onmouseup={() => handleCardRelease(card.id, card.templateId)}
				onmouseleave={handleCardCancel}
				ontouchstart={() => handleCardLongPress(card.id, card.templateId)}
				ontouchend={() => handleCardRelease(card.id, card.templateId)}
				ontouchcancel={handleCardCancel}
				aria-label="Segure para inspecionar, toque para jogar carta"
			>
				<Card
					templateId={card.templateId}
					flip
					playable={playable}
				/>
			</div>
		{/each}
	</div>
</section>

<Modal
	open={openPile !== null}
	title={openPile ? PILE_META[openPile].label : ''}
	onclose={closePileModal}
>
	{#if openPile}
		<div class="space-y-3">
			<p class="text-sm text-(--text-muted)">
				{PILE_META[openPile].icon} {getPileCards(openPile).length} carta(s)
			</p>
			{#if getPileCards(openPile).length > 0}
				<div class="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
					{#each getPileCards(openPile) as card (card.id)}
						<Card templateId={card.templateId} playable onclick={() => inspectingCard = card.templateId} />
					{/each}
				</div>
			{:else}
				<div class="rounded-xl border border-white/10 bg-black/10 px-4 py-6 text-center text-sm font-semibold text-(--text-muted)">
					Nenhuma carta nesta pilha.
				</div>
			{/if}
		</div>
	{/if}
</Modal>

<CardInspector templateId={inspectingCard} open={!!inspectingCard} onclose={() => inspectingCard = null} />

<style>
	.hand-fan {
		position: relative;
		height: 100%;
		min-height: 160px;
		width: 100%;
		overflow: visible;
		margin-top: auto;
	}

	.hand-card {
		position: absolute;
		bottom: 30px;
		width: 95px;
		max-width: 22vh;
		transform-origin: bottom center;
		transform: rotate(var(--angle));
		transition:
			transform 180ms ease-out,
			filter 180ms ease-out;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
	}

	@media (hover: hover) {
		.hand-card:not(.hand-card--muted):hover {
			transform: rotate(calc(var(--angle) * 0.3)) translateY(-22px) scale(1.06);
			z-index: 50 !important;
		}
	}

	.hand-card--selected {
		transform: rotate(0deg) translateY(-40px) scale(1.08) !important;
		z-index: 60 !important;
		filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.75));
	}

	.hand-card--muted {
		opacity: 0.45;
		cursor: default;
	}
</style>