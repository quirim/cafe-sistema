const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const CONFIG_FILE = path.join(__dirname,'..','config','usuarios.json');

function hashSenha(s){ return crypto.createHash('sha256').update(s).digest('hex'); }
function hashSenhaAntigo(s){ return crypto.createHash('sha256').update(s+'cafe-safra-2025').digest('hex'); }
function senhaCorreta(digitada, salva){
  return salva === hashSenha(digitada) || salva === hashSenhaAntigo(digitada);
}

function carregarConfig(){
  try{
    if(!fs.existsSync(path.dirname(CONFIG_FILE)))fs.mkdirSync(path.dirname(CONFIG_FILE),{recursive:true});
    if(!fs.existsSync(CONFIG_FILE)){
      const pad={usuarios:[{usuario:'admin',senha:hashSenha('1234'),nome:'Administrador'}]};
      fs.writeFileSync(CONFIG_FILE,JSON.stringify(pad,null,2));
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'));
  }catch(e){return{usuarios:[{usuario:'admin',senha:hashSenha('1234'),nome:'Administrador'}]};}
}

const sessoes={};
function gerarToken(){ return crypto.randomBytes(32).toString('hex'); }

function requireAuth(req,res,next){
  const token=req.headers['x-auth-token']||req.query._token;
  if(token&&sessoes[token]){req.usuario=sessoes[token];return next();}
  res.status(401).json({ok:false,erro:'Nao autenticado'});
}

router.post('/login',(req,res)=>{
  const{usuario,senha}=req.body;
  if(!usuario||!senha)return res.status(400).json({ok:false,erro:'Usuario e senha obrigatorios'});
  const cfg=carregarConfig();
  const user=cfg.usuarios.find(u=>u.usuario===usuario&&senhaCorreta(senha,u.senha));
  if(!user)return res.status(401).json({ok:false,erro:'Usuario ou senha incorretos'});
  const token=gerarToken();
  sessoes[token]={usuario:user.usuario,nome:user.nome};
  if(user.senha!==hashSenha(senha)){
    const cfg2=carregarConfig();
    const idx=cfg2.usuarios.findIndex(u=>u.usuario===usuario);
    if(idx>-1){cfg2.usuarios[idx].senha=hashSenha(senha);try{fs.writeFileSync(CONFIG_FILE,JSON.stringify(cfg2,null,2));}catch(e){}}
  }
  res.json({ok:true,token,nome:user.nome});
});

router.post('/logout',(req,res)=>{
  const token=req.headers['x-auth-token'];
  if(token)delete sessoes[token];
  res.json({ok:true});
});

router.get('/verificar',(req,res)=>{
  const token=req.headers['x-auth-token'];
  if(token&&sessoes[token])return res.json({ok:true,nome:sessoes[token].nome});
  res.status(401).json({ok:false});
});

router.post('/trocar-senha',(req,res)=>{
  const token=req.headers['x-auth-token'];
  if(!token||!sessoes[token])return res.status(401).json({ok:false,erro:'Nao autenticado'});
  const{senha_atual,senha_nova}=req.body;
  if(!senha_atual||!senha_nova)return res.status(400).json({ok:false,erro:'Preencha todos os campos'});
  if(senha_nova.length<4)return res.status(400).json({ok:false,erro:'Senha deve ter pelo menos 4 caracteres'});
  const cfg=carregarConfig();
  const idx=cfg.usuarios.findIndex(u=>u.usuario===sessoes[token].usuario);
  if(idx===-1)return res.status(404).json({ok:false,erro:'Usuario nao encontrado'});
  if(!senhaCorreta(senha_atual,cfg.usuarios[idx].senha))return res.status(401).json({ok:false,erro:'Senha atual incorreta'});
  cfg.usuarios[idx].senha=hashSenha(senha_nova);
  fs.writeFileSync(CONFIG_FILE,JSON.stringify(cfg,null,2));
  res.json({ok:true});
});

module.exports=router;
module.exports.requireAuth=requireAuth;
