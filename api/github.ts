// Camada de rede: tudo que fala com a API do GitHub mora aqui.
// O resto do back nao sabe o que e HTTP.

import type { CodigoErro } from '../compartilhado/tipos.ts'

const BASE = 'https://api.github.com'

/**
 * Executa tarefas com concorrencia limitada, parando na primeira falha.
 *
 * Promise.all sem limite tem dois problemas: dezenas de conexoes simultaneas
 * esgotam os sockets do Node ("fetch failed"), e quando uma tarefa falha as
 * outras continuam gastando requisicoes de um pedido que ja morreu.
 */
async function emLotes<T>(
  quantidade: number,
  tarefa: (indice: number) => Promise<T>,
  concorrencia = 8,
): Promise<T[]> {
  const resultado = new Array<T>(quantidade)
  let proximo = 0
  let falha: unknown = null

  async function trabalhador(): Promise<void> {
    while (falha === null) {
      const i = proximo++
      if (i >= quantidade) return
      try {
        resultado[i] = await tarefa(i)
      } catch (e) {
        falha ??= e
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concorrencia, quantidade) }, trabalhador),
  )

  if (falha !== null) throw falha
  return resultado
}

/** Erro com codigo legivel, para o handler traduzir em resposta. */
export class ErroGitHub extends Error {
  readonly codigo: CodigoErro
  /** Quando o limite reseta — so em codigo 'limite_api'. */
  readonly resetEm: Date | undefined

  constructor(codigo: CodigoErro, mensagem: string, resetEm?: Date) {
    super(mensagem)
    this.name = 'ErroGitHub'
    this.codigo = codigo
    this.resetEm = resetEm
  }
}

function cabecalhos(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bioluz',
  }
  // O token so existe no servidor. Se faltar, seguimos anonimos (60 req/h).
  const token = process.env.GITHUB_TOKEN
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

/**
 * GET na API do GitHub, com os erros ja traduzidos.
 * Distingue "nao existe" de "e privado" de "estourou o limite" — sao
 * situacoes diferentes para quem esta olhando a tela.
 */
async function buscar(caminho: string): Promise<unknown> {
  return (await buscarComResposta(caminho)).dados
}

async function buscarComResposta(
  caminho: string,
): Promise<{ dados: unknown; resposta: Response }> {
  let resposta: Response
  try {
    resposta = await fetch(`${BASE}${caminho}`, { headers: cabecalhos() })
  } catch (e) {
    // Preserva a causa: sem isso, um erro de rede e um erro de codigo viram
    // a mesma mensagem opaca e o diagnostico fica cego.
    const causa = e instanceof Error ? e.message : String(e)
    throw new ErroGitHub(
      'falha_github',
      `Não consegui falar com o GitHub (${causa}).`,
    )
  }

  if (resposta.ok) return { dados: await resposta.json(), resposta }

  // 403 e 429 sao limite de taxa quando as requisicoes restantes zeraram;
  // 403 com requisicoes sobrando e repositorio privado.
  if (resposta.status === 403 || resposta.status === 429) {
    const restantes = resposta.headers.get('x-ratelimit-remaining')
    if (restantes === '0') {
      const reset = resposta.headers.get('x-ratelimit-reset')
      const resetEm = reset ? new Date(Number(reset) * 1000) : undefined
      throw new ErroGitHub(
        'limite_api',
        'Limite da API do GitHub atingido.',
        resetEm,
      )
    }
    throw new ErroGitHub('privado', 'Esse repositório é privado ou não existe.')
  }

  if (resposta.status === 404) {
    throw new ErroGitHub('nao_encontrado', 'Não encontrei esse repositório.')
  }

  if (resposta.status === 409) {
    // O GitHub responde 409 para repositorio sem nenhum commit.
    throw new ErroGitHub('repo_vazio', 'Esse repositório está vazio.')
  }

  throw new ErroGitHub(
    'falha_github',
    `O GitHub respondeu ${resposta.status}.`,
  )
}

export type CommitBruto = {
  sha: string
  data: string
  autor: string
}

type PaginaCommits = Array<{
  sha: string
  commit: { author: { date: string; name: string } | null }
  author: { login: string } | null
}>

function normalizar(pagina: PaginaCommits): CommitBruto[] {
  return pagina.map((c) => ({
    sha: c.sha,
    data: c.commit?.author?.date ?? new Date(0).toISOString(),
    autor: c.author?.login ?? c.commit?.author?.name ?? 'desconhecido',
  }))
}

/** O GitHub informa o total de paginas no cabecalho Link. */
function ultimaPagina(resposta: Response): number {
  const link = resposta.headers.get('link')
  if (!link) return 1
  const m = link.match(/[?&]page=(\d+)>;\s*rel="last"/)
  return m ? Number(m[1]) : 1
}

const POR_PAGINA = 100

