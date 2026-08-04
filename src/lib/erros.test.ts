import { describe, expect, it } from 'vitest'
import { traduzirErro } from './erros'

describe('traduzirErro', () => {
  it('traduz falha de rede para linguagem de gente', () => {
    expect(traduzirErro('TypeError: Failed to fetch').titulo).toContain('Sem conexão')
    expect(traduzirErro('Load failed').titulo).toContain('Sem conexão') // Safari
    expect(traduzirErro('NetworkError when attempting to fetch resource.').titulo).toContain('Sem conexão')
  })

  it('traduz negacao de permissao (RLS)', () => {
    expect(traduzirErro('new row violates row-level security policy for table "precos_faixa"').titulo).toContain(
      'permissão',
    )
  })

  it('traduz sessao expirada e erro de servidor', () => {
    expect(traduzirErro('JWT expired').titulo).toContain('sessão expirou')
    expect(traduzirErro('504 Gateway Timeout').titulo).toContain('servidor')
  })

  it('guarda o texto original como detalhe tecnico', () => {
    expect(traduzirErro('Failed to fetch').detalhe).toBe('Failed to fetch')
  })

  it('mensagem ja em PT-BR passa intacta, sem detalhe duplicado', () => {
    const nossa = 'Só há 3 pacote(s) de saldo nesse cliente.'
    expect(traduzirErro(nossa)).toEqual({ titulo: nossa, detalhe: null })
  })
})
