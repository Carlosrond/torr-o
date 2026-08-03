import { addDias, diffDias } from './data'
import { arredondar2 } from './numero'
import { KG_POR_SKU, SKUS, type Sku, type TipoMovConsignado } from './tipos'

export interface MovConsignado {
  sku: Sku
  tipo: TipoMovConsignado
  qtdPacotes: number
  data: string
}

const SINAL: Record<TipoMovConsignado, number> = {
  entrega: 1,
  venda_apurada: -1,
  retorno: -1,
}

/**
 * Saldo em pacotes por SKU. Sempre calculado pela soma dos movimentos —
 * campo `saldo` guardado dessincroniza, soma não.
 */
export function saldoPorSku(movs: MovConsignado[]): Record<Sku, number> {
  const saldo = Object.fromEntries(SKUS.map((sku) => [sku, 0])) as Record<Sku, number>
  for (const mov of movs) {
    saldo[mov.sku] += SINAL[mov.tipo] * mov.qtdPacotes
  }
  return saldo
}

export function saldoKg(movs: MovConsignado[]): number {
  const saldo = saldoPorSku(movs)
  return arredondar2(SKUS.reduce((soma, sku) => soma + saldo[sku] * KG_POR_SKU[sku], 0))
}

function kgDe(movs: MovConsignado[]): number {
  return arredondar2(movs.reduce((soma, m) => soma + m.qtdPacotes * KG_POR_SKU[m.sku], 0))
}

function primeiraEntrega(movs: MovConsignado[]): string | null {
  const entregas = movs.filter((m) => m.tipo === 'entrega').map((m) => m.data).sort()
  return entregas[0] ?? null
}

/** Ritmo de venda no cliente: kg apurado ÷ dias desde a primeira entrega. */
export function vendaApuradaDiariaKg(movs: MovConsignado[], hoje: string): number | null {
  const apuradas = movs.filter((m) => m.tipo === 'venda_apurada')
  const inicio = primeiraEntrega(movs)
  if (apuradas.length === 0 || inicio === null) return null
  const dias = Math.max(1, diffDias(inicio, hoje))
  return arredondar2(kgDe(apuradas) / dias)
}

/** Dias que o saldo atual ainda cobre no ritmo apurado. Saldo zerado ou negativo = repor agora. */
export function diasRestantes(movs: MovConsignado[], hoje: string): number | null {
  const ritmo = vendaApuradaDiariaKg(movs, hoje)
  if (ritmo === null || ritmo <= 0) return null
  // saldo negativo é inconsistência de lançamento (apurou mais do que entregou);
  // nunca projetar data no passado — o recado operacional é "repor agora"
  return Math.max(0, Math.round(saldoKg(movs) / ritmo))
}

/** Giro: dias desde a última apuração — ou desde a primeira entrega, se nunca apurou. */
export function diasParado(movs: MovConsignado[], hoje: string): number | null {
  const apuradas = movs.filter((m) => m.tipo === 'venda_apurada').map((m) => m.data).sort()
  const referencia = apuradas[apuradas.length - 1] ?? primeiraEntrega(movs)
  if (!referencia) return null
  return diffDias(referencia, hoje)
}

/** Data prevista em que o saldo consignado acaba — o gatilho de reposição. */
export function previsaoReposicao(movs: MovConsignado[], hoje: string): string | null {
  const dias = diasRestantes(movs, hoje)
  if (dias === null) return null
  return addDias(hoje, dias)
}
