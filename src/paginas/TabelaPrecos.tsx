import { useState } from 'react'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useSalvarFaixas, usePrecos, type NovaFaixa } from '@/hooks/usePrecos'
import { hojeIso } from '@/lib/data'
import { SKUS, type FaixaPreco, type Sku } from '@/lib/tipos'

interface LinhaForm {
  sku: Sku
  kgMin: string
  kgMax: string
  precoUnit: string
}

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Faixas em vigor hoje: para cada (sku, kgMin), a versão mais recente já vigente. */
function vigentesHoje(faixas: FaixaPreco[], hoje: string): FaixaPreco[] {
  const porChave = new Map<string, FaixaPreco>()
  for (const faixa of faixas.filter((f) => f.vigenteDesde <= hoje)) {
    const chave = `${faixa.sku}|${faixa.kgMin}`
    const atual = porChave.get(chave)
    if (!atual || faixa.vigenteDesde > atual.vigenteDesde) porChave.set(chave, faixa)
  }
  return [...porChave.values()].sort(
    (a, b) => a.sku.localeCompare(b.sku) || a.kgMin - b.kgMin,
  )
}

export default function TabelaPrecos() {
  const { data: faixas, isLoading, error } = usePrecos()
  const salvar = useSalvarFaixas()
  const [vigenteDesde, setVigenteDesde] = useState(hojeIso())
  const [linhas, setLinhas] = useState<LinhaForm[]>([])
  const [erroForm, setErroForm] = useState<string | null>(null)

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />

  const emVigor = vigentesHoje(faixas ?? [], hojeIso())

  function carregarDoAtual() {
    setLinhas(
      emVigor.map((faixa) => ({
        sku: faixa.sku,
        kgMin: String(faixa.kgMin),
        kgMax: faixa.kgMax === null ? '' : String(faixa.kgMax),
        precoUnit: String(faixa.precoUnit),
      })),
    )
  }

  function adicionarLinha() {
    setLinhas([...linhas, { sku: '250g', kgMin: '', kgMax: '', precoUnit: '' }])
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErroForm(null)
    const novas: NovaFaixa[] = linhas.map((linha) => ({
      sku: linha.sku,
      kgMin: Number(linha.kgMin),
      kgMax: linha.kgMax === '' ? null : Number(linha.kgMax),
      precoUnit: Number(linha.precoUnit),
      vigenteDesde,
    }))

    for (const faixa of novas) {
      if (!Number.isFinite(faixa.kgMin) || faixa.kgMin < 0) {
        setErroForm('Todo piso de faixa precisa ser um número maior ou igual a zero.')
        return
      }
      if (faixa.kgMax !== null && faixa.kgMax <= faixa.kgMin) {
        setErroForm('O teto da faixa tem que ser maior que o piso.')
        return
      }
      if (!Number.isFinite(faixa.precoUnit) || faixa.precoUnit <= 0) {
        setErroForm('Todo preço precisa ser maior que zero.')
        return
      }
    }

    for (const sku of SKUS) {
      const doSku = novas.filter((f) => f.sku === sku)
      if (doSku.length > 0 && !doSku.some((f) => f.kgMax === null)) {
        setErroForm(`Falta a faixa sem teto (o "51+ kg") do ${sku}, senão pedido grande fica sem preço.`)
        return
      }
    }

    // cobertura continua por SKU: sem furo e sem sobreposicao entre as faixas da nova versao
    const FOLGA = 0.001
    for (const sku of SKUS) {
      const doSku = novas.filter((f) => f.sku === sku).sort((a, b) => a.kgMin - b.kgMin)
      if (doSku.length === 0) continue

      if (doSku[0].kgMin !== 0) {
        setErroForm(`A tabela do ${sku} precisa começar em 0 kg — hoje a primeira faixa começa em ${doSku[0].kgMin} kg.`)
        return
      }

      for (let i = 0; i < doSku.length - 1; i++) {
        const atual = doSku[i]
        const seguinte = doSku[i + 1]
        if (atual.kgMax === null) {
          setErroForm(`A tabela do ${sku} tem faixa sem teto no meio — só a última faixa pode ser sem teto.`)
          return
        }
        const diferenca = seguinte.kgMin - atual.kgMax
        if (diferenca > FOLGA) {
          setErroForm(
            `A tabela do ${sku} tem um furo entre ${atual.kgMax} kg e ${seguinte.kgMin} kg — pedido nessa faixa ficaria sem preço.`,
          )
          return
        }
        if (diferenca < -FOLGA) {
          setErroForm(
            `A tabela do ${sku} tem sobreposição entre ${atual.kgMin}–${atual.kgMax} kg e ${seguinte.kgMin}–${seguinte.kgMax ?? 'sem teto'} kg.`,
          )
          return
        }
      }

      if (doSku[doSku.length - 1].kgMax !== null) {
        setErroForm(`A última faixa do ${sku} precisa ser sem teto (o "51+ kg").`)
        return
      }
    }

    await salvar.mutateAsync(novas)
    setLinhas([])
  }

  return (
    <div className="space-y-6 p-4">
      <section>
        <h1 className="text-xl font-bold">Tabela de preços em vigor</h1>
        {emVigor.length === 0 ? (
          <Vazio mensagem="Nenhuma faixa cadastrada." />
        ) : (
          <table className="mt-3 w-full overflow-hidden rounded-xl bg-white text-sm shadow">
            <thead className="bg-stone-100 text-left">
              <tr>
                <th className="p-2">Pacote</th>
                <th className="p-2">Faixa (kg do pedido)</th>
                <th className="p-2">Preço</th>
                <th className="p-2">Desde</th>
              </tr>
            </thead>
            <tbody>
              {emVigor.map((faixa) => (
                <tr key={faixa.id} className="border-t border-stone-200">
                  <td className="p-2">{faixa.sku}</td>
                  <td className="p-2">
                    {faixa.kgMin} – {faixa.kgMax === null ? 'sem teto' : faixa.kgMax}
                  </td>
                  <td className="p-2">{reais(faixa.precoUnit)}</td>
                  <td className="p-2">{faixa.vigenteDesde.split('-').reverse().join('/')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form onSubmit={enviar} className="space-y-3 rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Nova versão da tabela</h2>
        <p className="text-sm text-stone-500">
          Salvar cria uma versão nova. Os pedidos já lançados continuam com o preço que tiveram.
        </p>

        <label className="block text-sm">
          Vigente a partir de
          <input
            type="date"
            required
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={carregarDoAtual}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            Copiar a tabela atual
          </button>
          <button
            type="button"
            onClick={adicionarLinha}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            + Faixa
          </button>
        </div>

        {linhas.map((linha, indice) => (
          <div key={indice} className="grid grid-cols-4 gap-2">
            <select
              value={linha.sku}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, sku: e.target.value as Sku }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            >
              {SKUS.map((sku) => (
                <option key={sku} value={sku}>
                  {sku}
                </option>
              ))}
            </select>
            <input
              placeholder="kg min"
              inputMode="decimal"
              value={linha.kgMin}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, kgMin: e.target.value }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
            <input
              placeholder="kg max"
              inputMode="decimal"
              value={linha.kgMax}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, kgMax: e.target.value }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
            <input
              placeholder="preço"
              inputMode="decimal"
              value={linha.precoUnit}
              onChange={(e) => {
                const copia = [...linhas]
                copia[indice] = { ...linha, precoUnit: e.target.value }
                setLinhas(copia)
              }}
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
          </div>
        ))}

        {erroForm && <p className="text-sm text-red-700">{erroForm}</p>}
        {salvar.error && <p className="text-sm text-red-700">{salvar.error.message}</p>}

        <button
          type="submit"
          disabled={linhas.length === 0 || salvar.isPending}
          className="w-full rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
        >
          {salvar.isPending ? 'Salvando…' : 'Salvar nova versão'}
        </button>
      </form>
    </div>
  )
}
