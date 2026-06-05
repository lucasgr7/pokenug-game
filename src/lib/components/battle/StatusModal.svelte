<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import type { StatusEntry } from './status-entry';

	let { entry, onclose }: { entry: StatusEntry | null; onclose: () => void } = $props();
</script>

<Modal open={entry !== null} title={entry ? `${entry.icon} ${entry.label}` : ''} {onclose}>
	{#if entry}
		<div class="rounded-lg border border-(--border)/50 p-3">
			<div class="mb-2 flex items-center gap-2">
				<span class="text-xl">{entry.icon}</span>
				<span class="text-sm font-bold" style="color:{entry.color}">{entry.label}</span>
			</div>
			<p class="text-sm text-(--text-muted)">{entry.description}</p>
			<p class="mt-1.5 text-[10px] text-(--text-muted)/60">{entry.scope} · {entry.decay}</p>
		</div>
	{/if}
</Modal>
