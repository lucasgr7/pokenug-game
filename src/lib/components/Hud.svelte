<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { game, setTheme, getPlatinum } from "$lib/game/state.svelte";
	import { toggleMusicMute, isMusicMuted } from "$lib/game/music.svelte";
	import { formatNumber } from "$lib/utils/math";
	import { hudTrades, type HudTradeEvent } from "$lib/stores/hud.svelte";
	import type { Element } from "$lib/game/types";
	import { _ } from "svelte-i18n";
	import SettingsMenu from "./SettingsMenu.svelte";

	let showSettings = $state(false);

	const elementEmoji: Partial<Record<Element, string>> = {
		fire: "🔥",
		water: "💧",
		grass: "🌿",
		electric: "⚡",
		psychic: "🔮",
		rock: "🪨",
		ground: "⛰️",
		fighting: "🥊",
		ice: "❄️",
		bug: "🐛",
		poison: "☠️",
		ghost: "👻",
		flying: "🪶",
		dragon: "🐉",
		normal: "⭐",
	};

	let expanded = $state(false);
	let elementChips = $derived(
		Object.entries(game.player?.elementPoints ?? {})
			.filter(([, v]) => (v ?? 0) >= 1)
			.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)),
	);
	let displayChips = $derived(
		expanded ? elementChips : elementChips.slice(0, 3),
	);
	let platinum = $derived(getPlatinum());

	function toggleTheme() {
		setTheme(game.player?.theme === "dark" ? "light" : "dark");
	}

	function tradeEvent(el: string): HudTradeEvent | undefined {
		return hudTrades.events.find((e) => e.element === el);
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
			<button
				class="ml-auto flex items-center gap-1.5 text-xs"
				onclick={() => goto("/market")}
				aria-label={$_("hud.mercado")}
				title={$_("hud.irParaMercado")}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M4 19V5M4 15l5-5 4 3 7-8" /><path d="M16 5h4v4" />
				</svg>
			</button>
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
			{#each displayChips as [el, v] (el)}
				{@const te = tradeEvent(el)}
				<span
					class="hud-chip"
					class:trade-buy={te?.kind === "buy"}
					class:trade-sell={te?.kind === "sell"}
					onanimationend={() => {
						if (te)
							hudTrades.events = hudTrades.events.filter((e) => e.id !== te.id);
					}}
				>
					{elementEmoji[el as Element] ?? ""}
					{formatNumber(v ?? 0)}
				</span>
			{/each}
			<button
				class="hud-toggle"
				onclick={() => (expanded = !expanded)}
				aria-label={expanded ? $_("hud.recolher") : $_("hud.expandir")}
				title={expanded ? $_("hud.recolher") : $_("hud.expandir")}
			>
				{expanded ? "▲" : "▼"}
			</button>
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
		transition:
			background 0.2s,
			border-color 0.2s;
	}
	.hud-platinum {
		color: #a78bfa;
		border-color: #a78bfa44;
		background: #a78bfa11;
	}
	.hud-toggle {
		border-radius: 9999px;
		background: var(--bg-2, #181821);
		border: 1px solid var(--line, #2b2c38);
		padding: 1px 5px;
		color: var(--txt-dim, #9a9bab);
		font-size: 9px;
		line-height: 1.2;
		cursor: pointer;
	}
	.hud-toggle:hover {
		color: var(--txt, #eee);
	}
	.trade-buy {
		animation: flash-buy 2s ease-out;
	}
	.trade-sell {
		animation: flash-sell 2s ease-out;
	}
	@keyframes flash-buy {
		0% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
			border-color: #22c55e;
			background: rgba(34, 197, 94, 0.15);
		}
		15% {
			box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.5);
			border-color: #22c55e;
			background: rgba(34, 197, 94, 0.15);
		}
		100% {
			box-shadow: none;
			border-color: var(--line, #2b2c38);
			background: var(--bg-2, #181821);
		}
	}
	@keyframes flash-sell {
		0% {
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6);
			border-color: #ef4444;
			background: rgba(239, 68, 68, 0.15);
		}
		15% {
			box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.5);
			border-color: #ef4444;
			background: rgba(239, 68, 68, 0.15);
		}
		100% {
			box-shadow: none;
			border-color: var(--line, #2b2c38);
			background: var(--bg-2, #181821);
		}
	}
</style>
