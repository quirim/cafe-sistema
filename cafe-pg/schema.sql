-- ============================================
-- SCHEMA PostgreSQL - Café Empréstimos & Safra
-- ============================================

CREATE TABLE IF NOT EXISTS clientes (
  cliente_id    SERIAL PRIMARY KEY,
  nome          VARCHAR(150) NOT NULL,
  documento     VARCHAR(20),
  telefone      VARCHAR(20),
  email         VARCHAR(200),
  endereco      VARCHAR(300),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimentos (
  movimento_id       SERIAL PRIMARY KEY,
  cliente_id         INT NOT NULL REFERENCES clientes(cliente_id),
  tipo               CHAR(1) NOT NULL CHECK (tipo IN ('D','C')),
  data_movimento     DATE NOT NULL,
  data_vencimento    DATE,
  sacas              INT NOT NULL DEFAULT 0,
  kg_avulso          INT NOT NULL DEFAULT 0,
  juros_pct          NUMERIC(5,2),
  total_kg_com_juros INT,
  observacao         VARCHAR(500),
  criado_em          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emprestimos_dinheiro (
  id         SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES clientes(cliente_id),
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  vencimento DATE,
  descricao  VARCHAR(500),
  capital    NUMERIC(14,2) NOT NULL,
  juros_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  situacao   CHAR(1) NOT NULL DEFAULT 'A' CHECK (situacao IN ('A','Q')),
  criado_em  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagamentos_dinheiro (
  id             SERIAL PRIMARY KEY,
  emprestimo_id  INT NOT NULL REFERENCES emprestimos_dinheiro(id) ON DELETE CASCADE,
  data           DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao      VARCHAR(500),
  valor          NUMERIC(14,2) NOT NULL,
  criado_em      TIMESTAMP DEFAULT NOW()
);

-- VIEW: Saldo devedor por cliente (equivalente ao vw_SaldoClientes do SQL Server)
CREATE OR REPLACE VIEW vw_saldo_clientes AS
SELECT
  c.cliente_id,
  c.nome,
  GREATEST(0,
    COALESCE(SUM(CASE m.tipo WHEN 'D' THEN COALESCE(m.total_kg_com_juros, m.sacas*60+m.kg_avulso) ELSE 0 END), 0) -
    COALESCE(SUM(CASE m.tipo WHEN 'C' THEN m.sacas*60+m.kg_avulso ELSE 0 END), 0)
  ) AS saldo_devedor_kg,
  GREATEST(0, FLOOR((
    COALESCE(SUM(CASE m.tipo WHEN 'D' THEN COALESCE(m.total_kg_com_juros, m.sacas*60+m.kg_avulso) ELSE 0 END), 0) -
    COALESCE(SUM(CASE m.tipo WHEN 'C' THEN m.sacas*60+m.kg_avulso ELSE 0 END), 0)
  ) / 60))::INT AS saldo_devedor_sacas,
  GREATEST(0, MOD(
    COALESCE(SUM(CASE m.tipo WHEN 'D' THEN COALESCE(m.total_kg_com_juros, m.sacas*60+m.kg_avulso) ELSE 0 END), 0) -
    COALESCE(SUM(CASE m.tipo WHEN 'C' THEN m.sacas*60+m.kg_avulso ELSE 0 END), 0)
  , 60))::INT AS saldo_devedor_kg_resto,
  CASE WHEN GREATEST(0,
    COALESCE(SUM(CASE m.tipo WHEN 'D' THEN COALESCE(m.total_kg_com_juros, m.sacas*60+m.kg_avulso) ELSE 0 END), 0) -
    COALESCE(SUM(CASE m.tipo WHEN 'C' THEN m.sacas*60+m.kg_avulso ELSE 0 END), 0)
  ) = 0 THEN 'Q' ELSE 'A' END AS situacao
FROM clientes c
LEFT JOIN movimentos m ON m.cliente_id = c.cliente_id
WHERE c.ativo = true
GROUP BY c.cliente_id, c.nome;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_movimentos_cliente ON movimentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_data ON movimentos(data_movimento);
CREATE INDEX IF NOT EXISTS idx_emprestimos_cliente ON emprestimos_dinheiro(cliente_id);
CREATE INDEX IF NOT EXISTS idx_emprestimos_situacao ON emprestimos_dinheiro(situacao);
CREATE INDEX IF NOT EXISTS idx_pagamentos_emprestimo ON pagamentos_dinheiro(emprestimo_id);
