import { getDb } from './index';
import type { Player } from '$lib/game/types';

const KEY = 'me';

function ensureNgu(player: Player): void {
	if (!player.ngu) {
		player.ngu = { moneyMultiplierLevel: 0 };
	} else {
		player.ngu.moneyMultiplierLevel ??= 0;
		// Strip legacy elemental ngu fields
		delete (player.ngu as Record<string, unknown>).elementalDamageLevels;
		delete (player.ngu as Record<string, unknown>).elementalHpLevels;
		delete (player.ngu as Record<string, unknown>).globalDamageLevel;
	}

	// Strip legacy elementPoints
	delete (player as unknown as Record<string, unknown>).elementPoints;

	player.lastBoosterPackPurchaseAt ??= 0;
	player.pilhaExaurir ??= 0;
	player.bannedTemplateIds ??= [];
	player.ghostPermDebuff ??= 0;
	player.platinum ??= 0;
	player.musicMuted ??= false;
}

export async function getPlayer(): Promise<Player | undefined> {
	const db = await getDb();
	const player = await db.get('player', KEY);
	if (player) {
		ensureNgu(player);
	}
	return player;
}

export async function savePlayer(player: Player): Promise<void> {
	const db = await getDb();
	await db.put('player', player, KEY);
}

export async function hasPlayer(): Promise<boolean> {
	return (await getPlayer()) !== undefined;
}
