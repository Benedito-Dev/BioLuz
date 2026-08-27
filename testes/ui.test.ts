// Testa as funcoes puras da interface. A classe Interface precisa de DOM,
// entao fica para a verificacao no navegador.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { autoresLegiveis, dataLegivel, normalizarEntrada } from '../src/ui.ts'

test('normalizarEntrada aceita os formatos que a pessoa cola', () => {
  const alvo = 'facebook/react'
  assert.equal(normalizarEntrada('facebook/react'), alvo)
  assert.equal(normalizarEntrada('  facebook/react  '), alvo)
  assert.equal(normalizarEntrada('https://github.com/facebook/react'), alvo)
  assert.equal(normalizarEntrada('http://github.com/facebook/react'), alvo)
  assert.equal(normalizarEntrada('https://www.github.com/facebook/react'), alvo)
  assert.equal(normalizarEntrada('https://github.com/facebook/react.git'), alvo)
  assert.equal(normalizarEntrada('https://github.com/facebook/react/'), alvo)
})

test('normalizarEntrada recusa o que nao e repositorio', () => {
  assert.equal(normalizarEntrada(''), null)
  assert.equal(normalizarEntrada('facebook'), null)
  assert.equal(normalizarEntrada('a/b/c'), null)
  assert.equal(normalizarEntrada('espaco no meio/repo'), null)
  assert.equal(normalizarEntrada('https://gitlab.com/a/b'), null)
})

test('normalizarEntrada casa com o back, para nao divergirem', async () => {
  const { analisarRepo } = await import('../api/quadros.ts')
  const casos = [
    'facebook/react',
    'https://github.com/vercel/ms.git',
    'a/b/c',
    'semBarra',
    '',
  ]
  for (const caso of casos) {
    const frente = normalizarEntrada(caso)
    const fundo = analisarRepo(caso)
    const fundoComo = fundo ? `${fundo.dono}/${fundo.nome}` : null
    assert.equal(frente, fundoComo, `divergiu em "${caso}"`)
  }
})

test('dataLegivel escreve por extenso em portugues', () => {
  const texto = dataLegivel('2015-03-12T10:30:00Z')
  assert.match(texto, /2015/)
  assert.match(texto, /mar/i, 'tem o mes por extenso')
})

test('dataLegivel nao quebra com entrada estranha', () => {
  assert.equal(typeof dataLegivel('nao-e-data'), 'string')
  assert.ok(dataLegivel('nao-e-data').length > 0)
})

test('autoresLegiveis resume listas longas', () => {
  assert.equal(autoresLegiveis([]), '')
  assert.equal(autoresLegiveis(['ana']), 'ana')
  assert.equal(autoresLegiveis(['ana', 'bruno']), 'ana, bruno')
  assert.equal(
    autoresLegiveis(['ana', 'bruno', 'carla', 'davi']),
    'ana, bruno e mais 2',
  )
})
