import { ELEMENT_COLOR, ELEMENT_EMOJI } from './elements';
import type { EnemyTurnResult, PlayCardResult } from './battle.svelte';

export interface LogPart {
	text: string;
	color?: string;
}

export interface BattleLogEntry {
	id: string;
	line: LogPart[];
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

export function buildPlayLog(result: PlayCardResult, templateName: string): LogPart[] {
	switch (result.kind) {
		case 'attack':
			return appendExhausted(buildAttackPlayLog(result, templateName), result.exhausted);
		case 'defense':
			return appendExhausted(
				[
					{ text: `🛡 ${templateName}`, color: '#60a5fa' },
					...(result.blocked ? [{ text: ` · +${result.blocked}`, color: '#60a5fa' }] : [])
				],
				result.exhausted
			);
		case 'heal':
			return appendExhausted(
				[
					{ text: `❤ ${templateName}`, color: '#4ade80' },
					...(result.healed ? [{ text: ` · +${result.healed} HP`, color: '#4ade80' }] : [])
				],
				result.exhausted
			);
		case 'energy':
			return appendExhausted(
				[
					{ text: `⚡ ${templateName}`, color: '#eab308' },
					...(result.manaGained ? [{ text: ` · +${result.manaGained} mana`, color: '#eab308' }] : [])
				],
				result.exhausted
			);
		case 'power':
			return appendExhausted([{ text: `⚡ ${templateName}`, color: '#a855f7' }], result.exhausted);
		case 'combo':
			return appendExhausted([{ text: `💢 ${templateName}`, color: '#fb923c' }], result.exhausted);
		case 'debuff':
			return appendExhausted([{ text: `👤 ${templateName}`, color: '#94a3b8' }], result.exhausted);
		case 'capture':
			return appendExhausted([{ text: `🎯 ${templateName}` }], result.exhausted);
		default:
			return appendExhausted([{ text: `🃏 ${templateName}` }], result.exhausted);
	}
}

export function buildEndTurnLog(result: EnemyTurnResult): LogPart[] {
	const parts: LogPart[] = [{ text: '↦ ', color: '#64748b' }];

	if (result.kind === 'attack') {
		if (result.damage && result.damage > 0) {
			parts.push({ text: `🤺 −${result.damage} HP`, color: '#ef4444' });
		} else {
			parts.push({ text: '🛡 Ataque bloqueado!', color: '#60a5fa' });
		}
		return parts;
	}

	if (result.kind === 'defend') {
		parts.push({ text: `🛡 Inimigo +${result.enemyBlock} bloqueio`, color: '#60a5fa' });
		return parts;
	}

	parts.push({ text: '✨ Inimigo se preparou', color: '#a8a29e' });
	return parts;
}