import { defineEvent, defineAnswerHook } from '../registry';

defineAnswerHook('restFromJob', async ({ pokemon, stopJob }) => {
	await stopJob(pokemon.id);
});

defineAnswerHook('playCooldown', async ({ pokemon }) => {
	pokemon.jobCooldownUntil = Date.now() + 15 * 60 * 1000;
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
			sentiment: 'good',
			hookId: 'playCooldown'
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

defineEvent({
	id: 'idle_meditating',
	trigger: 'idle',
	weight: 2,
	condition: (ctx) => {
		const first = ctx.pokemon.natures?.assigned[0];
		return first === 'serious' || first === 'quirky' || first === 'modest';
	},
	prompt: (ctx) => `${ctx.pokemon.name} está sentado de pernas cruzadas, olhos fechados, respirando profundamente. Uma aura tranquila emana ao redor.`,
	answers: [
		{
			text: () => 'Que paz... Posso meditar com você?',
			sentiment: 'good',
			hookId: 'playCooldown'
		},
		{
			text: () => 'Vou esperar você terminar.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Acorda! Temos coisas pra fazer!',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_showing_off',
	trigger: 'idle',
	weight: 2,
	condition: (ctx) => {
		const first = ctx.pokemon.natures?.assigned[0];
		return first === 'hardy' || first === 'adamant' || first === 'brave' || first === 'naughty';
	},
	prompt: (ctx) => `${ctx.pokemon.name} faz uma pose dramática e solta um pequeno golpe no ar, olhando para você com um sorriso confiante. "HEY! OLHA SÓ ISSO!"`,
	answers: [
		{
			text: () => 'INCRÍVEL! Você é o mais forte!',
			sentiment: 'good'
		},
		{
			text: () => 'Legal. Já vi coisa melhor, mas foi bom.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Que vergonha alheia. Para com isso.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_shy',
	trigger: 'idle',
	weight: 2,
	condition: (ctx) => {
		const first = ctx.pokemon.natures?.assigned[0];
		return first === 'timid' || first === 'lonely' || first === 'docile';
	},
	prompt: (ctx) => `${ctx.pokemon.name} está encolhido atrás de uma folha, olhando para você com um olho só. Quando percebe que foi visto, desvia o olhar rapidamente.\n\n"..."`,
	answers: [
		{
			text: () => 'Ei... tudo bem? Estou aqui, não precisa ter medo.',
			sentiment: 'good'
		},
		{
			text: () => 'Fico de longe pra você se sentir melhor.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Para de frescura e vem aqui agora.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_training',
	trigger: 'idle',
	weight: 2,
	condition: (ctx) => {
		const first = ctx.pokemon.natures?.assigned[0];
		return first === 'bold' || first === 'brave' || first === 'hardy';
	},
	prompt: (ctx) => `${ctx.pokemon.name} está treinando sozinho do lado, focado. Ele te olha com olhar sério "Tá olhando o quê? Quer entrar?"`,
	answers: [
		{
			text: () => 'Bora! 50 flexões agora, eu e você!',
			sentiment: 'good',
			hookId: 'playCooldown'
		},
		{
			text: () => 'Continue, estou só observando sua técnica.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Flexão de dedo? Isso é fichinha.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_napping',
	trigger: 'idle',
	weight: 2,
	condition: (ctx) => {
		const first = ctx.pokemon.natures?.assigned[0];
		return first === 'relaxed' || first === 'lax' || first === 'docile';
	},
	prompt: (ctx) => `${ctx.pokemon.name} está dormindo profundamente, roncando baixinho com uma bolha de saliva inflando e estourando no focinho. Uma pata balança lentamente como se estivesse sonhando com algo gostoso.`,
	answers: [
		{
			text: () => 'Dorme bem, sonho lindo. Vou cobrir você.',
			sentiment: 'good',
			hookId: 'playCooldown'
		},
		{
			text: () => '*senta do lado e espera quieto*',
			sentiment: 'neutral'
		},
		{
			text: () => 'ACORDA! TÁ NA HORA DO TREINO!',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_sketching',
	trigger: 'idle',
	weight: 2,
	condition: (ctx) => {
		const first = ctx.pokemon.natures?.assigned[0];
		return first === 'hasty' || first === 'sassy' || first === 'quirky';
	},
	prompt: (ctx) => `${ctx.pokemon.name} está rabiscando algo no chão com um graveto. Quando você se aproxima, ele tenta esconder com o pé, mas dá pra ver um desenho meio torto de vocês dois segurando uma taça.`,
	answers: [
		{
			text: () => 'Espera... isso sou eu? Tá lindo! Faz um pra parede!',
			sentiment: 'good'
		},
		{
			text: () => 'Interessante... você tem potencial.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Isso é o quê? Uma ameba? Não parece nada.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_collecting',
	trigger: 'idle',
	weight: 1,
	prompt: (ctx) => `${ctx.pokemon.name} está rodeado de uma pilha de objetos brilhantes: uma moeda enferrujada, um botão colorido, uma pena azul e um papel de bala amassado. Ele organiza tudo com uma seriedade impressionante.`,
	answers: [
		{
			text: () => 'Nossa, que coleção incrível! Achou mais coisa hoje?',
			sentiment: 'good'
		},
		{
			text: () => 'Guarda isso direito, não quero bagunça.',
			sentiment: 'neutral'
		},
		{
			text: () => 'Isso é lixo! Joga tudo fora agora.',
			sentiment: 'bad'
		}
	]
});

defineEvent({
	id: 'idle_contemplating',
	trigger: 'idle',
	weight: 1,
	condition: (ctx) => {
		const first = ctx.pokemon.natures?.assigned[0];
		return first === 'modest' || first === 'lonely' || first === 'serious';
	},
	prompt: (ctx) => `${ctx.pokemon.name} está sentado na grama, olhando fixamente para uma nuvem que passa lentamente. O vento sopra suave. Ele suspira. "Você acha que as nuvens sabem pra onde estão indo?"`,
	answers: [
		{
			text: () => 'Talvez elas só confiem no vento, como eu confio em você.',
			sentiment: 'good'
		},
		{
			text: () => '*senta do lado e olha pro céu também*',
			sentiment: 'neutral'
		},
		{
			text: () => 'Nuvem não pensa. Vamos fazer algo útil.',
			sentiment: 'bad'
		}
	]
});
