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

/**
 * Fuso da operação. A torrefação e os clientes estão na Bahia (UTC-3, sem horário de
 * verão): o "hoje" do negócio é o calendário da Bahia, não o do relógio UTC nem o do
 * aparelho. Sem isso, pedido lançado depois das 21h nasce com a data de amanhã —
 * cai no mês errado da comissão e imprime data errada no romaneio.
 */
const FUSO_OPERACAO = 'America/Bahia'

// en-CA formata exatamente YYYY-MM-DD, que é o formato ISO usado em todo o app
const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_OPERACAO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Data de hoje no fuso da operação. Só para a UI — função de cálculo recebe `hoje`
 * por parâmetro. `agora` existe para o teste poder fixar o instante.
 */
export function hojeIso(agora: Date = new Date()): string {
  return FORMATO_DIA.format(agora)
}
