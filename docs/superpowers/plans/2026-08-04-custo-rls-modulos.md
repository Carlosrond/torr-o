# Custo do produto + papel motorista com RLS por módulo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar custo por produto (congelado em cada pedido) para enxergar margem só para o admin, e criar o papel motorista que vê apenas as entregas pendentes — com fardo como medida de carga no romaneio.

**Architecture:** Extensão do app existente, sem reestruturação. Custo mora em duas tabelas separadas (`produto_custos`, `pedido_item_custos`) porque RLS do Postgres protege linha, não coluna — tabela separada é a única forma de o banco esconder custo de vendedor/motorista. O congelamento do custo no pedido é feito por **trigger** em `pedido_itens` (não por RPC), para ser impossível de burlar ou de reescrever custo de pedido antigo. Papel motorista entra no enum `papel_usuario` e ganha policies próprias; a transição `aberto → entregue` sai por RPC `marcar_entregue` (security definer) porque a policy de update de `pedidos` é do dono do cliente.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind v4 + TanStack Query v5 + React Router v6 + Supabase (Postgres + Auth + RLS + Storage + Edge Function). Vitest.

## Global Constraints

- UI e nomes de tabela/coluna em **PT-BR** — não "corrigir" para inglês.
- Dinheiro sempre por `arredondar2`; datas ISO `YYYY-MM-DD`; `new Date()` só dentro de `hojeIso()`.
- Número digitado sempre por `paraNumero` — **nunca** `Number()` (vírgula decimal); zero legítimo nunca cai em `||`.
- Comparação de kg por gramas inteiras (`paraGramas`) ou `arredondar2` — nunca float cru.
- `pedido_itens.preco_unit_aplicado` é preço congelado; **`pedido_item_custos.custo_unit_aplicado` é custo congelado** — reajuste nunca reescreve o passado.
- Pedido é sempre múltiplo de 5 kg. **1 fardo = 5 kg** (`MULTIPLO_KG`).
- RLS em toda tabela, **nenhuma policy `USING (true)`**; `service_role` só dentro da Edge Function.
- Regra de negócio em módulo puro e testado em `src/lib/`; tela só chama módulo + hook.
- Sem dependência nova no front (sem lib de ícone, gráfico, CSV ou PDF); SVG inline.
- Fora de escopo: contas a receber, NF-e, estoque — quem cobra é o ERP.
- Verificação: `npm run typecheck` + `npm run test`. **Não existe `npm run lint` neste repo** — não inventar o comando.
- Migrations aplicadas pela Management API (`POST https://api.supabase.com/v1/projects/wqihhxcfjwgjrqrlvkrc/database/query`) com `SUPABASE_ACCESS_TOKEN`. SQL com acento: montar o JSON **com Python lendo o arquivo em UTF-8** — acento direto no `-d` do curl corrompe caractere.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260804231000_produto_custo.sql` | tabelas de custo + trigger de congelamento |
| `supabase/migrations/20260804232000_papel_motorista.sql` | **só** o `alter type ... add value` (transação própria) |
| `supabase/migrations/20260804233000_rls_motorista.sql` | `is_motorista`, `tem_entrega_pendente`, policies, `marcar_entregue` |
| `src/lib/margem.ts` + `.test.ts` | custo/margem de itens e de período; item sem custo = margem indefinida |
| `src/lib/entregas.ts` + `.test.ts` | fardo como medida, agrupamento por data, atraso, carga do dia |
| `src/hooks/useProdutoCustos.ts` | leitura/gravação de `produto_custos` (só admin usa) |
| `src/hooks/useEntregas.ts` | lista de entregas pendentes + `marcar_entregue` |
| `src/paginas/Entregas.tsx` | tela do motorista |
| `src/hooks/useAuth.tsx` · `src/hooks/useEquipe.ts` | `Papel` ganha `motorista` |
| `src/componentes/RotaProtegida.tsx` | passa a aceitar lista de papéis |
| `src/componentes/AppShell.tsx` · `src/paginas/Mais.tsx` | navegação por papel |
| `src/App.tsx` | rota `/entregas` + papéis por rota |
| `src/paginas/Romaneio.tsx` | coluna Fardos + total de fardos |
| `src/paginas/Produtos.tsx` | campo Custo |
| `src/hooks/usePedidos.ts` | traz custo congelado embutido |
| `src/paginas/Relatorio.tsx` · `src/paginas/Painel.tsx` | custo/margem para admin |
| `src/paginas/NovoPedido.tsx` | pedido nasce `aberto` (hoje nasce `entregue`) |
| `supabase/functions/gerenciar-usuario/index.ts` | `PAPEIS` aceita `motorista` |
| `docs/COMO-RODAR.md` | papéis, tabelas de custo, tela Entregas |

**Achado que muda o escopo:** hoje `NovoPedido.tsx:224` cria todo pedido com `status: 'entregue'`. Sem a Task 6 a tela de Entregas nasceria sempre vazia. `apenasValidos` (`src/lib/metricas-venda.ts:29`) exclui só `cancelado`, e `bases_comissao` usa `status <> 'cancelado'` — logo trocar para `aberto` **não altera** número de Painel, Relatório ou Comissão. Pedidos já existentes em produção continuam `entregue` e não aparecem na fila (correto).

---

### Task 1: Migration — custo do produto e congelamento no pedido

**Files:**
- Create: `supabase/migrations/20260804231000_produto_custo.sql`

**Interfaces:**
- Produces: tabela `produto_custos(produto_id pk, custo_unit, atualizado_em, atualizado_por)`; tabela `pedido_item_custos(pedido_item_id pk, custo_unit_aplicado)`; trigger `pedido_itens_congelar_custo`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Custo do produto e margem são informação do dono, não da equipe. RLS do Postgres
-- protege LINHA, não coluna: custo como coluna de `produtos` vazaria pela API para
-- todo mundo que lê o catálogo (vendedor monta pedido, motorista monta romaneio).
-- Por isso tabela separada, com policy só de admin.
create table produto_custos (
  produto_id uuid primary key references produtos on delete cascade,
  custo_unit numeric(10,2) not null check (custo_unit >= 0),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users
);

alter table produto_custos enable row level security;

create policy produto_custos_admin_all on produto_custos for all
  using (is_admin()) with check (is_admin());

-- Custo congelado por item, mesma razão do preço congelado: reajustar custo não pode
-- reescrever a margem de faturamento passado.
create table pedido_item_custos (
  pedido_item_id uuid primary key references pedido_itens on delete cascade,
  custo_unit_aplicado numeric(10,2) not null check (custo_unit_aplicado >= 0)
);

alter table pedido_item_custos enable row level security;

-- Só leitura, só admin. NENHUMA policy de escrita de propósito: quem grava é o
-- trigger abaixo (security definer). Assim ninguém reescreve custo de pedido antigo
-- por API direta -- nem admin, nem vendedor.
create policy pedido_item_custos_admin_select on pedido_item_custos for select
  using (is_admin());

-- Trigger em vez de RPC: uma função chamável pelo cliente com um pedido_id qualquer
-- permitiria congelar o custo de HOJE num pedido de meses atrás, corrompendo margem
-- histórica. Trigger não aceita argumento e roda em todo insert, venha de onde vier.
-- Produto sem custo cadastrado não gera linha -- a margem aparece como indefinida na
-- tela, nunca como zero.
create function pedido_item_congelar_custo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into pedido_item_custos (pedido_item_id, custo_unit_aplicado)
  select new.id, pc.custo_unit
  from produto_custos pc
  where pc.produto_id = new.produto_id;
  return new;
end;
$$;

create trigger pedido_itens_congelar_custo
  after insert on pedido_itens
  for each row execute function pedido_item_congelar_custo();

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar via Management API**

Montar o JSON com Python (acento no comentário SQL) e postar em
`https://api.supabase.com/v1/projects/wqihhxcfjwgjrqrlvkrc/database/query`.
Esperado: `[]` (DDL não retorna linha).

