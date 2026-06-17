import type { CapturedPokemon, PokemonMemory, Sentiment } from '$lib/game/types';
import { firstEmoji, classifyEmoji, keywordFallback } from '$lib/game/relationship';
import { ELEMENT_LABEL } from '$lib/game/elements';

const OLLAMA_ENDPOINT = '/ollama/api/generate';
const OLLAMA_MODEL = 'llama3.1:8b-instruct-q5_K_M';
export const DEFAULT_ITEM_EMOJI = '❓';

async function ollamaGenerate(
	prompt: string,
	timeoutMs: number,
	opts: { temperature?: number } = {}
): Promise<string> {
	console.info('[ollama] POST', OLLAMA_ENDPOINT, OLLAMA_MODEL);
	const res = await fetch(OLLAMA_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: OLLAMA_MODEL,
			prompt,
			stream: false,
			options: { temperature: opts.temperature ?? 0.4 }
		}),
		signal: AbortSignal.timeout(timeoutMs)
	});
	const data = await res.json();
	return (data.response as string | undefined)?.trim() ?? '';
}

function buildPrompt(
	memories: PokemonMemory[],
	userMessage: string,
	pokemon: CapturedPokemon
): string {
	const elementLabel = ELEMENT_LABEL[pokemon.element] ?? pokemon.element;
	const lines: string[] = [];

	lines.push(
		`Você é ${pokemon.name}, um Pokémon do tipo ${elementLabel}. ` +
			`Aja como um Pokémon de verdade: tem humor e sentimentos próprios e reage ao seu treinador.`
	);

	// Apenas memórias com um emoji registrado servem de contexto.
	const pastReactions = memories.filter((m) => m.emoji && m.playerMessage);
	if (pastReactions.length > 0) {
		lines.push('');
		lines.push('Como você reagiu a falas anteriores do treinador:');
		for (const mem of pastReactions) {
			lines.push(`- Ele disse: "${mem.playerMessage}" e você reagiu: ${mem.emoji}`);
		}
	}

	lines.push('');
	lines.push(`Agora o treinador diz: "${userMessage}"`);
	lines.push('');
	lines.push(
		'Responda com UM ÚNICO emoji que mostre como você se sente, sem nenhuma palavra. ' +
			'Exemplos: 😊 feliz, 🥰 amado, 😡 irritado, 😢 triste, 😴 cansado, 😐 indiferente.'
	);

	return lines.join('\n');
}

export async function classifyMessage(
	memories: PokemonMemory[],
	userMessage: string,
	pokemon: CapturedPokemon
): Promise<{ emoji: string; sentiment: Sentiment }> {
	try {
		const prompt = buildPrompt(memories.slice(-3), userMessage, pokemon);
		const raw = await ollamaGenerate(prompt, 8000, { temperature: 0.4 });
		const emoji = firstEmoji(raw) ?? DEFAULT_ITEM_EMOJI;
		return { emoji, sentiment: classifyEmoji(emoji) };
	} catch (err) {
		console.error('[ollama] classifyMessage failed — using keyword fallback:', err);
		return { emoji: '😐', sentiment: keywordFallback(userMessage) };
	}
}
