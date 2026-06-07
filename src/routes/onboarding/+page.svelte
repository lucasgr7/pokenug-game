<script lang="ts">
	import { goto } from '$app/navigation';
	import Sprite from '$lib/components/Sprite.svelte';
	import { STARTERS, type StarterDef } from '$lib/data/starters';
	import { createPlayer } from '$lib/game/onboarding';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { _ } from 'svelte-i18n';

	const elementColor: Record<string, string> = {
		grass: '#16a34a',
		fire: '#ef4444',
		water: '#3b82f6',
		electric: '#eab308'
	};

	let name = $state('');
	let selected = $state<StarterDef | null>(null);
	let submitting = $state(false);

	let nameValid = $derived(name.trim().length >= 2 && name.trim().length <= 16);
	let canStart = $derived(nameValid && selected !== null && !submitting);

	async function start() {
		if (!canStart || !selected) return;
		submitting = true;
		try {
			await createPlayer(name, selected);
			pushToast($_('onboarding.boaSorte', { values: { name: name.trim() } }), 'success');
			await goto('/');
		} catch (e) {
			console.error(e);
			pushToast($_('onboarding.error'), 'error');
			submitting = false;
		}
	}
</script>

<main class="flex min-h-[100dvh] flex-col px-5 py-8">
	<header class="mb-6 text-center">
		<h1 class="text-3xl font-extrabold tracking-tight">{$_( 'onboarding.title' )}</h1>
		<p class="mt-1 text-sm text-[var(--text-muted)]">{$_( 'onboarding.subtitle' )}</p>
	</header>

	<label class="mb-2 block text-sm font-medium" for="trainer-name">{$_( 'onboarding.seuNome' )}</label>
	<input
		id="trainer-name"
		bind:value={name}
		maxlength="16"
		placeholder={$_('onboarding.placeholder')}
		class="mb-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none focus:border-[var(--accent)]"
	/>
	<p class="mb-6 h-4 text-xs text-[var(--text-muted)]">
		{#if name.length > 0 && !nameValid}
			{$_( 'onboarding.nameHint' )}
		{/if}
	</p>

	<h2 class="mb-3 text-sm font-medium">{$_( 'onboarding.escolhaInicial' )}</h2>
	<div class="grid grid-cols-2 gap-3">
		{#each STARTERS as s (s.speciesId)}
			<button
				class="flex flex-col items-center rounded-2xl border-2 bg-[var(--surface)] p-3 transition-all"
				class:border-[var(--accent)]={selected?.speciesId === s.speciesId}
				class:scale-[1.02]={selected?.speciesId === s.speciesId}
				style={selected?.speciesId === s.speciesId
					? ''
					: 'border-color: var(--border);'}
				onclick={() => (selected = s)}
			>
				<Sprite speciesId={s.speciesId} size={110} alt={s.name} />
				<span class="mt-1 font-bold">{s.name}</span>
				<span
					class="mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
					style="background: {elementColor[s.element]};"
				>
					{$_('elements.' + s.element)}
				</span>
			</button>
		{/each}
	</div>

	<div class="flex-1"></div>

	<button
		class="mt-6 w-full rounded-xl py-3.5 text-lg font-bold text-[var(--accent-text)] transition-opacity disabled:opacity-40"
		style="background: var(--accent);"
		disabled={!canStart}
		onclick={start}
	>
		{submitting ? $_('onboarding.criando') : $_('onboarding.comecar')}
	</button>
</main>
