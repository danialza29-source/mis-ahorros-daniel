const SUPABASE_URL='https://zpqpflmzzibhykctctfy.supabase.co';
const SUPABASE_KEY='sb_publishable_UzcS_X6DzvBHAfXAR6XfLg_OQzQg06C';
const SHARED_STATE_ENDPOINT=`${SUPABASE_URL}/rest/v1/app_state?id=eq.main`;
let remoteSyncBusy=false;
let lastRemoteUpdatedAt='';

function sharedHeaders(extra={}){
  return {
    'apikey':SUPABASE_KEY,
    'Content-Type':'application/json',
    ...extra
  };
}

function cleanSharedState(){
  return {
    deposits:Array.isArray(state.deposits)?state.deposits:[],
    investments:Array.isArray(state.investments)?state.investments:[],
    interestEntries:Array.isArray(state.interestEntries)?state.interestEntries:[]
  };
}

function hasFinancialData(s){
  return Boolean((s?.deposits?.length||0)+(s?.investments?.length||0)+(s?.interestEntries?.length||0));
}

async function fetchSharedState({renderAfter=true}={}){
  if(remoteSyncBusy)return false;
  remoteSyncBusy=true;
  try{
    const res=await fetch(`${SHARED_STATE_ENDPOINT}&select=state,updated_at,updated_by`,{headers:sharedHeaders()});
    if(!res.ok)throw new Error(`Lectura Supabase ${res.status}`);
    const rows=await res.json();
    const row=rows?.[0];
    if(!row)return false;
    const remote=row.state||{};

    if(!hasFinancialData(remote)&&hasFinancialData(state)){
      lastRemoteUpdatedAt=row.updated_at||'';
      if(renderAfter)render();
      return true;
    }

    if(row.updated_at&&row.updated_at===lastRemoteUpdatedAt)return true;
    const currentUser=state.currentUser;
    state={...state,...remote,currentUser};
    localStorage.setItem(KEY,JSON.stringify({...state,currentUser:null}));
    lastRemoteUpdatedAt=row.updated_at||'';
    if(renderAfter)render();
    return true;
  }catch(err){
    console.warn('No fue posible actualizar datos compartidos:',err);
    return false;
  }finally{
    remoteSyncBusy=false;
  }
}

async function pushSharedState(renderAfter=true){
  try{
    const payload={state:cleanSharedState(),updated_at:new Date().toISOString(),updated_by:adminName()};
    const res=await fetch(SHARED_STATE_ENDPOINT,{
      method:'PATCH',
      headers:sharedHeaders({'Prefer':'return=representation'}),
      body:JSON.stringify(payload)
    });
    if(!res.ok)throw new Error(await res.text());
    const rows=await res.json();
    lastRemoteUpdatedAt=rows?.[0]?.updated_at||payload.updated_at;
    if(renderAfter)render();
    return true;
  }catch(err){
    console.error('No fue posible guardar en la base compartida:',err);
    alert('El cambio quedó guardado en este dispositivo, pero no pudo sincronizarse con el fondo compartido.');
    if(renderAfter)render();
    return false;
  }
}

save=function(renderNow=true){
  localStorage.setItem(KEY,JSON.stringify({...state,currentUser:null}));
  if(isAdmin())pushSharedState(renderNow);else if(renderNow)render();
};

fetchSharedState();
setInterval(()=>fetchSharedState({renderAfter:true}),4000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')fetchSharedState({renderAfter:true})});
