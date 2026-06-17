<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { t } from '$lib/i18n';
	import Hud from '$lib/components/Hud.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import { REGIONS, getRegion } from '$lib/data/regions';
	import { CHALLENGES } from '$lib/data/challenges';
	import { canFightBoss, getBossCooldownRemainingMs, getRegionProgress } from '$lib/db/regions';
	import { game, activePokemon, normalizedPokemonHp } from '$lib/game/state.svelte';
	import { hasSavedBattle } from '$lib/game/battle.svelte';
	import { getActiveDeck } from '$lib/db/cards';
	import { pushToast } from '$lib/stores/toast.svelte';
	import { formatDuration, isMissingNoWindowOpen } from '$lib/utils/time';
	import { MISSINGNO_REGION } from '$lib/data/missingno';
	import { ELEMENT_COLOR, ELEMENT_EMOJI } from '$lib/game/elements';
	import type { BattleMode, Element } from '$lib/game/types';
	import type { RegionProgress } from '$lib/db/index';

	const MIN_DECK = 8;

	let tab = $state<'explore' | 'challenges'>('explore');
	let progressByRegion = $state<Record<string, RegionProgress>>({});
	let deckSize = $state(0);
	let selectedRegionIdx = $state(0);
	let windowOpen = $state(isMissingNoWindowOpen());

	$effect(() => {
		const iv = setInterval(() => { windowOpen = isMissingNoWindowOpen(); }, 1000);
		return () => clearInterval(iv);
	});

	const activeRegionIdx = $derived.by(() => {
		for (let i = 0; i < REGIONS.length; i++) {
			const p = progressByRegion[REGIONS[i].id];
			if ((game.player?.unlockedRegions.includes(REGIONS[i].id) ?? false) && (!p || p.defeats < REGIONS[i].requiredDefeats)) return i;
		}
		return REGIONS.length - 1;
	});

	onMount(async () => {
		if (await hasSavedBattle()) { await goto('/battle'); return; }
		const entries = await Promise.all(REGIONS.map(async (r) => [r.id, await getRegionProgress(r.id)] as const));
		progressByRegion = Object.fromEntries(entries);
		const deck = await getActiveDeck();
		deckSize = deck.length;
		selectedRegionIdx = activeRegionIdx;
	});

	const region = $derived(REGIONS[selectedRegionIdx]);
	const prog = $derived(progressByRegion[region?.id]);
	const defs = $derived(prog?.defeats ?? 0);
	const req = $derived(region?.requiredDefeats ?? 10);
	const remaining = $derived(req - defs);
	const bossReady = $derived(region ? canFightBoss(prog ?? { defeats: 0, bossLastDefeatedAt: 0, bossFirstFightDone: false }, Date.now()) : false);
	const bossCooldown = $derived(region ? getBossCooldownRemainingMs(prog ?? { defeats: 0, bossLastDefeatedAt: 0, bossFirstFightDone: false }, Date.now()) : 0);

// ── Per‑region trail waypoints ──────────────────────────────────────────
interface Pt { x: number; y: number }
const REGION_TRAILS: Pt[][] = [
	[ // 0 Verdant Forest — gentle S‑curve
		{x:55,y:225},{x:55,y:165},{x:90,y:105},{x:140,y:80},{x:190,y:90},
		{x:230,y:105},{x:260,y:90},{x:275,y:60},{x:282,y:30},{x:285,y:120},{x:285,y:225}
	],
	[ // 1 Ember Cave — sharp zigzag
		{x:55,y:225},{x:60,y:185},{x:130,y:175},{x:100,y:130},{x:160,y:100},
		{x:215,y:80},{x:175,y:50},{x:230,y:30},{x:270,y:55},{x:270,y:140},{x:270,y:225}
	],
	[ // 2 Crystal Lake — fluid low‑wave
		{x:55,y:225},{x:65,y:195},{x:100,y:210},{x:130,y:185},{x:155,y:200},
		{x:185,y:180},{x:215,y:195},{x:245,y:170},{x:270,y:185},{x:282,y:200},{x:285,y:225}
	],
	[ // 3 Thunder Plant — angular staircase
		{x:55,y:225},{x:55,y:185},{x:55,y:150},{x:120,y:150},{x:120,y:110},
		{x:120,y:75},{x:180,y:75},{x:180,y:40},{x:240,y:40},{x:240,y:40},{x:285,y:225}
	],
	[ // 4 Rocky Ridge — mountain peak
		{x:55,y:225},{x:70,y:190},{x:110,y:175},{x:140,y:150},{x:170,y:120},
		{x:185,y:80},{x:170,y:45},{x:155,y:70},{x:200,y:95},{x:240,y:140},{x:285,y:225}
	],
	[ // 5 Psychic Tower — loop / figure‑8
		{x:55,y:225},{x:80,y:185},{x:135,y:175},{x:170,y:195},{x:170,y:150},
		{x:170,y:105},{x:135,y:85},{x:80,y:95},{x:110,y:55},{x:200,y:55},{x:285,y:225}
	],
];

