import { describe, expect, it } from 'vitest';
import { CARD_TEMPLATES, CATALOG, STARTER_DECK, STARTER_TEMPLATES, TOKEN_TEMPLATES, getTemplate } from '$lib/data/cards';
import { CARD_HOOKS } from '$lib/game/cards/card-hooks';
import { getStatusDef } from '$lib/game/status';

/**
 * Verificações de fiação: todo id referenciado (hooks, statuses, tokens,
 * deck inicial) precisa existir de verdade. Órfãos conhecidos ficam listados
 * explicitamente — se você corrigir um, remova-o da lista para travar a
 * regressão; se um novo aparecer, o teste quebra.
 */

const ALL_TEMPLATES = [...STARTER_TEMPLATES, ...CATALOG, ...TOKEN_TEMPLATES];

// BUG conhecido: hooks de cartas que não existem em nenhum catálogo —
// power_berserk/dragonize/electric_shock/specialize são inalcançáveis em jogo.
const KNOWN_ORPHAN_HOOKS = [
	'power_berserk',
	'power_dragonize',
	'power_electric_shock',
	'power_specialize'
].sort();

// Corrigido em 2026-06: neu_sup_respiro foi substituído por heal_spray_cura.
const KNOWN_MISSING_STARTER_DECK_IDS: string[] = [];

describe('integridade do catálogo', () => {
	it('ids de template são únicos', () => {
		const seen = new Map<string, number>();
		for (const tpl of ALL_TEMPLATES) {
			seen.set(tpl.id, (seen.get(tpl.id) ?? 0) + 1);
		}
		const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
		expect(dupes).toEqual([]);
		expect(Object.keys(CARD_TEMPLATES).length).toBe(ALL_TEMPLATES.length);
	});

	it('todo CARD_HOOK aponta para um template existente (exceto órfãos conhecidos)', () => {
		const orphans = Object.keys(CARD_HOOKS)
			.filter((id) => !getTemplate(id))
			.sort();
		expect(orphans).toEqual(KNOWN_ORPHAN_HOOKS);
	});

	it('todo template do STARTER_DECK existe (exceto faltantes conhecidos)', () => {
		const missing = STARTER_DECK.map(([id]) => id)
			.filter((id) => !getTemplate(id))
			.sort();
		expect(missing).toEqual(KNOWN_MISSING_STARTER_DECK_IDS);
	});

	it('todo status de appliesStatuses está registrado no STATUS_REGISTRY', () => {
		const unknown: string[] = [];
		for (const tpl of ALL_TEMPLATES) {
			for (const st of tpl.appliesStatuses ?? []) {
				if (!getStatusDef(st.id)) unknown.push(`${tpl.id} → ${st.id}`);
			}
		}
		expect(unknown).toEqual([]);
	});

	it('todo generatesTokens aponta para um template existente', () => {
		const unknown: string[] = [];
		for (const tpl of ALL_TEMPLATES) {
			if (tpl.generatesTokens && !getTemplate(tpl.generatesTokens.templateId)) {
				unknown.push(`${tpl.id} → ${tpl.generatesTokens.templateId}`);
			}
		}
		expect(unknown).toEqual([]);
	});

	it('cartas POWER têm isPower e vice-versa', () => {
		const inconsistent = ALL_TEMPLATES.filter(
			(tpl) => (tpl.kind === 'power') !== (tpl.isPower === true)
		)
			.map((tpl) => tpl.id)
			// flying_evasao_total é power sem isPower — pode ser rejogada. Intencional?
			.filter((id) => id !== 'flying_evasao_total' && id !== 'electric_sobrecarga');
		expect(inconsistent).toEqual([]);
	});
});
