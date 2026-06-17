import { defineEvent, defineAnswerHook } from '../registry';

defineAnswerHook('restFromJob', async ({ pokemon, stopJob }) => {
	await stopJob(pokemon.id);
});

defineEvent({
	id: 'idle_calling_for_help',
	trigger: 'idle',
	weight: 2,
	condition: (ctx) => ctx.isOnJob,
	prompt: (ctx) => `${ctx.pokemon.name} parece exausto do trabalho e está te chamando...`,
	answers: [
		{
			text: () => 'Bom trabalho, vá descansar.',
			sentiment: 'good',
			hookId: 'restFromJob'
		},
		{
			text: () => 'Como você está se sentindo?',
			sentiment: 'neutral'
		},
		{
			text: () => 'Vamos lá, aguenta mais!',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_playful',
	trigger: 'idle',
	weight: 1,
	condition: (ctx) => !ctx.isOnJob,
	prompt: (ctx) => `${ctx.pokemon.name} está entediado e queria brincar um pouco. Ele olha para você com expectativa.`,
	answers: [
		{
			text: () => 'Vamos brincar! O que você quer fazer?',
			sentiment: 'good'
		},
		{
			text: () => 'Estou ocupado, mas depois a gente brinca.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Não agora. Fica quieto um pouco.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_hungry',
	trigger: 'idle',
	weight: 1,
	prompt: (ctx) => `${ctx.pokemon.name} se aproxima com um olhar pidão e faz um som baixinho. Parece que está com fome.`,
	answers: [
		{
			text: () => 'Está com fome? Vou te dar uma comida gostosa!',
			sentiment: 'good'
		},
		{
			text: () => 'Já comeu hoje? Acho que sim.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Você já comeu, não seja guloso.',
			sentiment: 'bad'
		}
	]
});
