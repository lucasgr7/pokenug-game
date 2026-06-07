<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { NatureId } from '$lib/game/types';

	let {
		id,
		locked = false,
		size = 32
	}: {
		id: NatureId;
		locked?: boolean;
		size?: number;
	} = $props();

	const NATURE_COLORS: Record<NatureId, string> = {
		hardy: '#f59e0b',
		lonely: '#ef4444',
		brave: '#c2410c',
		adamant: '#16a34a',
		naughty: '#eab308',
		bold: '#3b82f6',
		docile: '#22c55e',
		relaxed: '#60a5fa',
		lax: '#a8a29e',
		timid: '#6d28d9',
		serious: '#9333ea',
		hasty: '#eab308',
		quirky: '#84cc16',
		sassy: '#db2777',
		modest: '#22d3ee'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 32 32"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class:nature-locked={locked}
	class:nature-active={!locked}
	style="--nature-color: {NATURE_COLORS[id]};"
	aria-label={$_('natureIcon.ariaLabel', { values: { id: id } })}
>
	{#if id === 'hardy'}
		<rect x="6" y="16" width="20" height="3" rx="1.5" fill="var(--nature-color)" opacity="0.22" />
		<rect x="6" y="8" width="18" height="3" rx="1.5" fill="var(--nature-color)" opacity="0.22" />
		<rect x="6" y="24" width="14" height="3" rx="1.5" fill="var(--nature-color)" opacity="0.22" />
		<rect x="6" y="16" width="20" height="3" rx="1.5" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" />
		<rect x="6" y="8" width="18" height="3" rx="1.5" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" />
		<rect x="6" y="24" width="14" height="3" rx="1.5" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" />
	{:else if id === 'lonely'}
		<path d="M16 28S6 21 6 13a10 10 0 0 1 20 0c0 8-10 15-10 15z" fill="var(--nature-color)" opacity="0.22" />
		<path d="M16 28S6 21 6 13a10 10 0 0 1 20 0c0 8-10 15-10 15z" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
		<path d="M16 9v8M12 13h8" stroke="var(--nature-color)" stroke-width="2.5" stroke-linecap="round" />
	{:else if id === 'brave'}
		<g transform="translate(5 6)">
			<path d="M11 2L3 14h5l-2 12 10-14H11z" fill="var(--nature-color)" opacity="0.22" />
			<path d="M11 2L3 14h5l-2 12 10-14H11z" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
		</g>
	{:else if id === 'adamant'}
		<circle cx="16" cy="16" r="10" fill="var(--nature-color)" opacity="0.22" />
		<circle cx="16" cy="16" r="10" stroke="var(--nature-color)" stroke-width="2.5" />
		<path d="M10 20l6-10 6 10z" fill="var(--nature-color)" opacity="0.35" stroke="var(--nature-color)" stroke-width="2" stroke-linejoin="round" />
	{:else if id === 'naughty'}
		<path d="M16 4l2 6h6l-5 4 2 7-5-4-5 4 2-7-5-4h6z" fill="var(--nature-color)" opacity="0.22" />
		<path d="M16 4l2 6h6l-5 4 2 7-5-4-5 4 2-7-5-4h6z" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
		<path d="M12 13h8" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" opacity="0.6" />
	{:else if id === 'bold'}
		<path d="M16 4l10 4v8c0 7-4 12-10 14-6-2-10-7-10-14V8z" fill="var(--nature-color)" opacity="0.22" />
		<path d="M16 4l10 4v8c0 7-4 12-10 14-6-2-10-7-10-14V8z" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
		<path d="M12 16l3 3 6-7" stroke="var(--nature-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
		<path d="M12 22l3 3 6-7" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5" />
	{:else if id === 'docile'}
		<circle cx="16" cy="16" r="10" fill="var(--nature-color)" opacity="0.22" />
		<circle cx="16" cy="16" r="10" stroke="var(--nature-color)" stroke-width="2.5" />
		<path d="M11 16h10M16 11v10" stroke="var(--nature-color)" stroke-width="2.5" stroke-linecap="round" />
	{:else if id === 'relaxed'}
		<circle cx="16" cy="16" r="10" fill="var(--nature-color)" opacity="0.22" />
		<circle cx="16" cy="16" r="10" stroke="var(--nature-color)" stroke-width="2.5" />
		<path d="M11 19h10M11 14h6" stroke="var(--nature-color)" stroke-width="2.5" stroke-linecap="round" opacity="0.6" />
	{:else if id === 'lax'}
		<path d="M16 6l8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V9z" fill="var(--nature-color)" opacity="0.22" />
		<path d="M16 6l8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V9z" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
		<path d="M12 14l3 3 6-5M12 20l3 3 6-5" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
	{:else if id === 'timid'}
		<circle cx="16" cy="16" r="10" fill="var(--nature-color)" opacity="0.22" />
		<circle cx="16" cy="16" r="10" stroke="var(--nature-color)" stroke-width="2.5" />
		<circle cx="12" cy="13" r="1.5" fill="var(--nature-color)" />
		<circle cx="20" cy="13" r="1.5" fill="var(--nature-color)" />
		<path d="M12 21q4 2 8 0" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" fill="none" />
	{:else if id === 'serious'}
		<circle cx="16" cy="16" r="10" fill="var(--nature-color)" opacity="0.22" />
		<circle cx="16" cy="16" r="10" stroke="var(--nature-color)" stroke-width="2.5" />
		<circle cx="12" cy="13" r="1.5" fill="var(--nature-color)" />
		<circle cx="20" cy="13" r="1.5" fill="var(--nature-color)" />
		<path d="M12 19h8" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" />
	{:else if id === 'hasty'}
		<path d="M16 22V6l-5 6M16 6l5 6" stroke="var(--nature-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.22" />
		<path d="M16 22V6l-5 6M16 6l5 6" stroke="var(--nature-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
		<path d="M8 24h16" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" opacity="0.5" />
	{:else if id === 'quirky'}
		<circle cx="16" cy="16" r="6" fill="var(--nature-color)" opacity="0.22" />
		<circle cx="16" cy="16" r="6" stroke="var(--nature-color)" stroke-width="2.5" />
		<path d="M16 6v3M16 23v3M6 16h3M23 16h3M9 9l2 2M21 21l2 2M9 23l2-2M21 11l2-2" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" opacity="0.5" />
	{:else if id === 'sassy'}
		<path d="M16 4l10 4v8c0 7-4 12-10 14-6-2-10-7-10-14V8z" fill="var(--nature-color)" opacity="0.22" />
		<path d="M16 4l10 4v8c0 7-4 12-10 14-6-2-10-7-10-14V8z" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
		<circle cx="16" cy="18" r="4" stroke="var(--nature-color)" stroke-width="2" fill="none" />
		<path d="M16 15v6M13 18h6" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" opacity="0.6" />
		<path d="M10 8l2 2M22 8l-2 2" stroke="var(--nature-color)" stroke-width="2" stroke-linecap="round" opacity="0.5" />
	{:else if id === 'modest'}
		<path d="M16 6l8 4v6c0 5-3 9-8 11-5-2-8-6-8-11V10z" fill="var(--nature-color)" opacity="0.22" />
		<path d="M16 6l8 4v6c0 5-3 9-8 11-5-2-8-6-8-11V10z" stroke="var(--nature-color)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
		<path d="M12 16h8M16 12v8" stroke="var(--nature-color)" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
	{/if}

	{#if locked}
		<g opacity="0.9">
			<rect x="13" y="17" width="6" height="5" rx="1" fill="none" stroke="#fff" stroke-width="2" />
			<path d="M13 19V17a3 3 0 0 1 6 0v2" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" />
			<circle cx="16" cy="21" r="1" fill="#fff" />
		</g>
	{/if}
</svg>

<style>
	.nature-active {
		color: var(--nature-color);
	}
	.nature-locked {
		filter: grayscale(1) brightness(0.6);
		color: #666;
	}
</style>
