<script lang="ts">
	import { onMount } from 'svelte';
	import { game, setTheme, getPlatinum } from '$lib/game/state.svelte';
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
	let platinum = $derived(getPlatinum());

	function toggleTheme() {
		setTheme(game.player?.theme === 'dark' ? 'light' : 'dark');
	}

	let installPrompt = $state<Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
	let installed = $state(false);

	onMount(() => {
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			installPrompt = e as typeof installPrompt;
		});
		window.addEventListener('appinstalled', () => {
			installPrompt = null;
			installed = true;
		});
	});

	async function installPwa() {
		if (!installPrompt) return;
		await installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		if (outcome === 'accepted') installPrompt = null;
	}
</script>

<header
	class="hud-root sticky top-0 z-20 flex items-center gap-2 px-4 py-2.5 backdrop-blur"
>
	<div class="min-w-0 flex-1">
		<div class="truncate text-sm font-bold">{game.player?.name ?? '—'}</div>
		<div class="flex flex-wrap items-center gap-1.5 text-xs">
			<span class="hud-money font-semibold">💰 {formatNumber(game.player?.money ?? 0)}</span>
			<span class="hud-chip hud-platinum">⬡ {formatNumber(platinum)}</span>
			{#each elementChips as [el, v] (el)}
				<span class="hud-chip">
					{elementEmoji[el as Element] ?? ''} {formatNumber(v ?? 0)}
				</span>
			{/each}
		</div>
	</div>
	{#if installPrompt && !installed}
		<button
			class="rounded-lg px-2 py-1 text-lg hover:bg-(--surface-2)"
			onclick={installPwa}
			aria-label="Instalar aplicativo"
			title="Instalar app"
		>
			📲
		</button>
	{/if}
	<button
		class="rounded-lg px-2 py-1 text-lg hover:opacity-75"
		onclick={toggleTheme}
		aria-label="Alternar tema"
	>
		{game.player?.theme === 'dark' ? '🌙' : '☀️'}
	</button>
</header>

<style>
	.hud-root {
		background: color-mix(in srgb, var(--bg-0, #0b0b10) 95%, transparent);
		border-bottom: 1px solid var(--line, #2b2c38);
	}
	.hud-money {
		color: var(--cta, #ffc24a);
	}
	.hud-chip {
		border-radius: 9999px;
		background: var(--bg-2, #181821);
		border: 1px solid var(--line, #2b2c38);
		padding: 2px 8px;
		color: var(--txt-dim, #9a9bab);
	}
	.hud-platinum {
		color: #a78bfa;
		border-color: #a78bfa44;
		background: #a78bfa11;
	}
</style>
