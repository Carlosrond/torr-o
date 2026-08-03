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
  if (soAdmin && papel !== null && papel !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
