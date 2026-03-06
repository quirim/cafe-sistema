const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/movimentos
router.get('/', async (req, res) => {
  try {
    const { tipo, data_inicio, data_fim, busca, cliente_id } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(99999, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params = [];
    let pi = 1;

    if (cliente_id)  { where += ` AND m.cliente_id = $${pi++}`; params.push(parseInt(cliente_id)); }
    if (tipo)        { where += ` AND m.tipo = $${pi++}`;        params.push(tipo); }
    if (data_inicio) { where += ` AND m.data_movimento >= $${pi++}`; params.push(data_inicio.substring(0,10)); }
    if (data_fim)    { where += ` AND m.data_movimento <= $${pi++}`; params.push(data_fim.substring(0,10)); }
    if (busca)       { where += ` AND (c.nome ILIKE $${pi} OR CAST(m.movimento_id AS TEXT) ILIKE $${pi})`; params.push(`%${busca}%`); pi++; }

    const countResult = await query(`
      SELECT COUNT(*) AS total FROM movimentos m
      INNER JOIN clientes c ON c.cliente_id = m.cliente_id
      WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].total);

    const result = await query(`
      SELECT
        m.movimento_id, m.cliente_id,
        c.nome AS cliente_nome, c.telefone, c.documento,
        m.tipo,
        TO_CHAR(m.data_movimento,  'YYYY-MM-DD') AS data_movimento,
        TO_CHAR(m.data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
        m.sacas, m.kg_avulso,
        COALESCE(m.total_kg_com_juros, m.sacas*60+m.kg_avulso) AS total_kg_com_juros,
        m.juros_pct, m.observacao,
        COALESCE(vs.saldo_devedor_sacas, 0) AS saldo_devedor_sacas,
        COALESCE(vs.saldo_devedor_kg,    0) AS saldo_devedor_kg,
        COALESCE(vs.situacao, 'A')          AS situacao
      FROM movimentos m
      INNER JOIN clientes c ON c.cliente_id = m.cliente_id
      LEFT  JOIN vw_saldo_clientes vs ON vs.cliente_id = m.cliente_id
      WHERE ${where}
      ORDER BY m.movimento_id ASC
      LIMIT ${limit} OFFSET ${offset}`, params);

    const rows = result.rows;

    // Calcula saldo acumulado por linha
    const clienteIds = [...new Set(rows.map(r => r.cliente_id))];
    const saldoBase = {};

    if (clienteIds.length > 0 && offset > 0) {
      for (const cid of clienteIds) {
        const primeiro = rows.find(r => r.cliente_id === cid)?.movimento_id || 0;
        const r = await query(`
          SELECT COALESCE(
            SUM(CASE tipo WHEN 'D' THEN COALESCE(total_kg_com_juros, sacas*60+kg_avulso) ELSE 0 END) -
            SUM(CASE tipo WHEN 'C' THEN sacas*60+kg_avulso ELSE 0 END), 0) AS saldo_antes
          FROM movimentos
          WHERE cliente_id = $1 AND movimento_id < $2`, [cid, primeiro]);
        saldoBase[cid] = Math.max(0, Math.trunc(parseFloat(r.rows[0]?.saldo_antes) || 0));
      }
    }

    const acc = { ...saldoBase };
    rows.forEach(function(d) {
      if (!acc[d.cliente_id]) acc[d.cliente_id] = 0;
      const base   = (parseInt(d.sacas)||0)*60 + (parseInt(d.kg_avulso)||0);
      const comJrs = Math.trunc(parseFloat(d.total_kg_com_juros) || base);
      if (d.tipo === 'D') {
        acc[d.cliente_id] = Math.trunc(acc[d.cliente_id] + comJrs);
      } else {
        acc[d.cliente_id] = Math.max(0, Math.trunc(acc[d.cliente_id] - base));
      }
      d.saldo_acumulado_kg = acc[d.cliente_id];
    });

    res.json({ ok: true, data: rows, paginacao: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('ERRO /api/movimentos:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/movimentos/saldos
router.get('/saldos', async (req, res) => {
  try {
    const result = await query(`
      SELECT vs.cliente_id, c.nome, c.telefone,
        vs.saldo_devedor_kg, vs.saldo_devedor_sacas, vs.saldo_devedor_kg_resto, vs.situacao
      FROM vw_saldo_clientes vs
      INNER JOIN clientes c ON c.cliente_id = vs.cliente_id
      WHERE vs.saldo_devedor_kg > 0 AND c.ativo = true
      ORDER BY vs.saldo_devedor_kg DESC`);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/movimentos/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT m.*, c.nome AS cliente_nome, c.telefone, c.documento, c.endereco
      FROM movimentos m
      INNER JOIN clientes c ON c.cliente_id = m.cliente_id
      WHERE m.movimento_id = $1`, [parseInt(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ ok: false, erro: 'Não encontrado' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/movimentos
router.post('/', async (req, res) => {
  try {
    const { cliente_id, tipo, data_movimento, data_vencimento, sacas, kg_avulso, juros_pct, observacao } = req.body;
    if (!cliente_id || !tipo || !data_movimento || sacas === undefined)
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios faltando' });
    const base = (parseInt(sacas)||0)*60 + (parseInt(kg_avulso)||0);
    const jp = tipo==='D' ? (parseFloat(juros_pct)||0) : null;
    const totalKg = jp ? Math.trunc(base * (1 + jp/100)) : base;
    const result = await query(`
      INSERT INTO movimentos (cliente_id, tipo, data_movimento, data_vencimento, sacas, kg_avulso, juros_pct, total_kg_com_juros, observacao)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING movimento_id`,
      [parseInt(cliente_id), tipo, data_movimento?.substring(0,10)||null,
       data_vencimento?.substring(0,10)||null, parseInt(sacas)||0,
       parseInt(kg_avulso)||0, jp, totalKg, observacao||null]);
    res.json({ ok: true, data: result.rows[0] || {} });
  } catch (err) {
    console.error('ERRO POST movimentos:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PUT /api/movimentos/:id
router.put('/:id', async (req, res) => {
  try {
    const { tipo, data_movimento, data_vencimento, sacas, kg_avulso, juros_pct, observacao } = req.body;
    const base = (parseInt(sacas)||0)*60 + (parseInt(kg_avulso)||0);
    const jp = parseFloat(juros_pct)||null;
    const totalKg = jp ? Math.trunc(base * (1 + jp/100)) : base;
    await query(`
      UPDATE movimentos SET tipo=$1, data_movimento=$2, data_vencimento=$3, sacas=$4, kg_avulso=$5,
        juros_pct=$6, total_kg_com_juros=$7, observacao=$8
      WHERE movimento_id=$9`,
      [tipo, data_movimento?.substring(0,10)||null, data_vencimento?.substring(0,10)||null,
       parseInt(sacas)||0, parseInt(kg_avulso)||0, jp, totalKg, observacao||null, parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('ERRO PUT movimentos:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /api/movimentos/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM movimentos WHERE movimento_id=$1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('ERRO DELETE movimentos:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
