// Tipos usados pelo back (/api) e pelo front (/src).
// Uma definicao so — se cada lado tivesse a sua, elas divergiriam em
// algum momento e o bug seria silencioso: o back manda um campo, o
// front le outro, a tela fica vazia sem erro nenhum.

/** Uma fotografia da arvore de arquivos num instante do repositorio. */
export type Quadro = {
  sha: string
  /** ISO — quando essa foto foi tirada. */
  data: string
  /** Quem commitou desde o quadro anterior. */
  autores: string[]
  /** Caminhos completos, ex "src/api/user.js". */
  arquivos: string[]
}

/** Resposta de sucesso de GET /api/repo?repo=dono/nome */
export type RespostaRepo = {
  repo: string
  quadros: Quadro[]
  /**
   * Bytes de cada arquivo, no maior tamanho que ele teve.
   *
   * Fica aqui e nao dentro de cada Quadro porque o caminho se repete nos 40
   * quadros: no Linux isso seria 500 numeros x 40 = 20 mil, contra 500 aqui.
   */
  tamanhos: Record<string, number>
  /** Total de commits que o repositorio tem, nao so os amostrados. */
  totalCommits: number
  /** true quando passamos do teto e cortamos aos maiores arquivos. */
  truncado: boolean
}

/** Resposta de erro — sempre com mensagem legivel, nunca stack trace. */
export type RespostaErro = {
  erro: CodigoErro
  mensagem: string
}

export type CodigoErro =
  | 'repo_invalido'
  | 'nao_encontrado'
  | 'privado'
  | 'limite_api'
  | 'repo_vazio'
  | 'falha_github'

/** Um no do grafo: arquivo ou pasta. O caminho e a identidade. */
export type No = {
  /** A identidade — nunca muda. */
  caminho: string
  tipo: 'arquivo' | 'pasta'
  pai: string | null
  /** Posicao atual. */
  x: number
  y: number
  /** Velocidade atual. */
  vx: number
  vy: number
  /** Indice do quadro em que apareceu. */
  nascimento: number
  /** 1 ao ser tocado, decai a cada frame. */
  brilho: number
  raio: number
  /** Raio que o no busca — cresce de 0 ao nascer. */
  raioAlvo: number
  /** Bytes; 0 para pastas. */
  tamanho: number
  /** null enquanto vivo; timestamp do inicio do fade ao morrer. */
  morrendoDesde: number | null
  /** Indice interno da simulacao, para visitar cada par de nos uma vez so. */
  ordem: number
}
