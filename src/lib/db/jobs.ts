import { getDb } from './index';
import type { ActiveJob } from '$lib/game/types';

export async function getAllJobs(): Promise<ActiveJob[]> {
	const db = await getDb();
	return db.getAll('jobs');
}

export async function getJob(pokemonId: string): Promise<ActiveJob | undefined> {
	const db = await getDb();
	return db.get('jobs', pokemonId);
}

export async function setJob(job: ActiveJob): Promise<void> {
	const db = await getDb();
	await db.put('jobs', job, job.pokemonId);
}

export async function removeJob(pokemonId: string): Promise<void> {
	const db = await getDb();
	await db.delete('jobs', pokemonId);
}

export async function saveJobs(jobs: ActiveJob[]): Promise<void> {
	const db = await getDb();
	const tx = db.transaction('jobs', 'readwrite');
	for (const j of jobs) tx.store.put(j, j.pokemonId);
	await tx.done;
}
