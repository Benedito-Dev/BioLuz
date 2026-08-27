// Varre combinacoes de constantes e mede espalhamento vs estabilidade.
import { montarGrafo } from '../src/grafo.ts'
import { PADRAO, Simulacao, type Constantes } from '../src/fisica.ts'

const L = 1400, A = 800

function caminhos(n: number): string[] {
  const p = ['src','src/api','src/ui','src/lib','test','docs','src/ui/comp','scripts','bin','lib']
  return Array.from({ length: n }, (_, i) => `${p[i % p.length]}/a${i}.ts`)
}

function medir(k: Constantes, n = 460) {
  const nos = montarGrafo(caminhos(n), L, A)
  const sim = new Simulacao(k)
  for (let i = 0; i < 900; i++) sim.passo(nos, L, A)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, fora = 0
  for (const no of nos.values()) {
    minX = Math.min(minX, no.x); maxX = Math.max(maxX, no.x)
    minY = Math.min(minY, no.y); maxY = Math.max(maxY, no.y)
    if (no.x < 8 || no.x > L - 8 || no.y < 8 || no.y > A - 8) fora++
  }
  // Fracao da tela ocupada pela caixa do grafo.
  const ocupacao = ((maxX - minX) * (maxY - minY)) / (L * A)
  return { ocupacao, fora, energia: sim.energia(nos) }
}

console.log('grav     repouso  repulsao   ocupacao  fora  energia    veredito')
console.log('-'.repeat(72))

const candidatos: Array<Partial<Constantes>> = [
  {},
  { gravidade: 0.0015, comprimentoRepouso: 28 },
  { gravidade: 0.0014, comprimentoRepouso: 28, repulsao: 1000 },
  { gravidade: 0.0013, comprimentoRepouso: 29, repulsao: 1000 },
  { gravidade: 0.0013, comprimentoRepouso: 30, repulsao: 1100 },
  { gravidade: 0.0012, comprimentoRepouso: 28, repulsao: 1000 },
  { gravidade: 0.0012, comprimentoRepouso: 30, repulsao: 1100 },
]

for (const ajuste of candidatos) {
  const k = { ...PADRAO, ...ajuste }
  const r = medir(k)
  // Bom: ocupa boa parte da tela, quase ninguem na borda, energia baixa.
  const bom = r.ocupacao > 0.42 && r.fora <= 6 && r.energia < 0.1
  console.log(
    k.gravidade.toFixed(4).padEnd(9) +
    String(k.comprimentoRepouso).padEnd(9) +
    String(k.repulsao).padEnd(11) +
    (r.ocupacao * 100).toFixed(0).padStart(5) + '%' + '    ' +
    String(r.fora).padEnd(6) +
    r.energia.toExponential(1).padEnd(11) +
    (bom ? 'BOM' : ''),
  )
}
