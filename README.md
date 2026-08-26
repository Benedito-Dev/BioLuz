<div align="center">

# 🌃 Cidade de Commits

**Cole um repositório do GitHub e assista ele se construir do nada.**

Arquivos nascem como bolinhas. Pastas se separam em bairros.
O projeto inteiro cresce diante de você em dois minutos.

<br>

![Status](https://img.shields.io/badge/status-em%20construção-orange?style=flat-square)
![Etapa](https://img.shields.io/badge/etapa-1%20de%206-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=flat-square&logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?style=flat-square&logo=vercel&logoColor=white)

</div>

<br>

> **Em construção.** A animação ainda não está no ar.
> Este README documenta as decisões enquanto o projeto é construído.

<br>

## O que é

Um repositório do Git guarda a história completa de um projeto — mas essa
história só é legível como texto: listas de commits, diffs, mensagens.

**Cidade de Commits torna essa história visível.** Você cola uma URL e vê o
projeto nascer: o primeiro arquivo solitário, a primeira pasta, a explosão de
crescimento quando o time chegou, a grande refatoração em que um bairro inteiro
se apaga enquanto outro acende ao lado.

Nada disso é programado. A cidade **emerge** da estrutura de pastas.

<br>

## A decisão de engenharia

O caminho óbvio para animar a história de um repositório é reproduzir commit a
commit. **Este projeto não faz isso** — e a razão é o número de requisições.

Em vez de reproduzir cada commit, tiramos **40 fotografias** da árvore de
arquivos, espalhadas uniformemente do primeiro ao último commit. Comparar a
foto N com a N+1 diz exatamente quem nasceu e quem morreu.

|  | Replay commit a commit | 40 snapshots de árvore |
|---|---|---|
| **Requisições** | 1 por commit — 800+ | **41 no total** |
| **Limite da API** | estoura (60/h sem token) | cabe folgado |
| **Complexidade** | diffs, renomeações, merges | comparar dois arrays de string |
| **O que se perde** | — | granularidade invisível em 2 min |

A granularidade perdida não aparece na tela: numa animação de dois minutos,
ninguém distingue o commit 417 do 418. O que se ganha é um projeto que funciona
dentro do limite da API e cujo núcleo cabe em duas dezenas de linhas.

<br>

## Como a cidade se organiza

Cada arquivo vivo é uma bolinha ligada por um fio à bolinha da sua pasta. Três
forças simples acomodam tudo:

```
      repulsão                    mola                   gravidade
                                                              
    ◯ ←→ ◯                    ◯━━━━━◯                  ◯ ↘   ↙ ◯
                                                          ◯ ● ◯
    ◯ ←→ ◯                    ◯━━━━━◯                  ◯ ↗   ↖ ◯
                                                              
  nós próximos se           filho e pai se           todos são atraídos
  empurram, evitando        puxam, revelando         fracamente para o
  o amontoado               a hierarquia             centro da tela
```

Cada força sozinha falha, e o modo como falha mostra para que ela serve:

| Se faltar | O que acontece |
|---|---|
| **Repulsão** | tudo vira um borrão no centro |
| **Mola** | some a estrutura de pastas |
| **Gravidade** | o grafo foge da tela |

Juntas, elas produzem bairros — sem que ninguém programe o conceito de bairro.

<br>

## O tempo passando

O caminho é a identidade de um nó. Isso tem uma consequência elegante: um
arquivo renomeado é **uma morte e um nascimento**.

Visualmente, isso é melhor do que rastrear a renomeação. Uma refatoração grande
aparece como um bairro inteiro se apagando enquanto outro acende ao lado — que
é exatamente o que aconteceu no projeto real.

```
 quadro N          transição          quadro N+1
                                       
   ◯ ◯ ◯     ──  nasceu: ✦   ──      ◯ ◯ ◯ ✦
   ◯ ◯       ──  morreu: ✕   ──      ◯
```

<br>

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| **Render** | Canvas 2D puro | 500 nós a 60 fps; DOM não aguenta |
| **Linguagem** | TypeScript | o tipo `Quadro` é o contrato entre back e front |
| **Build** | Vite | uma página, um canvas — não precisa de framework |
| **Back** | Vercel Function | sem estado, só busca e transforma |
| **Cache** | CDN, 24 h | uma requisição por repositório por dia |

**Sem** biblioteca de grafo. **Sem** biblioteca de física. **Sem** 3D.
As três forças são cerca de quarenta linhas.

<br>

## Rodando localmente

```bash
git clone https://github.com/Benedito-Dev/BioLuz.git
cd BioLuz
npm install
npm run dev
```

Abre em `localhost:5173`. Para levantar também a função de `/api`, use
`vercel dev` no lugar de `npm run dev`.

### Token do GitHub

Opcional para experimentar, necessário para uso contínuo:

| | Requisições por hora | Repositórios por hora |
|---|---|---|
| **Sem token** | 60 | ~1 |
| **Com token** | 5.000 | ~120 |

```bash
cp .env.example .env.local
```

Gere em **Settings → Developer settings → Personal access tokens → Tokens
(classic)**, com o escopo **`public_repo`** apenas, e cole em `.env.local`.

> O arquivo está no `.gitignore` e o token só é lido no servidor.
> Ele nunca chega ao navegador.

<br>

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Typecheck e build de produção |
| `npm run preview` | Serve o build local, como em produção |
| `npm run check` | Typecheck do front e do back |

<br>

## Estrutura

```
BioLuz/
├── api/                 back — funções serverless
│   ├── github.ts        chamadas à API do GitHub
│   ├── quadros.ts       escolha dos shas, corte de 500
│   └── repo.ts          handler de GET /api/repo
├── compartilhado/
│   └── tipos.ts         o contrato entre os dois lados
└── src/                 front — canvas e física
    ├── grafo.ts         caminhos viram nós e arestas
    ├── fisica.ts        as três forças
    ├── render.ts        desenho
    └── main.ts          o loop
```

Back e front na mesma pasta, no modelo da Vercel: `/api` vira função
serverless, o resto vira estático no CDN. Mesmo repositório, mesmo deploy,
máquinas diferentes em produção. `compartilhado/tipos.ts` existe para que o
formato dos dados tenha **uma** definição — se cada lado tivesse a sua, elas
divergiriam e o bug seria silencioso.

<br>

## Roteiro

| | Etapa | Entrega |
|---|---|---|
| ✅ | **0 · Esqueleto** | Vite, TypeScript, canvas em tela cheia |
| 🔨 | **1 · Os dados** | `/api/repo` devolve 40 quadros, sem nenhum pixel |
| | **2 · A física** | as três forças, bolinhas cinzas que se organizam |
| | **3 · O tempo** | **o repositório cresce do nada até hoje** |
| | **4 · A beleza** | cor por extensão, brilho ao nascer, rastro |
| | **5 · A porta** | campo de URL, linha do tempo, tratamento de erro |
| | **6 · O ar** | deploy e GIF |

A Etapa 3 é o projeto. Sem o tempo passando, isto vira um gráfico bonito — que
é exatamente o que ninguém lembra.

<br>

---

<div align="center">
<sub>Construído com Canvas 2D e três forças.</sub>
</div>
