# Próximo incremento — vendedores e comissão

Pedido do Carlos em 03/08/2026, durante a entrega da v1. **Não está implementado.**

## O que a v1 já tem (a base existe)

- `profiles` com papel `admin` | `vendedor`
- `clientes.vendedor_id` — cada cliente tem dono, e a RLS já usa isso (vendedor vê só os seus)
- `pedidos.created_by` — quem lançou o pedido
- `pedidos.total_valor` e `total_kg` conferidos contra os itens pelo banco

Ou seja: já é possível saber **quem vendeu o quê**. Falta a régua de comissão e a tela.

## O que falta decidir antes de codar

A comissão é a parte do sistema que mexe no bolso da equipe. Errar aqui gera conflito com gente, não bug de tela — então as regras precisam vir do Carlos, não de suposição.

1. **Base de cálculo:** % sobre a receita (R$), valor fixo por kg, ou faixa por volume vendido no mês?
2. **Percentual:** igual para todos, por vendedor, ou por canal (revenda paga diferente de hotel)?
3. **Desconto do vendedor reduz a comissão dele?** Hoje o app já registra quando o preço sai abaixo da tabela — dá para descontar isso da comissão automaticamente, e isso alinha o incentivo.
4. **Quando a comissão vira devida:** no lançamento do pedido, no vencimento da condição, ou só quando o ERP confirma que o cliente pagou? Lembrando que a v1 **não** controla pagamento — quem baixa é o ERP.
5. **Consignado:** comissão na entrega ou só na venda apurada? (Comissionar na entrega paga por produto que talvez volte.)
6. **Pedido cancelado:** estorna comissão já apurada?
7. **Quem vê o quê:** o vendedor vê a comissão dele; o Carlos vê a de todos. O vendedor pode ver a do colega? (Recomendo não.)

## Escopo provável (para dimensionar)

- Tela de **cadastro de vendedor**: nome, e-mail, % ou regra de comissão, ativo/inativo
- `profiles` ganha os campos de comissão, ou uma tabela `comissao_regra` versionada por data — versionada, pela mesma razão da tabela de preço: mudar o % não pode reescrever o que já foi apurado
- Módulo puro `src/lib/comissao.ts` com teste, no mesmo padrão de `preco.ts`
- **Extrato de comissão** por vendedor e por mês: pedidos que entraram, base, %, valor, e o que foi descontado por venda abaixo da tabela
- Painel do vendedor: quanto ele já fez no mês e quanto falta para a próxima faixa (se houver faixa)

## Por que não entrou na v1

A v1 fechou o ciclo de venda (pedido → preço → métrica → recompra) e está funcional e verificada. Comissão é um segundo ciclo, com 7 decisões de negócio abertas acima. Entra como incremento próprio: brainstorming → spec → plano → execução, igual à v1.
