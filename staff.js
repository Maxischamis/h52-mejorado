import {labels, isActive, ageMinutes, visibleOrders, tableGroups, summary} from './staff-model.js';

const $ = selector => document.querySelector(selector);
const waiter = document.body.dataset.role === 'waiter';
const role = waiter ? 'waiter' : 'kitchen';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value || 0);
const icon = name => '<i data-lucide="' + name + '"></i>';
const clock = value => new Date(value).toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit'});
const shortId = order => '#' + order.id.slice(0, 6).toUpperCase();
const status = order => '<span class="status ' + esc(order.status) + '">' + esc(labels[order.status] || order.status) + '</span>';
let orders = [], products = [], tables = [], config = {overdueMinutes: 15, refreshSeconds: 30}, servicePercent = 10, maxQuantity = 99;
let view = waiter ? 'tables' : 'orders', unsubscribe, busy = false, loaded = false, selectedId, selectedTable, detailRevision, detailDirty = false, cancelId;
let draft = [], draftId = crypto.randomUUID(), audio, refreshGeneration = 0;
let soundEnabled = localStorage.getItem('h52-staff-sound') === 'true';
const icons = () => window.lucide?.createIcons();
const toast = text => {$('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => {$('#toast').hidden = true;}, 3500);};
function errorMessage(error) {$('#staff-error').hidden = false; $('#staff-error').textContent = error.message;}
function notes(item) {return [item.notes, ...(item.without || []).map(v => 'Sin ' + v), ...(item.extras || []).map(v => 'Extra: ' + v)].filter(Boolean).join(' · ');}
function beep() {
  if (!soundEnabled || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.frequency.setValueAtTime(740, audio.currentTime);
  oscillator.frequency.setValueAtTime(990, audio.currentTime + .12);
  gain.gain.setValueAtTime(.08, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .35);
  oscillator.start(); oscillator.stop(audio.currentTime + .35);
}
function empty(title = 'Todo al día', text = 'No hay pedidos en esta vista.') {return '<div class="empty">' + icon('circle-check') + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p></div>';}
function age(order) {
  const minutes = ageMinutes(order);
  return '<span class="order-time ' + (minutes >= config.overdueMinutes ? 'overdue' : '') + '">' + icon('clock') + minutes + ' min</span>';
}
function primaryAction(order) {
  const action = waiter ? {new: ['send','Enviar a cocina','arrow-right'], ready: ['delivered','Entregar','check']}[order.status] : {sent_to_kitchen:['preparing','Comenzar','flame'], preparing:['ready','Marcar listo','check']}[order.status];
  return action ? '<button class="primary" data-action="' + action[0] + '" data-id="' + esc(order.id) + '"' + (busy ? ' disabled' : '') + '>' + icon(action[2]) + action[1] + '</button>' : '';
}
function itemList(order, checkable = false) {
  return '<ul class="items">' + order.items.map((item, index) => {
    const done = order.preparedItems?.includes(index);
    const text = '<span class="qty">' + item.quantity + '</span><div><span class="item-name">' + esc(item.name) + '</span>' + (notes(item) ? '<p class="note">' + esc(notes(item)) + '</p>' : '') + '</div>';
    return '<li>' + (checkable ? '<button class="kitchen-check ' + (done ? 'done' : '') + '" data-item="' + index + '" data-id="' + esc(order.id) + '" aria-pressed="' + Boolean(done) + '"' + (busy ? ' disabled' : '') + '><span class="check">' + (done ? icon('check') : '') + '</span><span><span class="item-name">' + item.quantity + ' × ' + esc(item.name) + '</span>' + (notes(item) ? '<span class="note" style="display:block">' + esc(notes(item)) + '</span>' : '') + '</span></button>' : text) + (waiter ? '<span class="item-price">' + money(item.total) + '</span>' : '') + '</li>';
  }).join('') + '</ul>';
}
function orderCard(order) {
  return '<article class="order ' + (order.priority === 'urgent' ? 'urgent' : '') + '">' +
    '<header class="order-head"><div><div class="order-heading"><h2>Mesa ' + esc(order.tableNumber) + '</h2>' + status(order) + '</div><span class="order-number">' + shortId(order) + ' · ' + clock(order.createdAt) + '</span></div>' + age(order) + '</header>' +
    '<div class="order-body">' + itemList(order, !waiter && order.status === 'preparing') + (order.customerNotes ? '<p class="note">' + esc(order.customerNotes) + '</p>' : '') + (order.staffNotes ? '<p class="internal-note">' + esc(order.staffNotes) + '</p>' : '') + (order.priority === 'urgent' ? '<p class="urgent-marker">' + icon('flag') + 'PRIORIDAD ALTA</p>' : '') + (!waiter && order.status === 'preparing' ? '<div class="progress" aria-label="Productos terminados"><span style="width:' + ((order.preparedItems?.length || 0) / order.items.length * 100) + '%"></span></div>' : '') + '</div>' +
    '<footer class="order-footer">' + (waiter ? '<strong class="order-total">' + money(order.totals?.total) + '</strong>' : '') + '<button class="icon-button" data-detail="' + esc(order.id) + '" title="Detalle del pedido" aria-label="Detalle ' + shortId(order) + '">' + icon('expand') + '</button><button class="icon-button" data-print="' + esc(order.id) + '" title="Imprimir comanda" aria-label="Imprimir ' + shortId(order) + '">' + icon('printer') + '</button>' + primaryAction(order) + '</footer></article>';
}
function filters() {return {view, status: $('#filter').value, query: $('#search-table').value, sort: $('#sort').value, urgentOnly: $('#urgent-only').checked, overdueMinutes: config.overdueMinutes};}
function render() {
  const stats = summary(orders);
  const metrics = waiter ? [['Nuevos', stats.new, 'inbox', 'Por revisar'], ['En cocina',stats.kitchen,'chef-hat','En espera y preparación'], ['Listos',stats.ready,'bell','Para retirar del pase'], ['Mesas activas',stats.tables,'armchair',stats.delivered + ' pedidos entregados hoy']] : [['En espera',orders.filter(o=>o.status==='sent_to_kitchen').length,'inbox','Próximas comandas'], ['Preparando',orders.filter(o=>o.status==='preparing').length,'flame','En producción'], ['Listos',stats.ready,'bell','Esperando retiro'], ['Productos pendientes',orders.filter(o=>['preparing','sent_to_kitchen'].includes(o.status)).reduce((sum,o)=>sum+o.items.reduce((n,item,i)=>n+(o.preparedItems?.includes(i)?0:item.quantity),0),0),'utensils','Unidades por preparar']];
  $('#metrics').innerHTML = metrics.map(([label,value,name,caption])=>'<div class="metric ' + (label==='Listos'?'ready':'') + '"><p class="metric-label">' + icon(name) + esc(label) + '</p><strong class="metric-value">' + value + '</strong><br><small>' + esc(caption) + '</small></div>').join('');
  $('#shift-summary').textContent = waiter ? stats.active + (stats.active===1?' pedido activo · ':' pedidos activos · ') + stats.tables + (stats.tables===1?' mesa en servicio':' mesas en servicio') : 'Comandas por orden de llegada · ' + clock(Date.now());
  const list = visibleOrders(orders, filters());
  $('#summary').textContent = list.length + (list.length === 1 ? ' pedido' : ' pedidos');
  $('#table-grid').hidden = view !== 'tables';
  $('#orders').hidden = !['orders','history'].includes(view);
  $('#production').hidden = view !== 'production';
  if (view === 'tables') {
    const filtering = $('#filter').value || $('#search-table').value || $('#urgent-only').checked;
    const groups = tableGroups(orders, tables).filter(group => !filtering || group.orders.some(order => list.some(o => o.id === order.id)) || (!group.orders.length && !$('#filter').value && !$('#urgent-only').checked && group.number.includes($('#search-table').value.trim())));
    $('#table-grid').innerHTML = groups.length ? groups.map(group => '<button class="table ' + group.status + '" data-table="' + esc(group.number) + '"><span class="table-top"><span class="table-name"><small>MESA</small>' + esc(group.number) + '</span>' + icon('armchair') + '</span><span class="status ' + group.status + '">' + (group.status==='free'?'Disponible':esc(labels[group.status])) + '</span><span class="table-footer"><span>' + (group.orders.length ? group.orders.length + (group.orders.length===1?' pedido':' pedidos') : 'Sin pedidos activos') + '</span>' + (group.orders.length?'<strong>'+money(group.total)+'</strong>':'') + '</span></button>').join('') : empty('Sin mesas coincidentes');
  } else if (view === 'production') {
    const production = new Map();
    for (const order of list.filter(o => ['sent_to_kitchen','preparing'].includes(o.status))) for (const [index,item] of order.items.entries()) {
      if (order.preparedItems?.includes(index)) continue;
      const key = item.productId + '|' + notes(item);
      const line = production.get(key) || {name:item.name, notes:notes(item), waiting:0, preparing:0, tables:new Set()};
      line[order.status==='preparing'?'preparing':'waiting'] += item.quantity;
      line.tables.add(order.tableNumber); production.set(key,line);
    }
    $('#production').innerHTML = production.size ? '<table><thead><tr><th>PRODUCTO</th><th>EN ESPERA</th><th>PREPARANDO</th><th>MESAS</th></tr></thead><tbody>' + [...production.values()].map(line=>'<tr><td><b>'+esc(line.name)+'</b><p class="production-notes">'+esc(line.notes)+'</p></td><td><strong>'+line.waiting+'</strong></td><td><strong>'+line.preparing+'</strong></td><td>'+[...line.tables].map(esc).join(', ')+'</td></tr>').join('')+'</tbody></table>' : empty('Sin producción pendiente');
  } else if (!waiter) {
    $('#orders').className = 'kanban';
    $('#orders').innerHTML = ['sent_to_kitchen','preparing','ready'].map(value => '<section class="column ' + value + '"><h3 class="column-heading">' + icon({sent_to_kitchen:'inbox',preparing:'flame',ready:'check'}[value]) + labels[value] + '<span>' + list.filter(o=>o.status===value).length + '</span></h3><div class="column-orders">' + (list.filter(o=>o.status===value).map(orderCard).join('') || empty('Sin comandas', value==='ready'?'El pase esta despejado.':'')) + '</div></section>').join('');
  } else {$('#orders').className = 'orders'; $('#orders').innerHTML = list.length ? list.map(orderCard).join('') : empty(view==='history'?'Sin pedidos cerrados':'Todo al día');}
  if ($('#detail-dialog').open && !detailDirty) renderDetail();
  icons();
}
function detailOrder(order) {
  return '<div class="detail-meta">' + status(order) + age(order) + '</div>' + itemList(order) + (order.customerNotes?'<p class="internal-note">'+esc(order.customerNotes)+'</p>':'') + '<div class="detail-totals"><div><span>Productos</span><span>'+money(order.totals?.subtotal)+'</span></div><div><span>Servicio</span><span>'+money(order.totals?.service)+'</span></div><div class="final"><span>Total</span><span>'+money(order.totals?.total)+'</span></div></div>' +
    (waiter && isActive(order) ? '<form id="note-form" class="detail-section"><h3>Indicaciones del salón</h3><label>Observaciónes internas<textarea id="staff-notes" maxlength="1000">'+esc(order.staffNotes || '')+'</textarea></label><label>Prioridad<select id="priority"><option value="normal">Normal</option><option value="urgent" '+(order.priority==='urgent'?'selected':'')+'>Alta</option></select></label><button class="secondary" type="submit">'+icon('save')+'Guardar cambios</button><p id="note-error" class="error" role="alert"></p></form>' : order.staffNotes?'<p class="internal-note">'+esc(order.staffNotes)+'</p>':'') +
    '<section class="detail-section"><h3>Recorrido del pedido</h3><ol class="timeline">' + (order.history?.length?order.history:[{at:order.createdAt,status:'new',actor:'cliente'}]).map(entry=>'<li><div>'+esc(entry.label || labels[entry.status] || 'Pedido actualizado')+'<small>'+clock(entry.at)+' · '+esc({waiter:'Salón',kitchen:'Cocina',cliente:'Carta'}[entry.actor] || entry.actor)+'</small>'+(entry.reason?'<p class="note">'+esc(entry.reason)+'</p>':'')+'</div></li>').join('') + '</ol></section>';
}
function renderDetail() {
  const order = orders.find(o=>o.id===selectedId);
  if (order) {
    detailRevision = order.revision || 0;
    $('#detail-title').textContent = 'Mesa ' + order.tableNumber + ' · ' + shortId(order);
    $('#detail-body').innerHTML = detailOrder(order);
    $('#detail-actions').innerHTML = '<button class="secondary" data-print="'+esc(order.id)+'">'+icon('printer')+'Imprimir</button>'+(waiter&&order.status==='new'?'<button class="secondary" data-cancel="'+esc(order.id)+'">Cancelar</button>':'')+primaryAction(order);
  } else if (selectedTable) {
    const group = tableGroups(orders,tables).find(g=>g.number===selectedTable);
    $('#detail-title').textContent = 'Mesa ' + selectedTable;
    $('#detail-body').innerHTML = group?.orders.length ? group.orders.map(orderCard).join('') : empty('Mesa disponible','Todavía no hay pedidos en esta mesa.');
    $('#detail-actions').innerHTML = '<button class="primary" data-compose-table="'+esc(selectedTable)+'">'+icon('plus')+'Tomar pedido</button>';
  } else {$('#detail-body').innerHTML = empty('Pedido no disponible'); $('#detail-actions').innerHTML = '';}
}
function openDetail(id, table) {selectedId=id; selectedTable=table; detailDirty=false; renderDetail(); icons(); $('#detail-dialog').showModal();}
async function refresh() {
  const generation = ++refreshGeneration;
  try {
    const next = await H52Backend.listOrders();
    if (generation !== refreshGeneration) return;
    if (loaded) {
      const changed = next.some(order => {const old=orders.find(o=>o.id===order.id);return waiter?(order.status==='new'&&!old || order.status==='ready'&&old?.status!=='ready'):order.status==='sent_to_kitchen'&&!old;});
      if (changed) {beep(); toast(waiter?'Novedades en el salón':'Nueva comanda en cocina');}
    }
    orders=next; loaded=true;
    $('#last-updated').textContent = 'Actualizado ' + clock(Date.now());
    render();
  } catch(error) {
    if (error.status===401) {unsubscribe?.(); $('#detail-dialog').close(); $('#app').hidden=true; $('#logout').hidden=true; $('#login').hidden=false; $('#login-error').textContent='La sesión finalizó. Ingresá nuevamente.';$('#mode').textContent='Acceso del equipo';$('#mode').className='connection';}
    else errorMessage(error);
    throw error;
  }
}
async function activate() {
  const state = await H52Backend.getSession();
  if (state.session?.role !== role) {$('#login').hidden=false; $('#app').hidden=true; $('#logout').hidden=true; $('#mode').textContent='Acceso del equipo';$('#mode').className='connection'; return;}
  $('#login').hidden=true; $('#app').hidden=false; $('#logout').hidden=false; $('#password').value='';
  await refresh();
  unsubscribe?.(); unsubscribe=H52Backend.subscribe(()=>refresh().catch(()=>{}));
}
async function changeOrder(id, patch, revision) {
  if (busy) return false;
  busy=true; $('#staff-error').hidden=true;
  document.querySelectorAll('[data-action],[data-item],#note-form button,#confirm-cancel').forEach(b=>b.disabled=true);
  try {const order=orders.find(o=>o.id===id); await H52Backend.updateOrder(id,{...patch,expectedRevision:revision ?? order?.revision ?? 0}); detailDirty=false; await refresh(); return true;}
  catch(error) {errorMessage(error); toast(error.message); if ($('#note-error')) $('#note-error').innerHTML=esc(error.message)+' <button class="secondary" type="button" data-reload-detail>Recargar detalle</button>'; await refresh().catch(()=>{}); return false;}
  finally {busy=false; render();}
}
function photo(product) {
  if (!product.image || !/^(assets\/|https:\/\/)/.test(product.image)) return '<span class="photo">'+icon('utensils')+'</span>';
  const image=product.image.replace(/[\"'()\\\\]/g,c=>encodeURIComponent(c));
  const crop=product.imageCrop;
  if (!Array.isArray(crop) || crop.length !== 4 || crop.some(v=>!Number.isFinite(v))) return '<span class="photo" style="background-image:url(&quot;'+esc(image)+'&quot;);background-size:cover;background-position:center"></span>';
  const [x,y,w,h]=crop;
  return '<span class="photo" style="background-image:url(&quot;'+esc(image)+'&quot;);background-size:'+100/w+'% '+100/h+'%;background-position:'+(w===1?50:100*x/(1-w))+'% '+(h===1?50:100*y/(1-h))+'%"></span>';
}
function renderCatalog() {
  const term=$('#product-search').value.trim().toLocaleLowerCase('es');
  const list=products.filter(p=>p.available!==false && (p.name+' '+(p.category||'')).toLocaleLowerCase('es').includes(term));
  $('#catalog-list').innerHTML = list.length ? list.map(p=>'<div class="catalog-product">'+photo(p)+'<div><strong>'+esc(p.name)+'</strong><small>'+money(p.price)+'</small></div><button class="icon-button" type="button" data-product="'+esc(p.id)+'" title="Agregar '+esc(p.name)+'" aria-label="Agregar '+esc(p.name)+'">'+icon('plus')+'</button></div>').join('') : empty('Sin productos coincidentes');
  icons();
}
function draftTotals() {
  const subtotal=draft.reduce((sum,line)=>{const p=products.find(p=>String(p.id)===line.productId);return sum+(p.price+line.extraIds.reduce((n,id)=>n+(p.extras?.find(e=>String(e.id)===id)?.price||0),0))*line.quantity;},0);
  return subtotal+Math.round(subtotal*servicePercent)/100;
}
function renderDraft() {
  $('#compose-count').textContent=draft.reduce((sum,l)=>sum+l.quantity,0);
  $('#compose-lines').innerHTML = draft.length ? draft.map(line=>{
    const product=products.find(p=>String(p.id)===line.productId);
    return '<div class="compose-line"><div class="line-heading"><strong>'+esc(product.name)+'</strong><div class="stepper"><button type="button" data-draft-minus="'+esc(line.productId)+'" aria-label="Quitar '+esc(product.name)+'">'+icon('minus')+'</button><output>'+line.quantity+'</output><button type="button" data-draft-plus="'+esc(line.productId)+'" aria-label="Sumar '+esc(product.name)+'">'+icon('plus')+'</button></div></div><input data-draft-note="'+esc(line.productId)+'" value="'+esc(line.notes)+'" maxlength="1000" placeholder="Observaciónes del producto" aria-label="Observaciónes '+esc(product.name)+'">'+(product.extras?.some(e=>e.available)?'<details><summary>Extras</summary>'+product.extras.filter(e=>e.available).map(e=>'<label><input type="checkbox" data-extra-product="'+esc(line.productId)+'" data-extra="'+esc(e.id)+'" '+(line.extraIds.includes(String(e.id))?'checked':'')+'>'+esc(e.name)+' · '+money(e.price)+'</label>').join('')+'</details>':'')+'</div>';
  }).join('') : '<p class="compose-empty">Todavía no agregaste productos.</p>';
  $('#compose-total').textContent=money(draftTotals()); $('#compose-submit').disabled=!draft.length || busy; icons();
}
function openCompose(table) {
  if (!waiter) return;
  if (table) $('#compose-table').value=table;
  $('#detail-dialog').close(); $('#compose-error').textContent=''; renderCatalog(); renderDraft(); $('#compose-dialog').showModal();
}
function printOrder(order) {
  $('#print-area').innerHTML='<h1>H52 · MESA '+esc(order.tableNumber)+'</h1><p>'+shortId(order)+' · '+clock(order.createdAt)+'</p><hr><ul>'+order.items.map(item=>'<li><b>'+item.quantity+' × '+esc(item.name)+'</b><small>'+esc(notes(item))+'</small></li>').join('')+'</ul>'+(order.staffNotes?'<p>'+esc(order.staffNotes)+'</p>':'')+(order.customerNotes?'<p>'+esc(order.customerNotes)+'</p>':'')+'<hr><p>'+esc(labels[order.status])+'</p>';
  window.print();
}
function setView(next) {
  view=next; $('#filter').value=''; $('#staff-error').hidden=true;
  document.querySelectorAll('[data-view]').forEach(button=>{button.setAttribute('aria-selected',String(button.dataset.view===view));button.tabIndex=button.dataset.view===view?0:-1;});
  render();
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.submitter; button.disabled=true; $('#login-error').textContent='';
  try {await H52Backend.signIn('', $('#password').value); await activate();}
  catch(error) {$('#login-error').textContent=error.message;}
  finally {button.disabled=false;}
});
$('#logout').addEventListener('click',async()=>{try {await H52Backend.signOut(); unsubscribe?.(); loaded=false; orders=[]; $('#detail-dialog').close(); $('#compose-dialog').close(); await activate();} catch(error){errorMessage(error);}});
$('#refresh').addEventListener('click',()=>refresh().then(()=>toast('Pedidos actualizados')).catch(()=>{}));
for(const id of ['search-table','filter','sort','urgent-only']) $('#'+id).addEventListener(id==='search-table'?'input':'change',render);
$('#sound').checked=soundEnabled;
$('#sound').addEventListener('change',async event=>{soundEnabled=event.target.checked;localStorage.setItem('h52-staff-sound',String(soundEnabled));if(soundEnabled){audio ||= new (window.AudioContext || window.webkitAudioContext)();await audio.resume();beep();}});
$('#focus-mode')?.addEventListener('change',event=>document.body.classList.toggle('focus-mode',event.target.checked));
$('#new-order')?.addEventListener('click',()=>openCompose());
$('#product-search').addEventListener('input',renderCatalog);
$('#export-json')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(orders,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='h52-pedidos-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('#detail-dialog').addEventListener('input',event=>{if(event.target.closest('#note-form'))detailDirty=true;});
$('#detail-dialog').addEventListener('change',event=>{if(event.target.closest('#note-form'))detailDirty=true;});
$('#detail-dialog').addEventListener('submit',async event=>{if(event.target.id!=='note-form')return;event.preventDefault();const patch={staffNotes:$('#staff-notes').value,priority:$('#priority').value};if(await changeOrder(selectedId,patch,detailRevision))toast('Indicaciones guardadas');});
$('#compose-lines').addEventListener('input',event=>{const line=draft.find(l=>l.productId===event.target.dataset.draftNote);if(line){line.notes=event.target.value;draftId=crypto.randomUUID();}});
$('#compose-lines').addEventListener('change',event=>{const line=draft.find(l=>l.productId===event.target.dataset.extraProduct);if(!line)return;draftId=crypto.randomUUID();const id=event.target.dataset.extra;line.extraIds=event.target.checked?[...new Set([...line.extraIds,id])]:line.extraIds.filter(v=>v!==id);$('#compose-total').textContent=money(draftTotals());});
for (const id of ['compose-table','compose-notes']) $('#'+id).addEventListener('input',()=>{draftId=crypto.randomUUID();});
$('#compose-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!draft.length)return;busy=true;document.querySelectorAll('#compose-form input,#compose-form select,#compose-form textarea,#compose-form button').forEach(el=>el.disabled=true);$('#compose-error').textContent='';
  try {await H52Backend.createOrder({clientOrderId:draftId,tableNumber:$('#compose-table').value,customerNotes:$('#compose-notes').value,items:structuredClone(draft)});draft=[];draftId=crypto.randomUUID();$('#compose-notes').value='';$('#compose-dialog').close();toast('Pedido guardado. Listo para enviar a cocina.');await refresh();}
  catch(error){$('#compose-error').textContent=error.message;}
  finally {busy=false;document.querySelectorAll('#compose-form input,#compose-form select,#compose-form textarea,#compose-form button').forEach(el=>el.disabled=false);renderDraft();render();}
});
$('#cancel-reason').addEventListener('input',()=>$('#cancel-reason').setCustomValidity(''));
$('#confirm-cancel').addEventListener('click',async()=>{const reason=$('#cancel-reason').value.trim();if(!reason){$('#cancel-reason').setCustomValidity('Ingresá el motivo de cancelación.');$('#cancel-reason').reportValidity();return;}if(await changeOrder(cancelId,{status:'cancelled',reason})){ $('#confirm-dialog').close();toast('Pedido cancelado');}});
window.addEventListener('h52-connection',event=>{ $('#mode').textContent=event.detail?'En vivo':'Reconectando';$('#mode').className='connection '+(event.detail?'live':'offline');});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-reload-detail')){detailDirty=false;renderDetail();icons();return;}
  if(button.dataset.close){$('#'+button.dataset.close).close();return;}
  if(button.dataset.view){setView(button.dataset.view);return;}
  if(button.dataset.table){openDetail(null,button.dataset.table);return;}
  if(button.dataset.detail){openDetail(button.dataset.detail);return;}
  if(button.dataset.composeTable){openCompose(button.dataset.composeTable);return;}
  if(button.dataset.print){const order=orders.find(o=>o.id===button.dataset.print);if(order)printOrder(order);return;}
  if(button.dataset.cancel){cancelId=button.dataset.cancel;$('#confirm-description').textContent='El pedido se cerrará y quedará registrado en el historial.';$('#cancel-reason').value='';$('#confirm-dialog').showModal();return;}
  if(button.dataset.action){const status={send:'sent_to_kitchen',preparing:'preparing',ready:'ready',delivered:'delivered'}[button.dataset.action];if(await changeOrder(button.dataset.id,{status}))toast(labels[status]);return;}
  if(button.dataset.item!==undefined){const order=orders.find(o=>o.id===button.dataset.id);const index=Number(button.dataset.item);const prepared=order.preparedItems||[];await changeOrder(order.id,{preparedItems:prepared.includes(index)?prepared.filter(i=>i!==index):[...prepared,index]});return;}
  const productId=button.dataset.product || button.dataset.draftPlus || button.dataset.draftMinus;
  if(productId){if(busy)return;draftId=crypto.randomUUID();let line=draft.find(l=>l.productId===productId);if(!line){line={productId,quantity:0,notes:'',extraIds:[]};draft.push(line);}line.quantity=Math.min(maxQuantity,line.quantity+(button.dataset.draftMinus?-1:1));draft=draft.filter(l=>l.quantity>0);renderDraft();}
});
document.querySelector('.tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...document.querySelectorAll('[data-view]')],index=tabs.indexOf(document.activeElement);
  if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setView(tabs[next].dataset.view);tabs[next].focus();
});
async function init() {
  $('#calendar').textContent=new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'short'});icons();
  const responses=await Promise.all([fetch('config/products.json'),fetch('config/design.json'),fetch('config/staff.json')]);
  if(responses.some(r=>!r.ok))throw new Error('No se pudo cargar la configuración del servicio.');
  const [catalog,design,settings]=await Promise.all(responses.map(r=>r.json()));
  products=catalog.products;tables=design.order.tables;servicePercent=design.order.servicePercent;maxQuantity=design.order.maxQuantity;
  config={...config,...settings};
  if (localStorage.getItem('h52-staff-sound') === null) {soundEnabled=Boolean(settings.soundEnabled);$('#sound').checked=soundEnabled;}
  if (settings.restaurantLabel) document.querySelector('.brand small').textContent=settings.restaurantLabel;
  config.overdueMinutes=Math.max(1,Number(config.overdueMinutes)||15);
  $('#compose-table').innerHTML=tables.map(table=>'<option value="'+esc(table)+'">Mesa '+esc(table)+'</option>').join('');
  await activate();
  setInterval(()=>{if(!$('#app').hidden)refresh().catch(()=>{});},Math.max(15,Number(config.refreshSeconds)||30)*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#app').hidden)refresh().catch(()=>{});});
}
init().catch(error=>{$('#login').hidden=false;$('#login-error').textContent='Servidor no disponible. '+error.message;$('#mode').textContent='Sin conexión';$('#mode').className='connection offline';});
