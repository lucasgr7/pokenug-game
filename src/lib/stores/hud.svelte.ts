import type { Element } from '$lib/game/types';

export interface HudTradeEvent {
	id: string;
	element: Element;
	kind: 'buy' | 'sell';
}

export const hudTrades = $state<{ events: HudTradeEvent[] }>({ events: [] });

export function notifyHudTrade(element: Element, kind: 'buy' | 'sell'): void {
	const id = crypto.randomUUID();
	hudTrades.events = [...hudTrades.events, { id, element, kind }];
	setTimeout(() => {
		hudTrades.events = hudTrades.events.filter((e) => e.id !== id);
	}, 2200);
}
