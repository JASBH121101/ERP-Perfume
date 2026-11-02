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

  const products = [
    { id: 1, name: 'Club de Nuit Intense Man', sku: 'JBP-001', category: 'Diseñador', price: 2450, stock: 14, tone: 'art-night' },
    { id: 2, name: 'Yara Lattafa', sku: 'JBP-002', category: 'Árabes', price: 1850, stock: 8, tone: 'art-rose' },
    { id: 3, name: 'Khamrah Lattafa', sku: 'JBP-003', category: 'Árabes', price: 2200, stock: 3, tone: 'art-olive' },
    { id: 4, name: 'Badee Al Oud Amethyst', sku: 'JBP-004', category: 'Árabes', price: 2100, stock: 0, tone: 'art-violet' },
    { id: 5, name: '9PM Afnan', sku: 'JBP-005', category: 'Árabes', price: 1950, stock: 11, tone: 'art-night' },
    { id: 6, name: 'Good Girl Carolina Herrera', sku: 'JBP-006', category: 'Diseñador', price: 3100, stock: 5, tone: 'art-night' },
    { id: 7, name: 'Ana Abiyedh Rouge', sku: 'JBP-007', category: 'Unisex', price: 1750, stock: 2, tone: 'art-rose' },
    { id: 8, name: 'Eclaire Lattafa', sku: 'JBP-008', category: 'Árabes', price: 2050, stock: 9, tone: 'art-olive' }
  ];
  const orders = [
    { id: 'JP-1048', customer: 'María Gutiérrez', date: '02 nov 2026', amount: 4050, status: 'Completado' },
    { id: 'JP-1047', customer: 'Carlos Mendoza', date: '02 nov 2026', amount: 2200, status: 'Pendiente' },
    { id: 'JP-1046', customer: 'Andrea López', date: '01 nov 2026', amount: 1850, status: 'Completado' },
    { id: 'JP-1045', customer: 'Daniela Ruiz', date: '01 nov 2026', amount: 3100, status: 'En preparación' },
    { id: 'JP-1044', customer: 'Luis Salazar', date: '31 oct 2026', amount: 1950, status: 'Completado' }
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
  const state = { view: 'dashboard', query: '', filter: 'all' };
  const root = document.getElementById('view-root');
  const globalSearch = document.getElementById('global-search');
  const dialog = document.getElementById('product-dialog');
  const form = document.getElementById('product-form');

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function money(value) {
    return 'C$ ' + Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function status(stock) {
    if (stock === 0) return '<span class="status-chip status-danger">Agotado</span>';
    if (stock <= 3) return '<span class="status-chip status-pending">Stock bajo</span>';
    return '<span class="status-chip status-success">Disponible</span>';
  }
  function orderStatus(value) {
    if (value === 'Completado') return '<span class="status-chip status-success">Completado</span>';
    if (value === 'Pendiente') return '<span class="status-chip status-pending">Pendiente</span>';
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
    const top = products.slice().sort(function (a, b) { return b.stock - a.stock; }).slice(0, 4);
    const productRows = orders.slice(0, 4).map(function (order) {
      return '<tr><td class="table-primary">' + esc(order.id) + '</td><td>' + esc(order.customer) + '</td><td>' + esc(order.date) + '</td><td class="table-primary">' + money(order.amount) + '</td><td>' + orderStatus(order.status) + '</td></tr>';
    }).join('');
    const topRows = top.map(function (product) {
      return '<div class="top-product">' + art(product.tone) + '<div class="top-product-info"><strong>' + esc(product.name) + '</strong><small>' + esc(product.category) + ' · ' + product.stock + ' unidades</small></div><span class="top-product-value">' + money(product.price) + '</span></div>';
    }).join('');
    const low = products.filter(function (product) { return product.stock <= 3; }).length;
    return heading(views.dashboard, '<select class="period-select" aria-label="Periodo"><option>Últimos 7 días</option><option>Últimos 30 días</option><option>Este año</option></select><button class="button button-primary" data-action="new-product">' + svg('plus') + ' Nuevo producto</button>') +
      '<section class="metric-grid">' +
      metric('Ventas del mes', 'C$ 28,450', 'chart', '+12.8%', 'vs. mes anterior', false) +
      metric('Pedidos recibidos', '18', 'bag', '+4.2%', 'vs. mes anterior', false) +
      metric('Productos activos', String(products.length).padStart(2, '0'), 'bottle', 'Catálogo', 'productos de demostración', true) +
      metric('Alertas de stock', String(low).padStart(2, '0'), 'warning', 'Revisar', 'productos con 3 unidades o menos', true) +
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
  function filteredProducts() {
    return products.filter(function (product) {
      const query = (state.query || '').toLowerCase();
      const matches = !query || [product.name, product.sku, product.category].join(' ').toLowerCase().indexOf(query) !== -1;
      const filter = state.filter;
      const stockMatch = filter === 'all' || (filter === 'available' && product.stock > 3) || (filter === 'low' && product.stock > 0 && product.stock <= 3) || (filter === 'out' && product.stock === 0);
      return matches && stockMatch;
    });
  }
  function productTable(items) {
    if (!items.length) return '<tr><td colspan="6"><div class="empty-state">No hay resultados para esta búsqueda.</div></td></tr>';
    return items.map(function (p) {
      return '<tr><td><div class="product-cell">' + art(p.tone) + '<span><span class="table-primary">' + esc(p.name) + '</span><small class="table-secondary">' + esc(p.sku) + '</small></span></div></td><td>' + esc(p.category) + '</td><td class="table-primary">' + money(p.price) + '</td><td>' + p.stock + ' uds.</td><td>' + status(p.stock) + '</td><td><div class="table-actions"><button class="table-action" type="button" data-action="preview-product" data-id="' + p.id + '" aria-label="Ver ' + esc(p.name) + '">' + svg('eye') + '</button></div></td></tr>';
    }).join('');
  }
  function renderProducts() {
    const items = filteredProducts();
    return heading(views.products, '<button class="button button-primary" data-action="new-product">' + svg('plus') + ' Nuevo producto</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Total en catálogo</span><strong>' + products.length + '</strong></div><div class="summary-mini"><span>Con stock disponible</span><strong>' + products.filter(function (p) { return p.stock > 3; }).length + '</strong></div><div class="summary-mini"><span>Requieren revisión</span><strong>' + products.filter(function (p) { return p.stock <= 3; }).length + '</strong></div></div>' +
      '<div class="toolbar"><div class="toolbar-left"><label class="inline-search">' + svg('search') + '<input id="view-search" type="search" placeholder="Buscar por nombre, SKU..." value="' + esc(state.query) + '" aria-label="Buscar productos"></label></div><div class="toolbar-right"><select class="filter-select" id="stock-filter" aria-label="Filtrar por stock"><option value="all"' + (state.filter === 'all' ? ' selected' : '') + '>Todos los productos</option><option value="available"' + (state.filter === 'available' ? ' selected' : '') + '>Disponibles</option><option value="low"' + (state.filter === 'low' ? ' selected' : '') + '>Stock bajo</option><option value="out"' + (state.filter === 'out' ? ' selected' : '') + '>Agotados</option></select></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>PRECIO</th><th>EXISTENCIAS</th><th>ESTADO</th><th></th></tr></thead><tbody id="product-table-body">' + productTable(items) + '</tbody></table></div></article>' +
      '<div class="notice-panel">' + svg('spark') + '<div><strong>Catálogo en modo demostración</strong><p>Los productos nuevos se mantienen en memoria mientras esta pestaña esté abierta. La carga de imágenes y el guardado permanente se habilitarán al integrar R2 y Neon.</p></div></div>';
  }
  function renderInventory() {
    const rows = products.slice().sort(function (a, b) { return a.stock - b.stock; }).map(function (p) {
      return '<tr><td><div class="product-cell">' + art(p.tone) + '<span><span class="table-primary">' + esc(p.name) + '</span><small class="table-secondary">' + esc(p.sku) + '</small></span></div></td><td>' + esc(p.category) + '</td><td>' + p.stock + ' unidades</td><td>' + status(p.stock) + '</td><td>' + (p.stock <= 3 ? '<span class="table-secondary">Revisar reposición</span>' : '<span class="table-secondary">Nivel estable</span>') + '</td></tr>';
    }).join('');
    return heading(views.inventory, '<button class="button button-quiet" data-action="export">' + svg('download') + ' Exportar</button>') +
      '<div class="summary-strip"><div class="summary-mini"><span>Referencias</span><strong>' + products.length + '</strong></div><div class="summary-mini"><span>Unidades en stock</span><strong>' + products.reduce(function (sum, p) { return sum + p.stock; }, 0) + '</strong></div><div class="summary-mini"><span>Reposición sugerida</span><strong>' + products.filter(function (p) { return p.stock <= 3; }).length + '</strong></div></div>' +
      '<article class="list-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>STOCK</th><th>ESTADO</th><th>ACCIÓN SUGERIDA</th></tr></thead><tbody>' + rows + '</tbody></table></div></article>' +
      '<div class="notice-panel">' + svg('warning') + '<div><strong>Umbral de stock provisional: 3 unidades</strong><p>Este umbral es ilustrativo. Más adelante podrá configurarse por producto o categoría.</p></div></div>';
  }
  function renderOrders() {
    const rows = orders.map(function (o) {
      return '<tr><td class="table-primary">' + esc(o.id) + '</td><td>' + esc(o.customer) + '</td><td>' + esc(o.date) + '</td><td class="table-primary">' + money(o.amount) + '</td><td>' + orderStatus(o.status) + '</td><td><button class="table-action" data-action="preview-order" data-id="' + esc(o.id) + '" aria-label="Ver pedido">' + svg('eye') + '</button></td></tr>';
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
    document.getElementById('product-count').textContent = String(products.length).padStart(2, '0');
  }
  function goToView(view) {
    if (!views[view]) return;
    state.view = view;
    state.query = '';
    state.filter = 'all';
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
  function openProductModal() {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else toast('El formulario emergente no es compatible con este navegador.');
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
      else if (name === 'billing-preview') toast('El formulario de factura se diseñará después de validar los requisitos fiscales de Nicaragua.');
      else if (name === 'hr-preview') toast('El alta de personal se habilitará después de definir roles y protección de expedientes.');
      else if (name === 'export') toast('La exportación estará disponible al conectar los datos reales.');
      else if (name === 'preview-product') {
        const product = products.find(function (p) { return String(p.id) === action.getAttribute('data-id'); });
        if (product) toast(product.name + ' · ' + product.stock + ' unidades · ' + money(product.price));
      } else if (name === 'preview-order') toast('El detalle de pedidos estará disponible en la siguiente etapa.');
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
      document.getElementById('mobile-scrim').classList.toggle('visible', open);
      document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
    }
    if (event.target.closest('#mobile-scrim')) closeMobileMenu();
    if (event.target.closest('#modal-close') || event.target.closest('#cancel-product')) dialog.close();
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
  });
  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      globalSearch.focus();
    }
    if (event.key === 'Escape') closeMobileMenu();
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const price = Number(data.get('price'));
    const stock = Number(data.get('stock'));
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      toast('Revisa los datos antes de agregar el producto.');
      return;
    }
    products.unshift({
      id: Date.now(),
      name: name,
      sku: String(data.get('sku') || '').trim() || 'JBP-' + String(products.length + 1).padStart(3, '0'),
      category: String(data.get('category') || 'Perfumería'),
      price: price,
      stock: stock,
      tone: 'art-violet'
    });
    form.reset();
    dialog.close();
    goToView('products');
    toast('Producto agregado a la demostración. No se ha guardado en Neon.');
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
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}());
