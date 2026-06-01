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

// One entry per mana cost (1–5) — no duplicates.
export const ATTACK_TIERS: CardTier[] = [
    { damage: 12,  cost: 1, rarity: 'common', money: 860,     elemAmount: 300,     tier: 1 },
    { damage: 45,  cost: 2, rarity: 'rare',   money: 4000,    elemAmount: 5000,    tier: 2 },
    { damage: 120, cost: 3, rarity: 'epic',   money: 25000,   elemAmount: 35000,   tier: 3 }
];

export const DEF_TIERS: DefTier[] = [
    { block: 8,   cost: 1, rarity: 'common', money: 550,    tier: 1 },
    { block: 25,  cost: 2, rarity: 'rare',   money: 3000,   tier: 2 },
    { block: 90,  cost: 3, rarity: 'epic',   money: 22000,  tier: 3 },
    { block: 300, cost: 4, rarity: 'epic',   money: 180000, tier: 4 },
    { block: 600, cost: 5, rarity: 'epic',   money: 850000, tier: 5 },
];

export const HEAL_TIERS: HealTier[] = [
    { heal: 8,   cost: 1, rarity: 'common', money: 450,    tier: 1 },
    { heal: 15,  cost: 2, rarity: 'rare',   money: 950,    tier: 2 },
    { heal: 50,  cost: 3, rarity: 'rare',   money: 4500,   tier: 3 },
    { heal: 200, cost: 4, rarity: 'epic',   money: 35000,  tier: 4 },
    { heal: 800, cost: 5, rarity: 'epic',   money: 350000, tier: 5 },
];
