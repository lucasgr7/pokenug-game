import { game, setMusicMuted } from './state.svelte';
import { pick } from '$lib/utils/rng';

type MusicCategory = 'menu' | 'battle' | 'boss';

let audio: HTMLAudioElement | null = null;
let currentCategory: MusicCategory | null = null;
let unlockRegistered = false;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function ensureAudio(): HTMLAudioElement {
	if (!audio && typeof Audio !== 'undefined') {
		audio = new Audio();
		audio.loop = true;
		audio.onerror = () => console.warn('[music] Failed to load audio');
		setupVisibilityHandler();
	}
	return audio!;
}

function chooseSrc(cat: MusicCategory): string {
	if (cat === 'menu') return pick(['/mp3/menu-1.mp3', '/mp3/menu-2.mp3']);
	if (cat === 'boss') return pick(['/mp3/boss.mp3', '/mp3/boss-2.mp3']);
	return pick(['/mp3/battle-1.mp3', '/mp3/battle-2.mp3', '/mp3/battle-3.mp3']);
}

function startFadeIn(duration = 600): void {
	if (!audio || audio.muted) return;
	if (fadeTimer) clearTimeout(fadeTimer);
	audio.volume = 0;
	const start = performance.now();
	function step() {
		const elapsed = performance.now() - start;
		const t = Math.min(elapsed / duration, 1);
		audio!.volume = 1 - (1 - t) * (1 - t);
		if (t < 1) {
			fadeTimer = setTimeout(step, 16);
		} else {
			audio!.volume = 1;
			fadeTimer = null;
		}
	}
	step();
}

function setupVisibilityHandler(): void {
	if (typeof document === 'undefined') return;
	document.addEventListener('visibilitychange', () => {
		if (!audio || !currentCategory) return;
		if (document.hidden) {
			audio.pause();
		} else if (!audio.muted) {
			audio.play().then(() => startFadeIn(300)).catch(() => {});
		}
	});
}

function registerUnlock(): void {
	if (unlockRegistered || typeof window === 'undefined') return;
	unlockRegistered = true;
	const handler = () => {
		if (!audio || !currentCategory) return;
		audio.play().catch(() => {});
		window.removeEventListener('pointerdown', handler);
		window.removeEventListener('click', handler);
	};
	window.addEventListener('pointerdown', handler);
	window.addEventListener('click', handler);
}

export function playCategory(cat: MusicCategory): void {
	if (cat === currentCategory) return;
	const el = ensureAudio();
	if (!el) return;
	currentCategory = cat;
	el.src = chooseSrc(cat);
	el.muted = game.player?.musicMuted ?? false;
	el.currentTime = 0;
	el.play().then(() => startFadeIn()).catch(registerUnlock);
}

export function stopMusic(): void {
	if (!audio) return;
	currentCategory = null;
	audio.pause();
	audio.currentTime = 0;
}

export function toggleMusicMute(): void {
	const muted = !(game.player?.musicMuted ?? false);
	setMusicMuted(muted);
	if (audio) {
		audio.muted = muted;
		if (!muted && audio.paused && currentCategory) {
			audio.play().then(() => startFadeIn()).catch(registerUnlock);
		}
	}
}

export function isMusicMuted(): boolean {
	return game.player?.musicMuted ?? false;
}

const RESULT_SFX = {
	win: '/mp3/battle-victory.mp3',
	boss: '/mp3/battle-boss-win.mp3',
	capture: '/mp3/battle-capture.mp3',
	defeat: '/mp3/battle-lost.mp3'
} as const;

export type ResultVariant = keyof typeof RESULT_SFX;

export function playResultSfx(variant: ResultVariant): void {
	if (typeof Audio === 'undefined') return;
	if (game.player?.musicMuted) return;
	const sfx = new Audio(RESULT_SFX[variant]);
	sfx.volume = 1;
	sfx.play().catch(() => {});
}

export function playMissingNoIntro(): void {
	if (typeof Audio === 'undefined') return;
	if (game.player?.musicMuted) return;
	const el = new Audio('/mp3/final-boss-intro.mp3');
	el.volume = 1;
	el.play().catch(() => {});
}

export function playMissingNoBattle(): void {
	const el = ensureAudio();
	if (!el) return;
	currentCategory = 'boss';
	el.src = '/mp3/final-boss-battle.mp3';
	el.muted = game.player?.musicMuted ?? false;
	el.currentTime = 0;
	el.play().then(() => startFadeIn()).catch(registerUnlock);
}

export function playSfx(path: string): void {
	if (typeof Audio === 'undefined') return;
	if (game.player?.musicMuted) return;
	new Audio(path).play().catch(() => {});
}
