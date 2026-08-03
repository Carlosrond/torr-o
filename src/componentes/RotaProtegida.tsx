import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Carregando } from './Estado'

export function RotaProtegida({
  children,
  soAdmin = false,
}: {
  children: ReactNode
  soAdmin?: boolean
}) {
  const { sessao, papel, carregando } = useAuth()
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace />
  // papel ainda carregando (sessao ja existe, mas o profile nao voltou) -- nao decide o redirect ainda
  if (soAdmin && papel === null) return <Carregando />
  if (soAdmin && papel !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
