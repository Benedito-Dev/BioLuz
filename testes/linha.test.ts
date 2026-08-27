import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { LinhaDoTempo, MS_POR_QUADRO } from '../src/linha.ts'
import type { Quadro } from '../compartilhado/tipos.ts'

function quadros(n: number): Quadro[] {
  return Array.from({ length: n }, (_, i) => ({
    sha: `s${i}`,
    data: `20${String(10 + i).padStart(2, '0')}-01-01T00:00:00Z`,
    autores: [`autor${i}`],
    arquivos: [`a${i}.ts`],
  }))
}

test('avanca um quadro a cada intervalo, nao antes', () => {
  const linha = new LinhaDoTempo(quadros(5), 1000)
  linha.reiniciar(0)

  assert.ok(linha.avancar(0), 'o primeiro sai na hora zero')
  assert.equal(linha.avancar(500), null, 'ainda nao')
  assert.ok(linha.avancar(1000), 'agora sim')
  assert.equal(linha.posicao, 1)
})

test('40 quadros a 3 s dao os 2 minutos da spec', () => {
  const linha = new LinhaDoTempo(quadros(40), MS_POR_QUADRO)
  linha.reiniciar(0)

  let relogio = 0
  let avancos = 0
  while (!linha.terminou) {
    if (linha.avancar(relogio)) avancos++
    relogio += MS_POR_QUADRO
  }
  assert.equal(avancos, 40)
  assert.ok(relogio >= 117_000 && relogio <= 123_000, `~2 min (${relogio} ms)`)
})

test('pausar congela e retomar continua', () => {
  const linha = new LinhaDoTempo(quadros(5), 1000)
  linha.reiniciar(0)
  linha.avancar(0)

  linha.pausar(true)
  assert.equal(linha.avancar(5000), null, 'pausado nao avanca')
  assert.equal(linha.posicao, 0)

  linha.pausar(false)
  assert.ok(linha.avancar(5000), 'retomou')
})

test('reiniciar volta ao comeco', () => {
  const linha = new LinhaDoTempo(quadros(5), 1000)
  linha.reiniciar(0)
  linha.avancar(0)
  linha.avancar(1000)
  assert.equal(linha.posicao, 1)

  linha.reiniciar(9000)
  assert.equal(linha.posicao, -1)
  assert.equal(linha.atual, null)
  assert.ok(linha.avancar(9000), 'roda de novo do inicio')
})

test('aba em segundo plano: recupera o atraso em vez de ficar parada', () => {
  // O navegador reduz requestAnimationFrame a ~1 fps fora de foco.
  const linha = new LinhaDoTempo(quadros(40), 1000)
  linha.reiniciar(0)
  linha.avancar(0)

  // Volta 10 segundos depois: deve ter adiantado, nao ficado no quadro 0.
  linha.avancar(10_000)
  assert.ok(linha.posicao > 1, `adiantou (quadro ${linha.posicao})`)
  assert.ok(linha.posicao <= 5, 'sem teleportar para o fim')
})

test('nao passa do ultimo quadro', () => {
  const linha = new LinhaDoTempo(quadros(3), 1000)
  linha.reiniciar(0)
  for (let t = 0; t <= 20_000; t += 1000) linha.avancar(t)

  assert.equal(linha.posicao, 2, 'parou no ultimo')
  assert.ok(linha.terminou)
  assert.equal(linha.avancar(99_000), null)
})

test('fracao anda de 0 a 1 dentro do quadro', () => {
  const linha = new LinhaDoTempo(quadros(5), 1000)
  linha.reiniciar(0)
  linha.avancar(0)

  assert.ok(Math.abs(linha.fracao(0) - 0) < 0.01)
  assert.ok(Math.abs(linha.fracao(500) - 0.5) < 0.01)
  assert.ok(Math.abs(linha.fracao(1000) - 1) < 0.01)
})
