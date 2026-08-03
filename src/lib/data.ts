/**
 * Aritmética de data em string ISO YYYY-MM-DD, sempre em UTC.
 * UTC evita o bug clássico de fuso: em UTC-3, new Date('2026-08-03') cai no dia 2.
 */

function paraUtc(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function addDias(iso: string, dias: number): string {
  const data = paraUtc(iso)
  data.setUTCDate(data.getUTCDate() + dias)
  return paraIso(data)
}

/** Dias de `de` até `ate`. Negativo se `ate` for anterior. */
export function diffDias(de: string, ate: string): number {
  const MS_DIA = 86_400_000
  return Math.round((paraUtc(ate).getTime() - paraUtc(de).getTime()) / MS_DIA)
}

/** Segunda-feira da semana da data — chave de agrupamento das séries semanais. */
export function segundaDaSemana(iso: string): string {
  const diaSemana = paraUtc(iso).getUTCDay() // 0 = domingo
  const recuo = diaSemana === 0 ? 6 : diaSemana - 1
  return addDias(iso, -recuo)
}

/** Data de hoje. Só para a UI — função de cálculo recebe `hoje` por parâmetro. */
export function hojeIso(): string {
  return paraIso(new Date())
}
