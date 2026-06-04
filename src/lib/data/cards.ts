import type { CardTemplate } from '$lib/game/types';

// ---- Cartas neutras (starter) — nunca sofrem Misalignment ----
export const STARTER_TEMPLATES: CardTemplate[] = [
	// Ataques neutros
	{
		id: 'neu_atk_preciso',
		name: 'Ataque Preciso',
		description: 'Cause 4 de dano.',
		cost: 1,
		kind: 'attack',
		element: null,
		rarity: 'starter',
		damage: 4
	},
	{
		id: 'neu_atk_golpe_direto',
		name: 'Golpe Direto',
		description: 'Cause 8 de dano.',
		cost: 1,
		kind: 'attack',
		element: null,
		rarity: 'starter',
		damage: 8
	},
	{
		id: 'neu_atk_investida',
		name: 'Investida',
		description: 'Cause 18 de dano.',
		cost: 2,
		kind: 'attack',
		element: null,
		rarity: 'starter',
		damage: 18
	},
	// Defesas neutras
	{
		id: 'neu_def_bloqueio',
		name: 'Bloqueio',
		description: 'Ganha 6 de escudo.',
		cost: 1,
		kind: 'defense',
		element: null,
		rarity: 'starter',
		block: 6
	},
	{
		id: 'neu_def_postura',
		name: 'Postura Defensiva',
		description: 'Ganha 10 de escudo.',
		cost: 1,
		kind: 'defense',
		element: null,
		rarity: 'starter',
		block: 10
	},
	{
		id: 'neu_def_recuo',
		name: 'Recuo Estratégico',
		description: 'Ganha 20 de escudo.',
		cost: 2,
		kind: 'defense',
		element: null,
		rarity: 'starter',
		block: 20
	},
	// Pokébola inicial
	{
		id: 'pokeball_basic',
		name: 'Pokébola',
		description: 'Tenta capturar o pokémon selvagem.',
		cost: 2,
		kind: 'capture',
		element: null,
		rarity: 'starter',
		captureBonus: 0
	}
];

// Composição do deck inicial: [templateId, quantidade]
export const STARTER_DECK: Array<[string, number]> = [
	['neu_atk_preciso', 5],
	['neu_def_bloqueio', 4],
	['neu_sup_respiro', 2],
	['pokeball_basic', 2]
];

