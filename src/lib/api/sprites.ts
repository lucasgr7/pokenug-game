import { getDb } from '$lib/db/index';
import { fetchPokemon } from './pokeapi';

// Object URLs já criados nesta sessão, por espécie, para reaproveitar.
const objectUrls = new Map<number, string>();

/**
 * Retorna uma URL utilizável em <img> para a arte oficial da espécie.
 * Usa cache no IndexedDB (Blob) para funcionar offline após o primeiro fetch.
 */
export async function getSpriteUrl(speciesId: number): Promise<string> {
	const existingUrl = objectUrls.get(speciesId);
	if (existingUrl) return existingUrl;

	const db = await getDb();
	let blob = await db.get('sprites', speciesId);

	if (!blob) {
		const data = await fetchPokemon(speciesId);
		if (!data.artworkUrl) throw new Error(`Sem arte para a espécie ${speciesId}`);
		const res = await fetch(data.artworkUrl);
		if (!res.ok) throw new Error(`Falha ao baixar arte ${speciesId}: ${res.status}`);
		blob = await res.blob();
		await db.put('sprites', blob, speciesId);
	}

	const url = URL.createObjectURL(blob);
	objectUrls.set(speciesId, url);
	return url;
}
