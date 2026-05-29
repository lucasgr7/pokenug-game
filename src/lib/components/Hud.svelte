<script lang="ts">
	import { game, setTheme } from '$lib/game/state.svelte';
	import { formatNumber } from '$lib/utils/math';
	import type { Element } from '$lib/game/types';

	const elementEmoji: Partial<Record<Element, string>> = {
		fire: '🔥',
		water: '💧',
		grass: '🌿',
		electric: '⚡',
		psychic: '🔮',
		rock: '🪨',
		ground: '⛰️',
		fighting: '🥊',
		ice: '❄️',
		bug: '🐛',
		poison: '☠️',
		ghost: '👻',
		flying: '🪶',
		dragon: '🐉',
		normal: '⭐'
	};

	let elementChips = $derived(
		Object.entries(game.player?.elementPoints ?? {})
			.filter(([, v]) => (v ?? 0) >= 1)
			.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
	);

	function toggleTheme() {
		setTheme(game.player?.theme === 'dark' ? 'light' : 'dark');
	}
</script>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 backdrop-blur"
>
	<div class="min-w-0 flex-1">
		<div class="truncate text-sm font-bold">{game.player?.name ?? '—'}</div>
		<div class="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
			<span class="font-semibold text-[var(--text)]">💰 {formatNumber(game.player?.money ?? 0)}</span>
			{#each elementChips as [el, v] (el)}
				<span class="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5">
					{elementEmoji[el as Element] ?? ''} {formatNumber(v ?? 0)}
				</span>
			{/each}
		</div>
	</div>
	<button
		class="rounded-lg px-2 py-1 text-lg hover:bg-[var(--surface-2)]"
		onclick={toggleTheme}
		aria-label="Alternar tema"
	>
		{game.player?.theme === 'dark' ? '🌙' : '☀️'}
	</button>
</header>
