import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const context={window:{},Intl,structuredClone,document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(new URL('config-utils.js',root),'utf8'),context);
vm.runInNewContext(fs.readFileSync(new URL('editor-create.js',root),'utf8'),context);
const design=JSON.parse(fs.readFileSync(new URL('config/design.json',root)));
const catalog=JSON.parse(fs.readFileSync(new URL('config/products.json',root)));
const input={categoryId:'lomos',name:' Lomo nuevo ',price:'18000',description:'Con papas'};
test('Alta: categoria elegida, nombre limpio y defaults validos sin mutar catalogo',()=>{
  const p=context.editorNewProduct(catalog,input,'nuevo');
  assert.equal(p.classification.categoryId,'lomos');assert.equal(p.name,'Lomo nuevo');assert.equal(p.price,18000);
  assert.equal(p.available,true);assert.equal(p.customization.allowNote,true);
  assert.equal(p.preparationMinutes,null);assert.equal(catalog.products.length,177);
  assert.doesNotThrow(()=>context.window.H52Data.validate(design,{...catalog,products:[...catalog.products,p]}));
});
test('Alta: exige categoria, nombre y precio y rechaza fotos inseguras',()=>{
  for(const patch of [{categoryId:''},{name:'  '},{price:''},{price:'-1'},{image:'javascript:alert(1)'}])assert.throws(()=>context.editorNewProduct(catalog,{...input,...patch},'nuevo'));
});
test('Alta: conserva foto, personalizacion y extras validos',()=>{
  const p=context.editorNewProduct(catalog,{...input,photoId:'1',removable:'Papas\nCebolla\nPapas',ingredients:'Carne, Queso',allergens:'Leche',extras:[{name:'Cheddar',price:'500'}],available:false,featured:true},'nuevo');
  assert.equal(p.image,catalog.products[0].image);assert.equal(JSON.stringify(p.imageCrop),JSON.stringify(catalog.products[0].imageCrop));
  assert.equal(JSON.stringify(p.customization.removable),JSON.stringify(['Papas','Cebolla']));
  assert.equal(p.extras[0].price,500);assert.equal(p.available,false);assert.equal(p.featured,true);
  assert.doesNotThrow(()=>context.window.H52Data.validate(design,{...catalog,products:[...catalog.products,p]}));
  assert.throws(()=>context.editorNewProduct(catalog,{...input,extras:[{name:'',price:'500'}]},'nuevo'),/extra/);
});
