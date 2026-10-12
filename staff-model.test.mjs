import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tableGroups, visibleOrders, ageMinutes, summary} from './staff-model.js';

const now = Date.parse('2026-10-12T14:00:00Z');
const order = (id, table, state, minutes, more = {}) => ({id, tableNumber: table, status: state, createdAt: new Date(now-minutes*60000).toISOString(), updatedAt: new Date(now).toISOString(), items:[{name:'Hamburguesa Bacon',quantity:2}], totals:{total:100}, ...more});
const rows = [order('aaaaaa',1,'preparing',20),order('bbbbbb','1','ready',5),order('cccccc',2,'new',10),order('dddddd',3,'delivered',30),order('eeeeee',4,'cancelled',40)];
test('Mesas agrupa numeros y textos, prioriza listos y conserva mesas vacias',()=>{
  const groups=tableGroups(rows,[1,2,3,4,5]);
  assert.equal(groups.length,5);assert.equal(groups[0].orders.length,2);assert.equal(groups[0].status,'ready');assert.equal(groups[0].total,200);assert.equal(groups[2].status,'free');
});
test('Busqueda, historial y urgencias respetan estado, espera y prioridad',()=>{
  assert.deepEqual(visibleOrders(rows,{view:'history'}).map(o=>o.id),['eeeeee','dddddd']);
  assert.equal(visibleOrders(rows,{query:'bacon'}).length,3);
  assert.equal(visibleOrders(rows,{status:'ready',query:'1'}).length,1);
  assert.deepEqual(visibleOrders(rows,{urgentOnly:true},now).map(o=>o.id),['aaaaaa']);
  assert.equal(visibleOrders([order('z',5,'new',0,{priority:'urgent'})],{urgentOnly:true},now).length,1);
  assert.equal(ageMinutes(order('x',1,'new',-2),now),0);
});
test('La espera de cocina empieza al enviar y el resumen no suma cancelados',()=>{
  assert.equal(ageMinutes(order('x',1,'preparing',60,{sentToKitchenAt:new Date(now-120000).toISOString()}),now),2);
  const stats=summary(rows,now);assert.equal(stats.active,3);assert.equal(stats.tables,2);assert.equal(stats.ready,1);assert.equal(stats.delivered,1);assert.equal(stats.revenue,100);
});
