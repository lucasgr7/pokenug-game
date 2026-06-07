<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
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
	import { ELEMENT_COLOR, ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import type { BattleMode, Element } from '$lib/game/types';
	import type { RegionProgress } from '$lib/db/index';

	const MIN_DECK = 8;

	type BossPhase = 'hidden' | 'traces' | 'approaching' | 'revealed' | 'cooldown';
	type ZoneState = 'done' | 'active' | 'next' | 'locked';

	let tab = $state<'explore' | 'challenges'>('explore');
	let progressByRegion = $state<Record<string, RegionProgress>>({});
	let deckSize = $state(0);
	let selectedZoneIdx = $state(0);
	let windowOpen = $state(isMissingNoWindowOpen());

	$effect(() => {
		const iv = setInterval(() => {
			windowOpen = isMissingNoWindowOpen();
		}, 1000);
		return () => clearInterval(iv);
	});

	function allRegionsCompleted(): boolean {
		return REGIONS.every((r) => {
			const p = progressByRegion[r.id];
			if (!p) return false;
			return p.defeats >= r.requiredDefeats && p.bossLastDefeatedAt > 0;
		});
	}

	const activeZoneIdx = $derived.by(() => {
		for (let i = 0; i < REGIONS.length; i++) {
			if (isUnlocked(REGIONS[i].id) && progressByRegion[REGIONS[i].id]?.defeats < REGIONS[i].requiredDefeats) {
				return i;
			}
		}
		return REGIONS.length - 1;
	});

	const viewZoneIdx = $derived.by(() => {
		if (zoneState(selectedZoneIdx) === 'locked' || zoneState(selectedZoneIdx) === 'next') {
			return activeZoneIdx;
		}
		return selectedZoneIdx;
	});

	onMount(async () => {
		if (await hasSavedBattle()) {
			await goto('/battle');
			return;
		}
		const entries = await Promise.all(
			REGIONS.map(async (r) => [r.id, await getRegionProgress(r.id)] as const)
		);
		progressByRegion = Object.fromEntries(entries);
		const deck = await getActiveDeck();
		deckSize = deck.length;
		selectedZoneIdx = activeZoneIdx;
	});

	function isUnlocked(id: string): boolean {
		return game.player?.unlockedRegions.includes(id) ?? false;
	}

	function defeats(id: string): number {
		return progressByRegion[id]?.defeats ?? 0;
	}

	function progress(id: string): RegionProgress {
		return progressByRegion[id] ?? {
			defeats: 0,
			bossLastDefeatedAt: 0,
			bossFirstFightDone: false
		};
	}

	function bossReady(id: string): boolean {
		const r = getRegion(id);
		if (!r) return false;
		const p = progress(id);
		if (p.defeats < r.requiredDefeats) return false;
		return canFightBoss(p, Date.now());
	}

	function bossCooldownMs(id: string): number {
		return getBossCooldownRemainingMs(progress(id), Date.now());
	}

	function zoneState(idx: number): ZoneState {
		if (!isUnlocked(REGIONS[idx].id)) {
			const prev = REGIONS[idx - 1];
			if (prev && isUnlocked(prev.id) && defeats(prev.id) >= prev.requiredDefeats) return 'next';
			return 'locked';
		}
		if (defeats(REGIONS[idx].id) >= REGIONS[idx].requiredDefeats) return 'done';
		if (idx === activeZoneIdx) return 'active';
		const prevAllDone = REGIONS.slice(0, idx).every(
			(r) => !isUnlocked(r.id) || defeats(r.id) >= r.requiredDefeats
		);
		if (prevAllDone) return 'next';
		return 'locked';
	}

	function bossPhase(id: string): BossPhase {
		const r = getRegion(id);
		if (!r) return 'hidden';
		const p = progress(id);
		const remaining = getBossCooldownRemainingMs(p, Date.now());
		if (p.bossLastDefeatedAt > 0 && remaining > 0) return 'cooldown';
		if (p.defeats >= r.requiredDefeats) return 'revealed';
		const ratio = p.defeats / r.requiredDefeats;
		if (ratio > 0.7) return 'approaching';
		if (ratio > 0.4) return 'traces';
		return 'hidden';
	}

	function activeRegion() {
		return REGIONS[viewZoneIdx];
	}

	function challengeIsLocked(c: { unlockRegionId: string | null }): boolean {
		if (!c.unlockRegionId) return false;
		const r = getRegion(c.unlockRegionId);
		if (!r) return false;
		return defeats(c.unlockRegionId) < r.requiredDefeats;
	}

	async function enter(regionId: string, mode: BattleMode = 'normal') {
		if (!isUnlocked(regionId)) return;
		const region = getRegion(regionId);
		if (!region) return;

		const latestProgress = await getRegionProgress(regionId);
		progressByRegion[regionId] = latestProgress;

		if (mode === 'boss') {
			if (latestProgress.defeats < region.requiredDefeats) {
				pushToast('Derrote mais inimigos comuns nesta região antes do boss.', 'error');
				return;
			}
			if (!canFightBoss(latestProgress, Date.now())) {
				const remaining = getBossCooldownRemainingMs(latestProgress, Date.now());
				pushToast(`Boss em cooldown: ${formatDuration(remaining)}.`, 'error');
				return;
			}
		}

		if (!game.player?.activePokemonId) {
			pushToast('Selecione um Pokémon principal na aba Pokémons primeiro.', 'error');
			return;
		}
		const activePkm = game.roster.find((p) => p.id === game.player?.activePokemonId);
		if (activePkm && normalizedPokemonHp(activePkm) <= 0) {
			pushToast('Seu Pokémon principal está desmaiado. Selecione outro ou aguarde a recuperação.', 'error');
			return;
		}
		const deck = await getActiveDeck();
		if (deck.length < MIN_DECK) {
			pushToast(`Seu deck precisa de ao menos ${MIN_DECK} cartas.`, 'error');
			await goto('/deck');
			return;
		}
		await goto(`/battle?region=${regionId}&mode=${mode}`);
	}

	async function doExplore() {
		const reg = activeRegion();
		if (!reg) return;
		await enter(reg.id, 'normal');
	}

	async function doFightBoss() {
		const reg = activeRegion();
		if (!reg) return;
		await enter(reg.id, 'boss');
	}
</script>

<Hud />

<main class="px-4 py-4">
	<!-- Tabs -->
	<div class="tab-bar">
		<button
			class="tab-btn"
			class:on={tab === 'explore'}
			onclick={() => (tab = 'explore')}
		>
			Explorar
		</button>
		<button
			class="tab-btn"
			class:on={tab === 'challenges'}
			onclick={() => (tab = 'challenges')}
		>
			⚠ Desafios
		</button>
	</div>

	{#if tab === 'explore'}
		<!-- Zone Path -->
		<div class="zone-path">
			{#each REGIONS as region, i (region.id)}
				{@const zs = zoneState(i)}
				<button
					class="zp-node"
					class:done={zs === 'done'}
					class:active={zs === 'active'}
					class:next={zs === 'next'}
					class:locked={zs === 'locked'}
					class:selected={i === selectedZoneIdx}
					style="--zc: {region.color}"
					disabled={zs === 'locked' || zs === 'next'}
					onclick={() => { selectedZoneIdx = i; }}
				>
					<div class="zp-you">{zs === 'active' ? '▲ você' : ''}</div>
					<div class="zp-circle">{region.emoji}</div>
					<div class="zp-label">{region.name}</div>
				</button>
				{#if i < REGIONS.length - 1}
					{@const lineClass = i < activeZoneIdx ? 'done' : i === activeZoneIdx ? 'active-to-next' : 'ghost'}
					<div
						class="zp-line {lineClass}"
						style="--zc: {region.color}"
					></div>
				{/if}
			{/each}
		</div>

		<!-- Zone Hero -->
		{@const ar = activeRegion()}
		{#if ar}
			{@const defs = defeats(ar.id)}
			{@const req = ar.requiredDefeats}
			{@const bp = bossPhase(ar.id)}
			{@const bossIsReady = bossReady(ar.id)}
			{@const remaining = req - defs}
			{@const activePkm = activePokemon()}

			<div
				class="zone-hero"
				style="--zc: {ar.color}"
			>
				<div class="zh-atmosphere"></div>
				<div class="zh-inner">
					<div class="zh-toprow">
						<div class="zh-badge">{ar.emoji} {ar.name.split(' ')[0].toUpperCase()}</div>
						<div class="zh-status">
							<div class="zh-dot"></div>
							Ativa
						</div>
					</div>
					<div class="zh-name">{ar.name}</div>
					<div class="zh-desc">{ar.description}</div>
					<div class="zh-types">
						<span class="zh-types-label">Pokémon</span>
						{#each ar.types as t}
							<span class="type-chip" style="--tc: {ELEMENT_COLOR[t]}">
								{ELEMENT_EMOJI[t]} {ELEMENT_LABEL[t]}
							</span>
						{/each}
						<span class="type-chip boss-chip" style="--tc: {ELEMENT_COLOR[ar.bossType]}">
							👑 {ELEMENT_EMOJI[ar.bossType]} Boss
						</span>
					</div>
				</div>

				<div class="kill-track">
					<div class="kt-header">
						<span class="kt-label">Inimigos Derrotados</span>
						<span class="kt-count">{defs}/{req}</span>
					</div>
					<div class="kt-slots">
						{#each { length: req } as _, i}
							<div
								class="kt-slot"
								class:filled={i < defs}
								style="--zc: {ar.color}"
							></div>
						{/each}
					</div>
					<div class="kt-note" class:ready={defs >= req}>
						{defs >= req
							? 'Boss revelado — hora do confronto'
							: `${remaining} ${remaining === 1 ? 'inimigo' : 'inimigos'} para revelar o boss`}
					</div>
				</div>

				<button
					class="deck-preview"
					style="--pc: {activePkm ? (ELEMENT_COLOR[activePkm.element] ?? 'var(--txt-dim)') : 'var(--txt-dim)'}"
					onclick={() => goto('/deck')}
				>
					{#if activePkm}
						<div class="dp-avatar">
							<Sprite speciesId={activePkm.speciesId} size={52} alt={activePkm.name} />
						</div>
						<div class="dp-info">
							<div class="dp-name">{activePkm.name}</div>
							<span class="dp-type-chip">
								{ELEMENT_EMOJI[activePkm.element]} {ELEMENT_LABEL[activePkm.element]}
							</span>
						</div>
					{:else}
						<div class="dp-avatar" style="font-size: 22px;">❓</div>
						<div class="dp-info">
							<div class="dp-name">Sem Pokémon</div>
							<span class="dp-type-chip">—</span>
						</div>
					{/if}
					<div class="dp-deck">
						<div class="dp-deck-count">{deckSize}</div>
						<div class="dp-deck-label">cartas</div>
					</div>
				</button>

				<div class="zh-actions">
					<button
						class="btn-explore"
						onclick={doExplore}
						disabled={!isUnlocked(ar.id)}
					>
						⚔ Batalhar
					</button>
					<button
						class="btn-boss"
						disabled={!bossIsReady}
						onclick={doFightBoss}
					>
						{bossIsReady ? '💥 Fight Boss' : '🔒 Fight Boss'}
					</button>
				</div>
			</div>

			<!-- Boss Gate -->
			<div class="boss-gate" style="--zc: {ar.color}">
				{#if bp === 'cooldown'}
					<div class="bg-cooldown-wrap">
						<div class="bg-cd-icon">⏱</div>
						<div>
							<div class="bg-cd-title">Boss em Cooldown</div>
							<div class="bg-cd-time">{formatDuration(bossCooldownMs(ar.id))}</div>
						</div>
					</div>
				{:else if bp === 'revealed'}
					<div class="bg-revealed">
						<div class="bg-rev-glow"></div>
						<div class="bg-eyebrow">
							<div class="bg-dot"></div>
							<span class="bg-eyebrow-txt">Boss Revelado</span>
						</div>
						<div class="bg-boss-name">{ar.emoji} {ar.bossName}</div>
						<div class="bg-boss-desc">{ar.bossDesc}</div>
					</div>
				{/if}
			</div>

			<!-- Next Teaser -->
			{@const nextReg = REGIONS[activeZoneIdx + 1]}
			{#if nextReg}
				<div class="next-teaser">
					<div class="nt-icon">{nextReg.emoji}</div>
					<div class="nt-info">
						<div class="nt-label">Próxima Região</div>
						<div class="nt-name">{nextReg.name}</div>
					</div>
					<span class="nt-lock">🔒</span>
				</div>
			{/if}

			<!-- Conquered Trophies -->
			<div class="conquered-wrap">
				<div class="conquered-hd">
					<span class="conquered-hd-title">Regiões Conquistadas</span>
				</div>
				{#each REGIONS as region (region.id)}
					{@const zs = zoneState(REGIONS.indexOf(region))}
					{#if zs === 'done'}
						{@const ph = bossPhase(region.id)}
						{@const isCd = ph === 'cooldown'}
						<div class="trophy-item-wrapper">
							<div class="trophy-item" style="--zc: {region.color}">
								<div class="trophy-ambient"></div>
								<div class="trophy-seal">★</div>
								<div class="trophy-emoji">{region.emoji}</div>
								<div class="trophy-name">{region.name}</div>
								<div class="trophy-badge" class:ok={!isCd} class:cd={isCd}>
									{isCd ? `↺ ${formatDuration(bossCooldownMs(region.id))}` : '✓'}
								</div>
							</div>
						</div>
					{/if}
				{/each}
				{#if REGIONS.every((r) => zoneState(REGIONS.indexOf(r)) !== 'done')}
					<p class="empty-trophy-msg">Nenhuma conquista ainda.</p>
				{/if}
			</div>

			<!-- Secret MissingNo Card -->
			{#if import.meta.env.DEV || (allRegionsCompleted() && windowOpen)}
				<button
					class="missingno-card"
					onclick={async () => {
						if (!game.player?.activePokemonId) {
							pushToast('Selecione um Pokémon principal na aba Pokémons primeiro.', 'error');
							return;
						}
						const activePkm = game.roster.find((p) => p.id === game.player?.activePokemonId);
						if (activePkm && normalizedPokemonHp(activePkm) <= 0) {
							pushToast('Seu Pokémon principal está desmaiado. Selecione outro ou aguarde a recuperação.', 'error');
							return;
						}
						const deck = await getActiveDeck();
						if (deck.length < MIN_DECK) {
							pushToast(`Seu deck precisa de ao menos ${MIN_DECK} cartas.`, 'error');
							await goto('/deck');
							return;
						}
						await goto(`/battle?region=missingno&mode=missingno`);
					}}
				>
					<div class="mn-glow"></div>
					<div class="mn-inner">
						<div class="mn-emoji">👾</div>
						<div class="mn-name">???</div>
						<div class="mn-desc">Uma distorção nos dados.</div>
					</div>
				</button>
			{/if}
		{/if}

	{:else}
		<!-- Challenges Tab -->
		<div class="ch-intro">
			<div class="ch-intro-title">Desafios</div>
			<div class="ch-intro-sub">Regiões com restrições de deck e maior dificuldade. Recompensas exclusivas.</div>
		</div>
		<div class="ch-list">
			{#each CHALLENGES as c (c.id)}
				{@const locked = challengeIsLocked(c)}
				{@const deckColor = c.deckType === 'size' ? '#ffc24a' : (ELEMENT_COLOR[c.deckType] ?? '#3ad6c2')}
				<div class="ch-card" class:locked>
					<div class="ch-stripe" style="background: {c.stripe}"></div>
					<div class="ch-header">
						<div class="ch-name">{c.name}</div>
						<div class="ch-stars">
							{#each { length: 5 } as _, i}
								<span class="ch-star" style="color: {i < c.difficulty ? '#ffc24a' : '#2b2c38'}">★</span>
							{/each}
						</div>
					</div>
					<div class="ch-desc">{c.desc}</div>
					<div class="ch-restrictions">
						<div class="ch-restr enemies">
							<div class="ch-restr-label">Enfrenta</div>
							<div class="ch-enemy-chips">
								{#each c.enemies as t}
									<span class="ch-enemy-chip" style="--ec: {ELEMENT_COLOR[t]}">
										{ELEMENT_EMOJI[t]} {ELEMENT_LABEL[t]}
									</span>
								{/each}
							</div>
						</div>
						<div class="ch-restr deck" style="--rc: {deckColor}">
							<div class="ch-restr-label">Entra com</div>
							<div class="ch-deck-pill" style="--rc: {deckColor}">
								{c.deckEmoji} {c.deckLabel}
							</div>
						</div>
					</div>
					{#if locked}
						{@const unlockReg = getRegion(c.unlockRegionId!)}
						<div class="ch-lock-banner">
							🔒 <span>{unlockReg?.name ?? 'Complete a região anterior'}</span>
						</div>
					{/if}
					<div class="ch-footer">
						<div class="ch-reward">Recompensa <span>{c.reward}</span></div>
						<button
							class="ch-btn"
							class:available={!locked}
							class:locked-btn={locked}
							disabled={locked}
							onclick={() => {
								if (!locked) pushToast(`Desafio "${c.name}" em breve!`, 'info');
							}}
						>
							{locked ? '🔒 Bloqueado' : '⚔ Entrar'}
						</button>
				</div>
				</div>
			{/each}
		</div>
	{/if}
</main>

<style>
	/* ── Tab Bar ── */
	.tab-bar {
		display: flex;
		padding: 6px 0 0;
		gap: 6px;
	}
	.tab-btn {
		flex: 1;
		padding: 8px 0;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.3px;
		border-radius: 9px;
		border: 1px solid var(--line);
		background: var(--bg-2);
		color: var(--txt-mute);
		transition: all 0.2s;
		cursor: pointer;
	}
	.tab-btn.on {
		background: var(--bg-3);
		border-color: var(--line);
		color: var(--txt);
	}
	.tab-btn:last-child.on {
		color: var(--warn);
		border-color: color-mix(in oklch, var(--warn) 28%, transparent);
	}

	/* ── Zone Path ── */
	.zone-path {
		display: flex;
		align-items: center;
		padding: 12px 0 4px;
		overflow-x: auto;
		scrollbar-width: none;
		gap: 0;
	}
	.zone-path::-webkit-scrollbar {
		display: none;
	}
	.zp-line {
		height: 2px;
		flex: 1;
		min-width: 12px;
		max-width: 24px;
		flex-shrink: 0;
		margin-bottom: 28px;
		background: var(--line);
		transition: background 0.3s;
	}
	.zp-line.done {
		background: color-mix(in oklch, var(--zc) 70%, var(--bg-3));
	}
	.zp-line.active-to-next {
		background: linear-gradient(90deg, color-mix(in oklch, var(--acc) 50%, var(--line)), var(--line));
		border: none;
	}
	.zp-line.ghost {
		height: 0;
		border-top: 2px dashed color-mix(in oklch, var(--line) 60%, transparent);
		background: transparent;
		margin-bottom: 30px;
		opacity: 0.5;
	}
	.zp-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		padding: 0;
		font: inherit;
		color: inherit;
		border: none;
		background: none;
		cursor: pointer;
	}
	.zp-node:disabled {
		cursor: default;
	}
	.zp-you {
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--cta);
		height: 12px;
		opacity: 0;
		transition: opacity 0.3s;
	}
	.zp-node.active .zp-you {
		opacity: 1;
	}
	.zp-circle {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 17px;
		border: 2px solid var(--line);
		background: var(--bg-2);
		transition: all 0.3s;
		position: relative;
		z-index: 1;
	}
	.zp-node.done .zp-circle {
		background: color-mix(in oklch, var(--zc) 14%, var(--bg-2));
		border-color: color-mix(in oklch, var(--zc) 50%, transparent);
	}
	.zp-node.done .zp-circle::after {
		content: '✓';
		position: absolute;
		bottom: -1px;
		right: -1px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--good);
		border: 2px solid var(--bg-0);
		font-size: 7px;
		font-weight: 900;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}
	.zp-node.active .zp-circle {
		background: color-mix(in oklch, var(--zc) 20%, var(--bg-2));
		border-color: var(--zc);
		animation: zp-pulse 2.5s ease-in-out infinite;
	}
	@keyframes zp-pulse {
		0%, 100% {
			box-shadow: 0 0 0 3px color-mix(in oklch, var(--zc) 18%, transparent),
				0 0 16px color-mix(in oklch, var(--zc) 28%, transparent);
		}
		50% {
			box-shadow: 0 0 0 6px color-mix(in oklch, var(--zc) 10%, transparent),
				0 0 24px color-mix(in oklch, var(--zc) 38%, transparent);
		}
	}
	.zp-node.next .zp-circle {
		opacity: 0.4;
		filter: grayscale(0.7);
	}
	.zp-node.locked .zp-circle {
		opacity: 0.18;
		filter: grayscale(1);
		cursor: default;
	}
	.zp-label {
		font-size: 8.5px;
		font-weight: 700;
		color: var(--txt-mute);
		text-align: center;
		width: 50px;
		line-height: 1.3;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
	}
	.zp-node.active .zp-label {
		color: var(--txt-dim);
		font-weight: 800;
	}
	.zp-node.selected .zp-circle {
		outline: 2px solid var(--acc);
		outline-offset: 2px;
	}

	/* ── Zone Hero ── */
	.zone-hero {
		position: relative;
		margin: 8px 0 0;
		background: color-mix(in oklch, var(--zc, var(--bg-0)) 6%, var(--bg-0));
		border-top: 1px solid color-mix(in oklch, var(--zc, var(--line)) 14%, var(--line));
		border-bottom: 1px solid color-mix(in oklch, var(--zc, var(--line)) 14%, var(--line));
		overflow: hidden;
		border-radius: 0;
		transition: background 0.4s;
	}
	.zh-atmosphere {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(110% 60% at 90% 0%, color-mix(in oklch, var(--zc) 18%, transparent), transparent 52%),
			radial-gradient(70% 50% at 5% 100%, color-mix(in oklch, var(--zc) 7%, transparent), transparent 55%);
	}
	.zh-inner {
		padding: 14px 14px 0;
		position: relative;
	}
	.zh-toprow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.zh-badge {
		display: flex;
		align-items: center;
		gap: 5px;
		background: color-mix(in oklch, var(--zc) 10%, var(--bg-2));
		border: 1px solid color-mix(in oklch, var(--zc) 26%, transparent);
		border-radius: 20px;
		padding: 3px 10px 3px 7px;
		font-size: 10px;
		font-weight: 800;
		color: var(--zc);
		letter-spacing: 0.3px;
	}
	.zh-status {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		font-weight: 700;
		color: var(--acc);
	}
	.zh-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--acc);
		box-shadow: 0 0 6px var(--acc);
	}
	.zh-name {
		font-size: 24px;
		font-weight: 900;
		font-family: var(--font-display);
		line-height: 1.05;
		margin-bottom: 4px;
	}
	.zh-desc {
		font-size: 12px;
		color: var(--txt-dim);
		line-height: 1.45;
		margin-bottom: 12px;
	}
	.zh-types {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 14px;
		flex-wrap: wrap;
	}
	.zh-types-label {
		font-size: 9px;
		font-weight: 700;
		color: var(--txt-mute);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		flex-shrink: 0;
	}
	.type-chip {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 3px 8px 3px 5px;
		border-radius: 20px;
		font-size: 10px;
		font-weight: 800;
		background: color-mix(in oklch, var(--tc) 10%, var(--bg-2));
		border: 1px solid color-mix(in oklch, var(--tc) 28%, transparent);
		color: var(--tc);
	}
	.type-chip.boss-chip {
		background: color-mix(in oklch, var(--tc) 14%, var(--bg-2));
		border-color: color-mix(in oklch, var(--tc) 38%, transparent);
	}

	/* -- Kill Tracker -- */
	.kill-track {
		background: color-mix(in oklch, var(--bg-2) 70%, var(--bg-1));
		border-top: 1px solid color-mix(in oklch, var(--zc) 10%, var(--line));
		padding: 12px 14px 0;
	}
	.kt-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.kt-label {
		font-size: 10px;
		font-weight: 700;
		color: var(--txt-dim);
	}
	.kt-count {
		font-size: 13px;
		font-weight: 900;
		color: var(--zc);
		font-family: var(--font-display);
	}
	.kt-slots {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 4px;
		margin-bottom: 8px;
	}
	.kt-slot {
		height: 9px;
		border-radius: 3px;
		background: var(--bg-3);
		border: 1px solid var(--line);
		transition: background 0.22s, border-color 0.22s, box-shadow 0.22s;
		overflow: hidden;
	}
	.kt-slot.filled {
		background: var(--zc);
		border-color: var(--zc);
		box-shadow: 0 0 6px color-mix(in oklch, var(--zc) 42%, transparent);
	}
	.kt-note {
		font-size: 10px;
		font-weight: 600;
		color: var(--txt-mute);
		padding-bottom: 12px;
	}
	.kt-note.ready {
		color: var(--zc);
		font-weight: 800;
	}

	/* -- Deck Preview -- */
	.deck-preview {
		width: 100%;
		border-top: 1px solid color-mix(in oklch, var(--zc) 10%, var(--line));
		padding: 11px 14px;
		display: flex;
		align-items: center;
		gap: 12px;
		background: color-mix(in oklch, var(--bg-2) 80%, var(--bg-1));
		transition: background 0.2s;
		border: none;
		border-radius: 0;
		font: inherit;
		color: inherit;
		text-align: left;
	}
	.deck-preview:hover {
		background: color-mix(in oklch, var(--bg-2) 100%, var(--bg-1));
	}
	.dp-avatar {
		width: 52px;
		height: 52px;
		flex-shrink: 0;
		border-radius: 50%;
		background: color-mix(in oklch, var(--pc) 14%, var(--bg-3));
		border: 2px solid color-mix(in oklch, var(--pc) 38%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26px;
		line-height: 1;
		box-shadow: 0 0 14px color-mix(in oklch, var(--pc) 22%, transparent);
		position: relative;
		overflow: hidden;
	}
	.dp-avatar::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.12), transparent 60%);
	}
	.dp-info {
		flex: 1;
		min-width: 0;
	}
	.dp-name {
		font-size: 13px;
		font-weight: 900;
		margin-bottom: 3px;
	}
	.dp-type-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		background: color-mix(in oklch, var(--pc) 10%, var(--bg-2));
		border: 1px solid color-mix(in oklch, var(--pc) 26%, transparent);
		border-radius: 20px;
		padding: 2px 7px 2px 5px;
		font-size: 9px;
		font-weight: 800;
		color: var(--pc);
	}
	.dp-deck {
		text-align: right;
		flex-shrink: 0;
	}
	.dp-deck-count {
		font-size: 20px;
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--txt);
		line-height: 1;
	}
	.dp-deck-label {
		font-size: 9px;
		color: var(--txt-mute);
		font-weight: 700;
		margin-top: 1px;
	}

	/* -- Zone Actions -- */
	.zh-actions {
		display: flex;
		gap: 8px;
		padding: 10px 14px 14px;
		background: color-mix(in oklch, var(--bg-2) 70%, var(--bg-1));
	}
	.btn-explore {
		flex: 1;
		background: var(--bg-3);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 11px;
		font-size: 12px;
		font-weight: 800;
		color: var(--txt);
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
	}
	.btn-explore:not(:disabled):hover {
		border-color: color-mix(in oklch, var(--zc) 48%, transparent);
		background: color-mix(in oklch, var(--zc) 8%, var(--bg-3));
		color: var(--zc);
	}
	.btn-explore:not(:disabled):active {
		transform: scale(0.97);
	}
	.btn-explore:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.btn-boss {
		flex: 1;
		border-radius: 9px;
		padding: 11px;
		font-size: 12px;
		font-weight: 800;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: color-mix(in oklch, var(--zc) 10%, var(--bg-3));
		border: 1px solid color-mix(in oklch, var(--zc) 22%, transparent);
		color: var(--zc);
		cursor: pointer;
	}
	.btn-boss:disabled {
		opacity: 0.32;
		cursor: default;
	}
	.btn-boss:not(:disabled):hover {
		background: color-mix(in oklch, var(--zc) 20%, var(--bg-3));
		box-shadow: 0 3px 14px color-mix(in oklch, var(--zc) 22%, transparent);
	}
	.btn-boss:not(:disabled):active {
		transform: scale(0.97);
	}

	/* ── Boss Gate ── */
	.boss-gate {
		margin: 8px 0 0;
	}
	.bg-locked-wrap {
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 11px 13px;
		display: flex;
		align-items: center;
		gap: 12px;
		transition: border-color 0.4s, background 0.4s;
	}
	.bg-locked-wrap.traces {
		border-color: color-mix(in oklch, var(--zc) 18%, var(--line));
	}
	.bg-locked-wrap.approaching {
		border-color: color-mix(in oklch, var(--zc) 32%, var(--line));
		background: color-mix(in oklch, var(--zc) 4%, var(--bg-2));
	}
	.bg-lock-icon {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--bg-3);
		border: 1px solid var(--line);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 17px;
		transition: all 0.4s;
	}
	.bg-locked-wrap.traces .bg-lock-icon {
		border-color: color-mix(in oklch, var(--zc) 30%, transparent);
	}
	.bg-locked-wrap.approaching .bg-lock-icon {
		border-color: color-mix(in oklch, var(--zc) 55%, transparent);
		box-shadow: 0 0 14px color-mix(in oklch, var(--zc) 28%, transparent);
	}
	.bg-locked-info {
		flex: 1;
		min-width: 0;
	}
	.bg-l-title {
		font-size: 11px;
		font-weight: 900;
		color: var(--txt-dim);
		margin-bottom: 2px;
		transition: color 0.4s;
	}
	.bg-locked-wrap.approaching .bg-l-title {
		color: var(--zc);
	}
	.bg-l-sub {
		font-size: 10px;
		color: var(--txt-mute);
		margin-bottom: 7px;
		line-height: 1.35;
		transition: color 0.4s;
	}
	.bg-mini-bar {
		height: 4px;
		border-radius: 2px;
		background: var(--bg-3);
		overflow: hidden;
	}
	.bg-mini-fill {
		height: 100%;
		border-radius: 2px;
		background: var(--zc);
		transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.bg-revealed {
		background: linear-gradient(145deg, color-mix(in oklch, var(--zc) 10%, var(--bg-2)), var(--bg-2) 65%);
		border: 1px solid color-mix(in oklch, var(--zc) 36%, transparent);
		border-radius: 12px;
		padding: 14px 13px;
		position: relative;
		overflow: hidden;
		transition: border-color 0.3s, box-shadow 0.3s;
	}
	.bg-revealed:hover {
		border-color: color-mix(in oklch, var(--zc) 55%, transparent);
		box-shadow: 0 4px 22px color-mix(in oklch, var(--zc) 14%, transparent);
	}
	.bg-rev-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(70% 60% at 90% 10%, color-mix(in oklch, var(--zc) 12%, transparent), transparent 60%);
		pointer-events: none;
	}
	.bg-eyebrow {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-bottom: 9px;
	}
	.bg-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--zc);
		box-shadow: 0 0 10px var(--zc);
		flex-shrink: 0;
		animation: bdot 1.7s ease-in-out infinite;
	}
	@keyframes bdot {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.5); }
	}
	.bg-eyebrow-txt {
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 1.5px;
		text-transform: uppercase;
		color: var(--zc);
	}
	.bg-boss-name {
		font-size: 17px;
		font-weight: 900;
		font-family: var(--font-display);
		margin-bottom: 3px;
	}
	.bg-boss-desc {
		font-size: 11px;
		color: var(--txt-dim);
		margin-bottom: 12px;
		line-height: 1.4;
	}
	.bg-fight-btn {
		width: 100%;
		background: var(--zc);
		border-radius: 8px;
		padding: 11px;
		font-size: 13px;
		font-weight: 900;
		color: #0b0b10;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		letter-spacing: 0.3px;
		transition: all 0.2s;
		border: none;
		cursor: pointer;
	}
	.bg-fight-btn:hover {
		filter: brightness(1.1);
		transform: translateY(-1px);
		box-shadow: 0 6px 18px color-mix(in oklch, var(--zc) 36%, transparent);
	}
	.bg-fight-btn:active {
		transform: scale(0.97);
	}
	.bg-cooldown-wrap {
		background: var(--bg-2);
		border: 1px solid color-mix(in oklch, var(--warn) 20%, var(--line));
		border-radius: 12px;
		padding: 11px 13px;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.bg-cd-icon {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border-radius: 50%;
		background: color-mix(in oklch, var(--warn) 8%, var(--bg-3));
		border: 1px solid color-mix(in oklch, var(--warn) 24%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 17px;
	}
	.bg-cd-title {
		font-size: 11px;
		font-weight: 900;
		color: var(--txt-dim);
		margin-bottom: 2px;
	}
	.bg-cd-time {
		font-size: 15px;
		font-weight: 900;
		color: var(--warn);
		font-family: var(--font-display);
	}
	/* ── Next Teaser ── */
	.next-teaser {
		margin: 8px 0 0;
		padding: 10px 13px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 12px;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.nt-icon {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--bg-3);
		border: 1px solid var(--line);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		filter: grayscale(0.7);
		opacity: 0.45;
	}
	.nt-info {
		flex: 1;
	}
	.nt-label {
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.7px;
		text-transform: uppercase;
		color: var(--txt-mute);
		margin-bottom: 2px;
	}
	.nt-name {
		font-size: 13px;
		font-weight: 800;
		color: var(--txt-dim);
	}
	.nt-lock {
		font-size: 12px;
		color: var(--txt-mute);
		margin-left: auto;
		flex-shrink: 0;
	}

	/* ── Conquered Trophies ── */
	.conquered-wrap {
		padding: 14px 0 16px;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 7px;
	}
	.conquered-hd {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 0;
		grid-column: 1 / -1;
	}
	.conquered-hd-title {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--txt-mute);
	}
	.trophy-item-wrapper {
		display: contents;
	}
	.trophy-item {
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 11px 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		position: relative;
		overflow: hidden;
		cursor: pointer;
		transition: border-color 0.2s;
	}
	.trophy-item:hover {
		border-color: color-mix(in oklch, var(--zc) 38%, transparent);
	}
	.trophy-ambient {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--zc) 12%, transparent), transparent 65%);
		pointer-events: none;
	}
	.trophy-emoji {
		font-size: 22px;
		line-height: 1;
		position: relative;
	}
	.trophy-name {
		font-size: 9px;
		font-weight: 800;
		text-align: center;
		line-height: 1.3;
		color: var(--txt-dim);
		position: relative;
	}
	.trophy-badge {
		font-size: 8px;
		font-weight: 800;
		padding: 2px 6px;
		border-radius: 20px;
		position: relative;
	}
	.trophy-badge.ok {
		background: color-mix(in oklch, var(--good) 10%, var(--bg-2));
		border: 1px solid color-mix(in oklch, var(--good) 28%, transparent);
		color: var(--good);
	}
	.trophy-badge.cd {
		background: color-mix(in oklch, var(--warn) 10%, var(--bg-2));
		border: 1px solid color-mix(in oklch, var(--warn) 28%, transparent);
		color: var(--warn);
	}
	.trophy-seal {
		position: absolute;
		top: 7px;
		right: 7px;
		font-size: 10px;
	}
	.empty-trophy-msg {
		font-size: 10px;
		color: var(--txt-mute);
		padding: 4px 2px;
		grid-column: 1 / -1;
	}

	/* ── Challenges Tab ── */
	.ch-intro {
		padding: 10px 0 6px;
	}
	.ch-intro-title {
		font-size: 18px;
		font-weight: 900;
		font-family: var(--font-display);
		margin-bottom: 3px;
	}
	.ch-intro-sub {
		font-size: 11px;
		color: var(--txt-dim);
		line-height: 1.4;
	}
	.ch-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding-bottom: 44px;
	}
	.ch-card {
		margin: 8px 0 0;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid var(--line);
		background: var(--bg-1);
		position: relative;
		transition: border-color 0.2s;
	}
	.ch-card:hover {
		border-color: color-mix(in oklch, var(--warn) 25%, var(--line));
	}
	.ch-card.locked {
		opacity: 0.55;
	}
	.ch-card.locked:hover {
		border-color: var(--line);
	}
	.ch-stripe {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		border-radius: 14px 0 0 14px;
	}
	.ch-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 12px 13px 0;
	}
	.ch-name {
		font-size: 14px;
		font-weight: 900;
		line-height: 1.2;
		flex: 1;
		padding-right: 8px;
	}
	.ch-stars {
		display: flex;
		gap: 2px;
		padding-top: 2px;
		flex-shrink: 0;
	}
	.ch-star {
		font-size: 9px;
	}
	.ch-desc {
		font-size: 11px;
		color: var(--txt-dim);
		padding: 4px 13px 11px;
		line-height: 1.4;
	}
	.ch-restrictions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: 0 13px 11px;
	}
	.ch-restr {
		border-radius: 9px;
		padding: 9px 10px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.ch-restr.enemies {
		background: color-mix(in oklch, var(--warn) 6%, var(--bg-2));
		border: 1px solid color-mix(in oklch, var(--warn) 18%, transparent);
	}
	.ch-restr.deck {
		background: color-mix(in oklch, var(--rc) 8%, var(--bg-2));
		border: 1px solid color-mix(in oklch, var(--rc) 20%, transparent);
	}
	.ch-restr-label {
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--txt-mute);
		margin-bottom: 2px;
	}
	.ch-restr.enemies .ch-restr-label {
		color: color-mix(in oklch, var(--warn) 70%, var(--txt-mute));
	}
	.ch-restr.deck .ch-restr-label {
		color: color-mix(in oklch, var(--rc) 70%, var(--txt-mute));
	}
	.ch-enemy-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.ch-enemy-chip {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 10px;
		font-weight: 800;
		color: var(--ec);
	}
	.ch-deck-pill {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 900;
		color: var(--rc);
	}
	.ch-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 13px 12px;
		gap: 8px;
	}
	.ch-reward {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 700;
		color: var(--txt-mute);
	}
	.ch-reward span {
		color: var(--cta);
		font-weight: 800;
	}
	.ch-btn {
		border-radius: 8px;
		padding: 8px 14px;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.3px;
		transition: all 0.2s;
		border: none;
		cursor: pointer;
	}
	.ch-btn.available {
		background: color-mix(in oklch, var(--warn) 12%, var(--bg-3));
		border: 1px solid color-mix(in oklch, var(--warn) 30%, transparent);
		color: var(--warn);
	}
	.ch-btn.available:hover {
		background: color-mix(in oklch, var(--warn) 20%, var(--bg-3));
		box-shadow: 0 3px 12px color-mix(in oklch, var(--warn) 20%, transparent);
	}
	.ch-btn.locked-btn {
		background: var(--bg-3);
		border: 1px solid var(--line);
		color: var(--txt-mute);
		cursor: default;
		opacity: 0.7;
	}
	.ch-lock-banner {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 13px 12px;
		padding: 8px 10px;
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: 8px;
		font-size: 10px;
		color: var(--txt-mute);
	}
	.ch-lock-banner span {
		font-weight: 700;
	}

	/* ── Secret MissingNo Card ── */
	.missingno-card {
		position: relative;
		width: 100%;
		margin-top: 16px;
		padding: 0;
		border: 1px solid rgba(175, 0, 220, 0.35);
		border-radius: 14px;
		background: linear-gradient(145deg, rgba(16, 2, 32, 0.95), rgba(4, 0, 12, 0.98));
		cursor: pointer;
		overflow: hidden;
		transition: border-color 0.3s, box-shadow 0.3s;
		font-family: inherit;
		text-align: left;
		color: inherit;
	}
	.missingno-card:hover, .missingno-card:focus-visible {
		border-color: rgba(175, 0, 220, 0.7);
		box-shadow: 0 0 24px rgba(175, 0, 220, 0.15);
		outline: none;
	}
	.mn-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(80% 60% at 50% 50%, rgba(175, 0, 220, 0.06), transparent);
		animation: mnGlow 3s ease-in-out infinite;
		pointer-events: none;
	}
	@keyframes mnGlow {
		0%, 100% { opacity: 0.5; }
		50% { opacity: 1; }
	}
	.mn-inner {
		position: relative;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		z-index: 1;
	}
	.mn-emoji {
		font-size: 28px;
		animation: mnFloat 2.5s ease-in-out infinite;
	}
	@keyframes mnFloat {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-4px); }
	}
	.mn-name {
		font-size: 18px;
		font-weight: 900;
		color: rgba(200, 120, 255, 0.8);
		letter-spacing: 2px;
	}
	.mn-desc {
		font-size: 11px;
		color: rgba(160, 100, 200, 0.6);
		margin-bottom: 4px;
	}
	.mn-warning {
		font-size: 9px;
		color: rgba(180, 50, 80, 0.7);
		font-weight: 600;
		letter-spacing: 0.08em;
	}
</style>
