const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/clientes
router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;
    let sql = `SELECT cliente_id, nome, documento, telefone, email, endereco, ativo
               FROM clientes WHERE ativo = true`;
    const params = [];
    if (busca) {
      params.push(`%${busca}%`);
      sql += ` AND (nome ILIKE $1 OR documento ILIKE $1)`;
    }
    sql += ' ORDER BY nome';
    const result = await query(sql, params);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error('Erro ao listar clientes:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM clientes WHERE cliente_id = $1', [parseInt(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ ok: false, erro: 'Cliente não encontrado' });
    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /api/clientes/:id/saldo
router.get('/:id/saldo', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vw_saldo_clientes WHERE cliente_id = $1', [parseInt(req.params.id)]);
    res.json({ ok: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /api/clientes
router.post('/', async (req, res) => {
  try {
    const { cliente_id, nome, documento, telefone, email, endereco, ativo } = req.body;
    if (!nome) return res.status(400).json({ ok: false, erro: 'Nome é obrigatório' });
    let result;
    if (cliente_id) {
      result = await query(`
        UPDATE clientes SET nome=$1, documento=$2, telefone=$3, email=$4, endereco=$5, ativo=$6, atualizado_em=NOW()
        WHERE cliente_id=$7 RETURNING cliente_id`,
        [nome, documento||null, telefone||null, email||null, endereco||null, ativo!==undefined?ativo:true, cliente_id]);
    } else {
      result = await query(`
        INSERT INTO clientes (nome, documento, telefone, email, endereco, ativo)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING cliente_id`,
        [nome, documento||null, telefone||null, email||null, endereco||null, ativo!==undefined?ativo:true]);
    }
    res.json({ ok: true, cliente_id: result.rows[0]?.cliente_id });
  } catch (err) {
    console.error('Erro ao salvar cliente:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// DELETE /api/clientes/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('UPDATE clientes SET ativo=false, atualizado_em=NOW() WHERE cliente_id=$1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
