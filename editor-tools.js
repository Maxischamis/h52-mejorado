const editorSelection = new Set();
const editorText = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let photoLibrary = [];
function editorTables(text) {
  const tables=String(text).split(',').map(s=>s.trim()).filter(Boolean).map(v=>/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):v);
  if(!tables.length || tables.length>100 || tables.some(v=>String(v).length>30) || new Set(tables.map(String)).size!==tables.length) throw new Error('Mesas invalidas o repetidas. Usa hasta 100 nombres diferentes.');
  return tables;
}
function editorBulk(payload, ids, action, value) {
  if(!['percent','amount','available','unavailable','featured','unfeatured'].includes(action))throw new Error('Accion invalida.');
  if(['percent','amount'].includes(action)&&(!Number.isFinite(value)||action==='percent'&&value < -100))throw new Error('Ajuste de precio invalido.');
  const next=structuredClone(payload);
  next.catalog.products.filter(p=>ids.has(p.id)).forEach(p=>{
    if(action==='percent')p.price=Math.round(p.price*(1+value/100)*100)/100;
    if(action==='amount')p.price=Math.round((p.price+value)*100)/100;
    if(action==='available'||action==='unavailable')p.available=action==='available';
    if(action==='featured'||action==='unfeatured')p.featured=action==='featured';
  });
  H52Data.validate(next.design,next.catalog);
  return next;
}
function editorPhoto(product) {
  const url = String(product.image || '');
  if (!url || !/^(assets\/[\w./-]+|https?:\/\/[^\s"'<>]+)$/.test(url)) return '';
  const crop = product.imageCrop;
  const style = crop ? `background-size:${100/crop[2]}% ${100/crop[3]}%;background-position:${100*crop[0]/(1-crop[2])}% ${100*crop[1]/(1-crop[3])}%` : '';
  return `<span class="editor-photo" style="background-image:url(&quot;${escapeHTML(url)}&quot;);${style}"></span>`;
}
function editorResults() {
  const query = editorText($('#editor-search').value), categoryId = $('#editor-category').value, availability = $('#editor-availability').value;
  return data.catalog.products.filter(p => (!categoryId || p.classification.categoryId === categoryId) && editorText(p.name+' '+p.description).includes(query) &&
    (availability === 'all' || availability === 'available' && p.available || availability === 'unavailable' && !p.available || availability === 'featured' && p.featured));
}
function renderEditorCatalog() {
  if (!data) return;
  if (!photoLibrary.length) photoLibrary = structuredClone(data.catalog.products.filter(p => p.image));
  const filter = $('#editor-category'), previous = filter.value;
  filter.innerHTML = '<option value="">Todas las categorias</option>'+data.catalog.categories.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
  filter.value = [...filter.options].some(o => o.value === previous) ? previous : '';
  for (const id of editorSelection) if (!data.catalog.products.some(p => p.id === id)) editorSelection.delete(id);
  const list = editorResults();
  $('#editor-count').textContent = `${list.length} de ${data.catalog.products.length} productos`;
  $('#editor-catalog').innerHTML = list.map(p => `<div class="catalog-row ${p.id===selectedId?'selected':''}"><input type="checkbox" data-select-product="${escapeHTML(p.id)}" aria-label="Seleccionar ${escapeHTML(p.name)}" ${editorSelection.has(p.id)?'checked':''}><button data-edit-product="${escapeHTML(p.id)}" aria-pressed="${p.id===selectedId}">${editorPhoto(p)}<span><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(new Intl.NumberFormat(data.design.order.locale,{style:'currency',currency:data.design.order.currency}).format(p.price))}${p.featured?' · Destacado':''}</small></span></button><button class="availability-switch ${p.available?'on':''}" data-availability="${escapeHTML(p.id)}" role="switch" aria-checked="${p.available}" title="${p.available?'Quitar disponibilidad':'Marcar disponible'}" aria-label="Disponibilidad de ${escapeHTML(p.name)}"><i data-lucide="${p.available?'toggle-right':'toggle-left'}"></i></button></div>`).join('') || '<p class="empty-catalog">Sin resultados</p>';
  $('#bulk-tools').hidden = !editorSelection.size;
  $('#bulk-count').textContent = `${editorSelection.size} seleccionados`;
  window.lucide?.createIcons();
}
function renderService() {
  const order = data.design.order;
  $('#service-fields').innerHTML = field('Servicio (%)','order.servicePercent',order.servicePercent,'number')+field('Cantidad maxima por producto','order.maxQuantity',order.maxQuantity,'number')+
    `<label class="field">Mesa inicial<select data-path="order.defaultTable" data-target="design">${order.tables.map(table=>`<option value="${escapeHTML(table)}" ${String(table)===String(order.defaultTable)?'selected':''}>${escapeHTML(table)}</option>`).join('')}</select></label>`+
    field('Moneda','order.currency',order.currency)+field('Idioma y formato','order.locale',order.locale);
  $('#service-tables').value = order.tables.join(', ');
}
function organizeProductFields(product) {
  const host = $('#product-fields');
  const groups = [
    ['Producto',['name','price','description','classification.categoryId','available','featured']],
    ['Foto',['image','imageAlt']],
    ['Opciones y extras',['customization.removable','customization.allowNote']],
    ['Ingredientes y alergenos',['ingredients','allergens','classification.dietary','serving']],
    ['Organizacion',['classification.subcategory','classification.tags','badge','order','preparationMinutes','alcoholPercent']]
  ];
  const fields = [...host.querySelectorAll('.field')];
  host.replaceChildren();
  for (const [title, paths] of groups) {
    const section = document.createElement('details'); section.className = 'product-section'; section.open = title === 'Producto';
    const summary = document.createElement('summary'); summary.textContent = title; section.append(summary);
    const body = document.createElement('div'); body.className = 'product-section-body';
    for (const path of paths) {const input = fields.find(f => f.querySelector('[data-path]')?.dataset.path === path); if (input) body.append(input);}
    if (title === 'Foto') body.insertAdjacentHTML('afterbegin',`<div class="product-photo-preview">${editorPhoto(product)}<button id="choose-image"><i data-lucide="images"></i>Elegir foto</button></div>`);
    if (title === 'Opciones y extras') body.insertAdjacentHTML('beforeend','<h3>Extras</h3><div id="extras-fields"></div><button id="add-extra"><i data-lucide="plus"></i>Agregar extra</button>');
    section.append(body); host.append(section);
  }
  renderExtras();
  host.querySelectorAll('input[type=number]').forEach(input => {input.min = '0'; input.step = ['price','alcoholPercent'].includes(input.dataset.path)?'any':'1';});
  window.lucide?.createIcons();
}
function renderExtras() {
  const host = $('#extras-fields'); if (!host) return;
  host.innerHTML = (selected()?.extras || []).map((extra,index) => `<div class="extra-row">${field('Nombre del extra',`extras.${index}.name`,extra.name,'text','product')}${field('Precio del extra',`extras.${index}.price`,extra.price,'number','product')}${field('Extra disponible',`extras.${index}.available`,extra.available,'checkbox','product')}<button data-delete-extra="${index}" title="Eliminar extra" aria-label="Eliminar ${escapeHTML(extra.name)}"><i data-lucide="trash-2"></i></button></div>`).join('');
  window.lucide?.createIcons();
}
function renderImageGallery() {
  const query = editorText($('#image-search').value);
  $('#image-gallery').innerHTML = photoLibrary.filter(p => editorText(p.name).includes(query)).map(p => `<button data-pick-image="${escapeHTML(p.id)}">${editorPhoto(p)}<span>${escapeHTML(p.name)}</span></button>`).join('');
}
document.addEventListener('input',event => {
  if (['editor-search','editor-category','editor-availability'].includes(event.target.id)) renderEditorCatalog();
  if (event.target.id === 'image-search') renderImageGallery();
  if (event.target.id === 'bulk-action') $('#bulk-value').hidden = !['percent','amount'].includes(event.target.value);
});
document.addEventListener('change',event => {
  const id = event.target.dataset.selectProduct;
  if (id) {if (event.target.checked) editorSelection.add(id); else editorSelection.delete(id);renderEditorCatalog();}
});
document.addEventListener('click',event => {
  const button = event.target.closest('button'); if (!button || !data) return;
  if (button.dataset.editProduct) {selectedId=button.dataset.editProduct;renderProducts();}
  if (button.dataset.availability) {const p=data.catalog.products.find(p=>p.id===button.dataset.availability);p.available=!p.available;if(p.id===selectedId)renderProducts();update();}
  if (button.id === 'select-results') {editorResults().forEach(p=>editorSelection.add(p.id));renderEditorCatalog();}
  if (button.id === 'clear-selection') {editorSelection.clear();renderEditorCatalog();}
  if (button.id === 'bulk-apply') {
    const action=$('#bulk-action').value, value=Number($('#bulk-value').value);
    if (['percent','amount'].includes(action) && (!$('#bulk-value').value.trim() || !Number.isFinite(value) || action==='percent' && value < -100)) {status('Ajuste de precio invalido.',true);return;}
    let next;
    try {next=editorBulk(data,editorSelection,action,value);} catch(error){status(error.message,true);return;}
    if(!confirm(`Aplicar el cambio a ${editorSelection.size} productos?`))return;
    data=next;renderProducts();update();
  }
  if (button.id === 'add-extra' && selected()) {selected().extras ||= []; selected().extras.push({id:'extra-'+crypto.randomUUID(),name:'Nuevo extra',price:0,available:true});renderExtras();update();}
  if (button.dataset.deleteExtra !== undefined && selected()) {selected().extras.splice(Number(button.dataset.deleteExtra),1);renderExtras();update();}
  if (button.id === 'apply-tables') {
    let values;
    try {values=editorTables($('#service-tables').value);}catch(error){status(error.message,true);return;}
    data.design.order.tables=values;
    if(!data.design.order.tables.map(String).includes(String(data.design.order.defaultTable)))data.design.order.defaultTable=data.design.order.tables[0];
    else data.design.order.defaultTable=data.design.order.tables.find(v=>String(v)===String(data.design.order.defaultTable));
    renderService();update();
  }
  if (['category-up','category-down'].includes(button.id)) {
    const list=[...data.catalog.categories].sort((a,b)=>a.order-b.order), index=list.findIndex(c=>c.id===selectedCategoryId), to=index+(button.id==='category-up'?-1:1);
    if(to>=0&&to<list.length){[list[index],list[to]]=[list[to],list[index]];list.forEach((c,i)=>c.order=i+1);data.catalog.categories=list;renderCategories();renderProducts();update();}
  }
  if(button.id==='delete-category') {
    if(data.catalog.products.some(p=>p.classification.categoryId===selectedCategoryId)||data.design.homeSections.some(s=>s.categoryId===selectedCategoryId)){status('La categoria tiene productos o secciones. Cambia su categoria antes de eliminarla.',true);return;}
    if(!confirm('Eliminar esta categoria vacia?'))return;
    data.catalog.categories=data.catalog.categories.filter(c=>c.id!==selectedCategoryId);renderCategories();renderProducts();update();
  }
  if (button.id==='choose-image') {renderImageGallery();$('#image-dialog').showModal();}
  if (button.hasAttribute('data-close-images')) $('#image-dialog').close();
  if (button.dataset.pickImage && selected()) {
    const source=photoLibrary.find(p=>p.id===button.dataset.pickImage), p=selected();p.image=source.image;p.imageAlt=source.imageAlt;
    for(const key of ['imageCrop','imageIllustrative']){if(source[key]!==undefined)p[key]=structuredClone(source[key]);else delete p[key];}
    $('#image-dialog').close();renderProducts();update();
  }
  if(button.id==='toggle-preview'){const open=document.body.classList.toggle('show-preview');button.innerHTML=`<i data-lucide="${open?'pencil':'eye'}"></i>${open?'Volver a editar':'Vista previa'}`;window.lucide?.createIcons();}
});
