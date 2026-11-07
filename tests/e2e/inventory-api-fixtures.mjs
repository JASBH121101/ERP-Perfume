function pageWindow(searchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size") || 25)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function paginate(records, searchParams) {
  const { page, pageSize, offset } = pageWindow(searchParams);
  return {
    records: records.slice(offset, offset + pageSize),
    total: records.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(records.length / pageSize))
  };
}

function listStock(data, searchParams) {
  const search = (searchParams.get("search") || "").trim().toLocaleLowerCase("es");
  const category = (searchParams.get("category") || "").trim();
  const status = searchParams.get("status") || "all";
  const products = (data.products || []).filter(product => {
    if (product.active === false) return false;
    const searchable = [
      product.name, product.sku, product.brand, product.barcode, product.location
    ].filter(Boolean).join(" ").toLocaleLowerCase("es");
    if (search && !searchable.includes(search)) return false;
    if (category && product.category !== category) return false;
    const stock = Number(product.stock || 0);
    const minimum = Number(product.min_stock ?? 0);
    if (status === "available" && stock <= minimum) return false;
    if (status === "low" && !(stock > 0 && stock <= minimum)) return false;
    if (status === "out" && stock !== 0) return false;
    return true;
  }).sort((a, b) =>
    Number(a.stock || 0) - Number(b.stock || 0) ||
    String(a.name).localeCompare(String(b.name), "es") ||
    String(a.id).localeCompare(String(b.id))
  );
  return paginate(products.map(product => ({ ...product })), searchParams);
}

function listMovements(data, searchParams) {
  const search = (searchParams.get("search") || "").trim().toLocaleLowerCase("es");
  const type = searchParams.get("type") || "all";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const products = new Map((data.products || []).map(product => [String(product.id), product]));
  const records = (data.inventory_movements || []).flatMap(movement => {
    const product = products.get(String(movement.product_id));
    if (!product) return [];
    const row = {
      ...movement,
      product_name: product.name,
      sku: product.sku
    };
    const searchable = [row.product_name, row.sku, row.note, row.reference_id]
      .filter(Boolean).join(" ").toLocaleLowerCase("es");
    const day = String(row.created_at || "").slice(0, 10);
    if (type !== "all" && row.movement_type !== type) return [];
    if (search && !searchable.includes(search)) return [];
    if (from && day < from) return [];
    if (to && day > to) return [];
    return [row];
  }).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
    String(b.id).localeCompare(String(a.id))
  );
  return paginate(records, searchParams);
}

export function inventoryApiFixtureResponse(pathname, searchParams, data) {
  if (pathname === "/api/erp/inventory-summary") {
    const active = (data.products || []).filter(product => product.active !== false);
    const totalUnits = active.reduce((sum, product) => sum + Number(product.stock || 0), 0);
    const outOfStock = active.filter(product => Number(product.stock || 0) === 0).length;
    const lowStock = active.filter(product => Number(product.stock || 0) > 0 &&
      Number(product.stock || 0) <= Number(product.min_stock ?? 0)).length;
    const healthyStock = active.length - outOfStock - lowStock;
    return {
      summary: {
        activeProducts: active.length,
        totalUnits,
        outOfStock,
        lowStock,
        healthyStock
      },
      categories: [...new Set(active.map(product => product.category).filter(Boolean))].sort()
    };
  }
  if (pathname === "/api/erp/inventory-stock") {
    return listStock(data, searchParams);
  }
  if (pathname === "/api/erp/inventory-movements") {
    return listMovements(data, searchParams);
  }
  return null;
}
