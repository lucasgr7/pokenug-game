/** Inteiro aleatório entre min e max, inclusivo. */
export function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Escolhe um elemento aleatório de um array (assume não vazio). */
export function pick<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

/** Embaralha uma cópia do array (Fisher–Yates). */
export function shuffle<T>(arr: readonly T[]): T[] {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Retorna true com probabilidade p (0..1). */
export function chance(p: number): boolean {
	return Math.random() < p;
}

/** Escolha ponderada: pesos paralelos ao array de itens. */
export function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
	const total = weights.reduce((a, b) => a + b, 0);
	let roll = Math.random() * total;
	for (let i = 0; i < items.length; i++) {
		roll -= weights[i];
		if (roll < 0) return items[i];
	}
	return items[items.length - 1];
}
