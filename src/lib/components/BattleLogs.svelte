<script lang="ts">
	import type { BattleLogEntry } from '$lib/game/battle-log';

	let {
		logs = [],
		emptyLabel = 'Início da batalha...'
	}: {
		logs?: BattleLogEntry[];
		emptyLabel?: string;
	} = $props();
</script>

<section class="relative z-20 flex h-13.5 flex-col justify-end overflow-hidden border-t border-(--border) bg-(--surface-overlay) px-4 pb-1.5 shadow-inner">
	<div class="flex w-full flex-col items-center justify-end" aria-live="polite">
		{#each logs.slice(-2) as log (log.id)}
			<div class="animate-fade-in-up h-4.5 w-full truncate text-center text-[11.5px] font-bold">
				{#each log.line as part}
					<span style={part.color ? `color:${part.color}` : 'color:var(--text-muted)'}>{part.text}</span>
				{/each}
			</div>
		{/each}
		{#if logs.length === 0}
			<div class="h-4.5 w-full text-center text-[11.5px] font-bold text-(--text-muted)/50">
				{emptyLabel}
			</div>
		{/if}
	</div>
</section>

<style>
	@keyframes fade-in-up {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in-up {
		animation: fade-in-up 250ms ease-out forwards;
	}
</style>