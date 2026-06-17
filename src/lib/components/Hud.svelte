<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { game, setTheme, getPlatinum } from "$lib/game/state.svelte";
	import { toggleMusicMute, isMusicMuted } from "$lib/game/music.svelte";
	import { formatNumber } from "$lib/utils/math";
	import { _ } from "svelte-i18n";
	import SettingsMenu from "./SettingsMenu.svelte";

	let showSettings = $state(false);

	let platinum = $derived(getPlatinum());

	function toggleTheme() {
		setTheme(game.player?.theme === "dark" ? "light" : "dark");
	}

	let installPrompt = $state<
		| (Event & {
				prompt(): Promise<void>;
				userChoice: Promise<{ outcome: string }>;
		  })
		| null
	>(null);
	let installed = $state(false);

	onMount(() => {
		window.addEventListener("beforeinstallprompt", (e) => {
			e.preventDefault();
			installPrompt = e as typeof installPrompt;
		});
		window.addEventListener("appinstalled", () => {
			installPrompt = null;
			installed = true;
		});
	});

	async function installPwa() {
		if (!installPrompt) return;
		await installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		if (outcome === "accepted") installPrompt = null;
	}
</script>

<header
	class="hud-root sticky top-0 z-20 flex items-center gap-2 px-3 py-1.5 backdrop-blur"
>
	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<div class="truncate text-xs font-bold">{game.player?.name ?? "—"}</div>
			{#if installPrompt && !installed}
				<button
					class="rounded-md px-1.5 py-0.5 text-sm hover:bg-(--surface-2)"
					onclick={installPwa}
					aria-label={$_("hud.instalarApp")}
					title={$_("hud.instalar")}
				>
					📲
				</button>
			{/if}
			<button
				class="rounded-md px-1.5 py-0.5 text-sm hover:opacity-75"
				onclick={toggleMusicMute}
				aria-label={isMusicMuted() ? $_("hud.ativarSom") : $_("hud.silenciar")}
			>
				{isMusicMuted() ? "🔇" : "🔊"}
			</button>
			<button
				class="rounded-md px-1.5 py-0.5 text-sm hover:opacity-75"
				onclick={toggleTheme}
				aria-label={$_("hud.alternarTema")}
			>
				{game.player?.theme === "dark" ? "🌙" : "☀️"}
			</button>
			<button
				class="rounded-md px-1.5 py-0.5 text-sm hover:opacity-75"
				onclick={() => (showSettings = true)}
				aria-label={$_("menu.title")}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="3" />
					<path
						d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
					/>
				</svg>
			</button>
		</div>
		<div class="flex flex-wrap items-center gap-1 text-xs">
			<span class="hud-money font-semibold"
				>💰 {formatNumber(game.player?.money ?? 0)}</span
			>
			<span class="hud-chip hud-platinum">⬡ {formatNumber(platinum)}</span>
		</div>
	</div>
	{#if installPrompt && !installed}
		<button
			class="rounded-lg px-2 py-1 text-lg hover:bg-(--surface-2)"
			onclick={installPwa}
			aria-label={$_("hud.instalarApp")}
			title={$_("hud.instalar")}
		>
			📲
		</button>
	{/if}
</header>

<SettingsMenu open={showSettings} onclose={() => (showSettings = false)} />

<style>
	.hud-root {
		background: color-mix(in srgb, var(--bg-0, #0b0b10) 95%, transparent);
		border-bottom: 1px solid var(--line, #2b2c38);
	}
	.hud-money {
		color: var(--cta, #ffc24a);
	}
	.hud-chip {
		border-radius: 9999px;
		background: var(--bg-2, #181821);
		border: 1px solid var(--line, #2b2c38);
		padding: 1px 7px;
		color: var(--txt-dim, #9a9bab);
		font-size: 11px;
	}
	.hud-platinum {
		color: #a78bfa;
		border-color: #a78bfa44;
		background: #a78bfa11;
	}
</style>
