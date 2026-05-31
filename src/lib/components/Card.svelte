<script lang="ts">
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_COLOR, ELEMENT_LABEL } from '$lib/game/elements';
	import CardKindIcon from './CardKindIcon.svelte';
	import ElementMatchupBadge from './ElementMatchupBadge.svelte';
	import type { Element } from '$lib/game/types';
	import { activePokemon, getElementalDamageLevel } from '$lib/game/state.svelte';

	let {
		templateId,
		playable = true,
		selected = false,
		dimmed = false,
		flip = false,
		count = 0,
		badge = '',
		shiny = false,
		showcase = false,
		onclick
	}: {
		templateId: string;
		playable?: boolean;
		selected?: boolean;
		dimmed?: boolean;
		flip?: boolean;
		count?: number;
		badge?: string;
		shiny?: boolean;
		showcase?: boolean;
		onclick?: () => void;
	} = $props();

	let tpl = $derived(getTemplate(templateId));

	// Cor tema: baseada no elemento (ou um cinza neutro se não tiver elemento)
	let theme = $derived(
		tpl?.element
			? ELEMENT_COLOR[tpl.element as Element]
			: tpl?.kind === 'power'
				? '#f59e0b'
				: '#94a3b8'
	);
	
	// Classe da raridade para efeitos visuais
	let rarityClass = $derived(`rarity-${tpl?.rarity ?? 'common'}`);
	
	let typeLabel = $derived(
		tpl?.element ? ELEMENT_LABEL[tpl.element as Element] : (tpl?.rarity ?? '')
	);
	let iconSize = $derived(showcase ? 86 : 65);
	let activePkm = $derived(activePokemon());
</script>

