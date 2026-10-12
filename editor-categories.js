function editorRemoveCategory(source, categoryId, destinationId) {
  const next=structuredClone(source);
  if(next.catalog.categories.length<=1)throw new Error('Conserva al menos una categoria.');
  if(!next.catalog.categories.some(c=>c.id===categoryId))throw new Error('La categoria ya no existe.');
  const products=next.catalog.products.filter(p=>p.classification.categoryId===categoryId);
  const sections=next.design.homeSections.filter(s=>s.categoryId===categoryId);
  const destination=next.catalog.categories.find(c=>c.id===destinationId&&c.id!==categoryId);
  if((products.length||sections.length)&&!destination)throw new Error('Elegí una categoria de destino.');
  for(const p of products){p.classification.categoryId=destination.id;p.category=destination.name;}
  for(const s of sections)s.categoryId=destination.id;
  next.catalog.categories=next.catalog.categories.filter(c=>c.id!==categoryId);
  return next;
}
let categoryDialogMode, categoryDialogId;
function openCategoryDialog(mode) {
  categoryDialogMode=mode;categoryDialogId=selectedCategoryId;
  const category=data.catalog.categories.find(c=>c.id===categoryDialogId);
  if(mode==='delete'&&!category)return;
  $('#category-dialog-form').reset();$('#category-dialog-error').textContent='';
  $('#category-create-fields').hidden=mode!=='create';$('#category-delete-fields').hidden=mode!=='delete';
  $('#category-new-name').required=mode==='create';
  $('#category-dialog-title').textContent=mode==='create'?'Nueva categoria':`Eliminar ${category.name}`;
  $('#category-dialog-confirm').textContent=mode==='create'?'Crear categoria':'Mover y eliminar';
  const count=data.catalog.products.filter(p=>p.classification.categoryId===categoryDialogId).length;
  $('#category-delete-summary').textContent=`${count} productos. Los productos se conservan. Puedes recuperar la categoria con Deshacer.`;
  $('#category-destination').innerHTML='<option value="">Elegir categoria</option>'+data.catalog.categories.filter(c=>c.id!==categoryDialogId).map(c=>`<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
  $('#category-dialog-confirm').disabled=mode==='delete'&&data.catalog.categories.length<=1;
  if(mode==='delete'&&data.catalog.categories.length<=1)$('#category-dialog-error').textContent='Conserva al menos una categoria.';
  $('#category-dialog').showModal();window.lucide?.createIcons();
}
document.addEventListener('click',event=>{if(event.target.closest('[data-close-category]'))$('#category-dialog').close();});
document.addEventListener('submit',event=>{
  if(event.target.id!=='category-dialog-form')return;
  event.preventDefault();
  try {
    let next=structuredClone(data);
    if(categoryDialogMode==='create') {
      const name=$('#category-new-name').value.trim();
      if(!name)throw new Error('Escribe el nombre de la categoria.');
      if(next.catalog.categories.some(c=>c.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('Ya existe una categoria con ese nombre.');
      categoryDialogId='categoria-'+crypto.randomUUID();
      next.catalog.categories.push({id:categoryDialogId,name,subtitle:$('#category-new-subtitle').value.trim(),icon:$('#category-new-icon').value,order:Math.max(0,...next.catalog.categories.map(c=>c.order))+1});
    } else next=editorRemoveCategory(data,categoryDialogId,$('#category-destination').value);
    H52Data.validate(next.design,next.catalog);data=next;
    selectedCategoryId=categoryDialogMode==='create'?categoryDialogId:$('#category-destination').value||data.catalog.categories[0].id;
    $('#editor-category').value='';renderDesign();renderCategories();renderProducts();update();$('#category-dialog').close();
  } catch(error){$('#category-dialog-error').textContent=error.message;}
});
