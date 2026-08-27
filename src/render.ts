// Etapa 3: circulos cinzas, com opacidade para o fade de morte.
// A cor por extensao, o brilho e o rastro chegam na Etapa 4.

import type { No } from '../compartilhado/tipos.ts'
import { opacidade } from './tempo.ts'

export function desenhar(
  ctx: CanvasRenderingContext2D,
  nos: Map<string, No>,
  largura: number,
  altura: number,
  agora: number,
): void {
  ctx.fillStyle = '#07080c'
  ctx.fillRect(0, 0, largura, altura)

  // Arestas primeiro, para ficarem atras das bolinhas.
  ctx.lineWidth = 1
  for (const no of nos.values()) {
    if (no.pai === null) continue
    const pai = nos.get(no.pai)
    if (!pai) continue

    const alfa = Math.min(opacidade(no, agora), opacidade(pai, agora))
    if (alfa <= 0.01) continue

    ctx.strokeStyle = `rgba(150, 150, 170, ${(0.18 * alfa).toFixed(3)})`
    ctx.beginPath()
    ctx.moveTo(no.x, no.y)
    ctx.lineTo(pai.x, pai.y)
    ctx.stroke()
  }

  for (const no of nos.values()) {
    if (no.raio < 0.3) continue
    const alfa = opacidade(no, agora)
    if (alfa <= 0.01) continue

    // O brilho do nascimento clareia o cinza; vira cor na Etapa 4.
    const base = no.tipo === 'pasta' ? 138 : 90
    const tom = Math.round(base + no.brilho * (255 - base))

    ctx.beginPath()
    ctx.arc(no.x, no.y, no.raio, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${tom}, ${tom}, ${tom + 16}, ${alfa.toFixed(3)})`
    ctx.fill()
  }
}

/** Painel de diagnostico — sai na Etapa 4. */
export function desenharDiagnostico(
  ctx: CanvasRenderingContext2D,
  linhas: string[],
): void {
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'left'
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
