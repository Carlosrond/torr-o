import { useMemo, useState } from 'react'
import { Carregando, Erro } from '@/componentes/Estado'
import { useClientes } from '@/hooks/useClientes'
import { useCriarPedido } from '@/hooks/usePedidos'
import { usePrecos } from '@/hooks/usePrecos'
import { hojeIso } from '@/lib/data'
import { faixaVigente, kgTotal, precificar, totalPedido } from '@/lib/preco'
import { vencimentos } from '@/lib/prazo'
import { oportunidadeFaixa } from '@/lib/recompra'
import { ROTULO_CONDICAO, SKUS, type CondicaoPagamento, type ItemPrecificado, type Sku } from '@/lib/tipos'

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function NovoPedido() {
  const { data: clientes, isLoading: carregandoClientes, error: erroClientes } = useClientes()
  const { data: faixas, isLoading: carregandoPrecos, error: erroPrecos } = usePrecos()
  const criar = useCriarPedido()

  const [clienteId, setClienteId] = useState('')
  const [data, setData] = useState(hojeIso())
  const [quantidades, setQuantidades] = useState<Record<Sku, string>>({ '250g': '', '500g': '' })
  const [condicao, setCondicao] = useState<CondicaoPagamento | ''>('')
  const [observacao, setObservacao] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [precosManuais, setPrecosManuais] = useState<Record<Sku, string>>({ '250g': '', '500g': '' })
  const [salvo, setSalvo] = useState<string | null>(null)

  const cliente = (clientes ?? []).find((c) => c.id === clienteId) ?? null
  const condicaoEfetiva: CondicaoPagamento = condicao || cliente?.condicaoPadrao || 'avista'

  const itensInput = SKUS.map((sku) => ({ sku, qtdPacotes: Number(quantidades[sku]) || 0 })).filter(
    (item) => item.qtdPacotes > 0,
  )

  const calculo = useMemo(() => {
    if (!faixas || itensInput.length === 0) return null
    try {
      const daTabela = precificar(itensInput, faixas, data)
      const itens: ItemPrecificado[] = daTabela.map((item) => {
        const manual = Number(precosManuais[item.sku])
        if (!ajustando || !manual || manual <= 0) return item
        return {
          ...item,
          precoUnit: manual,
          subtotal: Math.round(manual * item.qtdPacotes * 100) / 100,
        }
      })
      return { itens, total: totalPedido(itens), tabela: daTabela }
    } catch (e) {
      return { erro: e instanceof Error ? e.message : 'Erro no cálculo' } as const
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faixas, JSON.stringify(itensInput), data, ajustando, JSON.stringify(precosManuais)])

  const kg = kgTotal(itensInput)
  const oportunidade =
    faixas && kg > 0 ? oportunidadeFaixa(faixas, '500g', kg, data) : null

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!calculo || 'erro' in calculo) return
    const id = await criar.mutateAsync({
      clienteId,
      data,
      condicao: condicaoEfetiva,
      status: 'entregue',
      observacao: observacao.trim() || null,
      totalKg: calculo.total.totalKg,
      totalValor: calculo.total.totalValor,
      itens: calculo.itens,
    })
    setSalvo(id)
    setQuantidades({ '250g': '', '500g': '' })
    setPrecosManuais({ '250g': '', '500g': '' })
    setObservacao('')
    setAjustando(false)
  }

  if (carregandoClientes || carregandoPrecos) return <Carregando />
  if (erroClientes) return <Erro mensagem={erroClientes.message} />
  if (erroPrecos) return <Erro mensagem={erroPrecos.message} />

  const ativos = (clientes ?? []).filter((c) => c.ativo)

  return (
    <form onSubmit={enviar} className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Novo pedido</h1>

      <select
        required
        value={clienteId}
        onChange={(e) => {
          setClienteId(e.target.value)
          setCondicao('')
          setSalvo(null)
        }}
        className="w-full rounded-lg border border-stone-300 px-3 py-3"
      >
        <option value="">Selecione o cliente…</option>
        {ativos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>

      <input
        type="date"
        required
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-3"
      />

      <div className="grid grid-cols-2 gap-3">
        {SKUS.map((sku) => (
          <label key={sku} className="text-sm text-stone-600">
            Pacotes de {sku}
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={quantidades[sku]}
              onChange={(e) => setQuantidades({ ...quantidades, [sku]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3 text-lg"
            />
          </label>
        ))}
      </div>

      <div className="rounded-xl bg-white p-4 shadow">
        <p className="text-sm text-stone-500">Volume do pedido</p>
        <p className="text-2xl font-bold">{kg.toLocaleString('pt-BR')} kg</p>

        {calculo && 'erro' in calculo && <p className="mt-2 text-sm text-red-700">{calculo.erro}</p>}

        {calculo && !('erro' in calculo) && (
          <>
            <ul className="mt-3 space-y-1 text-sm">
              {calculo.itens.map((item) => {
                const daTabela = calculo.tabela.find((t) => t.sku === item.sku)
                const alterado = daTabela && daTabela.precoUnit !== item.precoUnit
                return (
                  <li key={item.sku} className="flex justify-between">
                    <span>
                      {item.qtdPacotes} × {item.sku} a {reais(item.precoUnit)}
                      {alterado && (
                        <span className="text-amber-700"> (tabela {reais(daTabela!.precoUnit)})</span>
                      )}
                    </span>
                    <span>{reais(item.subtotal)}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-2xl font-bold">{reais(calculo.total.totalValor)}</p>
            {vencimentos(data, condicaoEfetiva, calculo.total.totalValor).length > 0 && (
              <p className="text-sm text-stone-500">
                Previsto entrar:{' '}
                {vencimentos(data, condicaoEfetiva, calculo.total.totalValor)
                  .map((v) => `${reais(v.valor)} em ${v.data.split('-').reverse().join('/')}`)
                  .join(' · ')}
              </p>
            )}
          </>
        )}

        {oportunidade && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Faltam {oportunidade.kgFaltando.toLocaleString('pt-BR')} kg para o pacote de 500g cair
            de {reais(oportunidade.precoAtual)} para {reais(oportunidade.precoMelhor)}.
          </p>
        )}
      </div>

      <select
        value={condicaoEfetiva}
        onChange={(e) => setCondicao(e.target.value as CondicaoPagamento)}
        className="w-full rounded-lg border border-stone-300 px-3 py-3"
      >
        {Object.entries(ROTULO_CONDICAO).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ajustando} onChange={(e) => setAjustando(e.target.checked)} />
        Ajustar preço manualmente
      </label>

      {ajustando && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            O desconto concedido aparece no painel como preço realizado abaixo da tabela.
          </p>
          {SKUS.map((sku) => (
            <label key={sku} className="block text-sm">
              Preço do {sku}
              <input
                type="number"
                min={0}
                step="0.01"
                value={precosManuais[sku]}
                onChange={(e) => setPrecosManuais({ ...precosManuais, [sku]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
      )}

      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação (opcional)"
        className="w-full rounded-lg border border-stone-300 px-3 py-2"
      />

      {criar.error && <Erro mensagem={criar.error.message} />}
      {salvo && <p className="text-sm font-medium text-green-700">Pedido salvo.</p>}

      <button
        type="submit"
        disabled={!clienteId || itensInput.length === 0 || criar.isPending}
        className="w-full rounded-lg bg-amber-800 py-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {criar.isPending ? 'Salvando…' : 'Salvar pedido'}
      </button>

      {faixas && faixas.length > 0 && kg > 0 && !faixaVigente(faixas, '250g', kg, data) && (
        <p className="text-sm text-red-700">
          Não há faixa de preço cadastrada para 250g nessa data. Ajuste a tabela de preços.
        </p>
      )}
    </form>
  )
}