{#if tpl}
	<div class="card-shell relative">
		<button
			type="button"
			{onclick}
			disabled={!playable}
			class="card-root {rarityClass} relative flex aspect-3/4 w-full flex-col overflow-hidden rounded-xl border-[3px] text-left transition-transform duration-150"
			class:showcase
			class:opacity-40={dimmed}
			class:cursor-default={!playable}
			class:selected
			class:flip
			class:power-card={tpl.kind === 'power'}
			style="--theme-color: {theme};"
		>
			<!-- faixa superior plana -->
			<div
				class="flex items-center justify-between px-1.5 py-1 text-white"
				style="background: var(--theme-color);"
			>
				<span
					class="card-cost flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[12px] font-extrabold"
					style="color: var(--theme-color);">{tpl.cost}</span
				>
				<span class="truncate pl-1 text-[9px] font-bold uppercase tracking-wider opacity-95"
					>{typeLabel}</span
				>
			</div>

			<!-- arte central -->
			<div class="card-art flex flex-1 items-center justify-center body-texture">
				<div class="icon-wrap">
					<CardKindIcon id={tpl.id} kind={tpl.kind} element={tpl.element} color="var(--theme-color)" size={iconSize} />
				</div>
			</div>

			{#if shiny}
				<span class="shield-shine" aria-hidden="true"></span>
			{/if}

			<!-- rodapé -->
			<div class="px-2 pb-2 pt-1">
				<div class="truncate text-xs font-black leading-tight mb-1">{tpl.name}</div>
				<div class="flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-bold text-(--text-muted)">
					{#if tpl.damage}
						{@const displayDmg = tpl.damage + (tpl.kind === 'attack' ? getElementalDamageLevel(activePkm?.element) * 3 + ((activePkm?.damageBuffs ?? 0) * 2) : 0)}
						<span class="flex items-center gap-0.5 text-red-400"><span class="text-sm">⚔</span> {displayDmg}</span>
					{/if}
					{#if tpl.block}
						<span class="flex items-center gap-0.5 text-blue-400"><span class="text-sm">🛡</span> {tpl.block}</span>
					{/if}
					{#if tpl.healHp}
						<span class="flex items-center gap-0.5 text-green-400"><span class="text-sm">❤</span> {tpl.healHp}</span>
					{/if}
					{#if tpl.buffAmount}
						<span class="flex items-center gap-0.5 text-purple-400"><span class="text-sm">✨</span> +{tpl.buffAmount}</span>
					{/if}
					{#if tpl.captureBonus}
						<span class="flex items-center gap-0.5 text-amber-500"><span class="text-sm">●</span> +{Math.round(tpl.captureBonus * 100)}%</span>
					{/if}
					{#if tpl.id === 'power_berserk'}
						<span class="flex items-center gap-0.5 text-red-500"><span class="text-sm">⚔</span> x2</span>
						<span class="flex items-center gap-0.5 text-blue-500"><span class="text-sm">🛡</span> ÷2</span>
					{/if}
					{#if tpl.id === 'power_dragonize'}
						<span class="flex items-center gap-0.5 text-indigo-400"><span class="text-sm">🐉</span> Dragão</span>
					{/if}
					{#if tpl.id === 'power_electric_shock'}
						<span class="flex items-center gap-0.5 text-amber-400"><span class="text-sm">⚡</span> +2/jogada</span>
					{/if}
					{#if tpl.kind === 'relic'}
						<span class="flex items-center gap-0.5 text-purple-600"><span class="text-sm">👻</span> Dano 1</span>
					{/if}
					{#if tpl.manaGain}
						<span class="flex items-center gap-0.5 text-cyan-400"><span class="text-sm">⚡</span> +{tpl.manaGain}</span>
					{/if}
					{#if tpl.attackRepeat}
						<span class="flex items-center gap-0.5 text-orange-400"><span class="text-sm">⚔</span> ×{tpl.attackRepeat + 1}</span>
					{/if}
					{#if tpl.drawCount}
						<span class="flex items-center gap-0.5 text-sky-300"><span class="text-sm">🃏</span> +{tpl.drawCount}</span>
					{/if}
					{#if tpl.debuffAmount}
						<span class="flex items-center gap-0.5 text-red-400"><span class="text-sm">👤</span> -{Math.round(tpl.debuffAmount * 100)}% {tpl.debuffDuration}t</span>
					{/if}
				</div>
			</div>

			{#if count > 1}
				<span
					class="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/50 bg-black/60 px-1 text-[10px] font-bold text-white"
					>×{count}</span
				>
			{/if}
			{#if badge}
				<span
					class="absolute bottom-1 right-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white"
					>{badge}</span
				>
			{/if}
		</button>

		{#if tpl.element}
			<div class="absolute bottom-1 left-1 z-20">
				<ElementMatchupBadge element={tpl.element as Element} compact={!showcase} />
			</div>
		{/if}
	</div>
{/if}

<style>
	.card-root {
		background: var(--surface);
		box-shadow:
			0 8px 20px rgba(0, 0, 0, 0.32),
			inset 0 0 0 1px rgba(255, 255, 255, 0.09);
	}
	.card-root.showcase {
		box-shadow:
			0 14px 32px rgba(0, 0, 0, 0.4),
			inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}
	.card-root.selected {
		border-color: var(--accent) !important;
		transform: translateY(-6px);
	}
	.card-root:not(:disabled):active {
		transform: scale(0.97);
	}

	/* Rarity Colors & Body Decals */
	.card-root.rarity-starter { border-color: #9ca3af; }
	.card-root.rarity-starter .body-texture {
		background: radial-gradient(ellipse at 50% 65%, color-mix(in srgb, var(--theme-color) 12%, var(--surface)), var(--surface) 80%);
	}

	.card-root.rarity-common { border-color: #64748b; }
	.card-root.rarity-common .body-texture {
		background: radial-gradient(ellipse at 50% 65%, color-mix(in srgb, var(--theme-color) 18%, var(--surface)), var(--surface) 80%);
	}

	.card-root.rarity-rare { border-color: #3b82f6; }
	.card-root.rarity-rare .body-texture {
		background: 
			radial-gradient(ellipse at 50% 65%, color-mix(in srgb, var(--theme-color) 25%, var(--surface)), var(--surface) 80%),
			repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 8px);
		box-shadow: inset 0 0 12px rgba(59, 130, 246, 0.15);
	}

	.card-root.rarity-epic { border-color: #a855f7; }
	.card-root.rarity-epic .body-texture {
		background: 
			radial-gradient(ellipse at 50% 65%, color-mix(in srgb, var(--theme-color) 35%, var(--surface)), var(--surface) 75%),
			repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0px, transparent 4px, rgba(255,255,255,0.02) 8px);
		box-shadow: inset 0 0 20px rgba(168, 85, 247, 0.3);
	}

	.card-root.rarity-secret {
		border-color: #facc15;
		box-shadow:
			0 14px 30px rgba(0, 0, 0, 0.45),
			0 0 0 1px rgba(250, 204, 21, 0.55),
			inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}
	.card-root.rarity-secret .body-texture {
		background:
			radial-gradient(circle at 50% 58%, color-mix(in srgb, var(--theme-color) 42%, #fef3c7), var(--surface) 60%),
			linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(59, 130, 246, 0.08) 40%, rgba(168, 85, 247, 0.16) 80%),
			repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 9px);
		box-shadow:
			inset 0 0 22px rgba(250, 204, 21, 0.28),
			inset 0 0 36px rgba(255, 255, 255, 0.06);
	}

	.card-root.power-card {
		isolation: isolate;
		box-shadow:
			0 12px 28px rgba(0, 0, 0, 0.4),
			0 0 0 1px color-mix(in srgb, var(--theme-color) 45%, white),
			inset 0 0 24px color-mix(in srgb, var(--theme-color) 22%, transparent);
	}
	.card-root.power-card::before {
		content: '';
		position: absolute;
		inset: 8px;
		border-radius: 0.8rem;
		border: 1px solid color-mix(in srgb, var(--theme-color) 55%, white);
		box-shadow: 0 0 18px color-mix(in srgb, var(--theme-color) 28%, transparent);
		pointer-events: none;
		z-index: 0;
	}
	.card-root.power-card::after {
		content: '';
		position: absolute;
		inset: auto -10% 18% -10%;
		height: 34%;
		background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--theme-color) 48%, white), transparent 72%);
		filter: blur(14px);
		opacity: 0.4;
		pointer-events: none;
		z-index: 0;
	}
	.card-root.power-card > * {
		position: relative;
		z-index: 1;
	}
	.card-root.power-card .body-texture {
		background:
			radial-gradient(circle at 50% 58%, color-mix(in srgb, var(--theme-color) 38%, var(--surface)), var(--surface) 62%),
			linear-gradient(145deg, color-mix(in srgb, var(--theme-color) 14%, transparent), transparent 58%),
			repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0px, rgba(255, 255, 255, 0.06) 2px, transparent 2px, transparent 9px);
	}
	.card-root.power-card .icon-wrap {
		filter: drop-shadow(0 0 14px color-mix(in srgb, var(--theme-color) 42%, transparent));
	}
	.card-root.power-card .card-cost {
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--theme-color) 30%, transparent),
			0 0 16px color-mix(in srgb, var(--theme-color) 30%, transparent);
	}

	.icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
	}
	.card-root.showcase .icon-wrap {
		transform: scale(1.07);
	}
	.card-root.flip {
		animation: card-flip 300ms ease-out backwards;
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
	@keyframes card-flip {
		from {
			transform: perspective(600px) rotateY(80deg);
			opacity: 0;
		}
		to {
			transform: perspective(600px) rotateY(0);
			opacity: 1;
		}
	}
	@keyframes shield-shine {
		0% {
			left: -40%;
			opacity: 0;
		}
		20% {
			opacity: 0.9;
		}
		45% {
			left: 85%;
			opacity: 0;
		}
		100% {
			left: 85%;
			opacity: 0;
		}
	}
</style>
