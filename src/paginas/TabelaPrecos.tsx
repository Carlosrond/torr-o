import { useState } from 'react'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useSalvarFaixas, usePrecos, type NovaFaixa } from '@/hooks/usePrecos'
import { hojeIso } from '@/lib/data'
import { dataLonga, reais } from '@/lib/formato'
import { paraNumero } from '@/lib/numero'
import { MULTIPLO_KG, validarFaixas } from '@/lib/preco'
import { SKUS, type FaixaPreco, type Sku } from '@/lib/tipos'

interface LinhaForm {
  sku: Sku
  kgMin: string
  kgMax: string
  precoUnit: string
}

/**
 * Faixas em vigor hoje: para cada SKU, acha a maior vigenteDesde <= hoje e devolve
 * só as faixas daquela data — nunca mistura faixas de versões diferentes do mesmo SKU.
 */
function vigentesHoje(faixas: FaixaPreco[], hoje: string): FaixaPreco[] {
  const jaVigentes = faixas.filter((f) => f.vigenteDesde <= hoje)
  const versaoPorSku = new Map<string, string>()
  for (const faixa of jaVigentes) {
    const atual = versaoPorSku.get(faixa.sku)
    if (!atual || faixa.vigenteDesde > atual) versaoPorSku.set(faixa.sku, faixa.vigenteDesde)
  }
  return jaVigentes
    .filter((f) => f.vigenteDesde === versaoPorSku.get(f.sku))
    .sort((a, b) => a.sku.localeCompare(b.sku) || a.kgMin - b.kgMin)
}

/**
 * Normaliza faixas legado (ex.: 0–10, 10.001–50) para a grade fechada de 5 em 5: arredonda
 * cada teto para o múltiplo de 5 mais próximo, força a primeira faixa a começar em
 * MULTIPLO_KG e reconstrói a contiguidade (piso seguinte = teto anterior + MULTIPLO_KG),
 * preservando o preço de cada faixa na sua posição original.
 */
function normalizarParaGrade5(faixas: FaixaPreco[]): LinhaForm[] {
  const arredondar5 = (kg: number) => Math.round(kg / MULTIPLO_KG) * MULTIPLO_KG

  const linhas: LinhaForm[] = []
  for (const sku of SKUS) {
    const doSku = faixas.filter((f) => f.sku === sku).sort((a, b) => a.kgMin - b.kgMin)
    if (doSku.length === 0) continue

    let piso = MULTIPLO_KG
    doSku.forEach((faixa, indice) => {
      const ultima = indice === doSku.length - 1
      const tetoArredondado = faixa.kgMax === null ? piso : arredondar5(faixa.kgMax)
      const teto = ultima ? null : Math.max(tetoArredondado, piso + MULTIPLO_KG)
      linhas.push({
        sku,
        kgMin: String(piso),
        kgMax: teto === null ? '' : String(teto),
        precoUnit: String(faixa.precoUnit),
      })
      if (teto !== null) piso = teto + MULTIPLO_KG
    })
  }
  return linhas
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
  const jaExisteNaData = (faixas ?? []).some((f) => f.vigenteDesde === vigenteDesde)

  function carregarDoAtual() {
    setLinhas(normalizarParaGrade5(emVigor))
  }

  function adicionarLinha() {
    setLinhas([...linhas, { sku: '250g', kgMin: '', kgMax: '', precoUnit: '' }])
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErroForm(null)
    const novas: NovaFaixa[] = linhas.map((linha) => ({
      sku: linha.sku,
      kgMin: paraNumero(linha.kgMin),
      kgMax: linha.kgMax === '' ? null : paraNumero(linha.kgMax),
      precoUnit: paraNumero(linha.precoUnit),
      vigenteDesde,
    }))

    const erro = validarFaixas(novas)
    if (erro) {
      setErroForm(erro)
      return
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
                  <td className="p-2">{dataLonga(faixa.vigenteDesde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form onSubmit={enviar} className="space-y-3 rounded-xl bg-white p-4 shadow">
        <h2 className="font-semibold">Nova versão da tabela</h2>
        <p className="text-sm text-stone-500">
          Salvar substitui inteiramente a versão gravada nesta data de vigência. Datas
          anteriores continuam intactas como histórico dos pedidos já lançados.
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

        <p className="text-sm text-stone-500">
          Faixas fechadas de 5 em 5 (o pedido é sempre múltiplo de 5 kg): 5 a 25, 30 a 50, 55 sem
          teto.
        </p>

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

        {jaExisteNaData && (
          <p className="text-sm text-amber-800">
            Já existe uma tabela com vigência em {dataLonga(vigenteDesde)}. Salvar vai
            substituí-la.
          </p>
        )}
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
