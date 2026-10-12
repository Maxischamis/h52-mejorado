(function () {
  let current, baseline, revision, replace, busy = false, checking = false, conflict = false;
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
      const next = await H52Backend.getMenu();
      if (next.revision !== revision) {
        if (dirty()) {conflict = true; status('Hay cambios de otro celular. Descarga tu borrador antes de recargar.');}
        else accept(next);
      } else if (!conflict) status(dirty() ? 'Cambios pendientes de guardar' : 'Todo guardado en el servidor');
    } catch {status('Sin conexion. El borrador sigue en este celular.');}
    finally {checking = false;}
  }
  window.H52EditorSync = {
    changed(value) {current = value; if (baseline && !busy && !conflict) status(dirty() ? 'Cambios pendientes de guardar' : 'Todo guardado en el servidor');},
    async start(value, replaceData) {
      current = value; replace = replaceData;
      const save = document.querySelector('#shared-save'), reload = document.querySelector('#shared-reload'), login = document.querySelector('#shared-login');
      async function auth() {
        const {session} = await H52Backend.getSession();
        const authorized = session?.role === 'waiter';
        login.hidden = authorized; save.disabled = !authorized;
        if (!authorized) status('Ingresa con la clave de salon para guardar');
      }
      try {
        accept(await H52Backend.getMenu()); await auth(); reload.disabled = false;
      } catch {status('Guardado compartido no disponible. Conecta el servidor JSON.'); return;}
      login.addEventListener('submit', async event => {
        event.preventDefault(); const button = login.querySelector('button'); button.disabled = true;
        try {await H52Backend.signIn('', document.querySelector('#shared-password').value); document.querySelector('#shared-password').value = ''; await auth(); await check();}
        catch (error) {status(error.message);} finally {button.disabled = false;}
      });
      save.addEventListener('click', async () => {
        if (busy || conflict) {if (conflict) status('Recarga los cambios compartidos antes de guardar. Puedes descargar tu borrador.'); return;}
        const payload = structuredClone(current);
        try {H52Data.validate(payload.design, payload.catalog);} catch (error) {status(error.message); return;}
        busy = true; save.disabled = true; status('Guardando...');
        try {
          const saved = await H52Backend.saveMenu({...payload, expectedRevision: revision});
          baseline = snapshot(saved); revision = saved.revision;
          if (!dirty()) {try {localStorage.removeItem('h52-editor-draft-v1');} catch {}}
          status(dirty() ? 'Guardado. Hay nuevos cambios pendientes.' : 'Guardado. Ya visible en los otros celulares.');
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
        try {accept(await H52Backend.getMenu());} catch (error) {status(error.message);}
        finally {busy = false; reload.disabled = false;}
      });
      setInterval(check, 2000);
      document.addEventListener('visibilitychange', check);
      window.addEventListener('beforeunload', event => {if (dirty()) {event.preventDefault(); event.returnValue = '';}});
    }
  };
})();
