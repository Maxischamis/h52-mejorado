import http from 'node:http';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {resolve, extname, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, randomBytes, timingSafeEqual} from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.H52_DATA_DIR || resolve(root, 'private-data'));
const keys = {waiter: process.env.H52_WAITER_PASSWORD, kitchen: process.env.H52_KITCHEN_PASSWORD};
if (!keys.waiter || !keys.kitchen) throw new Error('Configurar H52_WAITER_PASSWORD y H52_KITCHEN_PASSWORD.');
await mkdir(dataDir, {recursive: true});
const filename = resolve(dataDir, 'orders.json');
let orders;
try {orders = JSON.parse(await readFile(filename, 'utf8'));}
catch (error) {if (error.code !== 'ENOENT') throw error; orders = [];}
if (!Array.isArray(orders)) throw new Error('orders.json debe ser un array.');
const sessions = new Map(), streams = new Set(), limits = new Map();
let queue = Promise.resolve();
const transitions = {waiter: {new: ['sent_to_kitchen', 'cancelled'], ready: ['delivered']}, kitchen: {sent_to_kitchen: ['preparing'], preparing: ['ready']}};
function json(res, status, data) {res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));}
function session(req) {
  const token = /(?:^|;\s*)h52_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  const value = sessions.get(token);
  return value?.expires > Date.now() ? value : null;
}
async function body(req) {
  let value = '';
  for await (const chunk of req) {value += chunk; if (Buffer.byteLength(value) > 65536) throw new Error('Pedido demasiado grande.');}
  return JSON.parse(value || '{}');
}
function throttle(req, bucket, maximum) {
  const id = req.socket.remoteAddress + ':' + bucket;
  const current = limits.get(id) || {count: 0, until: Date.now() + 60000};
  if (current.until < Date.now()) {current.count = 0; current.until = Date.now() + 60000;}
  limits.set(id, current); return ++current.count <= maximum;
}
function mutate(fn) {
  const result = queue.then(async () => {
    const next = structuredClone(orders), value = fn(next);
    await writeFile(filename + '.tmp', JSON.stringify(next, null, 2), {mode: 0o600});
    await rename(filename + '.tmp', filename);
    orders = next;
    for (const stream of streams) stream.write('data: {}\n\n');
    return value;
  });
  queue = result.catch(() => {}); return result;
}
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const origin = req.headers.origin;
    if (origin && !['http://' + req.headers.host, 'https://' + req.headers.host, process.env.H52_ALLOWED_ORIGIN].includes(origin)) return json(res, 403, {error: 'Origen no permitido.'});
    if (origin) {res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin');}
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') {res.writeHead(204, {'Access-Control-Allow-Methods': 'GET, POST, PATCH', 'Access-Control-Allow-Headers': 'Content-Type'}); return res.end();}
    const user = session(req);
    if (path === '/api/session' && req.method === 'GET') return json(res, 200, {session: user ? {role: user.role} : null});
    if (path === '/api/login' && req.method === 'POST') {
      if (!throttle(req, 'login', 10)) return json(res, 429, {error: 'Esperar un minuto antes de intentar nuevamente.'});
      const input = await body(req), expected = Buffer.from(keys[input.role] || ''), supplied = Buffer.from(String(input.password || ''));
      if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return json(res, 401, {error: 'Clave incorrecta.'});
      const token = randomBytes(32).toString('hex');
      sessions.set(token, {role: input.role, expires: Date.now() + 43200000});
      res.setHeader('Set-Cookie', 'h52_session=' + token + '; HttpOnly; Path=/api; Max-Age=43200; SameSite=Lax' + (process.env.H52_SECURE_COOKIE === 'true' ? '; Secure' : ''));
      return json(res, 200, {ok: true});
    }
    if (path === '/api/logout' && req.method === 'POST') {
      sessions.delete(/h52_session=([^;]+)/.exec(req.headers.cookie || '')?.[1]);
      res.setHeader('Set-Cookie', 'h52_session=; HttpOnly; Path=/api; Max-Age=0; SameSite=Lax'); return json(res, 200, {ok: true});
    }
    if (path === '/api/orders' && req.method === 'POST') {
      if (!throttle(req, 'orders', 30)) return json(res, 429, {error: 'Demasiados pedidos. Esperar un minuto.'});
      const input = await body(req);
      if (typeof input.clientOrderId !== 'string' || !input.clientOrderId || input.clientOrderId.length > 100 || !String(input.tableNumber || '').trim() || String(input.tableNumber).length > 30 || !Array.isArray(input.items) || !input.items.length || input.items.length > 60) return json(res, 400, {error: 'Mesa o productos invalidos.'});
      const catalog = JSON.parse(await readFile(resolve(root, 'config/products.json'), 'utf8'));
      const items = input.items.map(item => {
        const product = catalog.products.find(p => String(p.id) === String(item.productId));
        if (!product || product.available === false || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Producto o cantidad invalida.');
        const extraIds = Array.isArray(item.extraIds) ? [...new Set(item.extraIds)] : [];
        const extras = extraIds.map(id => product.extras?.find(e => String(e.id) === String(id) && e.available));
        if (extras.some(e => !e)) throw new Error('Extra invalido.');
        const unitPrice = product.price + extras.reduce((sum, e) => sum + e.price, 0);
        return {productId: product.id, name: product.name, quantity: item.quantity, unitPrice, total: unitPrice * item.quantity, notes: String(item.notes || '').slice(0, 1000), without: Array.isArray(item.without) ? item.without.map(String).slice(0, 20) : [], extras: extras.map(e => e.name)};
      });
      const design = JSON.parse(await readFile(resolve(root, 'config/design.json'), 'utf8'));
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const service = Math.round(subtotal * design.order.servicePercent) / 100;
      const totals = {subtotal, service, total: subtotal + service};
      const result = await mutate(next => {
        const existing = next.find(o => o.clientOrderId === input.clientOrderId);
        if (existing) return {ok: true, duplicate: true, id: existing.id};
        const now = new Date().toISOString();
        const order = {id: randomUUID(), clientOrderId: input.clientOrderId, tableNumber: String(input.tableNumber).trim(), items, totals, customerNotes: String(input.customerNotes || '').slice(0, 1000), status: 'new', kitchenStatus: 'waiting', createdAt: now, updatedAt: now};
        next.unshift(order); return {ok: true, id: order.id};
      }); return json(res, 201, result);
    }
    if (path.startsWith('/api/')) {
      if (!user) return json(res, 401, {error: 'Ingresar con la clave del equipo.'});
      if (path === '/api/orders' && req.method === 'GET') return json(res, 200, user.role === 'kitchen' ? orders.filter(o => ['sent_to_kitchen', 'preparing', 'ready'].includes(o.status)) : orders);
      if (path === '/api/events' && req.method === 'GET') {
        res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
        res.write('data: {}\n\n'); streams.add(res);
        const heartbeat = setInterval(() => {if (user.expires <= Date.now()) res.end(); else res.write(': heartbeat\n\n');}, 15000);
        req.on('close', () => {streams.delete(res); clearInterval(heartbeat);}); return;
      }
      if (path.startsWith('/api/orders/') && req.method === 'PATCH') {
        const patch = await body(req);
        const result = await mutate(next => {
          const row = next.find(o => o.id === path.split('/').pop());
          if (!row) throw new Error('Pedido inexistente.');
          if (!transitions[user.role]?.[row.status]?.includes(patch.status)) throw new Error('Estado incompatible. Actualizar la pantalla.');
          row.status = patch.status; row.kitchenStatus = patch.status === 'preparing' ? 'preparing' : patch.status === 'ready' ? 'ready' : 'waiting'; row.updatedAt = new Date().toISOString();
          if (patch.status === 'sent_to_kitchen') row.sentToKitchenAt = row.updatedAt;
          return row;
        }); return json(res, 200, result);
      }
      return json(res, 404, {error: 'Ruta inexistente.'});
    }
    const file = path === '/' ? 'index.html' : decodeURIComponent(path).slice(1);
    if (!(file === 'index.html' || /^(mozo|cocina|editor)\.html$/.test(file) || /^[\w-]+\.(js|css)$/.test(file) || /^(assets|config)\/[\w./-]+\.(js|json|png|jpg|jpeg|webp|svg|woff2|ico)$/.test(file)) || file.includes('..')) return json(res, 404, {error: 'Archivo inexistente.'});
    const content = await readFile(resolve(root, file));
    const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp'};
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'}); res.end(content);
  } catch (error) {json(res, error.code === 'ENOENT' ? 404 : 400, {error: error.message});}
});
setInterval(() => {for (const [id, value] of sessions) if (value.expires <= Date.now()) sessions.delete(id); for (const [id, value] of limits) if (value.until < Date.now()) limits.delete(id);}, 60000).unref();
server.listen(Number(process.env.PORT || 8787), '0.0.0.0', () => console.log('H52 disponible en http://localhost:' + (process.env.PORT || 8787)));
