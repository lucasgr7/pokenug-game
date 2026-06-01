<script lang="ts">
	import Modal from './Modal.svelte';
	import Card from './Card.svelte';
	import { getTemplate } from '$lib/data/cards';
	import { ELEMENT_EMOJI, ELEMENT_LABEL } from '$lib/game/elements';
	import type { Element } from '$lib/game/types';

	let {
		templateId,
		open = false,
		onclose
	}: {
		templateId: string | null;
		open?: boolean;
		onclose: () => void;
	} = $props();

	let tpl = $derived(templateId ? getTemplate(templateId) : null);
</script>

<Modal open={open && !!tpl} title={tpl?.name ?? ''} onclose={onclose}>
	{#if tpl}
		<div class="space-y-4">
			<!-- Card Preview -->
			<div class="flex justify-center">
				<div class="w-48">
					<Card templateId={tpl.id} playable={false} showcase />
				</div>
			</div>

			<!-- Card Details -->
			<div class="space-y-3 rounded-xl border border-(--border) bg-(--surface-2) p-3">
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Custo</span>
					<span class="text-lg font-black">{tpl.cost} mana</span>
				</div>

				{#if tpl.element}
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Elemento</span>
						<span class="text-sm font-bold">{ELEMENT_EMOJI[tpl.element as Element]} {ELEMENT_LABEL[tpl.element as Element]}</span>
					</div>
				{/if}

				<div class="flex items-center justify-between">
					<span class="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Raridade</span>
					<span class="text-sm font-bold capitalize">{tpl.rarity}</span>
				</div>

				<div class="flex items-center justify-between">
					<span class="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Tipo</span>
					<span class="text-sm font-bold capitalize">{tpl.kind}</span>
				</div>
			</div>

			<!-- Effects -->
			{#if tpl.damage || tpl.block || tpl.healHp || tpl.buffAmount || tpl.debuffAmount || tpl.captureBonus || tpl.manaGain || tpl.attackRepeat || tpl.drawCount}
				<div class="space-y-2 rounded-xl border border-(--border) bg-(--surface-2) p-3">
					<h3 class="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Efeitos</h3>
					<div class="space-y-1.5">
						{#if tpl.damage}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-red-400">⚔</span>
								<span class="font-semibold">Causa <strong class="text-red-400">{tpl.damage}</strong> de dano</span>
							</div>
						{/if}
						{#if tpl.block}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-blue-400">🛡</span>
								<span class="font-semibold">Ganha <strong class="text-blue-400">{tpl.block}</strong> de bloqueio</span>
							</div>
						{/if}
						{#if tpl.healHp}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-green-400">❤</span>
								<span class="font-semibold">Cura <strong class="text-green-400">{tpl.healHp}</strong> HP</span>
							</div>
						{/if}
						{#if tpl.buffAmount}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-purple-400">✨</span>
								<span class="font-semibold">Aumenta dano em <strong class="text-purple-400">+{tpl.buffAmount}</strong></span>
							</div>
						{/if}
						{#if tpl.debuffAmount}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-red-400">👤</span>
								<span class="font-semibold">Reduz dano inimigo em <strong class="text-red-400">{Math.round(tpl.debuffAmount * 100)}%</strong> por <strong>{tpl.debuffDuration}</strong> turnos</span>
							</div>
						{/if}
						{#if tpl.captureBonus}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-amber-500">●</span>
								<span class="font-semibold">Aumenta chance de captura em <strong class="text-amber-500">+{Math.round(tpl.captureBonus * 100)}%</strong></span>
							</div>
						{/if}
						{#if tpl.manaGain}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-cyan-400">⚡</span>
								<span class="font-semibold">Ganha <strong class="text-cyan-400">+{tpl.manaGain}</strong> mana</span>
							</div>
						{/if}
						{#if tpl.attackRepeat}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-orange-400">⚔</span>
								<span class="font-semibold">Repete ataque <strong class="text-orange-400">×{tpl.attackRepeat + 1}</strong> vezes</span>
							</div>
						{/if}
						{#if tpl.drawCount}
							<div class="flex items-center gap-2 text-sm">
								<span class="text-sky-300">🃏</span>
								<span class="font-semibold">Compra <strong class="text-sky-300">+{tpl.drawCount}</strong> cartas</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Special Effects -->
			{#if tpl.id === 'power_berserk'}
				<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
					<div class="flex items-center gap-2 text-sm font-semibold">
						<span>⚔</span>
						<span>Dobra o dano, mas divide o bloqueio por 2</span>
					</div>
				</div>
			{/if}
			{#if tpl.id === 'power_dragonize'}
				<div class="rounded-xl border border-indigo-400/30 bg-indigo-400/10 p-3">
					<div class="flex items-center gap-2 text-sm font-semibold">
						<span>🐉</span>
						<span>Transforma em tipo Dragão durante a batalha</span>
					</div>
				</div>
			{/if}
			{#if tpl.id === 'power_electric_shock'}
				<div class="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
					<div class="flex items-center gap-2 text-sm font-semibold">
						<span>⚡</span>
						<span>Ganha +2 de dano a cada carta jogada</span>
					</div>
				</div>
			{/if}
			{#if tpl.kind === 'relic'}
				<div class="rounded-xl border border-purple-600/30 bg-purple-600/10 p-3">
					<div class="flex items-center gap-2 text-sm font-semibold">
						<span>👻</span>
						<span>Causa 1 de dano toda vez que é jogada (infinitas vezes)</span>
					</div>
				</div>
			{/if}

			<!-- Description (if any flavor text is needed) -->
			<div class="text-center text-xs italic text-(--text-muted)">
				{#if tpl.kind === 'attack'}
					Carta de ataque básica
				{:else if tpl.kind === 'defense'}
					Carta de defesa
				{:else if tpl.kind === 'skill'}
					Habilidade especial
				{:else if tpl.kind === 'power'}
					Carta de poder permanente
				{:else if tpl.kind === 'relic'}
					Relíquia reutilizável
				{/if}
			</div>
		</div>
	{/if}
</Modal>
