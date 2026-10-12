import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({structuredClone,document:{addEventListener(){}}});
vm.runInContext(fs.readFileSync(new URL('../editor-categories.js',import.meta.url),'utf8'),context);
const source={catalog:{categories:[{id:'a',name:'A'},{id:'b',name:'B'}],products:[{id:'p',category:'A',classification:{categoryId:'a'}}]},design:{homeSections:[{categoryId:'a',productIds:['p']}]}};
test('Categorias: mueve productos y secciones sin perder datos ni mutar origen',()=>{
  const next=context.editorRemoveCategory(source,'a','b');
  assert.equal(next.catalog.products[0].classification.categoryId,'b');
  assert.equal(next.catalog.products[0].category,'B');
  assert.equal(next.design.homeSections[0].categoryId,'b');
  assert.equal(next.design.homeSections[0].productIds[0],'p');
  assert.equal(next.catalog.categories.length,1);
  assert.equal(source.catalog.products[0].classification.categoryId,'a');
});
test('Categorias: exige destino valido y conserva ultima categoria',()=>{
  assert.throws(()=>context.editorRemoveCategory(source,'a','a'));
  assert.throws(()=>context.editorRemoveCategory(source,'a','missing'));
  assert.throws(()=>context.editorRemoveCategory({catalog:{categories:[{id:'a'}],products:[]},design:{homeSections:[]}},'a',''));
});
