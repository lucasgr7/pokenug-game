<script lang="ts">
	import type { CardKind } from '$lib/game/types';

	let {
		kind,
		color,
		size = 40
	}: { kind: CardKind; color: string; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 48 48"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	{#if kind === 'attack'}
		<!-- espada baseada no asset público, colorida pelo tema da carta -->
		<g transform="translate(5 5) scale(2)">
			<path
				d="M9.646 14.096a1 1 0 1 1-1.414 1.414l-1.414-1.414-2.828 2.829a1 1 0 0 1-1.415 1.414l-1.414-1.414a1 1 0 0 1 1.414-1.415l2.829-2.828-1.414-1.414a1 1 0 0 1 1.414-1.414l4.242 4.242zm.708-.707L6.11 9.146 14.596.661l3.536.707.707 3.536-8.485 8.485z"
				fill={color}
			/>
			<path
				d="M10.354 13.389L6.11 9.146 14.596.661"
				stroke="white"
				stroke-width="0.65"
				opacity="0.55"
			/>
		</g>
	{:else if kind === 'defense'}
		<!-- escudo -->
		<path
			d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z"
			fill={color}
			opacity="0.25"
		/>
		<path
			d="M24 6l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V11l14-5z"
			stroke={color}
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path d="M18 23l4 4 8-9" stroke={color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
	{:else if kind === 'heal'}
		<!-- coração com cruz -->
		<path
			d="M24 40S8 30 8 18a8 8 0 0114-5 8 8 0 0114 5c0 12-16 22-16 22z"
			fill={color}
			opacity="0.22"
		/>
		<path
			d="M24 40S8 30 8 18a8 8 0 0114-5 8 8 0 0114 5c0 12-16 22-16 22z"
			stroke={color}
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path d="M24 16v10M19 21h10" stroke={color} stroke-width="3" stroke-linecap="round" />
	{:else if kind === 'capture'}
		<!-- pokébola -->
		<circle cx="24" cy="24" r="16" fill="#fff" />
		<path d="M8 24a16 16 0 0132 0H8z" fill={color} />
		<path d="M8 24h32" stroke="#1c1917" stroke-width="3" />
		<circle cx="24" cy="24" r="5.5" fill="#fff" stroke="#1c1917" stroke-width="3" />
		<circle cx="24" cy="24" r="16" stroke="#1c1917" stroke-width="3" />
	{:else if kind === 'buff'}
		<!-- chevrons para cima + brilho -->
		<path
			d="M14 30l10-10 10 10"
			stroke={color}
			stroke-width="3.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M14 38l10-10 10 10"
			stroke={color}
			stroke-width="3.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.45"
		/>
		<path
			d="M24 6l1.5 4L30 11.5 25.5 13 24 17l-1.5-4L18 11.5 22.5 10 24 6z"
			fill={color}
		/>
	{/if}
</svg>
