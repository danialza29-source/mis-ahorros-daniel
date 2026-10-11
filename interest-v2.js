// Intereses por días + confirmación manual.
const interestLocalDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const interestDaysInclusive=(a,b)=>Math.floor((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)+1;
const interestDailyRate=ea=>{const r=Number(ea)||0;return r>0?Math.pow(1+r/100,1/365)-1:0};
const interestConfirmed=(bank,k)=>savings.find(x=>x.type==='interest'&&x.bank===bank&&x.sourceMonth===k);
function interestInvalidateFrom(k){savings=savings.filter(x=>!(x.type==='interest'&&x.sourceMonth&&x.sourceMonth>=k))}
function interestNative(bank,k,throughDate=lastDayOfMonth(k)){
  const ea=latestRate(bank,k),dr=interestDailyRate(ea);if(!(ea>0&&dr>0))return 0;
  const start=firstDayOfMonth(k),end=throughDate<lastDayOfMonth(k)?throughDate:lastDayOfMonth(k);if(end<start)return 0;
  return savings.filter(x=>x.bank===bank&&x.date<=end&&!(x.type==='interest'&&x.sourceMonth===k)).reduce((sum,x)=>{
    const from=x.date>start?x.date:start;if(from>end)return sum;
    const days=interestDaysInclusive(from,end);
    return sum+nativeValue(x)*(Math.pow(1+dr,days)-1);
  },0);
}
function interestPendingRows(){
  const regular=savings.filter(x=>x.type!=='interest');if(!regular.length)return[];
  const earliest=regular.map(x=>monthFromDate(x.date)).filter(Boolean).sort()[0],current=monthKey();let k=earliest;
  while(k<current){
    const banks=[...new Set(savings.filter(x=>x.date<=lastDayOfMonth(k)).map(x=>x.bank))];
    const pending=banks.map(bank=>({bank,k,ea:latestRate(bank,k),suggested:interestNative(bank,k),existing:interestConfirmed(bank,k)})).filter(r=>r.ea>0&&r.suggested>0&&!r.existing);
    if(pending.length)return pending;
    k=nextMonthKey(k);
  }
  return[];
}
function interestCurrent(bank){return interestNative(bank,monthKey(),interestLocalDate())}
capitalizeMissingInterest=async()=>false;
currentMonthlyInterest=bank=>{const v=interestCurrent(bank);return bank==='ARQ'?v*arqRate:v};
renderRates=()=>{const k=monthKey(),banks=bankNames();$('rateMonthLabel').textContent=monthName(k);$('ratesList').innerHTML=banks.length?banks.map(bank=>{const ea=latestRate(bank,k),v=interestCurrent(bank),display=bank==='ARQ'?usd(v):cop(v);return`<div class="row"><div><b>${esc(bank)}</b><span class="muted">${ea>0?`${ea.toLocaleString('es-CO',{maximumFractionDigits:4})}% E.A.`:'Sin tasa definida'}</span></div><b>${v>0?`${display} acumulado`:'—'}</b></div>`}).join(''):'<div class="empty">Agrega un ahorro para configurar tasas.</div>'};
function interestRenderPending(){
  const rows=interestPendingRows(),card=$('interestReviewCard'),list=$('pendingInterestList');if(!card||!list)return;
  card.hidden=!rows.length;if(!rows.length){list.innerHTML='';return}
  const k=rows[0].k;$('interestReviewTitle').textContent=`Intereses de ${monthName(k)}`;$('interestReviewText').textContent='Revisa el valor calculado según los días que cada ahorro estuvo en la cuenta. Puedes modificarlo antes de sumarlo al saldo.';
  list.innerHTML=rows.map(r=>`<div class="row" style="align-items:flex-end"><div style="flex:1"><b>${esc(r.bank)}</b><span class="muted">${r.ea.toLocaleString('es-CO',{maximumFractionDigits:4})}% E.A. · cálculo por días hasta ${lastDayOfMonth(k)}</span><div class="field" style="margin-top:8px"><label>Interés a acreditar (${r.bank==='ARQ'?'USD':'COP'})</label><input class="interestConfirmInput" data-bank="${esc(r.bank)}" data-month="${k}" type="text" inputmode="decimal" value="${formatAmountValue(r.suggested)}"></div></div><button type="button" class="primary confirmInterest" data-bank="${esc(r.bank)}" data-month="${k}">Confirmar</button></div>`).join('');
  list.querySelectorAll('.interestConfirmInput').forEach(el=>{el.addEventListener('input',e=>formatAmountField(e.target));el.addEventListener('blur',e=>{const v=parseAmount(e.target.value);if(Number.isFinite(v))e.target.value=formatAmountValue(v)})});
  list.querySelectorAll('.confirmInterest').forEach(btn=>btn.onclick=async()=>{const input=[...list.querySelectorAll('.interestConfirmInput')].find(el=>el.dataset.bank===btn.dataset.bank&&el.dataset.month===btn.dataset.month),amount=parseAmount(input?.value);if(!(amount>=0))return;const k=btn.dataset.month,bank=btn.dataset.bank;savings.push({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${bank}`,amount,date:firstDayOfMonth(nextMonthKey(k)),bank,type:'interest',sourceMonth:k,eaApplied:latestRate(bank,k),manualInterest:true});await saveVault();render()});
}
function interestEnableDelete(){
  const rows=[...$('tbody').querySelectorAll('tr')],ordered=[...savings].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  rows.forEach((tr,i)=>{const x=ordered[i];if(!x||x.type!=='interest')return;const cell=tr.querySelector('td:last-child');if(!cell)return;cell.innerHTML=`<button type="button" class="deleteInterest delete" data-id="${x.id}">Eliminar</button>`});
  document.querySelectorAll('.deleteInterest').forEach(btn=>btn.onclick=async()=>{const x=savings.find(s=>s.id===btn.dataset.id);if(!x)return;if(confirm('¿Eliminar este interés? Se restará del saldo y volverá a quedar pendiente por confirmar.')){savings=savings.filter(s=>s.id!==x.id);await saveVault();render()}});
}
function ensureInterestReviewUI(){
  if(!$('interestReviewCard')){
    const card=document.createElement('section');card.className='card rateCard';card.id='interestReviewCard';card.hidden=true;
    card.innerHTML='<div class="head"><div><div class="label">Capitalización</div><h2 id="interestReviewTitle">Intereses por confirmar</h2><p class="muted" id="interestReviewText">Revisa el valor antes de sumarlo al saldo.</p></div></div><div id="pendingInterestList"></div>';
    const rates=$('ratesList')?.closest('.card');if(rates)rates.insertAdjacentElement('afterend',card);else document.querySelector('main')?.appendChild(card);
  }
  const note=$('ratesList')?.nextElementSibling;if(note&&note.classList.contains('muted'))note.textContent='La tasa vigente se mantiene hasta que la cambies. El interés se calcula por los días efectivos de permanencia y debe confirmarse antes de sumarse al saldo.';
}
const previousRender=render;
render=()=>{
  previousRender();
  const totalAccrued=bankNames().reduce((sum,bank)=>sum+(bank==='ARQ'?interestCurrent(bank)*arqRate:interestCurrent(bank)),0);
  if($('interestSummary'))$('interestSummary').textContent=`Interés acumulado estimado este mes: ${cop(totalAccrued)}`;
  const goal=Number(goals[monthKey()])||0,monthsRemaining=12-new Date().getMonth();
  if($('annual'))$('annual').textContent=goal?cop(goal*monthsRemaining):'Sin definir';
  renderRates();interestRenderPending();interestEnableDelete();
  document.querySelectorAll('.delete').forEach(btn=>{if(btn.classList.contains('deleteInterest'))return;btn.onclick=async()=>{const x=savings.find(s=>s.id===btn.dataset.id);if(x&&confirm('¿Eliminar este ahorro?')){interestInvalidateFrom(monthFromDate(x.date));savings=savings.filter(s=>s.id!==btn.dataset.id);await saveVault();render()}}});
};
document.addEventListener('DOMContentLoaded',()=>{
  ensureInterestReviewUI();render();
  $('savingForm').onsubmit=async e=>{
    e.preventDefault();const amount=parseAmount($('amount').value),date=$('date').value,bank=$('bank').value;if(!(amount>0)||!date||!bank)return;
    if(editingId){const i=savings.findIndex(x=>x.id===editingId);if(i>=0){const old=savings[i],from=[monthFromDate(old.date),monthFromDate(date)].sort()[0];interestInvalidateFrom(from);savings[i]={...old,amount,date,bank}}}
    else{if(monthFromDate(date)<monthKey())interestInvalidateFrom(monthFromDate(date));savings.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),amount,date,bank,type:'saving'})}
    await saveVault();$('savingDialog').close();editingId=null;render();
  };
});
