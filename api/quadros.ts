// Logica pura: recebe dados, devolve dados, nao sabe o que e rede.
// Da para testar sem tocar no GitHub.

import type { Quadro } from '../compartilhado/tipos.ts'
import type { ArquivoBruto, CommitBruto } from './github.ts'

export const QUADROS_ALVO = 40
export const TETO_ARQUIVOS = 500

/** Aceita "dono/nome", a URL completa, ou a URL com .git no fim. */
export function analisarRepo(
  entrada: string,
): { dono: string; nome: string } | null {
  const limpo = entrada
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')

  const partes = limpo.split('/')
  if (partes.length !== 2) return null

  const [dono, nome] = partes
  // Regra de nome do GitHub: letras, numeros, ponto, hifen, underscore.
  const valido = /^[A-Za-z0-9._-]+$/
  if (!dono || !nome || !valido.test(dono) || !valido.test(nome)) return null

  return { dono, nome }
}

/**
 * Escolhe ate QUADROS_ALVO commits espacados uniformemente, do mais VELHO
 * para o mais NOVO, sempre incluindo o primeiro e o ultimo.
 *
 * A API do GitHub devolve do mais novo para o mais velho. Se esquecermos de
 * inverter, a animacao roda de tras para frente — o projeto encolhe ate virar
 * nada. O bug so apareceria na Etapa 3, quando ja custa caro achar.
 */
export function escolherCommits(
  commitsRecentesPrimeiro: CommitBruto[],
  alvo = QUADROS_ALVO,
): CommitBruto[] {
  const cronologicos = [...commitsRecentesPrimeiro].reverse()

  // Poucos commits: usa todos, sem inventar quadros repetidos.
  if (cronologicos.length <= alvo) return cronologicos

  const escolhidos: CommitBruto[] = []
  const ultimo = cronologicos.length - 1
  for (let i = 0; i < alvo; i++) {
    // Distribui de 0 a `ultimo` inclusive, garantindo as duas pontas.
    const indice = Math.round((i * ultimo) / (alvo - 1))
    escolhidos.push(cronologicos[indice]!)
  }
  return escolhidos
}

/**
 * Decide QUAIS arquivos entram na animacao — uma vez so, olhando TODOS os
 * quadros, e aplica a decisao a todos eles.
 *
 * Duas armadilhas que este desenho evita:
 *
 * 1. Se cada quadro escolhesse seus proprios 500 maiores, um arquivo entraria
 *    e sairia do conjunto conforme crescesse, e a animacao viraria um piscar
 *    aleatorio de bolinhas nascendo e morrendo sem motivo.
 *
 * 2. Se o elenco saisse so do quadro final, a historia sumiria: arquivos ja
 *    deletados nunca apareceriam, e um quadro inteiro poderia ficar VAZIO — foi
 *    o que aconteceu com o Linux, cujo quadro de 2015 caiu num commit do
 *    greybus, projeto mesclado depois e ausente da arvore atual.
 *
 * Criterio: os MAIORES arquivos do universo inteiro, como a spec pede, com
 * presenca como desempate. Priorizar persistencia em vez de tamanho parece
 * atraente, mas achata a animacao: sobram os arquivos presentes em todos os
 * quadros, e o repositorio nasce pronto em vez de crescer. Depois, uma segunda
 * passada garante que nenhum quadro fique sem nada para mostrar.
 */
