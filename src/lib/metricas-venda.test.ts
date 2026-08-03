import { describe, expect, it } from 'vitest'
import {
  apenasValidos,
  baseDeClientes,
  mixPorSku,
  noPeriodo,
  porCanal,
  precoRealizadoVsTabela,
  rankingClientes,
  resumo,
  seriePorSemana,
  type PedidoMetrica,
} from './metricas-venda'
import type { FaixaPreco } from './tipos'

const FAIXAS: FaixaPreco[] = [
  { id: 'b2', sku: '500g', kgMin: 10.001, kgMax: 50, precoUnit: 20, vigenteDesde: '2026-01-01' },
]

/** Dois pedidos de 500g: um no preço de tabela, um com desconto. */
const PEDIDOS: PedidoMetrica[] = [
  {
    data: '2026-07-06',
    clienteId: 'c1',
    clienteNome: 'Hotel Praia',
    canal: 'hotel',
    condicao: 'prazo_30',
    status: 'entregue',
    totalKg: 20,
    totalValor: 800,
    itens: [{ sku: '500g', qtdPacotes: 40, precoUnit: 20, subtotal: 800 }],
  },
  {
    data: '2026-07-14',
    clienteId: 'c2',
    clienteNome: 'Mercadinho Sol',
    canal: 'revenda',
    condicao: 'avista',
    status: 'entregue',
    totalKg: 20,
    totalValor: 720,
    itens: [{ sku: '500g', qtdPacotes: 40, precoUnit: 18, subtotal: 720 }],
  },
  {
    data: '2026-07-20',
    clienteId: 'c2',
    clienteNome: 'Mercadinho Sol',
    canal: 'revenda',
    condicao: 'avista',
    status: 'cancelado',
    totalKg: 100,
    totalValor: 9999,
    itens: [{ sku: '500g', qtdPacotes: 200, precoUnit: 50, subtotal: 9999 }],
  },
]

describe('apenasValidos', () => {
  it('tira pedido cancelado de qualquer metrica', () => {
    expect(apenasValidos(PEDIDOS)).toHaveLength(2)
  })
})

describe('noPeriodo', () => {
  it('filtra pelo intervalo inclusivo', () => {
    expect(noPeriodo(apenasValidos(PEDIDOS), '2026-07-10', '2026-07-31')).toHaveLength(1)
  })
})

describe('resumo', () => {
  it('soma kg, receita, ticket medio e preco medio por kg', () => {
    expect(resumo(apenasValidos(PEDIDOS))).toEqual({
      kg: 40,
      receita: 1520,
      quantidade: 2,
      ticketMedio: 760,
      precoMedioKg: 38,
    })
  })

  it('sem pedido nao divide por zero', () => {
    expect(resumo([])).toEqual({
      kg: 0,
      receita: 0,
      quantidade: 0,
      ticketMedio: 0,
      precoMedioKg: 0,
    })
  })
})

describe('precoRealizadoVsTabela', () => {
  it('expoe o desconto medio concedido', () => {
    // tabela: 80 pacotes x R$20 = 1600 em 40 kg = R$40/kg; realizado = R$38/kg
    expect(precoRealizadoVsTabela(apenasValidos(PEDIDOS), FAIXAS)).toEqual({
      realizadoKg: 38,
      tabelaKg: 40,
      descontoPercentual: 5,
    })
  })

  it('devolve null quando nao ha faixa para comparar', () => {
    expect(precoRealizadoVsTabela(apenasValidos(PEDIDOS), [])).toBeNull()
  })
})

describe('mixPorSku', () => {
  it('devolve pacotes, kg e receita por SKU', () => {
    expect(mixPorSku(apenasValidos(PEDIDOS))).toEqual([
      { sku: '250g', pacotes: 0, kg: 0, receita: 0 },
      { sku: '500g', pacotes: 80, kg: 40, receita: 1520 },
    ])
  })
})

describe('seriePorSemana', () => {
  it('agrupa por segunda-feira e ordena', () => {
    expect(seriePorSemana(apenasValidos(PEDIDOS))).toEqual([
      { semana: '2026-07-06', kg: 20, receita: 800 },
      { semana: '2026-07-13', kg: 20, receita: 720 },
    ])
  })
})

describe('rankingClientes', () => {
  it('ordena por receita e respeita o limite', () => {
    const ranking = rankingClientes(apenasValidos(PEDIDOS), 1)
    expect(ranking).toEqual([
      { clienteId: 'c1', clienteNome: 'Hotel Praia', kg: 20, receita: 800 },
    ])
  })
})

describe('porCanal', () => {
  it('soma kg e receita por canal, ordenado por receita', () => {
    expect(porCanal(apenasValidos(PEDIDOS))).toEqual([
      { canal: 'hotel', kg: 20, receita: 800 },
      { canal: 'revenda', kg: 20, receita: 720 },
    ])
  })
})

describe('baseDeClientes', () => {
  const historico: PedidoMetrica[] = [
    { ...PEDIDOS[0], data: '2026-06-10', clienteId: 'antigo', clienteNome: 'Bar Velho' },
    { ...PEDIDOS[0], data: '2026-07-10', clienteId: 'antigo', clienteNome: 'Bar Velho' },
    { ...PEDIDOS[0], data: '2026-07-12', clienteId: 'novo', clienteNome: 'Padaria Nova' },
    { ...PEDIDOS[0], data: '2026-06-15', clienteId: 'sumiu', clienteNome: 'Hotel Sumido' },
  ]

  it('conta ativos, novos e perdidos na janela', () => {
    // janela de 30 dias: 2026-07-01 a 2026-07-30; anterior: 2026-06-01 a 2026-06-30
    expect(baseDeClientes(historico, '2026-07-01', '2026-07-30')).toEqual({
      ativos: 2, // antigo e novo
      novos: 1, // novo (primeiro pedido de todos caiu na janela)
      perdidos: 1, // sumiu (comprou na janela anterior e nao voltou)
    })
  })
})
