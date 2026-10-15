(() => {
  const ACCESS_HASH = 'eea975611d6f0067d073a5a4641605c975747d41caa36c32d7470267621da677';
  const ENCRYPTED_PREFIX = 'INVENC1:';
  const SENSITIVE_KEYS = new Set([
    'inversion_amigos_v1',
    'inversion_amigos_admin_key_v1',
    'inversion_amigos_email_config_v1'
  ]);
  let accessPassword = '';
  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  function bytesToHex(buffer){return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('')}
  async function sha256(text){return bytesToHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))}
  function encryptText(text){return ENCRYPTED_PREFIX + CryptoJS.AES.encrypt(String(text), accessPassword).toString()}
  function decryptText(value){
    if(!value || !String(value).startsWith(ENCRYPTED_PREFIX)) return value;
    const cipher = String(value).slice(ENCRYPTED_PREFIX.length);
    const plain = CryptoJS.AES.decrypt(cipher, accessPassword).toString(CryptoJS.enc.Utf8);
    if(!plain) throw new Error('No fue posible descifrar la información guardada.');
    return plain;
  }
  function patchStorage(){
    Storage.prototype.getItem = function(key){
      const value = nativeGetItem.call(this,key);
      if(this===localStorage && SENSITIVE_KEYS.has(String(key)) && value){
        try{return decryptText(value)}catch{return null}
      }
      return value;
    };
    Storage.prototype.setItem = function(key,value){
      if(this===localStorage && SENSITIVE_KEYS.has(String(key))) return nativeSetItem.call(this,key,encryptText(value));
      return nativeSetItem.call(this,key,value);
    };
    Storage.prototype.removeItem = function(key){return nativeRemoveItem.call(this,key)};
  }
  function migrateExistingData(){
    SENSITIVE_KEYS.forEach(key=>{
      const value = nativeGetItem.call(localStorage,key);
      if(value && !String(value).startsWith(ENCRYPTED_PREFIX)) nativeSetItem.call(localStorage,key,encryptText(value));
    });
  }
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
  function renderLock(message=''){
    document.getElementById('app').innerHTML = `<div class="login"><div class="card login-card"><div class="brand"><h1>Inversión Amigos</h1><p>Fondo privado de ahorro e inversión.</p></div><form id="access-form" class="form-grid" style="margin-top:18px"><div class="field full"><label>Clave de acceso</label><input id="access-password" type="password" autocomplete="current-password" required placeholder="Ingresa la clave compartida"></div>${message?`<div class="field full"><div class="note" style="border-color:#fecaca;background:#fef2f2;color:#991b1b">${message}</div></div>`:''}<div class="actions field full"><button class="btn" type="submit">Entrar</button></div></form><div class="muted" style="margin-top:14px;font-size:12px">Solo las personas autorizadas deben conocer esta clave.</div></div></div>`;
    document.getElementById('access-form').addEventListener('submit',unlock);
  }
  async function unlock(e){
    e.preventDefault();
    const candidate=document.getElementById('access-password').value;
    if(await sha256(candidate)!==ACCESS_HASH){renderLock('La clave de acceso no es correcta.');return}
    accessPassword=candidate;
    try{
      patchStorage();
      migrateExistingData();
      document.getElementById('app').innerHTML='<div class="login"><div class="card login-card"><div class="muted">Abriendo fondo…</div></div></div>';
      await loadScript('app.js?v=secure1');
      await loadScript('overrides.js?v=secure1');
    }catch(err){renderLock('No fue posible abrir la información cifrada en este navegador.')}
  }
  renderLock();
})();