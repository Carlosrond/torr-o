import { arredondar2 } from './numero'

/** Item de pedido com o custo congelado dele. `custoUnit` null = produto sem custo cadastrado no dia do pedido. */
export interface ItemComCusto {
  qtdPacotes: number
  subtotal: number
  custoUnit: number | null
}

export interface Margem {
  receita: number
  /** Custo só dos itens que têm custo congelado. */
  custo: number
  /** null quando algum item não tem custo — margem parcial engana mais do que informa. */
  margem: number | null
  margemPercentual: number | null
  /** true quando existe item e todo item tem custo congelado. */
  completa: boolean
}

export function margemDosItens(itens: ItemComCusto[]): Margem {
  const receita = arredondar2(itens.reduce((soma, i) => soma + i.subtotal, 0))
  const custo = arredondar2(itens.reduce((soma, i) => soma + (i.custoUnit ?? 0) * i.qtdPacotes, 0))
  // `!== null` e não falsy: custo 0 é custo informado (brinde, amostra), não ausência de custo
  const completa = itens.length > 0 && itens.every((i) => i.custoUnit !== null)
  const margem = completa ? arredondar2(receita - custo) : null
  return {
    receita,
    custo,
    margem,
    margemPercentual: margem !== null && receita > 0 ? arredondar2((margem / receita) * 100) : null,
    completa,
  }
}

export function margemDoPeriodo(pedidos: { itens: ItemComCusto[] }[]): Margem {
  return margemDosItens(pedidos.flatMap((p) => p.itens))
}
