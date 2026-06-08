import type { CardTemplate } from '$lib/game/types';

/**
 * Card art registry.
 *
 * Every image under `src/lib/assets/cards/**` is collected at build time, so
 * dropping a new file there makes it available with zero code changes. See the
 * folder's README for the naming convention. Resolution falls back to the inline
 * SVG glyph (handled by the consumer) when nothing matches.
 */

// Eager `?url` glob → each value is the hashed, served URL string for the asset.
const modules = import.meta.glob<string>('../assets/cards/**/*.{jpg,jpeg,png,webp,avif}', {
	eager: true,
	query: '?url',
	import: 'default'
});

// Key by `<folder>/<basename-without-extension>` (e.g. `water/water_splash`).
const ART: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
	const m = path.match(/\/cards\/(.+)\.[^.]+$/);
	if (m) ART[m[1]] = url;
}

/** Folder that holds a card's art — its element, or `neutral` for colorless cards. */
function artFolder(tpl: Pick<CardTemplate, 'element'>): string {
	return tpl.element ?? 'neutral';
}

/**
 * Resolve the art URL for a card, or `null` when no image exists (caller should
 * then render the SVG glyph). Order: per-card → per-kind → per-element generic.
 */
export function getCardArt(tpl: Pick<CardTemplate, 'id' | 'element' | 'kind'>): string | null {
	const folder = artFolder(tpl);
	const candidates = [`${folder}/${tpl.id}`, `${folder}/_kind_${tpl.kind}`, `${folder}/_default`];
	for (const key of candidates) {
		if (ART[key]) return ART[key];
	}
	return null;
}
