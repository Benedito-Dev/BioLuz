// Transforma uma lista de caminhos em nos e arestas.
// "src/api/user.js" gera tres nos: src, src/api, src/api/user.js

import type { No } from '../compartilhado/tipos.ts'

/** Todos os prefixos de pasta de um caminho, do mais raso ao mais fundo. */
function ancestrais(caminho: string): string[] {
  const partes = caminho.split('/')
  const pastas: string[] = []
  for (let i = 1; i < partes.length; i++) {
    pastas.push(partes.slice(0, i).join('/'))
  }
  return pastas
}

function pai(caminho: string): string | null {
  const corte = caminho.lastIndexOf('/')
  return corte === -1 ? null : caminho.slice(0, corte)
}

export function criarNo(
  caminho: string,
  tipo: No['tipo'],
  quadro: number,
  x: number,
  y: number,
): No {
  return {
    caminho,
    tipo,
    pai: pai(caminho),
    x,
    y,
    vx: 0,
    vy: 0,
    nascimento: quadro,
    brilho: 1,
    // Nasce em zero e cresce ate raioAlvo; ver Etapa 3.
    raio: 0,
    raioAlvo: tipo === 'pasta' ? 4 : 3,
    tamanho: 0,
    morrendoDesde: null,
    ordem: 0,
  }
}

/**
 * Monta o mundo a partir de uma lista de caminhos.
 * As pastas sao criadas implicitamente a partir dos segmentos — ninguem
 * precisa declara-las.
 */
export function montarGrafo(
  arquivos: string[],
  largura: number,
  altura: number,
  quadro = 0,
  /** Injetavel para tornar os testes deterministicos. */
  aleatorio: () => number = Math.random,
): Map<string, No> {
  const nos = new Map<string, No>()
  const cx = largura / 2
  const cy = altura / 2

  function garantir(caminho: string, tipo: No['tipo']): void {
    if (nos.has(caminho)) return
    // Comeca perto do centro, com um espalhamento pequeno: as forcas fazem
    // o resto. Espalhar demais deixa a acomodacao lenta e feia.
    const angulo = aleatorio() * Math.PI * 2
    const distancia = aleatorio() * 40
    nos.set(
      caminho,
      criarNo(
        caminho,
        tipo,
        quadro,
        cx + Math.cos(angulo) * distancia,
        cy + Math.sin(angulo) * distancia,
      ),
    )
  }

  for (const arquivo of arquivos) {
    for (const pasta of ancestrais(arquivo)) garantir(pasta, 'pasta')
    garantir(arquivo, 'arquivo')
  }

  dimensionar(nos)
  return nos
}

/**
 * Pasta grande fica maior — o raio vira uma dica visual de peso.
 * Arquivo tem raio proprio, ajustado por tamanho na Etapa 4.
 */
export function dimensionar(nos: Map<string, No>): void {
  const filhos = new Map<string, number>()
  for (const no of nos.values()) {
    if (no.pai === null) continue
    filhos.set(no.pai, (filhos.get(no.pai) ?? 0) + 1)
  }

  for (const no of nos.values()) {
    if (no.tipo !== 'pasta') continue
    const quantos = filhos.get(no.caminho) ?? 0
    no.raioAlvo = 4 + Math.min(10, Math.sqrt(quantos) * 1.8)
  }
}

/** Quantos filhos diretos cada pasta tem. Usado pelos rotulos na Etapa 4. */
export function contarFilhos(nos: Map<string, No>): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const no of nos.values()) {
    if (no.pai === null) continue
    contagem.set(no.pai, (contagem.get(no.pai) ?? 0) + 1)
  }
  return contagem
}
