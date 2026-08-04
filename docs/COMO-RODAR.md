# Torrão — como rodar

App de vendas do café Torrão: lança pedido com preço automático por faixa de volume e mostra métricas de venda, prazo/caixa e fila de recompra.

## Rodar local

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Entrar

Dois usuários já existem no projeto:

| Papel | E-mail |
|---|---|
| Admin (vê tudo, edita preços) | carlos.eduardo@rondelli.com.br |
| Vendedor de teste (lança pedido) | vendedor@torrao.local |

As senhas **não ficam neste repositório** — ele é público. Para definir ou trocar: dashboard do Supabase → Authentication → Users → o usuário → Reset password.

O cadastro público está **desligado** de propósito (Authentication → Providers → "Allow new users to sign up"). Usuário novo se cria pelo dashboard, senão qualquer pessoa se registra e lê a tabela de preços.

## Banco

Projeto Supabase **`wqihhxcfjwgjrqrlvkrc`** (Torrão), região us-west-2.

As migrations em `supabase/migrations/` já estão aplicadas:
- `20260803120000_init_torrao.sql` — 6 tabelas, enums, RLS por papel
- `20260803130000_rpc_criar_pedido.sql` — pedido + itens + movimento de consignado numa transação

A tabela de preços foi semeada com **faixas de exemplo** (`supabase/seed.sql`). Os preços reais você cadastra na tela **Preços** — cada salvamento cria uma versão nova, então o histórico de pedido nunca muda de valor.

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

As telas em `src/paginas/` só chamam esses módulos e os hooks de `src/hooks/`.

## O que este app NÃO faz

Contas a receber, baixa de pagamento, inadimplência, aging, nota fiscal e estoque de produção ficam no ERP. Aqui a condição de pagamento existe só para calcular prazo médio e prever entrada de caixa.

## Documentos

- Design: `docs/superpowers/specs/2026-08-03-torrao-vendas-design.md`
- Plano de implementação: `docs/superpowers/plans/2026-08-03-torrao-vendas.md`
