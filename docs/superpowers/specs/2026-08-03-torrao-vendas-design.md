# Torrão — Sistema de Vendas, Recompra e Insight de Revenda

**Data:** 2026-08-03
**Dono:** Carlos Rondelli
**Repo:** `Carlosrond/torr-o`
**Supabase:** projeto `wqihhxcfjwgjrqrlvkrc` (próprio do Torrão, isolado do ProcessDesk)

---

## 1. Problema

A torrefação Torrão (Pindorama, grupo Leandro Campos Rondeli) já tem produto pronto e
capacidade de produção folgada — **uma máquina faz ~10× a venda atual**. O gargalo é
**demanda**, não fábrica.

Hoje não existe registro estruturado de quem compra, quanto, a que preço e em que
condição. Consequências: preço aplicado depende da memória do vendedor, prazo de
pagamento não vira conta a receber, consignado não tem saldo confiável, e não há
sinal nenhum de quando um cliente deveria recomprar.

O sistema não controla fábrica. Ele existe para **empurrar venda e recompra**.

## 2. Objetivo da v1

1. Lançar pedido com preço saindo automático da tabela de volume.
2. Métricas de venda claras (kg, R$, preço realizado, mix, canal, ranking).
3. Condição de pagamento virando conta a receber real, com atraso visível.
4. Alerta de recompra por cliente + saldo consignado.

## 3. Arquitetura

**Opção escolhida: app standalone com Supabase próprio.**

- Frontend: Vite + React 18 + TypeScript + Tailwind + shadcn/ui + TanStack Query
- Backend: Supabase (Postgres + Auth + RLS), projeto `wqihhxcfjwgjrqrlvkrc`
- Mobile-first (o vendedor lança do celular)

**Por que não módulo do ProcessDesk:** Torrão é outro negócio, com outros usuários.
O vendedor do Torrão não é usuário do ProcessDesk. Compartilhar banco ou auth
misturaria domínios e criaria risco de RLS cruzada sem ganho real.

### Canais de cliente
`loja_rondelli` · `revenda` · `bar_padaria` · `hotel` · `consumidor`

### SKUs
`250g` e `500g`. Todo cálculo de faixa converte para **kg**.

### Condições de pagamento
`avista` · `prazo_7` · `prazo_14` · `prazo_28` · `consignado`

## 4. Modelo de dados

Seis tabelas. Sem abstração especulativa.

### `clientes`
| campo | tipo | nota |
|---|---|---|
| id | uuid pk | |
| nome | text not null | |
| canal | enum | um dos 5 canais |
| cidade | text | |
| whatsapp | text | contato do vendedor |
| condicao_padrao | enum | default do pedido novo |
| cadencia_declarada_dias | int null | opcional, só para cliente novo sem histórico |
| ativo | bool default true | |
| created_at | timestamptz | |

### `precos_faixa`
| campo | tipo | nota |
|---|---|---|
| id | uuid pk | |
| sku | enum (`250g`,`500g`) | |
| kg_min | numeric not null | faixa medida em **kg total do pedido** |
| kg_max | numeric null | null = sem teto |
| preco_unit | numeric not null | preço do pacote naquela faixa |
| vigente_desde | date not null | |

Reajuste **cria linha nova** com `vigente_desde` posterior. Nunca faz UPDATE em
faixa antiga — o histórico de preço precisa continuar auditável.

### `pedidos`
| campo | tipo | nota |
|---|---|---|
| id | uuid pk | |
| cliente_id | uuid fk | |
| data | date not null | |
| condicao_pagamento | enum | |
| status | enum (`aberto`,`entregue`,`cancelado`) | |
| total_kg | numeric | denormalizado para o painel |
| total_valor | numeric | denormalizado para o painel |
| observacao | text | |
| created_by | uuid fk auth.users | |

### `pedido_itens`
| campo | tipo | nota |
|---|---|---|
| id | uuid pk | |
| pedido_id | uuid fk on delete cascade | |
| sku | enum | |
| qtd_pacotes | int not null | |
| preco_unit_aplicado | numeric not null | **congelado no momento do pedido** |
| subtotal | numeric | qtd × preço |

`preco_unit_aplicado` é gravado, não lido da tabela na exibição. Sem isso, um
reajuste reescreveria o faturamento passado.

### `recebimentos`
| campo | tipo | nota |
|---|---|---|
| id | uuid pk | |
| pedido_id | uuid fk | |
| vencimento | date not null | |
| data_pagamento | date null | null = em aberto |
| valor | numeric not null | |
| forma | text | pix, dinheiro, boleto |

Pedido `avista` gera recebimento com vencimento = data do pedido.
Pedido `prazo_N` gera recebimento com vencimento = data + N dias.
Pedido `consignado` **não gera recebimento** no ato — só na apuração.

### `consignado_movimentos`
| campo | tipo | nota |
|---|---|---|
| id | uuid pk | |
| cliente_id | uuid fk | |
| pedido_id | uuid fk null | preenchido na entrega |
| sku | enum | |
| tipo | enum (`entrega`,`venda_apurada`,`retorno`) | |
| qtd_pacotes | int not null | |
| data | date not null | |

