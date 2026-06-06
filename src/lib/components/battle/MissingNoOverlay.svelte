<script lang="ts">
	import { mn, choosePokemon, advance, winMissingNo } from '$lib/game/missingno.svelte';
	import { battle } from '$lib/game/battle.svelte';
	import SpeechBubble from './SpeechBubble.svelte';
	import BattleResultModal from '$lib/components/BattleResultModal.svelte';
	import { AT_STAKE_COUNT } from '$lib/data/missingno';

	let { ondismiss }: { ondismiss?: () => void } = $props();

	// ── Fog wisps (seeded, deterministic) ──
	function seededRNG(seed: number) {
		let s = seed >>> 0;
		return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
	}

	const rng = seededRNG(0xf065);
	const wisps = Array.from({ length: 26 }, (_, i) => ({
		id: i,
		x: 4 + rng() * 92,
		yPct: 50 + rng() * 46,
		w: 52 + rng() * 115,
		delay: rng() * 10,
		dur: 8 + rng() * 7,
		opacity: 0.1 + rng() * 0.22,
		dx: (rng() - 0.5) * 70,
		isRed: rng() > 0.52
	}));

	// ── Wire victory — trigger when boss HP hits 0 ──
	$effect(() => {
		if (mn.active && battle.state?.mode === 'missingno' && battle.state?.status === 'victory') {
			void winMissingNo();
		}
	});

	function pickClass(pkmId: string): string {
		if (mn.fallen.includes(pkmId)) return 'fallen';
		const activeId = battle.state?.player.pokemon.id;
		if (activeId === pkmId) return 'active';
		return '';
	}
</script>

