(function () {
  const key = item => JSON.stringify([item.productId,[...item.without].sort(),item.note,[...(item.extras||[])].sort()]);
  const quantity = (items,id) => items.filter(item=>item.productId===id).reduce((sum,item)=>sum+item.quantity,0);
  function add(items,productId,count,without=[],note='',max=99,extras=[]) {
    const amount=Math.max(0,Math.min(Math.floor(count),max-quantity(items,productId)));
    if(!amount)return items;
    const item={productId,quantity:amount,without:[...new Set(without)].sort(),note:note.trim().slice(0,400),extras:[...new Set(extras)].sort()};
    item.key=key(item);
    const existing=items.find(line=>line.key===item.key);
    if(existing)existing.quantity+=amount;else items.push(item);
    return items;
  }
  function normalize(raw,products,max) {
    const lines=Array.isArray(raw)?raw:raw&&typeof raw==='object'?Object.entries(raw).map(([productId,quantity])=>({productId,quantity})):[];
    const items=[];
    for(const line of lines){
      if(!line||!Number.isInteger(line.quantity)||line.quantity<=0)continue;
      const product=products.find(p=>p.id===line.productId&&p.available);if(!product)continue;
      const allowed=product.customization?.removable||[];
      const without=Array.isArray(line.without)?line.without.filter(value=>typeof value==='string'&&allowed.includes(value)):[];
      const note=typeof line.note==='string'&&product.customization?.allowNote!==false?line.note:'';
      const extras=Array.isArray(line.extras)?line.extras.filter(id=>product.extras?.some(e=>String(e.id)===id&&e.available)):[];
      add(items,line.productId,line.quantity,without,note,max,extras);
    }
    return items;
  }
  function totals(items,products,percent) {
    const subtotal=Math.round(items.reduce((sum,item)=>sum+unitPrice(item,products)*item.quantity,0)*100)/100;
    const service=Math.round(subtotal*percent)/100;
    return {subtotal,service,total:Math.round((subtotal+service)*100)/100};
  }
  function unitPrice(item,products){const p=products.find(p=>p.id===item.productId);return p?(p.price+(item.extras||[]).reduce((sum,id)=>sum+(p.extras?.find(e=>String(e.id)===id&&e.available)?.price||0),0)):0;}
  window.H52Order={key,quantity,add,normalize,totals,unitPrice};
})();
