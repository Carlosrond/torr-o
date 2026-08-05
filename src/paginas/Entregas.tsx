import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useEntregas, useMarcarEntregue, type Entrega } from '@/hooks/useEntregas'
import { hojeIso } from '@/lib/data'
import { agruparEntregas, cargaDoDia, fardosDeKg } from '@/lib/entregas'
import { dataLonga, kgTexto, numeroTexto, reais } from '@/lib/formato'
import { traduzirErro } from '@/lib/erros'

/** Só dígitos: wa.me não aceita parêntese, espaço nem traço. */
function linkWhatsapp(whatsapp: string): string {
  return `https://wa.me/55${whatsapp.replace(/\D/g, '')}`
}

function CartaoEntrega({ entrega }: { entrega: Entrega }) {
  const marcar = useMarcarEntregue()
  const [confirmando, setConfirmando] = useState(false)
  const fardos = fardosDeKg(entrega.totalKg)

  return (
    <li className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{entrega.clienteNome}</p>
          {entrega.cidade && <p className="text-sm text-stone-700">{entrega.cidade}</p>}
          <p className="mt-1 text-sm tabular-nums text-stone-700">
            <strong>
              {numeroTexto(fardos)} fardo{fardos === 1 ? '' : 's'}
            </strong>{' '}
            · {kgTexto(entrega.totalKg)} · {reais(entrega.totalValor)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <Link to={`/romaneio/${entrega.id}`} className="min-h-11 pt-2 text-stone-700 underline">
            Romaneio
          </Link>
          {entrega.whatsapp && (
            <a
              href={linkWhatsapp(entrega.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="text-stone-700 underline"
            >
              WhatsApp
            </a>
          )}
        </div>
      </div>

      {confirmando ? (
        <div className="mt-2 rounded-lg bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            Confirmar que entregou {numeroTexto(fardos)} fardo{fardos === 1 ? '' : 's'} para{' '}
            {entrega.clienteNome}?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={marcar.isPending}
              onClick={() => marcar.mutate(entrega.id)}
              className="min-h-11 flex-1 rounded-lg bg-amber-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {marcar.isPending ? 'Salvando…' : 'Sim, entreguei'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="min-h-11 rounded-lg border border-stone-300 px-4 text-sm"
            >
              Não
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-2 min-h-11 w-full rounded-lg bg-amber-800 text-sm font-semibold text-white"
        >
          Marcar entregue
        </button>
      )}

      {/* erro do banco vem em PT-BR (ex.: "Pedido cancelado não pode..."); mostra na própria entrega */}
      {marcar.error && (
        <p className="mt-2 text-sm text-red-700">{traduzirErro(marcar.error.message).titulo}</p>
      )}
    </li>
  )
}

export default function Entregas() {
  const { data: entregas, isLoading, error } = useEntregas()

  if (isLoading) return <Carregando texto="Carregando as entregas…" />
  if (error) return <Erro mensagem={error.message} />

  const lista = entregas ?? []
  // hojeIso() no render, nunca em const de módulo: como PWA o app fica aberto por dias
  // e um "hoje" congelado mostraria a carga de ontem
  const hoje = hojeIso()
  const carga = cargaDoDia(lista, hoje)
  const grupos = agruparEntregas(lista, hoje)

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Entregas</h1>

      <div className="mt-3 rounded-xl bg-stone-900 p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-stone-300">Para levar hoje</p>
        {carga.quantidade === 0 ? (
          <p className="mt-1 text-lg font-semibold">Nada pendente para hoje</p>
        ) : (
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {carga.quantidade} entrega{carga.quantidade === 1 ? '' : 's'} · {numeroTexto(carga.fardos)}{' '}
            fardo{carga.fardos === 1 ? '' : 's'} · {kgTexto(carga.kg)}
          </p>
        )}
      </div>

      {lista.length === 0 ? (
        <Vazio mensagem="Nenhuma entrega pendente. Quando um pedido novo for lançado, ele aparece aqui." />
      ) : (
        <div className="mt-4 space-y-4">
          {grupos.map((grupo) => (
            <section key={grupo.dia}>
              <div
                className={`flex items-center justify-between rounded-t-xl px-3 py-2 text-sm font-semibold ${
                  grupo.atrasado ? 'bg-red-100 text-red-900' : 'bg-stone-200'
                }`}
              >
                <span>
                  {dataLonga(grupo.dia)}
                  {grupo.atrasado && ' · ATRASADA'}
                </span>
                <span className="tabular-nums">
                  {numeroTexto(grupo.fardos)} fardo{grupo.fardos === 1 ? '' : 's'} · {kgTexto(grupo.kg)}
                </span>
              </div>
              <ul className="divide-y divide-stone-200 overflow-hidden rounded-b-xl bg-white shadow">
                {grupo.entregas.map((entrega) => (
                  <CartaoEntrega key={entrega.id} entrega={entrega} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
