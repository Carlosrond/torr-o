import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useClientes, useSalvarCliente, type Cliente } from '@/hooks/useClientes'
import { ROTULO_CANAL, ROTULO_CONDICAO, type Canal, type CondicaoPagamento } from '@/lib/tipos'

const VAZIO = {
  nome: '',
  canal: 'revenda' as Canal,
  cidade: '',
  whatsapp: '',
  condicaoPadrao: 'avista' as CondicaoPagamento,
  cadenciaDeclaradaDias: '' as string,
  ativo: true,
}

export default function Clientes() {
  const { data: clientes, isLoading, error } = useClientes()
  const salvar = useSalvarCliente()
  const [form, setForm] = useState(VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  function abrirNovo() {
    setForm(VAZIO)
    setEditandoId(null)
    setAberto(true)
  }

  function abrirEdicao(cliente: Cliente) {
    setForm({
      nome: cliente.nome,
      canal: cliente.canal,
      cidade: cliente.cidade ?? '',
      whatsapp: cliente.whatsapp ?? '',
      condicaoPadrao: cliente.condicaoPadrao,
      cadenciaDeclaradaDias:
        cliente.cadenciaDeclaradaDias === null ? '' : String(cliente.cadenciaDeclaradaDias),
      ativo: cliente.ativo,
    })
    setEditandoId(cliente.id)
    setAberto(true)
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    await salvar.mutateAsync({
      id: editandoId ?? undefined,
      nome: form.nome.trim(),
      canal: form.canal,
      cidade: form.cidade.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      condicaoPadrao: form.condicaoPadrao,
      cadenciaDeclaradaDias: form.cadenciaDeclaradaDias
        ? Number(form.cadenciaDeclaradaDias)
        : null,
      ativo: form.ativo,
    })
    setAberto(false)
  }

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />

  const filtrados = (clientes ?? []).filter((cliente) =>
    cliente.nome.toLowerCase().includes(busca.toLowerCase()),
  )

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente"
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
        />
        <button
          onClick={abrirNovo}
          className="rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white"
        >
          Novo
        </button>
      </div>

      {aberto && (
        <form onSubmit={enviar} className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <input
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Nome do cliente"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <select
            value={form.canal}
            onChange={(e) => setForm({ ...form, canal: e.target.value as Canal })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            {Object.entries(ROTULO_CANAL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              placeholder="Cidade"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
            />
            <input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="WhatsApp"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <select
            value={form.condicaoPadrao}
            onChange={(e) =>
              setForm({ ...form, condicaoPadrao: e.target.value as CondicaoPagamento })
            }
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            {Object.entries(ROTULO_CONDICAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <label className="block text-sm text-stone-600">
            Compra a cada quantos dias? (opcional — some quando o histórico assumir)
            <input
              type="number"
              min={1}
              value={form.cadenciaDeclaradaDias}
              onChange={(e) => setForm({ ...form, cadenciaDeclaradaDias: e.target.value })}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Cliente ativo
          </label>
          {salvar.error && <p className="text-sm text-red-700">{salvar.error.message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={salvar.isPending}
              className="flex-1 rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
            >
              {salvar.isPending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg border border-stone-300 px-4 py-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {filtrados.length === 0 ? (
        <Vazio mensagem="Nenhum cliente cadastrado ainda." />
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl bg-white shadow">
          {filtrados.map((cliente) => (
            <li key={cliente.id} className="flex items-center justify-between p-4">
              <div>
                <Link to={`/clientes/${cliente.id}`} className="font-medium underline">
                  {cliente.nome}
                </Link>
                <p className="text-sm text-stone-500">
                  {ROTULO_CANAL[cliente.canal]} · {ROTULO_CONDICAO[cliente.condicaoPadrao]}
                  {cliente.ativo ? '' : ' · inativo'}
                </p>
              </div>
              <button onClick={() => abrirEdicao(cliente)} className="text-sm text-stone-500 underline">
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
