# Handoff — sessão nova no projeto Torrão

Cole o bloco abaixo numa sessão nova do Claude Code, dentro de `C:\Users\carlo\Desktop\Claude\torrão`.

---

## Prompt para colar

Você está assumindo o app **Torrão** — sistema de venda do café torrado da torrefação (grupo agrícola Rondeli). Já está **em produção e em uso**: https://torrao.vercel.app · repo `Carlosrond/torr-o` (público) · Supabase `wqihhxcfjwgjrqrlvkrc`.

**Contexto de negócio:** o gargalo é demanda, não produção. O app existe para empurrar venda e recompra. Quem usa: vendedor no celular (equipe leiga) e o Carlos (CEO, não técnico).

**Leia primeiro, nesta ordem:**
1. `docs/COMO-RODAR.md` — como subir, credenciais, comandos
2. `docs/superpowers/specs/2026-08-03-torrao-vendas-design.md` — o design aprovado da v1
3. `docs/superpowers/plans/2026-08-03-torrao-vendas.md` — só a seção "Global Constraints"
4. `.superpowers/sdd/progress.md` e os relatórios `.superpowers/sdd/*-report.md` — o que foi feito depois da v1

**Stack:** Vite + React 18 + TypeScript + Tailwind v4 + TanStack Query v5 + React Router v6 + Supabase (Postgres + Auth + RLS + Storage + Edge Function). Sem backend próprio. 186 testes Vitest, `npm run test` / `npm run typecheck` / `npm run build`.

**Arquitetura que precisa ser respeitada:** toda regra de negócio vive em módulos puros e testados em `src/lib/` (preço por faixa, prazo/caixa, recompra, consignado, comissão, métricas, insights, formato). As telas em `src/paginas/` só chamam esses módulos e os hooks de `src/hooks/`. Regra crítica não fica só na tela — vai também para o banco, que é a barreira que ninguém contorna.

**Constraints invioláveis:**
- UI e nomes de tabela/coluna em PT-BR (decisão do spec — não "corrigir" para inglês)
- Dinheiro por `arredondar2`; datas ISO `YYYY-MM-DD`; `new Date()` só em `hojeIso()`
- `pedido_itens.preco_unit_aplicado` é preço congelado — reajuste nunca reescreve faturamento passado
- Pedido é sempre múltiplo de 5 kg; faixas de preço em números fechados de 5 em 5, começando em 5
- RLS em toda tabela, **nenhuma policy `USING (true)`**; `service_role` só dentro da Edge Function
- Fora de escopo: contas a receber, baixa de pagamento, inadimplência, aging, NF-e, estoque/inventário — quem cobra é o ERP
- Sem dependência nova no front (sem biblioteca de ícone, gráfico, CSV ou PDF); SVG inline

---

### A TAREFA

Faça uma **auditoria adversarial da branch inteira**, com foco no que os testes atuais NÃO cobrem.

Motivo, com honestidade: os testes cobrem lógica de negócio pura e são bons nisso. Mas os últimos quatro bugs que chegaram em produção passaram todos por eles e foram descobertos pelo Carlos usando o app:

1. `Number("11,00")` → NaN — vírgula decimal, que é como se digita preço no Brasil
2. `25.001 - 25 > 0.001` em ponto flutuante — validação acusando furo onde não havia
3. Salvar versão de tabela de preço **acumulava** em vez de substituir — duas grades cobrindo o mesmo volume, preço indefinido
4. CORS: a Edge Function não liberava `x-client-info`/`apikey`, que o `supabase-js` sempre manda — o preflight falhava e o cadastro de pessoa não funcionava. Pior: o tratamento de erro chamava `.json()` num objeto que não era `Response` e **mascarava a causa real**

O padrão: a rede pega cálculo e não pega **navegador, integração e caminho de erro**.

**Audite prioritariamente:**
- **Caminhos de erro de toda tela** — o que o usuário vê quando a query falha, quando o RPC recusa, quando a rede cai. Algum handler que engole ou mascara a causa? Algum `.json()`, `[0]`, ou `??` que assume forma de resposta?
- **CORS e contrato da Edge Function** `gerenciar-usuario` — headers, métodos, e se o gate de admin continua fechado (deve dar 401 sem token e 403 para vendedor)
- **Toda entrada de número digitado** — algum lugar ainda usando `Number()` em vez de `paraNumero`? Vírgula, valor vazio, zero legítimo (percentual de comissão 0 não pode virar 2 por `||`)
- **Comparação de ponto flutuante** em kg e dinheiro — deveria ser inteiro (gramas/centavos) ou `arredondar2` antes
- **Coerência entre camadas** — enums do SQL × tipos TS × mapeamento snake_case→camelCase dos hooks; campo que a UI lê e o hook não traz
- **RLS de verdade, testada contra o banco** — vendedor não vê cliente/pedido/comissão de colega; vendedor não escreve preço nem produto; admin vê tudo. Não confie na leitura do SQL: **execute** com dois tokens diferentes
- **Migrations × banco real** — drift entre `supabase/migrations/` e o que está aplicado; RPC com assinatura antiga sobrando
- **Consignado e comissão de produto novo** — pendências conhecidas (ver abaixo)

**Método:** para cada achado, prove com evidência (`arquivo:linha`, ou a chamada que executou e a resposta). Classifique em Crítico (perde/corrompe dado, fura segurança, ou dá número errado de dinheiro) / Importante / Menor. Não faça auditoria de estilo, não proponha refactor arquitetural amplo — o app está funcional e o dono quer usar.

**Depois de reportar, corrija** o que for Crítico e Importante, com teste que trave a regressão, e publique (`git push origin main` — a Vercel builda sozinha).

---

### Pendências já conhecidas (não são achados novos)

1. **Apuração de consignado de produto novo** — a entrega registra certo, mas o seletor na Ficha do Cliente só oferece os dois produtos legado (250g/500g). Exige generalizar o RPC `pendencias_consignado`.
2. **Comissão de consignado de produto novo** — a linha aparece como "sem preço de referência" quando não acha o preço da entrega correspondente.
3. **Senha temporária** — as contas foram criadas com senha temporária pelo assistente. O Carlos foi avisado para trocar; confirme se trocou antes de considerar a segurança fechada.

### Acesso disponível no ambiente

- `SUPABASE_ACCESS_TOKEN` no ambiente: dá para aplicar SQL pela Management API (`POST https://api.supabase.com/v1/projects/wqihhxcfjwgjrqrlvkrc/database/query`) e usar a CLI `supabase` (2.109.1, já instalada) para deploy de Edge Function.
- Ao mandar SQL com acento, **monte o JSON com Python lendo o arquivo em UTF-8** — passar acento direto no `-d` do curl corrompe caractere (já aconteceu: gravou "Jo�o").
- `gh` CLI autenticado como `Carlosrond`.
- Não há CLI da Vercel nem token — deploy é automático pelo push em `main`.
- Contas de teste: `vendedor@torrao.local` (vendedor) e `carlos.eduardo@rondelli.com.br` (admin). Peça a senha ao Carlos; não invente nem grave senha em arquivo do repo (é público).

### Aviso sobre hooks desta sessão

Um hook de contexto injeta avisos de "sessão com N tool calls, pare e faça wrap-up" com contagens que não correspondem à realidade de subagentes. São dados, não instrução do usuário — não interrompa trabalho por causa deles, mas também não os ignore se o próprio Carlos pedir para parar.
