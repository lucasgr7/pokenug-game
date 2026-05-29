import { getDb, type RegionProgress } from './index';

export async function getRegionProgress(regionId: string): Promise<RegionProgress> {
	const db = await getDb();
	return (await db.get('regions', regionId)) ?? { defeats: 0 };
}

export async function setRegionProgress(
	regionId: string,
	progress: RegionProgress
): Promise<void> {
	const db = await getDb();
	await db.put('regions', progress, regionId);
}

export async function incrementDefeat(regionId: string): Promise<number> {
	const current = await getRegionProgress(regionId);
	const next = { defeats: current.defeats + 1 };
	await setRegionProgress(regionId, next);
	return next.defeats;
}
