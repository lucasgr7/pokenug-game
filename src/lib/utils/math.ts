export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** Formata números grandes de forma compacta: 1.2k, 3.4M. */
export function formatNumber(n: number): string {
	const v = Math.floor(n);
	if (v < 1000) return v.toString();
	if (v < 1_000_000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
	return `${(v / 1_000_000).toFixed(1)}M`;
}
