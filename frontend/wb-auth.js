/* WidowBlue Auth + History + Admin (client)
 * Superadmin: giorgi.daniele96@gmail.com
 */
(function () {
  const ADMIN_EMAIL = 'giorgi.daniele96@gmail.com';
  const LS_USERS = 'wb_users_v1';
  const LS_SESSION = 'wb_session_v1';
  const LS_HIST = 'wb_hist_v1';

  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(LS_USERS) || '{}'); } catch (e) { return {}; }
  }
  function saveUsers(u) { localStorage.setItem(LS_USERS, JSON.stringify(u)); }
  function session() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch (e) { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(LS_SESSION, JSON.stringify(s));
    else localStorage.removeItem(LS_SESSION);
  }
  function histKey(email) { return LS_HIST + ':' + (email || 'guest'); }
  function loadHist(email) {
    try { return JSON.parse(localStorage.getItem(histKey(email)) || '[]'); } catch (e) { return []; }
  }
  function saveHist(email, list) {
    localStorage.setItem(histKey(email), JSON.stringify(list.slice(0, 80)));
  }

  async function hashPass(password, saltB64) {
    const enc = new TextEncoder();
    const salt = saltB64
      ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
      : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
    const saltOut = btoa(String.fromCharCode(...salt));
    return { hash, salt: saltOut };
  }

  function isAdmin(email) {
    return (email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }

  function ensureUI() {
    if (document.getElementById('wb-menu-btn')) return;

    const style = document.createElement('style');
    style.textContent = `
      #wb-menu-btn{position:fixed;right:12px;top:calc(10px + env(safe-area-inset-top,0px));z-index:30;
        width:40px;height:40px;border-radius:8px;border:1px solid rgba(77,225,255,.4);background:rgba(4,10,18,.85);
        color:#4de1ff;font-size:20px;cursor:pointer;line-height:1;pointer-events:auto}
      #wb-user-chip{position:fixed;right:56px;top:calc(14px + env(safe-area-inset-top,0px));z-index:30;
        font:600 12px Rajdhani,sans-serif;color:#5f8296;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}
      #wb-drawer{display:none;position:fixed;right:0;top:0;bottom:0;width:min(92vw,340px);z-index:40;
        background:rgba(4,10,18,.97);border-left:1px solid rgba(77,225,255,.35);padding:56px 14px 20px;overflow:auto}
      #wb-drawer h3{margin:0 0 12px;color:#4de1ff;font-size:16px}
      #wb-drawer .item{display:flex;align-items:flex-start;gap:8px;padding:10px;border:1px solid rgba(77,225,255,.2);
        border-radius:8px;margin-bottom:8px;cursor:pointer}
      #wb-drawer .item:hover{border-color:#4de1ff}
      #wb-drawer .item .meta{flex:1;font-size:13px;color:#cfeaf5}
      #wb-drawer .item .meta small{display:block;color:#5f8296;font-size:11px;margin-top:2px}
      #wb-drawer .item .del{background:transparent;border:1px solid rgba(255,107,107,.5);color:#ff6b6b;
        border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px}
      #wb-drawer .actions{display:flex;flex-direction:column;gap:8px;margin-top:12px}
      #wb-drawer button.act{height:40px;border-radius:6px;font:700 14px Rajdhani,sans-serif;cursor:pointer;
        border:1px solid rgba(77,225,255,.4);background:transparent;color:#4de1ff}
      #wb-drawer button.act.pri{background:#4de1ff;color:#04141c;border:0}
      #wb-drawer button.act.danger{border-color:#ff6b6b;color:#ff6b6b}
      #wb-auth,#wb-admin{display:none;position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.55);
        align-items:center;justify-content:center}
      #wb-auth .box,#wb-admin .box{width:min(92vw,400px);background:rgba(4,10,18,.98);border:1px solid rgba(77,225,255,.4);
        border-radius:12px;padding:20px;max-height:90vh;overflow:auto}
      #wb-auth h2,#wb-admin h2{margin:0 0 8px;color:#4de1ff}
      #wb-auth p.note,#wb-admin p.note{font-size:12px;color:#5f8296;margin:0 0 12px}
      #wb-auth label,#wb-admin label{display:block;font-size:12px;color:#5f8296;margin:8px 0 4px}
      #wb-auth input,#wb-admin input{width:100%;padding:10px;border-radius:6px;border:1px solid rgba(77,225,255,.35);
        background:rgba(77,225,255,.07);color:#cfeaf5;font:600 15px Rajdhani,sans-serif}
      #wb-auth .rowbtn,#wb-admin .rowbtn{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
      #wb-auth .rowbtn button,#wb-admin .rowbtn button{flex:1;min-width:100px;height:40px;border-radius:6px;
        font:700 14px Rajdhani,sans-serif;cursor:pointer}
      #wb-auth .err{color:#ff6b6b;font-size:13px;margin-top:8px}
      #wb-spider{display:none;position:fixed;left:16px;bottom:calc(180px + env(safe-area-inset-bottom,0px));z-index:25;
        background:rgba(40,0,0,.9);border:1px solid #ff6b6b;color:#ffb4b4;padding:8px 12px;border-radius:8px;
        font:600 12px Rajdhani,sans-serif;max-width:280px}
      #wb-admin .sec-block{border:1px solid rgba(77,225,255,.25);border-radius:8px;padding:10px;margin:10px 0}
      #wb-admin .sec-block h4{margin:0 0 6px;color:#ffb347;font-size:13px}
      #wb-admin code{font-size:12px;color:#4de1ff;word-break:break-all}
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'wb-menu-btn';
    btn.type = 'button';
    btn.title = 'Menu';
    btn.setAttribute('aria-label', 'Menu cronologia e account');
    btn.textContent = '⋮';
    document.body.appendChild(btn);

    const chip = document.createElement('div');
    chip.id = 'wb-user-chip';
    document.body.appendChild(chip);

    const drawer = document.createElement('div');
    drawer.id = 'wb-drawer';
    drawer.innerHTML = `
      <h3>Menu</h3>
      <div id="wb-drawer-user" style="font-size:13px;color:#5f8296;margin-bottom:12px"></div>
      <h3>Cronologia</h3>
      <p style="font-size:12px;color:#5f8296;margin:0 0 8px">Tocca una chat per riprenderla e continuare a scrivere.</p>
      <div id="wb-hist-list"></div>
      <div class="actions">
        <button type="button" class="act pri" id="wb-btn-login">Accedi / Registrati</button>
        <button type="button" class="act" id="wb-btn-admin" style="display:none">Dashboard sicurezza</button>
        <button type="button" class="act danger" id="wb-btn-logout" style="display:none">Esci</button>
        <button type="button" class="act" id="wb-btn-close-drawer">Chiudi</button>
      </div>`;
    document.body.appendChild(drawer);

    const auth = document.createElement('div');
    auth.id = 'wb-auth';
    auth.innerHTML = `
      <div class="box">
        <h2 id="wb-auth-title">Accedi</h2>
        <p class="note">Registrati per salvare la cronologia sul dispositivo.</p>
        <label>Email</label>
        <input type="email" id="wb-email" autocomplete="username">
        <label>Password (min 12 caratteri)</label>
        <input type="password" id="wb-pass" autocomplete="current-password">
        <div class="err" id="wb-auth-err"></div>
        <div class="rowbtn">
          <button type="button" id="wb-do-login" style="background:#4de1ff;color:#04141c;border:0">Accedi</button>
          <button type="button" id="wb-do-register" style="background:transparent;color:#4de1ff;border:1px solid rgba(77,225,255,.4)">Registrati</button>
          <button type="button" id="wb-auth-cancel" style="background:transparent;color:#5f8296;border:1px solid #5f8296">Annulla</button>
        </div>
      </div>`;
    document.body.appendChild(auth);

    const admin = document.createElement('div');
    admin.id = 'wb-admin';
    admin.innerHTML = `
      <div class="box">
        <h2>Dashboard sicurezza</h2>
        <p class="note">Solo superadmin: ${ADMIN_EMAIL}</p>
        <div class="sec-block">
          <h4>Chiave temporizzata</h4>
          <button type="button" id="wb-gen-key" style="background:#4de1ff;color:#04141c;border:0;height:36px;border-radius:6px;padding:0 12px;cursor:pointer;font:700 13px Rajdhani">Genera chiave</button>
          <p style="margin-top:8px"><code id="wb-timed-key">—</code></p>
          <p class="note" id="wb-key-ttl"></p>
        </div>
        <div class="sec-block">
          <h4>Spider Alert</h4>
          <button type="button" id="wb-sim-spider" style="background:transparent;color:#ff6b6b;border:1px solid #ff6b6b;height:36px;border-radius:6px;padding:0 12px;cursor:pointer;font:700 13px Rajdhani">Simula alert</button>
          <ul id="wb-spider-log" style="font-size:12px;color:#cfeaf5;padding-left:18px"></ul>
        </div>
        <div class="rowbtn">
          <button type="button" id="wb-admin-close" style="background:transparent;color:#4de1ff;border:1px solid rgba(77,225,255,.4)">Chiudi</button>
        </div>
      </div>`;
    document.body.appendChild(admin);

    const spider = document.createElement('div');
    spider.id = 'wb-spider';
    document.body.appendChild(spider);

    btn.onclick = () => { drawer.style.display = 'block'; refreshDrawer(); };
    document.getElementById('wb-btn-close-drawer').onclick = () => { drawer.style.display = 'none'; };
    document.getElementById('wb-btn-login').onclick = () => { drawer.style.display = 'none'; openAuth(); };
    document.getElementById('wb-btn-logout').onclick = () => { setSession(null); refreshChip(); refreshDrawer(); };
    document.getElementById('wb-btn-admin').onclick = () => {
      const s = session();
      if (!s || !isAdmin(s.email)) return;
      drawer.style.display = 'none';
      admin.style.display = 'flex';
    };
    document.getElementById('wb-auth-cancel').onclick = () => { auth.style.display = 'none'; };
    document.getElementById('wb-admin-close').onclick = () => { admin.style.display = 'none'; };
    document.getElementById('wb-do-login').onclick = doLogin;
    document.getElementById('wb-do-register').onclick = doRegister;
    document.getElementById('wb-gen-key').onclick = genTimedKey;
    document.getElementById('wb-sim-spider').onclick = () => {
      pushSpider('Simulated probe on /search');
      showSpiderBanner('Spider Alert: attività sospetta');
    };

    refreshChip();
  }

  function openAuth() {
    document.getElementById('wb-auth-err').textContent = '';
    document.getElementById('wb-auth').style.display = 'flex';
  }

  function refreshChip() {
    const s = session();
    const chip = document.getElementById('wb-user-chip');
    if (!chip) return;
    chip.textContent = s ? s.email : 'ospite';
  }

  function refreshDrawer() {
    const s = session();
    const u = document.getElementById('wb-drawer-user');
    u.textContent = s ? ('Account: ' + s.email + (isAdmin(s.email) ? ' · SUPERADMIN' : '')) : 'Ospite (cronologia locale)';
    document.getElementById('wb-btn-logout').style.display = s ? 'block' : 'none';
    document.getElementById('wb-btn-admin').style.display = s && isAdmin(s.email) ? 'block' : 'none';
    document.getElementById('wb-btn-login').style.display = s ? 'none' : 'block';

    const list = document.getElementById('wb-hist-list');
    list.innerHTML = '';
    const items = loadHist(s && s.email);
    if (!items.length) {
      list.innerHTML = '<p style="color:#5f8296;font-size:13px">Nessuna conversazione salvata.</p>';
      return;
    }
    items.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'item';
      const nMsg = (it.messages && it.messages.length) || 0;
      row.innerHTML =
        '<div class="meta">' +
        escapeHtml(it.title || it.prompt || 'Chat') +
        '<small>' +
        new Date(it.ts).toLocaleString() +
        (nMsg ? ' · ' + nMsg + ' messaggi' : '') +
        '</small></div>';
      const del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.textContent = 'Elimina';
      del.onclick = (e) => {
        e.stopPropagation();
        const next = loadHist(s && s.email).filter((_, i) => i !== idx);
        saveHist(s && s.email, next);
        refreshDrawer();
      };
      row.appendChild(del);
      row.onclick = () => {
        if (typeof window.wbLoadConversation === 'function') window.wbLoadConversation(it);
        document.getElementById('wb-drawer').style.display = 'none';
      };
      list.appendChild(row);
    });
  }

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  async function doRegister() {
    const email = document.getElementById('wb-email').value.trim().toLowerCase();
    const pass = document.getElementById('wb-pass').value;
    const err = document.getElementById('wb-auth-err');
    if (!email || !email.includes('@')) { err.textContent = 'Email non valida'; return; }
    if (pass.length < 12) { err.textContent = 'Password minimo 12 caratteri'; return; }
    const users = loadUsers();
    if (users[email]) { err.textContent = 'Email già registrata — accedi'; return; }
    const { hash, salt } = await hashPass(pass);
    users[email] = { hash, salt, created: Date.now(), role: isAdmin(email) ? 'superadmin' : 'user' };
    saveUsers(users);
    setSession({ email, role: users[email].role, at: Date.now() });
    document.getElementById('wb-auth').style.display = 'none';
    refreshChip();
    if (typeof say === 'function') say('Sicurezza', 'registrazione completata');
  }

  async function doLogin() {
    const email = document.getElementById('wb-email').value.trim().toLowerCase();
    const pass = document.getElementById('wb-pass').value;
    const err = document.getElementById('wb-auth-err');
    const users = loadUsers();
    const u = users[email];
    if (!u) { err.textContent = 'Account non trovato — registrati'; return; }
    const { hash } = await hashPass(pass, u.salt);
    if (hash !== u.hash) {
      pushSpider('Failed login for ' + email);
      err.textContent = 'Credenziali non valide';
      return;
    }
    setSession({ email, role: u.role || (isAdmin(email) ? 'superadmin' : 'user'), at: Date.now() });
    document.getElementById('wb-auth').style.display = 'none';
    refreshChip();
    if (typeof say === 'function') say('Sicurezza', 'accesso effettuato');
  }

  let keyTimer = null;
  function genTimedKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
    const arr = crypto.getRandomValues(new Uint8Array(20));
    let key = '';
    for (let i = 0; i < 20; i++) key += chars[arr[i] % chars.length];
    const el = document.getElementById('wb-timed-key');
    const ttl = document.getElementById('wb-key-ttl');
    el.textContent = key;
    let left = 60;
    ttl.textContent = 'Scade tra ' + left + 's';
    clearInterval(keyTimer);
    keyTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(keyTimer);
        el.textContent = '(scaduta)';
        ttl.textContent = 'Genera una nuova chiave';
      } else ttl.textContent = 'Scade tra ' + left + 's';
    }, 1000);
  }

  const spiderEvents = [];
  function pushSpider(msg) {
    spiderEvents.unshift({ t: Date.now(), msg });
    const ul = document.getElementById('wb-spider-log');
    if (ul) {
      ul.innerHTML = spiderEvents
        .slice(0, 8)
        .map((e) => '<li>' + new Date(e.t).toLocaleTimeString() + ' — ' + escapeHtml(e.msg) + '</li>')
        .join('');
    }
  }
  function showSpiderBanner(text) {
    const el = document.getElementById('wb-spider');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = text;
    setTimeout(() => {
      el.style.display = 'none';
    }, 6000);
  }

  /** Salva thread completo (messaggi) per ripresa continua */
  window.wbSaveConversation = function (prompt, result, messages) {
    const s = session();
    const email = s && s.email;
    const list = loadHist(email);
    const msgs = Array.isArray(messages)
      ? messages.map((m) => ({
          role: m.role,
          text: m.text || m.plain || '',
          plain: m.plain || m.text || '',
          html: m.html || null,
          entity: m.entity || null,
          at: m.at || Date.now(),
        }))
      : [
          { role: 'user', text: prompt || '', plain: prompt || '', at: Date.now() },
          { role: 'assistant', plain: result || '', text: result || '', at: Date.now() },
        ];
    // Aggiorna se stessa sessione recente (stesso titolo entro 30 min) altrimenti nuovo
    const title = (prompt || 'Chat').slice(0, 80);
    list.unshift({
      id: Date.now().toString(36),
      ts: Date.now(),
      title,
      prompt: prompt || '',
      result: (result || '').slice(0, 20000),
      messages: msgs.slice(-40),
    });
    saveHist(email, list);
  };

  window.wbLoadConversation = function (it) {
    if (typeof window.wbLoadConversation === 'function') {
      /* overridden by wb-app */
    }
    if (it && typeof say === 'function') say('Cronologia', (it.title || '').slice(0, 80));
  };

  window.wbSession = session;
  window.wbIsAdmin = function () {
    const s = session();
    return !!(s && isAdmin(s.email));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI);
  else ensureUI();
})();
