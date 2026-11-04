import { parseCatalogCSV as parseCatalogCSVModule, parseCatalogTextRows } from './catalog-import.mjs';
import { calculateFinancialSnapshot } from './financial-snapshot.mjs';

'use strict';

(function () {
  const iconPaths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
    bottle: '<rect x="8" y="7" width="8" height="14" rx="2"/><path d="M10 7V4h4v3M10 12h4"/>',
    boxes: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12v9M8 5.2l8 4.5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z" transform="translate(-.8 -1) scale(1.07)"/>',
    collapse: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m8-11-3 3 3 3"/>',
    expand: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-11 3 3-3 3"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    arrowUp: '<path d="m7 14 5-5 5 5"/><path d="M12 9v11"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    warning: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
    edit: '<path d="m14 5 5 5M4 20l4.2-.9L19 8.3 15.7 5 5 15.8 4 20Z"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>'
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (iconPaths[name] || iconPaths.spark) + '</svg>';
  }
  document.querySelectorAll('[data-icon]').forEach(function (node) {
    node.innerHTML = svg(node.getAttribute('data-icon'));
  });

  let exchangeRate = 36.6;
  function roundMoney(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
  function toUsd(value, currency) { const amount=Number(value||0);return roundMoney(currency==='USD'?amount:amount/exchangeRate); }
  function moneyInCurrency(value,currency) { return new Intl.NumberFormat('es-NI',{style:'currency',currency:currency==='NIO'?'NIO':'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0)); }
  function rateLabel(rate) { const value=Number(rate||exchangeRate),cents=Math.round(value*100);return 'C$ '+value.toFixed(Math.abs(value*100-cents)<0.000001?2:4)+' por US$ 1'; }
  function currencyOptions(selected) { return '<option value="USD"'+(selected==='USD'?' selected':'')+'>USD · Dólar</option><option value="NIO"'+(selected==='NIO'?' selected':'')+'>NIO · Córdoba</option>'; }

  let products = [];
  let orders = [];
  let customers = [];
  let suppliers = [];
  let purchases = [];
  let expenses = [];
  let cashEntries = [];
  let cashAccounts = [];
  let invoices = [];
  let invoiceDraftItems = [];
  let employees = [];
  let attendanceRecords = [];
  let leaveRequests = [];
  let payrollPeriods = [];
  let payrollItems = [];
  let inventoryMovements = [];
  let dgiSupportDocuments = [];
  let dgiDocumentsLoaded = false, dgiDocumentsLoading = false, dgiDocumentsLoadAttempted = false, dgiDocumentsError = "";
  let dgiCompliance = { taxpayer_name:"", ruc:"", business_address:"", regime_status:"not_confirmed", regime_confirmation_reference:"", quota_fixed_amount_nio:0, certificate_available:false, certificate_displayed:false, computerized_invoicing_status:"not_confirmed", dgi_confirmation_date:"", computerized_invoicing_authorization_number:"", computerized_invoicing_confirmation_reference:"" };
  let hrRecordsLoaded = false, hrRecordsLoading = false, hrLoadAttempted = false, hrLoadError = "";
  let erpDataLoaded = false, erpDataLoading = false, erpLoadError = "";

  async function erpApi(path, options = {}) {
    const auth = window.JBAuth;
    if (!auth || auth.mode !== "authenticated" || !auth.profile) throw new Error("Inicia sesión con un perfil ERP autorizado.");
    const token = await auth.getToken();
    if (!token) throw new Error("La sesión expiró. Vuelve a iniciar sesión.");
    const headers = new Headers(options.headers || {});
    headers.set("authorization", "Bearer " + token);
    if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(auth.apiUrl("/api/erp/" + path.replace(/^\/+/, "")), {
      ...options, headers, cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || "La operación no se pudo completar (HTTP " + response.status + ").");
    return body;
  }
  const productAssetUrlCache=new Map();
  async function productAssetUrl(key){
    if(productAssetUrlCache.has(key))return productAssetUrlCache.get(key);
    const auth=window.JBAuth;
    if(!auth?.profile)throw new Error("Inicia sesión para consultar las imágenes.");
    const pending=(async()=>{
      const token=await auth.getToken();
      const response=await fetch(auth.apiUrl("/api/erp/assets?key="+encodeURIComponent(key)),{
        headers:{authorization:"Bearer "+token},cache:"no-store"
      });
      if(!response.ok){
        const body=await response.json().catch(()=>({}));
        throw new Error(body?.error?.message||"No se pudo consultar la imagen.");
      }
      return URL.createObjectURL(await response.blob());
    })();
    productAssetUrlCache.set(key,pending);
    try{return await pending;}catch(error){productAssetUrlCache.delete(key);throw error;}
  }
  const PRODUCT_IMAGE_MAX_INPUT_BYTES=8*1024*1024;
  const PRODUCT_IMAGE_MAX_UPLOAD_BYTES=2*1024*1024;
  const PRODUCT_IMAGE_OPTIMIZE_THRESHOLD=400*1024;
  const PRODUCT_IMAGE_MAX_EDGE=1600;
  const PRODUCT_IMAGE_UPLOAD_CONCURRENCY=3;
  let pendingProductImagePreviewUrls=[];

  async function prepareProductImageForUpload(file){
    const supported=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
    if(!supported.has(String(file?.type||"").toLowerCase()))throw new Error("Formato no compatible. Usa JPG, PNG, WebP o AVIF.");
    if(file.size>PRODUCT_IMAGE_MAX_INPUT_BYTES)throw new Error("El archivo original supera 8 MB.");
    if(file.size<=PRODUCT_IMAGE_OPTIMIZE_THRESHOLD)return file;
    let bitmap=null,source=null,width=0,height=0,release=()=>{};
    try{
      if(typeof createImageBitmap==="function"){
        try{bitmap=await createImageBitmap(file);source=bitmap;width=bitmap.width;height=bitmap.height;release=()=>bitmap?.close?.();}catch{}
      }
      if(!source){
        const url=URL.createObjectURL(file);
        try{
          const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("No se pudo decodificar la imagen."));img.src=url;});
          source=image;width=image.naturalWidth;height=image.naturalHeight;
        }finally{URL.revokeObjectURL(url);}
      }
      if(!width||!height)throw new Error("La imagen no tiene dimensiones válidas.");
      const scale=Math.min(1,PRODUCT_IMAGE_MAX_EDGE/Math.max(width,height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const context=canvas.getContext("2d",{alpha:true});
      if(!context)throw new Error("No se pudo procesar la imagen.");
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";
      context.drawImage(source,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",0.82));
      if(!blob||blob.type!=="image/webp")return file;
      if(blob.size>=file.size&&scale===1)return file;
      const base=file.name.replace(/\.[^.]+$/,"")||"fotografia";
      return new File([blob],base+".webp",{type:"image/webp",lastModified:file.lastModified||Date.now()});
    }catch(error){
      console.warn("No se pudo optimizar la fotografía; se intentará usar el original.",file.name,error);
      return file;
    }finally{try{release();}catch{}}
  }

  async function uploadProductAsset(productId,file,onProgress){
    const auth=window.JBAuth;
    if(!auth?.profile)throw new Error("Inicia sesión para subir imágenes.");
    const uploadFile=await prepareProductImageForUpload(file);
    if(uploadFile.size>PRODUCT_IMAGE_MAX_UPLOAD_BYTES)throw new Error(file.name+" supera 2 MB después de optimizar. Reduce la resolución o elige otra imagen.");
    let lastError;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const token=await auth.getToken();
        if(!token)throw new Error("La sesión expiró. Inicia sesión nuevamente.");
        const formData=new FormData();
        formData.append("product_id",productId);
        formData.append("file",uploadFile,uploadFile.name);
        const asset=await new Promise((resolve,reject)=>{
          const xhr=new XMLHttpRequest();
          xhr.open("POST",auth.apiUrl("/api/erp/assets"),true);
          xhr.setRequestHeader("authorization","Bearer "+token);
          xhr.timeout=120000;
          xhr.upload.addEventListener("progress",event=>{
            if(event.lengthComputable&&typeof onProgress==="function")onProgress(Math.max(0,Math.min(100,Math.round(event.loaded/event.total*100))));
          });
          xhr.onload=()=>{
            let body={};try{body=JSON.parse(xhr.responseText||"{}");}catch{}
            if(xhr.status>=200&&xhr.status<300)resolve(body.asset);
            else reject(new Error(body?.error?.message||"No se pudo subir la imagen (HTTP "+xhr.status+")."));
          };
          xhr.onerror=()=>reject(new Error("Failed to fetch: conexión interrumpida durante la subida."));
          xhr.ontimeout=()=>reject(new Error("Failed to fetch: la subida superó 120 segundos."));
          xhr.onabort=()=>reject(new Error("Failed to fetch: la subida fue interrumpida."));
          xhr.send(formData);
        });
        if(typeof onProgress==="function")onProgress(100);
        return asset;
      }catch(error){
        lastError=error;
        if(!/failed to fetch|networkerror|connection|timed? ?out|interrumpida|interrumpido/i.test(String(error?.message||error))||attempt===2)break;
        await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
      }
    }
    throw lastError||new Error("No se pudo subir la imagen.");
  }

  async function runWithConcurrency(items,limit,task){
    let next=0;
    const workers=Array.from({length:Math.min(limit,items.length)},async()=>{
      while(next<items.length){const index=next++;await task(items[index],index);}
    });
    await Promise.all(workers);
  }

  function renderPendingProductImagePreviews(files){
    const container=document.getElementById("product-image-pending-gallery");
    if(!container)return;
    pendingProductImagePreviewUrls.forEach(url=>URL.revokeObjectURL(url));
    pendingProductImagePreviewUrls=[];
    container.replaceChildren();
    files.forEach((file,index)=>{
      const card=document.createElement("div");card.className="product-image-pending-card";card.dataset.uploadIndex=String(index);
      const image=document.createElement("img");const url=URL.createObjectURL(file);pendingProductImagePreviewUrls.push(url);
      image.src=url;image.alt="Vista previa "+(index+1);image.loading="lazy";
      const details=document.createElement("div");
      const name=document.createElement("strong");name.textContent=file.name;
      const status=document.createElement("small");status.dataset.uploadStatus=String(index);status.textContent="Lista para optimizar";
      const progress=document.createElement("progress");progress.max=100;progress.value=0;progress.dataset.uploadProgress=String(index);
      details.append(name,status,progress);card.append(image,details);container.append(card);
    });
  }
  function updatePendingProductImageProgress(index,status,percent){
    const card=document.querySelector('[data-upload-index="'+index+'"]');
    if(!card)return;
    const label=card.querySelector("[data-upload-status]"),progress=card.querySelector("[data-upload-progress]");
    if(label)label.textContent=status;
    if(progress&&Number.isFinite(percent))progress.value=Math.max(0,Math.min(100,percent));
  }
  function clearPendingProductImagePreviews(){
    pendingProductImagePreviewUrls.forEach(url=>URL.revokeObjectURL(url));pendingProductImagePreviewUrls=[];
    document.getElementById("product-image-pending-gallery")?.replaceChildren();
  }
  async function deleteProductAsset(productId,key){
    await erpApi("assets",{method:"DELETE",body:JSON.stringify({product_id:productId,key})});
    const cached=productAssetUrlCache.get(key);
    if(cached&&typeof cached.then==="function"){
      try{URL.revokeObjectURL(await cached);}catch{}
    }else if(cached){URL.revokeObjectURL(cached);}
    productAssetUrlCache.delete(key);
  }
  async function hydrateProductImageSlots(){
    const slots=Array.from(document.querySelectorAll("[data-product-image-slot]")).slice(0,60);
    await Promise.all(slots.map(async slot=>{
      const product=products.find(item=>String(item.id)===slot.getAttribute("data-product-image-slot"));
      const image=product?.images?.[0];
      if(!image?.key)return;
      try{
        const url=await productAssetUrl(image.key);
        if(!slot.isConnected)return;
        const img=document.createElement("img");
        img.src=url;img.alt=product.name;img.loading="lazy";
        slot.replaceChildren(img);
      }catch{}
    }));
  }
  async function mountProductImageGallery(container,product){
    if(!container)return;
    container.replaceChildren();
    const images=Array.isArray(product?.images)?product.images:[];
    if(!images.length){
      const empty=document.createElement("span");empty.className="table-secondary";empty.textContent="Todavía no hay imágenes guardadas.";
      container.appendChild(empty);return;
    }
    for(const image of images){
      const card=document.createElement("div");card.className="product-image-card";
      try{
        const url=await productAssetUrl(image.key);
        const img=document.createElement("img");img.src=url;img.alt=image.name||product.name;img.loading="lazy";card.appendChild(img);
      }catch{
        const failed=document.createElement("span");failed.textContent="Imagen no disponible";failed.className="table-secondary";card.appendChild(failed);
      }
      const remove=document.createElement("button");remove.type="button";remove.className="product-image-remove";
      remove.textContent="×";remove.setAttribute("aria-label","Eliminar imagen");
      remove.setAttribute("data-action","remove-product-image");remove.setAttribute("data-product-id",product.id);remove.setAttribute("data-key",image.key);
      card.appendChild(remove);container.appendChild(card);
    }
  }

  function dbDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" });
  }

  async function loadERPFromNeon(force = false) {
    if (erpDataLoading || (erpDataLoaded && !force)) return;
    erpDataLoading = true;
    erpLoadError = "";
    try {
      const response = await erpApi("bootstrap");
      const data = response.data || {};
      const rawProducts = Array.isArray(data.products) ? data.products : [];
      products = rawProducts.map((p) => {
        const purchaseCost = Number(p.purchase_cost_usd || 0);
        const additionalCost = Number(p.additional_cost_usd || 0);
        const price = Number(p.price_usd || 0);
        const unitCost = Number(p.unit_cost_usd || purchaseCost + additionalCost);
        const profit = price - unitCost;
        return {
          id: p.id, name: p.name, brand: p.brand || "", sku: p.sku, category: p.category || "Perfumería",
          concentration: p.concentration || "", gender: p.gender || "", family: p.family || "",
          sizeMl: p.size_ml == null ? null : Number(p.size_ml), presentation: p.presentation || "",
          purchaseCost, additionalCost, unitCost, price, wholesalePrice: p.wholesale_price_usd == null ? null : Number(p.wholesale_price_usd),
          profit, margin: price > 0 ? profit / price * 100 : 0, stock: Number(p.stock || 0), minStock: Number(p.min_stock || 0),
          location: p.location || "", barcode: p.barcode || "", notes: p.notes || "", tone: p.tone || "art-violet",
          supplier: p.supplier_name || "", images:Array.isArray(p.images)?p.images:[], active: p.active !== false, createdAt: p.created_at
        };
      });
      inventoryMovements = (data.inventory_movements || []).map((m) => ({
        id: m.id, productId: m.product_id, productName: products.find(p => p.id === m.product_id)?.name || "Producto",
        sku: products.find(p => p.id === m.product_id)?.sku || "", type: m.movement_type,
        quantity: Number(m.quantity), delta: Number(m.quantity_delta), previousStock: Number(m.previous_stock),
        newStock: Number(m.new_stock), note: m.note || "", sourceType: m.reference_type || "",
        sourceId: m.reference_id || "", createdAt: m.created_at
      }));
      suppliers = (data.suppliers || []).map(s => ({
        id: s.id, name: s.name, contact: s.contact || "", phone: s.phone || "", email: s.email || "",
        currency: s.currency || "USD", notes: s.notes || "", active: s.active !== false
      }));
      customers = (data.customers || []).map(x => ({
        id: x.id, name: x.name, contact: x.contact || x.phone || "", phone: x.phone || x.contact || "",
        email: x.email || "", customerType: x.customer_type || "particular", orders: 0, spent: 0,
        since: dbDate(x.created_at), notes: x.notes || "", active: x.active !== false
      }));
      const rawOrderItems = data.order_items || [];
      orders = (data.orders || []).map(o => ({
        id: o.order_number, dbId: o.id, customerId: o.customer_id, customer: o.customer_name, phone: o.phone || "",
        date: dbDate(o.created_at), createdAt: o.created_at, amount: Number(o.total_usd || 0),
        status: o.status, paymentMethod: o.payment_method || "", paymentStatus: o.payment_status,
        deliveryMode: o.delivery_mode || "", discount: Number(o.discount_usd || 0), deliveryFee: Number(o.delivery_fee_usd || 0),
        paymentCurrency: o.currency || "USD", paymentAmount: Number(o.original_amount || 0), exchangeRate: Number(o.exchange_rate || exchangeRate),
        items: rawOrderItems.filter(i => i.order_id === o.id).map(i => ({
          productId: i.product_id, name: i.product_name, sku: i.sku_snapshot || "", quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price_usd)
        })),
        inventoryAppliedAt: inventoryMovements.some(m => m.sourceType === "order" && m.sourceId === o.id && m.delta < 0) ? o.updated_at : null
      }));
      customers.forEach(customer => {
        const related = orders.filter(o => o.customerId === customer.id);
        customer.orders = related.length;
        customer.spent = roundMoney(related.reduce((sum, order) => sum + Number(order.amount || 0), 0));
      });
      const rawPurchaseItems = data.purchase_items || [];
      purchases = (data.purchases || []).map(p => {
        const lines = rawPurchaseItems.filter(i => i.purchase_id === p.id);
        const line = lines[0] || {};
        const paymentRows = (data.cash_entries || []).filter(e => e.source_type === "purchase" && e.source_id === p.id);
        return {
          id: p.id, purchaseNumber: p.purchase_number, supplierId: p.supplier_id, supplier: p.supplier_name,
          productId: line.product_id || "", product: line.product_name || (lines.length + " productos"),
          quantity: Number(line.quantity || lines.reduce((sum, i) => sum + Number(i.quantity || 0), 0)),
          currency: p.currency || "USD", originalUnitCost: Number(line.unit_cost_usd || 0) * (p.currency === "NIO" ? Number(p.exchange_rate || exchangeRate) : 1),
          originalTotal: Number(p.total_usd || 0) * (p.currency === "NIO" ? Number(p.exchange_rate || exchangeRate) : 1),
          exchangeRate: Number(p.exchange_rate || exchangeRate), unitCostUsd: Number(line.unit_cost_usd || 0),
          totalUsd: Number(p.total_usd || 0), paidUsd: Number(p.paid_usd || 0), status: p.status,
          payments: paymentRows.map(e => ({ amount: Number(e.original_amount), currency: e.currency, exchangeRate: Number(e.exchange_rate), amountUsd: Number(e.amount_usd), account: (data.cash_accounts || []).find(a => a.id === e.account_id)?.name || "", createdAt: e.created_at })),
          createdAt: p.created_at
        };
      });
      const rawInvoiceItems = data.invoice_items || [];
      const rawInvoicePayments = data.invoice_payments || [];
      invoices = (data.invoices || []).map(i => ({
        id: i.invoice_number, dbId: i.id, orderId: i.order_number_snapshot || "",
        customerId: i.customer_id, customer: i.customer_name, customerName: i.customer_name, customerPhone: i.customer_phone || "",
        source: i.source, currency: i.currency || "USD", exchangeRate: Number(i.exchange_rate || exchangeRate),
        subtotalUsd: Number(i.subtotal_usd || 0), discountUsd: Number(i.discount_usd || 0),
        deliveryFeeUsd: Number(i.delivery_fee_usd || 0), totalUsd: Number(i.total_usd || 0), paidUsd: Number(i.paid_usd || 0),
        status: i.status === "Pagada" ? "Pagado" : i.status, paymentMethod: i.payment_method || "",
        notes: i.notes || "", createdAt: i.created_at, date: dbDate(i.created_at),
        items: rawInvoiceItems.filter(x => x.invoice_id === i.id).map(x => ({
          productId: x.product_id, name: x.product_name, sku: x.sku_snapshot || "", quantity: Number(x.quantity),
          unitPriceUsd: Number(x.unit_price_usd), unitCostUsd: Number(x.unit_cost_usd || 0)
        })),
        payments: rawInvoicePayments.filter(x => x.invoice_id === i.id).map(x => ({
          amount: Number(x.original_amount), currency: x.currency, exchangeRate: Number(x.exchange_rate),
          amountUsd: Number(x.amount_usd), account: x.account_name || "", createdAt: x.created_at
        })),
        inventoryAppliedAt: inventoryMovements.some(m => m.sourceType === "invoice" && m.sourceId === i.id && m.delta < 0) ? i.created_at : null
      }));
      expenses = (data.expenses || []).map(e => ({
        id: e.id, category: e.category, description: e.description, currency: e.currency,
        originalAmount: Number(e.original_amount), exchangeRate: Number(e.exchange_rate), amountUsd: Number(e.amount_usd),
        createdAt: e.created_at
      }));
      cashAccounts = data.cash_accounts || [];
      cashEntries = (data.cash_entries || []).map(e => ({
        id: e.id, direction: e.direction, concept: e.concept,
        account: cashAccounts.find(a => a.id === e.account_id)?.name || "Cuenta no asignada",
        accountId: e.account_id, currency: e.currency, originalAmount: Number(e.original_amount),
        exchangeRate: Number(e.exchange_rate), amountUsd: Number(e.amount_usd),
        sourceType: e.source_type || "", sourceId: e.source_id || "", createdAt: e.created_at,
        supplier: suppliers.find(s => s.id === e.supplier_id)?.name || ""
      }));
      employees = (data.employees || []).map(e => ({
        id: e.id, employeeCode: e.employee_code || "", name: e.name, position: e.position,
        department: e.department || "", salaryNio: Number(e.salary_nio || 0), status: e.status || "Activo",
        hireDate: e.hire_date || null, phone: e.phone || "", email: e.email || "", notes: e.notes || ""
      }));
      attendanceRecords = (data.hr_attendance || []).map(e => ({
        id:e.id, employeeId:e.employee_id, workDate:e.work_date, checkIn:e.check_in, checkOut:e.check_out,
        breakMinutes:Number(e.break_minutes||0), status:e.status, notes:e.notes||""
      }));
      leaveRequests = (data.hr_leave_requests || []).map(e => ({
        id:e.id, employeeId:e.employee_id, leaveType:e.leave_type, startDate:e.start_date, endDate:e.end_date,
        days:Number(e.days||0), reason:e.reason||"", status:e.status, reviewedAt:e.reviewed_at
      }));
      payrollPeriods = (data.hr_payroll_periods || []).map(e => ({
        id:e.id, periodStart:e.period_start, periodEnd:e.period_end, paymentDate:e.payment_date||"",
        status:e.status, notes:e.notes||"", createdAt:e.created_at
      }));
      payrollItems = (data.hr_payroll_items || []).map(e => ({
        id:e.id, payrollPeriodId:e.payroll_period_id, employeeId:e.employee_id,
        baseSalaryNio:Number(e.base_salary_nio||0), bonusesNio:Number(e.bonuses_nio||0),
        deductionsNio:Number(e.deductions_nio||0), netSalaryNio:Number(e.net_salary_nio||0), notes:e.notes||""
      }));
      const rateSetting = (data.settings || []).find(s => s.setting_key === "default_exchange_rate");
      if (rateSetting && Number(rateSetting.setting_value?.value) > 0) exchangeRate = Number(rateSetting.setting_value.value);
      const dgiSetting = (data.settings || []).find(s => s.setting_key === "dgi_compliance");
      if (dgiSetting && dgiSetting.setting_value && typeof dgiSetting.setting_value === "object") {
        dgiCompliance = { ...dgiCompliance, ...dgiSetting.setting_value };
      }

      erpDataLoaded = true;
      hrRecordsLoaded = Array.isArray(data.employees);
      hrLoadAttempted = true;
      const dbStatus=document.getElementById('db-connection-status');
      if(dbStatus)dbStatus.textContent='Conectado';
      return true;
    } catch (error) {
      erpLoadError = error?.message || "No se pudieron cargar los registros reales.";
      const dbStatus=document.getElementById('db-connection-status');
      if(dbStatus)dbStatus.textContent='Error';
      throw error;
    } finally {
      erpDataLoading = false;
    }
  }
  const views = {
    dashboard: { title: 'Resumen', eyebrow: 'CENTRO DE CONTROL', heading: 'Buenos días', subtitle: 'Una mirada clara al movimiento de tu negocio.' },
    products: { title: 'Productos', eyebrow: 'CATÁLOGO', heading: 'Catálogo de productos', subtitle: 'Administra las fragancias, sus precios y la disponibilidad.' },
    inventory: { title: 'Inventario', eyebrow: 'CONTROL DE EXISTENCIAS', heading: 'Inventario', subtitle: 'Consulta los niveles de stock y detecta reposiciones.' },
    orders: { title: 'Pedidos', eyebrow: 'OPERACIONES', heading: 'Pedidos y ventas', subtitle: 'Da seguimiento al estado de cada pedido.' },
    customers: { title: 'Clientes', eyebrow: 'RELACIONES', heading: 'Cartera de clientes', subtitle: 'Mantén organizada la información comercial.' },
    billing: { title: 'Facturación', eyebrow: 'DOCUMENTOS COMERCIALES', heading: 'Facturación', subtitle: 'Registra ventas presenciales y pedidos web en un mismo lugar.' },
    receivables: { title: 'Cuentas por cobrar', eyebrow: 'FINANZAS', heading: 'Cuentas por cobrar', subtitle: 'Da seguimiento a saldos y abonos de clientes.' },
    hr: { title: 'RRHH', eyebrow: 'GESTIÓN DEL PERSONAL', heading: 'Recursos Humanos', subtitle: 'Organiza personal, asistencia, permisos y nómina.' },
    dgi: { title: 'DGI', eyebrow: 'CUMPLIMIENTO TRIBUTARIO', heading: 'Control tributario DGI', subtitle: 'Organiza libros simplificados, límites de referencia y soportes documentales.' },
    analytics: { title: 'Informes', eyebrow: 'RENDIMIENTO', heading: 'Informes y análisis', subtitle: 'Indicadores preparados para tomar decisiones.' },
    settings: { title: 'Configuración', eyebrow: 'SISTEMA', heading: 'Configuración', subtitle: 'Preferencias y conexiones de JB PARFUMS ERP.' },
    purchases: { title: 'Compras', eyebrow: 'ABASTECIMIENTO', heading: 'Compras', subtitle: 'Registra adquisiciones y recepción de productos.' },
    payables: { title: 'Cuentas por pagar', eyebrow: 'ABASTECIMIENTO', heading: 'Cuentas por pagar', subtitle: 'Controla saldos y abonos pendientes con tus proveedores.' },
    suppliers: { title: 'Proveedores', eyebrow: 'ABASTECIMIENTO', heading: 'Proveedores', subtitle: 'Administra proveedores y monedas habituales.' },
    expenses: { title: 'Gastos', eyebrow: 'FINANZAS', heading: 'Gastos operativos', subtitle: 'Controla egresos en dólares y córdobas.' },
    cash: { title: 'Caja y bancos', eyebrow: 'FINANZAS', heading: 'Caja y bancos', subtitle: 'Registra cobros, recibos y pagos por cuenta.' }
  };
  const state = { view: 'dashboard', query: '', filter: 'all', category: 'all', productStatus: 'active', hrTab: 'employees', inventoryMovementQuery: '', inventoryMovementType: 'all', inventoryMovementStartDate: '', inventoryMovementEndDate: '', inventoryMovementPage: 1, inventoryProductQuery: '', inventoryProductCategory: 'all', inventoryProductStock: 'all' };
  const permissionViews = {
    dashboard: ["dashboard.view"], products: ["products.catalog.view"],
    inventory: ["inventory.stock.view","inventory.receipts.view","inventory.manual_out.view","inventory.adjustments.view"],
    orders: ["orders.records.view"], billing: ["billing.invoices.view"],
    receivables: ["receivables.view","billing.payments.view"], customers: ["customers.records.view"],
    hr: ["hr.employees.view","hr.attendance.view","hr.payroll.view","hr.leave.view","hr.contracts.view"],
    dgi: ["dgi.documents.view"], analytics: ["analytics.reports.view"], settings: ["settings.general.view"],
    purchases: ["purchases.purchase_orders.view","purchases.receipts.view","purchases.supplier_invoices.view"],
    payables: ["payables.payments.view"], suppliers: ["suppliers.records.view"],
    expenses: ["expenses.records.view"], cash: ["cash.entries.view"]
  };
  function permissionGranted(key) {
    const grants = window.JBAuth?.profile?.permissions;
    return Array.isArray(grants) && (grants.includes("*") || grants.includes(key));
  }
  function canViewERPView(view) {
    const keys = permissionViews[view] || [];
    return keys.some(permissionGranted);
  }
  function firstPermittedView() {
    return Object.keys(permissionViews).find(canViewERPView) || null;
  }
  function applyPermissionNavigation() {
    document.querySelectorAll(".primary-nav .nav-item[data-view]").forEach((button) => {
      button.hidden = !canViewERPView(button.getAttribute("data-view"));
    });
    document.querySelectorAll(".primary-nav").forEach((nav) => {
      const visible = Array.from(nav.querySelectorAll(".nav-item")).some((button) => !button.hidden);
      nav.hidden = !visible;
      const caption = nav.previousElementSibling;
      if (caption?.classList.contains("nav-caption")) caption.hidden = !visible;
    });
  }
  const root = document.getElementById('view-root');
  const dialog = document.getElementById('product-dialog');
  const form = document.getElementById('product-form');
  const stockDialog = document.getElementById('stock-dialog');
  const stockForm = document.getElementById('stock-form');
  const detailDialog = document.getElementById('product-detail-dialog');
  const orderDialog = document.getElementById('order-detail-dialog');
  const businessDialog = document.getElementById('business-dialog');
  const businessForm = document.getElementById('business-form');
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(value) {
    return usdFormatter.format(Number(value || 0));
  }
  function status(stock, minimum) {
    if (stock === 0) return '<span class="status-chip status-danger">Agotado</span>';
    if (stock <= (Number.isInteger(minimum) ? minimum : 3)) return '<span class="status-chip status-pending">Stock bajo</span>';
    return '<span class="status-chip status-success">Disponible</span>';
  }
  function costSummary(product) {
    const unitCost = Number(product.unitCost ?? ((product.purchaseCost || 0) + (product.additionalCost || 0)));
    const profit = Number(product.price || 0) - unitCost;
    const margin = Number(product.price) > 0 ? (profit / Number(product.price)) * 100 : 0;
    return { unitCost, profit, margin };
  }
  function productMeta(product) {
    return [product.sku, product.brand, product.concentration, product.sizeMl ? product.sizeMl + ' ml' : '']
      .filter(Boolean).map(esc).join(' · ');
  }
  function orderStatus(value) {
    if (value === 'Completado') return '<span class="status-chip status-success">Completado</span>';
    if (value === 'Pendiente' || value === 'En preparación') return '<span class="status-chip status-pending">' + esc(value) + '</span>';
    if (value === 'Listo para entrega' || value === 'En tránsito') return '<span class="status-chip status-success">' + esc(value) + '</span>';
    return '<span class="status-chip status-muted">' + esc(value) + '</span>';
  }
  function art(tone) {
    return '<span class="product-art ' + esc(tone || '') + '" aria-hidden="true"><i class="bottle"></i></span>';
  }
  function setDate() {
    const today = new Date();
    document.getElementById('page-date').textContent = today.toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function heading(meta, actions) {
    const dashboardClass = state.view === 'dashboard' ? ' page-heading-dashboard' : '';
    const hrClass = state.view === 'hr' ? ' page-heading-hr' : '';
    const subtitle = state.view === 'hr' ? '' : '<p>' + meta.subtitle + '</p>';
    return '<div class="page-heading' + dashboardClass + hrClass + '"><div><h1>' + meta.heading + '</h1>' + subtitle + '</div><div class="heading-actions">' + (actions || '') + '</div></div>';
  }
  function metric(label, value, symbol, change, note, gold) {
    return '<article class="metric-card"><div class="metric-top"><span class="metric-label">' + label + '</span><span class="metric-symbol">' + svg(symbol) + '</span></div><div class="metric-value">' + value + '</div><div class="metric-foot"><span class="metric-change' + (gold ? ' gold' : '') + '">' + change + '</span><span class="metric-caption">' + note + '</span></div></article>';
  }
  function financialSnapshot(){ return calculateFinancialSnapshot(invoices, expenses, roundMoney); }
  function renderDashboard() {
    const activeProducts=products.filter(product=>product.active!==false);
    const top=activeProducts.slice().sort((a,b)=>b.stock-a.stock).slice(0,4);
    const recentInvoices=invoices.slice(0,5);
    const invoiceRows=recentInvoices.map(invoice=>'<tr><td data-label="Factura" class="table-primary">'+esc(invoice.id)+'</td><td data-label="Cliente">'+esc(invoice.customer||invoice.customerName)+'</td><td data-label="Fecha">'+dateText(invoice.createdAt)+'</td><td data-label="Total" class="table-primary">'+money(invoice.totalUsd)+'</td><td data-label="Estado">'+orderStatus(invoice.status)+'</td></tr>').join('');
    const topRows=top.map(product=>'<div class="top-product">'+art(product.tone)+'<div class="top-product-info"><strong>'+esc(product.name)+'</strong><small>'+esc(product.category)+' · '+product.stock+' unidades</small></div><span class="top-product-value">'+money(product.price)+'</span></div>').join('');
    const low=activeProducts.filter(needsRestock).length;
    const finance=financialSnapshot();
    const days=[];
    for(let offset=6;offset>=0;offset--){
      const day=new Date();day.setHours(0,0,0,0);day.setDate(day.getDate()-offset);
      const total=invoices.filter(invoice=>{const d=new Date(invoice.createdAt);return !Number.isNaN(d.getTime())&&d.toDateString()===day.toDateString();})
        .reduce((sum,invoice)=>sum+Number(invoice.totalUsd||0),0);
      days.push({label:day.toLocaleDateString('es-NI',{weekday:'short',day:'2-digit'}),total});
    }
    const maxDay=Math.max(1,...days.map(day=>day.total));
    const bars=days.map(day=>'<div class="stock-row"><div class="stock-row-head"><span>'+esc(day.label)+'</span><strong>'+money(day.total)+'</strong></div><div class="stock-track"><span class="stock-fill" style="width:'+Math.round(day.total/maxDay*100)+'%"></span></div></div>').join('');
    return heading(views.dashboard,'')+
      '<section class="metric-grid">'+
      metric('Ventas facturadas',money(finance.revenue),'chart',invoices.length+' facturas','productos vendidos · USD',false)+
      metric('Utilidad bruta',money(finance.grossProfit),'spark','Venta neta de productos − costo','antes de gastos operativos',true)+
      metric('Resultado después de gastos',money(finance.netProfit),'wallet',money(finance.operatingExpenses)+' en gastos','incluye ingresos de entrega; sin impuestos ni nómina no registrada',true)+
      metric('Alertas de inventario',String(low).padStart(2,'0'),'warning',activeProducts.length+' productos activos','stock bajo o agotado',true)+
      '</section>'+
      '<section class="dashboard-grid">'+
      '<article class="panel"><div class="panel-heading"><div><h2>Ventas facturadas · últimos 7 días</h2><p>Importes tomados de comprobantes registrados</p></div><button class="panel-link" data-view="analytics">Ver informes '+svg('arrow')+'</button></div><div class="chart-summary"><strong>'+money(finance.revenue)+'</strong><span>total facturado histórico · USD</span></div><div class="stock-summary">'+bars+'</div><div class="chart-note"><i></i> Solo incluye facturas guardadas en Neon.</div></article>'+
      '<article class="panel"><div class="panel-heading"><div><h2>Productos destacados</h2><p>Productos activos con más unidades disponibles</p></div><button class="panel-link" data-view="products">Catálogo '+svg('arrow')+'</button></div><div class="top-products">'+(topRows||'<div class="empty-state">Todavía no hay productos registrados.</div>')+'</div><div class="panel-footer-note">Precios, costos y existencias consultados desde Neon.</div></article>'+
      '</section>'+
      '<section class="lower-grid"><article class="panel"><div class="panel-heading"><div><h2>Facturas recientes</h2><p>Actividad comercial registrada</p></div><button class="panel-link" data-view="billing">Ver todas '+svg('arrow')+'</button></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FACTURA</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ESTADO</th></tr></thead><tbody>'+(invoiceRows||'<tr><td colspan="5"><div class="empty-state">Todavía no hay facturas.</div></td></tr>')+'</tbody></table></div></article>'+
      '<article class="panel"><div class="panel-heading"><div><h2>Estado del inventario</h2><p>Existencias y niveles mínimos</p></div></div><div class="stock-summary">'+
      stockBar('Disponible',activeProducts.filter(p=>p.stock>p.minStock).length,activeProducts.length,'')+
      stockBar('Stock bajo',activeProducts.filter(p=>p.stock>0&&needsRestock(p)).length,activeProducts.length,'low')+
      stockBar('Agotado',activeProducts.filter(p=>p.stock===0).length,activeProducts.length,'out')+
      '</div><div class="panel-footer-note">Los conteos reflejan existencias actuales guardadas en Neon.</div></article></section>';
  }
  function stockBar(label, count, total, tone) {
    const width = total ? Math.round(count / total * 100) : 0;
    return '<div class="stock-row"><div class="stock-row-head"><span>' + label + '</span><strong>' + count + ' productos</strong></div><div class="stock-track"><span class="stock-fill ' + tone + '" style="width:' + width + '%"></span></div></div>';
  }
  function needsRestock(product) {
    return product.stock <= (Number.isInteger(product.minStock) ? product.minStock : 3);
  }
  function filteredProducts() {
    return products.filter(function (product) {
      const query = (state.query || '').toLowerCase();
      const searchable = [product.name, product.brand, product.sku, product.category, product.concentration, product.family, product.supplier].join(' ').toLowerCase();
      const matches = !query || searchable.indexOf(query) !== -1;
      const minimum = Number.isInteger(product.minStock) ? product.minStock : 3;
      const stockMatch = state.filter === 'all' || (state.filter === 'available' && product.stock > minimum) ||
        (state.filter === 'low' && product.stock > 0 && product.stock <= minimum) || (state.filter === 'out' && product.stock === 0);
      const categoryMatch = state.category === 'all' || product.category === state.category;
      const statusMatch = state.productStatus === 'all' || (state.productStatus === 'active' && product.active !== false) || (state.productStatus === 'inactive' && product.active === false);
      return matches && stockMatch && categoryMatch && statusMatch;
    });
  }
  function productTable(items) {
    if (!items.length) return '<tr><td colspan="6"><div class="empty-state">No hay productos para los filtros seleccionados.</div></td></tr>';
    return items.map(function (product) {
      const costs = costSummary(product), inactive = product.active === false;
      const productStatus = inactive ? '<span class="status-chip status-muted">Desactivado</span>' : status(product.stock, product.minStock);
      const actions =
        '<button class="table-action" type="button" data-action="preview-product" data-id="' + product.id + '" aria-label="Ver ' + esc(product.name) + '" title="Ver ficha">' + svg('eye') + '</button>' +
        '<button class="table-action" type="button" data-action="edit-product" data-id="' + product.id + '" aria-label="Editar ' + esc(product.name) + '" title="Editar">' + svg('edit') + '</button>' +
        '<button class="table-action" type="button" data-action="toggle-product" data-id="' + product.id + '" aria-label="' + (inactive ? 'Activar ' : 'Desactivar ') + esc(product.name) + '" title="' + (inactive ? 'Activar' : 'Desactivar') + '">' + (inactive ? '↻' : '⏸') + '</button>' +
        '<button class="table-action table-action-danger" type="button" data-action="delete-product" data-id="' + product.id + '" aria-label="Eliminar ' + esc(product.name) + '" title="Eliminar">×</button>';
      return '<tr class="' + (inactive ? 'row-inactive' : '') + '"><td data-label="Perfume"><div class="product-cell"><span class="product-image-slot" data-product-image-slot="' + esc(product.id) + '">' + art(product.tone) + '</span><span><span class="table-primary">' + esc(product.name) + '</span><small class="table-secondary">' + productMeta(product) + '</small></span></div></td><td data-label="Categoría">' + esc(product.category) + '</td><td data-label="Precio y costo" class="table-primary">' + money(product.price) + '<small class="table-secondary">Costo ' + money(costs.unitCost) + ' · Margen ' + costs.margin.toFixed(1) + '%</small></td><td data-label="Existencias">' + product.stock + ' uds. <small class="table-secondary">Mín. ' + product.minStock + '</small></td><td data-label="Estado">' + productStatus + '</td><td data-label="Acciones"><div class="table-actions">' + actions + '</div></td></tr>';
    }).join('');
  }
  function renderProducts() {
    const activeCount = products.filter(function (product) { return product.active !== false; }).length;
    const inactiveCount = products.length - activeCount;
    const categories = ['Perfumería', 'Árabes', 'Diseñador', 'Nicho', 'Unisex', 'Body Mist', 'Sets / Combos', 'Accesorios'];
    const categoryOptions = categories.map(function (category) {
      return '<option value="' + esc(category) + '"' + (state.category === category ? ' selected' : '') + '>' + esc(category) + '</option>';
    }).join('');
    return heading(views.products, '<div class="heading-actions-inline"><button class="button button-quiet" data-action="import-products">' + svg('download') + ' Importar catálogo</button><button class="button button-primary" data-action="new-product">' + svg('plus') + ' Nuevo producto</button></div>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Productos activos</span><strong>' + activeCount + '</strong></div><div class="summary-mini"><span>Desactivados</span><strong>' + inactiveCount + '</strong></div><div class="summary-mini"><span>Requieren reposición</span><strong>' + products.filter(function (product) { return product.active !== false && needsRestock(product); }).length + '</strong></div></div>' +
      '<div class="toolbar products-toolbar"><div class="toolbar-left"><label class="inline-search">' + svg('search') + '<input id="view-search" type="search" value="' + esc(state.query) + '" aria-label="Buscar productos"></label></div><div class="toolbar-right"><select class="filter-select" id="product-status-filter" aria-label="Estado del producto"><option value="active"' + (state.productStatus === 'active' ? ' selected' : '') + '>Activos</option><option value="inactive"' + (state.productStatus === 'inactive' ? ' selected' : '') + '>Desactivados</option><option value="all"' + (state.productStatus === 'all' ? ' selected' : '') + '>Todos</option></select><select class="filter-select" id="category-filter" aria-label="Filtrar por categoría"><option value="all"' + (state.category === 'all' ? ' selected' : '') + '>Todas las categorías</option>' + categoryOptions + '</select><select class="filter-select" id="stock-filter" aria-label="Filtrar por stock"><option value="all"' + (state.filter === 'all' ? ' selected' : '') + '>Todos los estados</option><option value="available"' + (state.filter === 'available' ? ' selected' : '') + '>Disponibles</option><option value="low"' + (state.filter === 'low' ? ' selected' : '') + '>Stock bajo</option><option value="out"' + (state.filter === 'out' ? ' selected' : '') + '>Agotados</option></select></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>PRECIO / COSTO</th><th>EXISTENCIAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody id="product-table-body">' + productTable(filteredProducts()) + '</tbody></table></div></article>' +
      '<div class="notice-panel"><span>' + svg('spark') + '</span><div><strong>Catálogo conectado a Neon Development</strong><p>Las fichas se guardan en PostgreSQL. Las existencias iniciales y los movimientos posteriores quedan registrados en el kardex.</p></div></div>';
  }
  function renderInventoryMovementResults() {
    const query = String(state.inventoryMovementQuery || '').trim().toLocaleLowerCase('es');
    const startDate = state.inventoryMovementStartDate || '';
    const endDate = state.inventoryMovementEndDate || '';
    const ordered = inventoryMovements.slice().sort(function (a, b) {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
    const filtered = ordered.filter(function (movement) {
      const searchable = [movement.productName, movement.sku, movement.note, movement.type, movement.sourceId]
        .filter(Boolean).join(' ').toLocaleLowerCase('es');
      if (query && !searchable.includes(query)) return false;
      if (state.inventoryMovementType !== 'all' && String(movement.type || '') !== state.inventoryMovementType) return false;
      const date = new Date(movement.createdAt);
      const dateKey = Number.isNaN(date.getTime()) ? '' :
        date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      if (startDate && (!dateKey || dateKey < startDate)) return false;
      if (endDate && (!dateKey || dateKey > endDate)) return false;
      return true;
    });
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.inventoryMovementPage = Math.min(Math.max(1, Number(state.inventoryMovementPage) || 1), totalPages);
    const offset = (state.inventoryMovementPage - 1) * pageSize;
    const pageRows = filtered.slice(offset, offset + pageSize).map(function (movement) {
      const date = new Date(movement.createdAt);
      const dateLabel = Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
      const delta = Number(movement.delta || 0);
      const deltaLabel = delta > 0 ? '+' + delta : String(delta);
      return '<tr><td data-label="Fecha">' + esc(dateLabel) + '</td><td data-label="Perfume"><span class="table-primary">' + esc(movement.productName) + '</span><small class="table-secondary">' + esc(movement.sku || '') + '</small></td><td data-label="Tipo">' + esc(movement.type) + '</td><td data-label="Variación" class="table-primary">' + deltaLabel + ' uds.</td><td data-label="Stock resultante">' + Number(movement.previousStock || 0) + ' → ' + Number(movement.newStock || 0) + '</td><td data-label="Nota">' + esc(movement.note || '—') + '</td></tr>';
    }).join('');
    const rangeStart = filtered.length ? offset + 1 : 0;
    const rangeEnd = Math.min(offset + pageSize, filtered.length);
    const emptyMessage = inventoryMovements.length ? 'No hay movimientos que coincidan con los filtros.' : 'Todavía no hay movimientos registrados.';
    return '<div class="table-wrap"><table class="data-table inventory-ledger-table"><thead><tr><th>FECHA</th><th>PRODUCTO</th><th>TIPO</th><th>VARIACIÓN</th><th>STOCK RESULTANTE</th><th>NOTA</th></tr></thead><tbody id="inventory-movement-body">' +
      (pageRows || '<tr><td colspan="6"><div class="empty-state">' + emptyMessage + '</div></td></tr>') + '</tbody></table></div>' +
      '<div class="inventory-ledger-footer"><span class="inventory-ledger-range">Mostrando ' + rangeStart + '–' + rangeEnd + ' de ' + filtered.length + ' movimientos</span>' +
      '<div class="inventory-ledger-pagination"><button class="button button-quiet button-small" type="button" data-action="inventory-page" data-page="previous" ' + (state.inventoryMovementPage <= 1 ? 'disabled' : '') + '>Anterior</button>' +
      '<span class="ledger-count">Página ' + state.inventoryMovementPage + ' de ' + totalPages + '</span>' +
      '<button class="button button-quiet button-small" type="button" data-action="inventory-page" data-page="next" ' + (state.inventoryMovementPage >= totalPages ? 'disabled' : '') + '>Siguiente</button></div></div>';
  }
  function refreshInventoryMovementResults() {
    const container = document.getElementById('inventory-movement-results');
    if (container) container.innerHTML = renderInventoryMovementResults();
  }
  function renderInventoryLedger() {
    const types = [['all', 'Todos los movimientos'], ['Entrada', 'Entradas'], ['Salida', 'Salidas'], ['Ajuste', 'Ajustes'], ['Devolucion', 'Devoluciones'], ['Reversion', 'Reversiones']];
    const typeOptions = types.map(function (item) {
      return '<option value="' + item[0] + '"' + (state.inventoryMovementType === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
    }).join('');
    return '<article class="list-panel ledger-panel inventory-ledger-panel"><div class="panel-heading"><div><h2>Historial de movimientos</h2><p>Hasta 5,000 movimientos recientes, con filtros por producto, tipo y fecha</p></div><span class="ledger-count">' + inventoryMovements.length + ' movimientos</span></div>' +
      '<div class="toolbar products-toolbar inventory-ledger-toolbar"><div class="toolbar-left"><label class="inline-search">' + svg('search') + '<input id="inventory-movement-search" type="search" value="' + esc(state.inventoryMovementQuery) + '" placeholder="Producto, SKU o nota" aria-label="Buscar en el kardex"></label></div>' +
      '<div class="toolbar-right"><select class="filter-select" id="inventory-movement-type" aria-label="Filtrar movimientos por tipo">' + typeOptions + '</select>' +
      '<input class="filter-select" type="date" id="inventory-movement-start" value="' + esc(state.inventoryMovementStartDate) + '" aria-label="Desde fecha">' +
      '<input class="filter-select" type="date" id="inventory-movement-end" value="' + esc(state.inventoryMovementEndDate) + '" aria-label="Hasta fecha">' +
      '<button class="button button-quiet button-small" type="button" data-action="clear-inventory-filters">Limpiar filtros</button></div></div>' +
      '<div id="inventory-movement-results">' + renderInventoryMovementResults() + '</div></article>';
  }
  function filteredInventoryProducts() {
    const query = String(state.inventoryProductQuery || '').trim().toLocaleLowerCase('es');
    return products.filter(function (product) {
      if (product.active === false) return false;
      const searchable = [product.name, product.brand, product.sku, product.category, product.barcode, product.location]
        .filter(Boolean).join(' ').toLocaleLowerCase('es');
      const matchesQuery = !query || searchable.includes(query);
      const matchesCategory = state.inventoryProductCategory === 'all' || product.category === state.inventoryProductCategory;
      const minimum = Number.isInteger(product.minStock) ? product.minStock : 3;
      const matchesStock = state.inventoryProductStock === 'all' ||
        (state.inventoryProductStock === 'available' && product.stock > minimum) ||
        (state.inventoryProductStock === 'low' && product.stock > 0 && product.stock <= minimum) ||
        (state.inventoryProductStock === 'out' && product.stock === 0);
      return matchesQuery && matchesCategory && matchesStock;
    }).sort(function (a, b) {
      return a.stock - b.stock || String(a.name).localeCompare(String(b.name), 'es');
    });
  }
  function renderInventoryProductRows() {
    const filtered = filteredInventoryProducts();
    const rows = filtered.map(function (product) {
      const suggestion = product.stock === 0 ? 'Reposición urgente' : (needsRestock(product) ? 'Revisar reposición' : 'Nivel estable');
      return '<tr><td data-label="Perfume"><div class="product-cell">' + art(product.tone) + '<span><span class="table-primary">' + esc(product.name) + '</span><small class="table-secondary">' + esc(product.sku) + ' · Mín. ' + product.minStock + '</small></span></div></td><td data-label="Categoría">' + esc(product.category || '—') + '</td><td data-label="Stock actual" class="table-primary">' + product.stock + ' unidades</td><td data-label="Estado">' + status(product.stock, product.minStock) + '</td><td data-label="Reposición"><span class="table-secondary">' + suggestion + '</span></td><td data-label="Acción"><button class="button button-quiet button-small" type="button" data-action="stock-product" data-id="' + product.id + '">Registrar movimiento</button></td></tr>';
    }).join('');
    const count = document.getElementById('inventory-product-count');
    const body = document.getElementById('inventory-product-body');
    if (count) count.textContent = filtered.length + ' de ' + products.filter(function (product) { return product.active !== false; }).length + ' productos';
    if (body) body.innerHTML = rows || '<tr><td colspan="6"><div class="empty-state">No hay productos que coincidan con los filtros.</div></td></tr>';
  }
  function renderInventory() {
    const activeProducts = products.filter(function (product) { return product.active !== false; });
    const categories = Array.from(new Set(activeProducts.map(function (product) { return product.category; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    const categoryOptions = categories.map(function (category) {
      return '<option value="' + esc(category) + '"' + (state.inventoryProductCategory === category ? ' selected' : '') + '>' + esc(category) + '</option>';
    }).join('');
    const rows = filteredInventoryProducts().map(function (product) {
      const suggestion = product.stock === 0 ? 'Reposición urgente' : (needsRestock(product) ? 'Revisar reposición' : 'Nivel estable');
      return '<tr><td data-label="Perfume"><div class="product-cell">' + art(product.tone) + '<span><span class="table-primary">' + esc(product.name) + '</span><small class="table-secondary">' + esc(product.sku) + ' · Mín. ' + product.minStock + '</small></span></div></td><td data-label="Categoría">' + esc(product.category || '—') + '</td><td data-label="Stock actual" class="table-primary">' + product.stock + ' unidades</td><td data-label="Estado">' + status(product.stock, product.minStock) + '</td><td data-label="Reposición"><span class="table-secondary">' + suggestion + '</span></td><td data-label="Acción"><button class="button button-quiet button-small" type="button" data-action="stock-product" data-id="' + product.id + '">Registrar movimiento</button></td></tr>';
    }).join('');
    return heading(views.inventory, '<div class="heading-actions-inline"><button class="button button-quiet" data-action="export-inventory">' + svg('download') + ' Exportar CSV</button><button class="button button-primary" data-action="stock-new">' + svg('plus') + ' Registrar movimiento</button></div>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Referencias activas</span><strong>' + activeProducts.length + '</strong></div><div class="summary-mini"><span>Unidades en stock</span><strong>' + activeProducts.reduce(function (sum, product) { return sum + product.stock; }, 0) + '</strong></div><div class="summary-mini"><span>Para reponer</span><strong>' + activeProducts.filter(needsRestock).length + '</strong></div></div>' +
      '<article class="list-panel inventory-stock-panel"><div class="toolbar products-toolbar inventory-products-toolbar"><div class="toolbar-left"><label class="inline-search">' + svg('search') + '<input id="inventory-product-search" type="search" value="' + esc(state.inventoryProductQuery) + '" placeholder="Nombre, SKU, código o ubicación" aria-label="Buscar productos en existencias"></label></div><div class="toolbar-right"><select class="filter-select" id="inventory-product-category" aria-label="Categoría de existencias"><option value="all">Todas las categorías</option>' + categoryOptions + '</select><select class="filter-select" id="inventory-product-stock" aria-label="Estado de existencias"><option value="all"' + (state.inventoryProductStock === 'all' ? ' selected' : '') + '>Todos los estados</option><option value="available"' + (state.inventoryProductStock === 'available' ? ' selected' : '') + '>Disponibles</option><option value="low"' + (state.inventoryProductStock === 'low' ? ' selected' : '') + '>Stock bajo</option><option value="out"' + (state.inventoryProductStock === 'out' ? ' selected' : '') + '>Agotados</option></select><button class="button button-quiet button-small" type="button" data-action="clear-inventory-product-filters">Limpiar</button></div></div><div class="inventory-products-meta"><span id="inventory-product-count">' + rows.length + ' de ' + activeProducts.length + ' productos</span><span>Ordenados por menor existencia</span></div><div class="table-wrap"><table class="data-table inventory-stock-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK</th><th>ESTADO</th><th>ACCIÓN SUGERIDA</th><th></th></tr></thead><tbody id="inventory-product-body">' + (rows || '<tr><td colspan="6"><div class="empty-state">No hay productos que coincidan con los filtros.</div></td></tr>') + '</tbody></table></div></article>' +
      renderInventoryLedger() +
      '<div class="notice-panel"><span>' + svg('warning') + '</span><div><strong>Stock mínimo configurable por producto · Kardex conectado</strong><p>El sistema valida que las salidas no dejen existencias negativas. Cada movimiento conserva stock anterior, variación y stock resultante. Cada operación se registra en Neon y conserva su trazabilidad.</p></div></div>';
  }
  function showProductDetails(productId) {
    const product = products.find(function (item) { return String(item.id) === String(productId); });
    if (!product) return;
    const costs = costSummary(product);
    const fields = [
      ['Marca', product.brand], ['SKU', product.sku], ['Categoría', product.category],
      ['Concentración', product.concentration], ['Género', product.gender], ['Familia olfativa', product.family],
      ['Contenido', product.sizeMl ? product.sizeMl + ' ml' : '—'], ['Presentación', product.presentation],
      ['Proveedor', product.supplier], ['Costo unitario', money(costs.unitCost)], ['Precio de venta', money(product.price)],
      ['Utilidad estimada', money(costs.profit)], ['Margen bruto', costs.margin.toFixed(1) + '%'],
      ['Existencias', product.stock + ' unidades'], ['Stock mínimo', product.minStock + ' unidades'],
      ['Ubicación', product.location], ['Estado', product.active === false ? 'Desactivado' : 'Activo']
    ];
    document.getElementById('product-detail-title').textContent = product.name;
    document.getElementById('product-detail-content').innerHTML = '<div class="detail-grid">' + fields.map(function (field) {
      return '<div class="detail-field"><span>' + esc(field[0]) + '</span><strong>' + esc(field[1] || '—') + '</strong></div>';
    }).join('') + '</div>' + (product.notes ? '<p class="detail-notes">' + esc(product.notes) + '</p>' : '') + '<div class="detail-image-gallery product-image-gallery" id="product-detail-images"></div>';
    mountProductImageGallery(document.getElementById('product-detail-images'),product);
    document.getElementById('edit-detail-product').setAttribute('data-id', String(product.id));
    if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
  }
  function exportCsvFile(filename,rows){
    const csv='\\uFEFF'+rows.map(row=>row.map(cell=>'"'+String(cell==null?'':cell).replace(/"/g,'""')+'"').join(',')).join('\\r\\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=filename;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportCurrentView(){
    let rows=[],filename='jb-parfums-registro.csv';
    if(state.view==='products'){
      filename='jb-parfums-productos.csv';
      rows=[['SKU','Producto','Marca','Categoría','Precio USD','Costo USD','Stock','Stock mínimo','Estado'],
        ...products.map(p=>[p.sku,p.name,p.brand,p.category,p.price,p.unitCost,p.stock,p.minStock,p.active===false?'Inactivo':'Activo'])];
    }else if(state.view==='orders'){
      filename='jb-parfums-pedidos.csv';
      rows=[['Pedido','Cliente','Fecha','Total USD','Estado','Pago'],
        ...orders.map(o=>[o.id,o.customer,o.date,o.amount,o.status,o.paymentStatus])];
    }else if(state.view==='customers'){
      filename='jb-parfums-clientes.csv';
      rows=[['Cliente','Contacto','Pedidos','Total USD'],...customers.map(x=>[x.name,x.contact,x.orders,x.spent])];
    }else if(state.view==='suppliers'){
      filename='jb-parfums-proveedores.csv';
      rows=[['Proveedor','Contacto','Teléfono','Correo','Moneda'],...suppliers.map(x=>[x.name,x.contact,x.phone,x.email,x.currency])];
    }else if(state.view==='purchases'){
      filename='jb-parfums-compras.csv';
      rows=[['Compra','Proveedor','Fecha','Total USD','Pagado USD','Estado'],...purchases.map(x=>[x.purchaseNumber,x.supplier,dateText(x.createdAt),x.totalUsd,x.paidUsd,x.status])];
    }else if(state.view==='billing'||state.view==='receivables'){
      filename='jb-parfums-facturas.csv';
      rows=[['Factura','Cliente','Fecha','Total USD','Pagado USD','Saldo USD','Estado'],...invoices.map(x=>[x.id,x.customer,dateText(x.createdAt),x.totalUsd,x.paidUsd,Math.max(0,x.totalUsd-x.paidUsd),x.status])];
    }else if(state.view==='expenses'){
      filename='jb-parfums-gastos.csv';
      rows=[['Fecha','Categoría','Descripción','Moneda','Importe','Equivalente USD'],...expenses.map(x=>[dateText(x.createdAt),x.category,x.description,x.currency,x.originalAmount,x.amountUsd])];
    }else if(state.view==='cash'){
      filename='jb-parfums-caja-bancos.csv';
      rows=[['Fecha','Dirección','Concepto','Cuenta','Moneda','Importe','USD'],...cashEntries.map(x=>[dateText(x.createdAt),x.direction,x.concept,x.account,x.currency,x.originalAmount,x.amountUsd])];
    }else if(state.view==='analytics'){
      const f=financialSnapshot();filename='jb-parfums-resultados.csv';
      rows=[['Indicador','USD'],['Ventas facturadas (incluye entrega)',f.revenue],['Venta neta de productos',f.productNetSales],['Ingresos por entrega',f.deliveryIncome],['Costo de ventas',f.costOfSales],['Utilidad bruta de productos',f.grossProfit],['Gastos operativos',f.operatingExpenses],['Resultado después de gastos',f.netProfit]];
    }
    if(state.view==='dgi'){exportDgiBook();return;}
    if(!rows.length){toast('No hay datos disponibles para exportar en esta sección.');return;}
    exportCsvFile(filename,rows);
    toast('Exportación CSV generada desde los datos de Neon.');
  }
  function renderInventoryCsv() {
    const rows = [['SKU', 'Producto', 'Categoría', 'Stock', 'Stock mínimo', 'Estado', 'Ubicación']];
    products.filter(function (product) { return product.active !== false; }).forEach(function (product) {
      rows.push([product.sku, product.name, product.category, product.stock, product.minStock, product.stock === 0 ? 'Agotado' : (needsRestock(product) ? 'Stock bajo' : 'Disponible'), product.location || '']);
    });
    const csv = '\uFEFF' + rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'jb-parfums-inventario.csv';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Inventario exportado a CSV.');
  }
  function showOrderDetails(orderId) {
    const order = orders.find(function (item) { return String(item.id) === String(orderId); });
    if (!order) { toast('No se encontró el pedido seleccionado.'); return; }
    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce(function (sum, item) { return sum + (Number(item.quantity) * Number(item.unitPrice)); }, 0);
    const discount = Number(order.discount || 0);
    const deliveryFee = Number(order.deliveryFee || 0);
    const total = subtotal - discount + deliveryFee;
    const lineRows = items.map(function (item) {
      const lineTotal = Number(item.quantity) * Number(item.unitPrice);
      return '<tr><td><span class="table-primary">' + esc(item.name) + '</span><small class="table-secondary">' + esc(item.sku || '—') + '</small></td><td>' + item.quantity + '</td><td>' + money(item.unitPrice) + '</td><td class="table-primary">' + money(lineTotal) + '</td></tr>';
    }).join('');
    document.getElementById('order-detail-title').textContent = order.id;
    document.getElementById('order-detail-subtitle').textContent = 'Pedido registrado · ' + order.date + ' · Consulta de datos guardados en Neon.';
    document.getElementById('order-detail-content').innerHTML =
      '<section class="order-detail-grid">' +
        '<div class="detail-field"><span>Cliente</span><strong>' + esc(order.customer) + '</strong></div>' +
        '<div class="detail-field"><span>Contacto</span><strong>' + esc(order.phone || 'No registrado') + '</strong></div>' +
        '<div class="detail-field"><span>Método de pago</span><strong>' + esc(order.paymentMethod || 'No registrado') + '</strong></div>' +
        '<div class="detail-field"><span>Estado del pago</span><strong>' + esc(order.paymentStatus || 'No registrado') + '</strong></div>' +
        '<div class="detail-field"><span>Moneda de cobro</span><strong>' + esc(order.paymentCurrency || 'USD') + '</strong></div>' +
        '<div class="detail-field"><span>Importe de cobro</span><strong>' + esc(moneyInCurrency(order.paymentAmount == null ? order.amount : order.paymentAmount, order.paymentCurrency || 'USD')) + '</strong></div>' +
        '<div class="detail-field"><span>Tipo de cambio</span><strong>' + rateLabel(order.exchangeRate || 36.6) + '</strong></div>' +
        '<div class="detail-field"><span>Entrega</span><strong>' + esc(order.deliveryMode || 'No definida') + '</strong></div>' +
        '<div class="detail-field"><span>Estado del pedido</span><strong>' + orderStatus(order.status) + '</strong></div>' +
      '</section>' +
      '<section class="order-items-section"><div class="order-items-heading">Productos del pedido</div>' +
        '<div class="table-wrap"><table class="data-table order-items-table"><thead><tr><th>PRODUCTO / SKU</th><th>CANT.</th><th>PRECIO</th><th>SUBTOTAL</th></tr></thead><tbody>' + (lineRows || '<tr><td colspan="4">Sin productos registrados.</td></tr>') + '</tbody></table></div>' +
      '</section>' +
      '<div class="order-totals">' +
        '<div><span>Subtotal</span><strong>' + money(subtotal) + '</strong></div>' +
        (discount ? '<div><span>Descuento</span><strong>− ' + money(discount) + '</strong></div>' : '') +
        (deliveryFee ? '<div><span>Entrega</span><strong>' + money(deliveryFee) + '</strong></div>' : '') +
        '<div class="order-grand-total"><span>Total del pedido</span><strong>' + money(total) + '</strong></div>' +
      '</div>' +
      '<p class="order-demo-warning">Los cambios de estado aplican el movimiento de inventario correspondiente y quedan registrados en el kardex.</p>';
    const statusSelect = document.getElementById('order-status-select');
    statusSelect.value = order.status;
    document.getElementById('save-order-status').setAttribute('data-id', String(order.id));
    if (typeof orderDialog.showModal === 'function') orderDialog.showModal();
    else toast('El detalle de pedidos no es compatible con este navegador.');
  }
  function resolveOrderProduct(item) {
    return (item.productId!=null&&products.find(p=>String(p.id)===String(item.productId))) ||
      (item.sku&&products.find(p=>String(p.sku).toLowerCase()===String(item.sku).toLowerCase())) ||
      (item.name&&products.find(p=>String(p.name).toLowerCase()===String(item.name).toLowerCase())) || null;
  }
  function orderInventoryRequirements(order) {
    const grouped=new Map();
    for(const item of (Array.isArray(order.items)?order.items:[])){
      const quantity=Number(item.quantity),product=resolveOrderProduct(item);
      if(!Number.isInteger(quantity)||quantity<1)return {error:'El pedido contiene una cantidad inválida.'};
      if(!product)return {error:'No se pudo vincular uno de los perfumes del pedido con el inventario. No se realizó ningún cambio.'};
      const current=grouped.get(String(product.id));
      if(current)current.quantity+=quantity;else grouped.set(String(product.id),{product,quantity});
    }
    if(!grouped.size)return {error:'El pedido no contiene productos para descontar del inventario.'};
    return {items:Array.from(grouped.values())};
  }
  function recordOrderInventory(order,restoreStock) {
    const requirement=orderInventoryRequirements(order);
    if(requirement.error)return requirement;
    if(!restoreStock){
      const insufficient=requirement.items.find(line=>line.product.active===false||line.product.stock<line.quantity);
      if(insufficient)return {error:insufficient.product.active===false?'El perfume '+insufficient.product.name+' está desactivado y no puede venderse.':'Stock insuficiente para '+insufficient.product.name+'. Disponible: '+insufficient.product.stock+'; solicitado: '+insufficient.quantity+'.'};
    }
    const timestamp=new Date().toISOString();
    requirement.items.forEach(function(line,index){
      const product=line.product,previous=Number(product.stock||0),delta=restoreStock?line.quantity:-line.quantity,next=previous+delta;
      product.stock=next;
      inventoryMovements.unshift({id:Date.now()+index,productId:product.id,productName:product.name,sku:product.sku,type:restoreStock?'Reingreso por pedido':'Salida por pedido',quantity:line.quantity,delta,previousStock:previous,newStock:next,note:(restoreStock?'Reversión del pedido ':'Pedido confirmado ')+order.id,sourceType:'order',sourceId:String(order.id),createdAt:timestamp});
    });
    return {items:requirement.items};
  }
  function recordInvoiceInventory(invoice){
    const prior=inventoryMovements.some(m=>m.sourceType==='invoice'&&String(m.sourceId)===String(invoice.id)&&Number(m.delta)<0);
    if(invoice.inventoryAppliedAt||prior){invoice.inventoryAppliedAt=invoice.inventoryAppliedAt||new Date().toISOString();return {already:true};}
    const grouped=new Map();
    for(const item of invoice.items||[]){
      const product=resolveOrderProduct(item),quantity=Number(item.quantity);
      if(!product||!Number.isInteger(quantity)||quantity<1)return {error:'No se pudo vincular un perfume con el inventario o la cantidad es inválida.'};
      const current=grouped.get(String(product.id));
      if(current)current.quantity+=quantity;else grouped.set(String(product.id),{product,quantity});
    }
    const lines=Array.from(grouped.values());
    const insufficient=lines.find(line=>line.product.active===false||Number(line.product.stock||0)<line.quantity);
    if(insufficient)return {error:insufficient.product.active===false?'El perfume '+insufficient.product.name+' está desactivado.':'Stock insuficiente para '+insufficient.product.name+'. Disponible: '+insufficient.product.stock+'; solicitado: '+insufficient.quantity+'.'};
    const timestamp=new Date().toISOString();
    lines.forEach((line,index)=>{
      const product=line.product,previous=Number(product.stock||0),next=previous-line.quantity;
      product.stock=next;
      inventoryMovements.unshift({id:Date.now()+index,productId:product.id,productName:product.name,sku:product.sku,type:'Venta por factura',quantity:line.quantity,delta:-line.quantity,previousStock:previous,newStock:next,note:'Factura '+invoice.id,sourceType:'invoice',sourceId:String(invoice.id),createdAt:timestamp});
    });
    invoice.inventoryAppliedAt=timestamp;
    return {items:lines};
  }
  async function saveOrderStatus() {
    const button=document.getElementById('save-order-status');
    const order=orders.find(item=>String(item.id)===button?.getAttribute('data-id'));
    const nextStatus=document.getElementById('order-status-select')?.value;
    const allowedStatuses=['Pendiente','En preparación','Listo para entrega','En tránsito','Completado','Cancelado'];
    if(!order||!order.dbId||!allowedStatuses.includes(nextStatus)){toast('No se pudo validar el pedido o el estado.');return;}
    if(order.status===nextStatus){toast('El pedido ya tiene ese estado.');return;}
    if(order.status==='Completado'||order.status==='Cancelado'){toast('Un pedido cerrado no se puede reabrir desde este formulario.');return;}
    if(button){button.disabled=true;button.textContent='Guardando…';}
    try {
      await erpApi('orders/'+encodeURIComponent(order.dbId),{method:'PATCH',body:JSON.stringify({status:nextStatus})});
      await loadERPFromNeon(true);
      orderDialog.close();
      renderView();
      toast('Estado del pedido actualizado. El inventario se ajustó en Neon.');
    } catch(error) {
      toast(error?.message||'No se pudo actualizar el pedido.');
    } finally {
      if(button){button.disabled=false;button.textContent='Guardar cambios';}
    }
  }
  function featureCard(symbol, title, description) {
    return '<article class="feature-card"><span class="feature-symbol">' + svg(symbol) + '</span><h3>' + title + '</h3><p>' + description + '</p></article>';
  }
  function requiredMark(){return '<span class="required-mark" aria-hidden="true">*</span>';}
  function formField(label,name,type,required,attrs){return '<label class="form-field"><span>'+label+(required?' '+requiredMark():'')+'</span><input name="'+name+'" type="'+(type||'text')+'"'+(required?' required':'')+' '+(attrs||'')+'></label>';}
  function selectField(label,name,options,required){return '<label class="form-field"><span>'+label+(required?' '+requiredMark():'')+'</span><select name="'+name+'"'+(required?' required':'')+'>'+options+'</select></label>';}
  function currencyField(selected){return selectField('Moneda de la operación','currency',currencyOptions(selected||'USD'),true);}
  function supplierOptions(){return suppliers.map((s,i)=>'<option value="'+i+'">'+esc(s.name)+'</option>').join('');}
  function searchableField(label,name,lookupType,required,fieldId){
    const id=fieldId||('business-'+name+'-search');
    return '<div class="form-field search-field" data-search-field><label for="'+id+'">'+label+(required?' '+requiredMark():'')+'</label><input id="'+id+'" type="search" data-lookup="'+lookupType+'" data-target="'+name+'" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="'+id+'-results"'+(required?' required':'')+'><input type="hidden" name="'+name+'"><div class="search-results" id="'+id+'-results" role="listbox" hidden></div></div>';
  }
  function lookupItems(type){
    if(type==='customer')return customers.map((item,index)=>({value:String(index),label:item.name,meta:item.contact||'Sin contacto',search:[item.name,item.contact].join(' ')}));
    if(type==='supplier')return suppliers.map((item,index)=>({value:String(index),label:item.name,meta:[item.contact,item.phone].filter(Boolean).join(' · ')||'Proveedor',search:[item.name,item.contact,item.phone,item.email].join(' ')}));
    if(type==='product')return products.filter(item=>item.active!==false).map(item=>({value:String(item.id),label:item.name,meta:[item.sku,item.barcode,money(item.price),'Stock '+item.stock].filter(Boolean).join(' · '),search:[item.name,item.sku,item.barcode,item.brand,item.category].join(' ')}));
    if(type==='order')return orders.filter(item=>!invoices.some(invoice=>invoice.orderId===item.id)).map(item=>({value:item.id,label:item.id,meta:item.customer+' · '+money(item.amount),search:[item.id,item.customer,item.phone].join(' ')}));
    return [];
  }
  function renderLookupResults(input){
    const field=input.closest('[data-search-field]'),results=field&&field.querySelector('.search-results');
    if(!field||!results)return;
    const query=String(input.value||'').trim().toLocaleLowerCase('es');
    const items=lookupItems(input.dataset.lookup).filter(item=>!query||item.search.toLocaleLowerCase('es').includes(query)).slice(0,8);
    results.innerHTML=items.length?items.map(item=>'<button type="button" class="search-option" role="option" data-lookup-select data-value="'+esc(item.value)+'" data-label="'+esc(item.label)+'"><strong>'+esc(item.label)+'</strong><small>'+esc(item.meta)+'</small></button>').join(''):'<p class="search-empty">No hay coincidencias.</p>';
    results.hidden=false;input.setAttribute('aria-expanded','true');
  }
  function closeLookupResults(field){
    const input=field&&field.querySelector('[data-lookup]'),results=field&&field.querySelector('.search-results');
    if(results)results.hidden=true;
    if(input)input.setAttribute('aria-expanded','false');
  }
  function chooseLookupOption(field,value,label){
    if(!field)return;
    const input=field.querySelector('[data-lookup]'),hidden=field.querySelector('input[type="hidden"]');
    if(!input||!hidden)return;
    input.value=label;hidden.value=value;input.setCustomValidity('');closeLookupResults(field);
    if(input.dataset.lookup==='order'&&businessForm.dataset.recordType==='invoice')loadInvoiceOrderIntoDraft(value);
  }
  function selectLookupValue(input,value){
    const item=lookupItems(input.dataset.lookup).find(entry=>String(entry.value)===String(value));
    if(item)chooseLookupOption(input.closest('[data-search-field]'),item.value,item.label);
  }
  function invoiceUsdPrimary(amountUsd,rate){
    return '<strong class="invoice-money-stack">'+money(amountUsd)+'<small>'+moneyInCurrency(roundMoney(Number(amountUsd||0)*Number(rate||exchangeRate)),'NIO')+'</small></strong>';
  }
  function invoiceSelectedCurrency(){
    return businessForm.querySelector('[name="currency"]')?.value==='NIO'?'NIO':'USD';
  }
  function invoiceSuggestedPrice(product){
    const customerType=businessForm.querySelector('[name="customerType"]')?.value||'particular';
    const wholesale=Number(product.wholesalePrice||0);
    return customerType==='business'&&wholesale>0?wholesale:Number(product.price||0);
  }
  function applyInvoiceCustomerPricing(){
    if(businessForm.dataset.recordType!=='invoice'||businessForm.querySelector('[name="saleSource"]')?.value==='web')return;
    invoiceDraftItems=invoiceDraftItems.map(line=>{
      const product=products.find(item=>String(item.id)===String(line.productId));
      return product?Object.assign({},line,{unitPriceUsd:invoiceSuggestedPrice(product)}):line;
    });
    renderInvoiceCart();
  }
  function invoiceDraftTotals(){
    if(!invoiceDraftItems.length)return {error:'Agrega al menos un perfume a la factura.'};
    const items=[];
    for(const line of invoiceDraftItems){
      const quantity=Number(line.quantity),unitPriceUsd=Number(line.unitPriceUsd);
      if(!Number.isInteger(quantity)||quantity<1||!Number.isFinite(unitPriceUsd)||unitPriceUsd<0)return {error:'Revisa las cantidades y los precios unitarios.'};
      items.push(Object.assign({},line,{quantity,unitPriceUsd:roundMoney(unitPriceUsd),lineTotalUsd:roundMoney(quantity*unitPriceUsd)}));
    }
    const subtotalUsd=roundMoney(items.reduce((sum,item)=>sum+item.lineTotalUsd,0));
    const discountUsd=roundMoney(Number(businessForm.querySelector('[name="discountUsd"]')?.value||0));
    const deliveryFeeUsd=roundMoney(Number(businessForm.querySelector('[name="deliveryFeeUsd"]')?.value||0));
    if(!Number.isFinite(discountUsd)||!Number.isFinite(deliveryFeeUsd)||discountUsd<0||deliveryFeeUsd<0||discountUsd>subtotalUsd)return {error:'El descuento o el cargo de entrega no es válido.'};
    const totalUsd=roundMoney(subtotalUsd-discountUsd+deliveryFeeUsd);
    if(totalUsd<=0)return {error:'El total de la factura debe ser mayor que cero.'};
    return {items,subtotalUsd,discountUsd,deliveryFeeUsd,totalUsd};
  }
  function renderInvoiceCart(){
    if(businessForm.dataset.recordType!=='invoice')return;
    const target=businessForm.querySelector('#invoice-cart');
    if(!target)return;
    const source=businessForm.querySelector('[name="saleSource"]')?.value||'store';
    const count=businessForm.querySelector('#invoice-item-count');
    if(count)count.textContent=invoiceDraftItems.length+' '+(invoiceDraftItems.length===1?'artículo':'artículos');
    if(!invoiceDraftItems.length){
      target.innerHTML='<div class="invoice-preview-empty">Todavía no hay perfumes agregados. Busca por nombre, SKU o código de barras.</div>';
      updateInvoicePreview();
      return;
    }
    target.innerHTML='<div class="invoice-cart-list">'+invoiceDraftItems.map((line,index)=>{
      const product=products.find(item=>String(item.id)===String(line.productId));
      const stock=product?Number(product.stock||0):'—';
      return '<div class="invoice-cart-row"><div class="invoice-cart-product"><strong>'+esc(line.name)+'</strong><small>'+esc(line.sku||'Sin SKU')+(line.barcode?' · '+esc(line.barcode):'')+' · Stock: '+esc(stock)+'</small></div>'+
        '<label><span>Cantidad</span><input type="number" min="1" step="1" value="'+esc(line.quantity)+'" data-invoice-quantity="'+index+'" aria-label="Cantidad de '+esc(line.name)+'" '+(source==='web'?'readonly':'')+'></label>'+
        '<label><span>Precio unitario USD</span><input type="number" min="0" step="0.01" value="'+esc(line.unitPriceUsd)+'" data-invoice-price="'+index+'" aria-label="Precio unitario de '+esc(line.name)+'" '+(source==='web'?'readonly':'')+'></label>'+
        (source==='web'?'':'<button type="button" class="table-action invoice-remove-line" data-action="remove-invoice-product" data-index="'+index+'" aria-label="Quitar '+esc(line.name)+'">×</button>')+'</div>';
    }).join('')+'</div>';
    updateInvoicePreview();
  }
  function loadInvoiceOrderIntoDraft(orderId){
    if(businessForm.dataset.recordType!=='invoice')return;
    const order=orders.find(item=>String(item.id)===String(orderId));
    if(!order)return;
    const set=(name,value)=>{const field=businessForm.querySelector('[name="'+name+'"]');if(field)field.value=value==null?'':String(value);};
    set('customerName',order.customer||'');
    set('customerPhone',order.phone||'');
    set('customerType',order.customerType||'particular');
    set('currency',order.paymentCurrency==='NIO'?'NIO':'USD');
    const invoicePaymentMethods=['Efectivo','Transferencia','Tarjeta','Pago móvil','Cheque','Efectivo contra entrega','Pendiente / crédito','Otro'];
    const orderPaymentMethod=String(order.paymentMethod||'');
    set('paymentMethod',invoicePaymentMethods.includes(orderPaymentMethod)?orderPaymentMethod:'Pendiente / crédito');
    set('discountUsd',Number(order.discount||0));
    set('deliveryFeeUsd',Number(order.deliveryFee||0));
    invoiceDraftItems=(Array.isArray(order.items)?order.items:[]).map(item=>{
      const product=resolveOrderProduct(item);
      return {productId:product?product.id:(item.productId==null?null:item.productId),name:String(item.name||product?.name||'Perfume'),sku:String(item.sku||product?.sku||''),barcode:String(product?.barcode||''),quantity:Number(item.quantity||1),unitPriceUsd:roundMoney(Number(item.unitPrice||product?.price||0))};
    });
    const totals=invoiceDraftTotals();
    const paidCurrency=order.paymentCurrency==='NIO'?'NIO':'USD';
    const orderRate=Number(order.exchangeRate||exchangeRate);
    const isPaid=String(order.paymentStatus||'').toLocaleLowerCase('es').includes('pagado');
    const paid=isPaid?(paidCurrency==='NIO'?roundMoney((totals.totalUsd||0)*orderRate):(totals.totalUsd||0)):Number(order.paidAmount||0);
    set('amountReceived',paid);
    businessForm.dataset.invoiceReceivedEdited='1';
    businessForm.dataset.invoiceCurrency=paidCurrency;
    businessForm.dataset.invoiceReceivedRate=String(orderRate);
    renderInvoiceCart();
    refreshInvoiceSourceUI();
  }
  function refreshInvoiceSourceUI(){
    if(businessForm.dataset.recordType!=='invoice')return;
    const source=businessForm.querySelector('[name="saleSource"]')?.value||'store';
    if(source!=='web')businessForm.dataset.invoiceReceivedEdited='0';
    const orderField=businessForm.querySelector('#invoice-order-field');
    const addPanel=businessForm.querySelector('[data-search="invoice-product"]');
    const addButton=businessForm.querySelector('[data-action="add-invoice-product"]');
    if(orderField)orderField.hidden=source!=='web';
    if(addPanel)addPanel.hidden=source==='web';
    if(addButton)addButton.hidden=source==='web';
    if(source!=='web'){
      const hidden=businessForm.querySelector('[name="orderId"]');
      const visible=businessForm.querySelector('[data-lookup="order"]');
      if(hidden)hidden.value='';
      if(visible)visible.value='';
      invoiceDraftItems=[];
      renderInvoiceCart();
    }else{
      renderInvoiceCart();
    }
  }
  function updateInvoicePreview(){
    if(businessForm.dataset.recordType!=='invoice')return;
    const preview=businessForm.querySelector('#invoice-preview');
    if(!preview)return;
    const totals=invoiceDraftTotals();
    if(totals.error){preview.innerHTML='<div class="invoice-preview-empty">'+esc(totals.error)+'</div>';return;}
    const currency=invoiceSelectedCurrency(),rate=exchangeRate;
    const customer=businessForm.querySelector('[name="customerName"]')?.value||'Cliente sin nombre';
    const phone=businessForm.querySelector('[name="customerPhone"]')?.value||'No registrado';
    const selectedSource=businessForm.querySelector('[name="saleSource"]')?.value||'store';
    const receivedField=businessForm.querySelector('[name="amountReceived"]');
    const selectedPaymentMethod=businessForm.querySelector('[name="paymentMethod"]')?.value||'Efectivo';
    if(receivedField&&businessForm.dataset.invoiceReceivedEdited!=='1'&&selectedSource!=='web'){
      const pending=selectedPaymentMethod==='Pendiente / crédito';
      receivedField.value=String(pending?0:(currency==='NIO'?roundMoney(totals.totalUsd*rate):totals.totalUsd));
    }
    const source=selectedSource==='web'?'Pedido de página web':(selectedSource==='manual'?'Venta manual':'Venta presencial');
    const lineRows=totals.items.map(item=>
      '<div class="invoice-preview-line"><div class="invoice-line-product"><strong>'+esc(item.name)+'</strong><small>'+esc(item.sku||'Sin SKU')+'</small></div><span class="invoice-line-quantity">'+item.quantity+' uds.</span><div class="invoice-line-unit"><strong>'+money(item.unitPriceUsd)+'</strong><small>'+moneyInCurrency(roundMoney(item.unitPriceUsd*rate),'NIO')+'</small></div><div class="invoice-line-total"><strong>'+money(item.lineTotalUsd)+'</strong><small>'+moneyInCurrency(roundMoney(item.lineTotalUsd*rate),'NIO')+'</small></div></div>'
    ).join('');
    preview.innerHTML='<div class="invoice-preview-heading"><div><span class="invoice-kicker">VISTA PREVIA DE FACTURA</span><strong>'+esc(customer)+'</strong></div><span class="invoice-demo-chip">COMPROBANTE INTERNO · NO FISCAL</span></div>'+
      '<div class="invoice-preview-meta"><div><span>CLIENTE</span><strong>'+esc(customer)+'</strong></div><div><span>CONTACTO</span><strong>'+esc(phone)+'</strong></div><div><span>ORIGEN</span><strong>'+source+'</strong></div><div><span>FECHA</span><strong>'+new Date().toLocaleDateString('es-NI')+'</strong></div></div>'+
      '<div class="invoice-lines-heading"><span>PRODUCTO</span><span>CANT.</span><span>PRECIO</span><span>IMPORTE</span></div><div class="invoice-preview-lines">'+lineRows+'</div>'+
      '<div class="invoice-preview-totals"><div><span>Subtotal</span>'+invoiceUsdPrimary(totals.subtotalUsd,rate)+'</div>'+
      (totals.discountUsd?'<div><span>Descuento (USD)</span><strong class="invoice-money-stack">− '+money(totals.discountUsd)+'<small>− '+moneyInCurrency(roundMoney(totals.discountUsd*rate),'NIO')+'</small></strong></div>':'')+
      (totals.deliveryFeeUsd?'<div><span>Entrega</span><strong class="invoice-money-stack">'+money(totals.deliveryFeeUsd)+'<small>'+moneyInCurrency(roundMoney(totals.deliveryFeeUsd*rate),'NIO')+'</small></strong></div>':'')+
      '<div class="invoice-grand-total"><span>Total a cobrar (USD)</span>'+invoiceUsdPrimary(totals.totalUsd,rate)+'</div></div>'+
      '<div class="invoice-exchange-row"><span>Equivalente en córdobas</span><strong>'+moneyInCurrency(roundMoney(totals.totalUsd*rate),'NIO')+'</strong></div>'+
      '<div class="invoice-exchange-row"><span>Tipo de cambio aplicado</span><strong>'+rateLabel(rate)+'</strong></div>';
  }
  function invoiceDocumentMarkup(invoice){
    const rate=Number(invoice.exchangeRate||exchangeRate);
    const paymentCurrency=invoice.paymentCurrency||invoice.currency||'USD';
    const paymentOriginalAmount=invoice.paymentOriginalAmount==null
      ?(Array.isArray(invoice.payments)&&invoice.payments.length?Number(invoice.payments[0].amount||0):Number(invoice.paidUsd||0))
      :Number(invoice.paymentOriginalAmount||0);
    const lines=(invoice.items||[]).map(item=>{
      const unit=Number(item.unitPriceUsd||0);
      const lineTotal=item.lineTotalUsd==null?Number(item.quantity||0)*unit:Number(item.lineTotalUsd||0);
      return '<tr><td><strong>'+esc(item.name)+'</strong><small>'+esc(item.sku||'')+(item.barcode?' · '+esc(item.barcode):'')+'</small></td><td>'+Number(item.quantity||0)+'</td><td><span class="invoice-paper-usd">'+money(unit)+'</span><small class="invoice-paper-reference">'+moneyInCurrency(roundMoney(unit*rate),'NIO')+'</small></td><td><span class="invoice-paper-usd">'+money(lineTotal)+'</span><small class="invoice-paper-reference">'+moneyInCurrency(roundMoney(lineTotal*rate),'NIO')+'</small></td></tr>';
    }).join('');
    const balance=Math.max(0,Number(invoice.totalUsd||0)-Number(invoice.paidUsd||0));
    const source=invoice.source==='web'?'Página web':(invoice.source==='manual'?'Venta manual':'Tienda física');
    return '<article class="invoice-paper"><header class="invoice-paper-header"><div class="invoice-paper-brand"><span class="invoice-paper-monogram">JB</span><div><strong>JB PARFUMS</strong><small>FRAGANCIAS · PERFUMERÍA</small></div></div><div class="invoice-paper-number"><span>COMPROBANTE INTERNO</span><strong>'+esc(invoice.id)+'</strong><small>'+esc(dateText(invoice.createdAt))+'</small></div></header>'+
      '<div class="invoice-paper-status"><span>COMPROBANTE INTERNO · NO FISCAL</span><strong>'+esc(invoice.status||'Pendiente')+'</strong></div>'+
      '<section class="invoice-paper-parties"><div><small>FACTURAR A</small><strong>'+esc(invoice.customer||'Cliente general')+'</strong><span>'+esc(invoice.phone||'Sin contacto')+'</span><span>'+esc(invoice.customerType==='business'?'Cliente negocio':'Cliente particular')+'</span></div><div><small>ORIGEN DE VENTA</small><strong>'+source+'</strong><span>'+(invoice.orderId?'Pedido '+esc(invoice.orderId):'Venta directa')+'</span><span>Moneda de venta: USD</span><span>Moneda de cobro: '+esc(paymentCurrency)+'</span></div></section>'+
      '<table class="invoice-paper-table"><thead><tr><th>PRODUCTO / CÓDIGO</th><th>CANT.</th><th>PRECIO UNIT.</th><th>IMPORTE</th></tr></thead><tbody>'+lines+'</tbody></table>'+
      '<section class="invoice-paper-summary"><div><span>Subtotal</span>'+invoiceUsdPrimary(invoice.subtotalUsd,rate)+'</div>'+
      (Number(invoice.discountUsd)>0?'<div><span>Descuento</span><strong class="invoice-money-stack">− '+money(invoice.discountUsd)+'<small>− '+moneyInCurrency(roundMoney(invoice.discountUsd*rate),'NIO')+'</small></strong></div>':'')+
      (Number(invoice.deliveryFeeUsd)>0?'<div><span>Entrega</span>'+invoiceUsdPrimary(invoice.deliveryFeeUsd,rate)+'</div>':'')+
      '<div class="invoice-paper-total"><span>TOTAL USD</span>'+invoiceUsdPrimary(invoice.totalUsd,rate)+'</div>'+
      '<div><span>'+(balance>0&&Number(invoice.paidUsd||0)>0?'Abono inicial recibido':'Pago recibido')+'</span>'+invoiceUsdPrimary(invoice.paidUsd||0,rate)+'</div>'+
      (paymentOriginalAmount>0&&paymentCurrency==='NIO'?'<div><span>Pago inicial registrado en córdobas</span><strong>'+moneyInCurrency(paymentOriginalAmount,'NIO')+'</strong></div>':'')+
      '<div><span>Saldo pendiente</span>'+invoiceUsdPrimary(balance,rate)+'</div></section>'+
      '<footer class="invoice-paper-footer"><div><strong>Método de pago:</strong> '+esc(invoice.paymentMethod||'Pendiente')+'</div><div>Tipo de cambio aplicado: '+rateLabel(rate)+'</div><p>Documento comercial interno. No sustituye una factura fiscal autorizada.</p></footer></article>';
  }
  function showInvoicePreview(invoiceId){
    const invoice=invoices.find(item=>String(item.id)===String(invoiceId));
    const previewDialog=document.getElementById('invoice-preview-dialog');
    const content=document.getElementById('invoice-print-document');
    if(!invoice||!previewDialog||!content)return;
    content.innerHTML=invoiceDocumentMarkup(invoice);
    document.getElementById('invoice-preview-title').textContent='Factura '+invoice.id;
    const actions=previewDialog.querySelector('.invoice-preview-actions');
    if(actions&&!actions.querySelector('[data-action="new-invoice-after-preview"]')){
      const nextButton=document.createElement('button');
      nextButton.type='button';nextButton.className='button button-secondary';
      nextButton.setAttribute('data-action','new-invoice-after-preview');
      nextButton.textContent='Crear otra factura';
      actions.insertBefore(nextButton,actions.firstChild);
    }
    if(typeof previewDialog.showModal==='function')previewDialog.showModal();
  }
  function openBusinessDialog(type,recordId){
    const titles={customer:'Nuevo cliente',supplier:'Nuevo proveedor',order:'Nuevo pedido',purchase:'Registrar compra',expense:'Registrar gasto',cash:'Registrar recibo o pago','cash-account':'Nueva cuenta de caja o banco',invoice:'Nueva factura',payment:'Registrar abono',employee:'Agregar colaborador',attendance:'Registrar asistencia',leave:'Nueva solicitud de permiso o vacaciones','payroll-period':'Crear período de nómina','payroll-item':'Agregar partida de nómina','payroll-payment':'Pagar período de nómina'};
    let body='';
    if(type==='customer')body='<div class="form-grid">'+formField('Nombre del cliente','name','text',true,'maxlength="80"')+formField('Teléfono o contacto','contact','text',false,'maxlength="40"')+'</div>';
    if(type==='supplier')body='<div class="form-grid">'+formField('Nombre del proveedor','name','text',true,'maxlength="80"')+formField('Contacto','contact','text',false,'maxlength="80"')+formField('Teléfono','phone','tel',false,'maxlength="40"')+formField('Correo','email','email',false,'maxlength="120"')+currencyField('USD')+'</div>';
    if(type==='order'){
      if(!products.some(product=>product.active!==false)){toast('Registra primero un producto activo.');return;}
      body='<div class="form-grid">'+
        searchableField('Cliente existente (opcional)','customerIndex','customer',false)+
        formField('Nombre del cliente nuevo','newCustomerName','text',false,'maxlength="160" autocomplete="name"')+
        formField('Contacto del cliente nuevo','newCustomerContact','text',false,'maxlength="80"')+
        formField('Teléfono del cliente nuevo','newCustomerPhone','tel',false,'maxlength="40" autocomplete="tel"')+
        formField('Correo del cliente nuevo','newCustomerEmail','email',false,'maxlength="120" autocomplete="email"')+
        searchableField('Producto','productId','product',true)+
        formField('Cantidad','quantity','number',true,'min="1" step="1" value="1"')+
        currencyField('USD')+
        '</div><p class="form-helper">Selecciona un cliente existente o completa el nombre del cliente nuevo. Si es nuevo, el ERP lo guardará en la cartera y lo vinculará al pedido en la misma transacción.</p><p class="form-helper">Los precios del catálogo permanecen en USD. Se guarda la moneda de cobro y la tasa utilizada.</p>';
    }
    if(type==='purchase'){
      if(!suppliers.length){toast('Registra primero un proveedor.');return;}
      if(!products.some(product=>product.active!==false)){toast('Registra primero un producto activo.');return;}
      body='<div class="form-grid">'+searchableField('Proveedor','supplierIndex','supplier',true)+searchableField('Producto','productId','product',true)+formField('Cantidad recibida','quantity','number',true,'min="1" step="1"')+formField('Costo de compra por unidad','unitCost','number',true,'min="0.01" step="0.01"')+currencyField('USD')+formField('Pago inicial','initialPayment','number',false,'min="0" step="0.01" value="0"')+selectField('Cuenta para pago inicial','initialAccount',cashAccountOptions(),false)+'</div><p class="form-helper">Registra el costo de adquisición por unidad antes de costos adicionales. El ERP recalcula el costo promedio ponderado y aumenta las existencias en una sola operación.</p><p class="form-helper">El pago inicial se registra como salida de caja; el saldo restante queda pendiente con el proveedor.</p>';
    }
    if(type==='purchase-payment'){
      const purchase=purchases.find(item=>String(item.id)===String(recordId));
      if(!purchase){toast('No se encontró la compra seleccionada.');return;}
      const balance=Math.max(0,Number(purchase.totalUsd||0)-Number(purchase.paidUsd||0));
      if(balance<=0.001){toast('Esta compra ya está pagada.');return;}
      body='<div class="form-grid"><div class="detail-field full-field"><span>Proveedor · '+esc(purchase.supplier)+'</span><strong>Saldo pendiente: '+money(balance)+'</strong><small>'+esc(purchase.product)+' · '+purchase.quantity+' unidades</small></div>'+formField('Importe del abono','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta de pago','account',cashAccountOptions(),true)+'</div><p class="form-helper">El abono se convierte con el tipo de cambio vigente y se registra en Caja y bancos sin modificar inventario.</p>';
    }
    if(type==='expense')body='<div class="form-grid">'+selectField('Categoría','category','<option>Transporte</option><option>Alquiler</option><option>Servicios</option><option>Marketing</option><option>Comisiones</option><option>Empaque</option><option>Otros</option>',true)+formField('Descripción','description','text',true,'maxlength="120"')+formField('Importe','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta de pago','account',cashAccountOptions(),true)+'</div>';
    if(type==='cash')body='<div class="form-grid">'+selectField('Tipo de movimiento','direction','<option value="income">Entrada / Recibo</option><option value="expense">Salida / Pago</option>',true)+formField('Concepto','concept','text',true,'maxlength="120"')+formField('Importe','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta','account',cashAccountOptions(),true)+selectField('Proveedor relacionado','supplierIndex','<option value="">Ninguno</option>'+supplierOptions(),false)+'</div>';
    if(type==='cash-account')body='<div class="form-grid">'+formField('Nombre de la cuenta','name','text',true,'maxlength="80"')+selectField('Tipo de cuenta','accountType','<option>Caja</option><option>Banco</option><option>Otro</option>',true)+currencyField('USD')+formField('Saldo inicial','openingBalance','number',false,'min="0" step="0.01" value="0"')+'</div><p class="form-helper">El saldo inicial se registrará como una entrada de apertura, no como ingreso de ventas ni utilidad. Puedes iniciar en cero si todavía no deseas cargar un saldo.</p>';
    if(type==='invoice'){
      invoiceDraftItems=[];
      const customerOptions=customers.map(item=>'<option value="'+esc(item.name)+'"></option>').join('');
      body='<div class="form-grid invoice-form-grid">'+
        selectField('Origen de venta','saleSource','<option value="store" selected>Tienda física / venta directa</option><option value="web">Pedido de página web</option><option value="manual">Venta manual</option>',true)+
        '<div id="invoice-order-field" class="full-field" hidden>'+searchableField('Buscar pedido web (número o cliente)','orderId','order',false)+'</div>'+
        formField('Nombre del cliente','customerName','text',true,'list="invoice-customer-options" maxlength="100" autocomplete="off"')+
        selectField('Tipo de cliente','customerType','<option value="particular" selected>Particular · precio normal</option><option value="business">Negocio · precio mayorista si existe</option>',true)+
        formField('Teléfono o contacto','customerPhone','tel',false,'maxlength="40"')+
        '<datalist id="invoice-customer-options">'+customerOptions+'</datalist>'+
        '<div class="invoice-product-add full-field" data-search="invoice-product">'+searchableField('Perfume (nombre, SKU o código de barras)','draftProductId','product',false)+
        '<button type="button" class="button button-secondary" data-action="add-invoice-product">Agregar producto</button></div>'+
        '<div class="full-field"><div class="invoice-cart-heading"><strong>Productos de la factura</strong><span id="invoice-item-count">0 artículos</span></div><div id="invoice-cart" class="invoice-cart"><div class="invoice-preview-empty">Busca y agrega uno o varios perfumes.</div></div></div>'+
        formField('Descuento (USD)','discountUsd','number',false,'min="0" step="0.01" value="0"')+
        formField('Cargo de entrega (USD)','deliveryFeeUsd','number',false,'min="0" step="0.01" value="0"')+
        selectField('Moneda de cobro','currency',currencyOptions('USD'),true)+
        selectField('Método de pago','paymentMethod','<option selected>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Pago móvil</option><option>Cheque</option><option>Efectivo contra entrega</option><option>Pendiente / crédito</option><option>Otro</option>',true)+selectField('Cuenta de cobro','accountName',cashAccountOptions('USD'),false)+
        formField('Importe recibido (moneda de cobro)','amountReceived','number',false,'min="0" step="0.01" value="0"')+
        '<p class="form-helper full-field">En una venta directa, el sistema propone cobrar el total automáticamente. Si recibes solo una parte, cambia el importe para registrar el abono inicial; el resto quedará como saldo pendiente. Para una venta a crédito, selecciona «Pendiente / crédito».</p>'+ '<p class="form-helper full-field">Para clientes de negocio se utilizará el precio mayorista del producto cuando esté configurado; de lo contrario se conserva el precio normal. La factura guarda una copia del precio aplicado.</p>'+
        '<section class="invoice-preview full-field" id="invoice-preview" aria-live="polite"><div class="invoice-preview-empty">Agrega perfumes para calcular la factura.</div></section>'+
        '<p class="form-helper full-field">Comprobante comercial interno. No sustituye una factura fiscal autorizada por la autoridad tributaria.</p></div>';
    }
    if(type==='payment'){
      const invoice=invoices.find(f=>f.id===recordId);if(!invoice){toast('No se encontró el comprobante.');return;}
      const balance=Math.max(0,Number(invoice.totalUsd)-Number(invoice.paidUsd||0));
      body='<div class="form-grid"><div class="detail-field full-field"><span>Saldo pendiente</span><strong>'+money(balance)+'</strong></div>'+formField('Importe del abono','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta','account',cashAccountOptions(),true)+'</div>';
    }
    if(type==='employee')body='<div class="form-grid">'+formField('Nombre del colaborador','name','text',true,'maxlength="80"')+formField('Cargo','position','text',true,'maxlength="80"')+formField('Departamento','department','text',false,'maxlength="60"')+formField('Salario mensual (C$)','salaryNio','number',true,'min="0" step="0.01"')+'</div><p class="form-helper">La nómina se administra en córdobas; no se ofrece selector de moneda.</p>';
    if(type==='attendance'){
      if(!employees.some(e=>e.status==='Activo')){toast('Primero agrega un colaborador activo en RRHH > Personal.');return;}
      const options=employees.filter(e=>e.status==='Activo').map(e=>'<option value="'+e.id+'">'+esc(e.name)+' · '+esc(e.position)+'</option>').join('');
      const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
      body='<div class="form-grid">'+selectField('Colaborador','employeeId',options,true)+formField('Fecha','workDate','date',true,'value="'+today+'"')+selectField('Estado','status','<option>Presente</option><option>Tardanza</option><option>Ausente</option><option>Permiso</option><option>Vacaciones</option>',true)+formField('Hora de entrada','checkIn','datetime-local',false,'')+formField('Hora de salida','checkOut','datetime-local',false,'')+formField('Descanso (minutos)','breakMinutes','number',false,'min="0" step="1" value="0"')+formField('Observaciones','notes','text',false,'maxlength="250"')+'</div>';
    }
    if(type==='leave'){
      if(!employees.some(e=>e.status==='Activo')){toast('Primero agrega un colaborador en RRHH > Personal > Agregar colaborador.');return;}
      const options=employees.filter(e=>e.status==='Activo').map(e=>'<option value="'+e.id+'">'+esc(e.name)+'</option>').join('');
      body='<div class="form-grid">'+selectField('Colaborador','employeeId',options,true)+selectField('Tipo','leaveType','<option>Vacaciones</option><option>Permiso</option><option>Incapacidad</option><option>Otro</option>',true)+formField('Fecha inicial','startDate','date',true,'')+formField('Fecha final','endDate','date',true,'')+formField('Días solicitados','days','number',true,'min="0.5" step="0.5"')+formField('Motivo','reason','text',false,'maxlength="300"')+'</div>';
    }
    if(type==='payroll-period'){
      body='<div class="form-grid">'+formField('Inicio del período','periodStart','date',true,'')+formField('Fin del período','periodEnd','date',true,'')+formField('Fecha prevista de pago','paymentDate','date',false,'')+formField('Notas','notes','text',false,'maxlength="250"')+'</div><p class="form-helper">El período se crea en estado Borrador. Podrás agregar una partida por colaborador antes de aprobarlo.</p>';
    }
    if(type==='payroll-payment'){
      const period=payrollPeriods.find(p=>String(p.id)===String(recordId));
      if(!period||period.status!=='Aprobada'){toast('Solo se puede pagar un período aprobado.');return;}
      const items=payrollItems.filter(x=>x.payrollPeriodId===period.id);
      const total=items.reduce((sum,x)=>sum+Number(x.netSalaryNio||0),0);
      if(!items.length||total<=0){toast('El período no tiene partidas pagables.');return;}
      body='<div class="form-grid"><div class="detail-field full-field"><span>Período de nómina</span><strong>'+dateText(period.periodStart)+' – '+dateText(period.periodEnd)+'</strong><small>'+items.length+' colaboradores · '+moneyInCurrency(total,'NIO')+'</small></div>'+selectField('Cuenta de pago','account','<option>Caja NIO</option><option>Banco NIO</option>',true)+'</div><p class="form-helper">Al confirmar, el sistema registrará el gasto de nómina y una salida de caja/banco en córdobas. El período no podrá pagarse dos veces.</p>';
    }
    if(type==='payroll-item'){
      const available=payrollPeriods.filter(p=>p.status==='Borrador');
      if(!available.length){toast('Crea primero un período de nómina en estado Borrador.');return;}
      if(!employees.length){toast('Registra primero un colaborador.');return;}
      const periodOptions=available.map(p=>'<option value="'+p.id+'">'+dateText(p.periodStart)+' – '+dateText(p.periodEnd)+'</option>').join('');
      const employeeOptions=employees.filter(e=>e.status==='Activo').map(e=>'<option value="'+e.id+'" data-salary="'+Number(e.salaryNio||0)+'">'+esc(e.name)+' · '+moneyInCurrency(e.salaryNio,'NIO')+'</option>').join('');
      body='<div class="form-grid">'+selectField('Período de nómina','payrollPeriodId',periodOptions,true)+selectField('Colaborador','employeeId',employeeOptions,true)+formField('Salario base (C$)','baseSalaryNio','number',true,'min="0" step="0.01"')+formField('Bonos (C$)','bonusesNio','number',false,'min="0" step="0.01" value="0"')+formField('Deducciones (C$)','deductionsNio','number',false,'min="0" step="0.01" value="0"')+formField('Notas','notes','text',false,'maxlength="250"')+'</div><p class="form-helper">El neto se calcula en el servidor: salario base + bonos − deducciones. Solo se permiten partidas dentro de períodos en borrador.</p>';
    }
    document.getElementById('business-modal-title').textContent=titles[type]||(type==='purchase-payment'?'Abonar compra':'Nuevo registro');
    document.getElementById('business-form-body').innerHTML=body;businessForm.dataset.recordType=type;businessForm.dataset.recordId=recordId||'';
    const secureHR=type==='employee'&&window.JBAuth&&window.JBAuth.mode==='authenticated';
    document.querySelector('#business-dialog .eyebrow').textContent=window.JBAuth?.profile?'GESTIÓN · NEON DEVELOPMENT':'ACCESO REQUERIDO';
    document.getElementById('business-save').textContent=type==='invoice'?'Generar factura':(type==='payment'||type==='purchase-payment'?'Registrar abono':'Guardar en Neon');
    if(businessForm.querySelector('[name="currency"]'))refreshCashAccountOptions(businessForm,businessForm.querySelector('[name="currency"]').value);
    if(type==='payroll-payment')refreshCashAccountOptions(businessForm,'NIO');
    if(type==='invoice'){
      businessForm.dataset.invoiceReceivedEdited='0';
      businessForm.dataset.invoiceCurrency=businessForm.querySelector('[name="currency"]')?.value||'NIO';
      businessForm.dataset.invoiceReceivedRate=String(exchangeRate);
      refreshInvoiceSourceUI();renderInvoiceCart();
    }
    if(typeof businessDialog.showModal==='function')businessDialog.showModal();
  }
  function nextDocumentNumber(prefix, records, startAt=1000) {
    const max = (records || []).reduce((value, row) => {
      const suffix=String(row.purchaseNumber || row.id || "").split("-").pop();
      const parsed=Number(suffix);
      return Math.max(value,Number.isFinite(parsed)?parsed:0);
    }, startAt);
    return prefix + String(max + 1).padStart(6,"0");
  }
  function accountFor(name, currency) {
    const account = cashAccounts.find(item => item.name === name && item.currency === currency && item.active !== false);
    return account || null;
  }
  function cashAccountOptions(currencyFilter){
    const available=cashAccounts.filter(account=>account.active!==false&&(!currencyFilter||account.currency===currencyFilter));
    if(!available.length)return '<option value="">No hay cuentas activas</option>';
    return available.map(account=>'<option value="'+esc(account.name)+'">'+esc(account.name)+' · '+esc(account.currency)+'</option>').join('');
  }
  function refreshCashAccountOptions(formElement,currencyFilter){
    if(!formElement)return;
    ['account','initialAccount','accountName'].forEach(name=>{
      const select=formElement.querySelector('[name="'+name+'"]');
      if(!select)return;
      const current=select.value;
      const options=cashAccountOptions(currencyFilter);
      select.innerHTML=options;
      if(Array.from(select.options).some(option=>option.value===current))select.value=current;
      else if(select.options.length)select.selectedIndex=0;
    });
  }
  async function saveBusinessRecord(event){
    event.preventDefault();
    if(!businessForm.reportValidity())return;
    const button=document.getElementById('business-save');
    if(button){button.disabled=true;button.textContent='Guardando…';}
    const data=new FormData(businessForm);
    const get=k=>String(data.get(k)||'').trim();
    const num=k=>Number(data.get(k)||0);
    const type=businessForm.dataset.recordType;
    const currency=get('currency')==='NIO'?'NIO':'USD';
    const rate=exchangeRate;
    const dateNow=new Date().toISOString();
    try {
      if(type==='customer'){
        if(!get('name'))throw new Error('El nombre del cliente es obligatorio.');
        await erpApi('customers',{method:'POST',body:JSON.stringify({name:get('name'),contact:get('contact'),phone:get('contact'),customer_type:'particular',active:true})});
      } else if(type==='supplier'){
        if(!get('name'))throw new Error('El nombre del proveedor es obligatorio.');
        await erpApi('suppliers',{method:'POST',body:JSON.stringify({name:get('name'),contact:get('contact'),phone:get('phone'),email:get('email'),currency,active:true})});
      } else if(type==='order'){
        const selectedIndex=get('customerIndex');
        const customer=selectedIndex!==''?customers[Number(selectedIndex)]:null;
        const newCustomerName=get('newCustomerName');
        const product=products.find(p=>String(p.id)===get('productId'));
        const quantity=num('quantity');
        if(selectedIndex!==''&&!customer)throw new Error('El cliente seleccionado ya no está disponible. Actualiza la cartera e inténtalo de nuevo.');
        if(customer&&newCustomerName)throw new Error('Selecciona un cliente existente o registra uno nuevo, no ambos.');
        if(!customer&&!newCustomerName)throw new Error('Selecciona un cliente existente o escribe el nombre del nuevo cliente.');
        if(!product||!Number.isInteger(quantity)||quantity<1)throw new Error('Revisa el producto y la cantidad.');
        if(newCustomerName.length>160)throw new Error('El nombre del cliente no puede superar 160 caracteres.');
        const total=roundMoney(Number(product.price||0)*quantity);
        const number=nextDocumentNumber('JP-',orders,1000);
        await erpApi('orders',{method:'POST',body:JSON.stringify({
          order_number:number,customer_id:customer?.id||null,customer_name:customer?.name||newCustomerName,
          phone:customer?(customer.phone||customer.contact||''):get('newCustomerPhone'),
          new_customer:customer?null:{
            name:newCustomerName,contact:get('newCustomerContact'),phone:get('newCustomerPhone'),
            email:get('newCustomerEmail'),customer_type:'particular'
          },
          status:'Pendiente',payment_status:'Pendiente',payment_method:'Por definir',delivery_mode:'Por coordinar',
          currency,original_amount:currency==='NIO'?roundMoney(total*rate):total,exchange_rate:rate,
          total_usd:total,discount_usd:0,delivery_fee_usd:0,notes:'',
          items:[{product_id:product.id,product_name:product.name,sku_snapshot:product.sku,quantity,unit_price_usd:Number(product.price||0)}]
        })});
      } else if(type==='purchase'){
        const supplier=suppliers[num('supplierIndex')];
        const product=products.find(p=>String(p.id)===get('productId'));
        const quantity=num('quantity'), unitCost=num('unitCost'), initialPayment=num('initialPayment');
        const account=get('initialAccount')||('Caja '+currency);
        if(!supplier||!supplier.id||!product||!Number.isInteger(quantity)||quantity<1||!Number.isFinite(unitCost)||unitCost<=0)throw new Error('Revisa proveedor, producto, cantidad y costo.');
        if(!Number.isFinite(initialPayment)||initialPayment<0)throw new Error('El pago inicial no puede ser negativo.');
        const totalUsd=toUsd(unitCost*quantity,currency),paidUsd=toUsd(initialPayment,currency);
        if(paidUsd>totalUsd+0.001)throw new Error('El pago inicial supera el total de la compra.');
        if(initialPayment>0&&!accountFor(account,currency))throw new Error('La cuenta de pago no existe o no coincide con la moneda.');
        const number=nextDocumentNumber('JBC-',purchases,1000);
        await erpApi('purchases',{method:'POST',body:JSON.stringify({
          purchase_number:number,supplier_id:supplier.id,supplier_name:supplier.name,currency,exchange_rate:rate,
          total_usd:totalUsd,paid_usd:paidUsd,status:paidUsd>=totalUsd-0.001?'Pagado':(paidUsd>0?'Abono parcial':'Pendiente'),
          notes:'',product_id:product.id,quantity,unit_cost_usd:toUsd(unitCost,currency),
          initial_payment_amount:initialPayment,account_name:account
        })});
      } else if(type==='expense'){
        const amount=num('amount'),description=get('description');
        const account=get('account')||('Caja '+currency);
        if(!description||!Number.isFinite(amount)||amount<=0)throw new Error('Revisa descripción e importe.');
        if(!accountFor(account,currency))throw new Error('Selecciona una cuenta activa en la misma moneda del gasto.');
        await erpApi('expenses',{method:'POST',body:JSON.stringify({
          category:get('category'),description,currency,original_amount:amount,exchange_rate:rate,amount_usd:toUsd(amount,currency),account_name:account
        })});
      } else if(type==='cash-account'){
        const accountName=get('name'),accountType=get('accountType'),opening=num('openingBalance');
        if(!accountName||!['Caja','Banco','Otro'].includes(accountType)||!Number.isFinite(opening)||opening<0)throw new Error('Revisa nombre, tipo y saldo inicial de la cuenta.');
        if(cashAccounts.some(a=>String(a.name).toLocaleLowerCase('es')===accountName.toLocaleLowerCase('es')))throw new Error('Ya existe una cuenta con ese nombre.');
        await erpApi('cash-accounts',{method:'POST',body:JSON.stringify({
          name:accountName,currency,account_type:accountType,opening_balance:opening,exchange_rate:rate
        })});
      } else if(type==='cash'){
        const amount=num('amount'),account=get('account'),accountRow=accountFor(account,currency);
        if(!get('concept')||!Number.isFinite(amount)||amount<=0)throw new Error('Revisa el concepto y el importe.');
        if(!accountRow)throw new Error('La cuenta seleccionada no existe o tiene otra moneda.');
        const supplier=get('supplierIndex')===''?null:suppliers[num('supplierIndex')];
        await erpApi('cash_entries',{method:'POST',body:JSON.stringify({
          direction:get('direction'),concept:get('concept'),account_id:accountRow.id,currency,original_amount:amount,
          exchange_rate:rate,amount_usd:toUsd(amount,currency),source_type:supplier?'supplier':null,source_id:supplier?.id||null
        })});
      } else if(type==='payment'){
        const invoice=invoices.find(f=>f.id===businessForm.dataset.recordId);
        const amount=num('amount'),account=get('account'),amountUsd=toUsd(amount,currency);
        if(!invoice||!invoice.dbId)throw new Error('No se encontró la factura.');
        if(!Number.isFinite(amount)||amount<=0)throw new Error('Introduce un importe válido.');
        if(!accountFor(account,currency))throw new Error('La cuenta seleccionada no existe o tiene otra moneda.');
        if(amountUsd>Math.max(0,invoice.totalUsd-invoice.paidUsd)+0.001)throw new Error('El abono supera el saldo pendiente.');
        await erpApi('invoice-payments',{method:'POST',body:JSON.stringify({
          invoice_id:invoice.dbId,currency,original_amount:amount,exchange_rate:rate,amount_usd:amountUsd,
          account_name:account,payment_method:'Abono'
        })});
      } else if(type==='purchase-payment'){
        const purchase=purchases.find(p=>String(p.id)===String(businessForm.dataset.recordId));
        const amount=num('amount'),account=get('account'),amountUsd=toUsd(amount,currency);
        if(!purchase||!purchase.id)throw new Error('No se encontró la compra seleccionada.');
        if(!Number.isFinite(amount)||amount<=0)throw new Error('Introduce un importe válido.');
        if(!accountFor(account,currency))throw new Error('La cuenta seleccionada no existe o tiene otra moneda.');
        if(amountUsd>Math.max(0,purchase.totalUsd-purchase.paidUsd)+0.001)throw new Error('El abono supera el saldo pendiente de la compra.');
        await erpApi('purchase-payments',{method:'POST',body:JSON.stringify({
          purchase_id:purchase.id,currency,original_amount:amount,exchange_rate:rate,amount_usd:amountUsd,
          account_name:account,payment_method:'Abono'
        })});
      } else if(type==='invoice'){
        const selectedSource=get('saleSource');
        const source=selectedSource==='web'?'web':(selectedSource==='manual'?'manual':'store');
        const orderId=get('orderId');
        const order=source==='web'?orders.find(o=>String(o.id)===orderId):null;
        if(source==='web'&&(!order||!order.dbId||invoices.some(f=>String(f.orderId)===String(order.id))))throw new Error('Selecciona un pedido web que todavía no tenga factura.');
        const customerName=(source==='web'?(order?.customer||get('customerName')):get('customerName')).trim();
        if(!customerName)throw new Error('Escribe o selecciona el nombre del cliente.');
        const totals=invoiceDraftTotals();
        if(totals.error)throw new Error(totals.error);
        const phone=source==='web'?(order?.phone||get('customerPhone')):get('customerPhone');
        const received=num('amountReceived');
        if(!Number.isFinite(received)||received<0)throw new Error('El importe recibido no puede ser negativo.');
        const paidUsd=toUsd(received,currency);
        if(paidUsd>totals.totalUsd+0.001)throw new Error('El importe recibido supera el total de la factura.');
        const account=get('accountName')||((get('paymentMethod')==='Transferencia'?'Banco ':'Caja ')+currency);
        if(paidUsd>0&&!accountFor(account,currency))throw new Error('La cuenta de cobro no está configurada.');
        const number=nextDocumentNumber('JBI-',invoices,1000);
        const existingCustomer=customers.find(item=>String(item.name||'').trim().toLocaleLowerCase('es')===customerName.toLocaleLowerCase('es'));
        const items=totals.items.map(item=>{
          const product=products.find(p=>String(p.id)===String(item.productId));
          return {product_id:product?.id||null,product_name:item.name,sku_snapshot:item.sku||product?.sku||'',quantity:item.quantity,
            unit_price_usd:item.unitPriceUsd,unit_cost_usd:Number(product?.unitCost||0)};
        });
        if(items.some(item=>!item.product_id))throw new Error('Uno de los productos ya no existe en el catálogo.');
        await erpApi('invoices',{method:'POST',body:JSON.stringify({
          invoice_number:number,source,order_id:source==='web'?order.dbId:null,order_number_snapshot:source==='web'?order.id:null,
          customer_id:source==='web'?(order?.customerId||null):(existingCustomer?.id||null),customer_name:customerName,customer_phone:phone||'',
          currency,exchange_rate:rate,subtotal_usd:totals.subtotalUsd,discount_usd:totals.discountUsd,
          delivery_fee_usd:totals.deliveryFeeUsd,total_usd:totals.totalUsd,paid_usd:paidUsd,
          payment_method:get('paymentMethod')||'Pendiente / crédito',notes:'',
          items,original_payment_amount:received,account_name:paidUsd>0?account:null
        })});
      } else if(type==='employee'){
        const salary=num('salaryNio');
        if(!get('name')||!get('position')||!Number.isFinite(salary)||salary<0)throw new Error('Revisa los datos y el salario.');
        await erpApi('employees',{method:'POST',body:JSON.stringify({
          name:get('name'),position:get('position'),department:get('department')||null,salary_nio:salary,status:'Activo'
        })});
        hrRecordsLoaded=true;hrLoadAttempted=true;hrLoadError='';
      } else if(type==='attendance'){
        const employeeId=get('employeeId'),workDate=get('workDate'),status=get('status'),breakMinutes=num('breakMinutes');
        if(!employeeId||!workDate||!['Presente','Tardanza','Ausente','Permiso','Vacaciones'].includes(status)||!Number.isInteger(breakMinutes)||breakMinutes<0)throw new Error('Revisa colaborador, fecha, estado y minutos de descanso.');
        const checkIn=get('checkIn')?new Date(get('checkIn')).toISOString():null;
        const checkOut=get('checkOut')?new Date(get('checkOut')).toISOString():null;
        if(checkIn&&checkOut&&new Date(checkOut)<=new Date(checkIn))throw new Error('La hora de salida debe ser posterior a la entrada.');
        await erpApi('hr_attendance',{method:'POST',body:JSON.stringify({
          employee_id:employeeId,work_date:workDate,check_in:checkIn,check_out:checkOut,
          break_minutes:breakMinutes,status,notes:get('notes')||null
        })});
      } else if(type==='leave'){
        const employeeId=get('employeeId'),startDate=get('startDate'),endDate=get('endDate'),days=num('days');
        if(!employeeId||!startDate||!endDate||endDate<startDate||!['Vacaciones','Permiso','Incapacidad','Otro'].includes(get('leaveType'))||!Number.isFinite(days)||days<=0)throw new Error('Revisa colaborador, tipo, fechas y cantidad de días.');
        await erpApi('hr_leave_requests',{method:'POST',body:JSON.stringify({
          employee_id:employeeId,leave_type:get('leaveType'),start_date:startDate,end_date:endDate,
          days,reason:get('reason')||null,status:'Pendiente'
        })});
      } else if(type==='payroll-period'){
        const startDate=get('periodStart'),endDate=get('periodEnd'),paymentDate=get('paymentDate');
        if(!startDate||!endDate||endDate<startDate)throw new Error('El período requiere fechas válidas y el fin no puede ser anterior al inicio.');
        await erpApi('hr_payroll_periods',{method:'POST',body:JSON.stringify({
          period_start:startDate,period_end:endDate,payment_date:paymentDate||null,status:'Borrador',notes:get('notes')||null
        })});
      } else if(type==='payroll-item'){
        const periodId=get('payrollPeriodId'),employeeId=get('employeeId');
        const base=num('baseSalaryNio'),bonus=num('bonusesNio'),deductions=num('deductionsNio');
        if(!periodId||!employeeId||![base,bonus,deductions].every(Number.isFinite)||base<0||bonus<0||deductions<0||deductions>base+bonus)throw new Error('Revisa período, colaborador, salario, bonos y deducciones.');
        await erpApi('hr-payroll-items',{method:'POST',body:JSON.stringify({
          payroll_period_id:periodId,employee_id:employeeId,base_salary_nio:base,
          bonuses_nio:bonus,deductions_nio:deductions,notes:get('notes')||null
        })});
      } else if(type==='payroll-payment'){
        const periodId=businessForm.dataset.recordId,account=get('account');
        if(!periodId||!accountFor(account,'NIO'))throw new Error('Selecciona una cuenta activa en córdobas.');
        await erpApi('payroll-periods/'+encodeURIComponent(periodId)+'/status',{method:'PATCH',body:JSON.stringify({status:'Pagada',account_name:account})});
      } else {
        throw new Error('Este tipo de operación todavía no está conectado.');
      }
      await loadERPFromNeon(true);
      businessDialog.close();
      renderView();
      if(type==='invoice'){
        const lastInvoice=invoices[0];
        toast('Factura registrada en Neon Development. Revisa su estado y saldo en Facturación.');
        if(lastInvoice)window.requestAnimationFrame(()=>showInvoicePreview(lastInvoice.id));
      } else {
        const messages={
          customer:'Cliente guardado en Neon.',supplier:'Proveedor guardado en Neon.',order:'Pedido guardado en Neon.',
          purchase:'Compra registrada: inventario, costo y cuenta por pagar actualizados.',
          expense:'Gasto registrado en Neon y reflejado en caja y resultados.',cash:'Movimiento registrado en Caja y bancos.',
          payment:'Abono de cliente registrado.', 'purchase-payment':'Abono a proveedor registrado.',
          employee:'Colaborador registrado en Neon Development.',
          'cash-account':'Cuenta creada y saldo inicial registrado.',
          attendance:'Asistencia registrada en Neon.',
          leave:'Solicitud de permiso o vacaciones registrada.',
          'payroll-period':'Período de nómina creado en estado Borrador.',
          'payroll-item':'Partida de nómina calculada y registrada en NIO.',
          'payroll-payment':'Nómina pagada. Se registró el egreso y la salida de caja/banco.'
        };
        toast(messages[type]||'Operación guardada en Neon.');
      }
    } catch(error) {
      toast(error?.message||'No se pudo completar la operación en Neon.');
    } finally {
      if(button){button.disabled=false;button.textContent=type==='invoice'?'Generar factura':(type==='payment'||type==='purchase-payment'?'Registrar abono':'Guardar en Neon');}
    }
  }
  function dateText(value){
    if(!value)return '—';
    const raw=String(value);
    let d;
    if(/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)){
      const [year,month,day]=raw.split('-').map(Number);
      d=new Date(year,month-1,day);
    }else d=new Date(value);
    return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-NI',{day:'2-digit',month:'short',year:'numeric'});
  }
  function renderCustomers(){
    const rows=customers.map(c=>'<tr><td data-label="Cliente / contacto" class="table-primary">'+esc(c.name)+'<small class="table-secondary">'+esc(c.contact||'Sin contacto')+'</small></td><td data-label="Pedidos">'+Number(c.orders||0)+'</td><td data-label="Importe en pedidos USD" class="table-primary">'+money(c.spent)+'</td><td data-label="Desde">'+esc(c.since||'—')+'</td><td data-label="Estado"><span class="status-chip status-success">Activo</span></td></tr>').join('');
    return heading(views.customers,'<button class="button button-primary" data-action="new-customer">'+svg('plus')+' Nuevo cliente</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Clientes</span><strong>'+customers.length+'</strong></div><div class="summary-mini"><span>Pedidos acumulados</span><strong>'+customers.reduce((s,c)=>s+Number(c.orders||0),0)+'</strong></div><div class="summary-mini"><span>Importe en pedidos USD</span><strong>'+money(customers.reduce((s,c)=>s+Number(c.spent||0),0))+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>CLIENTE / CONTACTO</th><th>PEDIDOS</th><th>PEDIDOS USD</th><th>DESDE</th><th>ESTADO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">Sin clientes registrados.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('warning')+'<div><strong>Clientes conectados</strong><p>Los datos y el historial comercial se consultan desde Neon Development.</p></div></div>';
  }
  function renderOrders(){
    const rows=orders.map(o=>'<tr><td data-label="Referencia" class="table-primary">'+esc(o.id)+'</td><td data-label="Cliente">'+esc(o.customer)+'</td><td data-label="Fecha">'+esc(o.date)+'</td><td data-label="Total / cobro" class="table-primary">'+money(o.amount)+'<small class="table-secondary">Cobro: '+moneyInCurrency(o.paymentAmount==null?o.amount:o.paymentAmount,o.paymentCurrency||'USD')+'</small></td><td data-label="Estado">'+orderStatus(o.status)+'</td><td data-label="Detalle"><button class="table-action" data-action="preview-order" data-id="'+esc(o.id)+'" aria-label="Ver pedido '+esc(o.id)+'">'+svg('eye')+'</button></td></tr>').join('');
    return heading(views.orders,'<button class="button button-primary" data-action="new-order">'+svg('plus')+' Nuevo pedido</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Pedidos</span><strong>'+orders.length+'</strong></div><div class="summary-mini"><span>Pendientes</span><strong>'+orders.filter(o=>o.status!=='Completado').length+'</strong></div><div class="summary-mini"><span>Importe en pedidos USD</span><strong>'+money(orders.reduce((s,o)=>s+Number(o.amount||0),0))+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>REFERENCIA</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL / COBRO</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Sin pedidos.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('spark')+'<div><strong>Pedidos conectados</strong><p>El inventario se descuenta cuando el pedido pasa a preparación. El sistema registra reversiones si se devuelve a pendiente o se cancela antes de completarse.</p></div></div>';
  }
  function renderBilling(){
    const rows=invoices.map(f=>{
      const paid=Number(f.paidUsd||0),balance=Math.max(0,Number(f.totalUsd||0)-paid);
      const origin=f.source==='web'?'Página web':(f.source==='manual'?'Venta manual':'Tienda física');
      return '<tr><td data-label="Factura / origen" class="table-primary"><strong>'+esc(f.id)+'</strong><small class="table-secondary">'+origin+(f.orderId?' · '+esc(f.orderId):'')+'</small></td><td data-label="Cliente">'+esc(f.customer)+'</td><td data-label="Fecha">'+dateText(f.createdAt)+'</td><td data-label="Total">'+money(f.totalUsd)+'<small class="table-secondary">'+moneyInCurrency(roundMoney(Number(f.totalUsd||0)*Number(f.exchangeRate||exchangeRate)),'NIO')+' · '+rateLabel(f.exchangeRate)+'</small></td><td data-label="Pago recibido / saldo">'+money(paid)+' recibido <small class="table-secondary">'+money(balance)+' saldo pendiente</small></td><td data-label="Estado"><span class="status-chip '+(balance===0?'status-success':'status-pending')+'">'+esc(f.status||'Pendiente')+'</span></td><td data-label="Acción"><button class="button button-quiet button-small" data-action="view-invoice" data-id="'+esc(f.id)+'">Ver / imprimir</button>'+(balance>0?'<button class="button button-quiet button-small" data-action="new-payment" data-id="'+esc(f.id)+'">Abonar</button>':'')+'</td></tr>';
    }).join('');
    return heading(views.billing,'<button class="button button-primary" data-action="new-invoice">'+svg('plus')+' Nueva factura</button>')+
      '<div class="summary-strip"><div class="summary-mini"><span>Facturas registradas</span><strong>'+invoices.length+'</strong></div><div class="summary-mini"><span>Saldo pendiente USD</span><strong>'+money(invoices.reduce((s,f)=>s+Math.max(0,f.totalUsd-Number(f.paidUsd||0)),0))+'</strong></div><div class="summary-mini"><span>Venta facturada USD</span><strong>'+money(invoices.reduce((s,f)=>s+f.totalUsd,0))+'</strong></div></div>'+
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>FACTURA / ORIGEN</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>PAGO RECIBIDO / SALDO</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Todavía no hay facturas registradas.</td></tr>')+'</tbody></table></div></article>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Comprobantes comerciales internos</strong><p>La vista previa permite imprimir en formato A4. No tiene autorización tributaria ni sustituye una factura fiscal.</p></div></div>';
  }
  function renderReceivables(){
    const open=invoices.filter(f=>Number(f.totalUsd||0)-Number(f.paidUsd||0)>0.001);
    const total=open.reduce((sum,f)=>sum+Math.max(0,Number(f.totalUsd||0)-Number(f.paidUsd||0)),0);
    const clients=new Set(open.map(f=>String(f.customer||'').trim().toLocaleLowerCase('es'))).size;
    const rows=open.map(f=>{
      const balance=Math.max(0,Number(f.totalUsd||0)-Number(f.paidUsd||0));
      const origin=f.source==='web'?'Página web':(f.source==='manual'?'Venta manual':'Tienda física');
      const paymentCount=Array.isArray(f.payments)?f.payments.length:(Number(f.paidUsd||0)>0?1:0);
      return '<tr><td data-label="Factura / fecha" class="table-primary"><strong>'+esc(f.id)+'</strong><small class="table-secondary">'+dateText(f.createdAt)+'</small></td><td data-label="Cliente">'+esc(f.customer)+'</td><td data-label="Origen">'+origin+(f.orderId?' · '+esc(f.orderId):'')+'</td><td data-label="Total">'+money(Number(f.totalUsd||0))+'</td><td data-label="Pagos recibidos">'+money(Number(f.paidUsd||0))+'<small class="table-secondary">'+paymentCount+' abono(s)</small></td><td data-label="Saldo"><strong>'+money(balance)+'</strong></td><td data-label="Estado"><span class="status-chip status-pending">'+esc(f.status||'Pendiente')+'</span></td><td data-label="Acción"><button class="button button-quiet button-small" data-action="new-payment" data-id="'+esc(f.id)+'">Registrar abono</button></td></tr>';
    }).join('');
    return heading(views.receivables,'<button class="button button-quiet" data-view="billing">Ver facturas</button>')+
      '<div class="summary-strip"><div class="summary-mini"><span>Saldo pendiente USD</span><strong>'+money(total)+'</strong></div><div class="summary-mini"><span>Clientes con saldo</span><strong>'+clients+'</strong></div><div class="summary-mini"><span>Facturas pendientes</span><strong>'+open.length+'</strong></div></div>'+
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>FACTURA / FECHA</th><th>CLIENTE</th><th>ORIGEN</th><th>TOTAL USD</th><th>PAGOS RECIBIDOS</th><th>SALDO</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="8">No hay cuentas pendientes de cobro.</td></tr>')+'</tbody></table></div></article>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Cuentas por cobrar</strong><p>Los saldos se calculan desde las facturas y sus abonos registrados. Cada pago conserva importe, moneda, tasa, cuenta y fecha.</p></div></div>';
  }
  async function loadHRFromAPI(force){
    const auth=window.JBAuth;
    if(!auth||auth.mode!=='authenticated'||!auth.profile||!['owner','admin','hr'].includes(auth.profile.role))return;
    if(hrRecordsLoading||(hrRecordsLoaded&&!force))return;
    hrRecordsLoading=true;hrLoadAttempted=true;hrLoadError='';
    try{
      await loadERPFromNeon(Boolean(force));
      hrRecordsLoaded=true;
    }catch(error){
      hrLoadError=error?.message||'No se pudieron cargar los registros de RR. HH.';
      hrRecordsLoaded=false;
    }finally{
      hrRecordsLoading=false;
      if(state.view==='hr')renderView();
    }
  }
  function renderHR(){
    const auth=window.JBAuth,backendMode=Boolean(auth&&auth.mode==='authenticated');
    if(backendMode&&!auth.user)return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>Sección protegida</strong><p>Inicia sesión para consultar los expedientes de personal.</p></div></div>';
    if(backendMode&&!auth.profile)return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>Cuenta pendiente de autorización</strong><p>'+esc(auth.profileError||'Verifica tu correo y vuelve a iniciar sesión.')+'</p></div></div>';
    if(backendMode&&!['owner','admin','hr'].includes(auth.profile.role))return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>Permiso insuficiente</strong><p>Tu cuenta no tiene acceso al expediente de personal.</p></div></div>';
    if(backendMode&&!hrRecordsLoaded){
      if(!hrRecordsLoading&&!hrLoadAttempted)loadHRFromAPI(false);
      const message=hrLoadError||'Consultando los registros protegidos de Neon…';
      return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>RR. HH. · Neon Development</strong><p>'+esc(message)+'</p>'+(hrLoadError?'<button class="button button-quiet button-small" data-action="reload-hr">Reintentar</button>':'')+'</div></div>';
    }
    const activeEmployees=employees.filter(e=>e.status==='Activo');
    const totalPayroll=payrollItems.reduce((sum,item)=>sum+Number(item.netSalaryNio||0),0);
    const tabs=[
      ['employees','Personal',employees.length],
      ['attendance','Asistencia',attendanceRecords.length],
      ['leaves','Permisos',leaveRequests.filter(x=>x.status==='Pendiente').length],
      ['payroll','Nómina',payrollPeriods.length]
    ];
    const tabsHtml='<div class="toolbar products-toolbar hr-tabs"><div class="toolbar-left">'+tabs.map(([id,label,count])=>'<button type="button" class="button hr-tab-button '+(state.hrTab===id?'button-primary':'button-quiet')+' button-small" data-action="hr-tab" data-tab="'+id+'">'+label+' <span class="ledger-count">'+count+'</span></button>').join('')+'</div></div>';
    let actions='',content='';
    if(state.hrTab==='employees'){
      actions='<button class="button button-primary" data-action="new-employee">'+svg('plus')+' Agregar colaborador</button>';
      const rows=employees.map(e=>'<tr><td data-label="Colaborador" class="table-primary">'+esc(e.name)+'<small class="table-secondary">'+esc(e.employeeCode||'Sin código')+' · '+esc(e.department||'Sin departamento')+'</small></td><td data-label="Cargo">'+esc(e.position)+'</td><td data-label="Contacto">'+esc(e.phone||e.email||'—')+'</td><td data-label="Salario mensual" class="table-primary">'+moneyInCurrency(e.salaryNio,'NIO')+'</td><td data-label="Estado"><span class="status-chip '+(e.status==='Activo'?'status-success':'status-muted')+'">'+esc(e.status||'Activo')+'</span></td></tr>').join('');
      content='<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>COLABORADOR</th><th>CARGO</th><th>CONTACTO</th><th>SALARIO MENSUAL</th><th>ESTADO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">No hay colaboradores registrados.</td></tr>')+'</tbody></table></div></article>';
    } else if(state.hrTab==='attendance'){
      actions=activeEmployees.length?'<button class="button button-primary" data-action="new-attendance">'+svg('plus')+' Registrar asistencia</button>':'';
      const employeeName=id=>employees.find(e=>e.id===id)?.name||'Colaborador';
      const rows=attendanceRecords.map(a=>'<tr><td data-label="Fecha">'+dateText(a.workDate)+'</td><td data-label="Colaborador" class="table-primary">'+esc(employeeName(a.employeeId))+'</td><td data-label="Entrada">'+esc(a.checkIn?new Date(a.checkIn).toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'}):'—')+'</td><td data-label="Salida">'+esc(a.checkOut?new Date(a.checkOut).toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'}):'—')+'</td><td data-label="Estado"><span class="status-chip '+(a.status==='Ausente'?'status-danger':(a.status==='Tardanza'?'status-pending':'status-success'))+'">'+esc(a.status)+'</span></td><td data-label="Descanso">'+Number(a.breakMinutes||0)+' min</td></tr>').join('');
      content='<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>COLABORADOR</th><th>ENTRADA</th><th>SALIDA</th><th>ESTADO</th><th>DESCANSO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No hay asistencias registradas.</td></tr>')+'</tbody></table></div></article>';
    } else if(state.hrTab==='leaves'){
      actions=activeEmployees.length?'<button class="button button-primary" data-action="new-leave">'+svg('plus')+' Nueva solicitud</button>':'<button class="button button-primary" data-action="go-hr-employees">'+svg('plus')+' Agregar colaborador</button>';
      const employeeName=id=>employees.find(e=>e.id===id)?.name||'Colaborador';
      const rows=leaveRequests.map(l=>'<tr><td data-label="Colaborador" class="table-primary">'+esc(employeeName(l.employeeId))+'</td><td data-label="Tipo">'+esc(l.leaveType)+'</td><td data-label="Período">'+dateText(l.startDate)+' – '+dateText(l.endDate)+'</td><td data-label="Días">'+Number(l.days||0)+'</td><td data-label="Estado"><span class="status-chip '+(l.status==='Aprobado'?'status-success':(l.status==='Rechazado'?'status-danger':'status-pending'))+'">'+esc(l.status)+'</span></td><td data-label="Acciones">'+(l.status==='Pendiente'?'<button class="button button-quiet button-small" data-action="approve-leave" data-id="'+l.id+'">Aprobar</button><button class="button button-quiet button-small" data-action="reject-leave" data-id="'+l.id+'">Rechazar</button>':'—')+'</td></tr>').join('');
      content=(activeEmployees.length?'':'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Primero registra al colaborador</strong><p>Los permisos y vacaciones se vinculan a una persona activa. Entra en la pestaña Personal, selecciona Agregar colaborador y luego vuelve a Permisos para crear la solicitud.</p></div></div>')+'<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>COLABORADOR</th><th>TIPO</th><th>PERÍODO</th><th>DÍAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No hay permisos o vacaciones registrados.</td></tr>')+'</tbody></table></div></article>';
    } else {
      const draftPeriods=payrollPeriods.filter(p=>p.status==='Borrador');
      actions='<div class="heading-actions-inline">'+(draftPeriods.length?'<button class="button button-quiet" data-action="new-payroll-item">'+svg('plus')+' Agregar a nómina</button>':'')+'<button class="button button-primary" data-action="new-payroll-period">'+svg('plus')+' Nuevo período</button></div>';
      const rows=payrollPeriods.map(p=>{
        const items=payrollItems.filter(item=>item.payrollPeriodId===p.id);
        const total=items.reduce((sum,item)=>sum+Number(item.netSalaryNio||0),0);
        const periodAction=p.status==='Borrador'
          ?'<button class="button button-quiet button-small" data-action="approve-payroll" data-id="'+p.id+'" '+(items.length?'':'disabled')+'>Aprobar</button>'
          :(p.status==='Aprobada'?'<button class="button button-primary button-small" data-action="pay-payroll" data-id="'+p.id+'">Pagar nómina</button>':'—');
        return '<tr><td data-label="Período" class="table-primary">'+dateText(p.periodStart)+' – '+dateText(p.periodEnd)+'</td><td data-label="Colaboradores">'+items.length+'</td><td data-label="Neto a pagar">'+moneyInCurrency(total,'NIO')+'</td><td data-label="Fecha de pago">'+dateText(p.paymentDate)+'</td><td data-label="Estado"><span class="status-chip '+(p.status==='Pagada'?'status-success':(p.status==='Anulada'?'status-muted':'status-pending'))+'">'+esc(p.status)+'</span></td><td data-label="Acciones">'+periodAction+'</td></tr>';
      }).join('');
      content='<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>PERÍODO</th><th>COLABORADORES</th><th>NETO A PAGAR</th><th>FECHA DE PAGO</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No hay períodos de nómina registrados.</td></tr>')+'</tbody></table></div></article><div class="notice-panel hr-payroll-note">'+svg('warning')+'<div><strong>Antes de pagar</strong><p>Configura y valida las deducciones legales antes de aprobar la nómina.</p></div></div>';
    }
    return '<section class="hr-view">'+heading(views.hr,actions)+
      '<div class="summary-strip hr-summary-strip"><div class="summary-mini"><span>Colaboradores activos</span><strong>'+activeEmployees.length+'</strong></div><div class="summary-mini"><span>Nómina mensual base</span><strong>'+moneyInCurrency(activeEmployees.reduce((s,e)=>s+Number(e.salaryNio||0),0),'NIO')+'</strong></div><div class="summary-mini"><span>Solicitudes pendientes</span><strong>'+leaveRequests.filter(l=>l.status==='Pendiente').length+'</strong></div><div class="summary-mini"><span>Períodos de nómina</span><strong>'+payrollPeriods.length+'</strong></div></div>'+
      tabsHtml+'<div class="hr-content">'+content+'</div></section>';
  }
  function renderAnalytics(){
    const finance=financialSnapshot();
    const inventory=products.reduce((sum,p)=>sum+Number(p.unitCost||0)*Number(p.stock||0),0);
    const potential=products.reduce((sum,p)=>sum+Math.max(0,costSummary(p).profit)*Number(p.stock||0),0);
    const purchasesTotal=purchases.reduce((sum,p)=>sum+Number(p.totalUsd||0),0);
    const receivables=invoices.reduce((sum,i)=>sum+Math.max(0,Number(i.totalUsd||0)-Number(i.paidUsd||0)),0);
    const payables=purchases.reduce((sum,p)=>sum+Math.max(0,Number(p.totalUsd||0)-Number(p.paidUsd||0)),0);
    const paidRevenue=invoices.reduce((sum,i)=>sum+Number(i.paidUsd||0),0);
    return heading(views.analytics,'')+
      '<div class="metric-grid">'+
      metric('Ventas facturadas',money(finance.revenue),'chart',invoices.length+' facturas','productos vendidos · USD',false)+
      metric('Costo de ventas',money(finance.costOfSales),'boxes','Costo de productos vendidos','según costo guardado en factura',false)+
      metric('Utilidad bruta',money(finance.grossProfit),'spark','Venta neta de productos − costo','antes de gastos operativos',true)+
      metric('Gastos operativos',money(finance.operatingExpenses),'receipt',expenses.length+' gastos','convertidos a USD',false)+
      metric('Resultado después de gastos',money(finance.netProfit),'wallet','Utilidad bruta + entrega − gastos','antes de impuestos y partidas no registradas',true)+
      metric('Cobros recibidos',money(paidRevenue),'wallet','Facturas y abonos','flujo de cobros',false)+
      '</div>'+
      '<div class="summary-strip">'+
      '<div class="summary-mini"><span>Valor del inventario a costo</span><strong>'+money(inventory)+'</strong></div>'+
      '<div class="summary-mini"><span>Margen potencial del stock</span><strong>'+money(potential)+'</strong></div>'+
      '<div class="summary-mini"><span>Compras acumuladas</span><strong>'+money(purchasesTotal)+'</strong></div>'+
      '<div class="summary-mini"><span>Cuentas por cobrar</span><strong>'+money(receivables)+'</strong></div>'+
      '<div class="summary-mini"><span>Cuentas por pagar</span><strong>'+money(payables)+'</strong></div>'+
      '</div>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Criterio del resultado</strong><p>La utilidad bruta se calcula con los renglones de facturas y su costo unitario registrado. El resultado después de gastos descuenta los gastos operativos capturados; no representa utilidad fiscal ni incorpora impuestos, nómina o ajustes que aún no estén registrados.</p></div></div>';
  }
  function supplierPayablesUsd(supplierName){
    return purchases.filter(p=>p.supplier===supplierName).reduce((sum,p)=>sum+Math.max(0,Number(p.totalUsd||0)-Number(p.paidUsd||0)),0);
  }
  function renderSuppliers(){
    const rows=suppliers.map(s=>'<tr><td data-label="Proveedor / contacto" class="table-primary">'+esc(s.name)+'<small class="table-secondary">'+esc(s.contact||s.email||'Sin contacto')+'</small></td><td data-label="Teléfono">'+esc(s.phone||'—')+'</td><td data-label="Moneda habitual">'+(s.currency==='NIO'?'NIO · Córdoba':'USD · Dólar')+'</td><td data-label="Compras">'+purchases.filter(p=>p.supplier===s.name).length+'</td><td data-label="Saldo por pagar">'+money(supplierPayablesUsd(s.name))+'</td></tr>').join('');
    const outstanding=purchases.reduce((sum,p)=>sum+Math.max(0,Number(p.totalUsd||0)-Number(p.paidUsd||0)),0);
    return heading(views.suppliers,'<button class="button button-primary" data-action="new-supplier">'+svg('plus')+' Nuevo proveedor</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Proveedores</span><strong>'+suppliers.length+'</strong></div><div class="summary-mini"><span>Compras vinculadas</span><strong>'+purchases.length+'</strong></div><div class="summary-mini"><span>Saldo por pagar USD</span><strong>'+money(outstanding)+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>PROVEEDOR / CONTACTO</th><th>TELÉFONO</th><th>MONEDA HABITUAL</th><th>COMPRAS</th><th>SALDO USD</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">No hay proveedores registrados.</td></tr>')+'</tbody></table></div></article>';
  }
  function renderPurchases(){
    const total=purchases.reduce((s,p)=>s+Number(p.totalUsd||0),0);
    const paid=purchases.reduce((s,p)=>s+Number(p.paidUsd||0),0);
    const due=Math.max(0,total-paid);
    const rows=purchases.map(p=>{
      const balance=Math.max(0,Number(p.totalUsd||0)-Number(p.paidUsd||0));
      const status=balance<=0.001?'Pagado':(Number(p.paidUsd||0)>0?'Abono parcial':'Pendiente');
      return '<tr><td data-label="Fecha">'+dateText(p.createdAt)+'</td><td data-label="Proveedor" class="table-primary">'+esc(p.supplier)+'</td><td data-label="Perfume">'+esc(p.product)+'</td><td data-label="Unidades">'+p.quantity+'</td><td data-label="Total">'+moneyInCurrency(p.originalTotal,p.currency)+'<small class="table-secondary">'+money(p.totalUsd)+' USD</small></td><td data-label="Pagado">'+money(p.paidUsd||0)+'</td><td data-label="Saldo">'+money(balance)+'</td><td data-label="Estado"><span class="status-chip '+(balance<=0.001?'status-success':'status-pending')+'">'+status+'</span></td><td data-label="Acción">'+(balance>0.001?'<button class="button button-quiet button-small" data-action="new-purchase-payment" data-id="'+esc(p.id)+'">Abonar</button>':'—')+'</td></tr>';
    }).join('');
    return heading(views.purchases,'<button class="button button-primary" data-action="new-purchase">'+svg('plus')+' Registrar compra</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Compras</span><strong>'+purchases.length+'</strong></div><div class="summary-mini"><span>Compras USD</span><strong>'+money(total)+'</strong></div><div class="summary-mini"><span>Pagado USD</span><strong>'+money(paid)+'</strong></div><div class="summary-mini"><span>Por pagar USD</span><strong>'+money(due)+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>FECHA</th><th>PROVEEDOR</th><th>PERFUME</th><th>UNIDADES</th><th>TOTAL</th><th>PAGADO USD</th><th>SALDO USD</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="9">No hay compras registradas.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('spark')+'<div><strong>Recepción y costo de inventario</strong><p>La compra actualiza existencias, costo promedio, kardex, saldo del proveedor y el pago inicial cuando corresponde. Los abonos posteriores no modifican el inventario.</p></div></div>';
  }
  function renderPayables(){
    const open=purchases.filter(p=>Number(p.totalUsd||0)-Number(p.paidUsd||0)>0.001);
    const total=open.reduce((s,p)=>s+Math.max(0,Number(p.totalUsd||0)-Number(p.paidUsd||0)),0);
    const suppliersOpen=new Set(open.map(p=>p.supplier)).size;
    const rows=open.map(p=>{
      const balance=Math.max(0,Number(p.totalUsd||0)-Number(p.paidUsd||0));
      const status=Number(p.paidUsd||0)>0?'Abono parcial':'Pendiente';
      return '<tr><td data-label="Compra / fecha" class="table-primary"><strong>'+esc(p.id)+'</strong><small class="table-secondary">'+dateText(p.createdAt)+'</small></td><td data-label="Proveedor">'+esc(p.supplier)+'</td><td data-label="Producto">'+esc(p.product)+' · '+p.quantity+' uds.</td><td data-label="Total">'+money(Number(p.totalUsd||0))+'</td><td data-label="Abonado">'+money(Number(p.paidUsd||0))+'</td><td data-label="Saldo"><strong>'+money(balance)+'</strong></td><td data-label="Estado"><span class="status-chip status-pending">'+status+'</span></td><td data-label="Acción"><button class="button button-quiet button-small" data-action="new-purchase-payment" data-id="'+esc(p.id)+'">Registrar abono</button></td></tr>';
    }).join('');
    return heading(views.payables,'<button class="button button-quiet" data-view="purchases">Ver compras</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Saldo pendiente USD</span><strong>'+money(total)+'</strong></div><div class="summary-mini"><span>Proveedores pendientes</span><strong>'+suppliersOpen+'</strong></div><div class="summary-mini"><span>Compras con saldo</span><strong>'+open.length+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>COMPRA / FECHA</th><th>PROVEEDOR</th><th>PRODUCTO</th><th>TOTAL USD</th><th>ABONADO</th><th>SALDO</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="8">No hay cuentas pendientes con proveedores.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('warning')+'<div><strong>Cuentas por pagar</strong><p>Los saldos se calculan desde compras registradas en Neon. Cada abono conserva moneda, tipo de cambio, cuenta de salida y trazabilidad.</p></div></div>';
  }
  function renderExpenses(){
    const rows=expenses.map(e=>'<tr><td data-label="Fecha">'+dateText(e.createdAt)+'</td><td data-label="Categoría">'+esc(e.category)+'</td><td data-label="Descripción" class="table-primary">'+esc(e.description)+'</td><td data-label="Importe / conversión">'+moneyInCurrency(e.originalAmount,e.currency)+'<small class="table-secondary">'+money(e.amountUsd)+' · '+rateLabel(e.exchangeRate)+'</small></td></tr>').join('');
    return heading(views.expenses,'<button class="button button-primary" data-action="new-expense">'+svg('plus')+' Nuevo gasto</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Gastos</span><strong>'+expenses.length+'</strong></div><div class="summary-mini"><span>Total USD</span><strong>'+money(expenses.reduce((s,e)=>s+e.amountUsd,0))+'</strong></div><div class="summary-mini"><span>Tasa actual</span><strong>'+rateLabel(exchangeRate)+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>CATEGORÍA</th><th>DESCRIPCIÓN</th><th>IMPORTE / CONVERSIÓN</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">No hay gastos registrados.</td></tr>')+'</tbody></table></div></article>';
  }
  function renderCash(){
    const rows=cashEntries.map(e=>'<tr><td data-label="Fecha">'+dateText(e.createdAt)+'</td><td data-label="Movimiento">'+(e.direction==='income'?'<span class="status-chip status-success">Entrada</span>':'<span class="status-chip status-pending">Salida</span>')+'</td><td data-label="Concepto / cuenta" class="table-primary">'+esc(e.concept)+'<small class="table-secondary">'+esc(e.account)+'</small></td><td data-label="Importe / conversión">'+moneyInCurrency(e.originalAmount,e.currency)+'<small class="table-secondary">'+money(e.amountUsd)+' · '+rateLabel(e.exchangeRate)+'</small></td></tr>').join('');
    const income=cashEntries.filter(e=>e.direction==='income').reduce((s,e)=>s+e.amountUsd,0),out=cashEntries.filter(e=>e.direction!=='income').reduce((s,e)=>s+e.amountUsd,0);
    const accounts=cashAccounts.map(account=>{
      const entries=cashEntries.filter(e=>e.accountId===account.id);
      const balance=entries.reduce((sum,e)=>sum+(e.direction==='income'?Number(e.originalAmount||0):-Number(e.originalAmount||0)),0);
      const balanceUsd=entries.reduce((sum,e)=>sum+(e.direction==='income'?Number(e.amountUsd||0):-Number(e.amountUsd||0)),0);
      return '<div class="summary-mini"><span>'+esc(account.name)+' · '+esc(account.account_type)+'</span><strong>'+moneyInCurrency(balance,account.currency)+'</strong><small class="table-secondary">'+money(balanceUsd)+' USD equivalente</small></div>';
    }).join('');
    return heading(views.cash,'<div class="heading-actions-inline"><button class="button button-quiet" data-action="new-cash-account">Nueva cuenta</button><button class="button button-primary" data-action="new-cash">'+svg('plus')+' Registrar movimiento</button></div>')+
      '<div class="summary-strip"><div class="summary-mini"><span>Entradas equivalentes USD</span><strong>'+money(income)+'</strong></div><div class="summary-mini"><span>Salidas equivalentes USD</span><strong>'+money(out)+'</strong></div><div class="summary-mini"><span>Flujo neto USD</span><strong>'+money(income-out)+'</strong></div></div>'+
      '<article class="panel"><div class="panel-heading"><div><h2>Saldos por cuenta</h2><p>Saldo calculado desde movimientos y saldos iniciales registrados</p></div></div><div class="summary-strip">'+(accounts||'<div class="empty-state">No hay cuentas activas.</div>')+'</div></article>'+
      '<article class="list-panel"><div class="panel-heading"><div><h2>Libro de caja y bancos</h2><p>Entradas, salidas, cobros, pagos y aperturas de cuenta</p></div><span class="ledger-count">'+cashEntries.length+' movimientos</span></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>MOVIMIENTO</th><th>CONCEPTO / CUENTA</th><th>IMPORTE / CONVERSIÓN</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">No hay recibos ni pagos registrados.</td></tr>')+'</tbody></table></div></article>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Libro de caja y bancos</strong><p>Los saldos reflejan movimientos que registres en el ERP, incluidos los saldos iniciales. No consulta entidades bancarias ni ejecuta transferencias; la conciliación se realiza con estados de cuenta.</p></div></div>';
  }
  async function loadDgiSupportDocuments(force){
    if(dgiDocumentsLoading||(dgiDocumentsLoaded&&!force)||(!force&&dgiDocumentsLoadAttempted))return;
    dgiDocumentsLoading=true;dgiDocumentsLoadAttempted=true;dgiDocumentsError='';
    try{
      const response=await erpApi('dgi-support-documents');
      dgiSupportDocuments=(response.records||[]).map(document=>({
        id:document.id,documentDate:document.document_date,documentType:document.document_type,
        issuer:document.issuer,referenceNumber:document.reference_number||'',description:document.description||'',
        fiscalPeriod:document.fiscal_period||'',currency:document.currency||'NIO',
        originalAmount:Number(document.original_amount||0),amountNio:Number(document.amount_nio||0),
        formalInvoice:document.formal_invoice===true,fileName:document.file_name||'',
        fileType:document.file_type||'',fileSize:Number(document.file_size||0),notes:document.notes||''
      }));
      dgiDocumentsLoaded=true;
    }catch(error){dgiDocumentsError=error?.message||'No se pudo consultar el archivo DGI.';}
    finally{dgiDocumentsLoading=false;if(state.view==='dgi')renderView();}
  }
  function dgiPeriodKey(date){
    const value=date instanceof Date?date:new Date(date);
    return value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0');
  }
  function dgiTypeLabel(type){
    return ({purchase_invoice:'Factura de compra',service_invoice:'Factura de servicio',rent_receipt:'Recibo de alquiler',municipal_payment:'Pago municipal',dgi_payment:'Pago DGI',other:'Otro soporte'})[type]||'Documento';
  }
  function dgiAmountNio(usd,rate){return roundMoney(Number(usd||0)*Number(rate||exchangeRate));}
  function exportDgiBook(){
    const rows=[['Fecha','Tipo de operación','Tercero / descripción','Referencia','Importe NIO','Clasificación'],...invoices.filter(i=>!['Anulada','Cancelada','Anulado','Cancelado'].includes(i.status)).flatMap(i=>(i.payments||[]).map(payment=>[
      dateText(payment.createdAt),'Cobro recibido · factura',i.customer,i.id,dgiAmountNio(payment.amountUsd,payment.exchangeRate||1),'Ingreso percibido'
    ])),...cashEntries.filter(entry=>entry.direction==='income'&&!entry.sourceType).map(entry=>[
      dateText(entry.createdAt),'Ingreso de caja sin documento vinculado',entry.concept,entry.id,dgiAmountNio(entry.amountUsd,entry.exchangeRate||1),'Ingreso por conciliar'
    ]),...purchases.map(p=>[
      dateText(p.createdAt),'Compra de inventario',p.supplier,p.purchaseNumber,dgiAmountNio(p.totalUsd,p.exchangeRate||exchangeRate),'Egreso / compra'
    ]),...expenses.map(e=>[
      dateText(e.createdAt),'Gasto · '+e.category,e.description,e.id,dgiAmountNio(e.amountUsd,e.exchangeRate||exchangeRate),'Egreso'
    ])];
    exportCsvFile('jb-parfums-libro-auxiliar-dgi.csv',rows);
    toast('Libro auxiliar exportado. Concílialo con comprobantes y registros exigibles antes de presentarlo.');
  }
  async function saveDgiSettings(event){
    event.preventDefault();
    const form=event.target, data=new FormData(form), button=form.querySelector('[type="submit"]');
    const value={
      taxpayer_name:String(data.get('taxpayerName')||'').trim(),
      ruc:String(data.get('ruc')||'').trim(),
      business_address:String(data.get('businessAddress')||'').trim(),
      regime_status:String(data.get('regimeStatus')||'not_confirmed'),
      quota_fixed_amount_nio:Number(data.get('quotaFixedAmountNio')||0),
      certificate_available:data.get('certificateAvailable')==='on',
      certificate_displayed:data.get('certificateDisplayed')==='on',
      computerized_invoicing_status:String(data.get('computerizedInvoicingStatus')||'not_confirmed'),
      dgi_confirmation_date:String(data.get('dgiConfirmationDate')||'').trim(),
      regime_confirmation_reference:String(data.get('regimeConfirmationReference')||'').trim(),
      computerized_invoicing_authorization_number:String(data.get('computerizedInvoicingAuthorizationNumber')||'').trim(),
      computerized_invoicing_confirmation_reference:String(data.get('computerizedInvoicingConfirmationReference')||'').trim()
    };
    if(!Number.isFinite(value.quota_fixed_amount_nio)||value.quota_fixed_amount_nio<0){toast('La cuota mensual debe ser un importe válido.');return;}
    if(button){button.disabled=true;button.textContent='Guardando…';}
    try{
      await erpApi('settings',{method:'PATCH',body:JSON.stringify({setting_key:'dgi_compliance',setting_value:value})});
      dgiCompliance=value;renderView();toast('Configuración DGI guardada en Neon Development.');
    }catch(error){toast(error?.message||'No se pudo guardar la configuración DGI.');}
    finally{if(button){button.disabled=false;button.textContent='Guardar configuración DGI';}}
  }
  async function uploadDgiDocument(event){
    event.preventDefault();
    const form=event.target,button=form.querySelector('[type="submit"]');
    const file=form.querySelector('[name="file"]')?.files?.[0];
    if(!file){toast('Selecciona el archivo de respaldo.');return;}
    const data=new FormData(form);
    data.set('exchange_rate',String(exchangeRate));
    data.set('formal_invoice',form.querySelector('[name="formalInvoice"]')?.checked?'true':'false');
    if(data.get('document_type')==='dgi_payment'&&!String(data.get('fiscal_period')||'')){toast('Indica el período al que corresponde el pago DGI.');return;}
    if(button){button.disabled=true;button.textContent='Subiendo a R2…';}
    try{
      const auth=window.JBAuth,token=await auth?.getToken();
      if(!auth?.profile||!token)throw new Error('Inicia sesión para archivar documentos tributarios.');
      const response=await fetch(auth.apiUrl('/api/erp/dgi-support-documents'),{method:'POST',headers:{authorization:'Bearer '+token},body:data,cache:'no-store'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result?.error?.message||'No se pudo guardar el documento.');
      dgiDocumentsLoaded=false;dgiDocumentsLoadAttempted=false;await loadDgiSupportDocuments(true);renderView();toast('Documento archivado en Neon y Cloudflare R2.');
    }catch(error){toast(error?.message||'No se pudo archivar el documento.');}
    finally{if(button){button.disabled=false;button.textContent='Guardar respaldo en R2';}}
  }
  async function downloadDgiDocument(id,button){
    const documentRecord=dgiSupportDocuments.find(item=>String(item.id)===String(id));
    if(!documentRecord)return;
    if(button)button.disabled=true;
    try{
      const auth=window.JBAuth,token=await auth?.getToken();
      if(!auth?.profile||!token)throw new Error('Inicia sesión para descargar el documento.');
      const response=await fetch(auth.apiUrl('/api/erp/dgi-support-documents/'+encodeURIComponent(id)+'/file'),{headers:{authorization:'Bearer '+token},cache:'no-store'});
      if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body?.error?.message||'No se pudo obtener el archivo.');}
      const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
      link.href=url;link.download=documentRecord.fileName||'respaldo-dgi';document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(error){toast(error?.message||'No se pudo descargar el archivo.');}
    finally{if(button)button.disabled=false;}
  }
  function renderDgi(){
    const role=window.JBAuth?.profile?.role||'';
    if(!dgiDocumentsLoaded&&!dgiDocumentsLoading&&!dgiDocumentsLoadAttempted)loadDgiSupportDocuments(false);
    if(!['owner','admin','finance'].includes(role))return heading(views.dgi,'')+'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Acceso restringido</strong><p>El centro DGI está disponible para propietario, administración y finanzas.</p></div></div>';
    const now=new Date(), monthStart=new Date(now.getFullYear(),now.getMonth(),1), nextMonth=new Date(now.getFullYear(),now.getMonth()+1,1);
    const invoicedOrderIds=new Set(invoices.map(i=>String(i.orderId||'')));
    const completedOrdersWithoutInvoice=orders.filter(o=>o.status==='Completado'&&!invoicedOrderIds.has(String(o.id)));
    const salesRows=invoices.filter(i=>!['Anulada','Cancelada','Anulado','Cancelado'].includes(i.status))
      .flatMap(i=>(i.payments||[]).map(payment=>({
        date:new Date(payment.createdAt),
        amount:dgiAmountNio(payment.amountUsd,payment.exchangeRate||1)
      })));
    const unlinkedCashIncome=cashEntries.filter(entry=>entry.direction==='income'&&!entry.sourceType);
    const unlinkedIncomeRows=unlinkedCashIncome.map(entry=>({
      date:new Date(entry.createdAt),
      amount:dgiAmountNio(entry.amountUsd,entry.exchangeRate||1)
    }));
    // Standalone cash receipts are included in control thresholds to avoid understating income.
    // Linked cash entries are excluded here because their invoice payment is already counted.
    const incomeRows=[...salesRows,...unlinkedIncomeRows];
    const monthSales=incomeRows.filter(row=>row.date>=monthStart&&row.date<nextMonth).reduce((sum,row)=>sum+row.amount,0);
    const sixMonthStart=new Date(now.getFullYear(),now.getMonth()-6,1);
    const sixMonthSales=incomeRows.filter(row=>row.date>=sixMonthStart&&row.date<monthStart);
    const sixMonthTotal=sixMonthSales.reduce((sum,row)=>sum+row.amount,0);
    const sixMonthAverage=sixMonthTotal/6;
    const inventoryCost=products.reduce((sum,p)=>sum+Math.max(0,Number(p.stock||0))*Math.max(0,Number(p.unitCost||0))*exchangeRate,0);
    const monthPendingOrders=completedOrdersWithoutInvoice.filter(o=>{const d=new Date(o.createdAt);return d>=monthStart&&d<nextMonth;}).length;
    const unlinkedCashIncomeNio=unlinkedIncomeRows.reduce((sum,row)=>sum+row.amount,0);
    const regime=dgiCompliance.regime_status||'not_confirmed';
    const dgiPaymentPeriod=dgiPeriodKey(new Date(now.getFullYear(),now.getMonth()-1,1));
    const dgiPayment=dgiSupportDocuments.find(d=>d.documentType==='dgi_payment'&&d.fiscalPeriod===dgiPaymentPeriod);
    const cuota=Number(dgiCompliance.quota_fixed_amount_nio||0);
    const overdue=!dgiPayment&&now.getDate()>15;
    const limitSales=monthSales>100000;
    const limitAverage=sixMonthAverage>100000;
    const limitStock=inventoryCost>500000;
    const owner=['owner','admin'].includes(role);
    const settingsForm=owner?'<article class="panel"><div class="panel-heading"><div><h2>Datos del contribuyente y régimen</h2><p>Completa estos datos con la resolución o confirmación de la DGI. El ERP inicia como “no confirmado”.</p></div></div>'+
      '<form id="dgi-settings-form" class="form-grid">'+
      formField('Nombre del contribuyente','taxpayerName','text',false,'maxlength="180" value="'+esc(dgiCompliance.taxpayer_name||'')+'"')+
      formField('RUC','ruc','text',false,'maxlength="40" value="'+esc(dgiCompliance.ruc||'')+'"')+
      formField('Dirección del establecimiento','businessAddress','text',false,'maxlength="180" value="'+esc(dgiCompliance.business_address||'')+'"')+
      selectField('Régimen confirmado por DGI','regimeStatus','<option value="not_confirmed" '+(regime==='not_confirmed'?'selected':'')+'>Pendiente de confirmación</option><option value="cuota_fija" '+(regime==='cuota_fija'?'selected':'')+'>Cuota Fija</option><option value="general" '+(regime==='general'?'selected':'')+'>Régimen General</option>',true)+
      formField('Cuota fija mensual confirmada (C$)','quotaFixedAmountNio','number',false,'min="0" max="10000000" step="0.01" value="'+cuota.toFixed(2)+'"')+
      formField('Referencia de constancia o resolución del régimen','regimeConfirmationReference','text',false,'maxlength="180" value="'+esc(dgiCompliance.regime_confirmation_reference||'')+'"')+
      selectField('Estado de autorización para facturación computarizada','computerizedInvoicingStatus','<option value="not_confirmed" '+((dgiCompliance.computerized_invoicing_status||'not_confirmed')==='not_confirmed'?'selected':'')+'>No confirmado con DGI</option><option value="pending_authorization" '+(dgiCompliance.computerized_invoicing_status==='pending_authorization'?'selected':'')+'>Solicitud pendiente</option><option value="authorized" '+(dgiCompliance.computerized_invoicing_status==='authorized'?'selected':'')+'>Autorización recibida</option><option value="not_applicable_confirmed" '+(dgiCompliance.computerized_invoicing_status==='not_applicable_confirmed'?'selected':'')+'>DGI confirmó que no aplica</option>',true)+
      formField('Número de autorización de facturación computarizada','computerizedInvoicingAuthorizationNumber','text',false,'maxlength="180" value="'+esc(dgiCompliance.computerized_invoicing_authorization_number||'')+'"')+
      formField('Referencia de respuesta escrita si DGI confirma que no aplica','computerizedInvoicingConfirmationReference','text',false,'maxlength="180" value="'+esc(dgiCompliance.computerized_invoicing_confirmation_reference||'')+'"')+
      formField('Fecha de confirmación o autorización DGI','dgiConfirmationDate','date',false,'value="'+esc(dgiCompliance.dgi_confirmation_date||'')+'"')+
      '<label class="form-field"><span><input type="checkbox" name="certificateAvailable" '+(dgiCompliance.certificate_available?'checked':'')+'> Certificado de inscripción disponible</span></label>'+
      '<label class="form-field"><span><input type="checkbox" name="certificateDisplayed" '+(dgiCompliance.certificate_displayed?'checked':'')+'> Certificado exhibido en el establecimiento</span></label>'+
      '<div class="full-field modal-actions"><button class="button button-primary" type="submit">Guardar configuración DGI</button></div></form></article>':'';
    const documents=dgiSupportDocuments.map(d=>'<tr><td data-label="Fecha">'+dateText(d.documentDate)+'</td><td data-label="Tipo">'+esc(dgiTypeLabel(d.documentType))+(d.fiscalPeriod?'<small class="table-secondary">'+esc(d.fiscalPeriod)+'</small>':'')+'</td><td data-label="Emisor" class="table-primary">'+esc(d.issuer)+'</td><td data-label="Importe">'+moneyInCurrency(d.originalAmount,d.currency)+'<small class="table-secondary">'+moneyInCurrency(d.amountNio,'NIO')+'</small></td><td data-label="Factura formal">'+(d.formalInvoice?'Sí':'No / no indicado')+'</td><td data-label="Archivo">'+esc(d.fileName)+'</td><td data-label="Acción"><button type="button" class="button button-quiet button-small" data-action="download-dgi-document" data-id="'+esc(d.id)+'">Descargar</button></td></tr>').join('');
    const docForm='<article class="panel"><div class="panel-heading"><div><h2>Archivar soporte tributario</h2><p>Guarda las facturas originales de proveedores, servicios, alquiler y recibos municipales o de la DGI.</p></div></div>'+
      '<form id="dgi-document-form" class="form-grid">'+
      selectField('Tipo de documento','document_type','<option value="purchase_invoice">Factura de compra a proveedor</option><option value="service_invoice">Factura de servicio</option><option value="rent_receipt">Recibo de alquiler</option><option value="municipal_payment">Pago municipal</option><option value="dgi_payment">Pago DGI / Cuota Fija</option><option value="other">Otro soporte</option>',true)+
      formField('Fecha del documento','document_date','date',true,'value="'+new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)+'"')+
      formField('Período fiscal (AAAA-MM)','fiscal_period','month',false,'')+
      formField('Emisor / proveedor / institución','issuer','text',true,'maxlength="180"')+
      formField('Número de factura o referencia','reference_number','text',false,'maxlength="100"')+
      formField('Descripción','description','text',false,'maxlength="240"')+
      formField('Importe original','original_amount','number',false,'min="0" step="0.01" value="0"')+
      selectField('Moneda','currency','<option value="NIO" selected>NIO · Córdoba</option><option value="USD">USD · Dólar</option>',true)+
      '<label class="form-field"><span><input type="checkbox" name="formalInvoice"> Factura formal emitida por proveedor inscrito</span></label>'+
      formField('Archivo PDF / JPG / PNG','file','file',true,'accept="application/pdf,image/jpeg,image/png"')+
      formField('Notas','notes','text',false,'maxlength="300"')+
      '<p class="form-helper full-field">Archivos privados en el bucket R2 existente. Máximo 5 MB. Al escoger “Pago DGI”, indica también el período pagado para conciliarlo.</p>'+
      '<div class="full-field modal-actions"><button class="button button-primary" type="submit">Guardar respaldo en R2</button></div></form></article>';
    const monthStatus=limitSales||limitAverage||limitStock?'warning':'success';
    const dgiAlert=regime==='not_confirmed'?'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Régimen tributario pendiente de confirmar</strong><p>El ERP no supone que JB PARFUMS está inscrito en Cuota Fija. Confirma con la DGI la elegibilidad y el monto de la cuota antes de marcarlo aquí.</p></div></div>':'';
    const periodNotice=regime==='cuota_fija'?'<div class="notice-panel"><span>'+svg(overdue?'warning':'spark')+'</span><div><strong>Pago de Cuota Fija · período '+esc(dgiPaymentPeriod)+'</strong><p>'+(dgiPayment?'El comprobante del período está archivado. Importe registrado: '+moneyInCurrency(dgiPayment.amountNio,'NIO')+'.':(cuota>0?'Cuota configurada: '+moneyInCurrency(cuota,'NIO')+'. ':'Aún no se ha configurado el monto de cuota. ')+(overdue?'La fecha usual de pago de los primeros 15 días ya pasó; verifica el estado con la DGI.':'El pago del período anterior vence dentro de los primeros 15 días de este mes.'))+'</p></div></div>':'';
    return heading(views.dgi,'<button class="button button-primary" data-action="export-dgi-book">Exportar libro auxiliar CSV</button>')+
      dgiAlert+
      '<div class="summary-strip"><div class="summary-mini"><span>Ingresos observados del mes · NIO</span><strong>'+moneyInCurrency(monthSales,'NIO')+'</strong><small class="table-secondary">Ingresos percibidos registrados · referencia C$ 100,000</small></div><div class="summary-mini"><span>Promedio de ingresos observados · 6 meses</span><strong>'+moneyInCurrency(sixMonthAverage,'NIO')+'</strong><small class="table-secondary">Seis meses completos · referencia C$ 100,000</small></div><div class="summary-mini"><span>Inventario al costo · NIO</span><strong>'+moneyInCurrency(inventoryCost,'NIO')+'</strong><small class="table-secondary">Referencia legal: C$ 500,000 · estimación al tipo de cambio vigente</small></div><div class="summary-mini"><span>Pedidos completados sin factura</span><strong>'+monthPendingOrders+'</strong><small class="table-secondary">Revisa la facturación de ventas</small></div></div>'+
      (limitSales?'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Ingresos registrados del mes superiores a C$100,000</strong><p>El ERP no bloquea ventas. Revisa tu elegibilidad y consulta a la DGI; el indicador incluye cobros asociados a facturas e ingresos de caja sin vínculo documental, y no sustituye la conciliación tributaria.</p></div></div>':'')+
      (unlinkedCashIncome.length?'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Ingresos de caja sin vínculo documental</strong><p>'+unlinkedCashIncome.length+' movimientos por '+moneyInCurrency(unlinkedCashIncomeNio,'NIO')+' se incluyen de forma preventiva en el indicador para no subestimar ingresos. Pueden ser aportes, préstamos o transferencias y no necesariamente ventas; clasifícalos y relaciónalos con su soporte antes de cerrar el período.</p></div></div>':'')+
      (limitAverage?'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Promedio de ingresos percibidos de seis meses superior a C$100,000</strong><p>El artículo 256 de la Ley 822 contempla informar a la Administración Tributaria dentro de los 30 días calendario posteriores a la ocurrencia para el traslado al régimen general. Verifica el cálculo con la DGI y conserva la constancia.</p></div></div>':'')+
      (limitStock?'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Inventario al costo superior a C$500,000</strong><p>Consulta inmediatamente con la DGI la continuidad del régimen. El sistema informa el umbral, pero no bloquea la operación ni cambia el régimen automáticamente.</p></div></div>':'')+
      '<div class="feature-grid">'+
      featureCard('receipt','Registro simplificado','La exportación consolida ventas facturadas, compras registradas y gastos del ERP. Verifica que se haya registrado cada operación y adjunta los comprobantes originales.')+
      featureCard('boxes','Respaldo de inventario','Conserva las facturas formales de proveedores nicaragüenses que sustentan el inventario y los costos de adquisición.')+
      featureCard('calendar','Archivo cronológico','Separa recibos de servicios, alquiler, tributos municipales y pagos DGI; cada documento conserva fecha, emisor, período y respaldo.')+
      featureCard('shield','Facturación computarizada','No emitas documentos como fiscales desde el ERP hasta confirmar con la DGI el régimen aplicable y, cuando corresponda, obtener autorización previa.')+
      '</div>'+
      periodNotice+
      settingsForm+
      docForm+
      (dgiDocumentsError?'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Archivo DGI no disponible</strong><p>'+esc(dgiDocumentsError)+'</p><button type="button" class="button button-quiet button-small" data-action="reload-dgi-documents">Reintentar consulta</button></div></div>':'')+'<article class="list-panel"><div class="panel-heading"><div><h2>Archivo de respaldos tributarios</h2><p>'+dgiSupportDocuments.length+' documentos archivados en Neon y R2.</p></div></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>TIPO / PERÍODO</th><th>EMISOR</th><th>IMPORTE</th><th>FACTURA FORMAL</th><th>ARCHIVO</th><th></th></tr></thead><tbody>'+(documents||'<tr><td colspan="7">Todavía no hay documentos archivados.</td></tr>')+'</tbody></table></div></article>'+
      '<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Alcance del libro auxiliar y de los umbrales</strong><p>Los indicadores incluyen cobros asociados a facturas y movimientos de caja sin vínculo documental, sin duplicar cobros ya ligados a una factura. Los movimientos sin clasificar se incluyen preventivamente, pero pueden ser aportes, préstamos o transferencias y no ventas; por eso pueden sobreestimar los ingresos de ventas. Clasifícalos y concílialos antes de tomar una decisión tributaria. El tipo de cambio, las fechas y los registros faltantes afectan el resultado. Son indicadores de control, no una declaración fiscal ni certificación de elegibilidad. Este módulo no presenta declaraciones ni sustituye la validación de un contador o una respuesta escrita de la DGI.</p></div></div>';
  }
  function renderSettings(){
    const role=window.JBAuth?.profile?.role||'sin perfil';
    return heading(views.settings,'')+
      '<article class="panel settings-rate-panel"><div class="panel-heading"><div><h2>Moneda y tipo de cambio</h2><p>Moneda base: USD. La nómina se administra en córdobas (NIO).</p></div></div>'+
      '<form id="exchange-rate-form" class="rate-form"><label class="form-field"><span>Tipo de cambio · C$ por US$ 1 '+requiredMark()+'</span><input name="exchangeRate" type="number" min="0.0001" max="100000" step="0.0001" value="'+exchangeRate.toFixed(4)+'" required></label><button class="button button-primary" type="submit">Guardar tipo de cambio</button></form>'+
      '<p class="form-helper">Tasa vigente: '+rateLabel(exchangeRate)+'. Cada operación conserva la tasa que tenía al registrarse.</p></article>'+
      '<div class="feature-grid">'+
      featureCard('settings','Cuenta y permisos','Sesión de Neon Auth activa. Rol actual: '+role+'. Los módulos aplican permisos según el perfil.')+
      featureCard('receipt','Base de datos','Neon PostgreSQL · Desarrollo. Los registros operativos se consultan y actualizan en el servidor.')+
      featureCard('boxes','Archivos y fotografías','Bucket R2 privado vinculado al Worker. Integración de carga y gestión de archivos en la siguiente fase.')+
      featureCard('chart','Consumo y costos','Sin consultas periódicas ni tareas cron. Revisar los contadores de Neon, Workers y R2 en sus paneles antes de ampliar tráfico.')+
      featureCard('users','Personal y nómina','RR. HH. permanece habilitado. La nómina legal requiere configurar deducciones y prestaciones conforme a la normativa vigente.')+
      featureCard('spark','Trazabilidad','Las operaciones comerciales, cambios relevantes y ajustes de inventario registran auditoría.')+
      '</div>'+
      '<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Entorno de trabajo: Neon Development</strong><p>Los cambios de esta etapa se prueban en Desarrollo. Neon Production no recibe migraciones ni datos hasta validar el sistema y revisar los consumos.</p></div></div>';
  }
  function updateNotificationIndicator(){
    const dot=document.querySelector('.notification-button i');
    const button=document.querySelector('.notification-button');
    if(!dot||!button)return;
    const lowStock=products.some(p=>p.active!==false&&needsRestock(p));
    const receivable=invoices.some(i=>Number(i.totalUsd||0)-Number(i.paidUsd||0)>0.001);
    const payable=purchases.some(p=>Number(p.totalUsd||0)-Number(p.paidUsd||0)>0.001);
    const hasAlerts=lowStock||receivable||payable;
    dot.hidden=!hasAlerts;
    button.setAttribute('aria-label',hasAlerts?'Notificaciones: hay alertas operativas':'Notificaciones: sin alertas');
  }
  function renderView() {
    const meta = views[state.view] || views.dashboard;
    document.getElementById('breadcrumb-current').textContent = meta.title;
    document.getElementById('page-eyebrow').textContent = meta.eyebrow;
    document.querySelectorAll('.nav-item').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-view') === state.view);
    });
    const renderers = {
      dashboard: renderDashboard,
      products: renderProducts,
      inventory: renderInventory,
      orders: renderOrders,
      customers: renderCustomers,
      billing: renderBilling,
      receivables: renderReceivables,
      hr: renderHR,
      dgi: renderDgi,
      analytics: renderAnalytics,
      settings: renderSettings,
      purchases: renderPurchases,
      payables: renderPayables,
      suppliers: renderSuppliers,
      expenses: renderExpenses,
      cash: renderCash
    };
    if (!canViewERPView(state.view)) state.view = firstPermittedView() || "dashboard";
    root.innerHTML = (renderers[state.view] || renderDashboard)();
    applyPermissionNavigation();
    updateNotificationIndicator();
    document.querySelector('.page-context')?.classList.toggle('page-context-hr',state.view==='hr');
    document.getElementById('product-count').textContent = String(products.filter(function (product) { return product.active !== false; }).length).padStart(2, '0');
    hydrateProductImageSlots();
  }
  function goToView(view) {
    if (!views[view] || !canViewERPView(view)) return;
    state.view = view;
    state.query = '';
    state.filter = 'all';
    state.category = 'all';
    state.productStatus = 'active';
    state.inventoryMovementQuery = '';
    state.inventoryMovementType = 'all';
    state.inventoryMovementStartDate = '';
    state.inventoryMovementEndDate = '';
    state.inventoryMovementPage = 1;
    renderView();
    closeMobileMenu();
  }
  function toast(message) {
    const region = document.getElementById('toast-region');
    const item = document.createElement('div');
    item.className = 'toast';
    item.innerHTML = '<span class="toast-mark">✓</span><span>' + esc(message) + '</span>';
    region.appendChild(item);
    window.setTimeout(function () {
      item.remove();
    }, 3600);
  }
  function updateProductCostPreview() {
    const purchaseCost = Number(form.elements.purchaseCost.value || 0);
    const additionalCost = Number(form.elements.additionalCost.value || 0);
    const price = Number(form.elements.price.value || 0);
    const unitCost = purchaseCost + additionalCost;
    const profit = price - unitCost;
    const margin = price > 0 ? (profit / price) * 100 : null;
    document.getElementById('unit-cost-preview').textContent = money(unitCost);
    document.getElementById('unit-profit-preview').textContent = price > 0 ? money(profit) : '—';
    document.getElementById('gross-margin-preview').textContent = margin === null ? '—' : margin.toFixed(1) + '%';
    document.getElementById('unit-profit-preview').classList.toggle('negative-value', profit < 0 && price > 0);
    document.getElementById('gross-margin-preview').classList.toggle('negative-value', margin !== null && margin < 0);
  }
  function openProductModal(productId) {
    const product = productId == null ? null : products.find(function (item) { return String(item.id) === String(productId); });
    if (productId != null && !product) return;
    form.reset(); clearPendingProductImagePreviews(); const uploadStatus=document.getElementById('product-image-upload-status');if(uploadStatus)uploadStatus.textContent=''; form.dataset.editingId = product ? String(product.id) : '';
    const fields = ['name','brand','sku','category','concentration','gender','family','sizeMl','presentation','barcode','supplier','purchaseCost','additionalCost','price','wholesalePrice','stock','minStock','location','notes'];
    if (product) fields.forEach(function (field) { if (form.elements[field]) form.elements[field].value = product[field] == null ? '' : String(product[field]); });
    form.elements.stock.readOnly = Boolean(product);
    form.elements.stock.value = product ? String(product.stock) : (form.elements.stock.value || '');
    document.getElementById('modal-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('save-product').textContent = product ? 'Guardar cambios' : 'Guardar en Neon';
    document.querySelector('#product-dialog .modal-note').textContent = product
      ? 'Edición de ficha en Neon. Las existencias no se modifican aquí: registra entradas, salidas o ajustes desde Existencias.'
      : 'La ficha y las existencias iniciales se guardarán en Neon Development.';
    updateProductCostPreview();
    mountProductImageGallery(document.getElementById('product-image-gallery'),product||{images:[]});
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else toast('El formulario emergente no es compatible con este navegador.');
  }
  function openStockModal(productId) {
    const activeProducts = products.filter(function (product) { return product.active !== false; });
    if (!activeProducts.length) { toast('Primero activa o registra un producto para mover existencias.'); return; }
    stockForm.reset();
    const productSearch=stockForm.querySelector('[data-lookup="product"]');
    if(productSearch){productSearch.value='';productSearch.setCustomValidity('');}
    if(productId!=null&&productSearch)selectLookupValue(productSearch,productId);
    updateStockQuantityMode();
    if (typeof stockDialog.showModal === 'function') stockDialog.showModal();
  }
  function updateStockQuantityMode() {
    const type = stockForm.elements.type.value, quantity = stockForm.elements.quantity;
    document.getElementById('stock-quantity-label').textContent = type === 'adjustment' ? 'Stock físico contado (unidades)' : 'Cantidad (unidades)';
    quantity.min = type === 'adjustment' ? '0' : '1';
  }
  const fontLevels = [
    { value: 'normal', label: '100%' },
    { value: 'large', label: '110%' },
    { value: 'larger', label: '120%' }
  ];
  let fontLevelIndex = 1;
  function setFontLevel(index, persist) {
    fontLevelIndex = Math.max(0, Math.min(fontLevels.length - 1, index));
    const level = fontLevels[fontLevelIndex];
    document.body.setAttribute('data-font-scale', level.value);
    const label = document.getElementById('font-scale-label');
    if (label) label.textContent = level.label;
    const decrease = document.getElementById('font-decrease');
    const increase = document.getElementById('font-increase');
    if (decrease) decrease.disabled = fontLevelIndex === 0;
    if (increase) increase.disabled = fontLevelIndex === fontLevels.length - 1;
    if (persist) {
      try {
        window.localStorage.setItem('jbparfums-font-level', String(fontLevelIndex));
      } catch (error) {
        // Font controls still work for the current browser session.
      }
    }
  }
  function closeMobileMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('mobile-scrim').classList.remove('visible');
    document.body.classList.remove('mobile-menu-open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  }

  function setSidebarCollapsed(collapsed, persist) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const button = document.getElementById('sidebar-collapse');
    if (button) {
      const label = collapsed ? 'Expandir menú' : 'Contraer menú';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(collapsed));
      button.querySelector('[data-icon]').innerHTML = svg(collapsed ? 'expand' : 'collapse');
    }
    document.querySelectorAll('.nav-item').forEach(function (item) {
      const labelNode = item.querySelectorAll('span')[1];
      const label = labelNode ? labelNode.textContent.trim() : 'Sección';
      item.setAttribute('aria-label', label);
      item.setAttribute('title', collapsed ? label : '');
    });
    if (persist) {
      try {
        window.localStorage.setItem('jbparfums-sidebar-collapsed', collapsed ? '1' : '0');
      } catch (error) {
        // The menu remains usable when browser storage is unavailable.
      }
    }
  }

  function parseCatalogCSV(text) { return parseCatalogCSVModule(text, roundMoney); }
  function loadCatalogScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=Array.from(document.scripts).find(script=>script.src===src);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('No se pudo cargar el lector de archivos.')),{once:true});return;}
      const script=document.createElement('script');script.src=src;script.async=true;
      script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar el lector de archivos. Comprueba la conexión e inténtalo de nuevo.'));
      document.head.appendChild(script);
    });
  }
  async function readCatalogPDF(file, status) {
    const pdfUrl='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    await loadCatalogScript(pdfUrl,()=>Boolean(window.pdfjsLib));
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    if(pdf.numPages>10)throw new Error('El PDF supera el máximo de 10 páginas. Divide el documento e importa cada parte.');
    const textPages=[];
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      status('Leyendo página '+pageNumber+' de '+pdf.numPages+'…');
      const page=await pdf.getPage(pageNumber);
      const textContent=await page.getTextContent();
      const positionedItems=(textContent.items||[]).filter(item=>String(item.str||'').trim()).map(item=>({text:String(item.str||'').trim(),x:Number(item.transform?.[4]||0),y:Number(item.transform?.[5]||0),width:Number(item.width||0)})).sort((a,b)=>b.y-a.y||a.x-b.x);
      const textLines=[];
      for(const item of positionedItems){
        let line=textLines[textLines.length-1];
        if(!line||Math.abs(line.y-item.y)>2.5){line={y:item.y,items:[]};textLines.push(line);}
        line.items.push(item);
      }
      let pageText=textLines.sort((a,b)=>b.y-a.y).map(line=>{
        const items=line.items.sort((a,b)=>a.x-b.x);
        return items.map((item,index)=>index===0?item.text:((item.x-(items[index-1].x+items[index-1].width)>24)?'    ':' ')+item.text).join('');
      }).join('\n').trim();
      if(!pageText){
        status('PDF escaneado: aplicando OCR local a la página '+pageNumber+'…');
        await loadCatalogScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',()=>Boolean(window.Tesseract));
        const viewport=page.getViewport({scale:1.45});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        const context=canvas.getContext('2d');
        await page.render({canvasContext:context,viewport}).promise;
        const result=await window.Tesseract.recognize(canvas,'spa+eng',{logger:m=>{if(m.status==='recognizing text')status('OCR '+Math.round((m.progress||0)*100)+'% · página '+pageNumber);}});
        pageText=result.data.text||'';
        canvas.width=0;canvas.height=0;
      }
      textPages.push(pageText);
      page.cleanup();
    }
    await pdf.destroy();
    return textPages.join('\n');
  }
  async function readCatalogImage(file,status) {
    await loadCatalogScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',()=>Boolean(window.Tesseract));
    status('Reconociendo texto de la imagen localmente…');
    const result=await window.Tesseract.recognize(file,'spa+eng',{logger:m=>{if(m.status==='recognizing text')status('OCR '+Math.round((m.progress||0)*100)+'%');}});
    return result.data.text||'';
  }
  function openCatalogImport() {
    const dialog=document.createElement('dialog');
    dialog.className='modal';dialog.id='catalog-import-dialog';
    dialog.innerHTML='<form method="dialog" class="modal-card" style="width:min(1080px,96vw);max-height:90vh;overflow:auto"><div class="modal-heading"><div><span class="eyebrow">CATÁLOGO · IMPORTACIÓN</span><h2>Importar productos</h2></div><button type="button" class="icon-button modal-close" data-import-close aria-label="Cerrar">×</button></div><p class="modal-note">Admite CSV, PDF, PNG, JPG y JPEG. CSV conserva las columnas; PDF e imágenes usan lectura de texto y OCR local. Revisa y corrige los datos antes de guardarlos en Neon.</p><div class="form-grid"><label class="form-field full-field"><span>Seleccionar archivo</span><input id="catalog-import-file" type="file" accept=".csv,.pdf,.png,.jpg,.jpeg,text/csv,application/pdf,image/png,image/jpeg" required></label><label class="form-field full-field"><span>Importe detectado en PDF / imagen</span><select id="catalog-import-amount"><option value="none">No asignar automáticamente</option><option value="price">Asignar a precio de venta (USD)</option><option value="cost">Asignar a costo de compra (USD)</option></select><small class="form-helper">No se supondrá si una cifra detectada es costo o precio. En PDF e imágenes la detección es preliminar.</small></label></div><p id="catalog-import-status" class="form-helper" role="status">Selecciona un archivo para comenzar.</p><div id="catalog-import-preview" class="table-wrap" style="max-height:42vh;overflow:auto"></div><div class="modal-actions"><button type="button" class="button button-quiet" data-import-close>Cancelar</button><button type="button" class="button button-primary" id="catalog-import-save" disabled>Importar productos a Neon</button></div></form>';
    document.body.appendChild(dialog);
    let records=[];
    const statusNode=dialog.querySelector('#catalog-import-status');
    const previewNode=dialog.querySelector('#catalog-import-preview');
    const saveButton=dialog.querySelector('#catalog-import-save');
    const amountMode=dialog.querySelector('#catalog-import-amount');
    const fileInput=dialog.querySelector('#catalog-import-file');
    const status=message=>{statusNode.textContent=message;};
    const renderPreview=()=>{
      if(!records.length){previewNode.innerHTML='';saveButton.disabled=true;return;}
      const rows=records.map((record,index)=>'<tr><td><input class="filter-select" style="min-width:120px" data-import-index="'+index+'" data-import-field="sku" value="'+esc(record.sku)+'" aria-label="SKU"></td><td><input class="filter-select" style="min-width:180px" data-import-index="'+index+'" data-import-field="name" value="'+esc(record.name)+'" aria-label="Producto"></td><td><input class="filter-select" style="min-width:110px" data-import-index="'+index+'" data-import-field="brand" value="'+esc(record.brand||'')+'" aria-label="Marca"></td><td><input class="filter-select" style="min-width:110px" data-import-index="'+index+'" data-import-field="price_usd" type="number" min="0" step="0.01" value="'+Number(record.price_usd||0)+'" aria-label="Precio"></td><td><input class="filter-select" style="min-width:110px" data-import-index="'+index+'" data-import-field="purchase_cost_usd" type="number" min="0" step="0.01" value="'+Number(record.purchase_cost_usd||0)+'" aria-label="Costo"></td><td><input class="filter-select" style="min-width:75px" data-import-index="'+index+'" data-import-field="stock" type="number" min="0" step="1" value="'+Number(record.stock||0)+'" aria-label="Stock"></td><td><button type="button" class="table-action table-action-danger" data-import-remove="'+index+'" aria-label="Quitar fila">×</button></td></tr>').join('');
      previewNode.innerHTML='<table class="data-table"><thead><tr><th>SKU</th><th>PRODUCTO</th><th>MARCA</th><th>PRECIO USD</th><th>COSTO USD</th><th>STOCK</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
      saveButton.disabled=false;saveButton.textContent='Importar '+records.length+' productos a Neon';
    };
    fileInput.addEventListener('change',async()=>{
      const file=fileInput.files?.[0];records=[];renderPreview();saveButton.disabled=true;
      if(!file)return;
      if(file.size>10*1024*1024){status('El archivo supera el límite de 10 MB.');return;}
      const extension=(file.name.split('.').pop()||'').toLowerCase();
      try{
        status('Analizando '+file.name+'…');
        if(extension==='csv'||file.type==='text/csv'){
          records=parseCatalogCSV(await file.text());
        }else if(extension==='pdf'||file.type==='application/pdf'){
          records=parseCatalogTextRows(await readCatalogPDF(file,status));
        }else if(['png','jpg','jpeg'].includes(extension)||['image/png','image/jpeg'].includes(file.type)){
          records=parseCatalogTextRows(await readCatalogImage(file,status));
        }else throw new Error('Formato no admitido. Selecciona CSV, PDF, PNG, JPG o JPEG.');
        status('Se detectaron '+records.length+' filas. Revisa o corrige los campos antes de importar.');
        renderPreview();
      }catch(error){status(error?.message||'No se pudo leer el archivo.');}
    });
    amountMode.addEventListener('change',()=>{
      records.forEach(record=>{
        if(record._detected_amount==null)return;
        if(amountMode.value==='price')record.price_usd=record._detected_amount;
        else if(amountMode.value==='cost'){record.purchase_cost_usd=record._detected_amount;record.unit_cost_usd=record._detected_amount;}
        else {record.price_usd=0;record.purchase_cost_usd=0;record.unit_cost_usd=0;}
      });
      renderPreview();
    });
    previewNode.addEventListener('input',event=>{
      const input=event.target.closest('[data-import-index][data-import-field]');if(!input)return;
      const record=records[Number(input.dataset.importIndex)];if(!record)return;
      const field=input.dataset.importField;
      record[field]=['price_usd','purchase_cost_usd','stock'].includes(field)?catalogNumber(input.value):input.value.trim();
      if(field==='purchase_cost_usd')record.unit_cost_usd=record.purchase_cost_usd;
    });
    previewNode.addEventListener('click',event=>{
      const remove=event.target.closest('[data-import-remove]');if(!remove)return;
      records.splice(Number(remove.dataset.importRemove),1);renderPreview();
    });
    dialog.addEventListener('click',event=>{if(event.target.closest('[data-import-close]'))dialog.close();});
    dialog.addEventListener('close',()=>dialog.remove());
    saveButton.addEventListener('click',async()=>{
      if(!records.length)return;
      const seen=new Set();
      for(const record of records){
        record.sku=String(record.sku||'').trim().toUpperCase();
        record.name=String(record.name||'').trim();
        if(!record.sku||!record.name){status('Todos los productos necesitan SKU y nombre.');return;}
        if(seen.has(record.sku.toLowerCase())){status('Hay SKU repetidos en la vista previa: '+record.sku+'. Corrígelos antes de continuar.');return;}
        seen.add(record.sku.toLowerCase());
        if(!Number.isInteger(Number(record.stock))||Number(record.stock)<0){status('El stock debe ser un entero igual o mayor que cero.');return;}
        if(Number(record.price_usd)<0||Number(record.purchase_cost_usd)<0){status('Los precios y costos no pueden ser negativos.');return;}
      }
      saveButton.disabled=true;status('Guardando productos, existencias iniciales y kardex en Neon…');
      try{
        const payload=records.map(record=>{
          const clean={...record};delete clean._detected_amount;
          return clean;
        });
        const result=await erpApi('products/import',{method:'POST',body:JSON.stringify({records:payload,source_file:fileInput.files?.[0]?.name||''})});
        await loadERPFromNeon(true);dialog.close();renderView();
        toast((result.imported||payload.length)+' productos importados. Se registraron existencias iniciales en el kardex.');
      }catch(error){status(error?.message||'No se pudo importar el catálogo.');saveButton.disabled=false;}
    });
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }

  document.addEventListener('click', async function (event) {
    const viewButton = event.target.closest('[data-view], [data-view-link]');
    if (viewButton) {
      goToView(viewButton.getAttribute('data-view') || viewButton.getAttribute('data-view-link'));
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) {
      const name = action.getAttribute('data-action');
      if (name === 'reload-erp') {
        action.disabled=true;
        loadERPFromNeon(true).then(()=>renderView()).catch(error=>toast(error?.message||'No se pudo cargar Neon.')).finally(()=>{action.disabled=false;});
      } else if (name === 'import-products') openCatalogImport();
      else if (name === 'new-product') openProductModal();
      else if (name === 'edit-product') openProductModal(action.getAttribute('data-id'));
      else if (name === 'preview-product') showProductDetails(action.getAttribute('data-id'));
      else if (name === 'edit-from-detail') { const productId = action.getAttribute('data-id'); detailDialog.close(); openProductModal(productId); }
      else if (name === 'toggle-product') {
        const product=products.find(item=>String(item.id)===action.getAttribute('data-id'));
        if(!product)return;
        const active=product.active===false;
        if(!active&&!window.confirm('¿Desactivar '+product.name+'? Se conservarán sus ventas y movimientos históricos.'))return;
        action.disabled=true;
        try{
          await erpApi('products/'+encodeURIComponent(product.id),{method:'PATCH',body:JSON.stringify({active})});
          await loadERPFromNeon(true);
          renderView();
          toast(active?'Producto reactivado.':'Producto desactivado; su historial se conserva.');
        }catch(error){toast(error?.message||'No se pudo actualizar el producto.');}
        finally{action.disabled=false;}
      }
      else if (name === 'delete-product') {
        const product=products.find(item=>String(item.id)===action.getAttribute('data-id'));
        if(!product)return;
        if(!window.confirm('¿Desactivar '+product.name+'? Los registros históricos se conservarán.'))return;
        action.disabled=true;
        try{
          await erpApi('products/'+encodeURIComponent(product.id),{method:'DELETE'});
          await loadERPFromNeon(true);
          renderView();
          toast('Producto desactivado y conservado en el historial.');
        }catch(error){toast(error?.message||'No se pudo desactivar el producto.');}
        finally{action.disabled=false;}
      }
      else if (name === 'inventory-page') {
        const step = action.getAttribute('data-page') === 'previous' ? -1 : 1;
        state.inventoryMovementPage = Math.max(1, state.inventoryMovementPage + step);
        refreshInventoryMovementResults();
      }
      else if (name === 'clear-inventory-product-filters') {
        state.inventoryProductQuery = '';
        state.inventoryProductCategory = 'all';
        state.inventoryProductStock = 'all';
        const search = document.getElementById('inventory-product-search');
        const category = document.getElementById('inventory-product-category');
        const stock = document.getElementById('inventory-product-stock');
        if (search) search.value = '';
        if (category) category.value = 'all';
        if (stock) stock.value = 'all';
        renderInventoryProductRows();
      }
      else if (name === 'clear-inventory-filters') {
        state.inventoryMovementQuery = '';
        state.inventoryMovementType = 'all';
        state.inventoryMovementStartDate = '';
        state.inventoryMovementEndDate = '';
        state.inventoryMovementPage = 1;
        const search = document.getElementById('inventory-movement-search');
        const type = document.getElementById('inventory-movement-type');
        const startDate = document.getElementById('inventory-movement-start');
        const endDate = document.getElementById('inventory-movement-end');
        if (search) search.value = '';
        if (type) type.value = 'all';
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
        refreshInventoryMovementResults();
      }
      else if (name === 'stock-new') openStockModal();
      else if (name === 'stock-product') openStockModal(action.getAttribute('data-id'));
      else if (name === 'export-inventory') renderInventoryCsv();
      else if (name === 'export') exportCurrentView();
      else if (name === 'billing-preview') openBusinessDialog('invoice');
      else if (name === 'hr-preview') { goToView('hr'); loadHRFromAPI(true); openBusinessDialog('employee'); }
      else if (name === 'preview-order') showOrderDetails(action.getAttribute('data-id'));
      else if (name === 'save-order-status') saveOrderStatus();
      else if (name === 'reload-hr') loadHRFromAPI(true);
      return;
    }
    if (event.target.closest('#font-decrease')) {
      setFontLevel(fontLevelIndex - 1, true);
      return;
    }
    if (event.target.closest('#font-increase')) {
      setFontLevel(fontLevelIndex + 1, true);
      return;
    }
    if (event.target.closest('#sidebar-collapse')) {
      setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'), true);
      return;
    }
    if (event.target.closest('#menu-toggle')) {
      const sidebar = document.getElementById('sidebar');
      const open = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open', open);
      document.body.classList.toggle('mobile-menu-open', open);
      document.getElementById('mobile-scrim').classList.toggle('visible', open);
      document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
    }
    if (event.target.closest('#mobile-scrim')) closeMobileMenu();
    if (event.target.closest('#modal-close') || event.target.closest('#cancel-product')) { dialog.close(); form.dataset.editingId = ''; form.elements.stock.readOnly = false; }
    if (event.target.closest('#stock-modal-close') || event.target.closest('#stock-cancel')) stockDialog.close();
    if (event.target.closest('#detail-close') || event.target.closest('#detail-cancel')) detailDialog.close();
    if (event.target.closest('#order-detail-close') || event.target.closest('#order-detail-cancel')) orderDialog.close();
    if (event.target.closest('.notification-button')) {
      const alerts=[];
      const lowStock=products.filter(p=>p.active!==false&&needsRestock(p)).length;
      const receivable=invoices.filter(i=>Number(i.totalUsd||0)-Number(i.paidUsd||0)>0.001).length;
      const payable=purchases.filter(p=>Number(p.totalUsd||0)-Number(p.paidUsd||0)>0.001).length;
      if(lowStock)alerts.push(lowStock+' productos requieren reposición');
      if(receivable)alerts.push(receivable+' facturas tienen saldo pendiente');
      if(payable)alerts.push(payable+' compras tienen saldo con proveedor');
      toast(alerts.length?alerts.join(' · '):'No hay alertas operativas pendientes.');
    }
  });
  document.addEventListener('input', function (event) {
    if (event.target && event.target.id === 'view-search') {
      state.query = event.target.value;
      const body = document.getElementById('product-table-body');
      if (body) body.innerHTML = productTable(filteredProducts());
    }
    else if (event.target && event.target.id === 'inventory-movement-search') {
      state.inventoryMovementQuery = event.target.value;
      state.inventoryMovementPage = 1;
      refreshInventoryMovementResults();
    }
    else if (event.target && event.target.id === 'inventory-product-search') {
      state.inventoryProductQuery = event.target.value;
      renderInventoryProductRows();
    }
  });
  document.addEventListener('change', function (event) {
    if (event.target && ['inventory-product-category','inventory-product-stock'].includes(event.target.id)) {
      if (event.target.id === 'inventory-product-category') state.inventoryProductCategory = event.target.value;
      if (event.target.id === 'inventory-product-stock') state.inventoryProductStock = event.target.value;
      renderInventoryProductRows();
      return;
    }
    if (event.target && ['inventory-movement-type','inventory-movement-start','inventory-movement-end'].includes(event.target.id)) {
      if (event.target.id === 'inventory-movement-type') state.inventoryMovementType = event.target.value;
      if (event.target.id === 'inventory-movement-start') state.inventoryMovementStartDate = event.target.value;
      if (event.target.id === 'inventory-movement-end') state.inventoryMovementEndDate = event.target.value;
      state.inventoryMovementPage = 1;
      refreshInventoryMovementResults();
      return;
    }
    if (event.target && event.target.id === 'stock-filter') {
      state.filter = event.target.value;
      const body = document.getElementById('product-table-body');
      if (body) body.innerHTML = productTable(filteredProducts());
    }
    if (event.target && event.target.id === 'category-filter') {
      state.category = event.target.value;
      const body = document.getElementById('product-table-body');
      if (body) body.innerHTML = productTable(filteredProducts());
    }
    if (event.target && event.target.id === 'product-status-filter') {
      state.productStatus = event.target.value;
      const body = document.getElementById('product-table-body');
      if (body) body.innerHTML = productTable(filteredProducts());
    }
    if (event.target && event.target.id === 'stock-movement-type') updateStockQuantityMode();
  });
  form.addEventListener('input', updateProductCostPreview);
  form.elements.productImages?.addEventListener('change',()=>{
    const files=Array.from(form.elements.productImages.files||[]);
    const existing=products.find(product=>String(product.id)===String(form.dataset.editingId||''));
    if(files.length+Number(existing?.images?.length||0)>3){
      form.elements.productImages.value='';
      toast('Cada producto puede conservar hasta tres fotografías en total.');
      renderPendingProductImagePreviews([]);
      return;
    }
    if(files.some(file=>file.size>PRODUCT_IMAGE_MAX_INPUT_BYTES||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))){
      form.elements.productImages.value='';
      toast('Usa JPG, PNG, WebP o AVIF de máximo 8 MB antes de optimizar.');
      renderPendingProductImagePreviews([]);
      return;
    }
    renderPendingProductImagePreviews(files);
    const status=document.getElementById('product-image-upload-status');
    if(status)status.textContent=files.length?files.length+' fotografía(s) listas. Se optimizarán y cargarán hasta 3 simultáneamente al guardar.':'';
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMobileMenu();
  });
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if(!form.reportValidity())return;
    const button=document.getElementById('save-product');
    if(button){button.disabled=true;button.textContent='Guardando…';}
    const data=new FormData(form),value=key=>String(data.get(key)||'').trim(),number=key=>Number(data.get(key)||0);
    const editingId=form.dataset.editingId;
    const existing=editingId?products.find(product=>String(product.id)===editingId):null;
    const name=value('name'),price=number('price'),stock=number('stock'),minStock=number('minStock');
    const purchaseCost=number('purchaseCost'),additionalCost=number('additionalCost');
    const sku=value('sku')||(existing?existing.sku:makeSku());
    const wholesalePrice=number('wholesalePrice');
    const files=Array.from(form.elements.productImages?.files||[]);
    const invalid=[price,minStock,purchaseCost,additionalCost,wholesalePrice].some(n=>!Number.isFinite(n)||n<0);
    if(!name||price<=0||!Number.isInteger(minStock)||invalid||(!existing&&(!Number.isInteger(stock)||stock<0))){
      toast('Revisa nombre, precio, costos y existencias iniciales.');if(button)button.disabled=false;return;
    }
    if(files.length+Number(existing?.images?.length||0)>3){toast('Cada producto puede conservar hasta tres fotografías. Elimina una antes de agregar otra.');if(button)button.disabled=false;return;}
    if(files.some(file=>file.size>PRODUCT_IMAGE_MAX_INPUT_BYTES||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))){
      toast('Cada imagen debe ser JPG, PNG, WebP o AVIF y pesar máximo 8 MB antes de optimizar.');if(button)button.disabled=false;return;
    }
    if(products.some(p=>String(p.sku).toLowerCase()===sku.toLowerCase()&&(!existing||String(p.id)!==String(existing.id)))){
      toast('Ese SKU ya existe. Utiliza un código diferente.');form.elements.sku.focus();if(button)button.disabled=false;return;
    }
    const unitCost=roundMoney(purchaseCost+additionalCost);
    const payload={
      name,sku,brand:value('brand')||null,category:value('category')||'Perfumería',
      concentration:value('concentration')||null,gender:value('gender')||null,family:value('family')||null,
      size_ml:number('sizeMl')||null,presentation:value('presentation')||null,
      purchase_cost_usd:purchaseCost,additional_cost_usd:additionalCost,unit_cost_usd:unitCost,
      price_usd:price,min_stock:minStock,location:value('location')||null,active:existing?existing.active!==false:true,
      barcode:value('barcode')||null,supplier_name:value('supplier')||null,
      wholesale_price_usd:wholesalePrice||null,tone:existing?.tone||'art-violet',notes:value('notes')||null
    };
    let savedProductId=existing?.id||null;
    let saved=false;
    const imageErrors=[];
    const failedImageFiles=[];
    try{
      if(existing){
        const result=await erpApi('products/'+encodeURIComponent(existing.id),{method:'PATCH',body:JSON.stringify(payload)});
        savedProductId=result.record?.id||existing.id;
      }else{
        payload.stock=stock;
        const result=await erpApi('products',{method:'POST',body:JSON.stringify(payload)});
        savedProductId=result.record?.id||null;
      }
      saved=true;
      if(files.length&&!savedProductId)imageErrors.push('No se pudo obtener el identificador del producto para adjuntar sus imágenes.');
      else if(files.length){
        const status=document.getElementById('product-image-upload-status');
        if(status)status.textContent='Optimizando y subiendo '+files.length+' fotografía(s), máximo 3 simultáneas…';
        await runWithConcurrency(files,PRODUCT_IMAGE_UPLOAD_CONCURRENCY,async(file,index)=>{
          updatePendingProductImageProgress(index,'Optimizando…',0);
          try{
            const asset=await uploadProductAsset(savedProductId,file,percent=>updatePendingProductImageProgress(index,'Subiendo · '+percent+'%',percent));
            updatePendingProductImageProgress(index,'Subida completada · '+Math.round(Number(asset?.size||file.size)/1024)+' KB',100);
          }catch(error){
            imageErrors.push(file.name+': '+(error?.message||'falló la carga'));
            failedImageFiles.push(file);
            updatePendingProductImageProgress(index,'Error · '+(error?.message||'falló la carga'),0);
          }
        });
        if(status)status.textContent=imageErrors.length
          ?imageErrors.length+' fotografía(s) no se pudieron subir. Revisa los errores antes de volver a intentarlo.'
          :'Todas las fotografías se optimizaron y subieron correctamente.';
      }
      await loadERPFromNeon(true);
      if(imageErrors.length&&savedProductId){
        form.dataset.editingId=String(savedProductId);form.elements.stock.readOnly=true;
        const retryData=new DataTransfer();failedImageFiles.forEach(file=>retryData.items.add(file));
        form.elements.productImages.files=retryData.files;
        renderPendingProductImagePreviews(failedImageFiles);
        const uploadStatus=document.getElementById('product-image-upload-status');
        if(uploadStatus)uploadStatus.textContent=imageErrors.length+' fotografía(s) fallaron. El producto ya está guardado; las imágenes pendientes permanecen en el formulario para reintentarlas.';
        if(button){button.disabled=false;button.textContent='Reintentar fotografías y guardar cambios';}
        toast('Producto guardado. '+imageErrors.length+' imagen(es) pendientes; puedes reintentarlas sin duplicar el producto.');
        return;
      }
      form.reset();form.dataset.editingId='';form.elements.stock.readOnly=false;
      clearPendingProductImagePreviews();const uploadStatus=document.getElementById('product-image-upload-status');if(uploadStatus)uploadStatus.textContent='';
      updateProductCostPreview();dialog.close();
      if(existing){renderView();toast('Producto y ficha actualizados en Neon.');}
      else{goToView('products');toast('Producto y fotografías guardados en Neon y R2.');}
    }catch(error){
      if(saved){
        try{await loadERPFromNeon(true);}catch{}
        form.reset();form.dataset.editingId='';form.elements.stock.readOnly=false;dialog.close();renderView();
        toast('Producto guardado; hubo un problema al recargar los datos: '+(error?.message||'error de conexión.'));
      }else toast(error?.message||'No se pudo guardar el producto.');
    }finally{
      if(button){button.disabled=false;button.textContent=existing?'Guardar cambios':'Guardar en Neon';}
    }
  });
  function makeSku() {
    let index=1;
    while (products.some(function (product) { return String(product.sku).toLowerCase() === ('jbp-' + String(index).padStart(3,'0')).toLowerCase(); })) index+=1;
    return 'JBP-' + String(index).padStart(3,'0');
  }
  stockForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if(!stockForm.reportValidity())return;
    const data=new FormData(stockForm);
    const product=products.find(item=>String(item.id)===String(data.get('productId')));
    const type=String(data.get('type')||''),quantity=Number(data.get('quantity')),note=String(data.get('note')||'').trim();
    if(!product||product.active===false||!Number.isInteger(quantity)||quantity<0||(type!=='adjustment'&&quantity===0)){
      toast('Selecciona un producto activo y una cantidad válida.');return;
    }
    const movementType=type==='entry'?'Entrada':(type==='exit'?'Salida':'Ajuste');
    if(type==='exit'&&quantity>Number(product.stock||0)){toast('Stock insuficiente. La salida supera las existencias actuales.');return;}
    if(type==='adjustment'&&quantity===Number(product.stock||0)){toast('El ajuste coincide con el stock actual; no se registró movimiento.');return;}
    const button=stockForm.querySelector('[type="submit"]');
    if(button){button.disabled=true;button.textContent='Registrando…';}
    try{
      await erpApi('inventory-movements',{method:'POST',body:JSON.stringify({
        product_id:product.id,movement_type:movementType,quantity,note,reference_type:'manual',reference_id:null
      })});
      await loadERPFromNeon(true);
      stockForm.reset();stockDialog.close();renderView();
      toast(movementType+' registrado en Neon: '+product.name+'.');
    }catch(error){toast(error?.message||'No se pudo registrar el movimiento.');}
    finally{if(button){button.disabled=false;button.textContent='Registrar movimiento';}}
  });
  stockForm.elements.type.addEventListener('change',updateStockQuantityMode);
  businessForm.addEventListener('change',function(event){
    if(event.target.name==='currency')refreshCashAccountOptions(businessForm,event.target.value);
    if(businessForm.dataset.recordType==='payroll-item'&&event.target.name==='employeeId'){
      const selected=event.target.selectedOptions?.[0];
      const salary=businessForm.querySelector('[name="baseSalaryNio"]');
      if(salary&&selected){salary.value=selected.getAttribute('data-salary')||'0';}
      return;
    }
    if(businessForm.dataset.recordType!=='invoice')return;
    if(event.target.name==='saleSource')refreshInvoiceSourceUI();
    if(event.target.name==='customerType')applyInvoiceCustomerPricing();
    if(event.target.name==='currency'){
      const nextCurrency=event.target.value==='NIO'?'NIO':'USD';
      const previousCurrency=businessForm.dataset.invoiceCurrency||nextCurrency;
      const previousRate=Number(businessForm.dataset.invoiceReceivedRate||exchangeRate);
      const received=businessForm.querySelector('[name="amountReceived"]');
      if(received&&previousCurrency!==nextCurrency){
        const previousAmount=Number(received.value||0);
        const amountUsd=previousCurrency==='NIO'?previousAmount/(previousRate>0?previousRate:exchangeRate):previousAmount;
        received.value=String(nextCurrency==='NIO'?roundMoney(amountUsd*exchangeRate):roundMoney(amountUsd));
      }
      businessForm.dataset.invoiceCurrency=nextCurrency;
      businessForm.dataset.invoiceReceivedRate=String(exchangeRate);
    }
    if(['currency','customerName','customerType','discountUsd','deliveryFeeUsd','amountReceived','paymentMethod'].includes(event.target.name))updateInvoicePreview();
  });
  businessForm.addEventListener('input',function(event){
    if(businessForm.dataset.recordType!=='invoice')return;
    const quantity=event.target.getAttribute('data-invoice-quantity'),price=event.target.getAttribute('data-invoice-price');
    if(quantity!==null){invoiceDraftItems[Number(quantity)].quantity=Number(event.target.value);updateInvoicePreview();return;}
    if(price!==null){invoiceDraftItems[Number(price)].unitPriceUsd=Number(event.target.value);updateInvoicePreview();return;}
    if(event.target.name==='amountReceived')businessForm.dataset.invoiceReceivedEdited='1';
    if(['customerName','customerPhone','discountUsd','deliveryFeeUsd','amountReceived'].includes(event.target.name))updateInvoicePreview();
    if(event.target.name==='customerName'){
      const match=customers.find(item=>String(item.name||'').toLocaleLowerCase('es')===event.target.value.trim().toLocaleLowerCase('es'));
      if(match){const phone=businessForm.querySelector('[name="customerPhone"]');const type=businessForm.querySelector('[name="customerType"]');if(phone&&!phone.value)phone.value=match.contact||'';if(type&&type.value!==(match.customerType||'particular')){type.value=match.customerType||'particular';applyInvoiceCustomerPricing();}}
    }
  });
  businessForm.addEventListener('submit',saveBusinessRecord);
  document.addEventListener('focusin',function(event){const input=event.target.closest('[data-lookup]');if(input)renderLookupResults(input);});
  document.addEventListener('input',function(event){const input=event.target.closest('[data-lookup]');if(!input)return;const hidden=input.closest('[data-search-field]').querySelector('input[type="hidden"]');hidden.value='';input.setCustomValidity(input.value.trim()?'Selecciona un resultado de la lista.':'');renderLookupResults(input);if(input.dataset.lookup==='order'&&businessForm.dataset.recordType==='invoice')updateInvoicePreview();});
  document.addEventListener('click',function(event){
    const option=event.target.closest('[data-lookup-select]');
    if(option){chooseLookupOption(option.closest('[data-search-field]'),option.dataset.value,option.dataset.label);return;}
    if(!event.target.closest('[data-search-field]'))document.querySelectorAll('[data-search-field]').forEach(closeLookupResults);
  });
  document.addEventListener('keydown',function(event){
    const input=event.target.closest('[data-lookup]');
    if(!input)return;
    if(event.key==='Escape'){closeLookupResults(input.closest('[data-search-field]'));return;}
    if(event.key==='Enter'){const first=input.closest('[data-search-field]').querySelector('[data-lookup-select]');if(first){event.preventDefault();first.click();}}
  });
  document.addEventListener('click',function(event){
    const action=event.target.closest('[data-action]');
    if(!action){if(event.target.closest('#business-close')||event.target.closest('#business-cancel'))businessDialog.close();return;}
    const name=action.getAttribute('data-action'),types={'new-customer':'customer','new-supplier':'supplier','new-order':'order','new-purchase':'purchase','new-expense':'expense','new-cash':'cash','new-cash-account':'cash-account','new-invoice':'invoice','new-employee':'employee','new-attendance':'attendance','new-leave':'leave','new-payroll-period':'payroll-period','new-payroll-item':'payroll-item'};
    if(name==='hr-tab'){
      const tab=action.getAttribute('data-tab');
      if(['employees','attendance','leaves','payroll'].includes(tab)){state.hrTab=tab;renderView();}
    } else if(types[name])openBusinessDialog(types[name]);
    else if(name==='go-hr-employees'){state.hrTab='employees';renderView();}
    else if(name==='export-dgi-book')exportDgiBook();
    else if(name==='reload-dgi-documents'){dgiDocumentsLoadAttempted=false;dgiDocumentsLoaded=false;loadDgiSupportDocuments(true);}
    else if(name==='download-dgi-document')downloadDgiDocument(action.getAttribute('data-id'),action);
    else if(name==='pay-payroll')openBusinessDialog('payroll-payment',action.getAttribute('data-id'));
    else if(name==='remove-product-image'){
      const productId=action.getAttribute('data-product-id'),key=action.getAttribute('data-key');
      const product=products.find(item=>String(item.id)===String(productId));
      if(!product||!key)return;
      if(!window.confirm('¿Eliminar esta fotografía del almacenamiento privado?'))return;
      action.disabled=true;
      deleteProductAsset(productId,key)
        .then(()=>loadERPFromNeon(true))
        .then(()=>{
          const updated=products.find(item=>String(item.id)===String(productId));
          if(detailDialog.open)mountProductImageGallery(document.getElementById('product-detail-images'),updated);
          if(dialog.open)mountProductImageGallery(document.getElementById('product-image-gallery'),updated);
          renderView();toast('Imagen eliminada de R2 y desvinculada del producto.');
        })
        .catch(error=>toast(error?.message||'No se pudo eliminar la imagen.'))
        .finally(()=>{action.disabled=false;});
    }
    else if(name==='approve-payroll'){
      const id=action.getAttribute('data-id');
      if(!window.confirm('¿Aprobar el período? Al aprobarlo ya no se podrán agregar partidas.'))return;
      action.disabled=true;
      erpApi('payroll-periods/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status:'Aprobada'})})
        .then(()=>loadERPFromNeon(true)).then(()=>{renderView();toast('Período de nómina aprobado. Ya puede pagarse.');})
        .catch(error=>toast(error?.message||'No se pudo aprobar el período.'))
        .finally(()=>{action.disabled=false;});
    }
    else if(name==='approve-leave'||name==='reject-leave'){
      const id=action.getAttribute('data-id'),status=name==='approve-leave'?'Aprobado':'Rechazado';
      if(!window.confirm(status==='Aprobado'?'¿Aprobar esta solicitud?':'¿Rechazar esta solicitud?'))return;
      action.disabled=true;
      erpApi('hr_leave_requests/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})})
        .then(()=>loadERPFromNeon(true)).then(()=>{renderView();toast('Solicitud '+status.toLowerCase()+'.');})
        .catch(error=>toast(error?.message||'No se pudo revisar la solicitud.'))
        .finally(()=>{action.disabled=false;});
    }
    else if(name==='new-payment')openBusinessDialog('payment',action.getAttribute('data-id'));
    else if(name==='new-purchase-payment')openBusinessDialog('purchase-payment',action.getAttribute('data-id'));
    else if(name==='add-invoice-product'){
      if(businessForm.dataset.recordType!=='invoice')return;
      const hidden=businessForm.querySelector('[name="draftProductId"]'),product=products.find(p=>String(p.id)===String(hidden?.value||''));
      if(!product){toast('Busca y selecciona un perfume antes de agregarlo.');return;}
      const existing=invoiceDraftItems.find(item=>String(item.productId)===String(product.id));
      if(existing)existing.quantity=Number(existing.quantity||0)+1;
      else invoiceDraftItems.push({productId:product.id,name:product.name,sku:product.sku||'',barcode:product.barcode||'',quantity:1,unitPriceUsd:invoiceSuggestedPrice(product)});
      const visible=businessForm.querySelector('[data-lookup="product"]');if(visible){visible.value='';visible.setCustomValidity('');}
      if(hidden)hidden.value='';renderInvoiceCart();
    }else if(name==='remove-invoice-product'){
      const index=Number(action.getAttribute('data-index'));if(Number.isInteger(index)&&index>=0){invoiceDraftItems.splice(index,1);renderInvoiceCart();}
    }else if(name==='view-invoice')showInvoicePreview(action.getAttribute('data-id'));
    else if(name==='new-invoice-after-preview'){
      const preview=document.getElementById('invoice-preview-dialog');if(preview.open)preview.close();
      openBusinessDialog('invoice');
    }else if(name==='print-invoice')window.print();
    else if(name==='close-invoice-preview')document.getElementById('invoice-preview-dialog').close();
  });
  document.addEventListener('submit',function(event){
    if(event.target?.id==='dgi-settings-form'){event.preventDefault();saveDgiSettings(event);}
    else if(event.target?.id==='dgi-document-form'){event.preventDefault();uploadDgiDocument(event);}
  });
  document.addEventListener('submit',async function(event){
    if(!event.target||event.target.id!=='exchange-rate-form')return;
    event.preventDefault();
    const next=Number(new FormData(event.target).get('exchangeRate'));
    if(!Number.isFinite(next)||next<=0||next>100000){toast('Introduce un tipo de cambio válido.');return;}
    const button=event.target.querySelector('[type="submit"]');
    if(button){button.disabled=true;button.textContent='Guardando…';}
    try{
      await erpApi('settings',{method:'PATCH',body:JSON.stringify({setting_key:'default_exchange_rate',setting_value:{value:Number(next.toFixed(4))}})});
      exchangeRate=Number(next.toFixed(4));
      await loadERPFromNeon(true);
      renderView();
      toast('Tipo de cambio actualizado. Las operaciones anteriores conservan su tasa.');
    }catch(error){toast(error?.message||'No se pudo guardar el tipo de cambio.');}
    finally{if(button){button.disabled=false;button.textContent='Guardar tipo de cambio';}}
  });
  setDate();
  let initiallyCollapsed = false;
  try {
    initiallyCollapsed = window.localStorage.getItem('jbparfums-sidebar-collapsed') === '1';
  } catch (error) {
    initiallyCollapsed = false;
  }
  setSidebarCollapsed(initiallyCollapsed, false);
  let storedFontLevel = 1;
  try {
    const savedFontLevel = window.localStorage.getItem('jbparfums-font-level');
    const storedValue = savedFontLevel === null ? NaN : Number(savedFontLevel);
    if (Number.isInteger(storedValue) && storedValue >= 0 && storedValue < fontLevels.length) storedFontLevel = storedValue;
  } catch (error) {
    storedFontLevel = 1;
  }
  setFontLevel(storedFontLevel, false);
  root.innerHTML=heading(views.dashboard,'')+'<div class="notice-panel"><span>'+svg('clock')+'</span><div><strong>Conectando con Neon Development</strong><p>Consultando los registros operativos y permisos de esta cuenta…</p></div></div>';
  loadERPFromNeon(true).then(function(){
    renderView();
  }).catch(function(error){
    root.innerHTML=heading(views.dashboard,'')+'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>No se pudo cargar la información del ERP</strong><p>'+esc(error?.message||'Comprueba tu sesión o la conexión con la base de datos.')+'</p><button class="button button-quiet button-small" data-action="reload-erp">Reintentar conexión</button></div></div>';
  });
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}());
