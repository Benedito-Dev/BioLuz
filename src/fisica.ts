// As tres forcas. E o coracao do projeto.
//
//   1. Repulsao  — todo par proximo se empurra (inverso do quadrado)
//   2. Mola      — aresta filho->pai puxa os dois ao comprimento de repouso
//   3. Gravidade — atracao fraca de todos para o centro
//
// Sem repulsao  -> tudo vira um borrao no centro.
// Sem mola      -> some a estrutura de pastas.
// Sem gravidade -> o grafo incha e sai do centro. (A spec diz que ele "foge
//                  da tela"; medindo, ele estabiliza — a repulsao cai com o
//                  quadrado da distancia e as molas seguram. Mas o raio
//                  cresce ~60%, o que estoura a borda em tela menor.)

import type { No } from '../compartilhado/tipos.ts'

export type Constantes = {
  repulsao: number
  /** Distancia minima no denominador: sem isso a forca explode ao colidir. */
  distanciaMinima: number
  /** Alem disso, a repulsao e ignorada — e o que o spatial hash acelera. */
  alcance: number
  mola: number
  comprimentoRepouso: number
  gravidade: number
  amortecimento: number
  /** Teto de velocidade: impede que um empurrao lance o no para longe. */
  velocidadeMaxima: number
}

/**
 * Calibrado por varredura (testes/calibra.ts), medindo com 460 nos quanto da
 * tela o grafo ocupa contra quantos nos encostam na borda:
 *
 *   grav 0.0016 rep 900  -> 58% da tela,  5 nos na borda
 *   grav 0.0012 rep 1100 -> 64% da tela,  6 nos na borda   <- escolhido
 *   grav 0.0006 rep 1300 -> 99% da tela, 50 nos na borda
 *
 * Espalhar mais e tentador, mas encher a borda de nos presos fica feio.
 */
export const PADRAO: Constantes = {
  repulsao: 1100,
  distanciaMinima: 4,
  alcance: 90,
  mola: 0.012,
  comprimentoRepouso: 30,
  gravidade: 0.0012,
  amortecimento: 0.85,
  velocidadeMaxima: 8,
}

/**
 * Grade espacial: cada no cai numa celula, e a repulsao so consulta a propria
 * celula e as oito vizinhas. Sem isso a repulsao e O(n^2) — com 500 nos sao
 * 125 mil pares por passo, o que nao cabe em 60 fps.
 */
class Grade {
  private readonly celulas = new Map<number, No[]>()
  private readonly lado: number

  constructor(lado: number) {
    this.lado = lado
  }

  private chave(cx: number, cy: number): number {
    // Empacota duas coordenadas num numero, com deslocamento para aceitar
    // valores negativos (nos podem sair da tela durante a acomodacao).
    return (cx + 4096) * 16384 + (cy + 4096)
  }

  inserir(nos: Iterable<No>): void {
    this.celulas.clear()
    for (const no of nos) {
      const k = this.chave(
        Math.floor(no.x / this.lado),
        Math.floor(no.y / this.lado),
      )
      const celula = this.celulas.get(k)
      if (celula) celula.push(no)
      else this.celulas.set(k, [no])
    }
  }

  /** Os nos da celula do ponto e das oito ao redor. */
  vizinhos(no: No, saida: No[]): No[] {
    saida.length = 0
    const cx = Math.floor(no.x / this.lado)
    const cy = Math.floor(no.y / this.lado)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const celula = this.celulas.get(this.chave(cx + dx, cy + dy))
        if (celula) saida.push(...celula)
      }
    }
    return saida
  }
}

export class Simulacao {
  private readonly grade: Grade
  private readonly buffer: No[] = []
  readonly constantes: Constantes

  constructor(constantes: Constantes = PADRAO) {
    this.constantes = constantes
    // A celula tem o tamanho do alcance: assim as nove celulas cobrem tudo
    // que pode influenciar o no, e nada alem.
    this.grade = new Grade(constantes.alcance)
  }

  /**
   * Um passo de simulacao. O passo de tempo e FIXO — usar deltaTime real
   * faz a simulacao tremer quando um frame atrasa, e o efeito e cumulativo.
   */
  passo(nos: Map<string, No>, largura: number, altura: number): void {
    const k = this.constantes
    const cx = largura / 2
    const cy = altura / 2

    this.grade.inserir(nos.values())

    // 1. Repulsao — cada par visitado UMA vez, com a forca aplicada nos dois.
    // Visitar duas vezes (uma por no) dobraria o custo sem mudar o resultado.
    let indice = 0
    for (const no of nos.values()) {
      no.ordem = indice++
    }

    const alcance2 = k.alcance * k.alcance
    for (const no of nos.values()) {
      const vizinhos = this.grade.vizinhos(no, this.buffer)
      for (const outro of vizinhos) {
        // So o de indice menor processa o par.
        if (outro.ordem <= no.ordem) continue

        let dx = no.x - outro.x
        let dy = no.y - outro.y
        let d2 = dx * dx + dy * dy

        if (d2 > alcance2) continue

        // Nos exatamente sobrepostos: empurra numa direcao qualquer, senao
        // a divisao por zero trava os dois para sempre.
        if (d2 < 0.0001) {
          const a = Math.random() * Math.PI * 2
          dx = Math.cos(a)
          dy = Math.sin(a)
          d2 = 1
        }

        const d = Math.sqrt(d2)
        const efetiva = Math.max(d, k.distanciaMinima)
        // Inverso do quadrado, dividido de novo por d para normalizar (dx,dy).
        const forca = k.repulsao / (efetiva * efetiva * d)

        no.vx += dx * forca
        no.vy += dy * forca
        outro.vx -= dx * forca
        outro.vy -= dy * forca
      }
    }

    // 2. Mola — cada aresta filho->pai, aplicada nos dois lados.
    for (const no of nos.values()) {
      if (no.pai === null) continue
      const pai = nos.get(no.pai)
      if (!pai) continue

      const dx = pai.x - no.x
      const dy = pai.y - no.y
      const d = Math.hypot(dx, dy) || 0.0001
      const deslocamento = d - k.comprimentoRepouso
      const forca = (deslocamento * k.mola) / d

      no.vx += dx * forca
      no.vy += dy * forca
      pai.vx -= dx * forca
      pai.vy -= dy * forca
    }

    // 3. Gravidade — fraca, so para o grafo nao fugir da tela.
    for (const no of nos.values()) {
      no.vx += (cx - no.x) * k.gravidade
      no.vy += (cy - no.y) * k.gravidade
    }

    // Integracao: amortece, limita e move.
    for (const no of nos.values()) {
      no.vx *= k.amortecimento
      no.vy *= k.amortecimento

      const v = Math.hypot(no.vx, no.vy)
      if (v > k.velocidadeMaxima) {
        const escala = k.velocidadeMaxima / v
        no.vx *= escala
        no.vy *= escala
      }

      no.x += no.vx
      no.y += no.vy

      // O raio persegue o alvo: nascimento cresce, morte encolhe (Etapa 3).
      no.raio += (no.raioAlvo - no.raio) * 0.12
      if (no.brilho > 0) no.brilho = Math.max(0, no.brilho - 0.02)
    }
  }

  /** Energia cinetica media — mede se a simulacao ja assentou. */
  energia(nos: Map<string, No>): number {
    if (nos.size === 0) return 0
    let soma = 0
    for (const no of nos.values()) soma += no.vx * no.vx + no.vy * no.vy
    return soma / nos.size
  }
}
