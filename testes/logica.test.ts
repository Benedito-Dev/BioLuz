// Testa a logica pura, sem tocar na rede. Roda com: node --test
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import {
  analisarRepo,
  decidirElenco,
  escolherCommits,
} from '../api/quadros.ts'
import type { CommitBruto } from '../api/github.ts'

test('analisarRepo aceita os tres formatos que a pessoa cola', () => {
  const esperado = { dono: 'facebook', nome: 'react' }
  assert.deepEqual(analisarRepo('facebook/react'), esperado)
  assert.deepEqual(analisarRepo('https://github.com/facebook/react'), esperado)
  assert.deepEqual(analisarRepo('https://github.com/facebook/react.git'), esperado)
  assert.deepEqual(analisarRepo('  facebook/react/  '), esperado)
})

test('analisarRepo recusa entrada invalida antes de gastar requisicao', () => {
  assert.equal(analisarRepo(''), null)
  assert.equal(analisarRepo('facebook'), null)
  assert.equal(analisarRepo('a/b/c'), null)
  assert.equal(analisarRepo('face book/react'), null)
})

function commitsFalsos(n: number): CommitBruto[] {
  // Como a API devolve: do mais NOVO para o mais VELHO.
  return Array.from({ length: n }, (_, i) => ({
    sha: `sha${n - 1 - i}`,
    data: new Date(2020, 0, n - i).toISOString(),
    autor: `autor${i % 3}`,
  }))
}

test('escolherCommits devolve em ordem cronologica, nao invertida', () => {
  const escolhidos = escolherCommits(commitsFalsos(100), 40)
  assert.equal(escolhidos[0]!.sha, 'sha0', 'primeiro quadro = commit mais velho')
  assert.equal(escolhidos.at(-1)!.sha, 'sha99', 'ultimo quadro = commit mais novo')

  const datas = escolhidos.map((c) => Date.parse(c.data))
  const ordenadas = [...datas].sort((a, b) => a - b)
  assert.deepEqual(datas, ordenadas, 'datas sobem do inicio ao fim')
})

test('escolherCommits inclui as duas pontas e nao repete', () => {
  const escolhidos = escolherCommits(commitsFalsos(800), 40)
  assert.equal(escolhidos.length, 40)
  assert.equal(new Set(escolhidos.map((c) => c.sha)).size, 40, 'sem repetidos')
})

test('escolherCommits usa todos quando ha menos que o alvo', () => {
  const escolhidos = escolherCommits(commitsFalsos(7), 40)
  assert.equal(escolhidos.length, 7, 'nao inventa quadros')
  assert.equal(escolhidos[0]!.sha, 'sha0')
})

test('decidirElenco nao corta repositorio pequeno', () => {
  const { permitidos, truncado } = decidirElenco([[{ caminho: 'a.ts', tamanho: 10 }]], 500)
  assert.equal(permitidos, null)
  assert.equal(truncado, false)
})

test('decidirElenco respeita o teto e marca truncado', () => {
  const arvore = Array.from({ length: 600 }, (_, i) => ({
    caminho: `arquivo${i}.ts`,
    tamanho: i,
  }))
  const { permitidos, truncado } = decidirElenco([arvore], 500)
  assert.equal(truncado, true)
  assert.equal(permitidos!.size, 500)
})

test('decidirElenco prioriza tamanho, com presenca como desempate', () => {
  // Priorizar persistencia achataria a animacao: sobrariam os arquivos
  // presentes em todos os quadros e o repositorio nasceria pronto.
  const arvores = [
    Array.from({ length: 400 }, (_, i) => ({
      caminho: `antigo${i}.ts`,
      tamanho: 1,
    })),
    Array.from({ length: 400 }, (_, i) => ({
      caminho: `grande${i}.ts`,
      tamanho: 10_000 + i,
    })),
  ]
  const { permitidos } = decidirElenco(arvores, 500)
  const grandes = [...permitidos!].filter((c) => c.startsWith('grande')).length
  assert.equal(grandes, 400, 'todos os grandes entram')

  // Mesmo tamanho: quem atravessa mais quadros ganha o desempate.
  const persistente = { caminho: 'persistente.ts', tamanho: 500 }
  const empate = [
    [persistente, ...Array.from({ length: 600 }, (_, i) => ({ caminho: `x${i}.ts`, tamanho: 500 }))],
    [persistente],
    [persistente],
  ]
  const r = decidirElenco(empate, 500)
  assert.ok(r.permitidos!.has('persistente.ts'), 'desempate por presenca')
})

test('decidirElenco nao deixa nenhum quadro vazio', () => {
  // Reproduz o caso real do Linux: um quadro do meio caiu num commit de
  // projeto mesclado depois, cujos arquivos sumiram da arvore atual.
  const atuais = Array.from({ length: 600 }, (_, i) => ({
    caminho: `atual${i}.ts`,
    tamanho: 1000 + i,
  }))
  const orfaos = Array.from({ length: 20 }, (_, i) => ({
    caminho: `mesclado/antigo${i}.c`,
    tamanho: 5,
  }))
  const arvores = [atuais, orfaos, atuais]

  const { permitidos } = decidirElenco(arvores, 500)
  assert.ok(permitidos !== null)
  for (const [i, arvore] of arvores.entries()) {
    const visiveis = arvore.filter((a) => permitidos!.has(a.caminho))
    assert.ok(visiveis.length > 0, `quadro ${i} ficou vazio`)
  }
  assert.ok(permitidos!.size <= 500, 'o teto continua respeitado')
})

test('o elenco e decidido uma vez e vale para todos os quadros', () => {
  // Um arquivo pequeno no inicio que virou grande no fim precisa estar
  // presente desde o primeiro quadro — senao ele pisca.
  const inicial = [{ caminho: 'cresceu.ts', tamanho: 1 }]
  const finalArvore = Array.from({ length: 600 }, (_, i) => ({
    caminho: i === 0 ? 'cresceu.ts' : `outro${i}.ts`,
    tamanho: i === 0 ? 9999 : i,
  }))
  const { permitidos } = decidirElenco([inicial, finalArvore], 500)

  const visiveis = inicial.filter((a) => permitidos!.has(a.caminho))
  assert.equal(visiveis.length, 1, 'nao pisca entre quadros')
})
