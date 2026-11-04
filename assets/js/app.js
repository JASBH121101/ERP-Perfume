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

  let products = [
    { id: 1, name: 'Club de Nuit Intense Man', brand: 'Armaf', sku: 'JBP-001', category: 'Diseñador', concentration: 'Eau de Parfum (EDP)', gender: 'Masculino', family: 'Amaderada', sizeMl: 105, presentation: 'Caja original', supplier: 'Proveedor de muestra A', purchaseCost: toUsd(1450), additionalCost: toUsd(100), unitCost: toUsd(1550), price: toUsd(2450), profit: toUsd(900), margin: 36.7, stock: 14, minStock: 4, location: 'A-01', tone: 'art-night', active: true },
    { id: 2, name: 'Yara Lattafa', brand: 'Lattafa', sku: 'JBP-002', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Floral', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: toUsd(1050), additionalCost: toUsd(100), unitCost: toUsd(1150), price: toUsd(1850), profit: toUsd(700), margin: 37.8, stock: 8, minStock: 3, location: 'A-02', tone: 'art-rose', active: true },
    { id: 3, name: 'Khamrah Lattafa', brand: 'Lattafa', sku: 'JBP-003', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Unisex', family: 'Gourmand / Dulce', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: toUsd(1350), additionalCost: toUsd(100), unitCost: toUsd(1450), price: toUsd(2200), profit: toUsd(750), margin: 34.1, stock: 3, minStock: 5, location: 'A-03', tone: 'art-olive', active: true },
    { id: 4, name: 'Badee Al Oud Amethyst', brand: 'Lattafa', sku: 'JBP-004', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Floral', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: toUsd(1250), additionalCost: toUsd(100), unitCost: toUsd(1350), price: toUsd(2100), profit: toUsd(750), margin: 35.7, stock: 0, minStock: 3, location: 'A-04', tone: 'art-violet', active: true },
    { id: 5, name: '9PM Afnan', brand: 'Afnan', sku: 'JBP-005', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Masculino', family: 'Ámbar / Oriental', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: toUsd(1200), additionalCost: toUsd(100), unitCost: toUsd(1300), price: toUsd(1950), profit: toUsd(650), margin: 33.3, stock: 11, minStock: 3, location: 'A-05', tone: 'art-night', active: true },
    { id: 6, name: 'Good Girl Carolina Herrera', brand: 'Carolina Herrera', sku: 'JBP-006', category: 'Diseñador', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Ámbar / Oriental', sizeMl: 80, presentation: 'Caja original', supplier: 'Proveedor de muestra A', purchaseCost: toUsd(1950), additionalCost: toUsd(100), unitCost: toUsd(2050), price: toUsd(3100), profit: toUsd(1050), margin: 33.9, stock: 5, minStock: 4, location: 'B-01', tone: 'art-night', active: true },
    { id: 7, name: 'Ana Abiyedh Rouge', brand: 'Lattafa', sku: 'JBP-007', category: 'Unisex', concentration: 'Eau de Parfum (EDP)', gender: 'Unisex', family: 'Ambar / Oriental', sizeMl: 60, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: toUsd(1000), additionalCost: toUsd(100), unitCost: toUsd(1100), price: toUsd(1750), profit: toUsd(650), margin: 37.1, stock: 2, minStock: 4, location: 'B-02', tone: 'art-rose', active: true },
    { id: 8, name: 'Eclaire Lattafa', brand: 'Lattafa', sku: 'JBP-008', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Gourmand / Dulce', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: toUsd(1250), additionalCost: toUsd(100), unitCost: toUsd(1350), price: toUsd(2050), profit: toUsd(700), margin: 34.1, stock: 9, minStock: 3, location: 'B-03', tone: 'art-olive', active: true }
  ];
  let orders = [
    { id: 'JP-1048', customer: 'María Gutiérrez', phone: '+505 8888 1204', date: '02 nov 2026', amount: toUsd(4050), status: 'Completado', paymentMethod: 'Transferencia', paymentStatus: 'Pagado', deliveryMode: 'Entrega coordinada', discount: toUsd(0), deliveryFee: toUsd(150), items: [{ name: 'Yara Lattafa', sku: 'JBP-002', quantity: 1, unitPrice: toUsd(1850) }, { name: 'Eclaire Lattafa', sku: 'JBP-008', quantity: 1, unitPrice: toUsd(2050) }] },
    { id: 'JP-1047', customer: 'Carlos Mendoza', phone: '+505 8777 2310', date: '02 nov 2026', amount: toUsd(2200), status: 'Pendiente', paymentMethod: 'Efectivo contra entrega', paymentStatus: 'Pendiente', deliveryMode: 'Retiro en tienda', discount: toUsd(0), deliveryFee: toUsd(0), items: [{ name: 'Khamrah Lattafa', sku: 'JBP-003', quantity: 1, unitPrice: toUsd(2200) }] },
    { id: 'JP-1046', customer: 'Andrea López', phone: '+505 8666 3421', date: '01 nov 2026', amount: toUsd(1850), status: 'Completado', paymentMethod: 'Transferencia', paymentStatus: 'Pagado', deliveryMode: 'Retiro en tienda', discount: toUsd(0), deliveryFee: toUsd(0), items: [{ name: 'Yara Lattafa', sku: 'JBP-002', quantity: 1, unitPrice: toUsd(1850) }] },
    { id: 'JP-1045', customer: 'Daniela Ruiz', phone: '+505 8555 4532', date: '01 nov 2026', amount: toUsd(3100), status: 'En preparación', paymentMethod: 'Tarjeta', paymentStatus: 'Pagado', deliveryMode: 'Entrega coordinada', discount: toUsd(0), deliveryFee: toUsd(0), items: [{ name: 'Good Girl Carolina Herrera', sku: 'JBP-006', quantity: 1, unitPrice: toUsd(3100) }] },
    { id: 'JP-1044', customer: 'Luis Salazar', phone: 'No registrado', date: '31 oct 2026', amount: toUsd(1950), status: 'Completado', paymentMethod: 'Efectivo', paymentStatus: 'Pagado', deliveryMode: 'Retiro en tienda', discount: toUsd(0), deliveryFee: toUsd(0), items: [{ name: '9PM Afnan', sku: 'JBP-005', quantity: 1, unitPrice: toUsd(1950) }] }
  ];
  let customers = [
    { name: 'María Gutiérrez', contact: '+505 8888 1204', orders: 8, spent: toUsd(12450), since: 'Ago 2026' },
    { name: 'Carlos Mendoza', contact: '+505 8777 2310', orders: 5, spent: toUsd(8950), since: 'Sep 2026' },
    { name: 'Andrea López', contact: '+505 8666 3421', orders: 4, spent: toUsd(7300), since: 'Sep 2026' },
    { name: 'Daniela Ruiz', contact: '+505 8555 4532', orders: 3, spent: toUsd(6100), since: 'Oct 2026' }
  ];
  let suppliers=[];
  let purchases=[];
  let expenses=[];
  let cashEntries=[];
  let invoices=[];
  let invoiceDraftItems=[];
  let employees=[];
  let hrRecordsLoaded=false,hrRecordsLoading=false,hrLoadAttempted=false,hrLoadError='';
  const views = {
    dashboard: { title: 'Resumen', eyebrow: 'CENTRO DE CONTROL', heading: 'Buenos días', subtitle: 'Una mirada clara al movimiento de tu negocio.' },
    products: { title: 'Productos', eyebrow: 'CATÁLOGO', heading: 'Catálogo de productos', subtitle: 'Administra las fragancias, sus precios y la disponibilidad.' },
    inventory: { title: 'Inventario', eyebrow: 'CONTROL DE EXISTENCIAS', heading: 'Inventario', subtitle: 'Consulta los niveles de stock y detecta reposiciones.' },
    orders: { title: 'Pedidos', eyebrow: 'OPERACIONES', heading: 'Pedidos y ventas', subtitle: 'Da seguimiento al estado de cada pedido.' },
    customers: { title: 'Clientes', eyebrow: 'RELACIONES', heading: 'Cartera de clientes', subtitle: 'Mantén organizada la información comercial.' },
    billing: { title: 'Facturación', eyebrow: 'DOCUMENTOS COMERCIALES', heading: 'Facturación', subtitle: 'Registra ventas presenciales y pedidos web en un mismo lugar.' },
    receivables: { title: 'Cuentas por cobrar', eyebrow: 'FINANZAS', heading: 'Cuentas por cobrar', subtitle: 'Da seguimiento a saldos y abonos de clientes.' },
    hr: { title: 'RRHH', eyebrow: 'GESTIÓN DEL PERSONAL', heading: 'Recursos Humanos', subtitle: 'Organiza personal, asistencia, permisos y nómina.' },
    analytics: { title: 'Informes', eyebrow: 'RENDIMIENTO', heading: 'Informes y análisis', subtitle: 'Indicadores preparados para tomar decisiones.' },
    settings: { title: 'Configuración', eyebrow: 'SISTEMA', heading: 'Configuración', subtitle: 'Preferencias y conexiones de JB PARFUMS ERP.' },
    purchaseOrders: { title: 'Órdenes de compra', eyebrow: 'ABASTECIMIENTO', heading: 'Órdenes de compra', subtitle: 'Solicita productos, comparte la orden y registra recepciones parciales.' },
    purchases: { title: 'Facturas de proveedor', eyebrow: 'ABASTECIMIENTO', heading: 'Facturas de proveedor', subtitle: 'Registra obligaciones y abonos derivados de facturas recibidas.' },
    payables: { title: 'Cuentas por pagar', eyebrow: 'ABASTECIMIENTO', heading: 'Cuentas por pagar', subtitle: 'Controla saldos y abonos pendientes con tus proveedores.' },
    suppliers: { title: 'Proveedores', eyebrow: 'ABASTECIMIENTO', heading: 'Proveedores', subtitle: 'Administra proveedores y monedas habituales.' },
    expenses: { title: 'Gastos', eyebrow: 'FINANZAS', heading: 'Gastos operativos', subtitle: 'Controla egresos en dólares y córdobas.' },
    cash: { title: 'Caja y bancos', eyebrow: 'FINANZAS', heading: 'Caja y bancos', subtitle: 'Registra cobros, recibos y pagos por cuenta.' },
    profitability: { title: 'Rentabilidad', eyebrow: 'FINANZAS · RESULTADOS', heading: 'Rentabilidad', subtitle: 'Ventas, costo de venta, utilidad bruta y gastos operativos.' },
    capital: { title: 'Capital y flujo de efectivo', eyebrow: 'FINANZAS · LIQUIDEZ', heading: 'Capital y flujo de efectivo', subtitle: 'Efectivo registrado, inventario, cobros, pagos y compromisos.' }
  };
  const state = { view: 'dashboard', query: '', filter: 'all', category: 'all', productStatus: 'active' };
  const root = document.getElementById('view-root');
  const dialog = document.getElementById('product-dialog');
  const form = document.getElementById('product-form');
  const stockDialog = document.getElementById('stock-dialog');
  const stockForm = document.getElementById('stock-form');
  const detailDialog = document.getElementById('product-detail-dialog');
  const orderDialog = document.getElementById('order-detail-dialog');
  const businessDialog = document.getElementById('business-dialog');
  const businessForm = document.getElementById('business-form');
  const DEMO_STORAGE_KEY = 'jbparfums-demo-data-v2';
  const LEGACY_DEMO_STORAGE_KEY = 'jbparfums-demo-data-v1';
  function convertLegacyProductToUsd(product) {
    const purchaseCost = Number(product.purchaseCost || 0);
    const additionalCost = Number(product.additionalCost || 0);
    const unitCost = product.unitCost == null ? purchaseCost + additionalCost : Number(product.unitCost || 0);
    const price = Number(product.price || 0);
    return Object.assign({}, product, {
      purchaseCost: toUsd(purchaseCost),
      additionalCost: toUsd(additionalCost),
      unitCost: toUsd(unitCost),
      price: toUsd(price),
      profit: toUsd(product.profit == null ? price - unitCost : product.profit)
    });
  }
  function convertLegacyOrderToUsd(order) {
    return Object.assign({}, order, {
      amount: toUsd(order.amount),
      discount: toUsd(order.discount),
      deliveryFee: toUsd(order.deliveryFee),
      items: Array.isArray(order.items) ? order.items.map(function (item) {
        return Object.assign({}, item, { unitPrice: toUsd(item.unitPrice) });
      }) : []
    });
  }
  let inventoryMovements = [];
  let purchaseOrders = [];
  let purchaseReceipts = [];
  function persistDemoData() {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
        version: 4, products: products, inventoryMovements: inventoryMovements, orders: orders,
        customers: customers, suppliers: suppliers, purchases: purchases, purchaseOrders: purchaseOrders,
        purchaseReceipts: purchaseReceipts, expenses: expenses, cashEntries: cashEntries,
        invoices: invoices, employees: employees,
        settings: { exchangeRate: exchangeRate, baseCurrency: 'USD' }
      }));
      return true;
    } catch (error) {
      toast('No se pudo guardar en este navegador. Los cambios solo durarán hasta cerrar la sesión.');
      return false;
    }
  }
  function loadDemoData() {
    try {
      const stored = window.localStorage.getItem(DEMO_STORAGE_KEY) || window.localStorage.getItem(LEGACY_DEMO_STORAGE_KEY);
      if (!stored) {
        products.forEach(function (product) { product.active = true; });
        persistDemoData();
        return;
      }
      const parsed = JSON.parse(stored);
      const needsCurrencyMigration = parsed && parsed.version === 1;
      if (!parsed || ![1, 2, 3, 4].includes(parsed.version) || !Array.isArray(parsed.products) || !Array.isArray(parsed.inventoryMovements)) {
        products.forEach(function (product) { product.active = true; });
        persistDemoData();
        return;
      }
      if(parsed.settings && Number.isFinite(Number(parsed.settings.exchangeRate)) && Number(parsed.settings.exchangeRate)>0) exchangeRate=Number(parsed.settings.exchangeRate);
      if(Array.isArray(parsed.customers)) customers=parsed.customers;
      suppliers=Array.isArray(parsed.suppliers)?parsed.suppliers:[];
      purchases=Array.isArray(parsed.purchases)?parsed.purchases:[];
      purchaseOrders=Array.isArray(parsed.purchaseOrders)?parsed.purchaseOrders:[];
      purchaseReceipts=Array.isArray(parsed.purchaseReceipts)?parsed.purchaseReceipts:[];
      expenses=Array.isArray(parsed.expenses)?parsed.expenses:[];
      cashEntries=Array.isArray(parsed.cashEntries)?parsed.cashEntries:[];
      invoices=Array.isArray(parsed.invoices)?parsed.invoices:[];
      employees=Array.isArray(parsed.employees)?parsed.employees:[];
      products = parsed.products.filter(function (product) {
        return product && Number.isFinite(Number(product.id)) && String(product.name || '').trim();
      }).map(function (product) {
        product.active = product.active !== false;
        product.stock = Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : 0;
        product.minStock = Number.isInteger(product.minStock) && product.minStock >= 0 ? product.minStock : 3;
        return needsCurrencyMigration ? convertLegacyProductToUsd(product) : product;
      });
      inventoryMovements = parsed.inventoryMovements.filter(function (movement) {
        return movement && Number.isFinite(Number(movement.id)) && Number.isFinite(Number(movement.productId));
      });
      if (Array.isArray(parsed.orders)) {
        const allowedStatuses = ['Pendiente', 'En preparación', 'Listo para entrega', 'En tránsito', 'Completado'];
        orders = parsed.orders.filter(function (order) {
          return order && /^JP-\d+$/.test(String(order.id || '')) && String(order.customer || '').trim() && Array.isArray(order.items);
        }).map(function (order) {
          if (needsCurrencyMigration) order = convertLegacyOrderToUsd(order);
          order.status = allowedStatuses.includes(order.status) ? order.status : 'Pendiente';
          if (!order.paymentCurrency) {
            order.paymentCurrency = 'USD';
            order.paymentAmount = Number(order.amount || 0);
            order.exchangeRate = 36.6;
          }
          order.items = order.items.filter(function (item) {
            return item && String(item.name || '').trim() && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(Number(item.unitPrice)) && Number(item.unitPrice) >= 0;
          });
          return order;
        });
      }
      if (needsCurrencyMigration || parsed.version !== 4) {
        const saved = persistDemoData();
        if (saved && needsCurrencyMigration) window.localStorage.removeItem(LEGACY_DEMO_STORAGE_KEY);
      }
    } catch (error) {
      products.forEach(function (product) { product.active = true; });
      inventoryMovements = [];
    }
  }
  const BACKEND_MODE = Boolean(window.JBAuth && window.JBAuth.mode === 'authenticated');
  let erpBootstrapLoaded=false,erpBootstrapLoading=false,erpBootstrapError='';
  async function apiRequest(path,method,body){
    const auth=window.JBAuth;
    if(!BACKEND_MODE||!auth||auth.mode!=='authenticated')throw new Error('La sesión del ERP no está disponible.');
    const token=await auth.getToken();
    if(!token)throw new Error('La sesión expiró. Inicia sesión nuevamente.');
    const response=await fetch(auth.apiUrl?auth.apiUrl(path):path,{
      method:method||'GET',
      headers:Object.assign({authorization:'Bearer '+token},body?{'content-type':'application/json'}:{}),
      body:body?JSON.stringify(body):undefined,cache:'no-store'
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result?.error?.message||result?.error?.code||'La operación no pudo completarse.');
    return result;
  }
  function mapDbProduct(p){
    const cost=Number(p.unit_cost_usd||0),price=Number(p.price_usd||0);
    return {id:p.id,name:p.name,brand:p.brand||'',sku:p.sku,category:p.category||'Perfumería',
      concentration:p.concentration||'',gender:p.gender||'',family:p.family||'',sizeMl:p.size_ml==null?null:Number(p.size_ml),
      presentation:p.presentation||'',barcode:p.barcode||'',description:p.description||'',supplier:p.supplier_name||'',
      purchaseCost:Number(p.purchase_cost_usd||0),additionalCost:Number(p.additional_cost_usd||0),unitCost:cost,
      price:price,wholesalePrice:p.wholesale_price_usd==null?null:Number(p.wholesale_price_usd),
      profit:price-cost,margin:price>0?(price-cost)/price*100:0,stock:Number(p.stock||0),minStock:Number(p.min_stock||0),
      location:p.location||'',tone:p.tone||'art-violet',notes:p.notes||'',images:Array.isArray(p.images)?p.images:[],active:p.active!==false};
  }
  function mapDbSupplier(s){return {id:s.id,name:s.name,contact:s.contact||'',phone:s.phone||'',email:s.email||'',currency:s.currency||'USD',notes:s.notes||'',active:s.active!==false};}
  function mapDbCustomer(c){return {id:c.id,name:c.name,contact:c.contact||c.phone||'',phone:c.phone||'',email:c.email||'',customerType:c.customer_type||'particular',orders:Number(c.orders||0),spent:Number(c.spent_usd||0),since:dateText(c.created_at)};}
  function mapDbMovement(m){return {id:m.id,productId:m.product_id,productName:m.product_name,sku:m.sku_snapshot||'',type:m.movement_type,quantity:Number(m.quantity||0),delta:Number(m.quantity_delta||0),previousStock:Number(m.previous_stock||0),newStock:Number(m.new_stock||0),note:m.note||'',sourceType:m.reference_type||'',sourceId:m.reference_id||'',createdAt:m.created_at};}
  async function loadERPBootstrap(){
    if(!BACKEND_MODE||erpBootstrapLoading||erpBootstrapLoaded)return;
    erpBootstrapLoading=true;erpBootstrapError='';
    try{
      const data=await apiRequest('/api/erp/bootstrap','GET');
      products=(Array.isArray(data.products)?data.products:[]).map(mapDbProduct);
      suppliers=(Array.isArray(data.suppliers)?data.suppliers:[]).map(mapDbSupplier);
      customers=(Array.isArray(data.customers)?data.customers:[]).map(mapDbCustomer);
      inventoryMovements=(Array.isArray(data.inventoryMovements)?data.inventoryMovements:[]).map(mapDbMovement);
      exchangeRate=Number(data.exchangeRate)>0?Number(data.exchangeRate):36.6;
      erpBootstrapLoaded=true;
    }catch(error){erpBootstrapError=error?.message||'No se pudo cargar Neon Development.';toast(erpBootstrapError);}
    finally{erpBootstrapLoading=false;renderView();}
  }
  if(BACKEND_MODE){
    products=[];orders=[];customers=[];suppliers=[];purchases=[];expenses=[];cashEntries=[];invoices=[];
    employees=[];inventoryMovements=[];purchaseOrders=[];purchaseReceipts=[];
  }else{loadDemoData();}

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
    return '<div class="page-heading' + dashboardClass + '"><div><h1>' + meta.heading + '</h1><p>' + meta.subtitle + '</p></div><div class="heading-actions">' + (actions || '') + '</div></div>';
  }
  function metric(label, value, symbol, change, note, gold) {
    return '<article class="metric-card"><div class="metric-top"><span class="metric-label">' + label + '</span><span class="metric-symbol">' + svg(symbol) + '</span></div><div class="metric-value">' + value + '</div><div class="metric-foot"><span class="metric-change' + (gold ? ' gold' : '') + '">' + change + '</span><span class="metric-caption">' + note + '</span></div></article>';
  }
  function renderDashboard() {
    const activeProducts = products.filter(function (product) { return product.active !== false; });
    const top = activeProducts.slice().sort(function (a, b) { return b.stock - a.stock; }).slice(0, 4);
    const productRows = orders.slice(0, 4).map(function (order) {
      return '<tr><td data-label="Pedido" class="table-primary">' + esc(order.id) + '</td><td data-label="Cliente">' + esc(order.customer) + '</td><td data-label="Fecha">' + esc(order.date) + '</td><td data-label="Total" class="table-primary">' + money(order.amount) + '</td><td data-label="Estado">' + orderStatus(order.status) + '</td></tr>';
    }).join('');
    const topRows = top.map(function (product) {
      return '<div class="top-product">' + art(product.tone) + '<div class="top-product-info"><strong>' + esc(product.name) + '</strong><small>' + esc(product.category) + ' · ' + product.stock + ' unidades</small></div><span class="top-product-value">' + money(product.price) + '</span></div>';
    }).join('');
    const low = activeProducts.filter(needsRestock).length;
    return heading(views.dashboard, '') +
      '<section class="metric-grid">' +
      metric('Importe de pedidos', money(orders.reduce(function(sum,order){return sum+Number(order.amount||0);},0)), 'chart', 'Pedidos DEMO', 'importe registrado localmente', false) +
      metric('Pedidos de muestra', String(orders.length), 'bag', 'Registros', 'pedidos guardados localmente', false) +
      metric('Productos activos', String(activeProducts.length).padStart(2, '0'), 'bottle', 'Catálogo', 'productos DEMO activos', true) +
      metric('Alertas de stock', String(low).padStart(2, '0'), 'warning', 'Revisar', 'productos bajo su stock mínimo', true) +
      '</section>' +
      '<section class="dashboard-grid">' +
      '<article class="panel"><div class="panel-heading"><div><h2>Rendimiento de ventas</h2><p>Comportamiento comercial de los últimos días</p></div><button class="panel-link" data-view="analytics">Ver informe ' + svg('arrow') + '</button></div><div class="chart-summary"><strong>' + money(orders.reduce(function(sum,order){return sum+Number(order.amount||0);},0)) + '</strong><span>ventas de muestra</span></div>' +
      '<div class="chart-wrap"><svg viewBox="0 0 620 180" role="img" aria-label="Gráfico ilustrativo de ventas semanales"><defs><linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#c4a16b" stop-opacity=".26"/><stop offset="100%" stop-color="#c4a16b" stop-opacity="0"/></linearGradient></defs><path class="chart-gridline" d="M42 25H608M42 65H608M42 105H608M42 145H608"/><path class="chart-area" d="M42 129 C78 118 94 82 130 91 S188 115 222 77 S280 95 314 58 S374 77 408 53 S468 69 502 39 S566 57 608 22 V145 H42Z"/><path class="chart-line" d="M42 129 C78 118 94 82 130 91 S188 115 222 77 S280 95 314 58 S374 77 408 53 S468 69 502 39 S566 57 608 22"/><circle class="chart-point" cx="130" cy="91" r="4"/><circle class="chart-point" cx="222" cy="77" r="4"/><circle class="chart-point" cx="314" cy="58" r="4"/><circle class="chart-point" cx="408" cy="53" r="4"/><circle class="chart-point" cx="502" cy="39" r="4"/><text class="chart-label" x="42" y="166">Lun</text><text class="chart-label" x="135" y="166">Mar</text><text class="chart-label" x="228" y="166">Mié</text><text class="chart-label" x="321" y="166">Jue</text><text class="chart-label" x="414" y="166">Vie</text><text class="chart-label" x="507" y="166">Sáb</text><text class="chart-label" x="592" y="166">Dom</text></svg></div><div class="chart-note"><i></i> Datos ilustrativos · Se conectará al módulo de ventas</div></article>' +
      '<article class="panel"><div class="panel-heading"><div><h2>Productos destacados</h2><p>Selección de catálogo de ejemplo</p></div><button class="panel-link" data-view="products">Catálogo ' + svg('arrow') + '</button></div><div class="top-products">' + topRows + '</div><div class="panel-footer-note">Precios y existencias de demostración.</div></article>' +
      '</section>' +
      '<section class="lower-grid"><article class="panel"><div class="panel-heading"><div><h2>Pedidos recientes</h2><p>Actividad de ejemplo del negocio</p></div><button class="panel-link" data-view="orders">Ver todos ' + svg('arrow') + '</button></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ESTADO</th></tr></thead><tbody>' + productRows + '</tbody></table></div></article>' +
      '<article class="panel"><div class="panel-heading"><div><h2>Estado del inventario</h2><p>Distribución de stock de muestra</p></div></div><div class="stock-summary">' +
      stockBar('Disponible', activeProducts.filter(function (p) { return p.stock > p.minStock; }).length, activeProducts.length, '') +
      stockBar('Stock bajo', activeProducts.filter(function (p) { return p.stock > 0 && needsRestock(p); }).length, activeProducts.length, 'low') +
      stockBar('Agotado', activeProducts.filter(function (p) { return p.stock === 0; }).length, activeProducts.length, 'out') +
      '</div><div class="panel-footer-note">Conteos calculados con existencias DEMO y mínimos configurados por perfume.</div></article></section>';
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
      return '<tr class="' + (inactive ? 'row-inactive' : '') + '"><td data-label="Perfume"><div class="product-cell">' + art(product.tone) + '<span><span class="table-primary">' + esc(product.name) + '</span><small class="table-secondary">' + productMeta(product) + '</small></span></div></td><td data-label="Categoría">' + esc(product.category) + '</td><td data-label="Precio y costo" class="table-primary">' + money(product.price) + '<small class="table-secondary">Costo ' + money(costs.unitCost) + ' · Margen ' + costs.margin.toFixed(1) + '%</small></td><td data-label="Existencias">' + product.stock + ' uds. <small class="table-secondary">Mín. ' + product.minStock + '</small></td><td data-label="Estado">' + productStatus + '</td><td data-label="Acciones"><div class="table-actions">' + actions + '</div></td></tr>';
    }).join('');
  }
  function renderProducts() {
    const activeCount = products.filter(function (product) { return product.active !== false; }).length;
    const inactiveCount = products.length - activeCount;
    const categories = ['Perfumería', 'Árabes', 'Diseñador', 'Nicho', 'Unisex', 'Body Mist', 'Sets / Combos', 'Accesorios'];
    const categoryOptions = categories.map(function (category) {
      return '<option value="' + esc(category) + '"' + (state.category === category ? ' selected' : '') + '>' + esc(category) + '</option>';
    }).join('');
    return heading(views.products, '<button class="button button-quiet" data-action="export-product-catalog">'+svg('download')+' Catálogo PDF</button><button class="button button-primary" data-action="new-product">' + svg('plus') + ' Nuevo producto</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Productos activos</span><strong>' + activeCount + '</strong></div><div class="summary-mini"><span>Desactivados</span><strong>' + inactiveCount + '</strong></div><div class="summary-mini"><span>Requieren reposición</span><strong>' + products.filter(function (product) { return product.active !== false && needsRestock(product); }).length + '</strong></div></div>' +
      '<div class="toolbar products-toolbar"><div class="toolbar-left"><label class="inline-search">' + svg('search') + '<input id="view-search" type="search" value="' + esc(state.query) + '" aria-label="Buscar productos"></label></div><div class="toolbar-right"><select class="filter-select" id="product-status-filter" aria-label="Estado del producto"><option value="active"' + (state.productStatus === 'active' ? ' selected' : '') + '>Activos</option><option value="inactive"' + (state.productStatus === 'inactive' ? ' selected' : '') + '>Desactivados</option><option value="all"' + (state.productStatus === 'all' ? ' selected' : '') + '>Todos</option></select><select class="filter-select" id="category-filter" aria-label="Filtrar por categoría"><option value="all"' + (state.category === 'all' ? ' selected' : '') + '>Todas las categorías</option>' + categoryOptions + '</select><select class="filter-select" id="stock-filter" aria-label="Filtrar por stock"><option value="all"' + (state.filter === 'all' ? ' selected' : '') + '>Todos los estados</option><option value="available"' + (state.filter === 'available' ? ' selected' : '') + '>Disponibles</option><option value="low"' + (state.filter === 'low' ? ' selected' : '') + '>Stock bajo</option><option value="out"' + (state.filter === 'out' ? ' selected' : '') + '>Agotados</option></select></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>PRECIO / COSTO</th><th>EXISTENCIAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody id="product-table-body">' + productTable(filteredProducts()) + '</tbody></table></div></article>' +
      '<div class="notice-panel"><span>' + svg('spark') + '</span><div><strong>'+(BACKEND_MODE?'Catálogo conectado a Neon Development':'Catálogo DEMO local')+'</strong><p>'+(BACKEND_MODE?'Los productos, costos, precios y estado del catálogo se cargan y guardan en Neon. Las existencias solo cambian mediante movimientos.':'Los productos se guardan en este navegador y todavía no se sincronizan con Neon.')+'</p></div></div>';
  }
  function renderInventory() {
    const activeProducts = products.filter(function (product) { return product.active !== false; });
    const rows = activeProducts.slice().sort(function (a, b) { return a.stock - b.stock; }).map(function (product) {
      const suggestion = product.stock === 0 ? 'Reposición urgente' : (needsRestock(product) ? 'Revisar reposición' : 'Nivel estable');
      return '<tr><td data-label="Perfume"><div class="product-cell">' + art(product.tone) + '<span><span class="table-primary">' + esc(product.name) + '</span><small class="table-secondary">' + esc(product.sku) + ' · Mín. ' + product.minStock + '</small></span></div></td><td data-label="Categoría">' + esc(product.category) + '</td><td data-label="Stock actual" class="table-primary">' + product.stock + ' unidades</td><td data-label="Estado">' + status(product.stock, product.minStock) + '</td><td data-label="Reposición"><span class="table-secondary">' + suggestion + '</span></td><td data-label="Acción"><button class="button button-quiet button-small" type="button" data-action="stock-product" data-id="' + product.id + '">Registrar movimiento</button></td></tr>';
    }).join('');
    const movementRows = inventoryMovements.slice(0, 10).map(function (movement) {
      const date = new Date(movement.createdAt);
      const dateLabel = Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
      const deltaLabel = movement.delta > 0 ? '+' + movement.delta : String(movement.delta);
      return '<tr><td data-label="Fecha">' + esc(dateLabel) + '</td><td data-label="Perfume"><span class="table-primary">' + esc(movement.productName) + '</span><small class="table-secondary">' + esc(movement.sku || '') + '</small></td><td data-label="Tipo">' + esc(movement.type) + '</td><td data-label="Variación" class="table-primary">' + deltaLabel + ' uds.</td><td data-label="Stock resultante">' + movement.previousStock + ' → ' + movement.newStock + '</td><td data-label="Nota">' + esc(movement.note || '—') + '</td></tr>';
    }).join('');
    return heading(views.inventory, '<div class="heading-actions-inline"><button class="button button-quiet" data-action="export-inventory">' + svg('download') + ' Exportar CSV</button><button class="button button-primary" data-action="stock-new">' + svg('plus') + ' Registrar movimiento</button></div>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Referencias activas</span><strong>' + activeProducts.length + '</strong></div><div class="summary-mini"><span>Unidades en stock</span><strong>' + activeProducts.reduce(function (sum, product) { return sum + product.stock; }, 0) + '</strong></div><div class="summary-mini"><span>Para reponer</span><strong>' + activeProducts.filter(needsRestock).length + '</strong></div></div>' +
      '<article class="list-panel inventory-stock-panel"><div class="table-wrap"><table class="data-table inventory-stock-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK</th><th>ESTADO</th><th>ACCIÓN SUGERIDA</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6"><div class="empty-state">No hay productos activos.</div></td></tr>') + '</tbody></table></div></article>' +
      '<article class="list-panel ledger-panel"><div class="panel-heading"><div><h2>Historial de movimientos</h2><p>Entradas, salidas y ajustes registrados en esta demostración</p></div><span class="ledger-count">' + inventoryMovements.length + ' movimientos</span></div><div class="table-wrap"><table class="data-table inventory-ledger-table"><thead><tr><th>FECHA</th><th>PRODUCTO</th><th>TIPO</th><th>VARIACIÓN</th><th>STOCK RESULTANTE</th><th>NOTA</th></tr></thead><tbody>' + (movementRows || '<tr><td colspan="6"><div class="empty-state">Todavía no hay movimientos registrados.</div></td></tr>') + '</tbody></table></div></article>' +
      '<div class="notice-panel"><span>' + svg('warning') + '</span><div><strong>'+(BACKEND_MODE?'Kardex conectado a Neon Development':'Kardex DEMO local')+'</strong><p>'+(BACKEND_MODE?'Cada movimiento se registra en Neon junto al saldo anterior y nuevo. Las salidas no pueden dejar existencias negativas.':'Los movimientos se guardan solo en este navegador y no se sincronizan con Neon.')+'</p></div></div>';
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
    }).join('') + '</div>' + (product.notes ? '<p class="detail-notes">' + esc(product.notes) + '</p>' : '');
    document.getElementById('edit-detail-product').setAttribute('data-id', String(product.id));
    if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
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
    link.href = url; link.download = 'jb-parfums-inventario-demo.csv';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Inventario DEMO exportado a CSV.');
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
    document.getElementById('order-detail-subtitle').textContent = 'Pedido DEMO · ' + order.date + ' · Registro ficticio para pruebas; no representa una venta real.';
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
      '<p class="order-demo-warning">Pedido DEMO local. Al pasar a «En preparación» o a un estado posterior se descuenta el inventario; al devolverlo a «Pendiente» se registra el reingreso.</p>';
    const statusSelect = document.getElementById('order-status-select');
    statusSelect.value = order.status;
    document.getElementById('save-order-status').setAttribute('data-id', String(order.id));
    if (typeof orderDialog.showModal === 'function') orderDialog.showModal();
    else toast('El detalle de pedidos no es compatible con este navegador.');
  }
  function captureDemoState() {
    return JSON.stringify({products,inventoryMovements,orders,customers,suppliers,purchases,purchaseOrders,purchaseReceipts,expenses,cashEntries,invoices,employees,exchangeRate});
  }
  function restoreDemoState(snapshot) {
    const saved=JSON.parse(snapshot);
    products=saved.products;inventoryMovements=saved.inventoryMovements;orders=saved.orders;customers=saved.customers;
    suppliers=saved.suppliers;purchases=saved.purchases;
    purchaseOrders=Array.isArray(saved.purchaseOrders)?saved.purchaseOrders:[];
    purchaseReceipts=Array.isArray(saved.purchaseReceipts)?saved.purchaseReceipts:[];
    expenses=saved.expenses;cashEntries=saved.cashEntries;
    invoices=saved.invoices;employees=saved.employees;exchangeRate=Number(saved.exchangeRate)||36.6;
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
  function saveOrderStatus() {
    const button=document.getElementById('save-order-status'),order=orders.find(item=>String(item.id)===button.getAttribute('data-id'));
    const nextStatus=document.getElementById('order-status-select').value;
    const allowedStatuses=['Pendiente','En preparación','Listo para entrega','En tránsito','Completado'];
    if(!order||!allowedStatuses.includes(nextStatus)){toast('No se pudo validar el estado seleccionado.');return;}
    if(order.status===nextStatus){toast('El pedido ya tiene ese estado.');return;}
    if(order.status==='Completado'){toast('Un pedido completado no se puede reabrir desde este formulario.');return;}
    const snapshot=captureDemoState();let inventoryMessage='';
    if(nextStatus==='Pendiente'&&order.inventoryAppliedAt){
      const result=recordOrderInventory(order,true);if(result.error){toast(result.error);return;}
      order.inventoryAppliedAt=null;inventoryMessage=' Existencias reingresadas en DEMO.';
    }else if(nextStatus!=='Pendiente'&&!order.inventoryAppliedAt){
      const result=recordOrderInventory(order,false);if(result.error){toast(result.error);return;}
      order.inventoryAppliedAt=new Date().toISOString();inventoryMessage=' Existencias descontadas automáticamente.';
    }
    order.status=nextStatus;
    if(!persistDemoData()){restoreDemoState(snapshot);return;}
    orderDialog.close();renderView();toast('Estado del pedido actualizado en DEMO local.'+inventoryMessage);
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
      return {productId:product?product.id:(item.productId==null?null:item.productId),name:String(item.name||product?.name||'Perfume'),sku:String(item.sku||product?.sku||''),barcode:String(product?.barcode||''),quantity:Number(item.quantity||1),unitPriceUsd:roundMoney(Number(item.unitPrice||product?.price||0)),unitCostUsd:Number(product?.unitCost||0)};
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
    preview.innerHTML='<div class="invoice-preview-heading"><div><span class="invoice-kicker">VISTA PREVIA DE FACTURA</span><strong>'+esc(customer)+'</strong></div><span class="invoice-demo-chip">DEMO · NO FISCAL</span></div>'+
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
      '<div class="invoice-paper-status"><span>DEMO · NO FISCAL</span><strong>'+esc(invoice.status||'Pendiente')+'</strong></div>'+
      '<section class="invoice-paper-parties"><div><small>FACTURAR A</small><strong>'+esc(invoice.customer||'Cliente general')+'</strong><span>'+esc(invoice.phone||'Sin contacto')+'</span><span>'+esc(invoice.customerType==='business'?'Cliente negocio':'Cliente particular')+'</span></div><div><small>ORIGEN DE VENTA</small><strong>'+source+'</strong><span>'+(invoice.orderId?'Pedido '+esc(invoice.orderId):'Venta directa')+'</span><span>Moneda de venta: USD</span><span>Moneda de cobro: '+esc(paymentCurrency)+'</span></div></section>'+
      '<table class="invoice-paper-table"><thead><tr><th>PRODUCTO / CÓDIGO</th><th>CANT.</th><th>PRECIO UNIT.</th><th>IMPORTE</th></tr></thead><tbody>'+lines+'</tbody></table>'+
      '<section class="invoice-paper-summary"><div><span>Subtotal</span>'+invoiceUsdPrimary(invoice.subtotalUsd,rate)+'</div>'+
      (Number(invoice.discountUsd)>0?'<div><span>Descuento</span><strong class="invoice-money-stack">− '+money(invoice.discountUsd)+'<small>− '+moneyInCurrency(roundMoney(invoice.discountUsd*rate),'NIO')+'</small></strong></div>':'')+
      (Number(invoice.deliveryFeeUsd)>0?'<div><span>Entrega</span>'+invoiceUsdPrimary(invoice.deliveryFeeUsd,rate)+'</div>':'')+
      '<div class="invoice-paper-total"><span>TOTAL USD</span>'+invoiceUsdPrimary(invoice.totalUsd,rate)+'</div>'+
      '<div><span>'+(balance>0&&Number(invoice.paidUsd||0)>0?'Abono inicial recibido':'Pago recibido')+'</span>'+invoiceUsdPrimary(invoice.paidUsd||0,rate)+'</div>'+
      (paymentOriginalAmount>0&&paymentCurrency==='NIO'?'<div><span>Pago inicial registrado en córdobas</span><strong>'+moneyInCurrency(paymentOriginalAmount,'NIO')+'</strong></div>':'')+
      '<div><span>Saldo pendiente</span>'+invoiceUsdPrimary(balance,rate)+'</div></section>'+
      '<footer class="invoice-paper-footer"><div><strong>Método de pago:</strong> '+esc(invoice.paymentMethod||'Pendiente')+'</div><div>Tipo de cambio aplicado: '+rateLabel(rate)+'</div><p>Documento generado por JB PARFUMS ERP en modo DEMO. No es una factura fiscal autorizada.</p></footer></article>';
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
    const titles={customer:'Nuevo cliente',supplier:'Nuevo proveedor',order:'Nuevo pedido',purchase:'Registrar factura de proveedor','purchase-order':'Nueva orden de compra','purchase-receipt':'Registrar recepción parcial',expense:'Registrar gasto',cash:'Registrar recibo o pago',invoice:'Nueva factura',payment:'Registrar abono',employee:'Agregar colaborador'};
    let body='';
    if(type==='customer')body='<div class="form-grid">'+formField('Nombre del cliente','name','text',true,'maxlength="80"')+formField('Teléfono o contacto','contact','text',false,'maxlength="40"')+'</div>';
    if(type==='supplier')body='<div class="form-grid">'+formField('Nombre del proveedor','name','text',true,'maxlength="80"')+formField('Contacto','contact','text',false,'maxlength="80"')+formField('Teléfono','phone','tel',false,'maxlength="40"')+formField('Correo','email','email',false,'maxlength="120"')+currencyField('USD')+'</div>';
    if(type==='order'){
      if(!customers.length){toast('Registra primero un cliente.');return;}
      if(!products.some(product=>product.active!==false)){toast('Registra primero un producto activo.');return;}
      body='<div class="form-grid">'+searchableField('Cliente','customerIndex','customer',true)+searchableField('Producto','productId','product',true)+formField('Cantidad','quantity','number',true,'min="1" step="1" value="1"')+currencyField('USD')+'</div><p class="form-helper">Los precios del catálogo permanecen en USD. Se guarda la moneda de cobro y la tasa utilizada.</p>';
    }
    if(type==='purchase-order'){
      if(!suppliers.length){toast('Registra primero un proveedor.');return;}
      if(!products.some(product=>product.active!==false)){toast('Registra primero un producto activo.');return;}
      body='<div class="form-grid">'+searchableField('Proveedor','supplierIndex','supplier',true)+currencyField('USD')+
        formField('Entrega estimada','expectedDelivery','date',false,'')+
        formField('Condiciones de pago','paymentTerms','text',false,'maxlength="120"')+
        formField('Descuento (moneda seleccionada)','discount','number',false,'min="0" step="0.01" value="0"')+
        formField('Flete estimado','freight','number',false,'min="0" step="0.01" value="0"')+
        formField('Impuestos / otros','taxes','number',false,'min="0" step="0.01" value="0"')+
        '<label class="form-field full-field"><span>Notas para el proveedor</span><textarea name="notes" rows="2" maxlength="500"></textarea></label></div>'+
        '<section class="po-lines-panel"><div class="panel-heading"><div><h3>Productos solicitados</h3><p>Selecciona referencias existentes; no se crean productos desde una orden.</p></div><button type="button" class="button button-quiet button-small" data-action="add-po-line">Agregar producto</button></div><div id="po-line-list">'+purchaseOrderLineMarkup()+'</div></section>'+
        '<p class="form-helper">La orden inicia como borrador. Al crearla no se modifica stock, caja ni cuentas por pagar. El costo real del flete se confirma al recibir.</p>';
    }
    if(type==='purchase-receipt'){
      const order=purchaseOrders.find(item=>String(item.id)===String(recordId));
      if(!order){toast('No se encontró la orden de compra.');return;}
      if(['Borrador','Cancelada','Recibida','Cerrada con faltante'].includes(order.status)){toast('La orden no está disponible para recibir mercancía.');return;}
      const itemRows=order.items.map((item,index)=>{
        const remain=Math.max(0,Number(item.quantity||0)-Number(item.receivedQuantity||0));
        return '<div class="po-receipt-row"><div><strong>'+esc(item.name)+'</strong><small>'+esc(item.sku||'')+' · Solicitadas '+item.quantity+' · Recibidas '+item.receivedQuantity+' · Pendientes '+remain+'</small></div><label class="form-field"><span>Recibir ahora</span><input data-receipt-quantity="'+index+'" type="number" min="0" max="'+remain+'" step="1" value="0"></label></div>';
      }).join('');
      body='<div class="form-grid"><div class="detail-field full-field"><span>Orden · '+esc(order.number)+'</span><strong>'+esc(order.supplierName)+'</strong><small>'+purchaseOrderRemaining(order)+' unidades pendientes</small></div>'+
        formField('Flete real de esta recepción ('+esc(order.currency)+')','actualFreight','number',false,'min="0" step="0.01" value="0"')+
        '<label class="form-field full-field"><span>Nota / diferencia de entrega</span><textarea name="receiptNotes" rows="2" maxlength="500"></textarea></label></div>'+
        '<div class="po-receipt-list">'+itemRows+'</div>'+
        '<p class="form-helper">Solo las cantidades recibidas aumentan el inventario. Puedes registrar varias recepciones hasta completar la orden. No se registra pago ni cuenta por pagar aquí.</p>';
    }
    if(type==='purchase'){
      if(!suppliers.length){toast('Registra primero un proveedor.');return;}
      if(!products.some(product=>product.active!==false)){toast('Registra primero un producto activo.');return;}
      body='<div class="form-grid">'+searchableField('Proveedor','supplierIndex','supplier',true)+searchableField('Producto','productId','product',true)+formField('Unidades facturadas','quantity','number',true,'min="1" step="1"')+formField('Costo unitario facturado','unitCost','number',true,'min="0.01" step="0.01"')+currencyField('USD')+formField('Pago / abono inicial','initialPayment','number',false,'min="0" step="0.01" value="0"')+selectField('Cuenta para pago inicial','initialAccount','<option>Caja USD</option><option>Banco USD</option><option>Caja NIO</option><option>Banco NIO</option>',false)+'</div><p class="form-helper">El abono inicial se registra como salida de caja. La diferencia queda como saldo pendiente en Cuentas por pagar; el inventario se actualiza solo desde una recepción de orden de compra.</p>';
    }
    if(type==='purchase-payment'){
      const purchase=purchases.find(item=>String(item.id)===String(recordId));
      if(!purchase){toast('No se encontró la compra seleccionada.');return;}
      const balance=Math.max(0,Number(purchase.totalUsd||0)-Number(purchase.paidUsd||0));
      if(balance<=0.001){toast('Esta compra ya está pagada.');return;}
      body='<div class="form-grid"><div class="detail-field full-field"><span>Proveedor · '+esc(purchase.supplier)+'</span><strong>Saldo pendiente: '+money(balance)+'</strong><small>'+esc(purchase.product)+' · '+purchase.quantity+' unidades</small></div>'+formField('Importe del abono','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta de pago','account','<option>Caja USD</option><option>Banco USD</option><option>Caja NIO</option><option>Banco NIO</option>',true)+'</div><p class="form-helper">El abono se convierte con el tipo de cambio vigente y se registra en Caja y bancos sin modificar inventario.</p>';
    }
    if(type==='expense')body='<div class="form-grid">'+selectField('Categoría','category','<option>Transporte</option><option>Alquiler</option><option>Servicios</option><option>Marketing</option><option>Comisiones</option><option>Empaque</option><option>Otros</option>',true)+formField('Descripción','description','text',true,'maxlength="120"')+formField('Importe','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta de pago','account','<option>Caja USD</option><option>Banco USD</option><option>Caja NIO</option><option>Banco NIO</option>',true)+'</div><p class="form-helper">Un gasto pagado se registra una sola vez en gastos y en el flujo de efectivo. La cuenta debe usar la misma moneda del gasto.</p>';
    if(type==='cash')body='<div class="form-grid">'+selectField('Tipo de movimiento','direction','<option value="income">Entrada / Recibo</option><option value="expense">Salida / Pago</option>',true)+formField('Concepto','concept','text',true,'maxlength="120"')+formField('Importe','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta','account','<option>Caja USD</option><option>Banco USD</option><option>Caja NIO</option><option>Banco NIO</option>',true)+selectField('Proveedor relacionado','supplierIndex','<option value="">Ninguno</option>'+supplierOptions(),false)+'</div>';
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
        selectField('Método de pago','paymentMethod','<option selected>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Pago móvil</option><option>Cheque</option><option>Efectivo contra entrega</option><option>Pendiente / crédito</option><option>Otro</option>',true)+
        formField('Importe recibido (moneda de cobro)','amountReceived','number',false,'min="0" step="0.01" value="0"')+
        '<p class="form-helper full-field">En una venta directa, el sistema propone cobrar el total automáticamente. Si recibes solo una parte, cambia el importe para registrar el abono inicial; el resto quedará como saldo pendiente. Para una venta a crédito, selecciona «Pendiente / crédito».</p>'+ '<p class="form-helper full-field">Para clientes de negocio se utilizará el precio mayorista del producto cuando esté configurado; de lo contrario se conserva el precio normal. La factura guarda una copia del precio aplicado.</p>'+
        '<section class="invoice-preview full-field" id="invoice-preview" aria-live="polite"><div class="invoice-preview-empty">Agrega perfumes para calcular la factura.</div></section>'+
        '<p class="form-helper full-field">Comprobante interno DEMO, no fiscal. La factura se guardará en este navegador y actualizará el inventario una sola vez.</p></div>';
    }
    if(type==='payment'){
      const invoice=invoices.find(f=>f.id===recordId);if(!invoice){toast('No se encontró el comprobante.');return;}
      const balance=Math.max(0,Number(invoice.totalUsd)-Number(invoice.paidUsd||0));
      body='<div class="form-grid"><div class="detail-field full-field"><span>Saldo pendiente</span><strong>'+money(balance)+'</strong></div>'+formField('Importe del abono','amount','number',true,'min="0.01" step="0.01"')+currencyField('USD')+selectField('Cuenta','account','<option>Caja USD</option><option>Banco USD</option><option>Caja NIO</option><option>Banco NIO</option>',true)+'</div>';
    }
    if(type==='employee')body='<div class="form-grid">'+formField('Nombre del colaborador','name','text',true,'maxlength="80"')+formField('Cargo','position','text',true,'maxlength="80"')+formField('Departamento','department','text',false,'maxlength="60"')+formField('Salario mensual (C$)','salaryNio','number',true,'min="0" step="0.01"')+'</div><p class="form-helper">La nómina se administra en córdobas; no se ofrece selector de moneda.</p>';
    document.getElementById('business-modal-title').textContent=titles[type]||(type==='purchase-payment'?'Abonar compra':'Nuevo registro');
    document.getElementById('business-form-body').innerHTML=body;businessForm.dataset.recordType=type;businessForm.dataset.recordId=recordId||'';
    const secureHR=type==='employee'&&window.JBAuth&&window.JBAuth.mode==='authenticated';
    document.querySelector('#business-dialog .eyebrow').textContent=secureHR?'RR. HH. · NEON DEVELOPMENT':'GESTIÓN · DEMO LOCAL';
    document.getElementById('business-save').textContent=type==='invoice'?'Generar factura':(type==='payment'||type==='purchase-payment'?'Registrar abono':(secureHR?'Guardar en Neon':'Guardar en demo'));
    if(type==='invoice'){
      businessForm.dataset.invoiceReceivedEdited='0';
      businessForm.dataset.invoiceCurrency=businessForm.querySelector('[name="currency"]')?.value||'NIO';
      businessForm.dataset.invoiceReceivedRate=String(exchangeRate);
      refreshInvoiceSourceUI();renderInvoiceCart();
    }
    if(typeof businessDialog.showModal==='function')businessDialog.showModal();
  }
  async function saveBusinessRecord(event){
    event.preventDefault();if(!businessForm.reportValidity())return;
    const data=new FormData(businessForm),get=k=>String(data.get(k)||'').trim(),num=k=>Number(data.get(k)||0);
    const type=businessForm.dataset.recordType,currency=get('currency')==='NIO'?'NIO':'USD',rate=exchangeRate,id=Date.now();
    if(BACKEND_MODE&&!['customer','supplier','employee'].includes(type)){
      toast('Este módulo todavía no está conectado al backend. No se guardó ningún dato.');
      return;
    }
    const snapshot=captureDemoState();
    const persistBusinessChanges=function(){if(!persistDemoData()){restoreDemoState(snapshot);return false;}return true;};
    if(type==='purchase-order'){
      const supplier=get('supplierIndex')===''?null:suppliers[num('supplierIndex')],currency=get('currency')==='NIO'?'NIO':'USD';
      const rows=Array.from(businessForm.querySelectorAll('.po-line-row')),items=[];
      for(const row of rows){
        const product=products.find(p=>String(p.id)===String(row.querySelector('[data-po-product]')?.value||''));
        const quantity=Number(row.querySelector('[data-po-quantity]')?.value||0),unitCost=Number(row.querySelector('[data-po-cost]')?.value||0);
        if(!product||!Number.isInteger(quantity)||quantity<1||!Number.isFinite(unitCost)||unitCost<0){toast('Revisa cada producto, cantidad y costo unitario de la orden.');return;}
        if(items.some(item=>String(item.productId)===String(product.id))){toast('Cada producto debe aparecer una sola vez; modifica su cantidad en la misma línea.');return;}
        const unitCostUsd=toUsd(unitCost,currency);
        items.push({productId:product.id,name:product.name,sku:product.sku||'',quantity,receivedQuantity:0,unitCostInput:unitCost,currency,unitCostUsd,lineTotalUsd:roundMoney(quantity*unitCostUsd)});
      }
      if(!supplier||!items.length){toast('Selecciona un proveedor y agrega al menos un producto.');return;}
      const subtotalUsd=roundMoney(items.reduce((sum,item)=>sum+item.lineTotalUsd,0));
      const discountUsd=toUsd(num('discount'),currency),freightUsd=toUsd(num('freight'),currency),taxesUsd=toUsd(num('taxes'),currency);
      if([discountUsd,freightUsd,taxesUsd].some(value=>!Number.isFinite(value)||value<0)||discountUsd>subtotalUsd){toast('Revisa descuento, flete e impuestos.');return;}
      const totalUsd=roundMoney(subtotalUsd-discountUsd+freightUsd+taxesUsd);
      const order={id:String(id),number:nextDocumentNumber('OC',purchaseOrders,'number'),supplierId:supplier.id||null,supplierName:supplier.name,supplierPhone:supplier.phone||'',currency,exchangeRate:rate,items,subtotalUsd,discountUsd,freightUsd,taxesUsd,totalUsd,status:'Borrador',expectedDelivery:get('expectedDelivery'),paymentTerms:get('paymentTerms'),notes:get('notes'),createdAt:new Date().toISOString(),closeReason:''};
      purchaseOrders.unshift(order);
      if(!persistBusinessChanges())return;
      businessDialog.close();renderView();toast('Orden '+order.number+' guardada como borrador. No cambió stock, caja ni cuentas por pagar.');
    }else if(type==='purchase-receipt'){
      const order=purchaseOrders.find(item=>String(item.id)===String(businessForm.dataset.purchaseOrderId||businessForm.dataset.recordId||''));
      if(!order){toast('No se encontró la orden seleccionada.');return;}
      const receiptLines=[];let receiptValidationError='';
      (order.items||[]).forEach((item,index)=>{
        const input=businessForm.querySelector('[data-receipt-quantity="'+index+'"]'),quantity=Number(input?.value||0);
        const remaining=Math.max(0,Number(item.quantity||0)-Number(item.receivedQuantity||0));
        if(!Number.isInteger(quantity)||quantity<0||quantity>remaining){receiptValidationError='Una cantidad recibida supera las unidades pendientes.';return;}
        if(quantity>0)receiptLines.push({item,index,quantity});
      });
      if(receiptValidationError){toast(receiptValidationError);return;}
      if(!receiptLines.length){toast('Indica al menos una cantidad recibida.');return;}
      const missingProduct=receiptLines.find(line=>!products.some(product=>String(product.id)===String(line.item.productId)));
      if(missingProduct){toast('El producto '+missingProduct.item.name+' ya no existe en el catálogo. No se modificó el inventario.');return;}
      const actualFreightUsd=toUsd(num('actualFreight'),order.currency);
      if(!Number.isFinite(actualFreightUsd)||actualFreightUsd<0){toast('El flete real no es válido.');return;}
      const receivedValue=receiptLines.reduce((sum,line)=>sum+line.quantity*Number(line.item.unitCostUsd||0),0);
      const receipt={id:String(id),number:nextDocumentNumber('RC',purchaseReceipts,'number'),purchaseOrderId:order.id,actualFreightUsd,notes:get('receiptNotes'),receivedAt:new Date().toISOString(),items:[]};
      receiptLines.forEach((line,index)=>{
        const item=line.item,product=products.find(p=>String(p.id)===String(item.productId));
        if(!product)throw new Error('No se encontró el producto '+item.name+' en el catálogo.');
        const lineValue=line.quantity*Number(item.unitCostUsd||0),freightShare=receivedValue>0?actualFreightUsd*lineValue/receivedValue:0;
        const orderSubtotal=Number(order.subtotalUsd||0),lineShare=orderSubtotal>0?Number(item.lineTotalUsd||0)/orderSubtotal:0;
        const receiptShare=Number(item.quantity)>0?line.quantity/Number(item.quantity):0;
        const discountShare=Number(order.discountUsd||0)*lineShare*receiptShare,taxShare=Number(order.taxesUsd||0)*lineShare*receiptShare;
        const landedUnitCost=roundMoney((lineValue-discountShare+taxShare+freightShare)/line.quantity),previous=Number(product.stock||0),next=previous+line.quantity;
        const oldCost=Number(product.unitCost||product.purchaseCost||0),weighted=next>0?roundMoney((previous*oldCost+line.quantity*landedUnitCost)/next):landedUnitCost;
        product.stock=next;product.purchaseCost=weighted;product.additionalCost=0;product.unitCost=weighted;product.profit=roundMoney(Number(product.price||0)-weighted);product.margin=Number(product.price||0)>0?roundMoney(product.profit/Number(product.price)*100):0;
        item.receivedQuantity=Number(item.receivedQuantity||0)+line.quantity;
        inventoryMovements.unshift({id:id+index,productId:product.id,productName:product.name,sku:product.sku,type:'Recepción de orden de compra',quantity:line.quantity,delta:line.quantity,previousStock:previous,newStock:next,note:receipt.number+' · '+order.number,sourceType:'purchase-order-receipt',sourceId:receipt.id,createdAt:receipt.receivedAt});
        receipt.items.push({purchaseOrderItemIndex:line.index,productId:product.id,name:product.name,quantity:line.quantity,landedUnitCostUsd:landedUnitCost});
      });
      purchaseReceipts.unshift(receipt);
      order.status=purchaseOrderRemaining(order)===0?'Recibida':'Recepción parcial';order.updatedAt=receipt.receivedAt;
      if(!persistBusinessChanges())return;
      businessDialog.close();renderView();toast('Recepción '+receipt.number+' registrada. Inventario actualizado por las unidades recibidas; sin pago ni CxP.');
    }else if(type==='customer'){
      if(!get('name'))return;
      if(BACKEND_MODE){
        try{
          const result=await apiRequest('/api/catalog/customers','POST',{name:get('name'),contact:get('contact')});
          customers.unshift(mapDbCustomer(result.customer));businessDialog.close();renderView();toast('Cliente guardado en Neon Development.');
        }catch(error){toast(error?.message||'No se pudo guardar el cliente.');}
        return;
      }
      customers.unshift({name:get('name'),contact:get('contact'),orders:0,spent:0,since:new Date().toLocaleDateString('es-NI',{month:'short',year:'numeric'})});
      if(!persistBusinessChanges())return;businessDialog.close();renderView();toast('Cliente guardado en DEMO local.');
    }else if(type==='supplier'){
      if(!get('name'))return;
      if(BACKEND_MODE){
        try{
          const result=await apiRequest('/api/catalog/suppliers','POST',{name:get('name'),contact:get('contact'),phone:get('phone'),email:get('email'),currency,notes:get('notes')});
          suppliers.unshift(mapDbSupplier(result.supplier));businessDialog.close();renderView();toast('Proveedor guardado en Neon Development.');
        }catch(error){toast(error?.message||'No se pudo guardar el proveedor.');}
        return;
      }
      suppliers.unshift({id,name:get('name'),contact:get('contact'),phone:get('phone'),email:get('email'),currency});
      if(!persistBusinessChanges())return;businessDialog.close();renderView();toast('Proveedor guardado en DEMO local.');
    }else if(type==='order'){
      const customer=customers[num('customerIndex')],product=products.find(p=>String(p.id)===get('productId')),quantity=num('quantity');
      if(!customer||!product||!Number.isInteger(quantity)||quantity<1){toast('Revisa el cliente, producto y cantidad.');return;}
      const total=roundMoney(product.price*quantity),next=orders.reduce((m,o)=>Math.max(m,Number(String(o.id).replace('JP-',''))||0),1043)+1;
      const order={id:'JP-'+next,customer:customer.name,phone:customer.contact||'No registrado',date:new Date().toLocaleDateString('es-NI',{day:'2-digit',month:'short',year:'numeric'}),amount:total,status:'Pendiente',paymentMethod:'Por definir',paymentStatus:'Pendiente',deliveryMode:'Por coordinar',discount:0,deliveryFee:0,paymentCurrency:currency,paymentAmount:currency==='NIO'?roundMoney(total*rate):total,exchangeRate:rate,items:[{productId:product.id,name:product.name,sku:product.sku,quantity,unitPrice:product.price}]};
      orders.unshift(order);customer.orders=Number(customer.orders||0)+1;customer.spent=roundMoney(Number(customer.spent||0)+total);
      if(!persistBusinessChanges())return;businessDialog.close();goToView('orders');toast('Pedido guardado en DEMO local. El inventario no se descuenta hasta registrar una salida.');
    }else if(type==='purchase'){
      const supplier=suppliers[num('supplierIndex')],product=products.find(p=>String(p.id)===get('productId')),quantity=num('quantity'),unitCost=num('unitCost');
      if(!supplier||!product||!Number.isInteger(quantity)||quantity<1||!Number.isFinite(unitCost)||unitCost<=0){toast('Revisa proveedor, producto, cantidad y costo.');return;}
      const unitUsd=toUsd(unitCost,currency);
      const totalUsd=roundMoney(unitUsd*quantity),initialPayment=num('initialPayment'),initialAccount=get('initialAccount')||'Caja USD';
      const initialPaidUsd=initialPayment>0?toUsd(initialPayment,currency):0;
      const initialAccountCurrency=/NIO$/.test(initialAccount)?'NIO':'USD';
      if(!Number.isFinite(initialPayment)||initialPayment<0||initialPaidUsd>totalUsd+0.001){toast('El pago inicial debe estar entre cero y el total de la compra.');return;}
      if(initialPayment>0&&initialAccountCurrency!==currency){toast('La moneda de la cuenta debe coincidir con la moneda del pago inicial.');return;}
      const purchase={id,supplier:supplier.name,productId:product.id,product:product.name,quantity,currency,originalUnitCost:unitCost,originalTotal:roundMoney(unitCost*quantity),exchangeRate:rate,unitCostUsd:unitUsd,totalUsd,paidUsd:initialPaidUsd,status:initialPaidUsd>=totalUsd-0.001?'Pagado':(initialPaidUsd>0?'Abono parcial':'Pendiente'),payments:[],createdAt:new Date().toISOString()};
      if(initialPayment>0){purchase.payments.push({amount:initialPayment,currency,exchangeRate:rate,amountUsd:initialPaidUsd,account:initialAccount,createdAt:new Date().toISOString()});cashEntries.unshift({id:Date.now()+1,direction:'expense',concept:'Pago inicial de compra a '+supplier.name,currency,originalAmount:initialPayment,exchangeRate:rate,amountUsd:initialPaidUsd,account:initialAccount,supplier:supplier.name,sourceType:'purchase',sourceId:String(id),createdAt:new Date().toISOString()});}
      purchases.unshift(purchase);
      if(!persistBusinessChanges())return;businessDialog.close();renderView();toast('Factura de proveedor registrada. El saldo se refleja en Cuentas por pagar; el inventario no cambia.');
    }else if(type==='expense'){
      const amount=num('amount'),account=get('account')||'Caja USD',accountCurrency=/NIO$/.test(account)?'NIO':'USD';
      if(!get('description')||!Number.isFinite(amount)||amount<=0){toast('Revisa descripción e importe.');return;}
      if(accountCurrency!==currency){toast('La moneda del gasto debe coincidir con la moneda de la cuenta de pago.');return;}
      const amountUsd=toUsd(amount,currency),createdAt=new Date().toISOString();
      expenses.unshift({id,category:get('category'),description:get('description'),currency,originalAmount:amount,exchangeRate:rate,amountUsd,account,paidAt:createdAt,createdAt});
      cashEntries.unshift({id:id+1,direction:'expense',concept:get('description'),currency,originalAmount:amount,exchangeRate:rate,amountUsd,account,sourceType:'expense',sourceId:String(id),createdAt});
      if(!persistBusinessChanges())return;businessDialog.close();renderView();toast('Gasto pagado guardado en gastos y reflejado una sola vez en el flujo de efectivo.');
    }else if(type==='cash'||type==='payment'||type==='purchase-payment'){
      const amount=num('amount'),account=get('account'),accountCurrency=/NIO$/.test(account)?'NIO':'USD';
      if(type==='cash'&&!get('concept')){toast('Escribe un concepto para el movimiento.');return;}
      if(!Number.isFinite(amount)||amount<=0){toast('Introduce un importe válido.');return;}
      if(accountCurrency!==currency){toast('La moneda seleccionada debe coincidir con la moneda de la cuenta.');return;}
      if(type==='payment'){
        const invoice=invoices.find(f=>f.id===businessForm.dataset.recordId);if(!invoice){toast('No se encontró el comprobante.');return;}
        const amountUsd=toUsd(amount,currency),balance=roundMoney(invoice.totalUsd-Number(invoice.paidUsd||0));
        if(amountUsd>balance+0.001){toast('El abono supera el saldo pendiente.');return;}
        invoice.paidUsd=roundMoney(Number(invoice.paidUsd||0)+amountUsd);invoice.status=invoice.paidUsd>=invoice.totalUsd-0.001?'Pagado':'Abono parcial';
        invoice.payments=Array.isArray(invoice.payments)?invoice.payments:[];
        invoice.payments.push({amount,currency,exchangeRate:rate,amountUsd,account,createdAt:new Date().toISOString()});
        cashEntries.unshift({id,direction:'income',concept:'Abono '+invoice.id,currency,originalAmount:amount,exchangeRate:rate,amountUsd,account,sourceType:'invoice',sourceId:String(invoice.id),createdAt:new Date().toISOString()});
      }else if(type==='purchase-payment'){
        const purchase=purchases.find(p=>String(p.id)===String(businessForm.dataset.recordId));if(!purchase){toast('No se encontró la compra seleccionada.');return;}
        const amountUsd=toUsd(amount,currency),balance=roundMoney(Number(purchase.totalUsd||0)-Number(purchase.paidUsd||0));
        if(amountUsd>balance+0.001){toast('El abono supera el saldo pendiente de la compra.');return;}
        purchase.paidUsd=roundMoney(Number(purchase.paidUsd||0)+amountUsd);purchase.status=purchase.paidUsd>=purchase.totalUsd-0.001?'Pagado':'Abono parcial';
        purchase.payments=Array.isArray(purchase.payments)?purchase.payments:[];
        purchase.payments.push({amount,currency,exchangeRate:rate,amountUsd,account,createdAt:new Date().toISOString()});
        cashEntries.unshift({id,direction:'expense',concept:'Abono a compra '+purchase.id+' · '+purchase.supplier,currency,originalAmount:amount,exchangeRate:rate,amountUsd,account,supplier:purchase.supplier,sourceType:'purchase',sourceId:String(purchase.id),createdAt:new Date().toISOString()});
      }else{
        const supplier=get('supplierIndex')===''?null:suppliers[num('supplierIndex')];
        cashEntries.unshift({id,direction:get('direction'),concept:get('concept'),currency,originalAmount:amount,exchangeRate:rate,amountUsd:toUsd(amount,currency),account,supplier:supplier?supplier.name:'',createdAt:new Date().toISOString()});
      }
      if(!persistBusinessChanges())return;businessDialog.close();renderView();toast(type==='payment'?'Abono registrado en DEMO local.':(type==='purchase-payment'?'Abono al proveedor registrado en DEMO local.':'Movimiento de caja registrado en DEMO local.'));
    }else if(type==='invoice'){
      const selectedSource=get('saleSource');
      const source=selectedSource==='web'?'web':(selectedSource==='manual'?'manual':'store');
      const orderId=get('orderId'),order=source==='web'?orders.find(o=>String(o.id)===orderId):null;
      if(source==='web'&&(!order||invoices.some(f=>String(f.orderId)===String(order.id)))){toast('Selecciona un pedido web disponible que todavía no tenga factura.');return;}
      const customerName=(source==='web'?(order?.customer||get('customerName')):get('customerName')).trim();
      if(!customerName){toast('Escribe o selecciona el nombre del cliente.');return;}
      const totals=invoiceDraftTotals();if(totals.error){toast(totals.error);return;}
      const customerType=get('customerType')==='business'?'business':'particular';
      const phone=source==='web'?(order?.phone||get('customerPhone')):get('customerPhone');
      const received=num('amountReceived');
      if(!Number.isFinite(received)||received<0){toast('El importe recibido no puede ser negativo.');return;}
      const totalOriginal=totals.totalUsd;
      const paidUsd=toUsd(received,currency);
      if(paidUsd>totals.totalUsd+0.001){toast('El importe recibido supera el total de la factura.');return;}
      const nextNumber=Math.max(0,...invoices.map(f=>Number(String(f.id||'').match(/(\d+)$/)?.[1]||0)))+1;
      const invoiceId='JBI-'+String(nextNumber).padStart(6,'0');
      const invoice={
        id:invoiceId,orderId:source==='web'?order.id:'',source,customer:customerName,customerType,phone:phone||'',
        items:totals.items.map(item=>({productId:item.productId,name:item.name,sku:item.sku||'',barcode:item.barcode||'',quantity:item.quantity,unitPriceUsd:item.unitPriceUsd,unitCostUsd:Number(item.unitCostUsd??products.find(p=>String(p.id)===String(item.productId))?.unitCost??0),lineTotalUsd:item.lineTotalUsd})),
        subtotalUsd:totals.subtotalUsd,discountUsd:totals.discountUsd,deliveryFeeUsd:totals.deliveryFeeUsd,
        currency:'USD',paymentCurrency:currency,paymentOriginalAmount:received,exchangeRate:rate,totalUsd:totals.totalUsd,originalAmount:totalOriginal,paidUsd,payments:[],
        paymentMethod:get('paymentMethod')||'Pendiente',status:paidUsd>=totals.totalUsd-0.001?'Pagado':(paidUsd>0?'Abono parcial':'Pendiente'),
        createdAt:new Date().toISOString(),kind:'Comprobante interno DEMO',taxIncluded:false,inventoryAppliedAt:null
      };
      if(source==='web'){
        const orderNetMovement=inventoryMovements.filter(m=>m.sourceType==='order'&&String(m.sourceId)===String(order.id)).reduce((sum,m)=>sum+Number(m.delta||0),0);
        const alreadyApplied=Boolean(order.inventoryAppliedAt)||Math.abs(orderNetMovement)>0.001||order.status!=='Pendiente';
        if(!alreadyApplied){
          const stockResult=recordOrderInventory(order,false);
          if(stockResult.error){toast(stockResult.error);return;}
          order.inventoryAppliedAt=new Date().toISOString();
          order.status='En preparación';
        }else if(!order.inventoryAppliedAt){
          order.inventoryAppliedAt='confirmed-before-invoice';
        }
        invoice.inventoryAppliedAt=order.inventoryAppliedAt||'order-stock-already-applied';
        invoice.inventorySourceType='order';
        invoice.inventorySourceId=String(order.id);
        order.invoiceId=invoice.id;
        order.paymentStatus=invoice.status;
        order.paymentAmount=received;
        order.paymentCurrency=currency;
        order.paymentMethod=invoice.paymentMethod;
      }else{
        const stockResult=recordInvoiceInventory(invoice);
        if(stockResult.error){toast(stockResult.error);return;}
      }
      const existingCustomer=customers.find(item=>String(item.name||'').trim().toLocaleLowerCase('es')===customerName.toLocaleLowerCase('es'));
      if(existingCustomer){
        existingCustomer.customerType=customerType;
        if(phone)existingCustomer.contact=phone;
        if(source!=='web'){
          existingCustomer.orders=Number(existingCustomer.orders||0)+1;
          existingCustomer.spent=roundMoney(Number(existingCustomer.spent||0)+totals.totalUsd);
        }
      }else{
        customers.unshift({name:customerName,contact:phone||'',customerType,orders:1,spent:totals.totalUsd,since:new Date().toLocaleDateString('es-NI',{month:'short',year:'numeric'})});
      }
      if(paidUsd>0){
        const account=(invoice.paymentMethod==='Transferencia'?'Banco ':'Caja ')+currency;
        invoice.payments.push({amount:received,currency,exchangeRate:rate,amountUsd:paidUsd,account,createdAt:new Date().toISOString()});
        cashEntries.unshift({id:Date.now(),direction:'income',concept:'Cobro inicial '+invoice.id,currency,originalAmount:received,exchangeRate:rate,amountUsd:paidUsd,account,paymentMethod:invoice.paymentMethod,sourceType:'invoice',sourceId:String(invoice.id),createdAt:new Date().toISOString()});
      }
      invoices.unshift(invoice);
      if(!persistBusinessChanges())return;
      businessDialog.close();renderView();toast('Factura '+invoice.id+' generada. Inventario actualizado sin duplicar salidas.');
      window.requestAnimationFrame(function(){showInvoicePreview(invoice.id);});
    }else if(type==='employee'){
      const salary=num('salaryNio');if(!get('name')||!get('position')||!Number.isFinite(salary)||salary<0){toast('Revisa los datos y el salario.');return;}
      if(window.JBAuth&&window.JBAuth.mode==='authenticated'){
        try{
          const token=await window.JBAuth.getToken();
          if(!token)throw new Error('La sesión expiró. Inicia sesión nuevamente.');
          const response=await fetch(window.JBAuth.apiUrl ? window.JBAuth.apiUrl('/api/hr/employees') : '/api/hr/employees',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({name:get('name'),position:get('position'),department:get('department'),salaryNio:salary})});
          const result=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(result?.error?.message||'No se pudo guardar el colaborador en Neon.');
          const employee=result.employee;
          employees.unshift({id:employee.id,employeeCode:employee.employee_code||'',name:employee.name,position:employee.position,department:employee.department||'',salaryNio:Number(employee.salary_nio||0),status:employee.status||'Activo'});
          hrRecordsLoaded=true;hrLoadAttempted=true;hrLoadError='';
          businessDialog.close();renderView();toast('Colaborador guardado en Neon Development. Salario expresado en córdobas.');
        }catch(error){toast(error?.message||'No se pudo guardar el registro de RR. HH.');}
        return;
      }
      employees.unshift({id,name:get('name'),position:get('position'),department:get('department'),salaryNio:salary,status:'Activo'});
      if(!persistBusinessChanges())return;businessDialog.close();renderView();toast('Colaborador registrado en DEMO local. Salario expresado en córdobas.');
    }
  }
  function dateText(value){const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-NI',{day:'2-digit',month:'short',year:'numeric'});}
  function renderCustomers(){
    const rows=customers.map(c=>'<tr><td data-label="Cliente / contacto" class="table-primary">'+esc(c.name)+'<small class="table-secondary">'+esc(c.contact||'Sin contacto')+'</small></td><td data-label="Pedidos">'+Number(c.orders||0)+'</td><td data-label="Importe en pedidos USD" class="table-primary">'+money(c.spent)+'</td><td data-label="Desde">'+esc(c.since||'—')+'</td><td data-label="Estado"><span class="status-chip status-success">Activo</span></td></tr>').join('');
    return heading(views.customers,'<button class="button button-primary" data-action="new-customer">'+svg('plus')+' Nuevo cliente</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Clientes</span><strong>'+customers.length+'</strong></div><div class="summary-mini"><span>Pedidos acumulados</span><strong>'+customers.reduce((s,c)=>s+Number(c.orders||0),0)+'</strong></div><div class="summary-mini"><span>Importe en pedidos USD</span><strong>'+money(customers.reduce((s,c)=>s+Number(c.spent||0),0))+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>CLIENTE / CONTACTO</th><th>PEDIDOS</th><th>PEDIDOS USD</th><th>DESDE</th><th>ESTADO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">Sin clientes registrados.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('warning')+'<div><strong>'+(BACKEND_MODE?'Clientes conectados a Neon Development':'Clientes DEMO locales')+'</strong><p>'+(BACKEND_MODE?'Las fichas se guardan en Neon con permisos de administración. Pedidos y saldos aún no están conectados.':'Los datos viven solo en este navegador y no deben usarse para registros comerciales reales.')+'</p></div></div>';
  }
  function renderOrders(){
    const rows=orders.map(o=>'<tr><td data-label="Referencia" class="table-primary">'+esc(o.id)+'</td><td data-label="Cliente">'+esc(o.customer)+'</td><td data-label="Fecha">'+esc(o.date)+'</td><td data-label="Total / cobro" class="table-primary">'+money(o.amount)+'<small class="table-secondary">Cobro: '+moneyInCurrency(o.paymentAmount==null?o.amount:o.paymentAmount,o.paymentCurrency||'USD')+'</small></td><td data-label="Estado">'+orderStatus(o.status)+'</td><td data-label="Detalle"><button class="table-action" data-action="preview-order" data-id="'+esc(o.id)+'" aria-label="Ver pedido '+esc(o.id)+'">'+svg('eye')+'</button></td></tr>').join('');
    return heading(views.orders,'<button class="button button-primary" data-action="new-order">'+svg('plus')+' Nuevo pedido</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Pedidos</span><strong>'+orders.length+'</strong></div><div class="summary-mini"><span>Pendientes</span><strong>'+orders.filter(o=>o.status!=='Completado').length+'</strong></div><div class="summary-mini"><span>Importe en pedidos USD</span><strong>'+money(orders.reduce((s,o)=>s+Number(o.amount||0),0))+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>REFERENCIA</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL / COBRO</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Sin pedidos.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('spark')+'<div><strong>Pedidos DEMO</strong><p>El inventario se descuenta al confirmar el pedido (estado «En preparación» o posterior). Si vuelve a «Pendiente», se registra el reingreso correspondiente.</p></div></div>';
  }
  function renderBilling(){
    const rows=invoices.map(f=>{
      const paid=Number(f.paidUsd||0),balance=Math.max(0,Number(f.totalUsd||0)-paid);
      const origin=f.source==='web'?'Página web':(f.source==='manual'?'Venta manual':'Tienda física');
      return '<tr><td data-label="Factura / origen" class="table-primary"><strong>'+esc(f.id)+'</strong><small class="table-secondary">'+origin+(f.orderId?' · '+esc(f.orderId):'')+'</small></td><td data-label="Cliente">'+esc(f.customer)+'</td><td data-label="Fecha">'+dateText(f.createdAt)+'</td><td data-label="Total">'+money(f.totalUsd)+'<small class="table-secondary">'+moneyInCurrency(roundMoney(Number(f.totalUsd||0)*Number(f.exchangeRate||exchangeRate)),'NIO')+' · '+rateLabel(f.exchangeRate)+'</small></td><td data-label="Pago recibido / saldo">'+money(paid)+' recibido <small class="table-secondary">'+money(balance)+' saldo pendiente</small></td><td data-label="Estado"><span class="status-chip '+(balance===0?'status-success':'status-pending')+'">'+esc(f.status||'Pendiente')+'</span></td><td data-label="Acción"><button class="button button-quiet button-small" data-action="view-invoice" data-id="'+esc(f.id)+'">Ver / imprimir</button>'+(balance>0?'<button class="button button-quiet button-small" data-action="new-payment" data-id="'+esc(f.id)+'">Abonar</button>':'')+'</td></tr>';
    }).join('');
    return heading(views.billing,'<button class="button button-primary" data-action="new-invoice">'+svg('plus')+' Nueva factura</button>')+
      '<div class="summary-strip"><div class="summary-mini"><span>Facturas DEMO</span><strong>'+invoices.length+'</strong></div><div class="summary-mini"><span>Saldo pendiente USD</span><strong>'+money(invoices.reduce((s,f)=>s+Math.max(0,f.totalUsd-Number(f.paidUsd||0)),0))+'</strong></div><div class="summary-mini"><span>Venta facturada USD</span><strong>'+money(invoices.reduce((s,f)=>s+f.totalUsd,0))+'</strong></div></div>'+
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>FACTURA / ORIGEN</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>PAGO RECIBIDO / SALDO</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Todavía no hay facturas DEMO.</td></tr>')+'</tbody></table></div></article>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Comprobantes internos DEMO, no fiscales</strong><p>La vista previa permite imprimir en formato A4. No tiene autorización tributaria ni sustituye una factura fiscal.</p></div></div>';
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
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Cuentas por cobrar DEMO</strong><p>Los saldos se calculan sobre comprobantes internos locales. Cada abono conserva importe, moneda, tasa y cuenta de ingreso; no representa una transacción bancaria real.</p></div></div>';
  }
  async function loadHRFromAPI(force){
    const auth=window.JBAuth;
    if(!auth||auth.mode!=='authenticated'||!auth.profile||!['owner','admin','hr'].includes(auth.profile.role)||hrRecordsLoading)return;
    if(hrRecordsLoaded&&!force)return;
    if(hrLoadAttempted&&!force)return;
    hrRecordsLoading=true;hrLoadAttempted=true;hrLoadError='';
    try{
      const token=await auth.getToken();
      if(!token)throw new Error('La sesión expiró. Inicia sesión nuevamente.');
      const response=await fetch(window.JBAuth.apiUrl ? window.JBAuth.apiUrl('/api/hr/employees') : '/api/hr/employees',{headers:{authorization:'Bearer '+token},cache:'no-store'});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error?.message||'No se pudieron cargar los colaboradores.');
      employees=(Array.isArray(body.employees)?body.employees:[]).map(e=>({
        id:e.id,employeeCode:e.employee_code||'',name:e.name,position:e.position,department:e.department||'',
        salaryNio:Number(e.salary_nio||0),status:e.status||'Activo',hireDate:e.hire_date||null,
        phone:e.phone||'',email:e.email||''
      }));
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
    if(backendMode&&!auth.user){
      return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>Sección protegida</strong><p>Inicia sesión con tu cuenta autorizada para consultar expedientes y salarios. RR. HH. permanece habilitado, pero los datos reales no se muestran sin autenticación.</p></div></div>';
    }
    if(backendMode&&!auth.profile){
      return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>Cuenta pendiente de autorización</strong><p>'+esc(auth.profileError||'Verifica tu correo y vuelve a iniciar sesión para validar tus permisos de ERP.')+'</p></div></div>';
    }
    if(backendMode&&!['owner','admin','hr'].includes(auth.profile.role)){
      return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>Permiso insuficiente</strong><p>Tu cuenta no tiene acceso al expediente de personal. Solicita el rol RR. HH. a la cuenta propietaria.</p></div></div>';
    }
    if(backendMode&&!hrRecordsLoaded){
      if(!hrRecordsLoading&&!hrLoadAttempted)loadHRFromAPI(false);
      const message=hrLoadError||'Consultando los registros protegidos de Neon…';
      return heading(views.hr,'')+'<div class="notice-panel">'+svg('warning')+'<div><strong>RR. HH. · Neon Development</strong><p>'+esc(message)+'</p>'+(hrLoadError?'<button class="button button-quiet button-small" data-action="reload-hr">Reintentar</button>':'')+'</div></div>';
    }
    const rows=employees.map(e=>'<tr><td data-label="Colaborador" class="table-primary">'+esc(e.name)+'<small class="table-secondary">'+esc(e.department||'Sin departamento')+'</small></td><td data-label="Cargo">'+esc(e.position)+'</td><td data-label="Salario mensual" class="table-primary">'+moneyInCurrency(e.salaryNio,'NIO')+'</td><td data-label="Estado"><span class="status-chip status-success">'+esc(e.status||'Activo')+'</span></td></tr>').join('');
    const action=!backendMode||['owner','admin','hr'].includes(auth.profile.role)?'<button class="button button-primary" data-action="new-employee">'+svg('plus')+' Agregar colaborador</button>':'';
    const countLabel=backendMode?'Colaboradores en Neon':'Colaboradores DEMO';
    const noticeTitle=backendMode?'RR. HH. sincronizado con Neon Development':'RRHH DEMO';
    const noticeText=backendMode?'Los registros están protegidos por sesión y roles. Salarios y nómina se almacenan en córdobas; la nómina legal requiere revisar deducciones, prestaciones y normativa laboral.':'La nómina se mantiene en córdobas. Deducciones, prestaciones y documentos laborales requieren validación legal antes de producción.';
    return heading(views.hr,action)+'<div class="summary-strip"><div class="summary-mini"><span>'+countLabel+'</span><strong>'+employees.length+'</strong></div><div class="summary-mini"><span>Nómina mensual (C$)</span><strong>'+moneyInCurrency(employees.reduce((s,e)=>s+Number(e.salaryNio||0),0),'NIO')+'</strong></div><div class="summary-mini"><span>Moneda salarial</span><strong>NIO</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>COLABORADOR</th><th>CARGO</th><th>SALARIO MENSUAL</th><th>ESTADO</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">'+(backendMode?'No hay colaboradores registrados.':'No hay colaboradores DEMO.')+'</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('warning')+'<div><strong>'+noticeTitle+'</strong><p>'+noticeText+'</p></div></div>';
  }
  function purchaseOrderLineMarkup(){
    const options=products.filter(p=>p.active!==false).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.sku||'Sin SKU')+'</option>').join('');
    return '<div class="po-line-row"><label class="form-field po-product-field"><span>Producto existente</span><select data-po-product required><option value="">Seleccionar producto</option>'+options+'</select></label><label class="form-field po-quantity-field"><span>Cantidad</span><input data-po-quantity type="number" min="1" step="1" value="1" required></label><label class="form-field po-cost-field"><span>Costo unitario</span><input data-po-cost type="number" min="0" step="0.01" required></label><button type="button" class="table-action table-action-danger po-remove-line" data-action="remove-po-line" aria-label="Quitar producto">×</button></div>';
  }
  function purchaseOrderRemaining(order){return (order.items||[]).reduce((sum,item)=>sum+Math.max(0,Number(item.quantity||0)-Number(item.receivedQuantity||0)),0);}
  function purchaseOrderReceived(order){return (order.items||[]).reduce((sum,item)=>sum+Number(item.receivedQuantity||0),0);}
  function purchaseOrderOutstandingUsd(order){
    const subtotal=(order.items||[]).reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.unitCostUsd||0),0);
    const remaining=(order.items||[]).reduce((sum,item)=>sum+Math.max(0,Number(item.quantity||0)-Number(item.receivedQuantity||0))*Number(item.unitCostUsd||0),0);
    const ratio=subtotal>0?remaining/subtotal:0;
    return roundMoney(Math.max(0,remaining+(Number(order.freightUsd||0)+Number(order.taxesUsd||0)-Number(order.discountUsd||0))*ratio));
  }
  function nextDocumentNumber(prefix,collection,field){
    const year=new Date().getFullYear(),needle=prefix+'-'+year+'-';
    const sequence=(collection||[]).reduce((max,item)=>{const number=String(item[field]||'');return number.startsWith(needle)?Math.max(max,Number(number.slice(needle.length))||0):max;},0)+1;
    return needle+String(sequence).padStart(4,'0');
  }
  function renderPurchaseOrders(){
    const open=purchaseOrders.filter(o=>!['Recibida','Cerrada con faltante','Cancelada'].includes(o.status));
    const pendingUnits=open.reduce((sum,o)=>sum+purchaseOrderRemaining(o),0);
    const committed=open.reduce((sum,o)=>sum+purchaseOrderOutstandingUsd(o),0);
    const rows=purchaseOrders.map(order=>{
      const remaining=purchaseOrderRemaining(order),received=purchaseOrderReceived(order);
      const actions=[];
      if(order.status==='Borrador')actions.push('<button class="button button-quiet button-small" data-action="send-po" data-id="'+esc(order.id)+'">Marcar enviada</button>');
      if(order.status==='Enviada')actions.push('<button class="button button-quiet button-small" data-action="confirm-po" data-id="'+esc(order.id)+'">Confirmar</button>');
      if(remaining>0&&!['Borrador','Cancelada','Cerrada con faltante'].includes(order.status))actions.push('<button class="button button-primary button-small" data-action="receive-po" data-id="'+esc(order.id)+'">Recibir</button>');
      if(remaining>0&&!['Cancelada','Cerrada con faltante','Recibida'].includes(order.status))actions.push('<button class="button button-quiet button-small" data-action="close-po-short" data-id="'+esc(order.id)+'">Cerrar faltante</button>');
      if(!received&&!['Cancelada','Recibida'].includes(order.status))actions.push('<button class="table-action table-action-danger" data-action="cancel-po" data-id="'+esc(order.id)+'" aria-label="Cancelar orden">×</button>');
      actions.push('<button class="button button-quiet button-small" data-action="share-po" data-id="'+esc(order.id)+'">WhatsApp</button>');
      actions.push('<button class="table-action" data-action="print-po" data-id="'+esc(order.id)+'" aria-label="Imprimir orden">↗</button>');
      return '<tr><td data-label="Orden" class="table-primary"><strong>'+esc(order.number)+'</strong><small class="table-secondary">'+dateText(order.createdAt)+'</small></td><td data-label="Proveedor">'+esc(order.supplierName)+'</td><td data-label="Artículos">'+(order.items||[]).length+' referencias<small class="table-secondary">'+received+' recibidas · '+remaining+' pendientes</small></td><td data-label="Total">'+money(Number(order.totalUsd||0))+'</td><td data-label="Estado"><span class="status-chip '+(order.status==='Recibida'?'status-success':(order.status==='Cancelada'?'status-muted':'status-pending'))+'">'+esc(order.status)+'</span></td><td data-label="Acciones"><div class="table-actions po-actions">'+actions.join('')+'</div></td></tr>';
    }).join('');
    const receiptRows=purchaseReceipts.slice().sort((x,y)=>String(y.receivedAt).localeCompare(String(x.receivedAt))).slice(0,8).map(r=>{
      const order=purchaseOrders.find(o=>String(o.id)===String(r.purchaseOrderId));
      return '<tr><td>'+esc(r.number)+'</td><td>'+esc(order?.number||'Orden eliminada')+'</td><td>'+dateText(r.receivedAt)+'</td><td>'+r.items.reduce((sum,item)=>sum+Number(item.quantity||0),0)+' uds.</td><td>'+money(r.actualFreightUsd||0)+'</td></tr>';
    }).join('');
    return heading(views.purchaseOrders,'<button class="button button-primary" data-action="new-purchase-order">'+svg('plus')+' Nueva orden</button>')+
      '<div class="summary-strip"><div class="summary-mini"><span>Órdenes activas</span><strong>'+open.length+'</strong></div><div class="summary-mini"><span>Unidades pendientes</span><strong>'+pendingUnits+'</strong></div><div class="summary-mini"><span>Compromisos estimados</span><strong>'+money(committed)+'</strong></div></div>'+
      '<article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>ORDEN</th><th>PROVEEDOR</th><th>ARTÍCULOS</th><th>TOTAL USD</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Todavía no hay órdenes de compra.</td></tr>')+'</tbody></table></div></article>'+
      '<article class="list-panel"><div class="panel-heading"><div><h2>Historial de recepciones</h2><p>Cada entrega parcial conserva su fecha, cantidades y costo de flete real</p></div><span class="ledger-count">'+purchaseReceipts.length+' recepciones</span></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>RECEPCIÓN</th><th>ORDEN</th><th>FECHA</th><th>UNIDADES</th><th>FLETE USD</th></tr></thead><tbody>'+(receiptRows||'<tr><td colspan="5">No hay recepciones registradas.</td></tr>')+'</tbody></table></div></article>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Una orden no es una compra contabilizada</strong><p>Crear o enviar una orden no incrementa el inventario, no registra salida de efectivo y no genera cuentas por pagar. Solo la recepción aumenta existencias. La factura del proveedor se registra por separado.</p></div></div>';
  }
  function renderProfitability(){
    const recognized=invoices.filter(i=>!['Anulada','Cancelada'].includes(i.status));
    let revenue=0,cogs=0,unknownCostLines=0;const byProduct={};
    recognized.forEach(invoice=>{
      const lines=Array.isArray(invoice.items)?invoice.items:[];
      const lineSubtotal=lines.reduce((sum,line)=>sum+Number(line.lineTotalUsd??(Number(line.quantity||0)*Number(line.unitPriceUsd||0))),0);
      const subtotal=Number(invoice.subtotalUsd??lineSubtotal);
      const discount=Math.max(0,Number(invoice.discountUsd||0));
      const delivery=Math.max(0,Number(invoice.deliveryFeeUsd||0));
      revenue+=Number(invoice.totalUsd??Math.max(0,subtotal-discount+delivery));
      lines.forEach(line=>{
        const qty=Number(line.quantity||0),grossLine=Number(line.lineTotalUsd??(qty*Number(line.unitPriceUsd||0)));
        const discountShare=subtotal>0?discount*grossLine/subtotal:0;
        const lineSales=Math.max(0,grossLine-discountShare);
        const product=products.find(p=>String(p.id)===String(line.productId));
        const unitCost=line.unitCostUsd!=null?Number(line.unitCostUsd):Number(product?.unitCost||0),lineCost=qty*unitCost;
        cogs+=lineCost;if(!(unitCost>0))unknownCostLines+=1;
        const key=String(line.productId||line.sku||line.name);
        if(!byProduct[key])byProduct[key]={name:line.name||product?.name||'Producto',sku:line.sku||product?.sku||'',units:0,sales:0,cost:0};
        byProduct[key].units+=qty;byProduct[key].sales+=lineSales;byProduct[key].cost+=lineCost;
      });
    });
    revenue=roundMoney(revenue);cogs=roundMoney(cogs);
    const gross=roundMoney(revenue-cogs),operating=roundMoney(expenses.reduce((sum,item)=>sum+Number(item.amountUsd||0),0)),net=roundMoney(gross-operating);
    const rows=Object.values(byProduct).sort((x,y)=>(y.sales-y.cost)-(x.sales-x.cost)).map(item=>{
      const profit=item.sales-item.cost,margin=item.sales>0?profit/item.sales*100:0;
      return '<tr><td class="table-primary">'+esc(item.name)+'<small class="table-secondary">'+esc(item.sku)+'</small></td><td>'+item.units+'</td><td>'+money(item.sales)+'</td><td>'+money(item.cost)+'</td><td>'+money(profit)+'</td><td>'+margin.toFixed(1)+'%</td></tr>';
    }).join('');
    return heading(views.profitability,'<button class="button button-quiet" data-view="capital">Ver capital y efectivo '+svg('arrow')+'</button>')+
      '<div class="metric-grid">'+metric('Ventas facturadas',money(revenue),'chart',recognized.length+' facturas','ingreso reconocido · DEMO',false)+metric('Costo de venta',money(cogs),'boxes','COGS','costo guardado por unidad',false)+metric('Utilidad bruta',money(gross),'spark','Ventas − COGS','antes de gastos operativos',true)+metric('Utilidad neta estimada',money(net),'chart','Después de gastos',money(operating)+' en gastos operativos',true)+'</div>'+
      '<article class="list-panel"><div class="panel-heading"><div><h2>Rentabilidad por producto</h2><p>El descuento se distribuye proporcionalmente entre productos. La entrega se incluye en ventas totales, pero no se asigna a un SKU; documentos antiguos sin costo usan el costo actual como aproximación</p></div></div><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>PRODUCTO</th><th>UNIDADES</th><th>VENTAS</th><th>COSTO</th><th>UTILIDAD</th><th>MARGEN</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Todavía no hay facturas registradas.</td></tr>')+'</tbody></table></div></article>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Rentabilidad DEMO, no contabilidad oficial</strong><p>Se reconoce el ingreso al generar la factura, aunque exista saldo por cobrar. La utilidad neta resta gastos operativos, no órdenes de compra ni reposición de inventario. '+(unknownCostLines?unknownCostLines+' línea(s) no tienen costo histórico; su rentabilidad está incompleta.':'Los costos históricos están disponibles en las nuevas facturas.')+'</p></div></div>';
  }
  function renderCapital(){
    const income=cashEntries.filter(e=>e.direction==='income').reduce((sum,e)=>sum+Number(e.amountUsd||0),0);
    const outflow=cashEntries.filter(e=>e.direction!=='income').reduce((sum,e)=>sum+Number(e.amountUsd||0),0);
    const movement=roundMoney(income-outflow);
    const inventory=roundMoney(products.filter(p=>p.active!==false).reduce((sum,p)=>sum+Number(p.stock||0)*Number(p.unitCost||0),0));
    const receivable=roundMoney(invoices.reduce((sum,i)=>sum+Math.max(0,Number(i.totalUsd||0)-Number(i.paidUsd||0)),0));
    const payable=roundMoney(purchases.reduce((sum,p)=>sum+Math.max(0,Number(p.totalUsd||0)-Number(p.paidUsd||0)),0));
    const commitment=roundMoney(purchaseOrders.filter(o=>!['Recibida','Cancelada','Cerrada con faltante'].includes(o.status)).reduce((sum,o)=>sum+purchaseOrderOutstandingUsd(o),0));
    return heading(views.capital,'<button class="button button-quiet" data-view="profitability">Ver rentabilidad '+svg('arrow')+'</button>')+
      '<div class="metric-grid">'+metric('Flujo neto registrado',money(movement),'chart','Entradas − salidas','no incluye saldo inicial',false)+metric('Inventario valorizado',money(inventory),'boxes','A costo unitario','activo estimado en stock',false)+metric('Cuentas por cobrar',money(receivable),'wallet',invoices.filter(i=>Number(i.totalUsd||0)>Number(i.paidUsd||0)+0.001).length+' facturas','saldo pendiente de clientes',false)+metric('Cuentas por pagar',money(payable),'receipt',purchases.filter(p=>Number(p.totalUsd||0)>Number(p.paidUsd||0)+0.001).length+' facturas','obligaciones registradas',false)+'</div>'+
      '<div class="summary-strip"><div class="summary-mini"><span>Entradas acumuladas</span><strong>'+money(income)+'</strong></div><div class="summary-mini"><span>Salidas acumuladas</span><strong>'+money(outflow)+'</strong></div><div class="summary-mini"><span>Órdenes abiertas · compromiso</span><strong>'+money(commitment)+'</strong></div></div>'+
      '<div class="notice-panel">'+svg('warning')+'<div><strong>Capital y efectivo DEMO</strong><p>El flujo neto es solo el movimiento acumulado registrado: todavía no hay saldo inicial de caja/bancos configurado ni conciliación bancaria. El inventario es un activo, no efectivo. Las órdenes abiertas son compromisos, no cuentas por pagar; las cuentas por pagar salen de facturas de proveedor registradas.</p></div></div>'+
      '<article class="panel"><div class="panel-heading"><div><h2>Capital inicial</h2><p>No configurado. Evitamos mostrar una cifra inventada.</p></div></div><p class="form-helper">Cuando definamos el aporte inicial, podremos separar capital invertido, resultados acumulados, inventario y efectivo disponible.</p></article>';
  }
  function printPurchaseOrder(orderId){
    const order=purchaseOrders.find(item=>String(item.id)===String(orderId));if(!order)return;
    const rows=(order.items||[]).map(item=>'<tr><td>'+esc(item.name)+'</td><td>'+esc(item.sku||'')+'</td><td>'+Number(item.quantity)+'</td><td>'+money(item.unitCostUsd)+'</td><td>'+money(item.lineTotalUsd)+'</td></tr>').join('');
    const doc='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(order.number)+' · JB PARFUMS</title><style>body{font:14px Arial,sans-serif;color:#24211b;padding:32px;max-width:900px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:2px solid #b9935a;padding-bottom:18px}h1{font-size:24px;margin:0}small{color:#766f65}table{width:100%;border-collapse:collapse;margin-top:28px}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #ddd}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:22px}.meta div{padding:9px;background:#f7f4ef}.total{text-align:right;font-size:22px;margin-top:24px}footer{margin-top:42px;color:#766f65;font-size:12px}@media print{body{padding:0}}</style></head><body><header><div><h1>JB PARFUMS</h1><p>Orden de compra · '+esc(order.number)+'</p></div><div><strong>'+esc(order.status)+'</strong><br><small>'+dateText(order.createdAt)+'</small></div></header><div class="meta"><div><small>PROVEEDOR</small><br><strong>'+esc(order.supplierName)+'</strong></div><div><small>ENTREGA ESTIMADA</small><br><strong>'+esc(order.expectedDelivery||'Por coordinar')+'</strong></div><div><small>CONDICIONES DE PAGO</small><br>'+esc(order.paymentTerms||'Por acordar')+'</div><div><small>MONEDA</small><br>'+esc(order.currency)+' · tasa '+Number(order.exchangeRate).toFixed(4)+'</div></div><table><thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th>Costo unitario USD</th><th>Total USD</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Total estimado: <strong>'+money(order.totalUsd)+'</strong></div><p>'+esc(order.notes||'')+'</p><footer>Documento de solicitud comercial. No representa pago, recepción de inventario ni factura de proveedor.<br>Generado por JB PARFUMS ERP.</footer><script>window.addEventListener("load",()=>window.print())</script></body></html>';
    const win=window.open('','_blank');if(!win){toast('El navegador bloqueó la ventana. Permite ventanas emergentes para imprimir la orden.');return;}win.opener=null;win.document.open();win.document.write(doc);win.document.close();
  }
  function exportProductCatalogPdf(){
    const available=products.filter(p=>p.active!==false&&Number(p.stock||0)>0);
    const rows=available.map(p=>'<article><div class="art">JB</div><div><h2>'+esc(p.name)+'</h2><p>'+esc([p.brand,p.sizeMl?p.sizeMl+' ml':'',p.family].filter(Boolean).join(' · '))+'</p><p>'+esc(p.description||'Fragancia disponible en JB PARFUMS.')+'</p><strong>'+money(p.price)+'</strong><small>'+Number(p.stock)+' disponibles</small></div></article>').join('');
    const doc='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Catálogo JB PARFUMS</title><style>body{font:14px Arial,sans-serif;color:#25221e;padding:24px;max-width:1000px;margin:auto}header{border-bottom:2px solid #b9935a;margin-bottom:24px}h1{letter-spacing:3px}main{display:grid;grid-template-columns:1fr 1fr;gap:18px}article{display:flex;gap:14px;padding:14px;border:1px solid #e5ded2;border-radius:12px;break-inside:avoid}.art{width:90px;min-width:90px;height:120px;display:grid;place-items:center;background:#201c18;color:#c7a36e;font:28px Georgia;border-radius:8px}h2{font-size:17px;margin:0 0 6px}p{color:#6f685e;font-size:12px}small{display:block;color:#6f685e;margin-top:5px}@media print{body{padding:0}}</style></head><body><header><h1>JB PARFUMS</h1><p>CATÁLOGO COMERCIAL · DISPONIBILIDAD ACTUAL</p></header><main>'+(rows||'<p>No hay productos activos con existencias para exportar.</p>')+'</main><script>window.addEventListener("load",()=>window.print())</script></body></html>';
    const win=window.open('','_blank');if(!win){toast('Permite ventanas emergentes para exportar el catálogo.');return;}win.opener=null;win.document.open();win.document.write(doc);win.document.close();
  }
  function renderAnalytics(){
    const sales=orders.reduce((s,o)=>s+Number(o.amount||0),0),inventory=products.reduce((s,p)=>s+Number(p.unitCost||0)*Number(p.stock||0),0),potential=products.reduce((s,p)=>s+Math.max(0,costSummary(p).profit)*Number(p.stock||0),0),totalExpenses=expenses.reduce((s,e)=>s+Number(e.amountUsd||0),0),totalPurchases=purchases.reduce((s,p)=>s+Number(p.totalUsd||0),0);
    return heading(views.analytics,'')+'<div class="metric-grid">'+metric('Ventas de pedidos',money(sales),'chart',orders.length+' pedidos','total USD DEMO',false)+metric('Valor del inventario',money(inventory),'boxes',products.length+' referencias','a costo unitario',false)+metric('Margen potencial',money(potential),'spark','estimado','no es utilidad realizada',true)+metric('Gastos registrados',money(totalExpenses),'receipt',expenses.length+' movimientos','equivalente USD',false)+'</div><div class="summary-strip"><div class="summary-mini"><span>Compras USD</span><strong>'+money(totalPurchases)+'</strong></div><div class="summary-mini"><span>Pedidos sin completar</span><strong>'+orders.filter(o=>o.status!=='Completado').length+'</strong></div><div class="summary-mini"><span>Movimientos de stock</span><strong>'+inventoryMovements.length+'</strong></div></div><div class="notice-panel">'+svg('warning')+'<div><strong>Informes calculados sobre datos DEMO</strong><p>La utilidad real debe conciliar ventas cobradas, costo de venta, gastos, impuestos, devoluciones y ajustes; esta vista no constituye contabilidad oficial.</p></div></div>';
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
    return heading(views.purchases,'<button class="button button-primary" data-action="new-purchase">'+svg('plus')+' Registrar factura de proveedor</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Compras</span><strong>'+purchases.length+'</strong></div><div class="summary-mini"><span>Compras USD</span><strong>'+money(total)+'</strong></div><div class="summary-mini"><span>Pagado USD</span><strong>'+money(paid)+'</strong></div><div class="summary-mini"><span>Por pagar USD</span><strong>'+money(due)+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>FECHA</th><th>PROVEEDOR</th><th>PERFUME</th><th>UNIDADES</th><th>TOTAL</th><th>PAGADO USD</th><th>SALDO USD</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="9">No hay compras registradas.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('spark')+'<div><strong>Facturas de proveedor DEMO</strong><p>Esta sección registra la obligación y los abonos. No ajusta stock: la mercancía se incorpora al inventario mediante la recepción de una orden de compra.</p></div></div>';
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
    return heading(views.payables,'<button class="button button-quiet" data-view="purchases">Ver compras</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Saldo pendiente USD</span><strong>'+money(total)+'</strong></div><div class="summary-mini"><span>Proveedores pendientes</span><strong>'+suppliersOpen+'</strong></div><div class="summary-mini"><span>Compras con saldo</span><strong>'+open.length+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table mobile-record-actions"><thead><tr><th>COMPRA / FECHA</th><th>PROVEEDOR</th><th>PRODUCTO</th><th>TOTAL USD</th><th>ABONADO</th><th>SALDO</th><th>ESTADO</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="8">No hay cuentas pendientes con proveedores.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('warning')+'<div><strong>Cuentas por pagar DEMO</strong><p>Los saldos se calculan en USD. Cada abono conserva su moneda, tipo de cambio y cuenta de salida en el libro de caja local.</p></div></div>';
  }
  function renderExpenses(){
    const rows=expenses.map(e=>'<tr><td data-label="Fecha">'+dateText(e.createdAt)+'</td><td data-label="Categoría">'+esc(e.category)+'</td><td data-label="Descripción" class="table-primary">'+esc(e.description)+'</td><td data-label="Importe / conversión">'+moneyInCurrency(e.originalAmount,e.currency)+'<small class="table-secondary">'+money(e.amountUsd)+' · '+rateLabel(e.exchangeRate)+'</small></td></tr>').join('');
    return heading(views.expenses,'<button class="button button-primary" data-action="new-expense">'+svg('plus')+' Nuevo gasto</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Gastos</span><strong>'+expenses.length+'</strong></div><div class="summary-mini"><span>Total USD</span><strong>'+money(expenses.reduce((s,e)=>s+e.amountUsd,0))+'</strong></div><div class="summary-mini"><span>Tasa actual</span><strong>'+rateLabel(exchangeRate)+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>CATEGORÍA</th><th>DESCRIPCIÓN</th><th>IMPORTE / CONVERSIÓN</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">No hay gastos registrados.</td></tr>')+'</tbody></table></div></article>';
  }
  function renderCash(){
    const rows=cashEntries.map(e=>'<tr><td data-label="Fecha">'+dateText(e.createdAt)+'</td><td data-label="Movimiento">'+(e.direction==='income'?'<span class="status-chip status-success">Entrada</span>':'<span class="status-chip status-pending">Salida</span>')+'</td><td data-label="Concepto / cuenta" class="table-primary">'+esc(e.concept)+'<small class="table-secondary">'+esc(e.account)+'</small></td><td data-label="Importe / conversión">'+moneyInCurrency(e.originalAmount,e.currency)+'<small class="table-secondary">'+money(e.amountUsd)+' · '+rateLabel(e.exchangeRate)+'</small></td></tr>').join('');
    const income=cashEntries.filter(e=>e.direction==='income').reduce((s,e)=>s+e.amountUsd,0),out=cashEntries.filter(e=>e.direction!=='income').reduce((s,e)=>s+e.amountUsd,0);
    return heading(views.cash,'<button class="button button-primary" data-action="new-cash">'+svg('plus')+' Registrar movimiento</button>')+'<div class="summary-strip"><div class="summary-mini"><span>Entradas equivalentes USD</span><strong>'+money(income)+'</strong></div><div class="summary-mini"><span>Salidas equivalentes USD</span><strong>'+money(out)+'</strong></div><div class="summary-mini"><span>Flujo neto DEMO USD</span><strong>'+money(income-out)+'</strong></div></div><article class="list-panel"><div class="table-wrap"><table class="data-table mobile-record-table"><thead><tr><th>FECHA</th><th>MOVIMIENTO</th><th>CONCEPTO / CUENTA</th><th>IMPORTE / CONVERSIÓN</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4">No hay recibos ni pagos registrados.</td></tr>')+'</tbody></table></div></article><div class="notice-panel">'+svg('warning')+'<div><strong>Libro de caja DEMO</strong><p>No consulta bancos ni realiza transferencias. La moneda del movimiento debe coincidir con la cuenta.</p></div></div>';
  }
  function renderSettings(){
    return heading(views.settings,'')+'<article class="panel settings-rate-panel"><div class="panel-heading"><div><h2>Moneda y tipo de cambio</h2><p>Moneda base: USD. La nómina se expresa únicamente en córdobas.</p></div></div><form id="exchange-rate-form" class="rate-form"><label class="form-field"><span>Tipo de cambio · C$ por US$ 1 '+requiredMark()+'</span><input name="exchangeRate" type="number" min="0.0001" max="100000" step="0.0001" value="'+exchangeRate.toFixed(4)+'" required></label><button class="button button-primary" type="submit">Guardar tipo de cambio</button></form><p class="form-helper">Tasa actual: '+rateLabel(exchangeRate)+'. Cambiarla no altera operaciones anteriores; cada operación conserva la tasa utilizada.</p></article><div class="feature-grid">'+featureCard('settings','Preferencias del negocio','Formato de fecha, reglas de inventario y numeración interna.')+featureCard('receipt','Moneda de operaciones','Compras, gastos, cobros y pagos permiten USD o NIO; el catálogo y los informes usan USD.')+featureCard('users','Usuarios y permisos','Autenticación y permisos pendientes antes de producción.')+featureCard('boxes','Almacenamiento','R2 privado pendiente de integración para imágenes y documentos.')+featureCard('receipt','Base de datos y respaldo','Neon PostgreSQL no está conectado; los datos permanecen en este navegador.')+'</div><div class="notice-panel">'+svg('warning')+'<div><strong>Modo DEMO local</strong><p>No introducir datos reales hasta configurar autenticación, base de datos y controles de acceso.</p></div></div>';
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
      analytics: renderAnalytics,
      settings: renderSettings,
      purchaseOrders: renderPurchaseOrders,
      purchases: renderPurchases,
      profitability: renderProfitability,
      capital: renderCapital,
      payables: renderPayables,
      suppliers: renderSuppliers,
      expenses: renderExpenses,
      cash: renderCash
    };
    root.innerHTML = (renderers[state.view] || renderDashboard)();
    document.getElementById('product-count').textContent = String(products.filter(function (product) { return product.active !== false; }).length).padStart(2, '0');
  }
  function goToView(view) {
    if (!views[view]) return;
    state.view = view;
    state.query = '';
    state.filter = 'all';
    state.category = 'all';
    state.productStatus = 'active';
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
    form.reset(); form.dataset.editingId = product ? String(product.id) : '';
    const fields = ['name','brand','sku','category','concentration','gender','family','sizeMl','presentation','barcode','description','supplier','purchaseCost','additionalCost','price','wholesalePrice','stock','minStock','location','notes'];
    if (product) fields.forEach(function (field) { if (form.elements[field]) form.elements[field].value = product[field] == null ? '' : String(product[field]); });
    form.elements.stock.readOnly = true;
    form.elements.stock.value = product ? String(product.stock) : '0';
    document.getElementById('modal-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('save-product').textContent = product ? 'Guardar cambios' : 'Agregar a demo';
    document.querySelector('#product-dialog .modal-note').textContent = BACKEND_MODE
      ? (product?'Ficha de producto en Neon Development. El stock se modifica únicamente desde Existencias.':'Nuevo producto en Neon Development. El stock inicial siempre será cero; registra las existencias desde Inventario.')
      : (product?'Edición de ficha DEMO. Las existencias no se cambian aquí: registra movimientos desde Existencias.':'Ficha DEMO. Los datos se guardan localmente en este navegador y todavía no se sincronizan con Neon.');
    updateProductCostPreview();
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
  document.addEventListener('click', async function (event) {
    const viewButton = event.target.closest('[data-view], [data-view-link]');
    if (viewButton) {
      goToView(viewButton.getAttribute('data-view') || viewButton.getAttribute('data-view-link'));
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) {
      const name = action.getAttribute('data-action');
      if (name === 'new-product') openProductModal();
      else if (name === 'edit-product') openProductModal(action.getAttribute('data-id'));
      else if (name === 'preview-product') showProductDetails(action.getAttribute('data-id'));
      else if (name === 'edit-from-detail') { const productId = action.getAttribute('data-id'); detailDialog.close(); openProductModal(productId); }
      else if (name === 'toggle-product') {
        const product = products.find(function (item) { return String(item.id) === action.getAttribute('data-id'); });
        if (!product) return;
        if (product.active !== false && !window.confirm('¿Desactivar ' + product.name + '? Dejará de aparecer en el inventario activo.')) return;
        if(BACKEND_MODE){
          try{
            const result=await apiRequest('/api/catalog/products/'+encodeURIComponent(product.id),'PATCH',{active:product.active===false});
            const saved=mapDbProduct(result.product),index=products.findIndex(p=>String(p.id)===String(product.id));
            if(index>=0)products[index]=saved;renderView();toast(saved.active?'Producto reactivado en Neon.':'Producto desactivado en Neon; su historial se conserva.');
          }catch(error){toast(error?.message||'No se pudo cambiar el estado del producto.');}
          return;
        }
        const snapshot=captureDemoState();
        product.active = product.active === false;
        if(!persistDemoData()){restoreDemoState(snapshot);renderView();return;}
        renderView();
        toast(product.active ? 'Producto reactivado en el catálogo DEMO.' : 'Producto desactivado. Su historial se conserva.');
      }
      else if (name === 'delete-product') {
        const product = products.find(function (item) { return String(item.id) === action.getAttribute('data-id'); });
        if (!product) return;
        const hasStockHistory=inventoryMovements.some(function (movement) { return String(movement.productId) === String(product.id); });
        const hasOrderHistory=orders.some(function(order){return Array.isArray(order.items)&&order.items.some(function(item){return (item.productId!=null&&String(item.productId)===String(product.id))||(item.sku&&String(item.sku).toLowerCase()===String(product.sku).toLowerCase())||(item.name&&String(item.name).toLowerCase()===String(product.name).toLowerCase());});});
        const hasPurchaseHistory=purchases.some(function(purchase){return String(purchase.productId)===String(product.id);});
        if (hasStockHistory||hasOrderHistory||hasPurchaseHistory) {
          toast('No se puede eliminar: el producto tiene historial de inventario, pedidos o compras. Puedes desactivarlo y conservar su trazabilidad.'); return;
        }
        if(BACKEND_MODE){
          if(!window.confirm('¿Eliminar definitivamente este producto? Solo se permite si no tiene movimientos ni documentos vinculados.'))return;
          try{
            await apiRequest('/api/catalog/products/'+encodeURIComponent(product.id),'DELETE');
            products=products.filter(item=>String(item.id)!==String(product.id));renderView();toast('Producto eliminado de Neon Development.');
          }catch(error){toast(error?.message||'No se pudo eliminar el producto.');}
          return;
        }
        if (!window.confirm('¿Eliminar definitivamente este producto DEMO?')) return;
        const snapshot=captureDemoState();
        products = products.filter(function (item) { return String(item.id) !== String(product.id); });
        if(!persistDemoData()){restoreDemoState(snapshot);renderView();return;}
        renderView(); toast('Producto DEMO eliminado.');
      }
      else if (name === 'stock-new') openStockModal();
      else if (name === 'stock-product') openStockModal(action.getAttribute('data-id'));
      else if (name === 'export-inventory') renderInventoryCsv();
      else if (name === 'export') toast('La exportación estará disponible al conectar los datos reales.');
      else if (name === 'billing-preview') toast('El formulario de factura se diseñará después de validar los requisitos fiscales de Nicaragua.');
      else if (name === 'hr-preview') toast('El alta de personal se habilitará después de definir roles y protección de expedientes.');
      else if (name === 'preview-order') showOrderDetails(action.getAttribute('data-id'));
      else if (name === 'save-order-status') saveOrderStatus();
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
    if (event.target.closest('#modal-close') || event.target.closest('#cancel-product')) { dialog.close(); form.dataset.editingId = ''; form.elements.stock.readOnly = true; }
    if (event.target.closest('#stock-modal-close') || event.target.closest('#stock-cancel')) stockDialog.close();
    if (event.target.closest('#detail-close') || event.target.closest('#detail-cancel')) detailDialog.close();
    if (event.target.closest('#order-detail-close') || event.target.closest('#order-detail-cancel')) orderDialog.close();
    if (event.target.closest('.notification-button')) toast('No hay notificaciones reales: el sistema aún está en modo demo.');
  });
  document.addEventListener('input', function (event) {
    if (event.target && event.target.id === 'view-search') {
      state.query = event.target.value;
      const body = document.getElementById('product-table-body');
      if (body) body.innerHTML = productTable(filteredProducts());
    }
  });
  document.addEventListener('change', function (event) {
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
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMobileMenu();
  });
  form.addEventListener('submit', async function (event) {
    event.preventDefault(); if (!form.reportValidity()) return;
    const data = new FormData(form), value = function (key) { return String(data.get(key) || '').trim(); }, number = function (key) { return Number(data.get(key) || 0); };
    const editingId = form.dataset.editingId, existing = editingId ? products.find(function (product) { return String(product.id) === editingId; }) : null;
    const name = value('name'), price = number('price'), stock = number('stock'), minStock = number('minStock');
    const purchaseCost = number('purchaseCost'), additionalCost = number('additionalCost'), sku = value('sku') || (existing ? existing.sku : makeSku());
    const unitCost = purchaseCost + additionalCost, profit = price - unitCost, margin = price > 0 ? (profit / price) * 100 : 0;
    const invalidNumbers = [price,minStock,purchaseCost,additionalCost].some(function (n) { return !Number.isFinite(n) || n < 0; });
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(minStock) || invalidNumbers || (!existing && (!Number.isInteger(stock) || stock < 0))) {
      toast('Revisa el nombre, el precio, los costos y el stock mínimo.'); return;
    }
    if (products.some(function (product) { return String(product.sku).toLowerCase() === sku.toLowerCase() && (!existing || String(product.id) !== String(existing.id)); })) {
      toast('Ese SKU ya existe. Utiliza un código diferente.'); form.elements.sku.focus(); return;
    }
    const wholesalePrice=number('wholesalePrice');
    if(!Number.isFinite(wholesalePrice)||wholesalePrice<0){toast('El precio mayorista debe ser cero o mayor.');return;}
    const fields = {name:name,brand:value('brand'),sku:sku,category:value('category') || 'Perfumería',concentration:value('concentration'),gender:value('gender'),family:value('family'),sizeMl:number('sizeMl') || null,presentation:value('presentation'),barcode:value('barcode'),description:value('description'),supplier:value('supplier'),purchaseCost:purchaseCost,additionalCost:additionalCost,unitCost:unitCost,price:price,wholesalePrice:wholesalePrice||null,profit:profit,margin:margin,minStock:minStock,location:value('location'),notes:value('notes')};
    if(BACKEND_MODE){
      const payload={sku:fields.sku,name:fields.name,brand:fields.brand,category:fields.category,concentration:fields.concentration,
        gender:fields.gender,family:fields.family,sizeMl:fields.sizeMl,presentation:fields.presentation,barcode:fields.barcode,
        description:fields.description,supplier:fields.supplier,purchaseCost:fields.purchaseCost,additionalCost:fields.additionalCost,
        price:fields.price,wholesalePrice:fields.wholesalePrice,minStock:fields.minStock,location:fields.location,
        tone:existing?existing.tone:'art-violet',notes:fields.notes};
      try{
        const response=existing
          ?await apiRequest('/api/catalog/products/'+encodeURIComponent(existing.id),'PATCH',payload)
          :await apiRequest('/api/catalog/products','POST',payload);
        const saved=mapDbProduct(response.product);
        if(existing){const index=products.findIndex(p=>String(p.id)===String(existing.id));if(index>=0)products[index]=saved;}
        else products.unshift(saved);
        form.reset();form.dataset.editingId='';form.elements.stock.readOnly=true;form.elements.stock.value='0';
        updateProductCostPreview();dialog.close();renderView();
        toast(existing?'Producto actualizado en Neon Development.':'Producto guardado en Neon Development con stock inicial cero.');
      }catch(error){toast(error?.message||'No se pudo guardar el producto en Neon.');}
      return;
    }
    const snapshot=captureDemoState();
    if (existing) {
      Object.assign(existing,fields); if(!persistDemoData()){restoreDemoState(snapshot);return;} form.reset(); form.dataset.editingId=''; form.elements.stock.readOnly=true;
      updateProductCostPreview(); dialog.close(); renderView(); toast('Ficha de producto actualizada y guardada localmente en modo DEMO.');
    } else {
      products.unshift(Object.assign({id:Date.now(),stock:stock,active:true,tone:'art-violet'},fields)); if(!persistDemoData()){restoreDemoState(snapshot);return;}
      form.reset(); form.dataset.editingId=''; form.elements.stock.readOnly=false; updateProductCostPreview();
      dialog.close(); goToView('products'); toast('Producto guardado en DEMO local; no se ha guardado en Neon.');
    }
  });
  function makeSku() {
    let index=1;
    while (products.some(function (product) { return String(product.sku).toLowerCase() === ('jbp-' + String(index).padStart(3,'0')).toLowerCase(); })) index+=1;
    return 'JBP-' + String(index).padStart(3,'0');
  }
  stockForm.addEventListener('submit', async function (event) {
    event.preventDefault(); if (!stockForm.reportValidity()) return;
    const data=new FormData(stockForm), product=products.find(function (item) { return String(item.id)===String(data.get('productId')); });
    const type=String(data.get('type')||''), quantity=Number(data.get('quantity')), note=String(data.get('note')||'').trim();
    if (!product || product.active===false || !Number.isInteger(quantity) || quantity<0 || (type!=='adjustment' && quantity===0)) {
      toast('Selecciona un producto activo y una cantidad válida.'); return;
    }
    const previousStock=product.stock; let delta=0,label='';
    if(type==='entry'){delta=quantity;label='Entrada';} else if(type==='exit'){delta=-quantity;label='Salida';} else if(type==='adjustment'){delta=quantity-previousStock;label='Ajuste';} else {toast('Tipo de movimiento no reconocido.');return;}
    const newStock=previousStock+delta;
    if(newStock<0){toast('Stock insuficiente. La salida no puede dejar existencias negativas.');return;}
    if(delta===0){toast('El ajuste coincide con el stock actual; no se registró ningún movimiento.');return;}
    if(BACKEND_MODE){
      try{
        const result=await apiRequest('/api/inventory/movements','POST',{productId:product.id,type,quantity,note});
        const movement=mapDbMovement(result.movement);product.stock=movement.newStock;inventoryMovements.unshift(movement);
        stockForm.reset();stockDialog.close();renderView();
        toast(label+' registrada en Neon: '+product.name+' · '+(movement.delta>0?'+':'')+movement.delta+' unidades.');
      }catch(error){toast(error?.message||'No se pudo registrar el movimiento.');}
      return;
    }
    const snapshot=captureDemoState();
    product.stock=newStock;
    inventoryMovements.unshift({id:Date.now(),productId:product.id,productName:product.name,sku:product.sku,type:label,quantity:Math.abs(delta),delta:delta,previousStock:previousStock,newStock:newStock,note:note,createdAt:new Date().toISOString()});
    if(!persistDemoData()){restoreDemoState(snapshot);return;}
    stockForm.reset(); stockDialog.close(); renderView();
    toast(label+' registrada: '+product.name+' · '+(delta>0?'+':'')+delta+' unidades.');
  });
  stockForm.elements.type.addEventListener('change',updateStockQuantityMode);
  businessForm.addEventListener('change',function(event){
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
    const name=action.getAttribute('data-action'),types={'new-customer':'customer','new-supplier':'supplier','new-order':'order','new-purchase':'purchase','new-purchase-order':'purchase-order','new-expense':'expense','new-cash':'cash','new-invoice':'invoice','new-employee':'employee'};
    if(types[name])openBusinessDialog(types[name]);
    else if(name==='receive-po')openBusinessDialog('purchase-receipt',action.getAttribute('data-id'));
    else if(name==='add-po-line')document.getElementById('po-line-list')?.insertAdjacentHTML('beforeend',purchaseOrderLineMarkup());
    else if(name==='remove-po-line'){const row=action.closest('.po-line-row');if(row&&document.querySelectorAll('#po-line-list .po-line-row').length>1)row.remove();}
    else if(name==='send-po'||name==='confirm-po'){
      const order=purchaseOrders.find(item=>String(item.id)===action.getAttribute('data-id'));if(!order)return;
      order.status=name==='send-po'?'Enviada':'Confirmada';order.updatedAt=new Date().toISOString();
      if(!persistDemoData())return;renderView();toast('Orden '+order.number+': '+order.status+'.');
    }else if(name==='cancel-po'){
      const order=purchaseOrders.find(item=>String(item.id)===action.getAttribute('data-id'));if(!order)return;
      if(purchaseOrderReceived(order)>0){toast('Una orden con recepción parcial no se cancela; cierra el faltante para conservar la trazabilidad.');return;}
      if(!window.confirm('¿Cancelar la orden '+order.number+'?'))return;
      order.status='Cancelada';order.updatedAt=new Date().toISOString();persistDemoData();renderView();toast('Orden cancelada; el historial se conserva.');
    }else if(name==='close-po-short'){
      const order=purchaseOrders.find(item=>String(item.id)===action.getAttribute('data-id'));if(!order)return;
      const reason=window.prompt('Indica por qué se cerrará el faltante de la orden '+order.number+':');
      if(!reason||!reason.trim())return;
      order.status='Cerrada con faltante';order.closeReason=reason.trim();order.updatedAt=new Date().toISOString();persistDemoData();renderView();toast('Faltante cerrado con motivo registrado.');
    }else if(name==='print-po')printPurchaseOrder(action.getAttribute('data-id'));
    else if(name==='share-po'){
      const order=purchaseOrders.find(item=>String(item.id)===action.getAttribute('data-id'));if(!order)return;
      const message='Hola, te comparto la orden de compra '+order.number+' de JB PARFUMS por '+money(order.totalUsd)+'. El documento PDF se adjunta manualmente desde el dispositivo.';
      const phone=String(order.supplierPhone||'').replace(/\D/g,'');
      window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank');
    }
    else if(name==='export-product-catalog')exportProductCatalogPdf();
    else if(name==='new-payment')openBusinessDialog('payment',action.getAttribute('data-id'));
    else if(name==='new-purchase-payment')openBusinessDialog('purchase-payment',action.getAttribute('data-id'));
    else if(name==='add-invoice-product'){
      if(businessForm.dataset.recordType!=='invoice')return;
      const hidden=businessForm.querySelector('[name="draftProductId"]'),product=products.find(p=>String(p.id)===String(hidden?.value||''));
      if(!product){toast('Busca y selecciona un perfume antes de agregarlo.');return;}
      const existing=invoiceDraftItems.find(item=>String(item.productId)===String(product.id));
      if(existing)existing.quantity=Number(existing.quantity||0)+1;
      else invoiceDraftItems.push({productId:product.id,name:product.name,sku:product.sku||'',barcode:product.barcode||'',quantity:1,unitPriceUsd:invoiceSuggestedPrice(product),unitCostUsd:Number(product.unitCost||0)});
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
    if(!event.target||event.target.id!=='exchange-rate-form')return;
    event.preventDefault();const next=Number(new FormData(event.target).get('exchangeRate'));
    if(!Number.isFinite(next)||next<=0||next>100000){toast('Introduce un tipo de cambio válido.');return;}
    const previousRate=exchangeRate;exchangeRate=Number(next.toFixed(4));if(!persistDemoData()){exchangeRate=previousRate;return;}renderView();toast('Tipo de cambio actualizado. Las operaciones anteriores conservan su tasa.');
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
  renderView();
  if(BACKEND_MODE)loadERPBootstrap();
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}());
