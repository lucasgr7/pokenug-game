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

function appendShockDamage(parts: LogPart[], result: PlayCardResult): LogPart[] {
	return result.shockDamage && result.shockDamage > 0
		? [...parts, { text: ` · ⚡${result.shockDamage}`, color: '#facc15' }]
		: parts;
}

function appendMatchupDamage(parts: LogPart[], modifier?: number): LogPart[] {
	if (!modifier) return parts;
	const positive = modifier > 0;
	return [
		...parts,
		{
			text: ` · ${positive ? '+' : ''}${modifier} tipo`,
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
				parts = [...parts, { text: ` · +${result.drawCount} carta`, color: '#7dd3fc' }];
			}
			break;
		case 'defense':
			parts = [
				{ text: `🛡 ${templateName}`, color: '#60a5fa' },
				...(result.blocked ? [{ text: ` · +${result.blocked}`, color: '#60a5fa' }] : [])
			];
			break;
		case 'heal':
			parts = [
				{ text: `❤ ${templateName}`, color: '#4ade80' },
				...(result.healed ? [{ text: ` · +${result.healed} HP`, color: '#4ade80' }] : [])
			];
			break;
		case 'energy':
			parts = [
				{ text: `⚡ ${templateName}`, color: '#eab308' },
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

	return appendExhausted(appendShockDamage(parts, result), result.exhausted);
}

export function buildEndTurnLog(result: EnemyTurnResult): LogPart[] {
	const parts: LogPart[] = [{ text: '↦ ', color: '#64748b' }];

	if (result.kind === 'attack') {
		if (result.damage && result.damage > 0) {
			parts.push({ text: `${result.element ? `${ELEMENT_EMOJI[result.element]} ` : ''}🤺 −${result.damage} HP`, color: '#ef4444' });
		} else {
			parts.push({ text: '🛡 Ataque bloqueado!', color: '#60a5fa' });
		}
		return appendMatchupDamage(parts, result.damageModifier);
	}

	if (result.kind === 'defend') {
		parts.push({ text: `🛡 Inimigo +${result.enemyBlock} bloqueio`, color: '#60a5fa' });
		return parts;
	}

	parts.push({ text: '✨ Inimigo se preparou', color: '#a8a29e' });
	return parts;
}