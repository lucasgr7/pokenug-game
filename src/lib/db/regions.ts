import { getDb, type RegionProgress } from './index';

export const BOSS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function withDefaults(progress: RegionProgress | undefined): RegionProgress {
	return {
		defeats: progress?.defeats ?? 0,
		bossLastDefeatedAt: progress?.bossLastDefeatedAt ?? 0,
		bossFirstFightDone: progress?.bossFirstFightDone ?? false
	};
}

export async function getRegionProgress(regionId: string): Promise<RegionProgress> {
	const db = await getDb();
	return withDefaults(await db.get('regions', regionId));
}

export async function setRegionProgress(
	regionId: string,
	progress: RegionProgress
): Promise<void> {
	const db = await getDb();
	await db.put('regions', withDefaults(progress), regionId);
}

export async function incrementDefeat(regionId: string): Promise<number> {
	const current = await getRegionProgress(regionId);
	const next = { ...current, defeats: current.defeats + 1 };
	await setRegionProgress(regionId, next);
	return next.defeats;
}

export async function markBossFightDone(regionId: string): Promise<void> {
	const current = await getRegionProgress(regionId);
	if (current.bossFirstFightDone) return;
	await setRegionProgress(regionId, { ...current, bossFirstFightDone: true });
}

export async function markBossDefeated(regionId: string): Promise<void> {
	const current = await getRegionProgress(regionId);
	await setRegionProgress(regionId, {
		...current,
		bossFirstFightDone: true,
		bossLastDefeatedAt: Date.now()
	});
}

export function getBossCooldownRemainingMs(progress: RegionProgress, at: number = Date.now()): number {
	if (progress.bossLastDefeatedAt <= 0) return 0;
	return Math.max(0, progress.bossLastDefeatedAt + BOSS_COOLDOWN_MS - at);
}

export function canFightBoss(progress: RegionProgress, at: number = Date.now()): boolean {
	return getBossCooldownRemainingMs(progress, at) <= 0;
}
