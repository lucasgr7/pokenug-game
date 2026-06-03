<script lang="ts">
	import Modal from './Modal.svelte';
	import Card from './Card.svelte';
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import type { CardTemplate, Element } from '$lib/game/types';

	let {
		templateId,
		open = false,
		onclose,
		onplay,
		playable = false
	}: {
		templateId: string | null;
		open?: boolean;
		onclose: () => void;
		onplay?: () => void;
		playable?: boolean;
	} = $props();

	type InfoTone = 'default' | 'positive' | 'warning' | 'danger' | 'accent';
	type InfoRow = { label: string; value: string; tone?: InfoTone };

	const rarityLabel: Record<CardTemplate['rarity'], string> = {
		starter: 'Starter',
		common: 'Comum',
		rare: 'Rara',
		epic: 'Epica',
		secret: 'Secreta'
	};

	const kindLabel: Record<CardTemplate['kind'], string> = {
		attack: 'Ataque',
		defense: 'Defesa',
		heal: 'Cura',
		capture: 'Captura',
		buff: 'Buff',
		power: 'Power',
		relic: 'Reliquia',
		energy: 'Energia',
		combo: 'Combo',
		debuff: 'Debuff'
	};

	let tpl = $derived(templateId ? getTemplate(templateId) : null);

	function formatPercent(v: number): string {
		return `${Math.round(v * 100)}%`;
	}

	let primaryRows = $derived.by<InfoRow[]>(() => {
		if (!tpl) return [];
		const rows: InfoRow[] = [
			{ label: 'Custo', value: `${tpl.cost} mana`, tone: 'accent' },
			{ label: 'Tipo', value: kindLabel[tpl.kind] },
			{ label: 'Raridade', value: rarityLabel[tpl.rarity] }
		];

		if (tpl.element) {
			rows.push({
				label: 'Elemento',
				value: `${ELEMENT_EMOJI[tpl.element as Element]} ${ELEMENT_LABEL[tpl.element as Element]}`
			});
		}

		if (tpl.exhaust) {
			rows.push({
				label: 'Exaure',
				value: tpl.exhaust === 'combat' ? 'No combate' : 'Na run',
				tone: 'warning'
			});
		}

		if (tpl.isPower) {
			rows.push({ label: 'Power', value: 'Uma vez por combate', tone: 'warning' });
		}

		return rows;
	});

	let statRows = $derived.by<InfoRow[]>(() => {
		if (!tpl) return [];
		const rows: InfoRow[] = [];

		if (tpl.damage) rows.push({ label: 'Dano', value: `${tpl.damage}`, tone: 'danger' });
		if (tpl.block) rows.push({ label: 'Escudo', value: `${tpl.block}`, tone: 'positive' });
		if (tpl.healHp) rows.push({ label: 'Cura', value: `${tpl.healHp} HP`, tone: 'positive' });
		if (tpl.manaGain) rows.push({ label: 'Mana', value: `+${tpl.manaGain}`, tone: 'accent' });
		if (tpl.drawCount) rows.push({ label: 'Compra', value: `+${tpl.drawCount}`, tone: 'accent' });
		if (tpl.attackRepeat) rows.push({ label: 'Ataques', value: `x${tpl.attackRepeat + 1}`, tone: 'danger' });
		if (tpl.buffAmount) rows.push({ label: 'Buff dano', value: `+${tpl.buffAmount}`, tone: 'positive' });
		if (tpl.debuffAmount) rows.push({ label: 'Debuff dano', value: formatPercent(tpl.debuffAmount), tone: 'danger' });
		if (tpl.debuffDuration) rows.push({ label: 'Duracao debuff', value: `${tpl.debuffDuration} turno(s)` });
		if (tpl.captureBonus) rows.push({ label: 'Captura', value: `+${formatPercent(tpl.captureBonus)}`, tone: 'warning' });
		if (tpl.selfDamage) rows.push({ label: 'Auto dano', value: `${tpl.selfDamage}`, tone: 'danger' });
		if (tpl.poisonAmount) rows.push({ label: 'Veneno', value: `${tpl.poisonAmount}`, tone: 'danger' });
		if (tpl.imobilizadoTurns) rows.push({ label: 'Imobilizado', value: `${tpl.imobilizadoTurns} turno(s)`, tone: 'warning' });
		if (tpl.enraizadoTurns) rows.push({ label: 'Enraizado', value: `${tpl.enraizadoTurns} turno(s)`, tone: 'warning' });
		if (tpl.fraquezaStacks) rows.push({ label: 'Fraqueza', value: `${tpl.fraquezaStacks} stack(s)`, tone: 'warning' });

		return rows;
	});

	let mechanics = $derived.by<string[]>(() => {
		if (!tpl) return [];
		const list: string[] = [];

		if (tpl.artReflexo) list.push('Ativa REFLEXO neste turno.');
		if (tpl.artDuplicarCarta) list.push('Proxima carta nao-POWER executa duas vezes.');
		if (tpl.artDanoEletrico) list.push(`Ativa dano eletrico extra por carta: +${tpl.artDanoEletrico}.`);
		if (tpl.artCancelEscudo) list.push('Cancela o escudo do inimigo neste turno.');
		if (tpl.artReduzShield) list.push('Escudo do inimigo fica reduzido a 50%.');
		if (tpl.artReduzBuff) list.push('Buff de dano do inimigo fica reduzido a 50%.');
		if (tpl.artAmplifica) list.push('Dobra todos os debuffs ativos no inimigo.');
		if (tpl.artCopiaDescarte) list.push(`Cria copia no descarte (limite ${tpl.artCopiaDescarte}).`);
		if (tpl.artSequencia) list.push('Ativa o sistema SEQUENCIA para cartas Lutador.');
		if (tpl.artAutoJogar) list.push('Ativa AUTO_JOGAR para cartas Lutador.');
		if (tpl.artPilhaExaurir) list.push(`Ajusta PILHA_EXAURIR em ${tpl.artPilhaExaurir}.`);
		if (tpl.artBanido) list.push('A carta e banida da run ao ser jogada.');
		if (tpl.artPrisaoEterna) list.push('Duplica duracao de IMOBILIZADO ativo no inimigo.');
		if (tpl.artBlockDecrement) list.push('Escudo desta carta reduz permanentemente em 1 por uso.');
		if (tpl.artFuriaDragao) list.push('Dano escala com CARGA_DRAGAO acumulada.');
		if (tpl.artDuplicarDragao) list.push('Furia do Dragao causa dano dobrado neste combate.');
		if (tpl.artCongelamento) list.push('Dano escala com cartas de Gelo jogadas no combate.');
		if (tpl.artRevengeShield) list.push(`Se escudo quebrar, causa ${tpl.artRevengeShield} de dano ao inimigo.`);
		if (tpl.artEndsTurn) list.push('Termina o turno imediatamente apos uso.');
		if (tpl.nextTurnBonusDraw) list.push(`Concede +${tpl.nextTurnBonusDraw} compra no proximo turno.`);
		if (tpl.nextTurnBonusMana) list.push(`Concede +${tpl.nextTurnBonusMana} mana no proximo turno.`);
		if (tpl.artGrassDoubleIfEnraizado) list.push('Dobra dano quando ENRAIZADO estiver ativo.');
		if (tpl.artGhostPermDebuff) list.push('Aplica reducao permanente de dano inimigo.');
		if (tpl.selfMaxHpReduction) list.push(`Reduz max HP proprio em ${tpl.selfMaxHpReduction}.`);
		if (tpl.cargaDragaoGain) list.push(`Gera ${tpl.cargaDragaoGain} CARGA_DRAGAO.`);
		if (tpl.generatesTokens) {
			list.push(`Gera ${tpl.generatesTokens.count} token(s): ${tpl.generatesTokens.templateId}.`);
		}
		if (tpl.shieldEffect) list.push(`Escudo especial: ${tpl.shieldEffect}.`);

		if (tpl.kind === 'relic') list.push('Reliquia reutilizavel e pode ser jogada varias vezes.');
		if (tpl.kind === 'power') list.push('Efeito permanente durante o combate atual.');

		return list;
	});

	let priceLabel = $derived.by(() => {
		if (!tpl?.price) return null;
		const money = `${tpl.price.money} ouro`;
		if (!tpl.price.element) return money;
		const element = tpl.price.element;
		return `${money} + ${element.amount} ${ELEMENT_LABEL[element.type]}`;
	});
