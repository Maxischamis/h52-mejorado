(function () {
  const base = (window.H52_BACKEND?.apiUrl || '').replace(/\/$/, '');
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {response = await fetch(base + '/api' + path, {credentials: 'include', ...options, signal: controller.signal, headers: {'Content-Type': 'application/json'}});}
    catch (error) {throw new Error(error.name === 'AbortError' ? 'El servidor tarda en responder. Podes reintentar sin duplicar el pedido.' : 'No se pudo conectar. Revisa la conexion e intenta nuevamente.');}
    finally {clearTimeout(timeout);}
    let data;
    try {data = await response.json();} catch {throw new Error('Falta conectar el servidor de pedidos JSON.');}
    if (!response.ok) {
      const error = new Error(data.error || 'No se pudo conectar al servidor.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  window.H52Backend = {
    configured: Boolean(base || !location.hostname.endsWith("github.io")),
    async createOrder(order) {
      const fingerprint = JSON.stringify({...order, clientOrderId: null});
      let pending;
      try {pending = JSON.parse(localStorage.getItem('h52-pending-order'));} catch {}
      if (pending?.fingerprint !== fingerprint) pending = {fingerprint, id: order.clientOrderId};
      localStorage.setItem('h52-pending-order', JSON.stringify(pending));
      const result = await request('/orders', {method: 'POST', body: JSON.stringify({...order, clientOrderId: pending.id})});
      localStorage.removeItem('h52-pending-order');
      return result;
    },
    listOrders: () => request('/orders'),
    getMenu: () => request('/menu'),
    saveMenu: (payload) => request('/menu', {method: 'PATCH', body: JSON.stringify(payload)}),
    updateOrder: (id, patch) => request('/orders/' + encodeURIComponent(id), {method: 'PATCH', body: JSON.stringify(patch)}),
    signIn: (email, password) => request('/login', {method: 'POST', body: JSON.stringify({password, role: document.body.dataset.role})}),
    signOut: () => request('/logout', {method: 'POST'}),
    getSession: async () => ({configured: true, session: (await request('/session')).session}),
    subscribe(onChange) {
      const events = new EventSource(base + '/api/events', {withCredentials: true});
      events.onmessage = onChange;
      events.onopen = () => window.dispatchEvent(new CustomEvent('h52-connection', {detail: true}));
      events.onerror = () => window.dispatchEvent(new CustomEvent('h52-connection', {detail: false}));
      return () => events.close();
    }
  };
})();
