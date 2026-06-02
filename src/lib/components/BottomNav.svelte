<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const items = [
		{ href: '/', label: 'Mapa' },
		{ href: '/jobs', label: 'Jobs' },
		{ href: '/deck', label: 'Deck' },
		{ href: '/market', label: 'Mercado' },
		{ href: '/shop', label: 'Loja' }
	];

	let current = $derived(page.url.pathname);
</script>

<nav
	class="nav-bar sticky bottom-0 z-30 grid grid-cols-5"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	{#each items as item (item.href)}
		<button
			class="nav-item flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors"
			class:active={current === item.href}
			onclick={() => goto(item.href)}
		>
			{#if item.href === '/'}
				<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" />
				</svg>
			{:else if item.href === '/jobs'}
				<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M14 3l7 7-3 3-7-7zM11 6 4 13l-1 8 8-1 7-7" />
				</svg>
			{:else if item.href === '/deck'}
				<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6M9 11h6" />
				</svg>
			{:else if item.href === '/market'}
				<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M4 19V5M4 15l5-5 4 3 7-8" /><path d="M16 5h4v4" />
				</svg>
			{:else if item.href === '/shop'}
				<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M5 7h15l-1.5 9H7L5 7zM5 7 4 3H2" /><circle cx="8" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" />
				</svg>
			{/if}
			{item.label}
		</button>
	{/each}
	<div class="gesture-bar" aria-hidden="true"></div>
</nav>

<style>
	.nav-bar {
		background: linear-gradient(180deg, var(--bg-1), var(--bg-0));
		border-top: 1px solid var(--line);
		position: relative;
	}

	.nav-item {
		color: var(--txt-mute);
		letter-spacing: 0.3px;
	}
	.nav-item:hover {
		color: var(--txt-dim);
	}
	.nav-item.active {
		color: var(--acc-2);
	}
	.nav-item.active svg {
		filter: drop-shadow(0 0 6px color-mix(in srgb, var(--acc) 60%, transparent));
	}

	.gesture-bar {
		position: absolute;
		left: 50%;
		bottom: 5px;
		transform: translateX(-50%);
		width: 128px;
		height: 4.5px;
		border-radius: 3px;
		background: var(--line);
	}
</style>
