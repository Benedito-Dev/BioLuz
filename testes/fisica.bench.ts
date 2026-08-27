// Mede se a fisica assenta e quanto custa por passo, sem abrir navegador.
import { montarGrafo } from '../src/grafo.ts'
import { PADRAO, Simulacao, type Constantes } from '../src/fisica.ts'

const L = 1200
const A = 800

function caminhosFalsos(quantos: number): string[] {
  const pastas = ['src', 'src/api', 'src/ui', 'src/lib', 'testes', 'docs', 'src/ui/componentes', 'scripts']
  return Array.from({ length: quantos }, (_, i) => {
    const p = pastas[i % pastas.length]!
    return `${p}/arquivo${i}.ts`
  })
}

function medir(quantos: number, k: Constantes = PADRAO) {
  const nos = montarGrafo(caminhosFalsos(quantos), L, A)
  const sim = new Simulacao(k)

  const inicio = performance.now()
  const energias: number[] = []
  for (let i = 0; i < 600; i++) {
    sim.passo(nos, L, A)
    if (i % 60 === 59) energias.push(sim.energia(nos))
  }
  const ms = (performance.now() - inicio) / 600

  // Espalhamento: um raio pequeno demais significa borrao no centro.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  let foraDaTela = 0
  for (const n of nos.values()) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
    if (n.x < 0 || n.x > L || n.y < 0 || n.y > A) foraDaTela++
  }

  return {
    nos: nos.size,
    msPorPasso: ms,
    energiaFinal: energias.at(-1)!,
    energias,
    largura: maxX - minX,
    altura: maxY - minY,
    foraDaTela,
  }
}

console.log('nos    ms/passo   fps    energia final   espalhamento    fora da tela')
console.log('-'.repeat(74))
for (const n of [100, 300, 500, 800]) {
  const r = medir(n)
  const fps = 1000 / r.msPorPasso
  console.log(
    String(r.nos).padEnd(7) +
    r.msPorPasso.toFixed(2).padEnd(11) +
    (fps > 999 ? '>999' : fps.toFixed(0)).padEnd(7) +
    r.energiaFinal.toExponential(2).padEnd(16) +
    `${r.largura.toFixed(0)}x${r.altura.toFixed(0)}`.padEnd(16) +
    String(r.foraDaTela),
  )
}

console.log('')
console.log('curva de energia com 500 nos (a cada 60 passos):')
const r = medir(500)
console.log(r.energias.map((e) => e.toExponential(1)).join('  '))
console.log('')
console.log(r.energiaFinal < 0.05 ? 'ASSENTOU (energia baixa e estavel)' : 'AINDA TREMENDO')
