const MEMBERS = [
  'Camilo Sierra','David Urrego','Esteban Jaramillo','Luisa Alviar','Manuela Villa','Rafa Mejía','Laura Velasquez','Sebastián Maldonado','Daniel Alzate'
];
const ADMINS = ['Daniel Alzate','Camilo Sierra'];
const KEY = 'inversion_amigos_v1';

const initialState = {
  currentUser: null,
  deposits: [],
  investments: [],
  interestEntries: []
};

let state = loadState();
let tab = 'resumen';

function loadState(){
  try { return {...initialState, ...JSON.parse(localStorage.getItem(KEY) || '{}')}; }
  catch { return {...initialState}; }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); render(); }
function money(n){ return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0)); }
function pct(n){ return `${Number(n||0).toFixed(2)}%`; }
function isAdmin(){ return ADMINS.includes(state.currentUser); }
function memberTotals(){
  const totals = Object.fromEntries(MEMBERS.map(m=>[m,0]));
  state.deposits.forEach(d=> totals[d.member]=(totals[d.member]||0)+Number(d.amount));
  return totals;
}
function totalSaved(){ return state.deposits.reduce((a,d)=>a+Number(d.amount),0); }
function totalInterest(){ return state.interestEntries.reduce((a,i)=>a+Number(i.amount),0); }
function totalInvested(){ return state.investments.reduce((a,i)=>a+Number(i.amount),0); }
function currentFundValue(){ return totalSaved()+totalInterest(); }

function loginView(){
  document.getElementById('app').innerHTML = `
    <div class="login"><div class="card login-card">
      <div class="brand"><h1>Inversión Amigos</h1><p>Selecciona tu perfil para ingresar al prototipo.</p></div>
      <div class="note" style="margin-top:16px">Este MVP guarda la información solo en este navegador. Para uso real entre varias personas, el siguiente paso es conectarlo a una base de datos con autenticación.</div>
      <div class="member-list">
        ${MEMBERS.map(m=>`<button class="member-btn" onclick="login('${m.replaceAll("'","\\'")}')"><span>${m}</span><span class="badge">${ADMINS.includes(m)?'Administrador':'Solo lectura'}</span></button>`).join('')}
      </div>
    </div></div>`;
}
function login(name){ state.currentUser=name; save(); }
function logout(){ state.currentUser=null; save(); }
function setTab(t){ tab=t; render(); }

function dashboardView(){
 const totals=memberTotals(); const saved=totalSaved(); const interest=totalInterest(); const fund=currentFundValue(); const invested=totalInvested();
 const sorted=[...MEMBERS].sort((a,b)=>totals[b]-totals[a]);
 document.getElementById('app').innerHTML = `
 <div class="shell">
  <div class="topbar"><div class="brand"><h1>Inversión Amigos</h1><p>Fondo colectivo y participación individual</p></div>
    <div class="userbox"><span class="badge">${state.currentUser} · ${isAdmin()?'Administrador':'Solo lectura'}</span><button class="btn secondary" onclick="logout()">Salir</button></div>
  </div>
  <div class="grid stats">
    <div class="card"><div class="label">Ahorro colectivo</div><div class="value">${money(saved)}</div><div class="sub">Total aportado por los 9 participantes</div></div>
    <div class="card"><div class="label">Intereses ganados</div><div class="value positive">${money(interest)}</div><div class="sub">Rentabilidad registrada</div></div>
    <div class="card"><div class="label">Valor actual del fondo</div><div class="value">${money(fund)}</div><div class="sub">Aportes + intereses</div></div>
    <div class="card"><div class="label">Capital registrado como invertido</div><div class="value">${money(invested)}</div><div class="sub">Puede estar distribuido entre varias inversiones</div></div>
  </div>
  <div class="tabs">
    ${['resumen','aportes','inversiones','intereses'].map(t=>`<button class="tab ${tab===t?'active':''}" onclick="setTab('${t}')">${({resumen:'Resumen',aportes:'Aportes',inversiones:'Inversiones',intereses:'Intereses'})[t]}</button>`).join('')}
  </div>
  ${tab==='resumen'?summaryTab(sorted,totals,saved):''}
  ${tab==='aportes'?depositsTab():''}
  ${tab==='inversiones'?investmentsTab():''}
  ${tab==='intereses'?interestTab():''}
 </div>`;
}

