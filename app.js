const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeImage = value => /^(https?:\/\/|assets\/)/i.test(value || '') ? value : '';
const icon = name => `<i data-lucide="${esc(name)}"></i>`;
const icons = () => window.lucide?.createIcons();
history.scrollRestoration = 'manual';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let design, catalog, products, categories, cart = [], favorites = [], category = 'all', view = 'inicio', layout = 'grid', detailId, detailQuantity = 1, lastFocus, toastTimer, submittingOrder = false;
const productQuantity=id=>H52Order.quantity(cart,id);
const t = key => design.labels[key] ?? key;
const money = value => new Intl.NumberFormat(design.order.locale,{style:'currency',currency:design.order.currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
const normalized = value => String(value).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function setMenu(open) { $('#mobile-menu').hidden=!open;const button=$('.menu-toggle');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',t(open?'closeMenu':'openMenu'));button.title=t(open?'closeMenu':'openMenu'); }
const storageKey = suffix => `${design.order.storageKey}${window.parent!==window?'_preview':''}_${suffix}`;
function save() {
  try { localStorage.setItem(storageKey('cart'),JSON.stringify(cart)); localStorage.setItem(storageKey('favorites'),JSON.stringify(favorites)); localStorage.setItem(storageKey('table'),JSON.stringify($('#table').value)); localStorage.setItem(storageKey('layout'),JSON.stringify(layout)); } catch {}
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'),2200); }
function applyConfig(next, preserve = false) {
  H52Data.validate(next.design,next.catalog);
  design=next.design; catalog=H52Data.adaptCatalog(next.catalog); products=catalog.products; categories=[...catalog.categories].sort((a,b)=>a.order-b.order);
  const colors={background:'bg',surface:'surface',surfaceRaised:'raised',text:'text',muted:'muted',accent:'red',accentText:'accent-text',secondary:'secondary',border:'line',heroShade:'hero-shade'};
  Object.entries(colors).forEach(([key,variable])=>document.documentElement.style.setProperty(`--${variable}`,design.theme[key]));
  document.documentElement.style.setProperty('--serif',design.theme.fontDisplay);
  document.documentElement.style.setProperty('--body-font',design.theme.fontBody);
  document.documentElement.style.setProperty('--card-radius',`${design.theme.cardRadius}px`);
  document.documentElement.style.setProperty('--content-width',`${design.theme.contentWidth}px`);
  document.documentElement.style.setProperty('--hero-position',design.hero.desktopPosition);
  document.documentElement.style.setProperty('--hero-mobile-position',design.hero.mobilePosition);
  document.title=design.brand.pageTitle; $('meta[name="theme-color"]').content=design.theme.background;
  document.querySelectorAll('.brand').forEach(el=> {
    el.innerHTML=design.brand.logoImage?`<img src="${esc(safeImage(design.brand.logoImage))}" alt="${esc(design.brand.name)}">`:`<span class="brand-name">${esc(design.brand.name)}</span><span class="brand-subtitle">${esc(design.brand.subtitle)}</span>`;
    el.setAttribute('aria-label',`${design.brand.name}, ${design.navigation.home}`);
  });
  document.querySelectorAll('[data-label]').forEach(el=>el.textContent=t(el.dataset.label));
  document.querySelectorAll('[data-nav]').forEach(el=>el.textContent=design.navigation[el.dataset.nav]);
  $('.hero>img').src=safeImage(design.hero.image); $('.hero>img').alt=design.hero.imageAlt;
  $('.hero .eyebrow').textContent=design.hero.eyebrow;
  $('.hero h1').innerHTML=design.hero.titleLines.map((line,i)=>`<span class="${i===design.hero.accentLine?'accent-line':''}">${esc(line)}</span>`).join('');
  $('.hero-description').textContent=design.hero.description;
  $('.hero-cta-text').textContent=design.hero.button; $('.hero-caption').textContent=design.hero.caption;
  $('.hero-side-note').textContent=`01 / ${String(design.homeSections.length).padStart(2,'0')}`;
  $('.footer-eyebrow').textContent=design.footer.eyebrow; $('.footer-message').textContent=design.footer.message; $('.footer-link-text').textContent=design.footer.linkText;
  $('#search').placeholder=t('search'); $('#search').setAttribute('aria-label',t('search'));
  $('#sort').innerHTML=[['featured','sortFeatured'],['low','sortLow'],['high','sortHigh'],['name','sortName']].map(([value,key])=>`<option value="${value}">${esc(t(key))}</option>`).join('');
  const currentTable=$('#table').value;
  $('#table').innerHTML=design.order.tables.map(n=>`<option value="${esc(n)}">${esc(t('table'))} ${esc(n)}</option>`).join('');
  const selectedTable=preserve?currentTable:String(read(storageKey('table'),design.order.defaultTable));
  $('#table').value=design.order.tables.map(String).includes(selectedTable)?selectedTable:String(design.order.defaultTable);
  $('#table').setAttribute('aria-label',t('table'));
  document.querySelectorAll('.cart-toggle').forEach(el=>el.setAttribute('aria-label',design.navigation.order));
  document.querySelectorAll('.close-order,#close-confirm,#close-details').forEach(el=>el.setAttribute('aria-label',t('close')));
  document.querySelectorAll('.editor-link').forEach(el=>{el.title=t('edit');el.setAttribute('aria-label',t('edit'));});
  $('.header-favorite').setAttribute('aria-label',design.navigation.favorites);
  $('.menu-toggle').setAttribute('aria-label',t('openMenu'));$('.menu-toggle').title=t('openMenu');$('#mobile-menu').setAttribute('aria-label',design.navigation.menu);
  $('#sort').setAttribute('aria-label',t('sortFeatured'));
  $('#clear-search').setAttribute('aria-label',t('clearSearch'));
  $('#dietary-filter').setAttribute('aria-label',t('preferences'));
  $('#dietary-filter').innerHTML=`<option value="">${esc(t('preferences'))}</option>`+[...new Set(products.flatMap(p=>p.classification.dietary))].sort().map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
  $('#dietary-filter').hidden=$('#dietary-filter').options.length===1;
  document.querySelectorAll('[data-layout]').forEach(el=>{el.title=t(el.dataset.layout==='grid'?'gridView':'listView');el.setAttribute('aria-label',el.title);});
  if(!preserve){cart=read(storageKey('cart'),{});favorites=read(storageKey('favorites'),[]);layout=read(storageKey('layout'),'grid')==='list'?'list':'grid';}
  cart=H52Order.normalize(cart,products,design.order.maxQuantity);
  favorites=Array.isArray(favorites)?favorites.filter(id=>products.some(p=>p.id===id)):[];
  if(category!=='all'&&!categories.some(c=>c.id===category))category='all';
  route(preserve);renderOrder();icons();
}
function favoriteButton(p) { return `<button class="icon-button favorite ${favorites.includes(p.id)?'active':''}" data-favorite="${esc(p.id)}" aria-label="${esc(t('save')+' '+p.name)}" title="${esc(t('save'))}" aria-pressed="${favorites.includes(p.id)}">${icon('heart')}</button>`; }
function productPhoto(p, className='') {
  const crop=p.imageCrop;
  if(!Array.isArray(crop)||crop.length!==4||crop.some(v=>!Number.isFinite(v))||crop[2]<=0||crop[3]<=0)
    return `<img class="${esc(className)}" src="${esc(safeImage(p.image))}" alt="${esc(p.imageAlt||p.name)}" loading="lazy">`;
  const [x,y,w,h]=crop;
  const url=safeImage(p.image).replace(/["'()\\]/g,c=>encodeURIComponent(c));
  return `<span role="img" aria-label="${esc(p.imageAlt||p.name)}" class="menu-photo ${esc(className)}" style="background-image:url('${esc(url)}');background-size:${100/w}% ${100/h}%;background-position:${100*x/(1-w)}% ${100*y/(1-h)}%"></span>`;
}
function productCard(p, compact = false) {
  const cat=categories.find(c=>c.id===p.classification.categoryId);
  return `<article class="product ${p.available?'':'unavailable'}"><div class="product-image"><button class="image-link" data-detail="${esc(p.id)}" aria-label="${esc(t('details')+' '+p.name)}">${productPhoto(p)}</button>${compact?'':favoriteButton(p)}${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''}</div><div class="product-body">${compact?favoriteButton(p):''}<p class="product-category">${esc(cat.name)}${p.classification.subcategory?` / ${esc(p.classification.subcategory)}`:''}</p><h3><button class="title-link" data-detail="${esc(p.id)}">${esc(p.name)}</button></h3><p class="product-description">${esc(p.description)}</p>${p.classification.dietary.length?`<div class="dietary-tags">${p.classification.dietary.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add" data-add="${esc(p.id)}" aria-label="${esc(t('add')+' '+p.name)}" title="${esc(p.available?t('add'):t('unavailable'))}" ${p.available?'':'disabled'}>${icon(p.available?'plus':'ban')}</button></div>${p.available?'':`<span class="availability">${esc(t('unavailable'))}</span>`}</div></article>`;
}
function renderHomeSection(section, index) {
  const unlimited=section.limit===0;
  let list=section.productIds&&!unlimited?section.productIds.map(id=>products.find(p=>p.id===id)):products.filter(p=>section.categoryId==='all'?(unlimited||p.featured):p.classification.categoryId===section.categoryId);
  list=list.filter(Boolean).sort((a,b)=>section.productIds&&!unlimited?0:a.order-b.order).slice(0,unlimited?undefined:section.limit);
  if(!list.length)return '';
  return `<section class="menu-section"><div class="section-heading"><div><p class="eyebrow">${esc(section.eyebrow)}</p><h2>${esc(section.title)}</h2></div><a href="#carta" data-filter="${esc(section.categoryId)}">${esc(t('viewAll'))} ${icon('arrow-up-right')}</a><span class="section-number">${String(index+1).padStart(2,'0')}</span></div>${unlimited&&section.categoryId==='all'?`<div class="grouped-products">${renderGroups(list)}</div>`:`<div class="${section.layout==='list'?'list-grid':'featured-grid'}">${list.map(p=>productCard(p,section.layout==='list')).join('')}</div>`}</section>`;
}
function renderGroups(list){return categories.map(c=>{const items=list.filter(p=>p.classification.categoryId===c.id);return items.length?`<section class="catalog-group" data-group="${esc(c.id)}"><div class="group-heading"><span class="group-icon">${icon(c.icon)}</span><div><h2>${esc(c.name)}</h2><p>${esc(c.subtitle||'')}</p></div><span class="group-count">${String(items.length).padStart(2,'0')}</span></div><div class="group-items">${items.map(p=>productCard(p)).join('')}</div></section>`:'';}).join('');}
function renderProducts() {
  const query=normalized($('#search').value);
  const favoritesOnly=$('#favorites-only').checked;
  let list=products.filter(p=>(category==='all'||p.classification.categoryId===category)&&(!favoritesOnly||favorites.includes(p.id))&&normalized([p.name,p.description,p.classification.subcategory,...p.classification.tags,...p.classification.dietary,...p.ingredients].join(' ')).includes(query));
  const sort=$('#sort').value;
  list.sort((a,b)=>sort==='low'?a.price-b.price:sort==='high'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name):Number(b.featured)-Number(a.featured)||a.order-b.order);
  $('#result-count').textContent=`${list.length} ${t('results')}`;
  $('#heading').textContent=favoritesOnly?t('favoritesTitle'):category==='all'?t('catalogTitle'):categories.find(c=>c.id===category).name;
  $('#selection-label').textContent=category==='all'?t('allFlavors'):categories.find(c=>c.id===category).name;
  $('#category-description').textContent=category==='all'?t('catalogDescription'):categories.find(c=>c.id===category).subtitle;
  $('#clear-search').hidden=!$('#search').value;
  const options=[{id:'all',name:t('all'),icon:'utensils'},...categories];
  $('#categories').innerHTML=options.map(c=>`<button data-category="${esc(c.id)}" class="${category===c.id?'active':''}" aria-pressed="${category===c.id}" title="${esc(c.subtitle||c.name)}"><span class="category-icon">${icon(c.icon)}</span><span>${esc(c.name)}</span><small>${products.filter(p=>c.id==='all'||p.classification.categoryId===c.id).length}</small></button>`).join('');
  $('#products').classList.toggle('catalog-list',layout==='list');
  document.querySelectorAll('[data-layout]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.layout===layout)));
  $('#catalog-controls').hidden=false;$('#products').classList.remove('home-products');$('.header-favorite').setAttribute('aria-pressed',String(favoritesOnly));
  $('#favorite-count').textContent=favorites.length;$('#favorite-count').hidden=!favorites.length;
  const grouped=category==='all';$('#products').classList.toggle('grouped-products',grouped);
  $('#products').innerHTML=list.length?(grouped?renderGroups(list):list.map(p=>productCard(p)).join('')):`<div class="no-results">${icon(favoritesOnly?'heart':'search')}<h3>${esc(t(favoritesOnly?'emptyFavorites':'noResults'))}</h3><button class="outline-button" id="reset-filters">${esc(t('reset'))} ${icon('arrow-right')}</button></div>`;
  document.querySelectorAll('.product-image img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;img.closest('.product-image').classList.add('image-missing');},{once:true}));renderOrder();icons();
}
function totals() { return H52Order.totals(cart,products,design.order.servicePercent); }
function lineNotes(line){const p=products.find(p=>p.id===line.productId);return [...line.without.map(value=>`${t('without')} ${value}`),...(line.extras||[]).map(id=>`+ ${p.extras?.find(e=>String(e.id)===id)?.name||id}`),line.note].filter(Boolean).join(' · ');}
function orderPayload() {
  const values=totals();
  return {
    clientOrderId: crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tableNumber: $('#table').value,
    status: 'new',
    kitchenStatus: 'waiting',
    items: cart.map(line => {
      const p=products.find(product=>product.id===line.productId);
      return {
        productId: line.productId,
        name: p.name,
        quantity: line.quantity,
        unitPrice: H52Order.unitPrice(line,products),
        total: H52Order.unitPrice(line,products)*line.quantity,
        without: line.without,
        extras: (line.extras||[]).map(id=>p.extras?.find(e=>String(e.id)===id)?.name||id),
        notes: line.note
      };
    }),
    totals: values
  };
}
function renderOrder() {
  const entries=cart, count=cart.reduce((sum,line)=>sum+line.quantity,0), values=totals();
  $('#count').textContent=count;$('#count').hidden=!count;$('#order-table').textContent=`${t('table')} ${$('#table').value}`;
  $('#order-items').innerHTML=entries.length?entries.map(line=>{const p=products.find(p=>p.id===line.productId);return `<div class="order-item">${productPhoto(p)}<div><h3>${esc(p.name)}</h3>${lineNotes(line)?`<p class="line-notes">${esc(lineNotes(line))}</p>`:''}<strong>${money(H52Order.unitPrice(line,products)*line.quantity)}</strong><div class="stepper"><button data-line-minus="${esc(line.key)}" aria-label="${esc(t('minus')+' '+p.name)}">${icon('minus')}</button><span>${line.quantity}</span><button data-line-plus="${esc(line.key)}" aria-label="${esc(t('plus')+' '+p.name)}" ${productQuantity(p.id)>=design.order.maxQuantity?'disabled':''}>${icon('plus')}</button><button class="remove" data-line-remove="${esc(line.key)}" aria-label="${esc(t('remove')+' '+p.name)}">${icon('trash-2')}</button></div></div></div>`;}).join(''):`<div class="empty">${icon('shopping-bag')}<h3>${esc(t('emptyOrderTitle'))}</h3><p>${esc(t('emptyOrderDescription'))}</p></div>`;
  $('#totals').innerHTML=entries.length?`<div class="total-row"><span>${esc(t('subtotal'))}</span><span>${money(values.subtotal)}</span></div><div class="total-row"><span>${esc(t('service'))} · ${design.order.servicePercent}%</span><span>${money(values.service)}</span></div><div class="total-row final"><span>${esc(t('total'))}</span><span>${money(values.total)}</span></div><button class="primary" id="review-order">${esc(t('reviewOrder'))} ${icon('arrow-right')}</button><p class="order-note">${esc(window.H52Backend?.configured?t('liveOrderNote'):t('localOrderNote'))}</p>`:'';
  $('#mobile-cart').hidden=!count;$('#mobile-cart').innerHTML=`<span class="cart-summary">${icon('shopping-bag')}<span><span class="cart-label">${esc(t('orderTitle'))} · ${count} ${esc(t(count===1?'productSingular':'productPlural'))}</span><strong>${money(values.total)}</strong></span></span><span class="cart-cta">${esc(t('viewOrder'))} ${icon('arrow-right')}</span>`;
  document.querySelectorAll('.product [data-add]').forEach(button=>{const quantity=productQuantity(button.dataset.add),available=products.find(p=>p.id===button.dataset.add)?.available;button.innerHTML=quantity?`<span>${quantity}</span>`:icon(available?'plus':'ban');button.classList.toggle('in-cart',quantity>0);button.disabled=!available||quantity>=design.order.maxQuantity;});
  document.body.classList.toggle('has-cart',count>0);icons();save();
}
function openOrder(open) {
  if(open)lastFocus=document.activeElement;$('#order').hidden=!open;$('#backdrop').hidden=!open;document.body.classList.toggle('order-open',open);
  document.querySelectorAll('header,main,footer,.bottom-nav,#mobile-cart').forEach(el=>el.inert=open);
  if(open)$('.close-order').focus();else lastFocus?.focus();
}
function showDetails(id) {
  detailId=id;detailQuantity=1;
  const p=products.find(p=>p.id===id), cat=categories.find(c=>c.id===p.classification.categoryId);
  $('#details-content').innerHTML=`<div class="detail-media">${productPhoto(p,'detail-image')}${favoriteButton(p)}${p.badge?`<span class="badge">${esc(p.badge)}</span>`:''}</div><div class="detail-body"><p class="eyebrow">${esc(cat.name)}${p.classification.subcategory?' / '+esc(p.classification.subcategory):''}</p><h2 id="detail-title">${esc(p.name)}</h2><p>${esc(p.description)}</p><div class="detail-tags">${[...p.classification.tags,...p.classification.dietary].map(x=>`<span>${esc(x)}</span>`).join('')}</div>${p.ingredients.length?`<h3>${esc(t('ingredients'))}</h3><p>${p.ingredients.map(esc).join(' · ')}</p>`:''}<div class="allergen-note">${icon('info')}<div><h3>${esc(t('allergens'))}</h3><p>${p.allergens?.length?p.allergens.map(esc).join(' · '):esc(t('allergensUnknown'))}</p></div></div><dl>${p.serving?`<div><dt>${esc(t('serving'))}</dt><dd>${esc(p.serving)}</dd></div>`:''}${p.preparationMinutes!==null?`<div><dt>${esc(t('preparation'))}</dt><dd>${p.preparationMinutes} ${esc(t('minutes'))}</dd></div>`:''}${p.alcoholPercent!==null?`<div><dt>${esc(t('alcohol'))}</dt><dd>${p.alcoholPercent}%</dd></div>`:''}</dl><div class="detail-bottom"><div class="detail-price"><span>${esc(t('unitPrice'))}</span><strong>${money(p.price)}</strong></div><div class="detail-quantity"><button id="detail-minus" aria-label="${esc(t('minus'))}">${icon('minus')}</button><output id="detail-quantity">1</output><button id="detail-plus" aria-label="${esc(t('plus'))}">${icon('plus')}</button></div><button class="primary" id="detail-add">${esc(t('add'))} ${icon('arrow-right')}</button></div></div>`;updateDetail();icons();$('#details').showModal();
}
function selectedExtras(){return Array.from($('#details').querySelectorAll('[data-extra]:checked'),el=>el.value);}
function updateDetail(){const p=products.find(p=>p.id===detailId),remaining=design.order.maxQuantity-productQuantity(p.id);detailQuantity=Math.max(1,Math.min(detailQuantity,remaining));$('#detail-quantity').value=detailQuantity;$('#detail-minus').disabled=detailQuantity<=1;$('#detail-plus').disabled=detailQuantity>=remaining;$('#detail-add').disabled=!p.available||remaining<=0;const price=H52Order.unitPrice({productId:p.id,extras:selectedExtras()},products);$('#detail-add').innerHTML=`${esc(t(!p.available?'unavailable':remaining<=0?'quantityLimit':'add'))} <span>${money(price*detailQuantity)}</span> ${icon('arrow-right')}`;icons();}
function clearFilters(){$('#search').value='';$('#available-only').checked=false;$('#featured-only').checked=false;$('#dietary-filter').value='';$('#favorites-only').checked=false;}
function openProduct(id){
  showDetails(id);const p=products.find(p=>p.id===id),options=p.customization?.removable||[];
  if(p.imageIllustrative)$('#detail-title').insertAdjacentHTML('beforebegin','<p class="photo-disclaimer">Imagen ilustrativa</p>');
  const html=`<section class="customization">${options.length?`<fieldset><legend>${esc(t('customizeTitle'))}</legend><div class="without-options">${options.map((value,i)=>`<label><input type="checkbox" data-without="${i}" value="${esc(value)}"><span>${esc(t('without'))} ${esc(value)}</span>${icon('check')}</label>`).join('')}</div><p class="customization-hint">${esc(t('customizeHint'))}</p></fieldset>`:''}${p.customization?.allowNote!==false?`<label class="detail-note-label" for="detail-note">${esc(t('orderInstructions'))}</label><textarea id="detail-note" maxlength="400" rows="3" placeholder="${esc(t('instructionsPlaceholder'))}"></textarea>`:''}</section>`;
  const extras=p.extras?.length?`<fieldset class="extra-options"><legend>${esc(t('extras'))}</legend>${p.extras.map(e=>`<label><input type="checkbox" data-extra value="${esc(String(e.id))}" ${e.available?'':'disabled'}><span>${esc(e.name)}</span><strong>+ ${money(e.price)}</strong></label>`).join('')}</fieldset>`:'';
  $('#details-content .allergen-note').insertAdjacentHTML('beforebegin',html+extras);updateDetail();icons();
}
function route(preserveScroll = false) {
  setMenu(false);
  $('#hero').hidden=false;document.body.classList.add('single-page');
  renderProducts();renderOrder();
  if(!preserveScroll&&location.hash==='#carta')$('#carta').scrollIntoView();
}
$('#table').addEventListener('change',renderOrder);$('#search').addEventListener('input',renderProducts);$('#sort').addEventListener('change',renderProducts);
['available-only','featured-only','dietary-filter','favorites-only'].forEach(id=>$('#'+id).addEventListener('change',()=>{renderProducts();renderOrder();}));
document.addEventListener('change',event=>{if(event.target.matches('[data-extra]'))updateDetail();});
document.addEventListener('click',async event=> {
  if(design&&!event.target.closest('.menu-toggle')&&(!event.target.closest('#mobile-menu')||event.target.closest('#mobile-menu a')))setMenu(false);
  if(!design)return;const link=event.target.closest('a[data-filter]');if(link){category=link.dataset.filter;$('#search').value='';if(category==='all')clearFilters();if(location.hash==='#carta')renderProducts();}
  const b=event.target.closest('button');if(!b)return;
  if(b.classList.contains('menu-toggle'))setMenu($('#mobile-menu').hidden);
  if(b.dataset.layout){layout=b.dataset.layout;renderProducts();renderOrder();}
  if(b.id==='clear-search'){$('#search').value='';renderProducts();renderOrder();$('#search').focus();}
  if(b.dataset.category){category=b.dataset.category;if(category==='all')clearFilters();renderProducts();}
  if(b.hasAttribute('data-toggle-favorites')){$('#favorites-only').checked=!$('#favorites-only').checked;renderProducts();$('#carta').scrollIntoView();}
  if(b.dataset.favorite){const id=b.dataset.favorite;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];save();renderProducts();if($('#details').open){b.classList.toggle('active',favorites.includes(id));b.setAttribute('aria-pressed',String(favorites.includes(id)));}}
  if(b.id==='detail-minus'||b.id==='detail-plus'){detailQuantity+=b.id==='detail-plus'?1:-1;updateDetail();}
  if(b.id==='detail-add'){const p=products.find(p=>p.id===detailId);if(!p.available||productQuantity(p.id)+detailQuantity>design.order.maxQuantity)return;const without=Array.from($('#details').querySelectorAll('[data-without]:checked'),input=>input.value);H52Order.add(cart,p.id,detailQuantity,without,$('#detail-note')?.value||'',design.order.maxQuantity,selectedExtras());renderOrder();toast(`${detailQuantity} × ${p.name} ${t('added')}`);$('#details').close();}
  if(b.dataset.detail)openProduct(b.dataset.detail);
  if(b.dataset.add){const p=products.find(p=>p.id===b.dataset.add);if(!p?.available||productQuantity(p.id)>=design.order.maxQuantity)return;if(p.customization?.removable?.length||p.customization?.allowNote!==false){openProduct(p.id);return;}H52Order.add(cart,p.id,1,[],'',design.order.maxQuantity);renderOrder();toast(`${p.name} ${t('added')}`);}
  const lineKey=b.dataset.lineMinus??b.dataset.linePlus??b.dataset.lineRemove;
  if(lineKey){const line=cart.find(item=>item.key===lineKey);if(!line)return;if(b.dataset.lineRemove)cart=cart.filter(item=>item!==line);else if(b.dataset.lineMinus){line.quantity--;cart=cart.filter(item=>item.quantity>0);}else if(productQuantity(line.productId)<design.order.maxQuantity)line.quantity++;renderOrder();}
  if(b.classList.contains('cart-toggle'))openOrder(true);if(b.classList.contains('close-order'))openOrder(false);
  if(b.id==='reset-filters'){category='all';$('#search').value='';$('#available-only').checked=false;$('#featured-only').checked=false;$('#dietary-filter').value='';location.hash='carta';renderProducts();renderOrder();}
  if(b.id==='review-order'){$('#confirmation-title').textContent=t('confirmationTitle');document.querySelector('[data-label="confirmationDescription"]').textContent=t('confirmationDescription');$('#continue').disabled=false;$('#continue').innerHTML=`${esc(t('continue'))} ${icon('arrow-right')}`;$('#summary').innerHTML=`<strong>${esc(t('table'))} ${esc($('#table').value)}</strong>`+cart.map(line=>{const p=products.find(p=>p.id===line.productId);return `<div class="summary-line"><p><span>${line.quantity} × ${esc(p.name)}</span><span>${money(H52Order.unitPrice(line,products)*line.quantity)}</span></p>${lineNotes(line)?`<small>${esc(lineNotes(line))}</small>`:''}</div>`;}).join('')+`<p><strong>${esc(t('total'))}</strong><strong>${money(totals().total)}</strong></p>`;$('#confirmation').showModal();icons();}
  if(b.id==='continue'&&!submittingOrder){submittingOrder=true;b.disabled=true;b.innerHTML=`${esc(t('sendingOrder'))} ${icon('loader')}`;try{await window.H52Backend.createOrder(orderPayload());cart=[];renderOrder();$('#confirmation-title').textContent=t('orderSentTitle');document.querySelector('[data-label="confirmationDescription"]').textContent=window.H52Backend.configured?t('orderSentDescription'):t('localOrderSentDescription');setTimeout(()=>{$('#confirmation').close();openOrder(false);},1200);}catch(error){toast(t('orderSendError'));b.disabled=false;b.innerHTML=`${esc(t('continue'))} ${icon('arrow-right')}`;console.error(error);}finally{submittingOrder=false;icons();}}
  if(b.id==='close-confirm')$('#confirmation').close();if(b.id==='close-details')$('#details').close();
});
$('#backdrop').addEventListener('click',()=>openOrder(false));
document.addEventListener('keydown',event=> {
  if(event.key==='Escape'&&!$('#mobile-menu').hidden){setMenu(false);$('.menu-toggle').focus();}
  if(event.key==='Escape'&&!$('#confirmation').open&&!$('#details').open&&!$('#order').hidden)openOrder(false);
  if(event.key!=='Tab'||$('#order').hidden||$('#confirmation').open)return;
  const els=Array.from($('#order').querySelectorAll('button,select,a,input')).filter(el=>!el.disabled),first=els[0],last=els.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
window.addEventListener('message',event=> {
  if(event.source!==window.parent||window.parent===window||event.data?.type!=='h52-preview')return;
  try {applyConfig(event.data.payload,true);window.parent.postMessage({type:'h52-preview-success'},'*');} catch(error){window.parent.postMessage({type:'h52-preview-error',message:error.message},'*');}
});
H52Data.load().then(data=>{applyConfig(data);if(window.parent!==window)window.parent.postMessage({type:'h52-ready'},'*');}).catch(error=>{$('#load-error').hidden=false;$('#load-error').textContent=error.message;console.error(error);});
