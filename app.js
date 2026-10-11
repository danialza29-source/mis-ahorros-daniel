const C = window.APP_CONFIG;
const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const dec = new TextDecoder();
let savings = [], goals = {}, arqRate = 0, arqDate = '', activeKey = null;
const colors = ['#8ED1C5','#F4C95D','#C6A7E2','#F09A8E','#88B7E8','#E6A76F','#A7C97E','#D9A6C7'];

const cop = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(v)||0);
const usd = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
const b64 = bytes => btoa(Array.from(new Uint8Array(bytes), b => String.fromCharCode(b)).join(''));
const ub64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

async function deriveKey(password, salt) {
  if (!window.crypto || !crypto.subtle) throw new Error('Este navegador no permite cifrado seguro. Abre la app en Safari usando HTTPS.');
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'},
    base,
    {name:'AES-GCM', length:256},
    false,
    ['encrypt','decrypt']
  );
}
async function encrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, enc.encode(JSON.stringify(data)));
  return {iv:b64(iv), cipher:b64(cipher)};
}
async function decrypt(key, vault) {
  const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(vault.iv)}, key, ub64(vault.cipher));
  return JSON.parse(dec.decode(plain));
}
async function saveVault() {
  if (!activeKey) return;
  const raw = localStorage.getItem(C.vaultKey);
  if (!raw) return;
  const vault = JSON.parse(raw);
  const encrypted = await encrypt(activeKey,{savings,goals,arqRate,arqDate});
  localStorage.setItem(C.vaultKey, JSON.stringify({version:1,salt:vault.salt,...encrypted}));
}
function valueCOP(x){return x.bank==='ARQ' ? Number(x.amount)*arqRate : Number(x.amount)}
function monthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthName(){return new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(new Date())}
function dateFmt(s){const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d))}
function grouped(){
  const out={};
  for(const x of savings){
    if(!out[x.bank]) out[x.bank]={cop:0,usd:0};
    if(x.bank==='ARQ'){out[x.bank].usd+=Number(x.amount);out[x.bank].cop+=valueCOP(x)}
    else out[x.bank].cop+=Number(x.amount);
  }
  return Object.entries(out).sort((a,b)=>b[1].cop-a[1].cop);
}
function renderPie(banks,total){
  const pie=$('pie'),legend=$('legend'); legend.innerHTML='';
  if(!banks.length||!total){pie.style.background='#ffffff22';$('pieLabel').textContent='Distribución';$('pieValue').textContent='0 entidades';return}
  let start=0; const parts=[];
  banks.forEach(([bank,data],i)=>{const pct=data.cop/total*100;parts.push(`${colors[i%colors.length]} ${start}% ${start+pct}%`);start+=pct;const b=document.createElement('button');b.type='button';b.innerHTML=`<span class="dot" style="background:${colors[i%colors.length]}"></span>${esc(bank)} ${Math.round(pct)}%`;b.onclick=()=>{$('pieLabel').textContent=bank;$('pieValue').textContent=bank==='ARQ'?usd(data.usd):cop(data.cop)};legend.appendChild(b)});
  pie.style.background=`conic-gradient(${parts.join(',')})`;$('pieLabel').textContent='Distribución';$('pieValue').textContent=`${banks.length} entidades`;
}
function renderGoal(){
  const k=monthKey(),goal=Number(goals[k])||0,saved=savings.filter(x=>x.date?.slice(0,7)===k).reduce((a,x)=>a+valueCOP(x),0);
  $('goalMonth').textContent=monthName().replace(/^./,c=>c.toUpperCase());$('savedMonth').textContent=cop(saved);$('goalAmountView').textContent=goal?cop(goal):'Sin definir';$('annual').textContent=goal?cop(goal*12):'Sin definir';
  $('goalCard').classList.remove('pending','done');$('goalStatus').classList.remove('pending','done');
  if(!goal){$('bar').style.width='0%';$('goalCard').classList.add('pending');$('goalStatus').classList.add('pending');$('goalStatus').textContent='Define una meta para este mes';return}
  $('bar').style.width=Math.min(100,saved/goal*100)+'%';
  if(saved>=goal){$('goalCard').classList.add('done');$('goalStatus').classList.add('done');$('goalStatus').textContent=`Meta cumplida · ${Math.round(saved/goal*100)}%`}
  else{$('goalCard').classList.add('pending');$('goalStatus').classList.add('pending');$('goalStatus').textContent=`Meta pendiente · faltan ${cop(goal-saved)}`}
}
function render(){
  const total=savings.reduce((a,x)=>a+valueCOP(x),0),banks=grouped();
  $('total').textContent=cop(total);$('count').textContent=savings.length?`${savings.length} ${savings.length===1?'registro':'registros'} de ahorro`:'Aún no tienes registros.';$('bankCount').textContent=`${banks.length} ${banks.length===1?'entidad':'entidades'}`;
  $('banks').innerHTML=banks.length?banks.map(([b,d])=>`<div class="row"><div><b>${esc(b)}</b><span class="muted">${total?Math.round(d.cop/total*100):0}% del total${b==='ARQ'?` · ${usd(d.usd)}`:''}</span></div><b>${b==='ARQ'&&!arqRate?'Falta tasa':cop(d.cop)}</b></div>`).join(''):'<div class="empty">Agrega tu primer ahorro.</div>';
  renderPie(banks,total);renderGoal();
  const hasARQ=savings.some(x=>x.bank==='ARQ');$('arqCard').hidden=!hasARQ;if(hasARQ){$('arqInput').value=arqRate||'';$('arqText').textContent=arqRate?`Tasa actual: ${cop(arqRate)} por USD${arqDate?' · '+arqDate:''}`:'Ingresa la tasa COP por USD.'}
  const rows=[...savings].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $('tbody').innerHTML=rows.map(x=>`<tr><td data-label="Fecha">${dateFmt(x.date)}</td><td data-label="Entidad">${esc(x.bank)}</td><td data-label="Valor"><b>${x.bank==='ARQ'?`${usd(x.amount)}${arqRate?` · ${cop(valueCOP(x))}`:' · Falta tasa'}`:cop(x.amount)}</b></td><td><button type="button" class="delete" data-id="${x.id}">Eliminar</button></td></tr>`).join('');
  $('table').style.display=rows.length?'table':'none';$('empty').style.display=rows.length?'none':'block';
  document.querySelectorAll('.delete').forEach(btn=>btn.onclick=async()=>{if(confirm('¿Eliminar este ahorro?')){savings=savings.filter(x=>x.id!==btn.dataset.id);await saveVault();render()}});
}
async function setupAccount(){
  const err=$('setupErr'),btn=$('setupForm').querySelector('button');err.textContent='';
  const p=$('newPass').value,c=$('confirmPass').value;
  if(p.length<8){err.textContent='Usa al menos 8 caracteres.';return}
  if(p!==c){err.textContent='Las contraseñas no coinciden.';return}
  btn.disabled=true;btn.textContent='Creando…';
  try{
    const salt=crypto.getRandomValues(new Uint8Array(16));
    activeKey=await deriveKey(p,salt);
    const encrypted=await encrypt(activeKey,{savings,goals,arqRate,arqDate});
    localStorage.setItem(C.vaultKey,JSON.stringify({version:1,salt:b64(salt),...encrypted}));
    $('newPass').value='';$('confirmPass').value='';$('overlay').hidden=true;render();
  }catch(e){console.error(e);err.textContent=e?.message||'No fue posible crear la clave en este navegador.';activeKey=null}
  finally{btn.disabled=false;btn.textContent='Crear y entrar'}
}
async function unlockAccount(){
  const err=$('unlockErr'),btn=$('unlockForm').querySelector('button');err.textContent='';btn.disabled=true;btn.textContent='Abriendo…';
  try{
    const raw=localStorage.getItem(C.vaultKey);if(!raw) throw new Error('No existe una bóveda guardada.');
    const vault=JSON.parse(raw),k=await deriveKey($('unlockPass').value,ub64(vault.salt)),data=await decrypt(k,vault);
    activeKey=k;savings=Array.isArray(data.savings)?data.savings:[];goals=data.goals||{};arqRate=Number(data.arqRate)||0;arqDate=data.arqDate||'';$('unlockPass').value='';$('overlay').hidden=true;render();
  }catch(e){console.error(e);err.textContent='No pudimos abrir la bóveda. Revisa la contraseña.'}
  finally{btn.disabled=false;btn.textContent='Desbloquear'}
}
function lock(){activeKey=null;savings=[];goals={};arqRate=0;arqDate='';$('overlay').hidden=false;$('setup').hidden=true;$('unlock').hidden=false}
function exportExcel(){if(!savings.length)return alert('No hay datos para exportar.');const rows=[['Fecha','Entidad bancaria','Moneda','Valor original','Equivalente COP'],...[...savings].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(x=>[x.date,x.bank,x.bank==='ARQ'?'USD':'COP',x.amount,valueCOP(x)])];const html='<table>'+rows.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</table>';const blob=new Blob([html],{type:'application/vnd.ms-excel'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='mis_ahorros.xls';a.click();URL.revokeObjectURL(u)}

document.addEventListener('DOMContentLoaded',()=>{
  document.documentElement.style.setProperty('--accent',C.accent);document.documentElement.style.setProperty('--accent2',C.accent2);document.title=C.name;$('title').textContent=C.name;$('unlockTitle').textContent=C.name;
  const has=!!localStorage.getItem(C.vaultKey);$('setup').hidden=has;$('unlock').hidden=!has;$('overlay').hidden=false;render();
  $('setupForm').addEventListener('submit',e=>{e.preventDefault();setupAccount()});$('unlockForm').addEventListener('submit',e=>{e.preventDefault();unlockAccount()});$('lockBtn').onclick=lock;
  $('newBtn').onclick=()=>{$('savingForm').reset();$('date').value=new Date().toISOString().slice(0,10);$('savingDialog').showModal()};
  document.querySelectorAll('#cancelSaving').forEach(b=>b.onclick=()=>$('savingDialog').close());
  $('bank').onchange=()=>{$('amountHelp').textContent=$('bank').value==='ARQ'?'Valor en dólares (USD).':'Valor en pesos colombianos (COP).'};
  $('savingForm').onsubmit=async e=>{e.preventDefault();const amount=Number($('amount').value),date=$('date').value,bank=$('bank').value;if(!(amount>0)||!date||!bank)return;savings.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),amount,date,bank});await saveVault();$('savingDialog').close();render()};
  $('goalBtn').onclick=()=>{$('goalInput').value=goals[monthKey()]||'';$('goalDialog').showModal()};$('cancelGoal').onclick=()=>$('goalDialog').close();$('goalForm').onsubmit=async e=>{e.preventDefault();const v=Number($('goalInput').value);if(!(v>0))return;goals[monthKey()]=v;await saveVault();$('goalDialog').close();render()};
  $('saveArq').onclick=async()=>{const v=Number($('arqInput').value);if(!(v>0))return;arqRate=v;arqDate=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium'}).format(new Date());await saveVault();render()};
  $('backupBtn').onclick=()=>{const raw=localStorage.getItem(C.vaultKey);if(!raw)return alert('No hay copia cifrada para exportar.');const blob=new Blob([JSON.stringify({app:C.name,type:'encrypted-backup',version:1,exportedAt:new Date().toISOString(),vault:JSON.parse(raw)},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=C.backup;a.click();URL.revokeObjectURL(u)};
  $('restoreBtn').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const p=JSON.parse(await f.text());if(!p.vault?.salt||!p.vault?.iv||!p.vault?.cipher)throw new Error();if(!confirm('Esto reemplazará los datos actuales. ¿Continuar?'))return;localStorage.setItem(C.vaultKey,JSON.stringify(p.vault));lock();$('unlockErr').textContent='Copia restaurada. Usa la contraseña con la que se creó.'}catch{alert('No fue posible restaurar la copia.')}finally{e.target.value=''}};
  $('exportBtn').onclick=exportExcel;
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
});