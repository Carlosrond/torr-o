import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth, type Papel } from '@/hooks/useAuth'

// nav inferior tem no máximo 5 itens (limite de leitura no celular); o resto
// (Painel, admin e ação de sair) mora dentro de "Mais".
// Admin troca Consignado por Entregas na barra — Consignado segue no menu Mais e na
// Ficha do Cliente. Motorista tem só Entregas: é a única tela dele.
const ABAS_POR_PAPEL: Record<Papel, { para: string; rotulo: string }[]> = {
  admin: [
    { para: '/', rotulo: 'Hoje' },
    { para: '/pedido', rotulo: 'Pedido' },
    { para: '/clientes', rotulo: 'Clientes' },
    { para: '/entregas', rotulo: 'Entregas' },
  ],
  vendedor: [
    { para: '/', rotulo: 'Hoje' },
    { para: '/pedido', rotulo: 'Pedido' },
    { para: '/clientes', rotulo: 'Clientes' },
    { para: '/consignado', rotulo: 'Consignado' },
  ],
  motorista: [{ para: '/entregas', rotulo: 'Entregas' }],
}

const ROTAS_DENTRO_DE_MAIS = ['/painel', '/comissao', '/relatorio', '/consignado', '/precos', '/produtos', '/equipe']

const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Admin',
  vendedor: 'Vendedor',
  motorista: 'Motorista',
}

export function AppShell() {
  const { nome, papel, sair } = useAuth()
  const { pathname } = useLocation()
  const maisAtivo = pathname === '/mais' || ROTAS_DENTRO_DE_MAIS.some((rota) => pathname.startsWith(rota))

  // papel ainda carregando: usa as abas de vendedor como neutro (nenhuma é exclusiva de admin)
  const abas = ABAS_POR_PAPEL[papel ?? 'vendedor']
  // motorista não tem "Mais": nada lá dentro é dele, e Sair já está no cabeçalho
  const mostraMais = papel !== 'motorista'
  const colunas = abas.length + (mostraMais ? 1 : 0)

  return (
    <div className="min-h-screen bg-stone-50 pb-16 text-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <div>
          <span className="text-lg font-bold">Torrão</span>
          {nome && (
            <p className="text-xs text-stone-600">
              {nome}
              {papel && ` · ${ROTULO_PAPEL[papel]}`}
            </p>
          )}
        </div>
        <button onClick={sair} className="min-h-11 text-sm text-stone-700 underline">
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-3xl">
        <Outlet />
      </main>

      {/* colunas variam com o papel (motorista tem 1 aba) -- grid-cols fixo deixaria a aba estreita num canto */}
      <nav
        className="fixed bottom-0 left-0 right-0 grid border-t border-stone-200 bg-white"
        style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}
      >
        {abas.map((aba) => (
          <NavLink
            key={aba.para}
            to={aba.para}
            end={aba.para === '/'}
            className={({ isActive }) =>
              `px-1 py-3 text-center text-sm ${isActive ? 'font-semibold text-amber-800' : 'text-stone-700'}`
            }
          >
            {aba.rotulo}
          </NavLink>
        ))}
        {mostraMais && (
          <Link
            to="/mais"
            className={`px-1 py-3 text-center text-sm ${maisAtivo ? 'font-semibold text-amber-800' : 'text-stone-700'}`}
          >
            Mais
          </Link>
        )}
      </nav>
    </div>
  )
}
