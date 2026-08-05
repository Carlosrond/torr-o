# Torrão — como rodar

App de vendas do café Torrão: lança pedido com preço automático por faixa de volume e mostra métricas de venda, prazo/caixa e fila de recompra.

## Rodar local

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Entrar

Três papéis. O que cada um acessa é decidido **no banco** (RLS), não na tela — esconder o
botão não protege contra quem chama a API com o próprio token.

| Papel | O que vê |
|---|---|
| **Admin** | tudo, mais **custo e margem** (só ele) |
| **Vendedor** | só os clientes/pedidos/consignado/comissão dele. Nunca vê custo nem margem |
| **Motorista** | só as **entregas pendentes** (tela Entregas + romaneio). Nada de preço de tabela, custo, comissão, consignado, equipe, nem cliente sem entrega pendente |

Usuários existentes:

| Papel | E-mail |
|---|---|
| Admin (vê tudo, edita preços) | carlos.eduardo@rondelli.com.br |
| Vendedor de teste (lança pedido) | vendedor@torrao.local |

Pessoa nova (inclusive motorista) se cria em **Mais → Equipe**.

As senhas **não ficam neste repositório** — ele é público. Para definir ou trocar: dashboard do Supabase → Authentication → Users → o usuário → Reset password.

O cadastro público está **desligado** de propósito (Authentication → Providers → "Allow new users to sign up"). Usuário novo se cria pelo dashboard, senão qualquer pessoa se registra e lê a tabela de preços.

## Banco

Projeto Supabase **`wqihhxcfjwgjrqrlvkrc`** (Torrão), região us-west-2.

As migrations em `supabase/migrations/` já estão aplicadas:
- `20260803120000_init_torrao.sql` — 6 tabelas, enums, RLS por papel
- `20260803130000_rpc_criar_pedido.sql` — pedido + itens + movimento de consignado numa transação

Todas as migrations estão aplicadas E registradas em `supabase_migrations.schema_migrations`
(2026-08-04) — `supabase db push` não vai tentar reaplicar nada.

A tabela de preços foi semeada com **faixas de exemplo** (`supabase/seed.sql`). Os preços reais você cadastra na tela **Preços** — cada salvamento cria uma versão nova, então o histórico de pedido nunca muda de valor.

### Custo e margem

O custo mora em **duas tabelas separadas** de `produtos`, e não numa coluna: a RLS do Postgres
protege *linha*, não *coluna* — custo dentro de `produtos` vazaria pela API para vendedor e
motorista, que precisam ler o catálogo.

| Tabela | O que guarda | Quem lê |
|---|---|---|
| `produto_custos` | custo atual por pacote (você cadastra em Mais → Produtos) | só admin |
| `pedido_item_custos` | custo **congelado** no lançamento de cada item | só admin (leitura); ninguém escreve por API |

Quem grava o custo congelado é um **trigger** em `pedido_itens`, não um RPC: função com
`pedido_id` como argumento permitiria congelar o custo de hoje num pedido antigo e corromper a
margem histórica. Produto sem custo cadastrado não gera linha — a margem aparece como `—`,
nunca como zero.

### Fluxo de entrega

Pedido lançado nasce **`aberto`** (entrega pendente) e vira **`entregue`** quando alguém confirma
na tela **Entregas**, pelo RPC `marcar_entregue` — que só permite `aberto → entregue`, nada mais.
Métrica, painel e comissão excluem apenas `cancelado`, então isso não muda número nenhum.
Pedidos lançados antes desta mudança já estão `entregue` e não aparecem na fila.

**1 fardo = 5 kg** — é a medida que o motorista confere ao carregar, e aparece no romaneio por
item e no total.

## Variáveis de ambiente

`.env` na raiz (não vai para o git):

```
VITE_SUPABASE_URL=https://wqihhxcfjwgjrqrlvkrc.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key do dashboard>
```

A chave anon é pública por natureza — vai embutida no bundle. Quem protege o dado é a RLS, não o segredo da chave.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run test` | testes da lógica de negócio (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | build de produção em `dist/` |

## Onde mora a regra de negócio

Tudo que dá bug de dinheiro ou de data vive em `src/lib/`, testado e sem tocar em tela:

| Arquivo | Responsabilidade |
|---|---|
| `preco.ts` | faixa pelo kg total do pedido, versionada por data |
| `prazo.ts` | vencimentos da condição, prazo médio ponderado, caixa previsto |
| `recompra.ts` | cadência, próxima compra, sinais do cliente, oportunidade de faixa |
| `consignado.ts` | saldo por movimento, giro, previsão de reposição |
| `metricas-venda.ts` | kg, receita, preço realizado vs tabela, mix, ranking, base de clientes |
| `insights.ts` | fila "quem ligar agora" |
| `margem.ts` | custo e margem por pedido e por período; item sem custo = margem indefinida, nunca zero |
| `entregas.ts` | fardo como medida de carga (1 fardo = 5 kg), agrupamento por data, atraso, carga do dia |

As telas em `src/paginas/` só chamam esses módulos e os hooks de `src/hooks/`.

## O que este app NÃO faz

Contas a receber, baixa de pagamento, inadimplência, aging, nota fiscal e estoque de produção ficam no ERP. Aqui a condição de pagamento existe só para calcular prazo médio e prever entrada de caixa.

## Documentos

- Design: `docs/superpowers/specs/2026-08-03-torrao-vendas-design.md`
- Plano de implementação: `docs/superpowers/plans/2026-08-03-torrao-vendas.md`
