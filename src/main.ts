import { montarCanvas } from './canvas.ts'
import { Simulacao } from './fisica.ts'
import { LinhaDoTempo } from './linha.ts'
import { desenhar, desenharProgresso, desenharRotulos } from './render.ts'
import { limparMortos, transicao } from './tempo.ts'
import { Interface } from './ui.ts'
import type { No, RespostaErro, RespostaRepo } from '../compartilhado/tipos.ts'

const { ctx, largura, altura } = montarCanvas('cidade')
// Camada separada: a cidade usa rastro, a interface limpa a cada frame.
const { ctx: ctxUi } = montarCanvas('interface')

const sim = new Simulacao()
const nos = new Map<string, No>()

let linha: LinhaDoTempo | null = null
let tamanhos: Record<string, number> = {}
let requisicaoAtual = 0

const parametros = new URLSearchParams(location.search)
// ?ms=300 acelera a animacao — util para conferir o comportamento inteiro
// sem esperar dois minutos.
const msPorQuadro = Number(parametros.get('ms')) || undefined

const ui = new Interface(
  (repo) => void carregar(repo),
  () => {
    linha?.pausar()
    ui.refletirPausa(linha?.estaPausada ?? false)
  },
  () => {
    nos.clear()
    ctx.clearRect(0, 0, largura(), altura())
    linha?.reiniciar(performance.now())
    ui.refletirPausa(false)
  },
)

async function carregar(repo: string): Promise<void> {
  const minha = ++requisicaoAtual
  linha = null
  nos.clear()
  ctx.clearRect(0, 0, largura(), altura())
  ui.iniciarCarregamento()

  // A URL acompanha o repositorio: recarregar ou compartilhar funciona.
  const url = new URL(location.href)
  url.searchParams.set('repo', repo)
  history.replaceState(null, '', url)

  try {
    const r = await fetch(`/api/repo?repo=${encodeURIComponent(repo)}`)
    const corpo = (await r.json()) as RespostaRepo | RespostaErro

    // Chegou tarde: o usuario ja pediu outro repositorio.
    if (minha !== requisicaoAtual) return

    if ('erro' in corpo) {
      ui.mostrarErro(corpo.mensagem)
      return
    }
    if (corpo.quadros.length === 0) {
      ui.mostrarErro('Esse repositório não tem histórico para mostrar.')
      return
    }

    tamanhos = corpo.tamanhos ?? {}
    linha = new LinhaDoTempo(corpo.quadros, msPorQuadro)
    linha.reiniciar(performance.now())
    ui.pararCarregamento()
    ui.refletirPausa(false)

    if (corpo.truncado) {
      ui.mostrarAviso(
        'Repositório grande: mostrando os 500 maiores arquivos, ' +
          'para a simulação continuar fluida.',
      )
    }
  } catch (e) {
    if (minha !== requisicaoAtual) return
    ui.mostrarErro(
      e instanceof TypeError
        ? 'Não consegui falar com o servidor. Verifique a conexão.'
        : 'Algo deu errado ao montar a cidade.',
    )
  }
}

addEventListener('keydown', (e) => {
  // Nao sequestrar o teclado enquanto a pessoa digita no campo.
  if (e.target instanceof HTMLInputElement) return
  if (!linha) return

  if (e.code === 'Space') {
    e.preventDefault()
    linha.pausar()
    ui.refletirPausa(linha.estaPausada)
  }
  if (e.code === 'KeyR') {
    nos.clear()
    ctx.clearRect(0, 0, largura(), altura())
    linha.reiniciar(performance.now())
    ui.refletirPausa(false)
  }
})

function frame(): void {
  const agora = performance.now()

  if (linha) {
    const passo = linha.avancar(agora)
    if (passo) {
      transicao(
        nos, passo.de, passo.para, passo.indice, largura(), altura(), agora,
        Math.random, tamanhos,
      )
    }
    limparMortos(nos, agora)
  }

  if (nos.size > 0) sim.passo(nos, largura(), altura())

  desenhar(ctx, nos, largura(), altura(), agora)

  ctxUi.clearRect(0, 0, largura(), altura())
  desenharRotulos(ctxUi, nos, agora)

  if (linha) {
    const vivos = contarVivos()
    ui.atualizarLinha(linha.atual, linha.posicao + 1, linha.total, vivos)

    const progresso =
      linha.posicao < 0
        ? 0
        : (linha.posicao + linha.fracao(agora)) / Math.max(1, linha.total - 1)
    desenharProgresso(ctxUi, progresso, largura(), altura())
  }

  requestAnimationFrame(frame)
}

function contarVivos(): number {
  let n = 0
  for (const no of nos.values()) {
    if (no.morrendoDesde === null && no.tipo === 'arquivo') n++
  }
  return n
}

requestAnimationFrame(frame)

// Abre direto no repositorio da URL, ou num exemplo.
const inicial = parametros.get('repo') ?? 'expressjs/express'
ui.preencher(inicial)
void carregar(inicial)
