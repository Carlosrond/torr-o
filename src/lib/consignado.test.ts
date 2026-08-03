import { describe, expect, it } from 'vitest'
import {
  diasParado,
  diasRestantes,
  previsaoReposicao,
  saldoKg,
  saldoPorSku,
  vendaApuradaDiariaKg,
  type MovConsignado,
} from './consignado'

/** Entrega de 40 pacotes de 500g (20 kg) e 10 kg já apurados em 20 dias. */
const MOVS: MovConsignado[] = [
  { sku: '500g', tipo: 'entrega', qtdPacotes: 40, data: '2026-07-01' },
  { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 10, data: '2026-07-11' },
  { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 10, data: '2026-07-21' },
]

describe('saldoPorSku', () => {
  it('soma entrega e subtrai venda apurada e retorno', () => {
    expect(saldoPorSku(MOVS)).toEqual({ '250g': 0, '500g': 20 })
  })

  it('retorno reduz o saldo', () => {
    const comRetorno: MovConsignado[] = [
      ...MOVS,
      { sku: '500g', tipo: 'retorno', qtdPacotes: 5, data: '2026-07-25' },
    ]
    expect(saldoPorSku(comRetorno)['500g']).toBe(15)
  })

  it('sem movimento o saldo e zero em todos os SKUs', () => {
    expect(saldoPorSku([])).toEqual({ '250g': 0, '500g': 0 })
  })
})

describe('saldoKg', () => {
  it('converte o saldo de pacotes para kg', () => {
    expect(saldoKg(MOVS)).toBe(10) // 20 pacotes de 500g
  })
})

describe('vendaApuradaDiariaKg', () => {
  it('divide o kg apurado pelos dias desde a primeira entrega', () => {
    // 20 pacotes de 500g = 10 kg apurados em 20 dias (01/07 -> 21/07)
    expect(vendaApuradaDiariaKg(MOVS, '2026-07-21')).toBe(0.5)
  })

  it('devolve null quando nunca houve apuracao', () => {
    const soEntrega: MovConsignado[] = [MOVS[0]]
    expect(vendaApuradaDiariaKg(soEntrega, '2026-07-21')).toBeNull()
  })
})

describe('diasRestantes', () => {
  it('estima quantos dias o saldo ainda cobre', () => {
    // saldo 10 kg / 0,5 kg por dia = 20 dias
    expect(diasRestantes(MOVS, '2026-07-21')).toBe(20)
  })

  it('devolve null sem apuracao — nao ha ritmo para dividir', () => {
    expect(diasRestantes([MOVS[0]], '2026-07-21')).toBeNull()
  })
})

describe('diasParado', () => {
  it('conta os dias desde a ultima apuracao', () => {
    expect(diasParado(MOVS, '2026-07-31')).toBe(10)
  })

  it('sem apuracao conta desde a primeira entrega', () => {
    expect(diasParado([MOVS[0]], '2026-07-31')).toBe(30)
  })

  it('devolve null sem nenhum movimento', () => {
    expect(diasParado([], '2026-07-31')).toBeNull()
  })
})

describe('previsaoReposicao', () => {
  it('projeta a data em que o saldo acaba', () => {
    expect(previsaoReposicao(MOVS, '2026-07-21')).toBe('2026-08-10')
  })

  it('devolve null quando nao da para estimar', () => {
    expect(previsaoReposicao([MOVS[0]], '2026-07-21')).toBeNull()
  })
})
