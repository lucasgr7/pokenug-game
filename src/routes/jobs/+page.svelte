<script lang="ts">
	import Hud from '$lib/components/Hud.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { game } from '$lib/game/state.svelte';
	import {
		assignJob,
		stopJob,
		jobForPokemon,
		workersInJob,
		ratePerSecond,
		activeJobTypes
	} from '$lib/game/jobs.svelte';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import type { CapturedPokemon, Element, JobType } from '$lib/game/types';
	import { pushToast } from '$lib/stores/toast.svelte';

	let selected = $state<CapturedPokemon | null>(null);

	function jobLabel(type: JobType): string {
		return type === 'money' ? '💰 Dinheiro' : `${ELEMENT_EMOJI[type as Element]} ${ELEMENT_LABEL[type as Element]}`;
	}

	function jobColor(type: JobType): string {
		return type === 'money' ? '#eab308' : ELEMENT_COLOR[type as Element];
	}

	// Progresso até o próximo ponto: parte fracionária do total acumulado.
	function fractionToNext(type: JobType): number {
		if (type === 'money') {
			const v = game.player?.money ?? 0;
			return v - Math.floor(v);
		}
		const v = game.player?.elementPoints[type as Element] ?? 0;
		return v - Math.floor(v);
	}

	async function choose(type: JobType) {
		if (!selected) return;
		await assignJob(selected.id, type);
		pushToast(`${selected.name} agora trabalha em ${jobLabel(type)}.`, 'success');
		selected = null;
	}

	async function stop() {
		if (!selected) return;
		await stopJob(selected.id);
		pushToast(`${selected.name} parou de trabalhar.`);
		selected = null;
	}

	let activeTypes = $derived(activeJobTypes());
</script>

<Hud />

<main class="px-4 py-4">
	<h1 class="mb-3 text-xl font-bold">Pokémons</h1>

	{#if game.roster.length === 0}
		<p class="text-sm text-[var(--text-muted)]">Capture pokémons em batalha para colocá-los para trabalhar.</p>
	{:else}
		<div class="grid grid-cols-3 gap-2">
			{#each game.roster as p (p.id)}
				{@const job = jobForPokemon(p.id)}
				<button
					class="flex flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 active:scale-[0.98]"
					onclick={() => (selected = p)}
				>
					<Sprite speciesId={p.speciesId} size={64} alt={p.name} />
					<span class="mt-0.5 truncate text-xs font-bold">{p.name}</span>
					{#if job}
						<span
							class="mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
							style="background: {jobColor(job.jobType)};"
						>
							{jobLabel(job.jobType)}
						</span>
					{:else}
						<span class="mt-0.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
							ocioso
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Jobs ativos -->
	<h2 class="mb-2 mt-6 text-lg font-bold">Produção</h2>
	{#if activeTypes.length === 0}
		<p class="text-sm text-[var(--text-muted)]">Nenhum job ativo.</p>
	{:else}
		<div class="space-y-3">
			{#each activeTypes as type (type)}
				<div class="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
					<div class="mb-1 flex items-center justify-between text-sm">
						<span class="font-bold">{jobLabel(type)}</span>
						<span class="text-[var(--text-muted)]">
							{workersInJob(type)} 👷 · {ratePerSecond(type).toFixed(2)}/s
						</span>
					</div>
					<ProgressBar value={fractionToNext(type)} max={1} color={jobColor(type)} height={6} />
				</div>
			{/each}
		</div>
	{/if}
</main>

<!-- Modal de atribuição -->
<Modal open={!!selected} title={selected?.name ?? ''} onclose={() => (selected = null)}>
	{#if selected}
		{@const current = jobForPokemon(selected.id)}
		<div class="space-y-2">
			<button
				class="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-left font-semibold hover:bg-[var(--surface-2)]"
				onclick={() => choose('money')}
			>
				💰 Trabalhar por dinheiro
			</button>
			<button
				class="w-full rounded-xl border border-[var(--border)] px-4 py-3 text-left font-semibold hover:bg-[var(--surface-2)]"
				onclick={() => choose(selected!.element)}
			>
				{ELEMENT_EMOJI[selected.element]} Trabalhar com {ELEMENT_LABEL[selected.element]}
			</button>
			{#if current}
				<button
					class="w-full rounded-xl bg-[var(--danger)] px-4 py-3 text-left font-semibold text-white"
					onclick={stop}
				>
					✋ Parar de trabalhar
				</button>
			{/if}
		</div>
	{/if}
</Modal>
