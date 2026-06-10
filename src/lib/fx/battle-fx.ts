import { gsap } from 'gsap';
import { ELEMENT_COLOR, ELEMENT_EMOJI } from '$lib/game/elements';
import type { Element } from '$lib/game/types';

/**
 * Efeitos de combate (GSAP). Todo o movimento usa transform/opacity.
 *
 * Âncoras: elementos marcados com `data-fx="<nome>"` no DOM da batalha —
 * `pile-deck`, `pile-discard`, `sprite-enemy`, `sprite-player`.
 */

export function prefersReducedMotion(): boolean {
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fxAnchor(name: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-fx="${name}"]`);
}

function centerDelta(from: DOMRect, to: DOMRect): { x: number; y: number } {
	return {
		x: from.left + from.width / 2 - (to.left + to.width / 2),
		y: from.top + from.height / 2 - (to.top + to.height / 2)
	};
}

// ── 1. Compra: carta voa do deck (esquerda) até a posição na mão ─────────

/** Svelte action — anexe a cada carta da mão; `index` controla o stagger. */
export function dealFromDeck(node: HTMLElement, index: number): void {
	if (prefersReducedMotion()) return;
	const deck = fxAnchor('pile-deck');
	if (!deck) return;
	const delta = centerDelta(deck.getBoundingClientRect(), node.getBoundingClientRect());
	gsap.from(node, {
		x: delta.x,
		y: delta.y,
		rotation: -28,
		scale: 0.3,
		opacity: 0,
		duration: 0.45,
		delay: index * 0.07,
		ease: 'power3.out',
		clearProps: 'transform,opacity'
	});
}

// ── 2. Fim de turno: a mão voa para a pilha de descarte ─────────────────

export function discardHandToPile(cards: HTMLElement[]): Promise<void> {
	const pile = fxAnchor('pile-discard');
	if (!pile || cards.length === 0 || prefersReducedMotion()) return Promise.resolve();
	const pileRect = pile.getBoundingClientRect();
	return new Promise((resolve) => {
		const tl = gsap.timeline({ onComplete: resolve });
		cards.forEach((el, i) => {
			const delta = centerDelta(pileRect, el.getBoundingClientRect());
			tl.to(
				el,
				{
					x: delta.x,
					y: delta.y,
					rotation: -32 + Math.random() * 24,
					scale: 0.15,
					opacity: 0.15,
					duration: 0.32,
					ease: 'power2.in'
				},
				i * 0.06
			);
		});
		tl.fromTo(
			pile,
			{ scale: 1 },
			{ scale: 1.18, duration: 0.1, yoyo: true, repeat: 1, clearProps: 'transform' },
			'>-0.1'
		);
	});
}

// ── 3. Reshuffle: descarte volta a virar deck ────────────────────────────

export function reshuffleFx(): void {
	const from = fxAnchor('pile-discard');
	const to = fxAnchor('pile-deck');
	if (!from || !to) return;
	const pulse = gsap.timeline();
	pulse.fromTo(
		to,
		{ scale: 1 },
		{ scale: 1.3, duration: 0.12, yoyo: true, repeat: 3, ease: 'power1.inOut', delay: 0.25, clearProps: 'transform' }
	);
	if (prefersReducedMotion()) return;

	const fr = from.getBoundingClientRect();
	const tr = to.getBoundingClientRect();
	for (let i = 0; i < 4; i++) {
		const ghost = document.createElement('div');
		Object.assign(ghost.style, {
			position: 'fixed',
			left: `${fr.left + fr.width / 2 - 8}px`,
			top: `${fr.top + fr.height / 2 - 11}px`,
			width: '16px',
			height: '22px',
			borderRadius: '3px',
			background: 'var(--surface-2, #292524)',
			border: '1px solid #67e8f9',
			boxShadow: '0 0 8px rgba(103, 232, 249, 0.6)',
			zIndex: '80',
			pointerEvents: 'none'
		});
		document.body.appendChild(ghost);
		gsap.fromTo(
			ghost,
			{ x: 0, y: 0, rotation: -10 + i * 8, opacity: 1 },
			{
				x: tr.left + tr.width / 2 - (fr.left + fr.width / 2),
				y: tr.top + tr.height / 2 - (fr.top + fr.height / 2) - 6 + i * 3,
				rotation: 8,
				opacity: 0.9,
				duration: 0.38,
				delay: i * 0.08,
				ease: 'power2.inOut',
				onComplete: () => ghost.remove()
			}
		);
	}
}

// ── 4. Impacto elemental no sprite ───────────────────────────────────────

type ParticleMotion = 'burst' | 'rise' | 'fall' | 'ring';

const ELEMENT_MOTION: Record<Element, ParticleMotion> = {
	fire: 'rise',
	water: 'fall',
	grass: 'burst',
	electric: 'burst',
	normal: 'burst',
	fighting: 'burst',
	psychic: 'ring',
	rock: 'fall',
	ground: 'fall',
	flying: 'rise',
	bug: 'burst',
	poison: 'fall',
	ghost: 'ring',
	ice: 'burst',
	dragon: 'rise'
};

function makeLayer(target: HTMLElement): HTMLElement {
	const layer = document.createElement('div');
	Object.assign(layer.style, {
		position: 'absolute',
		inset: '0',
		zIndex: '40',
		pointerEvents: 'none',
		overflow: 'visible'
	});
	target.appendChild(layer);
	return layer;
}

function makeDot(layer: HTMLElement, color: string, size: number): HTMLElement {
	const dot = document.createElement('span');
	Object.assign(dot.style, {
		position: 'absolute',
		left: '50%',
		top: '50%',
		width: `${size}px`,
		height: `${size}px`,
		marginLeft: `${-size / 2}px`,
		marginTop: `${-size / 2}px`,
		borderRadius: '9999px',
		background: color,
		boxShadow: `0 0 8px ${color}`
	});
	layer.appendChild(dot);
	return dot;
}

function makeSlash(layer: HTMLElement, color: string, angle: number): HTMLElement {
	const slash = document.createElement('div');
	Object.assign(slash.style, {
		position: 'absolute',
		left: '50%',
		top: '50%',
		width: '110px',
		height: '4px',
		marginLeft: '-55px',
		marginTop: '-2px',
		borderRadius: '9999px',
		background: `linear-gradient(90deg, transparent, #fff 35%, ${color} 70%, transparent)`,
		boxShadow: `0 0 12px ${color}`,
		rotate: `${angle}deg`
	});
	layer.appendChild(slash);
	return slash;
}

