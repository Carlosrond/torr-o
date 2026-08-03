import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const ABAS = [
  { para: '/', rotulo: 'Pedido' },
  { para: '/clientes', rotulo: 'Clientes' },
  { para: '/painel', rotulo: 'Painel' },
  { para: '/precos', rotulo: 'Preços' },
]

export function AppShell() {
  const { sair } = useAuth()
  return (
    <div className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <span className="text-lg font-bold">Torrão</span>
        <button onClick={sair} className="text-sm text-stone-500 underline">
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-3xl">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 grid grid-cols-4 border-t border-stone-200 bg-white">
        {ABAS.map((aba) => (
          <NavLink
            key={aba.para}
            to={aba.para}
            end={aba.para === '/'}
            className={({ isActive }) =>
              `py-3 text-center text-sm ${isActive ? 'font-semibold text-amber-800' : 'text-stone-500'}`
            }
          >
            {aba.rotulo}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
