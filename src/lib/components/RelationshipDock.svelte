<script lang="ts">
	import { relationshipState } from '$lib/game/relationship.svelte';
	import { ALERT_TIMER_MS, MAX_ACTIVE_EVENTS } from '$lib/game/relationship';
	import { game } from '$lib/game/state.svelte';
	import { now } from '$lib/utils/time';
	import { getSpriteUrl } from '$lib/api/sprites';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	// Hide the dock while on a conversation page — tapping another badge there
	// would swap the active event mid-interaction.
	const onRelationshipPage = $derived(page.url.pathname.startsWith('/relationship'));

	let spriteUrls = $state<Record<string, string>>({});

	$effect(() => {
		const events = relationshipState.events;
		for (const event of events) {
			if (!spriteUrls[event.pokemonId]) {
				const pokemon = game.roster.find((p) => p.id === event.pokemonId);
				if (pokemon) {
					getSpriteUrl(pokemon.speciesId).then((url) => {
						spriteUrls[event.pokemonId] = url;
					});
				}
			}
		}
	});

	function fractionRemaining(event: { createdAt: number; expiresAt: number }): number {
		const elapsed = now() - event.createdAt;
		return Math.max(0, 1 - elapsed / ALERT_TIMER_MS);
	}

	const RADIUS = 14;
	const STROKE = 3;
	const CIRC = 2 * Math.PI * RADIUS;
</script>

{#if relationshipState.events.length > 0 && !onRelationshipPage}
	<div
		class="relationship-dock"
		style="position: fixed; left: 8px; bottom: calc(env(safe-area-inset-bottom) + 72px); z-index: 50; display: flex; flex-direction: column; gap: 6px; pointer-events: none;"
	>
		{#each relationshipState.events as event (event.id)}
			<button
				class="dock-badge"
				style="position: relative; width: 40px; height: 40px; border-radius: 50%; background: var(--bg-1); border: 1px solid var(--line); cursor: pointer; pointer-events: auto; display: flex; align-items: center; justify-content: center; overflow: hidden; transition: transform 0.15s;"
				onclick={() => goto(`/relationship/${event.pokemonId}`)}
				title={event.promptPt}
			>
				<svg
					class="countdown-ring"
					width="40"
					height="40"
					viewBox="0 0 40 40"
					style="position: absolute; transform: rotate(-90deg);"
				>
					<circle
						cx="20" cy="20" r={RADIUS}
						fill="none"
						stroke="var(--line)"
						stroke-width={STROKE}
					/>
					<circle
						cx="20" cy="20" r={RADIUS}
						fill="none"
						stroke="var(--acc-2)"
						stroke-width={STROKE}
						stroke-dasharray={CIRC}
						stroke-dashoffset={CIRC * (1 - fractionRemaining(event))}
						stroke-linecap="round"
						style="transition: stroke-dashoffset 1s linear;"
					/>
				</svg>
				{#if spriteUrls[event.pokemonId]}
					<img
						src={spriteUrls[event.pokemonId]}
						alt=""
						style="width: 28px; height: 28px; object-fit: contain; border-radius: 50%; position: relative; z-index: 1;"
					/>
				{/if}
				<span class="attention-dot" style="position: absolute; top: 0; right: 0; width: 10px; height: 10px; background: #ef4444; border-radius: 50%; border: 2px solid var(--bg-1); z-index: 2; animation: pulse 1.5s ease-in-out infinite;"></span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.dock-badge:hover {
		transform: scale(1.12);
	}
	@keyframes pulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}
</style>
