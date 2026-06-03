import { fetchPokemon } from '$lib/api/pokeapi';
import { addManyToInventory, setActiveDeck } from '$lib/db/cards';
import { addPokemon } from '$lib/db/pokemon';
import { savePlayer } from '$lib/db/player';
import { STARTER_DECK } from '$lib/data/cards';
import { REGIONS } from '$lib/data/regions';
import type { StarterDef } from '$lib/data/starters';
import { now } from '$lib/utils/time';
import { applyElementalHpBonusToPokemon, applyThemeToDom, game } from './state.svelte';
import type { Card, CapturedPokemon, Player } from './types';

function buildStarterDeck(): Card[] {
	const cards: Card[] = [];
	for (const [templateId, qty] of STARTER_DECK) {
		for (let i = 0; i < qty; i++) {
			cards.push({ id: crypto.randomUUID(), templateId });
		}
	}
	return cards;
}

/** Cria o jogador, o pokémon inicial e o deck inicial. Persiste tudo. */
export async function createPlayer(name: string, starter: StarterDef): Promise<void> {
	// HP base vem da PokeAPI; usa fallback se a rede falhar.
	let maxHp = 45;
	try {
		const data = await fetchPokemon(starter.speciesId);
		maxHp = data.maxHp;
	} catch {
		// mantém fallback
	}

	const pokemon: CapturedPokemon = {
		id: crypto.randomUUID(),
		speciesId: starter.speciesId,
		name: starter.name,
		element: starter.element,
		maxHp,
		currentHp: maxHp,
		capturedAt: now()
	};
	applyElementalHpBonusToPokemon(pokemon);
	await addPokemon(pokemon);

	const player: Player = {
		id: 'me',
		name: name.trim(),
		createdAt: now(),
		money: 50,
		elementPoints: {},
		activePokemonId: pokemon.id,
		defeatedByRegion: {},
		unlockedRegions: [REGIONS[0].id],
		theme: 'dark',
		lastShopRefresh: 0,
		paidRefreshCountToday: 0,
		lastBoosterPackPurchaseAt: 0,
		ngu: {
			moneyMultiplierLevel: 0,
			elementalDamageLevels: {},
			elementalHpLevels: {},
			globalDamageLevel: 0
		},
		pilhaExaurir: 0,
		bannedTemplateIds: [],
		ghostPermDebuff: 0
	};
	await savePlayer(player);

	const deck = buildStarterDeck();
	await addManyToInventory(deck);
	await setActiveDeck(deck);

	game.player = player;
	game.roster = [pokemon];
	applyThemeToDom(player.theme);
}
