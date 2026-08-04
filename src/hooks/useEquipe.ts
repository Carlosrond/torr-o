import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type PapelUsuario = 'admin' | 'vendedor'

export interface MembroEquipe {
  id: string
  nome: string
  email: string
  papel: PapelUsuario
  ativo: boolean
  clientesAtivos: number
  criadoEm: string
}

interface LinhaEquipe {
  id: string
  nome: string
  email: string
  papel: PapelUsuario
  ativo: boolean
  clientes_ativos: number
  criado_em: string
}

export function useEquipe(opcoes?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['equipe'],
    enabled: opcoes?.enabled,
    queryFn: async (): Promise<MembroEquipe[]> => {
      const { data, error } = await supabase.rpc('listar_equipe')
      if (error) throw new Error(error.message)
      return (data as LinhaEquipe[]).map((l) => ({
        id: l.id,
        nome: l.nome,
        email: l.email,
        papel: l.papel,
        ativo: l.ativo,
        clientesAtivos: l.clientes_ativos,
        criadoEm: l.criado_em,
      }))
    },
  })
}

async function chamarGerenciarUsuario(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gerenciar-usuario', { body })
  if (error) {
    // erro não-2xx: o corpo JSON com a mensagem em PT-BR vem em error.context (a Response)
    const contexto = (error as { context?: Response }).context
    const corpo = await contexto?.json().catch(() => null)
    throw new Error(corpo?.erro ?? error.message)
  }
  if (data?.erro) throw new Error(data.erro)
  return data
}

export function useCriarMembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; nome: string; papel: PapelUsuario; senha: string }) =>
      chamarGerenciarUsuario({ acao: 'criar', ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipe'] }),
  })
}

export function useAtualizarMembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      nome?: string
      papel?: PapelUsuario
      ativo?: boolean
      senha?: string
    }) => chamarGerenciarUsuario({ acao: 'atualizar', ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
      // desativar/reativar vendedor muda quais clientes aparecem pra ele e pro admin
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}
