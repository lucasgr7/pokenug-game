export function now(): number {
	return Date.now();
}

/** Timestamp do início do dia local (00:00). */
export function startOfToday(ts: number = Date.now()): number {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/** Verdadeiro se os dois timestamps caem em dias locais diferentes. */
export function isDifferentDay(a: number, b: number): boolean {
	return startOfToday(a) !== startOfToday(b);
}

/** Formata uma duração em ms como "2h 13m" / "5m 02s" / "12s". */
export function formatDuration(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
	return `${s}s`;
}
