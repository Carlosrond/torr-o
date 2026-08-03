import { useMemo, useState } from 'react'
import { BlocoPrazo } from '@/componentes/BlocoPrazo'
import { Cartao } from '@/componentes/Cartao'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { usePedidos } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { addDias, hojeIso } from '@/lib/data'
import {
  apenasValidos,
  baseDeClientes,
  mixPorSku,
  noPeriodo,
  porCanal,
  precoRealizadoVsTabela,
  rankingClientes,
  resumo,
  seriePorSemana,
} from '@/lib/metricas-venda'
import { ROTULO_CANAL } from '@/lib/tipos'

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const kgTexto = (valor: number) => `${valor.toLocaleString('pt-BR')} kg`
const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

const JANELAS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 365, rotulo: '12 meses' },
]

export default function Painel() {
  const { data: pedidos, isLoading, error } = usePedidos()
  const { data: faixas } = usePrecos()
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
      mix: mixPorSku(janela),
      serie: seriePorSemana(janela),
      ranking: rankingClientes(janela, 5),
      canais: porCanal(janela),
      base: baseDeClientes(validos, inicio, hoje),
    }
  }, [pedidos, faixas, inicio, hoje])

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />
  if ((pedidos ?? []).length === 0)
    return <Vazio mensagem="Nenhum pedido lançado ainda — o painel acende no primeiro pedido." />

  const { resumo: r, preco, mix, serie, ranking, canais, base } = dados
  const maiorReceitaSemana = Math.max(1, ...serie.map((s) => s.receita))

  return (
    <div className="space-y-6 p-4">
      <div className="flex gap-2">
        {JANELAS.map((janela) => (
          <button
            key={janela.dias}
            onClick={() => setDias(janela.dias)}
            className={`rounded-full px-4 py-1 text-sm ${
              dias === janela.dias ? 'bg-amber-800 text-white' : 'bg-white text-stone-600'
            }`}
          >
            {janela.rotulo}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Venda</h2>
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
                  ? `${preco.descontoPercentual}% abaixo da tabela`
                  : 'no preço de tabela'
                : undefined
            }
            alerta={!!preco && preco.descontoPercentual >= 5}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Mix de pacote</h2>
        <div className="grid grid-cols-2 gap-3">
          {mix.map((item) => (
            <Cartao
              key={item.sku}
              titulo={item.sku}
              valor={kgTexto(item.kg)}
              detalhe={`${item.pacotes} pacotes · ${reais(item.receita)}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Evolução semanal</h2>
        {serie.length === 0 ? (
          <Vazio mensagem="Sem pedido nessa janela." />
        ) : (
          <ul className="space-y-2 rounded-xl bg-white p-4 shadow">
            {serie.map((semana) => (
              <li key={semana.semana}>
                <div className="flex justify-between text-sm">
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
              <span>
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
              <span>
                {kgTexto(canal.kg)} · {reais(canal.receita)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <BlocoPrazo pedidos={dados.janela} />

      <section>
        <h2 className="mb-2 font-semibold">Base de clientes</h2>
        <div className="grid grid-cols-3 gap-3">
          <Cartao titulo="Ativos" valor={String(base.ativos)} />
          <Cartao titulo="Novos" valor={String(base.novos)} />
          <Cartao titulo="Perdidos" valor={String(base.perdidos)} alerta={base.perdidos > 0} />
        </div>
      </section>
    </div>
  )
}