</script>

<Modal open={open && !!tpl} title={tpl?.name ?? ''} onclose={onclose}>
	{#if tpl}
		<div class="details space-y-4">
			<div class="preview-wrap">
				<div class="preview-card">
					<Card templateId={tpl.id} playable={false} showcase />
				</div>
				<div class="preview-meta">
					{#each primaryRows as row (row.label)}
						<div class="row">
							<span class="label">{row.label}</span>
							<span class="value tone-{row.tone ?? 'default'}">{row.value}</span>
						</div>
					{/each}
				</div>
			</div>

			{#if statRows.length > 0}
				<section class="panel">
					<h3>Atributos</h3>
					<div class="stats-grid">
						{#each statRows as stat (stat.label)}
							<div class="stat-chip tone-{stat.tone ?? 'default'}">
								<span>{stat.label}</span>
								<strong>{stat.value}</strong>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if mechanics.length > 0}
				<section class="panel">
					<h3>Mecanicas</h3>
					<ul class="mechanics-list">
						{#each mechanics as line (line)}
							<li>{line}</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="panel">
				<h3>Descricao</h3>
				<p class="description">{tpl.description}</p>
				{#if priceLabel}
					<p class="price">Preco base: {priceLabel}</p>
				{/if}
			</section>

			{#if onplay}
				<button
					class="play-btn"
					disabled={!playable}
					onclick={onplay}
				>
					{playable ? 'Jogar carta' : 'Mana insuficiente'}
				</button>
			{/if}
		</div>
	{/if}
</Modal>

<style>
	.details {
		color: var(--text, #ececf4);
	}

	.preview-wrap {
		display: grid;
		grid-template-columns: minmax(0, 180px) minmax(0, 1fr);
		gap: 12px;
		align-items: center;
	}

	.preview-card {
		width: min(100%, 180px);
		justify-self: center;
	}

	.preview-meta {
		display: grid;
		gap: 8px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 10px;
		border: 1px solid color-mix(in srgb, var(--border, #2f3040) 80%, transparent);
		border-radius: 10px;
		background: color-mix(in srgb, var(--surface-2, #141622) 80%, black 20%);
	}

	.label {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted, #9fa2b8);
	}

	.value {
		font-size: 12px;
		font-weight: 800;
		text-align: right;
	}

	.panel {
		padding: 10px;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--border, #2f3040) 80%, transparent);
		background: color-mix(in srgb, var(--surface-2, #141622) 85%, black 15%);
	}

	.panel h3 {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted, #9fa2b8);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.stat-chip {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 8px;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 700;
		background: rgba(15, 16, 25, 0.65);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.stat-chip strong {
		font-weight: 900;
	}

	.mechanics-list {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 4px;
		font-size: 12px;
		line-height: 1.4;
	}

	.description {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
	}

	.price {
		margin: 10px 0 0;
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted, #9fa2b8);
	}

	.play-btn {
		width: 100%;
		border: 0;
		border-radius: 12px;
		padding: 10px 14px;
		font-size: 14px;
		font-weight: 900;
		color: #f8f9ff;
		background: linear-gradient(135deg, #ff8d2a, #ff5b2d);
		cursor: pointer;
	}

	.play-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.tone-default {
		color: var(--text, #ececf4);
	}

	.tone-positive {
		color: #7de3b4;
	}

	.tone-warning {
		color: #f5c866;
	}

	.tone-danger {
		color: #ff7f86;
	}

	.tone-accent {
		color: #7eb8ff;
	}

	@media (max-width: 640px) {
		.preview-wrap {
			grid-template-columns: 1fr;
		}

		.preview-card {
			width: 160px;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
</style>