- [ ] **Step 3: Provar o congelamento no banco, em transação revertida**

```sql
begin;
insert into produto_custos (produto_id, custo_unit)
  select id, 7.50 from produtos where sku_legado = '250g';
-- inserir um pedido_itens de teste e conferir que pedido_item_custos ganhou a linha
-- com custo_unit_aplicado = 7.50; depois trocar produto_custos para 9.00 e conferir
-- que a linha antiga continua 7.50.
rollback;
```
Esperado: linha congelada em 7,50 e imune ao reajuste.

- [ ] **Step 4: Provar que vendedor não lê custo**

Com `set local role authenticated` e `request.jwt.claims` de um vendedor:
`select count(*) from produto_custos;` e `select count(*) from pedido_item_custos;`
Esperado: **0** nas duas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260804231000_produto_custo.sql
git commit -m "feat(db): custo por produto congelado no pedido, visivel so para admin"
```

---

### Task 2: Migration — papel motorista, RLS por módulo e marcar_entregue

**Files:**
- Create: `supabase/migrations/20260804232000_papel_motorista.sql`
- Create: `supabase/migrations/20260804233000_rls_motorista.sql`

**Interfaces:**
- Consumes: `is_admin()`, `esta_ativo()`, `pode_ver_cliente(uuid)` (já existem).
- Produces: `is_motorista() → boolean`; `tem_entrega_pendente(uuid) → boolean`; `marcar_entregue(p_pedido_id uuid) → void`; policies revisadas de `pedidos`, `pedido_itens`, `clientes`, `precos_faixa`.

- [ ] **Step 1: Migration só do enum (transação própria)**

`20260804232000_papel_motorista.sql`:
```sql
-- Sozinha de propósito: Postgres cria o valor novo do enum numa transação, mas não
-- deixa USAR esse valor na mesma transação. A migration seguinte é que o usa.
alter type papel_usuario add value 'motorista';
```

- [ ] **Step 2: Migration das policies e do RPC**

`20260804233000_rls_motorista.sql`:
```sql
-- Motorista vê só o que precisa para entregar: pedido pendente, item do pedido e o
-- contato do cliente daquela entrega. Nada de preço de tabela, custo, comissão,
-- consignado, equipe ou cliente sem entrega pendente.

create or replace function is_motorista() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and papel = 'motorista' and ativo
  );
$$;

-- security definer para a policy de `clientes` poder olhar `pedidos` sem recursar na
-- RLS de pedidos (que por sua vez olha clientes)
create or replace function tem_entrega_pendente(p_cliente_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pedidos
    where cliente_id = p_cliente_id and status = 'aberto'
  );
$$;

grant execute on function is_motorista() to authenticated;
grant execute on function tem_entrega_pendente(uuid) to authenticated;

-- índice: a policy de clientes e a tela de Entregas filtram por status
create index if not exists pedidos_status_entrega_idx
  on pedidos (status, data_entrega_prevista);

-- ---------------------------------------------------------------- policies

drop policy pedidos_select on pedidos;
create policy pedidos_select on pedidos for select
  using (pode_ver_cliente(cliente_id) or (is_motorista() and status = 'aberto'));

drop policy pedido_itens_select on pedido_itens;
create policy pedido_itens_select on pedido_itens for select
  using (exists (
    select 1 from pedidos p
    where p.id = pedido_id
      and (pode_ver_cliente(p.cliente_id) or (is_motorista() and p.status = 'aberto'))
  ));

drop policy clientes_select on clientes;
create policy clientes_select on clientes for select
  using (
    is_admin()
    or (esta_ativo() and vendedor_id = auth.uid())
    or (is_motorista() and tem_entrega_pendente(id))
  );

-- preço de tabela não é assunto de motorista
drop policy precos_select on precos_faixa;
create policy precos_select on precos_faixa for select
  using (esta_ativo() and not is_motorista());

