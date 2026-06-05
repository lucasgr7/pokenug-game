<script lang="ts">
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_COLOR, ELEMENT_LABEL } from '$lib/game/elements';
	import CardKindIcon from './CardKindIcon.svelte';
	import type { Element } from '$lib/game/types';
	import { activePokemon, getElementalDamageLevel } from '$lib/game/state.svelte';

	let {
		templateId,
		playable = true,
		selected = false,
		dimmed = false,
		flip = false,
		dealDelay = 0,
		count = 0,
		badge = '',
		shiny = false,
		showcase = false,
		compact = false,
		iconOnlyBadge = false,
		description = '',
		costOverride = null,
		onclick,
		onlongpress
	}: {
		templateId: string;
		playable?: boolean;
		selected?: boolean;
		dimmed?: boolean;
		flip?: boolean;
		dealDelay?: number;
		count?: number;
		badge?: string;
		shiny?: boolean;
		showcase?: boolean;
		compact?: boolean;
		iconOnlyBadge?: boolean;
		description?: string;
		costOverride?: number | null;
		onclick?: () => void;
		onlongpress?: () => void;
	} = $props();

	let wasLongPress = $state(false);
	let pressTimer: ReturnType<typeof setTimeout> | null = null;

	function handlePointerDown() {
		if (!onlongpress) return;
		pressTimer = setTimeout(() => {
			wasLongPress = true;
			onlongpress();
			pressTimer = null;
		}, 300);
	}

	function handlePointerUp() {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handleClick() {
		if (wasLongPress) {
			wasLongPress = false;
			return;
		}
		onclick?.();
	}

	function handleContextMenu(e: Event) {
		if (onlongpress) {
			e.preventDefault();
			onlongpress();
		}
	}

	let tpl = $derived(getTemplate(templateId));

	let elementColor = $derived(
		tpl?.element ? ELEMENT_COLOR[tpl.element as Element] : tpl?.kind === 'power' ? '#f59e0b' : '#9ca3af'
	);
	let elementLabel = $derived(
		tpl?.element ? ELEMENT_LABEL[tpl.element as Element] : (tpl?.rarity?.toUpperCase() ?? 'CARTA')
	);

	let rarityClass = $derived(`rar-${tpl?.rarity ?? 'common'}`);
	let iconSize = $derived(showcase ? (compact ? 62 : 80) : compact ? 44 : 58);
	let activePkm = $derived(activePokemon());

	// Primary stat for the art badge
	let statKind = $derived(
		tpl?.kind === 'attack' || tpl?.damage ? 'atk'
		: tpl?.kind === 'defense' || tpl?.block ? 'def'
		: 'util'
	);
	let statValue = $derived(
		tpl?.damage
			? tpl.damage + (tpl.kind === 'attack' ? getElementalDamageLevel(activePkm?.element) * 3 + ((activePkm?.damageBuffs ?? 0) * 2) : 0)
			: tpl?.block ?? tpl?.healHp ?? tpl?.buffAmount ?? tpl?.manaGain ?? tpl?.captureBonus
				? Math.round((tpl.captureBonus ?? 0) * 100) || tpl?.manaGain || tpl?.drawCount || 1
				: null
	);

	// Rarity stars
	const RARITY_STARS: Record<string, number> = {
		starter: 0, common: 1, rare: 2, epic: 3, secret: 4
	};
	const RARITY_METAL: Record<string, string> = {
		starter: '#9a9ba6', common: '#aeb4c0', rare: '#dbe6f4', epic: '#ffd884', secret: '#f0f0ff'
	};
	let starCount = $derived(RARITY_STARS[tpl?.rarity ?? 'common'] ?? 1);
	let metalColor = $derived(RARITY_METAL[tpl?.rarity ?? 'common'] ?? '#aeb4c0');
</script>

{#if tpl}
	<button
		type="button"
		onclick={handleClick}
		onpointerdown={handlePointerDown}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		oncontextmenu={handleContextMenu}
		disabled={!playable}
		class="card-root {rarityClass}"
		class:selected
		class:dimmed
		class:flip
		class:showcase
		class:compact
		class:power-card={tpl.kind === 'power'}
		style="--elem-color: {elementColor}; --metal: {metalColor};{dealDelay ? `animation-delay:${dealDelay}ms;` : ''}"
	>
		<div class="frame">
			<div class="inner" style="border-color: {elementColor};">

				<!-- HEAD: cost gem + rarity stars -->
				<div class="c-head">
					<div class="cost-gem" class:cost-modified={costOverride != null && costOverride !== tpl.cost} class:cost-cheaper={costOverride != null && costOverride < tpl.cost} class:cost-pricier={costOverride != null && costOverride > tpl.cost}>
						<span class="cost-num">{costOverride ?? tpl.cost}</span>
					</div>
					<div class="rarity-stars">
						{#if starCount === 0}
							<span class="rarity-dot" style="background: {metalColor};"></span>
						{:else}
							{#each Array(starCount) as _, i (i)}
								<svg class="star" width="11" height="11" viewBox="0 0 24 24" fill={metalColor}>
									<path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
								</svg>
							{/each}
						{/if}
					</div>
				</div>

				<!-- NAME -->
				<div class="c-name">{tpl.name}</div>

				<!-- ART WINDOW -->
				<div class="c-art">
					<div class="art-halo" style="background: radial-gradient(circle at 50% 42%, {elementColor}cc, {elementColor}33 55%, transparent 72%);"></div>
					<div class="art-ring" style="border-color: {elementColor};"></div>
					<div class="art-glyph">
						<CardKindIcon id={tpl.id} kind={tpl.kind} element={tpl.element} color={elementColor} size={iconSize} />
					</div>
					{#if statValue !== null && statValue !== undefined}
						<div class="stat-badge {statKind}">
							{#if statKind === 'atk'}
								<svg width="{compact ? 11 : 22}" height="{compact ? 11 : 22}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 6-9 12-9-12z"/></svg>
								<span class="stat-val">{tpl.damage}</span>
							{:else if statKind === 'def'}
								<svg width="{compact ? 11 : 22}" height="{compact ? 11 : 22}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/></svg>
								<span class="stat-val">{tpl.block}</span>
							{:else}
								<svg width="{compact ? 11 : 22}" height="{compact ? 11 : 22}" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
								<span class="stat-val">{tpl.manaGain}</span>
							{/if}
						</div>
					{/if}
				</div>

				{#if tpl.description != null && tpl.description.trim() !== '' && !compact}
				<div class="p-4 text-sm text-center text-(--text-muted) line-clamp-4">
					{tpl.description}
				</div>
				{/if}

				<!-- FOOT: extra stats + type chip -->
				<div class="c-foot">
					<!-- secondary stats row -->
					 {#if !compact}
					<div class="stats-row text-small">
						{#if tpl.healHp}
							<span class="stat-tag heal">❤ {tpl.healHp}</span>
						{/if}
						{#if tpl.buffAmount}
							<span class="stat-tag util">✨ +{tpl.buffAmount}</span>
						{/if}
						{#if tpl.captureBonus}
							<span class="stat-tag util">● +{Math.round(tpl.captureBonus * 100)}%</span>
						{/if}
						{#if tpl.id === 'power_berserk'}
							<span class="stat-tag atk">⚔ x2</span>
							<span class="stat-tag def">🛡 ÷2</span>
						{/if}
						{#if tpl.id === 'power_dragonize'}
							<span class="stat-tag util">🐉 Dragão</span>
						{/if}
						{#if tpl.id === 'power_electric_shock'}
							<span class="stat-tag util">⚡ +2/jogada</span>
						{/if}
						{#if tpl.kind === 'relic'}
							<span class="stat-tag util">👻 Dano 1</span>
						{/if}
						{#if tpl.manaGain}
							<span class="stat-tag util">⚡ +{tpl.manaGain}</span>
						{/if}
						{#if tpl.attackRepeat}
							<span class="stat-tag atk">⚔ ×{tpl.attackRepeat + 1}</span>
						{/if}
						{#if tpl.drawCount}
							<span class="stat-tag util">🃏 +{tpl.drawCount}</span>
						{/if}
						{#if tpl.debuffAmount}
							<span class="stat-tag atk">👤 -{Math.round(tpl.debuffAmount * 100)}% {tpl.debuffDuration}t</span>
						{/if}
					</div>
					{/if}
					<!-- type chip -->
					{#if tpl.element}
						<div
							class="type-chip"
							style="color:{elementColor}; background: linear-gradient(180deg,{elementColor}22,{elementColor}11); border-color:{elementColor}66;"
						>
							{elementLabel.toUpperCase()}
						</div>
					{/if}
				</div>

			</div>
		</div>

		{#if shiny}
			<span class="shield-shine" aria-hidden="true"></span>
		{/if}
		{#if count > 1}
			<span class="count-badge">×{count}</span>
		{/if}
		{#if badge}
			<span class="card-badge">{badge}</span>
		{/if}
	</button>
{/if}

<style>
	/* ── Shell ─────────────────────────────────────────────────────────── */
	.card-root {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		cursor: pointer;
		border: none;
		padding: 0;
		background: transparent;
		transition: transform 0.28s cubic-bezier(0.2, 0.9, 0.25, 1.1), filter 0.2s;
		text-align: left;
	}
	.card-root:disabled {
		cursor: default;
	}
	.card-root.dimmed {
		opacity: 0.4;
	}
	.card-root.selected .frame {
		outline: 2px solid var(--acc);
		outline-offset: 2px;
	}
	.card-root.selected {
		transform: translateY(-6px);
	}
	.card-root:not(:disabled):active {
		transform: scale(0.97);
	}
	.card-root.flip {
		animation: card-deal-in 360ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
	}

	/* ── Frame (rarity-driven metallic gradient) ────────────────────────── */
	.frame {
		width: 100%;
		height: 100%;
		border-radius: 13px;
		padding: 3px;
		position: relative;
		box-shadow: 0 10px 22px -8px rgba(0, 0, 0, 0.85);
	}
	.rar-starter .frame  { background: linear-gradient(150deg, #42434d, #26272e 55%, #1b1c22); }
	.rar-common  .frame  { background: linear-gradient(150deg, #5a5d68, #34363f 50%, #23242b); }
	.rar-rare    .frame  {
		background: linear-gradient(150deg, #eef3fa, #9fadbf 42%, #d4dde9 58%, #76808f);
		animation: glow-rare 3s ease-in-out infinite;
	}
	.rar-epic    .frame  {
		background: linear-gradient(150deg, #ffe9ab, #cba24c 42%, #f4d488 58%, #9a7830);
		animation: glow-epic 2.6s ease-in-out infinite;
	}
	.rar-secret  .frame  {
		background: conic-gradient(from 0deg, #ff7ad9, #8e9bff, #6ff0d0, #ffd36e, #ff9ad1, #ff7ad9);
		animation: iridescent 6s linear infinite;
	}

	@keyframes glow-rare {
		0%, 100% { box-shadow: 0 10px 22px -8px rgba(0,0,0,.85), 0 0 8px rgba(178,205,235,.25); }
		50%       { box-shadow: 0 10px 22px -8px rgba(0,0,0,.85), 0 0 16px rgba(190,215,245,.6); }
	}
	@keyframes glow-epic {
		0%, 100% { box-shadow: 0 10px 22px -8px rgba(0,0,0,.85), 0 0 10px rgba(255,200,90,.3); }
		50%       { box-shadow: 0 10px 22px -8px rgba(0,0,0,.85), 0 0 20px rgba(255,210,110,.7); }
	}
	@keyframes iridescent {
		to { filter: hue-rotate(360deg); }
	}

	/* ── Inner (dark card body) ─────────────────────────────────────────── */
	.inner {
		width: 100%;
		height: 100%;
		border-radius: 10px;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--elem-color) 24%, #1c1d25) 0%,
			color-mix(in srgb, var(--elem-color) 14%, #14151c) 50%,
			#121319 50%,
			#090a0f 100%
		);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	/* ── Head: cost + rarity stars ─────────────────────────────────────── */
	.c-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 6px 7px 0;
		position: relative;
		z-index: 3;
	}
	.cost-gem {
		width: 30px;
		height: 33px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		clip-path: polygon(50% 0, 100% 27%, 100% 73%, 50% 100%, 0 73%, 0 27%);
		background: linear-gradient(160deg, #f3e7ff 0%, #c9a3ff 32%, #8b5cf6 65%, #5926c4 100%);
		filter: drop-shadow(0 2px 4px rgba(40, 10, 90, 0.55)) drop-shadow(0 0 6px rgba(168, 107, 255, 0.35));
	}
	.cost-gem.cost-cheaper {
		background: linear-gradient(160deg, #fef3c7 0%, #fbbf24 32%, #d97706 65%, #92400e 100%);
		filter: drop-shadow(0 2px 4px rgba(180, 80, 0, 0.55)) drop-shadow(0 0 6px rgba(251, 191, 36, 0.35));
	}
	.cost-gem.cost-pricier {
		background: linear-gradient(160deg, #fecaca 0%, #f87171 32%, #dc2626 65%, #7f1d1d 100%);
		filter: drop-shadow(0 2px 4px rgba(180, 0, 0, 0.55)) drop-shadow(0 0 6px rgba(248, 113, 113, 0.35));
	}
	.cost-gem.cost-modified .cost-num {
		font-weight: 900;
	}
	.cost-gem::before {
		content: '';
		position: absolute;
		inset: 0;
		clip-path: polygon(50% 0, 100% 27%, 100% 73%, 50% 100%, 0 73%, 0 27%);
		z-index: 2;
		pointer-events: none;
		background: radial-gradient(45% 35% at 30% 22%, rgba(255, 255, 255, 0.75), transparent 65%);
	}
	.cost-num {
		position: relative;
		z-index: 3;
		font-family: var(--font-display, 'Russo One', sans-serif);
		font-size: 15px;
		color: #fff;
		text-shadow: 0 1px 0 rgba(60, 20, 140, 0.8), 0 0 4px rgba(0, 0, 0, 0.4);
	}
	.rarity-stars {
		display: flex;
		gap: 2px;
		padding-top: 3px;
	}
	.rarity-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		transform: rotate(45deg);
		opacity: 0.6;
		margin-top: 4px;
	}
	.star {
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6));
	}

	/* ── Name ───────────────────────────────────────────────────────────── */
	.c-name {
		margin: 5px 6px 0;
		text-align: center;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.2px;
		color: #fff;
		line-height: 1.1;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
		text-wrap: balance;
		position: relative;
		z-index: 3;
	}

	/* ── Art window ─────────────────────────────────────────────────────── */
	.c-art {
		flex: 1;
		margin: 5px 7px 0;
		border-radius: 8px;
		position: relative;
		overflow: hidden;
		background: radial-gradient(120% 100% at 50% 38%, #23242e, #101015 80%);
		border: 1px solid rgba(255, 255, 255, 0.05);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.art-halo {
		position: absolute;
		width: 90px;
		height: 90px;
		border-radius: 50%;
		top: 44%;
		left: 50%;
		transform: translate(-50%, -50%);
		filter: blur(2px);
		opacity: 0.85;
	}
	.art-ring {
		position: absolute;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		top: 44%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: 1.5px solid;
		opacity: 0.55;
	}
	.art-glyph {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.card-root.power-card .art-glyph {
		filter: drop-shadow(0 0 14px color-mix(in srgb, var(--elem-color) 42%, transparent));
	}
	.stat-badge {
		position: absolute;
		left: 5px;
		bottom: 15px;
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 3px;
		background: rgba(8, 8, 12, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 7px;
		padding: 2px 5px;
	}
	.stat-badge.atk { color: #ff8c5a; }
	.stat-badge.def { color: #6fe6d4; }
	.stat-badge.util { color: var(--mana-2, #c9a3ff); }
	.stat-val {
		font-family: var(--font-display, 'Russo One', sans-serif);
		font-size: 18px;
		line-height: 1;
	}

	/* ── Footer ─────────────────────────────────────────────────────────── */
	.c-foot {
		padding: 4px 6px 6px;
		position: relative;
		z-index: 3;
	}
	.stats-row {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		margin-bottom: 4px;
	}
	.stat-tag {
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.06);
	}
	.stat-tag.atk  { color: #ff8c5a; }
	.stat-tag.def  { color: #6fe6d4; }
	.stat-tag.heal { color: var(--good-2, #7ee08f); }
	.stat-tag.util { color: var(--mana-2, #c9a3ff); }

	.type-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		padding: 3px 5px;
		font-size: 8.5px;
		font-weight: 800;
		letter-spacing: 0.7px;
		border: 1px solid;
		line-height: 1;
	}

	/* ── Overlays ───────────────────────────────────────────────────────── */
	.count-badge {
		position: absolute;
		right: 6px;
		top: 6px;
		display: flex;
		min-width: 20px;
		height: 20px;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.5);
		background: rgba(0, 0, 0, 0.65);
		padding: 0 4px;
		font-size: 10px;
		font-weight: 700;
		color: #fff;
	}
	.card-badge {
		position: absolute;
		bottom: 5px;
		right: 5px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.65);
		padding: 2px 6px;
		font-size: 9px;
		font-weight: 700;
		color: #fff;
	}
	.shield-shine {
		position: absolute;
		inset: -30% auto -30% -35%;
		width: 60%;
		background: linear-gradient(90deg, transparent, rgba(191, 219, 254, 0.82), transparent);
		transform: rotate(20deg);
		animation: shield-shine 1.6s ease-in-out infinite;
		mix-blend-mode: screen;
		pointer-events: none;
	}

	/* ── Compact mode (hand fan / small contexts) ──────────────────────── */
	.card-root.compact .c-head {
		padding: 4px 5px 0;
	}
	.card-root.compact .cost-gem {
		width: 24px;
		height: 27px;
	}
	.card-root.compact .cost-num {
		font-size: 12px;
	}
	.card-root.compact .rarity-dot {
		width: 6px;
		height: 6px;
	}
	.card-root.compact .star {
		width: 9px;
		height: 9px;
	}
	.card-root.compact .c-name {
		margin: 3px 4px 0;
		font-size: 9px;
		letter-spacing: 0;
		/* clamp to 2 lines then ellipsis */
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-wrap: unset;
	}
	.card-root.compact .c-art {
		margin: 3px 5px 0;
	}
	.card-root.compact .art-halo {
		width: 68px;
		height: 68px;
	}
	.card-root.compact .art-ring {
		width: 48px;
		height: 48px;
	}
	.card-root.compact .stat-badge {
		padding: 1px 4px;
		gap: 2px;
	}
	.card-root.compact .stat-val {
		font-size: 11px;
	}
	.card-root.compact .c-foot {
		padding: 2px 4px 4px;
	}
	.card-root.compact .stats-row {
		gap: 2px;
		margin-bottom: 2px;
	}
	.card-root.compact .stat-tag {
		font-size: 8px;
		padding: 1px 3px;
	}
	.card-root.compact .type-chip {
		display: none;
	}

	/* ── Animations ─────────────────────────────────────────────────────── */
	@keyframes card-deal-in {
		0%   { transform: translate(-42%, 64%) rotate(-22deg) scale(0.6); opacity: 0; }
		60%  { opacity: 1; }
		100% { transform: translate(0, 0) rotate(0) scale(1); opacity: 1; }
	}
	@keyframes shield-shine {
		0%   { left: -40%; opacity: 0; }
		20%  { opacity: 0.9; }
		45%  { left: 85%; opacity: 0; }
		100% { left: 85%; opacity: 0; }
	}
</style>
