(function () {
  const $ = selector => document.querySelector(selector);
  const role = document.body.dataset.role;
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let orders = [];

  function allowed(order) {
    return role === 'kitchen'
      ? ['sent_to_kitchen','preparing','ready'].includes(order.status) || ['preparing','ready'].includes(order.kitchenStatus)
      : ['new','sent_to_kitchen','preparing','ready'].includes(order.status);
  }

  function itemNotes(item) {
    return [item.notes, item.note, ...(item.without || []).map(value => `Sin ${value}`), ...(item.extras || []).map(value => `Extra: ${value}`)].filter(Boolean).join(' · ');
  }

  function render() {
    const list = orders.filter(allowed).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    $('#orders').innerHTML = list.length ? list.map(order => `
      <article class="order">
        <div>
          <h2>Mesa ${esc(order.tableNumber)}</h2>
          <div class="meta">
            <span class="tag ${esc(order.status)}">${statusText(order)}</span>
            <span class="tag">${new Date(order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="tag">${money(order.totals?.total)}</span>
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
    return 'Nuevo';
  }

  function actions(order) {
    if (role === 'kitchen') {
      return `
        <button class="secondary" data-action="preparing" data-id="${esc(order.id)}">Preparando</button>
        <button class="primary" data-action="ready" data-id="${esc(order.id)}">Listo</button>
      `;
    }
    return `
      <button class="primary" data-action="send" data-id="${esc(order.id)}" ${order.status !== 'new' ? 'disabled' : ''}>Enviar a cocina</button>
      <button class="secondary" data-action="delivered" data-id="${esc(order.id)}">Entregado</button>
    `;
  }

  async function refresh() {
    orders = await H52Backend.listOrders();
    render();
  }

  async function requireSession() {
    const state = await H52Backend.getSession();
    $('#mode').textContent = state.configured ? 'Supabase conectado' : 'Modo local';
    $('#mode').className = `pill ${state.configured ? 'live' : 'local'}`;
    if (!state.configured || state.session) {
      $('#login').hidden = true;
      $('#app').hidden = false;
      await refresh();
      H52Backend.subscribe(refresh);
      return;
    }
    $('#login').hidden = false;
    $('#app').hidden = true;
  }

  $('#login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    $('#login-error').textContent = '';
    try {
      await H52Backend.signIn($('#email').value, $('#password').value);
      await requireSession();
    } catch (error) {
      $('#login-error').textContent = 'No se pudo ingresar. Revisá email y clave.';
    }
  });

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === 'send') await H52Backend.updateOrder(id, { status: 'sent_to_kitchen', kitchenStatus: 'waiting', sentToKitchenAt: new Date().toISOString() });
    if (button.dataset.action === 'preparing') await H52Backend.updateOrder(id, { status: 'preparing', kitchenStatus: 'preparing' });
    if (button.dataset.action === 'ready') await H52Backend.updateOrder(id, { status: 'ready', kitchenStatus: 'ready' });
    if (button.dataset.action === 'delivered') await H52Backend.updateOrder(id, { status: 'delivered' });
    await refresh();
  });

  requireSession().catch(error => {
    $('#orders').innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  });
})();
