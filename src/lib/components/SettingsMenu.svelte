<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { locale, setLocale } from '$lib/i18n';
	import Modal from './Modal.svelte';
	import { deleteDB } from 'idb';

	let {
		open = false,
		onclose
	}: {
		open?: boolean;
		onclose?: () => void;
	} = $props();

	let confirmDelete = $state(false);

	async function handleDeleteSave() {
		try {
			await deleteDB('pokengu');
			localStorage.removeItem('pokengu-deck');
			localStorage.removeItem('pokengu-hud-trades');
			localStorage.removeItem('pokengu-disclaimer-seen');
			location.reload();
		} catch (e) {
			console.error('Failed to delete save:', e);
			location.reload();
		}
	}
</script>

<Modal {open} title={$_('menu.title')} onclose={() => { confirmDelete = false; onclose?.(); }}>
	<div class="space-y-4">
		<div class="space-y-2">
			<p class="text-sm font-medium text-(--text-dim)">{$_( 'menu.language' )}</p>
			<div class="flex gap-2">
			<button
				class="flex-1 rounded-xl border px-4 py-2 text-sm font-bold transition-all"
				class:active={$locale === 'pt-BR'}
				onclick={() => setLocale('pt-BR')}
			>
				🇧🇷 Português
			</button>
			<button
				class="flex-1 rounded-xl border px-4 py-2 text-sm font-bold transition-all"
				class:active={$locale === 'en'}
				onclick={() => setLocale('en')}
			>
				🇺🇸 English
			</button>
			</div>
		</div>

		<div class="border-t border-(--border) pt-4 space-y-1">
			<p class="text-sm font-medium text-(--text-dim)">{$_( 'menu.about' )}</p>
			<p class="text-sm">{$_( 'menu.aboutName' )}</p>
			<a
				href={$_('menu.aboutRepoUrl')}
				target="_blank"
				rel="noopener noreferrer"
				class="text-sm text-(--accent) underline"
			>
				{$_( 'menu.aboutRepo' )}
			</a>
		</div>

		<div class="border-t border-(--border) pt-4">
			{#if confirmDelete}
				<p class="mb-3 text-sm text-(--danger)">{$_( 'menu.confirmDelete' )}</p>
				<div class="flex gap-2">
					<button
						class="flex-1 rounded-xl border border-(--border) px-4 py-2 text-sm font-bold"
						onclick={() => (confirmDelete = false)}
					>
						{$_( 'menu.cancel' )}
					</button>
					<button
						class="flex-1 rounded-xl bg-(--danger) px-4 py-2 text-sm font-bold text-white"
						onclick={handleDeleteSave}
					>
						{$_( 'menu.confirm' )}
					</button>
				</div>
			{:else}
				<button
					class="w-full rounded-xl border border-(--danger)/30 bg-(--danger)/10 px-4 py-2.5 text-sm font-bold text-(--danger)"
					onclick={() => (confirmDelete = true)}
				>
					{$_( 'menu.deleteSave' )}
				</button>
			{/if}
		</div>
	</div>
</Modal>

<style>
	button.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
</style>
