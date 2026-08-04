import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Mais() {
  const { papel, sair } = useAuth()

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Mais</h1>

      <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-xl bg-white shadow">
        <li>
          <Link to="/comissao" className="block min-h-[44px] p-4">
            <p className="font-medium">Comissão</p>
            <p className="text-sm text-stone-500">Veja o que já fechou e o que ainda falta apurar.</p>
          </Link>
        </li>
        {papel === 'admin' && (
          <li>
            <Link to="/precos" className="block min-h-[44px] p-4">
              <p className="font-medium">Preços</p>
              <p className="text-sm text-stone-500">Tabela de preços por faixa de kg.</p>
            </Link>
          </li>
        )}
        {papel === 'admin' && (
          <li>
            <Link to="/equipe" className="block min-h-[44px] p-4">
              <p className="font-medium">Equipe</p>
              <p className="text-sm text-stone-500">Vendedores e administradores do time.</p>
            </Link>
          </li>
        )}
      </ul>

      <button
        onClick={sair}
        className="mt-6 min-h-[44px] w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left"
      >
        <p className="font-medium text-red-800">Sair</p>
        <p className="text-sm text-red-700">Encerrar sua sessão neste aparelho.</p>
      </button>
    </div>
  )
}
