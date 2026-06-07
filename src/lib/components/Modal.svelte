<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import { _ } from 'svelte-i18n';

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

	let previousBodyOverflow = '';
	let previousBodyPaddingRight = '';

	function backdropClick() {
		if (closable) onclose?.();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!open || !closable || event.key !== 'Escape') return;
		event.preventDefault();
		onclose?.();
	}

	$effect(() => {
		if (!open) return;

		previousBodyOverflow = document.body.style.overflow;
		previousBodyPaddingRight = document.body.style.paddingRight;

		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

		document.body.style.overflow = 'hidden';
		document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : previousBodyPaddingRight;

		return () => {
			document.body.style.overflow = previousBodyOverflow;
			document.body.style.paddingRight = previousBodyPaddingRight;
		};
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="absolute inset-0 bg-black/70 backdrop-blur-sm"
			onclick={backdropClick}
			role="presentation"
		></div>
		<div
			class="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-(--border) bg-(--surface) shadow-2xl"
			style="max-height: calc(100dvh - 1.5rem);"
			transition:scale={{ duration: 200, start: 0.92 }}
		>
			{#if title}
				<div class="flex items-center justify-between border-b border-(--border) px-5 py-4">
					<h2 class="text-lg font-bold">{title}</h2>
					{#if closable}
						<button
							type="button"
							class="rounded-xl px-2 py-1 text-(--text-muted) transition hover:bg-(--surface-2) hover:text-(--text)"
							onclick={() => onclose?.()}
							aria-label={$_('modal.fechar')}>✕</button
						>
					{/if}
				</div>
			{/if}
			<div class="min-h-0 overflow-y-auto p-5">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
