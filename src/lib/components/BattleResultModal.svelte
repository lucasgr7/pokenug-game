<script lang="ts">
	import { onMount } from 'svelte';
	import Card from './Card.svelte';
	import CardDetailsModal from './CardDetailsModal.svelte';
	import { playResultSfx } from '$lib/game/music.svelte';
	import { ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import { formatNumber } from '$lib/utils/math';
	import type { BattleReward, CapturedPokemon } from '$lib/game/types';
	import { _ } from 'svelte-i18n';

	function seededRNG(seed: number) {
		let s = seed >>> 0;
		return () => {
			s = (Math.imul(1664525, s) + 1013904223) >>> 0;
			return s / 0x100000000;
		};
	}

	interface Particle {
		id: number;
		kind: 'star' | 'rect' | 'orb';
		x: number;
		y: number;
		color: string;
		size: number;
		delay: number;
		dur: number;
		rot: number;
	}

	function genParticles(variant: string, seed = 42): Particle[] {
		const rng = seededRNG(seed);
		const p: Particle[] = [];
		const gold = '#ffd884';
		const purple = '#c9a3ff';
		const teal = '#6fe6d4';
		const white = '#ffffff';
		const red = '#ff6e6e';
		const grey = '#9a9bab';

		if (variant === 'win') {
			const colors = [gold, gold, white, teal];
			for (let i = 0; i < 24; i++) {
				p.push({ id: i, kind: 'star', x: 5 + rng() * 90, y: 5 + rng() * 82, color: colors[i % colors.length], size: 10 + rng() * 14, delay: rng() * 700, dur: 900 + rng() * 600, rot: rng() * 360 });
			}
			for (let i = 24; i < 40; i++) {
				p.push({ id: i, kind: 'rect', x: 5 + rng() * 90, y: 2 + rng() * 20, color: colors[i % colors.length], size: 5 + rng() * 7, delay: rng() * 500, dur: 1200 + rng() * 800, rot: rng() * 360 });
			}
		} else if (variant === 'capture') {
			const colors = [purple, purple, white, teal];
			for (let i = 0; i < 12; i++) {
				p.push({ id: i, kind: 'star', x: 5 + rng() * 90, y: 5 + rng() * 82, color: colors[i % colors.length], size: 10 + rng() * 12, delay: rng() * 700, dur: 900 + rng() * 600, rot: rng() * 360 });
			}
			for (let i = 12; i < 32; i++) {
				p.push({ id: i, kind: 'orb', x: 5 + rng() * 90, y: 5 + rng() * 82, color: colors[i % colors.length], size: 6 + rng() * 10, delay: rng() * 600, dur: 1200 + rng() * 500, rot: 0 });
			}
		} else if (variant === 'boss') {
			const colors = [gold, white, teal, purple];
			for (let i = 0; i < 36; i++) {
				p.push({ id: i, kind: 'star', x: 5 + rng() * 90, y: 5 + rng() * 82, color: colors[i % colors.length], size: 10 + rng() * 16, delay: rng() * 700, dur: 900 + rng() * 600, rot: rng() * 360 });
			}
			for (let i = 36; i < 62; i++) {
				p.push({ id: i, kind: 'rect', x: 5 + rng() * 90, y: 2 + rng() * 20, color: colors[i % colors.length], size: 5 + rng() * 7, delay: rng() * 500, dur: 1200 + rng() * 800, rot: rng() * 360 });
			}
			for (let i = 62; i < 78; i++) {
				p.push({ id: i, kind: 'orb', x: 5 + rng() * 90, y: 5 + rng() * 82, color: colors[i % colors.length], size: 7 + rng() * 10, delay: rng() * 600, dur: 1200 + rng() * 500, rot: 0 });
			}
		} else {
			for (let i = 0; i < 10; i++) {
				p.push({ id: i, kind: 'rect', x: 5 + rng() * 90, y: 2 + rng() * 10, color: i % 2 === 0 ? red : grey, size: 4 + rng() * 6, delay: rng() * 600, dur: 1000 + rng() * 600, rot: rng() * 360 });
			}
		}
		return p;
	}

	let { variant, reward, captured, enemyName, onDismiss, onClaimCard, silent = false }: {
		variant: 'win' | 'boss' | 'capture' | 'defeat';
		reward: BattleReward | null;
		captured: CapturedPokemon | null;
		enemyName: string;
		silent?: boolean;
		onDismiss: () => void;
		onClaimCard?: (templateId: string) => void;
	} = $props();

	let claimedId = $state<string | null>(null);
	let inspectingTemplateId = $state<string | null>(null);

	let particles = $derived(genParticles(variant));

	let desc = $derived(
		variant === 'defeat' ? $_('battle.result.descDefeat')
		: variant === 'capture' ? $_('battle.result.descCapture', { values: { name: enemyName } })
		: $_('battle.result.descWin', { values: { name: enemyName } })
	);

	const VARIANTS = $derived({
		win: {
			title: $_('battle.result.win'),
			titleSize: 36,
			titleColor: '#ffd884',
			titleGrad: null,
			pillLabel: $_('battle.result.pillWin'),
			pillColor: '#ffd884',
			accentColor: '#ffd884',
			borderColor: 'rgba(255,216,132,.22)',
			topGlow: 'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,216,132,.16) 0%, transparent 68%)',
			shadow: '0 36px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(255,216,132,.06)',
			isBoss: false,
			btnBg: '#ffd884',
			btnText: '#0c0a14',
			btnLabel: $_('battle.result.btnContinue'),
			btnShadow: 'rgba(255,216,132,.42)'
		},
		boss: {
			title: $_('battle.result.boss'),
			titleSize: 34,
			titleColor: '#ffd884',
			titleGrad: 'linear-gradient(180deg, #ffd884, #ff7a3d)',
			pillLabel: $_('battle.result.pillBoss'),
			pillColor: '#ff7a3d',
			accentColor: '#ffd884',
			borderColor: 'rgba(255,216,132,.28)',
			topGlow: 'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,216,132,.2) 0%, rgba(255,122,61,.08) 40%, transparent 68%)',
			shadow: '0 36px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(255,216,132,.08)',
			isBoss: true,
			btnBg: 'linear-gradient(135deg, #ffd884, #ff7a3d)',
			btnText: '#0c0a14',
			btnLabel: $_('battle.result.btnContinue'),
			btnShadow: 'rgba(255,216,132,.5)'
		},
		capture: {
			title: $_('battle.result.capture'),
			titleSize: 36,
			titleColor: '#c9a3ff',
			titleGrad: null,
			pillLabel: $_('battle.result.pillCapture'),
			pillColor: '#c9a3ff',
			accentColor: '#c9a3ff',
			borderColor: 'rgba(201,163,255,.22)',
			topGlow: 'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(201,163,255,.16) 0%, transparent 68%)',
			shadow: '0 36px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(201,163,255,.06)',
			isBoss: false,
			btnBg: '#c9a3ff',
			btnText: '#0c0a14',
			btnLabel: $_('battle.result.btnContinue'),
			btnShadow: 'rgba(201,163,255,.42)'
		},
		defeat: {
			title: $_('battle.result.defeat'),
			titleSize: 34,
			titleColor: '#ff6e6e',
			titleGrad: null,
			pillLabel: $_('battle.result.pillDefeat'),
			pillColor: '#ff6e6e',
			accentColor: '#ff6e6e',
			borderColor: 'rgba(255,110,110,.22)',
			topGlow: 'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,90,90,.14) 0%, transparent 68%)',
			shadow: '0 36px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(255,90,90,.06)',
			isBoss: false,
			btnBg: '#2b2c38',
			btnText: '#f3f3f7',
			btnLabel: $_('battle.result.btnMap'),
			btnShadow: 'rgba(0,0,0,.4)'
		}
	});

	let cfg = $derived(VARIANTS[variant]);

	onMount(() => { if (!silent) playResultSfx(variant); });
</script>

{#key variant}
	<div class="modal-backdrop" onclick={onDismiss} role="presentation"></div>
	<div class="modal-card" style="box-shadow: {cfg.shadow};">
		<div class="top-glow" style="background: {cfg.topGlow};"></div>

		{#if cfg.isBoss}
			<div class="boss-rays" aria-hidden="true">
				<div class="ray-layer ray-cw"></div>
				<div class="ray-layer ray-ccw"></div>
			</div>
		{/if}

		<div class="particle-layer">
			{#each particles as p (p.id)}
				<span
					class="particle {p.kind}"
					style="left: {p.x}%; top: {p.y}%; color: {p.color}; background: {p.kind === 'rect' ? p.color : 'transparent'}; width: {p.size}px; height: {p.kind === 'rect' ? p.size * 0.6 : p.size}px; animation-delay: {p.delay}ms; animation-duration: {p.dur}ms; --rot: {p.rot}deg;"
				>
					{#if p.kind === 'star'}★{/if}
				</span>
			{/each}
		</div>

		<button class="close-btn" onclick={onDismiss} aria-label={$_('battle.result.close')}>✕</button>

		{#if cfg.isBoss}
			<div class="boss-ring-1"></div>
			<div class="boss-ring-2"></div>
		{/if}

		<div class="content">
			<!-- Icon -->
			<div class="icon-wrap" style="--accent: {cfg.accentColor};">
				{#if variant === 'win'}
					<svg class="result-icon" width="90" height="90" viewBox="0 0 90 90" aria-hidden="true">
						<circle cx="45" cy="45" r="42" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.22" />
						<path d="M45 16c-8 0-14 4-16 10l-4 10c-1 3 0 6 2 8l18 18 18-18c2-2 3-5 2-8l-4-10c-2-6-8-10-16-10z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
						<path d="M35 28h20l-4 8-6 10-6-10-4-8z" fill="currentColor" opacity="0.22" />
						<path d="M32 42l13 13 13-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<path d="M45 42v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						<circle cx="45" cy="40" r="2" fill="currentColor" />
						<path d="M30 56h30v4H30z" fill="currentColor" opacity="0.33" />
						<path d="M20 22a4 4 0 0 1 8 0v4h-4a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="0.5" />
						<path d="M62 22a4 4 0 0 0-8 0v4h4a4 4 0 0 0 4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="0.5" />
					</svg>
				{:else if variant === 'capture'}
					<svg class="result-icon capture-orb" width="90" height="90" viewBox="0 0 90 90" aria-hidden="true">
						<circle cx="45" cy="45" r="42" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.22" />
						<circle cx="45" cy="45" r="28" fill="none" stroke="currentColor" stroke-width="2" opacity="0.33" />
						<circle cx="45" cy="45" r="14" fill="currentColor" opacity="0.15" />
						<circle cx="45" cy="45" r="5" fill="currentColor" opacity="0.6" />
						<circle cx="45" cy="45" r="3" fill="#fff" opacity="0.7" />
						<path d="M17 45h16M57 45h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.5" />
						<path d="M28 28l8 8M54 54l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.33" />
						<path d="M62 28l-8 8M36 54l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.33" />
					</svg>
				{:else if variant === 'boss'}
					<svg class="result-icon" width="90" height="90" viewBox="0 0 90 90" aria-hidden="true">
						<circle cx="45" cy="45" r="42" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.22" />
						<path d="M22 62l4-26 8 8 11-12 11 12 8-8 4 26H22z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
						<circle cx="36" cy="50" r="3" fill="currentColor" opacity="0.8" />
						<circle cx="45" cy="42" r="3" fill="currentColor" opacity="0.8" />
						<circle cx="54" cy="50" r="3" fill="currentColor" opacity="0.8" />
						<path d="M28 62v4h34v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5" />
						<path d="M32 66h26v2H32z" fill="currentColor" opacity="0.25" />
						<circle cx="36" cy="50" r="6" fill="none" stroke="#ff7a3d" stroke-width="1" opacity="0.5" />
						<circle cx="54" cy="50" r="6" fill="none" stroke="#6fe6d4" stroke-width="1" opacity="0.5" />
						<path d="M45 38v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4" />
					</svg>
				{:else}
					<svg class="result-icon" width="90" height="90" viewBox="0 0 90 90" aria-hidden="true">
						<circle cx="45" cy="45" r="42" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.15" />
						<path d="M30 35c0-8 12-8 12 0 0 12-12 8-12 20h24c0-12-12-8-12-20 0-8 12-8 12 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M28 58c0 4 34 4 34 0" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4" stroke-linecap="round" />
					</svg>
				{/if}
			</div>

			<!-- Pill label -->
			<div class="pill" style="color: {cfg.pillColor}; border-color: {cfg.pillColor};">
				{cfg.pillLabel}
			</div>

			<!-- Title -->
			<div
				class="title"
				style="font-size: {cfg.titleSize}px; color: {cfg.titleColor}; background: {cfg.titleGrad ?? 'none'};"
			>
				{cfg.title}
			</div>

			<!-- Description -->
			<div class="desc">{desc}</div>

			<!-- Divider -->
			<div class="divider"></div>

			<!-- Reward rows -->
			<div class="rewards">
				{#if reward}
					{#if reward.money > 0}
						<div class="reward-row">
							<div class="reward-label">💰 {$_( 'battle.result.rewardMoney' )}</div>
							<div class="reward-value">{formatNumber(reward.money)}</div>
						</div>
					{/if}
					{#if reward.elementPoints.amount > 0}
						<div class="reward-row">
							<div class="reward-label">{ELEMENT_EMOJI[reward.elementPoints.type]} {$_('elements.' + reward.elementPoints.type)}</div>
							<div class="reward-value">+{reward.elementPoints.amount}</div>
						</div>
					{/if}
					{#if reward.cardReward}
						<div class="reward-row">
							<div class="reward-label">🃏 {$_( 'battle.result.rewardCard' )}</div>
							<div class="reward-value">{reward.cardReward.name} ({reward.cardReward.rarity})</div>
						</div>
						<div class="reward-card">
							<Card templateId={reward.cardReward.templateId} compact />
						</div>
					{:else if variant !== 'defeat' && reward.cardChoices.length > 0}
						<div class="reward-row">
							<div class="reward-label">🃏 {$_( 'battle.result.rewardChoose' )}</div>
						</div>
						<div class="card-choices">
							{#each reward.cardChoices as choice (choice.templateId)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="choice-btn"
									class:claimed={claimedId !== null}
									role="button"
									tabindex="0"
									oncontextmenu={(e) => { e.preventDefault(); inspectingTemplateId = choice.templateId; }}
									onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (claimedId) return; claimedId = choice.templateId; onClaimCard?.(choice.templateId); } }}
								>
									<Card
										templateId={choice.templateId}
										compact
										playable={claimedId === null}
										onclick={() => {
											if (claimedId) return;
											claimedId = choice.templateId;
											onClaimCard?.(choice.templateId);
										}}
										onlongpress={() => { inspectingTemplateId = choice.templateId; }}
									/>
									<span class="choice-rarity">{choice.rarity}</span>
								</div>
							{/each}
						</div>
						{#if claimedId === null}
							<div class="forfeit-hint">{$_( 'battle.result.forfeitHint' )}</div>
						{/if}
					{/if}
					{#if reward.unlockedRegionName}
						<div class="reward-row highlight">
							<div class="reward-label">🗺️ {$_( 'battle.result.rewardNewRegion' )}</div>
							<div class="reward-value">{reward.unlockedRegionName}</div>
						</div>
					{/if}
				{/if}
				{#if variant === 'capture' && captured}
					<div class="reward-row highlight">
						<div class="reward-label">🐾 {$_( 'battle.result.rewardPokemon' )}</div>
						<div class="reward-value">{captured.name}</div>
					</div>
				{/if}
			</div>

			<!-- CTA -->
			<button class="cta" style="background: {cfg.btnBg}; color: {cfg.btnText}; box-shadow: 0 8px 24px -6px {cfg.btnShadow};" onclick={onDismiss}>
				{cfg.btnLabel}
			</button>
		</div>
	</div>
{/key}

<CardDetailsModal
	templateId={inspectingTemplateId}
	open={!!inspectingTemplateId}
	onclose={() => (inspectingTemplateId = null)}
/>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(5, 4, 12, 0.84);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		animation: backdropIn 0.3s ease both;
	}

	.modal-card {
		position: fixed;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		z-index: 101;
		width: 90vw;
		max-width: 372px;
		border-radius: 26px;
		background: linear-gradient(180deg, #0d0b16, #14111f);
		overflow: hidden;
		animation: modalIn 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	.top-glow {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 180px;
		pointer-events: none;
		z-index: 0;
	}

	.boss-rays {
		position: absolute;
		inset: -40%;
		z-index: 0;
		pointer-events: none;
	}
	.ray-layer {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: conic-gradient(from 0deg, transparent, rgba(255,216,132,.06), transparent 25%, rgba(255,216,132,.06), transparent 50%, rgba(255,122,61,.04), transparent 75%, rgba(255,216,132,.06), transparent);
	}
	.ray-cw { animation: spinCw 20s linear infinite; }
	.ray-ccw { animation: spinCcw 28s linear infinite; }

	.particle-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		z-index: 1;
		pointer-events: none;
	}
	.particle {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		will-change: transform, opacity;
	}
	.particle.star {
		font-size: 14px;
		line-height: 1;
		animation: floatUp both ease-out;
	}
	.particle.rect {
		border-radius: 2px;
		animation: confettiFall both ease-in;
	}
	.particle.orb {
		box-shadow: 0 0 6px currentColor;
		animation: floatUp both ease-out;
	}

	.close-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 5;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: rgba(255,255,255,0.06);
		color: rgba(255,255,255,0.5);
		font-size: 16px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}
	.close-btn:hover { background: rgba(255,255,255,0.12); }

	.boss-ring-1, .boss-ring-2 {
		position: absolute;
		top: 50%;
		left: 50%;
		translate: -50% -50%;
		border-radius: 50%;
		border: 1.5px solid rgba(255,216,132,.15);
		pointer-events: none;
		z-index: 0;
	}
	.boss-ring-1 {
		width: 160px;
		height: 160px;
		animation: ringPulse 0.8s 0.1s both ease-out;
	}
	.boss-ring-2 {
		width: 210px;
		height: 210px;
		animation: ringPulse 0.8s 0.28s both ease-out;
	}

	.content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 32px 24px 24px;
	}

	.icon-wrap {
		margin-bottom: 10px;
		color: var(--accent);
		animation: orbFloat 3s ease-in-out infinite;
	}
	.result-icon {
		display: block;
		filter: drop-shadow(0 0 12px color-mix(in srgb, var(--accent) 40%, transparent));
	}

	.capture-orb {
		animation: captureShake 0.5s 0.2s both, orbFloat 3s 0.7s ease-in-out infinite;
	}

	.pill {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: 1px solid;
		border-radius: 100px;
		padding: 4px 14px;
		margin-bottom: 8px;
		animation: slideUp 0.4s 0.12s both;
	}

	.title {
		font-family: 'Russo One', -apple-system, system-ui, sans-serif;
		font-weight: 900;
		line-height: 1.1;
		text-align: center;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		margin-bottom: 8px;
		animation: titlePop 0.5s 0.18s both;
	}

	.desc {
		font-size: 14px;
		color: rgba(255,255,255,0.5);
		text-align: center;
		margin-bottom: 16px;
		animation: slideUp 0.4s 0.3s both;
	}

	.divider {
		width: 100%;
		height: 1px;
		background: rgba(255,255,255,0.06);
		margin-bottom: 14px;
		animation: slideUp 0.4s 0.34s both;
	}

	.rewards {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 18px;
	}
	.reward-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(255,255,255,0.038);
		border: 1px solid rgba(255,255,255,0.07);
		border-radius: 13px;
		padding: 10px 14px;
		animation: slideUp 0.4s both;
	}
	.reward-row:nth-child(1) { animation-delay: 0.4s; }
	.reward-row:nth-child(2) { animation-delay: 0.48s; }
	.reward-row:nth-child(3) { animation-delay: 0.57s; }
	.reward-row:nth-child(4) { animation-delay: 0.65s; }
	.reward-row.highlight {
		border-color: rgba(111,230,212,0.2);
		background: rgba(111,230,212,0.06);
	}
	.reward-label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255,255,255,0.65);
	}
	.reward-value {
		font-size: 13px;
		font-weight: 700;
		color: #fff;
	}
	.reward-card {
		width: 110px;
		margin: 0 auto;
		animation: slideUp 0.4s 0.57s both;
	}

	.card-choices {
		display: flex;
		gap: 8px;
		justify-content: center;
		animation: slideUp 0.4s 0.57s both;
	}
	.choice-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 104px;
		transition: transform 0.15s, opacity 0.15s;
		touch-action: manipulation;
		-webkit-touch-callout: none;
		user-select: none;
	}
	.choice-btn.claimed { opacity: 0.5; }
	.choice-rarity {
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--txt-dim, #9a9bab);
	}
	.forfeit-hint {
		text-align: center;
		font-size: 11px;
		color: rgba(255,255,255,0.35);
		margin-top: 4px;
		animation: slideUp 0.4s 0.65s both;
	}

	.cta {
		width: 100%;
		border: none;
		border-radius: 15px;
		padding: 14px;
		font-size: 15px;
		font-weight: 800;
		cursor: pointer;
		transition: transform 0.15s, filter 0.15s;
		animation: slideUp 0.4s 0.68s both;
	}
	.cta:active { transform: scale(0.97); }

	@keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }

	@keyframes modalIn {
		from { opacity: 0; transform: translateY(52px) scale(0.82); }
		to   { opacity: 1; transform: translateY(0) scale(1); }
	}

	@keyframes titlePop {
		0%   { opacity: 0; transform: scale(0.6); }
		65%  { transform: scale(1.06); }
		100% { opacity: 1; transform: scale(1); }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	@keyframes floatUp {
		from { opacity: 1; transform: translateY(0); }
		to   { opacity: 0; transform: translateY(-100px); }
	}

	@keyframes confettiFall {
		0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
		100% { opacity: 0; transform: translateY(80px) rotate(260deg); }
	}

	@keyframes spinCw { to { transform: rotate(360deg); } }
	@keyframes spinCcw { to { transform: rotate(-360deg); } }

	@keyframes orbFloat {
		0%, 100% { transform: translateY(0); }
		50%      { transform: translateY(-6px); }
	}

	@keyframes captureShake {
		0%   { transform: rotate(0); }
		20%  { transform: rotate(-8deg); }
		40%  { transform: rotate(8deg); }
		60%  { transform: rotate(-5deg); }
		80%  { transform: rotate(5deg); }
		100% { transform: rotate(0); }
	}

	@keyframes ringPulse {
		from { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
		to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
	}
</style>
