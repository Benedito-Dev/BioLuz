// Serve o handler de /api/repo num servidor HTTP local, para testar com curl
// sem precisar de login na Vercel. A assinatura e a mesma (Request -> Response).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

try {
  for (const linha of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.trim()
  }
} catch {
  console.log('(sem .env.local — anonimo)')
}

const { default: handler } = await import('../api/repo.ts')
const porta = Number(process.env.PORT ?? 3000)

createServer(async (req, res) => {
  const url = `http://localhost:${porta}${req.url ?? '/'}`

  if (!url.includes('/api/repo')) {
    res.writeHead(404).end('use /api/repo?repo=dono/nome')
    return
  }

  const resposta = await handler(new Request(url))
  const corpo = await resposta.text()
  res.writeHead(resposta.status, Object.fromEntries(resposta.headers))
  res.end(corpo)
}).listen(porta, () => console.log(`ouvindo em http://localhost:${porta}`))
