import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Papel = 'admin' | 'vendedor'

interface Auth {
  sessao: Session | null
  usuarioId: string | null
  papel: Papel | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
}

const Contexto = createContext<Auth | null>(null)

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [papel, setPapel] = useState<Papel | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) {
      setPapel(null)
      return
    }
    supabase
      .from('profiles')
      .select('papel')
      .eq('id', sessao.user.id)
      .single()
      .then(({ data }) => setPapel((data?.papel as Papel) ?? 'vendedor'))
  }, [sessao])

  const valor: Auth = {
    sessao,
    usuarioId: sessao?.user.id ?? null,
    papel,
    carregando,
    entrar: async (email, senha) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw new Error('E-mail ou senha inválidos')
    },
    sair: async () => {
      await supabase.auth.signOut()
    },
  }

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth(): Auth {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useAuth precisa estar dentro de ProvedorAuth')
  return contexto
}
