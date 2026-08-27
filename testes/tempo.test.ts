import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { montarGrafo } from '../src/grafo.ts'
import {
  DURACAO_MORTE,
  limparMortos,
  opacidade,
  transicao,
} from '../src/tempo.ts'
import type { No, Quadro } from '../compartilhado/tipos.ts'

const L = 1200
const A = 800

function semente(valor = 7): () => number {
  let estado = valor
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296
    return estado / 4294967296
  }
}

function quadro(arquivos: string[], data = '2020-01-01T00:00:00Z'): Quadro {
  return { sha: 'x', data, autores: [], arquivos }
}

test('do nada para o primeiro quadro: tudo nasce', () => {
  const nos = new Map<string, No>()
  const r = transicao(nos, null, quadro(['src/a.ts']), 0, L, A, 0, semente())

  assert.equal(r.nasceram, 2, 'src e src/a.ts')
  assert.equal(r.morreram, 0)
  assert.deepEqual([...nos.keys()].sort(), ['src', 'src/a.ts'])
})

test('arquivo novo nasce com raio zero e brilho um', () => {
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['a.ts']), 0, L, A, 0, semente())
  const no = nos.get('a.ts')!
  assert.equal(no.raio, 0, 'invisivel ao nascer')
  assert.equal(no.brilho, 1, 'aceso ao nascer')
  assert.ok(no.raioAlvo > 0, 'vai crescer')
})

test('o no nasce na posicao do PAI, nao no centro', () => {
  // Nascer no centro faria o arquivo atravessar a tela ate seu bairro.
  const nos = montarGrafo(['src/a.ts'], L, A, 0, semente())
  const pai = nos.get('src')!
  pai.x = 100
  pai.y = 700

  transicao(
    nos,
    quadro(['src/a.ts']),
    quadro(['src/a.ts', 'src/novo.ts']),
    1, L, A, 0, semente(),
  )

  const novo = nos.get('src/novo.ts')!
  const distDoPai = Math.hypot(novo.x - pai.x, novo.y - pai.y)
  const distDoCentro = Math.hypot(novo.x - L / 2, novo.y - A / 2)
  assert.ok(distDoPai < 20, `brotou junto do pai (${distDoPai.toFixed(1)}px)`)
  assert.ok(distDoCentro > 100, 'nao nasceu no centro')
})

test('pasta nova nasce antes dos filhos, para o filho achar o pai', () => {
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['a/b/c.ts']), 0, L, A, 0, semente())

  const a = nos.get('a')!
  const ab = nos.get('a/b')!
  const c = nos.get('a/b/c.ts')!
  // Se a ordem estivesse errada, o filho cairia no centro em vez do pai.
  assert.ok(Math.hypot(ab.x - a.x, ab.y - a.y) < 60)
  assert.ok(Math.hypot(c.x - ab.x, c.y - ab.y) < 60)
})

test('arquivo removido e marcado para morrer, nao apagado na hora', () => {
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['a.ts', 'b.ts']), 0, L, A, 0, semente())

  const r = transicao(
    nos, quadro(['a.ts', 'b.ts']), quadro(['a.ts']), 1, L, A, 1000, semente(),
  )

  assert.equal(r.morreram, 1)
  assert.ok(nos.has('b.ts'), 'ainda existe durante o fade')
  assert.equal(nos.get('b.ts')!.morrendoDesde, 1000)
  assert.equal(nos.get('b.ts')!.raioAlvo, 0, 'encolhendo')
})

test('a morte some em 500 ms', () => {
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['a.ts', 'b.ts']), 0, L, A, 0, semente())
  transicao(nos, quadro(['a.ts', 'b.ts']), quadro(['a.ts']), 1, L, A, 1000, semente())
  const b = nos.get('b.ts')!

  assert.equal(opacidade(b, 1000), 1, 'opaco ao comecar a morrer')
  assert.ok(Math.abs(opacidade(b, 1250) - 0.5) < 0.01, 'meio do fade')
  assert.equal(opacidade(b, 1500), 0, 'invisivel ao fim')

  assert.equal(limparMortos(nos, 1400), 0, 'ainda nao')
  assert.equal(limparMortos(nos, 1000 + DURACAO_MORTE), 1, 'agora sim')
  assert.ok(!nos.has('b.ts'), 'removido do mundo')
})

test('arquivo restaurado volta a viver em vez de morrer', () => {
  // Renomear ida e volta, ou reverter um commit, acontece de verdade.
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['a.ts']), 0, L, A, 0, semente())
  transicao(nos, quadro(['a.ts']), quadro([]), 1, L, A, 1000, semente())
  assert.equal(nos.get('a.ts')!.morrendoDesde, 1000)

  transicao(nos, quadro([]), quadro(['a.ts']), 2, L, A, 1200, semente())
  assert.equal(nos.get('a.ts')!.morrendoDesde, null, 'ressuscitou')
  assert.equal(nos.get('a.ts')!.brilho, 1, 'aceso de novo')
})

test('renomear e uma morte e um nascimento', () => {
  // O caminho e a identidade — e visualmente isso fica otimo.
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['velho.ts']), 0, L, A, 0, semente())

  const r = transicao(
    nos, quadro(['velho.ts']), quadro(['novo.ts']), 1, L, A, 1000, semente(),
  )
  assert.equal(r.nasceram, 1)
  assert.equal(r.morreram, 1)
})

test('pasta esvaziada morre junto com os filhos', () => {
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['velha/a.ts', 'fica/b.ts']), 0, L, A, 0, semente())

  transicao(
    nos,
    quadro(['velha/a.ts', 'fica/b.ts']),
    quadro(['fica/b.ts']),
    1, L, A, 1000, semente(),
  )
  assert.ok(nos.get('velha')!.morrendoDesde !== null, 'a pasta morre tambem')
  assert.equal(nos.get('fica')!.morrendoDesde, null, 'a outra continua')
})

test('quadro identico nao mexe em nada', () => {
  const nos = new Map<string, No>()
  transicao(nos, null, quadro(['a.ts', 'b/c.ts']), 0, L, A, 0, semente())
  const antes = nos.size

  const r = transicao(
    nos, quadro(['a.ts', 'b/c.ts']), quadro(['a.ts', 'b/c.ts']),
    1, L, A, 1000, semente(),
  )
  assert.equal(r.nasceram, 0)
  assert.equal(r.morreram, 0)
  assert.equal(nos.size, antes)
})

test('a historia inteira roda sem vazar nos', () => {
  // 40 quadros com arquivos entrando e saindo: ao fim, o mundo deve conter
  // exatamente o ultimo quadro, sem sobra de nenhum morto.
  const nos = new Map<string, No>()
  let anterior: Quadro | null = null
  let relogio = 0

  for (let i = 0; i < 40; i++) {
    const arquivos = Array.from({ length: 20 }, (_, j) => `p${j % 4}/a${i + j}.ts`)
    const atual = quadro(arquivos)
    transicao(nos, anterior, atual, i, L, A, relogio, semente(i + 1))
    relogio += 3000
    limparMortos(nos, relogio)
    anterior = atual
  }

  const vivos = [...nos.values()].filter((n) => n.morrendoDesde === null)
  const esperado = new Set<string>()
  for (const a of anterior!.arquivos) {
    esperado.add(a)
    esperado.add(a.split('/')[0]!)
  }
  assert.equal(vivos.length, esperado.size, 'sem nos vazados')
})