Saldo consignado é **sempre calculado** pela soma dos movimentos
(`entrega − venda_apurada − retorno`). Não existe campo `saldo` — campo
dessincroniza, soma não.

## 5. Regra de preço (faixa por volume)

1. Soma o pedido inteiro em kg: `qtd_250g × 0,25 + qtd_500g × 0,5`.
2. Acha a faixa cujo `kg_min ≤ total_kg` e (`kg_max` nulo ou `total_kg ≤ kg_max`),
   entre as linhas com `vigente_desde` mais recente que seja ≤ data do pedido.
3. Aplica o `preco_unit` daquela faixa a **cada SKU** do pedido.
4. Grava em `preco_unit_aplicado`.

Medir a faixa pelo kg total (e não por SKU separado) é deliberado: incentiva o
cliente a fechar pedido maior, que é exatamente o que destrava demanda.

O vendedor pode sobrescrever o preço manualmente. Quando sobrescreve, o painel
mostra a diferença no indicador **preço médio realizado vs tabela** — o desconto
concedido fica visível, não escondido.

## 6. Métricas do painel

### Bloco A — Venda
- kg vendidos e receita R$ (mês / acumulado)
- **preço médio realizado R$/kg vs tabela** — expõe o desconto real dado
- ticket médio por pedido
- mix 250g vs 500g
- evolução semanal (kg + R$)
- ranking de clientes por kg e por R$
- kg por canal
- clientes ativos no mês, novos, perdidos

### Bloco B — Pagamento
- a receber total, quebrado por atraso: a vencer / 1–7 / 8–30 / 30+ dias
- % da venda por condição (à vista / prazo / consignado)
- prazo médio de recebimento (dias entre pedido e pagamento)
- inadimplência = vencido ÷ faturado
- consignado: saldo em kg e R$ por cliente + **giro** (dias que o produto fica parado)

### Bloco C — Insight de revenda
- **Na hora de recomprar** — previsão vencendo em ≤3 dias
- **Em risco** — passou 1,5× da cadência sem comprar
- **Caindo** — último pedido < 70% da média do cliente
- **Sobe de faixa** — "compra 45 kg; com 51 kg pega preço melhor" (argumento pronto)

## 7. Previsão de recompra

Por cliente, a partir do histórico de pedidos:

- `cadencia_dias` = média dos intervalos entre os últimos até 5 pedidos
- `proxima_compra_prevista` = data do último pedido + `cadencia_dias`
- `qtd_sugerida` = média de kg dos últimos 3 pedidos
- **selo de confiança**: baixa (<3 pedidos) · média (3–5) · alta (6+)

Com menos de 2 pedidos não há previsão — o cliente aparece como
**"novo — acompanhar"**. Se `cadencia_declarada_dias` estiver preenchida, ela é
usada como palpite inicial e claramente rotulada como declarada, não calculada.

**Consignado usa outra fórmula:** `dias_restantes = saldo_kg ÷ venda_apurada_diaria`.
Intervalo entre pedidos não diz nada quando o produto já está no cliente.

Média móvel simples, sem sazonalidade nem modelo. Se o histórico mostrar padrão
mensal claro, troca-se por média por período — é uma função.

## 8. Telas

| Tela | Função | Prioridade |
|---|---|---|
| **Novo pedido** | cliente → itens → faixa aplicada visível → condição → salvar | a mais usada, mobile-first |
| **Clientes** | lista + ficha (histórico, cadência, saldo consignado, o que deve) | alta |
| **Painel** | blocos A + B + C | alta |
| **A receber** | baixa de pagamento em 1 toque | alta |
| **Tabela de preços** | editar faixas criando versão nova | média |

Todas as telas seguem o padrão loading / erro / vazio / sucesso — o time que
consome é leigo, estado ambíguo gera ligação.

## 9. Acesso e segurança

Supabase Auth com email + senha. Dois papéis em `profiles.role`:

- **admin** (Carlos): vê e edita tudo, incluindo tabela de preços
- **vendedor**: cria pedido, vê os próprios clientes e recebimentos, não edita preço-tabela

RLS em todas as tabelas. Nenhuma policy `USING (true)`. Tabela de preços é
leitura para vendedor, escrita só para admin.

## 10. Fora de escopo na v1

- Emissão de nota fiscal
- Controle de produção / estoque da torrefação
- Rota de entrega e logística
- Integração com o ERP Consinco ou com o AgroFácil
- App nativo (o web mobile-first resolve)

## 11. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Previsão nasce cega (sem histórico) | selo de confiança + `cadencia_declarada_dias` como palpite inicial |
| Vendedor sobrescreve preço sempre | métrica de preço realizado vs tabela expõe o padrão |
| Consignado sem apuração em dia | giro em dias no painel denuncia saldo parado |
| Pedido lançado com atraso distorce cadência | campo `data` é editável e separado de `created_at` |
