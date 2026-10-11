(function () {
  const colorFields = ['background','surface','surfaceRaised','text','muted','accent','accentText','secondary','border','heroShade'];
  function adaptCatalog(input){
    if(Array.isArray(input.categories))return input;
    if(!Array.isArray(input.products))return input;
    const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const names=[...new Set(input.products.map(p=>p.category))];
    const icons={'Hamburguesas':'sandwich','Lomos':'sandwich','Papas H52':'utensils','Para picar':'flame','Pizzas':'pizza','Alfajores':'cookie','Promos':'sparkles','Cerveza':'beer','Tragos':'martini','Vinos y espumantes':'wine','Whisky':'glass-water','Bebidas sin alcohol':'cup-soda','Indumentaria':'shirt'};
    return {...input,schemaVersion:1,categories:names.map((name,i)=>({id:slug(name),name,subtitle:'',icon:icons[name]||'utensils',order:i+1})),products:input.products.map((p,i)=>({...p,id:String(p.id),sourceId:p.id,imageAlt:p.imageAlt||p.name,classification:{categoryId:slug(p.category),subcategory:p.subcategory||'',section:p.section||'',tags:p.tag?[p.tag]:[],dietary:[]},ingredients:Array.isArray(p.ingredients)?p.ingredients:p.ingredients?[p.ingredients]:[],allergens:Array.isArray(p.allergens)||p.allergens===null?p.allergens:p.allergens?[p.allergens]:null,featured:String(p.id)===String(input.featuredComboId),badge:String(p.id)===String(input.featuredComboId)?'COMBO DESTACADO':'',order:i+1,serving:p.serving??null,preparationMinutes:p.preparationMinutes??null,alcoholPercent:p.alcoholPercent??null,customization:p.customization||{removable:['Hamburguesas','Lomos'].includes(p.category)?['Papas']:[],allowNote:true}}))};
  }
  function validate(design, catalog) {
    catalog=adaptCatalog(catalog);
    if (!design?.brand?.name || !design.hero || !design.labels || !design.navigation || !design.order || !Array.isArray(design.homeSections)) throw new Error('Faltan secciones obligatorias en design.json.');
    if (!Array.isArray(design.hero.titleLines) || !design.hero.titleLines.length) throw new Error('hero.titleLines debe contener títulos.');
    colorFields.forEach(key => { if (!/^#[0-9a-f]{6}$/i.test(design.theme?.[key] || '')) throw new Error(`Color inválido: theme.${key}. Usá #RRGGBB.`); });
    if (!Number.isFinite(design.theme.cardRadius) || design.theme.cardRadius < 0 || design.theme.cardRadius > 8) throw new Error('cardRadius debe estar entre 0 y 8.');
    if (!Number.isFinite(design.theme.contentWidth) || design.theme.contentWidth < 800 || design.theme.contentWidth > 1800) throw new Error('contentWidth debe estar entre 800 y 1800.');
    if (!Array.isArray(design.order.tables) || !design.order.tables.length || !design.order.tables.includes(design.order.defaultTable)) throw new Error('La mesa predeterminada debe existir en order.tables.');
    if (!Number.isFinite(design.order.servicePercent) || design.order.servicePercent < 0 || design.order.servicePercent > 100) throw new Error('servicePercent debe estar entre 0 y 100.');
    if (!Number.isInteger(design.order.maxQuantity) || design.order.maxQuantity < 1 || design.order.maxQuantity > 999) throw new Error('maxQuantity debe estar entre 1 y 999.');
    try { new Intl.NumberFormat(design.order.locale,{style:'currency',currency:design.order.currency}); } catch { throw new Error('Moneda o idioma inválidos.'); }
    if (!Array.isArray(catalog?.categories) || !Array.isArray(catalog.products)) throw new Error('products.json necesita categories y products.');
    const ids = new Set(), categoryIds = new Set();
    catalog.categories.forEach(c => { if (!c.id || c.id === 'all' || categoryIds.has(c.id) || !c.name) throw new Error('Categoría inválida o duplicada.'); categoryIds.add(c.id); });
    catalog.products.forEach(p => {
      if (!p.id || ids.has(p.id) || !p.name || typeof p.description !== 'string') throw new Error('Producto inválido o ID duplicado.'); ids.add(p.id);
      if (!Number.isFinite(p.price) || p.price < 0) throw new Error(`Precio inválido: ${p.id}.`);
      if (!categoryIds.has(p.classification?.categoryId)) throw new Error(`Categoría inexistente: ${p.id}.`);
      for (const key of ['tags','dietary']) if (!Array.isArray(p.classification[key]) || p.classification[key].some(value=>typeof value!=='string')) throw new Error(`${p.id}: classification.${key} debe ser una lista de textos.`);
      if (!Array.isArray(p.ingredients) || !(p.allergens === null || Array.isArray(p.allergens))) throw new Error(`${p.id}: revisá ingredients y allergens.`);
      if (p.ingredients.some(value=>typeof value!=='string') || p.allergens?.some(value=>typeof value!=='string')) throw new Error(`${p.id}: ingredientes y alérgenos deben ser textos.`);
      if (!Number.isFinite(p.order)) throw new Error(`${p.id}: order debe ser un número.`);
      if (typeof p.available !== 'boolean' || typeof p.featured !== 'boolean') throw new Error(`${p.id}: available y featured deben ser true o false.`);
      for (const field of ['preparationMinutes','alcoholPercent']) if (p[field] !== null && (!Number.isFinite(p[field]) || p[field] < 0)) throw new Error(`${p.id}: ${field} debe ser número o null.`);
      if (p.alcoholPercent>100) throw new Error(`${p.id}: alcoholPercent no puede superar 100.`);
      if(p.imageCrop!==undefined){const c=p.imageCrop;if(!Array.isArray(c)||c.length!==4||c.some(v=>!Number.isFinite(v)||v<0)||c[2]<=0||c[3]<=0||c[2]>=1||c[3]>=1||c[0]+c[2]>1.000001||c[1]+c[3]>1.000001)throw new Error(`${p.id}: recorte de imagen inválido.`);}
      if(p.extras!==undefined){if(!Array.isArray(p.extras)||p.extras.some(e=>!e.id||typeof e.name!=='string'||!Number.isFinite(e.price)||e.price<0||typeof e.available!=='boolean')||new Set(p.extras.map(e=>String(e.id))).size!==p.extras.length)throw new Error(`${p.id}: extras inválidos.`);}
      if(p.customization!==undefined){const c=p.customization;if(!c||!Array.isArray(c.removable)||c.removable.some(value=>typeof value!=='string'||!value.trim())||new Set(c.removable).size!==c.removable.length||typeof c.allowNote!=='boolean')throw new Error(`${p.id}: customization necesita removable (textos únicos) y allowNote (true/false).`);}
    });
    design.homeSections.forEach(s => {
      if (!s.id || !s.title || !['featured','list'].includes(s.layout) || !Number.isInteger(s.limit) || s.limit < 0) throw new Error('Sección de inicio inválida.');
      if (s.categoryId !== 'all' && !categoryIds.has(s.categoryId)) throw new Error(`Sección ${s.id}: categoría inexistente.`);
      if (s.productIds?.some(id => !ids.has(id))) throw new Error(`Sección ${s.id}: producto inexistente.`);
    });
    return {design,catalog};
  }
  async function load() {
    if (location.protocol === 'file:') return validate(window.H52_OFFLINE_DATA.design,window.H52_OFFLINE_DATA.catalog);
    const results = await Promise.all(['config/design.json','config/products.json'].map(async url => {
      const response = await fetch(url,{cache:'no-store'});
      if (!response.ok) throw new Error(`No se pudo leer ${url}.`);
      return response.json();
    }));
    return validate(...results);
  }
  window.H52Data = {validate,load,colorFields,adaptCatalog};
})();
