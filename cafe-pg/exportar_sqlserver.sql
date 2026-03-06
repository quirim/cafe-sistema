-- ============================================================
-- EXPORTAR DADOS DO SQL SERVER PARA POSTGRESQL
-- Execute este script no SQL Server Management Studio
-- Salve o resultado como arquivo .sql e rode no PostgreSQL
-- ============================================================

-- 1. CLIENTES
SELECT
  'INSERT INTO clientes (cliente_id, nome, documento, telefone, email, endereco, ativo) VALUES (' +
  CAST(cliente_id AS VARCHAR) + ',' +
  '''' + REPLACE(ISNULL(nome,''), '''', '''''') + ''',' +
  CASE WHEN documento IS NULL THEN 'NULL' ELSE '''' + REPLACE(documento, '''', '''''') + '''' END + ',' +
  CASE WHEN telefone IS NULL THEN 'NULL' ELSE '''' + REPLACE(telefone, '''', '''''') + '''' END + ',' +
  CASE WHEN email IS NULL THEN 'NULL' ELSE '''' + REPLACE(email, '''', '''''') + '''' END + ',' +
  CASE WHEN endereco IS NULL THEN 'NULL' ELSE '''' + REPLACE(endereco, '''', '''''') + '''' END + ',' +
  CAST(ativo AS VARCHAR) +
  ');'
FROM dbo.Clientes ORDER BY cliente_id;

-- 2. MOVIMENTOS
SELECT
  'INSERT INTO movimentos (movimento_id, cliente_id, tipo, data_movimento, data_vencimento, sacas, kg_avulso, juros_pct, total_kg_com_juros, observacao) VALUES (' +
  CAST(movimento_id AS VARCHAR) + ',' +
  CAST(cliente_id AS VARCHAR) + ',' +
  '''' + tipo + ''',' +
  '''' + CONVERT(VARCHAR(10), data_movimento, 120) + ''',' +
  CASE WHEN data_vencimento IS NULL THEN 'NULL' ELSE '''' + CONVERT(VARCHAR(10), data_vencimento, 120) + '''' END + ',' +
  CAST(ISNULL(sacas,0) AS VARCHAR) + ',' +
  CAST(ISNULL(kg_avulso,0) AS VARCHAR) + ',' +
  CASE WHEN juros_pct IS NULL THEN 'NULL' ELSE CAST(juros_pct AS VARCHAR) END + ',' +
  CASE WHEN total_kg_com_juros IS NULL THEN 'NULL' ELSE CAST(total_kg_com_juros AS VARCHAR) END + ',' +
  CASE WHEN observacao IS NULL THEN 'NULL' ELSE '''' + REPLACE(observacao, '''', '''''') + '''' END +
  ');'
FROM dbo.Movimentos ORDER BY movimento_id;

-- 3. EMPRESTIMOS DINHEIRO
SELECT
  'INSERT INTO emprestimos_dinheiro (id, cliente_id, data, vencimento, descricao, capital, juros_pct, situacao) VALUES (' +
  CAST(id AS VARCHAR) + ',' +
  CAST(cliente_id AS VARCHAR) + ',' +
  '''' + CONVERT(VARCHAR(10), data, 120) + ''',' +
  CASE WHEN vencimento IS NULL THEN 'NULL' ELSE '''' + CONVERT(VARCHAR(10), vencimento, 120) + '''' END + ',' +
  CASE WHEN descricao IS NULL THEN 'NULL' ELSE '''' + REPLACE(descricao, '''', '''''') + '''' END + ',' +
  CAST(capital AS VARCHAR) + ',' +
  CAST(ISNULL(juros_pct,0) AS VARCHAR) + ',' +
  '''' + ISNULL(situacao,'A') + '''' +
  ');'
FROM dbo.Emprestimos_Dinheiro ORDER BY id;

-- 4. PAGAMENTOS DINHEIRO
SELECT
  'INSERT INTO pagamentos_dinheiro (id, emprestimo_id, data, descricao, valor) VALUES (' +
  CAST(id AS VARCHAR) + ',' +
  CAST(emprestimo_id AS VARCHAR) + ',' +
  '''' + CONVERT(VARCHAR(10), data, 120) + ''',' +
  CASE WHEN descricao IS NULL THEN 'NULL' ELSE '''' + REPLACE(descricao, '''', '''''') + '''' END + ',' +
  CAST(valor AS VARCHAR) +
  ');'
FROM dbo.Pagamentos_Dinheiro ORDER BY id;

-- 5. Resetar sequences após inserção (rode no PostgreSQL depois de importar os dados)
-- SELECT setval('clientes_cliente_id_seq', (SELECT MAX(cliente_id) FROM clientes));
-- SELECT setval('movimentos_movimento_id_seq', (SELECT MAX(movimento_id) FROM movimentos));
-- SELECT setval('emprestimos_dinheiro_id_seq', (SELECT MAX(id) FROM emprestimos_dinheiro));
-- SELECT setval('pagamentos_dinheiro_id_seq', (SELECT MAX(id) FROM pagamentos_dinheiro));
