<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Modal from './Modal.svelte';
	import Sprite from './Sprite.svelte';
	import NatureIcon from './NatureIcon.svelte';
	import CorruptedBadge from './CorruptedBadge.svelte';
	import { game, normalizedPokemonHp, setActivePokemon } from '$lib/game/state.svelte';
	import { assignJob, stopJob, jobForPokemon, jobsState, isOnJobCooldown, jobCooldownRemainingMs } from '$lib/game/jobs.svelte';
	import { UNLOCK_THRESHOLDS } from '$lib/game/relationship';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { capacityMs } from '$lib/game/exhaustion';
	import type { CapturedPokemon, PokemonMemory } from '$lib/game/types';

	let {
		selected,
		onclose
	}: {
		selected: CapturedPokemon | null;
		onclose: () => void;
	} = $props();

	function hpPercent(pokemon: CapturedPokemon): number {
		return pokemon.maxHp > 0 ? (normalizedPokemonHp(pokemon) / pokemon.maxHp) * 100 : 0;
	}

	function exhaustionPercent(p: CapturedPokemon): number {
		if (!p.work) return 100;
		const cap = capacityMs(p);
		return cap > 0 ? (p.work.exhaustionRemainingMs / cap) * 100 : 0;
	}

	function ragePercent(p: CapturedPokemon): number {
		if (!p.work || p.work.phase !== 'rage') return 0;
		const cap = capacityMs(p);
		return cap > 0 ? (p.work.rageRemainingMs / cap) * 100 : 0;
	}

	let cdRemaining = $state(0);

	$effect(() => {
		if (!selected) { cdRemaining = 0; return; }
		const id = setInterval(() => {
			cdRemaining = jobCooldownRemainingMs(selected.id);
		}, 1000);
		cdRemaining = jobCooldownRemainingMs(selected.id);
		return () => clearInterval(id);
	});

	async function choose(type: 'money') {
		if (!selected) return;
		await assignJob(selected.id, type);
		pushToast(`💼 ${selected.name} foi trabalhar`, 'success');
		onclose();
	}

	function chooseAsMain() {
		if (!selected) return;
		if (normalizedPokemonHp(selected) <= 0) {
			pushToast(`💀 ${selected.name} está debilitado!`, 'error');
			return;
		}
		setActivePokemon(selected.id);
		pushToast(`⭐ ${selected.name} é agora o líder`, 'success');
		onclose();
	}

	async function sendToRest() {
		if (!selected) return;
		await stopJob(selected.id);
		pushToast(`😴 ${selected.name} foi descansar`, 'info');
		onclose();
	}
</script>

