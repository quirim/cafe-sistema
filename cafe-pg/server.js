require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes   = require('./routes/auth');
const app = express();
const PORT = process.env.PORT || 3001;

// Testa conexão na inicialização
const { query } = require('./db');
query('SELECT 1').then(() => {
  console.log('✅ Banco PostgreSQL conectado!');
}).catch(err => {
  console.error('❌ Falha ao conectar:', err.message);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',       authRoutes);
app.use('/api/clientes',   require('./routes/clientes'));
app.use('/api/movimentos', require('./routes/movimentos'));
app.use('/api/dinheiro',   require('./routes/dinheiro'));

app.get('/api/status', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, status: 'Banco conectado', porta: PORT });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   ☕  CAFÉ EMPRÉSTIMOS - SISTEMA          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║   Acesse:  http://localhost:${PORT}          ║`);
  console.log('╚══════════════════════════════════════════╝');
});
