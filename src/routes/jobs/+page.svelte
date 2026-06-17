<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { t } from '$lib/i18n';
	import Hud from '$lib/components/Hud.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import NatureIcon from '$lib/components/NatureIcon.svelte';
	import CorruptedBadge from '$lib/components/CorruptedBadge.svelte';
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
	import type { CapturedPokemon, JobType } from '$lib/game/types';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { onMount } from 'svelte';
	import { getAllFled, removeFled } from '$lib/db/fled';
	import { capacityMs, stepWork } from '$lib/game/exhaustion';
	import type { FledPokemon } from '$lib/game/types';

	let selected = $state<CapturedPokemon | null>(null);
	let expandedNature = $state<number | null>(null);
	let showHelp = $state(false);
	let fledList = $state<FledPokemon[]>([]);

	onMount(async () => {
		fledList = await getAllFled();
	});

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
		return `${t('jobs.workMoney')}`;
	}

	function jobColor(type: JobType): string {
		return '#eab308';
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
		pushToast(t('jobs.assigned', { name: selected.name, label: jobLabel(type) }), 'success');
		selected = null;
	}

	async function stop() {
		if (!selected) return;
		await stopJob(selected.id);
		pushToast(t('jobs.stopped', { name: selected.name }));
		selected = null;
	}

	async function removeFromJob(pokemon: CapturedPokemon) {
		await stopJob(pokemon.id);
		pushToast(t('jobs.stopped', { name: pokemon.name }));
	}

	function chooseAsMain() {
		if (!selected) return;
		if (normalizedPokemonHp(selected) <= 0) {
			pushToast(t('jobs.fainted', { name: selected.name }), 'error');
			selected = null;
			return;
		}
		setActivePokemon(selected.id);
		pushToast(t('jobs.setMainSuccess', { name: selected.name }), 'success');
		selected = null;
	}

	function hpPercent(pokemon: CapturedPokemon): number {
		return pokemon.maxHp > 0 ? (normalizedPokemonHp(pokemon) / pokemon.maxHp) * 100 : 0;
	}

	function healsPassively(pokemon: CapturedPokemon): boolean {
		return !jobForPokemon(pokemon.id) && normalizedPokemonHp(pokemon) < pokemon.maxHp;
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

	async function handleRemoveFled(id: string) {
		await removeFled(id);
		fledList = fledList.filter((f) => f.id !== id);
	}
</script>

<Hud />

<main class="px-4 py-4">
	<!-- Idle + principal pokémon -->
	<h1 class="mb-3 text-xl font-bold">{$_('jobs.title')}</h1>

	{#if game.roster.length === 0}
		<p class="text-sm text-(--text-muted)">{$_('jobs.emptyRoster')}</p>
	{:else if visibleRoster.length === 0}
		<p class="text-sm text-(--text-muted)">{$_('jobs.allWorking')}</p>
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
							{$_('jobs.main')}
						</span>
					{:else}
						<span class="mt-0.5 rounded-full bg-(--surface-2) px-1.5 py-0.5 text-[10px] text-(--text-muted)">
							{$_('jobs.idle')}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Active jobs -->
	<div class="mb-2 mt-6 flex items-center gap-2">
		<h2 class="text-lg font-bold">{$_('jobs.production')}</h2>
		<button
			class="help-btn flex h-5 w-5 items-center justify-center rounded-full border border-(--text-muted) text-[10px] font-bold text-(--text-muted)"
			onclick={() => (showHelp = true)}
		>?</button>
	</div>
	{#if activeTypes.length === 0}
		<p class="text-sm text-(--text-muted)">{$_('jobs.noJobs')}</p>
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
									title={$_('jobs.stopTitle', { values: { name: w.name } })}
									onclick={() => removeFromJob(w)}
								>
									<Sprite speciesId={w.speciesId} size={36} alt={w.name} />
									<span class="mt-0.5 max-w-12 truncate text-[9px] text-(--text-muted)">{w.name}</span>
									<span class="text-[8px] text-(--danger)">{$_('jobs.stopLabel')}</span>
									{#if w.work}
										<div class="mt-1 w-full px-0.5">
											<div class="h-1 w-full overflow-hidden rounded-full bg-(--surface)">
												<div
													class="h-full rounded-full transition-[width] duration-500"
													style="width: {exhaustionPercent(w)}%; background: {w.work.phase === 'rage' ? '#ef4444' : 'linear-gradient(90deg, #6366f1, #8b5cf6)'};"
												></div>
											</div>
											{#if w.work.phase === 'rage'}
												<div class="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-(--surface)">
													<div
														class="h-full rounded-full transition-[width] duration-500"
														style="width: {ragePercent(w)}%; background: #ef4444; animation: pulse-bar 0.8s ease-in-out infinite;"
													></div>
												</div>
											{/if}
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Fugiram section -->
	{#if fledList.length > 0}
		<h2 class="mb-2 mt-6 text-lg font-bold">Fugiram</h2>
		<div class="flex flex-wrap gap-2">
			{#each fledList as f (f.id)}
				<div class="flex items-center gap-2 rounded-xl border border-(--danger)/30 bg-(--surface) px-3 py-2">
					<Sprite speciesId={f.speciesId} size={32} alt={f.name} />
					<div class="flex flex-col">
						<span class="text-xs font-bold text-(--txt-main)">{f.name}</span>
						<span class="text-[10px] text-(--text-muted)">{new Date(f.fledAt).toLocaleDateString('pt-BR')}</span>
					</div>
					<button
						class="ml-2 rounded-lg bg-(--danger)/15 px-2 py-1 text-[10px] font-semibold text-(--danger)"
						onclick={() => handleRemoveFled(f.id)}
					>Remover</button>
				</div>
			{/each}
		</div>
	{/if}
</main>

<!-- Help legend modal -->
<Modal open={showHelp} title="Exaustão" onclose={() => (showHelp = false)}>
	<div class="space-y-3 text-sm leading-relaxed text-(--text-dim)">
		<p class="flex items-center gap-2">
			<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6);"></span>
			<strong>Roxo = Cansaço:</strong> tempo restante de trabalho. Quando acaba, o Pokémon entra em fúria.
		</p>
		<p class="flex items-center gap-2">
			<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #ef4444;"></span>
			<strong>Vermelho = Fúria:</strong> se esvaziar completamente, o Pokémon foge. Tire-o do trabalho para acalmá-lo.
		</p>
		<p class="flex items-center gap-2">
			<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #22c55e;"></span>
			<strong>Verde = Descanso:</strong> Pokémon fora do trabalho recuperam o cansaço automaticamente.
		</p>
		<p class="mt-2 text-[11px] text-(--text-muted)">
			Natureza boa (primeira) = 3× mais tempo de trabalho. Natureza ruim = metade do tempo.
		</p>
	</div>
</Modal>

<!-- Assignment modal -->
<Modal open={!!selected} title={selected?.name ?? ''} onclose={() => (selected = null)}>
	{#if selected}
		{@const isMain = game.player?.activePokemonId === selected.id}
		<!-- Nature panel -->
		<div class="mb-3 flex items-center gap-2">
			<Sprite speciesId={selected.speciesId} size={48} alt={selected.name} />
			<div>
				<p class="font-bold flex items-center gap-1.5">
					{selected.name}
					{#if selected.corrupted}<CorruptedBadge size={16} />{/if}
				</p>
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
							title={$_('natures.' + id + '.description')}
						>
							<NatureIcon {id} locked={!unlocked} size={16} />
							{$_('natures.' + id + '.name')}
						</button>
						{#if expanded}
							<div class="mt-0.5 max-w-48 rounded-md bg-(--surface-2) px-2 py-1 text-[10px] text-(--text-muted)">
								{$_('natures.' + id + '.description')}
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
				⭐ {isMain ? $_('jobs.isMain') : $_('jobs.setAsMain')}
			</button>
			<button
				class="w-full rounded-xl border border-(--border) px-4 py-3 text-left font-semibold hover:bg-(--surface-2)"
				onclick={() => choose('money')}
			>
				{$_('jobs.workMoney')}
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
	.help-btn {
		transition: background 0.15s;
	}
	.help-btn:hover {
		background: var(--surface-2);
	}
	@keyframes pulse-bar {
		0%, 100% { opacity: 0.5; }
		50% { opacity: 1; }
	}
</style>