function summaryTab(sorted,totals,saved){
 return `<div class="grid content-grid">
  <div class="card"><div class="section-title"><h2>Participación individual</h2><span class="muted">Según aportes acumulados</span></div>
    <div class="table-wrap"><table><thead><tr><th>Participante</th><th>Aporte acumulado</th><th>Participación</th></tr></thead><tbody>
      ${sorted.map(m=>{const p=saved?totals[m]/saved*100:0; return `<tr><td>${m}</td><td>${money(totals[m])}</td><td><strong>${pct(p)}</strong><div class="bar"><span style="width:${Math.min(p,100)}%"></span></div></td></tr>`}).join('')}
    </tbody></table></div>
  </div>
  <div class="card"><div class="section-title"><h2>Últimos movimientos</h2></div>${recentMovements()}</div>
 </div>`;
}
function recentMovements(){
 const rows=[
  ...state.deposits.map(x=>({date:x.date,type:'Aporte',detail:x.member,amount:Number(x.amount)})),
  ...state.interestEntries.map(x=>({date:x.date,type:'Interés',detail:x.investmentName||'Rentabilidad',amount:Number(x.amount)}))
 ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
 if(!rows.length) return `<div class="empty">Aún no hay movimientos.</div>`;
 return `<table><tbody>${rows.map(r=>`<tr><td><div><strong>${r.type}</strong><div class="muted">${r.date} · ${r.detail}</div></div></td><td style="text-align:right">${money(r.amount)}</td></tr>`).join('')}</tbody></table>`;
}
function depositsTab(){
 return `<div class="split">
  <div class="card"><div class="section-title"><h2>Historial de aportes</h2></div>${state.deposits.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Valor</th><th></th></tr></thead><tbody>${[...state.deposits].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(d=>`<tr><td>${d.date}</td><td>${d.member}</td><td>${money(d.amount)}</td><td>${isAdmin()?`<button class="btn secondary" onclick="removeDeposit('${d.id}')">Eliminar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No hay aportes registrados.</div>`}</div>
  <div class="card"><div class="section-title"><h2>Registrar aporte</h2></div>${isAdmin()?depositForm():`<div class="empty">Tu perfil es de solo lectura.</div>`}</div>
 </div>`;
}
function depositForm(){ return `<form onsubmit="addDeposit(event)" class="form-grid">
 <div class="field"><label>Fecha</label><input type="date" name="date" required value="${new Date().toISOString().slice(0,10)}"></div>
 <div class="field"><label>Participante</label><select name="member" required>${MEMBERS.map(m=>`<option>${m}</option>`).join('')}</select></div>
 <div class="field full"><label>Valor aportado</label><input type="number" min="1" step="1" name="amount" placeholder="Ej. 500000" required></div>
 <div class="field full"><label>Nota opcional</label><input name="note" placeholder="Ej. Aporte octubre"></div>
 <div class="actions field full"><button class="btn" type="submit">Guardar aporte</button></div></form>`; }
function addDeposit(e){ e.preventDefault(); const f=new FormData(e.target); state.deposits.push({id:crypto.randomUUID(),date:f.get('date'),member:f.get('member'),amount:Number(f.get('amount')),note:f.get('note')}); save(); }
function removeDeposit(id){ if(confirm('¿Eliminar este aporte?')){state.deposits=state.deposits.filter(d=>d.id!==id);save();} }

function investmentsTab(){
 return `<div class="split"><div class="card"><div class="section-title"><h2>Dónde está invertido el dinero</h2></div>${state.investments.length?`<div class="table-wrap"><table><thead><tr><th>Inversión</th><th>Entidad</th><th>Capital</th><th>Tasa E.A.</th><th></th></tr></thead><tbody>${state.investments.map(i=>`<tr><td>${i.name}</td><td>${i.entity}</td><td>${money(i.amount)}</td><td>${i.rate?i.rate+'%':'—'}</td><td>${isAdmin()?`<button class="btn secondary" onclick="removeInvestment('${i.id}')">Eliminar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No hay inversiones registradas.</div>`}</div>
 <div class="card"><div class="section-title"><h2>Registrar inversión</h2></div>${isAdmin()?`<form onsubmit="addInvestment(event)" class="form-grid"><div class="field full"><label>Nombre / producto</label><input name="name" placeholder="Ej. CDT 180 días" required></div><div class="field"><label>Entidad</label><input name="entity" placeholder="Ej. Banco X" required></div><div class="field"><label>Capital invertido</label><input type="number" min="1" name="amount" required></div><div class="field"><label>Tasa E.A. (%)</label><input type="number" step="0.01" min="0" name="rate"></div><div class="field"><label>Fecha de inicio</label><input type="date" name="startDate" required></div><div class="field full"><label>Observaciones</label><input name="note" placeholder="Plazo, vencimiento, condiciones..."></div><div class="actions field full"><button class="btn">Guardar inversión</button></div></form>`:`<div class="empty">Tu perfil es de solo lectura.</div>`}</div></div>`;
}
function addInvestment(e){e.preventDefault();const f=new FormData(e.target);state.investments.push({id:crypto.randomUUID(),name:f.get('name'),entity:f.get('entity'),amount:Number(f.get('amount')),rate:Number(f.get('rate')||0),startDate:f.get('startDate'),note:f.get('note')});save();}
function removeInvestment(id){if(confirm('¿Eliminar esta inversión?')){state.investments=state.investments.filter(i=>i.id!==id);save();}}

function interestTab(){
 return `<div class="split"><div class="card"><div class="section-title"><h2>Intereses registrados</h2></div>${state.interestEntries.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Inversión</th><th>Ganancia</th><th></th></tr></thead><tbody>${[...state.interestEntries].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(i=>`<tr><td>${i.date}</td><td>${i.investmentName}</td><td class="positive">${money(i.amount)}</td><td>${isAdmin()?`<button class="btn secondary" onclick="removeInterest('${i.id}')">Eliminar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No se han registrado intereses.</div>`}</div>
 <div class="card"><div class="section-title"><h2>Registrar rentabilidad</h2></div>${isAdmin()?`<form onsubmit="addInterest(event)" class="form-grid"><div class="field"><label>Fecha</label><input type="date" name="date" required></div><div class="field"><label>Inversión</label><select name="investmentName" required>${state.investments.length?state.investments.map(i=>`<option>${i.name}</option>`).join(''):`<option>General</option>`}</select></div><div class="field full"><label>Interés ganado</label><input type="number" min="0" step="1" name="amount" required></div><div class="field full"><label>Nota opcional</label><input name="note"></div><div class="actions field full"><button class="btn">Guardar interés</button></div></form>`:`<div class="empty">Tu perfil es de solo lectura.</div>`}</div></div>`;
}
function addInterest(e){e.preventDefault();const f=new FormData(e.target);state.interestEntries.push({id:crypto.randomUUID(),date:f.get('date'),investmentName:f.get('investmentName'),amount:Number(f.get('amount')),note:f.get('note')});save();}
function removeInterest(id){if(confirm('¿Eliminar este interés?')){state.interestEntries=state.interestEntries.filter(i=>i.id!==id);save();}}

function render(){ state.currentUser ? dashboardView() : loginView(); }
render();
