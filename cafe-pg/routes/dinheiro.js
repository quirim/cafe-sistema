const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/dinheiro
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(99999, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const busca      = req.query.busca    || '';
    const situacao   = req.query.situacao || '';
    const cliente_id = req.query.cliente_id || '';
    const dataDE     = req.query.dataDE  || '';
    const dataATE    = req.query.dataATE || '';

    let where = '1=1';
    const params = [];
    let pi = 1;
    if (cliente_id)     { where += ` AND e.cliente_id = $${pi++}`; params.push(parseInt(cliente_id)); }
    if (busca)          { where += ` AND c.nome ILIKE $${pi++}`;   params.push(`%${busca}%`); }
    if (situacao==='Q') { where += ` AND e.situacao = 'Q'`; }
    if (situacao==='A') { where += ` AND e.situacao = 'A' AND (e.vencimento IS NULL OR e.vencimento >= CURRENT_DATE)`; }
    if (situacao==='V') { where += ` AND e.situacao = 'A' AND e.vencimento < CURRENT_DATE`; }
    if (dataDE)         { where += ` AND e.data >= $${pi++}`; params.push(dataDE); }
    if (dataATE)        { where += ` AND e.data <= $${pi++}`; params.push(dataATE); }

    const countRes = await query(`
      SELECT COUNT(*) AS total FROM emprestimos_dinheiro e
      INNER JOIN clientes c ON c.cliente_id = e.cliente_id WHERE ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const result = await query(`
      SELECT e.id, e.cliente_id, c.nome AS cliente_nome, c.telefone,
        TO_CHAR(e.data,'YYYY-MM-DD') AS data, TO_CHAR(e.vencimento,'YYYY-MM-DD') AS vencimento,
        e.descricao, e.capital, e.juros_pct, e.situacao,
        ROUND(e.capital * (1 + e.juros_pct / 100.0), 2) AS total_com_juros,
        COALESCE(pag.total_pago, 0) AS total_pago,
        ROUND(e.capital * (1 + e.juros_pct / 100.0), 2) - COALESCE(pag.total_pago, 0) AS saldo_devedor,
        CASE
          WHEN e.situacao = 'Q' THEN 'QUITADO'
          WHEN e.vencimento IS NOT NULL AND e.vencimento < CURRENT_DATE THEN 'VENCIDO'
          ELSE 'ABERTO'
        END AS situacao_label
      FROM emprestimos_dinheiro e
      INNER JOIN clientes c ON c.cliente_id = e.cliente_id
      LEFT JOIN (SELECT emprestimo_id, SUM(valor) AS total_pago FROM pagamentos_dinheiro GROUP BY emprestimo_id) pag
        ON pag.emprestimo_id = e.id
      WHERE ${where}
      ORDER BY e.id DESC
      LIMIT ${limit} OFFSET ${offset}`, params);

    res.json({ ok: true, data: result.rows, paginacao: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/dinheiro/stats
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT COUNT(*) AS total_registros,
        COALESCE(SUM(e.capital), 0) AS total_capital,
        COALESCE(SUM(pag.total_pago), 0) AS total_pago,
        SUM(CASE WHEN e.situacao='A' AND e.vencimento < CURRENT_DATE THEN 1 ELSE 0 END) AS total_vencidos
      FROM emprestimos_dinheiro e
      LEFT JOIN (SELECT emprestimo_id, SUM(valor) AS total_pago FROM pagamentos_dinheiro GROUP BY emprestimo_id) pag
        ON pag.emprestimo_id = e.id`);
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/dinheiro/vencimentos
router.get('/vencimentos', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const incluirVencidos = req.query.incluirVencidos === '1';
    let whereData;
    if (incluirVencidos || dias === -1) {
      whereData = `e.vencimento < CURRENT_DATE`;
    } else {
      whereData = `e.vencimento >= CURRENT_DATE AND e.vencimento <= CURRENT_DATE + INTERVAL '${dias} days'`;
    }
    const result = await query(`
      SELECT e.id AS emprestimo_id, c.nome AS cliente_nome, c.telefone,
        e.capital, e.juros_pct,
        ROUND(e.capital * (e.juros_pct / 100.0), 2) AS juros_valor,
        TO_CHAR(e.vencimento,'YYYY-MM-DD') AS vencimento,
        e.descricao, e.situacao
      FROM emprestimos_dinheiro e
      INNER JOIN clientes c ON c.cliente_id = e.cliente_id
      WHERE e.situacao = 'A' AND ${whereData}
      ORDER BY e.vencimento ASC, c.nome ASC`);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/dinheiro/relatorio/pagamentos-juros
router.get('/relatorio/pagamentos-juros', async (req, res) => {
  try {
    const { cliente_id, emprestimo_id, de, ate } = req.query;
    let where = '1=1';
    const params = [];
    let pi = 1;
    if (cliente_id)    { where += ` AND e.cliente_id = $${pi++}`;    params.push(parseInt(cliente_id)); }
    if (emprestimo_id) { where += ` AND p.emprestimo_id = $${pi++}`; params.push(parseInt(emprestimo_id)); }
    if (de)  { where += ` AND p.data >= $${pi++}`; params.push(de); }
    if (ate) { where += ` AND p.data <= $${pi++}`; params.push(ate); }

    const result = await query(`
      SELECT p.id AS pag_id, p.emprestimo_id,
        TO_CHAR(p.data,'YYYY-MM-DD') AS data_pag,
        p.valor, p.descricao AS pag_obs,
        e.cliente_id, c.nome AS cliente_nome,
        e.capital, e.juros_pct,
        COALESCE(pag_total.total_pago, 0) AS total_pago_ate_hoje,
        e.situacao,
        TO_CHAR(e.data,'YYYY-MM-DD') AS data_emp,
        TO_CHAR(e.vencimento,'YYYY-MM-DD') AS vencimento,
        e.descricao AS emp_desc
      FROM pagamentos_dinheiro p
      INNER JOIN emprestimos_dinheiro e ON e.id = p.emprestimo_id
      INNER JOIN clientes c ON c.cliente_id = e.cliente_id
      LEFT JOIN (SELECT emprestimo_id, SUM(valor) AS total_pago FROM pagamentos_dinheiro GROUP BY emprestimo_id) pag_total
        ON pag_total.emprestimo_id = e.id
      WHERE ${where}
      ORDER BY p.data DESC, p.id DESC`, params);

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/dinheiro/:id/pagamentos
router.get('/:id/pagamentos', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM pagamentos_dinheiro WHERE emprestimo_id = $1 ORDER BY data DESC`,
      [parseInt(req.params.id)]);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/dinheiro
router.post('/', async (req, res) => {
  try {
    const { cliente_id, data, vencimento, descricao, capital, juros_pct } = req.body;
    if (!cliente_id || !capital) return res.status(400).json({ ok: false, erro: 'cliente_id e capital são obrigatórios' });
    const result = await query(`
      INSERT INTO emprestimos_dinheiro (cliente_id, data, vencimento, descricao, capital, juros_pct, situacao)
      VALUES ($1,$2,$3,$4,$5,$6,'A') RETURNING id`,
      [parseInt(cliente_id), data?.substring(0,10)||null, vencimento?.substring(0,10)||null,
       descricao||null, parseFloat(capital), parseFloat(juros_pct)||0]);
    res.json({ ok: true, data: result.rows[0] || {} });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PUT /api/dinheiro/:id
router.put('/:id', async (req, res) => {
  try {
    const { data, vencimento, descricao, capital, juros_pct, situacao } = req.body;
    await query(`
      UPDATE emprestimos_dinheiro SET data=$1, vencimento=$2, descricao=$3, capital=$4, juros_pct=$5
      WHERE id=$6`,
      [data?.substring(0,10)||null, vencimento?.substring(0,10)||null,
       descricao||null, parseFloat(capital), parseFloat(juros_pct)||0, parseInt(req.params.id)]);
    if (situacao) {
      await query('UPDATE emprestimos_dinheiro SET situacao=$1 WHERE id=$2', [situacao, parseInt(req.params.id)]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PATCH /api/dinheiro/:id/situacao
router.patch('/:id/situacao', async (req, res) => {
  try {
    const { situacao } = req.body;
    await query('UPDATE emprestimos_dinheiro SET situacao=$1 WHERE id=$2', [situacao, parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/dinheiro/:id/pagamento
router.post('/:id/pagamento', async (req, res) => {
  try {
    const { data, descricao, valor } = req.body;
    if (!valor) return res.status(400).json({ ok: false, erro: 'Valor é obrigatório' });
    const result = await query(`
      INSERT INTO pagamentos_dinheiro (emprestimo_id, data, descricao, valor)
      VALUES ($1,$2,$3,$4) RETURNING id`,
      [parseInt(req.params.id), data?.substring(0,10)||null, descricao||null, parseFloat(valor)]);
    res.json({ ok: true, data: result.rows[0] || {} });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PUT /api/dinheiro/pagamento/:id
router.put('/pagamento/:id', async (req, res) => {
  try {
    const { data, valor, descricao } = req.body;
    if (!valor || valor <= 0) return res.status(400).json({ ok: false, erro: 'Valor obrigatório' });
    await query(`UPDATE pagamentos_dinheiro SET data=$1, valor=$2, descricao=$3 WHERE id=$4`,
      [data?.substring(0,10)||null, parseFloat(valor), descricao||null, parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /api/dinheiro/pagamento/:id
router.delete('/pagamento/:id', async (req, res) => {
  try {
    await query('DELETE FROM pagamentos_dinheiro WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /api/dinheiro/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM pagamentos_dinheiro WHERE emprestimo_id=$1', [parseInt(req.params.id)]);
    await query('DELETE FROM emprestimos_dinheiro WHERE id=$1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
