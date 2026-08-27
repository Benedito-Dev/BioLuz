// A unica funcao que muda o mundo entre uma foto e a proxima.
//
// caminho em `para` e nao em `de`  -> nasce, com raio 0 e brilho 1
// caminho em `de` e nao em `para`  -> morre, com fade de 500 ms
// pastas sao criadas implicitamente a partir dos segmentos do caminho

import type { No, Quadro } from '../compartilhado/tipos.ts'
import { criarNo, dimensionar } from './grafo.ts'

export const DURACAO_MORTE = 500

/** Todos os prefixos de pasta de um caminho, do mais raso ao mais fundo. */
function ancestrais(caminho: string): string[] {
  const partes = caminho.split('/')
  const pastas: string[] = []
  for (let i = 1; i < partes.length; i++) {
    pastas.push(partes.slice(0, i).join('/'))
  }
  return pastas
}

/** Tudo que deve existir para esta lista de arquivos: os proprios e as pastas. */
function universo(arquivos: string[]): Set<string> {
  const tudo = new Set<string>()
  for (const arquivo of arquivos) {
    for (const pasta of ancestrais(arquivo)) tudo.add(pasta)
    tudo.add(arquivo)
  }
  return tudo
}

export type Transicao = {
  nasceram: number
  morreram: number
}

/**
 * Aplica a diferenca entre dois quadros ao mundo.
 *
 * O no nasce na posicao do PAI, nao no centro. Nascer no centro faria o
 * arquivo atravessar a tela inteira ate seu bairro, o que fica feio; nascendo
 * no pai ele brota de dentro do bairro e e empurrado para fora pelas forcas.
 */
export function transicao(
  nos: Map<string, No>,
  de: Quadro | null,
  para: Quadro,
  indiceQuadro: number,
  largura: number,
  altura: number,
  agora: number = performance.now(),
  aleatorio: () => number = Math.random,
): Transicao {
  const antes = de ? universo(de.arquivos) : new Set<string>()
  const depois = universo(para.arquivos)

  let nasceram = 0
  let morreram = 0

  // Nascimentos — pastas antes dos arquivos, para o filho achar o pai
  // ja posicionado e brotar de dentro do bairro.
  const novos = [...depois]
    .filter((caminho) => !nos.has(caminho))
    .sort((a, b) => a.split('/').length - b.split('/').length)

  for (const caminho of novos) {
    const corte = caminho.lastIndexOf('/')
    const caminhoPai = corte === -1 ? null : caminho.slice(0, corte)
    const pai = caminhoPai ? nos.get(caminhoPai) : undefined

    // Sem pai (raiz) cai perto do centro; com pai, brota junto dele.
    const baseX = pai ? pai.x : largura / 2
    const baseY = pai ? pai.y : altura / 2
    const angulo = aleatorio() * Math.PI * 2
    const raio = pai ? 6 + aleatorio() * 10 : aleatorio() * 40

    const ehPasta = !para.arquivos.includes(caminho)
    nos.set(
      caminho,
      criarNo(
        caminho,
        ehPasta ? 'pasta' : 'arquivo',
        indiceQuadro,
        baseX + Math.cos(angulo) * raio,
        baseY + Math.sin(angulo) * raio,
      ),
    )
    nasceram++
  }

  // Mortes — marca para o fade; a remocao acontece em limparMortos().
  for (const caminho of antes) {
    if (depois.has(caminho)) continue
    const no = nos.get(caminho)
    if (!no || no.morrendoDesde !== null) continue
    no.morrendoDesde = agora
    no.raioAlvo = 0
    morreram++
  }

  // Um no marcado que reapareceu (arquivo restaurado) volta a viver.
  for (const caminho of depois) {
    const no = nos.get(caminho)
    if (no?.morrendoDesde != null) {
      no.morrendoDesde = null
      no.brilho = 1
    }
  }

  dimensionar(nos)
  return { nasceram, morreram }
}

/**
 * Remove quem terminou o fade. Separado da transicao porque o fade dura
 * 500 ms — mais que um frame — e precisa ser verificado a cada quadro.
 */
export function limparMortos(
  nos: Map<string, No>,
  agora: number = performance.now(),
): number {
  let removidos = 0
  for (const [caminho, no] of nos) {
    if (no.morrendoDesde === null) continue
    if (agora - no.morrendoDesde < DURACAO_MORTE) continue
    nos.delete(caminho)
    removidos++
  }
  return removidos
}

/** Opacidade de um no: 1 enquanto vivo, decaindo a 0 durante a morte. */
export function opacidade(no: No, agora: number = performance.now()): number {
  if (no.morrendoDesde === null) return 1
  const passou = agora - no.morrendoDesde
  return Math.max(0, 1 - passou / DURACAO_MORTE)
}
