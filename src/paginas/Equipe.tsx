import { useEffect, useState } from 'react'
import { Carregando, Erro, Vazio } from '@/componentes/Estado'
import { useAuth } from '@/hooks/useAuth'
import { PERCENTUAL_PADRAO, percentualVigente } from '@/lib/comissao'
import { hojeIso } from '@/lib/data'
import { paraNumero } from '@/lib/numero'
import {
  useAtualizarMembro,
  useCriarMembro,
  useEquipe,
  type MembroEquipe,
  type PapelUsuario,
} from '@/hooks/useEquipe'
import { useRegrasComissao, useSalvarRegraComissao } from '@/hooks/useComissao'

const ROTULO_PAPEL: Record<PapelUsuario, string> = { admin: 'Admin', vendedor: 'Vendedor' }

const NOVO_VAZIO = { nome: '', email: '', papel: 'vendedor' as PapelUsuario, senha: '' }

/** Percentual vigente de cada pessoa na lista da equipe. Só chama a RPC quando há membro. */
function usePercentualDaLinha(vendedorId: string) {
  const { data: regras } = useRegrasComissao(vendedorId)
  return regras === undefined ? null : percentualVigente(regras, hojeIso())
}

function LinhaPercentual({ membro }: { membro: MembroEquipe }) {
  const percentual = usePercentualDaLinha(membro.id)
  return (
    <p className="text-sm text-stone-500">
      {ROTULO_PAPEL[membro.papel]} · {membro.clientesAtivos} cliente(s) ativo(s)
      {percentual !== null && ` · comissão ${percentual}%`}
    </p>
  )
}

export default function Equipe() {
  const { usuarioId } = useAuth()
  const { data: equipe, isLoading, error } = useEquipe()
  const criar = useCriarMembro()
  const atualizar = useAtualizarMembro()
  const salvarComissao = useSalvarRegraComissao()

  const [aberto, setAberto] = useState(false)
  const [novo, setNovo] = useState(NOVO_VAZIO)
  const [editando, setEditando] = useState<MembroEquipe | null>(null)
  const [edicao, setEdicao] = useState({ nome: '', papel: 'vendedor' as PapelUsuario, ativo: true, senha: '' })
  const [comissaoTexto, setComissaoTexto] = useState(String(PERCENTUAL_PADRAO))

  const { data: regrasDoEditando } = useRegrasComissao(editando?.id ?? null)

  async function enviarNovo(evento: React.FormEvent) {
    evento.preventDefault()
    await criar.mutateAsync({
      email: novo.email.trim(),
      nome: novo.nome.trim(),
      papel: novo.papel,
      senha: novo.senha,
    })
    setNovo(NOVO_VAZIO)
    setAberto(false)
  }

  function abrirEdicao(membro: MembroEquipe) {
    setEditando(membro)
    setEdicao({ nome: membro.nome, papel: membro.papel, ativo: membro.ativo, senha: '' })
    setComissaoTexto(String(PERCENTUAL_PADRAO))
  }

  // regra vigente da pessoa aberta na edição chega depois (query separada) -- assim que
  // chegar, pré-preenche o campo com o percentual real (ou o padrão, se ainda não tem regra)
  useEffect(() => {
    if (editando && regrasDoEditando !== undefined) {
      setComissaoTexto(String(percentualVigente(regrasDoEditando, hojeIso())))
    }
  }, [editando, regrasDoEditando])

  async function enviarEdicao(evento: React.FormEvent) {
    evento.preventDefault()
    if (!editando) return
    const percentual = paraNumero(comissaoTexto)
    if (Number.isNaN(percentual) || percentual < 0 || percentual > 100) return
    await atualizar.mutateAsync({
      id: editando.id,
      nome: edicao.nome.trim(),
      papel: edicao.papel,
      ativo: edicao.ativo,
      ...(edicao.senha ? { senha: edicao.senha } : {}),
    })
    await salvarComissao.mutateAsync({
      vendedorId: editando.id,
      percentual,
      vigenteDesde: hojeIso(),
    })
    setEditando(null)
  }

  if (isLoading) return <Carregando />
  if (error) return <Erro mensagem={error.message} />

  const ehAPropriaConta = editando?.id === usuarioId

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Equipe</h1>
        <button
          onClick={() => setAberto(true)}
          className="rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white"
        >
          Nova pessoa
        </button>
      </div>

      {aberto && (
        <form onSubmit={enviarNovo} className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <input
            required
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            placeholder="Nome"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <input
            required
            type="email"
            value={novo.email}
            onChange={(e) => setNovo({ ...novo, email: e.target.value })}
            placeholder="E-mail"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <select
            value={novo.papel}
            onChange={(e) => setNovo({ ...novo, papel: e.target.value as PapelUsuario })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            {Object.entries(ROTULO_PAPEL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <input
            required
            minLength={8}
            type="password"
            value={novo.senha}
            onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
            placeholder="Senha inicial (mín. 8 caracteres)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <p className="text-xs text-stone-500">
            Avise a pessoa para trocar essa senha assim que entrar pela primeira vez.
          </p>
          {criar.error && <p className="text-sm text-red-700">{criar.error.message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={criar.isPending}
              className="flex-1 rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
            >
              {criar.isPending ? 'Criando…' : 'Criar'}
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

      {editando && (
        <form onSubmit={enviarEdicao} className="mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
          <p className="font-medium">{editando.email}</p>
          <input
            required
            value={edicao.nome}
            onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
            placeholder="Nome"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          <select
            value={edicao.papel}
            disabled={ehAPropriaConta}
            onChange={(e) => setEdicao({ ...edicao, papel: e.target.value as PapelUsuario })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 disabled:bg-stone-100 disabled:text-stone-400"
          >
            {Object.entries(ROTULO_PAPEL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={edicao.ativo}
              disabled={ehAPropriaConta}
              onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })}
            />
            Ativo
          </label>
          <div>
            <label className="mb-1 block text-sm text-stone-600">Comissão (%)</label>
            <input
              inputMode="decimal"
              value={comissaoTexto}
              onChange={(e) => setComissaoTexto(e.target.value)}
              placeholder="2"
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-stone-500">
              Vale a partir de hoje. Não altera comissão de mês já fechado. Pode ser 0 (salário fixo).
            </p>
          </div>
          {ehAPropriaConta && (
            <p className="text-xs text-stone-500">
              Você não pode mudar seu próprio papel nem se desativar — peça a outro admin.
            </p>
          )}
          <input
            type="password"
            minLength={8}
            value={edicao.senha}
            onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })}
            placeholder="Nova senha (opcional, mín. 8 caracteres)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
          {atualizar.error && <p className="text-sm text-red-700">{atualizar.error.message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={atualizar.isPending}
              className="flex-1 rounded-lg bg-amber-800 py-3 font-semibold text-white disabled:opacity-50"
            >
              {atualizar.isPending ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="rounded-lg border border-stone-300 px-4 py-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!equipe || equipe.length === 0 ? (
        <Vazio mensagem="Nenhuma pessoa cadastrada ainda." />
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl bg-white shadow">
          {equipe.map((membro) => (
            <li key={membro.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">
                  {membro.nome}
                  {!membro.ativo && ' · inativo'}
                </p>
                <p className="text-sm text-stone-500">{membro.email}</p>
                <LinhaPercentual membro={membro} />
              </div>
              <button onClick={() => abrirEdicao(membro)} className="text-sm text-stone-500 underline">
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
