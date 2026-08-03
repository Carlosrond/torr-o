import { arredondar2 } from './numero'
import { KG_POR_SKU, type FaixaPreco, type ItemPedidoInput, type ItemPrecificado, type Sku } from './tipos'

/** Kg total do pedido — é isso que define a faixa de volume. */
export function kgTotal(itens: ItemPedidoInput[]): number {
  const kg = itens.reduce((soma, item) => soma + KG_POR_SKU[item.sku] * item.qtdPacotes, 0)
  return arredondar2(kg)
}

/** Faixas do SKU que já estavam vigentes na data, da versão mais nova para a mais velha. */
function faixasDoSku(faixas: FaixaPreco[], sku: Sku, data: string): FaixaPreco[] {
  return faixas
    .filter((f) => f.sku === sku && f.vigenteDesde <= data)
    .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))
}

function contemKg(faixa: FaixaPreco, kg: number): boolean {
  return kg >= faixa.kgMin && (faixa.kgMax === null || kg <= faixa.kgMax)
}

/**
 * Faixa aplicável ao SKU, dado o kg TOTAL do pedido e a data.
 * Entre versões concorrentes, ganha a de `vigenteDesde` mais recente que seja <= data.
 */
export function faixaVigente(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTotalPedido: number,
  data: string,
): FaixaPreco | null {
  return faixasDoSku(faixas, sku, data).find((f) => contemKg(f, kgTotalPedido)) ?? null
}

/** Faixa imediatamente melhor que a atual — vira argumento de venda ("faltam X kg"). */
export function proximaFaixa(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTotalPedido: number,
  data: string,
): FaixaPreco | null {
  const atual = faixaVigente(faixas, sku, kgTotalPedido, data)
  if (!atual) return null
  const acima = faixasDoSku(faixas, sku, data).filter((f) => f.kgMin > atual.kgMin)
  if (acima.length === 0) return null
  const menorPiso = Math.min(...acima.map((f) => f.kgMin))
  // entre versões do mesmo piso, a mais recente que já vigia na data
  return (
    acima
      .filter((f) => f.kgMin === menorPiso)
      .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0] ?? null
  )
}

/** Precifica os itens aplicando a faixa do kg total. Congela o preço no item. */
export function precificar(
  itens: ItemPedidoInput[],
  faixas: FaixaPreco[],
  data: string,
): ItemPrecificado[] {
  const total = kgTotal(itens)
  return itens
    .filter((item) => item.qtdPacotes > 0)
    .map((item) => {
      const faixa = faixaVigente(faixas, item.sku, total, data)
      if (!faixa) {
        throw new Error(`Sem faixa de preço para ${item.sku} com ${total} kg em ${data}`)
      }
      return {
        sku: item.sku,
        qtdPacotes: item.qtdPacotes,
        precoUnit: faixa.precoUnit,
        subtotal: arredondar2(faixa.precoUnit * item.qtdPacotes),
      }
    })
}

export function totalPedido(itens: ItemPrecificado[]): { totalKg: number; totalValor: number } {
  return {
    totalKg: kgTotal(itens),
    totalValor: arredondar2(itens.reduce((soma, item) => soma + item.subtotal, 0)),
  }
}