-- ---------------------------------------------------------------- marcar entregue
-- A policy de update de `pedidos` é do dono do cliente, e o motorista não é dono de
-- nenhum. Em vez de afrouxar a policy (que liberaria qualquer campo), um RPC estreito:
-- só a transição aberto -> entregue, e nada mais. O trigger pedidos_sem_reescrita
-- continua guardando valor, cliente, condição e data.
create function marcar_entregue(p_pedido_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status status_pedido;
  v_cliente_id uuid;
begin
  select status, cliente_id into v_status, v_cliente_id
  from pedidos where id = p_pedido_id;

  if v_status is null then
    raise exception 'Pedido não encontrado';
  end if;

  -- pode_ver_cliente cobre admin e o vendedor dono do cliente
  if not (is_motorista() or pode_ver_cliente(v_cliente_id)) then
    raise exception 'Você não tem permissão para marcar esta entrega';
  end if;

  if v_status = 'entregue' then
    raise exception 'Este pedido já está marcado como entregue';
  end if;

  if v_status = 'cancelado' then
    raise exception 'Pedido cancelado não pode ser marcado como entregue';
  end if;

  update pedidos set status = 'entregue' where id = p_pedido_id;
end;
$$;

grant execute on function marcar_entregue(uuid) to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 3: Aplicar as duas migrations, em ordem, em chamadas separadas**

Esperado: `[]` nas duas. Se a segunda falhar com "unsafe use of new value of enum type", as duas foram enviadas na mesma transação — reenviar separadamente.

- [ ] **Step 4: Provar a RLS do motorista no banco (transação revertida)**

Criar um profile de teste com `papel = 'motorista'`, `set local role authenticated` + claims desse id, e conferir:

| Consulta | Esperado |
|---|---|
| `select count(*) from precos_faixa` | 0 |
| `select count(*) from produto_custos` | 0 |
| `select count(*) from pedido_item_custos` | 0 |
| `select count(*) from consignado_movimentos` | 0 |
| `select count(*) from comissao_regra` | 0 |
| `select count(*) from listar_equipe()` | 0 |
| `select count(*) from pedidos where status <> 'aberto'` | 0 |
| `select count(*) from clientes` | só clientes com pedido aberto |
| `select marcar_entregue(<id de pedido cancelado>)` | erro "Pedido cancelado não pode…" |
| `select marcar_entregue(<id de pedido aberto>)` | ok, status vira entregue |

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260804232000_papel_motorista.sql supabase/migrations/20260804233000_rls_motorista.sql
git commit -m "feat(db): papel motorista com RLS por modulo e RPC marcar_entregue"
```

---

### Task 3: Módulo puro `margem.ts`

**Files:**
- Create: `src/lib/margem.ts`
- Test: `src/lib/margem.test.ts`

**Interfaces:**
- Produces:
  - `interface ItemComCusto { qtdPacotes: number; subtotal: number; custoUnit: number | null }`
  - `interface Margem { receita: number; custo: number; margem: number | null; margemPercentual: number | null; completa: boolean }`
  - `margemDosItens(itens: ItemComCusto[]): Margem`
  - `margemDoPeriodo(pedidos: { itens: ItemComCusto[] }[]): Margem`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it } from 'vitest'
import { margemDoPeriodo, margemDosItens } from './margem'

describe('margemDosItens', () => {
  it('calcula custo, margem e percentual quando todo item tem custo', () => {
    const m = margemDosItens([
      { qtdPacotes: 20, subtotal: 200, custoUnit: 7.5 },
      { qtdPacotes: 10, subtotal: 180, custoUnit: 12 },
    ])
    expect(m.receita).toBe(380)
    expect(m.custo).toBe(270)
    expect(m.margem).toBe(110)
    expect(m.margemPercentual).toBe(28.95)
    expect(m.completa).toBe(true)
  })

  it('item sem custo deixa a margem indefinida em vez de inventar zero', () => {
    const m = margemDosItens([
      { qtdPacotes: 20, subtotal: 200, custoUnit: 7.5 },
      { qtdPacotes: 10, subtotal: 180, custoUnit: null },
    ])
    expect(m.receita).toBe(380)
    expect(m.custo).toBe(150)
    expect(m.margem).toBeNull()
    expect(m.margemPercentual).toBeNull()
    expect(m.completa).toBe(false)
  })

  it('lista vazia nao e margem zero: e margem desconhecida', () => {
    const m = margemDosItens([])
    expect(m.receita).toBe(0)
    expect(m.margem).toBeNull()
    expect(m.completa).toBe(false)
  })

  it('custo zero legitimo conta como custo informado', () => {
    const m = margemDosItens([{ qtdPacotes: 5, subtotal: 100, custoUnit: 0 }])
    expect(m.custo).toBe(0)
    expect(m.margem).toBe(100)
    expect(m.margemPercentual).toBe(100)
    expect(m.completa).toBe(true)
  })

  it('receita zero nao divide por zero', () => {
    const m = margemDosItens([{ qtdPacotes: 1, subtotal: 0, custoUnit: 0 }])
    expect(m.margemPercentual).toBeNull()
  })

  it('nao acumula erro de ponto flutuante', () => {
    const m = margemDosItens([{ qtdPacotes: 3, subtotal: 30, custoUnit: 0.1 }])
    expect(m.custo).toBe(0.3)
  })
})

describe('margemDoPeriodo', () => {
  it('soma os pedidos e fica incompleta se qualquer item nao tiver custo', () => {
    const m = margemDoPeriodo([
      { itens: [{ qtdPacotes: 20, subtotal: 200, custoUnit: 7.5 }] },
      { itens: [{ qtdPacotes: 10, subtotal: 100, custoUnit: null }] },
    ])
    expect(m.receita).toBe(300)
    expect(m.custo).toBe(150)
    expect(m.completa).toBe(false)
    expect(m.margem).toBeNull()
  })

  it('periodo todo com custo devolve margem', () => {
    const m = margemDoPeriodo([
      { itens: [{ qtdPacotes: 20, subtotal: 200, custoUnit: 5 }] },
      { itens: [{ qtdPacotes: 10, subtotal: 100, custoUnit: 5 }] },
    ])
    expect(m.custo).toBe(150)
    expect(m.margem).toBe(150)
    expect(m.margemPercentual).toBe(50)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- margem`
Esperado: FAIL — `Cannot find module './margem'`.

- [ ] **Step 3: Implementar**

```ts
import { arredondar2 } from './numero'

/** Um item de pedido com o custo congelado dele. `custoUnit` null = produto sem custo cadastrado no dia. */
export interface ItemComCusto {
  qtdPacotes: number
  subtotal: number
  custoUnit: number | null
}

export interface Margem {
  receita: number
  /** Custo só dos itens que têm custo congelado. */
  custo: number
  /** null quando algum item não tem custo — margem parcial engana mais que informa. */
  margem: number | null
  margemPercentual: number | null
  /** true quando há item e todo item tem custo congelado. */
  completa: boolean
}

export function margemDosItens(itens: ItemComCusto[]): Margem {
  const receita = arredondar2(itens.reduce((soma, i) => soma + i.subtotal, 0))
  const custo = arredondar2(
    itens.reduce((soma, i) => soma + (i.custoUnit ?? 0) * i.qtdPacotes, 0),
  )
  // `!== null` e não falsy: custo 0 é custo informado (brinde, amostra), não ausência
  const completa = itens.length > 0 && itens.every((i) => i.custoUnit !== null)
  const margem = completa ? arredondar2(receita - custo) : null
  return {
    receita,
    custo,
    margem,
    margemPercentual: margem !== null && receita > 0 ? arredondar2((margem / receita) * 100) : null,
    completa,
  }
}

export function margemDoPeriodo(pedidos: { itens: ItemComCusto[] }[]): Margem {
  return margemDosItens(pedidos.flatMap((p) => p.itens))
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- margem` · Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/margem.ts src/lib/margem.test.ts
git commit -m "feat: modulo de margem -- item sem custo nunca vira margem inventada"
```

---

### Task 4: Módulo puro `entregas.ts`

**Files:**
- Create: `src/lib/entregas.ts`
- Test: `src/lib/entregas.test.ts`

**Interfaces:**
- Consumes: `MULTIPLO_KG`, `pacotesPorCaixa` de `./preco`; `arredondar2` de `./numero`.
- Produces:
  - `fardosDeKg(kg: number): number`
  - `fardosDoItem(qtdPacotes: number, pesoUnitarioKg: number): number | null`
  - `interface GrupoEntrega<T> { dia: string; atrasado: boolean; entregas: T[]; kg: number; fardos: number }`
  - `agruparEntregas<T extends { dataEntregaPrevista: string; totalKg: number }>(entregas: T[], hoje: string): GrupoEntrega<T>[]`
  - `cargaDoDia<T extends { dataEntregaPrevista: string; totalKg: number }>(entregas: T[], hoje: string): { quantidade: number; kg: number; fardos: number }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it } from 'vitest'
