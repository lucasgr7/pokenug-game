<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { relationshipState, resolveWithLLM, progressionScale } from '$lib/game/relationship.svelte';
	import { game } from '$lib/game/state.svelte';
	import { getSpriteUrl } from '$lib/api/sprites';
	import { MAX_INPUT_CHARS, scaledThresholds, NATURE_REGION_GATE } from '$lib/game/relationship';
	import SpeechBubble from '$lib/components/battle/SpeechBubble.svelte';

	const pokemonId = $derived(page.params.id);
	const event = $derived(relationshipState.events.find((e) => e.pokemonId === pokemonId));
	const pokemon = $derived(game.roster.find((p) => p.id === pokemonId));

	// Captured so the result screen survives the event being removed from state.
	let phase = $state<'asking' | 'thinking' | 'responded'>('asking');
	let responseEmoji = $state('');
	let responseDelta = $state(0);
	let prompt = $state('');

	let spriteUrl = $state('');
	let peerSpriteUrl = $state('');
	let freeText = $state('');

	$effect(() => {
		if (pokemon && !spriteUrl) {
			getSpriteUrl(pokemon.speciesId).then((url) => { spriteUrl = url; });
		}
	});

	const peerPokemon = $derived(
		event?.secondaryPokemonId ? game.roster.find((p) => p.id === event.secondaryPokemonId) : null
	);

	$effect(() => {
		if (peerPokemon && !peerSpriteUrl) {
			getSpriteUrl(peerPokemon.speciesId).then((url) => { peerSpriteUrl = url; });
		}
	});

	const isConflict = $derived(!!event?.secondaryPokemonId);

	// Relationship progress (pink bar) — escala com a região mais avançada.
	const points = $derived(pokemon?.relationship?.points ?? 0);
	const scale = $derived(progressionScale());
	const thresholds = $derived(scaledThresholds(scale.scaling));
	const MAX_POINTS = $derived(thresholds[thresholds.length - 1]);
	const fillPct = $derived(Math.min(100, (points / MAX_POINTS) * 100));

	async function answer(text: string, hookId?: string, peerSentiment?: string) {
		if (!event || phase !== 'asking') return;
		const eventId = event.id;
		prompt = event.promptPt;
		phase = 'thinking';
		const res = await resolveWithLLM(eventId, text, hookId, peerSentiment as any);
		responseEmoji = res?.emoji ?? '❓';
		responseDelta = res?.delta ?? 0;
		phase = 'responded';
	}

	function submitFreeText(e: Event) {
		e.preventDefault();
		if (freeText.trim().length === 0) return;
		answer(freeText.trim());
	}

	function close() {
		goto('/');
	}

	// O coração reflete o ganho REAL de afinidade (já com a habituação aplicada),
	// não só o tom da reação — assim repetir a mesma coisa mostra ±0 ou perda.
	const heart = $derived(
		responseDelta > 0 ? { sym: '❤️', label: `+${responseDelta}`, bad: false }
		: responseDelta < 0 ? { sym: '💔', label: `${responseDelta}`, bad: true }
		: { sym: '😶', label: '±0', bad: false }
	);
</script>

