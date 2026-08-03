/** Arredonda para 2 casas decimais evitando o erro de ponto flutuante do JS. */
export function arredondar2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}
