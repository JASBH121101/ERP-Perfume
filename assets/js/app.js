import { parseCatalogCSV as parseCatalogCSVModule, parseCatalogTextRows } from './catalog-import.mjs';
import { calculateFinancialSnapshot, calculatePayablesSnapshot } from './financial-snapshot.mjs';
import { resolveReportingPeriod, isWithinReportingPeriod } from './reporting-periods.mjs';
import { profileHasPermission } from './permission-utils.mjs';
import { downloadExport, openPrintExport } from './export-tools.mjs';
import { calculateTenure, calculateVacationBalance, calculateAguinaldoEstimate, calculateInss } from './hr-calculations.mjs';
import { getContractReminders } from './hr-contract-reminders.mjs';

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

  // JB PARFUMS · accessible drag-and-drop for the existing file inputs.
  // Dropped files are routed through the same native input/change handlers,
  // so the existing type, size, count and upload validations remain authoritative.
  function fileDropContext(target) {
    const field = target && target.closest ? target.closest('.form-field') : null;
    const input = field && field.querySelector ? field.querySelector('input[type="file"]') : null;
    return input ? { field, input } : null;
  }
  document.addEventListener('dragenter', function (event) {
    const context = fileDropContext(event.target);
    if (!context) return;
    event.preventDefault();
    context.field.classList.add('is-file-dragover');
  });
  document.addEventListener('dragover', function (event) {
    const context = fileDropContext(event.target);
    if (!context) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    context.field.classList.add('is-file-dragover');
  });
  document.addEventListener('dragleave', function (event) {
    const context = fileDropContext(event.target);
    if (!context) return;
    if (event.relatedTarget && context.field.contains(event.relatedTarget)) return;
    context.field.classList.remove('is-file-dragover');
  });
  document.addEventListener('drop', function (event) {
    const context = fileDropContext(event.target);
    if (!context) return;
    event.preventDefault();
    context.field.classList.remove('is-file-dragover');
    const files = Array.from(event.dataTransfer && event.dataTransfer.files || []);
    if (!files.length || typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    files.forEach(function (file) { transfer.items.add(file); });
    try {
      context.input.files = transfer.files;
      context.input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) {
      toast('No se pudo adjuntar el archivo. Usa el selector para intentarlo de nuevo.');
    }
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
  let purchaseOrders = [];
  let purchaseOrderItems = [];
  let purchaseReceipts = [];
  let purchaseReceiptItems = [];
  let supplierInvoices = [];
  let supplierInvoicePayments = [];
  let expenses = [];
  let cashEntries = [];
  let cashAccounts = [];
  let invoices = [];
  let invoiceDraftItems = [];
  let analyticsPeriodPreset = 'all';
  let analyticsCustomFrom = '';
  let analyticsCustomTo = '';
  let employees = [];
  let employeeHistory = [];
  let employeeDocuments = [];
  let attendanceRecords = [];
  let leaveRequests = [];
  let payrollPeriods = [];
  let payrollItems = [];
  let hrCommissions = [];
  let hrInssSettings = { regime:'integral', employer_band:'under_50', employee_rate:7, employer_rate:21.5 };
  let inventoryMovements = [];
  let inventorySummary = null;
  let inventoryStockPageRows = null, inventoryStockTotal = null, inventoryStockPageError = "";
  let inventoryMovementPageRows = null, inventoryMovementTotal = null, inventoryMovementPageError = "";
  let inventoryStockLoading = false, inventoryMovementLoading = false;
  let inventoryStockRequestId = 0, inventoryMovementRequestId = 0;
  let inventoryStockSearchTimer = null, inventoryMovementSearchTimer = null;
  let dgiSupportDocuments = [];
  let dgiDocumentsLoaded = false, dgiDocumentsLoading = false, dgiDocumentsLoadAttempted = false, dgiDocumentsError = "";
  let dgiCompliance = { taxpayer_name:"", ruc:"", business_address:"", regime_status:"not_confirmed", regime_confirmation_reference:"", quota_fixed_amount_nio:0, certificate_available:false, certificate_displayed:false, computerized_invoicing_status:"not_confirmed", dgi_confirmation_date:"", computerized_invoicing_authorization_number:"", computerized_invoicing_confirmation_reference:"" };
  let hrRecordsLoaded = false, hrRecordsLoading = false, hrLoadAttempted = false, hrLoadError = "";
  let erpDataLoaded = false, erpDataLoading = false, erpLoadError = "";
  let notificationRecords = [], notificationUnreadCount = 0, notificationsLoading = false;
  let catalogSettings = {}, catalogSettingsLoaded = false, catalogSettingsLoading = false, catalogSettingsError = '';
  let resourceUsage = null, resourceUsageLoadedAt = 0, resourceUsageError = '';
  const RESOURCE_USAGE_TTL_MS = 5 * 60 * 1000;
  const NEON_PREVENTIVE_THRESHOLD_BYTES = 512 * 1024 * 1024;
  const R2_PREVENTIVE_THRESHOLD_BYTES = 2 * 1024 * 1024 * 1024;
  let clientErrorReportThrottle = 0;
  const accessManager = {
    attempted:false, loading:false, loaded:false, error:"",
    users:[], pendingIdentities:[], roles:[], permissions:[], grants:[], audit:[], clientErrors:[]
  };
  let accessSelectedRole = "";


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

  function reportClientError(errorType, message, sourceFile, lineNumber, columnNumber) {
    const now = Date.now();
    if (now - clientErrorReportThrottle < 2500 || !window.JBAuth?.profile) return;
    clientErrorReportThrottle = now;
    const safeSource = String(sourceFile || "").split(/[?#]/)[0].slice(0,300);
    const payload = {
      error_type: errorType,
      error_message: String(message || "Error sin mensaje").slice(0,600),
      source_file: safeSource,
      line_number: Number(lineNumber || 0),
      column_number: Number(columnNumber || 0),
      page_path: window.location.pathname
    };
    erpApi("client-errors", { method:"POST", body:JSON.stringify(payload) }).catch(() => {});
  }

  window.addEventListener("error", function(event) {
    if (!event?.error) return;
    reportClientError("javascript_error", event.message || event.error.message, event.filename, event.lineno, event.colno);
  });
  window.addEventListener("unhandledrejection", function(event) {
    const reason = event?.reason;
    const message = reason instanceof Error ? reason.message : String(reason || "Promesa rechazada sin detalle");
    reportClientError("unhandled_rejection", message, "", 0, 0);
  });

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
      purchaseOrders = (data.purchase_orders || []).map(order => ({
        id:order.id, orderNumber:order.order_number, supplierId:order.supplier_id, supplier:order.supplier_name,
        currency:order.currency, exchangeRate:Number(order.exchange_rate||1), subtotalUsd:Number(order.subtotal_usd||0),
        discountUsd:Number(order.discount_usd||0), freightUsd:Number(order.estimated_freight_usd||0),
        taxesUsd:Number(order.estimated_taxes_usd||0), totalUsd:Number(order.total_usd||0), status:order.status,
        createdBy:order.created_by||null, createdByName:order.created_by_name||"Usuario no disponible",
        approvedBy:order.approved_by||null, approvedByName:order.approved_by_name||"Usuario no disponible", approvedAt:order.approved_at||null,
        expectedDate:order.expected_delivery_date, paymentTerms:order.payment_terms||"", notes:order.notes||"", createdAt:order.created_at
      }));
      purchaseOrderItems = data.purchase_order_items || [];
      purchaseReceipts = (data.purchase_receipts || []).map(receipt=>({...receipt,
        purchaseOrderId:receipt.purchase_order_id, receiptNumber:receipt.receipt_number,
        documentStatus:receipt.document_status||"Contabilizada", purchaseCode:receipt.purchase_code||null,
        journalNumber:receipt.journal_number||null, emittedByName:receipt.emitted_by_name||"Usuario no disponible",
        postedByName:receipt.posted_by_name||"Usuario no disponible"
      }));
      purchaseReceiptItems = (data.purchase_receipt_items || []).map(line=>({...line,
        receiptId:line.receipt_id,purchaseOrderItemId:line.purchase_order_item_id,
        quantityReceived:Number(line.quantity_received||0)
      }));
      supplierInvoices = (data.supplier_invoices || []).map(invoice => ({
        id:invoice.id,supplierId:invoice.supplier_id,supplier:invoice.supplier_name,purchaseOrderId:invoice.purchase_order_id||null,
        invoiceNumber:invoice.invoice_number,invoiceDate:invoice.invoice_date,dueDate:invoice.due_date||null,currency:invoice.currency,
        exchangeRate:Number(invoice.exchange_rate||1),originalAmount:Number(invoice.original_amount||0),amountUsd:Number(invoice.amount_usd||0),
        paidUsd:Number(invoice.paid_amount_usd||0),status:invoice.status,notes:invoice.notes||"",createdAt:invoice.created_at
      }));
      supplierInvoicePayments = data.supplier_invoice_payments || [];
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
        hireDate: e.hire_date || null, phone: e.phone || "", email: e.email || "", notes: e.notes || "",
        commissionEnabled:e.commission_enabled===true, commissionRate:Number(e.commission_rate||0),
        contractType:e.contract_type||'Por definir', workSchedule:e.work_schedule||'Por definir',
        contractStartDate:e.contract_start_date||e.hire_date||null, contractEndDate:e.contract_end_date||null,
        linkedUserId:e.linked_user_id||null, linkedAccountStatus:e.linked_account_status||null, accountActive:e.account_active===true
      }));
      employeeHistory = (data.employee_history || []).map(item => ({
        id:item.id, employeeId:item.employee_id, eventType:item.event_type, effectiveDate:item.effective_date,
        fromPosition:item.from_position, toPosition:item.to_position, fromDepartment:item.from_department, toDepartment:item.to_department,
        fromSalaryNio:item.from_salary_nio==null?null:Number(item.from_salary_nio), toSalaryNio:item.to_salary_nio==null?null:Number(item.to_salary_nio),
        fromCommissionEnabled:item.from_commission_enabled, toCommissionEnabled:item.to_commission_enabled,
        fromCommissionRate:item.from_commission_rate==null?null:Number(item.from_commission_rate), toCommissionRate:item.to_commission_rate==null?null:Number(item.to_commission_rate),
        fromStatus:item.from_status, toStatus:item.to_status,
        fromContractType:item.from_contract_type, toContractType:item.to_contract_type,
        fromWorkSchedule:item.from_work_schedule, toWorkSchedule:item.to_work_schedule,
        fromContractStartDate:item.from_contract_start_date||null, toContractStartDate:item.to_contract_start_date||null,
        fromContractEndDate:item.from_contract_end_date||null, toContractEndDate:item.to_contract_end_date||null,
        reason:item.reason||"", createdAt:item.created_at
      }));
      employeeDocuments = (data.employee_documents || []).map(item => ({
        id:item.id, employeeId:item.employee_id, documentType:item.document_type, fileName:item.file_name,
        fileType:item.file_type, fileSize:Number(item.file_size||0), createdAt:item.created_at
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
        status:e.status, periodType:e.period_type||"Ordinaria", commissionExchangeRate:Number(e.commission_exchange_rate||exchangeRate), notes:e.notes||"", createdAt:e.created_at
      }));
      payrollItems = (data.hr_payroll_items || []).map(e => ({
        id:e.id, payrollPeriodId:e.payroll_period_id, employeeId:e.employee_id,
        baseSalaryNio:Number(e.base_salary_nio||0), bonusesNio:Number(e.bonuses_nio||0),
        commissionsUsd:Number(e.commissions_usd||0), commissionsNio:Number(e.commissions_nio||0),
        commissionExchangeRate:Number(e.commission_exchange_rate||exchangeRate), inssEmployeeNio:Number(e.inss_employee_nio||0),
        inssEmployerNio:Number(e.inss_employer_nio||0), aguinaldoNio:Number(e.aguinaldo_nio||0),
        deductionsNio:Number(e.deductions_nio||0), netSalaryNio:Number(e.net_salary_nio||0), notes:e.notes||""
      }));
      hrInssSettings = data.hr_inss_settings && typeof data.hr_inss_settings === "object" ? { ...hrInssSettings, ...data.hr_inss_settings } : hrInssSettings;
      hrCommissions = (data.hr_commissions || []).map(c => ({
        id:c.id, invoiceId:c.invoice_id, invoiceNumber:c.invoice_number||'', invoiceItemId:c.invoice_item_id,
        employeeId:c.employee_id, employeeName:c.employee_name||'Colaborador', saleDate:c.sale_date,
        productName:c.product_name, quantity:Number(c.quantity||0), grossSaleUsd:Number(c.gross_sale_usd||0),
        netSaleUsd:Number(c.net_sale_usd||0), unitCostUsd:Number(c.unit_cost_usd||0),
        grossProfitUsd:Number(c.gross_profit_usd||0), rate:Number(c.commission_rate||0),
        commissionUsd:Number(c.commission_usd||0), commissionNio:Number(c.commission_nio||0),
        exchangeRate:Number(c.exchange_rate||1), status:c.status||'Pendiente', payrollPeriodId:c.payroll_period_id||null
      }));
      const inssSetting = (data.settings || []).find(s => s.setting_key === 'hr_inss_settings');
      if (inssSetting?.setting_value && typeof inssSetting.setting_value === 'object') hrInssSettings = { ...hrInssSettings, ...inssSetting.setting_value };
      const rateSetting = (data.settings || []).find(s => s.setting_key === "default_exchange_rate");
      if (rateSetting && Number(rateSetting.setting_value?.value) > 0) exchangeRate = Number(rateSetting.setting_value.value);
      const dgiSetting = (data.settings || []).find(s => s.setting_key === "dgi_compliance");
      if (dgiSetting && dgiSetting.setting_value && typeof dgiSetting.setting_value === "object") {
        dgiCompliance = { ...dgiCompliance, ...dgiSetting.setting_value };
      }

      erpDataLoaded = true;
      void loadNotifications({ silent:true });
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
    catalog: { title: 'Catálogo PDF', eyebrow: 'EDITORIAL · JB PARFUMS', heading: 'Catálogo de fragancias', subtitle: 'Selecciona las piezas que quieres presentar y genera un PDF premium para compartir o imprimir.' },
    resources: { title: 'Resource Monitor', eyebrow: 'CONTROL DE RECURSOS', heading: 'Consumo y servicios', subtitle: 'Supervisa las mediciones disponibles de Neon y Cloudflare R2, sin confundirlas con las cuotas del proveedor.' },
    inventory: { title: 'Inventario', eyebrow: 'CONTROL DE EXISTENCIAS', heading: 'Inventario', subtitle: 'Consulta los niveles de stock y detecta reposiciones.' },
    orders: { title: 'Pedidos', eyebrow: 'OPERACIONES', heading: 'Pedidos y ventas', subtitle: 'Da seguimiento al estado de cada pedido.' },
    customers: { title: 'Clientes', eyebrow: 'RELACIONES', heading: 'Cartera de clientes', subtitle: 'Mantén organizada la información comercial.' },
    billing: { title: 'Facturación', eyebrow: 'DOCUMENTOS COMERCIALES', heading: 'Facturación', subtitle: 'Registra ventas presenciales y pedidos web en un mismo lugar.' },
    receivables: { title: 'Cuentas por cobrar', eyebrow: 'FINANZAS', heading: 'Cuentas por cobrar', subtitle: 'Da seguimiento a saldos y abonos de clientes.' },
    hr: { title: 'RRHH', eyebrow: 'GESTIÓN DEL PERSONAL', heading: 'Recursos Humanos', subtitle: 'Organiza personal, asistencia, permisos y nómina.' },
    dgi: { title: 'DGI', eyebrow: 'CUMPLIMIENTO TRIBUTARIO', heading: 'Control tributario DGI', subtitle: 'Organiza libros simplificados, límites de referencia y soportes documentales.' },
    analytics: { title: 'Informes', eyebrow: 'RENDIMIENTO', heading: 'Informes y análisis', subtitle: 'Indicadores preparados para tomar decisiones.' },
    settings: { title: 'Configuración', eyebrow: 'SISTEMA', heading: 'Configuración', subtitle: 'Preferencias y conexiones de JB PARFUMS ERP.' },
    purchases: { title: 'Compras', eyebrow: 'ABASTECIMIENTO', heading: 'Compras recibidas', subtitle: 'Consulta adquisiciones que ya ingresaron físicamente al inventario.' },
    purchaseOrders: { title: 'Órdenes de compra', eyebrow: 'ABASTECIMIENTO', heading: 'Órdenes de compra', subtitle: 'Prepara, envía, aprueba y recibe pedidos de proveedores.' },
    payables: { title: 'Cuentas por pagar', eyebrow: 'ABASTECIMIENTO', heading: 'Cuentas por pagar', subtitle: 'Controla saldos y abonos pendientes con tus proveedores.' },
    suppliers: { title: 'Proveedores', eyebrow: 'ABASTECIMIENTO', heading: 'Proveedores', subtitle: 'Administra proveedores y monedas habituales.' },
    expenses: { title: 'Gastos', eyebrow: 'FINANZAS', heading: 'Gastos operativos', subtitle: 'Controla egresos en dólares y córdobas.' },
    cash: { title: 'Caja y bancos', eyebrow: 'FINANZAS', heading: 'Caja y bancos', subtitle: 'Registra cobros, recibos y pagos por cuenta.' }
  };
  const state = { view: 'dashboard', query: '', filter: 'all', category: 'all', productStatus: 'active', hrTab: 'employees', purchaseTab: 'orders', inventoryMovementQuery: '', inventoryMovementActor: '', inventoryMovementSupplier: '', inventoryMovementType: 'all', inventoryMovementStartDate: '', inventoryMovementEndDate: '', inventoryMovementPage: 1, inventoryMovementPageSize: 25, inventoryProductQuery: '', inventoryProductCategory: 'all', inventoryProductStock: 'all', inventoryStockPage: 1, inventoryStockPageSize: 25, purchaseHistoryQuery: '', purchaseHistorySupplier: 'all', purchaseHistoryOrderStatus: 'all', purchaseHistoryReceiptStatus: 'all', purchaseHistoryStartDate: '', purchaseHistoryEndDate: '', catalogCategory: 'all', catalogShowPrices: true };
  const permissionViews = {
    dashboard: ["dashboard.view"], products: ["products.catalog.view"], catalog: ["products.catalog.view"], resources: [],
    inventory: ["inventory.stock.view","inventory.receipts.view","inventory.manual_out.view","inventory.adjustments.view","inventory.movements.reverse"],
    orders: ["orders.records.view"], billing: ["billing.invoices.view"],
    receivables: ["receivables.view","billing.payments.view"], customers: ["customers.records.view"],
    hr: ["hr.employees.view","hr.attendance.view","hr.payroll.view","hr.leave.view","hr.contracts.view"],
    dgi: ["dgi.documents.view"], analytics: ["analytics.reports.view"], settings: ["settings.general.view"],
    purchases: ["purchases.receipts.view"],
    purchaseOrders: ["purchases.purchase_orders.view","purchases.receipts.view"],
    payables: ["purchases.supplier_invoices.view"], suppliers: ["suppliers.records.view"],
    expenses: ["expenses.records.view"], cash: ["cash.entries.view"]
  };
  function permissionGranted(key) {
    const profile = window.JBAuth?.profile;
    // The Worker returns only effective grants; owner bypass is explicit.
    return profileHasPermission(profile, key);
  }
  function canViewERPView(view) {
    if (view === 'resources') return window.JBAuth?.profile?.role === 'owner';
    const keys = permissionViews[view] || [];
    return keys.some(permissionGranted);
  }
  function canExportERPView(view) {
    if (!canViewERPView(view)) return false;
    return !["analytics", "dgi"].includes(view) || permissionGranted("analytics.reports.export");
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
    const resourceLink = document.querySelector('.resource-monitor-link');
    if (resourceLink) resourceLink.hidden = !canViewERPView('resources');
  }
  const actionPermissions = {
    "new-order": ["orders.records.create"], "preview-order": ["orders.records.view"],
    "new-invoice": ["billing.invoices.create"], "new-invoice-after-preview": ["billing.invoices.create"],
    "add-invoice-product": ["billing.invoices.create"], "remove-invoice-product": ["billing.invoices.create"],
    "view-invoice": ["billing.invoices.view"], "new-payment": ["billing.payments.create"],
    "new-customer": ["customers.records.create"], "new-product": ["products.catalog.create"],
    "edit-product": ["products.catalog.edit"], "delete-product": ["products.catalog.delete"],
    "toggle-product": ["products.catalog.edit"], "import-products": ["products.catalog.create"],
    "save-catalog-settings": ["products.catalog.edit"], "generate-catalog-pdf": ["products.catalog.view"],
    "stock-new": ["inventory.receipts.receive","inventory.manual_out.create","inventory.adjustments.adjust"],
    "stock-product": ["inventory.receipts.receive","inventory.manual_out.create","inventory.adjustments.adjust"],
    "inventory-view-product": ["inventory.view"],
    "export-inventory": ["inventory.view"], "reverse-inventory-movement": ["inventory.movements.reverse"], "new-purchase": ["purchases.receipts.receive"],
    "submit-purchase-order": ["purchases.purchase_orders.submit"],
    "approve-purchase-order": ["purchases.approvals.approve"],
    "cancel-purchase-order": ["purchases.purchase_orders.cancel"], "post-purchase-receipt": ["purchases.receipts.post"], "view-purchase-journal": ["purchases.receipts.journal.view"],
    "add-purchase-order-line": ["purchases.purchase_orders.create"],
    "remove-purchase-order-line": ["purchases.purchase_orders.create"],
    "new-purchase-payment": ["payables.payments.create"],
    "new-supplier-invoice": ["purchases.supplier_invoices.create"],
    "new-supplier-invoice-payment": ["payables.payments.create"],
    "new-supplier": ["suppliers.records.create"],
    "new-expense": ["expenses.records.create"], "new-cash": ["cash.entries.create"],
    "new-cash-account": ["cash.entries.create"], "new-employee": ["hr.employees.create"],
    "view-employee": ["hr.employees.view"], "edit-employee": ["hr.employees.edit"],
    "upload-employee-document": ["hr.employees.edit"], "download-employee-document": ["hr.employees.view"],
    "new-attendance": ["hr.attendance.create"], "new-leave": ["hr.leave.create"],
    "approve-leave": ["hr.leave.approve"], "reject-leave": ["hr.leave.reject"],
    "new-payroll-period": ["hr.payroll.create"], "new-payroll-item": ["hr.payroll.create"],
    "approve-payroll": ["hr.payroll.approve"], "pay-payroll": ["hr.payroll.approve"],
    "download-dgi-document": ["dgi.documents.view"], "reload-dgi-documents": ["dgi.documents.view"],
    "export-dgi-book": ["analytics.reports.export"], "go-hr-employees": ["hr.employees.view"],
    "clear-inventory-filters": ["inventory.view"], "clear-inventory-product-filters": ["inventory.view"], "inventory-month-filter": ["inventory.view"], "clear-purchase-filters": ["purchases.purchase_orders.view","purchases.receipts.view"], "purchase-month-filter": ["purchases.purchase_orders.view","purchases.receipts.view"],
    "inventory-page": ["inventory.view"], "inventory-stock-page": ["inventory.view"], "refresh-access-manager": ["users.accounts.view"],
    "provision-user-account": ["users.accounts.create"], "save-user-access": ["users.accounts.edit"], "add-user-override": ["users.accounts.edit"], "remove-user-override": ["users.accounts.edit"]
  };
  function applyPermissionActions() {
    root.querySelectorAll("button[data-action]").forEach((button) => {
      const action = button.getAttribute("data-action");
      if (action === "hr-tab") {
        const tabPermission = {
          employees: "hr.employees.view", attendance: "hr.attendance.view",
          leaves: "hr.leave.view", benefits: "hr.payroll.view", commissions: "hr.payroll.view", payroll: "hr.payroll.view", contracts: "hr.contracts.view"
        }[button.getAttribute("data-tab")];
        if (tabPermission) button.hidden = !permissionGranted(tabPermission);
        return;
      }
      if (action === "new-purchase") {
        button.hidden = !(permissionGranted("purchases.receipts.receive") && permissionGranted("inventory.receipts.receive"));
        return;
      }
      if (action === "toggle-export-menu" || action === "export-current-view") {
        button.hidden = !canExportERPView(state.view);
        return;
      }
      if (action === "receive-purchase-order") {
        button.hidden = !(permissionGranted("purchases.receipts.receive") && permissionGranted("inventory.receipts.receive"));
        return;
      }
      const keys = actionPermissions[action];
      if (keys) button.hidden = !keys.some(permissionGranted);
    });
    root.querySelectorAll("button[data-view]").forEach((button) => {
      button.hidden = !canViewERPView(button.getAttribute("data-view"));
    });
  }
  const root = document.getElementById('view-root');
  const dialog = document.getElementById('product-dialog');
  const form = document.getElementById('product-form');
  const stockDialog = document.getElementById('stock-dialog');
  const stockForm = document.getElementById('stock-form');
  const inventoryReversalDialog = document.getElementById('inventory-reversal-dialog');
  const inventoryReversalForm = document.getElementById('inventory-reversal-form');
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
    const stockAvailable=activeProducts.filter(product=>Number(product.stock||0)>(Number.isInteger(product.minStock)?product.minStock:3)).length;
    const stockLow=activeProducts.filter(product=>Number(product.stock||0)>0&&needsRestock(product)).length;
    const stockOut=activeProducts.filter(product=>Number(product.stock||0)<=0).length;
    const stockTotal=activeProducts.length;
    const availableEnd=stockTotal?360*stockAvailable/stockTotal:0;
    const lowEnd=stockTotal?360*(stockAvailable+stockLow)/stockTotal:0;
    const donutBackground=stockTotal
      ? 'conic-gradient(#3f8b68 0deg '+availableEnd+'deg,#d7a44e '+availableEnd+'deg '+lowEnd+'deg,#bf6a62 '+lowEnd+'deg 360deg)'
      : 'conic-gradient(#e8edf2 0deg 360deg)';
    const stockSegments=[
      {label:'Disponible',count:stockAvailable,tone:'available'},
      {label:'Stock bajo',count:stockLow,tone:'low'},
      {label:'Agotado',count:stockOut,tone:'out'}
    ];
    const stockLegend=stockSegments.map(segment=>{
      const percent=stockTotal?Math.round(segment.count/stockTotal*100):0;
      return '<div class="donut-legend-item"><span class="donut-swatch '+segment.tone+'"></span><span class="donut-legend-label">'+segment.label+'</span><strong>'+segment.count+'</strong><small>'+percent+'%</small></div>';
    }).join('');
    const donutMarkup='<div class="inventory-donut" role="img" aria-label="Distribución de productos: '+stockAvailable+' disponibles, '+stockLow+' con stock bajo y '+stockOut+' agotados." style="background:'+donutBackground+'"><div class="inventory-donut-center"><strong>'+stockTotal+'</strong><span>productos</span></div></div>';
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
      '<article class="panel"><div class="panel-heading"><div><h2>Ventas facturadas · últimos 7 días</h2><p>Importes tomados de comprobantes registrados</p></div><button class="panel-link" data-view="analytics">Ver informes '+svg('arrow')+'</button></div><div class="chart-summary"><strong>'+money(finance.revenue)+'</strong><span>total facturado histórico · USD</span></div><div class="stock-summary dashboard-sales-bars">'+bars+'</div><div class="chart-note"><i></i> Solo incluye facturas guardadas en Neon.</div></article>'+
      '<article class="panel"><div class="panel-heading"><div><h2>Productos destacados</h2><p>Productos activos con más unidades disponibles</p></div><button class="panel-link" data-view="products">Catálogo '+svg('arrow')+'</button></div><div class="top-products">'+(topRows||'<div class="empty-state">Todavía no hay productos registrados.</div>')+'</div><div class="panel-footer-note">Precios, costos y existencias consultados desde Neon.</div></article>'+
      '</section>'+
      '<section class="lower-grid"><article class="panel"><div class="panel-heading"><div><h2>Facturas recientes</h2><p>Actividad comercial registrada</p></div><button class="panel-link" data-view="billing">Ver todas '+svg('arrow')+'</button></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FACTURA</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ESTADO</th></tr></thead><tbody>'+(invoiceRows||'<tr><td colspan="5"><div class="empty-state">Todavía no hay facturas.</div></td></tr>')+'</tbody></table></div></article>'+
      '<article class="panel inventory-status-panel"><div class="panel-heading"><div><h2>Estado del inventario</h2><p>Distribución de productos por nivel de existencias</p></div><button class="panel-link" data-view="inventory">Consultar existencias '+svg('arrow')+'</button></div><div class="inventory-donut-layout">'+donutMarkup+'<div class="donut-legend">'+stockLegend+'</div></div><div class="panel-footer-note">Conteo por referencia activa, calculado con existencias y stock mínimo registrados en Neon.</div></article></section>';
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
    return heading(views.products, '<div class="heading-actions-inline"><button class="button button-primary" data-action="new-product">' + svg('plus') + ' Nuevo producto</button><button class="button button-quiet" data-action="import-products">' + svg('download') + ' Importar catálogo</button></div>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Productos activos</span><strong>' + activeCount + '</strong></div><div class="summary-mini"><span>Desactivados</span><strong>' + inactiveCount + '</strong></div><div class="summary-mini"><span>Requieren reposición</span><strong>' + products.filter(function (product) { return product.active !== false && needsRestock(product); }).length + '</strong></div></div>' +
      '<div class="toolbar products-toolbar"><div class="toolbar-left"><label class="inline-search">' + svg('search') + '<input id="view-search" type="search" value="' + esc(state.query) + '" aria-label="Buscar productos"></label></div><div class="toolbar-right"><select class="filter-select" id="product-status-filter" aria-label="Estado del producto"><option value="active"' + (state.productStatus === 'active' ? ' selected' : '') + '>Activos</option><option value="inactive"' + (state.productStatus === 'inactive' ? ' selected' : '') + '>Desactivados</option><option value="all"' + (state.productStatus === 'all' ? ' selected' : '') + '>Todos</option></select><select class="filter-select" id="category-filter" aria-label="Filtrar por categoría"><option value="all"' + (state.category === 'all' ? ' selected' : '') + '>Todas las categorías</option>' + categoryOptions + '</select><select class="filter-select" id="stock-filter" aria-label="Filtrar por stock"><option value="all"' + (state.filter === 'all' ? ' selected' : '') + '>Todos los estados</option><option value="available"' + (state.filter === 'available' ? ' selected' : '') + '>Disponibles</option><option value="low"' + (state.filter === 'low' ? ' selected' : '') + '>Stock bajo</option><option value="out"' + (state.filter === 'out' ? ' selected' : '') + '>Agotados</option></select></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>PRECIO / COSTO</th><th>EXISTENCIAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody id="product-table-body">' + productTable(filteredProducts()) + '</tbody></table></div></article>' +
      '<div class="notice-panel"><span>' + svg('spark') + '</span><div><strong>Catálogo conectado a Neon Development</strong><p>Las fichas se guardan en PostgreSQL. Las existencias iniciales y los movimientos posteriores quedan registrados en el kardex.</p></div></div>';
  }
  function catalogConfigFor(product) {
    const saved = catalogSettings && catalogSettings[String(product.id)] || {};
    const minStock = Number(saved.minStock);
    return {
      published: saved.published === true,
      minStock: Number.isInteger(minStock) && minStock >= 0 ? minStock : 5
    };
  }
  async function loadCatalogSettings(force = false) {
    if (catalogSettingsLoading) return false;
    if (catalogSettingsLoaded && !force) return true;
    catalogSettingsLoading = true;
    catalogSettingsError = '';
    try {
      const response = await erpApi('catalog-settings');
      catalogSettings = response?.settings && typeof response.settings === 'object' && !Array.isArray(response.settings)
        ? response.settings : {};
      catalogSettingsLoaded = true;
      return true;
    } catch (error) {
      catalogSettingsError = error?.message || 'No se pudo cargar la configuración del catálogo.';
      return false;
    } finally {
      catalogSettingsLoading = false;
    }
  }
  function renderCatalog() {
    const canEdit = permissionGranted('products.catalog.edit');
    if (!catalogSettingsLoaded && !catalogSettingsError) {
      return heading(views.catalog, '') + '<div class="notice-panel"><span>' + svg('clock') + '</span><div><strong>Preparando catálogo</strong><p>Consultando la configuración de publicación y las fotografías existentes.</p></div></div>';
    }
    const active = products.filter(product => product.active !== false);
    const categories = Array.from(new Set(active.map(product => String(product.category || 'Perfumería')))).sort((a,b) => a.localeCompare(b,'es'));
    const categoryOptions = categories.map(category =>
      '<option value="' + esc(category) + '"' + (state.catalogCategory === category ? ' selected' : '') + '>' + esc(category) + '</option>'
    ).join('');
    const selected = active.filter(product => state.catalogCategory === 'all' || String(product.category || 'Perfumería') === state.catalogCategory);
    const rows = selected.map(product => {
      const config = catalogConfigFor(product);
      const image = Array.isArray(product.images) && product.images[0]?.key;
      const stock = Number(product.stock || 0);
      const availability = stock <= 0 ? 'Sin existencias · No se exporta' : stock <= config.minStock ? 'Últimas unidades' : 'Disponible';
      return '<article class="catalog-product-row" data-catalog-product-id="' + esc(product.id) + '">' +
        '<div class="catalog-editor-image" data-product-image-slot="' + esc(product.id) + '">' +
          (image ? '<span class="catalog-image-loading">Cargando foto</span>' : '<span class="catalog-image-missing">Sin fotografía</span>') +
        '</div>' +
        '<div class="catalog-product-copy"><span class="catalog-product-brand">' + esc(product.brand || 'JB PARFUMS') + '</span><strong>' + esc(product.name) + '</strong>' +
          '<small>' + esc(product.category || 'Perfumería') + (product.presentation ? ' · ' + esc(product.presentation) : '') + '</small>' +
          '<span class="catalog-stock-status ' + (stock <= 0 ? 'is-muted' : stock <= config.minStock ? 'is-low' : 'is-ready') + '">' + esc(availability) + '</span></div>' +
        '<div class="catalog-product-config">' +
          (canEdit
            ? '<label class="catalog-publish-toggle"><input type="checkbox" data-catalog-publish' + (config.published ? ' checked' : '') + '> <span>Publicar</span></label>' +
              '<label class="catalog-min-stock"><span>Mínimo para “últimas unidades”</span><input type="number" min="0" max="9999" step="1" value="' + config.minStock + '" data-catalog-min-stock aria-label="Mínimo de existencias para ' + esc(product.name) + '"></label>'
            : '<span class="catalog-publish-state">' + (config.published ? 'Publicado' : 'No publicado') + '</span><small class="catalog-min-stock-readonly">Mínimo: ' + config.minStock + ' unidades</small>') +
        '</div></article>';
    }).join('');
    const error = catalogSettingsError
      ? '<div class="notice-panel"><span>' + svg('warning') + '</span><div><strong>No se pudo leer la configuración</strong><p>' + esc(catalogSettingsError) + '</p><button type="button" class="button button-quiet button-small" data-action="reload-catalog-settings">Reintentar</button></div></div>'
      : '';
    return heading(views.catalog, '<div class="heading-actions-inline">' +
      (canEdit ? '<button type="button" class="button button-quiet" data-action="save-catalog-settings">' + svg('download') + ' Guardar selección</button>' : '') +
      '<button type="button" class="button button-primary" data-action="generate-catalog-pdf">' + svg('download') + ' Generar PDF premium</button></div>') +
      '<section class="catalog-control-panel"><div><label for="catalog-category-filter">Colección</label><select id="catalog-category-filter" class="filter-select"><option value="all"' + (state.catalogCategory === 'all' ? ' selected' : '') + '>Todas las fragancias</option>' + categoryOptions + '</select></div>' +
      '<label class="catalog-price-toggle"><input id="catalog-show-prices" type="checkbox"' + (state.catalogShowPrices ? ' checked' : '') + '> Mostrar precios en el PDF</label>' +
      '<p>El documento utiliza la fotografía principal guardada en Inventario. Solo incluye productos activos, publicados y con existencias; las cantidades exactas nunca aparecen en el PDF.</p></section>' +
      error +
      '<div class="catalog-editor-heading"><div><span class="eyebrow">SELECCIÓN EDITORIAL</span><strong>' + selected.length + ' productos en esta vista</strong></div><span>Las existencias se consultan desde el inventario</span></div>' +
      '<section class="catalog-editor-list">' + (rows || '<div class="empty-state">No hay productos activos para esta categoría.</div>') + '</section>' +
      '<div class="notice-panel catalog-note"><span>' + svg('spark') + '</span><div><strong>Un solo origen de fotografías</strong><p>Las imágenes se reutilizan desde Cloudflare R2. El catálogo PDF se genera al solicitarlo y no crea copias permanentes de los archivos.</p></div></div>';
  }
  function collectCatalogSettings() {
    const next = { ...(catalogSettings || {}) };
    root.querySelectorAll('.catalog-product-row[data-catalog-product-id]').forEach(row => {
      const productId = row.getAttribute('data-catalog-product-id');
      const previous = next[productId] || {};
      const publish = row.querySelector('[data-catalog-publish]');
      const minimum = row.querySelector('[data-catalog-min-stock]');
      next[productId] = {
        published: publish ? publish.checked : previous.published === true,
        minStock: minimum ? Number(minimum.value) : catalogConfigFor({id:productId}).minStock
      };
    });
    return next;
  }
  async function saveCatalogSettings(silent = false) {
    if (!permissionGranted('products.catalog.edit')) {
      if (!silent) toast('Tu cuenta no tiene permiso para modificar la publicación.');
      return false;
    }
    const settings = collectCatalogSettings();
    for (const value of Object.values(settings)) {
      if (!Number.isInteger(value.minStock) || value.minStock < 0 || value.minStock > 9999) {
        if (!silent) toast('Revisa los mínimos de existencias: usa números enteros entre 0 y 9999.');
        return false;
      }
    }
    try {
      const result = await erpApi('catalog-settings', { method:'PATCH', body:JSON.stringify({settings}) });
      catalogSettings = result?.settings || settings;
      catalogSettingsLoaded = true;
      catalogSettingsError = '';
      if (!silent) {
        renderView();
        toast('Selección del catálogo guardada.');
      }
      return true;
    } catch (error) {
      if (!silent) toast(error?.message || 'No se pudo guardar la selección del catálogo.');
      else catalogSettingsError = error?.message || 'No se pudo guardar la selección del catálogo.';
      return false;
    }
  }
  function catalogPrintDocument(items, includePrices) {
    const generated = new Date().toLocaleDateString('es-NI', { day:'2-digit', month:'long', year:'numeric' });
    const safeItems = items.map(product => {
      const detail = [product.brand, product.presentation, String(product.concentration || '').trim(), product.sizeMl ? product.sizeMl + ' ml' : ''].filter(value => String(value || '').trim()).join(' · ');
      const stock = Number(product.stock || 0);
      const config = catalogConfigFor(product);
      const availability = stock <= config.minStock ? 'Últimas unidades' : 'Disponible';
      const description = String(product.description || product.notes || '').trim();
      return '<article class="fragrance-card"><div class="fragrance-image">' +
        (product.printImage ? '<img src="' + esc(product.printImage) + '" alt="' + esc(product.name) + '">' : '<span class="fragrance-image-placeholder">JB</span>') +
        '</div><div class="fragrance-copy"><span class="fragrance-brand">' + esc(product.brand || 'JB PARFUMS') + '</span>' +
        '<h2>' + esc(product.name) + '</h2><p class="fragrance-detail">' + esc(detail || product.category || 'Perfumería') + '</p>' +
        (description ? '<p class="fragrance-description">' + esc(description.slice(0,260)) + '</p>' : '') +
        (includePrices ? '<strong class="fragrance-price">' + esc(money(product.price)) + '</strong>' : '') +
        '<span class="fragrance-availability">' + availability + '</span></div></article>';
    });
    const sheets = [];
    for (let index=0; index<safeItems.length; index+=4) {
      const cards = safeItems.slice(index,index+4).join('');
      sheets.push('<section class="catalog-sheet"><header class="catalog-sheet-header"><span>JB PARFUMS</span><small>SELECCIÓN DE FRAGANCIAS</small></header><div class="fragrance-grid">' + cards + '</div><footer class="catalog-sheet-footer"><span>JB PARFUMS · FRAGANCIAS CON IDENTIDAD</span><span>CATÁLOGO · ' + generated + '</span></footer></section>');
    }
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JB PARFUMS · Catálogo</title><style>' +
      '@page{size:A4;margin:12mm}*{box-sizing:border-box}html,body{margin:0;color:#29231c;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff}.cover{height:273mm;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:25mm 18mm;background:#171b22;color:#f7f1e7;break-after:page}.cover:before,.catalog-sheet:before{position:absolute;content:"";width:150mm;height:150mm;left:50%;top:48%;transform:translate(-50%,-50%);background:url("/assets/images/jb-parfums-watermark.png") center/contain no-repeat;opacity:.12;pointer-events:none}.cover:after{position:absolute;inset:12mm;border:1px solid #b99a66;content:"";pointer-events:none}.cover>*{position:relative;z-index:1}.cover-brand{font-size:12px;letter-spacing:5px;color:#d7bd91}.cover-monogram{width:28mm;height:28mm;border:1px solid #c9a977;border-radius:50%;display:grid;place-items:center;font:30px Georgia,serif;color:#e4cc9f;margin-top:34mm}.cover h1{font:52px/1.05 Georgia,"Times New Roman",serif;font-weight:400;letter-spacing:-1px;margin:16mm 0 8mm;max-width:130mm}.cover p{font:13px/1.8 Arial,sans-serif;letter-spacing:1px;color:#d2c5b1;max-width:105mm}.cover-footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #806d4f;padding-top:7mm;color:#c9b58e;font-size:9px;letter-spacing:1.6px}.catalog-sheet{height:273mm;position:relative;isolation:isolate;overflow:hidden;break-after:page;display:flex;flex-direction:column;padding:1mm 0}.catalog-sheet:before{z-index:-1;width:155mm;height:155mm;opacity:.055;top:52%}.catalog-sheet-header{height:12mm;border-bottom:1px solid #e7dfd2;display:flex;align-items:flex-start;justify-content:space-between;color:#725a36;font:11px Georgia,serif;letter-spacing:2px}.catalog-sheet-header small{font:8px Arial,sans-serif;letter-spacing:1.2px;color:#9b8c75}.fragrance-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8mm 7mm;padding:8mm 1mm}.fragrance-card{min-height:0;display:flex;flex-direction:column;border-bottom:1px solid #e7dfd2;padding:0 0 5mm;break-inside:avoid}.fragrance-image{height:65mm;min-height:65mm;background:linear-gradient(145deg,#f4f0e8,#e8e1d5);display:grid;place-items:center;overflow:hidden}.fragrance-image img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}.fragrance-image-placeholder{font:42px Georgia,serif;color:#bea77e}.fragrance-copy{padding:5mm 2mm 0;display:flex;flex-direction:column;align-items:flex-start}.fragrance-brand{font-size:8px;letter-spacing:2px;color:#9a7946;text-transform:uppercase}.fragrance-copy h2{font:22px/1.1 Georgia,"Times New Roman",serif;font-weight:400;margin:3mm 0 2mm;color:#27231f}.fragrance-detail{font-size:9px;color:#87785f;letter-spacing:.4px;margin:0 0 3mm}.fragrance-description{font-size:9px;line-height:1.5;color:#665d51;margin:0 0 3mm;max-height:25mm;overflow:hidden}.fragrance-price{font:16px Georgia,serif;color:#8b693b;margin:0 0 3mm}.fragrance-availability{margin-top:auto;font-size:8px;letter-spacing:1.2px;text-transform:uppercase;color:#59715d;border-top:1px solid #ddd5c8;padding-top:3mm}.catalog-sheet-footer{height:10mm;border-top:1px solid #e7dfd2;display:flex;align-items:flex-end;justify-content:space-between;color:#968a77;font-size:7px;letter-spacing:1.1px}.catalog-sheet:last-child{break-after:auto}@media screen{body{background:#eee7dc}.cover,.catalog-sheet{width:210mm;margin:10mm auto;background-color:#fff;box-shadow:0 12px 36px #30271924}.cover{background-color:#171b22}}' +
      '</style></head><body><section class="cover"><div><div class="cover-brand">JB PARFUMS</div><div class="cover-monogram">JB</div><h1>El arte de<br>dejar huella.</h1><p>UNA SELECCIÓN DE FRAGANCIAS PARA QUIENES HACEN DE CADA DETALLE UNA FIRMA PERSONAL.</p></div><div class="cover-footer"><span>CATÁLOGO DE FRAGANCIAS</span><span>' + esc(generated.toUpperCase()) + '</span></div></section>' +
      sheets.join('') + '</body></html>';
  }
  async function generateCatalogPDF() {
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      toast('El navegador bloqueó la ventana del catálogo. Permite ventanas emergentes para generar el PDF.');
      return;
    }
    printWindow.document.write('<!doctype html><title>Preparando catálogo JB PARFUMS…</title><p style="font:16px Arial;padding:30px">Preparando fotografías y diseño del catálogo…</p>');
    printWindow.document.close();
    if (permissionGranted('products.catalog.edit') && !await saveCatalogSettings(true)) {
      printWindow.close();
      toast(catalogSettingsError || 'No se pudo guardar la selección antes de generar el PDF.');
      return;
    }
    const eligible = products.filter(product => {
      const config = catalogConfigFor(product);
      return product.active !== false && config.published === true && Number(product.stock || 0) > 0 &&
        (state.catalogCategory === 'all' || String(product.category || 'Perfumería') === state.catalogCategory);
    });
    if (!eligible.length) {
      printWindow.close();
      toast('No hay productos publicados y con existencias en esta selección.');
      return;
    }
    if (eligible.length > 100) {
      printWindow.close();
      toast('La selección supera 100 fragancias. Filtra por categoría para generar un PDF más ligero.');
      return;
    }
    const includePrices = state.catalogShowPrices;
    const items = await Promise.all(eligible.map(async product => {
      const image = Array.isArray(product.images) ? product.images[0] : null;
      let printImage = null;
      if (image?.key) {
        try { printImage = await productAssetUrl(image.key); } catch (error) {
          console.warn('[catalog] Product photo unavailable:', product.sku, error?.message || 'asset error');
        }
      }
      return { ...product, printImage };
    }));
    const html = catalogPrintDocument(items, includePrices);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    try {
      await Promise.all(Array.from(printWindow.document.images || []).map(image =>
        image.complete ? Promise.resolve() : new Promise(resolve => {
          image.addEventListener('load', resolve, { once:true });
          image.addEventListener('error', resolve, { once:true });
        })
      ));
      if (printWindow.document.fonts?.ready) await printWindow.document.fonts.ready;
    } catch {}
    printWindow.focus();
    printWindow.print();
    toast('Catálogo listo. En la vista de impresión puedes guardarlo como PDF y compartirlo por WhatsApp.');
  }
  function formatResourceBytes(value) {
    const bytes = Math.max(0, Number(value || 0));
    if (bytes < 1024) return bytes + ' B';
    const units = ['KB','MB','GB','TB'];
    let size = bytes / 1024, index = 0;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return size.toFixed(size >= 100 ? 0 : 1) + ' ' + units[index];
  }
  function resourcePercent(value, threshold) {
    return Math.max(0, Math.min(100, Math.round((Number(value || 0) / threshold) * 100)));
  }
  function resourceLevel(percent) {
    return percent >= 95 ? 'is-critical' : percent >= 85 ? 'is-high' : percent >= 70 ? 'is-warning' : 'is-normal';
  }
  function updateResourceSidebarMetrics() {
    if (!resourceUsage) return;
    const dbBytes = Number(resourceUsage.database?.sizeBytes || 0);
    const r2Bytes = Number(resourceUsage.storage?.sizeBytes || 0);
    const dbPercent = resourcePercent(dbBytes, NEON_PREVENTIVE_THRESHOLD_BYTES);
    const r2Percent = resourcePercent(r2Bytes, R2_PREVENTIVE_THRESHOLD_BYTES);
    const dbText = document.getElementById('resource-sidebar-db');
    const r2Text = document.getElementById('resource-sidebar-r2');
    const dbBar = document.getElementById('resource-sidebar-db-bar');
    const r2Bar = document.getElementById('resource-sidebar-r2-bar');
    if (dbText) dbText.textContent = resourceUsage.database ? formatResourceBytes(dbBytes) : 'No disponible';
    if (r2Text) r2Text.textContent = resourceUsage.storage ? formatResourceBytes(r2Bytes) : 'No disponible';
    if (dbBar) { dbBar.style.width = dbPercent + '%'; dbBar.className = 'resource-mini-fill ' + resourceLevel(dbPercent); }
    if (r2Bar) { r2Bar.style.width = r2Percent + '%'; r2Bar.className = 'resource-mini-fill ' + resourceLevel(r2Percent); }
  }
  async function loadResourceUsage(force = false) {
    if (!force && resourceUsage && Date.now() - resourceUsageLoadedAt < RESOURCE_USAGE_TTL_MS) return resourceUsage;
    resourceUsageError = '';
    try {
      resourceUsage = await erpApi('resource-usage');
      resourceUsageLoadedAt = Date.now();
      updateResourceSidebarMetrics();
      return resourceUsage;
    } catch (error) {
      resourceUsageError = error?.message || 'No se pudo consultar el consumo.';
      resourceUsage = { database:null, storage:null };
      updateResourceSidebarMetrics();
      throw error;
    }
  }
  function renderResourceMetric(title, value, threshold, detail, errorText) {
    if (value == null) return '<article class="resource-card"><div class="resource-card-heading"><strong>' + title + '</strong><span class="resource-status is-unavailable">No disponible</span></div><p>' + esc(errorText || 'No fue posible obtener esta medición.') + '</p></article>';
    const percent = resourcePercent(value, threshold);
    return '<article class="resource-card"><div class="resource-card-heading"><strong>' + title + '</strong><span class="resource-status ' + resourceLevel(percent) + '">' + (percent >= 95 ? 'Crítico' : percent >= 85 ? 'Alto' : percent >= 70 ? 'Vigilar' : 'Estable') + '</span></div>' +
      '<div class="resource-number">' + formatResourceBytes(value) + '</div><div class="resource-track"><span class="resource-track-fill ' + resourceLevel(percent) + '" style="width:' + percent + '%"></span></div>' +
      '<div class="resource-card-foot"><span>' + percent + '% del umbral interno</span><span>Umbral: ' + formatResourceBytes(threshold) + '</span></div><p>' + esc(detail) + '</p></article>';
  }
  function renderResourceMonitor() {
    const usage = resourceUsage;
    const db = usage?.database || null, r2 = usage?.storage || null;
    const timestamp = usage?.updatedAt ? new Date(usage.updatedAt).toLocaleString('es-NI', {dateStyle:'short',timeStyle:'short'}) : 'Sin consulta todavía';
    const dbDetail = db ? Number(db.activeConnections || 0) + ' conexiones activas · ' + Number(db.transactionsCommitted || 0).toLocaleString('es-NI') + ' transacciones confirmadas desde el último reinicio de estadísticas.' : 'Las métricas de Neon no están disponibles.';
    const r2Detail = r2 ? Number(r2.objectCount || 0).toLocaleString('es-NI') + ' objetos contabilizados' + (r2.complete ? ' en el bucket.' : ' · medición parcial: se alcanzó el límite de exploración.') : 'No se pudo listar el contenido del bucket R2.';
    const error = resourceUsageError ? '<div class="notice-panel"><span>' + svg('warning') + '</span><div><strong>No se pudo actualizar</strong><p>' + esc(resourceUsageError) + '</p></div></div>' : '';
    return heading(views.resources, '<button type="button" class="button button-primary" data-action="refresh-resource-usage">' + svg('arrow') + ' Actualizar medición</button>') +
      '<div class="resource-snapshot-meta"><span>Última medición: ' + esc(timestamp) + '</span><span>Consulta manual · sin sondeo continuo</span></div>' + error +
      '<section class="resource-metric-grid">' +
        renderResourceMetric('Neon PostgreSQL', db ? db.sizeBytes : null, NEON_PREVENTIVE_THRESHOLD_BYTES, dbDetail, usage?.errors?.database || 'Consulta el monitor para obtener el tamaño actual.') +
        renderResourceMetric('Cloudflare R2', r2 ? r2.sizeBytes : null, R2_PREVENTIVE_THRESHOLD_BYTES, r2Detail, usage?.errors?.storage || 'Consulta el monitor para obtener el tamaño actual.') +
      '</section>' +
      '<section class="resource-secondary-grid"><article class="resource-card resource-service-card"><div class="resource-card-heading"><strong>Cloudflare Workers</strong><span class="resource-status is-normal">API activa</span></div><p>La API responde a esta consulta. Las métricas de solicitudes y CPU no están conectadas a Analytics API; no se muestran estimaciones.</p></article>' +
      '<article class="resource-card resource-service-card"><div class="resource-card-heading"><strong>GitHub Actions</strong><span class="resource-status is-unavailable">Métricas no conectadas</span></div><p>El historial de workflows está disponible, pero los minutos facturables requieren consultar la API de facturación de GitHub con acceso autorizado.</p><a href="https://github.com/JASBH121101/ERP-Perfume/actions" target="_blank" rel="noopener noreferrer">Abrir ejecuciones de GitHub Actions ↗</a></article></section>' +
      '<div class="notice-panel resource-monitor-note"><span>' + svg('warning') + '</span><div><strong>Cómo leer estas barras</strong><p>Los umbrales de 512 MB para Neon y 2 GB para R2 son referencias preventivas internas configurables; no representan el límite de tu plan ni generan cargos por sí mismos. La lectura R2 puede indicarse como parcial si el bucket supera 10.000 objetos.</p></div></div>';
  }
  function renderInventoryMovementResults() {
    const query=String(state.inventoryMovementQuery||'').trim().toLocaleLowerCase('es');
    const startDate=state.inventoryMovementStartDate||'',endDate=state.inventoryMovementEndDate||'';
    const ordered=inventoryMovements.slice().sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
    const localFiltered=ordered.filter(m=>{
      const searchable=[m.productName,m.sku,m.note,m.type,m.sourceId].filter(Boolean).join(' ').toLocaleLowerCase('es');
      if(query&&!searchable.includes(query))return false;
      if(state.inventoryMovementType!=='all'&&String(m.type||'')!==state.inventoryMovementType)return false;
      const date=new Date(m.createdAt),key=Number.isNaN(date.getTime())?'':date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
      if(startDate&&(!key||key<startDate))return false;
      if(endDate&&(!key||key>endDate))return false;
      return true;
    });
    const serverPage=Array.isArray(inventoryMovementPageRows);
    const filtered=serverPage?inventoryMovementPageRows:localFiltered;
    const total=serverPage?Number(inventoryMovementTotal||0):localFiltered.length;
    const pageSize=state.inventoryMovementPageSize,totalPages=Math.max(1,Math.ceil(total/pageSize));
    state.inventoryMovementPage=Math.min(Math.max(1,Number(state.inventoryMovementPage)||1),totalPages);
    const offset=(state.inventoryMovementPage-1)*pageSize;
    const pageRows=(serverPage?filtered:filtered.slice(offset,offset+pageSize)).map(m=>{
      const date=new Date(m.createdAt),dateLabel=Number.isNaN(date.getTime())?'Fecha no disponible':date.toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'});
      const delta=Number(m.delta||0),deltaLabel=delta>0?'+'+delta:String(delta);
      const traceStatus=m.type==='Reversion'?'Reversión registrada':(m.alreadyReversed?'Movimiento revertido':'');
      const canReverse=permissionGranted('inventory.movements.reverse')&&m.sourceType==='manual'&&m.type!=='Reversion'&&!m.alreadyReversed;
      const reverseAction=canReverse?'<button class="button button-quiet button-small" type="button" data-action="reverse-inventory-movement" data-id="'+esc(m.id)+'">Revertir</button>':'';
      return '<tr data-movement-id="'+esc(m.id)+'"><td data-label="Fecha">'+esc(dateLabel)+'</td><td data-label="Perfume"><span class="table-primary">'+esc(m.productName)+'</span><small class="table-secondary">'+esc(m.sku||'')+'</small></td><td data-label="Tipo">'+esc(m.type)+'</td><td data-label="Variación" class="table-primary">'+deltaLabel+' uds.</td><td data-label="Stock resultante">'+Number(m.previousStock||0)+' → '+Number(m.newStock||0)+'</td><td data-label="Responsable">'+esc(m.actorName||'No disponible')+'</td><td data-label="Proveedor / orden">'+esc(m.supplierName||'—')+(m.purchaseOrderNumber?'<small class="table-secondary">OC '+esc(m.purchaseOrderNumber)+'</small>':'')+'</td><td data-label="Nota">'+esc(m.note||'—')+(traceStatus?'<small class="table-secondary">'+esc(traceStatus)+'</small>':'')+reverseAction+'</td></tr>';
    }).join('');
    const rangeStart=total?offset+1:0,rangeEnd=Math.min(offset+pageSize,total);
    const empty=inventoryMovementPageError||(total?'No hay movimientos que coincidan con los filtros.':'Todavía no hay movimientos registrados.');
    const emptyRow=inventoryMovementLoading?'':'<tr><td colspan="6"><div class="empty-state">'+esc(empty)+'</div></td></tr>';
    return '<div class="table-wrap"><table class="data-table inventory-ledger-table"><thead><tr><th>FECHA</th><th>PRODUCTO</th><th>TIPO</th><th>VARIACIÓN</th><th>STOCK RESULTANTE</th><th>RESPONSABLE</th><th>PROVEEDOR / ORDEN</th><th>NOTA</th></tr></thead><tbody id="inventory-movement-body">'+(pageRows||emptyRow.replace('colspan="6"','colspan="8"'))+'</tbody></table></div>'+
      '<div class="inventory-ledger-footer"><span class="inventory-ledger-range">Mostrando '+rangeStart+'–'+rangeEnd+' de '+total+' movimientos · Página '+state.inventoryMovementPage+' de '+totalPages+(serverPage?' · consultados en Neon':' · vista inicial')+'</span>'+
      '<div class="inventory-ledger-pagination"><button class="button button-quiet button-small" type="button" data-action="inventory-page" data-page="previous" '+(state.inventoryMovementPage<=1?'disabled':'')+'>Anterior</button>'+
      '<span class="ledger-count">Página '+state.inventoryMovementPage+' de '+totalPages+'</span>'+
      '<button class="button button-quiet button-small" type="button" data-action="inventory-page" data-page="next" '+(state.inventoryMovementPage>=totalPages?'disabled':'')+'>Siguiente</button></div></div>';
  }
  function refreshInventoryMovementResults() {
    const container=document.getElementById('inventory-movement-results');
    if(container)container.innerHTML=renderInventoryMovementResults();
    const total=document.getElementById('inventory-movement-total');
    if(total&&inventoryMovementTotal!=null)total.textContent=Number(inventoryMovementTotal).toLocaleString('es-NI')+' movimientos';
  }
  async function loadInventoryMovementPage() {
    if(state.view!=='inventory' ||
      !["inventory.receipts.view","purchases.receipts.view","inventory.manual_out.view","inventory.adjustments.view","inventory.movements.reverse"].some(permissionGranted))return;
    const requestId=++inventoryMovementRequestId;
    const params=new URLSearchParams({
      page:String(state.inventoryMovementPage),page_size:String(state.inventoryMovementPageSize),
      search:state.inventoryMovementQuery,type:state.inventoryMovementType,actor:state.inventoryMovementActor,supplier:state.inventoryMovementSupplier,
      from:state.inventoryMovementStartDate,to:state.inventoryMovementEndDate
    });
    inventoryMovementLoading=true;
    inventoryMovementPageError='';
    inventoryMovementPageRows=[];
    // Preserve the last known total while the requested page is loading; render clamps the page against it.
    refreshInventoryMovementResults();
    try{
      const data=await erpApi('inventory-movements?'+params.toString());
      if(requestId!==inventoryMovementRequestId||state.view!=='inventory')return;
      const total=Number(data.total||0),totalPages=Math.max(1,Number(data.totalPages||1));
      inventoryMovementLoading=false;
      if(state.inventoryMovementPage>totalPages){state.inventoryMovementPage=totalPages;return loadInventoryMovementPage();}
      inventoryMovementPageRows=(data.records||[]).map(m=>({
        id:m.id,productId:m.product_id,productName:m.product_name,sku:m.sku,type:m.movement_type,
        quantity:Number(m.quantity||0),delta:Number(m.quantity_delta||0),
        previousStock:Number(m.previous_stock||0),newStock:Number(m.new_stock||0),
        actorUserId:m.actor_user_id||'',actorName:m.actor_name||'',supplierName:m.supplier_name||'',purchaseOrderNumber:m.purchase_order_number||'',
        note:m.note||'',sourceType:m.reference_type||'',sourceId:m.reference_id||'',alreadyReversed:m.already_reversed===true,createdAt:m.created_at
      }));
      inventoryMovementTotal=total;
      refreshInventoryMovementResults();
    }catch(error){
      if(requestId!==inventoryMovementRequestId)return;
      inventoryMovementLoading=false;
      inventoryMovementPageRows=[];
      inventoryMovementTotal=0;
      inventoryMovementPageError=error?.message||'No se pudo consultar el historial en Neon.';
      refreshInventoryMovementResults();
    }
  }
  async function loadInventorySummary() {
    if(state.view!=='inventory')return;
    try{
      const data=await erpApi('inventory-summary');
      if(state.view!=='inventory')return;
      inventorySummary=data.summary||null;
      const active=document.getElementById('inventory-summary-active');
      const units=document.getElementById('inventory-summary-units');
      const restock=document.getElementById('inventory-summary-restock');
      const out=document.getElementById('inventory-summary-out');
      if(active)active.textContent=Number(inventorySummary?.activeProducts||0).toLocaleString('es-NI');
      if(units)units.textContent=Number(inventorySummary?.totalUnits||0).toLocaleString('es-NI');
      if(restock)restock.textContent=(Number(inventorySummary?.lowStock||0)+Number(inventorySummary?.outOfStock||0)).toLocaleString('es-NI');
      if(out)out.textContent=Number(inventorySummary?.outOfStock||0).toLocaleString('es-NI');
      refreshInventoryCategoryOptions(data.categories||[]);
    }catch(error){
      const note=document.getElementById('inventory-summary-error');
      if(note)note.textContent=error?.message||'No se pudo actualizar el resumen desde Neon.';
    }
  }
  function refreshInventoryCategoryOptions(serverCategories) {
    const select=document.getElementById('inventory-product-category');
    if(!select)return;
    const categories=Array.from(new Set([...(serverCategories||[]),...products.map(p=>p.category).filter(Boolean)]))
      .filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'es'));
    select.innerHTML='<option value="all">Todas las categorías</option>'+categories.map(category=>
      '<option value="'+esc(category)+'"'+(state.inventoryProductCategory===category?' selected':'')+'>'+esc(category)+'</option>'
    ).join('');
  }
  async function loadInventoryStockPage() {
    if(state.view!=='inventory')return;
    const requestId=++inventoryStockRequestId;
    const params=new URLSearchParams({
      page:String(state.inventoryStockPage),page_size:String(state.inventoryStockPageSize),
      search:state.inventoryProductQuery,category:state.inventoryProductCategory==='all'?'':state.inventoryProductCategory,
      status:state.inventoryProductStock
    });
    inventoryStockLoading=true;
    inventoryStockPageError='';
    inventoryStockPageRows=[];
    inventoryStockTotal=0;
    renderInventoryProductRows();
    try{
      const data=await erpApi('inventory-stock?'+params.toString());
      if(requestId!==inventoryStockRequestId||state.view!=='inventory')return;
      const total=Number(data.total||0),totalPages=Math.max(1,Number(data.totalPages||1));
      inventoryStockLoading=false;
      if(state.inventoryStockPage>totalPages){state.inventoryStockPage=totalPages;return loadInventoryStockPage();}
      inventoryStockPageRows=(data.records||[]).map(p=>({
        id:p.id,name:p.name,sku:p.sku,brand:p.brand||'',category:p.category||'',stock:Number(p.stock||0),
        minStock:Number(p.min_stock??3),location:p.location||'',barcode:p.barcode||'',tone:p.tone||'',
        active:p.active!==false
      }));
      inventoryStockTotal=total;
      renderInventoryProductRows();
    }catch(error){
      if(requestId!==inventoryStockRequestId)return;
      inventoryStockLoading=false;
      inventoryStockPageRows=[];
      inventoryStockTotal=0;
      inventoryStockPageError=error?.message||'No se pudieron consultar las existencias.';
      renderInventoryProductRows();
    }
  }
  function renderInventoryLedger() {
    const types = [['all', 'Todos los movimientos'], ['Entrada', 'Entradas'], ['Salida', 'Salidas'], ['Ajuste', 'Ajustes'], ['Devolucion', 'Devoluciones'], ['Reversion', 'Reversiones']];
    const typeOptions = types.map(item => '<option value="' + item[0] + '"' + (state.inventoryMovementType === item[0] ? ' selected' : '') + '>' + item[1] + '</option>').join('');
    const movementCount=inventoryMovementTotal==null?inventoryMovements.length:Number(inventoryMovementTotal);
    const currentYear=new Date().getFullYear();
    const archiveYears=Array.from({length:6},(_,index)=>currentYear-index).map(year=>
      '<details class="inventory-archive-year" '+(year===currentYear?'open':'')+'><summary>'+year+'</summary><div class="inventory-archive-months">'+
      Array.from({length:12},(_,monthIndex)=>{
        const startValue=year+'-'+String(monthIndex+1).padStart(2,'0')+'-01';
        const lastDay=new Date(year,monthIndex+1,0).getDate();
        const endValue=year+'-'+String(monthIndex+1).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');
        const label=new Date(year,monthIndex,1).toLocaleDateString('es-NI',{month:'long'});
        const selected=state.inventoryMovementStartDate===startValue&&state.inventoryMovementEndDate===endValue;
        return '<button type="button" class="inventory-archive-month'+(selected?' is-active':'')+'" data-action="inventory-month-filter" data-start="'+startValue+'" data-end="'+endValue+'">'+label+'</button>';
      }).join('')+'</div></details>'
    ).join('');
    return '<article class="list-panel ledger-panel inventory-ledger-panel"><div class="panel-heading"><div><h2>Historial de movimientos</h2><p>Consulta por período, responsable, proveedor y tipo; filtros combinables en Neon.</p></div><span class="ledger-count" id="inventory-movement-total">'+movementCount.toLocaleString('es-NI')+' movimientos</span></div>'+
      '<details class="inventory-archive"><summary>'+svg('clock')+' Archivo mensual <span>Selecciona un mes para consultar su historial completo</span></summary><div class="inventory-archive-years">'+archiveYears+'</div></details>'+
      '<div class="toolbar products-toolbar inventory-ledger-toolbar"><div class="toolbar-left"><label class="inline-search">'+svg('search')+'<input id="inventory-movement-search" type="search" value="'+esc(state.inventoryMovementQuery)+'" placeholder="Producto, SKU o documento" aria-label="Buscar en el kardex"></label></div>'+
      '<div class="toolbar-right"><select class="filter-select" id="inventory-movement-type" aria-label="Filtrar movimientos por tipo">'+typeOptions+'</select>'+
      '<input class="filter-select" id="inventory-movement-actor" type="search" value="'+esc(state.inventoryMovementActor)+'" placeholder="Responsable" aria-label="Filtrar por responsable">'+
      '<input class="filter-select" id="inventory-movement-supplier" type="search" value="'+esc(state.inventoryMovementSupplier)+'" placeholder="Proveedor" aria-label="Filtrar por proveedor">'+
      '<input class="filter-select" type="date" id="inventory-movement-start" value="'+esc(state.inventoryMovementStartDate)+'" aria-label="Desde fecha">'+
      '<input class="filter-select" type="date" id="inventory-movement-end" value="'+esc(state.inventoryMovementEndDate)+'" aria-label="Hasta fecha">'+
      '<button class="button button-quiet button-small" type="button" data-action="clear-inventory-filters">Limpiar filtros</button></div></div>'+
      '<div id="inventory-movement-results">'+renderInventoryMovementResults()+'</div></article>';
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
    const filtered=Array.isArray(inventoryStockPageRows)?inventoryStockPageRows:filteredInventoryProducts();
    const total=inventoryStockTotal==null?products.filter(p=>p.active!==false).length:Number(inventoryStockTotal);
    const count=document.getElementById('inventory-product-count');
    const body=document.getElementById('inventory-product-body');
    const pagination=document.getElementById('inventory-stock-pagination');
    const pages=Math.max(1,Math.ceil(total/state.inventoryStockPageSize));
    const start=total?(state.inventoryStockPage-1)*state.inventoryStockPageSize+1:0;
    const end=Math.min(state.inventoryStockPage*state.inventoryStockPageSize,total);
    if(count)count.textContent='Mostrando '+start+'–'+end+' de '+total+' productos';
    if(body)body.innerHTML=filtered.map(product=>{
      const suggestion=Number(product.stock)===0?'Reposición urgente':(needsRestock(product)?'Revisar reposición':'Nivel estable');
      return '<tr><td data-label="Perfume"><div class="product-cell">'+art(product.tone)+'<span><span class="table-primary">'+esc(product.name)+'</span><small class="table-secondary">'+esc(product.sku)+' · Mín. '+Number(product.minStock??3)+'</small></span></div></td><td data-label="Categoría">'+esc(product.category || '—')+'</td><td data-label="Stock actual" class="table-primary">'+Number(product.stock||0)+' unidades</td><td data-label="Estado">'+status(Number(product.stock||0),Number(product.minStock??3))+'</td><td data-label="Reposición"><span class="table-secondary">'+suggestion+'</span></td><td data-label="Consulta"><div class="table-actions"><button class="table-action" type="button" data-action="inventory-view-product" data-id="'+esc(product.id)+'" aria-label="Consultar existencias de '+esc(product.name)+'" title="Consultar existencias">'+svg('eye')+'</button></div></td></tr>';
    }).join('')||(inventoryStockLoading?'':'<tr><td colspan="6"><div class="empty-state">'+esc(inventoryStockPageError||'No hay productos que coincidan con los filtros.')+'</div></td></tr>');
    if(pagination){
      const footer=document.createElement('div');
      footer.className='inventory-ledger-footer';
      const rangeLabel=document.createElement('span');
      rangeLabel.className='inventory-ledger-range';
      rangeLabel.textContent='Página '+state.inventoryStockPage+' de '+pages;
      const controls=document.createElement('div');
      controls.className='inventory-ledger-pagination';
      const previous=document.createElement('button');
      previous.className='button button-quiet button-small';
      previous.type='button';
      previous.dataset.action='inventory-stock-page';
      previous.dataset.page='previous';
      previous.disabled=state.inventoryStockPage<=1;
      previous.textContent='Menos stock';
      const count=document.createElement('span');
      count.className='ledger-count';
      count.textContent=start+'–'+end+' / '+total;
      const next=document.createElement('button');
      next.className='button button-quiet button-small';
      next.type='button';
      next.dataset.action='inventory-stock-page';
      next.dataset.page='next';
      next.disabled=state.inventoryStockPage>=pages;
      next.textContent='Más stock';
      controls.append(previous,count,next);
      footer.append(rangeLabel,controls);
      pagination.replaceChildren(footer);
    }
  }
  function renderInventory() {
    const activeProducts=products.filter(p=>p.active!==false);
    const categories=Array.from(new Set(activeProducts.map(p=>p.category).filter(Boolean))).sort((x,y)=>x.localeCompare(y,'es'));
    const categoryOptions=categories.map(category=>'<option value="'+esc(category)+'"'+(state.inventoryProductCategory===category?' selected':'')+'>'+esc(category)+'</option>').join('');
    const rows=filteredInventoryProducts().map(product=>{
      const suggestion=product.stock===0?'Reposición urgente':(needsRestock(product)?'Revisar reposición':'Nivel estable');
      return '<tr><td data-label="Perfume"><div class="product-cell">'+art(product.tone)+'<span><span class="table-primary">'+esc(product.name)+'</span><small class="table-secondary">'+esc(product.sku)+' · Mín. '+Number(product.minStock??3)+'</small></span></div></td><td data-label="Categoría">'+esc(product.category||'—')+'</td><td data-label="Stock actual" class="table-primary">'+Number(product.stock||0)+' unidades</td><td data-label="Estado">'+status(Number(product.stock||0),Number(product.minStock??3))+'</td><td data-label="Reposición"><span class="table-secondary">'+suggestion+'</span></td><td data-label="Consulta"><div class="table-actions"><button class="table-action" type="button" data-action="inventory-view-product" data-id="'+esc(product.id)+'" aria-label="Consultar existencias de '+esc(product.name)+'" title="Consultar existencias">'+svg('eye')+'</button></div></td></tr>';
    }).join('');
    const summary=inventorySummary||{};
    const restockCount=summary.lowStock==null||summary.outOfStock==null
      ? activeProducts.filter(needsRestock).length
      : Number(summary.lowStock)+Number(summary.outOfStock);
    return heading(views.inventory,'')+
      '<div class="inventory-page-actions"></div>'+
      '<div class="summary-strip inventory-summary-strip"><div class="summary-mini"><span>Referencias activas</span><strong id="inventory-summary-active">'+Number(summary.activeProducts??activeProducts.length).toLocaleString('es-NI')+'</strong></div><div class="summary-mini"><span>Unidades en stock</span><strong id="inventory-summary-units">'+Number(summary.totalUnits??activeProducts.reduce((sum,p)=>sum+p.stock,0)).toLocaleString('es-NI')+'</strong></div><div class="summary-mini"><span>Para reponer</span><strong id="inventory-summary-restock">'+Number(restockCount).toLocaleString('es-NI')+'</strong></div><div class="summary-mini"><span>Agotados</span><strong id="inventory-summary-out">'+(summary.outOfStock==null?'—':Number(summary.outOfStock).toLocaleString('es-NI'))+'</strong></div></div><p class="form-hint" id="inventory-summary-error" role="status"></p>'+
      '<article class="list-panel inventory-stock-panel"><div class="toolbar products-toolbar inventory-products-toolbar"><div class="toolbar-left"><label class="inline-search">'+svg('search')+'<input id="inventory-product-search" type="search" value="'+esc(state.inventoryProductQuery)+'" placeholder="Nombre, SKU, código o ubicación" aria-label="Buscar productos en existencias"></label></div><div class="toolbar-right"><select class="filter-select" id="inventory-product-category" aria-label="Categoría de existencias"><option value="all">Todas las categorías</option>'+categoryOptions+'</select><select class="filter-select" id="inventory-product-stock" aria-label="Estado de existencias"><option value="all"'+(state.inventoryProductStock==='all'?' selected':'')+'>Todos los estados</option><option value="available"'+(state.inventoryProductStock==='available'?' selected':'')+'>Disponibles</option><option value="low"'+(state.inventoryProductStock==='low'?' selected':'')+'>Stock bajo</option><option value="out"'+(state.inventoryProductStock==='out'?' selected':'')+'>Agotados</option></select><button class="button button-quiet button-small" type="button" data-action="clear-inventory-product-filters">Limpiar</button></div></div><div class="inventory-products-meta"><span id="inventory-product-count">'+rows.length+' de '+activeProducts.length+' productos</span><span>Ordenados por menor existencia · consulta paginada</span></div><div class="table-wrap"><table class="data-table inventory-stock-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK</th><th>ESTADO</th><th>ACCIÓN SUGERIDA</th><th>CONSULTA</th></tr></thead><tbody id="inventory-product-body">'+(rows||'<tr><td colspan="6"><div class="empty-state">No hay productos que coincidan con los filtros.</div></td></tr>')+'</tbody></table></div><div id="inventory-stock-pagination"></div></article>'+
      (["inventory.receipts.view","purchases.receipts.view","inventory.manual_out.view","inventory.adjustments.view","inventory.movements.reverse"].some(permissionGranted)?renderInventoryLedger():"")+
      '<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Stock mínimo configurable por producto · Kardex íntegro</strong><p>Las existencias y el historial se consultan directamente en Neon, con totales y paginación del lado del servidor. Las salidas se bloquean si generan stock negativo; cada movimiento conserva el saldo anterior, la variación y el saldo resultante.</p></div></div>';
  }
  function openInventoryReversalDialog(movementId) {
    if (!permissionGranted('inventory.movements.reverse')) {
      toast('Tu cuenta no tiene permiso para revertir movimientos.');
      return;
    }
    const movement = [...(inventoryMovementPageRows || []), ...(inventoryMovements || [])]
      .find(item => String(item.id) === String(movementId));
    const sourceType = movement?.sourceType || movement?.reference_type || '';
    const movementType = movement?.type || movement?.movement_type || '';
    if (!movement || sourceType !== 'manual' || movementType === 'Reversion' || movement.alreadyReversed === true) {
      toast('Solo se pueden revertir movimientos manuales que todavía no tengan reversión.');
      return;
    }
    inventoryReversalForm.dataset.movementId = String(movement.id);
    inventoryReversalForm.elements.reason.value = '';
    document.getElementById('inventory-reversal-summary').textContent =
      (movement.productName || movement.product_name || 'Producto') + ' · ' + movementType + ' · ' +
      (Number(movement.delta ?? movement.quantity_delta) > 0 ? '+' : '') +
      Number(movement.delta ?? movement.quantity_delta) + ' unidades';
    if (typeof inventoryReversalDialog.showModal === 'function') inventoryReversalDialog.showModal();
  }
  function showInventoryProductDetails(productId) {
    const product = [...(inventoryStockPageRows || []), ...products].find(function (item) { return String(item.id) === String(productId); });
    if (!product) return;
    const fields = [
      ['SKU / Código', product.sku],
      ['Categoría', product.category],
      ['Existencia actual', Number(product.stock || 0) + ' unidades'],
      ['Stock mínimo', Number(product.minStock ?? 3) + ' unidades'],
      ['Estado', product.stock === 0 ? 'Agotado' : (needsRestock(product) ? 'Stock bajo' : 'Disponible')],
      ['Ubicación', product.location]
    ];
    document.getElementById('product-detail-title').textContent = product.name;
    document.getElementById('product-detail-content').innerHTML =
      '<div class="detail-grid inventory-detail-grid">' + fields.map(function (field) {
        return '<div class="detail-field"><span>' + esc(field[0]) + '</span><strong>' + esc(field[1] || '—') + '</strong></div>';
      }).join('') + '</div>' +
      '<p class="detail-notes">Consulta de existencias. Los movimientos se registran desde una operación autorizada.</p>';
    const editButton = document.getElementById('edit-detail-product');
    if (editButton) editButton.hidden = true;
    if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
  }
  function showProductDetails(productId) {
    const product = products.find(function (item) { return String(item.id) === String(productId); });
    if (!product) return;
    const editButton = document.getElementById('edit-detail-product');
    if (editButton) editButton.hidden = false;
    const costs = costSummary(product);
    const fields = [
      ['Marca', product.brand], ['SKU', product.sku], ['Categoría', product.category],
      ...(String(product.concentration || '').trim() ? [['Concentración', String(product.concentration).trim()]] : []), ['Género', product.gender], ['Familia olfativa', product.family],
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
  function buildCurrentExportDataset(){
    const title=state.view==='hr'?'RR. HH. · '+({employees:'Personal',attendance:'Asistencia',leaves:'Permisos',payroll:'Nómina'}[state.hrTab]||'Personal'):(views[state.view]?.title||'Exportación');
    const fileBase='jb-parfums-'+(state.view==='hr'?'rrhh-'+state.hrTab:state.view);
    let headers=[],rows=[];
    if(state.view==='dashboard'){
      const finance=financialSnapshot();
      const active=products.filter(p=>p.active!==false);
      headers=['Indicador','Valor','Unidad'];
      rows=[
        ['Productos activos',active.length,'productos'],
        ['Unidades en inventario',active.reduce((sum,p)=>sum+Number(p.stock||0),0),'unidades'],
        ['Productos por reponer',active.filter(needsRestock).length,'productos'],
        ['Pedidos registrados',orders.length,'pedidos'],
        ['Facturas registradas',invoices.length,'facturas'],
        ['Ventas facturadas',finance.revenue,'USD'],
        ['Cobros recibidos',invoices.reduce((sum,i)=>sum+Number(i.paidUsd||0),0),'USD'],
        ['Utilidad bruta',finance.grossProfit,'USD'],
        ['Resultado después de gastos',finance.netProfit,'USD']
      ];
    }else if(state.view==='products'){
      headers=['SKU','Producto','Marca','Categoría','Concentración','Género','Familia olfativa','Contenido ml','Precio USD','Costo unitario USD','Utilidad estimada USD','Margen %','Stock','Stock mínimo','Ubicación','Estado'];
      rows=filteredProducts().map(p=>{const costs=costSummary(p);return [p.sku,p.name,p.brand,p.category,p.concentration,p.gender,p.family,p.sizeMl,p.price,costs.unitCost,costs.profit,roundMoney(costs.margin),p.stock,p.minStock,p.location,p.active===false?'Inactivo':'Activo'];});
    }else if(state.view==='inventory'){
      headers=['Tipo de registro','SKU','Producto','Categoría / tipo','Fecha','Variación / stock','Stock mínimo / anterior','Estado / stock nuevo','Ubicación / nota'];
      rows=filteredInventoryProducts().map(p=>['Existencia',p.sku,p.name,p.category,'',p.stock,p.minStock,p.stock===0?'Agotado':(needsRestock(p)?'Stock bajo':'Disponible'),p.location||'']);
      const query=String(state.inventoryMovementQuery||'').trim().toLocaleLowerCase('es');
      const startDate=state.inventoryMovementStartDate||'',endDate=state.inventoryMovementEndDate||'';
      const movements=inventoryMovements.slice().sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).filter(m=>{
        const searchable=[m.productName,m.sku,m.note,m.type,m.sourceId].filter(Boolean).join(' ').toLocaleLowerCase('es');
        if(query&&!searchable.includes(query))return false;
        if(state.inventoryMovementType!=='all'&&String(m.type||'')!==state.inventoryMovementType)return false;
        const date=new Date(m.createdAt),key=Number.isNaN(date.getTime())?'':date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
        if(startDate&&(!key||key<startDate))return false;
        if(endDate&&(!key||key>endDate))return false;
        return true;
      });
      movements.forEach(m=>rows.push(['Movimiento',m.sku,m.productName,m.type,dateText(m.createdAt),Number(m.delta||0),Number(m.previousStock||0),Number(m.newStock||0),m.note||'']));
    }else if(state.view==='orders'){
      headers=['Pedido','Cliente','Fecha','Total USD','Método de pago','Estado del pago','Moneda cobrada','Importe cobrado','Estado del pedido'];
      rows=orders.map(o=>[o.id,o.customer,o.date,o.amount,o.paymentMethod,o.paymentStatus,o.paymentCurrency,o.paymentAmount,o.status]);
    }else if(state.view==='customers'){
      headers=['Cliente','Contacto','Teléfono','Correo','Tipo','Pedidos','Total pedidos USD','Desde','Estado'];
      rows=customers.map(c=>[c.name,c.contact,c.phone,c.email,c.customerType,c.orders,c.spent,c.since,c.active===false?'Inactivo':'Activo']);
    }else if(state.view==='billing'||state.view==='receivables'){
      const records=state.view==='receivables'?invoices.filter(i=>Number(i.totalUsd||0)-Number(i.paidUsd||0)>0.001):invoices;
      headers=['Factura','Cliente','Fecha','Origen','Moneda','Tipo de cambio','Total USD','Pagado USD','Saldo USD','Estado','Método de pago','Cantidad de abonos'];
      rows=records.map(i=>[i.id,i.customer||i.customerName,dateText(i.createdAt),i.source,i.currency,i.exchangeRate,i.totalUsd,i.paidUsd,Math.max(0,Number(i.totalUsd||0)-Number(i.paidUsd||0)),i.status,i.paymentMethod,(i.payments||[]).length]);
    }else if(state.view==='hr'){
      const employeeName=id=>employees.find(e=>String(e.id)===String(id))?.name||'Colaborador';
      if(state.hrTab==='employees'){
        headers=['Código','Colaborador','Cargo','Departamento','Teléfono','Correo','Salario mensual NIO','Fecha de ingreso','Estado','Usuario vinculado'];
        rows=employees.map(e=>[e.employeeCode,e.name,e.position,e.department,e.phone,e.email,e.salaryNio,e.hireDate,e.status,e.linkedUserId||'']);
      }else if(state.hrTab==='attendance'){
        headers=['Fecha','Colaborador','Entrada','Salida','Descanso minutos','Estado','Notas'];
        rows=attendanceRecords.map(a=>[dateText(a.workDate),employeeName(a.employeeId),a.checkIn,a.checkOut,a.breakMinutes,a.status,a.notes]);
      }else if(state.hrTab==='leaves'){
        headers=['Colaborador','Tipo de permiso','Desde','Hasta','Días','Motivo','Estado','Fecha de revisión'];
        rows=leaveRequests.map(l=>[employeeName(l.employeeId),l.leaveType,dateText(l.startDate),dateText(l.endDate),l.days,l.reason,l.status,dateText(l.reviewedAt)]);
      }else if(state.hrTab==='payroll'){
        headers=['Período','Colaborador','Salario base NIO','Bonos NIO','Deducciones NIO','Salario neto NIO','Estado del período','Fecha de pago','Notas'];
        rows=payrollItems.map(item=>{
          const period=payrollPeriods.find(p=>String(p.id)===String(item.payrollPeriodId));
          return [period?dateText(period.periodStart)+' – '+dateText(period.periodEnd):item.payrollPeriodId,employeeName(item.employeeId),item.baseSalaryNio,item.bonusesNio,item.deductionsNio,item.netSalaryNio,period?.status||'',dateText(period?.paymentDate),item.notes];
        });
        if(!rows.length)rows=payrollPeriods.map(p=>[dateText(p.periodStart)+' – '+dateText(p.periodEnd),'',0,0,0,0,p.status,dateText(p.paymentDate),p.notes]);
      }
    }else if(state.view==='dgi'){
      const dgi=getDgiBookRows();headers=dgi[0]||[];rows=dgi.slice(1);
    }else if(state.view==='analytics'){
      const finance=financialSnapshot(),supplierPayables=calculatePayablesSnapshot(purchases,supplierInvoices,roundMoney);
      const inventoryValue=products.reduce((sum,p)=>sum+Number(p.unitCost||0)*Number(p.stock||0),0);
      const potential=products.reduce((sum,p)=>sum+Math.max(0,costSummary(p).profit)*Number(p.stock||0),0);
      headers=['Indicador','USD','Descripción'];
      rows=[
        ['Ventas facturadas',finance.revenue,'Incluye entrega'],
        ['Venta neta de productos',finance.productNetSales,'Después de descuentos'],
        ['Ingresos por entrega',finance.deliveryIncome,'Ingresos de entrega'],
        ['Costo de ventas',finance.costOfSales,'Costo guardado en las facturas'],
        ['Utilidad bruta',finance.grossProfit,'Antes de gastos operativos'],
        ['Gastos operativos',finance.operatingExpenses,'Gastos registrados'],
        ['Resultado después de gastos',finance.netProfit,'No representa utilidad fiscal'],
        ['Cobros recibidos',invoices.reduce((sum,i)=>sum+Number(i.paidUsd||0),0),'Pagos registrados'],
        ['Valor del inventario',inventoryValue,'A costo unitario'],
        ['Margen potencial del stock',potential,'Estimación sobre existencias actuales'],
        ['Cuentas por cobrar',invoices.reduce((sum,i)=>sum+Math.max(0,Number(i.totalUsd||0)-Number(i.paidUsd||0)),0),'Saldos pendientes'],
        ['Cuentas por pagar',supplierPayables.total,'Proveedores y compras anteriores']
      ];
    }else if(state.view==='settings'){
      headers=['Parámetro','Valor'];
      rows=[['Sistema','JB PARFUMS ERP'],['Entorno de base de datos','Neon Development'],['Moneda base','USD'],['Tipo de cambio vigente',exchangeRate],['Rol de la cuenta',window.JBAuth?.profile?.role||'']];
    }else if(state.view==='purchases'){
      headers=['Compra','Proveedor','Fecha','Moneda','Importe original','Tipo de cambio','Total USD','Pagado USD','Saldo USD','Estado'];
      rows=purchases.map(p=>[p.purchaseNumber,p.supplier,dateText(p.createdAt),p.currency,p.originalTotal,p.exchangeRate,p.totalUsd,p.paidUsd,Math.max(0,p.totalUsd-p.paidUsd),p.status]);
    }else if(state.view==='purchaseOrders'){
      headers=['Tipo de documento','Orden','Recepción','Factura proveedor','Proveedor','Fecha','Entrega estimada','Moneda','Tipo de cambio','Subtotal USD','Descuento USD','Flete USD','Impuestos USD','Total USD','Código de compra','Comprobante diario','Estado','Condición de pago','Emitido por','Contabilizado por','Notas'];
      const orderRows=filteredPurchaseOrders().map(p=>[
        'Orden de compra',p.orderNumber,'','','',dateText(p.createdAt),dateText(p.expectedDate),p.currency,p.exchangeRate,
        p.subtotalUsd,p.discountUsd,p.freightUsd,p.taxesUsd,p.totalUsd,'','',''+p.status,p.paymentTerms,
        p.createdByName||'',p.approvedByName||'',p.notes||''
      ]);
      const receiptRows=filteredPurchaseReceipts().map(r=>{
        const order=purchaseOrders.find(p=>String(p.id)===String(r.purchase_order_id));
        return [
          'Recepción',order?.orderNumber||'',r.receiptNumber||r.receipt_number||'',r.supplier_invoice_number||'',
          order?.supplier||'',dateText(r.supplier_invoice_date||r.emitted_at||r.received_at),
          dateText(order?.expectedDate),r.invoice_currency||order?.currency||'',
          Number(r.invoice_exchange_rate||order?.exchangeRate||0), '', '',r.actual_freight_usd||0,r.actual_taxes_usd||0,
          Number(r.invoice_total_usd||0),r.purchase_code||'',r.journal_number||'',
          r.documentStatus||r.document_status||'Contabilizada',r.payment_terms_snapshot||order?.paymentTerms||'',
          r.emitted_by_name||r.emittedByName||'',r.posted_by_name||r.postedByName||'',r.notes||''
        ];
      });
      rows=[...orderRows,...receiptRows];
    }else if(state.view==='payables'){
      headers=['Tipo de documento','Referencia','Proveedor','Fecha','Vencimiento','Moneda','Total USD','Pagado USD','Saldo USD','Estado'];
      rows=[
        ...supplierInvoices.map(i=>['Factura proveedor',i.invoiceNumber,i.supplier,dateText(i.invoiceDate),dateText(i.dueDate),i.currency,i.amountUsd,i.paidUsd,Math.max(0,i.amountUsd-i.paidUsd),i.status]),
        ...purchases.filter(p=>Number(p.totalUsd||0)-Number(p.paidUsd||0)>0.001).map(p=>['Compra anterior',p.purchaseNumber,p.supplier,dateText(p.createdAt),'',p.currency,p.totalUsd,p.paidUsd,Math.max(0,p.totalUsd-p.paidUsd),p.paidUsd>0?'Abono parcial':'Pendiente'])
      ];
    }else if(state.view==='suppliers'){
      headers=['Proveedor','Contacto','Teléfono','Correo','Moneda habitual','Compras vinculadas','Saldo por pagar USD','Estado'];
      rows=suppliers.map(s=>[s.name,s.contact,s.phone,s.email,s.currency,purchases.filter(p=>p.supplier===s.name).length,supplierPayablesUsd(s),s.active===false?'Inactivo':'Activo']);
    }else if(state.view==='expenses'){
      headers=['Fecha','Categoría','Descripción','Moneda','Importe original','Tipo de cambio','Equivalente USD'];
      rows=expenses.map(e=>[dateText(e.createdAt),e.category,e.description,e.currency,e.originalAmount,e.exchangeRate,e.amountUsd]);
    }else if(state.view==='cash'){
      headers=['Fecha','Dirección','Concepto','Cuenta','Moneda','Importe original','Tipo de cambio','Equivalente USD','Referencia'];
      rows=cashEntries.map(e=>[dateText(e.createdAt),e.direction==='income'?'Entrada':'Salida',e.concept,e.account,e.currency,e.originalAmount,e.exchangeRate,e.amountUsd,[e.sourceType,e.sourceId].filter(Boolean).join(' · ')]);
    }
    return {title,fileBase,headers,rows};
  }
  function renderExportActions(){
    return '<div class="export-actions"><button type="button" class="button button-quiet export-trigger" data-action="toggle-export-menu" aria-haspopup="true" aria-expanded="false" aria-controls="current-export-menu">'+svg('download')+' Exportar</button>'+
      '<div class="export-menu" id="current-export-menu" role="menu" aria-label="Formatos de exportación" hidden>'+
      '<button type="button" role="menuitem" data-action="export-current-view" data-format="csv">CSV <small>.csv · Compatible</small></button>'+
      '<button type="button" role="menuitem" data-action="export-current-view" data-format="excel">Excel <small>.xls · Abre en Excel</small></button>'+
      '<button type="button" role="menuitem" data-action="export-current-view" data-format="pdf">PDF / Imprimir <small>Vista A4 para guardar como PDF</small></button>'+
      '</div></div>';
  }
  async function fetchAllInventoryPages(resource,filterParams) {
    const pageSize=100,maxRows=25000;
    const params=new URLSearchParams(filterParams||{});
    params.set('page','1');params.set('page_size',String(pageSize));
    const first=await erpApi(resource+'?'+params.toString());
    const total=Number(first.total||0),totalPages=Math.max(1,Math.ceil(total/pageSize));
    if(total>maxRows)throw new Error('La consulta contiene '+total.toLocaleString('es-NI')+' registros. Reduce los filtros a 25,000 o menos para generar una exportación completa.');
    const records=Array.isArray(first.records)?first.records.slice():[];
    for(let start=2;start<=totalPages;start+=5){
      const pages=Array.from({length:Math.min(5,totalPages-start+1)},(_,index)=>start+index);
      const responses=await Promise.all(pages.map(async page=>{
        const pageParams=new URLSearchParams(params);pageParams.set('page',String(page));
        return erpApi(resource+'?'+pageParams.toString());
      }));
      for(const response of responses){
        if(Number(response.total||0)!==total)throw new Error('Los datos cambiaron mientras se preparaba la exportación. Vuelve a intentarlo para obtener un archivo consistente.');
        records.push(...(Array.isArray(response.records)?response.records:[]));
      }
    }
    if(records.length!==total)throw new Error('La exportación no recibió todos los registros de Neon; no se generó un archivo parcial.');
    return records;
  }
  async function buildInventoryExportDataset() {
    const stockParams=new URLSearchParams({
      search:state.inventoryProductQuery,
      category:state.inventoryProductCategory==='all'?'':state.inventoryProductCategory,
      status:state.inventoryProductStock
    });
    const movementParams=new URLSearchParams({
      search:state.inventoryMovementQuery,
      type:state.inventoryMovementType,
      actor:state.inventoryMovementActor,
      supplier:state.inventoryMovementSupplier,
      from:state.inventoryMovementStartDate,
      to:state.inventoryMovementEndDate
    });
    const stockRecords=await fetchAllInventoryPages('inventory-stock',stockParams);
    let movementRecords=[];
    if(["inventory.receipts.view","purchases.receipts.view","inventory.manual_out.view","inventory.adjustments.view"].some(permissionGranted)){
      movementRecords=await fetchAllInventoryPages('inventory-movements',movementParams);
    }
    const headers=['Tipo de registro','SKU','Producto','Categoría / tipo','Fecha','Variación / stock','Stock mínimo / anterior','Estado / stock nuevo','Responsable','Proveedor','Orden de compra','Ubicación / nota'];
    const rows=stockRecords.map(p=>{
      const stock=Number(p.stock||0),minimum=Number(p.min_stock??0);
      const statusLabel=stock===0?'Agotado':(stock<=minimum?'Stock bajo':'Disponible');
      return ['Existencia',p.sku,p.name,p.category,'',stock,minimum,statusLabel,'','','',p.location||''];
    });
    movementRecords.forEach(m=>rows.push([
      'Movimiento',m.sku,m.product_name,m.movement_type,dateText(m.created_at),
      Number(m.quantity_delta||0),Number(m.previous_stock||0),Number(m.new_stock||0),m.actor_name||'',m.supplier_name||'',m.purchase_order_number||'',m.note||''
    ]));
    return {
      title:'Inventario · Existencias y kardex',
      fileBase:'jb-parfums-inventory',
      headers,rows
    };
  }
  async function exportCurrentView(format){
    if(!canExportERPView(state.view)){toast('Tu cuenta no tiene permiso para exportar esta sección.');return;}
    try{
      const dataset=state.view==='inventory'?await buildInventoryExportDataset():buildCurrentExportDataset();
      if(!dataset.headers.length){toast('Esta sección todavía no tiene una estructura de exportación.');return;}
      if(!dataset.rows.length){toast('No hay registros disponibles para exportar con los filtros actuales.');return;}
      if(format==='pdf'){
        if(!openPrintExport(dataset)){toast('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio e inténtalo de nuevo.');return;}
        toast('Documento preparado. Selecciona “Guardar como PDF” en el diálogo de impresión.');
      }else{
        const filename=downloadExport(dataset,format||'csv');
        toast((format==='excel'?'Archivo de Excel generado: ':'Archivo CSV generado: ')+filename);
      }
    }catch(error){toast(error?.message||'No se pudo generar la exportación.');}
  }
  async function renderInventoryCsv(){return exportCurrentView('csv');}
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
    const titles={customer:'Nuevo cliente',supplier:'Nuevo proveedor',order:'Nuevo pedido',purchase:'Registrar compra','supplier-invoice':'Registrar factura de proveedor','supplier-invoice-payment':'Registrar pago a proveedor',expense:'Registrar gasto',cash:'Registrar recibo o pago','cash-account':'Nueva cuenta de caja o banco',invoice:'Nueva factura',payment:'Registrar abono',employee:recordId?'Editar colaborador':'Agregar colaborador','employee-history':'Historial del colaborador',attendance:'Registrar asistencia',leave:'Nueva solicitud de permiso o vacaciones','payroll-period':'Crear período de nómina','payroll-item':'Agregar partida de nómina','payroll-payment':'Pagar período de nómina'};
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
    if(type==='supplier-invoice'){
      if(!suppliers.length){toast('Registra primero un proveedor.');return;}
      const supplierOpts=suppliers.filter(item=>item.active!==false).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('');
      const orderOpts=purchaseOrders.filter(item=>['Confirmada','Recepción parcial','Recibida'].includes(item.status)).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.orderNumber)+' · '+esc(item.supplier)+'</option>').join('');
      const today=new Date().toISOString().slice(0,10);
      body='<div class="form-grid">'+selectField('Proveedor','supplierId','<option value="">Seleccionar proveedor</option>'+supplierOpts,true)+selectField('Orden de compra relacionada (opcional)','purchaseOrderId','<option value="">Sin orden vinculada</option>'+orderOpts,false)+formField('Número de factura del proveedor','invoiceNumber','text',true,'maxlength="100"')+formField('Fecha de factura','invoiceDate','date',true,'value="'+today+'"')+formField('Fecha de vencimiento','dueDate','date',false,'')+currencyField('USD')+formField('Tipo de cambio','exchangeRate','number',true,'min="0.0001" step="0.0001" value="'+Number(exchangeRate).toFixed(4)+'"')+formField('Importe total de factura','originalAmount','number',true,'min="0.01" step="0.01"')+formField('Notas','notes','text',false,'maxlength="1000"')+'</div><p class="form-helper">Esta factura registra la deuda real documentada por el proveedor. No vuelve a ingresar inventario: la mercancía se registra desde la recepción física de la orden.</p>';
    }
    if(type==='supplier-invoice-payment'){
      const invoice=supplierInvoices.find(item=>String(item.id)===String(recordId));
      if(!invoice){toast('No se encontró la factura del proveedor.');return;}
      const balance=Math.max(0,invoice.amountUsd-invoice.paidUsd);
      if(balance<=0.001){toast('Esta factura ya está pagada.');return;}
      body='<div class="form-grid"><div class="detail-field full-field"><span>'+esc(invoice.supplier)+' · Factura '+esc(invoice.invoiceNumber)+'</span><strong>Saldo pendiente: '+money(balance)+' USD</strong><small>Importe original: '+moneyInCurrency(invoice.originalAmount,invoice.currency)+' · Vence: '+dateText(invoice.dueDate)+'</small></div><input type="hidden" name="currency" value="'+esc(invoice.currency)+'">'+formField('Importe del pago ('+invoice.currency+')','amount','number',true,'min="0.01" step="0.01"')+selectField('Cuenta de salida','account',cashAccountOptions(invoice.currency),true)+formField('Referencia de pago','paymentReference','text',false,'maxlength="160"')+'</div><p class="form-helper">El pago actualiza el saldo de esta factura y registra una salida en Caja y bancos. No modifica existencias ni el costo del producto.</p>';
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
        selectField('Vendedor que realizó la venta','salespersonEmployeeId','<option value="">Sin comisión asignada</option>'+employees.filter(e=>e.status==='Activo'&&e.commissionEnabled&&e.commissionRate>0).map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+' · '+Number(e.commissionRate).toFixed(2)+'%</option>').join(''),false)+
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
    if(type==='employee'){
      const employee=recordId?employees.find(item=>String(item.id)===String(recordId)):null;
      const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
      const selectedCommission=employee?.commissionEnabled===true;
      const contractType=employee?.contractType||'Por definir';
      const workSchedule=employee?.workSchedule||'Por definir';
      const contractTypeOptions=['Por definir','Indefinido','Temporal'].map(value=>'<option value="'+value+'" '+(contractType===value?'selected':'')+'>'+value+'</option>').join('');
      const workScheduleOptions=['Por definir','Completa','Parcial'].map(value=>'<option value="'+value+'" '+(workSchedule===value?'selected':'')+'>'+value+'</option>').join('');
      const contractStartDate=employee?.contractStartDate||employee?.hireDate||today;
      const contractEndDate=employee?.contractEndDate||'';
      const commissionOptions='<option value="false" '+(!selectedCommission?'selected':'')+'>No</option><option value="true" '+(selectedCommission?'selected':'')+'>Sí</option>';
      const statusOptions=['Activo','Inactivo','Suspendido'].map(status=>'<option value="'+status+'" '+((employee?.status||'Activo')===status?'selected':'')+'>'+status+'</option>').join('');
      body=(employee?'<div class="employee-code-banner"><span>CÓDIGO DE EMPLEADO</span><strong>'+esc(employee.employeeCode||'Código pendiente')+'</strong><small>Identificador permanente. No cambia con ascensos ni traslados.</small></div>':'<div class="employee-code-banner"><span>CÓDIGO DE EMPLEADO</span><strong>Asignación automática</strong><small>Se genera en PostgreSQL al guardar el registro.</small></div>')+
        '<div class="form-grid">'+
        formField('Nombre del colaborador','name','text',true,'maxlength="80" autocomplete="name" value="'+esc(employee?.name||'')+'"')+
        formField('Correo electrónico','email','email',false,'maxlength="180" autocomplete="email" value="'+esc(employee?.email||'')+'"')+
        formField('Número de celular','phone','tel',false,'maxlength="40" autocomplete="tel" inputmode="tel" value="'+esc(employee?.phone||'')+'"')+
        formField('Cargo','position','text',true,'maxlength="80" value="'+esc(employee?.position||'')+'"')+
        formField('Departamento','department','text',false,'maxlength="60" value="'+esc(employee?.department||'')+'"')+
        (employee?'<div class="detail-field"><span>Fecha original de ingreso</span><strong>'+dateText(employee.hireDate)+'</strong><small>La antigüedad total se conserva aunque cambie de puesto.</small></div>':formField('Fecha de ingreso','hireDate','date',true,'value="'+today+'"'))+
        selectField('Tipo de contrato','contractType',contractTypeOptions,true)+
        selectField('Jornada laboral','workSchedule',workScheduleOptions,true)+
        formField('Inicio del contrato','contractStartDate','date',true,'value="'+esc(contractStartDate)+'"')+
        '<div id="employee-contract-end-field" class="full-field" '+(contractType!=='Temporal'?'hidden':'')+'>'+formField('Fin del contrato','contractEndDate','date',contractType==='Temporal','min="'+esc(contractStartDate)+'" value="'+esc(contractEndDate)+'"')+'</div>'+
        formField('Salario mensual (C$)','salaryNio','number',true,'min="0" step="0.01" value="'+Number(employee?.salaryNio||0)+'"')+
        selectField('¿Gana comisión?','commissionEnabled',commissionOptions,true)+
        '<div id="employee-commission-rate-field" class="full-field" '+(!selectedCommission?'hidden':'')+'>'+formField('Porcentaje de comisión (%)','commissionRate','number',false,'min="0.01" max="100" step="0.01" value="'+(selectedCommission?Number(employee.commissionRate).toFixed(2):'3')+'"')+'</div>'+
        (employee?selectField('Estado laboral','status',statusOptions,true):'<input type="hidden" name="status" value="Activo">')+
        (employee?formField('Fecha efectiva del cambio','effectiveDate','date',true,'value="'+today+'"'):'')+
        (employee?formField('Motivo del cambio','changeReason','text',false,'maxlength="300" placeholder="Ascenso, traslado, ajuste salarial, baja..."'):'')+
        '</div>'+
        '<p class="form-helper">Correo y celular son opcionales; puedes completarlos después.</p>'+
        '<p class="form-helper">Los cambios de cargo, salario, comisión, contrato y jornada se registran con fecha efectiva y motivo.</p>'+
        '<p class="form-helper">La fecha original de ingreso no se modifica al ascender o trasladar al colaborador.</p>'+
        '<p class="form-helper">Las nóminas cerradas conservan sus importes históricos.</p>';
    }
    if(type==='employee-history'){
      const today=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
      const employee=employees.find(item=>String(item.id)===String(recordId));
      if(!employee){toast('No se encontró el colaborador.');return;}
      const history=employeeHistory.filter(item=>String(item.employeeId)===String(employee.id)).sort((a,b)=>String(b.effectiveDate||'').localeCompare(String(a.effectiveDate||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
      const historyRows=history.map(item=>{
        const label=item.eventType==='position'?'Cambio de puesto / departamento':item.eventType==='compensation'?'Cambio salarial o de comisión':item.eventType==='status'?'Cambio de estado':item.eventType==='contract'?'Cambio de contrato / jornada':'Alta inicial';
        const detail=item.eventType==='position'?'De '+(item.fromPosition||'—')+' a '+(item.toPosition||'—')+' · '+(item.toDepartment||'Sin departamento'):
          item.eventType==='compensation'?'Salario: '+moneyInCurrency(item.fromSalaryNio||0,'NIO')+' → '+moneyInCurrency(item.toSalaryNio||0,'NIO')+' · Comisión: '+Number(item.toCommissionRate||0).toFixed(2)+'%':
          item.eventType==='status'?'Estado: '+(item.fromStatus||'—')+' → '+(item.toStatus||'—'):
          item.eventType==='contract'?'Contrato: '+(item.fromContractType||'—')+' → '+(item.toContractType||'—')+' · Jornada: '+(item.fromWorkSchedule||'—')+' → '+(item.toWorkSchedule||'—')+' · Vigencia: '+dateText(item.toContractStartDate)+' – '+(item.toContractEndDate?dateText(item.toContractEndDate):'Sin fecha de finalización'):
          'Registro inicial del colaborador';
        return '<div class="employee-history-item"><div class="employee-history-date">'+dateText(item.effectiveDate)+'</div><div><strong>'+label+'</strong><p>'+esc(detail)+'</p><small>'+esc(item.reason||'Sin observaciones')+'</small></div></div>';
      }).join('');
      const documentRows=employeeDocuments.filter(item=>String(item.employeeId)===String(employee.id)).map(item=>
        '<div class="employee-document-row"><div><strong>'+esc(item.fileName)+'</strong><small>'+esc(item.documentType)+' · '+(item.fileSize/1024).toFixed(0)+' KB · '+dateText(item.createdAt)+'</small></div><button type="button" class="button button-quiet button-small" data-action="download-employee-document" data-id="'+esc(item.id)+'">Descargar</button></div>'
      ).join('');
      body='<div class="employee-profile-summary"><div><span>COLABORADOR</span><strong>'+esc(employee.name)+'</strong><small>'+esc(employee.employeeCode||'Código pendiente')+' · '+esc(employee.position)+'</small></div><div><span>ANTIGÜEDAD TOTAL</span><strong>'+esc(calculateTenure(employee.hireDate,today).label)+'</strong></div></div>'+
        '<div class="employee-history-section"><h3>Historial laboral</h3>'+(historyRows||'<p class="form-helper">Todavía no hay movimientos históricos registrados.</p>')+'</div>'+
        '<div class="employee-history-section"><h3>Expediente digital</h3>'+(documentRows||'<p class="form-helper">Todavía no hay documentos adjuntos.</p>')+
        '<div class="employee-document-upload"><label class="form-field"><span>Tipo de documento</span><select id="employee-document-type"><option>Contrato</option><option>Identificación</option><option>Constancia</option><option>Otro</option></select></label><label class="form-field"><span>Archivo PDF, JPG o PNG (máximo 5 MB)</span><input id="employee-document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></label><button type="button" class="button button-primary" data-action="upload-employee-document" data-id="'+esc(employee.id)+'">Adjuntar documento</button></div></div>'+
        '<p class="form-helper">Los archivos se guardan en almacenamiento privado. Solo personal con permisos de RR. HH. puede consultarlos.</p>'+
        '<div class="employee-history-actions"><button type="button" class="button button-quiet" data-action="edit-employee" data-id="'+esc(employee.id)+'">Editar colaborador</button></div>';
    }
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
      body='<div class="form-grid">'+selectField('Tipo de período','periodType','<option value="Ordinaria" selected>Nómina ordinaria</option><option value="Aguinaldo">Aguinaldo · decimotercer mes</option>',true)+formField('Inicio del período','periodStart','date',true,'')+formField('Fin del período','periodEnd','date',true,'')+formField('Fecha prevista de pago','paymentDate','date',false,'')+formField('Tasa USD/NIO para comisiones','commissionExchangeRate','number',true,'min="0.0001" step="0.0001" value="'+Number(exchangeRate).toFixed(4)+'"')+formField('Notas','notes','text',false,'maxlength="250"')+'</div><p class="form-helper">El período se crea en estado Borrador. En nómina ordinaria se calculan comisiones e INSS. En Aguinaldo, el sistema calcula el proporcional del decimotercer mes por separado.</p>';
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
      const periodOptions=available.map(p=>'<option value="'+p.id+'" data-period-type="'+esc(p.periodType||'Ordinaria')+'">'+(p.periodType==='Aguinaldo'?'Aguinaldo · ':'Ordinaria · ')+dateText(p.periodStart)+' – '+dateText(p.periodEnd)+'</option>').join('');
      const firstPeriod=available[0];
      const employeeOptions=employees.filter(e=>e.status==='Activo').map(e=>'<option value="'+e.id+'" data-salary="'+Number(e.salaryNio||0)+'">'+esc(e.name)+' · '+moneyInCurrency(e.salaryNio,'NIO')+'</option>').join('');
      const initialSalary=firstPeriod?.periodType==='Aguinaldo'?0:Number(employees.find(e=>e.status==='Activo')?.salaryNio||0);
      const isAguinaldo=firstPeriod?.periodType==='Aguinaldo';
      body='<div class="form-grid">'+selectField('Período de nómina','payrollPeriodId',periodOptions,true)+selectField('Colaborador','employeeId',employeeOptions,true)+formField('Salario base (C$)','baseSalaryNio','number',true,'min="0" step="0.01" value="'+initialSalary+'"')+formField('Bonos (C$)','bonusesNio','number',false,'min="0" step="0.01" value="0"')+formField('Deducciones (C$)','deductionsNio','number',false,'min="0" step="0.01" value="0"')+formField('Notas','notes','text',false,'maxlength="250"')+'</div><p class="form-helper" id="payroll-item-help">'+(isAguinaldo?'El sistema calcula el decimotercer mes proporcional usando el ciclo laboral y el salario que corresponda; el aguinaldo está exento de INSS.':'El servidor calcula el INSS del trabajador y patronal, e incorpora las comisiones pendientes de ventas dentro de este período.')+'</p>';
    }
    document.getElementById('business-modal-title').textContent=titles[type]||(type==='purchase-payment'?'Abonar compra':'Nuevo registro');
    document.getElementById('business-form-body').innerHTML=body;businessForm.dataset.recordType=type;businessForm.dataset.recordId=recordId||'';
    const secureHR=type==='employee'&&window.JBAuth&&window.JBAuth.mode==='authenticated';
    document.querySelector('#business-dialog .eyebrow').textContent=window.JBAuth?.profile?'GESTIÓN · NEON DEVELOPMENT':'ACCESO REQUERIDO';
    document.getElementById('business-save').textContent=type==='invoice'?'Generar factura':(type==='supplier-invoice'?'Registrar factura':(type==='supplier-invoice-payment'?'Registrar pago':(type==='payment'||type==='purchase-payment'?'Registrar abono':(type==='employee-history'?'Cerrar':(recordId&&type==='employee'?'Guardar cambios':'Guardar en Neon')))));
    document.getElementById('business-save').hidden=type==='employee-history';
    if(type==='employee'){
      const contractSelect=businessForm.querySelector('[name="contractType"]');
      const contractStartInput=businessForm.querySelector('[name="contractStartDate"]');
      const contractEndField=businessForm.querySelector('#employee-contract-end-field');
      const contractEndInput=businessForm.querySelector('[name="contractEndDate"]');
      const syncContractFields=()=>{
        const temporary=contractSelect?.value==='Temporal';
        if(contractEndField)contractEndField.hidden=!temporary;
        if(contractEndInput){
          contractEndInput.disabled=!temporary;
          contractEndInput.required=temporary;
          contractEndInput.min=contractStartInput?.value||'';
          if(!temporary)contractEndInput.value='';
        }
      };
      contractSelect?.addEventListener('change',syncContractFields);
      contractStartInput?.addEventListener('change',()=>{
        if(contractEndInput){
          contractEndInput.min=contractStartInput.value||'';
          if(contractEndInput.value&&contractEndInput.value<contractStartInput.value)contractEndInput.value='';
        }
      });
      syncContractFields();
      const commissionSelect=businessForm.querySelector('[name="commissionEnabled"]');
      const commissionField=businessForm.querySelector('#employee-commission-rate-field');
      const commissionInput=businessForm.querySelector('[name="commissionRate"]');
      const syncCommissionField=()=>{
        const enabled=commissionSelect?.value==='true';
        if(commissionField)commissionField.hidden=!enabled;
         if(commissionInput){
           commissionInput.disabled=!enabled;
           commissionInput.required=enabled;
           if(!enabled)commissionInput.value='';
           else if(!commissionInput.value)commissionInput.value='3';
         }
      };
      commissionSelect?.addEventListener('change',syncCommissionField);
      syncCommissionField();
    }
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
      } else if(type==='supplier-invoice'){
        const supplier=suppliers.find(item=>String(item.id)===get('supplierId'));
        const amount=num('originalAmount'),invoiceDate=get('invoiceDate'),dueDate=get('dueDate'),invoiceNumber=get('invoiceNumber');
        const invoiceRate=num('exchangeRate');
        if(!supplier||!invoiceNumber||!invoiceDate||!Number.isFinite(amount)||amount<=0||!Number.isFinite(invoiceRate)||invoiceRate<=0)throw new Error('Revisa proveedor, número, fecha e importe de la factura.');
        if(dueDate&&dueDate<invoiceDate)throw new Error('La fecha de vencimiento no puede ser anterior a la fecha de factura.');
        const orderId=get('purchaseOrderId')||null;
        if(orderId){const order=purchaseOrders.find(item=>String(item.id)===orderId);if(!order||String(order.supplierId)!==String(supplier.id))throw new Error('La orden seleccionada no corresponde al proveedor.');}
        await erpApi('supplier-invoices',{method:'POST',body:JSON.stringify({supplier_id:supplier.id,purchase_order_id:orderId,invoice_number:invoiceNumber,invoice_date:invoiceDate,due_date:dueDate||null,currency,exchange_rate:invoiceRate,original_amount:amount,notes:get('notes')||null})});
      } else if(type==='supplier-invoice-payment'){
        const invoice=supplierInvoices.find(item=>String(item.id)===String(businessForm.dataset.recordId));
        const amount=num('amount'),accountName=get('account'),paymentCurrency=get('currency');
        if(!invoice||!accountName||!Number.isFinite(amount)||amount<=0)throw new Error('Revisa la factura, la cuenta y el importe.');
        const amountUsd=toUsd(amount,paymentCurrency);
        if(amountUsd>Math.max(0,invoice.amountUsd-invoice.paidUsd)+0.001)throw new Error('El pago supera el saldo pendiente de la factura.');
        const account=cashAccounts.find(item=>item.name===accountName&&item.currency===paymentCurrency&&item.active!==false);
        if(!account)throw new Error('La cuenta de salida no existe o no coincide con la moneda de la factura.');
        await erpApi('supplier-invoice-payments',{method:'POST',body:JSON.stringify({supplier_invoice_id:invoice.id,account_id:account.id,currency:paymentCurrency,original_amount:amount,exchange_rate:exchangeRate,amount_usd:amountUsd,payment_reference:get('paymentReference')||null})});
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
          salesperson_employee_id:get('salespersonEmployeeId')||null,
          items,original_payment_amount:received,account_name:paidUsd>0?account:null
        })});
      } else if(type==='employee'){
        const salary=num('salaryNio'),commissionEnabled=get('commissionEnabled')==='true',commissionRate=commissionEnabled?num('commissionRate'):0;
        const contractType=get('contractType')||'Por definir',workSchedule=get('workSchedule')||'Por definir';
        const email=get('email').trim().toLowerCase(),rawPhone=get('phone').trim(),phoneDigits=rawPhone.replace(/\D/g,'');
        let phone='';
        if(rawPhone){
          if(rawPhone.startsWith('+')&&phoneDigits.length>=8&&phoneDigits.length<=15)phone='+'+phoneDigits;
          else if(phoneDigits.startsWith('00')&&phoneDigits.length>=10&&phoneDigits.length<=17)phone='+'+phoneDigits.slice(2);
          else if(phoneDigits.startsWith('505')&&phoneDigits.length===11)phone='+'+phoneDigits;
          else if(phoneDigits.length===8)phone='+505'+phoneDigits;
          else throw new Error('Introduce un celular nicaragüense de 8 dígitos o un número internacional con código de país (por ejemplo, +505 8888 8888).');
        }
        if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Introduce un correo electrónico válido.');
        if(!get('name')||!get('position')||!Number.isFinite(salary)||salary<0||
          (commissionEnabled&&(!Number.isFinite(commissionRate)||commissionRate<=0||commissionRate>100)))throw new Error('Revisa nombre, cargo, salario y porcentaje de comisión.');
        if(!['Por definir','Indefinido','Temporal'].includes(contractType)||!['Por definir','Completa','Parcial'].includes(workSchedule))throw new Error('Selecciona un tipo de contrato y una jornada válidos.');
        const employeeId=businessForm.dataset.recordId||'';
        const original=employeeId?employees.find(item=>String(item.id)===String(employeeId)):null;
        const contractStartDate=get('contractStartDate')||(original?.contractStartDate||original?.hireDate||get('hireDate'))||null;
        const contractEndDate=contractType==='Temporal'?(get('contractEndDate')||null):null;
        if(!contractStartDate)throw new Error('Selecciona la fecha de inicio del contrato.');
        if(contractType==='Temporal'&&(!contractEndDate||contractEndDate<contractStartDate))throw new Error('Un contrato temporal necesita una fecha de finalización igual o posterior al inicio.');
        const payload={name:get('name'),email:email||null,phone:phone||null,position:get('position'),department:get('department')||null,
          salary_nio:salary,status:get('status')||'Activo',commission_enabled:commissionEnabled,commission_rate:commissionRate,
          contract_type:contractType,work_schedule:workSchedule,contract_start_date:contractStartDate,contract_end_date:contractEndDate};
        if(employeeId){
          const materialChange=original&&(original.position!==payload.position||original.department!==payload.department||
            Number(original.salaryNio)!==salary||original.commissionEnabled!==commissionEnabled||
            Number(original.commissionRate)!==commissionRate||original.status!==payload.status||
            original.contractType!==contractType||original.workSchedule!==workSchedule||
            original.contractStartDate!==contractStartDate||original.contractEndDate!==contractEndDate);
          if(materialChange&&!get('effectiveDate'))throw new Error('Selecciona la fecha efectiva del cambio.');
          payload.effective_date=get('effectiveDate');
          payload.change_reason=get('changeReason')||'Actualización de datos personales';
          await erpApi('employees/'+encodeURIComponent(employeeId),{method:'PATCH',body:JSON.stringify(payload)});
        }else{
          if(!get('hireDate'))throw new Error('Selecciona la fecha de ingreso.');
          payload.hire_date=get('hireDate');
          await erpApi('employees',{method:'POST',body:JSON.stringify(payload)});
        }
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
        if(!startDate||!endDate||endDate<startDate||!Number.isFinite(num('commissionExchangeRate'))||num('commissionExchangeRate')<=0)throw new Error('Revisa las fechas y la tasa USD/NIO para comisiones.');
        await erpApi('hr_payroll_periods',{method:'POST',body:JSON.stringify({
          period_start:startDate,period_end:endDate,period_type:get('periodType')==='Aguinaldo'?'Aguinaldo':'Ordinaria',payment_date:paymentDate||null,commission_exchange_rate:num('commissionExchangeRate'),status:'Borrador',notes:get('notes')||null
        })});
      } else if(type==='payroll-item'){
        const periodId=get('payrollPeriodId'),employeeId=get('employeeId');
        const base=num('baseSalaryNio'),bonus=num('bonusesNio'),deductions=num('deductionsNio');
        if(!periodId||!employeeId||![base,bonus,deductions].every(Number.isFinite)||base<0||bonus<0||deductions<0)throw new Error('Revisa período, colaborador, salario, bonos y deducciones.');
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
          'supplier-invoice':'Factura de proveedor registrada. El saldo pendiente ya está en cuentas por pagar.',
          'supplier-invoice-payment':'Pago aplicado a la factura del proveedor y salida registrada en caja/banco.',
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
      if(button){button.disabled=false;button.textContent=type==='invoice'?'Generar factura':(type==='supplier-invoice'?'Registrar factura':(type==='supplier-invoice-payment'?'Registrar pago':(type==='payment'||type==='purchase-payment'?'Registrar abono':'Guardar en Neon')));}
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
  function dateTimeText(value){
    if(!value)return '—';
    const d=new Date(value);
    return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-NI',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
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
    if(!auth||auth.mode!=='authenticated'||!auth.profile||!canViewERPView('hr'))return;
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
    if(backendMode&&!hrRecordsLoaded){
      if(!hrRecordsLoading&&!hrLoadAttempted)loadHRFromAPI(false);
      const message=hrLoadError||'Consultando los registros protegidos de Neon…';
      return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>RR. HH. · Neon Development</strong><p>'+esc(message)+'</p>'+(hrLoadError?'<button class="button button-quiet button-small" data-action="reload-hr">Reintentar</button>':'')+'</div></div>';
    }
    const activeEmployees=employees.filter(e=>e.status==='Activo');
    const activeCommissions=hrCommissions.filter(c=>['Pendiente','Asignada'].includes(c.status));
    const totalPayroll=payrollItems.reduce((sum,item)=>sum+Number(item.netSalaryNio||0),0);
    const now=new Date();
    const today=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
    const monthlyOrdinarySalaries=(employeeId,cycleEnd)=>{
      const totals=new Map();
      const cycleEndDate=cycleEnd?new Date(cycleEnd+'T00:00:00Z'):null;
      const cutoff=cycleEndDate?new Date(Date.UTC(cycleEndDate.getUTCFullYear(),cycleEndDate.getUTCMonth()-5,1)):null;
      const cutoffText=cutoff?cutoff.toISOString().slice(0,10):'0000-01-01';
      payrollItems.filter(item=>String(item.employeeId)===String(employeeId)).forEach(item=>{
        const period=payrollPeriods.find(p=>String(p.id)===String(item.payrollPeriodId));
        if(!period||period.status!=='Pagada'||period.periodType!=='Ordinaria'||!period.periodEnd||
           String(period.periodEnd)<cutoffText||String(period.periodEnd)>String(cycleEnd||'9999-12-31'))return;
        const month=String(period.periodEnd).slice(0,7);
        const value=Number(item.baseSalaryNio||0)+Number(item.bonusesNio||0)+Number(item.commissionsNio||0);
        totals.set(month,(totals.get(month)||0)+value);
      });
      return [...totals.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([,value])=>Number(value.toFixed(2)));
    };
    const vacationFor=(employee)=>calculateVacationBalance({
      hireDate:employee.hireDate,leaveRequests,employeeId:employee.id,asOf:today
    });
    const aguinaldoFor=(employee)=>{
      const cycle=calculateAguinaldoEstimate({hireDate:employee.hireDate,salaryNio:employee.salaryNio,asOf:today});
      return calculateAguinaldoEstimate({
        hireDate:employee.hireDate,salaryNio:employee.salaryNio,
        commissionEnabled:employee.commissionEnabled,
        monthlyOrdinarySalaries:monthlyOrdinarySalaries(employee.id,cycle.cycleEnd),asOf:today
      });
    };
    const inssFor=(employee)=>calculateInss({
      baseSalaryNio:employee.salaryNio,
      commissionsNio:activeCommissions.filter(c=>String(c.employeeId)===String(employee.id)&&c.status==='Pendiente')
        .reduce((sum,c)=>sum+Number(c.commissionUsd||0)*Number(exchangeRate||36.6),0),
      employeeRate:Number(hrInssSettings.employee_rate||7),
      employerRate:Number(hrInssSettings.employer_rate||21.5)
    });
    const availableTabs=[
      ['employees','Personal',employees.length,'hr.employees.view'],
      ['attendance','Asistencia',attendanceRecords.length,'hr.attendance.view'],
      ['leaves','Permisos',leaveRequests.filter(x=>x.status==='Pendiente').length,'hr.leave.view'],
      ['benefits','Prestaciones',activeEmployees.length,'hr.payroll.view'],
      ['commissions','Comisiones',activeCommissions.length,'hr.payroll.view'],
      ['payroll','Nómina',payrollPeriods.length,'hr.payroll.view']
    ];
    const tabs=availableTabs.filter(tab=>permissionGranted(tab[3]));
    if(!tabs.length)return heading(views.hr,'')+'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>RR. HH. sin apartados habilitados</strong><p>El propietario debe asignarte acceso a uno o varios apartados de Recursos Humanos.</p></div></div>';
    if(!tabs.some(tab=>tab[0]===state.hrTab))state.hrTab=tabs[0][0];
    const tabsHtml='<div class="toolbar products-toolbar hr-tabs"><div class="toolbar-left">'+tabs.map(([id,label,count])=>'<button type="button" class="button hr-tab-button '+(state.hrTab===id?'button-primary':'button-quiet')+' button-small" data-action="hr-tab" data-tab="'+id+'">'+label+' <span class="ledger-count">'+count+'</span></button>').join('')+'</div></div>';
    let actions='',content='';
    if(state.hrTab==='employees'){
      actions='<button class="button button-primary" data-action="new-employee">'+svg('plus')+' Agregar colaborador</button>';
      const contractReminders=getContractReminders(activeEmployees,today);
      const reminderPanel=contractReminders.length
        ? '<article class="contract-reminders" aria-label="Recordatorios de contratos"><div class="contract-reminders-heading"><div><strong>Contratos por vencer</strong><small>Alertas de vigencia · 30 y 15 días</small></div><span class="status-chip status-pending">'+contractReminders.length+' alertas</span></div>'+
          contractReminders.map(item=>'<div class="contract-reminder-row"><div><strong>'+esc(item.employeeName)+'</strong><small>Contrato temporal · vence '+dateText(item.contractEndDate)+'</small></div><span class="status-chip '+(item.daysRemaining<0?'status-danger':(item.daysRemaining<=15?'status-pending':'status-muted'))+'">'+(item.daysRemaining<0?'Vencido hace '+Math.abs(item.daysRemaining)+' días':(item.daysRemaining===0?'Vence hoy':'Vence en '+item.daysRemaining+' días'))+'</span><button type="button" class="button button-quiet button-small" data-action="edit-employee" data-id="'+esc(item.employeeId)+'">Revisar</button></div>').join('')+
          '</article>'
        : '';
      const rows=employees.map(e=>{
        const tenure=calculateTenure(e.hireDate,today).label;
        return '<tr><td data-label="Colaborador" class="table-primary">'+esc(e.name)+'<small class="table-secondary">'+esc(e.employeeCode||'Código pendiente')+' · '+esc(e.department||'Sin departamento')+'</small><small class="table-secondary">'+esc(e.contractType||'Por definir')+' · Jornada '+esc(e.workSchedule||'Por definir')+'</small></td><td data-label="Cargo">'+esc(e.position)+'</td><td data-label="Antigüedad">'+esc(tenure)+'</td><td data-label="Comisión">'+(e.commissionEnabled?'<span class="status-chip status-success">'+Number(e.commissionRate).toFixed(2)+'%</span>':'<span class="status-chip status-muted">No aplica</span>')+'</td><td data-label="Salario mensual" class="table-primary">'+moneyInCurrency(e.salaryNio,'NIO')+'</td><td data-label="Estado"><span class="status-chip '+(e.status==='Activo'?'status-success':'status-muted')+'">'+esc(e.status||'Activo')+'</span></td><td data-label="Acciones"><div class="hr-row-actions"><button type="button" class="button button-quiet button-small" data-action="view-employee" data-id="'+esc(e.id)+'">Historial</button><button type="button" class="button button-quiet button-small" data-action="edit-employee" data-id="'+esc(e.id)+'">Editar</button></div></td></tr>';
      }).join('');
      content=reminderPanel+'<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>COLABORADOR / CÓDIGO</th><th>CARGO</th><th>ANTIGÜEDAD</th><th>COMISIÓN</th><th>SALARIO MENSUAL</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">No hay colaboradores registrados.</td></tr>')+'</tbody></table></div></article>';
    } else if(state.hrTab==='attendance'){
      actions=activeEmployees.length?'<button class="button button-primary" data-action="new-attendance">'+svg('plus')+' Registrar asistencia</button>':'';
      const employeeName=id=>employees.find(e=>e.id===id)?.name||'Colaborador';
      const rows=attendanceRecords.map(a=>'<tr><td data-label="Fecha">'+dateText(a.workDate)+'</td><td data-label="Colaborador" class="table-primary">'+esc(employeeName(a.employeeId))+'</td><td data-label="Entrada">'+esc(a.checkIn?new Date(a.checkIn).toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'}):'—')+'</td><td data-label="Salida">'+esc(a.checkOut?new Date(a.checkOut).toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'}):'—')+'</td><td data-label="Estado"><span class="status-chip '+(a.status==='Ausente'?'status-danger':(a.status==='Tardanza'?'status-pending':'status-success'))+'">'+esc(a.status)+'</span></td><td data-label="Descanso">'+Number(a.breakMinutes||0)+' min</td></tr>').join('');
      content='<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>COLABORADOR</th><th>ENTRADA</th><th>SALIDA</th><th>ESTADO</th><th>DESCANSO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No hay asistencias registradas.</td></tr>')+'</tbody></table></div></article>';
    } else if(state.hrTab==='leaves'){
      actions=activeEmployees.length?'<button class="button button-primary" data-action="new-leave">'+svg('plus')+' Nueva solicitud</button>':'<button class="button button-primary" data-action="go-hr-employees">'+svg('plus')+' Agregar colaborador</button>';
      const employeeName=id=>employees.find(e=>e.id===id)?.name||'Colaborador';
      const rows=leaveRequests.map(l=>'<tr><td data-label="Colaborador" class="table-primary">'+esc(employeeName(l.employeeId))+'</td><td data-label="Tipo">'+esc(l.leaveType)+'</td><td data-label="Período">'+dateText(l.startDate)+' – '+dateText(l.endDate)+'</td><td data-label="Días">'+Number(l.days||0)+'</td><td data-label="Estado"><span class="status-chip '+(l.status==='Aprobado'?'status-success':(l.status==='Rechazado'?'status-danger':'status-pending'))+'">'+esc(l.status)+'</span></td><td data-label="Acciones">'+(l.status==='Pendiente'?'<button class="button button-quiet button-small" data-action="approve-leave" data-id="'+l.id+'">Aprobar</button><button class="button button-quiet button-small" data-action="reject-leave" data-id="'+l.id+'">Rechazar</button>':'—')+'</td></tr>').join('');
      content=(activeEmployees.length?'':'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Primero registra al colaborador</strong><p>Los permisos y vacaciones se vinculan a una persona activa.</p></div></div>')+'<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>COLABORADOR</th><th>TIPO</th><th>PERÍODO</th><th>DÍAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">No hay permisos o vacaciones registrados.</td></tr>')+'</tbody></table></div></article>';
    } else if(state.hrTab==='benefits'){
      const rows=activeEmployees.map(e=>{
        const tenure=calculateTenure(e.hireDate,today);
        const vacation=vacationFor(e);
        const aguinaldo=aguinaldoFor(e);
        const inss=inssFor(e);
        const salaryBasisNote=e.commissionEnabled
          ? (monthlyOrdinarySalaries(e.id,aguinaldo.cycleEnd).length?'<small class="table-secondary">Mayor salario ordinario de los últimos meses registrados</small>':'<small class="table-secondary">Sin historial suficiente; se usa el salario fijo actual</small>')
          : '<small class="table-secondary">Último salario mensual fijo registrado</small>';
        return '<tr><td data-label="Colaborador" class="table-primary">'+esc(e.name)+'<small class="table-secondary">'+esc(tenure.label)+'</small></td><td data-label="Vacaciones"><strong>'+vacation.balanceDays.toFixed(2)+' días</strong><small class="table-secondary">'+vacation.accruedDays.toFixed(2)+' acumulados · '+vacation.usedDays.toFixed(2)+' usados</small></td><td data-label="Aguinaldo estimado"><strong>'+moneyInCurrency(aguinaldo.amountNio,'NIO')+'</strong>'+salaryBasisNote+'</td><td data-label="INSS trabajador">'+moneyInCurrency(inss.employeeInssNio,'NIO')+'</td><td data-label="INSS patronal">'+moneyInCurrency(inss.employerInssNio,'NIO')+'</td></tr>';
      }).join('');
      const vacationTotal=activeEmployees.reduce((sum,e)=>sum+vacationFor(e).balanceDays,0);
      const aguinaldoTotal=activeEmployees.reduce((sum,e)=>sum+aguinaldoFor(e).amountNio,0);
      const preset=String(hrInssSettings.regime||'integral')+':'+String(hrInssSettings.employer_band||'under_50');
      const presets=[
        ['integral:under_50','Integral · menos de 50 trabajadores (7% / 21.5%)'],
        ['integral:fifty_plus','Integral · 50 o más trabajadores (7% / 22.5%)'],
        ['ivm_rp:under_50','IVM-RP · menos de 50 trabajadores (5% / 15.5%)'],
        ['ivm_rp:fifty_plus','IVM-RP · 50 o más trabajadores (5% / 16.5%)']
      ];
      const inssConfig=permissionGranted('settings.general.manage')
        ? '<form id="hr-inss-settings-form" class="hr-inss-settings"><div class="form-grid"><label>Modalidad INSS<select name="preset">'+presets.map(([value,label])=>'<option value="'+value+'" '+(preset===value?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label><div class="detail-field"><span>Tasas aplicadas</span><strong>'+Number(hrInssSettings.employee_rate||7).toFixed(2)+'% trabajador · '+Number(hrInssSettings.employer_rate||21.5).toFixed(2)+'% patronal</strong></div></div><button class="button button-primary button-small" type="submit">Guardar modalidad INSS</button></form>'
        : '<p class="form-helper">Modalidad configurada: '+esc(hrInssSettings.regime||'integral')+' · trabajador '+Number(hrInssSettings.employee_rate||7).toFixed(2)+'% · patronal '+Number(hrInssSettings.employer_rate||21.5).toFixed(2)+'%.</p>';
      content='<div class="summary-strip hr-benefit-summary"><div class="summary-mini"><span>Vacaciones disponibles</span><strong>'+vacationTotal.toFixed(2)+' días</strong></div><div class="summary-mini"><span>Aguinaldo estimado</span><strong>'+moneyInCurrency(aguinaldoTotal,'NIO')+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>COLABORADOR</th><th>VACACIONES DISPONIBLES</th><th>AGUINALDO ESTIMADO</th><th>INSS TRABAJADOR</th><th>INSS PATRONAL</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">No hay colaboradores activos.</td></tr>')+'</tbody></table></div></article><article class="list-panel hr-benefit-settings"><div class="panel-heading"><div><h3>Configuración de INSS</h3><p>El descuento laboral y el aporte patronal se muestran por separado.</p></div></div>'+inssConfig+'</article><div class="notice-panel hr-payroll-note">'+svg('warning')+'<div><strong>Estimaciones y reglas</strong><p>Las vacaciones se acumulan a razón de 2.5 días por mes y se descuentan cuando ya fueron disfrutadas. El aguinaldo se muestra como provisión estimada; su pago se calcula en un período especial. El INSS mostrado es una proyección sobre salario mensual y comisiones pendientes, no una planilla oficial.</p></div></div>';
    } else if(state.hrTab==='commissions'){
      const rows=hrCommissions.map(c=>'<tr><td data-label="Colaborador" class="table-primary">'+esc(c.employeeName)+'</td><td data-label="Factura">'+esc(c.invoiceNumber||'—')+'<small class="table-secondary">'+dateText(c.saleDate)+'</small></td><td data-label="Perfume">'+esc(c.productName)+' × '+Number(c.quantity||0)+'</td><td data-label="Utilidad bruta">'+money(c.grossProfitUsd)+' USD</td><td data-label="Tasa">'+Number(c.rate||0).toFixed(2)+'%</td><td data-label="Comisión USD">'+money(c.commissionUsd)+' USD<small class="table-secondary">Equivalente al vender: '+moneyInCurrency(c.commissionNio,'NIO')+'</small></td><td data-label="Estado"><span class="status-chip '+(c.status==='Pagada'?'status-success':(c.status==='Asignada'?'status-pending':'status-muted'))+'">'+esc(c.status)+'</span></td></tr>').join('');
      const pendingTotal=activeCommissions.reduce((sum,c)=>sum+Number(c.commissionUsd||0),0);
      const paidTotal=hrCommissions.filter(c=>c.status==='Pagada').reduce((sum,c)=>sum+Number(c.commissionUsd||0),0);
      content='<div class="summary-strip"><div class="summary-mini"><span>Pendiente / asignada</span><strong>'+money(pendingTotal)+' USD</strong></div><div class="summary-mini"><span>Histórico pagado</span><strong>'+money(paidTotal)+' USD</strong></div><div class="summary-mini"><span>Registros</span><strong>'+hrCommissions.length+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>COLABORADOR</th><th>FACTURA / FECHA</th><th>PERFUME</th><th>UTILIDAD BRUTA</th><th>TASA</th><th>COMISIÓN USD</th><th>ESTADO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Todavía no hay comisiones registradas desde facturas.</td></tr>')+'</tbody></table></div></article><div class="notice-panel hr-payroll-note">'+svg('warning')+'<div><strong>Liquidación automática</strong><p>Las comisiones pendientes se incorporan una sola vez a la nómina ordinaria que cubra la fecha de la venta. Al pagarla cambian a Pagada; si se anula el período, regresan a Pendiente. El historial nunca se borra ni se reinicia manualmente.</p></div></div>';
    } else {
      const draftPeriods=payrollPeriods.filter(p=>p.status==='Borrador');
      actions='<div class="heading-actions-inline">'+(draftPeriods.length?'<button class="button button-quiet" data-action="new-payroll-item">'+svg('plus')+' Agregar a nómina</button>':'')+'<button class="button button-primary" data-action="new-payroll-period">'+svg('plus')+' Nuevo período</button></div>';
      const rows=payrollPeriods.map(p=>{
        const items=payrollItems.filter(item=>item.payrollPeriodId===p.id);
        const total=items.reduce((sum,item)=>sum+Number(item.netSalaryNio||0),0);
        const commissions=items.reduce((sum,item)=>sum+Number(item.commissionsNio||0),0);
        const commissionsUsd=items.reduce((sum,item)=>sum+Number(item.commissionsUsd||0),0);
        const commissionRate=items.find(item=>Number(item.commissionsUsd||0)>0)?.commissionExchangeRate||p.commissionExchangeRate||exchangeRate;
        const aguinaldo=items.reduce((sum,item)=>sum+Number(item.aguinaldoNio||0),0);
        const employerInss=items.reduce((sum,item)=>sum+Number(item.inssEmployerNio||0),0);
        const periodAction=p.status==='Borrador'
          ?'<button class="button button-quiet button-small" data-action="approve-payroll" data-id="'+p.id+'" '+(items.length?'':'disabled')+'>Aprobar</button>'
          :(p.status==='Aprobada'?'<button class="button button-primary button-small" data-action="pay-payroll" data-id="'+p.id+'">Pagar nómina</button>':'—');
        return '<tr><td data-label="Período" class="table-primary">'+(p.periodType==='Aguinaldo'?'Aguinaldo · ':'Ordinaria · ')+dateText(p.periodStart)+' – '+dateText(p.periodEnd)+'</td><td data-label="Colaboradores">'+items.length+'</td><td data-label="Comisiones">'+money(commissionsUsd)+' USD<small class="table-secondary">'+moneyInCurrency(commissions,'NIO')+' · tasa '+Number(commissionRate).toFixed(4)+'</small></td><td data-label="Aguinaldo">'+moneyInCurrency(aguinaldo,'NIO')+'</td><td data-label="INSS patronal">'+moneyInCurrency(employerInss,'NIO')+'</td><td data-label="Neto a pagar">'+moneyInCurrency(total,'NIO')+'</td><td data-label="Fecha de pago">'+dateText(p.paymentDate)+'</td><td data-label="Estado"><span class="status-chip '+(p.status==='Pagada'?'status-success':(p.status==='Anulada'?'status-muted':'status-pending'))+'">'+esc(p.status)+'</span></td><td data-label="Acciones">'+periodAction+'</td></tr>';
      }).join('');
      content='<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>PERÍODO</th><th>COLABORADORES</th><th>COMISIONES USD / C$</th><th>AGUINALDO</th><th>INSS PATRONAL</th><th>NETO A PAGAR</th><th>FECHA DE PAGO</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(rows||'<tr><td colspan="9">No hay períodos de nómina registrados.</td></tr>')+'</tbody></table></div></article><div class="notice-panel hr-payroll-note">'+svg('warning')+'<div><strong>Antes de pagar</strong><p>El ERP calcula automáticamente comisiones e INSS en la nómina ordinaria. Para el treceavo mes crea un período de tipo Aguinaldo: el sistema calcula el proporcional y no aplica cotizaciones ni deducciones ordinarias al aguinaldo.</p></div></div>';
    }
    return '<section class="hr-view">'+heading(views.hr,actions)+
      '<div class="summary-strip hr-summary-strip"><div class="summary-mini"><span>Colaboradores activos</span><strong>'+activeEmployees.length+'</strong></div><div class="summary-mini"><span>Nómina mensual base</span><strong>'+moneyInCurrency(activeEmployees.reduce((s,e)=>s+Number(e.salaryNio||0),0),'NIO')+'</strong></div><div class="summary-mini"><span>Comisiones pendientes</span><strong>'+money(activeCommissions.reduce((s,c)=>s+Number(c.commissionUsd||0),0))+' USD</strong></div><div class="summary-mini"><span>Períodos de nómina</span><strong>'+payrollPeriods.length+'</strong></div></div>'+
      tabsHtml+'<div class="hr-content">'+content+'</div></section>';
  }
  function renderAnalytics(){
    const period=resolveReportingPeriod(analyticsPeriodPreset,new Date(),analyticsCustomFrom,analyticsCustomTo);
    const inPeriod=(record,fields)=>{
      const value=fields.map(field=>record?.[field]).find(item=>item!==null&&item!==undefined&&item!=="");
      return isWithinReportingPeriod(value,period);
    };
    const periodInvoices=invoices.filter(invoice=>inPeriod(invoice,['createdAt','invoiceDate','date']));
    const periodExpenses=expenses.filter(expense=>inPeriod(expense,['createdAt','expenseDate','date']));
    const periodPurchases=purchases.filter(purchase=>inPeriod(purchase,['createdAt','purchaseDate','date']));
    const periodSupplierInvoices=supplierInvoices.filter(invoice=>inPeriod(invoice,['invoiceDate','createdAt','date']));
    const finance=calculateFinancialSnapshot(periodInvoices,periodExpenses,roundMoney);
    const inventory=products.reduce((sum,p)=>sum+Number(p.unitCost||0)*Number(p.stock||0),0);
    const potential=products.reduce((sum,p)=>sum+Math.max(0,costSummary(p).profit)*Number(p.stock||0),0);
    const supplierPayables=calculatePayablesSnapshot(purchases,supplierInvoices,roundMoney);
    const purchasesTotal=roundMoney(periodPurchases.reduce((sum,p)=>sum+Number(p.totalUsd||0),0)+
      periodSupplierInvoices.filter(invoice=>invoice.status!=="Anulada").reduce((sum,invoice)=>sum+Number(invoice.amountUsd||0),0));
    // These are current outstanding balances, not period activity.
    const receivables=invoices.reduce((sum,i)=>sum+Math.max(0,Number(i.totalUsd||0)-Number(i.paidUsd||0)),0);
    const payables=supplierPayables.total;
    const paidRevenue=invoices.reduce((sum,invoice)=>{
      const payments=Array.isArray(invoice.payments)?invoice.payments:[];
      if(payments.length)return sum+payments.filter(payment=>isWithinReportingPeriod(payment.createdAt,period)).reduce((subtotal,payment)=>subtotal+Number(payment.amountUsd||0),0);
      return sum+(isWithinReportingPeriod(invoice.createdAt,period)?Number(invoice.paidUsd||0):0);
    },0);
    const presetOptions=[
      ['all','Todo el historial'],['month','Este mes'],['previous_month','Mes anterior'],
      ['last_30','Últimos 30 días'],['last_90','Últimos 90 días'],['last_180','Últimos 180 días'],
      ['year','Este año'],['custom','Rango personalizado']
    ].map(([value,label])=>'<option value="'+value+'"'+(analyticsPeriodPreset===value?' selected':'')+'>'+label+'</option>').join('');
    const fromValue=period.valid?period.from:(analyticsCustomFrom||'');
    const toValue=period.valid?period.to:(analyticsCustomTo||'');
    const rangePanel='<article class="panel analytics-range-panel"><div class="panel-heading"><div><h2>Ventana de consulta</h2><p>Filtra ventas, costos, gastos y compras por fecha. Saldos e inventario se muestran al día de hoy.</p></div></div>'+
      '<div class="form-grid analytics-range-form">'+
      '<label class="form-field"><span>Período</span><select id="analytics-period">'+presetOptions+'</select></label>'+
      '<label class="form-field"><span>Desde</span><input id="analytics-from" type="date" value="'+esc(fromValue)+'"></label>'+
      '<label class="form-field"><span>Hasta</span><input id="analytics-to" type="date" value="'+esc(toValue)+'"></label>'+
      '<div class="full-field modal-actions"><button type="button" class="button button-primary" data-action="apply-analytics-range">Aplicar consulta</button><span class="table-secondary">'+esc(period.valid?period.label:'Revisa las fechas del rango personalizado.')+'</span></div></div></article>';
    const rangeError=!period.valid?'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Rango de fechas no válido</strong><p>Selecciona una fecha inicial y final válidas, y asegúrate de que la fecha inicial no sea posterior a la final.</p></div></div>':'';
    return heading(views.analytics,'')+
      rangePanel+rangeError+
      '<div class="metric-grid">'+
      metric('Ventas facturadas',money(finance.revenue),'chart',periodInvoices.length+' facturas en el período','productos vendidos · USD',false)+
      metric('Costo de ventas',money(finance.costOfSales),'boxes','Costo de productos vendidos','según costo guardado en factura',false)+
      metric('Utilidad bruta',money(finance.grossProfit),'spark','Venta neta de productos − costo','antes de gastos operativos',true)+
      metric('Gastos operativos',money(finance.operatingExpenses),'receipt',periodExpenses.length+' gastos en el período','convertidos a USD',false)+
      metric('Resultado después de gastos',money(finance.netProfit),'wallet','Utilidad bruta + entrega − gastos','antes de impuestos y partidas no registradas',true)+
      metric('Cobros recibidos',money(paidRevenue),'wallet','Abonos con fecha dentro del período','flujo de efectivo cobrado · USD',false)+
      '</div>'+
      '<div class="summary-strip">'+
      '<div class="summary-mini"><span>Valor del inventario a costo · hoy</span><strong>'+money(inventory)+'</strong></div>'+
      '<div class="summary-mini"><span>Margen potencial del stock · hoy</span><strong>'+money(potential)+'</strong></div>'+
      '<div class="summary-mini"><span>Compras y facturas proveedor · período</span><strong>'+money(purchasesTotal)+'</strong></div>'+
      '<div class="summary-mini"><span>Cuentas por cobrar · saldo actual</span><strong>'+money(receivables)+'</strong></div>'+
      '<div class="summary-mini"><span>Cuentas por pagar · saldo actual</span><strong>'+money(payables)+'</strong></div>'+
      '</div>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Criterio del resultado</strong><p>La utilidad bruta se calcula con los renglones de facturas del período y su costo unitario registrado. El resultado después de gastos descuenta los gastos operativos capturados en el mismo rango; no representa utilidad fiscal ni incorpora impuestos, nómina o partidas no registradas. Los saldos por cobrar/pagar y el valor del inventario son posiciones actuales, no movimientos del período.</p></div></div>';
  }
  function supplierPayablesUsd(supplier){
    const supplierName=supplier.name;
    const legacy=purchases.filter(p=>p.supplier===supplierName);
    const documents=supplierInvoices.filter(invoice=>String(invoice.supplierId)===String(supplier.id));
    return calculatePayablesSnapshot(legacy,documents,roundMoney).total;
  }
  function renderSuppliers(){
    const rows=suppliers.map(s=>'<tr><td data-label="Proveedor / contacto" class="table-primary">'+esc(s.name)+'<small class="table-secondary">'+esc(s.contact||s.email||'Sin contacto')+'</small></td><td data-label="Teléfono">'+esc(s.phone||'—')+'</td><td data-label="Moneda habitual">'+(s.currency==='NIO'?'NIO · Córdoba':'USD · Dólar')+'</td><td data-label="Compras">'+purchases.filter(p=>p.supplier===s.name).length+'</td><td data-label="Saldo por pagar">'+money(supplierPayablesUsd(s))+'</td></tr>').join('');
    const outstanding=calculatePayablesSnapshot(purchases,supplierInvoices,roundMoney).total;
    return heading(views.suppliers,'<button class="button button-primary" data-action="new-supplier">'+svg('plus')+' Nuevo proveedor</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Proveedores</span><strong>'+suppliers.length+'</strong></div><div class="summary-mini"><span>Compras vinculadas</span><strong>'+purchases.length+'</strong></div><div class="summary-mini"><span>Saldo por pagar USD</span><strong>'+money(outstanding)+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>PROVEEDOR / CONTACTO</th><th>TELÉFONO</th><th>MONEDA HABITUAL</th><th>COMPRAS</th><th>SALDO USD</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">No hay proveedores registrados.</td></tr>')+'</tbody></table></div></article>';
  }
  function purchaseOrderLineHtml(){
    const options=products.filter(product=>product.active!==false).map(product=>'<option value="'+esc(product.id)+'">'+esc(product.name)+' · '+esc(product.sku||'Sin SKU')+'</option>').join('');
    return '<div class="purchase-order-line"><label>Producto<select name="product_id" required><option value="">Seleccionar producto</option>'+options+'</select></label><label>Cantidad<input name="ordered_quantity" type="number" min="1" max="1000000" step="1" value="1" required></label><label>Costo unitario (moneda de la orden)<input name="unit_cost_input" type="number" min="0.01" step="0.01" required placeholder="0.00"></label><button class="button button-quiet button-small" type="button" data-action="remove-purchase-order-line" aria-label="Quitar producto">Quitar</button></div>';
  }
  function setPurchaseOrderTab(tab){
    const form=document.getElementById("purchase-order-form");
    if(!form)return;
    const allowed=["general","products","adjustments"];
    const selected=allowed.includes(tab)?tab:"general";
    const captions={general:"Etapa 1 de 3 · Datos de la orden",products:"Etapa 2 de 3 · Productos solicitados",adjustments:"Etapa 3 de 3 · Costos y notas"};
    form.querySelectorAll("[data-action=\"purchase-order-tab\"]").forEach(button=>{
      const active=button.getAttribute("data-tab")===selected;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-selected",String(active));
      button.tabIndex=active?0:-1;
    });
    form.querySelectorAll("[data-po-panel]").forEach(panel=>{
      panel.hidden=panel.getAttribute("data-po-panel")!==selected;
    });
    const caption=form.querySelector("[data-po-step-caption]");
    if(caption)caption.textContent=captions[selected];
  }
  function openPurchaseReceiptDialog(orderId){
    const order=purchaseOrders.find(item=>String(item.id)===String(orderId));if(!order)return;
    const lines=purchaseOrderItems.filter(item=>String(item.purchase_order_id)===String(order.id)).map(item=>({...item,remaining:Number(item.ordered_quantity||0)-Number(item.received_quantity||0)})).filter(item=>item.remaining>0);
    if(!lines.length){toast("Esta orden no tiene cantidades pendientes de recibir.");return;}
    let dialog=document.getElementById("purchase-receipt-dialog");
    if(!dialog){dialog=document.createElement("dialog");dialog.id="purchase-receipt-dialog";dialog.className="modal-dialog purchase-receipt-dialog";document.body.appendChild(dialog);}
    const receiptLines=lines.map(item=>'<div class="purchase-receipt-line" data-receipt-line data-po-item-id="'+esc(item.id)+'"><div><strong>'+esc(item.product_name)+'</strong><small class="table-secondary">'+esc(item.sku_snapshot||'')+' · '+Number(item.received_quantity||0)+' recibidas de '+Number(item.ordered_quantity||0)+'</small></div><label>Recibir ahora<input data-receipt-quantity name="quantity_received" type="number" min="1" max="'+item.remaining+'" step="1" value="'+item.remaining+'" required></label><label>Costo unitario facturado ('+esc(order.currency)+')<input data-receipt-unit-cost type="number" min="0.01" step="0.0001" value="'+Number(item.unit_cost_input||0).toFixed(4)+'" required></label><small>Máximo: '+item.remaining+'</small></div>').join('');
    dialog.innerHTML='<form id="purchase-receipt-form" class="modal-form"><div class="modal-header"><div><span class="eyebrow">DOCUMENTO DE RECEPCIÓN</span><h2>Emitir recepción · '+esc(order.orderNumber)+'</h2><p>'+esc(order.supplier)+' · Orden '+esc(order.currency)+' · TC '+Number(order.exchangeRate||1).toFixed(4)+'</p></div><button class="icon-button" type="button" data-action="close-purchase-receipt" aria-label="Cerrar">×</button></div>'+
      '<input type="hidden" name="purchase_order_id" value="'+esc(order.id)+'"><input type="hidden" name="invoice_currency" value="'+esc(order.currency)+'"><input type="hidden" name="invoice_exchange_rate" value="'+Number(order.exchangeRate||1)+'"><input type="hidden" name="payment_terms" value="'+esc(order.paymentTerms||"Por acordar")+'">'+
      '<div class="form-grid"><label>Número de factura del proveedor<input name="supplier_invoice_number" maxlength="100" required placeholder="Ej. FAC-001-2026"></label><label>Fecha de factura<input name="supplier_invoice_date" type="date" value="'+new Date().toISOString().slice(0,10)+'" required></label><label>Total de factura ('+esc(order.currency)+')<input name="invoice_original_total" type="number" min="0.01" step="0.01" value="0.00" required></label><label>Flete real (USD)<input name="actual_freight_usd" type="number" min="0" step="0.01" value="0" required></label><label>Impuestos reales (USD)<input name="actual_taxes_usd" type="number" min="0" step="0.01" value="0" required></label><label>Condición de pago<input value="'+esc(order.paymentTerms||"Por acordar")+'" disabled></label></div>'+
      '<div class="purchase-receipt-lines">'+receiptLines+'</div><label>Notas<input name="notes" maxlength="1000" placeholder="Observaciones de la factura o recepción"></label>'+
      '<p class="form-helper">El total se calcula según las cantidades recibidas, descuento, flete e impuestos. Al emitir, la recepción queda pendiente: no aumenta existencias ni crea la cuenta por pagar hasta contabilizarla.</p>'+
      '<div class="form-actions"><button class="button button-quiet" type="button" data-action="close-purchase-receipt">Cancelar</button><button class="button button-primary" type="submit">Emitir recepción pendiente</button></div></form>';
    const updateInvoiceOriginalTotal=()=>{
      const rate=Math.max(0.0001,Number(order.exchangeRate||1));
      const merchandiseUsd=Array.from(dialog.querySelectorAll("[data-receipt-line]")).reduce((sum,row)=>{
        const quantity=Number(row.querySelector("[data-receipt-quantity]")?.value||0);
        const unitInput=Number(row.querySelector("[data-receipt-unit-cost]")?.value||0);
        const unitUsd=order.currency==="NIO"?unitInput/rate:unitInput;
        return sum+Math.max(0,quantity)*Math.max(0,unitUsd);
      },0);
      const subtotalUsd=Math.max(0,Number(order.subtotalUsd||0));
      const discountShare=subtotalUsd>0?Number(order.discountUsd||0)*merchandiseUsd/subtotalUsd:0;
      const freight=Math.max(0,Number(dialog.querySelector('[name="actual_freight_usd"]')?.value||0));
      const taxes=Math.max(0,Number(dialog.querySelector('[name="actual_taxes_usd"]')?.value||0));
      const totalUsd=Math.max(0,merchandiseUsd-discountShare+freight+taxes);
      const originalTotal=order.currency==="NIO"?totalUsd*rate:totalUsd;
      const totalInput=dialog.querySelector('[name="invoice_original_total"]');
      if(totalInput)totalInput.value=(Math.round((originalTotal+Number.EPSILON)*100)/100).toFixed(2);
    };
    dialog.oninput=event=>{
      if(event.target.matches("[data-receipt-quantity],[data-receipt-unit-cost],[name='actual_freight_usd'],[name='actual_taxes_usd']"))updateInvoiceOriginalTotal();
    };
    updateInvoiceOriginalTotal();
    if(typeof dialog.showModal==="function")dialog.showModal();else toast("Tu navegador no admite el formulario de recepción.");
  }
  function purchaseHistoryDateKey(value){
    return value?String(value).slice(0,10):"";
  }
  function purchaseHistoryDateMatches(value){
    const key=purchaseHistoryDateKey(value);
    if(state.purchaseHistoryStartDate&&(!key||key<state.purchaseHistoryStartDate))return false;
    if(state.purchaseHistoryEndDate&&(!key||key>state.purchaseHistoryEndDate))return false;
    return true;
  }
  function purchaseHistoryQueryMatches(order,receipt){
    const query=String(state.purchaseHistoryQuery||"").trim().toLocaleLowerCase("es");
    if(!query)return true;
    const linkedLines=purchaseOrderItems.filter(line=>String(line.purchase_order_id)===String(order?.id));
    const linkedReceipts=receipt?[receipt]:purchaseReceipts.filter(item=>String(item.purchase_order_id)===String(order?.id));
    const searchable=[
      order?.orderNumber,order?.supplier,order?.status,order?.notes,
      ...linkedLines.map(line=>line.product_name),
      ...linkedReceipts.flatMap(item=>[
        item.receiptNumber,item.receipt_number,item.supplier_invoice_number,
        item.purchaseCode,item.purchase_code,item.documentStatus,item.document_status
      ])
    ].filter(Boolean).join(" ").toLocaleLowerCase("es");
    return searchable.includes(query);
  }
  function filteredPurchaseOrders(){
    return purchaseOrders.filter(order=>{
      if(state.purchaseHistorySupplier!=="all"&&String(order.supplierId)!==String(state.purchaseHistorySupplier))return false;
      if(state.purchaseHistoryOrderStatus!=="all"&&String(order.status||"")!==state.purchaseHistoryOrderStatus)return false;
      if(!purchaseHistoryDateMatches(order.createdAt))return false;
      return purchaseHistoryQueryMatches(order,null);
    });
  }
  function filteredPurchaseReceipts(){
    return purchaseReceipts.filter(receipt=>{
      const order=purchaseOrders.find(item=>String(item.id)===String(receipt.purchase_order_id));
      const status=receipt.documentStatus||receipt.document_status||"Contabilizada";
      if(state.purchaseHistorySupplier!=="all"&&String(order?.supplierId||"")!==String(state.purchaseHistorySupplier))return false;
      if(state.purchaseHistoryReceiptStatus!=="all"&&status!==state.purchaseHistoryReceiptStatus)return false;
      if(!purchaseHistoryDateMatches(receipt.emitted_at||receipt.received_at||receipt.supplier_invoice_date))return false;
      return purchaseHistoryQueryMatches(order,receipt);
    }).sort((a,b)=>String(b.emitted_at||b.received_at||"").localeCompare(String(a.emitted_at||a.received_at||"")));
  }
  function renderPurchaseHistoryArchive(){
    const currentYear=new Date().getFullYear();
    const years=Array.from({length:6},(_,index)=>currentYear-index).map(year=>
      '<details class="inventory-archive-year" '+(year===currentYear?'open':'')+'><summary>'+year+'</summary><div class="inventory-archive-months">'+
      Array.from({length:12},(_,monthIndex)=>{
        const start=year+"-"+String(monthIndex+1).padStart(2,"0")+"-01";
        const end=year+"-"+String(monthIndex+1).padStart(2,"0")+"-"+String(new Date(year,monthIndex+1,0).getDate()).padStart(2,"0");
        const label=new Date(year,monthIndex,1).toLocaleDateString("es-NI",{month:"long"});
        const selected=state.purchaseHistoryStartDate===start&&state.purchaseHistoryEndDate===end;
        return '<button type="button" class="inventory-archive-month'+(selected?' is-active':'')+'" data-action="purchase-month-filter" data-start="'+start+'" data-end="'+end+'">'+label+'</button>';
      }).join("")+'</div></details>'
    ).join("");
    return '<details class="inventory-archive purchase-history-archive"><summary>'+svg("clock")+' Archivo mensual <span>Filtra órdenes y recepciones por mes</span></summary><div class="inventory-archive-years">'+years+'</div></details>';
  }
  function refreshPurchaseOrdersView(preserveFocus=true){
    const active=document.activeElement;
    const activeId=preserveFocus?active?.id:"";
    const selectionStart=preserveFocus&&typeof active?.selectionStart==="number"?active.selectionStart:null;
    const selectionEnd=preserveFocus&&typeof active?.selectionEnd==="number"?active.selectionEnd:null;
    if(!root||state.view!=="purchaseOrders")return;
    root.innerHTML=renderPurchaseOrders();
    applyPermissionActions();
    if(activeId){
      const next=root.querySelector("#"+CSS.escape(activeId));
      if(next){
        next.focus();
        if(selectionStart!==null&&typeof next.setSelectionRange==="function"){
          try{next.setSelectionRange(selectionStart,selectionEnd);}catch{}
        }
      }
    }
  }
  function renderPurchaseOrders(){
    const linesByOrder=new Map();
    purchaseOrderItems.forEach(item=>{const key=String(item.purchase_order_id);if(!linesByOrder.has(key))linesByOrder.set(key,[]);linesByOrder.get(key).push(item);});
    const receiptCounts=new Map();
    purchaseReceipts.forEach(receipt=>receiptCounts.set(String(receipt.purchase_order_id),(receiptCounts.get(String(receipt.purchase_order_id))||0)+1));
    const visibleOrders=filteredPurchaseOrders();
    const visibleReceipts=filteredPurchaseReceipts();
    const rows=visibleOrders.map(order=>{
      const lines=linesByOrder.get(String(order.id))||[];
      const itemSummary=lines.map(line=>esc(line.product_name)+' × '+Number(line.ordered_quantity)+' <small class="table-secondary">('+Number(line.received_quantity||0)+' recibidas)</small>').join('<br>');
      const actions=[];
      const currentUserId=window.JBAuth?.profile?.id||"";
      const createdByCurrentUser=Boolean(order.createdBy&&currentUserId&&String(order.createdBy)===String(currentUserId));
      if(order.status==="Borrador"&&permissionGranted("purchases.purchase_orders.submit"))actions.push('<button class="button button-quiet button-small" data-action="submit-purchase-order" data-id="'+esc(order.id)+'">Enviar</button>');
      if(order.status==="Enviada"&&permissionGranted("purchases.approvals.approve")&&!createdByCurrentUser)actions.push('<button class="button button-quiet button-small" data-action="approve-purchase-order" data-id="'+esc(order.id)+'">Aprobar</button>');
      else if(order.status==="Enviada"&&createdByCurrentUser)actions.push('<small class="table-secondary">Requiere otro aprobador</small>');
      if(["Borrador","Enviada"].includes(order.status)&&permissionGranted("purchases.purchase_orders.cancel"))actions.push('<button class="button button-quiet button-small" data-action="cancel-purchase-order" data-id="'+esc(order.id)+'">Cancelar</button>');
      const remaining=lines.reduce((sum,line)=>sum+Math.max(0,Number(line.ordered_quantity||0)-Number(line.received_quantity||0)),0);
      if(["Confirmada","Recepción parcial"].includes(order.status)&&remaining>0&&permissionGranted("purchases.receipts.receive")&&permissionGranted("inventory.receipts.receive"))actions.push('<button class="button button-primary button-small" data-action="receive-purchase-order" data-id="'+esc(order.id)+'">Recibir ('+remaining+')</button>');
      return '<tr><td data-label="Orden" class="table-primary"><strong>'+esc(order.orderNumber)+'</strong><small class="table-secondary">Creada por '+esc(order.createdByName||"Usuario no disponible")+' · '+dateTimeText(order.createdAt)+'</small>'+(order.approvedAt?'<small class="table-secondary">Aprobada por '+esc(order.approvedByName||"Usuario no disponible")+' · '+dateTimeText(order.approvedAt)+'</small>':'')+'</td><td data-label="Proveedor">'+esc(order.supplier)+'</td><td data-label="Productos">'+(itemSummary||'—')+'</td><td data-label="Entrega estimada">'+(order.expectedDate?dateText(order.expectedDate):'—')+'</td><td data-label="Total">'+money(order.totalUsd)+'</td><td data-label="Recepciones">'+(receiptCounts.get(String(order.id))||0)+'</td><td data-label="Estado"><span class="status-chip '+(order.status==="Recibida"?'status-success':order.status==="Cancelada"?'status-muted':'status-pending')+'">'+esc(order.status)+'</span>'+(order.approvedAt?'<small class="table-secondary">Aprobada · '+dateText(order.approvedAt)+'</small>':'')+'</td><td data-label="Acciones">'+(actions.join(' ')||'—')+'</td></tr>';
    }).join('');
    const supplierOptions=suppliers.filter(supplier=>supplier.active!==false).map(supplier=>'<option value="'+esc(supplier.id)+'">'+esc(supplier.name)+'</option>').join('');
    const canCreate=permissionGranted("purchases.purchase_orders.create")&&permissionGranted("products.catalog.view")&&permissionGranted("suppliers.records.view");
    const createForm=canCreate?'<section class="panel purchase-order-create"><div class="panel-heading"><div><h2>Nueva orden</h2><p>Completa los datos por etapas; el número de OC se genera al crearla.</p></div></div>'+
      '<form id="purchase-order-form" novalidate>'+
      '<div class="purchase-order-step-tabs" role="tablist" aria-label="Etapas de la orden de compra">'+
      '<button type="button" id="po-tab-general" role="tab" aria-selected="true" aria-controls="po-panel-general" class="po-step-tab is-active" data-action="purchase-order-tab" data-tab="general"><span class="po-step-number">01</span><span>Datos</span></button>'+
      '<button type="button" id="po-tab-products" role="tab" aria-selected="false" aria-controls="po-panel-products" class="po-step-tab" data-action="purchase-order-tab" data-tab="products"><span class="po-step-number">02</span><span>Productos</span></button>'+
      '<button type="button" id="po-tab-adjustments" role="tab" aria-selected="false" aria-controls="po-panel-adjustments" class="po-step-tab" data-action="purchase-order-tab" data-tab="adjustments"><span class="po-step-number">03</span><span>Costos y notas</span></button></div>'+
      '<section id="po-panel-general" class="po-step-panel" role="tabpanel" aria-labelledby="po-tab-general" data-po-panel="general"><div class="form-grid">'+
      '<label>Proveedor<select name="supplier_id" required><option value="">Seleccionar proveedor</option>'+supplierOptions+'</select></label>'+
      '<label>Moneda<select name="currency"><option value="USD">USD · Dólar</option><option value="NIO">NIO · Córdoba</option></select></label>'+
      '<label>Tipo de cambio<input name="exchange_rate" type="number" min="0.0001" step="0.0001" value="'+Number(exchangeRate).toFixed(4)+'" required></label>'+
      '<label>Entrega estimada<input name="expected_delivery_date" type="date"></label>'+
      '<label class="purchase-order-full-field">Condición de pago<select name="payment_terms"><option value="Contado">Contado</option><option value="Crédito 15 días">Crédito · 15 días</option><option value="Crédito 30 días">Crédito · 30 días</option><option value="Crédito 45 días">Crédito · 45 días</option><option value="Crédito 60 días">Crédito · 60 días</option><option value="Por acordar">Por acordar</option></select></label>'+
      '</div></section>'+
      '<section id="po-panel-products" class="po-step-panel" role="tabpanel" aria-labelledby="po-tab-products" data-po-panel="products" hidden>'+
      '<div class="purchase-order-lines-heading"><strong>Productos solicitados</strong><button class="button button-quiet button-small" type="button" data-action="add-purchase-order-line">Añadir producto</button></div>'+
      '<div id="purchase-order-lines">'+purchaseOrderLineHtml()+'</div></section>'+
      '<section id="po-panel-adjustments" class="po-step-panel" role="tabpanel" aria-labelledby="po-tab-adjustments" data-po-panel="adjustments" hidden>'+
      '<div class="form-grid purchase-order-adjustments"><label>Descuento USD<input name="discount_usd" type="number" min="0" step="0.01" value="0"></label><label>Flete estimado USD<input name="estimated_freight_usd" type="number" min="0" step="0.01" value="0"></label><label>Impuestos estimados USD<input name="estimated_taxes_usd" type="number" min="0" step="0.01" value="0"></label><label class="purchase-order-full-field">Notas de la orden<input name="notes" maxlength="1000" placeholder="Indicaciones para el proveedor (opcional)"></label></div>'+
      '</section><div class="po-form-footer"><span data-po-step-caption>Etapa 1 de 3 · Datos de la orden</span><button class="button button-primary" type="submit">Generar orden <span aria-hidden="true">→</span></button></div></form></section>':'';
    const receiptRows=visibleReceipts.map(receipt=>{
      const status=receipt.documentStatus||receipt.document_status||"Contabilizada";
      const actions=[];
      if(status==="Emitida"&&permissionGranted("purchases.receipts.post"))actions.push('<button class="button button-primary button-small" data-action="post-purchase-receipt" data-id="'+esc(receipt.id)+'">Contabilizar</button>');
      if(status==="Contabilizada"&&receipt.journal_number&&permissionGranted("purchases.receipts.journal.view"))actions.push('<button class="button button-quiet button-small" data-action="view-purchase-journal" data-id="'+esc(receipt.id)+'">Comprobante diario</button>');
      const statusClass=status==="Contabilizada"?"status-success":status==="Anulada"?"status-muted":"status-pending";
      if(status==="Contabilizada"&&!receipt.journal_number)actions.push('<small class="table-secondary">Histórico · sin comprobante diario</small>');
      return '<tr><td data-label="Recepción"><strong>'+esc(receipt.receiptNumber||receipt.receipt_number||"—")+'</strong><small class="table-secondary">Emitida por '+esc(receipt.emitted_by_name||receipt.emittedByName||"Usuario no disponible")+' · '+dateTimeText(receipt.emitted_at||receipt.received_at)+'</small>'+(status==="Contabilizada"?'<small class="table-secondary">Contabilizada por '+esc(receipt.posted_by_name||receipt.postedByName||"Usuario no disponible")+' · '+dateTimeText(receipt.posted_at||receipt.received_at)+'</small>':'')+'</td><td data-label="Factura">'+esc(receipt.supplier_invoice_number||"—")+'</td><td data-label="Fecha">'+dateText(receipt.supplier_invoice_date||receipt.emitted_at||receipt.received_at)+'</td><td data-label="Importe">'+money(Number(receipt.invoice_total_usd||0))+' USD</td><td data-label="Código de compra">'+(receipt.purchaseCode||receipt.purchase_code||"—")+'</td><td data-label="Estado"><span class="status-chip '+statusClass+'">'+esc(status)+'</span>'+(receipt.journal_number?'<small class="table-secondary">CD '+esc(receipt.journal_number)+'</small>':'')+'</td><td data-label="Acciones">'+(actions.join(" ")||"—")+'</td></tr>';
    }).join('');
    const receiptPanel='<article class="list-panel purchase-receipts-panel"><div class="panel-heading"><div><h2>Recepciones y comprobantes</h2><p>Emitidas pendientes de contabilizar o documentos ya registrados en el diario.</p></div><span class="ledger-count">'+visibleReceipts.length+' documentos</span></div><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>RECEPCIÓN</th><th>FACTURA</th><th>FECHA</th><th>TOTAL USD</th><th>CÓDIGO COMPRA</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(receiptRows||'<tr><td colspan="7">Todavía no hay recepciones emitidas.</td></tr>')+'</tbody></table></div></article>';
    const supplierFilterOptions='<option value="all">Todos los proveedores</option>'+suppliers.map(supplier=>'<option value="'+esc(supplier.id)+'"'+(String(state.purchaseHistorySupplier)===String(supplier.id)?' selected':'')+'>'+esc(supplier.name)+'</option>').join("");
    const toolbar='<article class="list-panel purchase-history-tools"><div class="toolbar products-toolbar inventory-ledger-toolbar"><div class="toolbar-left"><label class="inline-search">'+svg("search")+'<input id="purchase-history-search" type="search" value="'+esc(state.purchaseHistoryQuery)+'" placeholder="Orden, proveedor, producto o factura" aria-label="Buscar en órdenes y recepciones"></label></div><div class="toolbar-right"><select class="filter-select" id="purchase-history-supplier" aria-label="Filtrar por proveedor">'+supplierFilterOptions+'</select><select class="filter-select" id="purchase-history-order-status" aria-label="Estado de orden">'+[["all","Todas las órdenes"],["Borrador","Borrador"],["Enviada","Enviada"],["Confirmada","Confirmada"],["Recepción parcial","Recepción parcial"],["Recibida","Recibida"],["Cancelada","Cancelada"]].map(([value,label])=>'<option value="'+value+'"'+(state.purchaseHistoryOrderStatus===value?' selected':'')+'>'+label+'</option>').join("")+'</select><select class="filter-select" id="purchase-history-receipt-status" aria-label="Estado de recepción">'+[["all","Todas las recepciones"],["Emitida","Emitida"],["Contabilizada","Contabilizada"],["Anulada","Anulada"]].map(([value,label])=>'<option value="'+value+'"'+(state.purchaseHistoryReceiptStatus===value?' selected':'')+'>'+label+'</option>').join("")+'</select><input class="filter-select" type="date" id="purchase-history-start" value="'+esc(state.purchaseHistoryStartDate)+'" aria-label="Desde fecha"><input class="filter-select" type="date" id="purchase-history-end" value="'+esc(state.purchaseHistoryEndDate)+'" aria-label="Hasta fecha"><button class="button button-quiet button-small" type="button" data-action="clear-purchase-filters">Limpiar filtros</button></div></div>'+renderPurchaseHistoryArchive()+'<div class="panel-heading"><span class="ledger-count">'+visibleOrders.length+' órdenes · '+visibleReceipts.length+' recepciones</span></div></article>';
    const canViewOrders=permissionGranted("purchases.purchase_orders.view");
    const canViewReceiptDocs=permissionGranted("purchases.receipts.view");
    const availableSections=[
      ...(canViewOrders?[["orders","Órdenes",visibleOrders.length]]:[]),
      ...(canViewReceiptDocs?[["receipts","Recepciones",visibleReceipts.length]]:[]),
      ...(canCreate?[["new","Nueva orden",null]]:[])
    ];
    if(!availableSections.some(([id])=>id===state.purchaseTab))state.purchaseTab=availableSections[0]?.[0]||"orders";
    const sectionTabs='<nav class="purchase-module-tabs" role="tablist" aria-label="Secciones de abastecimiento">'+availableSections.map(([id,label,count])=>'<button type="button" role="tab" aria-selected="'+String(state.purchaseTab===id)+'" class="purchase-module-tab '+(state.purchaseTab===id?'is-active':'')+'" data-action="purchase-section-tab" data-tab="'+id+'"><span>'+label+'</span>'+(count===null?'':'<span class="purchase-tab-count">'+count+'</span>')+'</button>').join("")+'</nav>';
    const orderSummary='<div class="summary-strip purchase-orders-summary-strip"><div class="summary-mini"><span>Órdenes filtradas</span><strong>'+visibleOrders.length+'</strong></div><div class="summary-mini"><span>Borradores</span><strong>'+visibleOrders.filter(x=>x.status==="Borrador").length+'</strong></div><div class="summary-mini"><span>Por aprobar</span><strong>'+visibleOrders.filter(x=>x.status==="Enviada").length+'</strong></div><div class="summary-mini"><span>Por recibir</span><strong>'+visibleOrders.filter(x=>["Confirmada","Recepción parcial"].includes(x.status)).length+'</strong></div></div>';
    const ordersPanel='<article class="list-panel purchase-orders-list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>ORDEN</th><th>PROVEEDOR</th><th>PRODUCTOS / RECIBIDO</th><th>ENTREGA</th><th>TOTAL USD</th><th>RECEPCIONES</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(rows||'<tr><td colspan="8">Todavía no hay órdenes de compra.</td></tr>')+'</tbody></table></div></article>';
    const receiptNotice='<div class="notice-panel"><span>'+svg('shield')+'</span><div><strong>Separación de funciones</strong><p>Emitir una recepción registra la factura, pero no toca existencias ni cuentas por pagar. La contabilización genera el movimiento de inventario, la cuenta por pagar y el comprobante diario de forma atómica.</p></div></div>';
    return heading(views.purchaseOrders,renderExportActions())+sectionTabs+
      (state.purchaseTab==="new"?createForm:"")+
      (state.purchaseTab==="orders"?toolbar+orderSummary+ordersPanel:"")+
      (state.purchaseTab==="receipts"?receiptPanel+receiptNotice:"");
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
    return '<section class="purchases-view">'+heading(views.purchases,'<button class="button button-primary" data-action="new-purchase">'+svg('plus')+' Registrar compra</button>')+'<div class="summary-strip purchases-summary-strip"><div class="summary-mini"><span>Compras</span><strong>'+purchases.length+'</strong></div><div class="summary-mini"><span>Compras USD</span><strong>'+money(total)+'</strong></div><div class="summary-mini"><span>Pagado USD</span><strong>'+money(paid)+'</strong></div><div class="summary-mini"><span>Por pagar USD</span><strong>'+money(due)+'</strong></div></div><article class="list-panel purchases-list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>FECHA</th><th>PROVEEDOR</th><th>PERFUME</th><th>UNIDADES</th><th>TOTAL</th><th>PAGADO USD</th><th>SALDO USD</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="9">No hay compras registradas.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('spark')+'<div><strong>Recepción y costo de inventario</strong><p>La compra actualiza existencias, costo promedio, kardex, saldo del proveedor y el pago inicial cuando corresponde. Los abonos posteriores no modifican el inventario.</p></div></div></section>';
  }
  function renderPayables(){
    const open=supplierInvoices.filter(invoice=>invoice.status!=='Anulada'&&invoice.amountUsd-invoice.paidUsd>0.001);
    const total=open.reduce((sum,invoice)=>sum+Math.max(0,invoice.amountUsd-invoice.paidUsd),0);
    const suppliersOpen=new Set(open.map(invoice=>invoice.supplierId)).size;
    const today=new Date().toISOString().slice(0,10);
    const rows=supplierInvoices.map(invoice=>{
      const balance=Math.max(0,invoice.amountUsd-invoice.paidUsd);
      const overdue=balance>0.001&&invoice.dueDate&&invoice.dueDate<today;
      const linkedOrder=purchaseOrders.find(order=>String(order.id)===String(invoice.purchaseOrderId));
      const paymentRows=supplierInvoicePayments.filter(payment=>String(payment.supplier_invoice_id)===String(invoice.id));
      const status=invoice.status==='Pagada'?'Pagada':invoice.status==='Anulada'?'Anulada':invoice.paidUsd>0?'Abono parcial':overdue?'Vencida':'Pendiente';
      const action=balance>0.001&&invoice.status!=='Anulada'&&permissionGranted('payables.payments.create')?'<button class="button button-quiet button-small" data-action="new-supplier-invoice-payment" data-id="'+esc(invoice.id)+'">Registrar pago</button>':'—';
      return '<tr><td data-label="Factura / fecha" class="table-primary"><strong>'+esc(invoice.invoiceNumber)+'</strong><small class="table-secondary">'+dateText(invoice.invoiceDate)+'</small><small class="table-secondary">'+paymentRows.length+' pago(s)</small></td><td data-label="Proveedor">'+esc(invoice.supplier)+'</td><td data-label="Orden relacionada">'+(linkedOrder?esc(linkedOrder.orderNumber):'—')+'</td><td data-label="Total USD">'+money(invoice.amountUsd)+'<small class="table-secondary">'+moneyInCurrency(invoice.originalAmount,invoice.currency)+' · '+invoice.currency+'</small></td><td data-label="Pagado">'+money(invoice.paidUsd)+'</td><td data-label="Saldo"><strong>'+money(balance)+'</strong></td><td data-label="Vencimiento">'+dateText(invoice.dueDate)+'</td><td data-label="Estado"><span class="status-chip '+(status==='Pagada'?'status-success':status==='Vencida'?'status-danger':'status-pending')+'">'+status+'</span></td><td data-label="Acción">'+action+'</td></tr>';
    }).join('');
    const canCreate=permissionGranted('purchases.supplier_invoices.create')&&permissionGranted('suppliers.records.view');
    const legacy=purchases.filter(p=>Number(p.totalUsd||0)-Number(p.paidUsd||0)>0.001);
    const legacyRows=legacy.map(p=>'<tr><td>'+dateText(p.createdAt)+'</td><td>'+esc(p.supplier)+'</td><td>'+esc(p.product)+' · '+p.quantity+' uds.</td><td>'+money(p.totalUsd)+'</td><td>'+money(p.paidUsd)+'</td><td>'+money(Math.max(0,p.totalUsd-p.paidUsd))+'</td><td><button class="button button-quiet button-small" data-action="new-purchase-payment" data-id="'+esc(p.id)+'">Abonar compra anterior</button></td></tr>').join('');
    return heading(views.payables,(canCreate?'<button class="button button-primary" data-action="new-supplier-invoice">'+svg('plus')+' Registrar factura</button>':'')+'<button class="button button-quiet" data-view="purchaseOrders">Órdenes de compra</button>')+
      '<div class="summary-strip"><div class="summary-mini"><span>Saldo documental USD</span><strong>'+money(total)+'</strong></div><div class="summary-mini"><span>Proveedores pendientes</span><strong>'+suppliersOpen+'</strong></div><div class="summary-mini"><span>Facturas abiertas</span><strong>'+open.length+'</strong></div><div class="summary-mini"><span>Facturas vencidas</span><strong>'+open.filter(invoice=>invoice.dueDate&&invoice.dueDate<today).length+'</strong></div></div>'+
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>FACTURA / FECHA</th><th>PROVEEDOR</th><th>ORDEN</th><th>TOTAL</th><th>PAGADO</th><th>SALDO</th><th>VENCE</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead><tbody>'+(rows||'<tr><td colspan="9">Todavía no hay facturas de proveedor registradas.</td></tr>')+'</tbody></table></div></article>'+
      (legacyRows?'<article class="list-panel"><div class="panel-heading"><div><h3>Compras anteriores</h3><p>Registros del flujo anterior; sus saldos se conservan hasta completar su conciliación documental.</p></div></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>PROVEEDOR</th><th>PRODUCTO</th><th>TOTAL</th><th>PAGADO</th><th>SALDO</th><th></th></tr></thead><tbody>'+legacyRows+'</tbody></table></div></article>':'')+
      '<div class="notice-panel">'+svg('shield')+'<div><strong>Conciliación documental y financiera</strong><p>Las facturas registran la deuda real; los pagos conservan moneda, tipo de cambio, cuenta de salida y referencia. Las recepciones actualizan inventario por separado, evitando duplicar existencias.</p></div></div>';
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
  function getDgiBookRows(){
    return [['Fecha','Tipo de operación','Tercero / descripción','Referencia','Importe NIO','Clasificación'],
      ...invoices.filter(i=>!['Anulada','Cancelada','Anulado','Cancelado'].includes(i.status)).flatMap(i=>(i.payments||[]).map(payment=>[
        dateText(payment.createdAt),'Cobro recibido · factura',i.customer,i.id,dgiAmountNio(payment.amountUsd,payment.exchangeRate||1),'Ingreso percibido'
      ])),
      ...cashEntries.filter(entry=>entry.direction==='income'&&!entry.sourceType).map(entry=>[
        dateText(entry.createdAt),'Ingreso de caja sin documento vinculado',entry.concept,entry.id,dgiAmountNio(entry.amountUsd,entry.exchangeRate||1),'Ingreso por conciliar'
      ]),
      ...purchases.map(p=>[
        dateText(p.createdAt),'Compra de inventario',p.supplier,p.purchaseNumber,dgiAmountNio(p.totalUsd,p.exchangeRate||exchangeRate),'Egreso / compra'
      ]),
      ...expenses.map(e=>[
        dateText(e.createdAt),'Gasto · '+e.category,e.description,e.id,dgiAmountNio(e.amountUsd,e.exchangeRate||exchangeRate),'Egreso'
      ])
    ];
  }
  function exportDgiBook(){
    exportCsvFile('jb-parfums-libro-auxiliar-dgi.csv',getDgiBookRows());
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
    if(!permissionGranted('dgi.documents.view'))return heading(views.dgi,'')+'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Acceso restringido</strong><p>Tu cuenta no tiene permiso para consultar los documentos DGI.</p></div></div>';
    if(!dgiDocumentsLoaded&&!dgiDocumentsLoading&&!dgiDocumentsLoadAttempted)loadDgiSupportDocuments(false);
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
      renderAccessManager()+
      '<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>Entorno de trabajo: Neon Development</strong><p>Los cambios de esta etapa se prueban en Desarrollo. Neon Production no recibe migraciones ni datos hasta validar el sistema y revisar los consumos.</p></div></div>';
  }
  async function loadAccessManager(force = false) {
    if (window.JBAuth?.profile?.role !== "owner") return;
    if (accessManager.loading || (accessManager.loaded && !force) || (accessManager.attempted && !force)) return;
    accessManager.attempted = true;
    accessManager.loading = true;
    accessManager.error = "";
    try {
      const [users, roles, audit, clientErrors] = await Promise.all([
        erpApi("users"), erpApi("roles"), erpApi("audit"), erpApi("client-errors")
      ]);
      accessManager.users = users.users || [];
      accessManager.pendingIdentities = users.pendingIdentities || [];
      accessManager.roles = roles.roles || [];
      accessManager.permissions = roles.permissions || [];
      accessManager.grants = roles.grants || [];
      accessManager.audit = audit.records || [];
      accessManager.clientErrors = clientErrors.records || [];
      if (!accessSelectedRole || !accessManager.roles.some(role => role.role_key === accessSelectedRole)) {
        accessSelectedRole = accessManager.roles.find(role => role.role_key !== "owner")?.role_key || "";
      }
      accessManager.loaded = true;
    } catch (error) {
      accessManager.error = error?.message || "No se pudo cargar la administración de accesos.";
      accessManager.loaded = false;
    } finally {
      accessManager.loading = false;
      if (state.view === "settings") renderView();
    }
  }

  function renderAccessManager() {
    if (window.JBAuth?.profile?.role !== "owner") return "";
    if (!accessManager.attempted) loadAccessManager();
    if (accessManager.loading && !accessManager.loaded) {
      return '<article class="panel"><div class="panel-heading"><div><h2>Administración de accesos</h2><p>Cargando cuentas, plantillas, permisos y auditoría…</p></div></div></article>';
    }
    if (accessManager.error && !accessManager.loaded) {
      return '<article class="panel"><div class="panel-heading"><div><h2>Administración de accesos</h2><p>'+esc(accessManager.error)+'</p></div><button class="button button-quiet button-small" data-action="refresh-access-manager">Reintentar</button></div></article>';
    }

    const roleOptions = accessManager.roles.filter(role => role.role_key !== "owner")
      .map(role => '<option value="'+esc(role.role_key)+'"'+(role.role_key==="viewer"?' selected':'')+'>'+esc(role.name)+'</option>').join("");
    const userRows = accessManager.users.map(user => {
      if (user.role === "owner") {
        return '<tr><td><strong>'+esc(user.display_name)+'</strong><small class="table-secondary">'+esc(user.email)+'</small></td><td>Propietario</td><td>Protegido</td><td><span class="status-chip status-success">Activo</span></td><td>—</td></tr>';
      }
      const statusOptions = ["invited","registered","active","rejected","disabled"]
        .map(status => '<option value="'+status+'"'+(user.account_status===status?' selected':'')+'>'+({
          invited:"Invitado",registered:"Registrado",active:"Activo",rejected:"Rechazado",disabled:"Deshabilitado"
        })[status]+'</option>').join("");
      const userOverrides = Array.isArray(user.overrides) ? user.overrides : [];
      const overrideRows = userOverrides.map(override => {
        const permission = accessManager.permissions.find(item=>item.permission_key===override.permission_key);
        return '<div class="permission-override-row" data-override-key="'+esc(override.permission_key)+'">'+
          '<span>'+esc(permission?.label||"Permiso")+'</span>'+
          '<select class="filter-select" data-override-value><option value="allow"'+(override.allowed?' selected':'')+'>Permitir</option><option value="deny"'+(!override.allowed?' selected':'')+'>Denegar</option></select>'+
          '<button type="button" class="button button-quiet button-small" data-action="remove-user-override" aria-label="Quitar excepción">Quitar</button></div>';
      }).join("");
      const overridePermissionOptions = accessManager.permissions.map(permission =>
        '<option value="'+esc(permission.permission_key)+'">'+esc(permission.label)+'</option>'
      ).join("");
      return '<tr data-user-id="'+esc(user.id)+'"><td><strong>'+esc(user.display_name)+'</strong><small class="table-secondary">'+esc(user.email)+'</small></td>'+
        '<td><input class="filter-select" data-user-position value="'+esc(user.position_title||"")+'" maxlength="120" placeholder="Cargo libre"></td>'+
        '<td><select class="filter-select" data-user-role>'+accessManager.roles.filter(role=>role.role_key!=="owner").map(role=>'<option value="'+esc(role.role_key)+'"'+(user.role_template_key===role.role_key?' selected':'')+'>'+esc(role.name)+'</option>').join("")+'</select></td>'+
        '<td><select class="filter-select" data-user-status>'+statusOptions+'</select></td>'+
        '<td class="user-access-controls"><label><input type="checkbox" data-user-password'+(user.must_change_password?' checked':'')+'> Cambio inicial</label>'+
        '<details class="user-overrides"><summary>Excepciones ('+userOverrides.length+')</summary><div data-user-overrides>'+overrideRows+'</div>'+
        '<div class="permission-override-add"><select class="filter-select" data-new-override-permission aria-label="Permiso individual">'+overridePermissionOptions+'</select>'+
        '<select class="filter-select" data-new-override-value aria-label="Efecto"><option value="allow">Permitir</option><option value="deny">Denegar</option></select>'+
        '<button type="button" class="button button-quiet button-small" data-action="add-user-override">Añadir</button></div>'+
        '<small class="form-helper">Las excepciones reemplazan el valor de la plantilla para esta cuenta.</small></details>'+
        '<button class="button button-quiet button-small" data-action="save-user-access">Guardar cuenta</button></td></tr>';
    }).join("");

    const pendingRows = accessManager.pendingIdentities.map(identity =>
      '<tr data-pending-email="'+esc(identity.email)+'" data-employee-id="'+esc(identity.employee_id||'')+'"><td><strong>'+esc(identity.email)+'</strong><small class="table-secondary">'+(identity.email_verified?'Correo verificado':'Correo pendiente de verificar')+'</small>'+(identity.employee_name?'<small class="table-secondary">Ficha: '+esc(identity.employee_name)+'</small>':'')+'</td>'+
      '<td><input class="filter-select" data-pending-name value="'+esc(identity.display_name||"")+'" maxlength="180" placeholder="Nombre completo"></td>'+
      '<td><input class="filter-select" data-pending-position maxlength="120" placeholder="Cargo libre"></td>'+
      '<td><select class="filter-select" data-pending-role>'+roleOptions+'</select></td>'+
      '<td><button class="button button-primary button-small" data-action="provision-user-account">Preparar cuenta ERP</button></td></tr>'
    ).join("");

    const selectedRole = accessManager.roles.find(role=>role.role_key===accessSelectedRole);
    const granted = new Set(accessManager.grants.filter(grant=>grant.role_key===accessSelectedRole && grant.allowed===true).map(grant=>grant.permission_key));
    const moduleRows = accessManager.permissions.filter(permission=>permission.permission_type==="module");
    const permissionGroups = moduleRows.map(module => {
      const modulePermissions = accessManager.permissions.filter(permission=>permission.module_key===module.module_key);
      const rows = modulePermissions.map(permission => {
        const level = permission.permission_type==="module" ? "Módulo" : permission.permission_type==="section" ? "Sección" : "Acción";
        const indent = permission.permission_type==="module" ? 0 : permission.permission_type==="section" ? 16 : 34;
        return '<label class="permission-editor-row" style="padding-left:'+indent+'px"><input type="checkbox" name="permission" value="'+esc(permission.permission_key)+'"'+(granted.has(permission.permission_key)?' checked':'')+'><span>'+esc(permission.label)+'</span><small>'+level+'</small></label>';
      }).join("");
      const enabledCount = modulePermissions.filter(permission=>granted.has(permission.permission_key)).length;
      return '<details class="permission-editor-module"><summary><span>'+esc(module.label)+'</span><small>'+enabledCount+' / '+modulePermissions.length+' permisos</small></summary><div class="permission-editor-module-content">'+rows+'</div></details>';
    }).join("");

    const auditDetailsSummary = record => {
      const details=record.details&&typeof record.details==="object"?record.details:{};
      const labels={
        order_number:"Orden",receipt_number:"Recepción",supplier_invoice_number:"Factura",
        purchase_code:"Código de compra",journal_number:"Comprobante",invoice_total_usd:"Total USD",
        inventory_movement_count:"Movimientos",line_count:"Líneas",document_status:"Estado",
        status:"Estado",quantity:"Cantidad",movement_type:"Movimiento",supplier_name:"Proveedor"
      };
      const parts=Object.entries(labels).filter(([key])=>details[key]!==undefined&&details[key]!==null&&details[key]!=="")
        .map(([key,label])=>label+": "+String(details[key]));
      return parts.join(" · ")||"—";
    };
    const auditRows = accessManager.audit.slice(0,100).map(record =>
      '<tr><td>'+esc(new Date(record.created_at).toLocaleString("es-NI"))+'</td><td>'+esc(record.actor_name||"Sistema")+(record.actor_email?'<small class="table-secondary">'+esc(record.actor_email)+'</small>':'')+'</td><td>'+esc(record.action)+'</td><td>'+esc(record.entity_type)+(record.entity_id?' · '+esc(record.entity_id):'')+'</td><td>'+esc(auditDetailsSummary(record))+'</td></tr>'
    ).join("");
    const clientErrorRows = accessManager.clientErrors.slice(0,100).map(error =>
      '<tr><td>'+esc(new Date(error.created_at).toLocaleString("es-NI"))+'</td><td>'+esc(error.actor_name||"Usuario")+'</td><td><span class="status-chip status-warning">'+esc(error.error_type)+'</span></td><td>'+esc(error.error_message)+'</td><td>'+esc(error.page_path||"/")+(error.source_file?' · '+esc(error.source_file):'')+(error.line_number?' :'+Number(error.line_number):'')+'</td></tr>'
    ).join("");

    return '<section class="access-manager-section">'+
      '<div class="panel-heading"><div><span class="eyebrow">CONTROL DEL PROPIETARIO</span><h2>Administración de accesos</h2><p>Solo el propietario puede autorizar identidades, editar permisos y consultar auditoría.</p></div><button class="button button-quiet button-small" data-action="refresh-access-manager">Actualizar</button></div>'+
      '<article class="panel"><div class="panel-heading"><div><h3>Cuentas ERP</h3><p>El cargo es texto libre. El estado activo es lo que habilita la entrada al ERP.</p></div><span class="ledger-count">'+accessManager.users.length+' cuentas</span></div>'+
      '<div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>CUENTA</th><th>CARGO</th><th>PLANTILLA</th><th>ESTADO</th><th>SEGURIDAD</th></tr></thead><tbody>'+(userRows||'<tr><td colspan="5">No hay cuentas provisionadas.</td></tr>')+'</tbody></table></div></article>'+
      '<article class="panel"><div class="panel-heading"><div><h3>Identidades pendientes</h3><p>La identidad ya debe existir en Neon Auth. Esta acción crea el perfil ERP, inicialmente bloqueado; no crea la contraseña ni envía una invitación.</p></div><span class="ledger-count">'+accessManager.pendingIdentities.length+' pendientes</span></div>'+
      '<div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>IDENTIDAD</th><th>NOMBRE</th><th>CARGO</th><th>PLANTILLA</th><th></th></tr></thead><tbody>'+(pendingRows||'<tr><td colspan="5">No hay identidades nuevas pendientes.</td></tr>')+'</tbody></table></div></article>'+
      '<article class="panel"><div class="panel-heading"><div><h3>Plantillas de permisos</h3><p>Los permisos de módulo, sección y acción se configuran por separado. Activar un padre no activa automáticamente sus hijos.</p></div>'+
      '<select class="filter-select" id="access-role-select">'+accessManager.roles.filter(role=>role.role_key!=="owner").map(role=>'<option value="'+esc(role.role_key)+'"'+(role.role_key===accessSelectedRole?' selected':'')+'>'+esc(role.name)+'</option>').join("")+'</select></div>'+
      (selectedRole ? '<form id="role-permissions-form" data-role-key="'+esc(accessSelectedRole)+'"><div class="permission-editor-grid">'+permissionGroups+'</div><div class="modal-actions"><button class="button button-primary" type="submit">Guardar permisos de plantilla</button></div></form>' : '<p>No hay plantillas editables disponibles.</p>')+
      '<form id="role-create-form" class="rate-form"><label class="form-field"><span>Clave nueva</span><input name="role_key" maxlength="32" pattern="[a-z][a-z0-9_-]{2,31}" placeholder="supervisor" required></label><label class="form-field"><span>Nombre</span><input name="name" maxlength="80" placeholder="Supervisor de tienda" required></label><label class="form-field"><span>Descripción</span><input name="description" maxlength="240" placeholder="Responsabilidades del puesto"></label><button class="button button-quiet" type="submit">Crear plantilla vacía</button></form></article>'+
      '<article class="panel"><div class="panel-heading"><div><h3>Auditoría reciente</h3><p>Últimos 100 cambios registrados, con identidad, fecha y detalle disponible.</p></div></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>ACTOR</th><th>ACCIÓN</th><th>REGISTRO</th><th>DETALLE</th></tr></thead><tbody>'+(auditRows||'<tr><td colspan="5">Todavía no hay eventos de auditoría.</td></tr>')+'</tbody></table></div></article>'+
      '<article class="panel"><div class="panel-heading"><div><h3>Monitoreo de errores del navegador</h3><p>Últimos 100 errores reportados por sesiones autenticadas. Los datos sensibles se filtran antes de guardarse.</p><span class="ledger-count">'+accessManager.clientErrors.length+' eventos</span></div></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>USUARIO</th><th>TIPO</th><th>ERROR</th><th>ORIGEN</th></tr></thead><tbody>'+(clientErrorRows||'<tr><td colspan="5">No se han reportado errores técnicos del navegador.</td></tr>')+'</tbody></table></div></article>'+
      '</section>';
  }

  function closeNotificationPanel() {
    const panel=document.getElementById('notification-panel');
    const button=document.querySelector('.notification-button');
    if(panel)panel.hidden=true;
    if(button)button.setAttribute('aria-expanded','false');
  }
  function renderNotificationPanel() {
    const panel=document.getElementById('notification-panel');
    const list=document.getElementById('notification-list');
    if(!panel||!list)return;
    if(notificationsLoading&&!notificationRecords.length){
      list.innerHTML='<p class="notification-empty">Cargando notificaciones…</p>';
      return;
    }
    if(!notificationRecords.length){
      list.innerHTML='<p class="notification-empty">No hay notificaciones pendientes. Las nuevas solicitudes y alertas aparecerán aquí.</p>';
      return;
    }
    list.innerHTML=notificationRecords.map(item=>{
      const timestamp=item.created_at?new Date(item.created_at).toLocaleString('es-NI',{dateStyle:'short',timeStyle:'short'}):'';
      const severity=item.severity==='critical'?'Crítica':item.severity==='warning'?'Importante':'Informativa';
      return '<button type="button" class="notification-item '+(item.read_at?'is-read':'is-unread')+'" data-notification-open data-id="'+esc(item.id)+'" data-view="'+esc(item.target_view||'dashboard')+'">'+
        '<span class="notification-item-top"><strong>'+esc(item.title)+'</strong><span class="notification-severity severity-'+esc(item.severity)+'">'+severity+'</span></span>'+
        '<span class="notification-item-message">'+esc(item.message)+'</span><span class="notification-item-time">'+esc(timestamp)+(item.read_at?' · Leída':' · Nueva')+'</span></button>';
    }).join('');
  }
  function updateNotificationIndicator() {
    const button=document.querySelector('.notification-button');
    const count=document.getElementById('notification-count');
    const unread=Math.max(0,Number(notificationUnreadCount||0));
    if(count){count.textContent=unread>99?'99+':String(unread);count.hidden=unread===0;}
    if(button)button.setAttribute('aria-label',unread?('Notificaciones: '+unread+' sin leer'):'Notificaciones: sin alertas nuevas');
  }
  async function loadNotifications(options={}) {
    if(notificationsLoading)return;
    notificationsLoading=true;
    renderNotificationPanel();
    try{
      const response=await erpApi('notifications');
      notificationRecords=Array.isArray(response.notifications)?response.notifications:[];
      notificationUnreadCount=Number(response.unread_count||0);
      updateNotificationIndicator();
      renderNotificationPanel();
      return true;
    }catch(error){
      if(!options.silent){
        const list=document.getElementById('notification-list');
        if(list)list.innerHTML='<p class="notification-error">'+esc(error?.message||'No se pudo cargar el centro de notificaciones.')+'</p>';
      }
      return false;
    }finally{notificationsLoading=false;}
  }
  async function markAllNotificationsRead() {
    const button=document.getElementById('notification-mark-all');
    if(button)button.disabled=true;
    try{
      await erpApi('notifications/read-all',{method:'PATCH',body:JSON.stringify({})});
      await loadNotifications({silent:true});
    }catch(error){toast(error?.message||'No se pudieron marcar las notificaciones como leídas.');}
    finally{if(button)button.disabled=false;}
  }
  async function openNotification(button) {
    const id=button.getAttribute('data-id');
    const targetView=button.getAttribute('data-view');
    if(!id)return;
    button.disabled=true;
    try{
      await erpApi('notifications/'+encodeURIComponent(id)+'/read',{method:'PATCH',body:JSON.stringify({})});
      await loadNotifications({silent:true});
      closeNotificationPanel();
      if(targetView)goToView(targetView);
    }catch(error){toast(error?.message||'No se pudo abrir la notificación.');}
    finally{button.disabled=false;}
  }
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'&&window.JBAuth?.profile)loadNotifications({silent:true});
  });
  window.setInterval(function(){
    if(document.visibilityState==='visible'&&window.navigator.onLine&&window.JBAuth?.profile)loadNotifications({silent:true});
  },120000);
  function renderView() {
    if (!canViewERPView(state.view)) state.view = firstPermittedView() || "dashboard";
    const meta = views[state.view] || views.dashboard;
    document.getElementById('breadcrumb-current').textContent = meta.title;
    document.getElementById('page-eyebrow').textContent = meta.eyebrow;
    document.querySelectorAll('.nav-item').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-view') === state.view);
    });
    const renderers = {
      dashboard: renderDashboard,
      products: renderProducts,
      catalog: renderCatalog,
      resources: renderResourceMonitor,
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
      purchaseOrders: renderPurchaseOrders,
      payables: renderPayables,
      suppliers: renderSuppliers,
      expenses: renderExpenses,
      cash: renderCash
    };
    root.innerHTML = (renderers[state.view] || renderDashboard)();
    const pageActions=root.querySelector('.page-heading .heading-actions');
    if(state.view==='inventory'){
      const inventoryActions=root.querySelector('.inventory-page-actions');
      if(inventoryActions)inventoryActions.insertAdjacentHTML('afterbegin',renderExportActions());
    }else if(pageActions&&!pageActions.querySelector('[data-action="toggle-export-menu"]')){
      pageActions.insertAdjacentHTML('afterbegin',renderExportActions());
    }
    applyPermissionNavigation();
    applyPermissionActions();
    updateNotificationIndicator();
    if(state.view==='inventory'){
      loadInventorySummary();
      loadInventoryStockPage();
      loadInventoryMovementPage();
    }
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
    state.inventoryMovementActor = '';
    state.inventoryMovementSupplier = '';
    state.inventoryMovementType = 'all';
    state.inventoryMovementStartDate = '';
    state.inventoryMovementEndDate = '';
    state.inventoryMovementPage = 1;
    state.inventoryStockPage = 1;
    renderView();
    closeMobileMenu();
    if (view === 'catalog') loadCatalogSettings().then(() => { if (state.view === 'catalog') renderView(); });
    if (view === 'resources') loadResourceUsage().then(() => { if (state.view === 'resources') renderView(); }).catch(() => { if (state.view === 'resources') renderView(); });
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
    const movementSelect = stockForm.elements.type;
    const allowedTypes = [
      { value: "entry", permission: "inventory.receipts.receive" },
      { value: "exit", permission: "inventory.manual_out.create" },
      { value: "adjustment", permission: "inventory.adjustments.adjust" }
    ].filter((item) => permissionGranted(item.permission));
    if (!allowedTypes.length) { toast("Tu cuenta no tiene permiso para registrar movimientos manuales."); return; }
    Array.from(movementSelect.options).forEach((option) => {
      const allowed = allowedTypes.some((item) => item.value === option.value);
      option.hidden = !allowed;
      option.disabled = !allowed;
    });
    stockForm.reset();
    movementSelect.value = allowedTypes[0].value;
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
    { value: 'larger', label: '120%' },
    { value: 'largest', label: '130%' },
    { value: 'huge', label: '140%' },
    { value: 'extra', label: '150%' }
  ];
  let fontLevelIndex = 2;
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
  try {
    const savedFontLevel = window.localStorage.getItem('jbparfums-font-level');
    if (savedFontLevel !== null && Number.isInteger(Number(savedFontLevel))) {
      setFontLevel(Number(savedFontLevel), false);
    } else {
      setFontLevel(fontLevelIndex, false);
    }
  } catch (error) {
    setFontLevel(fontLevelIndex, false);
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
    dialog.className='modal catalog-import-dialog';dialog.id='catalog-import-dialog';
    dialog.innerHTML='<form method="dialog" class="modal-card catalog-import-card"><div class="modal-heading"><div><span class="eyebrow">CATÁLOGO · IMPORTACIÓN</span><h2>Importar productos</h2></div><button type="button" class="icon-button modal-close" data-import-close aria-label="Cerrar">×</button></div><p class="modal-note">Admite CSV, PDF, PNG, JPG y JPEG. CSV conserva las columnas; PDF e imágenes usan lectura de texto y OCR local. Revisa y corrige los datos antes de guardarlos en Neon.</p><div class="form-grid"><label class="form-field full-field"><span>Seleccionar archivo</span><input id="catalog-import-file" type="file" accept=".csv,.pdf,.png,.jpg,.jpeg,text/csv,application/pdf,image/png,image/jpeg" required></label><label class="form-field full-field"><span>Importe detectado en PDF / imagen</span><select id="catalog-import-amount"><option value="none">No asignar automáticamente</option><option value="price">Asignar a precio de venta (USD)</option><option value="cost">Asignar a costo de compra (USD)</option></select><small class="form-helper">No se supondrá si una cifra detectada es costo o precio. En PDF e imágenes la detección es preliminar.</small></label></div><p id="catalog-import-status" class="form-helper" role="status">Selecciona un archivo para comenzar.</p><div id="catalog-import-preview" class="table-wrap" style="max-height:42vh;overflow:auto"></div><div class="modal-actions"><button type="button" class="button button-quiet" data-import-close>Cancelar</button><button type="button" class="button button-primary" id="catalog-import-save" disabled>Importar productos a Neon</button></div></form>';
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
      previewNode.innerHTML = '<table class="data-table"><thead><tr><th>SKU</th><th>PRODUCTO</th><th>MARCA</th><th>PRECIO USD</th><th>COSTO USD</th><th>STOCK</th><th></th></tr></thead><tbody>' +
        records.map((record, index) =>
          '<tr><td><input class="filter-select" style="min-width:120px" data-import-index="' + index + '" data-import-field="sku" value="' + esc(record.sku) + '" aria-label="SKU"></td>' +
          '<td><input class="filter-select" style="min-width:180px" data-import-index="' + index + '" data-import-field="name" value="' + esc(record.name) + '" aria-label="Producto"></td>' +
          '<td><input class="filter-select" style="min-width:110px" data-import-index="' + index + '" data-import-field="brand" value="' + esc(record.brand || '') + '" aria-label="Marca"></td>' +
          '<td><input class="filter-select" style="min-width:110px" data-import-index="' + index + '" data-import-field="price_usd" type="number" min="0" step="0.01" value="' + Number(record.price_usd || 0) + '" aria-label="Precio"></td>' +
          '<td><input class="filter-select" style="min-width:110px" data-import-index="' + index + '" data-import-field="purchase_cost_usd" type="number" min="0" step="0.01" value="' + Number(record.purchase_cost_usd || 0) + '" aria-label="Costo"></td>' +
          '<td><input class="filter-select" style="min-width:75px" data-import-index="' + index + '" data-import-field="stock" type="number" min="0" step="1" value="' + Number(record.stock || 0) + '" aria-label="Stock"></td>' +
          '<td><button type="button" class="table-action table-action-danger" data-import-remove="' + index + '" aria-label="Quitar fila">×</button></td></tr>'
        ).join('') + '</tbody></table>';
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
    if(!event.target.closest('.notification-wrap'))closeNotificationPanel();
    if(event.target.closest('.notification-button')){
      const panel=document.getElementById('notification-panel');
      const button=event.target.closest('.notification-button');
      if(panel){const open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)await loadNotifications({silent:false});}
      return;
    }
    if(event.target.closest('#notification-mark-all')){await markAllNotificationsRead();return;}
    const notificationButton=event.target.closest('[data-notification-open]');
    if(notificationButton){await openNotification(notificationButton);return;}
    if(!event.target.closest('.export-actions')){
      const openMenu=document.getElementById('current-export-menu');
      if(openMenu&&!openMenu.hidden){openMenu.hidden=true;const trigger=root.querySelector('[data-action="toggle-export-menu"]');if(trigger)trigger.setAttribute('aria-expanded','false');}
    }
    const viewButton = event.target.closest('[data-view], [data-view-link]');
    if (viewButton) {
      goToView(viewButton.getAttribute('data-view') || viewButton.getAttribute('data-view-link'));
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) {
      const name = action.getAttribute('data-action');
      if(name==='toggle-export-menu'){
        const menu=document.getElementById('current-export-menu');
        if(!menu)return;
        menu.hidden=!menu.hidden;
        if(!menu.hidden && window.matchMedia('(max-width: 720px)').matches){
          const rect=action.getBoundingClientRect();
          const width=Math.min(240,window.innerWidth-24);
          const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
          menu.style.position='fixed';
          menu.style.left=left+'px';
          menu.style.right='auto';
          menu.style.top=Math.min(rect.bottom+8,window.innerHeight-180)+'px';
          menu.style.width=width+'px';
          menu.style.maxHeight='min(260px, calc(100dvh - '+(Math.min(rect.bottom+20,window.innerHeight-180))+'px - 16px))';
          menu.style.overflowY='auto';
        }else{
          menu.removeAttribute('style');
        }
        action.setAttribute('aria-expanded',String(!menu.hidden));
        return;
      } else if(name==='export-current-view'){
        const menu=document.getElementById('current-export-menu');
        if(menu){menu.hidden=true;menu.removeAttribute('style');}
        const trigger=root.querySelector('[data-action="toggle-export-menu"]');
        if(trigger)trigger.setAttribute('aria-expanded','false');
        await exportCurrentView(action.getAttribute('data-format')||'csv');
        return;
      } else if (name === 'reload-erp') {
        action.disabled=true;
        loadERPFromNeon(true).then(()=>renderView()).catch(error=>toast(error?.message||'No se pudo cargar Neon.')).finally(()=>{action.disabled=false;});
      } else if (name === 'reload-catalog-settings') {
        action.disabled=true;
        loadCatalogSettings(true).then(()=>renderView()).finally(()=>{action.disabled=false;});
      } else if (name === 'save-catalog-settings') {
        action.disabled=true;
        await saveCatalogSettings(false);
        action.disabled=false;
      } else if (name === 'generate-catalog-pdf') {
        action.disabled=true;
        try { await generateCatalogPDF(); } finally { action.disabled=false; }
      } else if (name === 'refresh-resource-usage') {
        action.disabled=true;
        try { await loadResourceUsage(true); renderView(); } catch (error) { renderView(); toast(error?.message || 'No se pudo actualizar el monitor.'); }
        finally { action.disabled=false; }
      } else if (name === 'import-products') openCatalogImport();
      else if (name === 'new-product') openProductModal();
      else if (name === 'edit-product') openProductModal(action.getAttribute('data-id'));
      else if (name === 'preview-product') showProductDetails(action.getAttribute('data-id'));
      else if (name === 'inventory-view-product') showInventoryProductDetails(action.getAttribute('data-id'));
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
        loadInventoryMovementPage();
      }
      else if (name === 'inventory-stock-page') {
        const step = action.getAttribute('data-page') === 'previous' ? -1 : 1;
        state.inventoryStockPage = Math.max(1, state.inventoryStockPage + step);
        loadInventoryStockPage();
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
        state.inventoryStockPage = 1;
        loadInventoryStockPage();
      }
      else if (name === 'purchase-month-filter') {
        state.purchaseHistoryStartDate=action.getAttribute('data-start')||'';
        state.purchaseHistoryEndDate=action.getAttribute('data-end')||'';
        refreshPurchaseOrdersView(false);
      }
      else if (name === 'clear-purchase-filters') {
        state.purchaseHistoryQuery='';
        state.purchaseHistorySupplier='all';
        state.purchaseHistoryOrderStatus='all';
        state.purchaseHistoryReceiptStatus='all';
        state.purchaseHistoryStartDate='';
        state.purchaseHistoryEndDate='';
        refreshPurchaseOrdersView(false);
      }
      else if (name === 'inventory-month-filter') {
        state.inventoryMovementStartDate=action.getAttribute('data-start')||'';
        state.inventoryMovementEndDate=action.getAttribute('data-end')||'';
        state.inventoryMovementPage=1;
        const startDate=document.getElementById('inventory-movement-start'),endDate=document.getElementById('inventory-movement-end');
        if(startDate)startDate.value=state.inventoryMovementStartDate;
        if(endDate)endDate.value=state.inventoryMovementEndDate;
        loadInventoryMovementPage();
      }
      else if (name === 'clear-inventory-filters') {
        state.inventoryMovementQuery = '';
        state.inventoryMovementActor = '';
        state.inventoryMovementSupplier = '';
        state.inventoryMovementType = 'all';
        state.inventoryMovementStartDate = '';
        state.inventoryMovementEndDate = '';
        state.inventoryMovementPage = 1;
        const search=document.getElementById('inventory-movement-search');
        const actor=document.getElementById('inventory-movement-actor'),supplier=document.getElementById('inventory-movement-supplier');
        const type=document.getElementById('inventory-movement-type');
        const startDate=document.getElementById('inventory-movement-start'),endDate=document.getElementById('inventory-movement-end');
        if(search)search.value='';if(actor)actor.value='';if(supplier)supplier.value='';
        if(type)type.value='all';if(startDate)startDate.value='';if(endDate)endDate.value='';
        loadInventoryMovementPage();
      }
      else if (name === 'stock-new') openStockModal();
      else if (name === 'stock-product') openStockModal(action.getAttribute('data-id'));
      else if (name === 'reverse-inventory-movement') openInventoryReversalDialog(action.getAttribute('data-id'));
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
    if (event.target.closest('#inventory-reversal-close') || event.target.closest('#inventory-reversal-cancel')) inventoryReversalDialog.close();
    if (event.target.closest('#detail-close') || event.target.closest('#detail-cancel')) detailDialog.close();
    if (event.target.closest('#order-detail-close') || event.target.closest('#order-detail-cancel')) orderDialog.close();
  });
  document.addEventListener('input', function (event) {
    if (event.target && event.target.id === 'purchase-history-search') {
      state.purchaseHistoryQuery=event.target.value;
      refreshPurchaseOrdersView(true);
    }
    else if (event.target && event.target.id === 'view-search') {
      state.query = event.target.value;
      const body = document.getElementById('product-table-body');
      if (body) body.innerHTML = productTable(filteredProducts());
    }
    else if (event.target && ['inventory-movement-search','inventory-movement-actor','inventory-movement-supplier'].includes(event.target.id)) {
      if(event.target.id==='inventory-movement-search')state.inventoryMovementQuery=event.target.value;
      if(event.target.id==='inventory-movement-actor')state.inventoryMovementActor=event.target.value;
      if(event.target.id==='inventory-movement-supplier')state.inventoryMovementSupplier=event.target.value;
      state.inventoryMovementPage = 1;
      window.clearTimeout(inventoryMovementSearchTimer);
      inventoryMovementSearchTimer = window.setTimeout(loadInventoryMovementPage, 250);
    }
    else if (event.target && event.target.id === 'inventory-product-search') {
      state.inventoryProductQuery = event.target.value;
      state.inventoryStockPage = 1;
      window.clearTimeout(inventoryStockSearchTimer);
      inventoryStockSearchTimer = window.setTimeout(loadInventoryStockPage, 250);
    }
  });
  document.addEventListener('change', function (event) {
    if (event.target && ['purchase-history-supplier','purchase-history-order-status','purchase-history-receipt-status','purchase-history-start','purchase-history-end'].includes(event.target.id)) {
      if(event.target.id==='purchase-history-supplier')state.purchaseHistorySupplier=event.target.value;
      if(event.target.id==='purchase-history-order-status')state.purchaseHistoryOrderStatus=event.target.value;
      if(event.target.id==='purchase-history-receipt-status')state.purchaseHistoryReceiptStatus=event.target.value;
      if(event.target.id==='purchase-history-start')state.purchaseHistoryStartDate=event.target.value;
      if(event.target.id==='purchase-history-end')state.purchaseHistoryEndDate=event.target.value;
      refreshPurchaseOrdersView(false);
      return;
    }
    if (event.target && event.target.id === 'catalog-category-filter') {
      state.catalogCategory = event.target.value;
      renderView();
      return;
    }
    if (event.target && event.target.id === 'catalog-show-prices') {
      state.catalogShowPrices = event.target.checked;
      return;
    }
    if (event.target && ['inventory-product-category','inventory-product-stock'].includes(event.target.id)) {
      if (event.target.id === 'inventory-product-category') state.inventoryProductCategory = event.target.value;
      if (event.target.id === 'inventory-product-stock') state.inventoryProductStock = event.target.value;
      state.inventoryStockPage = 1;
      loadInventoryStockPage();
      return;
    }
    if (event.target && ['inventory-movement-type','inventory-movement-start','inventory-movement-end'].includes(event.target.id)) {
      if (event.target.id === 'inventory-movement-type') state.inventoryMovementType = event.target.value;
      if (event.target.id === 'inventory-movement-start') state.inventoryMovementStartDate = event.target.value;
      if (event.target.id === 'inventory-movement-end') state.inventoryMovementEndDate = event.target.value;
      state.inventoryMovementPage = 1;
      loadInventoryMovementPage();
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
  inventoryReversalForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!inventoryReversalForm.reportValidity()) return;
    if (!permissionGranted('inventory.movements.reverse')) {
      toast('Tu cuenta ya no tiene permiso para revertir movimientos.');
      inventoryReversalDialog.close();
      return;
    }
    const movementId = String(inventoryReversalForm.dataset.movementId || '');
    const reason = String(inventoryReversalForm.elements.reason.value || '').trim();
    if (!movementId || reason.length < 3 || reason.length > 240) {
      toast('Indica un motivo válido de 3 a 240 caracteres.');
      return;
    }
    const button = inventoryReversalForm.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Revirtiendo…'; }
    try {
      await erpApi('inventory-movements/' + encodeURIComponent(movementId) + '/reverse', {
        method: 'POST', body: JSON.stringify({ reason })
      });
      inventoryReversalDialog.close();
      inventoryReversalForm.reset();
      inventoryReversalForm.dataset.movementId = '';
      state.inventoryMovementPage = 1;
      await Promise.all([loadInventoryMovementPage(), loadInventoryStockPage(), loadInventorySummary()]);
      toast('Reversión registrada. El movimiento original permanece en el Kardex.');
    } catch (error) {
      toast(error?.message || 'No se pudo revertir el movimiento.');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Registrar reversión'; }
    }
  });
  stockForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if(!stockForm.reportValidity())return;
    const data=new FormData(stockForm);
    const product=[...(inventoryStockPageRows||[]),...products].find(item=>String(item.id)===String(data.get('productId')));
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
      const result=await erpApi('inventory-movements',{method:'POST',body:JSON.stringify({
        product_id:product.id,movement_type:movementType,quantity,note,reference_type:'manual',reference_id:null
      })});
      const savedMovement=result?.record||null;
      stockForm.reset();stockDialog.close();
      try{
        await loadERPFromNeon(true);
      }catch(refreshError){
        // The POST already committed. Reflect its returned balance locally and close the form
        // so the operator cannot accidentally submit the same stock movement a second time.
        const currentProduct=products.find(item=>String(item.id)===String(product.id));
        if(currentProduct&&Number.isInteger(Number(savedMovement?.new_stock))){
          currentProduct.stock=Number(savedMovement.new_stock);
        }
        if(savedMovement?.id&&!inventoryMovements.some(item=>String(item.id)===String(savedMovement.id))){
          inventoryMovements.unshift({
            id:savedMovement.id,productId:savedMovement.product_id,productName:product.name,sku:product.sku,
            type:savedMovement.movement_type,quantity:Number(savedMovement.quantity||0),
            delta:Number(savedMovement.quantity_delta||0),previousStock:Number(savedMovement.previous_stock||0),
            newStock:Number(savedMovement.new_stock||0),note:savedMovement.note||"",
            sourceType:savedMovement.reference_type||"",sourceId:savedMovement.reference_id||"",
            createdAt:savedMovement.created_at||new Date().toISOString()
          });
          inventoryMovements=inventoryMovements.slice(0,5000);
        }
        renderView();
        toast('Movimiento guardado en Neon. La recarga falló; el saldo quedó actualizado. Recarga los datos antes de otra operación.');
        return;
      }
      renderView();
      toast(movementType+' registrado en Neon: '+product.name+'.');
    }catch(error){toast(error?.message||'No se pudo registrar el movimiento.');}
    finally{if(button){button.disabled=false;button.textContent='Registrar movimiento';}}
  });
  stockForm.elements.type.addEventListener('change',updateStockQuantityMode);
  businessForm.addEventListener('change',function(event){
    if(event.target.name==='currency')refreshCashAccountOptions(businessForm,event.target.value);
    if(businessForm.dataset.recordType==='employee'&&event.target.name==='contractType'){
      const isTemporary=event.target.value==='Temporal';
      const wrapper=businessForm.querySelector('#employee-contract-end-field');
      const endDate=businessForm.querySelector('[name="contractEndDate"]');
      const startDate=businessForm.querySelector('[name="contractStartDate"]');
      if(wrapper)wrapper.hidden=!isTemporary;
      if(endDate){endDate.required=isTemporary;if(!isTemporary)endDate.value='';if(startDate)endDate.min=startDate.value||'';}
    }
    if(businessForm.dataset.recordType==='employee'&&event.target.name==='contractStartDate'){
      const endDate=businessForm.querySelector('[name="contractEndDate"]');
      if(endDate)endDate.min=event.target.value||'';
    }
    if(businessForm.dataset.recordType==='payroll-item'&&event.target.name==='payrollPeriodId'){
      const periodType=event.target.selectedOptions?.[0]?.getAttribute('data-period-type');
      const salary=businessForm.querySelector('[name="baseSalaryNio"]');
      const help=businessForm.querySelector('#payroll-item-help');
      const isAguinaldo=periodType==='Aguinaldo';
      if(salary){salary.value=isAguinaldo?'0':(businessForm.querySelector('[name="employeeId"]')?.selectedOptions?.[0]?.getAttribute('data-salary')||'0');}
      if(help)help.textContent=isAguinaldo?'El sistema calcula el decimotercer mes proporcional usando el ciclo laboral y el salario que corresponda; el aguinaldo está exento de INSS.':'El servidor calcula el INSS del trabajador y patronal, e incorpora las comisiones pendientes de ventas dentro de este período.';
      return;
    }
    if(businessForm.dataset.recordType==='payroll-item'&&event.target.name==='employeeId'){
      const selected=event.target.selectedOptions?.[0];
      const salary=businessForm.querySelector('[name="baseSalaryNio"]');
      if(salary&&selected){
        const periodType=businessForm.querySelector('[name="payrollPeriodId"]')?.selectedOptions?.[0]?.getAttribute('data-period-type');
        salary.value=periodType==='Aguinaldo'?'0':(selected.getAttribute('data-salary')||'0');
      }
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
  async function uploadEmployeeDocument(button) {
    const employeeId=button?.getAttribute('data-id')||'';
    const fileInput=document.getElementById('employee-document-file');
    const typeInput=document.getElementById('employee-document-type');
    const file=fileInput?.files?.[0];
    if(!employeeId||!file){toast('Selecciona un documento antes de adjuntarlo.');return;}
    const supported=new Set(['application/pdf','image/jpeg','image/png']);
    if(!supported.has(String(file.type||'').toLowerCase())){toast('El expediente admite únicamente PDF, JPG y PNG.');return;}
    if(file.size<1||file.size>5*1024*1024){toast('El archivo debe pesar como máximo 5 MB.');return;}
    const formData=new FormData();
    formData.append('employee_id',employeeId);
    formData.append('document_type',typeInput?.value||'Otro');
    formData.append('file',file);
    const originalText=button.textContent;
    button.disabled=true;button.textContent='Subiendo…';
    try{
      const token=await window.JBAuth.getToken();
      const response=await fetch(window.JBAuth.apiUrl('/api/erp/employee-documents'),{
        method:'POST',headers:{authorization:'Bearer '+token},body:formData,cache:'no-store'
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error?.message||'No se pudo adjuntar el documento.');
      await loadERPFromNeon(true);
      businessDialog.close();
      openBusinessDialog('employee-history',employeeId);
      toast('Documento adjuntado al expediente.');
    }catch(error){toast(error?.message||'No se pudo adjuntar el documento.');}
    finally{button.disabled=false;button.textContent=originalText;}
  }

  async function downloadEmployeeDocument(documentId,button) {
    if(!documentId)throw new Error('La referencia del documento no es válida.');
    const originalText=button?.textContent;
    if(button){button.disabled=true;button.textContent='Descargando…';}
    try{
      const token=await window.JBAuth.getToken();
      const response=await fetch(window.JBAuth.apiUrl('/api/erp/employee-documents/'+encodeURIComponent(documentId)+'/file'),{
        headers:{authorization:'Bearer '+token},cache:'no-store'
      });
      if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload?.error?.message||'No se pudo descargar el documento.');}
      const blob=await response.blob();
      const fileName=employeeDocuments.find(item=>String(item.id)===String(documentId))?.fileName||'documento-personal';
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }finally{if(button){button.disabled=false;button.textContent=originalText;}}
  }

  document.addEventListener('click',function(event){
    const action=event.target.closest('[data-action]');
    if(!action){if(event.target.closest('#business-close')||event.target.closest('#business-cancel'))businessDialog.close();return;}
    const name=action.getAttribute('data-action'),types={'new-customer':'customer','new-supplier':'supplier','new-order':'order','new-purchase':'purchase','new-expense':'expense','new-cash':'cash','new-cash-account':'cash-account','new-invoice':'invoice','new-employee':'employee','new-attendance':'attendance','new-leave':'leave','new-payroll-period':'payroll-period','new-payroll-item':'payroll-item'};
    if(name==='hr-tab'){
      const tab=action.getAttribute('data-tab');
      if(['employees','attendance','leaves','payroll'].includes(tab)){state.hrTab=tab;renderView();}
    } else if(types[name])openBusinessDialog(types[name]);
    else if(name==='view-employee')openBusinessDialog('employee-history',action.getAttribute('data-id'));
    else if(name==='edit-employee')openBusinessDialog('employee',action.getAttribute('data-id'));
    else if(name==='go-hr-employees'){state.hrTab='employees';renderView();}
    else if(name==='export-dgi-book')exportDgiBook();
    else if(name==='apply-analytics-range'){
      const preset=document.getElementById('analytics-period')?.value||'all';
      const from=document.getElementById('analytics-from')?.value||'';
      const to=document.getElementById('analytics-to')?.value||'';
      const candidate=resolveReportingPeriod(preset,new Date(),from,to);
      if(!candidate.valid){toast('Selecciona un rango de fechas válido.');return;}
      analyticsPeriodPreset=preset;
      analyticsCustomFrom=preset==='custom'?from:'';
      analyticsCustomTo=preset==='custom'?to:'';
      renderView();
    }
    else if(name==='reload-dgi-documents'){dgiDocumentsLoadAttempted=false;dgiDocumentsLoaded=false;loadDgiSupportDocuments(true);}
    else if(name==='download-dgi-document')downloadDgiDocument(action.getAttribute('data-id'),action);
    else if(name==='upload-employee-document')uploadEmployeeDocument(action);
    else if(name==='download-employee-document')downloadEmployeeDocument(action.getAttribute('data-id'),action).catch(error=>toast(error?.message||'No se pudo descargar el documento.'));
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
    else if(name==='new-supplier-invoice')openBusinessDialog('supplier-invoice');
    else if(name==='new-supplier-invoice-payment')openBusinessDialog('supplier-invoice-payment',action.getAttribute('data-id'));
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
  document.addEventListener("change",function(event){
    if(event.target?.id==="access-role-select"){
      accessSelectedRole=event.target.value;
      renderView();
    }
  });
  document.addEventListener("click",async function(event){
    const button=event.target.closest("[data-action]");
    if(!button)return;
    const action=button.getAttribute("data-action");
    if(action==="close-purchase-receipt"){document.getElementById("purchase-receipt-dialog")?.close();return;}
    if(action==="purchase-order-tab"){setPurchaseOrderTab(button.getAttribute("data-tab"));return;}
    if(action==="purchase-section-tab"){
      const tab=button.getAttribute("data-tab");
      if(["orders","receipts","new"].includes(tab)){state.purchaseTab=tab;renderView();}
      return;
    }
    if(action==="add-purchase-order-line"){
      if(!permissionGranted("purchases.purchase_orders.create"))return;
      const container=document.getElementById("purchase-order-lines");
      if(container)container.insertAdjacentHTML("beforeend",purchaseOrderLineHtml());
      return;
    }
    if(action==="remove-purchase-order-line"){
      const line=button.closest(".purchase-order-line");
      if(line?.parentElement?.children.length>1)line.remove();else toast("La orden necesita al menos un producto.");
      return;
    }
    if(action==="receive-purchase-order"){
      if(!permissionGranted("purchases.receipts.receive")||!permissionGranted("inventory.receipts.receive")){toast("Necesitas permisos de recepción de compras e inventario.");return;}
      openPurchaseReceiptDialog(button.getAttribute("data-id"));
      return;
    }
    if(action==="post-purchase-receipt"){
      const id=button.getAttribute("data-id");if(!id)return;
      if(!permissionGranted("purchases.receipts.post")){toast("No tienes permiso para contabilizar recepciones.");return;}
      if(!window.confirm("¿Contabilizar esta recepción? Se actualizarán existencias, cuenta por pagar y comprobante diario en una sola transacción."))return;
      button.disabled=true;
      try{const result=await erpApi("purchase-receipts/"+encodeURIComponent(id)+"/post",{method:"POST",body:"{}"});
        await loadERPFromNeon(true);goToView("purchaseOrders");
        toast("Recepción contabilizada. Código de compra "+(result.record?.purchase_code||"generado")+".");
      }catch(error){toast(error?.message||"No se pudo contabilizar la recepción.");}
      finally{button.disabled=false;}
      return;
    }
    if(action==="view-purchase-journal"){
      const id=button.getAttribute("data-id");if(!id)return;
      try{
        const result=await erpApi("purchase-receipts/"+encodeURIComponent(id)+"/journal");
        const record=result.record||{},lines=Array.isArray(record.lines)?record.lines:[];
        const detail=lines.map(line=>line.account_name+": "+money(Number(line.debit_usd||0))+" debe / "+money(Number(line.credit_usd||0))+" haber").join("\n");
        window.alert("Comprobante diario "+record.journal_number+"\nCompra "+record.purchase_code+"\n"+record.description+"\n"+detail);
      }catch(error){toast(error?.message||"No se pudo consultar el comprobante diario.");}
      return;
    }
    if(["submit-purchase-order","approve-purchase-order","cancel-purchase-order"].includes(action)){
      const id=button.getAttribute("data-id");
      const nextStatus=action==="submit-purchase-order"?"Enviada":action==="approve-purchase-order"?"Confirmada":"Cancelada";
      if(!id)return;
      if(action==="cancel-purchase-order"&&!window.confirm("¿Cancelar esta orden de compra?"))return;
      button.disabled=true;
      try{
        await erpApi("purchase-orders/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({status:nextStatus,reason:"Cancelada desde el ERP"})});
        await loadERPFromNeon(true);goToView("purchaseOrders");toast("Estado de la orden actualizado: "+nextStatus+".");
      }catch(error){toast(error?.message||"No se pudo actualizar la orden.");}
      finally{button.disabled=false;}
      return;
    }
    if(action==="refresh-access-manager"){
      button.disabled=true;
      await loadAccessManager(true);
      if(accessManager.loaded)toast("Administración de accesos actualizada.");
      else toast(accessManager.error||"No se pudo actualizar.");
      button.disabled=false;
      return;
    }
    if(action==="provision-user-account"){
      const row=button.closest("tr");
      if(!row)return;
      const email=row.getAttribute("data-pending-email");
      const payload={
        email,
        display_name:row.querySelector("[data-pending-name]")?.value.trim()||"",
        position_title:row.querySelector("[data-pending-position]")?.value.trim()||"",
        role_template_key:row.querySelector("[data-pending-role]")?.value||"viewer",
        employee_id:row.getAttribute("data-employee-id")||null,
        must_change_password:true
      };
      if(!payload.display_name){toast("Escribe el nombre completo antes de preparar la cuenta.");return;}
      button.disabled=true;
      try{
        await erpApi("users",{method:"POST",body:JSON.stringify(payload)});
        await loadAccessManager(true);
        toast("Perfil ERP creado y bloqueado. Actívalo solo después de completar la autorización.");
      }catch(error){toast(error?.message||"No se pudo preparar la cuenta.");}
      finally{button.disabled=false;}
      return;
    }
    if(action==="remove-user-override"){
      const overrideRow=button.closest("[data-override-key]");
      const userRow=button.closest("tr[data-user-id]");
      if(overrideRow)overrideRow.remove();
      const summary=userRow?.querySelector(".user-overrides summary");
      if(summary&&userRow)summary.textContent="Excepciones ("+userRow.querySelectorAll("[data-override-key]").length+")";
      return;
    }
    if(action==="add-user-override"){
      const userRow=button.closest("tr[data-user-id]");
      const container=userRow?.querySelector("[data-user-overrides]");
      const selector=userRow?.querySelector("[data-new-override-permission]");
      const effect=userRow?.querySelector("[data-new-override-value]");
      if(!userRow||!container||!selector||!effect)return;
      const key=selector.value;
      if(userRow.querySelector('[data-override-key="'+CSS.escape(key)+'"]')){
        toast("Ese permiso ya tiene una excepción. Edita su valor en la lista.");
        return;
      }
      const permission=accessManager.permissions.find(item=>item.permission_key===key);
      if(!permission)return;
      const row=document.createElement("div");
      row.className="permission-override-row";
      row.setAttribute("data-override-key",key);
      const label=document.createElement("span");
      label.textContent=permission.label;
      const code=document.createElement("small");
      code.textContent=key;
      label.appendChild(code);
      const value=document.createElement("select");
      value.className="filter-select";
      value.setAttribute("data-override-value","");
      value.innerHTML='<option value="allow">Permitir</option><option value="deny">Denegar</option>';
      value.value=effect.value;
      const remove=document.createElement("button");
      remove.type="button";
      remove.className="button button-quiet button-small";
      remove.setAttribute("data-action","remove-user-override");
      remove.textContent="Quitar";
      row.append(label,value,remove);
      container.appendChild(row);
      const summary=userRow.querySelector(".user-overrides summary");
      if(summary)summary.textContent="Excepciones ("+userRow.querySelectorAll("[data-override-key]").length+")";
      return;
    }
    if(action==="save-user-access"){
      const row=button.closest("tr"), id=row?.getAttribute("data-user-id");
      if(!id)return;
      const payload={
        position_title:row.querySelector("[data-user-position]")?.value.trim()||"",
        role_template_key:row.querySelector("[data-user-role]")?.value||"viewer",
        account_status:row.querySelector("[data-user-status]")?.value||"registered",
        must_change_password:row.querySelector("[data-user-password]")?.checked===true,
        overrides:Array.from(row.querySelectorAll("[data-override-key]")).map(item=>({
          permission_key:item.getAttribute("data-override-key"),
          allowed:item.querySelector("[data-override-value]")?.value==="allow"
        }))
      };
      button.disabled=true;
      try{
        await erpApi("users/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(payload)});
        await loadAccessManager(true);
        toast("Cuenta ERP actualizada.");
      }catch(error){toast(error?.message||"No se pudo actualizar la cuenta.");}
      finally{button.disabled=false;}
    }
  });
  document.addEventListener("submit",async function(event){
    const form=event.target;
    if(form?.id==="purchase-order-form"){
      event.preventDefault();
      if(!permissionGranted("purchases.purchase_orders.create")){toast("Tu cuenta no puede crear órdenes de compra.");return;}
      if(!form.checkValidity()){
        const invalid=form.querySelector(":invalid");
        const panel=invalid?.closest("[data-po-panel]");
        if(panel)setPurchaseOrderTab(panel.getAttribute("data-po-panel"));
        if(invalid)requestAnimationFrame(()=>invalid.reportValidity());
        return;
      }
      const data=new FormData(form);
      const lines=Array.from(form.querySelectorAll(".purchase-order-line")).map(row=>({
        product_id:row.querySelector('[name="product_id"]').value,ordered_quantity:Number(row.querySelector('[name="ordered_quantity"]').value),
        unit_cost_input:Number(row.querySelector('[name="unit_cost_input"]').value)
      }));
      const payload={supplier_id:String(data.get("supplier_id")||""),
        currency:String(data.get("currency")||"USD"),exchange_rate:Number(data.get("exchange_rate")||1),
        expected_delivery_date:String(data.get("expected_delivery_date")||"")||null,payment_terms:String(data.get("payment_terms")||"").trim()||null,
        notes:String(data.get("notes")||"").trim()||null,discount_usd:Number(data.get("discount_usd")||0),
        estimated_freight_usd:Number(data.get("estimated_freight_usd")||0),estimated_taxes_usd:Number(data.get("estimated_taxes_usd")||0),items:lines};
      const submit=form.querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Generando…";}
      try{
        const response=await erpApi("purchase-orders",{method:"POST",body:JSON.stringify(payload)});
        state.purchaseTab="orders";
        await loadERPFromNeon(true);goToView("purchaseOrders");
        toast("Orden "+(response.record?.order_number||"generada")+" como borrador. El inventario permanece sin cambios.");
      }
      catch(error){toast(error?.message||"No se pudo generar la orden de compra.");}
      finally{if(submit){submit.disabled=false;submit.textContent="Generar orden";}}
      return;
    }
    if(form?.id==="purchase-receipt-form"){
      event.preventDefault();
      if(!permissionGranted("purchases.receipts.receive")){toast("Tu cuenta no puede emitir recepciones.");return;}
      const data=new FormData(form);
      const items=Array.from(form.querySelectorAll("[data-receipt-line]")).map(row=>({
        purchase_order_item_id:row.getAttribute("data-po-item-id"),
        quantity_received:Number(row.querySelector("[data-receipt-quantity]").value||0),
        invoice_unit_cost_input:Number(row.querySelector("[data-receipt-unit-cost]").value||0)
      })).filter(item=>item.quantity_received>0);
      if(!items.length){toast("Introduce al menos una cantidad recibida.");return;}
      const payload={
        supplier_invoice_number:String(data.get("supplier_invoice_number")||"").trim(),
        supplier_invoice_date:String(data.get("supplier_invoice_date")||""),
        invoice_currency:String(data.get("invoice_currency")||""),
        invoice_exchange_rate:Number(data.get("invoice_exchange_rate")||0),
        invoice_original_total:Number(data.get("invoice_original_total")||0),
        payment_terms:String(data.get("payment_terms")||""),
        actual_freight_usd:Number(data.get("actual_freight_usd")||0),
        actual_taxes_usd:Number(data.get("actual_taxes_usd")||0),
        notes:String(data.get("notes")||"").trim()||null,items
      };
      const orderId=String(data.get("purchase_order_id")||"");
      const submit=form.querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Emitiendo…";}
      try{
        const result=await erpApi("purchase-orders/"+encodeURIComponent(orderId)+"/receipts",{method:"POST",body:JSON.stringify(payload)});
        state.purchaseTab="receipts";
        document.getElementById("purchase-receipt-dialog")?.close();await loadERPFromNeon(true);goToView("purchaseOrders");
        toast("Recepción "+(result.record?.receipt_number||"emitida")+" pendiente de contabilización. El inventario sigue sin cambios.");
      }catch(error){toast(error?.message||"No se pudo emitir la recepción.");}
      finally{if(submit){submit.disabled=false;submit.textContent="Emitir recepción pendiente";}}
      return;
    }
    if(form?.id==="role-permissions-form"){
      event.preventDefault();
      if(window.JBAuth?.profile?.role!=="owner")return;
      const roleKey=form.getAttribute("data-role-key");
      const enabled=new Set(new FormData(form).getAll("permission").map(String));
      const permissions=accessManager.permissions.map(permission=>({
        permission_key:permission.permission_key,
        allowed:enabled.has(permission.permission_key)
      }));
      const submit=form.querySelector('[type="submit"]');
      if(submit){submit.disabled=true;submit.textContent="Guardando…";}
      try{
        await erpApi("roles/"+encodeURIComponent(roleKey),{method:"PATCH",body:JSON.stringify({permissions})});
        await loadAccessManager(true);
        toast("Permisos de la plantilla actualizados.");
      }catch(error){toast(error?.message||"No se pudo guardar la plantilla.");}
      finally{if(submit){submit.disabled=false;submit.textContent="Guardar permisos de plantilla";}}
      return;
    }
    if(form?.id==="role-create-form"){
      event.preventDefault();
      if(window.JBAuth?.profile?.role!=="owner")return;
      const data=new FormData(form);
      const payload={role_key:String(data.get("role_key")||"").trim(),name:String(data.get("name")||"").trim(),description:String(data.get("description")||"").trim()};
      const submit=form.querySelector('[type="submit"]');
      if(submit){submit.disabled=true;submit.textContent="Creando…";}
      try{
        const result=await erpApi("roles",{method:"POST",body:JSON.stringify(payload)});
        accessSelectedRole=result.role?.role_key||accessSelectedRole;
        form.reset();
        await loadAccessManager(true);
        toast("Plantilla vacía creada. Asigna cada módulo, sección y acción antes de utilizarla.");
      }catch(error){toast(error?.message||"No se pudo crear la plantilla.");}
      finally{if(submit){submit.disabled=false;submit.textContent="Crear plantilla vacía";}}
    }
  });
  document.addEventListener('submit',function(event){
    if(event.target?.id==='dgi-settings-form'){event.preventDefault();saveDgiSettings(event);}
    else if(event.target?.id==='dgi-document-form'){event.preventDefault();uploadDgiDocument(event);}
  });
  document.addEventListener('submit',async function(event){
    const form=event.target;
    if(form?.id!=='hr-inss-settings-form')return;
    event.preventDefault();
    if(!permissionGranted('settings.general.manage')){toast('Tu cuenta no puede modificar la modalidad de INSS.');return;}
    const preset=String(new FormData(form).get('preset')||'integral:under_50');
    const presets={
      'integral:under_50':{regime:'integral',employer_band:'under_50',employee_rate:7,employer_rate:21.5},
      'integral:fifty_plus':{regime:'integral',employer_band:'fifty_plus',employee_rate:7,employer_rate:22.5},
      'ivm_rp:under_50':{regime:'ivm_rp',employer_band:'under_50',employee_rate:5,employer_rate:15.5},
      'ivm_rp:fifty_plus':{regime:'ivm_rp',employer_band:'fifty_plus',employee_rate:5,employer_rate:16.5}
    };
    const setting=presets[preset];
    if(!setting){toast('Selecciona una modalidad INSS válida.');return;}
    const button=form.querySelector('[type="submit"]');
    if(button){button.disabled=true;button.textContent='Guardando…';}
    try{
      await erpApi('settings',{method:'PATCH',body:JSON.stringify({setting_key:'hr_inss_settings',setting_value:setting})});
      hrInssSettings={...setting};
      await loadERPFromNeon(true);
      renderView();
      toast('Modalidad INSS actualizada. Los períodos ya pagados conservan sus importes.');
    }catch(error){toast(error?.message||'No se pudo guardar la modalidad INSS.');}
    finally{if(button){button.disabled=false;button.textContent='Guardar modalidad INSS';}}
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
    // Populate the owner's sidebar monitor once per session; the five-minute
    // in-memory TTL prevents repeated provider queries while navigating.
    if(window.JBAuth?.profile?.role==='owner') loadResourceUsage().catch(()=>{});
  }).catch(function(error){
    root.innerHTML=heading(views.dashboard,'')+'<div class="notice-panel"><span>'+svg('warning')+'</span><div><strong>No se pudo cargar la información del ERP</strong><p>'+esc(error?.message||'Comprueba tu sesión o la conexión con la base de datos.')+'</p><button class="button button-quiet button-small" data-action="reload-erp">Reintentar conexión</button></div></div>';
  });
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}());