export function decidirElenco(
  arvores: ArquivoBruto[][],
  teto = TETO_ARQUIVOS,
): { permitidos: Set<string> | null; truncado: boolean } {
  const universo = new Set<string>()
  for (const arvore of arvores) {
    for (const a of arvore) universo.add(a.caminho)
  }
  if (universo.size <= teto) return { permitidos: null, truncado: false }

  // Quantos quadros cada arquivo atravessa, e seu maior tamanho.
  const presenca = new Map<string, number>()
  const tamanho = new Map<string, number>()
  for (const arvore of arvores) {
    for (const a of arvore) {
      presenca.set(a.caminho, (presenca.get(a.caminho) ?? 0) + 1)
      tamanho.set(a.caminho, Math.max(tamanho.get(a.caminho) ?? 0, a.tamanho))
    }
  }

  const ordenados = [...universo].sort((x, y) => {
    const dif = (tamanho.get(y) ?? 0) - (tamanho.get(x) ?? 0)
    return dif !== 0 ? dif : (presenca.get(y) ?? 0) - (presenca.get(x) ?? 0)
  })

  const permitidos = new Set(ordenados.slice(0, teto))

  // Nenhum quadro pode ficar vazio: se algum ficou de fora por completo,
  // adota os maiores arquivos dele, trocando pelos menos persistentes.
  //
  // Os sacrificados saem do FIM de `ordenados` — os menos persistentes que
  // entraram. Um resgatado nunca e sacrificado, senao o resgate se desfaria
  // sozinho e o teto estouraria.
  const resgatados = new Set<string>()
  let candidatoASair = teto - 1

  function abrirVaga(): void {
    while (permitidos.size >= teto && candidatoASair >= 0) {
      const alvo = ordenados[candidatoASair--]
      if (alvo && !resgatados.has(alvo)) permitidos.delete(alvo)
    }
  }

  for (const arvore of arvores) {
    if (arvore.length === 0) continue
    if (arvore.some((a) => permitidos.has(a.caminho))) continue

    const melhores = [...arvore]
      .sort((a, b) => b.tamanho - a.tamanho)
      .slice(0, Math.min(8, arvore.length))

    for (const a of melhores) {
      if (permitidos.has(a.caminho)) continue
      abrirVaga()
      if (permitidos.size >= teto) break // sem vaga possivel
      permitidos.add(a.caminho)
      resgatados.add(a.caminho)
    }
  }

  return { permitidos, truncado: true }
}

/**
 * Junta commits e arvores nos quadros finais.
 * `autores` de cada quadro sao quem commitou desde o quadro anterior.
 */
export function montarQuadros(
  commitsEscolhidos: CommitBruto[],
  arvores: ArquivoBruto[][],
  todosCronologicos: CommitBruto[],
  permitidos: Set<string> | null,
): Quadro[] {
  return commitsEscolhidos.map((commit, i) => {
    const arvore = arvores[i] ?? []
    const arquivos = permitidos
      ? arvore.filter((a) => permitidos.has(a.caminho)).map((a) => a.caminho)
      : arvore.map((a) => a.caminho)

    return {
      sha: commit.sha,
      data: commit.data,
      autores: autoresEntre(
        todosCronologicos,
        i === 0 ? null : commitsEscolhidos[i - 1]!.sha,
        commit.sha,
      ),
      arquivos,
    }
  })
}

/**
 * Maior tamanho que cada arquivo permitido teve ao longo da historia.
 * O maior, nao o final, para que um arquivo grande que encolheu no fim
 * ainda apareca com o peso que teve.
 */
export function tamanhosDe(
  arvores: ArquivoBruto[][],
  permitidos: Set<string> | null,
): Record<string, number> {
  const mapa: Record<string, number> = {}
  for (const arvore of arvores) {
    for (const a of arvore) {
      if (permitidos && !permitidos.has(a.caminho)) continue
      const atual = mapa[a.caminho]
      if (atual === undefined || a.tamanho > atual) mapa[a.caminho] = a.tamanho
    }
  }
  return mapa
}

/** Autores unicos que commitaram apos `shaDe` ate `shaAte` inclusive. */
function autoresEntre(
  cronologicos: CommitBruto[],
  shaDe: string | null,
  shaAte: string,
): string[] {
  const fim = cronologicos.findIndex((c) => c.sha === shaAte)
  if (fim === -1) return []

  const inicio =
    shaDe === null ? 0 : cronologicos.findIndex((c) => c.sha === shaDe) + 1

  const nomes = new Set<string>()
  for (let i = Math.max(inicio, 0); i <= fim; i++) {
    const autor = cronologicos[i]?.autor
    if (autor) nomes.add(autor)
  }
  return [...nomes]
}