<div class="rel-page">
	<button class="close-btn" onclick={close} aria-label="Fechar">✕</button>

	{#if !event && phase === 'asking'}
		<div class="centered">
			<span style="font-size: 48px;">😴</span>
			<p class="muted">Nenhum evento ativo para este Pokémon.</p>
			<button class="primary" onclick={close}>Voltar</button>
		</div>
	{:else}
		<!-- Relationship progress bar (pink) with milestone marks -->
		<div class="progress-wrap">
			<div class="progress-track">
				<div class="progress-fill" style="width: {fillPct}%;"></div>
				{#each thresholds as th, i}
					{@const regionLocked = scale.regionIndex < NATURE_REGION_GATE[i]}
					<div
						class="mark"
						class:reached={points >= th && !regionLocked}
						class:region-locked={regionLocked}
						style="left: {(th / MAX_POINTS) * 100}%;"
						title={regionLocked
							? `Avance até a região ${NATURE_REGION_GATE[i] + 1} para liberar esta natureza`
							: `Marco ${Math.round(th)}: desbloqueia natureza + HP máximo`}
					>
						<span class="mark-icon">{regionLocked ? '🔒' : '⭐'}</span>
					</div>
				{/each}
			</div>
			<div class="progress-label muted">{points} / {MAX_POINTS} · afinidade</div>
		</div>

		<div class="scene" class:conflict={isConflict}>
			{#if isConflict}
				<!-- Two-sprite fight layout -->
				<div class="fight-ring">
					<div class="fighter left">
						{#if spriteUrl}
							<img class="sprite fight-sprite" class:dim={phase === 'thinking'} src={spriteUrl} alt={pokemon?.name} />
						{/if}
						<span class="fighter-name">{pokemon?.name ?? '?'}</span>
					</div>
					<div class="vs-badge">⚡</div>
					<div class="fighter right">
						{#if peerSpriteUrl}
							<img class="sprite fight-sprite" class:dim={phase === 'thinking'} src={peerSpriteUrl} alt={peerPokemon?.name} />
						{/if}
						<span class="fighter-name">{peerPokemon?.name ?? '?'}</span>
					</div>
				</div>
			{:else}
				{#if spriteUrl}
					<img class="sprite" class:dim={phase === 'thinking'} src={spriteUrl} alt={pokemon?.name} />
				{/if}
			{/if}

			{#if phase === 'thinking'}
				<div class="bubble-host">
					<div class="thinking-bubble">
						<span class="dot"></span><span class="dot"></span><span class="dot"></span>
					</div>
				</div>
			{:else if phase === 'responded'}
				<div class="emoji-reaction">
					{#key responseEmoji}
						<span class="big-emoji">{responseEmoji}</span>
					{/key}
					<div class="heart-float" class:bad={heart.bad}>
						<span class="heart-sym">{heart.sym}</span>
						<span class="heart-label">{heart.label}</span>
					</div>
				</div>
			{:else if event}
				<div class="bubble-host">
					<SpeechBubble text={event.promptPt} speaker={isConflict ? 'BRIGA!' : (pokemon?.name ?? '???')} isAlly={!isConflict} inline />
				</div>
			{/if}
		</div>

		{#if phase === 'asking' && event}
			<div class="answers">
				{#each event.answers as a, i (a.text)}
					<button
						class="answer-btn slide-in"
						class:side-a={a.peerSentiment === 'bad'}
						class:side-b={a.peerSentiment === 'good'}
						class:mediate={!a.peerSentiment || a.peerSentiment === a.sentiment}
						style="animation-delay: {i * 90}ms;"
						onclick={() => answer(a.text, a.hookId, a.peerSentiment)}
					>{a.text}</button>
				{/each}
			</div>

			<form class="free-text" onsubmit={submitFreeText}>
				<input
					type="text"
					bind:value={freeText}
					maxlength={MAX_INPUT_CHARS}
					placeholder="Diga algo para {pokemon?.name ?? 'seu Pokémon'}..."
				/>
				<button type="submit" disabled={freeText.trim().length === 0}>Enviar</button>
			</form>
		{:else if phase === 'responded'}
			<div class="result-footer">
				<p class="muted">Como será que {pokemon?.name ?? 'ele'} se sentiu?</p>
				<button class="primary" onclick={close}>Fechar</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.rel-page {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		padding: 16px;
		background: var(--bg-0);
	}
	.close-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 10;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg-1);
		border: 1px solid var(--line);
		color: var(--txt-dim);
		font-size: 16px;
		cursor: pointer;
	}
	.close-btn:hover { background: var(--bg-2); }

	.centered, .scene {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}
	.muted { color: var(--txt-dim); font-size: 14px; text-align: center; }
	.primary {
		padding: 10px 24px;
		background: var(--accent);
		border: none;
		border-radius: 12px;
		color: var(--accent-text);
		font-weight: 600;
		cursor: pointer;
	}

	/* Progress bar */
	.progress-wrap { margin-top: 40px; }
	.progress-track {
		position: relative;
		height: 10px;
		border-radius: 999px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		overflow: visible;
	}
	.progress-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #f472b6, #ec4899);
		box-shadow: 0 0 10px rgba(236, 72, 153, 0.6);
		transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.mark {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		filter: grayscale(1) opacity(0.45);
	}
	.mark.reached { filter: none; }
	.mark-icon { line-height: 1; }
	.progress-label { margin-top: 6px; font-size: 11px; }

	.sprite {
		width: 120px;
		height: 120px;
		object-fit: contain;
		image-rendering: pixelated;
		transition: opacity 0.2s;
	}
	.sprite.dim { opacity: 0.6; }
	.bubble-host { position: relative; width: 100%; max-width: 320px; }

	/* Thinking dots */
	.thinking-bubble {
		display: inline-flex;
		gap: 5px;
		padding: 12px 16px;
		margin: 0 auto;
		background: linear-gradient(145deg, rgba(10, 8, 18, 0.97), rgba(6, 4, 12, 0.99));
		border: 1px solid rgba(18, 140, 140, 0.55);
		border-radius: 14px;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #3ad6c2;
		animation: dot-bounce 1.2s infinite ease-in-out;
	}
	.dot:nth-child(2) { animation-delay: 0.18s; }
	.dot:nth-child(3) { animation-delay: 0.36s; }
	@keyframes dot-bounce {
		0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
		30% { transform: translateY(-5px); opacity: 1; }
	}

	/* Big floating emoji reaction */
	.emoji-reaction {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 160px;
	}
	.big-emoji {
		font-size: clamp(88px, 30vw, 150px);
		line-height: 1;
		filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.45));
		animation: emoji-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both,
			emoji-float 3s ease-in-out 0.5s infinite;
	}
	@keyframes emoji-pop {
		0% { opacity: 0; transform: scale(0.3) rotate(-12deg); }
		100% { opacity: 1; transform: scale(1) rotate(0deg); }
	}
	@keyframes emoji-float {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}

	/* Heart feedback */
	.heart-float {
		position: absolute;
		left: 50%;
		top: -6px;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 3px;
		font-weight: 800;
		color: #ec4899;
		animation: heart-rise 1.6s ease-out forwards;
		pointer-events: none;
	}
	.heart-float.bad { color: #94a3b8; }
	.heart-sym { font-size: 22px; }
	.heart-label { font-size: 14px; }
	@keyframes heart-rise {
		0% { opacity: 0; transform: translate(-50%, 6px) scale(0.6); }
		25% { opacity: 1; transform: translate(-50%, -8px) scale(1.1); }
		100% { opacity: 0; transform: translate(-50%, -42px) scale(1); }
	}

	/* Answers + input */
	.answers { display: flex; flex-direction: column; gap: 8px; padding: 16px 0; }
	.answer-btn {
		width: 100%;
		padding: 12px 16px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 12px;
		color: var(--txt-main);
		font-size: 14px;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}
	.answer-btn:hover { background: var(--bg-2); }
	.slide-in {
		opacity: 0;
		animation: slide-in-left 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	@keyframes slide-in-left {
		from { opacity: 0; transform: translateX(-32px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.free-text { display: flex; gap: 8px; padding: 8px 0 24px; }
	.free-text input {
		flex: 1;
		padding: 10px 14px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 10px;
		color: var(--txt-main);
		font-size: 14px;
		outline: none;
	}
	.free-text button {
		padding: 10px 18px;
		background: var(--accent);
		border: none;
		border-radius: 10px;
		color: var(--accent-text);
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
	}
	.free-text button:disabled { opacity: 0.5; cursor: not-allowed; }

	.result-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 8px 0 24px;
	}

	/* Conflict fight ring */
	.fight-ring {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: 320px;
		justify-content: center;
	}
	.fighter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		flex: 1;
	}
	.fight-sprite {
		width: 80px;
		height: 80px;
		object-fit: contain;
		image-rendering: pixelated;
		transition: opacity 0.2s;
	}
	.fighter-name {
		font-size: 10px;
		font-weight: 800;
		color: var(--txt-dim);
		text-align: center;
	}
	.vs-badge {
		font-size: 22px;
		animation: vs-spark 1.2s ease-in-out infinite;
	}
	@keyframes vs-spark {
		0%, 100% { transform: scale(1); opacity: 0.7; }
		50% { transform: scale(1.3); opacity: 1; }
	}
	.scene.conflict { gap: 8px; }

	/* Answer button role coloring */
	.answer-btn.side-a { border-left: 3px solid #3b82f6; }
	.answer-btn.side-b { border-left: 3px solid #ef4444; }
	.answer-btn.mediate { border-left: 3px solid #f59e0b; }
</style>
