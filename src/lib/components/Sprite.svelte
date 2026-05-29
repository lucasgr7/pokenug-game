<script lang="ts">
	import { getSpriteUrl } from '$lib/api/sprites';

	let {
		speciesId,
		size = 96,
		alt = ''
	}: { speciesId: number; size?: number; alt?: string } = $props();

	let url = $state<string | null>(null);
	let loading = $state(true);
	let failed = $state(false);

	// Object URLs são cacheados por sessão em sprites.ts e compartilhados entre
	// componentes, então NÃO são revogados aqui.
	$effect(() => {
		const id = speciesId;
		loading = true;
		failed = false;
		url = null;
		let cancelled = false;
		getSpriteUrl(id)
			.then((u) => {
				if (!cancelled) {
					url = u;
					loading = false;
				}
			})
			.catch(() => {
				if (!cancelled) {
					failed = true;
					loading = false;
				}
			});
		return () => {
			cancelled = true;
		};
	});
</script>

<div
	class="relative inline-flex items-center justify-center overflow-hidden"
	style="width: {size}px; height: {size}px;"
>
	{#if loading}
		<div
			class="h-full w-full animate-pulse rounded-xl bg-[var(--surface-2)]"
			aria-hidden="true"
		></div>
	{:else if failed}
		<div
			class="flex h-full w-full items-center justify-center rounded-xl bg-[var(--surface-2)] text-2xl"
			aria-hidden="true"
		>
			❓
		</div>
	{:else if url}
		<img
			src={url}
			{alt}
			loading="lazy"
			width={size}
			height={size}
			class="sprite-fade h-full w-full object-contain"
			style="image-rendering: auto;"
		/>
	{/if}
</div>

<style>
	.sprite-fade {
		animation: fade-in 250ms ease-out;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
