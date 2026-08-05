import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/componentes/AppShell'
import { RotaProtegida } from '@/componentes/RotaProtegida'
import { ProvedorAuth } from '@/hooks/useAuth'
import Clientes from '@/paginas/Clientes'
import Comissao from '@/paginas/Comissao'
import Consignado from '@/paginas/Consignado'
import Entregas from '@/paginas/Entregas'
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

/** Telas de venda: motorista não entra em nenhuma delas. */
const VENDA = ['admin', 'vendedor'] as const

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProvedorAuth>
        <BrowserRouter>
          <Routes>
            <Route path="/entrar" element={<Login />} />
            {/* fora do AppShell de propósito: romaneio é papel, não tela de app -- sem nav pra esconder na impressão.
                Sem restrição de papel aqui: a RLS decide o que cada um consegue carregar. */}
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
              <Route
                path="/"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <Hoje />
                  </RotaProtegida>
                }
              />
              <Route
                path="/pedido"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <NovoPedido />
                  </RotaProtegida>
                }
              />
              <Route
                path="/clientes"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <Clientes />
                  </RotaProtegida>
                }
              />
              <Route
                path="/clientes/:id"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <FichaCliente />
                  </RotaProtegida>
                }
              />
              <Route
                path="/consignado"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <Consignado />
                  </RotaProtegida>
                }
              />
              <Route
                path="/entregas"
                element={
                  <RotaProtegida papeis={['admin', 'motorista']}>
                    <Entregas />
                  </RotaProtegida>
                }
              />
              <Route
                path="/painel"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <Painel />
                  </RotaProtegida>
                }
              />
              {/* sem restrição: o próprio menu já mostra só o que o papel acessa */}
              <Route path="/mais" element={<Mais />} />
              <Route
                path="/comissao"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <Comissao />
                  </RotaProtegida>
                }
              />
              <Route
                path="/relatorio"
                element={
                  <RotaProtegida papeis={[...VENDA]}>
                    <Relatorio />
                  </RotaProtegida>
                }
              />
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
