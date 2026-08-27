import { montarCanvas } from './canvas.ts'
import { Simulacao } from './fisica.ts'
import { LinhaDoTempo } from './linha.ts'
import {
  desenhar,
  desenharDiagnostico,
  desenharProgresso,
  desenharRotulos,
} from './render.ts'
import { limparMortos, transicao } from './tempo.ts'
import type { No, RespostaErro, RespostaRepo } from '../compartilhado/tipos.ts'

const { ctx, largura, altura } = montarCanvas('cidade')
// Camada separada: a cidade usa rastro, a interface limpa a cada frame.
const { ctx: ctxUi } = montarCanvas('interface')
const sim = new Simulacao()

const nos = new Map<string, No>()
let linha: LinhaDoTempo | null = null
let estado = 'carregando…'
let ultimaTransicao = { nasceram: 0, morreram: 0 }
let tamanhos: Record<string, number> = {}

const parametros = new URLSearchParams(location.search)
const repo = parametros.get('repo') ?? 'vercel/ms'
// ?ms=300 acelera a animacao — util para conferir o comportamento inteiro
// sem esperar dois minutos.
const msPorQuadro = Number(parametros.get('ms')) || undefined

async function carregar(): Promise<void> {
  try {
    const r = await fetch(`/api/repo?repo=${encodeURIComponent(repo)}`)
    const corpo = (await r.json()) as RespostaRepo | RespostaErro

    if ('erro' in corpo) {
      estado = corpo.mensagem
      return
    }
    if (corpo.quadros.length === 0) {
      estado = 'sem quadros'
      return
    }

    tamanhos = corpo.tamanhos ?? {}
    linha = new LinhaDoTempo(corpo.quadros, msPorQuadro)
    linha.reiniciar(performance.now())
    estado = corpo.repo
  } catch (e) {
    estado = `falhou: ${e instanceof Error ? e.message : e}`
  }
}

void carregar()

// Espaco pausa, R reinicia.
addEventListener('keydown', (e) => {
  if (!linha) return
  if (e.code === 'Space') {
    e.preventDefault()
    linha.pausar()
  }
  if (e.code === 'KeyR') {
    nos.clear()
    linha.reiniciar(performance.now())
  }
})

function frame(): void {
  const agora = performance.now()

  if (linha) {
    const passo = linha.avancar(agora)
    if (passo) {
      ultimaTransicao = transicao(
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

  const quadro = linha?.atual
  const posicao = linha ? linha.posicao + 1 : 0
  desenharDiagnostico(ctxUi, [
    `${estado}${linha?.estaPausada ? '  [pausado]' : ''}`,
    quadro
      ? `${quadro.data.slice(0, 10)}   quadro ${posicao}/${linha!.total}`
      : '',
    quadro?.autores.length
      ? `autores: ${quadro.autores.slice(0, 4).join(', ')}`
      : '',
    `nos: ${nos.size}   +${ultimaTransicao.nasceram} -${ultimaTransicao.morreram}`,
    'espaco: pausar    R: reiniciar',
  ])

  if (linha) {
    const progresso =
      linha.posicao < 0
        ? 0
        : (linha.posicao + linha.fracao(agora)) / Math.max(1, linha.total - 1)
    desenharProgresso(ctxUi, progresso, largura(), altura())
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
