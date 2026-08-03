import { describe, expect, it } from 'vitest'
import { oportunidadeFaixa, prever, sinais, type PedidoHistorico } from './recompra'
import type { FaixaPreco } from './tipos'

/** Pedidos a cada 10 dias, 20 kg cada. */
const REGULAR: PedidoHistorico[] = [
  { data: '2026-07-04', totalKg: 20 },
  { data: '2026-07-14', totalKg: 20 },
  { data: '2026-07-24', totalKg: 20 },
]

describe('prever', () => {
  it('calcula cadencia, proxima compra e quantidade sugerida', () => {
    const p = prever(REGULAR, null, '2026-07-28')
    expect(p.cadenciaDias).toBe(10)
    expect(p.origemCadencia).toBe('calculada')
    expect(p.proximaCompraPrevista).toBe('2026-08-03')
    expect(p.atrasoDias).toBe(-6) // faltam 6 dias
    expect(p.qtdSugeridaKg).toBe(20)
    expect(p.confianca).toBe('media')
  })

  it('atrasoDias fica positivo quando a previsao ja passou', () => {
    expect(prever(REGULAR, null, '2026-08-10').atrasoDias).toBe(7)
  })

  it('nao depende da ordem dos pedidos na entrada', () => {
    const desordenado = [REGULAR[2], REGULAR[0], REGULAR[1]]
    expect(prever(desordenado, null, '2026-07-28')).toEqual(prever(REGULAR, null, '2026-07-28'))
  })

  it('usa so os ultimos 5 pedidos para a cadencia', () => {
    // 6 pedidos: os 2 primeiros com intervalo de 60 dias, o resto de 10
    const pedidos: PedidoHistorico[] = [
      { data: '2026-01-01', totalKg: 20 },
      { data: '2026-03-01', totalKg: 20 },
      { data: '2026-03-11', totalKg: 20 },
      { data: '2026-03-21', totalKg: 20 },
      { data: '2026-03-31', totalKg: 20 },
      { data: '2026-04-10', totalKg: 20 },
    ]
    expect(prever(pedidos, null, '2026-04-15').cadenciaDias).toBe(10)
    expect(prever(pedidos, null, '2026-04-15').confianca).toBe('alta')
  })

  it('quantidade sugerida usa a media dos ultimos 3', () => {
    const pedidos: PedidoHistorico[] = [
      { data: '2026-07-04', totalKg: 100 },
      { data: '2026-07-14', totalKg: 10 },
      { data: '2026-07-24', totalKg: 20 },
      { data: '2026-08-03', totalKg: 30 },
    ]
    expect(prever(pedidos, null, '2026-08-05').qtdSugeridaKg).toBe(20)
  })

  it('com 2 pedidos a confianca e baixa', () => {
    expect(prever(REGULAR.slice(0, 2), null, '2026-07-20').confianca).toBe('baixa')
  })

  it('com 1 pedido cai na cadencia declarada', () => {
    const p = prever([{ data: '2026-07-24', totalKg: 15 }], 15, '2026-07-28')
    expect(p.cadenciaDias).toBe(15)
    expect(p.origemCadencia).toBe('declarada')
    expect(p.proximaCompraPrevista).toBe('2026-08-08')
    expect(p.qtdSugeridaKg).toBe(15)
    expect(p.confianca).toBe('sem_historico')
  })

  it('com 1 pedido e sem cadencia declarada nao ha previsao', () => {
    const p = prever([{ data: '2026-07-24', totalKg: 15 }], null, '2026-07-28')
    expect(p.cadenciaDias).toBeNull()
    expect(p.origemCadencia).toBe('nenhuma')
    expect(p.proximaCompraPrevista).toBeNull()
    expect(p.confianca).toBe('sem_historico')
  })

  it('sem nenhum pedido nao inventa numero', () => {
    const p = prever([], 20, '2026-07-28')
    expect(p.proximaCompraPrevista).toBeNull()
    expect(p.qtdSugeridaKg).toBeNull()
    expect(p.confianca).toBe('sem_historico')
  })
})

describe('sinais', () => {
  it('marca na_hora quando a previsao cai em ate 3 dias', () => {
    const hoje = '2026-08-01' // previsao 2026-08-03
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).toContain('na_hora')
  })

  it('nao marca na_hora quando ainda falta mais de 3 dias', () => {
    const hoje = '2026-07-26'
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).not.toContain('na_hora')
  })

  it('marca em_risco quando passou 1,5x a cadencia', () => {
    const hoje = '2026-08-09' // 16 dias desde 24/07, cadencia 10 -> limite 15
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).toContain('em_risco')
  })

  it('marca caindo quando o ultimo pedido fica abaixo de 70% da media anterior', () => {
    const pedidos: PedidoHistorico[] = [
      { data: '2026-07-04', totalKg: 20 },
      { data: '2026-07-14', totalKg: 20 },
      { data: '2026-07-24', totalKg: 10 },
    ]
    const hoje = '2026-07-26'
    expect(sinais(pedidos, prever(pedidos, null, hoje), hoje)).toContain('caindo')
  })

  it('nao marca caindo numa variacao pequena', () => {
    const pedidos: PedidoHistorico[] = [
      { data: '2026-07-04', totalKg: 20 },
      { data: '2026-07-14', totalKg: 20 },
      { data: '2026-07-24', totalKg: 18 },
    ]
    const hoje = '2026-07-26'
    expect(sinais(pedidos, prever(pedidos, null, hoje), hoje)).not.toContain('caindo')
  })

  it('cliente sem historico e novo', () => {
    const pedidos = [{ data: '2026-07-24', totalKg: 15 }]
    expect(sinais(pedidos, prever(pedidos, null, '2026-07-26'), '2026-07-26')).toEqual(['novo'])
  })

  it('cliente em dia fica ok', () => {
    const hoje = '2026-07-26'
    expect(sinais(REGULAR, prever(REGULAR, null, hoje), hoje)).toEqual(['ok'])
  })
})

describe('oportunidadeFaixa', () => {
  const FAIXAS: FaixaPreco[] = [
    { id: 'a2', sku: '250g', kgMin: 10.001, kgMax: 50, precoUnit: 11, vigenteDesde: '2026-01-01' },
    { id: 'a3', sku: '250g', kgMin: 50.001, kgMax: null, precoUnit: 10, vigenteDesde: '2026-01-01' },
  ]

  it('diz quantos kg faltam para o preco melhor', () => {
    const o = oportunidadeFaixa(FAIXAS, '250g', 45, '2026-03-01')
    expect(o).toEqual({
      kgFaltando: 5,
      precoAtual: 11,
      precoMelhor: 10,
      economiaPorPacote: 1,
    })
  })

  it('devolve null quando o cliente ja esta na melhor faixa', () => {
    expect(oportunidadeFaixa(FAIXAS, '250g', 80, '2026-03-01')).toBeNull()
  })

  it('devolve null quando nao ha faixa na data', () => {
    expect(oportunidadeFaixa(FAIXAS, '250g', 45, '2025-01-01')).toBeNull()
  })
})