function interpPath(pts: Pt[], count: number): Pt[] {
	if (pts.length === 0) return [];
	const path: Pt[] = [];
	for (let i = 0; i < count; i++) {
		const t = i / (count - 1);
		const totalLen = pts.length - 1;
		const idx = Math.min(Math.floor(t * totalLen), totalLen - 1);
		const frac = (t * totalLen) - idx;
		path.push({
			x: pts[idx].x + (pts[idx + 1].x - pts[idx].x) * frac,
			y: pts[idx].y + (pts[idx + 1].y - pts[idx].y) * frac,
		});
	}
	return path;
}

function trailSvgPath(pts: Pt[]): string {
	return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
}

	const isUnlocked = $derived(game.player?.unlockedRegions.includes(region?.id ?? '') ?? false);
	const activePkm = $derived(activePokemon());
	const trailIdx = $derived(Math.min(selectedRegionIdx, REGION_TRAILS.length - 1));
	const tPts = $derived(REGION_TRAILS[trailIdx]);
	const pathD = $derived(trailSvgPath(tPts));

	const NODES = $derived.by(() => {
		if (!region) return [];
		const ti = Math.min(selectedRegionIdx, REGION_TRAILS.length - 1);
		const pts = interpPath(REGION_TRAILS[ti], req + 1);
		return pts.map((p, i) => ({
			x: p.x, y: p.y, idx: i,
			isBoss: i === pts.length - 1,
			done: i < defs,
			current: i === defs && i < pts.length - 1,
			locked: i > defs
		}));
	});

	const doneCount = $derived(Math.min(defs, NODES.length - 1));

	function allRegionsCompleted(): boolean {
		return REGIONS.every((r) => {
			const p = progressByRegion[r.id];
			return p && p.defeats >= r.requiredDefeats && p.bossLastDefeatedAt > 0;
		});
	}

	function challengeIsLocked(c: { unlockRegionId: string | null }): boolean {
		if (!c.unlockRegionId) return false;
		const r = getRegion(c.unlockRegionId);
		return r ? (progressByRegion[c.unlockRegionId]?.defeats ?? 0) < r.requiredDefeats : false;
	}

	async function enter(regionId: string, mode: BattleMode = 'normal') {
		const region = getRegion(regionId);
		if (!region || !(game.player?.unlockedRegions.includes(regionId) ?? false)) return;
		const latestProgress = await getRegionProgress(regionId);
		progressByRegion[regionId] = latestProgress;
		if (mode === 'boss') {
			if (latestProgress.defeats < region.requiredDefeats || !canFightBoss(latestProgress, Date.now())) {
				const rem = getBossCooldownRemainingMs(latestProgress, Date.now());
				pushToast(rem > 0 ? t('map.bossCooldownMsg', { duration: formatDuration(rem) }) : t('map.needMoreDefeats'), 'error');
				return;
			}
		}
		if (!game.player?.activePokemonId) { pushToast(t('map.selectPokemonFirst'), 'error'); return; }
		const pkm = game.roster.find((p) => p.id === game.player?.activePokemonId);
		if (pkm && normalizedPokemonHp(pkm) <= 0) { pushToast(t('map.pokemonFainted'), 'error'); return; }
		const deck = await getActiveDeck();
		if (deck.length < MIN_DECK) { pushToast(t('map.deckTooSmall', { min: MIN_DECK }), 'error'); await goto('/deck'); return; }
		await goto(`/battle?region=${regionId}&mode=${mode}`);
	}
</script>

<Hud />

