import { t } from '$lib/i18n';
import { ELEMENT_COLOR, ELEMENT_EMOJI } from './elements';
import type { EnemyTurnResult, PlayCardResult } from './battle.svelte';
import type { BattleEvent } from './status/types';


export interface LogPart {
	text: string;
	color?: string;
}

export interface BattleLogEntry {
	id: string;
	line: LogPart[];
}

const EVENT_GLYPH: Record<string, { glyph: string; color: string }> = {
	static_shock: { glyph: '⚡', color: '#facc15' },
	dano_eletrico: { glyph: '⚡', color: '#facc15' },
	reflexo: { glyph: '🛡', color: '#a78bfa' },
	revenge_shield: { glyph: '🧊', color: '#67e8f9' },
	shield_fire_thorns: { glyph: '🔥', color: '#ef4444' },
	shield_ice_reflect: { glyph: '🧊', color: '#67e8f9' },
	electric_descarga: { glyph: '⚡', color: '#facc15' },
	psychic_refluxo: { glyph: '🔮', color: '#db2777' },
	bug_enxame: { glyph: '🐛', color: '#84cc16' },
	ice_congelamento: { glyph: '❄', color: '#22d3ee' }
};

export function appendEvents(parts: LogPart[], events?: BattleEvent[]): LogPart[] {
	if (!events || events.length === 0) return parts;
	for (const e of events) {
		if (e.kind === 'bonus_dmg') {
			const g = EVENT_GLYPH[e.source] ?? { glyph: '⚡', color: '#a8a29e' };
			parts.push({ text: ` · ${g.glyph}${e.amount}`, color: g.color });
		} else if (e.kind === 'status_applied') {
			const g = EVENT_GLYPH[e.id] ?? { glyph: '+', color: '#a8a29e' };
			parts.push({ text: ` · +${g.glyph}${e.stacks > 1 ? e.stacks : ''}`, color: g.color });
		}
	}
	return parts;
}

function appendExhausted(parts: LogPart[], exhausted: boolean): LogPart[] {
	return exhausted ? [...parts, { text: ' 💤', color: '#64748b' }] : parts;
}

function buildAttackPlayLog(result: PlayCardResult, templateName: string): LogPart[] {
	const element = result.element as keyof typeof ELEMENT_COLOR | null | undefined;
	const parts: LogPart[] = [
		{
			text: `${element ? ELEMENT_EMOJI[element] : '⚔'} ${templateName}`,
			color: element ? ELEMENT_COLOR[element] : '#f87171'
		}
	];

	if (result.damage !== undefined) {
		parts.push({ text: ` · ⚔${result.damage}`, color: '#f87171' });
	}

	if (result.effectiveness !== undefined) {
		if (result.effectiveness > 1) parts.push({ text: ' 💥', color: '#fbbf24' });
		if (result.effectiveness < 1) parts.push({ text: ' 🫤', color: '#94a3b8' });
	}

	return parts;
}

function appendMatchupDamage(parts: LogPart[], modifier?: number): LogPart[] {
	if (!modifier) return parts;
	const positive = modifier > 0;
	return [
		...parts,
		{
			text: t('battleLog.modifierTipo', { sign: positive ? '+' : '', modifier }),
			color: positive ? '#fbbf24' : '#94a3b8'
		}
	];
}

export function buildPlayLog(result: PlayCardResult, templateName: string): LogPart[] {
	let parts: LogPart[];
	switch (result.kind) {
		case 'attack':
			parts = buildAttackPlayLog(result, templateName);
			parts = appendMatchupDamage(parts, result.damageModifier);
			if (result.drawCount) {
				const cnt = result.drawCount;
				parts = [...parts, { text: t('battleLog.carta', { count: cnt }), color: '#7dd3fc' }];
			}
			break;
		case 'defense':
			parts = [
				{ text: t('battleLog.block', { template: templateName, block: result.blocked ?? 0 }), color: '#60a5fa' },
				...(result.blocked ? [{ text: ` · +${result.blocked}`, color: '#60a5fa' }] : [])
			];
			break;
		case 'heal':
			parts = [
				{ text: t('battleLog.hp', { template: templateName, healed: result.healed ?? 0 }), color: '#4ade80' },
				...(result.healed ? [{ text: ` · +${result.healed} HP`, color: '#4ade80' }] : [])
			];
			break;
		case 'energy':
			parts = [
				{ text: t('battleLog.mana', { template: templateName, mana: result.manaGained ?? 0 }), color: '#eab308' },
				...(result.manaGained ? [{ text: ` · +${result.manaGained} mana`, color: '#eab308' }] : [])
			];
			break;
		case 'power':
			parts = [{ text: `⚡ ${templateName}`, color: '#a855f7' }];
			break;
		case 'combo':
			parts = [{ text: `💢 ${templateName}`, color: '#fb923c' }];
			break;
		case 'debuff':
			parts = [{ text: `👤 ${templateName}`, color: '#94a3b8' }];
			break;
		case 'capture':
			parts = [{ text: `🎯 ${templateName}` }];
			break;
		default:
			parts = [{ text: `🃏 ${templateName}` }];
	}

	parts = appendEvents(parts, result.events);
	return appendExhausted(parts, result.exhausted);
}

export function buildEndTurnLog(result: EnemyTurnResult): LogPart[] {
	let parts: LogPart[] = [{ text: t('battleLog.turnEnd'), color: '#64748b' }];

	if (result.kind === 'attack') {
		if (result.damage && result.damage > 0) {
			const dmg = result.damage;
			const emoji = result.element ? ELEMENT_EMOJI[result.element] : '';
			parts.push({ text: t('battleLog.enemyAttack', { emoji, damage: dmg }), color: '#ef4444' });
		} else {
			parts.push({ text: t('battleLog.attackBlocked'), color: '#60a5fa' });
		}
		parts = appendMatchupDamage(parts, result.damageModifier);
		return appendEvents(parts, result.events);
	}

	if (result.kind === 'defend') {
		parts.push({ text: t('battleLog.enemyBlocked', { block: result.enemyBlock ?? 0 }), color: '#60a5fa' });
		return appendEvents(parts, result.events);
	}

	parts.push({ text: t('battleLog.enemyPrepared'), color: '#a8a29e' });
	return appendEvents(parts, result.events);
}