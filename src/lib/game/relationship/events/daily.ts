import { defineEvent } from '../registry';

defineEvent({
	id: 'daily_good_morning',
	trigger: 'newDay',
	weight: 2,
	prompt: (ctx) => `Um novo dia começa! ${ctx.pokemon.name} acorda espreguiçando e te cumprimenta com um sorriso.`,
	answers: [
		{
			text: () => 'Bom dia, meu amigo! Vai ser um ótimo dia!',
			sentiment: 'good'
		},
		{
			text: () => 'Bom dia. Dormiu bem?',
			sentiment: 'neutral'
		},
		{
			text: () => 'Acorda logo, temos muito o que fazer.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'daily_explore',
	trigger: 'newDay',
	weight: 1,
	prompt: (ctx) => `${ctx.pokemon.name} chega perto de você com um mapa imaginário na cabeça, claramente querendo explorar algo novo hoje.`,
	answers: [
		{
			text: () => 'Vamos explorar juntos hoje! Mal posso esperar.',
			sentiment: 'good'
		},
		{
			text: () => 'Hoje não, mas podemos ir amanhã.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Fica quieto, você só vai causar problemas.',
			sentiment: 'bad'
		}
	]
});
