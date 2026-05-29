<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts, dismissToast } from '$lib/stores/toast.svelte';

	const color: Record<string, string> = {
		info: 'var(--accent)',
		success: 'var(--success)',
		error: 'var(--danger)'
	};
</script>

<div class="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
	{#each toasts.list as t (t.id)}
		<button
			class="pointer-events-auto w-full max-w-[420px] rounded-xl px-4 py-3 text-left text-sm font-medium text-white shadow-lg"
			style="background: {color[t.kind]};"
			transition:fly={{ y: -20, duration: 220 }}
			onclick={() => dismissToast(t.id)}
		>
			{t.message}
		</button>
	{/each}
</div>
