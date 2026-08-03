import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FaixaPreco, Sku } from '@/lib/tipos'

interface LinhaFaixa {
  id: string
  sku: Sku
  kg_min: number
  kg_max: number | null
  preco_unit: number
  vigente_desde: string
}

export function usePrecos() {
  return useQuery({
    queryKey: ['precos'],
    queryFn: async (): Promise<FaixaPreco[]> => {
      const { data, error } = await supabase
        .from('precos_faixa')
        .select('id, sku, kg_min, kg_max, preco_unit, vigente_desde')
        .order('vigente_desde', { ascending: false })
        .order('kg_min')
      if (error) throw new Error(error.message)
      return (data as LinhaFaixa[]).map((linha) => ({
        id: linha.id,
        sku: linha.sku,
        kgMin: Number(linha.kg_min),
        kgMax: linha.kg_max === null ? null : Number(linha.kg_max),
        precoUnit: Number(linha.preco_unit),
        vigenteDesde: linha.vigente_desde,
      }))
    },
    // preço muda raramente; 5 min evita ida ao banco em cada tela de pedido
    staleTime: 5 * 60_000,
  })
}

export type NovaFaixa = Omit<FaixaPreco, 'id'>

/** Grava um lote de faixas como uma nova versão. Nunca faz UPDATE em faixa antiga. */
export function useSalvarFaixas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (faixas: NovaFaixa[]) => {
      const { error } = await supabase.from('precos_faixa').insert(
        faixas.map((f) => ({
          sku: f.sku,
          kg_min: f.kgMin,
          kg_max: f.kgMax,
          preco_unit: f.precoUnit,
          vigente_desde: f.vigenteDesde,
        })),
      )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['precos'] }),
  })
}
