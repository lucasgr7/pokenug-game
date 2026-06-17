import { defineEvent } from '../registry';

defineEvent({
	id: 'battle_victory_excited',
	trigger: 'victory',
	weight: 1,
	prompt: (ctx) => `${ctx.pokemon.name} está radiante com a vitória! Dá pulinhos de alegria ao seu lado.`,
	answers: [
		{
			text: () => 'Você foi incrível! Estou muito orgulhoso!',
			sentiment: 'good'
		},
		{
			text: () => 'Bom trabalho, mas ainda podemos melhorar.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Não se empolgue tanto, foi sorte.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'battle_victory_curious',
	trigger: 'victory',
	weight: 1,
	condition: (ctx) => ctx.isActive,
	prompt: (ctx) => `${ctx.pokemon.name} se aproxima com os olhos brilhando, querendo mostrar um movimento novo que aprendeu na batalha.`,
	answers: [
		{
			text: () => 'Mostre! Vou adorar ver!',
			sentiment: 'good'
		},
		{
			text: () => 'Depois a gente vê, estou ocupado.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Agora não é hora para brincadeiras.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'battle_defeat_sad',
	trigger: 'defeat',
	weight: 2,
	prompt: (ctx) => `${ctx.pokemon.name} está cabisbaixo após a derrota. O olhar dele busca conforto em você.`,
	answers: [
		{
			text: () => 'Tudo bem, perdemos juntos. Vamos treinar mais!',
			sentiment: 'good'
		},
		{
			text: () => 'Acontece. Descansa um pouco.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Você precisa se esforçar mais que isso!',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'battle_defeat_injured',
	trigger: 'defeat',
	weight: 1,
	condition: (ctx) => ctx.isActive,
	prompt: (ctx) => `${ctx.pokemon.name} manca um pouco e solta um gemido baixo. Parece que sente dor, mas tenta disfarçar.`,
	answers: [
		{
			text: () => 'Vai ficar bem, estou aqui. Vamos nos cuidar.',
			sentiment: 'good',
			hookId: 'restFromJob'
		},
		{
			text: () => 'Você aguentou bem. Melhore rápido.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Não foi tão grave, levanta e tenta de novo.',
			sentiment: 'bad'
		}
	]
});
