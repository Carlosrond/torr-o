import { Cartao } from './Cartao'
import { Vazio } from './Estado'
import { dataCurta, diasTexto, numeroTexto, reais } from '@/lib/formato'
import type { PedidoMetrica } from '@/lib/metricas-venda'
import { arredondar2 } from '@/lib/numero'
import { caixaPrevistoPorSemana, prazoMedioDias, prazoMedioPonderado } from '@/lib/prazo'
import { ROTULO_CONDICAO, type CondicaoPagamento } from '@/lib/tipos'

export function BlocoPrazo({ pedidos }: { pedidos: PedidoMetrica[] }) {
  const paraPrazo = pedidos.map((pedido) => ({
    data: pedido.data,
    condicao: pedido.condicao,
    totalValor: pedido.totalValor,
  }))

  const prazoMedio = prazoMedioPonderado(paraPrazo)
  const caixa = caixaPrevistoPorSemana(paraPrazo)
  const receita = arredondar2(pedidos.reduce((soma, p) => soma + p.totalValor, 0))

  const porCondicao = new Map<CondicaoPagamento, number>()
  for (const pedido of pedidos) {
    porCondicao.set(pedido.condicao, (porCondicao.get(pedido.condicao) ?? 0) + pedido.totalValor)
  }
  const condicoes = [...porCondicao.entries()]
    .map(([condicao, valor]) => ({
      condicao,
      valor: arredondar2(valor),
      percentual: receita === 0 ? 0 : arredondar2((valor / receita) * 100),
    }))
    .sort((a, b) => b.valor - a.valor)

  const porCliente = new Map<string, { nome: string; valor: number; ponderado: number }>()
  for (const pedido of pedidos) {
    const prazo = prazoMedioDias(pedido.condicao)
    if (prazo === null) continue
    const atual = porCliente.get(pedido.clienteId) ?? {
      nome: pedido.clienteNome,
      valor: 0,
      ponderado: 0,
    }
    porCliente.set(pedido.clienteId, {
      nome: pedido.clienteNome,
      valor: atual.valor + pedido.totalValor,
      ponderado: atual.ponderado + pedido.totalValor * prazo,
    })
  }
  const prazoPorCliente = [...porCliente.values()]
    .map((cliente) => ({
      nome: cliente.nome,
      dias: cliente.valor === 0 ? 0 : arredondar2(cliente.ponderado / cliente.valor),
      valor: arredondar2(cliente.valor),
    }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 5)

  const maiorSemana = Math.max(1, ...caixa.map((semana) => semana.valor))

  return (
    <section className="space-y-4">
      <div>
        <h2 className="mb-1 font-semibold">Prazo e caixa</h2>
        <p className="text-sm text-stone-700">
          Previsto pela condição de pagamento. A cobrança e a baixa ficam no ERP que emite a NF.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cartao
          titulo="Prazo médio"
          valor={prazoMedio === null ? '—' : diasTexto(prazoMedio)}
          detalhe="ponderado por R$"
        />
        <Cartao
          titulo="Consignado"
          valor={`${numeroTexto(condicoes.find((c) => c.condicao === 'consignado')?.percentual ?? 0)}%`}
          detalhe="da receita — fora da previsão de caixa"
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-600">Venda por condição</h3>
        <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
          {condicoes.map((item) => (
            <li key={item.condicao} className="flex justify-between p-3 text-sm">
              <span>{ROTULO_CONDICAO[item.condicao]}</span>
              <span className="tabular-nums">
                {numeroTexto(item.percentual)}% · {reais(item.valor)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-600">Entrada prevista por semana</h3>
        {caixa.length === 0 ? (
          <Vazio mensagem="Nada previsto — só consignado nessa janela." />
        ) : (
          <ul className="space-y-2 rounded-xl bg-white p-4 shadow">
            {caixa.map((semana) => (
              <li key={semana.semana}>
                <div className="flex justify-between text-sm tabular-nums">
                  <span>{dataCurta(semana.semana)}</span>
                  <span>{reais(semana.valor)}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-stone-100">
                  <div
                    className="h-2 rounded bg-emerald-700"
                    style={{ width: `${(semana.valor / maiorSemana) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-600">
          Quem paga mais devagar (top 5)
        </h3>
        {prazoPorCliente.length === 0 ? (
          <Vazio mensagem="Sem venda a prazo nessa janela." />
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
            {prazoPorCliente.map((cliente) => (
              <li key={cliente.nome} className="flex justify-between p-3 text-sm">
                <span>{cliente.nome}</span>
                <span className="tabular-nums">
                  {diasTexto(cliente.dias)} · {reais(cliente.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
