import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { arredondar2 } from '@/lib/numero'
import { KG_POR_SKU, SKUS, type Sku } from '@/lib/tipos'

export interface PendenciaConsignadoLinha {
  clienteId: string
  clienteNome: string
  whatsapp: string | null
  vendedorId: string
  prazoRetorno: string | null
  saldoPorSku: Record<Sku, number>
  saldoKg: number
  ultimaApuracao: string | null
  ultimaEntrega: string | null
}

interface LinhaRpc {
  cliente_id: string
  cliente_nome: string
  whatsapp: string | null
  vendedor_id: string
  prazo_retorno: string | null
  saldo_250g: number
  saldo_500g: number
  ultima_apuracao: string | null
  ultima_entrega: string | null
}

export function usePendenciasConsignado() {
  return useQuery({
    queryKey: ['pendencias-consignado'],
    queryFn: async (): Promise<PendenciaConsignadoLinha[]> => {
      const { data, error } = await supabase.rpc('pendencias_consignado')
      if (error) throw new Error(error.message)
      return (data as LinhaRpc[]).map((linha) => {
        const saldoPorSku: Record<Sku, number> = { '250g': linha.saldo_250g, '500g': linha.saldo_500g }
        return {
          clienteId: linha.cliente_id,
          clienteNome: linha.cliente_nome,
          whatsapp: linha.whatsapp,
          vendedorId: linha.vendedor_id,
          prazoRetorno: linha.prazo_retorno,
          saldoPorSku,
          saldoKg: arredondar2(
            SKUS.reduce((soma, sku) => soma + saldoPorSku[sku] * KG_POR_SKU[sku], 0),
          ),
          ultimaApuracao: linha.ultima_apuracao,
          ultimaEntrega: linha.ultima_entrega,
        }
      })
    },
  })
}
