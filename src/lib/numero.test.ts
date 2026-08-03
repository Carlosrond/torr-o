import { describe, expect, it } from 'vitest'
import { arredondar2 } from './numero'

describe('arredondar2', () => {
  it('arredonda para 2 casas', () => {
    expect(arredondar2(10.456)).toBe(10.46)
    expect(arredondar2(10.454)).toBe(10.45)
  })

  it('resolve o erro classico de ponto flutuante', () => {
    expect(arredondar2(0.1 + 0.2)).toBe(0.3)
    expect(arredondar2(1.005)).toBe(1.01)
  })

  it('preserva inteiros e zero', () => {
    expect(arredondar2(0)).toBe(0)
    expect(arredondar2(7)).toBe(7)
  })
})
