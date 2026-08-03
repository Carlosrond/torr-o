export function Cartao({
  titulo,
  valor,
  detalhe,
  alerta = false,
}: {
  titulo: string
  valor: string
  detalhe?: string
  alerta?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 shadow ${alerta ? 'bg-amber-50' : 'bg-white'}`}>
      <p className="text-xs uppercase tracking-wide text-stone-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
      {detalhe && <p className="mt-1 text-sm text-stone-500">{detalhe}</p>}
    </div>
  )
}
