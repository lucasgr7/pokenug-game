<script lang="ts">
	import { page } from '$app/state';
	import { game } from '$lib/game/state.svelte';
	import { battle } from '$lib/game/battle.svelte';
	import { mn } from '$lib/game/missingno.svelte';
	import { playCategory, stopMusic, preloadMusic } from '$lib/game/music.svelte';

	// Seleciona a faixa baseada na rota + estado da batalha.
	// O $effect reage a mudanças de rota e a battle.state.status.
	$effect(() => {
		const path = page.url.pathname;
		const active = battle.state?.status === 'active';

		// MissingNo gerencia música manualmente (intro → silence → final boss).
		if (active && battle.state!.mode === 'missingno') {
			return;
		}
		if (active) {
			playCategory(battle.state!.mode === 'boss' ? 'boss' : 'battle');
		} else if (path.startsWith('/battle')) {
			return; // batalha carregando OU modal de resultado: mantém faixa atual
		} else if (path === '/onboarding' || !game.player) {
			stopMusic();
		} else {
			playCategory('menu');
			preloadMusic(['battle', 'boss']);
		}
	});
</script>
