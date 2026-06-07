<script lang="ts">
	import '../app.css';
	import '$lib/i18n';
	import favicon from '$lib/assets/favicon.svg';
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { game, initApp, addToRoster, applyElementalHpBonusToPokemon, type OfflineSummary } from '$lib/game/state.svelte';
	import { addPokemon } from '$lib/db/pokemon';
	import { fetchPokemon } from '$lib/api/pokeapi';
	import { ensurePokemonNatures } from '$lib/data/natures';
	import { now, formatDuration } from '$lib/utils/time';
	import { randomInt } from '$lib/utils/rng';
	import { startTicker, stopTicker } from '$lib/game/jobs.svelte';
	import { formatNumber } from '$lib/utils/math';
	import Toast from '$lib/components/Toast.svelte';
	import MusicController from '$lib/components/MusicController.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { _ } from 'svelte-i18n';
	import { waitLocale } from '$lib/i18n';

	let { children } = $props();

	let initialized = $state(false);
	let offline = $state<OfflineSummary | null>(null);

	onMount(async () => {
		injectAnalytics();
		await waitLocale();
		const res = await initApp();
		offline = res.offline;
		initialized = true;
		if (res.hasPlayer) startTicker();
		dismissSplash();
	});

	function dismissSplash() {
		const splash = document.getElementById('pokengu-splash');
		if (!splash) return;
		const bar = document.getElementById('pokengu-bar');
		if (typeof window.__splashBarStop === 'function') window.__splashBarStop();
		if (bar) { bar.style.transition = 'width 0.15s ease'; bar.style.width = '100%'; }
		setTimeout(() => {
			splash.style.opacity = '0';
			setTimeout(() => splash.remove(), 420);
		}, 180);
	}

	onDestroy(() => stopTicker());

	// Guarda de rota: sem player vai para onboarding; com player sai do onboarding.
	$effect(() => {
		if (!initialized) return;
		const path = page.url.pathname;
		if (!game.player && path !== '/onboarding') goto('/onboarding');
		else if (game.player && path === '/onboarding') goto('/');
	});

	let showNav = $derived(!!game.player && page.url.pathname !== '/onboarding');

	let offlineEntries = $derived(
		offline
			? Object.entries(offline.elementPoints).filter(([, v]) => (v ?? 0) >= 1)
			: []
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<Toast />
<MusicController />

<div id="app-shell" class="flex min-h-[100dvh] flex-col">
	<div class="flex min-h-0 flex-1 flex-col">
		{#if !initialized}
			<div class="flex flex-1 items-center justify-center">
				<div class="animate-pulse text-[var(--text-muted)]">Carregando…</div>
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>
	{#if showNav}
		<BottomNav />
	{/if}
</div>

<Modal open={!!offline} title={offline ? $_('layout.welcomeBack') : ''} onclose={() => (offline = null)}>
	{#if offline}
		<p class="mb-3 text-sm text-[var(--text-muted)]">
			{$_( 'layout.offlineEarnings', { values: { duration: formatDuration(offline.elapsedMs) } } )}
		</p>
		<ul class="space-y-1 text-sm">
			{#if offline.money >= 1}
				<li>+{@html $_( 'layout.moneyEarned', { values: { amount: formatNumber(offline.money) } } )}</li>
			{/if}
			{#each offlineEntries as [el, v] (el)}
				<li>+{@html $_( 'layout.pointsEarned', { values: { amount: formatNumber(v ?? 0), element: el } } )}</li>
			{/each}
		</ul>
		<button
			class="mt-4 w-full rounded-xl bg-[var(--accent)] py-2.5 font-semibold text-[var(--accent-text)]"
			onclick={() => (offline = null)}
		>
			{$_( 'layout.continue' )}
		</button>
	{/if}
</Modal>

<!-- 🛠 Dev debug menu (yarn dev only) -->
{#if import.meta.env.DEV}
	{@const addRandomPokemon = async () => {
		const speciesId = randomInt(1, 151);
		let data: { id: number; name: string; element: import('$lib/game/types').Element; maxHp: number };
		try {
			data = await fetchPokemon(speciesId);
		} catch {
			data = { id: speciesId, name: `#${speciesId}`, element: 'normal' as import('$lib/game/types').Element, maxHp: 40 };
		}
		const pkm: import('$lib/game/types').CapturedPokemon = {
			id: crypto.randomUUID(),
			speciesId: data.id,
			name: data.name,
			element: data.element,
			maxHp: data.maxHp,
			currentHp: data.maxHp,
			capturedAt: now()
		};
		ensurePokemonNatures(pkm);
		applyElementalHpBonusToPokemon(pkm);
		await addPokemon(pkm);
		addToRoster(pkm);
	}}
	<div class="debug-menu">
		<button class="debug-btn" onclick={addRandomPokemon}>+ Pokémon</button>
	</div>
{/if}
