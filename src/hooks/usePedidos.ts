import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
  condicao_pagamento: CondicaoPagamento
  status: StatusPedido
  total_kg: number
  total_valor: number
  clientes: { nome: string; canal: Canal } | null
  pedido_itens: {
    sku: Sku
    qtd_pacotes: number
    preco_unit_aplicado: number
    subtotal: number
  }[]
}

const SELECT_PEDIDO =
  'id, cliente_id, data, condicao_pagamento, status, total_kg, total_valor, clientes(nome, canal), pedido_itens(sku, qtd_pacotes, preco_unit_aplicado, subtotal)'

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
        condicao: linha.condicao_pagamento,
        status: linha.status,
        totalKg: Number(linha.total_kg),
        totalValor: Number(linha.total_valor),
        itens: linha.pedido_itens.map((item) => ({
          sku: item.sku,
          qtdPacotes: item.qtd_pacotes,
          precoUnit: Number(item.preco_unit_aplicado),
          subtotal: Number(item.subtotal),
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
  itens: ItemPrecificado[]
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
          sku: item.sku,
          qtd_pacotes: item.qtdPacotes,
          preco_unit_aplicado: item.precoUnit,
          subtotal: item.subtotal,
        })),
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
