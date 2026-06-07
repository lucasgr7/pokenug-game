<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import CardDetailsModal from '$lib/components/CardDetailsModal.svelte';
	import { effectiveCardCost } from '$lib/game/battle.svelte';
	import type { Card as BattleCard, BattleState } from '$lib/game/types';

	let {
		state: battleState,
		ended = false,
		canPlay,
		onPlayCard,
		onPlayRelic,
		onEndTurn
	}: {
		state: BattleState;
		ended?: boolean;
		canPlay: (card: BattleCard) => boolean;
		onPlayCard: (cardId: string, templateId: string) => void;
		onPlayRelic: (cardId: string, templateId: string) => void;
		onEndTurn: () => void;
	} = $props();

	type PileKind = 'deck' | 'discard' | 'exhausted';

	let openPile: PileKind | null = $state(null);
	let inspecting: { templateId: string; cardId?: string } | null = $state(null);
	let wasLongPress = $state(false);
	let pressTimer: ReturnType<typeof setTimeout> | null = $state(null);

	const pileKinds: PileKind[] = ['deck', 'discard', 'exhausted'];
	const PILE_META: Record<PileKind, { icon: string; label: string }> = {
		deck: { icon: '🂠', label: 'Pilha de compra' },
		discard: { icon: '♻', label: 'Pilha de descarte' },
		exhausted: { icon: '💤', label: 'Cartas exaustas' }
	};

	function getPileCards(pile: PileKind | null): BattleCard[] {
		if (!pile) return [];
		return battleState[pile];
	}

	function handlePointerDown(card: BattleCard) {
		pressTimer = setTimeout(() => {
			wasLongPress = true;
			inspecting = { templateId: card.templateId, cardId: card.id };
			pressTimer = null;
		}, 300);
	}

	function handlePointerUp() {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handleHandClick(card: BattleCard) {
		if (wasLongPress) { wasLongPress = false; return; }
		if (ended) return;
		if (canPlay(card)) {
			onPlayCard(card.id, card.templateId);
		} else {
			inspecting = { templateId: card.templateId, cardId: card.id };
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
		const handCard = battleState.hand.find((c) => c.id === inspecting!.cardId);
		return handCard ? canPlay(handCard) : false;
	});
</script>

<section class="hand-section shrink-0 flex flex-col">
	<!-- Action bar -->
	<div class="actionbar">
		<!-- Left: pile chips -->
		<div class="meta-chips">
			{#each pileKinds as pile (pile)}
				<button
					type="button"
					class="chip"
					onclick={() => (openPile = pile)}
					aria-label={`Abrir ${PILE_META[pile].label}`}
				>
					{PILE_META[pile].icon} {battleState[pile].length}
				</button>
			{/each}
		</div>


		<!-- Right: End turn -->
		<button
			class="endturn"
			class:dim={battleState.turn !== 'player' || ended}
			disabled={battleState.turn !== 'player' || ended}
			onclick={onEndTurn}
		>
			Fim de turno ↦
		</button>
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
			{@const playable = canPlay(card)}
			<div
				role="button"
				tabindex="0"
				class="hand-card"
				class:hand-card--muted={!playable}
				style="left: calc(50% + {xPos}px - 65px); --angle: {angle}deg; z-index: {i + 1};"
				onpointerdown={() => handlePointerDown(card)}
				onpointerup={handlePointerUp}
				onpointercancel={handlePointerUp}
				oncontextmenu={(e) => { e.preventDefault(); inspecting = { templateId: card.templateId, cardId: card.id }; }}
				onclick={() => handleHandClick(card)}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleHandClick(card); }}
				aria-label="Jogar carta (segure para inspecionar)"
			>
				<Card templateId={card.templateId} compact={true} flip playable={playable} upgradeLevel={card.upgrades ?? 0} costOverride={effectiveCardCost(battleState, card)} dealDelay={i * 55} />
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
							compact={true}
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
<CardDetailsModal
	templateId={inspecting?.templateId ?? null}
	open={!!inspecting}
	onclose={() => (inspecting = null)}
	playable={inspectPlayable}
	onplay={inspecting?.cardId && !ended ? playInspected : undefined}
/>

<style>
	.hand-section {
		background: linear-gradient(180deg, var(--bg-1, #121219), var(--bg-0, #0b0b10));
		border-top: 1px solid var(--line, #2b2c38);
	}

	/* ── action bar ─────────────────────────────────────────────── */
	.actionbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px 4px;
	}
	.meta-chips {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		font-weight: 700;
		color: var(--txt-dim, #9a9bab);
		background: rgba(24, 24, 32, 0.85);
		border: 1px solid var(--line, #2b2c38);
		border-radius: 9px;
		padding: 5px 8px;
		backdrop-filter: blur(4px);
		cursor: pointer;
		transition: background 0.15s;
	}
	.chip:hover {
		background: rgba(40, 40, 52, 0.9);
	}

	/* hint text */
	.hand-hint {
		font-size: 11px;
		font-weight: 600;
		color: var(--txt-dim, #9a9bab);
		text-align: center;
		white-space: nowrap;
	}

	/* end turn button */
	.endturn {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.2px;
		color: #3b2400;
		background: linear-gradient(180deg, #ffd87a, #f0a91a);
		border: 1px solid #ffe39a;
		border-radius: 12px;
		padding: 9px 14px;
		cursor: pointer;
		box-shadow:
			0 8px 20px -6px rgba(240, 165, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.55);
		transition: transform 0.15s, filter 0.15s;
		text-shadow: 0 1px 0 rgba(255, 240, 200, 0.5);
		white-space: nowrap;
	}
	.endturn:active {
		transform: translateY(1px) scale(0.98);
	}
	.endturn.dim,
	.endturn:disabled {
		filter: grayscale(0.4) brightness(0.8);
		cursor: not-allowed;
	}

	/* ── hand fan ───────────────────────────────────────────────── */
	.hand-fan {
		position: relative;
		height: 240px;
		width: 100%;
		overflow: visible;
	}

	.hand-card {
		position: absolute;
		bottom: 24px;
		width: 130px;
		max-width: 30vh;
		transition: filter 180ms ease-out;
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
