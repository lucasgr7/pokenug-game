import type { CardRarity } from '$lib/game/types';

export interface CardTier {
	damage: number;
	cost: number;
	rarity: CardRarity;
	money: number;
	elemAmount: number;
	tier: number;
}

export interface DefTier {
    block: number;
    cost: number;
    rarity: CardRarity;
    money: number;
    tier: number;
}

export interface HealTier {
    heal: number;
    cost: number;
    rarity: CardRarity;
    money: number;
    tier: number;
}

// Escalonamento de dano acompanha aproximadamente a curva Fibonacci (1, 2, 3, 5, 8, 13) e continua crescendo.
export const ATTACK_TIERS: CardTier[] = [
    // Tier 1 - 4
	{ damage: 8, cost: 1, rarity: 'common', money: 440, elemAmount: 100, tier: 1 },
	{ damage: 12, cost: 1, rarity: 'common', money: 860, elemAmount: 300, tier: 1 },
	{ damage: 18, cost: 2, rarity: 'rare', money: 1200, elemAmount: 900, tier: 2 },
	{ damage: 25, cost: 3, rarity: 'epic', money: 1700, elemAmount: 2500, tier: 2 },
    // Tier 5 - 10 (Fibonacci/Extremo)
    { damage: 45, cost: 2, rarity: 'rare', money: 4000, elemAmount: 5000, tier: 3 },
    { damage: 70, cost: 3, rarity: 'epic', money: 9500, elemAmount: 12000, tier: 3 },
    { damage: 120, cost: 3, rarity: 'epic', money: 25000, elemAmount: 35000, tier: 4 },
    { damage: 210, cost: 4, rarity: 'epic', money: 65000, elemAmount: 90000, tier: 5 },
    { damage: 400, cost: 4, rarity: 'epic', money: 200000, elemAmount: 250000, tier: 6 },
    { damage: 800, cost: 5, rarity: 'epic', money: 1000000, elemAmount: 1000000, tier: 6 },
];

export const DEF_TIERS: DefTier[] = [
	{ block: 5, cost: 1, rarity: 'common', money: 350, tier: 1 },
	{ block: 8, cost: 1, rarity: 'common', money: 550, tier: 1 },
	{ block: 12, cost: 2, rarity: 'rare', money: 950, tier: 2 },
    { block: 25, cost: 2, rarity: 'rare', money: 3000, tier: 2 },
    { block: 45, cost: 3, rarity: 'epic', money: 8000, tier: 3 },
    { block: 90, cost: 3, rarity: 'epic', money: 22000, tier: 4 },
    { block: 150, cost: 4, rarity: 'epic', money: 60000, tier: 5 },
    { block: 300, cost: 4, rarity: 'epic', money: 180000, tier: 6 },
    { block: 600, cost: 5, rarity: 'epic', money: 850000, tier: 6 }
];

export const HEAL_TIERS: HealTier[] = [
	{ heal: 8, cost: 1, rarity: 'common', money: 450, tier: 1 },
	{ heal: 15, cost: 2, rarity: 'rare', money: 950, tier: 1 },
	{ heal: 25, cost: 3, rarity: 'epic', money: 1650, tier: 2 },
    { heal: 50, cost: 3, rarity: 'rare', money: 4500, tier: 3 },
    { heal: 100, cost: 4, rarity: 'epic', money: 12000, tier: 4 },
    { heal: 200, cost: 4, rarity: 'epic', money: 35000, tier: 5 },
    { heal: 400, cost: 5, rarity: 'epic', money: 100000, tier: 6 },
    { heal: 800, cost: 5, rarity: 'epic', money: 350000, tier: 6 }
];