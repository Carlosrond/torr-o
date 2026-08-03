import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MovConsignado } from '@/lib/consignado'
import type { Sku, TipoMovConsignado } from '@/lib/tipos'

interface LinhaMov {
  sku: Sku
  tipo: TipoMovConsignado
  qtd_pacotes: number
  data: string
}

export function useConsignado(clienteId: string | null) {
  return useQuery({
    queryKey: ['consignado', clienteId],
    enabled: clienteId !== null,
    queryFn: async (): Promise<MovConsignado[]> => {
      const { data, error } = await supabase
        .from('consignado_movimentos')
        .select('sku, tipo, qtd_pacotes, data')
        .eq('cliente_id', clienteId!)
        .order('data')
      if (error) throw new Error(error.message)
      return (data as LinhaMov[]).map((linha) => ({
        sku: linha.sku,
        tipo: linha.tipo,
        qtdPacotes: linha.qtd_pacotes,
        data: linha.data,
      }))
    },
  })
}

export interface ApuracaoConsignado {
  clienteId: string
  sku: Sku
  tipo: Extract<TipoMovConsignado, 'venda_apurada' | 'retorno'>
  qtdPacotes: number
  data: string
}

export function useApurarConsignado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (apuracao: ApuracaoConsignado) => {
      const { error } = await supabase.from('consignado_movimentos').insert({
        cliente_id: apuracao.clienteId,
        sku: apuracao.sku,
        tipo: apuracao.tipo,
        qtd_pacotes: apuracao.qtdPacotes,
        data: apuracao.data,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consignado'] }),
  })
}
