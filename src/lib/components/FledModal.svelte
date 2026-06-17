<script lang="ts">
	import { onMount } from 'svelte';
	import { getAllFled, removeFled } from '$lib/db/fled';
	import type { FledPokemon } from '$lib/game/types';
	import Sprite from './Sprite.svelte';

	let fled = $state<FledPokemon[]>([]);
	let show = $state(false);

	onMount(async () => {
		const all = await getAllFled();
		if (all.length > 0) {
			fled = all;
			show = true;
		}
	});

	function dismiss() {
		show = false;
	}

	function onBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') dismiss();
	}
</script>

{#if show && fled.length > 0}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="fled-backdrop" role="dialog" tabindex="-1" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px;" onclick={dismiss} onkeydown={onBackdropKeydown}>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="fled-modal" role="document" style="background: var(--bg-0); border: 1px solid var(--line); border-radius: 16px; padding: 24px; max-width: 340px; width: 100%;" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<h2 style="font-size: 18px; font-weight: 700; margin-bottom: 12px; color: var(--txt-main);">
				{fled.length === 1 ? '1 Pokémon se exauriu e fugiu' : `${fled.length} Pokémon se exauriram e fugiram`}
			</h2>
			<div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; max-height: 200px; overflow-y: auto;">
				{#each fled as f (f.id)}
					<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; background: var(--bg-1); border-radius: 12px; min-width: 72px;">
						<Sprite speciesId={f.speciesId} size={48} alt={f.name} />
						<span style="font-size: 11px; font-weight: 600; color: var(--txt-dim); text-align: center;">{f.name}</span>
					</div>
				{/each}
			</div>
			<button
				style="width: 100%; padding: 10px; background: var(--accent); border: none; border-radius: 12px; color: var(--accent-text); font-weight: 600; font-size: 14px; cursor: pointer;"
				onclick={dismiss}
			>
				Entendi
			</button>
		</div>
	</div>
{/if}
