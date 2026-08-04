import { describe, expect, it } from 'vitest'
import type { FaixaPreco } from './tipos'
import {
  ehMultiploValido,
  faixaVigente,
  kgMaisProximos,
  kgTotal,
  precificar,
  proximaFaixa,
  totalPedido,
  validarFaixas,
  type FaixaParaValidar,
} from './preco'

/** Tabela de exemplo: faixas em kg do pedido inteiro, por SKU. */
const FAIXAS: FaixaPreco[] = [
  { id: 'a1', sku: '250g', kgMin: 0, kgMax: 10, precoUnit: 12, vigenteDesde: '2026-01-01' },
  { id: 'a2', sku: '250g', kgMin: 10.001, kgMax: 50, precoUnit: 11, vigenteDesde: '2026-01-01' },
  { id: 'a3', sku: '250g', kgMin: 50.001, kgMax: null, precoUnit: 10, vigenteDesde: '2026-01-01' },
  { id: 'b1', sku: '500g', kgMin: 0, kgMax: 10, precoUnit: 22, vigenteDesde: '2026-01-01' },
  { id: 'b2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 20, vigenteDesde: '2026-01-01' },
  { id: 'b3', sku: '500g', kgMin: 50.001, kgMax: null, precoUnit: 18, vigenteDesde: '2026-01-01' },
  // reajuste posterior do 500g — versão completa, as três faixas com a mesma vigência
  { id: 'b1v2', sku: '500g', kgMin: 0, kgMax: 10, precoUnit: 22, vigenteDesde: '2026-06-01' },
  { id: 'b2v2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 21, vigenteDesde: '2026-06-01' },
  { id: 'b3v2', sku: '500g', kgMin: 50.001, kgMax: null, precoUnit: 18, vigenteDesde: '2026-06-01' },
]

describe('kgTotal', () => {
  it('soma 250g e 500g em kg', () => {
    expect(kgTotal([{ sku: '250g', qtdPacotes: 4 }])).toBe(1)
    expect(kgTotal([{ sku: '500g', qtdPacotes: 3 }])).toBe(1.5)
    expect(
      kgTotal([
        { sku: '250g', qtdPacotes: 40 },
        { sku: '500g', qtdPacotes: 20 },
      ]),
    ).toBe(20)
  })

  it('pedido vazio tem 0 kg', () => {
    expect(kgTotal([])).toBe(0)
  })
})

describe('faixaVigente', () => {
  it('escolhe a faixa pelo kg TOTAL do pedido, nao pelo kg do SKU', () => {
    // 8 pacotes de 250g = 2 kg, mas com 500g o pedido vai a 12 kg -> faixa do meio
    const itens = [
      { sku: '250g' as const, qtdPacotes: 8 },
      { sku: '500g' as const, qtdPacotes: 20 },
    ]
    const total = kgTotal(itens) // 2 + 10 = 12
    expect(total).toBe(12)
    expect(faixaVigente(FAIXAS, '250g', total, '2026-03-01')?.precoUnit).toBe(11)
  })

  it('respeita o teto e o piso da faixa', () => {
    expect(faixaVigente(FAIXAS, '250g', 10, '2026-03-01')?.precoUnit).toBe(12)
    expect(faixaVigente(FAIXAS, '250g', 50, '2026-03-01')?.precoUnit).toBe(11)
    expect(faixaVigente(FAIXAS, '250g', 300, '2026-03-01')?.precoUnit).toBe(10)
  })

  it('usa a versao vigente na data do pedido, nao a mais recente', () => {
    expect(faixaVigente(FAIXAS, '500g', 20, '2026-03-01')?.precoUnit).toBe(20)
    expect(faixaVigente(FAIXAS, '500g', 20, '2026-07-01')?.precoUnit).toBe(21)
  })

  it('devolve null quando nao ha faixa aplicavel', () => {
    expect(faixaVigente(FAIXAS, '500g', 20, '2025-12-31')).toBeNull()
  })

  it('versao mais recente incompleta (faixa do meio faltando) devolve null, nao vaza preco da versao anterior', () => {
    const faixasComVersaoIncompleta: FaixaPreco[] = [
      ...FAIXAS,
      // reajuste do 250g esquecendo a faixa do meio (10.001-50)
      { id: 'a1v2', sku: '250g', kgMin: 0, kgMax: 10, precoUnit: 13, vigenteDesde: '2026-08-01' },
      { id: 'a3v2', sku: '250g', kgMin: 50.001, kgMax: null, precoUnit: 11, vigenteDesde: '2026-08-01' },
    ]
    expect(faixaVigente(faixasComVersaoIncompleta, '250g', 20, '2026-09-01')).toBeNull()
  })
})

describe('precificar', () => {
  it('aplica a faixa do kg total a todos os itens e calcula subtotal', () => {
    const itens = [
      { sku: '250g' as const, qtdPacotes: 8 },
      { sku: '500g' as const, qtdPacotes: 20 },
    ]
    const precificados = precificar(itens, FAIXAS, '2026-03-01')
    expect(precificados).toEqual([
      { sku: '250g', qtdPacotes: 8, precoUnit: 11, subtotal: 88 },
      { sku: '500g', qtdPacotes: 20, precoUnit: 20, subtotal: 400 },
    ])
  })

  it('ignora item com quantidade zero', () => {
    const precificados = precificar(
      [
        { sku: '250g', qtdPacotes: 0 },
        { sku: '500g', qtdPacotes: 4 },
      ],
      FAIXAS,
      '2026-03-01',
    )
    expect(precificados).toHaveLength(1)
    expect(precificados[0].sku).toBe('500g')
  })

  it('lanca erro quando falta faixa para o SKU na data', () => {
    expect(() => precificar([{ sku: '500g', qtdPacotes: 4 }], FAIXAS, '2025-01-01')).toThrow(
      /sem faixa de preço/i,
    )
  })
})

describe('totalPedido', () => {
  it('soma kg e valor dos itens precificados', () => {
    const total = totalPedido([
      { sku: '250g', qtdPacotes: 8, precoUnit: 11, subtotal: 88 },
      { sku: '500g', qtdPacotes: 20, precoUnit: 20, subtotal: 400 },
    ])
    expect(total).toEqual({ totalKg: 12, totalValor: 488 })
  })
})

describe('ehMultiploValido', () => {
  it('aceita multiplos positivos de 5', () => {
    expect(ehMultiploValido(5)).toBe(true)
    expect(ehMultiploValido(10)).toBe(true)
    expect(ehMultiploValido(50)).toBe(true)
    expect(ehMultiploValido(500)).toBe(true)
  })

  it('rejeita 0 (pedido vazio nao e pedido)', () => {
    expect(ehMultiploValido(0)).toBe(false)
  })

  it('rejeita valores que nao sao multiplo de 5', () => {
    expect(ehMultiploValido(12)).toBe(false)
    expect(ehMultiploValido(2.5)).toBe(false)
    expect(ehMultiploValido(0.25)).toBe(false)
  })

  it('tolera erro de ponto flutuante de ate 0.001', () => {
    expect(ehMultiploValido(9.9995)).toBe(true)
    expect(ehMultiploValido(10.0009)).toBe(true)
    expect(ehMultiploValido(10.01)).toBe(false)
  })
})

describe('kgMaisProximos', () => {
  it('devolve o multiplo abaixo e acima para valor invalido', () => {
    expect(kgMaisProximos(12)).toEqual({ abaixo: 10, acima: 15 })
  })

  it('nao existe multiplo positivo abaixo de 5', () => {
    expect(kgMaisProximos(2)).toEqual({ abaixo: null, acima: 5 })
  })

  it('valor ja valido devolve o proprio valor nos dois lados', () => {
    expect(kgMaisProximos(10)).toEqual({ abaixo: 10, acima: 10 })
  })
})

describe('proximaFaixa', () => {
  it('devolve a faixa seguinte para virar argumento de venda', () => {
    const proxima = proximaFaixa(FAIXAS, '250g', 45, '2026-03-01')
    expect(proxima?.kgMin).toBe(50.001)
    expect(proxima?.precoUnit).toBe(10)
  })

  it('devolve null quando o cliente ja esta na melhor faixa', () => {
    expect(proximaFaixa(FAIXAS, '250g', 80, '2026-03-01')).toBeNull()
  })
})

describe('validarFaixas', () => {
  const faixa = (kgMin: number, kgMax: number | null, precoUnit: number): FaixaParaValidar => ({
    sku: '250g',
    kgMin,
    kgMax,
    precoUnit,
  })

  it('caminho feliz: grade de 5 fechada e sem furo (5-25, 30-50, 55-sem teto)', () => {
    expect(
      validarFaixas([faixa(5, 25, 11), faixa(30, 50, 10), faixa(55, null, 8.7)]),
    ).toBeNull()
  })

  it('5-25 seguido de 30-50 nao e furo (caso que hoje falha em ponto flutuante)', () => {
    // sem a faixa sem-teto, a tabela fica incompleta - mas a mensagem tem que ser
    // "falta faixa sem teto", nunca um falso furo entre 25 e 30.
    const resultado = validarFaixas([faixa(5, 25, 11), faixa(30, 50, 10)])
    expect(resultado).toBe(
      'Falta a faixa sem teto do 250g. Deixe o campo de kg máximo vazio na última faixa, senão pedido grande fica sem preço.',
    )
  })

  it('rejeita preço vazio ou invalido', () => {
    const resultado = validarFaixas([
      faixa(5, 25, 11),
      faixa(30, 50, NaN),
      faixa(55, null, 8.7),
    ])
    expect(resultado).toBe(
      'O preço da faixa de 30 kg do 250g está vazio ou inválido. Use vírgula ou ponto, por exemplo 10,50.',
    )
  })

  it('rejeita kg que nao e multiplo de 5', () => {
    const resultado = validarFaixas([
      faixa(5, 25, 11),
      faixa(27, 50, 10),
      faixa(55, null, 8.7),
    ])
    expect(resultado).toBe(
      'A faixa do 250g que começa em 27 kg não é múltipla de 5. Use números fechados: 5, 10, 15, 20…',
    )
  })

  it('rejeita primeira faixa que nao comeca em 5', () => {
    const resultado = validarFaixas([faixa(30, null, 10)])
    expect(resultado).toBe(
      'A primeira faixa do 250g começa em 30 kg. Ela precisa começar em 5 kg, que é o pedido mínimo.',
    )
  })

  it('rejeita teto menor ou igual ao piso', () => {
    const resultado = validarFaixas([faixa(5, 25, 11), faixa(30, 25, 10)])
    expect(resultado).toBe(
      'A faixa do 250g que começa em 30 kg termina em 25 kg. O teto tem que ser maior que o piso.',
    )
  })

  it('rejeita faixas sobrepostas', () => {
    const resultado = validarFaixas([faixa(5, 50, 11), faixa(50, null, 8.7)])
    expect(resultado).toBe(
      'As faixas do 250g se sobrepõem: uma vai até 50 kg e a seguinte já começa em 50 kg.',
    )
  })

  it('rejeita sobreposição no meio da tabela em geral (caso 5-15 e 10-25, sem envolver zero)', () => {
    const resultado = validarFaixas([faixa(5, 15, 11), faixa(10, 25, 10), faixa(30, null, 8.7)])
    expect(resultado).toBe(
      'As faixas do 250g se sobrepõem: uma vai até 15 kg e a seguinte já começa em 10 kg.',
    )
  })

  it('grade antiga (0-10) misturada com a nova (5-10) do mesmo SKU: 0 passa no multiplo de 5, mas a regra de "primeira faixa começa em 5" barra a mistura das duas versões', () => {
    // este é o cenário real do incidente: salvar duas vezes na mesma data deixou
    // 0-10 (versão antiga) e 5-10 (versão nova) juntas na mesma vigência.
    const resultado = validarFaixas([faixa(0, 10, 12), faixa(5, 10, 12), faixa(55, null, 10)])
    expect(resultado).toBe(
      'A primeira faixa do 250g começa em 0 kg. Ela precisa começar em 5 kg, que é o pedido mínimo.',
    )
  })

  it('rejeita furo real entre faixas', () => {
    const resultado = validarFaixas([faixa(5, 25, 11), faixa(40, null, 8.7)])
    expect(resultado).toBe(
      'A tabela do 250g pula de 25 kg para 40 kg. A faixa seguinte tem que começar em 30 kg.',
    )
  })

  it('rejeita tabela sem faixa sem teto', () => {
    const resultado = validarFaixas([faixa(5, 50, 11)])
    expect(resultado).toBe(
      'Falta a faixa sem teto do 250g. Deixe o campo de kg máximo vazio na última faixa, senão pedido grande fica sem preço.',
    )
  })

  it('rejeita duas faixas sem teto', () => {
    const resultado = validarFaixas([faixa(5, null, 11), faixa(30, null, 8.7)])
    expect(resultado).toBe('O 250g tem duas faixas sem teto. Só a última pode ficar sem teto.')
  })

  it('valida so os SKUs presentes na lista (um SKU so e permitido)', () => {
    expect(
      validarFaixas([
        { sku: '500g', kgMin: 5, kgMax: 25, precoUnit: 20 },
        { sku: '500g', kgMin: 30, kgMax: null, precoUnit: 18 },
      ]),
    ).toBeNull()
  })
})
