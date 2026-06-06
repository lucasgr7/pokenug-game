<script lang="ts">
	import HpBar from '$lib/components/HpBar.svelte';
	import TypeAdvantageAlert from '$lib/components/TypeAdvantageAlert.svelte';
	import StatusModal from './StatusModal.svelte';
	import { buildEntry } from './status-entry';
	import { ELEMENT_EMOJI } from '$lib/game/elements';
	import { getElementInteraction } from '$lib/game/type-chart';
	import type { BattleState, ActiveStatus } from '$lib/game/types';

	let { s, hpReveal = true }: { s: BattleState; hpReveal?: boolean } = $props();
	let selected = $state<ActiveStatus | null>(null);

	function intentText(): string {
		const it = s.enemy.intent;
		if (it.kind === 'attack') {
			const attackElement = it.element ?? s.enemy.pokemon.element;
			if (s.mode === 'missingno') return `${ELEMENT_EMOJI[attackElement]} ⚔️ ???`;
			const interaction = getElementInteraction(attackElement, s.player.pokemon.element);
			const projectedDamage = Math.max(0, Math.round((it.damage + s.enemy.nextDamageBonus) * interaction.multiplier));
			return `${ELEMENT_EMOJI[attackElement]} ⚔️ ${projectedDamage}`;
		}
		if (it.kind === 'defend') return `🛡️ ${it.block}`;
		return `✨ +${it.nextDamage}`;
	}
</script>

<div class="absolute left-2 top-2 z-10 w-[58%] max-w-65">
	<div class="rounded-xl border border-(--border) bg-(--surface)/85 p-2 shadow-lg backdrop-blur">
		<div class="mb-1 flex items-center justify-between gap-1">
			<span class="truncate text-xs font-bold">{s.enemy.pokemon.name}</span>
			<span class="shrink-0 text-[10px] text-(--text-muted)">{ELEMENT_EMOJI[s.enemy.pokemon.element]}</span>
		</div>
		<HpBar hp={hpReveal ? s.enemy.hp : 0} maxHp={s.enemy.pokemon.maxHp} block={s.enemy.block} />
		<div class="mt-1 flex items-center gap-1 text-[11px] font-bold text-(--danger)">
			<span class="rounded bg-(--danger)/15 px-1.5 py-0.5">Intenção {intentText()}</span>
		</div>
		<TypeAdvantageAlert attacker={s.enemy.pokemon.element} defender={s.player.pokemon.element} />
		{#if s.enemy.statuses.length > 0}
			<div class="mt-1.5 flex flex-wrap gap-1">
				{#each s.enemy.statuses as st (st.defId)}
					{@const entry = buildEntry(s.enemy, st, s)}
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

<StatusModal entry={selected ? buildEntry(s.enemy, selected, s) : null} onclose={() => (selected = null)} />