<div class="missingno-root">
	<!-- Exit button — always visible during MissingNo -->
	<button class="exit-btn" onclick={ondismiss} aria-label="Sair">✕ Sair</button>

	{#if mn.act >= 1}
		<!-- Fog layer -->
		<div class="fog-layer">
			{#each wisps as w (w.id)}
				<div
					class="fog-wisp"
					style="left: {w.x}%; top: {w.yPct}%; width: {w.w}px; height: {w.w}px; margin-left: {w.w / -2}px; margin-top: {w.w / -2}px; background: radial-gradient(circle, {w.isRed ? 'rgba(188,8,34,' + w.opacity + ')' : 'rgba(88,4,158,' + w.opacity + ')'} 0%, transparent 70%); --fo: {w.opacity}; --fdx: {w.dx}px; animation-delay: {w.delay}s; animation-duration: {w.dur}s;"
				></div>
			{/each}
		</div>

		<!-- Vignette -->
		<div class="vignette"></div>

		<!-- Dark flash -->
		<div class="dark-flash"></div>

		<!-- Boss sprite -->
		<div class="sprite-wrap enemy-sprite">
			<div class="missingno-sprite"></div>
		</div>
	{/if}

	<!-- Speech bubbles (click to advance) -->
	{#if mn.speech}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="speech-click-area" onclick={advance} onkeydown={(e) => e.key === 'Enter' && advance()}>
			{#key mn.speech.key}
				<SpeechBubble text={mn.speech.text} speaker={mn.speech.speaker} isAlly={mn.speech.isAlly} />
			{/key}
		</div>
	{/if}

	<!-- Act 2: silent defeat screen (5s hold) -->
	{#if mn.act === 2 && mn.act2Phase === 'defeat'}
		<BattleResultModal variant="defeat" reward={null} captured={null} enemyName="MissingNo." onDismiss={() => {}} silent />
	{/if}

	<!-- Act 2: shatter overlay -->
	{#if mn.act === 2 && mn.act2Phase === 'shatter'}
		<div class="shatter-overlay">
			<div class="shatter-content">
				<span class="shatter-text">D3RROT4D0...</span>
			</div>
		</div>
	{/if}

	<!-- Act 3: pick popup -->
	{#if mn.awaitingPick}
		<div class="pick-backdrop">
			<div class="pick-popup">
				<div class="pick-title">ESCOLHA SEU PRÓXIMO</div>
				<div class="pick-subtitle">Faltam {AT_STAKE_COUNT - mn.fallen.length} Pokémon</div>
				<div class="pick-options">
					{#each mn.pickOptions as pkm (pkm.id)}
						<button
							class="pick-card"
							onclick={() => choosePokemon(pkm)}
						>
							<div class="pick-sprite-placeholder" style="background: {pkm.element};">
								{pkm.name[0]}
							</div>
							<div class="pick-name">{pkm.name}</div>
							<div class="pick-maxhp">HP {pkm.maxHp}</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Victory screen -->
	{#if battle.state?.status === 'victory' && !mn.active}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="end-screen">
			<div class="end-content victory">
				<div class="end-icon">👾</div>
				<div class="end-title">M1SS1NGN0...</div>
				<div class="end-sub">D3F34T3D</div>
				<div class="end-desc">Seus Pokémon foram restaurados com a marca Corrompido.</div>
				<button class="end-btn" onclick={ondismiss}>Voltar ao mapa</button>
			</div>
		</div>
	{/if}

	<!-- Loss screen -->
	{#if battle.state?.status === 'defeat' && !mn.active}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="end-screen">
			<div class="end-content loss">
				<div class="end-icon">💀</div>
				<div class="end-title">D4T4 S4LV4...</div>
				<div class="end-sub">C0RRUPT3D</div>
				<div class="end-desc">Todos os Pokémon foram perdidos permanentemente.</div>
				<button class="end-btn" onclick={ondismiss}>Voltar ao mapa</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.missingno-root {
		position: absolute;
		inset: 0;
		z-index: 30;
		pointer-events: none;
		overflow: hidden;
		border-radius: 26px;
	}

	/* ── Fog ── */
	.fog-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
		overflow: hidden;
	}
	.fog-wisp {
		position: absolute;
		border-radius: 50%;
		filter: blur(24px);
		animation: fogRise linear infinite;
	}
	@keyframes fogRise {
		0% { opacity: 0; transform: translateY(0); }
		12% { opacity: var(--fo); }
		86% { opacity: var(--fo); }
		100% { opacity: 0; transform: translateY(-210px) translateX(var(--fdx, 0px)); }
	}

	/* ── Speech click area ── */
	.speech-click-area {
		position: absolute;
		inset: 0;
		z-index: 26;
		cursor: pointer;
		pointer-events: auto;
	}

	/* ── Vignette ── */
	.vignette {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 4;
		border-radius: 26px;
		animation: vigBreath 4.5s ease-in-out infinite;
	}
	@keyframes vigBreath {
		0%, 100% { box-shadow: inset 0 0 90px rgba(175, 0, 28, 0.18), inset 0 0 38px rgba(75, 0, 115, 0.14); }
		50% { box-shadow: inset 0 0 115px rgba(200, 0, 36, 0.28), inset 0 0 48px rgba(95, 0, 135, 0.20); }
	}

	/* ── Dark flash ── */
	.dark-flash {
		position: absolute;
		inset: 0;
		z-index: 8;
		border-radius: 26px;
		pointer-events: none;
		background: rgba(155, 0, 24, 0.08);
		animation: flashPulse 3s ease-in-out infinite;
	}
	@keyframes flashPulse {
		0%, 100% { opacity: 0; }
		10% { opacity: 0.6; }
		15% { opacity: 0; }
		80% { opacity: 0; }
		85% { opacity: 0.4; }
		90% { opacity: 0; }
	}

	/* ── Boss sprite ── */
	.sprite-wrap {
		position: absolute;
		z-index: 10;
		pointer-events: none;
	}
	.enemy-sprite {
		top: 96px;
		right: 30px;
	}
	.missingno-sprite {
		width: 120px;
		height: 120px;
		background: linear-gradient(135deg, #1a0033, #0a0018, #2a0050, #0a0018);
		border: 2px solid rgba(175, 0, 220, 0.4);
		animation: glitch 0.3s infinite;
		image-rendering: pixelated;
	}
	@keyframes glitch {
		0% { clip-path: inset(0 0 80% 0); transform: translate(-2px, 2px); }
		10% { clip-path: inset(20% 0 60% 0); transform: translate(2px, -2px); }
		20% { clip-path: inset(40% 0 40% 0); transform: translate(-1px, 1px); }
		30% { clip-path: inset(60% 0 20% 0); transform: translate(1px, -1px); }
		40% { clip-path: inset(80% 0 0 0); transform: translate(-3px, 0); }
		50% { clip-path: inset(0 0 80% 0); transform: translate(3px, 0); }
		60% { clip-path: inset(20% 0 60% 0); transform: translate(-2px, -2px); }
		70% { clip-path: inset(40% 0 40% 0); transform: translate(2px, 2px); }
		80% { clip-path: inset(60% 0 20% 0); transform: translate(-1px, 0); }
		90% { clip-path: inset(80% 0 0 0); transform: translate(1px, 0); }
		100% { clip-path: inset(0 0 80% 0); transform: translate(0); }
	}

	/* ── Exit button ── */
	.exit-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 80;
		background: rgba(20, 16, 40, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 4px 10px;
		font-size: 11px;
		font-weight: 700;
		color: #7a6e9e;
		cursor: pointer;
		font-family: inherit;
		pointer-events: auto;
		transition: color 0.2s, border-color 0.2s;
	}
	.exit-btn:hover, .exit-btn:focus-visible {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.4);
		outline: none;
	}

	/* ── Shatter overlay (Act 2) ── */
	.shatter-overlay {
		position: absolute;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.85);
		animation: shatterIn 0.6s ease-out forwards;
		pointer-events: none;
	}
	@keyframes shatterIn {
		0% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
		30% { clip-path: polygon(2% 0, 98% 2%, 96% 98%, 4% 96%); }
		60% { clip-path: polygon(4% 2%, 96% 0, 94% 100%, 6% 98%); }
		100% { clip-path: polygon(15% 8%, 88% 12%, 85% 85%, 18% 80%); opacity: 0; }
	}
	.shatter-content {
		text-align: center;
	}
	.shatter-text {
		font-family: 'Russo One', sans-serif;
		font-size: 36px;
		font-weight: 900;
		color: rgba(255, 50, 50, 0.6);
		text-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
		letter-spacing: 4px;
		animation: shatterFade 0.6s ease-out forwards;
	}
	@keyframes shatterFade {
		0% { opacity: 1; transform: scale(1); }
		100% { opacity: 0; transform: scale(1.2) rotate(2deg); }
	}

	/* ── Pick popup (Act 3) ── */
	.pick-backdrop {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(2, 0, 6, 0.85);
		backdrop-filter: blur(4px);
		pointer-events: auto;
		animation: fadeIn 0.3s ease;
	}
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	.pick-popup {
		background: linear-gradient(180deg, #0d0a1c, #080412);
		border: 1px solid rgba(175, 18, 42, 0.4);
		border-radius: 16px;
		padding: 20px;
		max-width: 340px;
		width: 90%;
		text-align: center;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(175, 18, 42, 0.15);
	}
	.pick-title {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #ff4d62;
		margin-bottom: 4px;
	}
	.pick-subtitle {
		font-size: 11px;
		color: #7a6e9e;
		margin-bottom: 16px;
	}
	.pick-options {
		display: flex;
		gap: 10px;
		justify-content: center;
	}
	.pick-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		background: #141028;
		border: 1px solid #231d3a;
		border-radius: 12px;
		padding: 12px 10px;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 80px;
		color: #ede9ff;
		font-family: inherit;
		outline: none;
	}
	.pick-card:hover, .pick-card:focus-visible {
		border-color: rgba(175, 18, 42, 0.6);
		background: #1c1636;
		transform: translateY(-2px);
	}
	.pick-sprite-placeholder {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		font-weight: 900;
		color: #fff;
		opacity: 0.85;
	}
	.pick-name {
		font-size: 11px;
		font-weight: 700;
		text-align: center;
	}
	.pick-maxhp {
		font-size: 9px;
		color: #7a6e9e;
	}

	/* ── End screens ── */
	.end-screen {
		position: absolute;
		inset: 0;
		z-index: 70;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(2, 0, 6, 0.9);
		pointer-events: auto;
		animation: fadeIn 0.6s ease;
	}
	.end-content {
		text-align: center;
		padding: 24px;
	}
	.end-icon {
		font-size: 48px;
		margin-bottom: 12px;
		animation: endPulse 1.5s ease-in-out infinite;
	}
	@keyframes endPulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}
	.end-title {
		font-family: 'Russo One', sans-serif;
		font-size: 32px;
		font-weight: 900;
		letter-spacing: 3px;
		margin-bottom: 6px;
	}
	.end-content.victory .end-title { color: #ff4d62; text-shadow: 0 0 20px rgba(255, 77, 98, 0.5); }
	.end-content.loss .end-title { color: #ff1a1a; text-shadow: 0 0 20px rgba(255, 0, 0, 0.5); }
	.end-sub {
		font-size: 18px;
		font-weight: 700;
		color: #7a6e9e;
		margin-bottom: 12px;
	}
	.end-desc {
		font-size: 12px;
		color: #4a4268;
		max-width: 240px;
		margin: 0 auto 12px;
	}
	.end-btn {
		background: #231d3a;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		padding: 8px 20px;
		font-size: 12px;
		font-weight: 700;
		color: #ede9ff;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.2s;
	}
	.end-btn:hover, .end-btn:focus-visible {
		background: #292524;
		border-color: var(--accent, #8b5cf6);
		outline: none;
	}
</style>
