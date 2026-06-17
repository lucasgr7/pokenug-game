<script lang="ts">
	import { onDestroy } from 'svelte';

	let {
		text,
		speaker = 'M1SS1NGN0.',
		isAlly = false,
		inline = false
	}: {
		text: string;
		speaker?: string;
		isAlly?: boolean;
		/** Place the bubble in normal document flow instead of absolute battle positioning. */
		inline?: boolean;
	} = $props();

	let shown = $state('');
	let typing = $state(true);

	const isNarrator = $derived(speaker === 'NARRADOR');

	let i = 0;
	const iv = setInterval(() => {
		i++;
		shown = text.slice(0, i);
		if (i >= text.length) {
			clearInterval(iv);
			typing = false;
		}
	}, 80);

	onDestroy(() => clearInterval(iv));
</script>

<div class="speech-wrap" class:ally={isAlly} class:narrator={isNarrator} class:inline={inline}>
	<div class="speech-bubble" class:ally={isAlly} class:narrator={isNarrator}>
		<div class="speech-name" class:ally={isAlly} class:narrator={isNarrator}>
			{speaker}
		</div>
		<div class="speech-text">
			{#if isNarrator}{shown}{#if typing}<span class="speech-cursor"></span>{/if}{:else}&ldquo;{shown}{#if typing}<span class="speech-cursor" class:ally={isAlly}></span>{/if}&rdquo;{/if}
		</div>
	</div>
</div>

<style>
	.speech-wrap {
		position: absolute;
		z-index: 25;
		top: 56px;
		right: 14px;
		max-width: 178px;
		animation: bubbleIn 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}
	.speech-wrap.ally {
		left: 14px;
		right: auto;
	}
	.speech-wrap.narrator {
		left: 18px;
		right: 18px;
		top: auto;
		bottom: 116px;
		max-width: none;
	}
	/* Normal-flow placement (e.g. relationship page) — overrides the absolute battle layout. */
	.speech-wrap.inline,
	.speech-wrap.inline.ally,
	.speech-wrap.inline.narrator {
		position: relative;
		top: auto;
		left: auto;
		right: auto;
		bottom: auto;
		max-width: 280px;
		margin: 0 auto;
	}
	@keyframes bubbleIn {
		from { opacity: 0; transform: scale(0.72) translateY(10px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.speech-bubble {
		background: linear-gradient(145deg, rgba(16, 6, 28, 0.97), rgba(8, 3, 16, 0.99));
		border: 1px solid rgba(175, 18, 42, 0.6);
		border-radius: 4px 14px 14px 14px;
		padding: 9px 13px 10px;
		position: relative;
		box-shadow:
			0 8px 28px rgba(0, 0, 0, 0.78),
			0 0 22px rgba(175, 18, 42, 0.12),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}
	.speech-bubble.ally {
		border-radius: 14px 4px 14px 14px;
		border-color: rgba(18, 140, 140, 0.55);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6), 0 0 20px rgba(18, 140, 140, 0.1);
		margin-left: auto;
	}
	.speech-bubble.narrator {
		border-radius: 12px;
		border-color: rgba(255, 255, 255, 0.16);
		background: linear-gradient(145deg, rgba(10, 8, 18, 0.97), rgba(6, 4, 12, 0.99));
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.72);
		text-align: center;
	}
	.speech-bubble.narrator::before,
	.speech-bubble.narrator::after {
		content: none;
	}

	.speech-bubble::before {
		content: '';
		position: absolute;
		top: 12px;
		left: -12px;
		border-top: 6px solid transparent;
		border-bottom: 6px solid transparent;
		border-right: 12px solid rgba(175, 18, 42, 0.6);
	}
	.speech-bubble.ally::before {
		left: auto;
		right: -12px;
		border-right: none;
		border-left: 12px solid rgba(18, 140, 140, 0.55);
	}

	.speech-bubble::after {
		content: '';
		position: absolute;
		top: 13px;
		left: -9px;
		border-top: 5px solid transparent;
		border-bottom: 5px solid transparent;
		border-right: 9px solid rgba(10, 3, 18, 0.98);
	}
	.speech-bubble.ally::after {
		left: auto;
		right: -9px;
		border-right: none;
		border-left: 9px solid rgba(3, 10, 18, 0.98);
	}

	.speech-name {
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #ff4d62;
		margin-bottom: 5px;
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.speech-name::before {
		content: '▣';
		font-size: 7px;
	}
	.speech-name.ally {
		color: #3ad6c2;
	}
	.speech-name.ally::before {
		content: none;
	}
	.speech-name.ally::after {
		content: '▣';
		font-size: 7px;
	}
	.speech-name.narrator {
		color: #9b94b8;
		justify-content: center;
		letter-spacing: 0.2em;
	}
	.speech-name.narrator::before {
		content: none;
	}

	.speech-text {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.5;
		color: rgba(228, 222, 252, 0.88);
		font-style: italic;
		text-wrap: pretty;
	}

	.speech-cursor {
		display: inline-block;
		width: 2px;
		height: 11px;
		background: #ff4d62;
		margin-left: 2px;
		vertical-align: middle;
		animation: blink 0.65s step-end infinite;
	}
	.speech-cursor.ally {
		background: #3ad6c2;
	}
	@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
</style>
