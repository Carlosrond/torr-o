import { describe, expect, it } from 'vitest'
import type { FaixaPreco } from './tipos'
import { faixaVigente, kgTotal, precificar, proximaFaixa, totalPedido } from './preco'

/** Tabela de exemplo: faixas em kg do pedido inteiro, por SKU. */
const FAIXAS: FaixaPreco[] = [
  { id: 'a1', sku: '250g', kgMin: 0, kgMax: 10, precoUnit: 12, vigenteDesde: '2026-01-01' },
  { id: 'a2', sku: '250g', kgMin: 10.001, kgMax: 50, precoUnit: 11, vigenteDesde: '2026-01-01' },
  { id: 'a3', sku: '250g', kgMin: 50.001, kgMax: null, precoUnit: 10, vigenteDesde: '2026-01-01' },
  { id: 'b1', sku: '500g', kgMin: 0, kgMax: 10, precoUnit: 22, vigenteDesde: '2026-01-01' },
  { id: 'b2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 20, vigenteDesde: '2026-01-01' },
  { id: 'b3', sku: '500g', kgMin: 50.001, kgMax: null, precoUnit: 18, vigenteDesde: '2026-01-01' },
  // reajuste posterior do 500g na faixa do meio
  { id: 'b2v2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 21, vigenteDesde: '2026-06-01' },
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
