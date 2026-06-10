import { beforeEach, vi } from 'vitest';

// IndexedDB does not exist in Node. The card persistence adapter is replaced
// by spies so engine code that fires db cleanups (exhaust 'run', misalignment
// sanitize, relics) runs cleanly — and tests can assert on the calls, e.g.:
//   import { removeFromDeck } from '$lib/db/cards';
//   expect(vi.mocked(removeFromDeck)).toHaveBeenCalled();
vi.mock('$lib/db/cards', () => ({
	getInventory: vi.fn(async () => []),
	addToInventory: vi.fn(async () => {}),
	addManyToInventory: vi.fn(async () => {}),
	removeFromInventory: vi.fn(async () => {}),
	getActiveDeck: vi.fn(async () => []),
	addToDeck: vi.fn(async () => {}),
	removeFromDeck: vi.fn(async () => {}),
	setActiveDeck: vi.fn(async () => {}),
	resetDeckToStarters: vi.fn(async () => {}),
	updateCardEverywhere: vi.fn(async () => {})
}));

beforeEach(() => {
	vi.clearAllMocks();
});
