function editorNewProduct(catalog,input,id) {
  const category=catalog.categories.find(c=>c.id===input.categoryId);
  if(!category)throw new Error('Elegir una categoria.');
  const name=String(input.name||'').trim();
  if(!name||name.length>150)throw new Error('Escribir un nombre de hasta 150 caracteres.');
  if(input.price===''||!Number.isFinite(Number(input.price))||Number(input.price)<0)throw new Error('Escribir un precio valido.');
  const list=value=>String(value||'').split(',').map(s=>s.trim()).filter(Boolean);
  const optional=value=>value===''||value==null?null:Number(value);
  const ownImage=String(input.image||'').trim();
  if(ownImage&&!/^(assets\/[\w./-]+|https:\/\/[^\s"'<>]+)$/.test(ownImage))throw new Error('La foto debe ser una direccion HTTPS o un archivo de assets.');
  const photo=ownImage?null:catalog.products.find(p=>p.id===input.photoId);
  const removable=[...new Set(String(input.removable||'').split('\n').map(s=>s.trim()).filter(Boolean))];
  const extras=(input.extras||[]).map((extra,index)=>{
    const name=String(extra.name||'').trim(),price=Number(extra.price);
    if(!name||extra.price===''||!Number.isFinite(price)||price<0)throw new Error('Completar nombre y precio de cada extra.');
    return {id:id+'-extra-'+index,name,price,available:extra.available!==false};
  });
  return {id,name,description:String(input.description||'').trim(),price:Number(input.price),category:category.name,image:ownImage||photo?.image||'',imageAlt:name,
    ...(photo?.imageCrop?{imageCrop:structuredClone(photo.imageCrop)}:{}),...(photo?.imageIllustrative!==undefined?{imageIllustrative:photo.imageIllustrative}:{}),
    classification:{categoryId:category.id,subcategory:String(input.subcategory||'').trim(),tags:list(input.tags),dietary:list(input.dietary)},
    available:input.available!==false,featured:input.featured===true,badge:String(input.badge||'').trim(),order:Math.max(0,...catalog.products.map(p=>p.order))+1,
    ingredients:list(input.ingredients),allergens:String(input.allergens||'').trim()?list(input.allergens):null,serving:String(input.serving||'').trim()||null,
    preparationMinutes:optional(input.preparation),alcoholPercent:optional(input.alcohol),customization:{removable,allowNote:input.allowNote!==false},extras};
}
function openCreateProduct() {
  if(!data.catalog.categories.length){status('Agrega una categoria antes de crear el producto.',true);return;}
  $('#create-product-form').reset();$('#create-error').textContent='';$('#create-extras').replaceChildren();
  $('#create-product-body').querySelectorAll('details').forEach(el=>el.open=false);
  $('#create-category').innerHTML='<option value="">Elegir categoria</option>'+data.catalog.categories.map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
  $('#create-category').value=$('#editor-category').value;
  $('#create-photo').innerHTML='<option value="">Sin foto</option>'+data.catalog.products.filter(p=>p.image).map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`).join('');
  $('#create-photo-preview').replaceChildren();
  updateCreateCategory();$('#create-product-dialog').showModal();
  if($('#create-category').value)$('#create-name').focus();
}
function updateCreateCategory() {
  const chosen=Boolean($('#create-category').value);
  $('#create-product-body').hidden=!chosen;$('#create-confirm').disabled=!chosen;
}
document.addEventListener('change',event=>{
  if(event.target.id==='create-category'){updateCreateCategory();if(event.target.value)$('#create-name').focus();}
  if(event.target.id==='create-photo'){
    const photo=data.catalog.products.find(p=>p.id===event.target.value);
    $('#create-photo-preview').innerHTML=photo?editorPhoto(photo):'';
  }
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-close-create'))$('#create-product-dialog').close();
  if(button.id==='create-add-extra') {
    const row=document.createElement('div');row.className='extra-row';
    row.innerHTML='<label class="field">Nombre del extra<input data-create-extra-name required maxlength="150"></label><label class="field">Precio del extra<input data-create-extra-price type="number" min="0" step="0.01" required inputmode="decimal"></label><label class="field checkbox"><input data-create-extra-available type="checkbox" checked>Disponible</label><button type="button" data-remove-create-extra title="Eliminar extra" aria-label="Eliminar extra"><i data-lucide="trash-2"></i></button>';
    $('#create-extras').append(row);window.lucide?.createIcons();row.querySelector('input').focus();
  }
  if(button.hasAttribute('data-remove-create-extra'))button.closest('.extra-row').remove();
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='create-product-form')return;event.preventDefault();
  const value=id=>$('#create-'+id).value;
  try {
    const product=editorNewProduct(data.catalog,{
      categoryId:value('category'),name:value('name'),price:value('price'),description:value('description'),photoId:value('photo'),image:value('image'),
      ingredients:value('ingredients'),allergens:value('allergens'),serving:value('serving'),preparation:value('preparation'),alcohol:value('alcohol'),
      removable:value('removable'),subcategory:value('subcategory'),tags:value('tags'),dietary:value('dietary'),badge:value('badge'),
      available:$('#create-available').checked,featured:$('#create-featured').checked,allowNote:$('#create-allow-note').checked,
      extras:[...$('#create-extras').querySelectorAll('.extra-row')].map(row=>({name:row.querySelector('[data-create-extra-name]').value,price:row.querySelector('[data-create-extra-price]').value,available:row.querySelector('[data-create-extra-available]').checked}))
    },'producto-'+crypto.randomUUID());
    const next=structuredClone(data);next.catalog.products.push(product);H52Data.validate(next.design,next.catalog);
    data=next;selectedId=product.id;$('#editor-category').value=product.classification.categoryId;$('#editor-search').value='';$('#editor-availability').value='all';
    $('#create-product-dialog').close();renderCategories();renderProducts();update();
    $('#product-fields').scrollIntoView({block:'start'});
  }catch(error){$('#create-error').textContent=error.message;}
});
