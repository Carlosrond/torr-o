import { useMemo, useState } from 'react'
import { BlocoInsight } from '@/componentes/BlocoInsight'
import { BlocoPrazo } from '@/componentes/BlocoPrazo'
import { Cartao } from '@/componentes/Cartao'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useClientes } from '@/hooks/useClientes'
import { usePedidos } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { useProdutos } from '@/hooks/useProdutos'
import { addDias, hojeIso } from '@/lib/data'
import { dataCurta, kgTexto, numeroTexto, reais } from '@/lib/formato'
import { porCliente } from '@/lib/insights'
import {
  apenasValidos,
  baseDeClientes,
  mixPorProduto,
  noPeriodo,
  porCanal,
  precoRealizadoVsTabela,
  rankingClientes,
  resumo,
  seriePorSemana,
} from '@/lib/metricas-venda'
import { ROTULO_CANAL } from '@/lib/tipos'

const JANELAS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 365, rotulo: '12 meses' },
]

export default function Painel() {
  const { data: pedidos, isLoading, error } = usePedidos()
  const { data: faixas, error: erroPrecos } = usePrecos()
  const { data: clientes, error: erroClientes } = useClientes()
  const { data: produtos } = useProdutos()
  const [dias, setDias] = useState(30)

  const hoje = hojeIso()
  const inicio = addDias(hoje, -(dias - 1))

  const dados = useMemo(() => {
    const validos = apenasValidos(pedidos ?? [])
    const janela = noPeriodo(validos, inicio, hoje)
    return {
      validos,
      janela,
      resumo: resumo(janela),
      preco: faixas ? precoRealizadoVsTabela(janela, faixas) : null,
      mix: mixPorProduto(janela, produtos ?? []),
      serie: seriePorSemana(janela),
      ranking: rankingClientes(janela, 5),
      canais: porCanal(janela),
      base: baseDeClientes(validos, inicio, hoje),
    }
  }, [pedidos, faixas, produtos, inicio, hoje])

  const cadencias = useMemo(
    () =>
      Object.fromEntries(
        (clientes ?? []).map((cliente) => [cliente.id, cliente.cadenciaDeclaradaDias]),
      ),
    [clientes],
  )

  const linhasInsight = useMemo(
    () => porCliente(dados.validos, cadencias, hoje),
    [dados.validos, cadencias, hoje],
  )

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />
  if ((pedidos ?? []).length === 0)
    return <Vazio mensagem="Nenhum pedido lançado ainda — o painel acende no primeiro pedido." />

  const { resumo: r, preco, mix, serie, ranking, canais, base } = dados
  const maiorReceitaSemana = Math.max(1, ...serie.map((s) => s.receita))

  return (
    <div className="space-y-6 p-4">
      {erroPrecos && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Não foi possível carregar a tabela de preços — o indicador de desconto vs. tabela ficou
          indisponível.
        </p>
      )}
      {erroClientes && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Não foi possível carregar os clientes — a fila de ligação pode estar sem a cadência
          informada de alguns clientes.
        </p>
      )}

      <BlocoInsight linhas={linhasInsight} />

      <div className="flex gap-2">
        {JANELAS.map((janela) => (
          <button
            key={janela.dias}
            onClick={() => setDias(janela.dias)}
            className={`flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium ${
              dias === janela.dias ? 'bg-amber-800 text-white' : 'bg-white text-stone-600'
            }`}
          >
            {janela.rotulo}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Quanto vendeu</h2>
        <div className="grid grid-cols-2 gap-3">
          <Cartao titulo="Volume" valor={kgTexto(r.kg)} detalhe={`${r.quantidade} pedidos`} />
          <Cartao titulo="Receita" valor={reais(r.receita)} />
          <Cartao titulo="Ticket médio" valor={reais(r.ticketMedio)} />
          <Cartao
            titulo="Preço médio"
            valor={`${reais(r.precoMedioKg)}/kg`}
            detalhe={
              preco
                ? preco.descontoPercentual > 0
                  ? `${numeroTexto(preco.descontoPercentual)}% abaixo da tabela`
                  : 'no preço de tabela'
                : undefined
            }
            alerta={!!preco && preco.descontoPercentual >= 5}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Mix de produto</h2>
        {mix.length === 0 ? (
          <Vazio mensagem="Sem venda nessa janela." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mix.map((item) => (
              <Cartao
                key={item.produtoId ?? item.nome}
                titulo={item.nome}
                valor={kgTexto(item.kg)}
                detalhe={`${item.pacotes} pacotes · ${reais(item.receita)}`}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Evolução semanal</h2>
        {serie.length === 0 ? (
          <Vazio mensagem="Sem pedido nessa janela." />
        ) : (
          <ul className="space-y-2 rounded-xl bg-white p-4 shadow">
            {serie.map((semana) => (
              <li key={semana.semana}>
                <div className="flex justify-between text-sm tabular-nums">
                  <span>{dataCurta(semana.semana)}</span>
                  <span>
                    {kgTexto(semana.kg)} · {reais(semana.receita)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-stone-100">
                  <div
                    className="h-2 rounded bg-amber-700"
                    style={{ width: `${(semana.receita / maiorReceitaSemana) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Top 5 clientes</h2>
        <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
          {ranking.map((cliente) => (
            <li key={cliente.clienteId} className="flex justify-between p-3 text-sm">
              <span>{cliente.clienteNome}</span>
              <span className="tabular-nums">
                {kgTexto(cliente.kg)} · {reais(cliente.receita)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Por canal</h2>
        <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
          {canais.map((canal) => (
            <li key={canal.canal} className="flex justify-between p-3 text-sm">
              <span>{ROTULO_CANAL[canal.canal]}</span>
              <span className="tabular-nums">
                {kgTexto(canal.kg)} · {reais(canal.receita)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <BlocoPrazo pedidos={dados.janela} />

      <section>
        <h2 className="mb-2 font-semibold">Seus clientes</h2>
        <div className="grid grid-cols-3 gap-3">
          <Cartao titulo="Ativos" valor={String(base.ativos)} />
          <Cartao titulo="Novos" valor={String(base.novos)} />
          <Cartao titulo="Perdidos" valor={String(base.perdidos)} alerta={base.perdidos > 0} />
        </div>
      </section>
    </div>
  )
}
