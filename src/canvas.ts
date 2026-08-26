/** Prepara o canvas para tela cheia e alta resolucao (retina). */
export function montarCanvas(id: string): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  largura: () => number
  altura: () => number
} {
  const canvas = document.querySelector<HTMLCanvasElement>(`#${id}`)
  if (!canvas) throw new Error(`canvas #${id} nao encontrado`)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('contexto 2d indisponivel')

  let largura = 0
  let altura = 0

  function ajustar(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    largura = window.innerWidth
    altura = window.innerHeight
    canvas!.width = Math.floor(largura * dpr)
    canvas!.height = Math.floor(altura * dpr)
    // Desenhamos em coordenadas CSS; o dpr some daqui pra frente.
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  ajustar()
  window.addEventListener('resize', ajustar)

  return { canvas, ctx, largura: () => largura, altura: () => altura }
}
