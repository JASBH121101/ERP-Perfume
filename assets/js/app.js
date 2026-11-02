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

  let products = [
    { id: 1, name: 'Club de Nuit Intense Man', brand: 'Armaf', sku: 'JBP-001', category: 'Diseñador', concentration: 'Eau de Parfum (EDP)', gender: 'Masculino', family: 'Amaderada', sizeMl: 105, presentation: 'Caja original', supplier: 'Proveedor de muestra A', purchaseCost: 1450, additionalCost: 100, unitCost: 1550, price: 2450, profit: 900, margin: 36.7, stock: 14, minStock: 4, location: 'A-01', tone: 'art-night', active: true },
    { id: 2, name: 'Yara Lattafa', brand: 'Lattafa', sku: 'JBP-002', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Floral', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: 1050, additionalCost: 100, unitCost: 1150, price: 1850, profit: 700, margin: 37.8, stock: 8, minStock: 3, location: 'A-02', tone: 'art-rose', active: true },
    { id: 3, name: 'Khamrah Lattafa', brand: 'Lattafa', sku: 'JBP-003', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Unisex', family: 'Gourmand / Dulce', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: 1350, additionalCost: 100, unitCost: 1450, price: 2200, profit: 750, margin: 34.1, stock: 3, minStock: 5, location: 'A-03', tone: 'art-olive', active: true },
    { id: 4, name: 'Badee Al Oud Amethyst', brand: 'Lattafa', sku: 'JBP-004', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Floral', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: 1250, additionalCost: 100, unitCost: 1350, price: 2100, profit: 750, margin: 35.7, stock: 0, minStock: 3, location: 'A-04', tone: 'art-violet', active: true },
    { id: 5, name: '9PM Afnan', brand: 'Afnan', sku: 'JBP-005', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Masculino', family: 'Ámbar / Oriental', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: 1200, additionalCost: 100, unitCost: 1300, price: 1950, profit: 650, margin: 33.3, stock: 11, minStock: 3, location: 'A-05', tone: 'art-night', active: true },
    { id: 6, name: 'Good Girl Carolina Herrera', brand: 'Carolina Herrera', sku: 'JBP-006', category: 'Diseñador', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Ámbar / Oriental', sizeMl: 80, presentation: 'Caja original', supplier: 'Proveedor de muestra A', purchaseCost: 1950, additionalCost: 100, unitCost: 2050, price: 3100, profit: 1050, margin: 33.9, stock: 5, minStock: 4, location: 'B-01', tone: 'art-night', active: true },
    { id: 7, name: 'Ana Abiyedh Rouge', brand: 'Lattafa', sku: 'JBP-007', category: 'Unisex', concentration: 'Eau de Parfum (EDP)', gender: 'Unisex', family: 'Ambar / Oriental', sizeMl: 60, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: 1000, additionalCost: 100, unitCost: 1100, price: 1750, profit: 650, margin: 37.1, stock: 2, minStock: 4, location: 'B-02', tone: 'art-rose', active: true },
    { id: 8, name: 'Eclaire Lattafa', brand: 'Lattafa', sku: 'JBP-008', category: 'Árabes', concentration: 'Eau de Parfum (EDP)', gender: 'Femenino', family: 'Gourmand / Dulce', sizeMl: 100, presentation: 'Caja original', supplier: 'Proveedor de muestra B', purchaseCost: 1250, additionalCost: 100, unitCost: 1350, price: 2050, profit: 700, margin: 34.1, stock: 9, minStock: 3, location: 'B-03', tone: 'art-olive', active: true }
  ];
  let orders = [
    { id: 'JP-1048', customer: 'María Gutiérrez', phone: '+505 8888 1204', date: '02 nov 2026', amount: 4050, status: 'Completado', paymentMethod: 'Transferencia', paymentStatus: 'Pagado', deliveryMode: 'Entrega coordinada', discount: 0, deliveryFee: 150, items: [{ name: 'Yara Lattafa', sku: 'JBP-002', quantity: 1, unitPrice: 1850 }, { name: 'Eclaire Lattafa', sku: 'JBP-008', quantity: 1, unitPrice: 2050 }] },
    { id: 'JP-1047', customer: 'Carlos Mendoza', phone: '+505 8777 2310', date: '02 nov 2026', amount: 2200, status: 'Pendiente', paymentMethod: 'Efectivo contra entrega', paymentStatus: 'Pendiente', deliveryMode: 'Retiro en tienda', discount: 0, deliveryFee: 0, items: [{ name: 'Khamrah Lattafa', sku: 'JBP-003', quantity: 1, unitPrice: 2200 }] },
    { id: 'JP-1046', customer: 'Andrea López', phone: '+505 8666 3421', date: '01 nov 2026', amount: 1850, status: 'Completado', paymentMethod: 'Transferencia', paymentStatus: 'Pagado', deliveryMode: 'Retiro en tienda', discount: 0, deliveryFee: 0, items: [{ name: 'Yara Lattafa', sku: 'JBP-002', quantity: 1, unitPrice: 1850 }] },
    { id: 'JP-1045', customer: 'Daniela Ruiz', phone: '+505 8555 4532', date: '01 nov 2026', amount: 3100, status: 'En preparación', paymentMethod: 'Tarjeta', paymentStatus: 'Pagado', deliveryMode: 'Entrega coordinada', discount: 0, deliveryFee: 0, items: [{ name: 'Good Girl Carolina Herrera', sku: 'JBP-006', quantity: 1, unitPrice: 3100 }] },
    { id: 'JP-1044', customer: 'Luis Salazar', phone: 'No registrado', date: '31 oct 2026', amount: 1950, status: 'Completado', paymentMethod: 'Efectivo', paymentStatus: 'Pagado', deliveryMode: 'Retiro en tienda', discount: 0, deliveryFee: 0, items: [{ name: '9PM Afnan', sku: 'JBP-005', quantity: 1, unitPrice: 1950 }] }
  ];
  const customers = [
    { name: 'María Gutiérrez', contact: '+505 8888 1204', orders: 8, spent: 12450, since: 'Ago 2026' },
    { name: 'Carlos Mendoza', contact: '+505 8777 2310', orders: 5, spent: 8950, since: 'Sep 2026' },
    { name: 'Andrea López', contact: '+505 8666 3421', orders: 4, spent: 7300, since: 'Sep 2026' },
    { name: 'Daniela Ruiz', contact: '+505 8555 4532', orders: 3, spent: 6100, since: 'Oct 2026' }
  ];
  const views = {
    dashboard: { title: 'Resumen', eyebrow: 'CENTRO DE CONTROL', heading: 'Buenos días', subtitle: 'Una mirada clara al movimiento de tu negocio.' },
    products: { title: 'Productos', eyebrow: 'CATÁLOGO', heading: 'Catálogo de productos', subtitle: 'Administra las fragancias, sus precios y la disponibilidad.' },
    inventory: { title: 'Inventario', eyebrow: 'CONTROL DE EXISTENCIAS', heading: 'Inventario', subtitle: 'Consulta los niveles de stock y detecta reposiciones.' },
    orders: { title: 'Pedidos', eyebrow: 'OPERACIONES', heading: 'Pedidos y ventas', subtitle: 'Da seguimiento al estado de cada pedido.' },
    customers: { title: 'Clientes', eyebrow: 'RELACIONES', heading: 'Cartera de clientes', subtitle: 'Mantén organizada la información comercial.' },
    billing: { title: 'Facturación', eyebrow: 'DOCUMENTOS COMERCIALES', heading: 'Facturación', subtitle: 'Consulta comprobantes, borradores y cuentas por cobrar.' },
    hr: { title: 'RRHH', eyebrow: 'GESTIÓN DEL PERSONAL', heading: 'Recursos Humanos', subtitle: 'Organiza personal, asistencia, permisos y nómina.' },
    analytics: { title: 'Informes', eyebrow: 'RENDIMIENTO', heading: 'Informes y análisis', subtitle: 'Indicadores preparados para tomar decisiones.' },
    settings: { title: 'Configuración', eyebrow: 'SISTEMA', heading: 'Configuración', subtitle: 'Preferencias y conexiones de JB PARFUMS ERP.' }
  };
  const state = { view: 'dashboard', query: '', filter: 'all', category: 'all', productStatus: 'active' };
  const root = document.getElementById('view-root');
  const globalSearch = document.getElementById('global-search');
  const dialog = document.getElementById('product-dialog');
  const form = document.getElementById('product-form');
  const stockDialog = document.getElementById('stock-dialog');
  const stockForm = document.getElementById('stock-form');
  const detailDialog = document.getElementById('product-detail-dialog');
  const orderDialog = document.getElementById('order-detail-dialog');
  const DEMO_STORAGE_KEY = 'jbparfums-demo-data-v1';
  let inventoryMovements = [];
  function persistDemoData() {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, products: products, inventoryMovements: inventoryMovements, orders: orders }));
      return true;
    } catch (error) {
      toast('No se pudo guardar en este navegador. Los cambios solo durarán hasta cerrar la sesión.');
      return false;
    }
  }
  function loadDemoData() {
    try {
      const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (!stored) {
        products.forEach(function (product) { product.active = true; });
        persistDemoData();
        return;
      }
      const parsed = JSON.parse(stored);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.products) || !Array.isArray(parsed.inventoryMovements)) {
        products.forEach(function (product) { product.active = true; });
        persistDemoData();
        return;
      }
      products = parsed.products.filter(function (product) {
        return product && Number.isFinite(Number(product.id)) && String(product.name || '').trim();
      }).map(function (product) {
        product.active = product.active !== false;
        product.stock = Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : 0;
        product.minStock = Number.isInteger(product.minStock) && product.minStock >= 0 ? product.minStock : 3;
        return product;
      });
      inventoryMovements = parsed.inventoryMovements.filter(function (movement) {
        return movement && Number.isFinite(Number(movement.id)) && Number.isFinite(Number(movement.productId));
      });
      if (Array.isArray(parsed.orders)) {
        const allowedStatuses = ['Pendiente', 'En preparación', 'Listo para entrega', 'En tránsito', 'Completado'];
        orders = parsed.orders.filter(function (order) {
          return order && /^JP-\d+$/.test(String(order.id || '')) && String(order.customer || '').trim() && Array.isArray(order.items);
        }).map(function (order) {
          order.status = allowedStatuses.includes(order.status) ? order.status : 'Pendiente';
          order.items = order.items.filter(function (item) {
            return item && String(item.name || '').trim() && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(Number(item.unitPrice)) && Number(item.unitPrice) >= 0;
          });
          return order;
        });
      }
    } catch (error) {
      products.forEach(function (product) { product.active = true; });
      inventoryMovements = [];
    }
  }
  loadDemoData();

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function money(value) {
    return 'C$ ' + Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function isLowStock(product) {
    const minimum = Number.isInteger(product.minStock) ? product.minStock : 3;
    return product.stock > 0 && product.stock <= minimum;
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
    return '<div class="page-heading"><div><h1>' + meta.heading + (state.view === 'dashboard' ? ', administrador' : '') + '</h1><p>' + meta.subtitle + '</p></div><div class="heading-actions">' + (actions || '') + '</div></div>';
  }
  function metric(label, value, symbol, change, note, gold) {
    return '<article class="metric-card"><div class="metric-top"><span class="metric-label">' + label + '</span><span class="metric-symbol">' + svg(symbol) + '</span></div><div class="metric-value">' + value + '</div><div class="metric-foot"><span class="metric-change' + (gold ? ' gold' : '') + '">' + change + '</span><span class="metric-caption">' + note + '</span></div></article>';
  }
  function renderDashboard() {
    const activeProducts = products.filter(function (product) { return product.active !== false; });
    const top = activeProducts.slice().sort(function (a, b) { return b.stock - a.stock; }).slice(0, 4);
    const productRows = orders.slice(0, 4).map(function (order) {
      return '<tr><td class="table-primary">' + esc(order.id) + '</td><td>' + esc(order.customer) + '</td><td>' + esc(order.date) + '</td><td class="table-primary">' + money(order.amount) + '</td><td>' + orderStatus(order.status) + '</td></tr>';
    }).join('');
    const topRows = top.map(function (product) {
      return '<div class="top-product">' + art(product.tone) + '<div class="top-product-info"><strong>' + esc(product.name) + '</strong><small>' + esc(product.category) + ' · ' + product.stock + ' unidades</small></div><span class="top-product-value">' + money(product.price) + '</span></div>';
    }).join('');
    const low = activeProducts.filter(needsRestock).length;
    return heading(views.dashboard, '<select class="period-select" aria-label="Periodo"><option>Últimos 7 días</option><option>Últimos 30 días</option><option>Este año</option></select><button class="button button-primary" data-action="new-product">' + svg('plus') + ' Nuevo producto</button>') +
      '<section class="metric-grid">' +
      metric('Ventas del mes', 'C$ 28,450', 'chart', '+12.8%', 'vs. mes anterior', false) +
      metric('Pedidos recibidos', '18', 'bag', '+4.2%', 'vs. mes anterior', false) +
      metric('Productos activos', String(activeProducts.length).padStart(2, '0'), 'bottle', 'Catálogo', 'productos DEMO activos', true) +
      metric('Alertas de stock', String(low).padStart(2, '0'), 'warning', 'Revisar', 'productos bajo su stock mínimo', true) +
      '</section>' +
      '<section class="dashboard-grid">' +
      '<article class="panel"><div class="panel-heading"><div><h2>Rendimiento de ventas</h2><p>Comportamiento comercial de los últimos días</p></div><button class="panel-link" data-view="analytics">Ver informe ' + svg('arrow') + '</button></div><div class="chart-summary"><strong>C$ 28,450</strong><span>ventas de muestra</span></div>' +
      '<div class="chart-wrap"><svg viewBox="0 0 620 180" role="img" aria-label="Gráfico ilustrativo de ventas semanales"><defs><linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#c4a16b" stop-opacity=".26"/><stop offset="100%" stop-color="#c4a16b" stop-opacity="0"/></linearGradient></defs><path class="chart-gridline" d="M42 25H608M42 65H608M42 105H608M42 145H608"/><path class="chart-area" d="M42 129 C78 118 94 82 130 91 S188 115 222 77 S280 95 314 58 S374 77 408 53 S468 69 502 39 S566 57 608 22 V145 H42Z"/><path class="chart-line" d="M42 129 C78 118 94 82 130 91 S188 115 222 77 S280 95 314 58 S374 77 408 53 S468 69 502 39 S566 57 608 22"/><circle class="chart-point" cx="130" cy="91" r="4"/><circle class="chart-point" cx="222" cy="77" r="4"/><circle class="chart-point" cx="314" cy="58" r="4"/><circle class="chart-point" cx="408" cy="53" r="4"/><circle class="chart-point" cx="502" cy="39" r="4"/><text class="chart-label" x="42" y="166">Lun</text><text class="chart-label" x="135" y="166">Mar</text><text class="chart-label" x="228" y="166">Mié</text><text class="chart-label" x="321" y="166">Jue</text><text class="chart-label" x="414" y="166">Vie</text><text class="chart-label" x="507" y="166">Sáb</text><text class="chart-label" x="592" y="166">Dom</text></svg></div><div class="chart-note"><i></i> Datos ilustrativos · Se conectará al módulo de ventas</div></article>' +
      '<article class="panel"><div class="panel-heading"><div><h2>Productos destacados</h2><p>Selección de catálogo de ejemplo</p></div><button class="panel-link" data-view="products">Catálogo ' + svg('arrow') + '</button></div><div class="top-products">' + topRows + '</div><div class="panel-footer-note">Precios y existencias de demostración.</div></article>' +
      '</section>' +
      '<section class="lower-grid"><article class="panel"><div class="panel-heading"><div><h2>Pedidos recientes</h2><p>Actividad de ejemplo del negocio</p></div><button class="panel-link" data-view="orders">Ver todos ' + svg('arrow') + '</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ESTADO</th></tr></thead><tbody>' + productRows + '</tbody></table></div></article>' +
      '<article class="panel"><div class="panel-heading"><div><h2>Estado del inventario</h2><p>Distribución de stock de muestra</p></div></div><div class="stock-summary">' +
      stockBar('Disponible', products.filter(function (p) { return p.stock > 3; }).length, products.length, '') +
      stockBar('Stock bajo', products.filter(function (p) { return p.stock > 0 && p.stock <= 3; }).length, products.length, 'low') +
      stockBar('Agotado', products.filter(function (p) { return p.stock === 0; }).length, products.length, 'out') +
      '</div><div class="panel-footer-note">Las alertas reales se activarán al conectar inventario.</div></article></section>';
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
      return '<tr class="' + (inactive ? 'row-inactive' : '') + '"><td><div class="product-cell">' + art(product.tone) + '<span><span class="table-primary">' + esc(product.name) + '</span><small class="table-secondary">' + productMeta(product) + '</small></span></div></td><td>' + esc(product.category) + '</td><td class="table-primary">' + money(product.price) + '<small class="table-secondary">Costo ' + money(costs.unitCost) + ' · Margen ' + costs.margin.toFixed(1) + '%</small></td><td>' + product.stock + ' uds. <small class="table-secondary">Mín. ' + product.minStock + '</small></td><td>' + productStatus + '</td><td><div class="table-actions">' + actions + '</div></td></tr>';
    }).join('');
  }
  function renderProducts() {
    const activeCount = products.filter(function (product) { return product.active !== false; }).length;
    const inactiveCount = products.length - activeCount;
    const categories = ['Perfumería', 'Árabes', 'Diseñador', 'Nicho', 'Unisex', 'Body Mist', 'Sets / Combos', 'Accesorios'];
    const categoryOptions = categories.map(function (category) {
      return '<option value="' + esc(category) + '"' + (state.category === category ? ' selected' : '') + '>' + esc(category) + '</option>';
    }).join('');
    return heading(views.products, '<button class="button button-primary" data-action="new-product">' + svg('plus') + ' Nuevo producto</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Productos activos</span><strong>' + activeCount + '</strong></div><div class="summary-mini"><span>Desactivados</span><strong>' + inactiveCount + '</strong></div><div class="summary-mini"><span>Requieren reposición</span><strong>' + products.filter(function (product) { return product.active !== false && needsRestock(product); }).length + '</strong></div></div>' +
      '<div class="toolbar"><div class="toolbar-left"><label class="inline-search">' + svg('search') + '<input id="view-search" type="search" value="' + esc(state.query) + '" aria-label="Buscar productos"></label></div><div class="toolbar-right"><select class="filter-select" id="product-status-filter" aria-label="Estado del producto"><option value="active"' + (state.productStatus === 'active' ? ' selected' : '') + '>Activos</option><option value="inactive"' + (state.productStatus === 'inactive' ? ' selected' : '') + '>Desactivados</option><option value="all"' + (state.productStatus === 'all' ? ' selected' : '') + '>Todos</option></select><select class="filter-select" id="category-filter" aria-label="Filtrar por categoría"><option value="all"' + (state.category === 'all' ? ' selected' : '') + '>Todas las categorías</option>' + categoryOptions + '</select><select class="filter-select" id="stock-filter" aria-label="Filtrar por stock"><option value="all"' + (state.filter === 'all' ? ' selected' : '') + '>Todos los estados</option><option value="available"' + (state.filter === 'available' ? ' selected' : '') + '>Disponibles</option><option value="low"' + (state.filter === 'low' ? ' selected' : '') + '>Stock bajo</option><option value="out"' + (state.filter === 'out' ? ' selected' : '') + '>Agotados</option></select></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>PRECIO / COSTO</th><th>EXISTENCIAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody id="product-table-body">' + productTable(filteredProducts()) + '</tbody></table></div></article>' +
      '<div class="notice-panel"><span>' + svg('spark') + '</span><div><strong>Catálogo de demostración con guardado local</strong><p>Los productos se guardan en este navegador y permanecen después de recargar. Todavía no se sincronizan con Neon ni contienen datos reales del negocio. El stock se modifica únicamente desde Existencias.</p></div></div>';
  }
  function renderInventory() {
    const activeProducts = products.filter(function (product) { return product.active !== false; });
    const rows = activeProducts.slice().sort(function (a, b) { return a.stock - b.stock; }).map(function (product) {
      const suggestion = product.stock === 0 ? 'Reposición urgente' : (needsRestock(product) ? 'Revisar reposición' : 'Nivel estable');
      return '<tr><td><div class="product-cell">' + art(product.tone) + '<span><span class="table-primary">' + esc(product.name) + '</span><small class="table-secondary">' + esc(product.sku) + ' · Mín. ' + product.minStock + '</small></span></div></td><td>' + esc(product.category) + '</td><td class="table-primary">' + product.stock + ' unidades</td><td>' + status(product.stock, product.minStock) + '</td><td><span class="table-secondary">' + suggestion + '</span></td><td><button class="button button-quiet button-small" type="button" data-action="stock-product" data-id="' + product.id + '">Movimiento</button></td></tr>';
    }).join('');
    const movementRows = inventoryMovements.slice(0, 10).map(function (movement) {
      const date = new Date(movement.createdAt);
      const dateLabel = Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
      const deltaLabel = movement.delta > 0 ? '+' + movement.delta : String(movement.delta);
      return '<tr><td>' + esc(dateLabel) + '</td><td><span class="table-primary">' + esc(movement.productName) + '</span><small class="table-secondary">' + esc(movement.sku || '') + '</small></td><td>' + esc(movement.type) + '</td><td class="table-primary">' + deltaLabel + ' uds.</td><td>' + movement.previousStock + ' → ' + movement.newStock + '</td><td>' + esc(movement.note || '—') + '</td></tr>';
    }).join('');
    return heading(views.inventory, '<div class="heading-actions-inline"><button class="button button-quiet" data-action="export-inventory">' + svg('download') + ' Exportar CSV</button><button class="button button-primary" data-action="stock-new">' + svg('plus') + ' Registrar movimiento</button></div>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Referencias activas</span><strong>' + activeProducts.length + '</strong></div><div class="summary-mini"><span>Unidades en stock</span><strong>' + activeProducts.reduce(function (sum, product) { return sum + product.stock; }, 0) + '</strong></div><div class="summary-mini"><span>Para reponer</span><strong>' + activeProducts.filter(needsRestock).length + '</strong></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK</th><th>ESTADO</th><th>ACCIÓN SUGERIDA</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6"><div class="empty-state">No hay productos activos.</div></td></tr>') + '</tbody></table></div></article>' +
      '<article class="list-panel ledger-panel"><div class="panel-heading"><div><h2>Historial de movimientos</h2><p>Entradas, salidas y ajustes registrados en esta demostración</p></div><span class="ledger-count">' + inventoryMovements.length + ' movimientos</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>FECHA</th><th>PRODUCTO</th><th>TIPO</th><th>VARIACIÓN</th><th>STOCK RESULTANTE</th><th>NOTA</th></tr></thead><tbody>' + (movementRows || '<tr><td colspan="6"><div class="empty-state">Todavía no hay movimientos registrados.</div></td></tr>') + '</tbody></table></div></article>' +
      '<div class="notice-panel"><span>' + svg('warning') + '</span><div><strong>Stock mínimo configurable por producto · Kardex DEMO</strong><p>El sistema valida que las salidas no dejen existencias negativas. Cada movimiento conserva stock anterior, variación y stock resultante. Estos datos se guardan solo en este navegador; no se han enviado a Neon ni a R2.</p></div></div>';
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
      '<p class="order-demo-warning">Los datos de este pedido son ficticios y se guardan solo en este navegador. No generan factura ni movimiento de inventario.</p>';
    const statusSelect = document.getElementById('order-status-select');
    statusSelect.value = order.status;
    document.getElementById('save-order-status').setAttribute('data-id', String(order.id));
    if (typeof orderDialog.showModal === 'function') orderDialog.showModal();
    else toast('El detalle de pedidos no es compatible con este navegador.');
  }
  function saveOrderStatus() {
    const button = document.getElementById('save-order-status');
    const order = orders.find(function (item) { return String(item.id) === button.getAttribute('data-id'); });
    const nextStatus = document.getElementById('order-status-select').value;
    const allowedStatuses = ['Pendiente', 'En preparación', 'Listo para entrega', 'En tránsito', 'Completado'];
    if (!order || !allowedStatuses.includes(nextStatus)) { toast('No se pudo validar el estado seleccionado.'); return; }
    if (order.status === nextStatus) { toast('El pedido ya tiene ese estado.'); return; }
    const previousStatus = order.status;
    order.status = nextStatus;
    if (!persistDemoData()) {
      order.status = previousStatus;
      return;
    }
    orderDialog.close();
    renderView();
    toast('Estado del pedido actualizado en DEMO local.');
  }
  function renderOrders() {
    const rows = orders.map(function (o) {
      return '<tr><td class="table-primary">' + esc(o.id) + '</td><td>' + esc(o.customer) + '</td><td>' + esc(o.date) + '</td><td class="table-primary">' + money(o.amount) + '</td><td>' + orderStatus(o.status) + '</td><td><button class="table-action" data-action="preview-order" data-id="' + esc(o.id) + '" aria-label="Ver pedido ' + esc(o.id) + '">' + svg('eye') + '</button></td></tr>';
    }).join('');
    return heading(views.orders, '<button class="button button-primary" data-action="export">' + svg('download') + ' Exportar</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Pedidos de muestra</span><strong>' + orders.length + '</strong></div><div class="summary-mini"><span>Pendientes</span><strong>' + orders.filter(function (o) { return o.status !== 'Completado'; }).length + '</strong></div><div class="summary-mini"><span>Venta registrada</span><strong>' + money(orders.reduce(function (sum, o) { return sum + o.amount; }, 0)) + '</strong></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>REFERENCIA</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ESTADO</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></article>' +
      '<div class="notice-panel">' + svg('spark') + '<div><strong>Flujo de pedidos pendiente de conexión</strong><p>En una siguiente etapa definiremos estados, abonos, pagos, entregas y trazabilidad de cada movimiento.</p></div></div>';
  }
  function renderCustomers() {
    const rows = customers.map(function (c) {
      return '<tr><td class="table-primary">' + esc(c.name) + '<small class="table-secondary">' + esc(c.contact) + '</small></td><td>' + c.orders + '</td><td class="table-primary">' + money(c.spent) + '</td><td>' + esc(c.since) + '</td><td><span class="status-chip status-success">Activo</span></td></tr>';
    }).join('');
    return heading(views.customers, '<button class="button button-quiet" data-action="export">' + svg('download') + ' Exportar</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Clientes de muestra</span><strong>' + customers.length + '</strong></div><div class="summary-mini"><span>Compras acumuladas</span><strong>' + customers.reduce(function (sum, c) { return sum + c.orders; }, 0) + '</strong></div><div class="summary-mini"><span>Valor de cartera</span><strong>' + money(customers.reduce(function (sum, c) { return sum + c.spent; }, 0)) + '</strong></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>CLIENTE / CONTACTO</th><th>PEDIDOS</th><th>COMPRAS</th><th>DESDE</th><th>ESTADO</th></tr></thead><tbody>' + rows + '</tbody></table></div></article>' +
      '<div class="notice-panel">' + svg('warning') + '<div><strong>Datos de clientes ficticios</strong><p>No hay información personal real en esta vista. La ficha de cliente se diseñará con controles de acceso y protección de datos.</p></div></div>';
  }
  function featureCard(symbol, title, description) {
    return '<article class="feature-card"><span class="feature-symbol">' + svg(symbol) + '</span><h3>' + title + '</h3><p>' + description + '</p></article>';
  }
  function renderAnalytics() {
    return heading(views.analytics, '<select class="period-select"><option>Mes actual</option><option>Últimos 90 días</option></select>') +
      '<div class="feature-grid">' +
      featureCard('chart', 'Ventas y rentabilidad', 'Resumen por periodo, comparación de ventas, margen y evolución del ingreso.') +
      featureCard('bottle', 'Rendimiento por producto', 'Fragancias más vendidas, rotación, margen por referencia y productos sin movimiento.') +
      featureCard('boxes', 'Inventario y reposición', 'Existencias valorizadas, alertas de mínimos y sugerencias de compra.') +
      featureCard('users', 'Clientes y recurrencia', 'Frecuencia de compra, valor acumulado y comportamiento de clientes frecuentes.') +
      '</div><div class="notice-panel">' + svg('spark') + '<div><strong>Los informes se activarán después del modelo de datos</strong><p>Primero definiremos las fórmulas y fuentes de cada indicador para evitar reportes que mezclen ventas, pedidos y cobros.</p></div></div>';
  }
  function renderBilling() {
    const rows = [
      { id: 'FAC-DEMO-001', client: 'Cliente de demostración A', date: '02 nov 2026', total: 4050, state: 'Borrador' },
      { id: 'FAC-DEMO-002', client: 'Cliente de demostración B', date: '01 nov 2026', total: 2200, state: 'Pendiente' },
      { id: 'FAC-DEMO-003', client: 'Cliente de demostración C', date: '31 oct 2026', total: 1850, state: 'Emitida (demo)' }
    ];
    const table = rows.map(function (row) {
      const chip = row.state === 'Pendiente'
        ? '<span class="status-chip status-pending">Pendiente</span>'
        : row.state === 'Borrador'
          ? '<span class="status-chip status-muted">Borrador</span>'
          : '<span class="status-chip status-success">Emitida (demo)</span>';
      return '<tr><td class="table-primary">' + esc(row.id) + '</td><td>' + esc(row.client) + '</td><td>' + esc(row.date) + '</td><td class="table-primary">' + money(row.total) + '</td><td>' + chip + '</td></tr>';
    }).join('');
    return heading(views.billing, '<button class="button button-primary" data-action="billing-preview">' + svg('plus') + ' Nueva factura</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Comprobantes de muestra</span><strong>03</strong></div><div class="summary-mini"><span>Pendientes de cobro</span><strong>01</strong></div><div class="summary-mini"><span>Importe de muestra</span><strong>' + money(8100) + '</strong></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>REFERENCIA</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL</th><th>ESTADO</th></tr></thead><tbody>' + table + '</tbody></table></div></article>' +
      '<div class="notice-panel">' + svg('warning') + '<div><strong>Facturación oficial aún no habilitada</strong><p>Esta pantalla contiene únicamente ejemplos ficticios. Numeración, impuestos, requisitos fiscales, formatos y notas de crédito se definirán después de verificar la normativa vigente de Nicaragua. No emite comprobantes fiscales reales.</p></div></div>';
  }
  function renderHR() {
    return heading(views.hr, '<button class="button button-primary" data-action="hr-preview">' + svg('plus') + ' Agregar colaborador</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Equipo de demostración</span><strong>05</strong></div><div class="summary-mini"><span>Asistencia de hoy</span><strong>04</strong></div><div class="summary-mini"><span>Permisos pendientes</span><strong>01</strong></div></div>' +
      '<div class="feature-grid">' +
      featureCard('users', 'Personal y expedientes', 'Datos laborales, contratos, cargos, departamentos y documentos con permisos de acceso.') +
      featureCard('clock', 'Asistencia y turnos', 'Entradas, salidas, horarios, ausencias y controles de jornada.') +
      featureCard('receipt', 'Nómina y prestaciones', 'Periodos de pago, deducciones, prestaciones y comprobantes de nómina.') +
      featureCard('clock', 'Vacaciones y permisos', 'Solicitudes, aprobaciones, saldos disponibles y calendario de ausencias.') +
      '</div><div class="notice-panel">' + svg('warning') + '<div><strong>RRHH en etapa de diseño</strong><p>Esta sección no contiene empleados reales ni procesa nómina. Los cálculos y documentos laborales se construirán tras validar la legislación nicaragüense, la privacidad de los expedientes y los permisos de cada rol.</p></div></div>';
  }
  function renderSettings() {
    return heading(views.settings, '') +
      '<div class="feature-grid">' +
      featureCard('settings', 'Preferencias del negocio', 'Moneda, formato de fecha, datos comerciales, reglas de inventario y numeración de documentos.') +
      featureCard('users', 'Usuarios y permisos', 'Perfiles de administrador y colaboradores con permisos por módulo y registro de actividad.') +
      featureCard('boxes', 'Almacenamiento de archivos', 'Imágenes de productos alojadas en R2 privado con enlaces temporales y acceso controlado.') +
      featureCard('receipt', 'Base de datos y respaldo', 'Neon PostgreSQL con entornos separados para desarrollo y producción, migraciones y respaldos.') +
      '</div><div class="notice-panel">' + svg('warning') + '<div><strong>Conexiones aún no configuradas</strong><p>No se han guardado claves, credenciales ni secretos en el navegador o en el repositorio.</p></div></div>';
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
      hr: renderHR,
      analytics: renderAnalytics,
      settings: renderSettings
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
    globalSearch.value = '';
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
    const fields = ['name','brand','sku','category','concentration','gender','family','sizeMl','presentation','barcode','supplier','purchaseCost','additionalCost','price','stock','minStock','location','notes'];
    if (product) fields.forEach(function (field) { if (form.elements[field]) form.elements[field].value = product[field] == null ? '' : String(product[field]); });
    form.elements.stock.readOnly = Boolean(product);
    form.elements.stock.value = product ? String(product.stock) : (form.elements.stock.value || '');
    document.getElementById('modal-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('save-product').textContent = product ? 'Guardar cambios' : 'Agregar a demo';
    document.querySelector('#product-dialog .modal-note').textContent = product
      ? 'Edición de ficha DEMO. Las existencias no se cambian aquí: registra entradas, salidas o ajustes desde Existencias.'
      : 'Ficha DEMO. Los datos se guardan localmente en este navegador y todavía no se sincronizan con Neon.';
    updateProductCostPreview();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else toast('El formulario emergente no es compatible con este navegador.');
  }
  function openStockModal(productId) {
    const activeProducts = products.filter(function (product) { return product.active !== false; });
    if (!activeProducts.length) { toast('Primero activa o registra un producto para mover existencias.'); return; }
    stockForm.reset();
    stockForm.elements.productId.innerHTML = activeProducts.map(function (product) {
      return '<option value="' + product.id + '">' + esc(product.name) + ' · ' + esc(product.sku) + ' · stock ' + product.stock + '</option>';
    }).join('');
    if (productId != null) stockForm.elements.productId.value = String(productId);
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
  document.addEventListener('click', function (event) {
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
        product.active = product.active === false; persistDemoData(); renderView();
        toast(product.active ? 'Producto reactivado en el catálogo DEMO.' : 'Producto desactivado. Su historial se conserva.');
      }
      else if (name === 'delete-product') {
        const product = products.find(function (item) { return String(item.id) === action.getAttribute('data-id'); });
        if (!product) return;
        if (inventoryMovements.some(function (movement) { return String(movement.productId) === String(product.id); })) {
          toast('No se puede eliminar: el producto ya tiene movimientos. Puedes desactivarlo y conservar su historial.'); return;
        }
        if (!window.confirm('¿Eliminar definitivamente este producto DEMO?')) return;
        products = products.filter(function (item) { return String(item.id) !== String(product.id); });
        persistDemoData(); renderView(); toast('Producto DEMO eliminado.');
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
    if (event.target.closest('#modal-close') || event.target.closest('#cancel-product')) { dialog.close(); form.dataset.editingId = ''; form.elements.stock.readOnly = false; }
    if (event.target.closest('#stock-modal-close') || event.target.closest('#stock-cancel')) stockDialog.close();
    if (event.target.closest('#detail-close') || event.target.closest('#detail-cancel')) detailDialog.close();
    if (event.target.closest('#order-detail-close') || event.target.closest('#order-detail-cancel')) orderDialog.close();
    if (event.target.closest('.notification-button')) toast('No hay notificaciones reales: el sistema aún está en modo demo.');
  });
  document.addEventListener('input', function (event) {
    if (event.target === globalSearch) {
      state.query = event.target.value;
      if (state.view === 'products') {
        const body = document.getElementById('product-table-body');
        if (body) body.innerHTML = productTable(filteredProducts());
        const local = document.getElementById('view-search');
        if (local && local !== document.activeElement) local.value = state.query;
      }
    }
    if (event.target && event.target.id === 'view-search') {
      state.query = event.target.value;
      const body = document.getElementById('product-table-body');
      if (body) body.innerHTML = productTable(filteredProducts());
      globalSearch.value = state.query;
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
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      globalSearch.focus();
    }
    if (event.key === 'Escape') closeMobileMenu();
  });
  form.addEventListener('submit', function (event) {
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
    const fields = {name:name,brand:value('brand'),sku:sku,category:value('category') || 'Perfumería',concentration:value('concentration'),gender:value('gender'),family:value('family'),sizeMl:number('sizeMl') || null,presentation:value('presentation'),barcode:value('barcode'),supplier:value('supplier'),purchaseCost:purchaseCost,additionalCost:additionalCost,unitCost:unitCost,price:price,profit:profit,margin:margin,minStock:minStock,location:value('location'),notes:value('notes')};
    if (existing) {
      Object.assign(existing,fields); persistDemoData(); form.reset(); form.dataset.editingId=''; form.elements.stock.readOnly=false;
      updateProductCostPreview(); dialog.close(); renderView(); toast('Ficha de producto actualizada y guardada localmente en modo DEMO.');
    } else {
      products.unshift(Object.assign({id:Date.now(),stock:stock,active:true,tone:'art-violet'},fields)); persistDemoData();
      form.reset(); form.dataset.editingId=''; form.elements.stock.readOnly=false; updateProductCostPreview();
      dialog.close(); goToView('products'); toast('Producto guardado en DEMO local; no se ha guardado en Neon.');
    }
  });
  function makeSku() {
    let index=1;
    while (products.some(function (product) { return String(product.sku).toLowerCase() === ('jbp-' + String(index).padStart(3,'0')).toLowerCase(); })) index+=1;
    return 'JBP-' + String(index).padStart(3,'0');
  }
  stockForm.addEventListener('submit', function (event) {
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
    product.stock=newStock;
    inventoryMovements.unshift({id:Date.now(),productId:product.id,productName:product.name,sku:product.sku,type:label,quantity:Math.abs(delta),delta:delta,previousStock:previousStock,newStock:newStock,note:note,createdAt:new Date().toISOString()});
    persistDemoData(); stockForm.reset(); stockDialog.close(); renderView();
    toast(label+' registrada: '+product.name+' · '+(delta>0?'+':'')+delta+' unidades.');
  });
  stockForm.elements.type.addEventListener('change',updateStockQuantityMode);  setDate();
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
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}());
