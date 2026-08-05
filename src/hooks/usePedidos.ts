import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ItemProdutoPrecificado } from '@/lib/preco'
import type {
  Canal,
  CondicaoPagamento,
  ItemPrecificado,
  Sku,
  StatusPedido,
} from '@/lib/tipos'

export interface PedidoCompleto {
  id: string
  clienteId: string
  clienteNome: string
  canal: Canal
  data: string
  dataEntregaPrevista: string
  condicao: CondicaoPagamento
  status: StatusPedido
  totalKg: number
  totalValor: number
  itens: ItemPrecificado[]
}

interface LinhaPedido {
  id: string
  cliente_id: string
  data: string
  data_entrega_prevista: string | null
  condicao_pagamento: CondicaoPagamento
  status: StatusPedido
  total_kg: number
  total_valor: number
  clientes: { nome: string; canal: Canal } | null
  pedido_itens: {
    produto_id: string
    sku: Sku | null
    qtd_pacotes: number
    preco_unit_aplicado: number
    subtotal: number
    pedido_item_custos: unknown
  }[]
}

const SELECT_PEDIDO =
  'id, cliente_id, data, data_entrega_prevista, condicao_pagamento, status, total_kg, total_valor, clientes(nome, canal), pedido_itens(produto_id, sku, qtd_pacotes, preco_unit_aplicado, subtotal, pedido_item_custos(custo_unit_aplicado))'

/**
 * Custo congelado do item. Vem vazio para quem não é admin (a RLS de
 * `pedido_item_custos` só deixa admin ler) — isso não é erro, é a proteção funcionando.
 *
 * O PostgREST devolve OBJETO quando a FK também é PK (1-para-1) e ARRAY em outras
 * versões. Ler as duas formas em vez de assumir uma: assumir forma de resposta já
 * mascarou causa real de bug neste app antes.
 */
function custoDoItem(bruto: unknown): number | null {
  const linha = Array.isArray(bruto) ? bruto[0] : bruto
  const valor = (linha as { custo_unit_aplicado?: number } | null | undefined)?.custo_unit_aplicado
  return valor === undefined || valor === null ? null : Number(valor)
}

export function usePedidos() {
  return useQuery({
    queryKey: ['pedidos'],
    queryFn: async (): Promise<PedidoCompleto[]> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(SELECT_PEDIDO)
        .order('data', { ascending: false })
      if (error) throw new Error(error.message)
      return (data as unknown as LinhaPedido[]).map((linha) => ({
        id: linha.id,
        clienteId: linha.cliente_id,
        clienteNome: linha.clientes?.nome ?? '(cliente removido)',
        canal: linha.clientes?.canal ?? 'consumidor',
        data: linha.data,
        dataEntregaPrevista: linha.data_entrega_prevista ?? linha.data,
        condicao: linha.condicao_pagamento,
        status: linha.status,
        totalKg: Number(linha.total_kg),
        totalValor: Number(linha.total_valor),
        itens: linha.pedido_itens.map((item) => ({
          produtoId: item.produto_id,
          sku: item.sku,
          qtdPacotes: item.qtd_pacotes,
          precoUnit: Number(item.preco_unit_aplicado),
          subtotal: Number(item.subtotal),
          custoUnit: custoDoItem(item.pedido_item_custos),
        })),
      }))
    },
  })
}

export interface NovoPedido {
  clienteId: string
  data: string
  condicao: CondicaoPagamento
  status: StatusPedido
  observacao: string | null
  totalKg: number
  totalValor: number
  itens: ItemProdutoPrecificado[]
  /** Só faz sentido em consignado; para as demais condições vai null. */
  prazoRetorno: string | null
  dataEntregaPrevista: string
}

export function useCriarPedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pedido: NovoPedido): Promise<string> => {
      const { data, error } = await supabase.rpc('criar_pedido', {
        p_cliente_id: pedido.clienteId,
        p_data: pedido.data,
        p_condicao: pedido.condicao,
        p_status: pedido.status,
        p_observacao: pedido.observacao,
        p_total_kg: pedido.totalKg,
        p_total_valor: pedido.totalValor,
        p_itens: pedido.itens.map((item) => ({
          produto_id: item.produtoId,
          qtd_pacotes: item.qtdPacotes,
          preco_unit_aplicado: item.precoUnit,
          subtotal: item.subtotal,
        })),
        p_prazo_retorno: pedido.prazoRetorno,
        p_data_entrega_prevista: pedido.dataEntregaPrevista,
      })
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['consignado'] })
    },
  })
}

/** Cancela um pedido lançado errado — não apaga, só marca como cancelado. */
export function useCancelarPedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['consignado'] })
    },
  })
}
