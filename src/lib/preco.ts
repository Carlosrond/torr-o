import { arredondar2 } from './numero'
import { KG_POR_SKU, type FaixaPreco, type ItemPedidoInput, type ItemPrecificado, type Sku } from './tipos'

/** Kg total do pedido — é isso que define a faixa de volume. */
export function kgTotal(itens: ItemPedidoInput[]): number {
  const kg = itens.reduce((soma, item) => soma + KG_POR_SKU[item.sku] * item.qtdPacotes, 0)
  return arredondar2(kg)
}

/** Data de vigência mais recente que já vigia (<= data) entre as faixas do SKU. */
function versaoVigente(faixas: FaixaPreco[], sku: Sku, data: string): string | null {
  const datas = faixas.filter((f) => f.sku === sku && f.vigenteDesde <= data).map((f) => f.vigenteDesde)
  if (datas.length === 0) return null
  return datas.reduce((maisRecente, atual) => (atual > maisRecente ? atual : maisRecente))
}

/** Faixas do SKU que pertencem à versão vigente na data (não mistura versões). */
function faixasDoSku(faixas: FaixaPreco[], sku: Sku, data: string): FaixaPreco[] {
  const versao = versaoVigente(faixas, sku, data)
  if (versao === null) return []
  return faixas.filter((f) => f.sku === sku && f.vigenteDesde === versao)
}

function contemKg(faixa: FaixaPreco, kg: number): boolean {
  return kg >= faixa.kgMin && (faixa.kgMax === null || kg <= faixa.kgMax)
}

/**
 * Faixa aplicável ao SKU, dado o kg TOTAL do pedido e a data.
 * Reduz primeiro à versão (vigenteDesde) mais recente que já vigia na data e só então
 * procura a faixa que contém o kg — uma versão incompleta nunca cai na versão anterior.
 */
export function faixaVigente(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTotalPedido: number,
  data: string,
): FaixaPreco | null {
  return faixasDoSku(faixas, sku, data).find((f) => contemKg(f, kgTotalPedido)) ?? null
}

/** Faixa imediatamente melhor que a atual — vira argumento de venda ("faltam X kg"). */
export function proximaFaixa(
  faixas: FaixaPreco[],
  sku: Sku,
  kgTotalPedido: number,
  data: string,
): FaixaPreco | null {
  const atual = faixaVigente(faixas, sku, kgTotalPedido, data)
  if (!atual) return null
  const acima = faixasDoSku(faixas, sku, data).filter((f) => f.kgMin > atual.kgMin)
  if (acima.length === 0) return null
  const menorPiso = Math.min(...acima.map((f) => f.kgMin))
  return acima.find((f) => f.kgMin === menorPiso) ?? null
}

/** Precifica os itens aplicando a faixa do kg total. Congela o preço no item. */
export function precificar(
  itens: ItemPedidoInput[],
  faixas: FaixaPreco[],
  data: string,
): ItemPrecificado[] {
  const total = kgTotal(itens)
  return itens
    .filter((item) => item.qtdPacotes > 0)
    .map((item) => {
      const faixa = faixaVigente(faixas, item.sku, total, data)
      if (!faixa) {
        throw new Error(`Sem faixa de preço para ${item.sku} com ${total} kg em ${data}`)
      }
      return {
        sku: item.sku,
        qtdPacotes: item.qtdPacotes,
        precoUnit: faixa.precoUnit,
        subtotal: arredondar2(faixa.precoUnit * item.qtdPacotes),
      }
    })
}

/** Múltiplo em kg em que todo pedido é fechado — regra da operação, não da faixa de preço. */
export const MULTIPLO_KG = 5

/** Verdadeiro quando kg é múltiplo positivo de MULTIPLO_KG (tolerância de ponto flutuante). */
export function ehMultiploValido(kg: number): boolean {
  if (kg <= 0) return false
  const resto = kg % MULTIPLO_KG
  return resto < 0.001 || MULTIPLO_KG - resto < 0.001
}

/** Múltiplos de 5 imediatamente abaixo e acima de kg, para a tela sugerir ajuste. */
export function kgMaisProximos(kg: number): { abaixo: number | null; acima: number } {
  if (ehMultiploValido(kg)) return { abaixo: kg, acima: kg }
  const abaixo = Math.floor(kg / MULTIPLO_KG) * MULTIPLO_KG
  const acima = abaixo + MULTIPLO_KG
  return { abaixo: abaixo > 0 ? abaixo : null, acima }
}

