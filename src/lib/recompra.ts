import { addDias, diffDias } from './data'
import { arredondar2 } from './numero'
import { faixaVigente, proximaFaixa } from './preco'
import type { FaixaPreco, Sku } from './tipos'

export interface PedidoHistorico {
  data: string
  totalKg: number
}

export type Confianca = 'sem_historico' | 'baixa' | 'media' | 'alta'
export type OrigemCadencia = 'calculada' | 'declarada' | 'nenhuma'

export interface PrevisaoRecompra {
  cadenciaDias: number | null
  origemCadencia: OrigemCadencia
  proximaCompraPrevista: string | null
  /** Positivo = a previsão já passou. É a chave de ordenação da lista de recompra. */
  atrasoDias: number | null
  qtdSugeridaKg: number | null
  confianca: Confianca
}

const PEDIDOS_PARA_CADENCIA = 5
const PEDIDOS_PARA_QUANTIDADE = 3
const DIAS_DE_ANTECEDENCIA = 3
const FATOR_RISCO = 1.5
const PISO_QUEDA = 0.7
/** Janela de comparação do sinal `caindo` — separada da janela de cadência de propósito. */
const PEDIDOS_PARA_QUEDA = 5

function ordenados(pedidos: PedidoHistorico[]): PedidoHistorico[] {
  return [...pedidos].sort((a, b) => a.data.localeCompare(b.data))
}

function confiancaDe(quantidade: number): Confianca {
  if (quantidade < 2) return 'sem_historico'
  if (quantidade < 3) return 'baixa'
  if (quantidade <= 5) return 'media'
  return 'alta'
}

function mediaKg(pedidos: PedidoHistorico[]): number {
  return arredondar2(pedidos.reduce((soma, p) => soma + p.totalKg, 0) / pedidos.length)
}

/**
 * Previsão de recompra por média móvel simples.
 * Sem sazonalidade e sem modelo — se o histórico revelar padrão mensal, troca-se aqui.
 */
export function prever(
  pedidos: PedidoHistorico[],
  cadenciaDeclaradaDias: number | null,
  hoje: string,
): PrevisaoRecompra {
  const lista = ordenados(pedidos)
  const confianca = confiancaDe(lista.length)

  if (lista.length === 0) {
    return {
      cadenciaDias: cadenciaDeclaradaDias,
      origemCadencia: cadenciaDeclaradaDias === null ? 'nenhuma' : 'declarada',
      proximaCompraPrevista: null,
      atrasoDias: null,
      qtdSugeridaKg: null,
      confianca,
    }
  }

  const ultimo = lista[lista.length - 1]
  const qtdSugeridaKg = mediaKg(lista.slice(-PEDIDOS_PARA_QUANTIDADE))

  let cadenciaDias: number | null = null
  let origemCadencia: OrigemCadencia = 'nenhuma'

  if (lista.length >= 2) {
    const recentes = lista.slice(-PEDIDOS_PARA_CADENCIA)
    const intervalos = recentes
      .slice(1)
      .map((pedido, indice) => diffDias(recentes[indice].data, pedido.data))
      // dois pedidos na mesma data (segundo pedido do dia, correcao de lancamento) dao
      // intervalo 0 -- descarta antes da media pra nao travar o cliente em cadencia 0
      .filter((d) => d > 0)
    if (intervalos.length > 0) {
      cadenciaDias = Math.round(intervalos.reduce((soma, d) => soma + d, 0) / intervalos.length)
      origemCadencia = 'calculada'
    } else if (cadenciaDeclaradaDias !== null) {
      cadenciaDias = cadenciaDeclaradaDias
      origemCadencia = 'declarada'
    }
  } else if (cadenciaDeclaradaDias !== null) {
    cadenciaDias = cadenciaDeclaradaDias
    origemCadencia = 'declarada'
  }

  const proximaCompraPrevista = cadenciaDias === null ? null : addDias(ultimo.data, cadenciaDias)

  return {
    cadenciaDias,
    origemCadencia,
    proximaCompraPrevista,
    atrasoDias: proximaCompraPrevista === null ? null : diffDias(proximaCompraPrevista, hoje),
    qtdSugeridaKg,
    confianca,
  }
}

export type Sinal = 'novo' | 'na_hora' | 'em_risco' | 'caindo' | 'ok'

/** Sinais que a tela usa para priorizar a ligação do vendedor. */
export function sinais(
  pedidos: PedidoHistorico[],
  previsao: PrevisaoRecompra,
  hoje: string,
): Sinal[] {
  const lista = ordenados(pedidos)
  const encontrados: Sinal[] = []

  // `novo` é rótulo de confiança, não curto-circuito: um cliente com cadência
  // declarada tem previsão válida e precisa acender na fila mesmo sem histórico.
  if (previsao.confianca === 'sem_historico') encontrados.push('novo')
  if (lista.length === 0) return encontrados

  const ultimo = lista[lista.length - 1]

  if (previsao.atrasoDias !== null && previsao.atrasoDias >= -DIAS_DE_ANTECEDENCIA) {
    encontrados.push('na_hora')
  }

  if (
    previsao.cadenciaDias !== null &&
    diffDias(ultimo.data, hoje) > previsao.cadenciaDias * FATOR_RISCO
  ) {
    encontrados.push('em_risco')
  }

  // compara com a média dos ANTERIORES: incluir o último na média mascararia a queda
  const anteriores = lista.slice(0, -1).slice(-PEDIDOS_PARA_QUEDA)
  if (anteriores.length > 0 && ultimo.totalKg < mediaKg(anteriores) * PISO_QUEDA) {
    encontrados.push('caindo')
  }

  return encontrados.length > 0 ? encontrados : ['ok']
}

export interface OportunidadeFaixa {
  kgFaltando: number
  precoAtual: number
  precoMelhor: number
  economiaPorPacote: number
}

/** Argumento de venda: quanto falta em kg para o cliente cair na faixa melhor. */
export function oportunidadeFaixa(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTipico: number,
  data: string,
): OportunidadeFaixa | null {
  const atual = faixaVigente(faixas, sku, kgTipico, data)
  const melhor = proximaFaixa(faixas, sku, kgTipico, data)
  if (!atual || !melhor || melhor.precoUnit >= atual.precoUnit) return null
  return {
    kgFaltando: arredondar2(melhor.kgMin - kgTipico),
    precoAtual: atual.precoUnit,
    precoMelhor: melhor.precoUnit,
    economiaPorPacote: arredondar2(atual.precoUnit - melhor.precoUnit),
  }
}
