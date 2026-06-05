<script lang="ts">
	import Hud from '$lib/components/Hud.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import NatureIcon from '$lib/components/NatureIcon.svelte';
	import { NATURES } from '$lib/data/natures';
	import { game, normalizedPokemonHp, setActivePokemon } from '$lib/game/state.svelte';
	import {
		assignJob,
		stopJob,
		jobForPokemon,
		jobsState,
		workersInJob,
		ratePerSecond,
		activeJobTypes
	} from '$lib/game/jobs.svelte';
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import type { CapturedPokemon, Element, JobType } from '$lib/game/types';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { onMount } from 'svelte';

	let selected = $state<CapturedPokemon | null>(null);
	let expandedNature = $state<number | null>(null);

	// Smooth progress animation via requestAnimationFrame
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

	/** Pokémon working on a given job type */
	function pokemonInJob(type: JobType): CapturedPokemon[] {
		const ids = new Set(jobsState.list.filter((j) => j.jobType === type).map((j) => j.pokemonId));
		return game.roster.filter((p) => ids.has(p.id));
	}

	/** Only idle + principal pokémon appear in the main list */
	let visibleRoster = $derived(
		game.roster.filter((p) => {
			const isMain = game.player?.activePokemonId === p.id;
			const hasJob = !!jobForPokemon(p.id);
			return isMain || !hasJob;
		})
	);

	let activeTypes = $derived(activeJobTypes());

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

	async function removeFromJob(pokemon: CapturedPokemon) {
		await stopJob(pokemon.id);
		pushToast(`${pokemon.name} parou de trabalhar.`);
	}

	function chooseAsMain() {
		if (!selected) return;
		if (normalizedPokemonHp(selected) <= 0) {
			pushToast(`${selected.name} está desmaiado e precisa se recuperar antes de lutar.`, 'error');
			selected = null;
			return;
		}
		setActivePokemon(selected.id);
		pushToast(`${selected.name} agora é o pokémon principal.`, 'success');
		selected = null;
	}

	function hpPercent(pokemon: CapturedPokemon): number {
		return pokemon.maxHp > 0 ? (normalizedPokemonHp(pokemon) / pokemon.maxHp) * 100 : 0;
	}

	function healsPassively(pokemon: CapturedPokemon): boolean {
		return !jobForPokemon(pokemon.id) && normalizedPokemonHp(pokemon) < pokemon.maxHp;
	}
</script>

<Hud />