function makeRing(layer: HTMLElement, color: string): HTMLElement {
	const ring = document.createElement('div');
	Object.assign(ring.style, {
		position: 'absolute',
		left: '50%',
		top: '50%',
		width: '40px',
		height: '40px',
		marginLeft: '-20px',
		marginTop: '-20px',
		borderRadius: '9999px',
		border: `3px solid ${color}`,
		boxShadow: `0 0 14px ${color}`
	});
	layer.appendChild(ring);
	return ring;
}

function makeGlyph(layer: HTMLElement, glyph: string): HTMLElement {
	const el = document.createElement('span');
	el.textContent = glyph;
	Object.assign(el.style, {
		position: 'absolute',
		left: '50%',
		top: '50%',
		fontSize: '20px',
		marginLeft: '-10px',
		marginTop: '-10px',
		filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.6))'
	});
	layer.appendChild(el);
	return el;
}

/**
 * Slash + flash + partículas na cor do elemento sobre o sprite alvo.
 * `target` é 'enemy' (ataques do jogador) ou 'player' (turno inimigo).
 */
export function elementalHitFx(target: 'enemy' | 'player', element: Element | null): void {
	const host = fxAnchor(`sprite-${target}`);
	if (!host) return;
	const color = element ? ELEMENT_COLOR[element] : '#f5f5f4';
	const motion = element ? ELEMENT_MOTION[element] : 'burst';

	const layer = makeLayer(host);
	const tl = gsap.timeline({ onComplete: () => layer.remove() });

	// flash radial
	const flash = document.createElement('div');
	Object.assign(flash.style, {
		position: 'absolute',
		inset: '10%',
		borderRadius: '9999px',
		background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`
	});
	layer.appendChild(flash);
	tl.fromTo(flash, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1.25, duration: 0.12, ease: 'power2.out' }, 0);
	tl.to(flash, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0.14);

	if (prefersReducedMotion()) return;

	// slash duplo
	for (const angle of [-28, 32]) {
		const slash = makeSlash(layer, color, angle);
		const dir = angle < 0 ? 1 : -1;
		tl.fromTo(
			slash,
			{ opacity: 0, scaleX: 0, x: -30 * dir },
			{ opacity: 1, scaleX: 1, x: 0, duration: 0.14, ease: 'power3.out' },
			angle < 0 ? 0 : 0.08
		);
		tl.to(slash, { opacity: 0, x: 26 * dir, duration: 0.22, ease: 'power1.out' }, '>-0.02');
	}

	// partículas
	const count = 12;
	for (let i = 0; i < count; i++) {
		const dot = makeDot(layer, color, 4 + Math.random() * 5);
		const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
		const dist = 34 + Math.random() * 38;
		let dx = Math.cos(angle) * dist;
		let dy = Math.sin(angle) * dist;
		if (motion === 'rise') dy = -Math.abs(dy) - 14;
		if (motion === 'fall') dy = Math.abs(dy) + 14;
		tl.fromTo(
			dot,
			{ opacity: 1, scale: 1 },
			{
				x: dx,
				y: dy,
				opacity: 0,
				scale: 0.3,
				duration: 0.55 + Math.random() * 0.2,
				ease: motion === 'fall' ? 'power1.in' : 'power2.out'
			},
			0.08 + Math.random() * 0.08
		);
	}

	// anéis (psychic/ghost)
	if (motion === 'ring') {
		for (let i = 0; i < 2; i++) {
			const ring = makeRing(layer, color);
			tl.fromTo(
				ring,
				{ opacity: 0.9, scale: 0.4 },
				{ opacity: 0, scale: 2.4 + i * 0.8, duration: 0.55, ease: 'power2.out' },
				0.1 + i * 0.12
			);
		}
	}

	// emojis do elemento — identidade visual do jogo
	if (element) {
		for (let i = 0; i < 2; i++) {
			const glyph = makeGlyph(layer, ELEMENT_EMOJI[element]);
			tl.fromTo(
				glyph,
				{ opacity: 0, scale: 0.5, x: -14 + i * 28, y: 8 },
				{ opacity: 1, scale: 1.15, y: -22 - i * 10, duration: 0.3, ease: 'power2.out' },
				0.12 + i * 0.1
			);
			tl.to(glyph, { opacity: 0, y: '-=14', duration: 0.28, ease: 'power1.out' }, '>-0.05');
		}
	}
}
