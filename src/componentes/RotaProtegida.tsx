import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Carregando, Erro } from './Estado'

export function RotaProtegida({
  children,
  soAdmin = false,
}: {
  children: ReactNode
  soAdmin?: boolean
}) {
  const { sessao, papel, ativo, carregando, erroPerfil } = useAuth()
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace />
  if (!ativo) {
    // a RLS já bloqueia tudo para conta desativada; sem esta mensagem o app ficaria
    // só com telas vazias e ninguém entenderia o motivo
    return <Erro mensagem="Seu acesso foi desativado. Fale com o administrador do Torrão." />
  }
  if (soAdmin && papel === null) {
    // falha de rede não pode rebaixar admin em silêncio nem girar para sempre: diz o que
    // aconteceu. A leitura do perfil tem retry e refaz sozinha ao voltar para a aba.
    if (erroPerfil) {
      return <Erro mensagem={`Não foi possível confirmar seu acesso de administrador: ${erroPerfil}`} />
    }
    // papel ainda carregando (sessao ja existe, mas o profile nao voltou) -- nao decide o redirect ainda
    return <Carregando />
  }
  if (soAdmin && papel !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
