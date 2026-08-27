# BioLuz — especificação de implementação

> Documento de contexto para agente de código. Cole na raiz do repositório
> (como `PROJETO.md` ou dentro de `CLAUDE.md`) antes de começar a implementar.
> Regras: seguir as decisões arquiteturais desta spec; não substituir a
> abordagem de snapshots por replay commit-a-commit; não colocar chave de API
> no cliente.

## O que é

Uma página onde a pessoa cola a URL de um repositório do GitHub e assiste ao
projeto se construindo do nada em ~2 minutos: arquivos nascendo como bolinhas,
pastas se separando em bairros, o código crescendo ao longo dos anos.

**Alvo de esforço:** 5 horas de trabalho limpo.
**Stack:** Canvas 2D puro + TypeScript + Vite no front; Cloudflare Worker com
cache no back. Sem biblioteca de grafo, sem biblioteca de física, sem 3D.

## O conceito em três frases

1. Um repositório é uma pilha de fotografias — cada commit é o estado completo
   da árvore de arquivos naquele instante, não só o que mudou.
2. Pegando 40 dessas fotos espalhadas do primeiro ao último commit, você tem 40
   listas de caminhos de arquivo; comparar a lista N com a N+1 diz quem nasceu e
   quem morreu.
3. Cada arquivo vivo é uma bolinha ligada por um fio à bolinha da sua pasta, e
   três forças simples acomodam tudo — a "cidade" emerge da estrutura de pastas,
   ninguém a programa.

## Decisão arquitetural central (não reverter)

**Snapshots de árvore, não replay de commits.**

| | Replay commit-a-commit | 40 snapshots de árvore |
|---|---|---|
| Requisições | 1 por commit (800+) | 41 no total |
| Limite da API | estoura (60/h sem auth) | cabe folgado |
| Complexidade | diffs, renomeações, merges | comparar dois arrays de string |
| Perda | — | granularidade invisível numa animação de 2 min |

Endpoints usados:

- `GET /repos/{owner}/{repo}/commits?per_page=100` → lista de commits com sha,
  autor e data. 1 requisição (pagine só se quiser mais de 100).
- `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` → árvore completa de
  arquivos daquele commit. 1 requisição por snapshot escolhido.

Escolha os 40 shas por espaçamento uniforme ao longo da lista de commits
(sempre incluindo o primeiro e o último).

## Modelo de dados

```ts
type Quadro = {
  sha: string
  data: string        // ISO, quando essa foto foi tirada
  autores: string[]   // quem commitou desde o quadro anterior
  arquivos: string[]  // caminhos completos, ex "src/api/user.js"
}

type No = {
  caminho: string           // a identidade — nunca muda
  tipo: 'arquivo' | 'pasta'
  pai: string | null
  x: number; y: number      // posição atual
  vx: number; vy: number    // velocidade atual
  nascimento: number        // índice do quadro em que apareceu
  brilho: number            // 1 ao ser tocado, decai a cada frame
  raio: number
}

// única função que muda o mundo entre uma foto e a próxima
function transicao(nos: Map<string, No>, de: Quadro, para: Quadro): void
// - caminho em `para` e não em `de`  → cria nó com raio 0 e brilho 1
// - caminho em `de` e não em `para`  → marca para sumir (fade de 500 ms)
// - pastas são criadas implicitamente a partir dos segmentos do caminho
```

`caminho` é a identidade. Arquivo renomeado = uma morte e um nascimento, e
visualmente isso fica ótimo: uma refatoração grande aparece como um bairro
apagando enquanto outro acende ao lado.

## As três forças (o coração, ~40 linhas)

Para cada nó, a cada passo de simulação:

1. **Repulsão** — todo par de nós próximos se empurra (inverso do quadrado da
   distância, com distância mínima para não explodir).
2. **Mola** — aresta filho→pai puxa os dois para um comprimento de repouso.
3. **Gravidade** — atração fraca de todos para o centro do canvas.

Depois: `v *= amortecimento` (comece em `0.85`) e `pos += v`, com **passo de
tempo fixo**.

- Sem repulsão → tudo vira um borrão no centro.
- Sem mola → some a estrutura de pastas.
- Sem gravidade → o grafo foge da tela.

Otimização necessária acima de ~300 nós: grade espacial (spatial hash) para a
repulsão só considerar vizinhos da mesma célula e adjacentes. Sem isso é O(n²).

## Plano de execução

Cada etapa termina em algo verificável. Não avance sem o critério de aceite.

### Etapa 1 — Os dados, sem nenhum pixel (1 h)

Worker que recebe `?repo=dono/nome`, busca a lista de commits, escolhe 40 shas
espalhados, busca as 40 árvores em paralelo e devolve `Quadro[]` como JSON.
Cache de 24 h por repositório. Token do GitHub em variável de ambiente do
Worker — **nunca** no cliente.

**Aceite:** um `curl` no Worker devolve 40 quadros com contagem de arquivos
crescente do primeiro ao último.

### Etapa 2 — A física, com bolinhas feias (1 h)

Monta o grafo do quadro 40 inteiro e roda as três forças. Círculos cinzas,
linhas finas, nenhuma cor. Ajustar constantes até estabilizar.

**Aceite:** a árvore de pastas se organiza sozinha e para de tremer em poucos
segundos.

### Etapa 3 — O tempo passando (1 h)

`transicao()` entre quadros consecutivos, avançando um quadro a cada ~3 s.
Nascimento cresce de raio 0; morte some em 500 ms.

**Aceite:** o repositório cresce do nada até hoje. **Este é o projeto.**

### Etapa 4 — Ficar bonito (1 h)

Cor por extensão de arquivo; raio por tamanho; brilho ao nascer; rótulo só nas
pastas grandes; fundo escuro; rastro suave (desenhar um retângulo semi-opaco
por cima em vez de `clearRect`).

**Aceite:** dá para mostrar a alguém sem pedir desculpa.

### Etapa 5 — Deixar entrar (1 h)

Campo de URL, três repositórios famosos pré-aquecidos no cache como botões,
linha do tempo com data e autores, deploy, GIF de 10 s no README.

**Aceite:** outra pessoa cola o repositório dela e funciona de primeira.

## Riscos conhecidos

- **Repositórios gigantes.** Linux tem 80 mil arquivos e a física morre. Limite
  aos 500 maiores por tamanho, agregue o resto na pasta, e diga isso na tela.
- **Física tremendo.** Vibração = amortecimento baixo demais. Congelamento no
  meio = repulsão fraca demais. Passo de tempo sempre fixo.
- **Limite da API na hora da demo.** Três repositórios pré-aquecidos no cache, e
  sempre comece a demo por eles.
- **Chave da API no cliente.** Nunca. É a primeira coisa que se procura no
  DevTools.

## Ordem de corte se o tempo acabar

1. Rótulos de pasta → fica só a cor por extensão.
2. Autores na linha do tempo → fica só a data.
3. Campo de URL livre → ficam só os três exemplos, declarados como prévia.
4. Morte de arquivo → tudo só nasce e acumula.

**Não cortar em hipótese nenhuma:** a Etapa 3. Sem o tempo passando isso vira um
gráfico bonito, que é exatamente o que ninguém lembra.

## README (o que escrever depois)

- GIF de 10 s no topo, antes de qualquer texto.
- Um parágrafo sobre a decisão snapshots-vs-commits, com os números (41 vs 800+
  requisições). É o trecho que prova critério de engenharia.
