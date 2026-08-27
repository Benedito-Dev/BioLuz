// Roda a animacao inteira com dados reais, medindo o que a tela mostraria.
// Sem navegador: relogio simulado, passo de tempo fixo, 60 fps.
import { readFileSync } from 'node:fs'
try {
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.trim()
  }
} catch {}

const { default: handler } = await import('../api/repo.ts')
const { Simulacao } = await import('../src/fisica.ts')
const { LinhaDoTempo, MS_POR_QUADRO } = await import('../src/linha.ts')
const { transicao, limparMortos } = await import('../src/tempo.ts')
type No = import('../compartilhado/tipos.ts').No
type RespostaRepo = import('../compartilhado/tipos.ts').RespostaRepo

const alvo = process.argv[2] ?? 'expressjs/express'
const L = 1400, A = 800
const MS_FRAME = 1000 / 60

const r = await handler(new Request(`http://x/api/repo?repo=${encodeURIComponent(alvo)}`))
const corpo = (await r.json()) as RespostaRepo
if (!('quadros' in corpo)) { console.log('erro:', corpo); process.exit(1) }

const nos = new Map<string, No>()
const sim = new Simulacao()
const linha = new LinhaDoTempo(corpo.quadros)

let relogio = 0
linha.reiniciar(relogio)

console.log(`${alvo} — ${corpo.quadros.length} quadros, ${MS_POR_QUADRO} ms cada`)
console.log('')
console.log('quadro  data         nos   nasc  morr  energia   ocupacao  custo/frame')
console.log('-'.repeat(76))

let picoNos = 0
let piorCusto = 0
const custos: number[] = []

while (!linha.terminou || linha.posicao < 0) {
  const passo = linha.avancar(relogio)
  if (passo) {
    const t = transicao(nos, passo.de, passo.para, passo.indice, L, A, relogio)
    // Roda os frames deste quadro medindo o custo real.
    let energia = 0
    const inicio = performance.now()
    let frames = 0
    for (let ms = 0; ms < MS_POR_QUADRO; ms += MS_FRAME) {
      limparMortos(nos, relogio + ms)
      sim.passo(nos, L, A)
      frames++
    }
    energia = sim.energia(nos)
    const custo = (performance.now() - inicio) / frames
    custos.push(custo)
    piorCusto = Math.max(piorCusto, custo)
    picoNos = Math.max(picoNos, nos.size)

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nos.values()) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
    }
    const ocupacao = ((maxX - minX) * (maxY - minY)) / (L * A)

    const q = passo.indice + 1
    if (q <= 3 || q % 8 === 0 || q === corpo.quadros.length) {
      console.log(
        String(q).padEnd(8) +
        passo.para.data.slice(0, 10).padEnd(13) +
        String(nos.size).padEnd(6) +
        ('+' + t.nasceram).padEnd(6) +
        ('-' + t.morreram).padEnd(6) +
        energia.toExponential(1).padEnd(10) +
        ((ocupacao * 100).toFixed(0) + '%').padEnd(10) +
        custo.toFixed(2) + ' ms',
      )
    }
  }
  relogio += MS_POR_QUADRO
}

// Deixa assentar e limpa os mortos finais.
for (let i = 0; i < 120; i++) sim.passo(nos, L, A)
limparMortos(nos, relogio + 1000)

const vivos = [...nos.values()].filter((n) => n.morrendoDesde === null).length
const ultimo = corpo.quadros.at(-1)!
const esperados = new Set<string>()
for (const a of ultimo.arquivos) {
  esperados.add(a)
  const partes = a.split('/')
  for (let i = 1; i < partes.length; i++) esperados.add(partes.slice(0, i).join('/'))
}

console.log('')
console.log(`duracao total:   ${(relogio / 1000).toFixed(0)}s`)
console.log(`pico de nos:     ${picoNos}`)
console.log(`custo mediano:   ${custos.sort((a,b)=>a-b)[Math.floor(custos.length/2)]!.toFixed(2)} ms/frame`)
console.log(`pior frame:      ${piorCusto.toFixed(2)} ms  (orcamento 16,7 ms)`)
console.log('')
console.log(`nos vivos ao fim: ${vivos}   esperados: ${esperados.size}`)
console.log(vivos === esperados.size ? 'OK: sem vazamento' : 'VAZOU')
console.log(piorCusto < 16.7 ? 'OK: cabe em 60 fps' : 'ESTOURA o orcamento')
