import { describe, expect, it } from 'vitest'
import {
  diasParado,
  diasRestantes,
  pendenciaConsignado,
  previsaoReposicao,
  saldoKg,
  saldoPorSku,
  situacaoPeloPrazo,
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

  it('retorno reduz o saldo mas nao conta como ritmo de venda', () => {
    const comRetorno: MovConsignado[] = [
      { sku: '500g', tipo: 'entrega', qtdPacotes: 40, data: '2026-07-01' },
      { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 10, data: '2026-07-11' },
      { sku: '500g', tipo: 'retorno', qtdPacotes: 10, data: '2026-07-21' },
    ]
    // so os 10 pacotes apurados (5 kg) entram no ritmo, em 20 dias
    expect(vendaApuradaDiariaKg(comRetorno, '2026-07-21')).toBe(0.25)
    expect(saldoKg(comRetorno)).toBe(10)
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

  it('saldo negativo nao projeta dia negativo', () => {
    // apurou 30 pacotes mas so 20 foram entregues: inconsistencia de lancamento
    const inconsistente: MovConsignado[] = [
      { sku: '500g', tipo: 'entrega', qtdPacotes: 20, data: '2026-07-01' },
      { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 30, data: '2026-07-21' },
    ]
    expect(diasRestantes(inconsistente, '2026-07-21')).toBe(0)
  })

  it('saldo zerado significa repor agora', () => {
    const zerado: MovConsignado[] = [
      { sku: '500g', tipo: 'entrega', qtdPacotes: 20, data: '2026-07-01' },
      { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 20, data: '2026-07-21' },
    ]
    expect(diasRestantes(zerado, '2026-07-21')).toBe(0)
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

  it('nunca devolve data no passado', () => {
    const inconsistente: MovConsignado[] = [
      { sku: '500g', tipo: 'entrega', qtdPacotes: 20, data: '2026-07-01' },
      { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 30, data: '2026-07-21' },
    ]
    expect(previsaoReposicao(inconsistente, '2026-07-21')).toBe('2026-07-21')
  })
})

describe('situacaoPeloPrazo', () => {
  it('vencido ha 3 dias', () => {
    expect(situacaoPeloPrazo('2026-07-28', '2026-07-31')).toEqual({
      diasParaPrazo: -3,
      situacao: 'vencido',
    })
  })

  it('vence hoje conta como vence_em_breve', () => {
    expect(situacaoPeloPrazo('2026-07-31', '2026-07-31')).toEqual({
      diasParaPrazo: 0,
      situacao: 'vence_em_breve',
    })
  })

  it('vence no limite de 7 dias ainda e vence_em_breve', () => {
    expect(situacaoPeloPrazo('2026-08-07', '2026-07-31')).toEqual({
      diasParaPrazo: 7,
      situacao: 'vence_em_breve',
    })
  })

  it('vence em 8 dias vira em_dia', () => {
    expect(situacaoPeloPrazo('2026-08-08', '2026-07-31')).toEqual({
      diasParaPrazo: 8,
      situacao: 'em_dia',
    })
  })

  it('sem prazo devolve sem_prazo', () => {
    expect(situacaoPeloPrazo(null, '2026-07-31')).toEqual({
      diasParaPrazo: null,
      situacao: 'sem_prazo',
    })
  })
})

describe('pendenciaConsignado', () => {
  it('vencido ha 3 dias', () => {
    const pendencia = pendenciaConsignado(MOVS, '2026-07-28', '2026-07-31')
    expect(pendencia.situacao).toBe('vencido')
    expect(pendencia.diasParaPrazo).toBe(-3)
  })

  it('vence hoje (diasParaPrazo = 0) conta como vence_em_breve', () => {
    const pendencia = pendenciaConsignado(MOVS, '2026-07-31', '2026-07-31')
    expect(pendencia.situacao).toBe('vence_em_breve')
    expect(pendencia.diasParaPrazo).toBe(0)
  })

  it('vence no limite de 7 dias ainda e vence_em_breve', () => {
    const pendencia = pendenciaConsignado(MOVS, '2026-08-07', '2026-07-31')
    expect(pendencia.situacao).toBe('vence_em_breve')
    expect(pendencia.diasParaPrazo).toBe(7)
  })

  it('vence em 8 dias vira em_dia', () => {
    const pendencia = pendenciaConsignado(MOVS, '2026-08-08', '2026-07-31')
    expect(pendencia.situacao).toBe('em_dia')
    expect(pendencia.diasParaPrazo).toBe(8)
  })

  it('sem prazo devolve situacao sem_prazo e nao quebra', () => {
    const pendencia = pendenciaConsignado(MOVS, null, '2026-07-31')
    expect(pendencia.situacao).toBe('sem_prazo')
    expect(pendencia.diasParaPrazo).toBeNull()
  })

  it('reusa saldo e giro ja testados em vez de duplicar a conta', () => {
    const pendencia = pendenciaConsignado(MOVS, '2026-08-07', '2026-07-31')
    expect(pendencia.saldoKg).toBe(saldoKg(MOVS))
    expect(pendencia.saldoPorSku).toEqual(saldoPorSku(MOVS))
    expect(pendencia.diasParado).toBe(diasParado(MOVS, '2026-07-31'))
    expect(pendencia.previsaoAcabar).toBe(previsaoReposicao(MOVS, '2026-07-31'))
  })

  it('saldo zerado nao estoura', () => {
    const zerado: MovConsignado[] = [
      { sku: '500g', tipo: 'entrega', qtdPacotes: 20, data: '2026-07-01' },
      { sku: '500g', tipo: 'venda_apurada', qtdPacotes: 20, data: '2026-07-21' },
    ]
    const pendencia = pendenciaConsignado(zerado, '2026-08-01', '2026-07-31')
    expect(pendencia.saldoKg).toBe(0)
    expect(pendencia.saldoPorSku).toEqual({ '250g': 0, '500g': 0 })
    expect(pendencia.situacao).toBe('vence_em_breve')
  })

  it('sem nenhum movimento tambem nao estoura', () => {
    const pendencia = pendenciaConsignado([], '2026-08-07', '2026-07-31')
    expect(pendencia.saldoKg).toBe(0)
    expect(pendencia.diasParado).toBeNull()
    expect(pendencia.previsaoAcabar).toBeNull()
  })
})
