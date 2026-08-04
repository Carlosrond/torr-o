import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/componentes/AppShell'
import { RotaProtegida } from '@/componentes/RotaProtegida'
import { ProvedorAuth } from '@/hooks/useAuth'
import Clientes from '@/paginas/Clientes'
import Comissao from '@/paginas/Comissao'
import Consignado from '@/paginas/Consignado'
import Equipe from '@/paginas/Equipe'
import FichaCliente from '@/paginas/FichaCliente'
import Hoje from '@/paginas/Hoje'
import Login from '@/paginas/Login'
import Mais from '@/paginas/Mais'
import NovoPedido from '@/paginas/NovoPedido'
import Painel from '@/paginas/Painel'
import Produtos from '@/paginas/Produtos'
import Relatorio from '@/paginas/Relatorio'
import Romaneio from '@/paginas/Romaneio'
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
            {/* fora do AppShell de propósito: romaneio é papel, não tela de app -- sem nav pra esconder na impressão */}
            <Route
              path="/romaneio/:id"
              element={
                <RotaProtegida>
                  <Romaneio />
                </RotaProtegida>
              }
            />
            <Route
              element={
                <RotaProtegida>
                  <AppShell />
                </RotaProtegida>
              }
            >
              <Route path="/" element={<Hoje />} />
              <Route path="/pedido" element={<NovoPedido />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/:id" element={<FichaCliente />} />
              <Route path="/consignado" element={<Consignado />} />
              <Route path="/painel" element={<Painel />} />
              <Route path="/mais" element={<Mais />} />
              <Route path="/comissao" element={<Comissao />} />
              <Route path="/relatorio" element={<Relatorio />} />
              <Route
                path="/precos"
                element={
                  <RotaProtegida soAdmin>
                    <TabelaPrecos />
                  </RotaProtegida>
                }
              />
              <Route
                path="/produtos"
                element={
                  <RotaProtegida soAdmin>
                    <Produtos />
                  </RotaProtegida>
                }
              />
              <Route
                path="/equipe"
                element={
                  <RotaProtegida soAdmin>
                    <Equipe />
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
