export type Sku = '250g' | '500g'

/** Peso em kg de cada pacote. Fonte única — nunca escrever 0.25 solto no código. */
export const KG_POR_SKU: Record<Sku, number> = { '250g': 0.25, '500g': 0.5 }

export const SKUS: Sku[] = ['250g', '500g']

export type Canal = 'loja_rondelli' | 'revenda' | 'bar_padaria' | 'hotel' | 'consumidor'

export const ROTULO_CANAL: Record<Canal, string> = {
  loja_rondelli: 'Loja Rondelli',
  revenda: 'Revenda',
  bar_padaria: 'Bar / Padaria',
  hotel: 'Hotel',
  consumidor: 'Consumidor final',
}

export type CondicaoPagamento =
  | 'avista'
  | 'prazo_7'
  | 'prazo_14'
  | 'prazo_28'
  | 'prazo_30'
  | 'prazo_30_60'
  | 'consignado'

export const ROTULO_CONDICAO: Record<CondicaoPagamento, string> = {
  avista: 'À vista',
  prazo_7: '7 dias',
  prazo_14: '14 dias',
  prazo_28: '28 dias',
  prazo_30: '30 dias',
  prazo_30_60: '30/60 dias',
  consignado: 'Consignado',
}

export type StatusPedido = 'aberto' | 'entregue' | 'cancelado'

export type TipoMovConsignado = 'entrega' | 'venda_apurada' | 'retorno'

export interface FaixaPreco {
  id: string
  sku: Sku
  /** Piso da faixa, em kg do pedido inteiro. */
  kgMin: number
  /** Teto da faixa em kg; null = sem teto. */
  kgMax: number | null
  /** Preço do pacote nessa faixa. */
  precoUnit: number
  /** ISO YYYY-MM-DD. */
  vigenteDesde: string
}

export interface ItemPedidoInput {
  sku: Sku
  qtdPacotes: number
}

export interface ItemPrecificado {
  sku: Sku
  qtdPacotes: number
  precoUnit: number
  subtotal: number
}
