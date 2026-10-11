import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../order-utils.js',import.meta.url),'utf8'),context);
const order=context.window.H52Order;
const products=[{id:'burger',price:1000,available:true,customization:{removable:['Papas','Cebolla'],allowNote:true}}];
test('Versiones normales y sin papas son líneas distintas',()=>{
  const items=[];order.add(items,'burger',1);order.add(items,'burger',2,['Papas'],'Salsa aparte');
  assert.equal(items.length,2);assert.equal(order.quantity(items,'burger'),3);
  assert.equal(items[1].without[0],'Papas');assert.equal(items[1].note,'Salsa aparte');
});
test('Las personalizaciones idénticas se agrupan sin depender del orden',()=>{
  const items=[];order.add(items,'burger',1,['Cebolla','Papas']);order.add(items,'burger',2,['Papas','Cebolla']);
  assert.equal(items.length,1);assert.equal(items[0].quantity,3);
});
test('El límite es por producto, sumando todas sus versiones',()=>{
  const items=[];order.add(items,'burger',2,[],'',3);order.add(items,'burger',5,['Papas'],'',3);
  assert.equal(order.quantity(items,'burger'),3);assert.equal(items[1].quantity,1);
});
test('Migra pedidos anteriores y conserva personalizaciones al recargar',()=>{
  const migrated=order.normalize({burger:2},products,99);assert.equal(migrated[0].quantity,2);
  order.add(migrated,'burger',1,['Papas'],'Sin sal');
  assert.equal(JSON.stringify(order.normalize(JSON.parse(JSON.stringify(migrated)),products,99)),JSON.stringify(migrated));
});
test('Descarta productos inexistentes y opciones no permitidas',()=>{
  const items=order.normalize([{productId:'missing',quantity:1},{productId:'burger',quantity:1,without:['Papas','Inexistente'],note:'x'.repeat(500)}],products,99);
  assert.equal(items.length,1);assert.equal(items[0].without.length,1);assert.equal(items[0].note.length,400);
});
test('Quitar ingredientes no cambia el precio y el servicio es correcto',()=>{
  const items=[];order.add(items,'burger',2,['Papas']);
  assert.equal(JSON.stringify(order.totals(items,products,10)),JSON.stringify({subtotal:2000,service:200,total:2200}));
});
test('Los extras suman por unidad y no se mezclan con la versión normal',()=>{
  const ps=structuredClone(products);ps[0].extras=[{id:'papas',name:'Papas extra',price:300,available:true}];
  const items=[];order.add(items,'burger',2,[],'',99,['papas']);order.add(items,'burger',1);
  assert.equal(items.length,2);assert.equal(order.unitPrice(items[0],ps),1300);assert.equal(order.totals(items,ps,10).total,3960);
  assert.equal(order.normalize(items,ps,99)[0].extras[0],'papas');
});
