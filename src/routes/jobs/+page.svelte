<script lang="ts">
	import Hud from '$lib/components/Hud.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { game, normalizedPokemonHp, setActivePokemon } from '$lib/game/state.svelte';
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
	import { onMount } from 'svelte';

	let selected = $state<CapturedPokemon | null>(null);

	// Progresso visual fluido: avança continuamente via requestAnimationFrame,
	// no ritmo real de produção, em vez de pular a cada segundo.
	let smooth = $state<Record<string, number>>({});
	onMount(() => {
		let raf = 0;
		let last = performance.now();
		const loop = (t: number) => {
			const dt = Math.min(0.1, (t - last) / 1000);
			last = t;
			const next = { ...smooth };
			for (const type of activeJobTypes()) {
				const key = String(type);
				next[key] = ((next[key] ?? 0) + ratePerSecond(type) * dt) % 1;
			}
			smooth = next;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	function jobLabel(type: JobType): string {
		return type === 'money' ? '💰 Dinheiro' : `${ELEMENT_EMOJI[type as Element]} ${ELEMENT_LABEL[type as Element]}`;
	}

	function jobColor(type: JobType): string {
		return type === 'money' ? '#eab308' : ELEMENT_COLOR[type as Element];
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

	function chooseAsMain() {
		if (!selected) return;
		setActivePokemon(selected.id);
		pushToast(`${selected.name} agora e o pokemon principal.`, 'success');
		selected = null;
	}

	function hpPercent(pokemon: CapturedPokemon): number {
		return pokemon.maxHp > 0 ? (normalizedPokemonHp(pokemon) / pokemon.maxHp) * 100 : 0;
	}

	function healsPassively(pokemon: CapturedPokemon): boolean {
		return !jobForPokemon(pokemon.id) && normalizedPokemonHp(pokemon) < pokemon.maxHp;
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
				{@const isMain = game.player?.activePokemonId === p.id}
				<button
					class="flex flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 active:scale-[0.98]"
					class:border-[var(--accent)]={isMain}
					class:ring-2={isMain}
					style={isMain ? 'box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);' : ''}
					onclick={() => (selected = p)}
				>
					<Sprite speciesId={p.speciesId} size={64} alt={p.name} />
					<span class="mt-0.5 truncate text-xs font-bold">{p.name}</span>
					<div class="mt-1 w-full">
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
							<div
								class="h-full rounded-full transition-[width] duration-500"
								class:hp-heal-glow={healsPassively(p)}
								style="width: {hpPercent(p)}%; background: {healsPassively(p)
									? 'linear-gradient(90deg, #22c55e, #4ade80)'
									: 'linear-gradient(90deg, #f59e0b, #22c55e)'};"
							></div>
						</div>
						<div class="mt-0.5 text-center text-[10px] text-[var(--text-muted)]">
							{Math.ceil(normalizedPokemonHp(p))}/{p.maxHp} HP
						</div>
					</div>
					{#if isMain}
						<span class="mt-0.5 rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
							⭐ principal
						</span>
					{/if}
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
					<ProgressBar
						value={smooth[String(type)] ?? 0}
						max={1}
						color={jobColor(type)}
						height={6}
						animate={false}
					/>
				</div>
			{/each}
		</div>
	{/if}
</main>

<!-- Modal de atribuição -->
<Modal open={!!selected} title={selected?.name ?? ''} onclose={() => (selected = null)}>
	{#if selected}
		{@const current = jobForPokemon(selected.id)}
		{@const isMain = game.player?.activePokemonId === selected.id}
		<div class="space-y-2">
			<button
				class="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-3 text-left font-semibold text-[var(--accent)] disabled:opacity-50"
				disabled={isMain}
				onclick={chooseAsMain}
			>
				⭐ {isMain ? 'Pokemon principal atual' : 'Definir como principal de batalha'}
			</button>
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

<style>
	button :global(.hp-heal-glow) {
		box-shadow: 0 0 10px rgba(74, 222, 128, 0.75);
		animation: hp-heal-glow 1.1s ease-in-out infinite;
	}

	@keyframes hp-heal-glow {
		0%,
		100% {
			box-shadow: 0 0 6px rgba(74, 222, 128, 0.45);
		}
		50% {
			box-shadow: 0 0 14px rgba(74, 222, 128, 0.95);
		}
	}
</style>
