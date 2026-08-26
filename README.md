# Cidade de Commits

Cole a URL de um repositorio do GitHub e assista o projeto se construir do
nada em cerca de dois minutos: arquivos nascem como bolinhas, pastas se
separam em bairros, o codigo cresce ao longo dos anos.

> Em construcao. Etapa 0 de 6 concluida.

## A decisao de engenharia

Um repositorio nao e reproduzido commit a commit. Sao tiradas **40
fotografias** da arvore de arquivos, espalhadas uniformemente do primeiro ao
ultimo commit — comparar a foto N com a N+1 diz quem nasceu e quem morreu.

|                | Replay commit a commit | 40 snapshots de arvore |
| -------------- | ---------------------- | ---------------------- |
| Requisicoes    | 1 por commit (800+)    | **41 no total**        |
| Limite da API  | estoura                | cabe folgado           |
| Complexidade   | diffs, renomeacoes, merges | comparar dois arrays de string |

A granularidade perdida e invisivel numa animacao de dois minutos.

## Como funciona a cidade

Cada arquivo vivo e uma bolinha ligada por um fio a bolinha da sua pasta, e
tres forcas simples acomodam tudo: **repulsao** entre nos proximos, **mola**
entre filho e pai, e **gravidade** fraca para o centro. A cidade emerge da
estrutura de pastas — ninguem a programa.

## Stack

Canvas 2D puro, TypeScript e Vite no front. Vercel Function no back, com
cache de 24 h. Sem biblioteca de grafo, sem biblioteca de fisica, sem 3D.

## Rodando localmente

```bash
npm install
npm run dev
```

Para levantar tambem a funcao de `/api`, use `vercel dev` no lugar de
`npm run dev`.

### Token do GitHub

Opcional para comecar, necessario para uso continuo: sem token a API do
GitHub permite 60 requisicoes por hora, com token sobem para 5000.

```bash
cp .env.example .env.local
```

Gere um token em **Settings > Developer settings > Personal access tokens >
Tokens (classic)** com o escopo `public_repo`, e cole em `.env.local`. Esse
arquivo esta no `.gitignore` — o token nunca chega ao cliente.

## Scripts

| Comando | O que faz |
| ------- | --------- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck e build de producao |
| `npm run check` | Typecheck do front e do back |
