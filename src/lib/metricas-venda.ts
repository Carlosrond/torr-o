import { addDias, diffDias, segundaDaSemana } from './data'
import { arredondar2 } from './numero'
import { faixaVigente } from './preco'
import {
  KG_POR_SKU,
  SKUS,
  type Canal,
  type CondicaoPagamento,
  type FaixaPreco,
  type ItemPrecificado,
  type Sku,
  type StatusPedido,
} from './tipos'

export interface PedidoMetrica {
  data: string
  clienteId: string
  clienteNome: string
  canal: Canal
  condicao: CondicaoPagamento
  status: StatusPedido
  totalKg: number
  totalValor: number
  itens: ItemPrecificado[]
}

/** Pedido cancelado não entra em métrica nenhuma. */
export function apenasValidos(pedidos: PedidoMetrica[]): PedidoMetrica[] {
  return pedidos.filter((pedido) => pedido.status !== 'cancelado')
}

export function noPeriodo(
  pedidos: PedidoMetrica[],
  inicio: string,
  fim: string,
): PedidoMetrica[] {
  return pedidos.filter((pedido) => pedido.data >= inicio && pedido.data <= fim)
}

export function resumo(pedidos: PedidoMetrica[]): {
  kg: number
  receita: number
  quantidade: number
  ticketMedio: number
  precoMedioKg: number
} {
  const kg = arredondar2(pedidos.reduce((soma, p) => soma + p.totalKg, 0))
  const receita = arredondar2(pedidos.reduce((soma, p) => soma + p.totalValor, 0))
  const quantidade = pedidos.length
  return {
    kg,
    receita,
    quantidade,
    ticketMedio: quantidade === 0 ? 0 : arredondar2(receita / quantidade),
    precoMedioKg: kg === 0 ? 0 : arredondar2(receita / kg),
  }
}

/**
 * Preço realizado vs tabela: expõe o desconto que o vendedor deu de fato.
 * O preço de tabela é reconstruído com a faixa vigente na data de cada pedido.
 */
export function precoRealizadoVsTabela(
  pedidos: PedidoMetrica[],
  faixas: FaixaPreco[],
): { realizadoKg: number; tabelaKg: number; descontoPercentual: number } | null {
  let kg = 0
  let realizado = 0
  let tabela = 0

  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const faixa = faixaVigente(faixas, item.sku, pedido.totalKg, pedido.data)
      if (!faixa) continue
      kg += KG_POR_SKU[item.sku] * item.qtdPacotes
      realizado += item.subtotal
      tabela += faixa.precoUnit * item.qtdPacotes
    }
  }

  if (kg === 0 || tabela === 0) return null
  const realizadoKg = arredondar2(realizado / kg)
  const tabelaKg = arredondar2(tabela / kg)
  return {
    realizadoKg,
    tabelaKg,
    descontoPercentual: arredondar2(((tabelaKg - realizadoKg) / tabelaKg) * 100),
  }
}

export function mixPorSku(
  pedidos: PedidoMetrica[],
): { sku: Sku; pacotes: number; kg: number; receita: number }[] {
  return SKUS.map((sku) => {
    const itens = pedidos.flatMap((p) => p.itens.filter((item) => item.sku === sku))
    const pacotes = itens.reduce((soma, item) => soma + item.qtdPacotes, 0)
    return {
      sku,
      pacotes,
      kg: arredondar2(pacotes * KG_POR_SKU[sku]),
      receita: arredondar2(itens.reduce((soma, item) => soma + item.subtotal, 0)),
    }
  })
}

export function seriePorSemana(
  pedidos: PedidoMetrica[],
): { semana: string; kg: number; receita: number }[] {
  const porSemana = new Map<string, { kg: number; receita: number }>()
  for (const pedido of pedidos) {
    const semana = segundaDaSemana(pedido.data)
    const atual = porSemana.get(semana) ?? { kg: 0, receita: 0 }
    porSemana.set(semana, {
      kg: atual.kg + pedido.totalKg,
      receita: atual.receita + pedido.totalValor,
    })
  }
  return [...porSemana.entries()]
    .map(([semana, valores]) => ({
      semana,
      kg: arredondar2(valores.kg),
      receita: arredondar2(valores.receita),
    }))
    .sort((a, b) => a.semana.localeCompare(b.semana))
}

