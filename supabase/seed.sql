-- Faixas de EXEMPLO só para a tela ter dado. Os preços reais são cadastrados
-- pelo Carlos na tela Tabela de Preços — não tratar estes números como oficiais.
insert into precos_faixa (sku, kg_min, kg_max, preco_unit, vigente_desde) values
  ('250g',  0,     10,   12.00, '2026-01-01'),
  ('250g', 10.001, 50,   11.00, '2026-01-01'),
  ('250g', 50.001, null, 10.00, '2026-01-01'),
  ('500g',  0,     10,   22.00, '2026-01-01'),
  ('500g', 10.001, 50,   20.00, '2026-01-01'),
  ('500g', 50.001, null, 18.00, '2026-01-01');
