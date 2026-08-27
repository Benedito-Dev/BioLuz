// Compara spatial hash contra forca bruta O(n^2), para provar que a
// otimizacao e necessaria e nao invencao.
import { montarGrafo } from '../src/grafo.ts'
import { PADRAO, Simulacao } from '../src/fisica.ts'
import type { No } from '../compartilhado/tipos.ts'

const L = 1200, A = 800
const caminhos = (n: number) =>
  Array.from({ length: n }, (_, i) => `p${i % 8}/a${i}.ts`)

function repulsaoBruta(nos: Map<string, No>): void {
  const k = PADRAO
  const lista = [...nos.values()]
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i]!, b = lista[j]!
      const dx = a.x - b.x, dy = a.y - b.y
      const d2 = dx * dx + dy * dy
      if (d2 > k.alcance * k.alcance || d2 < 0.0001) continue
      const d = Math.sqrt(d2)
      const ef = Math.max(d, k.distanciaMinima)
      const f = k.repulsao / (ef * ef * d)
      a.vx += dx * f; a.vy += dy * f
      b.vx -= dx * f; b.vy -= dy * f
    }
  }
}

console.log('nos     hash(ms)   bruta(ms)   ganho    orcamento 16ms')
console.log('-'.repeat(60))
for (const n of [300, 500, 800, 1500]) {
  const nosH = montarGrafo(caminhos(n), L, A)
  const sim = new Simulacao()
  let t = performance.now()
  for (let i = 0; i < 200; i++) sim.passo(nosH, L, A)
  const mh = (performance.now() - t) / 200

  const nosB = montarGrafo(caminhos(n), L, A)
  t = performance.now()
  for (let i = 0; i < 200; i++) repulsaoBruta(nosB)
  const mb = (performance.now() - t) / 200

  console.log(
    String(nosH.size).padEnd(8) +
    mh.toFixed(2).padEnd(11) +
    mb.toFixed(2).padEnd(12) +
    (mb / mh).toFixed(1).padEnd(9) + 'x' +
    (mh < 16 ? '  cabe' : '  NAO CABE'),
  )
}