<main class="px-4 py-4">
	<!-- Region pills -->
	<div class="region-strip">
		{#each REGIONS as r, i (r.id)}
			<button
				class="region-pill"
				class:active={i === selectedRegionIdx}
				class:unlocked={game.player?.unlockedRegions.includes(r.id)}
				style={game.player?.unlockedRegions.includes(r.id) ? `--rc: ${ELEMENT_COLOR[r.types[0]]}` : ''}
				onclick={() => { if (game.player?.unlockedRegions.includes(r.id)) selectedRegionIdx = i; }}
				disabled={!game.player?.unlockedRegions.includes(r.id)}
			>
				{r.emoji}
				<span>{$_('regions.' + r.id + '.name').split(' ')[0]}</span>
			</button>
		{/each}
	</div>

	{#if tab === 'explore'}
		{@const elColor = region ? ELEMENT_COLOR[region.types[0]] : '#666'}

		{#if !region || !isUnlocked}
			<div class="empty-state">
				<span class="text-3xl">🔒</span>
				<p class="text-sm text-(--text-muted)">Região bloqueada</p>
			</div>
		{:else}
			<!-- SVG World Map -->
			<div class="map-canvas-wrap">
				<svg class="map-canvas" viewBox="0 0 340 260" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="pathGrad" x1="0" y1="0" x2="1" y2="0">
							<stop offset="0" stop-color={elColor} stop-opacity="0.35" />
							<stop offset="1" stop-color={elColor} stop-opacity="0.15" />
						</linearGradient>
						<filter id="nodeGlow">
							<feGaussianBlur stdDeviation="3" result="blur" />
							<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
						</filter>
					</defs>

					<!-- Trail path -->
					<path d={pathD} fill="none" stroke="var(--surface-2)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
					<path d={pathD} fill="none" stroke={elColor} stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
						stroke-dasharray={tPts.length * 24}
						stroke-dashoffset={(tPts.length - doneCount) * 24}
						style="transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);" />

					<!-- Nodes -->
					{#each NODES as node, i (i)}
						{@const st = node.done ? 'done' : node.current ? 'current' : node.locked ? 'locked' : 'normal'}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<g class="map-node" role="button" tabindex="-1" onclick={() => enter(region.id, node.isBoss ? 'boss' : 'normal')} style="cursor: pointer;">
							<!-- Glow ring for current/boss -->
							{#if node.current}
								<circle cx={node.x} cy={node.y} r="22" fill="none" stroke={elColor} stroke-width="1.5" opacity="0.25" filter="url(#nodeGlow)">
									<animate attributeName="r" values="20;24;20" dur="2s" repeatCount="indefinite" />
									<animate attributeName="opacity" values="0.25;0.05;0.25" dur="2s" repeatCount="indefinite" />
								</circle>
							{/if}

							<!-- Node circle -->
							<circle cx={node.x} cy={node.y} r={node.isBoss ? 18 : 13}
								fill={node.done ? elColor : node.current ? 'var(--surface)' : 'var(--surface-2)'}
								stroke={node.done ? elColor : node.current ? elColor : 'var(--surface-2)'}
								stroke-width="2.5"
								style="transition: fill 0.3s, stroke 0.3s;" />

							<!-- Checkmark for done -->
							{#if node.done && !node.isBoss}
								<text x={node.x} y={node.y + 1} text-anchor="middle" dominant-baseline="middle"
									fill="#fff" font-size="10" font-weight="900">✓</text>
							{/if}

							<!-- Boss icon -->
							{#if node.isBoss}
								<text x={node.x} y={node.y + 1} text-anchor="middle" dominant-baseline="middle"
									fill={defs >= req ? '#ffc24a' : 'var(--text-muted)'} font-size="16">👑</text>
							{/if}

							<!-- Current pulsing dot -->
							{#if node.current}
								<circle cx={node.x} cy={node.y} r="5" fill={elColor}>
									<animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
									<animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
								</circle>
							{/if}

							<!-- Locked X -->
							{#if node.locked}
								<text x={node.x} y={node.y + 1} text-anchor="middle" dominant-baseline="middle"
									fill="var(--text-muted)" font-size="9" opacity="0.5">🔒</text>
							{/if}
						</g>
					{/each}
				</svg>
			</div>

			<!-- Quick stats + Battle button -->
			<div class="action-card" style="--ac: {elColor};">
				<div class="action-top">
					<div class="action-pkm">
						{#if activePkm}
							<div class="action-sprite">
								<Sprite speciesId={activePkm.speciesId} size={40} alt={activePkm.name} />
							</div>
							<div class="action-pkm-info">
								<div class="action-pkm-name">{activePkm.name}</div>
								<div class="action-pkm-el" style="color: {ELEMENT_COLOR[activePkm.element]}">
									{ELEMENT_EMOJI[activePkm.element]} {activePkm.element}
								</div>
							</div>
						{:else}
							<div class="action-pkm-info">
								<div class="action-pkm-name">Sem Pokémon</div>
								<div class="action-pkm-el">Selecione um líder</div>
							</div>
						{/if}
					</div>
					<div class="action-progress">
						<div class="action-progress-num">{defs}/{req}</div>
						<div class="action-progress-label">vitórias</div>
					</div>
				</div>

				<div class="action-bar-track">
					<div class="action-bar-fill" style="width: {req > 0 ? (defs / req) * 100 : 0}%; background: {elColor};"></div>
				</div>

				<button
					class="action-btn"
					class:boss={defs >= req && bossReady}
					class:cooldown={defs >= req && !bossReady}
					disabled={!activePkm || deckSize < MIN_DECK || (defs >= req && !bossReady)}
					onclick={() => enter(region.id, defs >= req ? 'boss' : 'normal')}
				>
					{#if defs >= req}
						{bossReady ? '⚔️ Lutar contra o Chefão' : `⏱ Chefão em ${formatDuration(bossCooldown)}`}
					{:else}
						⚔️ Batalhar ({remaining} restantes)
					{/if}
				</button>
			</div>
		{/if}

		<!-- Secret MissingNo -->
		{#if import.meta.env.DEV || (allRegionsCompleted() && windowOpen)}
			<button class="mn-btn" onclick={async () => {
				if (!game.player?.activePokemonId) { pushToast(t('map.selectPokemonFirst'), 'error'); return; }
				const pkm = game.roster.find((p) => p.id === game.player?.activePokemonId);
				if (pkm && normalizedPokemonHp(pkm) <= 0) { pushToast(t('map.pokemonFainted'), 'error'); return; }
				const deck = await getActiveDeck();
				if (deck.length < MIN_DECK) { pushToast(t('map.deckTooSmall', { min: MIN_DECK }), 'error'); await goto('/deck'); return; }
				await goto('/battle?region=missingno&mode=missingno');
			}}>
				<div class="mn-glow"></div>
				<div class="mn-inner">
					<div class="mn-emoji">👾</div>
					<div class="mn-name">???</div>
					<div class="mn-desc">{$_('map.missingnoDesc')}</div>
				</div>
			</button>
		{/if}

	{:else}
		<!-- Challenges Tab (simplified) -->
		<div class="ch-section">
			<div class="ch-intro-title">{$_('map.challengesTitle')}</div>
			<div class="ch-list">
				{#each CHALLENGES as c (c.id)}
					{@const locked = challengeIsLocked(c)}
					<div class="ch-card" class:locked>
						<div class="ch-stripe" style="background: {c.stripe}"></div>
						<div class="ch-body">
							<div class="ch-name">{c.name}</div>
							<div class="ch-stars">{#each { length: 5 } as _, i}<span style="color: {i < c.difficulty ? '#ffc24a' : '#2b2c38'}">★</span>{/each}</div>
							<div class="ch-desc">{c.desc}</div>
							<div class="ch-footer">
								<div class="ch-reward">{@html $_('map.challengesReward', { values: { reward: c.reward } })}</div>
								<button class="ch-btn" class:locked-btn={locked} disabled={locked}
									onclick={() => { if (!locked) pushToast(t('map.challengeSoon', { name: c.name }), 'info'); }}>
									{locked ? '🔒' : '⚔️'}
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</main>

<style>
	/* ── Region pills ── */
	.region-strip { display: flex; gap: 6px; overflow-x: auto; padding: 4px 0 8px; scrollbar-width: none; }
	.region-strip::-webkit-scrollbar { display: none; }
	.region-pill {
		flex-shrink: 0; display: flex; align-items: center; gap: 4px;
		padding: 5px 10px 5px 8px; border-radius: 20px; font-size: 11px; font-weight: 800;
		border: 1px solid var(--line); background: var(--surface); color: var(--text-muted);
		cursor: pointer; transition: all 0.2s; font-family: inherit;
	}
	.region-pill.active { background: color-mix(in oklch, var(--rc) 18%, var(--surface)); border-color: var(--rc); color: var(--rc); }
	.region-pill.unlocked:not(.active):hover { border-color: color-mix(in oklch, var(--rc) 40%, var(--line)); }
	.region-pill:disabled { opacity: 0.3; cursor: default; }

	/* ── SVG Map ── */
	.map-canvas-wrap {
		background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
		padding: 8px; margin-bottom: 10px; position: relative; overflow: hidden;
	}
	.map-canvas { display: block; width: 100%; height: auto; }
	.map-node { cursor: pointer; }
	.map-node circle { transition: stroke-width 0.15s, filter 0.15s; }
	.map-node:hover circle { stroke-width: 4; filter: brightness(1.2); }
	.map-node:active { opacity: 0.7; }

	/* ── Action card ── */
	.action-card {
		background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
		padding: 14px; margin-bottom: 10px; border-top: 2px solid color-mix(in oklch, var(--ac) 30%, transparent);
	}
	.action-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
	.action-pkm { display: flex; align-items: center; gap: 10px; }
	.action-sprite { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
	.action-pkm-name { font-size: 14px; font-weight: 900; line-height: 1.2; }
	.action-pkm-el { font-size: 10px; font-weight: 700; text-transform: capitalize; }
	.action-progress { text-align: right; }
	.action-progress-num { font-size: 22px; font-weight: 900; font-family: var(--font-display); line-height: 1; color: var(--ac); }
	.action-progress-label { font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
	.action-bar-track { height: 4px; border-radius: 2px; background: var(--surface-2); overflow: hidden; margin-bottom: 12px; }
	.action-bar-fill { height: 100%; border-radius: 2px; transition: width 0.5s cubic-bezier(0.4,0,0.2,1); }
	.action-btn {
		width: 100%; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 900;
		border: none; cursor: pointer; transition: all 0.15s; font-family: inherit;
		background: var(--ac); color: #0b0b10;
	}
	.action-btn:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 16px color-mix(in oklch, var(--ac) 30%, transparent); }
	.action-btn:not(:disabled):active { transform: scale(0.97); }
	.action-btn:disabled { opacity: 0.35; cursor: default; }
	.action-btn.cooldown { background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--line); }
	.action-btn.cooldown:disabled { opacity: 0.6; }

	/* ── Empty state ── */
	.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }

	/* ── MissingNo ── */
	.mn-btn {
		position: relative; width: 100%; margin-top: 10px; padding: 0;
		border: 1px solid rgba(175, 0, 220, 0.35); border-radius: 14px;
		background: linear-gradient(145deg, rgba(16, 2, 32, 0.95), rgba(4, 0, 12, 0.98));
		cursor: pointer; overflow: hidden; transition: border-color 0.3s; font-family: inherit; color: inherit;
	}
	.mn-btn:hover { border-color: rgba(175, 0, 220, 0.7); box-shadow: 0 0 24px rgba(175, 0, 220, 0.15); }
	.mn-glow { position: absolute; inset: 0; background: radial-gradient(80% 60% at 50% 50%, rgba(175, 0, 220, 0.06), transparent); animation: mnGlow 3s ease-in-out infinite; pointer-events: none; }
	@keyframes mnGlow { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
	.mn-inner { position: relative; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 1; }
	.mn-emoji { font-size: 28px; animation: mnFloat 2.5s ease-in-out infinite; }
	@keyframes mnFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
	.mn-name { font-size: 18px; font-weight: 900; color: rgba(200, 120, 255, 0.8); letter-spacing: 2px; }
	.mn-desc { font-size: 11px; color: rgba(160, 100, 200, 0.6); }

	/* ── Challenges (simplified) ── */
	.ch-section { padding-bottom: 44px; }
	.ch-intro-title { font-size: 18px; font-weight: 900; font-family: var(--font-display); padding: 10px 0 6px; }
	.ch-list { display: flex; flex-direction: column; gap: 8px; }
	.ch-card { border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: var(--surface); position: relative; }
	.ch-card.locked { opacity: 0.55; }
	.ch-stripe { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
	.ch-body { padding: 12px; }
	.ch-name { font-size: 14px; font-weight: 900; }
	.ch-stars { display: flex; gap: 2px; padding: 2px 0; }
	.ch-stars span { font-size: 9px; }
	.ch-desc { font-size: 11px; color: var(--text-dim); padding: 4px 0 8px; line-height: 1.4; }
	.ch-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.ch-reward { font-size: 10px; font-weight: 700; color: var(--text-muted); }
	.ch-btn { border-radius: 8px; padding: 6px 12px; font-size: 14px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text-muted); cursor: pointer; font-family: inherit; }
	.ch-btn.locked-btn { opacity: 0.5; cursor: default; }
</style>
