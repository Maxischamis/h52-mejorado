(function () {
  const $ = selector => document.querySelector(selector);
  const role = document.body.dataset.role;
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let orders = [];
  let unsubscribe;
  let busy = false;

  function allowed(order) {
    return role === 'kitchen'
      ? ['sent_to_kitchen','preparing','ready'].includes(order.status) || ['preparing','ready'].includes(order.kitchenStatus)
      : ['new','sent_to_kitchen','preparing','ready'].includes(order.status);
  }

  function itemNotes(item) {
    return [item.notes, item.note, ...(item.without || []).map(value => `Sin ${value}`), ...(item.extras || []).map(value => `Extra: ${value}`)].filter(Boolean).join(' · ');
  }

  function render() {
    const filter = $('#filter').value;
    const search = $('#search-table').value.trim().toLowerCase();
    const list = orders.filter(o => (filter ? o.status === filter : allowed(o)) && String(o.tableNumber).toLowerCase().includes(search)).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    $('#summary').textContent = list.length + ' pedidos';

    $('#orders').innerHTML = list.length ? list.map(order => `
      <article class="order">
        <div>
          <h2>Mesa ${esc(order.tableNumber)}</h2>
          <div class="meta">
            <span class="tag ${esc(order.status)}">${statusText(order)}</span>
            <span class="tag">${new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="tag">${money(order.totals?.total)}</span><span class="tag">${Math.max(0, Math.floor((Date.now()-new Date(order.createdAt))/60000))} min</span>
          </div>
          <ul class="items">
            ${order.items.map(item => `
              <li>
                <span class="qty">${esc(item.quantity)}x</span>
                <span>${esc(item.name)}</span>
                <strong>${money(item.total)}</strong>
                ${itemNotes(item) ? `<small class="note">${esc(itemNotes(item))}</small>` : ''}
              </li>
            `).join('')}
          </ul>
          ${order.customerNotes ? `<p class="muted">${esc(order.customerNotes)}</p>` : ''}
        </div>
        <div class="actions">${actions(order)}</div>
      </article>
    `).join('') : '<div class="empty">No hay pedidos para esta pantalla.</div>';
  }

  function statusText(order) {
    if (order.kitchenStatus === 'ready' || order.status === 'ready') return 'Listo';
    if (order.kitchenStatus === 'preparing' || order.status === 'preparing') return 'Preparando';
    if (order.status === 'sent_to_kitchen') return 'En cocina';
    if (order.status === 'cancelled') return 'Cancelado';
    if (order.status === 'delivered') return 'Entregado';
    return 'Nuevo';
  }

  function actions(order) {
    if (role === 'kitchen') {
      if (order.status === 'sent_to_kitchen') return '<button class="primary" data-action="preparing" data-id="' + esc(order.id) + '">Comenzar preparacion</button>';
      if (order.status === 'preparing') return '<button class="primary" data-action="ready" data-id="' + esc(order.id) + '">Marcar listo</button>';
      return '';
    }
    if (order.status === 'new') return '<button class="primary" data-action="send" data-id="' + esc(order.id) + '">Enviar a cocina</button><button class="secondary" data-action="cancelled" data-id="' + esc(order.id) + '">Cancelar</button>';
    if (order.status === 'ready') return '<button class="primary" data-action="delivered" data-id="' + esc(order.id) + '">Entregado</button>';
    return '';
  }

  async function refresh() {
    orders = await H52Backend.listOrders();
    render();
  }

  async function requireSession() {
    const state = await H52Backend.getSession();
    $('#mode').textContent = state.configured ? 'Conectando' : 'Sin servidor';
    $('#mode').className = `pill ${state.configured ? 'live' : 'local'}`;
    if (state.session?.role === role) {
      $('#login').hidden = true;
      $('#app').hidden = false;
      await refresh();
      unsubscribe?.();
      unsubscribe = H52Backend.subscribe(() => refresh().catch(showError));
      return;
    }
    $('#login').hidden = false;
    $('#app').hidden = true;
    $('#mode').textContent = 'Acceso del equipo';
  }

  $('#login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    $('#login-error').textContent = '';
    try {
      await H52Backend.signIn('', $('#password').value);
      await requireSession();
    } catch (error) {
      $('#login-error').textContent = 'No se pudo ingresar. Revisá la clave.';
    }
  });

  function showError(error) { $('#staff-error').textContent = error.message; }
  $('#search-table').addEventListener('input', render);
  $('#filter').addEventListener('change', render);
  $('#logout').addEventListener('click', async () => {try {await H52Backend.signOut(); unsubscribe?.(); await requireSession();} catch (error) {showError(error);}});
  window.addEventListener('h52-connection', event => {$('#mode').textContent = event.detail ? 'En vivo' : 'Reconectando'; $('#mode').className = 'pill ' + (event.detail ? 'live' : 'local');});
  setInterval(() => {if (!$('#app').hidden) render();}, 30000);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button || busy) return;
    const status = {send: 'sent_to_kitchen', preparing: 'preparing', ready: 'ready', delivered: 'delivered', cancelled: 'cancelled'}[button.dataset.action];
    busy = true; button.disabled = true; $('#staff-error').textContent = '';
    try {await H52Backend.updateOrder(button.dataset.id, {status}); await refresh();}
    catch (error) {showError(error);}
    finally {busy = false; button.disabled = false;}
  });

  requireSession().catch(error => {
    $('#login').hidden = false;
    $('#login-error').textContent = 'Servidor de pedidos no disponible. ' + error.message;
    $('#mode').textContent = 'Sin conexion';
  });
})();
