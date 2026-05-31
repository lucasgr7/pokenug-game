<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const items = [
		{ href: '/', label: 'Mapa', icon: '🗺️' },
		{ href: '/jobs', label: 'Jobs', icon: '⛏️' },
		{ href: '/deck', label: 'Deck', icon: '🃏' },
		{ href: '/catalog', label: 'Cartas', icon: '📖' },
		{ href: '/shop', label: 'Loja', icon: '🛒' }
	];

	let current = $derived(page.url.pathname);
</script>

<nav
	class="sticky bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--surface)]"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	{#each items as item (item.href)}
		<button
			class="flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors"
			class:text-[var(--accent)]={current === item.href}
			class:text-[var(--text-muted)]={current !== item.href}
			onclick={() => goto(item.href)}
		>
			<span class="text-xl">{item.icon}</span>
			{item.label}
		</button>
	{/each}
</nav>
