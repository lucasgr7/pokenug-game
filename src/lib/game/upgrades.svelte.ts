import { getInventory, updateCardEverywhere } from '$lib/db/cards';
import { getTemplate } from '$lib/data/cards';
import { game, spendMoney, schedulePersist } from './state.svelte';
import type { Card, CardTemplate } from './types';

const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const MONEY_BASE = 40;
const MAX_LEVEL = FIB.length;

export function isUpgradeable(tpl: CardTemplate | undefined): boolean {
	return !!tpl && (tpl.kind === 'attack' || tpl.kind === 'defense');
}

export function cardUpgradeCost(tpl: CardTemplate, level: number): { money: number } {
	const f = FIB[Math.min(level, FIB.length - 1)];
	return {
		money: f * MONEY_BASE
	};
}

export function canAffordUpgrade(tpl: CardTemplate, level: number): boolean {
	const cost = cardUpgradeCost(tpl, level);
	const p = game.player;
	if (!p) return false;
	if (p.money < cost.money) return false;
	return true;
}

export async function upgradeCardCopy(cardId: string): Promise<number | null> {
	const inv = await getInventory();
	const card = inv.find((c) => c.id === cardId);
	if (!card) return null;
	const tpl = getTemplate(card.templateId);
	if (!isUpgradeable(tpl) || !tpl) return null;

	const level = card.upgrades ?? 0;
	if (level >= MAX_LEVEL) return null;
	if (!canAffordUpgrade(tpl, level)) return null;

	const cost = cardUpgradeCost(tpl, level);
	if (!spendMoney(cost.money)) return null;

	const next: Card = { id: card.id, templateId: card.templateId, upgrades: level + 1 };
	await updateCardEverywhere(next);
	schedulePersist();
	return level + 1;
}