export function totalPedido(itens: ItemPrecificado[]): { totalKg: number; totalValor: number } {
  return {
    totalKg: kgTotal(itens),
    totalValor: arredondar2(itens.reduce((soma, item) => soma + item.subtotal, 0)),
  }
}

/** Faixa de preço em edição na tela — ainda não tem id nem vigência confirmada. */
export interface FaixaParaValidar {
  sku: Sku
  kgMin: number
  kgMax: number | null
  precoUnit: number
}

/** Kg em gramas inteiros — elimina erro de ponto flutuante (25.001 - 25 !== 0.001 em JS). */
function paraGramas(kg: number): number {
  return Math.round(kg * 1000)
}

const MULTIPLO_G = paraGramas(MULTIPLO_KG)

/**
 * Valida a tabela de faixas na grade fechada de 5 em 5 kg (decisão: todo pedido já é
 * múltiplo de MULTIPLO_KG, então o teto de uma faixa e o piso da seguinte são volumes
 * consecutivos reais — não um "furo" de ponto flutuante). Devolve a primeira mensagem de
 * erro em PT-BR, ou null se a tabela está válida. Valida só os SKUs presentes na lista.
 */
export function validarFaixas(faixas: FaixaParaValidar[]): string | null {
  const skusPresentes = [...new Set(faixas.map((f) => f.sku))]

  for (const sku of skusPresentes) {
    const doSku = faixas.filter((f) => f.sku === sku)

    for (const f of doSku) {
      if (!Number.isFinite(f.precoUnit) || f.precoUnit <= 0) {
        return `O preço da faixa de ${f.kgMin} kg do ${sku} está vazio ou inválido. Use vírgula ou ponto, por exemplo 10,50.`
      }
    }

    for (const f of doSku) {
      const valores = f.kgMax === null ? [f.kgMin] : [f.kgMin, f.kgMax]
      for (const kg of valores) {
        if (paraGramas(kg) % MULTIPLO_G !== 0) {
          return `A faixa do ${sku} que começa em ${f.kgMin} kg não é múltipla de 5. Use números fechados: 5, 10, 15, 20…`
        }
      }
    }

    const ordenado = [...doSku].sort((a, b) => a.kgMin - b.kgMin)

    if (paraGramas(ordenado[0].kgMin) !== MULTIPLO_G) {
      return `A primeira faixa do ${sku} começa em ${ordenado[0].kgMin} kg. Ela precisa começar em ${MULTIPLO_KG} kg, que é o pedido mínimo.`
    }

    for (const f of doSku) {
      if (f.kgMax !== null && paraGramas(f.kgMax) <= paraGramas(f.kgMin)) {
        return `A faixa do ${sku} que começa em ${f.kgMin} kg termina em ${f.kgMax} kg. O teto tem que ser maior que o piso.`
      }
    }

    for (let i = 0; i < ordenado.length - 1; i++) {
      const atual = ordenado[i]
      const seguinte = ordenado[i + 1]
      if (atual.kgMax === null) continue
      const tetoG = paraGramas(atual.kgMax)
      const proximoMinG = paraGramas(seguinte.kgMin)
      if (proximoMinG <= tetoG) {
        return `As faixas do ${sku} se sobrepõem: uma vai até ${atual.kgMax} kg e a seguinte já começa em ${seguinte.kgMin} kg.`
      }
      if (proximoMinG !== tetoG + MULTIPLO_G) {
        return `A tabela do ${sku} pula de ${atual.kgMax} kg para ${seguinte.kgMin} kg. A faixa seguinte tem que começar em ${atual.kgMax + MULTIPLO_KG} kg.`
      }
    }

    const semTeto = doSku.filter((f) => f.kgMax === null)
    if (semTeto.length === 0) {
      return `Falta a faixa sem teto do ${sku}. Deixe o campo de kg máximo vazio na última faixa, senão pedido grande fica sem preço.`
    }
    if (semTeto.length > 1) {
      return `O ${sku} tem duas faixas sem teto. Só a última pode ficar sem teto.`
    }
    if (semTeto[0] !== ordenado[ordenado.length - 1]) {
      return `Falta a faixa sem teto do ${sku}. Deixe o campo de kg máximo vazio na última faixa, senão pedido grande fica sem preço.`
    }
  }

  return null
}
