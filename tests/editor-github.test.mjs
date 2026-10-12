import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const payload={design:JSON.parse(fs.readFileSync(new URL('config/design.json',root))),catalog:JSON.parse(fs.readFileSync(new URL('config/products.json',root)))};
function setup({race=false}={}) {
  const calls=[], context={window:{},Intl,structuredClone,AbortSignal,TextDecoder,Uint8Array,atob};
  vm.runInNewContext(fs.readFileSync(new URL('config-utils.js',root),'utf8'),context);context.H52Data=context.window.H52Data;
  vm.runInNewContext(fs.readFileSync(new URL('editor-github.js',root),'utf8'),context);
  const base='https://api.github.com/repos/Maxischamis/h52-mejorado';
  const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
  const fetcher=async(url,options)=>{
    const path=url.slice(base.length);calls.push({path,...options});
    if(path==='')return response({permissions:{push:true}});
    if(path==='/git/ref/heads/main')return response({object:{sha:'head-1'}});
    if(path.startsWith('/contents/'))return response({encoding:'base64',content:Buffer.from(JSON.stringify(path.includes('design')?payload.design:payload.catalog)).toString('base64')});
    if(path==='/git/commits/head-1')return response({tree:{sha:'base-tree'}});
    if(path==='/git/trees')return response({sha:'new-tree'});
    if(path==='/git/commits')return response({sha:'commit-2'});
    if(path==='/git/refs/heads/main')return race?response({},422):response({object:{sha:'commit-2'}});
    throw new Error('Unexpected endpoint '+path);
  };
  return {calls,storage:context.window.H52GithubEditor.create({owner:'Maxischamis',repository:'h52-mejorado',branch:'main'},fetcher)};
}
test('GitHub: lee JSON con acentos, limita consultas y exige conexion para escribir',async()=>{
  const {storage,calls}=setup();
  const menu=await storage.getMenu();assert.equal(menu.revision,'head-1');assert.equal(menu.design.hero.description,payload.design.hero.description);
  await storage.getMenu();assert.equal(calls.length,3);
  assert.ok(calls.every(c=>!c.headers.Authorization));
  await assert.rejects(storage.saveMenu({...payload,expectedRevision:'head-1'}),error=>error.status===401);
});
test('GitHub: guarda ambos JSON y copia offline en un commit, sin forzar la rama',async()=>{
  const {storage,calls}=setup();await storage.signIn('','test-only-token');
  const saved=await storage.saveMenu({...payload,expectedRevision:'head-1'});assert.equal(saved.revision,'commit-2');
  const tree=JSON.parse(calls.find(c=>c.path==='/git/trees').body);
  assert.deepEqual(tree.tree.map(row=>row.path),['config/design.json','config/products.json','assets/offline-data.js']);
  assert.equal(tree.base_tree,'base-tree');
  assert.equal(JSON.parse(tree.tree[0].content).brand.name,'H52');
  const ref=JSON.parse(calls.find(c=>c.path==='/git/refs/heads/main').body);assert.equal(ref.force,false);
  await storage.signOut();assert.equal((await storage.getSession()).session,null);
});
test('GitHub: rechaza version vieja y carrera entre editores sin sobrescribir',async()=>{
  const first=setup();await first.storage.signIn('','test-only-token');
  await assert.rejects(first.storage.saveMenu({...payload,expectedRevision:'old'}),error=>error.status===409);
  assert.ok(!first.calls.some(c=>c.method==='POST'));
  const second=setup({race:true});await second.storage.signIn('','test-only-token');
  await assert.rejects(second.storage.saveMenu({...payload,expectedRevision:'head-1'}),error=>error.status===409);
  assert.equal(JSON.parse(second.calls.find(c=>c.path==='/git/refs/heads/main').body).force,false);
});
