// Etapa 4: cor por extensao, brilho ao nascer, rotulo nas pastas grandes,
// e rastro suave em vez de limpar a tela.

import type { No } from '../compartilhado/tipos.ts'
import { COR_PASTA, corDe, type Cor } from './paleta.ts'
import { opacidade } from './tempo.ts'

const FUNDO = { r: 7, g: 8, b: 12 }

/**
 * Quantos filhos uma pasta precisa para ganhar rotulo.
 * Rotular todas vira sopa de letras; so as grandes orientam a leitura.
 */
const FILHOS_PARA_ROTULO = 12

/**
 * Rastro: em vez de limpar a tela, pinta um retangulo semi-opaco por cima.
 * O que estava desenhado desbota aos poucos em vez de sumir, e o movimento
 * ganha cauda. Valor alto demais apaga rapido e perde o efeito; baixo demais
 * deixa borrao permanente.
 */
const OPACIDADE_RASTRO = 0.22

function rgba(cor: Cor, alfa: number): string {
  return `rgba(${cor.r}, ${cor.g}, ${cor.b}, ${alfa.toFixed(3)})`
}

/** Mistura em direcao ao branco — usado pelo brilho do nascimento. */
function clarear(cor: Cor, quanto: number): Cor {
  return {
    r: Math.round(cor.r + (255 - cor.r) * quanto),
    g: Math.round(cor.g + (255 - cor.g) * quanto),
    b: Math.round(cor.b + (255 - cor.b) * quanto),
  }
}

export function desenhar(
  ctx: CanvasRenderingContext2D,
  nos: Map<string, No>,
  largura: number,
  altura: number,
  agora: number,
): void {
  // Rastro, nao clearRect.
  ctx.fillStyle = rgba(FUNDO, OPACIDADE_RASTRO)
  ctx.fillRect(0, 0, largura, altura)

  desenharArestas(ctx, nos, agora)
  desenharNos(ctx, nos, agora)
  // Os rotulos vao na camada de interface: texto sobre rastro vira mancha.
}

function desenharArestas(
  ctx: CanvasRenderingContext2D,
  nos: Map<string, No>,
  agora: number,
): void {
  ctx.lineWidth = 1
  for (const no of nos.values()) {
    if (no.pai === null) continue
    const pai = nos.get(no.pai)
    if (!pai) continue

    const alfa = Math.min(opacidade(no, agora), opacidade(pai, agora))
    if (alfa <= 0.01) continue

    // A aresta puxa um pouco da cor do filho: os bairros ganham tom proprio.
    const cor = no.tipo === 'pasta' ? COR_PASTA : corDe(no.caminho)
    ctx.strokeStyle = rgba(cor, 0.1 * alfa)
    ctx.beginPath()
    ctx.moveTo(no.x, no.y)
    ctx.lineTo(pai.x, pai.y)
    ctx.stroke()
  }
}

function desenharNos(
  ctx: CanvasRenderingContext2D,
  nos: Map<string, No>,
  agora: number,
): void {
  for (const no of nos.values()) {
    if (no.raio < 0.3) continue
    const alfa = opacidade(no, agora)
    if (alfa <= 0.01) continue

    const base = no.tipo === 'pasta' ? COR_PASTA : corDe(no.caminho)
    // Clarear ate 0,85 apagava a cor por completo; 0,45 mantem a identidade
    // do arquivo visivel mesmo no auge do nascimento.
    const cor = no.brilho > 0.01 ? clarear(base, no.brilho * 0.45) : base

    // Halo do nascimento: um circulo maior e translucido em volta.
    if (no.brilho > 0.05) {
      ctx.beginPath()
      ctx.arc(no.x, no.y, no.raio + 5 * no.brilho, 0, Math.PI * 2)
      ctx.fillStyle = rgba(cor, 0.18 * no.brilho * alfa)
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(no.x, no.y, no.raio, 0, Math.PI * 2)
    ctx.fillStyle = rgba(cor, alfa)
    ctx.fill()
  }
}

export function desenharRotulos(
  ctx: CanvasRenderingContext2D,
  nos: Map<string, No>,
  agora: number,
): void {
  const filhos = new Map<string, number>()
  for (const no of nos.values()) {
    if (no.pai === null) continue
    filhos.set(no.pai, (filhos.get(no.pai) ?? 0) + 1)
  }

  ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const no of nos.values()) {
    if (no.tipo !== 'pasta') continue
    if ((filhos.get(no.caminho) ?? 0) < FILHOS_PARA_ROTULO) continue

    const alfa = opacidade(no, agora)
    if (alfa <= 0.01) continue

    // So o ultimo segmento: "src/ui/componentes" vira "componentes".
    const nome = no.caminho.slice(no.caminho.lastIndexOf('/') + 1)
    const y = no.y - no.raio - 8

    // Contorno escuro para o texto sobreviver por cima das bolinhas.
    ctx.lineWidth = 3
    ctx.strokeStyle = rgba(FUNDO, 0.85 * alfa)
    ctx.strokeText(nome, no.x, y)
    ctx.fillStyle = `rgba(215, 220, 240, ${(0.75 * alfa).toFixed(3)})`
    ctx.fillText(nome, no.x, y)
  }
}

/** Painel de diagnostico — some quando a interface da Etapa 5 chegar. */
export function desenharDiagnostico(
  ctx: CanvasRenderingContext2D,
  linhas: string[],
): void {
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#6b6b7b'
  linhas.forEach((linha, i) => ctx.fillText(linha, 16, 24 + i * 16))
}

/** Barra de progresso da historia, no rodape. */
export function desenharProgresso(
  ctx: CanvasRenderingContext2D,
  fracao: number,
  largura: number,
  altura: number,
): void {
  const margem = 16
  const y = altura - margem
  const w = largura - margem * 2

  ctx.fillStyle = 'rgba(150, 150, 170, 0.15)'
  ctx.fillRect(margem, y, w, 2)
  ctx.fillStyle = 'rgba(190, 190, 215, 0.55)'
  ctx.fillRect(margem, y, w * Math.max(0, Math.min(1, fracao)), 2)
}
