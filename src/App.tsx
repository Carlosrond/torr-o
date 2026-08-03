import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/componentes/AppShell'
import { RotaProtegida } from '@/componentes/RotaProtegida'
import { ProvedorAuth } from '@/hooks/useAuth'
import Clientes from '@/paginas/Clientes'
import Login from '@/paginas/Login'
import NovoPedido from '@/paginas/NovoPedido'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function EmBreve({ nome }: { nome: string }) {
  return <p className="p-6 text-stone-500">{nome} — em construção</p>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorAuth>
        <BrowserRouter>
          <Routes>
            <Route path="/entrar" element={<Login />} />
            <Route
              element={
                <RotaProtegida>
                  <AppShell />
                </RotaProtegida>
              }
            >
              <Route path="/" element={<NovoPedido />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/painel" element={<EmBreve nome="Painel" />} />
              <Route
                path="/precos"
                element={
                  <RotaProtegida soAdmin>
                    <EmBreve nome="Tabela de preços" />
                  </RotaProtegida>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProvedorAuth>
    </QueryClientProvider>
  )
}
