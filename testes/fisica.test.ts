// Testa o grafo e as tres forcas, sem navegador.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { montarGrafo } from '../src/grafo.ts'
import { PADRAO, Simulacao } from '../src/fisica.ts'

const L = 1200
const A = 800

/**
 * Gerador deterministico: montarGrafo espalha os nos ao acaso, e um teste
 * de fisica que depende disso passa cinco vezes e falha na sexta.
 */
function semente(valor = 42): () => number {
  let estado = valor
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296
    return estado / 4294967296
  }
}

test('montarGrafo cria as pastas implicitamente', () => {
  const nos = montarGrafo(['src/api/user.js'], L, A, 0, semente())
  assert.deepEqual(
    [...nos.keys()].sort(),
    ['src', 'src/api', 'src/api/user.js'],
  )
  assert.equal(nos.get('src')!.pai, null)
  assert.equal(nos.get('src/api')!.pai, 'src')
  assert.equal(nos.get('src/api/user.js')!.pai, 'src/api')
  assert.equal(nos.get('src/api')!.tipo, 'pasta')
  assert.equal(nos.get('src/api/user.js')!.tipo, 'arquivo')
})

test('montarGrafo nao duplica pastas compartilhadas', () => {
  const nos = montarGrafo(['src/a.ts', 'src/b.ts', 'src/sub/c.ts'], L, A, 0, semente())
  assert.equal(nos.size, 5, 'src, src/sub e os tres arquivos')
})

test('nos nascem com raio zero e crescem', () => {
  const nos = montarGrafo(['a.ts'], L, A, 0, semente())
  const no = nos.get('a.ts')!
  assert.equal(no.raio, 0, 'nasce invisivel')
  assert.ok(no.raioAlvo > 0)

  const sim = new Simulacao()
  for (let i = 0; i < 60; i++) sim.passo(nos, L, A)
  assert.ok(no.raio > no.raioAlvo * 0.9, 'cresceu ate perto do alvo')
})

test('a simulacao assenta: a energia cai e fica baixa', () => {
  const caminhos = Array.from({ length: 200 }, (_, i) => `p${i % 6}/a${i}.ts`)
  const nos = montarGrafo(caminhos, L, A, 0, semente())
  const sim = new Simulacao()

  for (let i = 0; i < 60; i++) sim.passo(nos, L, A)
  const cedo = sim.energia(nos)
  for (let i = 0; i < 800; i++) sim.passo(nos, L, A)
  const tarde = sim.energia(nos)

  assert.ok(tarde < cedo, `energia caiu (${cedo} -> ${tarde})`)
  assert.ok(tarde < 0.2, `assentou (${tarde})`)
})

test('sem repulsao tudo vira um borrao no centro', () => {
  const caminhos = Array.from({ length: 100 }, (_, i) => `p${i % 4}/a${i}.ts`)
  const nos = montarGrafo(caminhos, L, A, 0, semente())
  const sim = new Simulacao({ ...PADRAO, repulsao: 0 })
  for (let i = 0; i < 600; i++) sim.passo(nos, L, A)

  let maxD = 0
  for (const no of nos.values()) {
    maxD = Math.max(maxD, Math.hypot(no.x - L / 2, no.y - A / 2))
  }
  assert.ok(maxD < 80, `amontoado no centro (raio ${maxD.toFixed(0)})`)
})

test('sem gravidade o grafo incha e descentraliza', () => {
  // A spec diz "sem gravidade o grafo foge da tela". Medindo, isso nao se
  // confirma: a repulsao cai com o quadrado da distancia e as molas seguram
  // tudo, entao o layout estabiliza. O efeito real da gravidade e manter o
  // grafo COMPACTO e centrado — sem ela o raio cresce ~60% (271px -> 441px),
  // o que estoura a borda em telas menores ou com mais nos.
  const caminhos = Array.from({ length: 100 }, (_, i) => `p${i % 4}/a${i}.ts`)

  function raioFinal(gravidade: number): number {
    const nos = montarGrafo(caminhos, L, A, 0, semente())
    const sim = new Simulacao({ ...PADRAO, gravidade })
    for (let i = 0; i < 1200; i++) sim.passo(nos, L, A)
    let maior = 0
    for (const no of nos.values()) {
      maior = Math.max(maior, Math.hypot(no.x - L / 2, no.y - A / 2))
    }
    return maior
  }

  const com = raioFinal(PADRAO.gravidade)
  const sem = raioFinal(0)
  assert.ok(sem > com * 1.3, `sem gravidade incha (${com.toFixed(0)} -> ${sem.toFixed(0)}px)`)
})

test('com as tres forcas o grafo fica na tela e espalhado', () => {
  const caminhos = Array.from({ length: 200 }, (_, i) => `p${i % 6}/a${i}.ts`)
  const nos = montarGrafo(caminhos, L, A, 0, semente())
  const sim = new Simulacao()
  for (let i = 0; i < 900; i++) sim.passo(nos, L, A)

  let minX = Infinity, maxX = -Infinity, fora = 0
  for (const no of nos.values()) {
    minX = Math.min(minX, no.x)
    maxX = Math.max(maxX, no.x)
    if (no.x < -50 || no.x > L + 50 || no.y < -50 || no.y > A + 50) fora++
  }
  assert.equal(fora, 0, 'ninguem escapou')
  assert.ok(maxX - minX > 300, `espalhou (${(maxX - minX).toFixed(0)}px)`)
})

test('nos sobrepostos se separam em vez de travar', () => {
  const nos = montarGrafo(['a.ts', 'b.ts'], L, A, 0, semente())
  const [a, b] = [...nos.values()]
  a!.x = 500; a!.y = 400
  b!.x = 500; b!.y = 400

  const sim = new Simulacao()
  for (let i = 0; i < 120; i++) sim.passo(nos, L, A)

  const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
  assert.ok(Number.isFinite(d), 'sem NaN')
  assert.ok(d > 5, `separaram (${d.toFixed(1)}px)`)
})

test('pasta com muitos filhos fica maior', () => {
  const muitos = Array.from({ length: 40 }, (_, i) => `grande/a${i}.ts`)
  const nos = montarGrafo([...muitos, 'pequena/unico.ts'], L, A, 0, semente())
  assert.ok(
    nos.get('grande')!.raioAlvo > nos.get('pequena')!.raioAlvo,
    'o raio reflete o peso da pasta',
  )
})
