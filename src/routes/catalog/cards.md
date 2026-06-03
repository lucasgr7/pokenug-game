# Pokemon Deckbuilder — Game Design Document

> Inspirado em Slay the Spire. Cada elemento define uma vertical de jogo com filosofia propria.
> Este documento e a fonte de verdade para implementacao do sistema de cartas, artefatos e regras.

---

## Indice

1. [Visao Geral do Sistema](#1-visao-geral-do-sistema)
2. [Sistema de Exhaust](#2-sistema-de-exhaust)
3. [Sistema de Misalignment](#3-sistema-de-misalignment)
4. [Raridades](#4-raridades)
5. [Artefatos de Regras](#5-artefatos-de-regras)
6. [Cartas Neutras (Starter Cards)](#6-cartas-neutras-starter-cards)
7. [Elementos e Cartas](#7-elementos-e-cartas)
   - [Agua](#71-agua)
   - [Fogo](#72-fogo)
   - [Grama](#73-grama)
   - [Dragao](#74-dragao)
   - [Psiquico](#75-psiquico)
   - [Terra](#76-terra)
   - [Lutador](#77-lutador)
   - [Voador](#78-voador)
   - [Inseto](#79-inseto)
   - [Veneno](#710-veneno)
   - [Fantasma](#711-fantasma)
   - [Gelo](#712-gelo)
   - [Eletricidade](#713-eletricidade)
   - [Pedra](#714-pedra)
8. [Elementos Pendentes](#8-elementos-pendentes)
9. [Alertas de Balanceamento](#9-alertas-de-balanceamento)

---

## 1. Visao Geral do Sistema

O jogo e um deckbuilder roguelike onde cada Pokemon possui um **elemento primario**. O elemento do Pokemon define quais cartas funcionam plenamente no deck. Cartas de outros elementos sao penalizadas pelo sistema de **Misalignment**.

### Principios centrais

- Cada elemento tem uma **filosofia unica** que define como o deck deve ser construido e jogado
- Cartas elementais sao mais fortes que cartas neutras dentro de sua vertical
- O jogador decide em qual vertical investir conforme progride na run
- Nenhum elemento e universalmente superior — cada um tem trade-offs claros

---

## 2. Sistema de Exhaust

O jogo possui dois tipos distintos de Exhaust:

### EXHAUST_COMBATE
> Carta e removida somente durante o combate atual. Volta ao deck normalmente no proximo combate.

- Indicado nas cartas como: `[EXHAUST_COMBATE]`
- Usado em cartas de poder limitado dentro da luta (ex: Sementes de Vida, Fortaleza de Silex)

### EXHAUST_RUN
> Carta e removida permanentemente da run atual. Nao volta mais.

- Indicado nas cartas como: `[EXHAUST_RUN]`
- Usado em cartas geradas temporariamente (ex: Picada Rapida gerada por Nuvem de Insetos)
- Usado em cartas de alto impacto com custo permanente (ex: Alma Penada)

### Cartas geradas em combate
Cartas criadas dinamicamente durante a luta (tokens como Picada Rapida) sao automaticamente removidas ao fim do combate. Nao entram no deck permanente.

---

## 3. Sistema de Misalignment

Quando um Pokemon usa uma carta cujo elemento **nao e o seu elemento primario**, a carta sofre **Misalignment**.

### Regras de Misalignment

| Condicao | Comportamento |
|---|---|
| Carta elemental alinhada com o Pokemon | Funciona normalmente |
| Carta elemental fora do elemento do Pokemon | `[EXHAUST_COMBATE]` automatico apos ser jogada |
| Carta neutra (Normal) | Nunca sofre Misalignment |
| Starter cards | Nunca sofrem Misalignment, independente do elemento |

### Implicacao estrategica
O sistema pressiona naturalmente o jogador a montar um deck focado. Quanto mais cartas elementais fora do tipo o jogador acumular, mais rapidamente seu deck se degrada.

---

## 4. Raridades

| Raridade | Descricao | Frequencia no mercado |
|---|---|---|
| `COMMON` | Carta basica. Efeito direto e simples. | Alta |
| `RARE` | Carta com sinergia ou efeito especial. | Media |
| `EPIC` | Carta poderosa. Altera o estado da luta. | Baixa |
| `SPECIAL` | Carta unica por luta (POWER) ou mecanica exclusiva. | Muito baixa |

---

## 5. Artefatos de Regras

Artefatos sao **definicoes reutilizaveis de regras**. Cartas referenciam o ID do artefato ao inves de descrever a regra completa. Isso garante consistencia na implementacao.

---

### ART-01 — EXHAUST_COMBATE
**Efeito:** Carta e removida do combate atual ao ser jogada. Retorna ao deck no proximo combate.
**Usado por:** Sementes de Vida, Fortaleza de Silex, Paradoxo Cerebral

---

### ART-02 — EXHAUST_RUN
**Efeito:** Carta e removida permanentemente da run atual ao ser jogada.
**Usado por:** Alma Penada, cartas geradas (tokens), cartas Misalignment

---

### ART-03 — POWER
**Efeito:** Carta de poder. So pode ser jogada uma vez por luta. Seu efeito e persistente ate o fim da luta.
**Regra adicional:** Uma carta POWER nao pode ser copiada por `DUPLICAR_CARTA`.
**Usado por:** Poder Canalizado, Compressao Terrestre, Punho Sincronizado, Congelamento Progressivo, Assombracao Progressiva

---

### ART-04 — IMOBILIZADO
**Efeito:** Status no inimigo. Enquanto ativo, o dano do inimigo e reduzido a 50%.
**Parametro:** `IMOBILIZADO(X)` onde X = numero de turnos de duracao.
**Acumulavel:** Sim. Jogar novamente adiciona turnos ao contador atual.
**Usado por:** Imobilizacao Total, Prisao Eterna, cartas de Gelo

---

### ART-05 — FRAQUEZA
**Efeito:** Status no inimigo. O inimigo recebe +25% de dano de todas as fontes por carga.
**Parametro:** `FRAQUEZA(X)` onde X = numero de cargas ou turnos.
**Acumulavel:** Sim.
**Usado por:** Colapso Toxico, Friagem Cortante

---

### ART-06 — ENRAIZADO
**Efeito:** Status no inimigo. Cartas do elemento Grama causam o dobro de dano enquanto ativo.
**Parametro:** `ENRAIZADO(X)` onde X = numero de turnos.
**Acumulavel:** Sim. Turnos se somam.
**Usado por:** Raiz Profunda, Sementes de Vida

---

### ART-07 — CARGA_DRAGAO
**Efeito:** Recurso numerico acumulavel do deck Dragao. Cada ponto de CARGA_DRAGAO adiciona +1 de dano base a Furia do Dragao quando ela for jogada.
**Persistencia:** Persiste durante todo o combate. Reseta ao fim da luta.
**Acumulavel:** Sim, sem limite.
**Usado por:** Bafo Ancestral, Choque Draconico, Poder Canalizado

---

### ART-08 — ESCUDO_PERSISTE
**Efeito:** O escudo atual nao e zerado no inicio do proximo turno. Permanece ate ser completamente destruido pelo dano do inimigo.
**Regra:** Aplicado como efeito de turno, nao como estado permanente. Precisa ser ativado novamente se o escudo for zerado.
**Usado por:** Muralha de Pedra

---

### ART-09 — REFLEXO
**Efeito:** Todo dano absorvido pelo escudo do jogador neste turno e devolvido ao inimigo.
**Calculo sugerido:** Reflexo = 50% do dano absorvido (para balanceamento).
**Duracao:** Apenas no turno em que foi ativado.
**Usado por:** Espelho Psiquico

---

### ART-10 — DUPLICAR_CARTA
**Efeito:** A proxima carta jogada apos ativar este efeito e executada duas vezes, com todos os seus efeitos aplicados duas vezes.
**Restricao:** Nao funciona em cartas com tag `POWER`.
**Duracao:** Consome o efeito apos a proxima carta ser jogada.
**Usado por:** Paradoxo Cerebral, Cristal Imobilizante

---

### ART-11 — DANO_ELETRICO
**Efeito:** Passivo ativo. Enquanto DANO_ELETRICO estiver ativo, cada carta jogada pelo jogador causa X de dano eletrico bonus ao inimigo, independente do tipo da carta.
**Parametro:** `DANO_ELETRICO(X)` onde X = dano bonus por carta.
**Duracao:** Ate o fim do combate ou ate ser removido.
**Usado por:** Sobrecarga

---

### ART-12 — CANCEL_ESCUDO
**Efeito:** Cancela a acao de escudo do inimigo no turno atual. Se o inimigo for usar escudo neste turno, a acao e ignorada e o escudo nao e gerado.
**Duracao:** Apenas no turno em que foi ativado.
**Usado por:** Eletrocussao

---

### ART-13 — REDUZ_SHIELD
**Efeito:** O escudo que o inimigo ganhar neste turno e reduzido a 50% do valor original.
**Duracao:** Apenas no turno em que foi ativado.
**Usado por:** Intoxicacao

---

### ART-14 — REDUZ_BUFF
**Efeito:** Qualquer buff de dano (inspiracao ou equivalente) que o inimigo ganhar neste turno e reduzido a 50% do valor original.
**Duracao:** Apenas no turno em que foi ativado.
**Usado por:** Morte Lenta

---

### ART-15 — AMPLIFICA
**Efeito:** Todos os efeitos negativos ativos no inimigo no momento da ativacao tem seus valores dobrados instantaneamente.
**Regra:** Aplica-se ao estado atual. Novos debuffs aplicados depois nao sao afetados.
**Usado por:** Toxina Mortifera

---

### ART-16 — COPIA_DESCARTE
**Efeito:** Cria uma copia da carta especificada e a insere na pilha de descarte do jogador para esta partida. A copia e identica a original, exceto quando indicado (ex: "-1 de defesa").
**Limite sugerido:** Maximo de 3 copias da mesma carta por partida para evitar loops.
**Usado por:** Rajada de Socos, Barreira Mineral

---

### ART-17 — SEQUENCIA
**Efeito:** Cartas do elemento Lutador jogadas consecutivamente (sem interrupcao de outras cartas) acumulam +2 de dano por carta na sequencia.
**Reset:** Se uma carta de outro elemento for jogada, o contador de sequencia volta a zero.
**Requer:** Tag POWER ativa (Punho Sincronizado deve estar em jogo).
**Usado por:** Punho Sincronizado

---

### ART-18 — AUTO_JOGAR
**Efeito:** Cartas marcadas com AUTO_JOGAR sao jogadas automaticamente no inicio do turno do jogador, antes de qualquer acao manual, sem custar energia adicional.
**Limite sugerido:** Maximo de 3 cartas auto-jogadas por turno para evitar abuso com `COPIA_DESCARTE`.
**Usado por:** Ritmo Implacavel

---

### ART-19 — PILHA_EXAURIR
**Efeito:** Contador global de cartas do elemento Inseto que foram exauridas (via `EXHAUST_COMBATE` ou `EXHAUST_RUN`) durante esta run. Alimenta o calculo de dano de Enxame Voraz.
**Persistencia:** Persiste entre combates durante a run.
**Acumulavel:** Sim, sem limite.
**Usado por:** Picada Rapida, Corte de Tesoura, Enxame Voraz

---

### ART-20 — BANIDO (Supremas)
**Efeito:** Apos ser jogada, a carta e banida permanentemente da run atual. Nunca mais aparece no deck ou no mercado nesta run.
**Usado por:** Todas as cartas Supremas

---

## 6. Cartas Neutras (Starter Cards)

Cartas neutras nao pertencem a nenhum elemento. **Nunca sofrem Misalignment.** Funcionam como base inicial de qualquer deck e sao substituidas naturalmente conforme o jogador investe em cartas elementais.

### Filosofia
Fazem uma coisa de forma competente. Sem combos, sem sinergia especial. Nao ganham nem perdem uma luta sozinhas — sao o piso do deck.

### Ataque

| Nome | Custo | Dano | Raridade | Efeito |
|---|---|---|---|---|
| Ataque Preciso | 0 | 4 | COMMON | Cause 4 de dano. |
| Golpe Direto | 1 | 8 | COMMON | Cause 8 de dano. |
| Investida | 2 | 18 | COMMON | Cause 18 de dano. |

### Defesa

| Nome | Custo | Escudo | Raridade | Efeito |
|---|---|---|---|---|
| Bloqueio | 0 | 6 | COMMON | Ganha 6 de escudo. |
| Postura Defensiva | 1 | 10 | COMMON | Ganha 10 de escudo. |
| Recuo Estrategico | 2 | 20 | COMMON | Ganha 20 de escudo. |

### Suporte

| Nome | Custo | Raridade | Efeito |
|---|---|---|---|
| Respiro | 0 | COMMON | Ganha +1 de energia no proximo turno. |
| Concentracao | 1 | COMMON | Compre 1 carta. |
| Reserva | 1 | COMMON | Compre 1 carta. Ganha 4 de escudo. |

---

## 7. Elementos e Cartas

---

### 7.1 Agua

**Filosofia:** Cartas baratas focadas em compra de cartas. Dano baixo, fluxo continuo e volume de deck. O deck de Agua nao vence por dano individual alto — vence por volume e consistencia.

**Mecanica de geracao de energia:** Nao possui. Agua investe em volume de cartas, nao em energia.

**Mecanica de compra:** Core do elemento. Cartas de custo 0 compram 1 carta. Cartas de custo alto compram multiplas.

| Nome | Custo | Dano | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Splash | 0 | 4 | COMMON | Cause 4 de dano. Compre 1 carta do mercado. | OK |
| Fluxo | 2 | 14 | RARE | Cause 14 de dano. Compre 2 cartas do mercado. | OK |
| Torrent | 3 | 28 | EPIC | Cause 28 de dano. Sem efeito adicional. | Ajustado de 42 para 28 |

---

### 7.2 Fogo

**Filosofia:** Auto-dano em troca de dano alto. O jogador troca vida propria por poder ofensivo. Deck agressivo de alto risco.

**Mecanica de geracao de energia:** Nao possui diretamente. Alta agressao compensa.

**Mecanica de sobrevivencia:** Nao possui escudo. O jogador precisa vencer rapido ou usar outros elementos de suporte.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Chama Ardente | 0 | 8 dmg | COMMON | Cause 8 de dano. Voce sofre 1 de dano. | OK |
| Inferno | 2 | 30 dmg | RARE | Cause 30 de dano. Voce sofre 8 de dano. | Ajustado: removido escudo, aumentado auto-dano |
| Incineracao | 2 | 20 dmg | RARE | Cause 20 de dano. Voce sofre 2 de dano. | OK |

> **Nota:** Inferno foi ajustado para remover o escudo (inconsistente com a filosofia de Fogo) e aumentar o auto-dano proporcionalmente ao dano causado.

---

### 7.3 Grama

**Filosofia:** Centrada em Raiz Profunda. Aplica `ENRAIZADO` no inimigo para dobrar o dano de cartas Grama. Geracao de energia passiva como recompensa por controle.

**Mecanica de geracao de energia:** Sementes de Vida (`EXHAUST_COMBATE`) gera +1 energia. Fotossintese (poder passivo sugerido) gera +1 energia por turno automaticamente.

**Mecanica de compra:** Enquanto `ENRAIZADO` estiver ativo no inimigo, o jogador pode comprar 1 carta gratuita por turno.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Raiz Profunda | 2 | - | RARE | Aplica `ENRAIZADO(2)` no inimigo (acumulavel). Cartas Grama causam dobro de dano enquanto ativo. | OK — peca central |
| Sementes de Vida | 0 | - | RARE | Ganha +1 de energia. Compre +1 carta. `[EXHAUST_COMBATE]` | OK — EXHAUST justifica o 0 custo |
| Brotos Ofensivos | 1 | 6 dmg | COMMON | Cause 6 de dano. (12 se `ENRAIZADO` ativo.) | OK |
| Espinhos | 1 | 12 blk | COMMON | Ganha 12 de escudo. Reduz seu escudo maximo permanente em -1. | OK — trade-off interessante |

---

### 7.4 Dragao

**Filosofia:** Centrada em Furia do Dragao. Acumular `CARGA_DRAGAO` ao longo da luta para liberar dano massivo em um unico golpe explosivo.

**Mecanica de geracao de energia:** A cada 4 pontos de `CARGA_DRAGAO` acumulados, o jogador ganha 2 de energia automaticamente e o contador reseta.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Furia do Dragao | 2 | 10+ dmg | EPIC | Cause 10 de dano base + valor total de `CARGA_DRAGAO`. | OK — peca central |
| Bafo Ancestral | 1 | - | COMMON | Compre +1 carta. Adiciona +8 em `CARGA_DRAGAO`. | OK |
| Choque Draconico | 1 | 6 dmg | COMMON | Cause 6 de dano. Adiciona +8 em `CARGA_DRAGAO`. | OK |
| Poder Canalizado | 3 | - | SPECIAL | `[POWER]` Furia do Dragao causa o dobro do dano total nesta luta. | OK — POWER equilibra |

---

### 7.5 Psiquico

**Filosofia:** Transforma dano recebido em ataque. Inversao e paradoxo. O deck Psiquico nao evita dano — ele o converte em vantagem ofensiva.

**Mecanica de sobrevivencia:** Espelho Psiquico gera escudo com `REFLEXO`. O dano absorvido e devolvido ao inimigo (50% do valor absorvido).

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Refluxo Mental | 2 | var dmg | EPIC | Todo dano sofrido no ultimo turno e causado de volta ao inimigo. Teto sugerido: 30. | Teto adicionado |
| Espelho Psiquico | 2 | 18 blk | RARE | Ganha 18 de escudo. `[REFLEXO]` 50% do dano absorvido pelo escudo e devolvido ao inimigo neste turno. | Ajustado para 50% |
| Mente Contorcida | 1 | 13 dmg | COMMON | Cause 13 de dano. | OK |
| Paradoxo Cerebral | 2 | - | EPIC | `[DUPLICAR_CARTA]` A proxima carta jogada e executada duas vezes. `[EXHAUST_COMBATE]` | Ajustado custo de 1 para 2 |

---

### 7.6 Terra

**Filosofia:** Estrutura e pensamento de longo prazo. Controle via `IMOBILIZADO`. O deck Terra vence desacelerando o inimigo e construindo poder ao longo do tempo.

**Mecanica de geracao de energia:** Compressao Terrestre (`POWER`) garante +1 de energia no proximo turno. Rocha Imovel (Pedra) tambem oferece +1 energia condicional.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Imobilizacao Total | 2 | - | RARE | Aplica `IMOBILIZADO(2)` no inimigo (dano do inimigo reduzido a 50% por 2 turnos). | OK |
| Peso da Terra | 0 | 12 blk | COMMON | Ganha 12 de escudo. A proxima carta Terra jogada tem -1 de custo (minimo 0). | OK |
| Compressao Terrestre | 3 | - | SPECIAL | `[POWER]` No proximo turno, comece com +1 de energia adicional. | OK |
| Prisao Eterna | 1 | 5 dmg | RARE | Cause 5 de dano. Se o inimigo estiver com `IMOBILIZADO` ativo, duplique sua duracao. | OK |

---

### 7.7 Lutador

**Filosofia:** Cadeia de golpes e combo. Cartas Lutador jogadas em sequencia acumulam poder. Quebrar a cadeia reseta o bonus. Deck explosivo dependente de ritmo.

**Mecanica de geracao de energia:** A cada 2+ cartas Lutador jogadas no mesmo turno, o jogador ganha +1 de energia no proximo turno.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Rajada de Socos | 0 | 6 dmg | COMMON | Cause 6 de dano. `[COPIA_DESCARTE]` Cria 1 copia desta carta na pilha de descarte. Limite: 2 copias por partida. | Limite adicionado |
| Punho Sincronizado | 2 | - | SPECIAL | `[POWER]` `[SEQUENCIA]` Ativa o sistema de cadeia: cartas Lutador consecutivas acumulam +2 de dano por carta. | OK |
| Serie de Ataques | 3 | 32 dmg | EPIC | Cause 32 de dano. | OK |
| Ritmo Implacavel | 0 | - | SPECIAL | `[AUTO_JOGAR]` Cartas Lutador na mao sao jogadas automaticamente no inicio do turno. Limite: 3 cartas por turno. | Limite adicionado |

---

### 7.8 Voador

**Filosofia:** Evasao de alto risco e alto ganho. O jogador sacrifica o turno atual em troca de um proximo turno mais poderoso. Incerteza e planejamento.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Evasao Total | 3 | - | EPIC | Termine seu turno imediatamente. Proximo turno: compre +2 cartas e ganha +1 de energia. | OK |
| Golpe Aereo | 1 | 9 dmg | COMMON | Cause 9 de dano. Se voce nao jogou nenhum ataque antes desta carta neste turno, compre 1 carta. | Efeito Voador adicionado |
| Evasao | 1 | 12 blk | COMMON | Ganha 12 de escudo. Se voce nao sofreu dano neste turno, ganha +4 de escudo adicional. | Efeito Voador adicionado |
| Fluxo Aereo | 0 | var dmg | SPECIAL | Nao jogue nenhum ataque nos proximos 2 turnos. Entao jogue automaticamente todas as cartas da pilha de descarte de uma vez. | OK — risco real |

---

### 7.9 Inseto

**Filosofia:** Exaurir cartas Inseto ao longo da luta para potencializar Enxame Voraz. Cada carta Inseto e descartavel individualmente mas valiosima para o combo final.

**Mecanica de compra:** A cada 4 cartas Inseto em `PILHA_EXAURIR`, o jogador compra 1 carta gratuita do mercado.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Picada Rapida | 0 | 5 dmg | COMMON | Cause 5 de dano. `[EXHAUST_COMBATE]` `[PILHA_EXAURIR +1]` | OK — token gerado |
| Corte de Tesoura | 1 | 12 dmg | COMMON | Cause 12 de dano. Exaure 1 carta Inseto da sua mao. `[PILHA_EXAURIR +1]` | OK |
| Nuvem de Insetos | 1 | - | RARE | Gere 3 cartas Picada Rapida (custo 0) na sua mao. | OK — alimenta PILHA_EXAURIR |
| Enxame Voraz | 2 | var dmg | EPIC | Cause 2 de dano por cada carta em `PILHA_EXAURIR`. | OK |

---

### 7.10 Veneno

**Filosofia:** Reducao de upgrades do inimigo. Impede o inimigo de se fortalecer com escudos e buffs. Controle indireto via deterioracao.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Intoxicacao | 1 | 5 dmg | COMMON | Cause 5 de dano. `[REDUZ_SHIELD]` Escudo que o inimigo ganhar neste turno e reduzido a 50%. | OK |
| Morte Lenta | 1 | 8 dmg | RARE | Cause 8 de dano. `[REDUZ_BUFF]` Buff de dano que o inimigo ganhar neste turno e reduzido a 50%. | OK |
| Toxina Mortifera | 3 | 16 dmg | EPIC | Cause 16 de dano. `[AMPLIFICA]` Dobra todos os efeitos negativos ativos no inimigo agora. | Ajustado custo de 2 para 3 |
| Colapso Toxico | 3 | - | EPIC | Por 5 turnos, o inimigo recebe `[FRAQUEZA(5)]` — +25% de dano recebido de todas as fontes. | OK |

---

### 7.11 Fantasma

**Filosofia:** Paga com HP maximo como recurso. Cada carta Fantasma custa vida permanente em troca de poder imediato. Deck de sacrificio progressivo.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Alma Penada | 0 | - | RARE | Reduz dano do inimigo em 1 permanentemente. Exaure 1 carta aleatoria da sua mao. `[EXHAUST_RUN desta carta]` | OK |
| Espectro Voraz | 1 | 18 dmg | RARE | Cause 18 de dano. Reduz seu HP maximo em 4. | OK |
| Assombracao Progressiva | 3 | - | SPECIAL | `[POWER]` Cartas Fantasma ganham +1 de dano a cada turno desta luta. | OK |
| Fantasmagoria | 2 | 8/8 | COMMON | Cause 8 de dano e ganha 8 de escudo. | Ajustado de 12/12 por 1 energia para 8/8 por 2 |
| Maldicao Eterna | 1 | - | RARE | Perca 1 de HP maximo. Ganha +1 de energia e compre 1 carta. | Ajustado custo de 0 para 1 |

---

### 7.12 Gelo

**Filosofia:** Uma carta buffa a outra. Cartas Gelo potencializam a proxima carta Gelo jogada. Sistema de chain buff crescente.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Congelamento Progressivo | 2 | - | SPECIAL | `[POWER]` Cause 3 de dano por cada carta Gelo jogada nesta luta. | OK |
| Cristal Imobilizante | 1 | 11 dmg | RARE | Cause 11 de dano. `[DUPLICAR_CARTA]` A proxima carta Gelo jogada e executada duas vezes. | OK |
| Friagem Cortante | 2 | 14 dmg | RARE | Cause 14 de dano. Aplica `[FRAQUEZA(1)]` no inimigo por 1 turno. | OK |
| Glaciacao | 2 | 20 blk | EPIC | Ganha 20 de escudo. Se o escudo for completamente destruido, cause 20 de dano ao inimigo. | OK — mecanica unica |

---

### 7.13 Eletricidade

**Filosofia:** Chip damage continuo. Cartas baratas que constantemente causam dano bonus via `DANO_ELETRICO`. Pressao constante ao longo da luta.

**Mecanica de geracao de energia:** Nao possui diretamente. A pressao do DANO_ELETRICO e o trade-off.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Sobrecarga | 3 | - | EPIC | Ativa `[DANO_ELETRICO(2)]`: cada carta jogada causa +2 de dano eletrico ao inimigo ate o fim do combate. | OK |
| Descarga Eletrica | 2 | var dmg | RARE | Descarte todas as cartas da sua mao. Cause 2 de dano por carta descartada. | OK — monitorar com Agua |
| Eletrocussao | 2 | 8 blk | RARE | Ganha 8 de escudo. `[CANCEL_ESCUDO]` Se o inimigo for usar escudo neste turno, cancela sua acao. | OK |

---

### 7.14 Pedra

**Filosofia:** Protecao e durabilidade. Escudo e prioridade maxima. O deck Pedra constroi paredes impenetraveis e ganha energia por manter escudo ativo.

**Mecanica de geracao de energia:** Rocha Imovel — se o jogador tiver escudo no fim do turno, ganha +1 de energia no proximo turno.

**Mecanica de sobrevivencia:** Core do elemento. Escudo duplicado, persistente e auto-replicante.

| Nome | Custo | Dano/Def | Raridade | Efeito | Balanceamento |
|---|---|---|---|---|---|
| Muralha de Pedra | 3 | - | EPIC | `[ESCUDO_PERSISTE]` O escudo atual nao decai no inicio do proximo turno. | OK |
| Barreira Mineral | 0 | 10 blk | RARE | Ganha 10 de escudo. `[COPIA_DESCARTE]` Cria 1 copia com -1 de defesa na pilha de descarte. Limite: 3 copias. | Limite adicionado |
| Fortaleza de Silex | 2 | x2 blk | EPIC | Duplica o escudo atual. `[EXHAUST_COMBATE]` | OK — EXHAUST equilibra |
| Rocha Imovel | 0 | - | RARE | Se voce tiver escudo no fim deste turno, ganha +1 de energia no proximo turno. | OK |

---

## 8. Elementos Pendentes

Os seguintes elementos ainda nao possuem cartas definidas e precisam de elaboracao antes da implementacao:

| Elemento | Filosofia definida | Cartas definidas |
|---|---|---|
| Metal | Sim — Estrutura e efeito permanente, reducao de dano via Armadura | Nao |
| Sorte | Sim — Risco e recompensa aleatoria, sacrifica turno por incerteza futura | Nao |
| Normal | Sim — Eficiencia pura, custo-beneficio sem gimmick | Parcial (starter cards) |

---

## 9. Alertas de Balanceamento

Mudancas aplicadas neste documento em relacao ao rascunho original:

| Carta | Problema | Solucao Aplicada |
|---|---|---|
| Torrent (Agua) | 42 dano por 3 energia | Reduzido para 28 |
| Inferno (Fogo) | Escudo inconsistente com filosofia | Removido escudo, trocado por auto-dano |
| Paradoxo Cerebral (Psiquico) | Duplicar carta por 1 energia | Custo aumentado para 2 |
| Espelho Psiquico (Psiquico) | Reflexo 100% do escudo | Reduzido para 50% do dano absorvido |
| Refluxo Mental (Psiquico) | Sem teto de dano refletido | Teto de 30 de dano adicionado |
| Rajada de Socos (Lutador) | Auto-replica sem limite | Limite de 2 copias por partida |
| Ritmo Implacavel (Lutador) | Auto-jogar tudo sem limite | Limite de 3 cartas auto-jogadas por turno |
| Toxina Mortifera (Veneno) | Amplifica + 16 dano por 2 energia | Custo aumentado para 3 |
| Fantasmagoria (Fantasma) | 12 dano + 12 escudo por 1 energia | Reduzido para 8/8 e custo aumentado para 2 |
| Maldicao Eterna (Fantasma) | 3 efeitos positivos por custo 0 | Custo aumentado para 1 |
| Barreira Mineral (Pedra) | Cadeia de copias sem limite | Limite de 3 copias por partida |

---

*Documento gerado para implementacao por Agentes de IA. Cada artefato deve ser implementado como uma funcao ou sistema reutilizavel referenciado pelo seu ID.*