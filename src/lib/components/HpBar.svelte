<script lang="ts">
	import { clamp } from '$lib/utils/math';

	let {
		hp,
		maxHp,
		block = 0
	}: { hp: number; maxHp: number; block?: number } = $props();

	let total = $derived(maxHp + Math.max(0, block));
	let hpPct = $derived(total > 0 ? clamp((hp / total) * 100, 0, 100) : 0);
	let blockPct = $derived(total > 0 ? clamp((Math.max(0, block) / total) * 100, 0, 100) : 0);
	let low = $derived(maxHp > 0 && hp / maxHp < 0.25);
	let crit = $derived(maxHp > 0 && hp / maxHp < 0.15);

	let fillGradient = $derived(
		crit
			? 'linear-gradient(180deg, #ff8f8f, #ff4d4d 60%, #c62f2f)'
			: low
				? 'linear-gradient(180deg, #ffb36b, #ff7a3d 60%, #d2541f)'
				: 'linear-gradient(180deg, var(--good-2), var(--good) 60%, #2f9a44)'
	);
</script>

<div class="hpbar-root">
	<div class="fill" class:crit class:low style="width:{hpPct}%; background:{fillGradient};"></div>
	{#if block > 0}
		<div
			class="block-fill"
			style="left:{hpPct}%; width:{blockPct}%;"
		></div>
	{/if}
	<div class="shine" aria-hidden="true"></div>
	<div class="label">
		{Math.ceil(hp)} / {maxHp}{#if block > 0}&nbsp;· 🛡{block}{/if}
	</div>
</div>

<style>
	.hpbar-root {
		position: relative;
		height: 18px;
		border-radius: 9px;
		background: #0c0c11;
		border: 1px solid #000;
		overflow: hidden;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.7);
		width: 100%;
	}
	.fill {
		position: absolute;
		inset: 0;
		border-radius: 9px;
		transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -3px 6px rgba(0, 0, 0, 0.25);
	}
	.fill.low {
		animation: hp-pulse 0.9s ease-in-out infinite;
	}
	.block-fill {
		position: absolute;
		top: 0;
		height: 100%;
		background: linear-gradient(180deg, #93c5fd, #2563eb 60%, #1d4ed8);
		transition: width 0.3s ease-out, left 0.3s ease-out;
	}
	.shine {
		position: absolute;
		top: 0;
		left: 0;
		height: 50%;
		width: 100%;
		border-radius: 9px 9px 0 0;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent);
		pointer-events: none;
	}
	.label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.6);
		letter-spacing: 0.3px;
	}
	@keyframes hp-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.55; }
	}
</style>
