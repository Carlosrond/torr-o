/** Formatadores de exibição usados nas telas — única fonte, para não duplicar semântica diferente com o mesmo nome. */

export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function kgTexto(valor: number): string {
  return `${valor.toLocaleString('pt-BR')} kg`
}

/** dd/mm — sem ano, para exibição dentro de uma janela/série onde o ano é óbvio pelo contexto. */
export function dataCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** dd/mm/aaaa — com ano, para histórico e vigência onde o ano importa. */
export function dataLonga(iso: string): string {
  return iso.split('-').reverse().join('/')
}
