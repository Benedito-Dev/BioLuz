// Avanca os quadros no relogio, controlando o ritmo da animacao.

import type { Quadro } from '../compartilhado/tipos.ts'

/** ~3 s por quadro: 40 quadros dao os ~2 min que a spec pede. */
export const MS_POR_QUADRO = 3000

/**
 * Teto de quadros recuperados de uma vez. Voltar para a aba depois de um
 * minuto deve adiantar a animacao, nao teleportar direto para o fim.
 */
const MAXIMO_RECUPERADO = 4

export class LinhaDoTempo {
  private readonly quadros: Quadro[]
  private readonly msPorQuadro: number
  private indice = -1
  private proximoEm = 0
  private pausada = false

  constructor(quadros: Quadro[], msPorQuadro = MS_POR_QUADRO) {
    this.quadros = quadros
    this.msPorQuadro = msPorQuadro
  }

  get atual(): Quadro | null {
    return this.indice >= 0 ? (this.quadros[this.indice] ?? null) : null
  }

  get posicao(): number {
    return this.indice
  }

  get total(): number {
    return this.quadros.length
  }

  get terminou(): boolean {
    return this.indice >= this.quadros.length - 1
  }

  get estaPausada(): boolean {
    return this.pausada
  }

  pausar(valor = !this.pausada): void {
    this.pausada = valor
  }

  reiniciar(agora: number): void {
    this.indice = -1
    this.proximoEm = agora
  }

  /**
   * Devolve o proximo quadro quando chega a hora, ou null.
   * Quem chama aplica a transicao — a linha do tempo nao conhece o mundo.
   *
   * Quando a aba fica em segundo plano o navegador reduz requestAnimationFrame
   * a ~1 fps. Sem tratamento a animacao ficaria PARADA onde estava; aqui ela
   * recupera os quadros perdidos, ate um limite — pular 30 de uma vez seria
   * um salto sem sentido, entao acima disso ela segue do ponto atual.
   */
  avancar(agora: number): { de: Quadro | null; para: Quadro; indice: number } | null {
    if (this.pausada || this.terminou) return null
    if (agora < this.proximoEm) return null

    const atrasadoEm = agora - this.proximoEm
    const perdidos = Math.floor(atrasadoEm / this.msPorQuadro)

    const de = this.atual
    this.indice++

    // Recupera o atraso sem deixar a fila crescer para sempre.
    if (perdidos > 0) {
      this.indice = Math.min(
        this.indice + Math.min(perdidos, MAXIMO_RECUPERADO),
        this.quadros.length - 1,
      )
    }

    this.proximoEm = agora + this.msPorQuadro

    const para = this.quadros[this.indice]
    if (!para) return null
    return { de, para, indice: this.indice }
  }

  /** 0 a 1 dentro do quadro atual — para interpolar a barra de progresso. */
  fracao(agora: number): number {
    if (this.indice < 0) return 0
    const decorrido = this.msPorQuadro - (this.proximoEm - agora)
    return Math.max(0, Math.min(1, decorrido / this.msPorQuadro))
  }
}
