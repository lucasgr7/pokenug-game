<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import CardInspector from '$lib/components/CardInspector.svelte';
	import type { Card as BattleCard, BattleState } from '$lib/game/types';

	let {
		state: battleState,
		ended = false,
		autoConfirm = false,
		canPlay,
		onCardTap,
		onPlayCard,
		onPlayRelic,
		onEndTurn,
		onAutoConfirmChange
	}: {
		state: BattleState;
		ended?: boolean;
		autoConfirm?: boolean;
		canPlay: (templateId: string) => boolean;
		onCardTap: (cardId: string, templateId: string) => void;
		onPlayCard: (cardId: string, templateId: string) => void;
		onPlayRelic: (cardId: string, templateId: string) => void;
		onEndTurn: () => void;
		onAutoConfirmChange: (enabled: boolean) => void;
	} = $props();

	type PileKind = 'deck' | 'discard' | 'exhausted';

	let openPile: PileKind | null = $state(null);
	// { cardId } present when opened from hand (enables play button); absent for pile/relic inspect
	let inspecting: { templateId: string; cardId?: string } | null = $state(null);

	const pileKinds: PileKind[] = ['deck', 'discard', 'exhausted'];
	const PILE_META: Record<PileKind, { icon: string; label: string }> = {
		deck: { icon: '🂠', label: 'Pilha de compra' },
		discard: { icon: '♻', label: 'Pilha de descarte' },
		exhausted: { icon: '💤', label: 'Cartas exaustas' }
	};

	function handleAutoConfirmToggle(event: Event) {
		onAutoConfirmChange((event.currentTarget as HTMLInputElement).checked);
	}

	function getPileCards(pile: PileKind | null): BattleCard[] {
		if (!pile) return [];
		return battleState[pile];
	}

	// Single tap: in auto-confirm mode play immediately; otherwise open inspector.
	function handleCardTap(cardId: string, templateId: string) {
		if (autoConfirm && canPlay(templateId)) {
			onCardTap(cardId, templateId);
		} else {
			inspecting = { templateId, cardId };
		}
	}

	function playInspected() {
		if (!inspecting?.cardId) return;
		const { cardId, templateId } = inspecting;
		inspecting = null;
		onPlayCard(cardId, templateId);
	}

	let inspectPlayable = $derived.by(() => {
		if (ended || !inspecting || !inspecting.cardId) return false;
		return canPlay(inspecting.templateId);
	});
</script>

<section class="shrink-0 flex flex-col border-t border-white/10 bg-(--surface) px-2 pb-2 pt-1.5">
	<!-- Controls row -->
	<div class="mb-0.5 flex items-center justify-between gap-2 px-1">
		<div class="flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-(--text-muted)">
			{#each pileKinds as pile (pile)}
				<button
					type="button"
					class="rounded-full bg-black/15 px-2 py-1 transition-colors hover:bg-black/25"
					onclick={() => (openPile = pile)}
					aria-label={`Abrir ${PILE_META[pile].label}`}
				>
					{PILE_META[pile].icon} {battleState[pile].length}
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			<label
				class="flex cursor-pointer select-none items-center gap-2 rounded-full bg-black/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-(--text-muted)"
				title="Usa a carta imediatamente com um toque"
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

	<!-- Relics row -->
	{#if battleState.relicSlots.length > 0}
		<div class="mb-1 flex items-center gap-2 px-1">
			<span class="shrink-0 text-[10px] font-black uppercase tracking-widest text-purple-400">Relíquias</span>
			{#each battleState.relicSlots as relic (relic.id)}
				<div
					role="button"
					tabindex="0"
					class="w-12 shrink-0"
					onclick={() => onPlayRelic(relic.id, relic.templateId)}
					oncontextmenu={(e) => { e.preventDefault(); inspecting = { templateId: relic.templateId }; }}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPlayRelic(relic.id, relic.templateId); }}
					aria-label="Jogar relíquia (clique direito para inspecionar)"
				>
					<Card
						templateId={relic.templateId}
						playable={battleState.turn === 'player' && !ended}
					/>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Hand fan -->
	<div class="hand-fan" role="group" aria-label="Mão de cartas">
		{#each battleState.hand as card, i (card.id)}
			{@const n = battleState.hand.length || 1}
			{@const mid = (n - 1) / 2}
			{@const offset = i - mid}
			{@const spread = n > 1 ? Math.min(68, 240 / (n - 1)) : 0}
			{@const angle = offset * Math.min(7, 24 / Math.max(n, 1))}
			{@const xPos = offset * spread}
			{@const playable = canPlay(card.templateId)}
			<div
				role="button"
				tabindex="0"
				class="hand-card"
				class:hand-card--muted={!playable}
				style="left: calc(50% + {xPos}px - 45px); --angle: {angle}deg; z-index: {i + 1};"
				onclick={() => handleCardTap(card.id, card.templateId)}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardTap(card.id, card.templateId); }}
				aria-label={autoConfirm ? 'Jogar carta' : 'Inspecionar carta'}
			>
				<Card templateId={card.templateId} flip playable={playable} />
			</div>
		{/each}
	</div>
</section>

<!-- Pile inspect modal -->
<Modal
	open={openPile !== null}
	title={openPile ? PILE_META[openPile].label : ''}
	onclose={() => (openPile = null)}
>
	{#if openPile}
		<div class="space-y-3">
			<p class="text-sm text-(--text-muted)">
				{PILE_META[openPile].icon} {getPileCards(openPile).length} carta(s)
			</p>
			{#if getPileCards(openPile).length > 0}
				<div class="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
					{#each getPileCards(openPile) as card (card.id)}
						<Card
							templateId={card.templateId}
							playable
							onclick={() => (inspecting = { templateId: card.templateId })}
						/>
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

<!-- Card inspector (hand + pile) -->
<CardInspector
	templateId={inspecting?.templateId ?? null}
	open={!!inspecting}
	onclose={() => (inspecting = null)}
	playable={inspectPlayable}
	onplay={inspecting?.cardId && !ended ? playInspected : undefined}
/>

<style>
	.hand-fan {
		position: relative;
		height: 170px;
		width: 100%;
		overflow: visible;
	}

	.hand-card {
		position: absolute;
		bottom: 20px;
		width: 90px;
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

	.hand-card--muted {
		opacity: 0.45;
		cursor: default;
	}
</style>