export function rankingClientes(
  pedidos: PedidoMetrica[],
  limite: number,
): { clienteId: string; clienteNome: string; kg: number; receita: number }[] {
  const porCliente = new Map<string, { clienteNome: string; kg: number; receita: number }>()
  for (const pedido of pedidos) {
    const atual = porCliente.get(pedido.clienteId) ?? {
      clienteNome: pedido.clienteNome,
      kg: 0,
      receita: 0,
    }
    porCliente.set(pedido.clienteId, {
      clienteNome: pedido.clienteNome,
      kg: atual.kg + pedido.totalKg,
      receita: atual.receita + pedido.totalValor,
    })
  }
  return [...porCliente.entries()]
    .map(([clienteId, valores]) => ({
      clienteId,
      clienteNome: valores.clienteNome,
      kg: arredondar2(valores.kg),
      receita: arredondar2(valores.receita),
    }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, limite)
}

export function porCanal(
  pedidos: PedidoMetrica[],
): { canal: Canal; kg: number; receita: number }[] {
  const porCanalMapa = new Map<Canal, { kg: number; receita: number }>()
  for (const pedido of pedidos) {
    const atual = porCanalMapa.get(pedido.canal) ?? { kg: 0, receita: 0 }
    porCanalMapa.set(pedido.canal, {
      kg: atual.kg + pedido.totalKg,
      receita: atual.receita + pedido.totalValor,
    })
  }
  return [...porCanalMapa.entries()]
    .map(([canal, valores]) => ({
      canal,
      kg: arredondar2(valores.kg),
      receita: arredondar2(valores.receita),
    }))
    .sort((a, b) => b.receita - a.receita)
}

export type Periodo = 'hoje' | 'semana' | 'mes'

export interface JanelaPeriodo {
  inicio: string
  fim: string
  rotulo: string
}

const ROTULO_PERIODO: Record<Periodo, string> = {
  hoje: 'Hoje',
  semana: 'Esta semana',
  mes: 'Este mês',
}

/** Janela do período contando a partir de `hoje`. `semana` = segunda a hoje. `mes` = dia 1 a hoje. */
export function janelaPeriodo(periodo: Periodo, hoje: string): JanelaPeriodo {
  const inicio =
    periodo === 'hoje'
      ? hoje
      : periodo === 'semana'
        ? segundaDaSemana(hoje)
        : `${hoje.slice(0, 7)}-01`
  return { inicio, fim: hoje, rotulo: ROTULO_PERIODO[periodo] }
}

/** Janela imediatamente anterior, de mesmo tamanho, para comparação justa. */
export function janelaAnterior(janela: JanelaPeriodo): { inicio: string; fim: string } {
  const tamanho = diffDias(janela.inicio, janela.fim)
  return {
    inicio: addDias(janela.inicio, -(tamanho + 1)),
    fim: addDias(janela.inicio, -1),
  }
}

export interface Comparativo {
  atual: { kg: number; receita: number; quantidade: number }
  anterior: { kg: number; receita: number; quantidade: number }
  /** null quando o anterior foi zero — não dá para dividir por zero. */
  variacaoReceitaPct: number | null
  variacaoKgPct: number | null
}

function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return arredondar2(((atual - anterior) / anterior) * 100)
}

/** Compara o período selecionado com o período anterior de mesmo tamanho — a régua do "Hoje". */
export function comparativoPeriodo(
  pedidos: PedidoMetrica[],
  periodo: Periodo,
  hoje: string,
): Comparativo {
  const validos = apenasValidos(pedidos)
  const janela = janelaPeriodo(periodo, hoje)
  const anterior = janelaAnterior(janela)

  const atual = resumo(noPeriodo(validos, janela.inicio, janela.fim))
  const doAnterior = resumo(noPeriodo(validos, anterior.inicio, anterior.fim))

  return {
    atual: { kg: atual.kg, receita: atual.receita, quantidade: atual.quantidade },
    anterior: { kg: doAnterior.kg, receita: doAnterior.receita, quantidade: doAnterior.quantidade },
    variacaoReceitaPct: variacaoPercentual(atual.receita, doAnterior.receita),
    variacaoKgPct: variacaoPercentual(atual.kg, doAnterior.kg),
  }
}

/**
 * Base de clientes na janela. "Perdidos" compara com a janela anterior de mesmo tamanho:
 * comprou antes, não comprou agora.
 */
export function baseDeClientes(
  pedidos: PedidoMetrica[],
  inicio: string,
  fim: string,
): { ativos: number; novos: number; perdidos: number } {
  const validos = apenasValidos(pedidos)
  const tamanho = diffDias(inicio, fim)
  const inicioAnterior = addDias(inicio, -(tamanho + 1))
  const fimAnterior = addDias(inicio, -1)

  const naJanela = new Set(noPeriodo(validos, inicio, fim).map((p) => p.clienteId))
  const naAnterior = new Set(
    noPeriodo(validos, inicioAnterior, fimAnterior).map((p) => p.clienteId),
  )

  const primeiraCompra = new Map<string, string>()
  for (const pedido of validos) {
    const atual = primeiraCompra.get(pedido.clienteId)
    if (!atual || pedido.data < atual) primeiraCompra.set(pedido.clienteId, pedido.data)
  }

  let novos = 0
  for (const clienteId of naJanela) {
    const primeira = primeiraCompra.get(clienteId)
    if (primeira && primeira >= inicio && primeira <= fim) novos += 1
  }

  let perdidos = 0
  for (const clienteId of naAnterior) {
    if (!naJanela.has(clienteId)) perdidos += 1
  }

  return { ativos: naJanela.size, novos, perdidos }
}
