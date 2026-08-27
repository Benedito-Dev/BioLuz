// GET /api/repo?repo=dono/nome  ->  RespostaRepo | RespostaErro
//
// Orquestra: valida a entrada, busca 1 lista de commits, escolhe 40 shas,
// busca as 40 arvores em paralelo, corta o elenco e devolve os quadros.
// Total: 41 requisicoes ao GitHub, contra 800+ de um replay commit a commit.

import type { RespostaErro, RespostaRepo } from '../compartilhado/tipos.ts'
import { ErroGitHub, buscarArvores, listarCommits } from './github.ts'
import {
  QUADROS_ALVO,
  analisarRepo,
  decidirElenco,
  escolherCommits,
  montarQuadros,
  tamanhosDe,
} from './quadros.ts'

const STATUS: Record<RespostaErro['erro'], number> = {
  repo_invalido: 400,
  nao_encontrado: 404,
  privado: 403,
  limite_api: 429,
  repo_vazio: 422,
  falha_github: 502,
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const entrada = url.searchParams.get('repo') ?? ''

  const alvo = analisarRepo(entrada)
  if (!alvo) {
    return erro(
      'repo_invalido',
      'Use o formato dono/nome, ou cole a URL do repositorio.',
    )
  }

  const { dono, nome } = alvo

  try {
    // Amostra da historia inteira, do mais novo para o mais velho.
    const { amostra, total } = await listarCommits(dono, nome, QUADROS_ALVO)

    // Espacamento uniforme, ja em ordem cronologica.
    const escolhidos = escolherCommits(amostra, QUADROS_ALVO)
    const cronologicos = [...amostra].reverse()

    // 40 requisicoes com concorrencia limitada: rapido sem virar rajada.
    const arvores = await buscarArvores(
      dono,
      nome,
      escolhidos.map((c) => c.sha),
    )

    // O elenco e decidido uma vez, olhando todos os quadros.
    const { permitidos, truncado } = decidirElenco(
      arvores.map((a) => a.arquivos),
    )

    const quadros = montarQuadros(
      escolhidos,
      arvores.map((a) => a.arquivos),
      cronologicos,
      permitidos,
    )

    const corpo: RespostaRepo = {
      repo: `${dono}/${nome}`,
      quadros,
      tamanhos: tamanhosDe(
        arvores.map((a) => a.arquivos),
        permitidos,
      ),
      totalCommits: total,
      truncado: truncado || arvores.some((a) => a.truncada),
    }

    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Uma requisicao por repositorio por dia; o CDN serve o resto.
        'Cache-Control':
          'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (e) {
    if (e instanceof ErroGitHub) {
      return erro(e.codigo, mensagemDe(e))
    }
    return erro('falha_github', 'Algo deu errado ao montar a cidade.')
  }
}

function mensagemDe(e: ErroGitHub): string {
  if (e.codigo !== 'limite_api' || !e.resetEm) return e.message

  const minutos = Math.max(
    1,
    Math.ceil((e.resetEm.getTime() - Date.now()) / 60000),
  )
  return `Limite da API do GitHub atingido. Tente de novo em ${minutos} min.`
}

function erro(codigo: RespostaErro['erro'], mensagem: string): Response {
  const corpo: RespostaErro = { erro: codigo, mensagem }
  return new Response(JSON.stringify(corpo), {
    status: STATUS[codigo],
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