<main class="px-4 py-4">
	<!-- Idle + principal pokémon -->
	<h1 class="mb-3 text-xl font-bold">Pokémons</h1>

	{#if game.roster.length === 0}
		<p class="text-sm text-(--text-muted)">Capture pokémons em batalha para colocá-los para trabalhar.</p>
	{:else if visibleRoster.length === 0}
		<p class="text-sm text-(--text-muted)">Todos os pokémons estão trabalhando.</p>
	{:else}
		<div class="grid grid-cols-3 gap-2">
			{#each visibleRoster as p (p.id)}
				{@const isMain = game.player?.activePokemonId === p.id}
				<button
					class="flex flex-col items-center rounded-2xl border border-(--border) bg-(--surface) p-2 active:scale-[0.98]"
					class:border-(--accent)={isMain}
					class:ring-2={isMain}
					style={isMain ? 'box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);' : ''}
					onclick={() => (selected = p)}
				>
					<Sprite speciesId={p.speciesId} size={64} alt={p.name} />
					<span class="mt-0.5 truncate text-xs font-bold">{p.name}</span>
					<div class="mt-1 w-full">
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-2)">
							<div
								class="h-full rounded-full transition-[width] duration-500"
								class:hp-heal-glow={healsPassively(p)}
								style="width: {hpPercent(p)}%; background: {healsPassively(p)
									? 'linear-gradient(90deg, #22c55e, #4ade80)'
									: 'linear-gradient(90deg, #f59e0b, #22c55e)'};"
							></div>
						</div>
						<div class="mt-0.5 text-center text-[10px] text-(--text-muted)">
							{Math.ceil(normalizedPokemonHp(p))}/{p.maxHp} HP
						</div>
					</div>
					{#if isMain}
						<span class="mt-0.5 rounded-full bg-(--accent)/15 px-1.5 py-0.5 text-[10px] font-semibold text-(--accent)">
							⭐ principal
						</span>
					{:else}
						<span class="mt-0.5 rounded-full bg-(--surface-2) px-1.5 py-0.5 text-[10px] text-(--text-muted)">
							ocioso
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Active jobs -->
	<h2 class="mb-2 mt-6 text-lg font-bold">Produção</h2>
	{#if activeTypes.length === 0}
		<p class="text-sm text-(--text-muted)">Nenhum job ativo.</p>
	{:else}
		<div class="space-y-3">
			{#each activeTypes as type (type)}
				{@const workers = pokemonInJob(type)}
				<div class="rounded-2xl border border-(--border) bg-(--surface) p-3">
					<div class="mb-1 flex items-center justify-between text-sm">
						<span class="font-bold">{jobLabel(type)}</span>
						<span class="text-(--text-muted)">
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
					<!-- Worker tiles — tap to go idle -->
					{#if workers.length > 0}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each workers as w (w.id)}
								<button
									class="worker-tile flex flex-col items-center rounded-xl border border-(--border) bg-(--surface-2) px-1.5 py-1 active:scale-95"
									title="Parar {w.name}"
									onclick={() => removeFromJob(w)}
								>
									<Sprite speciesId={w.speciesId} size={36} alt={w.name} />
									<span class="mt-0.5 max-w-12 truncate text-[9px] text-(--text-muted)">{w.name}</span>
									<span class="text-[8px] text-(--danger)">✕ parar</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</main>

<!-- Assignment modal -->
<Modal open={!!selected} title={selected?.name ?? ''} onclose={() => (selected = null)}>
	{#if selected}
		{@const isMain = game.player?.activePokemonId === selected.id}
		<!-- Nature panel -->
		<div class="mb-3 flex items-center gap-2">
			<Sprite speciesId={selected.speciesId} size={48} alt={selected.name} />
			<div>
				<p class="font-bold">{selected.name}</p>
				<p class="text-[10px] text-(--text-muted)">{Math.ceil(normalizedPokemonHp(selected))}/{selected.maxHp} HP</p>
			</div>
		</div>
		{#if selected.natures}
			<div class="mb-3 flex flex-wrap gap-1.5">
				{#each [0, 1, 2] as i}
					{@const id = selected.natures.assigned[i]}
					{@const unlocked = selected.natures.unlocked[i]}
					{@const expanded = expandedNature === i}
					<div>
						<button
							class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
							class:border-(--border)={!unlocked}
							class:border-(--success)={unlocked}
							class:opacity-50={!unlocked}
							onclick={() => (expandedNature = expanded ? null : i)}
							title={NATURES[id].description}
						>
							<NatureIcon {id} locked={!unlocked} size={16} />
							{NATURES[id].namePt}
						</button>
						{#if expanded}
							<div class="mt-0.5 max-w-48 rounded-md bg-(--surface-2) px-2 py-1 text-[10px] text-(--text-muted)">
								{NATURES[id].description}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
		<div class="space-y-2">
			<button
				class="w-full rounded-xl border border-(--accent) bg-(--accent)/10 px-4 py-3 text-left font-semibold text-(--accent) disabled:opacity-50"
				disabled={isMain}
				onclick={chooseAsMain}
			>
				⭐ {isMain ? 'Pokémon principal atual' : 'Definir como principal de batalha'}
			</button>
			<button
				class="w-full rounded-xl border border-(--border) px-4 py-3 text-left font-semibold hover:bg-(--surface-2)"
				onclick={() => choose('money')}
			>
				💰 Trabalhar por dinheiro
			</button>
			<button
				class="w-full rounded-xl border border-(--border) px-4 py-3 text-left font-semibold hover:bg-(--surface-2)"
				onclick={() => choose(selected!.element)}
			>
				{ELEMENT_EMOJI[selected.element]} Trabalhar com {ELEMENT_LABEL[selected.element]}
			</button>
		</div>
	{/if}
</Modal>

<style>
	:global(.hp-heal-glow) {
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

	.worker-tile {
		transition: transform 0.1s ease, opacity 0.1s ease;
	}
	.worker-tile:active {
		opacity: 0.7;
	}
</style>
