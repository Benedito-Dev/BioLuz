// Etapa 2: circulos cinzas e linhas finas, nenhuma cor.
// A cor por extensao, o brilho e o rastro chegam na Etapa 4.

import type { No } from '../compartilhado/tipos.ts'

export function desenhar(
  ctx: CanvasRenderingContext2D,
  nos: Map<string, No>,
  largura: number,
  altura: number,
): void {
  ctx.fillStyle = '#07080c'
  ctx.fillRect(0, 0, largura, altura)

  // Arestas primeiro, para ficarem atras das bolinhas.
  ctx.strokeStyle = 'rgba(150, 150, 170, 0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const no of nos.values()) {
    if (no.pai === null) continue
    const pai = nos.get(no.pai)
    if (!pai) continue
    ctx.moveTo(no.x, no.y)
    ctx.lineTo(pai.x, pai.y)
  }
  ctx.stroke()

  for (const no of nos.values()) {
    if (no.raio < 0.3) continue
    ctx.beginPath()
    ctx.arc(no.x, no.y, no.raio, 0, Math.PI * 2)
    ctx.fillStyle = no.tipo === 'pasta' ? '#8a8aa0' : '#5a5a6e'
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
