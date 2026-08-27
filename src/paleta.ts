// Cor por extensao de arquivo.
//
// A paleta e escolhida para funcionar em fundo escuro: matizes bem separados
// no circulo cromatico, saturacao alta o suficiente para distinguir bolinhas
// de 3 px, e luminosidade parecida entre si — assim nenhuma linguagem parece
// mais importante que outra por acidente.

export type Cor = { r: number; g: number; b: number }

function hex(codigo: string): Cor {
  const n = parseInt(codigo.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Extensao -> cor. Agrupadas por familia, nao por linguagem individual. */
const CORES: Record<string, string> = {
  // TypeScript e JavaScript — azul e amarelo, as duas familias mais comuns
  ts: '#3aa0ff',
  tsx: '#3aa0ff',
  mts: '#3aa0ff',
  cts: '#3aa0ff',
  js: '#f0c040',
  jsx: '#f0c040',
  mjs: '#f0c040',
  cjs: '#f0c040',

  // Estilo — rosa
  css: '#f06fb0',
  scss: '#f06fb0',
  sass: '#f06fb0',
  less: '#f06fb0',
  styl: '#f06fb0',

  // Marcacao — laranja
  html: '#ff8a4c',
  htm: '#ff8a4c',
  vue: '#6fd88f',
  svelte: '#ff8a4c',

  // Dados e configuracao — verde-agua
  json: '#4fd6c0',
  yml: '#4fd6c0',
  yaml: '#4fd6c0',
  toml: '#4fd6c0',
  xml: '#4fd6c0',
  ini: '#4fd6c0',
  env: '#4fd6c0',

  // Documentacao — cinza claro, deliberadamente discreto
  md: '#9fa8bd',
  mdx: '#9fa8bd',
  txt: '#9fa8bd',
  rst: '#9fa8bd',

  // Sistemas — roxo
  c: '#a78bfa',
  h: '#a78bfa',
  cc: '#a78bfa',
  cpp: '#a78bfa',
  hpp: '#a78bfa',
  rs: '#a78bfa',
  go: '#7ee0e0',
  zig: '#a78bfa',

  // Dinamicas — verde
  py: '#5fd97a',
  rb: '#e0553f',
  php: '#8b8bd8',
  lua: '#5fd97a',

  // JVM e .NET — vermelho-tijolo
  java: '#e08b4c',
  kt: '#e08b4c',
  scala: '#e0553f',
  cs: '#7bc86c',

  // Script de shell — verde-oliva
  sh: '#b8d95f',
  bash: '#b8d95f',
  zsh: '#b8d95f',
  ps1: '#b8d95f',

  // Imagem e midia — magenta
  svg: '#e07bd8',
  png: '#e07bd8',
  jpg: '#e07bd8',
  jpeg: '#e07bd8',
  gif: '#e07bd8',
  webp: '#e07bd8',
  ico: '#e07bd8',

  // Banco de dados
  sql: '#5fb0d9',
  prisma: '#5fb0d9',
}

/** Arquivo sem extensao conhecida. Neutro, nunca invisivel. */
const DESCONHECIDO = hex('#6b7280')

/** Pastas nao tem extensao: um cinza-azulado que nao compete com os arquivos. */
export const COR_PASTA = hex('#8f97b8')

const CACHE = new Map<string, Cor>()

/** Nome de arquivo -> cor. Cacheado porque roda para todo no, todo frame. */
export function corDe(caminho: string): Cor {
  const guardada = CACHE.get(caminho)
  if (guardada) return guardada

  const nome = caminho.slice(caminho.lastIndexOf('/') + 1)
  const ponto = nome.lastIndexOf('.')
  // "Makefile" e ".gitignore" nao tem extensao util.
  const ext = ponto > 0 ? nome.slice(ponto + 1).toLowerCase() : ''

  const codigo = CORES[ext]
  const cor = codigo ? hex(codigo) : DESCONHECIDO
  CACHE.set(caminho, cor)
  return cor
}

/** Quantas extensoes distintas a paleta conhece — usado nos testes. */
export function extensoesConhecidas(): string[] {
  return Object.keys(CORES)
}
