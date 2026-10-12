import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('JSON: autenticacion, roles, duplicados concurrentes, precios y persistencia', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'h52-test-'));
  let child;
  async function start() {
    child = spawn(process.execPath, ['server.mjs'], {cwd: new URL('.', import.meta.url), env: {...process.env, PORT: '18987', H52_DATA_DIR: dir, H52_WAITER_PASSWORD: 'test-waiter', H52_KITCHEN_PASSWORD: 'test-kitchen'}, stdio: ['ignore', 'pipe', 'pipe']});
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => {throw new Error('El servidor no inicio.');})]);
  }
  async function stop() {const done = once(child, 'exit'); child.kill(); await done;}
  async function request(path, method = 'GET', data, cookie) {
    const response = await fetch('http://127.0.0.1:18987/api' + path, {method, headers: {'Content-Type': 'application/json', ...(cookie ? {Cookie: cookie} : {})}, body: data ? JSON.stringify(data) : undefined});
    return {status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0]};
  }
  try {
    await start();
    assert.equal((await request('/orders')).status, 401);
    const waiter = await request('/login', 'POST', {role: 'waiter', password: 'test-waiter'});
    const kitchen = await request('/login', 'POST', {role: 'kitchen', password: 'test-kitchen'});
    assert.equal(waiter.status, 200); assert.equal(kitchen.status, 200);
    const input = {clientOrderId: 'same-id', tableNumber: '8', items: [{productId: '1', quantity: 2, unitPrice: 1, extraIds: ['salsa-especial-h52'], notes: 'Bien cocida'}]};
    const results = await Promise.all([request('/orders', 'POST', input), request('/orders', 'POST', input)]);
    assert.ok(results.every(r => r.status === 201));
    const rows = (await request('/orders', 'GET', null, waiter.cookie)).data;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].items[0].unitPrice, 16200);
    assert.equal(rows[0].items[0].notes, 'Bien cocida');
    assert.equal((await request('/orders', 'GET', null, kitchen.cookie)).data.length, 0);
    const path = '/orders/' + rows[0].id;
    assert.equal((await request(path, 'PATCH', {status: 'ready'}, waiter.cookie)).status, 409);
    assert.equal((await request(path, 'PATCH', {status: 'sent_to_kitchen'}, kitchen.cookie)).status, 409);
    assert.equal((await request(path, 'PATCH', {staffNotes: 'Sale todo junto'}, kitchen.cookie)).status, 400);
    const edits = await Promise.all([
      request(path, 'PATCH', {staffNotes: 'Sale todo junto', priority: 'urgent', expectedRevision: 0}, waiter.cookie),
      request(path, 'PATCH', {staffNotes: 'Otra indicacion', expectedRevision: 0}, waiter.cookie)
    ]);
    assert.deepEqual(edits.map(r=>r.status).sort(), [200,409]);
    assert.equal((await request(path, 'PATCH', {totals: {total: 1}}, waiter.cookie)).status, 400);
    assert.equal((await request(path, 'PATCH', {status: 'sent_to_kitchen'}, waiter.cookie)).status, 200);
    assert.equal((await request(path, 'PATCH', {status: 'preparing'}, kitchen.cookie)).status, 200);
    assert.equal((await request(path, 'PATCH', {preparedItems: [99]}, kitchen.cookie)).status, 400);
    assert.equal((await request(path, 'PATCH', {preparedItems: [0]}, waiter.cookie)).status, 400);
    assert.equal((await request(path, 'PATCH', {preparedItems: [0]}, kitchen.cookie)).status, 200);
    assert.equal((await request(path, 'PATCH', {status: 'ready'}, kitchen.cookie)).status, 200);
    assert.equal((await request(path, 'PATCH', {status: 'delivered'}, waiter.cookie)).status, 200);
    const saved = JSON.parse(await readFile(join(dir, 'orders.json'), 'utf8'))[0];
    assert.equal(saved.status, 'delivered');
    assert.ok(saved.history.some(entry => entry.status === 'ready' && entry.actor === 'kitchen'));
    assert.ok(saved.history.some(entry => entry.label === 'Indicaciones actualizadas'));
    assert.equal(saved.staffNotes, 'Sale todo junto');
    assert.equal(saved.priority, 'urgent');
    assert.equal(JSON.parse(await readFile(join(dir, 'orders.previous.json'), 'utf8'))[0].status, 'ready');
    const stream = await fetch('http://127.0.0.1:18987/api/events', {headers: {Cookie: waiter.cookie}, signal: AbortSignal.timeout(3000)});
    const reader = stream.body.getReader();
    assert.ok(new TextDecoder().decode((await reader.read()).value).includes('data:'));
    const extraOrder = request('/orders', 'POST', {...input, clientOrderId: 'another-id'});
    assert.ok(new TextDecoder().decode((await reader.read()).value).includes('data:'));
    await extraOrder;
    await request('/logout', 'POST', null, waiter.cookie);
    assert.equal((await reader.read()).done, true);
    assert.equal((await fetch('http://127.0.0.1:18987/private-data/orders.json')).status, 404);
    await stop(); await start();
    const login = await request('/login', 'POST', {role: 'waiter', password: 'test-waiter'});
    assert.equal((await request('/orders', 'GET', null, login.cookie)).data.find(o=>o.id===rows[0].id).status, 'delivered');
  } finally {if (child && child.exitCode === null) await stop(); await rm(dir, {recursive: true, force: true});}
});
