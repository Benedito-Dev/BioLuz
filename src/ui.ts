// A camada entre a pagina e a animacao: campo de busca, carregamento
// narrado, linha do tempo no rodape, erros e controles.

import type { Quadro } from '../compartilhado/tipos.ts'

function elemento<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id)
  if (!e) throw new Error(`elemento #${id} nao encontrado`)
  return e as T
}

/**
 * Aceita "dono/nome", a URL completa, ou a URL com .git no fim.
 * Espelha analisarRepo() do back — o back valida de novo, mas barrar aqui
 * evita uma ida ao servidor para dizer o obvio.
 */
export function normalizarEntrada(bruto: string): string | null {
  const limpo = bruto
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')

  const partes = limpo.split('/')
  if (partes.length !== 2) return null

  const [dono, nome] = partes
  const valido = /^[A-Za-z0-9._-]+$/
  if (!dono || !nome || !valido.test(dono) || !valido.test(nome)) return null
  return `${dono}/${nome}`
}

/** Data ISO -> "12 de março de 2015". */
export function dataLegivel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "ana, bruno e mais 3" — a lista inteira nao cabe e nao interessa. */
export function autoresLegiveis(autores: string[], teto = 2): string {
  if (autores.length === 0) return ''
  if (autores.length <= teto) return autores.join(', ')
  const mostrados = autores.slice(0, teto).join(', ')
  return `${mostrados} e mais ${autores.length - teto}`
}

/**
 * Passos da narracao do carregamento.
 *
 * A busca leva de 4 a 30 s — 41 requisicoes ao GitHub. Uma tela parada nesse
 * tempo parece travada; contando o que esta acontecendo, a espera vira parte
 * da historia. Os tempos sao estimados, nao medidos: o texto avanca sozinho
 * ate o dado chegar.
 */
const NARRACAO: Array<{ apos: number; texto: string }> = [
  { apos: 0, texto: 'procurando o repositório…' },
  { apos: 1400, texto: 'lendo a lista de commits…' },
  { apos: 3200, texto: 'escolhendo 40 momentos da história…' },
  { apos: 5600, texto: 'baixando as 40 fotografias da árvore…' },
  { apos: 11_000, texto: 'ainda baixando — repositório grande…' },
  { apos: 18_000, texto: 'quase lá, montando a cidade…' },
]

export class Interface {
  private readonly entrada = elemento<HTMLInputElement>('entrada')
  private readonly busca = elemento<HTMLFormElement>('busca')
  private readonly carregando = elemento('carregando')
  private readonly narracao = elemento('narracao')
  private readonly erro = elemento('erro')
  private readonly mensagemErro = elemento('mensagemErro')
  private readonly rodape = elemento('rodape')
  private readonly data = elemento<HTMLTimeElement>('data')
  private readonly autores = elemento('autores')
  private readonly contagem = elemento('contagem')
  private readonly pausar = elemento<HTMLButtonElement>('pausar')
  private readonly reiniciar = elemento<HTMLButtonElement>('reiniciar')
  private readonly aviso = elemento('aviso')

  private timerNarracao: number | null = null
  private ultimaData = ''

  private readonly aoBuscar: (repo: string) => void
  private readonly aoPausar: () => void
  private readonly aoReiniciar: () => void

  constructor(
    aoBuscar: (repo: string) => void,
    aoPausar: () => void,
    aoReiniciar: () => void,
  ) {
    this.aoBuscar = aoBuscar
    this.aoPausar = aoPausar
    this.aoReiniciar = aoReiniciar

    this.busca.addEventListener('submit', (e) => {
      e.preventDefault()
      this.submeter(this.entrada.value)
    })

    for (const botao of document.querySelectorAll<HTMLButtonElement>(
      '.exemplos button',
    )) {
      botao.addEventListener('click', () => {
        const repo = botao.dataset.repo
        if (repo) {
          this.entrada.value = repo
          this.submeter(repo)
        }
      })
    }

    this.pausar.addEventListener('click', () => this.aoPausar())
    this.reiniciar.addEventListener('click', () => this.aoReiniciar())
    elemento('tentarOutro').addEventListener('click', () => {
      this.esconderErro()
      this.entrada.focus()
      this.entrada.select()
    })
  }

  private submeter(bruto: string): void {
    const repo = normalizarEntrada(bruto)
    if (!repo) {
      this.mostrarErro('Use o formato dono/repositório, ou cole a URL do GitHub.')
      return
    }
    this.esconderErro()
    this.aoBuscar(repo)
  }

  preencher(repo: string): void {
    this.entrada.value = repo
  }

  /** Comeca a narracao; ela avanca sozinha ate `pararCarregamento()`. */
  iniciarCarregamento(): void {
    this.esconderErro()
    this.rodape.hidden = true
    this.aviso.hidden = true
    this.carregando.hidden = false

    const inicio = performance.now()
    this.narracao.textContent = NARRACAO[0]!.texto

    const tique = (): void => {
      const decorrido = performance.now() - inicio
      let texto = NARRACAO[0]!.texto
      for (const passo of NARRACAO) {
        if (decorrido >= passo.apos) texto = passo.texto
      }
      if (this.narracao.textContent !== texto) {
        this.narracao.textContent = texto
      }
      this.timerNarracao = window.setTimeout(tique, 250)
    }
    tique()
  }

  pararCarregamento(): void {
    if (this.timerNarracao !== null) {
      clearTimeout(this.timerNarracao)
      this.timerNarracao = null
    }
    this.carregando.hidden = true
  }

  mostrarErro(mensagem: string): void {
    this.pararCarregamento()
    this.rodape.hidden = true
    this.mensagemErro.textContent = mensagem
    this.erro.hidden = false
  }

  esconderErro(): void {
    this.erro.hidden = true
  }

  mostrarAviso(texto: string): void {
    this.aviso.textContent = texto
    this.aviso.hidden = false
  }

  /** Atualiza o rodape. Chamado a cada frame — so mexe no DOM se mudou. */
  atualizarLinha(
    quadro: Quadro | null,
    posicao: number,
    total: number,
    nos: number,
  ): void {
    if (!quadro) {
      this.rodape.hidden = true
      return
    }
    this.rodape.hidden = false

    const data = dataLegivel(quadro.data)
    if (data !== this.ultimaData) {
      this.data.textContent = data
      this.data.dateTime = quadro.data
      this.ultimaData = data
    }

    const autores = autoresLegiveis(quadro.autores)
    if (this.autores.textContent !== autores) {
      this.autores.textContent = autores
    }

    const contagem = `${nos} arquivos · quadro ${posicao} de ${total}`
    if (this.contagem.textContent !== contagem) {
      this.contagem.textContent = contagem
    }
  }

  refletirPausa(pausada: boolean): void {
    this.pausar.textContent = pausada ? '▶' : '❚❚'
    this.pausar.setAttribute('aria-label', pausada ? 'Continuar' : 'Pausar')
  }
}
