# ============================================================
# INSTRUÇÕES DE DEPLOY NO RENDER.COM
# ============================================================

## PASSO 1 — Criar repositório no GitHub

1. Acesse https://github.com e faça login
2. Clique em "New repository"
3. Nome: cafe-sistema
4. Clique "Create repository"
5. Suba todos os arquivos desta pasta para o repositório

## PASSO 2 — Criar banco PostgreSQL no Render

1. No dashboard do Render: https://dashboard.render.com
2. Clique "New +" → "PostgreSQL"
3. Nome: cafe-db
4. Region: São Paulo ou Oregon (qualquer um)
5. Plan: Free
6. Clique "Create Database"
7. Aguarde criar e COPIE a "Internal Database URL"

## PASSO 3 — Criar Web Service no Render

1. Clique "New +" → "Web Service"
2. Conecte seu GitHub e selecione o repositório cafe-sistema
3. Configure:
   - Name: cafe-sistema
   - Region: mesma do banco
   - Branch: main
   - Runtime: Node
   - Build Command: npm install
   - Start Command: node server.js
   - Plan: Free

4. Em "Environment Variables" adicione:
   - DATABASE_URL = [cole a Internal Database URL do passo 2]
   - NODE_ENV = production

5. Clique "Create Web Service"

## PASSO 4 — Criar as tabelas do banco

1. No Render, vá no banco criado (cafe-db)
2. Clique em "PSQL Command" e copie o comando
3. Cole no terminal (ou use o psql do Render)
4. Cole o conteúdo do arquivo schema.sql

## PASSO 5 — Migrar dados do SQL Server

1. No SQL Server Management Studio, execute exportar_sqlserver.sql
2. Salve os resultados como arquivo .sql
3. Execute esse arquivo no PostgreSQL do Render

## PASSO 6 — Copiar arquivos do frontend

Os arquivos da pasta public/ (index.html, app.js, etc.) do sistema atual
devem ser copiados para a pasta public/ deste projeto.

## OBSERVAÇÕES

- O plano Free do Render "dorme" após 15min de inatividade
  (primeira requisição demora ~30s para acordar)
- Para manter ativo 24h use: https://uptimerobot.com (gratuito)
  Configure para pingar seu app a cada 10 minutos

## URL DO SISTEMA

Após o deploy, o sistema ficará disponível em:
https://cafe-sistema.onrender.com (ou similar)
Acessível de qualquer celular, em qualquer lugar, sem VPN!
