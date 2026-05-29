<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	let {
		open = false,
		title = '',
		closable = true,
		onclose,
		children
	}: {
		open?: boolean;
		title?: string;
		closable?: boolean;
		onclose?: () => void;
		children: Snippet;
	} = $props();

	function backdropClick() {
		if (closable) onclose?.();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="absolute inset-0 bg-black/60"
			onclick={backdropClick}
			role="presentation"
		></div>
		<div
			class="relative z-10 m-3 w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
			transition:scale={{ duration: 200, start: 0.92 }}
		>
			{#if title}
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-lg font-bold">{title}</h2>
					{#if closable}
						<button
							class="rounded-lg px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
							onclick={() => onclose?.()}
							aria-label="Fechar">✕</button
						>
					{/if}
				</div>
			{/if}
			{@render children()}
		</div>
	</div>
{/if}
