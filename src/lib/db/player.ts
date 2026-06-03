import { getDb } from './index';
import type { Player } from '$lib/game/types';

const KEY = 'me';

function ensureNgu(player: Player): void {
	if (!player.ngu) {
		player.ngu = {
			moneyMultiplierLevel: 0,
			elementalDamageLevels: {},
			elementalHpLevels: {},
			globalDamageLevel: 0
		};
		return;
	}

	player.ngu.moneyMultiplierLevel ??= 0;
	player.ngu.elementalDamageLevels ??= {};
	player.ngu.elementalHpLevels ??= {};
	player.ngu.globalDamageLevel ??= 0;
	player.lastBoosterPackPurchaseAt ??= 0;

	// Campos de run persistentes (GDD) — migração para saves antigos
	player.pilhaExaurir ??= 0;
	player.bannedTemplateIds ??= [];
	player.ghostPermDebuff ??= 0;
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
