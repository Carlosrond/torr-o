import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/componentes/AppShell'
import { RotaProtegida } from '@/componentes/RotaProtegida'
import { ProvedorAuth } from '@/hooks/useAuth'
import Clientes from '@/paginas/Clientes'
import FichaCliente from '@/paginas/FichaCliente'
import Login from '@/paginas/Login'
import NovoPedido from '@/paginas/NovoPedido'
import Painel from '@/paginas/Painel'
import TabelaPrecos from '@/paginas/TabelaPrecos'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

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
              <Route path="/clientes/:id" element={<FichaCliente />} />
              <Route path="/painel" element={<Painel />} />
              <Route
                path="/precos"
                element={
                  <RotaProtegida soAdmin>
                    <TabelaPrecos />
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
