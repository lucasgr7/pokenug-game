<script lang="ts">
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_COLOR, ELEMENT_LABEL } from '$lib/game/elements';
	import CardKindIcon from './CardKindIcon.svelte';
	import type { Element } from '$lib/game/types';

	let {
		templateId,
		playable = true,
		selected = false,
		dimmed = false,
		flip = false,
		count = 0,
		badge = '',
		shiny = false,
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
		onclick?: () => void;
	} = $props();

	let tpl = $derived(getTemplate(templateId));

	const rarityColor: Record<string, string> = {
		starter: '#9ca3af',
		common: '#64748b',
		rare: '#3b82f6',
		epic: '#a855f7'
	};
	// Cor tema: elemento quando houver, senão cor da raridade.
	let theme = $derived(
		tpl?.element ? ELEMENT_COLOR[tpl.element as Element] : rarityColor[tpl?.rarity ?? 'common']
	);
	let typeLabel = $derived(
		tpl?.element ? ELEMENT_LABEL[tpl.element as Element] : (tpl?.rarity ?? '')
	);
</script>

{#if tpl}
	<button
		type="button"
		{onclick}
		disabled={!playable}
		class="card-root relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-lg border-2 bg-[var(--surface)] text-left transition-transform duration-150"
		class:opacity-40={dimmed}
		class:cursor-default={!playable}
		class:-translate-y-1.5={selected}
		class:flip
		style="border-color: {selected ? 'var(--accent)' : theme};"
	>
		<!-- faixa superior plana -->
		<div
			class="flex items-center justify-between px-1.5 py-1 text-white"
			style="background: {theme};"
		>
			<span
				class="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[12px] font-extrabold"
				style="color: {theme};">{tpl.cost}</span
			>
			<span class="truncate pl-1 text-[8px] font-bold uppercase tracking-wide opacity-95"
				>{typeLabel}</span
			>
		</div>

		<!-- arte central plana -->
		<div class="flex flex-1 items-center justify-center" style="background: {theme}14;">
			<CardKindIcon kind={tpl.kind} color={theme} size={42} />
		</div>

		{#if shiny}
			<span class="shield-shine" aria-hidden="true"></span>
		{/if}

		<!-- rodapé -->
		<div class="px-1.5 pb-1.5 pt-1">
			<div class="truncate text-[11px] font-bold leading-tight">{tpl.name}</div>
			<div class="mt-0.5 flex flex-wrap gap-1 text-[9px] font-bold leading-none">
				{#if tpl.damage}<span class="rounded px-1 py-0.5 text-white" style="background:#ef4444">⚔ {tpl.damage}</span>{/if}
				{#if tpl.block}<span class="rounded px-1 py-0.5 text-white" style="background:#3b82f6">🛡 {tpl.block}</span>{/if}
				{#if tpl.healHp}<span class="rounded px-1 py-0.5 text-white" style="background:#16a34a">❤ {tpl.healHp}</span>{/if}
				{#if tpl.buffAmount}<span class="rounded px-1 py-0.5 text-white" style="background:#a855f7">✨ +{tpl.buffAmount}</span>{/if}
				{#if tpl.captureBonus}<span class="rounded px-1 py-0.5 text-white" style="background:#d97706">● +{Math.round(tpl.captureBonus * 100)}%</span>{/if}
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
{/if}

<style>
	.card-root:not(:disabled):active {
		transform: scale(0.97);
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
