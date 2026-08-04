import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Carregando, Erro } from '@/componentes/Estado'
import { useClientes } from '@/hooks/useClientes'
import { useCriarPedido } from '@/hooks/usePedidos'
import { usePrecosProdutos } from '@/hooks/usePrecos'
import { useProdutos } from '@/hooks/useProdutos'
import { addDias, hojeIso } from '@/lib/data'
import { dataLonga, kgTexto, reais } from '@/lib/formato'
import { arredondar2, precoDigitado } from '@/lib/numero'
import {
  ehMultiploValido,
  kgMaisProximos,
  kgTotalProdutos,
  pacotesPorCaixa,
  precificarProdutos,
  totalPedidoProdutos,
  validarItensCaixa,
  type FaixaProduto,
  type ItemProdutoInput,
  type ItemProdutoPrecificado,
} from '@/lib/preco'
import { vencimentos } from '@/lib/prazo'
import { oportunidadeFaixaProduto } from '@/lib/recompra'
import { ROTULO_CONDICAO, type CondicaoPagamento, type Produto } from '@/lib/tipos'

/** Placeholder neutro quando o produto não tem foto — mesmo desenho da tela de Produtos. */
function FotoMiniatura({ produto }: { produto: Produto }) {
  if (produto.fotoUrl) {
    return (
      <img
        src={produto.fotoUrl}
        alt={`Foto do produto ${produto.nome}`}
        loading="lazy"
        className="aspect-square h-12 w-12 shrink-0 rounded-lg object-cover sm:h-14 sm:w-14"
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={`${produto.nome} — sem foto`}
      className="flex aspect-square h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400 sm:h-14 sm:w-14"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <rect x="5" y="8" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 8 V6 a4 4 0 0 1 8 0 v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  )
}

function ControleQuantidade({
  valor,
  passo,
  onChange,
}: {
  valor: string
  /** Pacotes por caixa de 5 kg: os botões andam de caixa em caixa, nunca de 1 em 1. */
  passo: number
  onChange: (novo: string) => void
}) {
  const numero = Number(valor) || 0
  // se o valor digitado está fora da grade, − e + arredondam pra caixa vizinha
  const anterior = Math.max(0, (Math.ceil(numero / passo) - 1) * passo)
  const proximo = (Math.floor(numero / passo) + 1) * passo
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(anterior === 0 ? '' : String(anterior))}
        aria-label={`Diminuir uma caixa (${passo} pacotes)`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-lg font-semibold text-stone-700"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        step={passo}
        inputMode="numeric"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-14 rounded-lg border border-stone-300 text-center text-lg"
      />
      <button
        type="button"
        onClick={() => onChange(String(proximo))}
        aria-label={`Aumentar uma caixa (${passo} pacotes)`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-300 text-lg font-semibold text-stone-700"
      >
        +
      </button>
    </div>
  )
}

export default function NovoPedido() {
  const { data: clientes, isLoading: carregandoClientes, error: erroClientes } = useClientes()
  const { data: produtos, isLoading: carregandoProdutos, error: erroProdutos } = useProdutos()
  const { data: faixas, isLoading: carregandoPrecos, error: erroPrecos } = usePrecosProdutos()
  const criar = useCriarPedido()
  const navegar = useNavigate()

  const [clienteId, setClienteId] = useState('')
  const [data, setData] = useState(hojeIso())
  // entrega prevista acompanha a data do pedido (mesmo dia é o caso comum), mas o
  // vendedor pode ajustar antes de salvar
  const [dataEntrega, setDataEntrega] = useState(hojeIso())
  useEffect(() => {
    setDataEntrega(data)
  }, [data])
  const [quantidades, setQuantidades] = useState<Record<string, string>>({})
  const [condicao, setCondicao] = useState<CondicaoPagamento | ''>('')
  const [observacao, setObservacao] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [precosManuais, setPrecosManuais] = useState<Record<string, string>>({})
  const [salvo, setSalvo] = useState<string | null>(null)

  const cliente = (clientes ?? []).find((c) => c.id === clienteId) ?? null
  const condicaoEfetiva: CondicaoPagamento = condicao || cliente?.condicaoPadrao || 'avista'

  // prazo padrão do retorno/apuração: recalcula sempre que troca o cliente ou a data,
  // mas o vendedor pode ajustar a mão antes de salvar
  const [prazoRetorno, setPrazoRetorno] = useState(() => addDias(data, cliente?.prazoConsignadoDias ?? 30))
  useEffect(() => {
    setPrazoRetorno(addDias(data, cliente?.prazoConsignadoDias ?? 30))
  }, [data, cliente?.id, cliente?.prazoConsignadoDias])

  const produtosAtivos = useMemo(() => (produtos ?? []).filter((p) => p.ativo), [produtos])

  const itensInput: ItemProdutoInput[] = produtosAtivos
    .map((p) => ({ produtoId: p.id, qtdPacotes: Number(quantidades[p.id]) || 0 }))
    .filter((item) => item.qtdPacotes > 0)

  const calculo = useMemo(() => {
    if (!faixas || !produtos || itensInput.length === 0) return null
    try {
      const daTabela = precificarProdutos(itensInput, produtos, faixas, data)
      const itens: ItemProdutoPrecificado[] = daTabela.map((item) => {
        if (!ajustando) return item
        const { valor } = precoDigitado(precosManuais[item.produtoId] ?? '')
        if (valor === null) return item
        return {
          ...item,
          precoUnit: valor,
          subtotal: arredondar2(valor * item.qtdPacotes),
        }
      })
      return { itens, total: totalPedidoProdutos(itens, produtos), tabela: daTabela }
    } catch (e) {
      return { erro: e instanceof Error ? e.message : 'Erro no cálculo' } as const
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faixas, produtos, JSON.stringify(itensInput), data, ajustando, JSON.stringify(precosManuais)])

  const kg = produtos ? kgTotalProdutos(itensInput, produtos) : 0

  // a caixa fecha POR PRODUTO: 5 pacotes de 250g (1,25 kg) nao existe na operacao
  const erroCaixa = produtos ? validarItensCaixa(itensInput, produtos) : null

  // preço digitado que não é preço não pode passar calado: trava o salvamento e diz o quê
  const erroPrecoManual = ajustando
    ? (itensInput
        .map((item) => precoDigitado(precosManuais[item.produtoId] ?? '').erro)
        .find((erro) => erro !== null) ?? null)
    : null

  // oportunidade pelo produto de MAIOR PESO presente no pedido — é o que mais pesa na faixa
  const produtoDeMaiorPeso = useMemo(() => {
    if (itensInput.length === 0 || !produtos) return null
    return itensInput.reduce<{ produtoId: string; pesoKg: number } | null>((melhor, item) => {
      const produto = produtos.find((p) => p.id === item.produtoId)
      if (!produto) return melhor
      if (!melhor || produto.pesoKg > melhor.pesoKg) return { produtoId: item.produtoId, pesoKg: produto.pesoKg }
      return melhor
    }, null)
  }, [itensInput, produtos])

  const oportunidade = useMemo(() => {
    if (!faixas || !produtoDeMaiorPeso || kg <= 0) return null
    return oportunidadeFaixaProduto(faixas as FaixaProduto[], produtoDeMaiorPeso.produtoId, kg, data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faixas, produtoDeMaiorPeso, kg, data])

  const nomeProduto = (produtoId: string) => produtos?.find((p) => p.id === produtoId)?.nome ?? produtoId

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!calculo || 'erro' in calculo || erroPrecoManual || erroCaixa) return
    const id = await criar.mutateAsync({
      clienteId,
      data,
      condicao: condicaoEfetiva,
      status: 'entregue',
      observacao: observacao.trim() || null,
      totalKg: calculo.total.totalKg,
      totalValor: calculo.total.totalValor,
      itens: calculo.itens,
      prazoRetorno: condicaoEfetiva === 'consignado' ? prazoRetorno : null,
      dataEntregaPrevista: dataEntrega,
    })
    setSalvo(id)
    setQuantidades({})
    setPrecosManuais({})
    setObservacao('')
    setAjustando(false)
  }

  if (carregandoClientes || carregandoProdutos || carregandoPrecos) return <Carregando />
  if (erroClientes) return <Erro mensagem={erroClientes.message} />
  if (erroProdutos) return <Erro mensagem={erroProdutos.message} />
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

      <label className="block text-sm text-stone-600">
        Entrega prevista
        <input
          type="date"
          required
          value={dataEntrega}
          onChange={(e) => setDataEntrega(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3"
        />
      </label>

      {produtosAtivos.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Nenhum produto ativo cadastrado. Cadastre em Mais → Produtos antes de lançar um pedido.
        </p>
      ) : (
        <ul className="space-y-2">
          {produtosAtivos.map((produto) => {
            const item = calculo && !('erro' in calculo) ? calculo.itens.find((i) => i.produtoId === produto.id) : null
            return (
              <li key={produto.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow">
                <FotoMiniatura produto={produto} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{produto.nome}</p>
                  <p className="text-xs text-stone-600">{kgTexto(produto.pesoKg)} por pacote</p>
                  {item && (
                    <p className="mt-1 text-sm tabular-nums text-stone-700">
                      {item.qtdPacotes} × {reais(item.precoUnit)} = <strong>{reais(item.subtotal)}</strong>
                    </p>
                  )}
                </div>
                <ControleQuantidade
                  valor={quantidades[produto.id] ?? ''}
                  passo={pacotesPorCaixa(produto.pesoKg) ?? 1}
                  onChange={(v) => setQuantidades({ ...quantidades, [produto.id]: v })}
                />
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-xl bg-white p-4 shadow">
        <p className="text-sm text-stone-700">Volume do pedido</p>
        <p className="text-2xl font-bold tabular-nums">{kgTexto(kg)}</p>

        {erroCaixa && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{erroCaixa}</p>
        )}

        {!erroCaixa && kg > 0 && !ehMultiploValido(kg) && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {(() => {
              const { abaixo, acima } = kgMaisProximos(kg)
              if (abaixo === null) {
                return `${kgTexto(kg)} não fecha caixa. O mínimo é ${kgTexto(acima)}.`
              }
              return `${kgTexto(kg)} não fecha caixa. O pedido é sempre em múltiplo de 5 kg — ajuste para ${kgTexto(abaixo)} ou ${kgTexto(acima)}.`
            })()}
          </p>
        )}

        {calculo && 'erro' in calculo && <p className="mt-2 text-sm text-red-700">{calculo.erro}</p>}

        {calculo && !('erro' in calculo) && (
          <>
            <p className="mt-3 text-2xl font-bold tabular-nums">{reais(calculo.total.totalValor)}</p>
            {vencimentos(data, condicaoEfetiva, calculo.total.totalValor).length > 0 && (
              <p className="text-sm text-stone-700">
                Previsto entrar:{' '}
                {vencimentos(data, condicaoEfetiva, calculo.total.totalValor)
                  .map((v) => `${reais(v.valor)} em ${dataLonga(v.data)}`)
                  .join(' · ')}
              </p>
            )}
          </>
        )}

        {oportunidade && produtoDeMaiorPeso && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm tabular-nums text-amber-900">
            Faltam {kgTexto(oportunidade.kgFaltando)} para o pacote de{' '}
            {nomeProduto(produtoDeMaiorPeso.produtoId)} cair de {reais(oportunidade.precoAtual)} para{' '}
            {reais(oportunidade.precoMelhor)}.
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

      {condicaoEfetiva === 'consignado' && (
        <label className="block text-sm text-stone-600">
          Retorno/apuração até
          <input
            type="date"
            required
            value={prazoRetorno}
            onChange={(e) => setPrazoRetorno(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3"
          />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ajustando} onChange={(e) => setAjustando(e.target.checked)} />
        Ajustar preço manualmente
      </label>

      {ajustando && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            O desconto concedido aparece no painel como preço realizado abaixo da tabela.
          </p>
          {itensInput.length === 0 ? (
            <p className="text-sm text-amber-900">Escolha a quantidade de um produto para ajustar o preço.</p>
          ) : (
            itensInput.map((item) => {
              const { erro } = precoDigitado(precosManuais[item.produtoId] ?? '')
              return (
                <label key={item.produtoId} className="block text-sm">
                  Preço do {nomeProduto(item.produtoId)}
                  {/* texto + inputMode decimal (não type=number): é assim que o resto do app
                      aceita vírgula, que é como se digita preço no Brasil */}
                  <input
                    inputMode="decimal"
                    placeholder="10,50"
                    value={precosManuais[item.produtoId] ?? ''}
                    onChange={(e) => setPrecosManuais({ ...precosManuais, [item.produtoId]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3"
                  />
                  {erro && <span className="mt-1 block text-red-700">{erro}</span>}
                </label>
              )
            })
          )}
        </div>
      )}

      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação (opcional)"
        className="w-full rounded-lg border border-stone-300 px-3 py-3"
      />

      {criar.error && <Erro mensagem={criar.error.message} />}

      {salvo ? (
        <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Pedido salvo.</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navegar(`/romaneio/${salvo}`)}
              className="min-h-11 rounded-lg bg-amber-800 py-3 text-sm font-semibold text-white"
            >
              Gerar romaneio
            </button>
            <button
              type="button"
              onClick={() => setSalvo(null)}
              className="min-h-11 rounded-lg border border-stone-300 bg-white py-3 text-sm font-semibold text-stone-700"
            >
              Lançar outro pedido
            </button>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          disabled={
            !clienteId ||
            itensInput.length === 0 ||
            !ehMultiploValido(kg) ||
            erroCaixa !== null ||
            erroPrecoManual !== null ||
            criar.isPending
          }
          className="w-full rounded-lg bg-amber-800 py-4 text-lg font-semibold text-white disabled:opacity-50"
        >
          {criar.isPending ? 'Salvando…' : 'Salvar pedido'}
        </button>
      )}
    </form>
  )
}