/**
 * Amostra commits ao longo de TODA a historia, do mais novo para o mais velho.
 *
 * Baixar tudo e inviavel: o Linux tem 1,4 milhao de commits, o que daria 14 mil
 * requisicoes. Mas o cabecalho Link diz quantas paginas existem, entao saltamos
 * direto para as paginas que contem os commits que queremos. Um repositorio de
 * qualquer tamanho custa no maximo `alvo` requisicoes.
 */
export async function listarCommits(
  dono: string,
  nome: string,
  alvo = 40,
): Promise<{ amostra: CommitBruto[]; total: number }> {
  const base = `/repos/${dono}/${nome}/commits?per_page=${POR_PAGINA}`

  const primeira = await buscarComResposta(`${base}&page=1`)
  const inicial = normalizar(primeira.dados as PaginaCommits)
  if (inicial.length === 0) {
    throw new ErroGitHub('repo_vazio', 'Esse repositório ainda não tem commits.')
  }

  const paginas = ultimaPagina(primeira.resposta)

  // Cabe tudo numa pagina: nada a amostrar.
  if (paginas === 1) {
    return { amostra: inicial, total: inicial.length }
  }

  // A ultima pagina revela o total exato de commits.
  const ultima = await buscarComResposta(`${base}&page=${paginas}`)
  const commitsUltima = normalizar(ultima.dados as PaginaCommits)
  const total = (paginas - 1) * POR_PAGINA + commitsUltima.length

  // Poucas paginas: baixa todas, sai mais simples e mais preciso.
  if (paginas <= alvo) {
    const meio = await emLotes(paginas - 2, (i) =>
      buscar(`${base}&page=${i + 2}`),
    )
    const todos = [
      ...inicial,
      ...meio.flatMap((p) => normalizar(p as PaginaCommits)),
      ...commitsUltima,
    ]
    return { amostra: todos, total: todos.length }
  }

  // Muitas paginas: pega uma amostra espacada, um commit por pagina visitada.
  const indices = new Set<number>()
  for (let i = 0; i < alvo; i++) {
    indices.add(Math.round((i * (total - 1)) / (alvo - 1)))
  }

  const porPagina = new Map<number, number[]>()
  for (const indice of indices) {
    const pagina = Math.floor(indice / POR_PAGINA) + 1
    const dentro = indice % POR_PAGINA
    const lista = porPagina.get(pagina) ?? []
    lista.push(dentro)
    porPagina.set(pagina, lista)
  }

  const cache = new Map<number, CommitBruto[]>()
  cache.set(1, inicial)
  cache.set(paginas, commitsUltima)

  const faltando = [...porPagina.keys()].filter((p) => !cache.has(p))
  const baixadas = await emLotes(faltando.length, async (i) => {
    const p = faltando[i]!
    const dados = await buscar(`${base}&page=${p}`)
    return [p, normalizar(dados as PaginaCommits)] as const
  })
  for (const [p, commits] of baixadas) cache.set(p, commits)

  const amostra: CommitBruto[] = []
  for (const pagina of [...porPagina.keys()].sort((a, b) => a - b)) {
    const commits = cache.get(pagina) ?? []
    for (const dentro of (porPagina.get(pagina) ?? []).sort((a, b) => a - b)) {
      const c = commits[dentro]
      if (c) amostra.push(c)
    }
  }

  return { amostra, total }
}

export type ArquivoBruto = {
  caminho: string
  tamanho: number
}

/**
 * Busca varias arvores com concorrencia limitada.
 *
 * Promise.all com 40 requisicoes de uma vez tem dois problemas: o GitHub
 * responde 429 por rajada mesmo dentro da cota, e quando uma falha as outras
 * 39 continuam gastando requisicoes de um pedido que ja morreu. Aqui um
 * trabalhador que encontra erro faz os demais pararem na proxima iteracao.
 */
export async function buscarArvores(
  dono: string,
  nome: string,
  shas: string[],
  concorrencia = 8,
): Promise<Array<{ arquivos: ArquivoBruto[]; truncada: boolean }>> {
  return emLotes(
    shas.length,
    (i) => buscarArvore(dono, nome, shas[i]!),
    concorrencia,
  )
}

/** A arvore completa de arquivos num commit. Uma requisicao por snapshot. */
export async function buscarArvore(
  dono: string,
  nome: string,
  sha: string,
): Promise<{ arquivos: ArquivoBruto[]; truncada: boolean }> {
  const bruto = (await buscar(
    `/repos/${dono}/${nome}/git/trees/${sha}?recursive=1`,
  )) as {
    tree?: Array<{ path: string; type: string; size?: number }>
    truncated?: boolean
  }

  const arquivos = (bruto.tree ?? [])
    // 'blob' e arquivo; 'tree' e pasta, e nos derivamos as pastas dos
    // caminhos, entao ignoramos aqui.
    .filter((item) => item.type === 'blob')
    .map((item) => ({ caminho: item.path, tamanho: item.size ?? 0 }))

  return { arquivos, truncada: bruto.truncated === true }
}
