(function () {
  const config = window.H52_BACKEND || {};
  const hasConfig = Boolean(config.enabled && config.supabaseUrl && config.supabasePublishableKey && window.supabase);
  const client = hasConfig ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
  const restaurantId = config.restaurantId || 'h52';
  const localKey = `h52_orders_${restaurantId}`;

  const localRead = () => {
    try { return JSON.parse(localStorage.getItem(localKey)) || []; } catch { return []; }
  };
  const localWrite = orders => localStorage.setItem(localKey, JSON.stringify(orders));
  const nowIso = () => new Date().toISOString();
  const cryptoId = () => crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function normalizeOrder(row) {
    return {
      id: row.id,
      clientOrderId: row.client_order_id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      items: row.items || [],
      totals: row.totals || {},
      customerNotes: row.customer_notes || '',
      status: row.status || 'new',
      kitchenStatus: row.kitchen_status || 'waiting',
      sentToKitchenAt: row.sent_to_kitchen_at,
      createdAt: row.created_at || nowIso(),
      updatedAt: row.updated_at || nowIso()
    };
  }

  function toRow(order) {
    return {
      restaurant_id: restaurantId,
      client_order_id: order.clientOrderId,
      table_number: String(order.tableNumber || ''),
      items: order.items,
      totals: order.totals,
      customer_notes: order.customerNotes || '',
      status: order.status || 'new',
      kitchen_status: order.kitchenStatus || 'waiting'
    };
  }

  async function createOrder(order) {
    const payload = {...order, clientOrderId: order.clientOrderId || cryptoId()};
    if (client) {
      const { data, error } = await client.from('h52_orders').insert(toRow(payload)).select().single();
      if (error) {
        if (error.code === '23505') return { ok: true, duplicate: true };
        throw error;
      }
      return { ok: true, order: normalizeOrder(data) };
    }
    const orders = localRead();
    if (orders.some(item => item.clientOrderId === payload.clientOrderId)) return { ok: true, duplicate: true };
    const local = { ...payload, id: cryptoId(), restaurantId, createdAt: nowIso(), updatedAt: nowIso() };
    localWrite([local, ...orders]);
    window.dispatchEvent(new CustomEvent('h52-local-orders'));
    return { ok: true, order: local };
  }

  async function listOrders() {
    if (client) {
      const { data, error } = await client
        .from('h52_orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data.map(normalizeOrder);
    }
    return localRead();
  }

  async function updateOrder(id, patch) {
    const mapped = {};
    if (patch.status) mapped.status = patch.status;
    if (patch.kitchenStatus) mapped.kitchen_status = patch.kitchenStatus;
    if (patch.sentToKitchenAt !== undefined) mapped.sent_to_kitchen_at = patch.sentToKitchenAt;
    if (client) {
      const { data, error } = await client.from('h52_orders').update(mapped).eq('id', id).select().single();
      if (error) throw error;
      return normalizeOrder(data);
    }
    const orders = localRead().map(order => order.id === id ? { ...order, ...patch, updatedAt: nowIso() } : order);
    localWrite(orders);
    window.dispatchEvent(new CustomEvent('h52-local-orders'));
    return orders.find(order => order.id === id);
  }

  function subscribe(onChange) {
    if (client) {
      const channel = client.channel(`h52-orders-${restaurantId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'h52_orders', filter: `restaurant_id=eq.${restaurantId}` }, onChange)
        .subscribe();
      return () => client.removeChannel(channel);
    }
    window.addEventListener('h52-local-orders', onChange);
    return () => window.removeEventListener('h52-local-orders', onChange);
  }

  async function signIn(email, password) {
    if (!client) throw new Error('Supabase no está configurado.');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  async function getSession() {
    if (!client) return { configured: false, session: null };
    const { data } = await client.auth.getSession();
    return { configured: true, session: data.session };
  }

  window.H52Backend = { configured: hasConfig, restaurantId, createOrder, listOrders, updateOrder, subscribe, signIn, signOut, getSession };
})();
