# Custo do produto + papéis com RLS por módulo (motorista) — design aprovado

**Data:** 2026-08-04 · **Aprovado por:** Carlos (conversa de brainstorming)

## Objetivo

1. Registrar o **custo** de cada produto para enxergar **margem** — sem nunca reescrever a margem do passado.
2. Criar o papel **motorista**, que vê **só as entregas pendentes** e mais nada — garantido pelo banco (RLS), não pela tela.
3. Formalizar a **matriz de acesso por aba** para os três papéis: admin, vendedor, motorista.
4. Romaneio ganha a medida **FARDO** (1 fardo = 5 kg) — é o que o motorista confere na carga.

**Não é uma reestruturação.** A arquitetura atual (regra de negócio pura em `src/lib/`, telas finas, banco como barreira) permanece; o trabalho é extensão.

## Decisões de negócio (fechadas com o Carlos)

| Decisão | Escolha |
|---|---|
| Custo muda com o tempo | Cadastro guarda o custo ATUAL; cada pedido **congela** o custo do dia (mesmo padrão do preço congelado). Pedido antigo sem custo mostra "sem custo informado" — nunca inventa número. |
| Quem vê custo/margem | **Só admin.** Bloqueado no banco, não só escondido na tela. |
| Como o motorista recebe entregas | Vê **todas** as pendentes (sem atribuição individual); marca como entregue quando conclui. |
| Gestão de permissões | **Papéis fixos** (admin, vendedor, motorista). Papel novo no futuro = migration pequena. |
| Romaneio do motorista | **Com valores** (preço/total), e com coluna de **fardos** — 1 fardo = 5 kg. |
| Vendedor e a aba Entregas | Vendedor **não** ganha a aba; acompanha os pedidos dele pela Ficha do Cliente. |
| Pedido cancelado | Some da lista do motorista na hora. Motorista não lança nem cancela nada. |

## Matriz de acesso (aba por aba)

| Aba / tela | Admin | Vendedor | Motorista |
|---|---|---|---|
| Hoje | ✅ tudo | ✅ só clientes dele | ❌ (o "Hoje" dele é Entregas) |
| Pedido (lançar) | ✅ | ✅ | ❌ |
| Clientes + Ficha | ✅ todos | ✅ só os dele | ❌ (nome/cidade/zap aparecem dentro da entrega pendente) |
| Consignado | ✅ tudo | ✅ só os dele | ❌ |
| Painel | ✅ tudo **+ margem (novo)** | ✅ só números dele, sem custo | ❌ |
| Comissão | ✅ de todos | ✅ só a dele | ❌ |
| Relatório | ✅ tudo **+ custo/margem (novo)** | ✅ só os dele, sem custo | ❌ |
| Tabela de preços | ✅ edita | lê preço ao lançar pedido (tela de edição é do admin) | ❌ nem lê |
| Produtos (agora com custo) | ✅ | ❌ | ❌ |
| Equipe | ✅ | ❌ | ❌ |
| **Entregas (nova)** | ✅ | ❌ | ✅ pendentes de todos |
| Romaneio | ✅ qualquer | ✅ dos pedidos dele | ✅ das entregas pendentes (com valores + fardos) |
| Mais (menu) | tudo | só o que acessa | só Sair |

A navegação mostra apenas as abas do papel; a RLS recusa o resto mesmo por API direta.

## Banco de dados

### Custo (2 tabelas novas — por que não coluna em `produtos`)

RLS do Postgres protege **linhas**, não colunas. Custo em coluna de `produtos` vazaria para vendedor/motorista via API (todos leem `produtos` para montar pedido/romaneio). Tabela separada com RLS admin-only é a proteção real.

- `produto_custos` — `produto_id` (PK, FK `produtos` on delete cascade), `custo_unit numeric(10,2) not null check (>= 0)` (R$ por pacote), `atualizado_em timestamptz`. RLS: admin para tudo; nenhuma outra policy.
- `pedido_item_custos` — `pedido_item_id` (PK, FK `pedido_itens` on delete cascade), `custo_unit_aplicado numeric(10,2) not null`. RLS: **select** só admin; **nenhuma policy de escrita** — quem grava é o RPC `criar_pedido` (security definer). Produto sem custo cadastrado no dia = sem linha (nunca inventa zero).

### Papel motorista

