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

<section class="log-section" aria-live="polite">
	{#each logs.slice(-2) as log (log.id)}
		<div class="log-line">
			{#each log.line as part}
				<span style={part.color ? `color:${part.color}` : 'color:var(--txt-dim)'}>{part.text}</span>
			{/each}
		</div>
	{/each}
	{#if logs.length === 0}
		<div class="log-line log-empty">{emptyLabel}</div>
	{/if}
</section>

<style>
	.log-section {
		position: relative;
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		padding: 6px 12px 8px;
		min-height: 54px;
		pointer-events: none;
	}
	.log-line {
		display: inline-block;
		font-size: 12px;
		font-weight: 600;
		color: var(--txt-dim, #9a9bab);
		background: rgba(10, 10, 14, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 999px;
		padding: 5px 14px;
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		animation: logIn 0.4s ease forwards;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.log-empty {
		color: var(--txt-mute, #6b6c7e);
		background: transparent;
		border-color: transparent;
		backdrop-filter: none;
	}
	@keyframes logIn {
		from { opacity: 0; transform: translateY(6px); }
		to   { opacity: 1; transform: translateY(0);   }
	}
</style>