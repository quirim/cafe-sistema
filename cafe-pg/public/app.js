
var API = window.location.origin + '/api';
var movimentos = [], dadosDin = [], clientes = [];
var selCafe = null, paginaCafe = 1, totalPaginasCafe = 1, limitCafe = 50;
var selDin  = null, paginaDin  = 1, totalPaginasDin  = 1, limitDin  = 50;
var selCli  = null;
var filtroCafe = '', filtroDin = '', filtroCli = '';
var buscaTimer = null;
var authToken = localStorage.getItem('auth_token') || '';

window.addEventListener('load', function() {
  verificarAuth();
});

async function verificarAuth(){
  if(!authToken){ mostrarLogin(); return; }
  try{
    var r=await fetch(API+'/auth/verificar',{headers:{'x-auth-token':authToken}});
    var d=await r.json();
    if(d.ok){ ocultarLogin(d.nome); iniciarSistema(); }
    else{ authToken=''; localStorage.removeItem('auth_token'); mostrarLogin(); }
  }catch(e){ mostrarLogin(); }
}
function mostrarLogin(){
  document.getElementById('telaLogin').style.display='flex';
  setTimeout(function(){document.getElementById('loginUser').focus();},100);
}
function ocultarLogin(nome){
  document.getElementById('telaLogin').style.display='none';
  if(nome)document.getElementById('topUsuario').textContent=nome;
}
async function fazerLogin(){
  var usuario=document.getElementById('loginUser').value.trim();
  var senha=document.getElementById('loginSenha').value;
  var erroEl=document.getElementById('loginErro');
  erroEl.textContent='';
  if(!usuario||!senha){erroEl.textContent='Preencha usuario e senha';return;}
  try{
    var r=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario,senha})});
    var d=await r.json();
    if(d.ok){
      authToken=d.token; localStorage.setItem('auth_token',authToken);
      document.getElementById('loginSenha').value='';
      ocultarLogin(d.nome); iniciarSistema();
    }else{
      erroEl.textContent=d.erro||'Usuario ou senha incorretos';
      document.getElementById('loginSenha').value='';
      document.getElementById('loginSenha').focus();
    }
  }catch(e){erroEl.textContent='Erro: rota /api/auth nao encontrada. Verifique o server.js ('+e.message+')';}
}
async function fazerLogout(){
  if(!confirm('Deseja sair do sistema?'))return;
  try{await fetch(API+'/auth/logout',{method:'POST',headers:{'x-auth-token':authToken}});}catch(e){}
  authToken=''; localStorage.removeItem('auth_token');
  document.getElementById('loginUser').value='';
  document.getElementById('loginSenha').value='';
  document.getElementById('loginErro').textContent='';
  mostrarLogin();
}
function iniciarSistema(){
  // Limpa filtros ao iniciar
  document.getElementById('searchCafe').value='';
  document.getElementById('searchDin').value='';
  filtroCafe=''; filtroDin=''; filtroCli='';
  verificarStatus();
  carregarClientes();
  carregarDashboard();
  carregarCafe(1,'');
  carregarDin(1,'');
  document.getElementById('movData').value=hoje();
  document.getElementById('dinData').value=hoje();
  document.getElementById('pagData').value=hoje();
  document.addEventListener('click',function(e){
    if(!e.target.closest('.drop-wrap'))
      document.querySelectorAll('.drop-menu').forEach(function(m){m.classList.remove('show');});
  });
}
async function fazerBackup(){
  toast('Gerando backup, aguarde...','info');
  try{
    var r=await fetch(API+'/backup/gerar',{headers:{'x-auth-token':authToken}});
    if(!r.ok){var d=await r.json();return toast('Erro: '+(d.erro||r.status),'error');}
    var blob=await r.blob();
    var disp=r.headers.get('Content-Disposition')||'';
    var match=disp.match(/filename="([^"]+)"/);
    var filename=match?match[1]:'backup_'+hoje()+'.sql';
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();
    toast('Backup gerado com sucesso!','success');
  }catch(e){toast('Erro ao gerar backup: '+e.message,'error');}
}
function abrirTrocarSenha(){
  document.getElementById('senhaAtual').value='';
  document.getElementById('senhaNova').value='';
  document.getElementById('senhaConf').value='';
  document.getElementById('senhaErro').textContent='';
  var nome=document.getElementById('topUsuario').textContent||'admin';
  document.getElementById('senhaUsuarioNome').textContent=nome;
  atualizarForcaSenha('');
  document.getElementById('telaSenha').setAttribute('style','display:flex;position:fixed;inset:0;background:linear-gradient(135deg,#3a006f 0%,#6a1b9a 50%,#7b1fa2 100%);align-items:center;justify-content:center;z-index:9998');
  setTimeout(function(){document.getElementById('senhaAtual').focus();},100);
}
function fecharTrocaSenha(){
  document.getElementById('telaSenha').setAttribute('style','display:none;position:fixed;inset:0;background:linear-gradient(135deg,#3a006f 0%,#6a1b9a 50%,#7b1fa2 100%);align-items:center;justify-content:center;z-index:9998');
}
function atualizarForcaSenha(v){
  var n=0;
  if(v.length>=4)n++;
  if(v.length>=8)n++;
  if(/[0-9]/.test(v)&&/[a-zA-Z]/.test(v))n++;
  if(/[^a-zA-Z0-9]/.test(v))n++;
  var cores=['#e0e0e0','#ef5350','#ff9800','#66bb6a','#2e7d32'];
  var txts=['','Fraca','Razoável','Boa','Forte'];
  var cor=n>0?cores[n]:'#e0e0e0';
  for(var i=1;i<=4;i++){
    document.getElementById('forca'+i).style.background=i<=n?cor:'#e0e0e0';
  }
  document.getElementById('forcaTxt').textContent=v.length>0?txts[n]:'';
  document.getElementById('forcaTxt').style.color=cor;
}
async function trocarSenha(){
  var atual=document.getElementById('senhaAtual').value;
  var nova=document.getElementById('senhaNova').value;
  var conf=document.getElementById('senhaConf').value;
  var erroEl=document.getElementById('senhaErro');
  erroEl.textContent='';
  if(!atual||!nova||!conf){erroEl.textContent='Preencha todos os campos';return;}
  if(nova.length<4){erroEl.textContent='Nova senha deve ter pelo menos 4 caracteres';return;}
  if(nova!==conf){erroEl.textContent='Nova senha e confirmação não conferem';return;}
  try{
    var r=await fetch(API+'/auth/trocar-senha',{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':authToken},body:JSON.stringify({senha_atual:atual,senha_nova:nova})});
    var d=await r.json();
    if(d.ok){
      toast('Senha alterada com sucesso!','success');
      fecharTrocaSenha();
    }else{erroEl.textContent=d.erro||'Senha atual incorreta';}
  }catch(e){erroEl.textContent='Erro de conexão';}
}

function hoje(){return new Date().toISOString().split('T')[0];}
function fmtData(d){
  if(!d)return '-';
  var s=typeof d==='string'?d.substring(0,10):new Date(d).toISOString().substring(0,10);
  var p=s.split('-');
  if(p.length===3)return p[2]+'/'+p[1]+'/'+p[0];
  return '-';
}
function fmtBRL(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function tradSit(s){return({A:'Ativo',V:'Vencido',Q:'Quitado',P:'Parcial'})[s]||s||'-';}
function recarregarTudo(){carregarCafe();carregarDin();carregarClientes();toast('Atualizado!','success');}
function fechar(id){document.getElementById(id).classList.remove('show');}
function toggleDrop(id){document.getElementById(id).classList.toggle('show');}
function toast(msg,tipo){
  var el=document.createElement('div');
  el.className='toast '+(tipo||'success');el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(function(){el.remove();},3000);
}
function trocarAba(aba){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active');});
  document.getElementById('page-'+aba).classList.add('active');
  document.getElementById('tab-'+aba).classList.add('active');
  if(aba==='dashboard')carregarDashboard();
  if(aba==='cafe')carregarCafe();
  if(aba==='dinheiro')carregarDin();
  if(aba==='clientes')carregarCli();
  if(aba==='relatorios'&&clientes.length===0)carregarClientes();
}

async function verificarStatus(){
  try{
    var r=await fetch(API+'/status');var d=await r.json();
    var dbgApi=document.getElementById('dbg-api');
    if(dbgApi)dbgApi.innerHTML='HTTP '+r.status;
    document.getElementById('dbDot').className='db-dot '+(d.ok?'ok':'erro');
    document.getElementById('dbStatus').textContent=d.ok?'Banco OK':'Erro BD';
  }catch(e){
    document.getElementById('dbDot').className='db-dot erro';
    document.getElementById('dbStatus').textContent='Sem conexao';
  }
}

/* ===== CAFE ===== */
async function carregarCafe(pagina,buscaOverride){
  paginaCafe=pagina||paginaCafe;
  var busca=buscaOverride!==undefined?buscaOverride:document.getElementById('searchCafe').value.trim();
  var de=document.getElementById('cafeDe')?document.getElementById('cafeDe').value:'';
  var ate=document.getElementById('cafeAte')?document.getElementById('cafeAte').value:'';
  var url=API+'/movimentos?page='+paginaCafe+'&limit='+limitCafe;
  if(busca)url+='&busca='+encodeURIComponent(busca);
  if(de)url+='&data_inicio='+de;
  if(ate)url+='&data_fim='+ate;
  document.getElementById('gridCafe').innerHTML='<tr><td colspan="11" style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span>Carregando...</td></tr>';
  try{
    var r=await fetch(url);
    var d=await r.json();
    if(d.ok){
      movimentos=d.data;
      var pag=d.paginacao||{page:1,totalPages:1,total:d.data.length,limit:d.data.length};
      totalPaginasCafe=pag.totalPages;
      renderCafe();renderPaginacaoCafe(pag);
    }else{
      document.getElementById('gridCafe').innerHTML='<tr><td colspan="11" style="text-align:center;padding:20px;color:#c62828">Erro: '+(d.erro||'desconhecido')+'</td></tr>';
    }
  }catch(e){
    document.getElementById('gridCafe').innerHTML='<tr><td colspan="11" style="text-align:center;padding:20px;color:#c62828">ERRO: '+e.message+'</td></tr>';
  }
}

function renderCafe(){
  var lista=movimentos;
  var tbody=document.getElementById('gridCafe');
  if(!lista.length){tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:30px;color:#aaa">Nenhum registro.</td></tr>';atualizarRodapeCafe(lista);return;}
  var isMobile=window.innerWidth<=768;
  var h='';
  for(var i=0;i<lista.length;i++){
    var d=lista[i];
    var baseKg=(parseInt(d.sacas)||0)*60+(parseInt(d.kg_avulso)||0);
    var totalKgJ=parseInt(d.total_kg_com_juros)||baseKg;
    var jurosKg=d.tipo==='D'?Math.max(0,totalKgJ-baseKg):0;
    var jSc=Math.floor(jurosKg/60),jKg=jurosKg%60;
    var acum=Math.trunc(parseFloat(d.saldo_acumulado_kg)||0);
    var quit=acum<=0;
    var sSc=Math.floor(Math.abs(acum)/60),sKg=Math.abs(acum)%60;
    var saldoTxt=quit?'Quitado':(sSc+' sc '+sKg+' kg');
    var saldoCSS=quit?'color:#2e7d32;font-weight:700':'color:#c62828;font-weight:700';
    var vencido=d.tipo==='D'&&d.data_vencimento&&new Date(d.data_vencimento)<new Date();
    var vencCSS=vencido?'color:#c62828;font-weight:700':'';
    var badgeD=d.tipo==='D';
    var badge=badgeD?'<span class="badge-d">D</span>':'<span class="badge-c">C</span>';
    var sel=selCafe===d.movimento_id;
    if(isMobile){
      h+='<tr class="'+(sel?'selected':'')+' mob-card-row" onclick="selecionarCafe('+d.movimento_id+')" ondblclick="editarMovId('+d.movimento_id+')">';
      h+='<td colspan="11" style="padding:10px 12px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      h+='<span style="font-weight:700;font-size:13px">'+(d.cliente_nome||'-')+'</span>';
      h+=badge;
      h+='</div>';
      h+='<div style="display:flex;justify-content:space-between;font-size:12px;color:#555">';
      h+='<span>'+fmtData(d.data_movimento)+'</span>';
      h+='<span style="font-weight:600">'+(parseInt(d.sacas)||0)+' sc '+(parseInt(d.kg_avulso)||0)+' kg</span>';
      h+='<span style="'+saldoCSS+'">'+saldoTxt+'</span>';
      h+='</div>';
      if(d.tipo==='D'){
        h+='<div style="font-size:11px;color:#666;margin-top:3px;display:flex;gap:10px">';
        h+='<span>Juros: <b>'+(d.juros_pct||0)+'%</b></span>';
        h+='<span>Juros Sc/Kg: <b>'+jSc+' sc '+jKg+' kg</b></span>';
        h+='</div>';
      }
      if(d.data_vencimento||d.observacao){
        h+='<div style="font-size:11px;color:#888;margin-top:2px">';
        if(d.data_vencimento)h+='<span style="'+vencCSS+'">Venc: '+fmtData(d.data_vencimento)+'</span>';
        if(d.observacao)h+='<span style="margin-left:8px">'+(d.observacao.length>30?d.observacao.substring(0,30)+'...':d.observacao)+'</span>';
        h+='</div>';
      }
      h+='</td></tr>';
    }else{
      h+='<tr class="'+(sel?'selected':'')+'" onclick="selecionarCafe('+d.movimento_id+')" ondblclick="editarMovId('+d.movimento_id+')">';
      h+='<td style="text-align:center;width:40px"><input type="checkbox" '+(sel?'checked':'')+'></td>';
      h+='<td style="text-align:center"><b>'+String(d.movimento_id).padStart(6,'0')+'</b></td>';
      h+='<td>'+badge+'</td>';
      h+='<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(d.observacao||'&mdash;')+'</td>';
      h+='<td><b>'+(d.cliente_nome||'-')+'</b>'+(d.telefone?'<br><small style="color:#888;font-size:11px">'+d.telefone+'</small>':'')+'</td>';
      h+='<td style="white-space:nowrap">'+fmtData(d.data_movimento)+'</td>';
      h+='<td style="white-space:nowrap;'+vencCSS+'">'+fmtData(d.data_vencimento)+'</td>';
      h+='<td style="white-space:nowrap">'+(parseInt(d.sacas)||0)+' sc '+(parseInt(d.kg_avulso)||0)+' kg</td>';
      h+='<td>'+(d.tipo==='D'?(d.juros_pct||0)+'%':'&mdash;')+'</td>';
      h+='<td style="white-space:nowrap">'+(d.tipo==='D'?jSc+' sc '+jKg+' kg':'&mdash;')+'</td>';
      h+='<td style="white-space:nowrap;'+saldoCSS+'">'+saldoTxt+'</td>';
      h+='</tr>';
    }
  }
  tbody.innerHTML=h;
  atualizarRodapeCafe(lista);
}

function atualizarRodapeCafe(lista){
  document.getElementById('ftTotal').textContent='Página: '+lista.length+' registros';
  var venc=lista.filter(function(d){return d.situacao==='VENCIDO'||d.situacao==='V';}).length;
  document.getElementById('ftVenc').textContent='Vencidos: '+venc;
  var u={};lista.filter(function(d){return d.tipo==='D';}).forEach(function(d){u[d.cliente_id]=1;});
  document.getElementById('ftClientes').textContent='Clientes c/ saldo: '+Object.keys(u).length;
}

function selecionarCafe(id){
  selCafe=id;
  document.getElementById('btnEditCafe').disabled=false;
  document.getElementById('btnComp').disabled=false;
  renderCafe();
}
function filtrarCafe(){
  clearTimeout(buscaTimer);
  buscaTimer=setTimeout(function(){paginaCafe=1;carregarCafe(1);},400);
}

function renderPaginacaoCafe(pag){
  var footer=document.getElementById('footerPagCafe');
  if(!footer||!pag)return;
  var p=pag.page,t=pag.totalPages,total=pag.total;
  var h='<div style="display:flex;align-items:center;gap:4px">';
  h+='<select class="pg-sel" onchange="limitCafe=parseInt(this.value);paginaCafe=1;carregarCafe(1)" style="margin-right:6px">';
  [20,50,100,200].forEach(function(n){h+='<option value="'+n+'"'+(limitCafe===n?' selected':'')+'>'+n+'/pág</option>';});
  h+='</select>';
  h+='<button class="pg-btn" '+(p<=1?'disabled':'')+' onclick="carregarCafe(1)" title="Primeira"><i class="fas fa-angle-double-left"></i></button>';
  h+='<button class="pg-btn" '+(p<=1?'disabled':'')+' onclick="carregarCafe('+(p-1)+')" title="Anterior"><i class="fas fa-angle-left"></i></button>';
  var s=Math.max(1,p-2),e=Math.min(t,p+2);
  if(s>1){h+='<button class="pg-btn" onclick="carregarCafe(1)">1</button>';if(s>2)h+='<span class="pg-dots">...</span>';}
  for(var i=s;i<=e;i++)h+='<button class="pg-btn'+(i===p?' pg-active':'')+'" onclick="carregarCafe('+i+')">'+i+'</button>';
  if(e<t){if(e<t-1)h+='<span class="pg-dots">...</span>';h+='<button class="pg-btn" onclick="carregarCafe('+t+')">'+t+'</button>';}
  h+='<button class="pg-btn" '+(p>=t?'disabled':'')+' onclick="carregarCafe('+(p+1)+')" title="Próxima"><i class="fas fa-angle-right"></i></button>';
  h+='<button class="pg-btn" '+(p>=t?'disabled':'')+' onclick="carregarCafe('+t+')" title="Última"><i class="fas fa-angle-double-right"></i></button>';
  h+='<span style="margin-left:8px;font-size:11px;color:#888">Total: <b style="color:#00838f">'+total+'</b> regs</span>';
  h+='</div>';
  footer.innerHTML=h;
}

/* COMPROVANTE */
function gerarComprovante(){
  if(!selCafe)return toast('Selecione um emprestimo!','warn');
  var mov=null;
  for(var i=0;i<movimentos.length;i++){if(movimentos[i].movimento_id===selCafe){mov=movimentos[i];break;}}
  if(!mov)return;
  if(mov.tipo!=='D')return toast('Comprovante disponivel apenas para Emprestimos!','warn');
  var num='Nº '+String(mov.movimento_id).padStart(6,'0');
  var baseKg=(parseInt(mov.sacas)||0)*60+(parseInt(mov.kg_avulso)||0);
  var totalKg=parseInt(mov.total_kg_com_juros)||baseKg;
  var jurosKg=totalKg-baseKg;
  var jSc=Math.floor(jurosKg/60),jKg=jurosKg%60;
  var totalSc=Math.floor(totalKg/60),totalKgR=totalKg%60;
  var acumKg=parseInt(mov.saldo_acumulado_kg)||0;
  var acumSc=Math.floor(acumKg/60),acumKgR=acumKg%60;
  var saldoTxt=acumKg>0?acumSc+' sc '+acumKgR+' kg':'Quitado';
  var agora=new Date();
  var emissao='Emitido em: '+agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  [1,2].forEach(function(v){
    document.getElementById('cNum'+v).textContent=num;
    document.getElementById('cCliente'+v).textContent=mov.cliente_nome||'-';
    document.getElementById('cData'+v).textContent=fmtData(mov.data_movimento);
    document.getElementById('cCapital'+v).textContent=(mov.sacas||0)+' sc '+(mov.kg_avulso||0)+' kg';
    document.getElementById('cJuros'+v).textContent=(mov.juros_pct||0)+'%';
    document.getElementById('cJurosKg'+v).textContent=jSc+' sc '+jKg+' kg';
    document.getElementById('cTotal'+v).textContent=totalSc+' sc '+totalKgR+' kg';
    document.getElementById('cSaldo'+v).textContent=saldoTxt;
    document.getElementById('cEmissao'+v).textContent=emissao;
    if(mov.documento){document.getElementById('cDoc'+v).textContent=mov.documento;document.getElementById('cDocRow'+v).style.display='';}
    else document.getElementById('cDocRow'+v).style.display='none';
    if(mov.telefone){document.getElementById('cTel'+v).textContent=mov.telefone;document.getElementById('cTelRow'+v).style.display='';}
    else document.getElementById('cTelRow'+v).style.display='none';
    if(mov.data_vencimento){document.getElementById('cVenc'+v).textContent=fmtData(mov.data_vencimento);document.getElementById('cVencRow'+v).style.display='';}
    else document.getElementById('cVencRow'+v).style.display='none';
    if(mov.observacao){document.getElementById('cObs'+v).textContent=mov.observacao;document.getElementById('cObsRow'+v).style.display='';}
    else document.getElementById('cObsRow'+v).style.display='none';
  });
  document.getElementById('modalComp').classList.add('show');
}

function compartilharWhatsApp(){
  if(!selCafe)return;
  var mov=null;
  for(var i=0;i<movimentos.length;i++){if(movimentos[i].movimento_id===selCafe){mov=movimentos[i];break;}}
  if(!mov)return;
  var num=String(mov.movimento_id).padStart(6,'0');
  var baseKg=(parseInt(mov.sacas)||0)*60+(parseInt(mov.kg_avulso)||0);
  var totalKg=parseInt(mov.total_kg_com_juros)||baseKg;
  var jurosKg=totalKg-baseKg;
  var jSc=Math.floor(jurosKg/60),jKg=jurosKg%60;
  var totalSc=Math.floor(totalKg/60),totalKgR=totalKg%60;
  var acumKg=parseInt(mov.saldo_acumulado_kg)||0;
  var acumSc=Math.floor(acumKg/60),acumKgR=acumKg%60;
  var saldoTxt=acumKg>0?acumSc+' sc '+acumKgR+' kg':'Quitado';
  var dataMov=fmtData(mov.data_movimento);
  var texto=
    '*COMPROVANTE DE EMPRÉSTIMO DE CAFÉ*\n'+
    '━━━━━━━━━━━━━━━━━━━━━\n'+
    '📋 Nº: '+num+'\n'+
    '👤 Cliente: '+mov.cliente_nome+'\n'+
    '📅 Data: '+dataMov+'\n'+
    (mov.data_vencimento?'⏰ Vencimento: '+fmtData(mov.data_vencimento)+'\n':'')+
    '━━━━━━━━━━━━━━━━━━━━━\n'+
    '☕ Capital: '+(mov.sacas||0)+' sc '+(mov.kg_avulso||0)+' kg\n'+
    '📈 Juros: '+(mov.juros_pct||0)+'% → '+jSc+' sc '+jKg+' kg\n'+
    '📦 Total c/ Juros: '+totalSc+' sc '+totalKgR+' kg\n'+
    '━━━━━━━━━━━━━━━━━━━━━\n'+
    '💰 Saldo Devedor: '+saldoTxt+'\n'+
    (mov.observacao?'📝 Obs: '+mov.observacao+'\n':'')+
    '━━━━━━━━━━━━━━━━━━━━━\n'+
    '_Empréstimos & Safra_';
  var tel=(mov.telefone||'').replace(/\D/g,'');
  var url='https://wa.me/'+(tel?'55'+tel:'')+'?text='+encodeURIComponent(texto);
  window.open(url,'_blank');
}

/* MODAL MOVIMENTO */
function abrirMovModal(tipo,mov){
  document.getElementById('movId').value=mov?mov.movimento_id:'';
  document.getElementById('movTipo').value=tipo;
  document.getElementById('ttlMov').textContent=mov?'Alterar Movimento':(tipo==='D'?'Incluir Emprestimo':'Registrar Devolucao');
  document.getElementById('grpJuros').style.display=tipo==='D'?'':'none';
  document.getElementById('grpVenc').style.display=tipo==='D'?'':'none';
  document.getElementById('movTipo').disabled=false;
  document.getElementById('saldoBox').style.display='none';
  popularSelect('movCli');
  if(mov){
    document.getElementById('movCli').value=mov.cliente_id||'';
    document.getElementById('movData').value=fmtInputDate(mov.data_movimento)||hoje();
    document.getElementById('movVenc').value=fmtInputDate(mov.data_vencimento);
    document.getElementById('movSc').value=mov.sacas||0;
    document.getElementById('movKg').value=mov.kg_avulso||0;
    document.getElementById('movJuros').value=mov.juros_pct||25;
    document.getElementById('movObs').value=mov.observacao||'';
    carregarSaldo(mov);
  }else{
    document.getElementById('movCli').value='';
    document.getElementById('movData').value=hoje();
    document.getElementById('movVenc').value='';
    document.getElementById('movSc').value=0;
    document.getElementById('movKg').value=0;
    document.getElementById('movJuros').value=25;
    document.getElementById('movObs').value='';
    document.getElementById('movTotal').value='';
  }
  calcMovTotal();
  document.getElementById('modalMov').classList.add('show');
}
function onTipoChange(){
  var tipo=document.getElementById('movTipo').value;
  document.getElementById('grpJuros').style.display=tipo==='D'?'':'none';
  document.getElementById('grpVenc').style.display=tipo==='D'?'':'none';
  calcMovTotal();
}
function calcMovTotal(){
  var sc=parseInt(document.getElementById('movSc').value)||0;
  var kg=parseInt(document.getElementById('movKg').value)||0;
  var jr=parseFloat(document.getElementById('movJuros').value)||0;
  var tipo=document.getElementById('movTipo').value;
  if(tipo==='D'){var tk=Math.trunc((sc*60+kg)*(1+jr/100));document.getElementById('movTotal').value=Math.floor(tk/60)+' sc '+(tk%60)+' kg';}
  else document.getElementById('movTotal').value=sc+' sc '+kg+' kg';
}
async function carregarSaldo(mov){
  var id=document.getElementById('movCli').value;
  var box=document.getElementById('saldoBox');
  if(!id){box.style.display='none';return;}
  // Se temos o movimento carregado, usa o saldo_acumulado_kg da linha (mesma fonte da tabela)
  if(mov&&mov.saldo_acumulado_kg!==undefined){
    var acum=Math.max(0,Math.trunc(parseFloat(mov.saldo_acumulado_kg)||0));
    var sc=Math.floor(acum/60),kg=acum%60;
    var sit=acum>0?'DEVENDO':'Quitado';
    document.getElementById('sldSc').textContent=sc;
    document.getElementById('sldKg').textContent=kg;
    document.getElementById('sldSit').textContent=sit;
    box.style.display='block';
    return;
  }
  // Para novos registros, busca da API
  try{
    var r=await fetch(API+'/clientes/'+id+'/saldo');var d=await r.json();
    if(d.ok&&d.data){
      var sc=d.data.saldo_devedor_sacas||0;
      var kg=d.data.saldo_devedor_kg_resto!==undefined?d.data.saldo_devedor_kg_resto:(d.data.saldo_devedor_kg%60)||0;
      document.getElementById('sldSc').textContent=sc;
      document.getElementById('sldKg').textContent=kg;
      document.getElementById('sldSit').textContent=d.data.saldo_devedor_kg>0?'DEVENDO':'Quitado';
      box.style.display='block';
    }else box.style.display='none';
  }catch(e){box.style.display='none';}
}
async function salvarMov(){
  var id=document.getElementById('movId').value;
  var tipo=document.getElementById('movTipo').value;
  var body={cliente_id:document.getElementById('movCli').value,tipo:tipo,data_movimento:document.getElementById('movData').value,data_vencimento:document.getElementById('movVenc').value||null,sacas:document.getElementById('movSc').value,kg_avulso:document.getElementById('movKg').value,juros_pct:document.getElementById('movJuros').value,observacao:document.getElementById('movObs').value};
  if(!body.cliente_id)return toast('Selecione o cliente!','error');
  if(!body.data_movimento)return toast('Informe a data!','error');
  try{
    var r=await fetch(id?(API+'/movimentos/'+id):(API+'/movimentos'),{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await r.json();
    if(d.ok){toast(id?'Atualizado!':(tipo==='D'?'Emprestimo registrado!':'Devolucao registrada!'),'success');fechar('modalMov');carregarCafe();}
    else toast('Erro: '+d.erro,'error');
  }catch(e){toast('Erro de conexao','error');}
}
function editarMovId(id){var m=movimentos.find(function(x){return x.movimento_id===id;});if(m)abrirMovModal(m.tipo,m);}
function editarMovSel(){if(selCafe)editarMovId(selCafe);else toast('Selecione um registro!','warn');}
async function excluirMov(){
  if(!selCafe)return toast('Selecione um registro!','warn');
  if(!confirm('Excluir este registro?'))return;
  try{
    var r=await fetch(API+'/movimentos/'+selCafe,{method:'DELETE'});var d=await r.json();
    if(d.ok){toast('Excluido.','warn');selCafe=null;document.getElementById('btnEditCafe').disabled=true;document.getElementById('btnComp').disabled=true;carregarCafe();}
    else toast('Erro: '+d.erro,'error');
  }catch(e){toast('Erro de conexao','error');}
}
function exportarCSV(){
  var header=['Cod.','Cliente','Tipo','Data','Vencimento','Sacas','Kg','Juros%','Total c/Juros','Saldo(kg)'];
  var rows=movimentos.map(function(d){return[String(d.movimento_id).padStart(6,'0'),d.cliente_nome,d.tipo==='D'?'Emprestimo':'Devolucao',fmtData(d.data_movimento),fmtData(d.data_vencimento),d.sacas,d.kg_avulso,d.juros_pct||'',d.total_kg_com_juros||'',d.saldo_acumulado_kg||0];});
  var csv=[header].concat(rows).map(function(r){return r.join(';');}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));a.download='cafe_'+hoje()+'.csv';a.click();
}

/* ===== DINHEIRO ===== */
async function carregarDin(pagina,buscaOverride){
  paginaDin=pagina||paginaDin;
  var busca=buscaOverride!==undefined?buscaOverride:(document.getElementById('searchDin')||{value:''}).value.trim();
  var sit=(document.getElementById('filtroSitDin')||{value:''}).value||'';
  var url=API+'/dinheiro?page='+paginaDin+'&limit='+limitDin;
  if(busca)url+='&busca='+encodeURIComponent(busca);
  if(sit)url+='&situacao='+sit;
  document.getElementById('gridDin').innerHTML='<tr><td colspan="10" style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span>Carregando...</td></tr>';
  try{
    var r=await fetch(url);var d=await r.json();
    if(d.ok){
      dadosDin=d.data;
      var pag=d.paginacao||{page:1,totalPages:1,total:d.data.length,limit:d.data.length};
      totalPaginasDin=pag.totalPages;
      renderDin();renderPaginacaoDin(pag);
    }else toast('Erro: '+d.erro,'error');
  }catch(e){document.getElementById('gridDin').innerHTML='<tr><td colspan="10" style="color:#c62828;padding:20px;text-align:center">Servidor nao encontrado.</td></tr>';}
}

function renderDin(){
  var lista=dadosDin;
  var tbody=document.getElementById('gridDin');
  if(!lista.length){tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:20px;color:#aaa">Nenhum registro.</td></tr>';return;}
  var isMobile=window.innerWidth<=768;
  var h='';
  for(var i=0;i<lista.length;i++){
    var d=lista[i];
    var vencido=d.vencimento&&new Date(d.vencimento)<new Date()&&d.situacao==='A';
    var sitL=d.situacao==='Q'?'Quitado':(vencido?'Vencido':'Aberto');
    var sitColor=d.situacao==='Q'?'color:#2e7d32;font-weight:700':(vencido?'color:#c62828;font-weight:700':'color:#1565c0;font-weight:700');
    var sel=selDin===d.id;
    if(isMobile){
      h+='<tr class="'+(sel?'selected':'')+' mob-card-row" onclick="selecionarDin('+d.id+')" ondblclick="editarDinId('+d.id+')">';
      h+='<td colspan="10" style="padding:10px 12px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      h+='<span style="font-weight:700;font-size:13px">'+(d.cliente_nome||'-')+'</span>';
      h+='<span style="'+sitColor+';font-size:12px">'+sitL+'</span>';
      h+='</div>';
      h+='<div style="display:flex;justify-content:space-between;font-size:12px;color:#555">';
      h+='<span>Capital: <b>'+fmtBRL(d.capital)+'</b></span>';
      h+='<span style="color:#2e7d32">Pago: <b>'+fmtBRL(d.total_pago)+'</b></span>';
      h+='</div>';
      if(d.vencimento||d.descricao){
        h+='<div style="font-size:11px;color:#888;margin-top:3px">';
        if(d.vencimento)h+='<span style="'+(vencido?'color:#c62828;font-weight:700':'')+'">Venc: '+fmtData(d.vencimento)+'</span>';
        if(d.descricao)h+='<span style="margin-left:8px">'+(d.descricao.length>30?d.descricao.substring(0,30)+'...':d.descricao)+'</span>';
        h+='</div>';
      }
      h+='</td></tr>';
    }else{
      h+='<tr class="'+(sel?'selected':'')+'" onclick="selecionarDin('+d.id+')" ondblclick="editarDinId('+d.id+')">';
      h+='<td style="text-align:center"><input type="checkbox" '+(sel?'checked':'')+'></td>';
      h+='<td><b>'+String(i+1+(paginaDin-1)*limitDin).padStart(2,'0')+'</b></td>';
      h+='<td><b>'+(d.cliente_nome||'')+'</b>'+(d.telefone?'<br><small style="color:#888">'+d.telefone+'</small>':'')+'</td>';
      h+='<td style="color:#555">'+(d.descricao||'—')+'</td>';
      h+='<td>'+fmtData(d.data)+'</td>';
      h+='<td style="'+(vencido?'color:#c62828;font-weight:600':'')+'">'+fmtData(d.vencimento)+'</td>';
      h+='<td>'+fmtBRL(d.capital)+'</td>';
      h+='<td>'+d.juros_pct+'%</td>';
      h+='<td style="color:#2e7d32">'+fmtBRL(d.total_pago)+'</td>';
      h+='<td style="'+sitColor+'">'+sitL+'</td>';
      h+='</tr>';
    }
  }
  tbody.innerHTML=h;
  var ts=dadosDin.reduce(function(a,d){return a+(parseFloat(d.saldo_devedor)||0);},0);
  var venc=dadosDin.filter(function(d){return d.situacao==='A'&&d.vencimento&&new Date(d.vencimento)<new Date();}).length;
  document.getElementById('ftDinTotal').textContent='Registros: '+lista.length;
  document.getElementById('ftDinSaldo').textContent='Saldo Total: '+fmtBRL(ts);
  document.getElementById('ftDinVenc').textContent='Vencidos: '+venc;
}

function renderPaginacaoDin(pag){
  var footer=document.getElementById('footerPagDin');
  if(!footer||!pag)return;
  var p=pag.page,t=pag.totalPages,total=pag.total;
  var h='<div style="display:flex;align-items:center;gap:4px">';
  h+='<select class="pg-sel" onchange="limitDin=parseInt(this.value);paginaDin=1;carregarDin(1)" style="margin-right:6px">';
  [20,50,100,200].forEach(function(n){h+='<option value="'+n+'"'+(limitDin===n?' selected':'')+'>'+n+'/pág</option>';});
  h+='</select>';
  h+='<button class="pg-btn" '+(p<=1?'disabled':'')+' onclick="carregarDin(1)" title="Primeira"><i class="fas fa-angle-double-left"></i></button>';
  h+='<button class="pg-btn" '+(p<=1?'disabled':'')+' onclick="carregarDin('+(p-1)+')" title="Anterior"><i class="fas fa-angle-left"></i></button>';
  var s=Math.max(1,p-2),e=Math.min(t,p+2);
  if(s>1){h+='<button class="pg-btn" onclick="carregarDin(1)">1</button>';if(s>2)h+='<span class="pg-dots">...</span>';}
  for(var i=s;i<=e;i++)h+='<button class="pg-btn'+(i===p?' pg-active':'')+'" onclick="carregarDin('+i+')">'+i+'</button>';
  if(e<t){if(e<t-1)h+='<span class="pg-dots">...</span>';h+='<button class="pg-btn" onclick="carregarDin('+t+')">'+t+'</button>';}
  h+='<button class="pg-btn" '+(p>=t?'disabled':'')+' onclick="carregarDin('+(p+1)+')" title="Próxima"><i class="fas fa-angle-right"></i></button>';
  h+='<button class="pg-btn" '+(p>=t?'disabled':'')+' onclick="carregarDin('+t+')" title="Última"><i class="fas fa-angle-double-right"></i></button>';
  h+='<span style="margin-left:8px;font-size:11px;color:#888">Total: <b style="color:#00838f">'+total+'</b> regs</span>';
  h+='</div>';
  footer.innerHTML=h;
}

function selecionarDin(id){
  selDin=id;
  var din=dadosDin.find(function(d){return d.id===id;});
  document.getElementById('btnEditDin').disabled=false;
  document.getElementById('btnVerPag').disabled=false;
  document.getElementById('btnPagarDin').disabled=(din&&din.situacao==='Q');
  renderDin();
}
function filtrarDin(){
  filtroDin=document.getElementById('searchDin').value.toLowerCase();
  paginaDin=1;carregarDin(1);
}
function abrirDinModal(din){
  popularSelect('dinCli');
  document.getElementById('dinId').value=din?din.id:'';
  document.getElementById('ttlDin').textContent=din?'Alterar Emprestimo':'Novo Emprestimo Dinheiro';
  document.getElementById('dinCli').value=din?din.cliente_id:'';
  document.getElementById('dinData').value=din?fmtInputDate(din.data)||hoje():hoje();
  document.getElementById('dinVenc').value=din?fmtInputDate(din.vencimento):'';
  document.getElementById('dinCapital').value=din?din.capital:'';
  document.getElementById('dinJuros').value=din?din.juros_pct:0;
  document.getElementById('dinDesc').value=din?(din.descricao||''):'';
  document.getElementById('dinSit').value=din?din.situacao:'A';
  calcDinTotal();
  document.getElementById('modalDin').classList.add('show');
}
function calcDinTotal(){var cap=parseFloat(document.getElementById('dinCapital').value)||0;var jr=parseFloat(document.getElementById('dinJuros').value)||0;document.getElementById('dinTotal').value=fmtBRL(cap*(1+jr/100));}
async function salvarDin(){
  var id=document.getElementById('dinId').value;
  var body={cliente_id:document.getElementById('dinCli').value,data:document.getElementById('dinData').value,vencimento:document.getElementById('dinVenc').value||null,capital:document.getElementById('dinCapital').value,juros_pct:document.getElementById('dinJuros').value,descricao:document.getElementById('dinDesc').value||null,situacao:document.getElementById('dinSit').value};
  if(!body.cliente_id)return toast('Selecione o cliente!','error');
  if(!body.capital||parseFloat(body.capital)<=0)return toast('Informe o capital!','error');
  try{
    var r=await fetch(id?API+'/dinheiro/'+id:API+'/dinheiro',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await r.json();
    if(d.ok){
        toast(id?'Atualizado!':'Registrado!','success');
        fechar('modalDin');
        await carregarDin(1);
        if(!id&&d.data&&d.data.id){selecionarDin(d.data.id);}
      }
    else toast('Erro: '+d.erro,'error');
  }catch(e){toast('Erro de conexao','error');}
}
function editarDinId(id){var d=dadosDin.find(function(x){return x.id===id;});if(d)abrirDinModal(d);}
function editarDinSel(){if(selDin)editarDinId(selDin);else toast('Selecione um registro!','warn');}
async function excluirDin(){
  if(!selDin)return toast('Selecione um registro!','warn');
  if(!confirm('Excluir este emprestimo?'))return;
  try{var r=await fetch(API+'/dinheiro/'+selDin,{method:'DELETE'});var d=await r.json();if(d.ok){toast('Excluido.','warn');selDin=null;carregarDin();}else toast('Erro: '+d.erro,'error');}
  catch(e){toast('Erro de conexao','error');}
}
function abrirPagModal(){
  if(!selDin)return toast('Selecione um emprestimo!','warn');
  var din=dadosDin.find(function(d){return d.id===selDin;});
  document.getElementById('pagCli').textContent=din?din.cliente_nome:'-';
  document.getElementById('pagSaldo').textContent=fmtBRL(din?din.saldo_devedor:0);
  document.getElementById('pagData').value=hoje();
  document.getElementById('pagValor').value='';
  document.getElementById('pagDesc').value='';
  document.getElementById('modalPag').classList.add('show');
}
async function salvarPag(){
  var valor=document.getElementById('pagValor').value;
  if(!valor||parseFloat(valor)<=0)return toast('Informe o valor!','error');
  var body={data:document.getElementById('pagData').value,valor:valor,descricao:document.getElementById('pagDesc').value||null};
  try{var r=await fetch(API+'/dinheiro/'+selDin+'/pagamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var d=await r.json();if(d.ok){toast('Pagamento registrado!','success');fechar('modalPag');carregarDin();}else toast('Erro: '+d.erro,'error');}
  catch(e){toast('Erro de conexao','error');}
}
async function verPagamentos(){
  if(!selDin)return toast('Selecione um emprestimo!','warn');
  var din=dadosDin.find(function(d){return d.id===selDin;});
  try{
    var r=await fetch(API+'/dinheiro/'+selDin+'/pagamentos');
    var d=await r.json();
    var tbody=document.getElementById('bodyPag');
    document.getElementById('ttlListPag').textContent='Pagamentos — '+(din?din.cliente_nome:'')+'  Nº '+String(selDin).padStart(6,'0');
    if(d.ok&&d.data&&d.data.length){
      var h='';
      d.data.forEach(function(p){
        h+='<tr style="height:42px">';
        h+='<td style="text-align:center">'+String(p.id).padStart(3,'0')+'</td>';
        h+='<td>'+fmtData(p.data)+'</td>';
        h+='<td><b style="color:#2e7d32">'+fmtBRL(p.valor)+'</b></td>';
        h+='<td>'+(p.descricao||'—')+'</td>';
        h+='<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center">'+
           '<button class="btn" style="padding:3px 8px;font-size:11px" '+
           'data-pid="'+p.id+'" data-pdata="'+fmtData(p.data)+'" data-pvalor="'+p.valor+'" data-pdesc="'+encodeURIComponent(p.descricao||'')+'" '+
           'onclick="var b=this;editarPagamento(b.dataset.pid,b.dataset.pdata,b.dataset.pvalor,b.dataset.pdesc)">'+
           '<i class="fas fa-edit"></i></button>'+
           '<button class="btn" style="padding:3px 8px;font-size:11px;background:#fce4ec;border-color:#ef9a9a;color:#c62828" '+
           'data-pid="'+p.id+'" onclick="excluirPagamento(parseInt(this.dataset.pid))">'+
           '<i class="fas fa-trash"></i></button>'+
           '</div></td>';
        h+='</tr>';
      });
      tbody.innerHTML=h;
    }else{
      tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px">Nenhum pagamento registrado.</td></tr>';
    }
    document.getElementById('modalListPag').classList.add('show');
  }catch(e){toast('Erro ao carregar pagamentos: '+e.message,'error');}
}
function editarPagamento(id,data,valor,desc){
  document.getElementById('editPagId').value=id;
  var partes=(data||'').split('/');
  document.getElementById('editPagData').value=partes.length===3?partes[2]+'-'+partes[1]+'-'+partes[0]:data;
  document.getElementById('editPagValor').value=valor;
  document.getElementById('editPagDesc').value=decodeURIComponent(desc||'');
  document.getElementById('modalEditPag').classList.add('show');
}
async function salvarEdicaoPag(){
  var id=document.getElementById('editPagId').value;
  var data=document.getElementById('editPagData').value;
  var valor=document.getElementById('editPagValor').value;
  var desc=document.getElementById('editPagDesc').value;
  if(!valor||parseFloat(valor)<=0)return toast('Informe o valor!','error');
  try{
    var r=await fetch(API+'/dinheiro/pagamento/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:data,valor:parseFloat(valor),descricao:desc||null})});
    var d=await r.json();
    if(d.ok){toast('Pagamento atualizado!','success');fechar('modalEditPag');verPagamentos();carregarDin();}
    else toast('Erro: '+d.erro,'error');
  }catch(e){toast('Erro de conexão','error');}
}

async function excluirPagamento(id){
  if(!confirm('Excluir este pagamento?'))return;
  try{
    var r=await fetch(API+'/dinheiro/pagamento/'+id,{method:'DELETE'});
    var d=await r.json();
    if(d.ok){toast('Pagamento excluído.','warn');verPagamentos();carregarDin();}
    else toast('Erro: '+d.erro,'error');
  }catch(e){toast('Erro de conexão','error');}
}

/* ===== DASHBOARD ===== */
async function carregarDashboard(){
  try{
    var r1=await fetch(API+'/movimentos/saldos');
    var d1=await r1.json();
    var totalCafeKg=0,clientesCafe=0;
    if(d1.ok){d1.data.forEach(function(r){totalCafeKg+=parseInt(r.saldo_devedor_kg)||0;});clientesCafe=d1.data.length;}
    var cafeSc=Math.floor(totalCafeKg/60),cafeKgR=totalCafeKg%60;
    document.getElementById('dshCafeKg').textContent=cafeSc+' sc '+cafeKgR+' kg';
    document.getElementById('dshCafeSub').textContent=clientesCafe+' clientes com saldo';
    var r3=await fetch(API+'/clientes');
    var d3=await r3.json();
    var totalCli=d3.ok?d3.data.length:0;
    var cliAtivos=d3.ok?d3.data.filter(function(c){return c.ativo;}).length:0;
    document.getElementById('dshClientes').textContent=totalCli;
    document.getElementById('dshClientesSub').textContent=cliAtivos+' ativos';
    var r4=await fetch(API+'/dinheiro/stats');
    var d4=await r4.json();
    if(d4&&d4.ok){
      document.getElementById('dshCapital').textContent=fmtBRL(d4.data.total_capital);
      document.getElementById('dshCapitalSub').textContent=d4.data.total_registros+' emprestimos';
      document.getElementById('dshPago').textContent=fmtBRL(d4.data.total_pago);
      document.getElementById('dshPagoSub').textContent=fmtBRL(d4.data.total_capital-d4.data.total_pago)+' em aberto';
      document.getElementById('dshVencidos').textContent=d4.data.total_vencidos;
      document.getElementById('dshVencSub').textContent='emprestimos em atraso';
    }
  }catch(e){console.error('Dashboard erro:',e);}
}

/* ===== CLIENTES ===== */
async function carregarClientes(){
  try{var r=await fetch(API+'/clientes');var d=await r.json();if(d.ok){clientes=d.data;popularSelect('movCli');popularSelect('dinCli');}}catch(e){}
}
async function carregarCli(){
  document.getElementById('gridCli').innerHTML='<tr class="empty-row"><td colspan="8"><span class="spinner"></span>Carregando...</td></tr>';
  try{var r=await fetch(API+'/clientes');var d=await r.json();if(d.ok){clientes=d.data;renderCli();}else toast('Erro: '+d.erro,'error');}
  catch(e){toast('Erro de conexao','error');}
}
function renderCli(){
  var lista=clientes.filter(function(c){return(c.nome||'').toLowerCase().indexOf(filtroCli)>=0||(c.documento||'').indexOf(filtroCli)>=0;});
  var tbody=document.getElementById('gridCli');
  if(!lista.length){tbody.innerHTML='<tr class="empty-row"><td colspan="8">Nenhum cliente.</td></tr>';return;}
  var h='';
  for(var i=0;i<lista.length;i++){
    var c=lista[i];var sel=selCli===c.cliente_id?' selected':'';
    h+='<tr class="'+sel+'" onclick="selecionarCli('+c.cliente_id+')" ondblclick="editarCliId('+c.cliente_id+')">';
    h+='<td><input type="checkbox" '+(selCli===c.cliente_id?'checked':'')+'></td>';
    h+='<td>'+String(c.cliente_id).padStart(6,'0')+'</td>';
    h+='<td><b>'+(c.nome||'')+'</b></td><td>'+(c.documento||'')+'</td><td>'+(c.telefone||'')+'</td><td>'+(c.email||'')+'</td>';
    h+='<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+(c.endereco||'')+'</td>';
    h+='<td><span class="badge '+(c.ativo?'bc':'bv')+'">'+(c.ativo?'Ativo':'Inativo')+'</span></td>';
    h+='</tr>';
  }
  tbody.innerHTML=h;
  document.getElementById('ftCliTotal').textContent='Clientes: '+lista.length;
}
function selecionarCli(id){selCli=id;document.getElementById('btnEditCli').disabled=false;document.getElementById('btnDelCli').disabled=false;renderCli();}
function filtrarCli(){filtroCli=document.getElementById('searchCli').value.toLowerCase();renderCli();}
function popularSelect(id){
  var sel=document.getElementById(id);if(!sel)return;var val=sel.value;
  sel.innerHTML='<option value="">Selecione o cliente...</option>';
  clientes.forEach(function(c){var o=document.createElement('option');o.value=c.cliente_id;o.textContent=c.nome+(c.documento?' - '+c.documento:'');sel.appendChild(o);});
  if(val)sel.value=val;
}
function abrirCliModal(cli){
  document.getElementById('cliId').value=cli?cli.cliente_id:'';
  document.getElementById('ttlCli').textContent=cli?'Alterar Cliente':'Cadastrar Cliente';
  document.getElementById('cliNome').value=cli?(cli.nome||''):'';
  document.getElementById('cliDoc').value=cli?(cli.documento||''):'';
  document.getElementById('cliTel').value=cli?(cli.telefone||''):'';
  document.getElementById('cliEmail').value=cli?(cli.email||''):'';
  document.getElementById('cliEnd').value=cli?(cli.endereco||''):'';
  document.getElementById('modalCli').classList.add('show');
}
async function salvarCli(){
  var nome=document.getElementById('cliNome').value.trim();
  if(!nome)return toast('Informe o nome!','error');
  var cliId=document.getElementById('cliId').value;
  var body={nome:nome,documento:document.getElementById('cliDoc').value||undefined,telefone:document.getElementById('cliTel').value||undefined,email:document.getElementById('cliEmail').value||undefined,endereco:document.getElementById('cliEnd').value||undefined};
  if(cliId)body.cliente_id=cliId;
  try{var r=await fetch(API+'/clientes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var d=await r.json();if(d.ok){toast('Cliente salvo!','success');fechar('modalCli');carregarClientes();renderCli();}else toast('Erro: '+d.erro,'error');}
  catch(e){toast('Erro de conexao','error');}
}
function editarCliId(id){var c=clientes.find(function(x){return x.cliente_id===id;});if(c)abrirCliModal(c);}
function editarCliSel(){if(selCli)editarCliId(selCli);else toast('Selecione um cliente!','warn');}
async function excluirCli(){
  if(!selCli)return toast('Selecione um cliente!','warn');
  if(!confirm('Desativar este cliente?'))return;
  try{var r=await fetch(API+'/clientes/'+selCli,{method:'DELETE'});var d=await r.json();if(d.ok){toast('Desativado.','warn');selCli=null;carregarClientes();carregarCli();}else toast('Erro: '+d.erro,'error');}
  catch(e){toast('Erro de conexao','error');}
}

/* ===== RELATORIOS ===== */
var relAtivo=null;
function fmtInputDate(s){if(!s)return'';var p=s.replace('T',' ').replace('Z','').trim();return p.substring(0,10);}
function mostrarRel(tipo){
  relAtivo=tipo;
  document.getElementById('relClienteSel').style.display=tipo==='historico'?'':'none';
  document.getElementById('relClienteSelDin').style.display=tipo==='historicoDin'?'':'none';
  document.getElementById('filtrosDin').style.display=tipo==='devedoresDin'?'flex':'none';
  document.getElementById('filtrosPagJuros').style.display=tipo==='pagJuros'?'flex':'none';
  document.getElementById('filtrosVenc').style.display=tipo==='vencimentos'?'flex':'none';
  document.getElementById('btnImprimirRel').style.display='none';
  if(tipo==='devedores')carregarDevedores();
  if(tipo==='historico'){popularSelectRel();document.getElementById('areaRelatorio').innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Selecione um cliente para ver o histórico</div>';}
  if(tipo==='devedoresDin'){
    document.getElementById('areaRelatorio').innerHTML='<div style="text-align:center;padding:60px;color:#aaa"><i class="fas fa-filter" style="font-size:32px;margin-bottom:12px;display:block"></i>Use os filtros acima e clique em <b>Buscar</b></div>';
  }
  if(tipo==='historicoDin'){popularSelectRelDin();document.getElementById('areaRelatorio').innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Selecione um cliente para ver o histórico de dinheiro</div>';}
  if(tipo==='pagJuros'){
    popularSelectPagJuros();
    document.getElementById('areaRelatorio').innerHTML='<div style="text-align:center;padding:60px;color:#aaa"><i class="fas fa-hand-holding-usd" style="font-size:32px;margin-bottom:12px;display:block"></i>Use os filtros acima e clique em <b>Buscar</b></div>';
  }
  if(tipo==='vencimentos'){
    document.getElementById('areaRelatorio').innerHTML='<div style="text-align:center;padding:60px;color:#aaa"><i class="fas fa-calendar-times" style="font-size:32px;margin-bottom:12px;display:block"></i>Selecione o período e clique em <b>Buscar</b></div>';
  }
}
function isMobile(){return window.innerWidth<768;}
async function carregarDevedores(){
  var area=document.getElementById('areaRelatorio');
  area.innerHTML='<div style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span> Carregando...</div>';
  try{
    var r=await fetch(API+'/movimentos/saldos');var d=await r.json();
    if(!d.ok){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+d.erro+'</div>';return;}
    var rows=d.data;
    var totalKg=rows.reduce(function(s,r){return s+(parseInt(r.saldo_devedor_kg)||0);},0);
    var totalSc=Math.floor(totalKg/60),totalKgR=totalKg%60;
    if(!rows.length){area.innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Nenhum devedor encontrado.</div>';return;}
    var h='';
    if(isMobile()){
      h='<div style="padding:12px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">';
      h+='<span style="font-size:13px;color:#666">'+rows.length+' devedor(es)</span>';
      h+='<span style="font-size:14px;font-weight:700;color:#c62828">Total: '+totalSc+' sc '+totalKgR+' kg</span></div>';
      rows.forEach(function(x){
        var sc=parseInt(x.saldo_devedor_sacas)||0,kg=parseInt(x.saldo_devedor_kg)||0,kgR=kg%60;
        h+='<div style="background:#fff;border-radius:10px;border-left:4px solid #00acc1;padding:14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
        h+='<div style="font-weight:700;font-size:14px;color:#333">'+x.nome+'</div>';
        h+='<div style="font-size:15px;font-weight:700;color:#c62828">'+sc+' sc '+kgR+' kg</div></div>';
        h+='<div style="font-size:12px;color:#888;display:flex;gap:12px;flex-wrap:wrap">';
        if(x.telefone)h+='<span>📞 '+x.telefone+'</span>';
        if(x.documento)h+='<span>📄 '+x.documento+'</span>';
        h+='</div></div>';
      });
      h+='<div style="background:#fff;border-radius:8px;padding:12px 14px;margin-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:14px"><span>Total devedor</span><span style="color:#c62828">'+totalSc+' sc '+totalKgR+' kg</span></div></div>';
    } else {
      var agora=new Date();var dataHora=agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      h='<div class="rel-wrap"><div class="rel-topo"><div class="rel-empresa"><h2><i class="fas fa-coffee"></i> EMPRÉSTIMOS &amp; SAFRA</h2><p>Sistema de Controle de Empréstimos de Café</p></div>';
      h+='<div class="rel-info">Emitido em: '+dataHora+'<br>Usuário: Administrador<br>Total de devedores: '+rows.length+'</div></div>';
      h+='<div class="rel-titulo-doc">Relatório de Devedores de Café</div>';
      h+='<table class="rel-table"><thead><tr><th>Nº</th><th>Cliente</th><th>CPF/CNPJ</th><th>Telefone</th><th>Saldo Devedor</th></tr></thead><tbody>';
      rows.forEach(function(x,i){
        var sc=parseInt(x.saldo_devedor_sacas)||0,kg=parseInt(x.saldo_devedor_kg)||0,kgR=kg%60;
        h+='<tr><td>'+String(i+1).padStart(3,'0')+'</td><td><b>'+x.nome+'</b></td><td>'+(x.documento||'—')+'</td><td>'+(x.telefone||'—')+'</td><td><b>'+sc+' sc '+kgR+' kg</b></td></tr>';
      });
      h+='</tbody><tfoot><tr><td colspan="4"><b>TOTAL GERAL</b></td><td><b>'+totalSc+' sc '+totalKgR+' kg</b></td></tr></tfoot></table>';
      h+='<div class="rel-assin"><div>________________________<br>Responsável / Gerente</div><div>________________________<br>Conferente</div></div>';
      h+='<div class="rel-rodape">Documento gerado pelo Sistema Empréstimos &amp; Safra — '+dataHora+'</div></div>';
    }
    area.innerHTML=h;
    document.getElementById('ftRelInfo').textContent=rows.length+' devedores';
    document.getElementById('btnImprimirRel').style.display='';
  }catch(e){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+e.message+'</div>';}
}
function popularSelectRel(){
  var sel=document.getElementById('relClienteSel');
  sel.innerHTML='<option value="">Selecione o cliente...</option>';
  clientes.forEach(function(c){sel.innerHTML+='<option value="'+c.cliente_id+'">'+c.nome+'</option>';});
}
async function carregarHistorico(){
  var cid=document.getElementById('relClienteSel').value;
  if(!cid)return;
  var area=document.getElementById('areaRelatorio');
  area.innerHTML='<div style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span> Carregando...</div>';
  try{
    var r=await fetch(API+'/movimentos?limit=99999&page=1&cliente_id='+cid);var d=await r.json();
    if(!d.ok){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+d.erro+'</div>';return;}
    var rows=d.data;
    rows.sort(function(a,b){return a.movimento_id-b.movimento_id;});
    var cliente=rows.length?rows[0].cliente_nome:document.getElementById('relClienteSel').selectedOptions[0].text;
    var totalD=0;
    rows.forEach(function(r){if(r.tipo==='D')totalD+=parseInt(r.total_kg_com_juros)||0;});
    var saldoKgLast=rows.length?Math.max(0,parseInt(rows[rows.length-1].saldo_acumulado_kg)||0):0;
    var saldoKg=saldoKgLast,saldoSc=Math.floor(saldoKg/60),saldoKgR=saldoKg%60;
    if(!rows.length){area.innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Nenhum movimento encontrado.</div>';return;}
    var h='';
    if(isMobile()){
      h='<div style="padding:12px">';
      h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">';
      h+='<span style="font-size:13px;font-weight:700;color:#333">'+cliente+'</span>';
      h+='<span style="font-size:13px;font-weight:700;color:'+(saldoKg>0?'#c62828':'#2e7d32')+'">'+(saldoKg>0?'Saldo: '+saldoSc+' sc '+saldoKgR+' kg':'✅ Quitado')+'</span></div>';
      rows.forEach(function(r){
        var base=(parseInt(r.sacas)||0)*60+(parseInt(r.kg_avulso)||0);
        var total=parseInt(r.total_kg_com_juros)||base;
        var jurosKg=r.tipo==='D'?total-base:0;
        var jSc=Math.floor(jurosKg/60),jKg=jurosKg%60;
        var tSc=Math.floor(total/60),tKg=total%60;
        var acum=Math.trunc(parseFloat(r.saldo_acumulado_kg)||0),aSc=Math.floor(acum/60),aKg=acum%60;
        var isD=r.tipo==='D';
        var vencido=isD&&r.data_vencimento&&new Date(r.data_vencimento)<new Date();
        var bord=isD?'#e53935':'#2e7d32';
        h+='<div style="background:#fff;border-radius:10px;border-left:4px solid '+bord+';padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
        h+='<div style="display:flex;align-items:center;gap:8px"><span style="font-weight:700;font-size:13px;color:#fff;background:'+bord+';border-radius:6px;padding:1px 8px">'+(isD?'D':'C')+'</span>';
        h+='<span style="font-size:12px;color:#666">'+fmtData(r.data_movimento)+'</span></div>';
        h+='<span style="font-size:13px;font-weight:700;color:'+bord+'">'+tSc+' sc '+tKg+' kg</span></div>';
        h+='<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;font-size:12px;color:#555">';
        if(isD){h+='<span>📈 Juros: '+(r.juros_pct||0)+'% ('+jSc+' sc '+jKg+' kg)</span>';
          if(r.data_vencimento)h+='<span style="color:'+(vencido?'#c62828':'#888')+'">📅 Venc: '+fmtData(r.data_vencimento)+(vencido?' ⚠️':'')+'</span>';}
        h+='<span style="color:'+(acum>0?'#c62828':'#2e7d32')+';font-weight:700">Saldo: '+(acum>0?aSc+' sc '+aKg+' kg':'Quitado')+'</span></div>';
        if(r.observacao)h+='<div style="font-size:11px;color:#aaa;margin-top:3px">'+r.observacao+'</div>';
        h+='</div>';
      });
      h+='<div style="background:#fff;border-radius:8px;padding:12px 14px;margin-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:13px"><span>Emprestado: '+Math.floor(totalD/60)+' sc '+(totalD%60)+' kg</span><span style="color:'+(saldoKg>0?'#c62828':'#2e7d32')+'">'+(saldoKg>0?saldoSc+' sc '+saldoKgR+' kg deve':'✅ Quitado')+'</span></div></div>';
    } else {
      var agora=new Date();var dataHora=agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      h='<div class="rel-wrap"><div class="rel-topo"><div class="rel-empresa"><h2><i class="fas fa-coffee"></i> EMPRÉSTIMOS &amp; SAFRA</h2><p>Sistema de Controle de Empréstimos de Café</p></div>';
      h+='<div class="rel-info">Emitido em: '+dataHora+'<br>Usuário: Administrador<br>Movimentos: '+rows.length+'</div></div>';
      h+='<div class="rel-titulo-doc">Histórico de Movimentos — '+cliente+'</div>';
      h+='<table class="rel-table"><thead><tr><th>Nº</th><th>Tipo</th><th>Data</th><th>Vencimento</th><th>Capital</th><th>Juros%</th><th>Juros Sc/Kg</th><th>Total c/ Juros</th><th>Saldo Linha</th><th>Observação</th></tr></thead><tbody>';
      rows.forEach(function(r){
        var base=(parseInt(r.sacas)||0)*60+(parseInt(r.kg_avulso)||0);
        var total=parseInt(r.total_kg_com_juros)||base;
        var jurosKg=r.tipo==='D'?total-base:0;
        var jSc=Math.floor(jurosKg/60),jKg=jurosKg%60;
        var tSc=Math.floor(total/60),tKg=total%60;
        var acum=Math.trunc(parseFloat(r.saldo_acumulado_kg)||0),aSc=Math.floor(acum/60),aKg=acum%60;
        var vencStyle=(r.tipo==='D'&&r.data_vencimento&&new Date(r.data_vencimento)<new Date())?'color:#c62828;font-weight:700':'';
        h+='<tr><td>'+String(r.movimento_id).padStart(6,'0')+'</td><td>'+(r.tipo==='D'?'<span class="status-d">D</span>':'<span class="status-c">C</span>')+'</td><td>'+fmtData(r.data_movimento)+'</td><td style="'+vencStyle+'">'+fmtData(r.data_vencimento)+'</td><td>'+(parseInt(r.sacas)||0)+' sc '+(parseInt(r.kg_avulso)||0)+' kg</td><td>'+(r.tipo==='D'?(r.juros_pct||0)+'%':'—')+'</td><td>'+(r.tipo==='D'?jSc+' sc '+jKg+' kg':'—')+'</td><td><b>'+tSc+' sc '+tKg+' kg</b></td><td>'+(acum>0?aSc+' sc '+aKg+' kg':'Quitado')+'</td><td>'+(r.observacao||'—')+'</td></tr>';
      });
      h+='</tbody><tfoot><tr><td colspan="7">TOTAIS</td><td><b>'+Math.floor(totalD/60)+' sc '+(totalD%60)+' kg</b> emprestado</td><td><b style="color:'+(saldoKg>0?'#c62828">'+saldoSc+' sc '+saldoKgR+' kg devedor':'#2e7d32">Quitado')+'</b></td><td></td></tr></tfoot></table>';
      h+='<div class="rel-assin"><div>________________________<br>Responsável / Gerente</div><div>________________________<br>Conferente</div></div>';
      h+='<div class="rel-rodape">Documento gerado pelo Sistema Empréstimos &amp; Safra — '+dataHora+'</div></div>';
    }
    area.innerHTML=h;
    document.getElementById('ftRelInfo').textContent=rows.length+' movimentos — '+cliente;
    document.getElementById('btnImprimirRel').style.display='';
  }catch(e){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+e.message+'</div>';}
}
async function carregarDevedoresDin(){
  var area=document.getElementById('areaRelatorio');
  area.innerHTML='<div style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span> Carregando...</div>';
  try{
    var sit=document.getElementById('relSitDin').value;
    var de=document.getElementById('relDinDe').value;
    var ate=document.getElementById('relDinAte').value;
    var url=API+'/dinheiro?limit=2000&page=1';
    if(sit)url+='&situacao='+sit;if(de)url+='&dataDE='+de;if(ate)url+='&dataATE='+ate;
    var r=await fetch(url);var d=await r.json();
    if(!d.ok){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+d.erro+'</div>';return;}
    var rows=d.data.filter(function(x){return x.situacao!=='Q'&&(parseFloat(x.saldo_devedor)||0)>0;});
    rows.sort(function(a,b){return (parseFloat(b.saldo_devedor)||0)-(parseFloat(a.saldo_devedor)||0);});
    var totalSaldo=rows.reduce(function(s,r){return s+(parseFloat(r.saldo_devedor)||0);},0);
    if(!rows.length){area.innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Nenhum devedor encontrado.</div>';return;}
    var h='';
    if(isMobile()){
      h='<div style="padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px"><span style="font-size:13px;color:#666">'+rows.length+' devedor(es)</span><span style="font-size:14px;font-weight:700;color:#c62828">Total: '+fmtBRL(totalSaldo)+'</span></div>';
      rows.forEach(function(x){
        var hoje=new Date();hoje.setHours(0,0,0,0);
        var vencido=x.vencimento&&new Date(x.vencimento+'T12:00:00')<hoje;
        var bord=vencido?'#c62828':'#1565c0';
        h+='<div style="background:#fff;border-radius:10px;border-left:4px solid '+bord+';padding:14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)">';
        h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><div style="font-weight:700;font-size:14px;color:#333">'+x.cliente_nome+'</div>';
        h+='<div style="font-size:11px;font-weight:700;color:#fff;background:'+(vencido?'#c62828':'#1565c0')+';border-radius:12px;padding:2px 8px">'+(vencido?'VENCIDO':'ABERTO')+'</div></div>';
        h+='<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;font-size:12px;color:#555"><span>💵 Capital: <b>'+fmtBRL(x.capital)+'</b></span><span>📈 Juros: <b>'+(x.juros_pct||0)+'%</b></span><span style="color:#2e7d32">✅ Pago: <b>'+fmtBRL(x.total_pago)+'</b></span></div>';
        if(x.vencimento)h+='<div style="font-size:11px;color:'+(vencido?'#c62828':'#888')+';margin-top:4px">📅 Vencimento: '+fmtData(x.vencimento)+(vencido?' ⚠️':'')+'</div>';
        if(x.descricao)h+='<div style="font-size:11px;color:#aaa;margin-top:2px">'+x.descricao+'</div>';
        h+='</div>';
      });
      h+='<div style="background:#fff;border-radius:8px;padding:12px 14px;margin-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:14px"><span>Total devedor</span><span style="color:#c62828">'+fmtBRL(totalSaldo)+'</span></div></div>';
    } else {
      var agora=new Date();var dataHora=agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      h='<div class="rel-wrap"><div class="rel-topo"><div class="rel-empresa"><h2><i class="fas fa-coffee"></i> EMPRÉSTIMOS &amp; SAFRA</h2><p>Sistema de Controle de Empréstimos de Café</p></div>';
      h+='<div class="rel-info">Emitido em: '+dataHora+'<br>Usuário: Administrador<br>Total de devedores: '+rows.length+'</div></div>';
      h+='<div class="rel-titulo-doc">Relatório de Devedores — Empréstimos em Dinheiro</div>';
      h+='<table class="rel-table"><thead><tr><th>Nº</th><th>Cliente</th><th>CPF/CNPJ</th><th>Capital</th><th>Pago</th><th>Vencimento</th></tr></thead><tbody>';
      rows.forEach(function(x,i){
        var vencido=x.vencimento&&new Date(x.vencimento)<agora;
        var vencStyle=vencido?'color:#c62828;font-weight:700':'';
        h+='<tr><td>'+String(i+1).padStart(3,'0')+'</td><td><b>'+x.cliente_nome+'</b></td><td>'+(x.telefone||'—')+'</td><td>'+fmtBRL(x.capital)+'</td><td style="color:#2e7d32">'+fmtBRL(x.total_pago)+'</td><td style="'+vencStyle+'">'+(x.vencimento?fmtData(x.vencimento):'—')+(vencido?' ⚠':'')+'</td></tr>';
      });
      h+='</tbody></table><div class="rel-assin"><div>________________________<br>Responsável / Gerente</div><div>________________________<br>Conferente</div></div>';
      h+='<div class="rel-rodape">Documento gerado pelo Sistema Empréstimos &amp; Safra — '+dataHora+'</div></div>';
    }
    area.innerHTML=h;
    document.getElementById('ftRelInfo').textContent=rows.length+' devedores — Total: '+fmtBRL(totalSaldo);
    document.getElementById('btnImprimirRel').style.display='';
  }catch(e){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+e.message+'</div>';}
}

function popularSelectRelDin(){
  var sel=document.getElementById('relClienteSelDin');
  sel.innerHTML='<option value="">Selecione o cliente...</option>';
  clientes.forEach(function(c){sel.innerHTML+='<option value="'+c.cliente_id+'">'+c.nome+'</option>';});
}

async function carregarHistoricoDin(){
  var cid=document.getElementById('relClienteSelDin').value;
  if(!cid)return;
  var area=document.getElementById('areaRelatorio');
  area.innerHTML='<div style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span> Carregando...</div>';
  try{
    var r=await fetch(API+'/dinheiro?limit=99999&page=1&cliente_id='+cid);var d=await r.json();
    if(!d.ok){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+d.erro+'</div>';return;}
    var rows=d.data;
    if(!rows.length){area.innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Nenhum empréstimo para este cliente.</div>';return;}
    var cliente=rows[0].cliente_nome;
    var totalCap=rows.reduce(function(s,r){return s+(parseFloat(r.capital)||0);},0);
    var totalPago=rows.reduce(function(s,r){return s+(parseFloat(r.total_pago)||0);},0);
    var totalSaldo=rows.reduce(function(s,r){return s+(r.situacao!=='Q'?(parseFloat(r.saldo_devedor)||0):0);},0);
    var agora=new Date();
    var dataHora=agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    var h='<div class="rel-wrap">';
    h+='<div class="rel-topo"><div class="rel-empresa"><h2><i class="fas fa-coffee"></i> EMPRÉSTIMOS &amp; SAFRA</h2><p>Sistema de Controle de Empréstimos de Café</p></div>';
    h+='<div class="rel-info">Emitido em: '+dataHora+'<br>Usuário: Administrador<br>Empréstimos: '+rows.length+'</div></div>';
    h+='<div class="rel-titulo-doc">Histórico de Empréstimos em Dinheiro — '+cliente+'</div>';
    h+='<table class="rel-table"><thead><tr><th>Nº</th><th>Data</th><th>Vencimento</th><th>Descrição</th><th>Capital</th><th>Juros%</th><th>Pago</th><th>Situação</th></tr></thead><tbody>';
    rows.forEach(function(r,i){
      var vencido=r.situacao==='A'&&r.vencimento&&new Date(r.vencimento)<agora;
      var sitL=r.situacao==='Q'?'Quitado':(vencido?'Vencido':'Aberto');
      var sitStyle=r.situacao==='Q'?'color:#2e7d32':vencido?'color:#c62828':'color:#1565c0';
      h+='<tr>';
      h+='<td>'+String(r.id).padStart(6,'0')+'</td>';
      h+='<td>'+fmtData(r.data)+'</td>';
      h+='<td>'+(r.vencimento?fmtData(r.vencimento):'—')+'</td>';
      h+='<td>'+(r.descricao||'—')+'</td>';
      h+='<td>'+fmtBRL(r.capital)+'</td>';
      h+='<td>'+r.juros_pct+'%</td>';
      h+='<td style="color:#2e7d32">'+fmtBRL(r.total_pago)+'</td>';
      
      h+='<td style="'+sitStyle+';font-weight:700">'+sitL+'</td>';
      h+='</tr>';
    });
    h+='</tbody><tfoot><tr><td colspan="4"><b>TOTAIS</b></td><td><b>'+fmtBRL(totalCap)+'</b></td><td></td><td style="color:#2e7d32"><b>'+fmtBRL(totalPago)+'</b></td><td style="color:#c62828"><b>'+fmtBRL(totalSaldo)+'</b></td><td></td></tr></tfoot></table>';
    h+='<div class="rel-assin"><div>________________________<br>Responsável / Gerente</div><div>________________________<br>Conferente</div></div>';
    h+='<div class="rel-rodape">Documento gerado pelo Sistema Empréstimos &amp; Safra — '+dataHora+'</div></div>';
    area.innerHTML=h;
    document.getElementById('ftRelInfo').textContent=rows.length+' empréstimos — '+cliente+' — Saldo: '+fmtBRL(totalSaldo);
    document.getElementById('btnImprimirRel').style.display='';
  }catch(e){area.innerHTML='<div style="color:#c62828;padding:20px">Erro: '+e.message+'</div>';}
}

function exportarExcelCafe(){
  if(!movimentos.length)return toast('Nenhum dado para exportar!','warn');
  var rows=[['Cod.','Tipo','Cliente','Data','Vencimento','Sacas','Kg Avulso','Juros%','Total c/Juros (kg)','Saldo (kg)','Observacao']];
  movimentos.forEach(function(d){
    var base=(parseInt(d.sacas)||0)*60+(parseInt(d.kg_avulso)||0);
    var total=parseInt(d.total_kg_com_juros)||base;
    rows.push([
      String(d.movimento_id).padStart(6,'0'),
      d.tipo==='D'?'Emprestimo':'Devolucao',
      d.cliente_nome, fmtData(d.data_movimento), fmtData(d.data_vencimento),
      d.sacas||0, d.kg_avulso||0, d.juros_pct||0,
      total, d.saldo_acumulado_kg||0, d.observacao||''
    ]);
  });
  baixarExcel(rows,'cafe_emprestimos_'+hoje()+'.xlsx','Café');
}
function exportarCSVDin(){
  if(!dadosDin.length)return toast('Nenhum dado para exportar!','warn');
  var header=['Cod.','Cliente','Descrição','Data','Vencimento','Capital','Juros%','Pago','Situação'];
  var rows=dadosDin.map(function(d){
    var vencido=d.situacao==='A'&&d.vencimento&&new Date(d.vencimento)<new Date();
    return[String(d.id).padStart(6,'0'),d.cliente_nome,d.descricao||'',
      fmtData(d.data),fmtData(d.vencimento),d.capital,d.juros_pct+'%',
      d.total_pago||0,
      d.situacao==='Q'?'Quitado':vencido?'Vencido':'Aberto'];
  });
  var nl='\n';
  var csv=[header].concat(rows).map(function(r){return r.join(';');}).join(nl);
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download='dinheiro_'+hoje()+'.csv';a.click();
}
function exportarExcelDin(){
  if(!dadosDin.length)return toast('Nenhum dado para exportar!','warn');
  var rows=[['Cod.','Cliente','Descrição','Data','Vencimento','Capital (R$)','Juros%','Total c/Juros (R$)','Pago (R$)','Saldo (R$)','Situação']];
  dadosDin.forEach(function(d){
    var vencido=d.situacao==='A'&&d.vencimento&&new Date(d.vencimento)<new Date();
    rows.push([String(d.id).padStart(6,'0'),d.cliente_nome,d.descricao||'',
      fmtData(d.data),fmtData(d.vencimento),parseFloat(d.capital)||0,d.juros_pct,
      parseFloat(d.total_com_juros)||0,parseFloat(d.total_pago)||0,
      parseFloat(d.saldo_devedor)||0,
      d.situacao==='Q'?'Quitado':vencido?'Vencido':'Aberto']);
  });
  baixarExcel(rows,'dinheiro_emprestimos_'+hoje()+'.xlsx','Dinheiro');
}
function baixarExcel(rows, filename, sheetName){
  // Gera XML Excel (SpreadsheetML) que abre nativamente no Excel
  var xml='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
  xml+='<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
  xml+='xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  xml+='<Worksheet ss:Name="'+sheetName+'"><Table>';
  rows.forEach(function(row,ri){
    xml+='<Row>';
    row.forEach(function(cell){
      var t=typeof cell==='number'?'Number':'String';
      var v=String(cell).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if(ri===0)xml+='<Cell ss:StyleID="h"><Data ss:Type="'+t+'">'+v+'</Data></Cell>';
      else xml+='<Cell><Data ss:Type="'+t+'">'+v+'</Data></Cell>';
    });
    xml+='</Row>';
  });
  xml+='</Table></Worksheet>';
  xml+='<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#00ACC1" ss:Pattern="Solid"/></Style></Styles>';
  xml+='</Workbook>';
  var blob=new Blob([xml],{type:'application/vnd.ms-excel'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename.replace('.xlsx','.xls');a.click();
}
function imprimirRelatorio(){
  var conteudo = document.getElementById('areaRelatorio').innerHTML;
  var win = window.open('', '_blank', 'width=900,height=700');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">');
  win.document.write('<title>Relatório</title>');
  win.document.write('<style>');
  win.document.write('body{font-family:Arial,sans-serif;font-size:11px;margin:10mm;color:#000}');
  win.document.write('.rel-wrap{width:100%}');
  win.document.write('.rel-topo{display:flex;justify-content:space-between;border-bottom:2px solid #00acc1;padding-bottom:8px;margin-bottom:12px}');
  win.document.write('.rel-empresa h2{font-size:16px;margin:0;color:#00acc1}');
  win.document.write('.rel-empresa p{margin:2px 0;font-size:11px;color:#555}');
  win.document.write('.rel-info{font-size:10px;text-align:right;color:#555}');
  win.document.write('.rel-titulo-doc{text-align:center;font-size:14px;font-weight:700;margin:12px 0;text-transform:uppercase;letter-spacing:1px}');
  win.document.write('.rel-table{width:100%;border-collapse:collapse;margin-top:8px}');
  win.document.write('.rel-table th{background:#00acc1;color:#fff;padding:6px 8px;text-align:left;font-size:10px}');
  win.document.write('.rel-table td{padding:5px 8px;border-bottom:1px solid #e0e0e0;font-size:10px}');
  win.document.write('.rel-table tr:nth-child(even) td{background:#f9f9f9}');
  win.document.write('tfoot td{background:#e0f7fa!important;font-weight:700;border-top:2px solid #00acc1}');
  win.document.write('.rel-assin{display:flex;justify-content:space-around;margin-top:30px;padding-top:10px}');
  win.document.write('.rel-assin div{text-align:center;font-size:11px}');
  win.document.write('.rel-rodape{text-align:center;margin-top:20px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:6px}');
  win.document.write('.status-d{background:#fce4ec;color:#c62828;border:1px solid #f48fb1;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700}');
  win.document.write('.status-c{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700}');
  win.document.write('@media print{@page{size:A4;margin:10mm 12mm}body{margin:0}thead{display:table-header-group}tr{page-break-inside:avoid}}');
  win.document.write('</style></head><body>');
  win.document.write(conteudo);
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(function(){ win.focus(); win.print(); }, 600);
}





/* ===== RELATORIO PAGAMENTOS DE JUROS ===== */
function popularSelectPagJuros(){
  var sel=document.getElementById('relPagJurisCli');
  if(sel.options.length>1)return;
  clientes.forEach(function(c){
    var o=document.createElement('option');
    o.value=c.cliente_id;o.textContent=c.nome;
    sel.appendChild(o);
  });
}

async function carregarPagJuros(){
  var area=document.getElementById('areaRelatorio');
  area.innerHTML='<div style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span> Carregando...</div>';
  var cli=document.getElementById('relPagJurisCli').value;
  var emp=document.getElementById('relPagJurisEmp').value;
  var de=document.getElementById('relPagJurisDe').value;
  var ate=document.getElementById('relPagJurisAte').value;
  var qs=new URLSearchParams();
  if(cli)qs.set('cliente_id',cli);if(emp)qs.set('emprestimo_id',emp);if(de)qs.set('de',de);if(ate)qs.set('ate',ate);
  try{
    var r=await fetch(API+'/dinheiro/relatorio/pagamentos-juros?'+qs.toString());
    var d=await r.json();
    if(!d.ok)return area.innerHTML='<div style="color:red;padding:20px">Erro: '+d.erro+'</div>';
    var rows=d.data;
    if(!rows.length){area.innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Nenhum pagamento encontrado.</div>';return;}
    var totalPago=rows.reduce(function(s,x){return s+parseFloat(x.valor||0);},0);
    var h='';
    if(isMobile()){
      h='<div style="padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px"><span style="font-size:13px;color:#666">'+rows.length+' pagamento(s)</span><span style="font-size:14px;font-weight:700;color:#1565c0">Total: '+fmtBRL(totalPago)+'</span></div>';
      rows.forEach(function(x){
        var sit=x.situacao==='Q'?'Quitado':x.situacao==='V'?'Vencido':'Aberto';
        var sitCor=x.situacao==='Q'?'#2e7d32':x.situacao==='V'?'#c62828':'#1565c0';
        h+='<div style="background:#fff;border-radius:10px;border-left:4px solid #e65100;padding:14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)">';
        h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><div><div style="font-weight:700;font-size:14px;color:#333">'+x.cliente_nome+'</div>';
        h+='<div style="font-size:11px;color:#888">Emp. Nº '+String(x.emprestimo_id).padStart(4,'0')+(x.emp_desc?' — '+x.emp_desc:'')+'</div></div>';
        h+='<div style="font-size:11px;font-weight:700;color:#fff;background:'+sitCor+';border-radius:12px;padding:2px 8px">'+sit+'</div></div>';
        h+='<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;font-size:12px;color:#555"><span>📅 '+fmtData(x.data_pag)+'</span><span>💵 Capital: <b>'+fmtBRL(x.capital)+'</b></span><span>📈 <b>'+(x.juros_pct||0)+'%</b></span><span style="color:#1565c0">💰 Pago: <b>'+fmtBRL(x.valor)+'</b></span></div>';
        if(x.pag_obs)h+='<div style="font-size:11px;color:#aaa;margin-top:4px">📝 '+x.pag_obs+'</div>';
        h+='</div>';
      });
      h+='<div style="background:#fff;border-radius:8px;padding:12px 14px;margin-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:14px"><span>Total pago</span><span style="color:#1565c0">'+fmtBRL(totalPago)+'</span></div></div>';
    } else {
      var agora=new Date();var dataHora=agora.toLocaleDateString('pt-BR')+' às '+agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      h='<div class="rel-wrap"><div class="rel-header"><div class="rel-title">Histórico de Pagamentos de Juros — Dinheiro</div>';
      if(cli){var cn=rows[0]&&rows[0].cliente_nome;h+='<div class="rel-sub">Cliente: '+cn+'</div>';}
      if(emp)h+='<div class="rel-sub">Empréstimo Nº: '+String(emp).padStart(4,'0')+'</div>';
      if(de||ate)h+='<div class="rel-sub">Período: '+(de?fmtData(de):'início')+' até '+(ate?fmtData(ate):'hoje')+'</div>';
      h+='<div class="rel-sub">'+rows.length+' pagamento(s) encontrado(s)</div></div>';
      h+='<table class="rel-table"><thead><tr><th>Data Pgto</th><th>Cliente</th><th>Nº Emp.</th><th>Descrição</th><th>Capital</th><th>Juros%</th><th>Valor Pago</th><th>Total Pago</th><th>Situação</th><th>Observação</th></tr></thead><tbody>';
      rows.forEach(function(x){
        var sit=x.situacao==='Q'?'<span class="status-q">Quitado</span>':x.situacao==='V'?'<span class="status-v">Vencido</span>':'<span class="status-a">Aberto</span>';
        h+='<tr><td>'+fmtData(x.data_pag)+'</td><td>'+x.cliente_nome+'</td><td style="font-weight:700;text-align:center">'+String(x.emprestimo_id).padStart(4,'0')+'</td><td style="font-size:11px;color:#555">'+(x.emp_desc||'—')+'</td><td>'+fmtBRL(x.capital)+'</td><td>'+(x.juros_pct||0)+'%</td><td style="color:#1565c0;font-weight:700">'+fmtBRL(x.valor)+'</td><td style="color:#1565c0;font-weight:600">'+fmtBRL(x.total_pago_ate_hoje)+'</td><td>'+sit+'</td><td style="font-size:11px;color:#666">'+(x.pag_obs||'—')+'</td></tr>';
      });
      h+='</tbody><tfoot><tr><td colspan="6" style="font-weight:700;text-align:right">TOTAL PAGO</td><td style="font-weight:700;color:#1565c0">'+fmtBRL(totalPago)+'</td><td colspan="3"></td></tr></tfoot></table></div>';
    }
    area.innerHTML=h;
    document.getElementById('btnImprimirRel').style.display='';
  }catch(e){area.innerHTML='<div style="color:red;padding:20px">Erro de conexão</div>';}
}

/* ===== AVISO VENCIMENTO WHATSAPP ===== */
async function avisarVencimentosWhatsApp(){
  if(!selDin)return toast('Selecione um empréstimo!','warn');
  var x=dadosDin.find(function(d){return d.id===selDin;});
  if(!x)return toast('Empréstimo não encontrado!','warn');

  var jurosValor=(parseFloat(x.capital)||0)*((parseFloat(x.juros_pct)||0)/100);

  var texto='📅 *VENCIMENTOS — EMPRÉSTIMOS & SAFRA*\n';
  texto+='━━━━━━━━━━━━━━━━━━━━━\n\n';
  texto+='*'+fmtData(x.vencimento)+'*\n';
  texto+='👤 '+x.cliente_nome+'\n';
  texto+='🔢 Empréstimo Nº '+String(x.id).padStart(4,'0')+'\n';
  texto+='💵 Capital: '+fmtBRL(x.capital)+'\n';
  texto+='📈 Juros: '+(x.juros_pct||0)+'%\n';
  texto+='💰 Juros a pagar: '+fmtBRL(jurosValor)+'\n';
  texto+='⏰ Vencimento: '+fmtData(x.vencimento)+'\n';
  texto+='\n━━━━━━━━━━━━━━━━━━━━━\n';
  texto+='_Empréstimos & Safra_';

  var tel=(x.telefone||'').replace(/\D/g,'');
  var url='https://wa.me/'+(tel?'55'+tel:'')+'?text='+encodeURIComponent(texto);
  window.open(url,'_blank');
}

/* ===== RELATORIO VENCIMENTOS ===== */
async function carregarVencimentos(){
  var area=document.getElementById('areaRelatorio');
  area.innerHTML='<div style="text-align:center;padding:30px;color:#aaa"><span class="spinner"></span> Carregando...</div>';
  var dias=parseInt(document.getElementById('relVencDias').value);
  var url=API+'/dinheiro/vencimentos?dias='+(dias===0?-1:dias)+'&incluirVencidos='+(dias===0?'1':'0');
  try{
    var r=await fetch(url);var d=await r.json();
    if(!d.ok)return area.innerHTML='<div style="color:red;padding:20px">Erro: '+d.erro+'</div>';
    var rows=d.data;
    if(!rows.length){area.innerHTML='<div style="text-align:center;padding:40px;color:#aaa">Nenhum vencimento encontrado.</div>';return;}
    var totalJuros=rows.reduce(function(s,x){return s+(parseFloat(x.juros_valor)||0);},0);
    var totalCap=rows.reduce(function(s,x){return s+(parseFloat(x.capital)||0);},0);
    var titulo=dias===0?'Empréstimos Vencidos':'Próximos '+dias+' dias';
    var h='';
    if(isMobile()){
      h='<div style="padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px"><span style="font-size:13px;font-weight:700;color:#333">'+titulo+' — '+rows.length+' emp.</span><span style="font-size:13px;font-weight:700;color:#c62828">Juros: '+fmtBRL(totalJuros)+'</span></div>';
      rows.forEach(function(x){
        var hoje=new Date();hoje.setHours(0,0,0,0);
        var vd=new Date(x.vencimento+'T12:00:00');
        var vencido=vd<hoje;
        var bord=vencido?'#c62828':'#ff9800';
        var sitLabel=vencido?'VENCIDO':'A VENCER';
        h+='<div style="background:#fff;border-radius:10px;border-left:4px solid '+bord+';padding:14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)">';
        h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><div><div style="font-weight:700;font-size:14px;color:#333">'+x.cliente_nome+'</div>';
        h+='<div style="font-size:11px;color:#888">Emp. Nº '+String(x.emprestimo_id).padStart(4,'0')+(x.descricao?' — '+x.descricao:'')+'</div></div>';
        h+='<div style="font-size:11px;font-weight:700;color:#fff;background:'+bord+';border-radius:12px;padding:2px 8px">'+sitLabel+'</div></div>';
        h+='<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;font-size:12px;color:#555"><span>📅 Venc: <b style="color:'+bord+'">'+fmtData(x.vencimento)+'</b></span><span>💵 Capital: <b>'+fmtBRL(x.capital)+'</b></span><span>📈 <b>'+(x.juros_pct||0)+'%</b></span><span style="color:#c62828">💰 Juros: <b>'+fmtBRL(x.juros_valor)+'</b></span></div>';
        h+='</div>';
      });
      h+='<div style="background:#fff;border-radius:8px;padding:12px 14px;margin-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:13px"><span>Capital: '+fmtBRL(totalCap)+'</span><span style="color:#c62828">Juros: '+fmtBRL(totalJuros)+'</span></div></div>';
    } else {
      h='<div class="rel-wrap"><div class="rel-header"><div class="rel-title">'+titulo+'</div><div class="rel-sub">'+rows.length+' empréstimo(s) encontrado(s)</div></div>';
      h+='<table class="rel-table"><thead><tr><th>Vencimento</th><th>Cliente</th><th>Nº Emp.</th><th>Descrição</th><th>Capital</th><th>Juros%</th><th>Juros a Pagar</th><th>Situação</th></tr></thead><tbody>';
      rows.forEach(function(x){
        var hoje=new Date();hoje.setHours(0,0,0,0);
        var vd=new Date(x.vencimento+'T12:00:00');
        var vencido=vd<hoje;
        var corLinha=vencido?'background:#fff8f8':'';
        var sit=vencido?'<span class="status-v">Vencido</span>':'<span class="status-a">A vencer</span>';
        h+='<tr style="'+corLinha+'"><td style="font-weight:700;'+(vencido?'color:#c62828':'color:#1565c0')+'">'+fmtData(x.vencimento)+'</td><td>'+x.cliente_nome+'</td><td style="text-align:center;font-weight:700">'+String(x.emprestimo_id).padStart(4,'0')+'</td><td style="font-size:11px;color:#555">'+(x.descricao||'—')+'</td><td>'+fmtBRL(x.capital)+'</td><td>'+(x.juros_pct||0)+'%</td><td style="font-weight:700;color:#c62828">'+fmtBRL(x.juros_valor)+'</td><td>'+sit+'</td></tr>';
      });
      h+='</tbody><tfoot><tr><td colspan="4" style="font-weight:700;text-align:right">TOTAIS</td><td style="font-weight:700">'+fmtBRL(totalCap)+'</td><td></td><td style="font-weight:700;color:#c62828">'+fmtBRL(totalJuros)+'</td><td></td></tr></tfoot></table></div>';
    }
    area.innerHTML=h;
    document.getElementById('btnImprimirRel').style.display='';
  }catch(e){area.innerHTML='<div style="color:red;padding:20px">Erro de conexão</div>';}
}
