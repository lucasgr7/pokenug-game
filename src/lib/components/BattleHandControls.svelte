<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import CardDetailsModal from '$lib/components/CardDetailsModal.svelte';
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

		<!-- Center: AUTO toggle -->
		<label
			class="auto-toggle"
			class:on={autoConfirm}
			title="Usa a carta imediatamente com um toque"
		>
			<input
				type="checkbox"
				class="sr-only"
				checked={autoConfirm}
				onchange={handleAutoConfirmToggle}
				aria-label="Auto confirmação"
			/>
			<span class="switch">
				<span class="knob"></span>
			</span>
			<span>AUTO</span>
		</label>

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
			{@const playable = canPlay(card.templateId)}
			<div
				role="button"
				tabindex="0"
				class="hand-card"
				class:hand-card--muted={!playable}
				style="left: calc(50% + {xPos}px - 65px); --angle: {angle}deg; z-index: {i + 1};"
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

	/* AUTO toggle */
	.auto-toggle {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.5px;
		color: var(--txt-dim, #9a9bab);
		cursor: pointer;
		user-select: none;
	}
	.auto-toggle.on {
		color: #7ee9d8;
	}
	.switch {
		width: 38px;
		height: 21px;
		border-radius: 999px;
		background: #2a2b36;
		border: 1px solid var(--line, #2b2c38);
		position: relative;
		transition: background 0.25s, border-color 0.25s;
		flex-shrink: 0;
	}
	.auto-toggle.on .switch {
		background: linear-gradient(90deg, #1ea193, #3ad6c2);
		border-color: #6fe6d4;
	}
	.knob {
		position: absolute;
		top: 1.5px;
		left: 1.5px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #cfd0db;
		transition: left 0.25s cubic-bezier(0.3, 1.4, 0.5, 1), background 0.2s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}
	.auto-toggle.on .knob {
		left: 19px;
		background: #fff;
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
