<script lang="ts">
	import { page } from '$app/state';
	import { game } from '$lib/game/state.svelte';
	import { battle } from '$lib/game/battle.svelte';
	import { playCategory, stopMusic } from '$lib/game/music.svelte';

	// Seleciona a faixa baseada na rota + estado da batalha.
	// O $effect reage a mudanças de rota e a battle.state.status.
	$effect(() => {
		const path = page.url.pathname;
		const active = battle.state?.status === 'active';

		if (active) {
			playCategory(battle.state!.mode === 'boss' ? 'boss' : 'battle');
		} else if (path.startsWith('/battle')) {
			return; // batalha carregando OU modal de resultado: mantém faixa atual
		} else if (path === '/onboarding' || !game.player) {
			stopMusic();
		} else {
			playCategory('menu');
		}
	});
</script>
