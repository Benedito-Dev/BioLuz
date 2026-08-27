import { montarCanvas } from './canvas.ts'
import { montarGrafo } from './grafo.ts'
import { Simulacao } from './fisica.ts'
import { desenhar, desenharDiagnostico } from './render.ts'
import type { No, RespostaErro, RespostaRepo } from '../compartilhado/tipos.ts'

const { ctx, largura, altura } = montarCanvas('cidade')
const sim = new Simulacao()

let nos = new Map<string, No>()
let estado = 'carregando…'
let passos = 0

// Etapa 2: monta o ULTIMO quadro inteiro e deixa acomodar.
// O tempo passando chega na Etapa 3.
const repo = new URLSearchParams(location.search).get('repo') ?? 'vercel/ms'

async function carregar(): Promise<void> {
  try {
    const r = await fetch(`/api/repo?repo=${encodeURIComponent(repo)}`)
    const corpo = (await r.json()) as RespostaRepo | RespostaErro

    if ('erro' in corpo) {
      estado = corpo.mensagem
      return
    }

    const ultimo = corpo.quadros.at(-1)
    if (!ultimo) {
      estado = 'sem quadros'
      return
    }

    nos = montarGrafo(ultimo.arquivos, largura(), altura())
    estado = `${corpo.repo} · ${ultimo.data.slice(0, 10)}`
  } catch (e) {
    estado = `falhou: ${e instanceof Error ? e.message : e}`
  }
}

void carregar()

function quadro(): void {
  if (nos.size > 0) {
    sim.passo(nos, largura(), altura())
    passos++
  }

  desenhar(ctx, nos, largura(), altura())
  desenharDiagnostico(ctx, [
    estado,
    `nos: ${nos.size}   passos: ${passos}`,
    `energia: ${sim.energia(nos).toExponential(2)}`,
  ])

  requestAnimationFrame(quadro)
}

requestAnimationFrame(quadro)