- `alter type papel_usuario add value 'motorista'` — em **migration própria**: Postgres não deixa usar o valor novo na mesma transação que o cria.
- Função `is_motorista()` (security definer, exige `ativo`, espelho da `is_admin()`).
- Policies novas/ajustadas:
  - `pedidos` select: motorista lê pedidos com `status = 'aberto'`.
  - `pedido_itens` select: acompanha a visibilidade do pedido.
  - `clientes` select: motorista lê **apenas** clientes com pedido aberto (nome/cidade/whatsapp para a entrega).
  - `precos_faixa` select: hoje é `esta_ativo()`; passa a excluir motorista.
  - `produtos` select: continua para todo ativo (nome/peso são necessários no romaneio; custo não mora aqui).
  - Comissão e consignado: já filtram por `vendedor_id` — motorista naturalmente não vê nada; RPCs (`bases_comissao`, `pendencias_consignado`) já recusam quem não é dono/admin.
- RPC novo `marcar_entregue(p_pedido_id uuid)` — security definer; permite **só** a transição `aberto → entregue`; chamável por motorista ativo, admin ou vendedor dono do cliente; erro amigável nos demais casos. O trigger `pedidos_sem_reescrita` continua blindando valores/cliente/data.

### `criar_pedido` (alteração)

Após inserir os itens, grava em `pedido_item_custos` o custo vigente de cada produto que tiver custo em `produto_custos`. Sem custo cadastrado → sem linha.

## Front-end

- **Tipos/auth:** `Papel` vira `'admin' | 'vendedor' | 'motorista'`; `ROTULO_PAPEL` e o seletor de papel da tela Equipe ganham Motorista.
- **RotaProtegida:** além de `soAdmin`, passa a aceitar papéis permitidos; motorista logado é levado para `/entregas`; rota que ele não acessa redireciona para `/entregas` (vendedor/admin continuam caindo em `/`).
- **AppShell:** navegação por papel. Motorista: cabeçalho + Entregas + Sair, sem nav de vendas. Menu Mais filtrado por papel.
- **Tela nova `Entregas`** (`/entregas`): pedidos abertos agrupados por data de entrega prevista, atrasadas primeiro e em destaque. Cada card: cliente, cidade, WhatsApp, fardos + kg, valor total, botão "Marcar entregue" (com confirmação) e link para o romaneio. Topo: **carga do dia** — "hoje: N entregas · X fardos · Y kg" (pendentes com data prevista até hoje). Estados de vazio/erro/carregando no padrão `Estado.tsx`.
- **Romaneio:** coluna **Fardos** por item (`pacotesPorCaixa(pesoUnitario)`; quantidade que não fecha fardo aparece fracionada "1,5"; peso que não divide 5 kg mostra "—") e **total de fardos** no rodapé (`totalKg / 5`). Para todos os papéis.
- **Produtos (admin):** campo "Custo (R$ por pacote)" no formulário; hook separado (`useProdutoCustos`) só usado nesta tela e nos relatórios do admin — `useProdutos` não muda (vendedor continua usando sem enxergar custo).
- **Relatório (admin):** colunas de custo total e margem (R$ e %) por pedido; "—" quando algum item não tem custo congelado.
- **Painel (admin):** bloco de margem do período (vendido, custo, margem R$ e %).

## Regra de negócio pura (novos módulos em `src/lib/`)

- `margem.ts` + teste — custo total e margem de um pedido a partir dos itens + custos congelados; trata item sem custo (margem indefinida, nunca zero).
- `entregas.ts` + teste — agrupamento por data, detecção de atraso, soma de fardos/kg da carga do dia (reusa `pacotesPorCaixa` de `preco.ts`).

## Tratamento de erro

- `marcar_entregue` devolve mensagens amigáveis mapeadas em `erros.ts` (ex.: pedido já entregue, pedido cancelado, sem permissão).
- Falha de rede na tela Entregas mostra erro com retry (padrão TanStack já usado); nunca lista vazia silenciosa.

## Testes e verificação

- Vitest nos módulos puros novos (`margem`, `entregas`) e nos pontos alterados; `npm run typecheck` + `npm run test` + `npm run lint`.
- **Prova de RLS contra o banco real** (não só leitura de SQL): com token de cada papel — motorista não lê preço de tabela, custo, comissão, consignado, cliente sem entrega pendente; vendedor não lê custo; motorista só transita `aberto → entregue`.
- Migrations aplicadas via Management API (padrão do projeto, ver `docs/COMO-RODAR.md` / HANDOFF); com acento, montar o JSON via Python em UTF-8.

## Fora de escopo

- Atribuição de entrega por motorista específico (ficou decidido: todos veem as pendentes).
- Rota/otimização de entrega, GPS, comprovante com foto.
- Custo retroativo de pedidos antigos (aparecem como "sem custo informado").
- Desfazer "entregue" pela tela (caso raro; admin resolve direto se precisar).
- Matriz de permissão configurável por pessoa (papéis são fixos por decisão).
- Contas a receber, NF-e, estoque — continuam no ERP.