import { agruparEntregas, cargaDoDia, fardosDeKg, fardosDoItem } from './entregas'

describe('fardosDeKg', () => {
  it('1 fardo e 5 kg', () => {
    expect(fardosDeKg(5)).toBe(1)
    expect(fardosDeKg(30)).toBe(6)
  })
  it('meio fardo aparece fracionado, nao arredondado pra cima', () => {
    expect(fardosDeKg(7.5)).toBe(1.5)
  })
  it('zero kg e zero fardo', () => {
    expect(fardosDeKg(0)).toBe(0)
  })
})

describe('fardosDoItem', () => {
  it('20 pacotes de 250g fecham 1 fardo', () => {
    expect(fardosDoItem(20, 0.25)).toBe(1)
  })
  it('10 pacotes de 500g fecham 1 fardo', () => {
    expect(fardosDoItem(10, 0.5)).toBe(1)
  })
  it('30 pacotes de 250g dao 1,5 fardo', () => {
    expect(fardosDoItem(30, 0.25)).toBe(1.5)
  })
  it('peso que nao divide o fardo devolve null', () => {
    expect(fardosDoItem(10, 0.3)).toBeNull()
    expect(fardosDoItem(10, 0)).toBeNull()
  })
})

const ENTREGAS = [
  { id: 'a', dataEntregaPrevista: '2026-08-02', totalKg: 10 },
  { id: 'b', dataEntregaPrevista: '2026-08-04', totalKg: 5 },
  { id: 'c', dataEntregaPrevista: '2026-08-04', totalKg: 15 },
  { id: 'd', dataEntregaPrevista: '2026-08-06', totalKg: 20 },
]

describe('agruparEntregas', () => {
  it('agrupa por dia em ordem crescente e marca atraso', () => {
    const grupos = agruparEntregas(ENTREGAS, '2026-08-04')
    expect(grupos.map((g) => g.dia)).toEqual(['2026-08-02', '2026-08-04', '2026-08-06'])
    expect(grupos[0].atrasado).toBe(true)
    expect(grupos[1].atrasado).toBe(false)
    expect(grupos[2].atrasado).toBe(false)
  })

  it('soma kg e fardos do grupo', () => {
    const grupos = agruparEntregas(ENTREGAS, '2026-08-04')
    expect(grupos[1].kg).toBe(20)
    expect(grupos[1].fardos).toBe(4)
    expect(grupos[1].entregas).toHaveLength(2)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(agruparEntregas([], '2026-08-04')).toEqual([])
  })
})

