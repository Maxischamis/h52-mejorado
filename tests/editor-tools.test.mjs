import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const context={window:{},Intl,structuredClone,document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(new URL('config-utils.js',root),'utf8'),context);
context.H52Data=context.window.H52Data;
vm.runInNewContext(fs.readFileSync(new URL('editor-tools.js',root),'utf8'),context);
const payload={design:JSON.parse(fs.readFileSync(new URL('config/design.json',root))),catalog:JSON.parse(fs.readFileSync(new URL('config/products.json',root)))};
test('Editor: mesas numericas y nombres, sin duplicados normalizados',()=>{
  assert.equal(JSON.stringify(context.editorTables('1, 2, Terraza')),JSON.stringify([1,2,'Terraza']));
  assert.throws(()=>context.editorTables('1, 01'),/repetidas/);
  assert.throws(()=>context.editorTables(' , '),/invalidas/);
  assert.throws(()=>context.editorTables('a'.repeat(31)),/invalidas/);
});
test('Editor: precios por lote solo cambian seleccion y no mutan el original',()=>{
  const ids=new Set([payload.catalog.products[0].id]);
  const next=context.editorBulk(payload,ids,'percent',10);
  assert.equal(next.catalog.products[0].price,16500);
  assert.equal(payload.catalog.products[0].price,15000);
  assert.equal(next.catalog.products[1].price,payload.catalog.products[1].price);
  assert.throws(()=>context.editorBulk(payload,ids,'percent',-101),/invalido/);
  assert.throws(()=>context.editorBulk(payload,ids,'amount',-99999),/Precio/);
});
test('Editor: disponibilidad y destacado por lote conservan precios',()=>{
  const ids=new Set([payload.catalog.products[0].id]);
  const next=context.editorBulk(payload,ids,'unavailable',0);
  assert.equal(next.catalog.products[0].available,false);
  assert.equal(next.catalog.products[0].price,15000);
  assert.equal(context.editorBulk(payload,ids,'featured',0).catalog.products[0].featured,true);
  assert.throws(()=>context.editorBulk(payload,ids,'unknown',0),/invalida/);
});
