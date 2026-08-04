import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Cartao } from '@/componentes/Cartao'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useClientes } from '@/hooks/useClientes'
import { useApurarConsignado, useConsignado } from '@/hooks/useConsignado'
import { useCancelarPedido, usePedidos } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { useProdutos } from '@/hooks/useProdutos'
import { hojeIso } from '@/lib/data'
import { diasParado, previsaoReposicao, saldoKg, saldoPorSku } from '@/lib/consignado'
import { dataLonga, kgTexto, reais } from '@/lib/formato'
import { porCliente } from '@/lib/insights'
import { paraNumero } from '@/lib/numero'
import { faixaVigente } from '@/lib/preco'
import { oportunidadeFaixa } from '@/lib/recompra'
import { prazoMedioPonderado } from '@/lib/prazo'
import { KG_POR_SKU, ROTULO_CANAL, ROTULO_CONDICAO, SKUS, type Produto, type Sku } from '@/lib/tipos'

/** Nome do produto pelo sku legado, com fallback pro rótulo do sku — cai fora só se o produto foi removido do catálogo. */
function nomeDoSku(produtos: Produto[], sku: Sku): string {
  return produtos.find((p) => p.skuLegado === sku)?.nome ?? sku
}

export default function FichaCliente() {
  const { id = '' } = useParams()
  const { data: clientes, isLoading: carregandoClientes, error: erroClientes } = useClientes()
  const { data: pedidos, isLoading: carregandoPedidos, error: erroPedidos } = usePedidos()
  const { data: faixas, error: erroPrecos } = usePrecos()
  const { data: produtos } = useProdutos()
  const { data: movimentos } = useConsignado(id || null)
  const apurar = useApurarConsignado()
  const cancelar = useCancelarPedido()

  const [skuApuracao, setSkuApuracao] = useState<Sku>(SKUS[0])
  const [qtdApuracao, setQtdApuracao] = useState('')
  const [dataApuracao, setDataApuracao] = useState(hojeIso())
  const [tipoApuracao, setTipoApuracao] = useState<'venda_apurada' | 'retorno'>('venda_apurada')
  const [erroApuracao, setErroApuracao] = useState<string | null>(null)

  const hoje = hojeIso()
  const cliente = (clientes ?? []).find((c) => c.id === id) ?? null

  // filtra direto de PedidoCompleto (mantém o `id`, usado na lista de histórico)
  const doCliente = useMemo(
    () =>
      (pedidos ?? []).filter((pedido) => pedido.clienteId === id && pedido.status !== 'cancelado'),
    [pedidos, id],
  )

  if (carregandoClientes || carregandoPedidos) return <Carregando />
  if (erroClientes) return <Erro mensagem={erroClientes.message} />
  if (erroPedidos) return <Erro mensagem={erroPedidos.message} />
  if (!cliente) return <Erro mensagem="Cliente não encontrado." />

  const linha = porCliente(doCliente, { [id]: cliente.cadenciaDeclaradaDias }, hoje)[0] ?? null
  const kgTipico = linha?.previsao.qtdSugeridaKg ?? 0

  // SKU que o cliente mais compra em kg no historico -- sem historico, nao ha sobre o que opinar
  const kgPorSkuHistorico: Record<Sku, number> = { '250g': 0, '500g': 0 }
  for (const pedido of doCliente) {
    for (const item of pedido.itens) {
      if (!item.sku) continue // produto novo (sem sku legado) nao entra nesta leitura por SKU
      kgPorSkuHistorico[item.sku] += KG_POR_SKU[item.sku] * item.qtdPacotes
    }
  }
  const skuMaisComprado = SKUS.filter((sku) => kgPorSkuHistorico[sku] > 0).reduce<Sku | null>(
    (melhor, atual) => (melhor === null || kgPorSkuHistorico[atual] > kgPorSkuHistorico[melhor] ? atual : melhor),
    null,
  )
  const oportunidade =
    faixas && skuMaisComprado && kgTipico > 0
      ? oportunidadeFaixa(faixas, skuMaisComprado, kgTipico, hoje)
      : null
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
  const skusComSaldo = SKUS.filter((sku) => saldo[sku] > 0)
  const diasParadoConsignado = diasParado(movs, hoje)
  const reposicaoConsignado = previsaoReposicao(movs, hoje)

  // valor do saldo consignado em R$: preco de tabela do SKU hoje (faixa de 1 pacote), sem desconto de
  // volume -- se algum SKU do saldo nao tiver faixa aplicavel na tabela, nao inventa valor (so kg)
  const faixasDosSaldos = skusComSaldo.map((sku) => ({
    sku,
    faixa: faixas ? faixaVigente(faixas, sku, KG_POR_SKU[sku], hoje) : null,
  }))
  const valorSaldoDisponivel = faixasDosSaldos.length > 0 && faixasDosSaldos.every((f) => f.faixa !== null)
  const valorSaldoConsignado = valorSaldoDisponivel
    ? faixasDosSaldos.reduce((soma, f) => soma + f.faixa!.precoUnit * saldo[f.sku], 0)
    : null

  async function registrarApuracao(evento: React.FormEvent) {
    evento.preventDefault()
    setErroApuracao(null)
    const qtd = paraNumero(qtdApuracao)
    if (!Number.isFinite(qtd) || qtd <= 0) {
      setErroApuracao('A quantidade precisa ser maior que zero.')
      return
    }
    const saldoDoSku = saldo[skuApuracao] ?? 0
    if (qtd > saldoDoSku) {
      setErroApuracao(`Só há ${saldoDoSku} pacote(s) de ${skuApuracao} de saldo nesse cliente.`)
      return
    }
    try {
      await apurar.mutateAsync({
        clienteId: id,
        sku: skuApuracao,
        tipo: tipoApuracao,
        qtdPacotes: qtd,
        data: dataApuracao,
      })
      setQtdApuracao('')
    } catch (e) {
      setErroApuracao(e instanceof Error ? e.message : 'Erro ao registrar.')
    }
  }

  async function cancelarPedidoLancado(pedidoId: string) {
    if (!window.confirm('Cancelar esse pedido? Ele sai do painel e do histórico de venda.')) return
    await cancelar.mutateAsync(pedidoId)
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <Link to="/clientes" className="text-sm text-stone-700 underline">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-bold">{cliente.nome}</h1>
        <p className="text-sm text-stone-700">
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
              ? dataLonga(linha.previsao.proximaCompraPrevista)
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
              : kgTexto(linha.previsao.qtdSugeridaKg)
          }
        />
        <Cartao
          titulo="Prazo médio"
          valor={prazoMedio === null ? '—' : `${prazoMedio} dias`}
          detalhe="ponderado por R$"
        />
      </div>

      {erroPrecos && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Não foi possível carregar a tabela de preços — o argumento de venda e o valor do saldo
          consignado ficaram indisponíveis.
        </p>
      )}

      {oportunidade && skuMaisComprado && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm tabular-nums text-amber-900">
          Argumento de venda: com {kgTexto(oportunidade.kgFaltando)} a mais, o pacote de{' '}
          {nomeDoSku(produtos ?? [], skuMaisComprado)} cai de {reais(oportunidade.precoAtual)} para{' '}
          {reais(oportunidade.precoMelhor)} — {reais(oportunidade.economiaPorPacote)} por pacote.
        </p>
      )}

      {temConsignado && (
        <section>
          <h2 className="mb-2 font-semibold">Consignado</h2>
          <div className="grid grid-cols-2 gap-3">
            <Cartao
              titulo="Saldo no cliente"
              valor={kgTexto(saldoKg(movs))}
              detalhe={valorSaldoConsignado !== null ? reais(valorSaldoConsignado) : undefined}
            />
            <Cartao
              titulo="Parado há"
              valor={diasParadoConsignado === null ? '—' : `${diasParadoConsignado} dias`}
              alerta={(diasParadoConsignado ?? 0) > 30}
            />
            <Cartao
              titulo="Acaba em"
              valor={reposicaoConsignado ? dataLonga(reposicaoConsignado) : '—'}
              detalhe="no ritmo apurado"
            />
          </div>

          {skusComSaldo.length > 0 && (
            <form onSubmit={registrarApuracao} className="mt-3 space-y-2 rounded-xl bg-white p-4 shadow">
              <h3 className="text-sm font-semibold">Apurar consignado</h3>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={skuApuracao}
                  onChange={(e) => setSkuApuracao(e.target.value as Sku)}
                  className="rounded-lg border border-stone-300 px-2 py-3"
                >
                  {skusComSaldo.map((sku) => (
                    <option key={sku} value={sku}>
                      {nomeDoSku(produtos ?? [], sku)} ({saldo[sku]} pacotes em saldo)
                    </option>
                  ))}
                </select>
                <select
                  value={tipoApuracao}
                  onChange={(e) => setTipoApuracao(e.target.value as 'venda_apurada' | 'retorno')}
                  className="rounded-lg border border-stone-300 px-2 py-3"
                >
                  <option value="venda_apurada">Vendeu</option>
                  <option value="retorno">Devolveu</option>
                </select>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Qtd. pacotes"
                  value={qtdApuracao}
                  onChange={(e) => setQtdApuracao(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-3"
                />
                <input
                  type="date"
                  value={dataApuracao}
                  onChange={(e) => setDataApuracao(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-3"
                />
              </div>
              {erroApuracao && <p className="text-sm text-red-700">{erroApuracao}</p>}
              {apurar.error && <p className="text-sm text-red-700">{apurar.error.message}</p>}
              <button
                type="submit"
                disabled={apurar.isPending}
                className="w-full rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
              >
                {apurar.isPending ? 'Registrando…' : 'Registrar'}
              </button>
            </form>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Histórico de pedidos</h2>
        {doCliente.length === 0 ? (
          <Vazio mensagem="Esse cliente ainda não comprou. Lance o primeiro pedido em Pedido." />
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white shadow">
            {[...doCliente]
              .sort((a, b) => b.data.localeCompare(a.data))
              .map((pedido) => (
                <li key={pedido.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    {dataLonga(pedido.data)} · {ROTULO_CONDICAO[pedido.condicao]}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {kgTexto(pedido.totalKg)} · {reais(pedido.totalValor)}
                    <button
                      type="button"
                      onClick={() => cancelarPedidoLancado(pedido.id)}
                      disabled={cancelar.isPending}
                      className="text-xs text-stone-600 underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  )
}
