import { defineConfig, type Plugin } from 'vite'

/**
 * Encaminha /api/* para o servidor local de funcoes (npm run api).
 *
 * Nao da para usar `server.proxy` nem um middleware comum: a pasta api/ fica
 * na raiz do projeto — exigencia da Vercel — e o Vite a enxerga como codigo
 * do front, servindo o FONTE de repo.ts transformado em modulo. Empilhando o
 * middleware no topo de servidor.middlewares.stack ele roda antes de tudo.
 */
function proxyApi(alvo: string): Plugin {
  return {
    name: 'proxy-api',
    configureServer(servidor) {
      servidor.middlewares.use('/api', (req, res) => {
        // req.url aqui ja vem sem o prefixo /api consumido pelo mount.
        const url = `${alvo}/api${req.url ?? ''}`

        // Repositorio grande leva ~30s no primeiro pedido (41 requisicoes ao
        // GitHub). O timeout padrao do fetch corta antes disso.
        fetch(url, { signal: AbortSignal.timeout(120_000) })
          .then(async (r) => {
            res.statusCode = r.status
            res.setHeader(
              'content-type',
              r.headers.get('content-type') ?? 'application/json',
            )
            res.end(Buffer.from(await r.arrayBuffer()))
          })
          .catch((e: Error) => {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(
              JSON.stringify({
                erro: 'falha_github',
                mensagem: `Servidor de API fora do ar (${e.message}). Rode: npm run api`,
              }),
            )
          })
      })

      // Move este middleware para o topo da pilha, antes dos internos do Vite.
      const pilha = servidor.middlewares.stack
      const meu = pilha.pop()
      if (meu) pilha.unshift(meu)
    },
  }
}

export default defineConfig({
  plugins: [proxyApi('http://localhost:3000')],
})
