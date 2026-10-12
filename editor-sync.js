(function () {
  let current, baseline, revision, replace, busy = false, checking = false, conflict = false;
  const github=location.hostname.endsWith('.github.io')&&!window.H52_BACKEND?.apiUrl;
  const storage=github?H52GithubEditor.create(window.H52_GITHUB):H52Backend;
  const savedLabel=github?'Todo guardado en GitHub':'Todo guardado en el servidor';
  const status = text => {document.querySelector('#shared-status').textContent = text;};
  const snapshot = value => JSON.stringify({design: value.design, catalog: value.catalog});
  const dirty = () => current && snapshot(current) !== baseline;
  function accept(next) {
    baseline = snapshot(next); revision = next.revision; conflict = false;
    replace(next); status('Carta compartida actualizada');
  }
  async function check() {
    if (busy || checking) return;
    checking = true;
    try {
      const next = await storage.getMenu();
      if (next.revision !== revision) {
        if (dirty()) {conflict = true; status('Hay cambios de otro celular. Descarga tu borrador antes de recargar.');}
        else accept(next);
      } else if (!conflict) status(dirty() ? 'Cambios pendientes de guardar' : document.querySelector('#shared-login').hidden?savedLabel:github?'Conecta GitHub para publicar':'Ingresa con la clave de salon para guardar');
    } catch {status('Sin conexion. El borrador sigue en este celular.');}
    finally {checking = false;}
  }
  window.H52EditorSync = {
    changed(value) {current = value; if (baseline && !busy && !conflict) status(dirty() ? 'Cambios pendientes de guardar' : savedLabel);},
    async start(value, replaceData) {
      current = value; replace = replaceData;
      const save = document.querySelector('#shared-save'), reload = document.querySelector('#shared-reload'), login = document.querySelector('#shared-login');
      if(github){
        save.innerHTML='<i data-lucide="github"></i>Publicar en GitHub';reload.innerHTML='<i data-lucide="refresh-cw"></i>Recargar GitHub';
        const input=document.querySelector('#shared-password');input.autocomplete='off';input.setAttribute('aria-label','Token de GitHub');
        login.querySelector('label').firstChild.textContent='Token de GitHub';login.querySelector('button').textContent='Conectar';
        document.querySelector('#github-token-link').hidden=false;window.lucide?.createIcons();
      }
      async function auth() {
        const {session} = await storage.getSession();
        const authorized = session?.role === 'waiter';
        login.hidden = authorized; save.disabled = !authorized;
        document.querySelector('#shared-disconnect').hidden=!github||!authorized;
        if (!authorized) status(github?'Conecta GitHub para publicar':'Ingresa con la clave de salon para guardar');
      }
      try {
        accept(await storage.getMenu()); await auth(); reload.disabled = false;
      } catch {
        baseline=snapshot(current);login.hidden=false;reload.disabled=false;
        status(github?'Conecta GitHub para leer y publicar la carta.':'Guardado compartido no disponible. Conecta el servidor JSON.');
      }
      login.addEventListener('submit', async event => {
        event.preventDefault(); const button = login.querySelector('button'); button.disabled = true;
        const password=document.querySelector('#shared-password').value;document.querySelector('#shared-password').value='';
        try {
          await storage.signIn('', password); await auth();
          if(!revision&&!dirty())accept(await storage.getMenu(true));else await check();
        }
        catch (error) {status(error.message);} finally {button.disabled = false;}
      });
      save.addEventListener('click', async () => {
        if (busy || conflict) {if (conflict) status('Recarga los cambios compartidos antes de guardar. Puedes descargar tu borrador.'); return;}
        const payload = structuredClone(current);
        try {H52Data.validate(payload.design, payload.catalog);} catch (error) {status(error.message); return;}
        busy = true; save.disabled = true; status('Guardando...');
        try {
          const saved = await storage.saveMenu({...payload, expectedRevision: revision});
          baseline = snapshot(saved); revision = saved.revision;
          if (!dirty()) {try {localStorage.removeItem('h52-editor-draft-v1');} catch {}}
          status(dirty() ? 'Guardado. Hay nuevos cambios pendientes.' : github?'Guardado en GitHub. La pagina publica se actualizara al terminar el despliegue.':'Guardado. Ya visible en los otros celulares.');
        } catch (error) {
          if (error.status === 409) conflict = true;
          status(error.message);
          if (error.status === 401 || error.status === 403) {login.hidden = false;}
        } finally {busy = false; save.disabled = !login.hidden;}
      });
      reload.addEventListener('click', async () => {
        if (busy) return;
        if (dirty() && !confirm('Reemplazar el borrador por la carta compartida? Descarga el JSON primero si necesitas conservarlo.')) return;
        busy = true; reload.disabled = true;
        try {accept(await storage.getMenu(true));} catch (error) {status(error.message);}
        finally {busy = false; reload.disabled = false;}
      });
      document.querySelector('#shared-disconnect').addEventListener('click',async()=>{if(busy)return;await storage.signOut();await auth();});
      setInterval(check, github?60000:2000);
      document.addEventListener('visibilitychange', check);
      window.addEventListener('beforeunload', event => {if (dirty()) {event.preventDefault(); event.returnValue = '';}});
    }
  };
})();
