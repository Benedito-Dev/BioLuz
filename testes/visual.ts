// Roda a animacao inteira e mede o resultado visual: quantas cores
// distintas aparecem, a faixa de raios, e se algo ficou invisivel.
import { readFileSync } from 'node:fs'
try {
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.trim()
  }
} catch {}

const { default: handler } = await import('../api/repo.ts')
const { Simulacao } = await import('../src/fisica.ts')
const { LinhaDoTempo } = await import('../src/linha.ts')
const { transicao, limparMortos } = await import('../src/tempo.ts')
const { corDe, COR_PASTA } = await import('../src/paleta.ts')
type No = import('../compartilhado/tipos.ts').No
type RespostaRepo = import('../compartilhado/tipos.ts').RespostaRepo

const alvo = process.argv[2] ?? 'expressjs/express'
const L = 1400, A = 800

const r = await handler(new Request(`http://x/api/repo?repo=${encodeURIComponent(alvo)}`))
const corpo = (await r.json()) as RespostaRepo

const nos = new Map<string, No>()
const sim = new Simulacao()
const linha = new LinhaDoTempo(corpo.quadros, 3000)
let t = 0
linha.reiniciar(t)

let brilhoMaximoSimultaneo = 0
while (!linha.terminou || linha.posicao < 0) {
  const passo = linha.avancar(t)
  if (passo) {
    transicao(nos, passo.de, passo.para, passo.indice, L, A, t, Math.random, corpo.tamanhos)
    for (let i = 0; i < 180; i++) {
      limparMortos(nos, t + i * 16.7)
      sim.passo(nos, L, A)
      if (i === 0) {
        let acesos = 0
        for (const n of nos.values()) if (n.brilho > 0.5) acesos++
        const fracao = acesos / Math.max(1, nos.size)
        brilhoMaximoSimultaneo = Math.max(brilhoMaximoSimultaneo, fracao)
      }
    }
  }
  t += 3000
}

const porCor = new Map<string, number>()
const raios: number[] = []
let semCor = 0
for (const n of nos.values()) {
  if (n.morrendoDesde !== null) continue
  if (n.tipo !== 'arquivo') continue
  const c = corDe(n.caminho)
  const k = `${c.r},${c.g},${c.b}`
  porCor.set(k, (porCor.get(k) ?? 0) + 1)
  if (k === '107,114,128') semCor++
  raios.push(n.raioAlvo)
}
raios.sort((a, b) => a - b)

console.log(`${alvo} — estado final`)
console.log('')
console.log(`arquivos:          ${raios.length}`)
console.log(`cores distintas:   ${porCor.size}`)
console.log(`sem cor (neutro):  ${semCor}  (${((semCor / raios.length) * 100).toFixed(0)}%)`)
console.log(`raio menor/maior:  ${raios[0]!.toFixed(1)} / ${raios.at(-1)!.toFixed(1)} px`)
console.log(`raio mediano:      ${raios[Math.floor(raios.length / 2)]!.toFixed(1)} px`)
console.log(`cor de pasta:      ${COR_PASTA.r},${COR_PASTA.g},${COR_PASTA.b}`)
console.log(`pico de nos acesos ao mesmo tempo: ${(brilhoMaximoSimultaneo * 100).toFixed(0)}%`)
console.log('')
console.log('cores mais comuns:')
for (const [cor, n] of [...porCor].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`  rgb(${cor})`.padEnd(22) + `${n} arquivos`)
}
console.log('')
const variedadeOk = porCor.size >= 5
const neutroOk = semCor / raios.length < 0.5
const raioOk = raios.at(-1)! > raios[0]! * 1.5
console.log(`variedade de cor: ${variedadeOk ? 'ok' : 'POBRE'}`)
console.log(`maioria colorida: ${neutroOk ? 'ok' : 'MUITO NEUTRO'}`)
console.log(`raio diferencia:  ${raioOk ? 'ok' : 'TODOS IGUAIS'}`)
