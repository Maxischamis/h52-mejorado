const $ = s=>document.querySelector(s);
const escapeHTML = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,selectedId,selectedCategoryId,ready=false,history=[],historyIndex=-1;
const draftKey='h52-editor-draft-v1';
let savedDraft;
try { savedDraft=JSON.parse(localStorage.getItem(draftKey)); } catch {}
function contrast(a,b){const luminance=hex=>{const channels=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const palettes=[
  {name:'Nocturno',colors:['#080b0c','#111617','#1b2223','#f6f4f0','#a8b2b0','#ef5462','#190c10','#b5d5ca','#303a3b','#080b0c']},
  {name:'Botánico',colors:['#09120f','#111f19','#1f3027','#f0f6ee','#a4b5aa','#c6e485','#112016','#e4a8b3','#35483e','#09120f']},
  {name:'Estudio',colors:['#101113','#191b1e','#292c31','#fafafa','#b1b4bc','#8abcf4','#111921','#efb8be','#3a3d44','#101113']}
];
const displayNames={background:'Fondo',surface:'Superficie',surfaceRaised:'Relieve',text:'Texto',muted:'Texto secundario',accent:'Acento',accentText:'Texto del acento',secondary:'Contraste',border:'Bordes',heroShade:'Sombra de portada'};
const getPath=(obj,path)=>path.split('.').reduce((o,key)=>o[key],obj);
function setPath(obj,path,value){const keys=path.split('.');const key=keys.pop();keys.reduce((o,k)=>o[k],obj)[key]=value;}
function field(label,path,value,type='text',target='design') {
  const attrs=`data-path="${path}" data-target="${target}"`;
  if(target==='design'&&['theme.cardRadius','theme.contentWidth'].includes(path))return `<label class="field range-field">${label}<span><input type="range" ${attrs} min="${path==='theme.cardRadius'?0:800}" max="${path==='theme.cardRadius'?8:1800}" step="${path==='theme.cardRadius'?1:20}" value="${value}"><output>${value}</output></span></label>`;
  if(target==='design'&&['theme.fontDisplay','theme.fontBody'].includes(path)) {
    const fonts=[value,'Arial, Helvetica, sans-serif','Georgia, serif','Verdana, sans-serif','Trebuchet MS, sans-serif','Courier New, monospace'];
    return `<label class="field">${label}<select ${attrs}>${[...new Set(fonts)].map(font=>`<option value="${escapeHTML(font)}" ${font===value?'selected':''}>${escapeHTML(font)}</option>`).join('')}</select></label>`;
  }
  if(type==='textarea')return `<label class="field">${label}<textarea ${attrs} rows="3">${escapeHTML(value)}</textarea></label>`;
  if(type==='checkbox')return `<label class="field checkbox"><input type="checkbox" ${attrs} ${value?'checked':''}>${label}</label>`;
  return `<label class="field">${label}<input type="${type}" ${attrs} value="${escapeHTML(value)}"></label>`;
}
function renderDesign() {
  $('#brand-fields').innerHTML=field('Nombre','brand.name',data.design.brand.name)+field('Subtítulo','brand.subtitle',data.design.brand.subtitle)+field('Título de la pestaña','brand.pageTitle',data.design.brand.pageTitle)+field('Logo (ruta opcional)','brand.logoImage',data.design.brand.logoImage);
  $('#theme-presets').innerHTML=palettes.map((p,i)=>`<button data-palette="${i}"><span class="palette-swatches">${[p.colors[0],p.colors[5],p.colors[7]].map(color=>`<span style="background:${color}"></span>`).join('')}</span>${p.name}</button>`).join('');
  $('#color-fields').innerHTML=H52Data.colorFields.map(key=>`<div class="color-field"><label><input type="color" aria-label="${displayNames[key]}" data-target="design" data-path="theme.${key}" value="${data.design.theme[key]}"><span>${displayNames[key]}</span></label><input type="text" aria-label="${displayNames[key]} hexadecimal" data-target="design" data-path="theme.${key}" value="${data.design.theme[key]}" spellcheck="false"></div>`).join('')+'<div id="contrast-check"></div>';
  $('#format-fields').innerHTML=field('Tipografía de títulos','theme.fontDisplay',data.design.theme.fontDisplay)+field('Tipografía de texto','theme.fontBody',data.design.theme.fontBody)+field('Radio de tarjetas (0–8)','theme.cardRadius',data.design.theme.cardRadius,'number')+field('Ancho máximo (800–1800)','theme.contentWidth',data.design.theme.contentWidth,'number');
  $('#hero-fields').innerHTML=field('Imagen','hero.image',data.design.hero.image)+field('Descripción de imagen','hero.imageAlt',data.design.hero.imageAlt)+field('Texto superior','hero.eyebrow',data.design.hero.eyebrow)+field('Título (una línea por renglón)','hero.titleLines',data.design.hero.titleLines.join('\n'),'textarea')+field('Línea con acento (empieza en 0)','hero.accentLine',data.design.hero.accentLine,'number')+field('Descripción','hero.description',data.design.hero.description,'textarea')+field('Botón','hero.button',data.design.hero.button)+field('Texto al pie de la foto','hero.caption',data.design.hero.caption)+field('Posición de foto en escritorio','hero.desktopPosition',data.design.hero.desktopPosition)+field('Posición de foto en celular','hero.mobilePosition',data.design.hero.mobilePosition);
  $('#other-fields').innerHTML=Object.keys(data.design.navigation).map(key=>field(`Navegación: ${key}`,`navigation.${key}`,data.design.navigation[key])).join('')+field('Frase del pie','footer.message',data.design.footer.message)+field('Enlace del pie','footer.linkText',data.design.footer.linkText)+field('Texto pequeño del pie','footer.eyebrow',data.design.footer.eyebrow)+field('Servicio (%)','order.servicePercent',data.design.order.servicePercent,'number');
  $('#section-fields').innerHTML=data.design.homeSections.map((section,i)=>`<div class="section-editor"><h3>${escapeHTML(section.title)}</h3>${field('Título',`homeSections.${i}.title`,section.title)}${field('Texto superior',`homeSections.${i}.eyebrow`,section.eyebrow)}<label class="field">Tipo de productos<select data-target="design" data-path="homeSections.${i}.categoryId"><option value="all" ${section.categoryId==='all'?'selected':''}>Todos los tipos</option>${data.catalog.categories.map(c=>`<option value="${escapeHTML(c.id)}" ${section.categoryId===c.id?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select></label>${field('Cantidad (0 = todos)',`homeSections.${i}.limit`,section.limit,'number')}<label class="field">Presentación<select data-target="design" data-path="homeSections.${i}.layout"><option value="featured" ${section.layout==='featured'?'selected':''}>Destacados</option><option value="list" ${section.layout==='list'?'selected':''}>Lista</option></select></label></div>`).join('');
  $('#label-fields').innerHTML=Object.entries(data.design.labels).map(([key,value])=>field(key,`labels.${key}`,value)).join('');
  renderService();
}
function renderCategories(){
  if(!data.catalog.categories.some(c=>c.id===selectedCategoryId))selectedCategoryId=data.catalog.categories[0]?.id;
  $('#category-select').innerHTML=data.catalog.categories.map(c=>`<option value="${escapeHTML(c.id)}" ${c.id===selectedCategoryId?'selected':''}>${escapeHTML(c.name)}</option>`).join('');
  const c=data.catalog.categories.find(c=>c.id===selectedCategoryId);
  $('#category-fields').innerHTML=c?field('Nombre','name',c.name,'text','category')+field('Subtítulo','subtitle',c.subtitle,'text','category')+field('Ícono Lucide','icon',c.icon,'text','category')+field('Orden','order',c.order,'number','category'):'';
}
function selected(){return data.catalog.products.find(p=>p.id===selectedId);}
function renderProducts() {
  const categoryFilter=$('#editor-category').value;
  const options=data.catalog.products.filter(p=>!categoryFilter||p.classification.categoryId===categoryFilter);
  if(!options.some(p=>p.id===selectedId))selectedId=options[0]?.id;
  $('#product-select').innerHTML=options.map(p=>`<option value="${escapeHTML(p.id)}" ${p.id===selectedId?'selected':''}>${escapeHTML(p.name)}</option>`).join('');
  $('#duplicate-product').disabled=!selectedId;$('#delete-product').disabled=!selectedId;
  const p=selected();if(!p){$('#product-fields').innerHTML='';return;}
  $('#product-fields').innerHTML=field('Nombre','name',p.name,'text','product')+field('Descripción','description',p.description,'textarea','product')+field('Precio','price',p.price,'number','product')+`<label class="field">Categoría<select data-target="product" data-path="classification.categoryId">${data.catalog.categories.map(c=>`<option value="${escapeHTML(c.id)}" ${c.id===p.classification.categoryId?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select></label>`+field('Subcategoría','classification.subcategory',p.classification.subcategory,'text','product')+field('Etiquetas (separadas por coma)','classification.tags',p.classification.tags.join(', '),'text','product')+field('Clasificación alimentaria (separada por coma)','classification.dietary',p.classification.dietary.join(', '),'text','product')+field('Imagen','image',p.image,'text','product')+field('Descripción de imagen','imageAlt',p.imageAlt,'text','product')+field('Insignia','badge',p.badge,'text','product')+field('Ingredientes (separados por coma)','ingredients',p.ingredients.join(', '),'textarea','product')+field('Alérgenos (vacío = sin información)','allergens',p.allergens?.join(', ')||'','text','product')+field('Porción','serving',p.serving||'','text','product')+field('Preparación en minutos (opcional)','preparationMinutes',p.preparationMinutes??'','number','product')+field('Alcohol % (opcional)','alcoholPercent',p.alcoholPercent??'','number','product')+field('Orden','order',p.order,'number','product')+field('Disponible','available',p.available,'checkbox','product')+field('Destacado','featured',p.featured,'checkbox','product');
  renderCustomizationFields();
  organizeProductFields(p);
  renderEditorCatalog();
}
function renderCustomizationFields(){const p=selected();if(!p)return;const c=p.customization||{removable:[],allowNote:true};$('#product-fields').querySelectorAll('.field')[2].insertAdjacentHTML('afterend',`${field('Opciones para quitar (una por línea)','customization.removable',c.removable.join('\n'),'textarea','product')}${field('Permitir indicaciones escritas','customization.allowNote',c.allowNote,'checkbox','product')}`);}
function raw(){ $('#raw-design').value=JSON.stringify(data.design,null,2);$('#raw-products').value=JSON.stringify(data.catalog,null,2); }
function status(text,error=false){$('#editor-status').textContent=text;$('#editor-status').classList.toggle('error',error);}
function update(record=true) {
  try {
    H52Data.validate(data.design,data.catalog);const snapshot=JSON.stringify(data);
    if(record&&history[historyIndex]!==snapshot){history=history.slice(0,historyIndex+1);history.push(snapshot);if(history.length>80)history.shift();historyIndex=history.length-1;}
    $('#undo').disabled=historyIndex<=0;$('#redo').disabled=historyIndex>=history.length-1;
    const theme=data.design.theme;
    $('#contrast-check').innerHTML=[['Texto',theme.text,theme.background],['Botones',theme.accentText,theme.accent]].map(([label,a,b])=>{const ratio=contrast(a,b);return `<span class="${ratio<4.5?'contrast-low':''}">${label} <strong>${ratio.toFixed(1)}:1</strong> ${ratio<4.5?'· revisar contraste':'· AA'}</span>`;}).join('');
    raw();if(ready)$('#preview').contentWindow.postMessage({type:'h52-preview',payload:data},'*');
    window.H52EditorSync?.changed(data);
    renderEditorCatalog();
    window.lucide?.createIcons();
    let backedUp=false;if(history.length>1){try{localStorage.setItem(draftKey,JSON.stringify({updatedAt:Date.now(),payload:data}));backedUp=true;}catch{}}
    status(backedUp?'Borrador guardado en este navegador':'Vista previa actualizada');return true;
  } catch(error){status(error.message,true);return false;}
}
function download(name,content,type='application/json') {
  if(!update())return;const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('input',event=> {
  const input=event.target;if(!input.dataset.path||!data)return;const path=input.dataset.path;
  let value=input.type==='checkbox'?input.checked:['number','range'].includes(input.type)?(input.value===''?null:Number(input.value)):input.value;
  if(input.type==='range')input.closest('.field').querySelector('output').textContent=value;
  if(path==='hero.titleLines')value=value.split('\n').filter(Boolean);
  if(['classification.tags','classification.dietary','ingredients','allergens'].includes(path))value=input.value.trim()?input.value.split(',').map(x=>x.trim()).filter(Boolean):path==='allergens'?null:[];
  if(path==='serving'&&!value)value=null;
  if(path==='customization.removable')value=input.value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(path==='order.defaultTable')value=data.design.order.tables.find(table=>String(table)===String(input.value));
  const target=input.dataset.target==='product'?selected():input.dataset.target==='category'?data.catalog.categories.find(c=>c.id===selectedCategoryId):data.design;
  if(input.dataset.target==='product'&&path.startsWith('customization.'))target.customization??={removable:[],allowNote:true};
  setPath(target,path,value);
  if(input.dataset.target==='product'&&path==='image'){delete target.imageCrop;delete target.imageIllustrative;}
  if(/^homeSections\.\d+\.categoryId$/.test(path))delete data.design.homeSections[Number(path.split('.')[1])].productIds;
  if(path.startsWith('theme.'))document.querySelectorAll(`[data-path="${path}"]`).forEach(el=>{if(el!==input&&/^#[\da-f]{6}$/i.test(value))el.value=value;});
  update();
});
document.addEventListener('click',event=> {
  const button=event.target.closest('button');if(!button||!data)return;
  if(button.id==='restore-draft'&&savedDraft){try{H52Data.validate(savedDraft.payload.design,savedDraft.payload.catalog);data=structuredClone(savedDraft.payload);selectedId=data.catalog.products[0]?.id;renderDesign();renderCategories();renderProducts();$('#draft-tools').hidden=true;update();}catch(error){status(error.message,true);}}
  if(button.dataset.tab){document.querySelectorAll('.editor-tabs button').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.editor-view').forEach(el=>el.hidden=el.id!==`${button.dataset.tab}-tab`);if(button.dataset.tab==='json')raw();if(button.dataset.tab==='design')renderDesign();if(button.dataset.tab==='service')renderService();if(button.dataset.tab==='products'){renderCategories();renderProducts();}}
  if(button.dataset.width){$('#preview').classList.toggle('mobile',button.dataset.width==='mobile');$('#preview').classList.toggle('tablet',button.dataset.width==='tablet');document.querySelectorAll('[data-width]').forEach(b=>b.classList.toggle('active',b===button));}
  if(button.dataset.palette!==undefined){palettes[Number(button.dataset.palette)].colors.forEach((color,i)=>data.design.theme[H52Data.colorFields[i]]=color);renderDesign();update();}
  if(['undo','redo'].includes(button.id)){const next=historyIndex+(button.id==='undo'?-1:1);if(next>=0&&next<history.length){historyIndex=next;data=JSON.parse(history[next]);selectedId=data.catalog.products.some(p=>p.id===selectedId)?selectedId:data.catalog.products[0]?.id;renderDesign();renderCategories();renderProducts();update(false);}}
  if(button.id==='new-category'){const id='categoria-'+Date.now();data.catalog.categories.push({id,name:'Nueva categoría',subtitle:'',icon:'utensils',order:data.catalog.categories.length+1});selectedCategoryId=id;renderCategories();renderProducts();update();}
  if(button.id==='duplicate-product'&&selected()){const p=structuredClone(selected());p.id='producto-'+Date.now();p.name+=' (copia)';p.order=data.catalog.products.length+1;data.catalog.products.push(p);selectedId=p.id;renderProducts();update();}
  if(button.id==='download-design')download('design.json',JSON.stringify(data.design,null,2));
  if(button.id==='download-products')download('products.json',JSON.stringify(data.catalog,null,2));
  if(button.dataset.export==='design')download('design.json',JSON.stringify(data.design,null,2));
  if(button.dataset.export==='products')download('products.json',JSON.stringify(data.catalog,null,2));
  if(button.id==='download-offline')download('offline-data.js',`window.H52_OFFLINE_DATA = ${JSON.stringify(data)};`,'text/javascript');
  if(button.id==='apply-json'){try{const next=H52Data.validate(JSON.parse($('#raw-design').value),JSON.parse($('#raw-products').value));data=next;selectedId=data.catalog.products[0]?.id;renderDesign();renderCategories();renderProducts();update();}catch(error){status(error.message,true);}}
  if(button.id==='new-product'){
    openCreateProduct();
  }
  if(button.id==='delete-product'){
    if(!selected()||!confirm(`Eliminar ${selected().name}? Puedes recuperarlo con Deshacer.`))return;
    data.catalog.products=data.catalog.products.filter(p=>p.id!==selectedId);data.design.homeSections.forEach(s=>{if(s.productIds)s.productIds=s.productIds.filter(id=>id!==selectedId);});selectedId=data.catalog.products[0]?.id;renderProducts();update();
  }
});
$('#product-select').addEventListener('change',()=>{selectedId=$('#product-select').value;renderProducts();});
$('#category-select').addEventListener('change',()=>{selectedCategoryId=$('#category-select').value;renderCategories();});
$('#preview-route').addEventListener('change',()=>{$('#preview').src='index.html#'+$('#preview-route').value;ready=false;});
for(const kind of ['design','products'])$('#import-'+kind).addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{const next=structuredClone(data);next[kind==='design'?'design':'catalog']=JSON.parse(await file.text());data=H52Data.validate(next.design,next.catalog);selectedId=data.catalog.products[0]?.id;renderDesign();renderCategories();renderProducts();update();}catch(error){status(error.message,true);}event.target.value='';
});
window.addEventListener('message',event=>{if(event.source!==$('#preview').contentWindow)return;if(event.data?.type==='h52-ready'){ready=true;if(data)update();}if(event.data?.type==='h52-preview-error')status(event.data.message,true);});
$('#preview').addEventListener('load',()=>{ready=true;if(data)update();});
function replaceShared(next) {
  data=H52Data.validate(next.design,next.catalog);history=[];historyIndex=-1;
  selectedId=data.catalog.products[0]?.id;renderDesign();renderCategories();renderProducts();update();
}
H52Data.load().then(next=>{replaceShared(next);$('#draft-tools').hidden=!savedDraft?.payload;window.lucide?.createIcons();window.H52EditorSync?.start(data,replaceShared);}).catch(error=>status(error.message,true));
