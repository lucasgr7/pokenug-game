import { defineEvent, type EventContext } from '../registry';

defineEvent({
	id: 'conflict_food',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false, // never picked individually; only via conflict pipeline
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} e ${ctx.peerName!} estão discutindo feio por causa de uma porção de comida que caiu no chão. ${ctx.pokemon.name} diz que viu primeiro. ${ctx.peerName!} já comeu metade. Os dois te olham esperando um veredito.`,
	answers: [
		{
			text: () => 'Foi você quem achou, pode comer.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Divide! Não briguem por isso.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Joga fora, ninguém come.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_attention',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} e ${ctx.peerName!} estão disputando sua atenção. ${ctx.pokemon.name} puxa sua manga. ${ctx.peerName!} se joga na sua frente. "QUEM VOCÊ ESCOLHE?!"`,
	answers: [
		{
			text: () => 'Vem cá, você primeiro.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Chega! Vocês dois, sentados. Agora.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Ninguém. Vou embora.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_training_method',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} e ${ctx.peerName!} discordam sobre o melhor jeito de treinar. ${ctx.pokemon.name} quer repetir o básico. ${ctx.peerName!} quer pular direto pro avançado. Os dois bufam e cruzam os braços.`,
	answers: [
		{
			text: () => 'Vamos devagar, um passo de cada vez.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Cada um treina do seu jeito, sem briga.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Os dois métodos são fracos. Façam do meu jeito.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_territory',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} está sentado num cantinho quando ${ctx.peerName!} se aproxima e senta exatamente no mesmo lugar, quase em cima. ${ctx.pokemon.name} rosna baixo. ${ctx.peerName!} não se mexe.`,
	answers: [
		{
			text: () => 'Ele estava aqui primeiro. Sai daí.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Cabe os dois. Se virem.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Vou pegar fita e marcar o chão, resolve?',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_direction',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} quer ir para a esquerda. ${ctx.peerName!} quer ir para a direita. Os dois apontam em direções opostas e se recusam a andar. ${ctx.pokemon.name} cruza os braços. ${ctx.peerName!} faz cara feia.`,
	answers: [
		{
			text: () => 'Esquerda. Confio no seu instinto.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Vamos de moeda. Cara esquerda, coroa direita.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Vão os dois sozinhos então. Me avisem.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_annoying',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.peerName!} está enchendo o saco de ${ctx.pokemon.name} — cutucando com a patinha, fazendo barulho, repetindo o nome sem parar. ${ctx.pokemon.name} está claramente irritado, mas ${ctx.peerName!} acha que é uma brincadeira.`,
	answers: [
		{
			text: () => 'Para de encher o saco, dá um tempo.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Você dois, se acertem ou eu separo.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Briguem, quero ver quem ganha.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_toy',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} está brincando com uma bolinha quando ${ctx.peerName!} corre, rouba a bolinha e sai em disparada. ${ctx.pokemon.name} parte atrás. Os dois rodam em círculos e param ofegantes aos seus pés, cada um com metade da bolinha na boca.`,
	answers: [
		{
			text: () => 'Dá a bolinha de volta, foi injusto.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Dou outra bolinha e acabou a treta.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Bolinha nenhuma. Vão treinar.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_nap',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} estava tirando um cochilo gostoso quando ${ctx.peerName!} derrubou uma pilha de latas bem ao lado. ${ctx.pokemon.name} acorda assustado e solta um grito. ${ctx.peerName!} segura o riso. ${ctx.pokemon.name} não acha graça nenhuma.`,
	answers: [
		{
			text: () => 'Foi sem querer, acalma. Mas pede desculpas.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Os dois me ajudem a guardar as latas. Conversa depois.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Era só uma soneca. Os dois estão exagerando.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_strategy',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.pokemon.name} está explicando uma estratégia de batalha imaginária com vozes e gestos. ${ctx.peerName!} interrompe: "Isso nunca vai funcionar!" ${ctx.pokemon.name} para, vira lentamente a cabeça e encara ${ctx.peerName!}. O clima pesa.`,
	answers: [
		{
			text: () => 'Deixa ele terminar, depois você fala.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Os dois têm pontos válidos. Escuto os dois.',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Estratégia é perda de tempo. Vão na raça.',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'conflict_loud',
	trigger: 'idle',
	weight: 1,
	condition: (_ctx) => false,
	prompt: (ctx: EventContext) =>
		`${ctx.peerName!} está cantando (ou tentando cantar) uma melodia horrível bem alto. ${ctx.pokemon.name} tampou os ouvidos e fez cara de dor. ${ctx.peerName!} canta mais alto ainda só de provocação. ${ctx.pokemon.name} já está com os dentes trincados.`,
	answers: [
		{
			text: () => 'Baixa o volume, você está machucando os ouvidos dele.',
			sentiment: 'good',
			peerSentiment: 'bad'
		},
		{
			text: () => 'Canta junto! Faz um dueto!',
			sentiment: 'neutral',
			peerSentiment: 'neutral'
		},
		{
			text: () => 'Os dois tão incomodando. Silêncio!',
			sentiment: 'bad',
			peerSentiment: 'bad'
		}
	]
});
