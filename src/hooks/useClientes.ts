import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Canal, CondicaoPagamento } from '@/lib/tipos'

export interface Cliente {
  id: string
  nome: string
  canal: Canal
  cidade: string | null
  whatsapp: string | null
  condicaoPadrao: CondicaoPagamento
  cadenciaDeclaradaDias: number | null
  ativo: boolean
}

export type ClienteInput = Omit<Cliente, 'id'> & { id?: string }

interface LinhaCliente {
  id: string
  nome: string
  canal: Canal
  cidade: string | null
  whatsapp: string | null
  condicao_padrao: CondicaoPagamento
  cadencia_declarada_dias: number | null
  ativo: boolean
}

function mapear(linha: LinhaCliente): Cliente {
  return {
    id: linha.id,
    nome: linha.nome,
    canal: linha.canal,
    cidade: linha.cidade,
    whatsapp: linha.whatsapp,
    condicaoPadrao: linha.condicao_padrao,
    cadenciaDeclaradaDias: linha.cadencia_declarada_dias,
    ativo: linha.ativo,
  }
}

export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, canal, cidade, whatsapp, condicao_padrao, cadencia_declarada_dias, ativo')
        .order('nome')
      if (error) throw new Error(error.message)
      return (data as LinhaCliente[]).map(mapear)
    },
  })
}

export function useSalvarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cliente: ClienteInput) => {
      const linha = {
        nome: cliente.nome,
        canal: cliente.canal,
        cidade: cliente.cidade,
        whatsapp: cliente.whatsapp,
        condicao_padrao: cliente.condicaoPadrao,
        cadencia_declarada_dias: cliente.cadenciaDeclaradaDias,
        ativo: cliente.ativo,
      }
      const resposta = cliente.id
        ? await supabase.from('clientes').update(linha).eq('id', cliente.id)
        : await supabase.from('clientes').insert(linha)
      if (resposta.error) throw new Error(resposta.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}
