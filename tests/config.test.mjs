import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const design=JSON.parse(fs.readFileSync(new URL('config/design.json',root)));
const catalog=JSON.parse(fs.readFileSync(new URL('config/products.json',root)));
const context={window:{},Intl};
vm.runInNewContext(fs.readFileSync(new URL('config-utils.js',root),'utf8'),context);
const validate=context.window.H52Data.validate;
test('Las nuevas fotos son locales y cada recorte está dentro de la imagen',()=>{
  assert.equal(catalog.products.filter(p=>p.imageIllustrative).length,177);
  assert.ok(new Set(catalog.products.map(p=>JSON.stringify([p.image,p.imageCrop]))).size>=35);
  const changed=structuredClone(catalog);changed.products[0].imageCrop=[.9,0,.5,.5];
  assert.throws(()=>validate(design,changed),/recorte/);
});
test('La configuración real y todas las fotos locales existen',()=>{
  validate(design,catalog);
  for(const p of catalog.products)if(p.image.startsWith('assets/'))assert.ok(fs.existsSync(new URL(p.image,root)),p.id);
  assert.ok(fs.existsSync(new URL(design.hero.image,root)));
});
test('Una categoría nueva funciona sin cambiar código',()=>{
  const changed=structuredClone(catalog);
  changed.categories.push({id:'postres',name:'Postres',icon:'cake',order:6});
  changed.products[0].classification.categoryId='postres';
  assert.doesNotThrow(()=>validate(design,changed));
});
test('No acepta referencias de categoría inexistentes',()=>{
  const changed=structuredClone(catalog);changed.products[0].classification.categoryId='missing';
  assert.throws(()=>validate(design,changed),/Categoría inexistente/);
});
test('No acepta precios negativos ni IDs duplicados',()=>{
  const changed=structuredClone(catalog);changed.products[0].price=-1;
  assert.throws(()=>validate(design,changed),/Precio inválido/);
  changed.products[0].price=100;changed.products.push(changed.products[0]);
  assert.throws(()=>validate(design,changed),/duplicado/);
});
test('No acepta colores inválidos ni un servicio fuera de rango',()=>{
  const changed=structuredClone(design);changed.theme.accent='red';
  assert.throws(()=>validate(changed,catalog),/Color inválido/);
  changed.theme.accent='#22aabb';changed.order.servicePercent=101;
  assert.throws(()=>validate(changed,catalog),/servicePercent/);
});
test('La copia offline coincide con los dos JSON',()=>{
  const offline={window:{}};
  vm.runInNewContext(fs.readFileSync(new URL('assets/offline-data.js',root),'utf8'),offline);
  assert.equal(JSON.stringify(offline.window.H52_OFFLINE_DATA),JSON.stringify({design,catalog}));
});
test('Rechaza clasificaciones y alérgenos con datos mal formados',()=>{
  const changed=structuredClone(catalog);changed.products[0].classification.tags=[null];
  assert.throws(()=>validate(design,changed),/lista de textos/);
  changed.products[0].classification.tags=[];changed.products[0].allergens=[42];
  assert.throws(()=>validate(design,changed),/deben ser textos/);
});
test('Rechaza porcentajes de alcohol imposibles y orden inválido',()=>{
  const changed=structuredClone(catalog);changed.products[0].alcoholPercent=101;
  assert.throws(()=>validate(design,changed),/superar 100/);
  changed.products[0].alcoholPercent=null;changed.products[0].order='primero';
  assert.throws(()=>validate(design,changed),/order/);
});
test('La navegación inferior no existe en el documento',()=>{
  const html=fs.readFileSync(new URL('index.html',root),'utf8');
  assert.ok(!html.includes('class="bottom-nav"'));
  assert.ok(html.includes('id="mobile-menu"'));
});
test('Una sección acepta 0 para mostrar todos y rechaza números negativos',()=>{
  const changed=structuredClone(design);changed.homeSections[0].limit=0;
  assert.doesNotThrow(()=>validate(changed,catalog));changed.homeSections[0].limit=-1;
  assert.throws(()=>validate(changed,catalog),/Sección/);
});
test('Las opciones para quitar deben ser textos únicos',()=>{
  const changed=structuredClone(catalog);changed.products[0].customization={removable:['Papas','Papas'],allowNote:true};
  assert.throws(()=>validate(design,changed),/customization/);
});
test('La carta importada contiene 177 productos y 13 tipos',()=>{assert.equal(catalog.products.length,177);assert.equal(catalog.categories.length,13);assert.ok(catalog.products.every(p=>p.extras!==undefined));});
test('Adapta el formato de productos proporcionado sin perder extras',()=>{
  const raw={featuredComboId:1,products:[{id:1,name:'Prueba',description:'Descripción',ingredients:'Queso, cebolla',allergens:'Consultar',category:'Hamburguesas',price:1000,image:'https://example.com/1.jpg',available:true,extras:[{id:'x',name:'Extra',price:200,available:true}]}]};
  const result=validate(design,raw);assert.equal(result.catalog.products[0].id,'1');assert.equal(result.catalog.products[0].extras[0].price,200);assert.equal(result.catalog.products[0].featured,true);
});
