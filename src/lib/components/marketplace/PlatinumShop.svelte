<script lang="ts">
	import { ELEMENTS, type Element } from '$lib/game/types';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import {
		buyElementPack,
		buyPlatinumPokemon,
		PLATINUM_POKEMON,
		PLATINUM_PACK_COST,
		PLATINUM_PACK_SIZE
	} from '$lib/game/market.svelte';
	import { getPlatinum } from '$lib/game/state.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { formatNumber } from '$lib/utils/math';

	let busy = $state(false);
	let selectedElement = $state<Element>('fire');

	let platinum = $derived(getPlatinum());

	async function handleBuyPack() {
		if (busy) return;
		busy = true;
		try {
			const result = await buyElementPack(selectedElement);
			if (result.success && result.cards) {
				const names = result.cards.map((c) => c.name).join(', ');
				pushToast(`${result.message} (${names})`, 'success');
			} else {
				pushToast(result.message, 'error');
			}
		} finally {
			busy = false;
		}
	}

	async function handleBuyPokemon(speciesId: number) {
		if (busy) return;
		busy = true;
		try {
			const result = await buyPlatinumPokemon(speciesId);
			pushToast(result.message, result.success ? 'success' : 'error');
		} finally {
			busy = false;
		}
	}
</script>

<div class="space-y-4">
	<div class="flex items-center gap-2 text-sm font-bold">
		<span class="text-[var(--text-muted)]">Saldo:</span>
		<span class="text-[#a78bfa]">⬡ {formatNumber(platinum)}</span>
	</div>

	<!-- Element packs -->
	<div>
		<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-2">
			Pacotes por Elemento ({PLATINUM_PACK_COST}⬡ · {PLATINUM_PACK_SIZE} cartas)
		</p>
		<div class="grid grid-cols-5 gap-1.5 mb-3">
			{#each ELEMENTS as el (el)}
				<button
					onclick={() => (selectedElement = el)}
					class="flex items-center justify-center py-1.5 rounded-lg border-2 transition-all text-sm"
					style={el === selectedElement
						? `background: ${ELEMENT_COLOR[el]}22; border-color: ${ELEMENT_COLOR[el]}88;`
						: `border-color: var(--border);`}
				>
					{ELEMENT_EMOJI[el]}
				</button>
			{/each}
		</div>
		<button
			onclick={handleBuyPack}
			disabled={busy || platinum < PLATINUM_PACK_COST}
			class="w-full rounded-xl py-2.5 font-black text-sm border-2 transition-all disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
			style="background: #a78bfa22; border-color: #a78bfa55; color: #a78bfa;"
		>
			Comprar pacote de {ELEMENT_LABEL[selectedElement]} (⬡{PLATINUM_PACK_COST})
		</button>
	</div>

	<!-- Exclusive Pokémon -->
	<!-- <div>
		<p class="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-2">
			Pokémon Exclusivos
		</p>
		<div class="space-y-2">
			{#each PLATINUM_POKEMON as pk (pk.speciesId)}
				<div
					class="flex items-center justify-between rounded-xl p-3 border border-[var(--border)] bg-[var(--surface)]"
				>
					<div>
						<span class="font-black text-sm">{pk.name}</span>
						<span class="text-xs ml-1" style="color: {ELEMENT_COLOR[pk.element]};">
							{ELEMENT_EMOJI[pk.element]} {ELEMENT_LABEL[pk.element]}
						</span>
					</div>
					<button
						onclick={() => handleBuyPokemon(pk.speciesId)}
						disabled={busy || platinum < pk.cost}
						class="px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
						style="background: #a78bfa22; border-color: #a78bfa55; color: #a78bfa;"
					>
						Capturar (⬡{pk.cost})
					</button>
				</div>
			{/each}
		</div>
	</div> -->
</div>