describe('cargaDoDia', () => {
  it('conta o que vence hoje e o que esta atrasado -- e o que vai no carro', () => {
    expect(cargaDoDia(ENTREGAS, '2026-08-04')).toEqual({ quantidade: 3, kg: 30, fardos: 6 })
  })

  it('nao conta entrega futura', () => {
    expect(cargaDoDia(ENTREGAS, '2026-08-01')).toEqual({ quantidade: 0, kg: 0, fardos: 0 })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- entregas` · Esperado: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { arredondar2 } from './numero'
import { MULTIPLO_KG, pacotesPorCaixa } from './preco'

/**
 * Fardo é a medida que o motorista confere na carga: 1 fardo = MULTIPLO_KG (5 kg).
 * Fração aparece como fração (1,5) — arredondar esconderia carga faltando.
 */
export function fardosDeKg(kg: number): number {
  return arredondar2(kg / MULTIPLO_KG)
}

/** Fardos de um item do pedido. null quando o peso do pacote não divide o fardo. */
export function fardosDoItem(qtdPacotes: number, pesoUnitarioKg: number): number | null {
  const porFardo = pacotesPorCaixa(pesoUnitarioKg)
  if (porFardo === null) return null
  return arredondar2(qtdPacotes / porFardo)
}

export interface GrupoEntrega<T> {
  dia: string
  /** Data prevista já passou — vai no topo e em destaque. */
  atrasado: boolean
  entregas: T[]
  kg: number
  fardos: number
}

interface Entregavel {
  dataEntregaPrevista: string
  totalKg: number
}

export function agruparEntregas<T extends Entregavel>(entregas: T[], hoje: string): GrupoEntrega<T>[] {
  const porDia = new Map<string, T[]>()
  for (const entrega of entregas) {
    const lista = porDia.get(entrega.dataEntregaPrevista)
    if (lista) lista.push(entrega)
    else porDia.set(entrega.dataEntregaPrevista, [entrega])
  }
  // ISO YYYY-MM-DD ordena como texto — sem Date, sem fuso
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, doDia]) => {
      const kg = arredondar2(doDia.reduce((soma, e) => soma + e.totalKg, 0))
      return { dia, atrasado: dia < hoje, entregas: doDia, kg, fardos: fardosDeKg(kg) }
    })
}

/** O que precisa entrar no carro hoje: vencidas + as de hoje. */
export function cargaDoDia<T extends Entregavel>(entregas: T[], hoje: string) {
  const doDia = entregas.filter((e) => e.dataEntregaPrevista <= hoje)
  const kg = arredondar2(doDia.reduce((soma, e) => soma + e.totalKg, 0))
  return { quantidade: doDia.length, kg, fardos: fardosDeKg(kg) }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- entregas` · Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/entregas.ts src/lib/entregas.test.ts
git commit -m "feat: modulo de entregas -- fardo como medida de carga, atraso e carga do dia"
```

---

### Task 5: Papel motorista no front — tipos, rotas e navegação

**Files:**
- Modify: `src/hooks/useAuth.tsx` (tipo `Papel`)
- Modify: `src/hooks/useEquipe.ts` (tipo `PapelUsuario`)
- Modify: `src/paginas/Equipe.tsx` (`ROTULO_PAPEL`)
- Modify: `src/componentes/RotaProtegida.tsx` (prop `papeis`)
- Modify: `src/componentes/AppShell.tsx` (nav por papel)
- Modify: `src/paginas/Mais.tsx` (itens por papel)
- Modify: `src/App.tsx` (rota `/entregas`, papéis por rota)
- Modify: `supabase/functions/gerenciar-usuario/index.ts` (`PAPEIS`)

**Interfaces:**
- Consumes: `Papel` de `useAuth`.
- Produces: `RotaProtegida` aceita `papeis?: Papel[]`; `ROTA_INICIAL: Record<Papel, string>` exportado de `src/componentes/RotaProtegida.tsx`.

- [ ] **Step 1: `Papel` ganha motorista nos dois hooks**

`src/hooks/useAuth.tsx`: `export type Papel = 'admin' | 'vendedor' | 'motorista'`
`src/hooks/useEquipe.ts`: `export type PapelUsuario = 'admin' | 'vendedor' | 'motorista'`

- [ ] **Step 2: Rótulo do papel na tela Equipe**

`src/paginas/Equipe.tsx`:
```ts
const ROTULO_PAPEL: Record<PapelUsuario, string> = {
  admin: 'Admin',
  vendedor: 'Vendedor',
  motorista: 'Motorista',
}
```
(O `<select>` já itera `Object.entries(ROTULO_PAPEL)` — ganha a opção sozinho.)

- [ ] **Step 3: Edge Function aceita o papel novo**

`supabase/functions/gerenciar-usuario/index.ts`:
```ts
const PAPEIS = ['admin', 'vendedor', 'motorista']
```
Sem isso o admin não consegue criar motorista (400 "Papel inválido").

- [ ] **Step 4: `RotaProtegida` por lista de papéis**

```tsx
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth, type Papel } from '@/hooks/useAuth'
import { Carregando, Erro } from './Estado'

/** Onde cada papel cai quando entra, ou quando tenta uma rota que não é dele. */
export const ROTA_INICIAL: Record<Papel, string> = {
  admin: '/',
  vendedor: '/',
  motorista: '/entregas',
}

export function RotaProtegida({
  children,
  soAdmin = false,
  papeis,
}: {
  children: ReactNode
  soAdmin?: boolean
  /** Papéis que podem abrir a rota. Ausente = qualquer papel autenticado e ativo. */
  papeis?: Papel[]
}) {
  const { sessao, papel, ativo, carregando, erroPerfil } = useAuth()
  const exigidos = soAdmin ? (['admin'] as Papel[]) : papeis

  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace />
  if (!ativo) {
    return <Erro mensagem="Seu acesso foi desativado. Fale com o administrador do Torrão." />
  }
  if (exigidos && papel === null) {
    // falha de rede não pode rebaixar ninguém em silêncio nem girar para sempre
    if (erroPerfil) {
      return <Erro mensagem={`Não foi possível confirmar seu acesso: ${erroPerfil}`} />
    }
    return <Carregando />
  }
  if (exigidos && papel !== null && !exigidos.includes(papel)) {
    return <Navigate to={ROTA_INICIAL[papel]} replace />
  }
  return <>{children}</>
}
```

- [ ] **Step 5: Rotas — `/entregas` e papéis por rota**

`src/App.tsx`: importar `Entregas`; dentro do `AppShell`:
```tsx
<Route path="/" element={<RotaProtegida papeis={['admin', 'vendedor']}><Hoje /></RotaProtegida>} />
<Route path="/entregas" element={<RotaProtegida papeis={['admin', 'motorista']}><Entregas /></RotaProtegida>} />
```
e `papeis={['admin', 'vendedor']}` em `/pedido`, `/clientes`, `/clientes/:id`, `/consignado`, `/painel`, `/comissao`, `/relatorio`. `/mais` fica sem restrição (o próprio menu filtra). `/precos`, `/produtos`, `/equipe` seguem `soAdmin`. `/romaneio/:id` fica sem restrição de papel — a RLS decide o que cada um consegue carregar.

- [ ] **Step 6: Navegação por papel no AppShell**

```tsx
const ABAS_POR_PAPEL: Record<Papel, { para: string; rotulo: string }[]> = {
  admin: [
    { para: '/', rotulo: 'Hoje' },
    { para: '/pedido', rotulo: 'Pedido' },
    { para: '/clientes', rotulo: 'Clientes' },
    { para: '/entregas', rotulo: 'Entregas' },
  ],
  vendedor: [
    { para: '/', rotulo: 'Hoje' },
    { para: '/pedido', rotulo: 'Pedido' },
    { para: '/clientes', rotulo: 'Clientes' },
    { para: '/consignado', rotulo: 'Consignado' },
  ],
  // motorista não tem "Mais": a única tela dele é Entregas, e Sair já está no cabeçalho
  motorista: [{ para: '/entregas', rotulo: 'Entregas' }],
}
```
`ROTULO_PAPEL` ganha `motorista: 'Motorista'`. A nav monta `abas.length + (mostraMais ? 1 : 0)` colunas via `style={{ gridTemplateColumns: \`repeat(${colunas}, minmax(0, 1fr))\` }}` — a classe `grid-cols-5` fixa quebraria com 1 item. `mostraMais = papel !== 'motorista'`. Enquanto `papel === null` (perfil carregando), usar as abas de vendedor como neutro.

Admin troca Consignado por Entregas na barra de baixo (Consignado continua acessível pela Ficha do Cliente e pela rota direta) — 5 colunas é o limite de leitura no celular.

- [ ] **Step 7: Menu Mais por papel**

`src/paginas/Mais.tsx`: Painel, Comissão e Relatório só para `admin` e `vendedor`; Consignado entra na lista para admin (saiu da barra); Produtos, Preços e Equipe seguem só admin. Motorista vê apenas o botão Sair.

- [ ] **Step 8: Typecheck e teste**

Run: `npm run typecheck && npm run test`
Esperado: 0 erro; 186 testes passando (nenhum toca navegação).

- [ ] **Step 9: Deploy da Edge Function e commit**

```bash
supabase functions deploy gerenciar-usuario --project-ref wqihhxcfjwgjrqrlvkrc
git add src/hooks/useAuth.tsx src/hooks/useEquipe.ts src/paginas/Equipe.tsx src/paginas/Mais.tsx src/componentes/RotaProtegida.tsx src/componentes/AppShell.tsx src/App.tsx supabase/functions/gerenciar-usuario/index.ts
git commit -m "feat: papel motorista no front -- rotas e navegacao por papel"
```

---

### Task 6: Tela Entregas + pedido nasce aberto

**Files:**
- Create: `src/hooks/useEntregas.ts`
- Create: `src/paginas/Entregas.tsx`
- Modify: `src/paginas/NovoPedido.tsx` (`status: 'aberto'`)

**Interfaces:**
- Consumes: `agruparEntregas`, `cargaDoDia`, `fardosDeKg` de `@/lib/entregas`; `marcar_entregue` (Task 2).
- Produces: `interface Entrega { id: string; clienteNome: string; cidade: string | null; whatsapp: string | null; dataEntregaPrevista: string; totalKg: number; totalValor: number }`; `useEntregas()`; `useMarcarEntregue()`.

- [ ] **Step 1: Hook**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Entrega {
  id: string
  clienteNome: string
  cidade: string | null
  whatsapp: string | null
  dataEntregaPrevista: string
  totalKg: number
  totalValor: number
}

interface LinhaEntrega {
  id: string
  data: string
  data_entrega_prevista: string | null
  total_kg: number
  total_valor: number
  clientes: { nome: string; cidade: string | null; whatsapp: string | null } | null
}

/** Só pedidos pendentes. Para o motorista a RLS já limita a estes; o admin precisa do filtro. */
export function useEntregas() {
  return useQuery({
    queryKey: ['entregas'],
    queryFn: async (): Promise<Entrega[]> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, data, data_entrega_prevista, total_kg, total_valor, clientes(nome, cidade, whatsapp)')
        .eq('status', 'aberto')
        .order('data_entrega_prevista', { ascending: true })
      if (error) throw new Error(error.message)
      return (data as unknown as LinhaEntrega[]).map((linha) => ({
        id: linha.id,
        clienteNome: linha.clientes?.nome ?? '(cliente removido)',
        cidade: linha.clientes?.cidade ?? null,
        whatsapp: linha.clientes?.whatsapp ?? null,
        dataEntregaPrevista: linha.data_entrega_prevista ?? linha.data,
        totalKg: Number(linha.total_kg),
        totalValor: Number(linha.total_valor),
      }))
    },
    // o motorista fica com a tela aberta na rua: dado velho manda ele entregar o que já saiu
    staleTime: 15_000,
  })
}

export function useMarcarEntregue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase.rpc('marcar_entregue', { p_pedido_id: pedidoId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    },
  })
}
```

- [ ] **Step 2: Tela**

`src/paginas/Entregas.tsx`: cabeçalho com `cargaDoDia` (quantidade · fardos · kg), grupos de `agruparEntregas` com dia em destaque quando `atrasado`, e por entrega: cliente, cidade, WhatsApp (link `https://wa.me/`), fardos + kg, valor, link Romaneio e botão "Marcar entregue" com `window.confirm`. Estados `Carregando`/`Erro`/`Vazio` de `@/componentes/Estado`. Erro do RPC exibido inline por entrega (mensagem já vem em PT-BR do banco). `hojeIso()` chamado no render, nunca em const de módulo (PWA fica aberto por dias).

- [ ] **Step 3: Pedido nasce aberto**

`src/paginas/NovoPedido.tsx:224`: `status: 'entregue'` → `status: 'aberto'`.
Comentário no lugar: pedido lançado é entrega pendente até o motorista confirmar; `apenasValidos` só exclui cancelado, então nenhum número de painel/comissão muda.

- [ ] **Step 4: Typecheck + teste**

Run: `npm run typecheck && npm run test` · Esperado: 0 erro, tudo passando.

- [ ] **Step 5: Verificar no navegador**

Subir o dev server, entrar como admin, lançar um pedido e conferir que ele aparece em Entregas; marcar entregue e conferir que sai da lista. Checar console e rede sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEntregas.ts src/paginas/Entregas.tsx src/paginas/NovoPedido.tsx
git commit -m "feat: tela de entregas com carga do dia -- pedido nasce aberto e o motorista confirma"
```

---

### Task 7: Fardos no romaneio

**Files:**
- Modify: `src/paginas/Romaneio.tsx`

**Interfaces:**
- Consumes: `fardosDeKg`, `fardosDoItem` de `@/lib/entregas`; `numeroTexto` de `@/lib/formato`.

- [ ] **Step 1: Coluna Fardos por item**

Após a coluna Pacotes, `<th className="py-1 pr-2 text-right">Fardos</th>`; na linha:
```tsx
<td className="py-1 pr-2 text-right tabular-nums">
  {(() => {
    const fardos = fardosDoItem(item.qtdPacotes, item.pesoUnitario)
    return fardos === null ? '—' : numeroTexto(fardos)
  })()}
</td>
```
`—` quando o peso do pacote não divide 5 kg — nunca número inventado.

- [ ] **Step 2: Total de fardos no rodapé**

No bloco de totais, ao lado de Peso total:
```tsx
<div>
  <p className="text-xs uppercase text-stone-600 print:text-black">Fardos</p>
  <p className="text-2xl font-bold tabular-nums">{numeroTexto(fardosDeKg(pedido.totalKg))}</p>
</div>
```

- [ ] **Step 3: Typecheck e conferir impressão**

Run: `npm run typecheck` · Abrir `/romaneio/<id>` e conferir que a tabela continua caber em A4 (`min-w-[540px]` sobe para `min-w-[620px]` com a coluna nova).

- [ ] **Step 4: Commit**

```bash
git add src/paginas/Romaneio.tsx
git commit -m "feat: romaneio em fardos -- 1 fardo = 5 kg, e o que o motorista confere"
```

---

### Task 8: Custo no cadastro de produto

**Files:**
- Create: `src/hooks/useProdutoCustos.ts`
- Modify: `src/paginas/Produtos.tsx`

**Interfaces:**
- Produces: `useProdutoCustos()` → `Record<string, number>` (produtoId → custo); `useSalvarProdutoCusto()` → `mutateAsync({ produtoId, custoUnit })`.

- [ ] **Step 1: Hook**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Custo atual por produto. Tabela separada e só de admin: RLS protege linha, não
 * coluna — custo dentro de `produtos` vazaria para vendedor e motorista.
 * Para quem não é admin a consulta volta vazia (não é erro).
 */
export function useProdutoCustos() {
  return useQuery({
    queryKey: ['produto-custos'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('produto_custos').select('produto_id, custo_unit')
      if (error) throw new Error(error.message)
      return Object.fromEntries(
        (data as { produto_id: string; custo_unit: number }[]).map((l) => [
          l.produto_id,
          Number(l.custo_unit),
        ]),
      )
    },
    staleTime: 5 * 60_000,
  })
}

export function useSalvarProdutoCusto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ produtoId, custoUnit }: { produtoId: string; custoUnit: number }) => {
      const { error } = await supabase
        .from('produto_custos')
        .upsert(
          { produto_id: produtoId, custo_unit: custoUnit, atualizado_em: new Date().toISOString() },
          { onConflict: 'produto_id' },
        )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produto-custos'] }),
  })
}
```

- [ ] **Step 2: Campo Custo no formulário**

`src/paginas/Produtos.tsx`: `VAZIO` ganha `custo: ''`; `abrirEdicao` preenche com `custos[produto.id]` formatado com vírgula; campo ao lado de Peso:
```tsx
<label className="flex-1 text-sm text-stone-600">
  Custo (R$ por pacote)
  <input
    inputMode="decimal"
    value={form.custo}
    onChange={(e) => setForm({ ...form, custo: e.target.value })}
    placeholder="7,50"
    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-3"
  />
</label>
```
Legenda: "Só você vê o custo e a margem. Vendedor e motorista não têm acesso."

No `enviar`, depois de `salvar.mutateAsync`: se o campo estiver preenchido, validar com `paraNumero` (recusar NaN ou negativo, aceitar 0) e chamar `salvarCusto.mutateAsync`. Campo vazio não apaga custo já cadastrado — só não mexe. Custo novo precisa do id do produto: `useSalvarProduto` hoje não devolve id, então o custo de produto **novo** é gravado no segundo salvamento (edição). Para evitar essa pegadinha, `useSalvarProduto` passa a usar `.select('id').single()` e devolver o id.

- [ ] **Step 3: Mostrar custo no card do produto**

No card, quando `custos[produto.id] !== undefined`: `<p className="text-xs text-stone-600">Custo {reais(custo)}</p>`.

- [ ] **Step 4: Typecheck + teste + navegador**

Run: `npm run typecheck && npm run test` · Cadastrar custo em 250g e conferir que persiste ao reabrir.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProdutoCustos.ts src/hooks/useProdutos.ts src/paginas/Produtos.tsx
git commit -m "feat: custo por pacote no cadastro de produto -- visivel so para admin"
```

---

### Task 9: Margem no Relatório e no Painel

**Files:**
- Modify: `src/hooks/usePedidos.ts` (custo congelado embutido)
- Modify: `src/paginas/Relatorio.tsx`
- Modify: `src/paginas/Painel.tsx`

**Interfaces:**
- Consumes: `margemDoPeriodo`, `margemDosItens` de `@/lib/margem`.
- Produces: `ItemPrecificado` do pedido passa a carregar `custoUnit: number | null` no `PedidoCompleto`.

- [ ] **Step 1: `usePedidos` traz o custo congelado**

`SELECT_PEDIDO` ganha `pedido_item_custos(custo_unit_aplicado)` dentro de `pedido_itens(...)`. A RLS devolve vazio para quem não é admin — não é erro.
PostgREST devolve **objeto** quando o FK também é PK, e **array** em outras versões. Ler as duas formas:
```ts
/** PostgREST devolve objeto em relação 1-1 e array em 1-N, dependendo da versão — ler as duas. */
function custoDoItem(bruto: unknown): number | null {
  const linha = Array.isArray(bruto) ? bruto[0] : bruto
  const valor = (linha as { custo_unit_aplicado?: number } | null | undefined)?.custo_unit_aplicado
  return valor === undefined || valor === null ? null : Number(valor)
}
```
Mapear `custoUnit: custoDoItem(item.pedido_item_custos)` e declarar `custoUnit?: number | null` em `ItemPrecificado` (`src/lib/tipos.ts`) — opcional para não quebrar os literais de teste que só exercitam preço.

- [ ] **Step 2: Relatório — cartões e linha por pedido**

`const margem = useMemo(() => margemDoPeriodo(apenasValidos(filtrados)), [filtrados])`, e para admin (`papel === 'admin'` de `useAuth`) dois cartões a mais:
```tsx
<Cartao titulo="Custo" valor={margem.completa ? reais(margem.custo) : '—'} />
<Cartao
  titulo="Margem"
  valor={margem.margem === null ? '—' : reais(margem.margem)}
  detalhe={margem.margemPercentual === null ? 'Falta custo em algum produto' : `${numeroTexto(margem.margemPercentual)}% da venda`}
/>
```
Na linha de cada pedido, para admin, `margemDosItens(pedido.itens)` → `· margem R$ X (Y%)`, ou `· margem —` quando incompleta.

- [ ] **Step 3: Painel — bloco de margem para admin**

Cartões de Custo e Margem do período, com a mesma regra de `—`, ao lado do resumo existente. Só para `papel === 'admin'`.

- [ ] **Step 4: Typecheck + teste + navegador**

Run: `npm run typecheck && npm run test` · Como admin, conferir margem coerente num pedido com custo; como vendedor, conferir que nenhum cartão de custo aparece.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePedidos.ts src/lib/tipos.ts src/paginas/Relatorio.tsx src/paginas/Painel.tsx
git commit -m "feat: custo e margem no relatorio e no painel do admin"
```

---

### Task 10: Prova de RLS ponta a ponta e documentação

**Files:**
- Modify: `docs/COMO-RODAR.md`

- [ ] **Step 1: Criar um motorista de teste pela tela Equipe**

Como admin, criar `motorista@torrao.local` com papel Motorista.

- [ ] **Step 2: Provar com token real de motorista (não só leitura de SQL)**

Login por `signInWithPassword` e, com esse token:

| Ação | Esperado |
|---|---|
| `GET /rest/v1/precos_faixa` | `[]` |
| `GET /rest/v1/produto_custos` | `[]` |
| `GET /rest/v1/pedido_item_custos` | `[]` |
| `GET /rest/v1/comissao_regra` | `[]` |
| `GET /rest/v1/consignado_movimentos` | `[]` |
| `GET /rest/v1/pedidos?status=eq.entregue` | `[]` |
| `GET /rest/v1/clientes` | só clientes com pedido aberto |
| `POST /rest/v1/rpc/listar_equipe` | `[]` |
| `POST /rest/v1/rpc/marcar_entregue` (pedido aberto) | 204, status vira entregue |
| `PATCH /rest/v1/pedidos` (total_valor) | recusado |

- [ ] **Step 3: Provar com token de vendedor**

`produto_custos` e `pedido_item_custos` → `[]`. Cliente de colega → `[]`. `precos_faixa` → continua lendo.

- [ ] **Step 4: Atualizar a documentação**

`docs/COMO-RODAR.md`: tabela de papéis com Motorista; `margem.ts` e `entregas.ts` na tabela "onde mora a regra de negócio"; nota de que custo/margem são admin-only por tabela separada; nota de que pedido nasce `aberto` e vira `entregue` pela tela Entregas.

- [ ] **Step 5: Commit e publicar**

```bash
git add docs/COMO-RODAR.md
git commit -m "docs: papel motorista, tabelas de custo e fluxo de entrega"
```

---

## Self-review

**Cobertura da spec:** custo por produto (T1, T8) · custo congelado (T1) · admin-only no banco (T1, T10) · papel motorista (T2, T5) · RLS por módulo (T2, T10) · `marcar_entregue` (T2, T6) · tela Entregas com carga do dia (T6) · matriz de acesso na navegação (T5) · romaneio com fardos e valores (T7) · margem no Relatório e Painel (T9) · módulos puros `margem.ts` e `entregas.ts` com teste (T3, T4) · prova de RLS com token real (T10) · documentação (T10).

**Desvios conscientes da spec:**
1. O congelamento de custo virou **trigger** em `pedido_itens` em vez de alteração no RPC `criar_pedido` — `criar_pedido` é `security invoker` e, para gravar numa tabela sem policy de escrita, teria de virar `security definer`, o que afrouxaria as próprias policies de `pedidos`/`pedido_itens`. Trigger é diff menor, não aceita argumento do cliente e não permite reescrever custo de pedido antigo.
2. A spec citava `npm run lint`; esse script não existe no repo. Verificação é `npm run typecheck` + `npm run test`.
3. Task 6 inclui trocar o status inicial do pedido de `entregue` para `aberto` — não estava na spec porque só apareceu ao ler o código. Sem isso a fila de entregas nasce vazia.
4. Na barra inferior do admin, Entregas entra no lugar de Consignado (limite de 5 colunas); Consignado segue acessível pelo menu Mais e pela Ficha do Cliente.
