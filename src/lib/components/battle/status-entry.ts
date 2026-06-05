import { getStatusDef } from '$lib/game/status';
import { NATURES } from '$lib/data/natures';
import type { BattleState, ActiveStatus } from '$lib/game/types';

export interface StatusEntry {
	icon: string;
	label: string;
	description: string;
	color: string;
	bg: string;
	scope: string;
	decay: string;
}

export function buildEntry(
	holder: { statuses: ActiveStatus[] },
	st: ActiveStatus,
	s: BattleState
): StatusEntry | null {
	const def = getStatusDef(st.defId);
	if (!def?.hooks.emblem) return null;
	const emblem = def.hooks.emblem(st, s);
	if (!emblem) return null;
	let description = emblem.title;
	if (st.defId.startsWith('nature_')) {
		const natureId = st.defId.replace('nature_', '');
		if (natureId in NATURES) description = NATURES[natureId as keyof typeof NATURES].description;
	}
	return {
		icon: emblem.icon,
		label: emblem.label,
		description,
		color: emblem.color,
		bg: emblem.bg,
		scope: holder === s.player ? 'Jogador' : 'Inimigo',
		decay: def.decay === 'permanent' ? 'Batalha' : def.decay === 'turnStart' ? 'Início do turno' : 'Fim do turno'
	};
}
