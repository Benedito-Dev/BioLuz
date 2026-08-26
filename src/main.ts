import { montarCanvas } from './canvas.ts'

const { ctx, largura, altura } = montarCanvas('cidade')

// Etapa 0 — prova de vida. O loop existe, o canvas ocupa a tela,
// as coordenadas estao corretas em qualquer densidade de pixel.
// A partir da Etapa 2 este loop roda a fisica e o render de verdade.
function quadro(): void {
  ctx.fillStyle = '#07080c'
  ctx.fillRect(0, 0, largura(), altura())

  ctx.fillStyle = '#6b6b7b'
  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    `Cidade de Commits — etapa 0 · ${largura()}x${altura()}`,
    largura() / 2,
    altura() / 2,
  )

  requestAnimationFrame(quadro)
}

requestAnimationFrame(quadro)
