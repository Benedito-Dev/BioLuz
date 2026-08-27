// Chama o handler direto, sem servidor.
// Uso: node --experimental-strip-types testes/manual.ts <dono/nome>
import { readFileSync } from 'node:fs'

// Carrega .env.local sem dependencia externa.
try {
  const conteudo = readFileSync('.env.local', 'utf8')
  for (const linha of conteudo.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.trim()
  }
} catch {
  console.log('(sem .env.local — rodando anonimo, 60 req/h)')
}

const { default: handler } = await import('../api/repo.ts')
type Resposta = import('../compartilhado/tipos.ts').RespostaRepo
type Erro = import('../compartilhado/tipos.ts').RespostaErro

const alvo = process.argv[2] ?? 'vercel/ms'
const inicio = Date.now()
const resposta = await handler(
  new Request(`http://local/api/repo?repo=${encodeURIComponent(alvo)}`),
)
const ms = Date.now() - inicio
const corpo = (await resposta.json()) as Resposta | Erro

console.log('')
console.log(`${alvo}  ->  HTTP ${resposta.status}  (${ms} ms)`)

if ('erro' in corpo) {
  console.log(`erro: ${corpo.erro}`)
  console.log(`msg:  ${corpo.mensagem}`)
  process.exit(0)
}

const contagens = corpo.quadros.map((q) => q.arquivos.length)
console.log(
  `commits: ${corpo.totalCommits}   quadros: ${corpo.quadros.length}   truncado: ${corpo.truncado}`,
)
console.log(`cache: ${resposta.headers.get('cache-control')}`)
console.log('')
console.log('contagem de arquivos por quadro:')
console.log(contagens.join(' '))

const primeiro = corpo.quadros[0]!
const ultimo = corpo.quadros.at(-1)!
console.log('')
console.log(
  `primeiro: ${primeiro.data.slice(0, 10)}  ${primeiro.arquivos.length} arquivos  autores: ${primeiro.autores.slice(0, 3).join(', ')}`,
)
console.log(
  `ultimo:   ${ultimo.data.slice(0, 10)}  ${ultimo.arquivos.length} arquivos  autores: ${ultimo.autores.slice(0, 3).join(', ')}`,
)

// Os aceites da etapa.
const cresce = ultimo.arquivos.length > primeiro.arquivos.length
const cronologico = Date.parse(primeiro.data) < Date.parse(ultimo.data)
const tetoOk = contagens.every((c) => c <= 500)
const semVazio = contagens.every((c) => c > 0)
console.log('')
console.log(
  `ACEITE  cresce: ${cresce ? 'ok' : 'FALHOU'}   cronologico: ${cronologico ? 'ok' : 'FALHOU'}   teto 500: ${tetoOk ? 'ok' : 'FALHOU'}   sem quadro vazio: ${semVazio ? 'ok' : 'FALHOU'}`,
)
