<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { game, initApp, type OfflineSummary } from '$lib/game/state.svelte';
	import { startTicker, stopTicker } from '$lib/game/jobs.svelte';
	import { formatNumber } from '$lib/utils/math';
	import { formatDuration } from '$lib/utils/time';
	import Toast from '$lib/components/Toast.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { children } = $props();

	let initialized = $state(false);
	let offline = $state<OfflineSummary | null>(null);

	onMount(async () => {
		const res = await initApp();
		offline = res.offline;
		initialized = true;
		if (res.hasPlayer) startTicker();
	});

	onDestroy(() => stopTicker());

	// Guarda de rota: sem player vai para onboarding; com player sai do onboarding.
	$effect(() => {
		if (!initialized) return;
		const path = page.url.pathname;
		if (!game.player && path !== '/onboarding') goto('/onboarding');
		else if (game.player && path === '/onboarding') goto('/');
	});

	let showNav = $derived(
		!!game.player && !['/onboarding', '/battle'].includes(page.url.pathname)
	);

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

<div id="app-shell" class="flex flex-col">
	<div class="flex-1">
		{#if !initialized}
			<div class="flex min-h-[100dvh] items-center justify-center">
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

<Modal open={!!offline} title="Bem-vindo de volta!" onclose={() => (offline = null)}>
	{#if offline}
		<p class="mb-3 text-sm text-[var(--text-muted)]">
			Você ficou fora por {formatDuration(offline.elapsedMs)}. Enquanto isso, seus pokémons
			trabalharam:
		</p>
		<ul class="space-y-1 text-sm">
			{#if offline.money >= 1}
				<li>💰 <strong>{formatNumber(offline.money)}</strong> de dinheiro</li>
			{/if}
			{#each offlineEntries as [el, v] (el)}
				<li>✨ <strong>{formatNumber(v ?? 0)}</strong> pontos de {el}</li>
			{/each}
		</ul>
		<button
			class="mt-4 w-full rounded-xl bg-[var(--accent)] py-2.5 font-semibold text-[var(--accent-text)]"
			onclick={() => (offline = null)}
		>
			Continuar
		</button>
	{/if}
</Modal>
