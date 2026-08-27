import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { COR_PASTA, corDe, extensoesConhecidas } from '../src/paleta.ts'
import { raioPorTamanho } from '../src/grafo.ts'

test('a cor vem da extensao, nao do caminho', () => {
  const a = corDe('src/api/user.ts')
  const b = corDe('outro/lugar/completamente/diferente.ts')
  assert.deepEqual(a, b, 'mesma extensao, mesma cor')
})

test('familias diferentes tem cores diferentes', () => {
  const ts = corDe('a.ts')
  const css = corDe('a.css')
  const py = corDe('a.py')
  assert.notDeepEqual(ts, css)
  assert.notDeepEqual(ts, py)
  assert.notDeepEqual(css, py)
})

test('a mesma familia compartilha a cor', () => {
  assert.deepEqual(corDe('a.ts'), corDe('a.tsx'))
  assert.deepEqual(corDe('a.js'), corDe('a.mjs'))
  assert.deepEqual(corDe('a.scss'), corDe('a.css'))
})

test('extensao desconhecida cai no neutro, nunca invisivel', () => {
  const cor = corDe('a.xyzabc')
  const soma = cor.r + cor.g + cor.b
  assert.ok(soma > 150, `visivel em fundo escuro (soma ${soma})`)
})

test('arquivo sem extensao nao quebra', () => {
  for (const nome of ['Makefile', '.gitignore', 'LICENSE', 'src/Dockerfile']) {
    const cor = corDe(nome)
    assert.ok(Number.isFinite(cor.r) && cor.r >= 0 && cor.r <= 255, nome)
  }
})

test('a cor de pasta nao colide com nenhuma extensao', () => {
  for (const ext of extensoesConhecidas()) {
    assert.notDeepEqual(
      corDe(`a.${ext}`),
      COR_PASTA,
      `.${ext} colidiu com a cor de pasta`,
    )
  }
})

test('toda cor da paleta e visivel em fundo escuro', () => {
  for (const ext of extensoesConhecidas()) {
    const c = corDe(`a.${ext}`)
    // O fundo e rgb(7,8,12); precisa de contraste claro.
    const luminancia = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
    assert.ok(luminancia > 80, `.${ext} escura demais (${luminancia.toFixed(0)})`)
  }
})

test('o raio cresce com o tamanho, sem saturar', () => {
  const r = [50, 500, 5_000, 50_000, 500_000].map(raioPorTamanho)
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i]! > r[i - 1]!, `${i}: ${r[i - 1]} -> ${r[i]}`)
  }
  // O caso que a raiz cubica errava: arquivos todos grandes ficavam iguais.
  assert.ok(
    raioPorTamanho(500_000) > raioPorTamanho(50_000) + 0.4,
    'distingue mesmo entre arquivos grandes',
  )
})

test('o raio fica dentro de limites desenhaveis', () => {
  for (const b of [0, 1, 1000, 1e6, 1e9, 1e12]) {
    const r = raioPorTamanho(b)
    assert.ok(r >= 2 && r <= 9, `${b} bytes -> ${r}`)
  }
})