// ---- Catálogo comprável (GDD cards.md) ----
export const CATALOG: CardTemplate[] = [
	// ── Água ──────────────────────────────────────────────
	{
		id: 'water_splash',
		name: 'Splash',
		description: 'Cause 4 de dano. Compre 1 carta.',
		cost: 0,
		kind: 'attack',
		element: 'water',
		rarity: 'common',
		damage: 4,
		drawCount: 1,
		price: { money: 40 }
	},
	{
		id: 'water_fluxo',
		name: 'Fluxo',
		description: 'Cause 14 de dano. Compre 2 cartas.',
		cost: 2,
		kind: 'attack',
		element: 'water',
		rarity: 'rare',
		damage: 14,
		drawCount: 2,
		price: { money: 90 }
	},
	{
		id: 'water_torrent',
		name: 'Torrent',
		description: 'Cause 28 de dano.',
		cost: 3,
		kind: 'attack',
		element: 'water',
		rarity: 'epic',
		damage: 28,
		price: { money: 180 }
	},

	// ── Fogo ──────────────────────────────────────────────
	{
		id: 'fire_chama_ardente',
		name: 'Chama Ardente',
		description: 'Cause 8 de dano. Você sofre 1 de dano.',
		cost: 0,
		kind: 'attack',
		element: 'fire',
		rarity: 'common',
		damage: 8,
		selfDamage: 1,
		price: { money: 40 }
	},
	{
		id: 'fire_incineracao',
		name: 'Incineração',
		description: 'Cause 20 de dano. Você sofre 2 de dano.',
		cost: 2,
		kind: 'attack',
		element: 'fire',
		rarity: 'rare',
		damage: 20,
		selfDamage: 2,
		price: { money: 90 }
	},
	{
		id: 'fire_inferno',
		name: 'Inferno',
		description: 'Cause 30 de dano. Você sofre 8 de dano.',
		cost: 2,
		kind: 'attack',
		element: 'fire',
		rarity: 'rare',
		damage: 30,
		selfDamage: 8,
		price: { money: 90 }
	},

	// ── Grama ─────────────────────────────────────────────
	{
		id: 'grass_raiz_profunda',
		name: 'Raiz Profunda',
		description: 'Aplica ENRAIZADO(2) no inimigo. Cartas Grama causam dobro de dano enquanto ativo.',
		cost: 2,
		kind: 'debuff',
		element: 'grass',
		rarity: 'rare',
		appliesStatuses: [{ id: 'enraizado', stacks: 2, target: 'enemy' }],
		price: { money: 90 }
	},
	{
		id: 'grass_sementes',
		name: 'Sementes de Vida',
		description: 'Ganha +1 de energia. Compre 1 carta. [EXHAUST_COMBATE]',
		cost: 0,
		kind: 'energy',
		element: 'grass',
		rarity: 'rare',
		manaGain: 1,
		drawCount: 1,
		exhaust: 'combat',
		price: { money: 90 }
	},
	{
		id: 'grass_brotos_ofensivos',
		name: 'Brotos Ofensivos',
		description: 'Cause 6 de dano (12 se ENRAIZADO ativo).',
		cost: 1,
		kind: 'attack',
		element: 'grass',
		rarity: 'common',
		damage: 6,
		price: { money: 40 }
	},
	{
		id: 'grass_espinhos',
		name: 'Espinhos',
		description: 'Ganha 12 de escudo. O escudo fornecido reduz -1 permanentemente a cada uso.',
		cost: 1,
		kind: 'defense',
		element: 'grass',
		rarity: 'common',
		block: 12,
		price: { money: 40 }
	},
	{
		id: 'grass_chicote_verde',
		name: 'Chicote Verde',
		description: '10 de dano. 3x contra inimigo ENRAIZADO.',
		cost: 1,
		kind: 'attack',
		element: 'grass',
		rarity: 'rare',
		damage: 10,
		price: { money: 500 }
	},

	// ── Dragão ────────────────────────────────────────────
	{
		id: 'dragon_furia',
		name: 'Fúria do Dragão',
		description: 'Cause 10 de dano base + valor total de CARGA_DRAGÃO.',
		cost: 2,
		kind: 'attack',
		element: 'dragon',
		rarity: 'epic',
		price: { money: 180, element: { type: 'dragon', amount: 60 } }
	},
	{
		id: 'dragon_bafo',
		name: 'Bafo Ancestral',
		description: 'Compre 1 carta. Adiciona +8 em CARGA_DRAGÃO.',
		cost: 1,
		kind: 'buff',
		element: 'dragon',
		rarity: 'common',
		drawCount: 1,
		appliesStatuses: [{ id: 'carga_dragao', stacks: 8 }],
		price: { money: 40 }
	},
	{
		id: 'dragon_choque',
		name: 'Choque Dracônico',
		description: 'Cause 6 de dano. Adiciona +8 em CARGA_DRAGÃO.',
		cost: 1,
		kind: 'attack',
		element: 'dragon',
		rarity: 'common',
		damage: 6,
		appliesStatuses: [{ id: 'carga_dragao', stacks: 8 }],
		price: { money: 40 }
	},
	{
		id: 'dragon_poder',
		name: 'Poder Canalizado',
		description: '[POWER] Fúria do Dragão causa o dobro do dano total nesta luta. [EXHAUST_COMBATE]',
		cost: 3,
		kind: 'power',
		element: 'dragon',
		rarity: 'secret',
		isPower: true,
		appliesStatuses: [{ id: 'furia_double' }],
		exhaust: 'combat',
		price: { money: 300, element: { type: 'dragon', amount: 80 } }
	},

	// ── Psíquico ──────────────────────────────────────────
	{
		id: 'psychic_refluxo',
		name: 'Refluxo Mental',
		description: 'Todo dano sofrido no último turno é causado de volta ao inimigo (máx. 30).',
		cost: 2,
		kind: 'attack',
		element: 'psychic',
		rarity: 'epic',
		price: { money: 180, element: { type: 'psychic', amount: 50 } }
	},
	{
		id: 'psychic_espelho',
		name: 'Espelho Psíquico',
		description: 'Ganha 18 de escudo. [REFLEXO] 50% do dano absorvido é devolvido ao inimigo neste turno.',
		cost: 2,
		kind: 'defense',
		element: 'psychic',
		rarity: 'rare',
		block: 18,
		appliesStatuses: [{ id: 'reflexo' }],
		price: { money: 90 }
	},
	{
		id: 'psychic_mente',
		name: 'Mente Contorcida',
		description: 'Cause 13 de dano.',
		cost: 1,
		kind: 'attack',
		element: 'psychic',
		rarity: 'common',
		damage: 13,
		price: { money: 40 }
	},
	{
		id: 'psychic_paradoxo',
		name: 'Paradoxo Cerebral',
		description: '[DUPLICAR_CARTA] A próxima carta jogada é executada duas vezes. [EXHAUST_COMBATE]',
		cost: 2,
		kind: 'buff',
		element: 'psychic',
		rarity: 'epic',
		exhaust: 'combat',
		price: { money: 180 }
	},

	// ── Terra ─────────────────────────────────────────────
	{
		id: 'ground_imobilizacao',
		name: 'Imobilização Total',
		description: 'Aplica IMOBILIZADO(2) no inimigo (dano reduzido a 50% por 2 turnos).',
		cost: 2,
		kind: 'debuff',
		element: 'ground',
		rarity: 'rare',
		appliesStatuses: [{ id: 'imobilizado', stacks: 2, target: 'enemy' }],
		price: { money: 90 }
	},
	{
		id: 'ground_peso',
		name: 'Peso da Terra',
		description: 'Ganha 12 de escudo. Perde 1 de energia neste turno.',
		cost: 0,
		kind: 'defense',
		element: 'ground',
		rarity: 'common',
		block: 12,
		manaGain: -1,
		price: { money: 40 }
	},
	{
		id: 'ground_compressao',
		name: 'Compressão Terrestre',
		description: '[POWER] No próximo turno, comece com +1 de energia adicional.',
		cost: 3,
		kind: 'power',
		element: 'ground',
		rarity: 'secret',
		isPower: true,
		appliesStatuses: [{ id: 'next_turn_bonus', stacks: 1, data: { mana: 1 } }],
		price: { money: 300 }
	},
	{
		id: 'ground_prisao',
		name: 'Prisão Eterna',
		description: 'Cause 5 de dano. Se o inimigo estiver IMOBILIZADO, duplica sua duração.',
		cost: 1,
		kind: 'attack',
		element: 'ground',
		rarity: 'rare',
		damage: 5,
		price: { money: 90 }
	},

	// ── Lutador ───────────────────────────────────────────
	{
		id: 'fighting_rajada',
		name: 'Rajada de Socos',
		description: 'Cause 6 de dano. [COPIA_DESCARTE] Cria 1 cópia desta carta no descarte. (Limite: 2)',
		cost: 0,
		kind: 'attack',
		element: 'fighting',
		rarity: 'common',
		damage: 6,
		price: { money: 40 }
	},
	{
		id: 'fighting_punho',
		name: 'Punho Sincronizado',
		description: '[POWER] [SEQUÊNCIA] Cartas Lutador consecutivas acumulam +2 de dano por carta. [EXHAUST_COMBATE]',
		cost: 2,
		kind: 'power',
		element: 'fighting',
		rarity: 'secret',
		isPower: true,
		appliesStatuses: [{ id: 'sequencia' }],
		exhaust: 'combat',
		price: { money: 300, element: { type: 'fighting', amount: 60 } }
	},
	{
		id: 'fighting_serie',
		name: 'Série de Ataques',
		description: 'Cause 32 de dano.',
		cost: 3,
		kind: 'attack',
		element: 'fighting',
		rarity: 'epic',
		damage: 32,
		price: { money: 180 }
	},
	{
		id: 'fighting_ritmo',
		name: 'Ritmo Implacável',
		description: '[POWER] [AUTO_JOGAR] Cartas Lutador na mão são jogadas automaticamente no início do turno. (Limite: 3)',
		cost: 0,
		kind: 'power',
		element: 'fighting',
		rarity: 'secret',
		isPower: true,
		appliesStatuses: [{ id: 'auto_jogar' }],
		price: { money: 300, element: { type: 'fighting', amount: 60 } }
	},

	// ── Voador ────────────────────────────────────────────
	{
		id: 'flying_evasao_total',
		name: 'Evasão Total',
		description: 'Termine seu turno imediatamente. Próximo turno: compre +2 cartas e ganha +1 de energia.',
		cost: 3,
		kind: 'power',
		element: 'flying',
		rarity: 'epic',
		endsTurn: true,
		appliesStatuses: [{ id: 'next_turn_bonus', stacks: 1, data: { draw: 2, mana: 1 } }],
		price: { money: 180 }
	},
	{
		id: 'flying_golpe_aereo',
		name: 'Golpe Aéreo',
		description: 'Cause 9 de dano. Se for o primeiro ataque do turno, compre 1 carta.',
		cost: 1,
		kind: 'attack',
		element: 'flying',
		rarity: 'common',
		damage: 9,
		price: { money: 40 }
	},
	{
		id: 'flying_evasao',
		name: 'Evasão',
		description: 'Ganha 12 de escudo. Se não sofreu dano neste turno, ganha +4 de escudo adicional.',
		cost: 1,
		kind: 'defense',
		element: 'flying',
		rarity: 'common',
		block: 12,
		price: { money: 40 }
	},

	// ── Inseto ────────────────────────────────────────────
	{
		id: 'bug_picada',
		name: 'Picada Rápida',
		description: 'Cause 5 de dano. [EXHAUST_COMBATE] [PILHA_EXAURIR +1]',
		cost: 0,
		kind: 'attack',
		element: 'bug',
		rarity: 'common',
		damage: 5,
		exhaust: 'combat',
		price: { money: 40 }
	},
	{
		id: 'bug_corte',
		name: 'Corte de Tesoura',
		description: 'Cause 12 de dano. Exaure 1 carta Inseto da mão. [PILHA_EXAURIR +1]',
		cost: 1,
		kind: 'attack',
		element: 'bug',
		rarity: 'common',
		damage: 12,
		price: { money: 40 }
	},
	{
		id: 'bug_nuvem',
		name: 'Nuvem de Insetos',
		description: 'Gere 3 cartas Picada Rápida (custo 0) na sua mão.',
		cost: 1,
		kind: 'buff',
		element: 'bug',
		rarity: 'rare',
		generatesTokens: { templateId: 'bug_picada_token', count: 3 },
		price: { money: 90 }
	},
	{
		id: 'bug_enxame',
		name: 'Enxame Voraz',
		description: 'Cause 2 de dano por cada carta em PILHA_EXAURIR.',
		cost: 2,
		kind: 'attack',
		element: 'bug',
		rarity: 'epic',
		price: { money: 180, element: { type: 'bug', amount: 50 } }
	},

	// ── Veneno ────────────────────────────────────────────
	{
		id: 'poison_intoxicacao',
		name: 'Intoxicação',
		description: 'Cause 5 de dano. [REDUZ_SHIELD] Escudo que o inimigo ganhar neste turno é reduzido a 50%.',
		cost: 1,
		kind: 'attack',
		element: 'poison',
		rarity: 'common',
		damage: 5,
		appliesStatuses: [{ id: 'shield_reduced', target: 'enemy' }],
		price: { money: 40 }
	},
	{
		id: 'poison_morte_lenta',
		name: 'Morte Lenta',
		description: 'Cause 8 de dano. [REDUZ_BUFF] Buff de dano do inimigo neste turno é reduzido a 50%.',
		cost: 1,
		kind: 'attack',
		element: 'poison',
		rarity: 'rare',
		damage: 8,
		appliesStatuses: [{ id: 'buff_reduced', target: 'enemy' }],
		price: { money: 90 }
	},
	{
		id: 'poison_toxina',
		name: 'Toxina Mortífera',
		description: 'Cause 16 de dano. [AMPLIFICA] Dobra todos os efeitos negativos ativos no inimigo.',
		cost: 3,
		kind: 'attack',
		element: 'poison',
		rarity: 'epic',
		damage: 16,
		price: { money: 180, element: { type: 'poison', amount: 50 } }
	},
	{
		id: 'poison_colapso',
		name: 'Colapso Tóxico',
		description: 'Por 5 turnos, o inimigo recebe FRAQUEZA(5) — +25% de dano recebido.',
		cost: 3,
		kind: 'debuff',
		element: 'poison',
		rarity: 'epic',
		appliesStatuses: [{ id: 'fraqueza', stacks: 5, target: 'enemy' }],
		price: { money: 180 }
	},

	// ── Fantasma ──────────────────────────────────────────
	{
		id: 'ghost_alma_penada',
		name: 'Alma Penada',
		description: 'Reduz dano do inimigo em 1 permanentemente. Exaure 1 carta aleatória da mão. [EXHAUST_RUN desta carta]',
		cost: 0,
		kind: 'debuff',
		element: 'ghost',
		rarity: 'rare',
		exhaust: 'run',
		price: { money: 90 }
	},
	{
		id: 'ghost_espectro',
		name: 'Espectro Voraz',
		description: 'Cause 18 de dano. Reduz seu HP máximo em 4.',
		cost: 1,
		kind: 'attack',
		element: 'ghost',
		rarity: 'rare',
		damage: 18,
		selfMaxHpReduction: 4,
		price: { money: 90 }
	},
	{
		id: 'ghost_assombracao',
		name: 'Assombração Progressiva',
		description: '[POWER] Cartas Fantasma ganham +1 de dano a cada turno desta luta.',
		cost: 3,
		kind: 'power',
		element: 'ghost',
		rarity: 'secret',
		isPower: true,
		price: { money: 300, element: { type: 'ghost', amount: 60 } }
	},
	{
		id: 'ghost_fantasmagoria',
		name: 'Fantasmagoria',
		description: 'Cause 8 de dano e ganha 8 de escudo.',
		cost: 2,
		kind: 'attack',
		element: 'ghost',
		rarity: 'common',
		damage: 8,
		block: 8,
		price: { money: 40 }
	},
	{
		id: 'ghost_maldicao',
		name: 'Maldição Eterna',
		description: 'Perca 1 de HP máximo. Ganha +1 de energia e compre 1 carta.',
		cost: 1,
		kind: 'buff',
		element: 'ghost',
		rarity: 'rare',
		selfMaxHpReduction: 1,
		manaGain: 1,
		drawCount: 1,
		price: { money: 90 }
	},

	// ── Gelo ──────────────────────────────────────────────
	{
		id: 'ice_congelamento',
		name: 'Congelamento Progressivo',
		description: '[POWER] Cause 3 de dano por cada carta Gelo jogada nesta luta.',
		cost: 2,
		kind: 'power',
		element: 'ice',
		rarity: 'secret',
		isPower: true,
		price: { money: 300, element: { type: 'ice', amount: 60 } }
	},
	{
		id: 'ice_cristal',
		name: 'Cristal Imobilizante',
		description: 'Cause 11 de dano. [DUPLICAR_CARTA] A próxima carta Gelo jogada é executada duas vezes.',
		cost: 1,
		kind: 'attack',
		element: 'ice',
		rarity: 'rare',
		damage: 11,
		price: { money: 90 }
	},
	{
		id: 'ice_friagem',
		name: 'Friagem Cortante',
		description: 'Cause 14 de dano. Aplica FRAQUEZA(1) no inimigo por 1 turno.',
		cost: 2,
		kind: 'attack',
		element: 'ice',
		rarity: 'rare',
		damage: 14,
		appliesStatuses: [{ id: 'fraqueza', stacks: 1, target: 'enemy' }],
		price: { money: 90 }
	},
	{
		id: 'ice_glaciacao',
		name: 'Glaciação',
		description: 'Ganha 20 de escudo. Se o escudo for completamente destruído, cause 20 de dano ao inimigo.',
		cost: 2,
		kind: 'defense',
		element: 'ice',
		rarity: 'epic',
		block: 20,
		appliesStatuses: [{ id: 'revenge_shield', stacks: 20 }],
		price: { money: 180 }
	},

	// ── Eletricidade ──────────────────────────────────────
	{
		id: 'electric_sobrecarga',
		name: 'Sobrecarga',
		description: 'Ativa DANO_ELÉTRICO(2): cada carta jogada causa +2 de dano elétrico até o fim do combate.',
		cost: 3,
		kind: 'power',
		element: 'electric',
		rarity: 'epic',
		appliesStatuses: [{ id: 'dano_eletrico', stacks: 2 }],
		price: { money: 180, element: { type: 'electric', amount: 50 } }
	},
	{
		id: 'electric_descarga',
		name: 'Descarga Elétrica',
		description: 'Descarte todas as cartas da mão. Cause 2 de dano por carta descartada.',
		cost: 2,
		kind: 'attack',
		element: 'electric',
		rarity: 'rare',
		price: { money: 90 }
	},
	{
		id: 'electric_eletrocussao',
		name: 'Eletrocussão',
		description: 'Ganha 8 de escudo. [CANCEL_ESCUDO] Se o inimigo for usar escudo neste turno, cancela sua ação.',
		cost: 2,
		kind: 'defense',
		element: 'electric',
		rarity: 'rare',
		block: 8,
		appliesStatuses: [{ id: 'shield_cancelled', target: 'enemy' }],
		price: { money: 90 }
	},

	// ── Pedra ─────────────────────────────────────────────
	{
		id: 'rock_muralha',
		name: 'Muralha de Pedra',
		description: '[ESCUDO_PERSISTE] O escudo atual não decai no início do próximo turno. [EXHAUST_COMBATE]',
		cost: 3,
		kind: 'defense',
		element: 'rock',
		rarity: 'epic',
		exhaust: 'combat',
		price: { money: 180, element: { type: 'rock', amount: 50 } }
	},
	{
		id: 'rock_barreira',
		name: 'Barreira Mineral',
		description: 'Ganha 10 de escudo. [COPIA_DESCARTE] Cria 1 cópia com -1 de defesa no descarte. (Limite: 3)',
		cost: 0,
		kind: 'defense',
		element: 'rock',
		rarity: 'rare',
		block: 10,
		price: { money: 90 }
	},
	{
		id: 'rock_fortaleza',
		name: 'Fortaleza de Silex',
		description: 'Duplica o escudo atual. [EXHAUST_COMBATE]',
		cost: 2,
		kind: 'defense',
		element: 'rock',
		rarity: 'epic',
		exhaust: 'combat',
		price: { money: 180 }
	},
	{
		id: 'rock_rocha_imovel',
		name: 'Rocha Imóvel',
		description: 'Se você tiver escudo no início do próximo turno, ganha +1 de energia no próximo turno.',
		cost: 0,
		kind: 'buff',
		element: 'rock',
		rarity: 'rare',
		price: { money: 90 }
	},

	// ── Pokébolas aprimoradas ─────────────────────────────
	{
		id: 'pokeball_great',
		name: 'Great Ball',
		description: 'Captura com +15% de chance.',
		cost: 2,
		kind: 'capture',
		element: null,
		rarity: 'common',
		captureBonus: 0.15,
		price: { money: 600 }
	},
	{
		id: 'pokeball_ultra',
		name: 'Ultra Ball',
		description: 'Captura com +30% de chance.',
		cost: 2,
		kind: 'capture',
		element: null,
		rarity: 'rare',
		captureBonus: 0.3,
		price: { money: 1200 }
	},
	{
		id: 'pokeball_master',
		name: 'Master Ball',
		description: 'Captura com +50% de chance.',
		cost: 2,
		kind: 'capture',
		element: null,
		rarity: 'epic',
		captureBonus: 0.5,
		price: { money: 2000 }
	}
];

// Tokens gerados em combate — nunca aparecem na loja, mas existem no template index
export const TOKEN_TEMPLATES: CardTemplate[] = [
	{
		id: 'bug_picada_token',
		name: 'Picada Rápida',
		description: 'Cause 5 de dano. [EXHAUST_RUN] [PILHA_EXAURIR +1]',
		cost: 0,
		kind: 'attack',
		element: 'bug',
		rarity: 'common',
		damage: 5,
		exhaust: 'run'
	}
];

// Todos os templates indexados por id.
export const CARD_TEMPLATES: Record<string, CardTemplate> = (() => {
	const map: Record<string, CardTemplate> = {};
	for (const t of [...STARTER_TEMPLATES, ...CATALOG, ...TOKEN_TEMPLATES]) map[t.id] = t;
	return map;
})();

export function getTemplate(id: string): CardTemplate | undefined {
	return CARD_TEMPLATES[id];
}
