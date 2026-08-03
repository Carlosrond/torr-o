import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Cartao } from '@/componentes/Cartao'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useClientes } from '@/hooks/useClientes'
import { useConsignado } from '@/hooks/useConsignado'
import { usePedidos } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { hojeIso } from '@/lib/data'
import { diasParado, previsaoReposicao, saldoKg, saldoPorSku } from '@/lib/consignado'
import { porCliente } from '@/lib/insights'
import { oportunidadeFaixa } from '@/lib/recompra'
import { prazoMedioPonderado } from '@/lib/prazo'
import { ROTULO_CANAL, ROTULO_CONDICAO, SKUS } from '@/lib/tipos'

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataCurta = (iso: string) => iso.split('-').reverse().join('/')

export default function FichaCliente() {
  const { id = '' } = useParams()
  const { data: clientes, isLoading: carregandoClientes, error } = useClientes()
  const { data: pedidos, isLoading: carregandoPedidos } = usePedidos()
  const { data: faixas } = usePrecos()
  const { data: movimentos } = useConsignado(id || null)

  const hoje = hojeIso()
  const cliente = (clientes ?? []).find((c) => c.id === id) ?? null

  // filtra direto de PedidoCompleto (mantém o `id`, usado na lista de histórico)
  const doCliente = useMemo(
    () =>
      (pedidos ?? []).filter((pedido) => pedido.clienteId === id && pedido.status !== 'cancelado'),
    [pedidos, id],
  )

  if (carregandoClientes || carregandoPedidos) return <Carregando />
  if (error) return <Erro mensagem={error.message} />
  if (!cliente) return <Erro mensagem="Cliente não encontrado." />

  const linha = porCliente(doCliente, { [id]: cliente.cadenciaDeclaradaDias }, hoje)[0] ?? null
  const kgTipico = linha?.previsao.qtdSugeridaKg ?? 0
  const oportunidade =
    faixas && kgTipico > 0 ? oportunidadeFaixa(faixas, '500g', kgTipico, hoje) : null
  const prazoMedio = prazoMedioPonderado(
    doCliente.map((pedido) => ({
      data: pedido.data,
      condicao: pedido.condicao,
      totalValor: pedido.totalValor,
    })),
  )
  const movs = movimentos ?? []
  const saldo = saldoPorSku(movs)
  const temConsignado = SKUS.some((sku) => saldo[sku] !== 0)

  return (
    <div className="space-y-6 p-4">
      <div>
        <Link to="/clientes" className="text-sm text-stone-500 underline">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-bold">{cliente.nome}</h1>
        <p className="text-sm text-stone-500">
          {ROTULO_CANAL[cliente.canal]} · {ROTULO_CONDICAO[cliente.condicaoPadrao]}
          {cliente.cidade ? ` · ${cliente.cidade}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cartao
          titulo="Cadência"
          valor={linha?.previsao.cadenciaDias === null || !linha ? '—' : `${linha.previsao.cadenciaDias} dias`}
          detalhe={linha?.previsao.origemCadencia === 'declarada' ? 'informada' : 'calculada'}
        />
        <Cartao
          titulo="Próxima compra"
          valor={
            linha?.previsao.proximaCompraPrevista
              ? dataCurta(linha.previsao.proximaCompraPrevista)
              : '—'
          }
          detalhe={
            linha && linha.previsao.atrasoDias !== null && linha.previsao.atrasoDias > 0
              ? `${linha.previsao.atrasoDias} dias de atraso`
              : undefined
          }
          alerta={!!linha && (linha.previsao.atrasoDias ?? -1) > 0}
        />
        <Cartao
          titulo="Sugerir"
          valor={
            linha?.previsao.qtdSugeridaKg === null || !linha
              ? '—'
              : `${linha.previsao.qtdSugeridaKg.toLocaleString('pt-BR')} kg`
          }
        />
        <Cartao
          titulo="Prazo médio"
          valor={prazoMedio === null ? '—' : `${prazoMedio} dias`}
          detalhe="ponderado por R$"
        />
      </div>

      {oportunidade && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Argumento de venda: com {oportunidade.kgFaltando.toLocaleString('pt-BR')} kg a mais, o
          pacote de 500g cai de {reais(oportunidade.precoAtual)} para{' '}
          {reais(oportunidade.precoMelhor)} — {reais(oportunidade.economiaPorPacote)} por pacote.
        </p>
      )}

      {temConsignado && (
        <section>
          <h2 className="mb-2 font-semibold">Consignado</h2>
          <div className="grid grid-cols-2 gap-3">
            <Cartao titulo="Saldo no cliente" valor={`${saldoKg(movs).toLocaleString('pt-BR')} kg`} />
            <Cartao
              titulo="Parado há"
              valor={diasParado(movs, hoje) === null ? '—' : `${diasParado(movs, hoje)} dias`}
              alerta={(diasParado(movs, hoje) ?? 0) > 30}
            />
            <Cartao
              titulo="Acaba em"
              valor={previsaoReposicao(movs, hoje) ? dataCurta(previsaoReposicao(movs, hoje)!) : '—'}
              detalhe="no ritmo apurado"
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Histórico de pedidos</h2>
        {doCliente.length === 0 ? (
          <Vazio mensagem="Esse cliente ainda não comprou." />
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
            {[...doCliente]
              .sort((a, b) => b.data.localeCompare(a.data))
              .map((pedido) => (
                <li key={pedido.id} className="flex justify-between p-3 text-sm">
                  <span>
                    {dataCurta(pedido.data)} · {ROTULO_CONDICAO[pedido.condicao]}
                  </span>
                  <span>
                    {pedido.totalKg.toLocaleString('pt-BR')} kg · {reais(pedido.totalValor)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  )
}