<Modal open={!!selected} title="" onclose={onclose} closable={true}>
	{#if selected}
		{@const elColor = ELEMENT_COLOR[selected.element]}
		{@const elEmoji = ELEMENT_EMOJI[selected.element]}
		{@const elLabel = ELEMENT_LABEL[selected.element]}
		{@const isMain = game.player?.activePokemonId === selected.id}
		{@const rel = selected.relationship}
		{@const memories: PokemonMemory[] = rel?.memories?.slice(-3) ?? []}
		{@const onJob = !!jobForPokemon(selected.id)}
		{@const nxt = rel ? UNLOCK_THRESHOLDS.find((t) => t > rel.points) : undefined}

		<div
			class="relative -mx-5 -mt-5 overflow-hidden px-5 pt-5 pb-3"
			style="background: linear-gradient(180deg, {elColor}18, transparent 70%);"
		>
			<div class="pointer-events-none absolute inset-0 opacity-[0.03]" style="background: radial-gradient(ellipse at 70% 0%, {elColor} 0%, transparent 60%);"></div>

			<div class="relative flex items-start justify-between gap-3">
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<h2 class="truncate text-lg font-extrabold tracking-tight">{selected.name}</h2>
						{#if selected.corrupted}<CorruptedBadge size={14} />{/if}
					</div>
					<div class="mt-0.5 flex flex-wrap items-center gap-1">
						<span
							class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
							style="background: {elColor}22; color: {elColor};"
						>{elEmoji} {elLabel}</span>
						{#if isMain}
							<span class="rounded-full bg-(--accent)/15 px-1.5 py-0.5 text-[8px] font-bold text-(--accent)">Líder</span>
						{/if}
					</div>
				</div>
				<div class="shrink-0 -mr-2 -mt-1">
					<Sprite speciesId={selected.speciesId} size={64} alt={selected.name} />
				</div>
			</div>

			{#if selected.natures}
				<div class="mt-2 flex gap-1.5">
					{#each [0, 1, 2] as i}
						{@const nid = selected.natures.assigned[i]}
						{@const unlocked = selected.natures.unlocked[i]}
						<span
							class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold"
							class:opacity-30={!unlocked}
							style="background: {unlocked ? '#22c55e18' : 'var(--surface-2)'}; color: {unlocked ? '#22c55e' : 'var(--text-muted)'};"
						>
							<NatureIcon id={nid} locked={!unlocked} size={11} />
							{$_('natures.' + nid + '.name')}
						</span>
					{/each}
				</div>
			{/if}

			<div class="mt-2">
				<div class="flex items-center justify-between text-[8px] text-(--text-muted)">
					<span>HP</span>
					<span>{Math.ceil(normalizedPokemonHp(selected))}/{selected.maxHp}</span>
				</div>
				<div class="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-(--surface-2)">
					<div
						class="h-full rounded-full transition-[width] duration-500"
						style="width: {hpPercent(selected)}%; background: linear-gradient(90deg, #22c55e, #4ade80);"
					></div>
				</div>
			</div>

			{#if onJob && selected.work}
				<div class="mt-1.5">
					<div class="flex items-center justify-between text-[8px] text-(--text-muted)">
						<span class="flex items-center gap-1">
							{selected.work.phase === 'rage' ? '⚠' : ''} {selected.work.phase === 'rage' ? 'Fúria' : 'Exaustão'}
						</span>
						<span>{Math.round(selected.work.phase === 'rage' ? ragePercent(selected) : exhaustionPercent(selected))}%</span>
					</div>
					<div class="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-(--surface-2)">
						<div
							class="h-full rounded-full transition-[width] duration-500"
							style="width: {selected.work.phase === 'rage' ? ragePercent(selected) : exhaustionPercent(selected)}%; background: {selected.work.phase === 'rage' ? '#ef4444' : 'linear-gradient(90deg, #6366f1, #8b5cf6)'};"
						></div>
					</div>
				</div>
			{/if}

			<div class="mt-1.5 flex items-center gap-2">
				<span class="text-[10px]">❤️</span>
				<div class="flex-1">
					<div style="display: flex; gap: 2px;">
						{#each UNLOCK_THRESHOLDS as th, i}
							<div
								class="h-1 flex-1 rounded-full"
								style="background: {rel && rel.points >= th ? '#22c55e' : 'var(--surface-2)'};"
							></div>
						{/each}
					</div>
					<div class="mt-0.5 text-[8px] text-(--text-muted)">
						{rel?.points ?? 0} pts {#if nxt}· {rel!.points}/{nxt}{:else if rel}· Completo!{/if}
					</div>
				</div>
			</div>
		</div>

		{#if memories.length > 0}
			<div class="mb-3 space-y-1.5">
				{#each memories as mem (mem.at)}
					<div
						class="flex items-start gap-2 rounded-lg px-3 py-2"
						style="background: var(--surface-2);"
					>
						<span class="mt-0.5 text-sm">{mem.emoji || '💬'}</span>
						<div class="min-w-0 flex-1">
							<div class="truncate text-[10px] text-(--text-muted)">{mem.playerMessage || '(automático)'}</div>
							<div class="mt-0.5 flex items-center gap-1.5 text-[8px] text-(--text-muted)">
								<span
									class="font-bold capitalize"
									style="color: {mem.sentiment === 'good' ? '#22c55e' : mem.sentiment === 'bad' ? '#ef4444' : 'var(--text-muted)'};"
								>{mem.sentiment}</span>
								<span>·</span>
								<span>{new Date(mem.at).toLocaleDateString('pt-BR')}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{@const onCd = cdRemaining > 0}
		{#if onCd && !onJob}
			<div class="mb-3 flex items-center gap-2 rounded-lg px-3 py-2" style="background: #f59e0b15; border: 1px solid #f59e0b33;">
				<span style="font-size: 14px;">😴</span>
				<div class="flex-1">
					<div class="text-[11px] font-bold" style="color: #f59e0b;">Descansando</div>
					<div class="text-[9px]" style="color: #f59e0b99;">⏳ {Math.ceil(cdRemaining / 60000)}min restantes</div>
				</div>
			</div>
		{/if}

		<div style="display: flex; gap: 8px;">
			<button
				class="flex-1 rounded-xl px-3 py-2.5 text-center font-bold text-[11px] transition-all active:scale-[0.97] disabled:opacity-40"
				disabled={isMain || onCd}
				style="background: {onCd ? 'var(--surface-2)' : `${elColor}18`}; color: {onCd ? 'var(--text-muted)' : elColor}; border: 1px solid {onCd ? 'var(--line)' : `${elColor}33`};"
				onclick={chooseAsMain}
			>
				{#if onCd}⏳ {Math.ceil(cdRemaining / 60000)}min{:else}⭐ {isMain ? 'Líder' : 'Líder'}{/if}
			</button>
			{#if onJob}
				<button
					class="flex-1 rounded-xl px-3 py-2.5 text-center font-bold text-[11px] transition-all active:scale-[0.97]"
					style="background: #ef444418; color: #ef4444; border: 1px solid #ef444433;"
					onclick={sendToRest}
				>
					🛑 Descansar
				</button>
			{:else}
				<button
					class="flex-1 rounded-xl px-3 py-2.5 text-center font-bold text-[11px] transition-all active:scale-[0.97] disabled:opacity-40"
					style="background: {onCd ? 'var(--surface-2)' : '#eab30818'}; color: {onCd ? 'var(--text-muted)' : '#eab308'}; border: 1px solid {onCd ? 'var(--line)' : '#eab30833'};"
					disabled={onCd}
					onclick={() => choose('money')}
				>
					{onCd ? '⏳ Descansando' : `💰 ${$_('jobs.workMoney')}`}
				</button>
			{/if}
		</div>
	{/if}
</Modal>
