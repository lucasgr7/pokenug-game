<script lang="ts">
	import HpBar from '$lib/components/HpBar.svelte';
	import ManaCrystal from '$lib/components/ManaCrystal.svelte';
	import StatusModal from './StatusModal.svelte';
	import { buildEntry } from './status-entry';
	import type { BattleState, ActiveStatus } from '$lib/game/types';

	let { s, hpReveal = true }: { s: BattleState; hpReveal?: boolean } = $props();
	let selected = $state<ActiveStatus | null>(null);
</script>

<div class="absolute bottom-2 right-2 z-10 w-[58%] max-w-65">
	<div class="rounded-xl border border-(--border) bg-(--surface)/85 p-2 shadow-lg backdrop-blur">
		<div class="mb-1 flex items-center justify-between gap-1">
			<span class="truncate text-xs font-bold">{s.player.pokemon.name}</span>
			<div class="flex items-center gap-1">
				<ManaCrystal mana={s.player.mana} max={s.player.maxMana} />
			</div>
		</div>
		<HpBar hp={hpReveal ? s.player.hp : 0} maxHp={s.player.pokemon.maxHp} block={s.player.block} />
		{#if s.player.statuses.length > 0}
			<div class="mt-1.5 flex flex-wrap gap-1">
				{#each s.player.statuses as st (st.defId)}
					{@const entry = buildEntry(s.player, st, s)}
					{#if entry}
						<button
							class="cursor-pointer rounded-full px-1.5 py-0.5 text-[9px] font-black transition-opacity hover:opacity-80"
							style="color:{entry.color};background:{entry.bg}"
							onclick={() => (selected = st)}
						>{entry.icon} {entry.label}</button>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

<StatusModal entry={selected ? buildEntry(s.player, selected, s) : null} onclose={() => (selected = null)} />
