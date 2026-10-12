export const labels = {new: 'Nuevo', sent_to_kitchen: 'En espera', preparing: 'Preparando', ready: 'Listo para retirar', delivered: 'Entregado', cancelled: 'Cancelado'};
export const activeStatuses = ['new', 'sent_to_kitchen', 'preparing', 'ready'];
export const isActive = order => activeStatuses.includes(order.status);
export function ageMinutes(order, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(order.sentToKitchenAt || order.createdAt).getTime()) / 60000));
}
export function visibleOrders(orders, {view = 'orders', status = '', query = '', urgentOnly = false, sort = 'oldest', overdueMinutes = 15} = {}, now = Date.now()) {
  const term = query.trim().toLocaleLowerCase('es');
  return orders.filter(order => {
    const matchesView = view === 'history' ? !isActive(order) : isActive(order);
    const matchesText = [order.tableNumber, order.id.slice(0, 6), ...order.items.map(item => item.name)].some(value => String(value).toLocaleLowerCase('es').includes(term));
    return matchesView && (!status || order.status === status) && matchesText && (!urgentOnly || order.priority === 'urgent' || ageMinutes(order, now) >= overdueMinutes);
  }).sort((a, b) => {
    if (sort === 'table') return String(a.tableNumber).localeCompare(String(b.tableNumber), 'es', {numeric: true});
    if (sort === 'priority' && a.priority !== b.priority) return a.priority === 'urgent' ? -1 : b.priority === 'urgent' ? 1 : 0;
    return (new Date(a.createdAt) - new Date(b.createdAt)) * (sort === 'newest' ? -1 : 1);
  });
}
export function tableGroups(orders, tableNumbers = []) {
  const names = [...new Set([...tableNumbers.map(String), ...orders.filter(isActive).map(o => String(o.tableNumber))])];
  return names.sort((a,b) => a.localeCompare(b, 'es', {numeric: true})).map(number => {
    const active = orders.filter(o => isActive(o) && String(o.tableNumber) === number);
    const status = ['ready', 'new', 'preparing', 'sent_to_kitchen'].find(value => active.some(o => o.status === value)) || 'free';
    return {number, orders: active, status, total: active.reduce((sum, o) => sum + (o.totals?.total || 0), 0)};
  });
}
export function summary(orders, now = Date.now()) {
  const active = orders.filter(isActive);
  const today = new Date(now).toLocaleDateString('en-CA');
  const delivered = orders.filter(o => o.status === 'delivered' && new Date(o.updatedAt).toLocaleDateString('en-CA') === today);
  return {active: active.length, new: active.filter(o => o.status === 'new').length, kitchen: active.filter(o => ['sent_to_kitchen', 'preparing'].includes(o.status)).length, ready: active.filter(o => o.status === 'ready').length, tables: new Set(active.map(o => String(o.tableNumber))).size, delivered: delivered.length, revenue: delivered.reduce((sum, o) => sum + (o.totals?.total || 0), 0)};
}
