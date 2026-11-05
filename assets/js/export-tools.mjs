function cleanCell(value) {
  if (value == null) return "";
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function xmlEscape(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function htmlEscape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function matrixFor(dataset) {
  const headers = Array.isArray(dataset && dataset.headers) ? dataset.headers : [];
  const rows = Array.isArray(dataset && dataset.rows) ? dataset.rows : [];
  return [headers, ...rows].map(row => headers.map((_, index) => cleanCell(Array.isArray(row) ? row[index] : "")));
}

export function serializeCsv(dataset) {
  const matrix = matrixFor(dataset);
  return "\uFEFF" + matrix.map(row => row.map(value =>
    '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'
  ).join(",")).join("\r\n");
}

export function serializeExcelXml(dataset) {
  const matrix = matrixFor(dataset);
  const rows = matrix.map((row, rowIndex) => {
    const style = rowIndex === 0 ? ' ss:StyleID="Header"' : "";
    const cells = row.map(value => {
      const isNumber = typeof value === "number" && Number.isFinite(value);
      const type = isNumber ? "Number" : "String";
      const cellValue = isNumber ? String(value) : String(value == null ? "" : value);
      return '<Cell><Data ss:Type="' + type + '">' + xmlEscape(cellValue) + '</Data></Cell>';
    }).join("");
    return "<Row" + style + ">" + cells + "</Row>";
  }).join("");
  const sheetName = xmlEscape(String(dataset && dataset.title || "Exportación").slice(0, 31).replace(/[\\\/?*\[\]:]/g, " "));
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#29251E" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style></Styles>' +
    '<Worksheet ss:Name="' + sheetName + '"><Table>' + rows + '</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>' +
    '</Workbook>';
}

export function renderPrintableHtml(dataset, generatedAt) {
  const headers = Array.isArray(dataset && dataset.headers) ? dataset.headers : [];
  const rows = Array.isArray(dataset && dataset.rows) ? dataset.rows : [];
  const head = headers.map(value => "<th>" + htmlEscape(value) + "</th>").join("");
  const body = rows.length
    ? rows.map(row => "<tr>" + headers.map((_, index) => "<td>" + htmlEscape(Array.isArray(row) ? row[index] : "") + "</td>").join("") + "</tr>").join("")
    : '<tr><td colspan="' + Math.max(1, headers.length) + '" class="empty">No hay registros para mostrar.</td></tr>';
  const title = htmlEscape(dataset && dataset.title || "Exportación ERP");
  const stamp = htmlEscape(generatedAt || new Date().toLocaleString("es-NI"));
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + ' · JB PARFUMS ERP</title><style>' +
    '*{box-sizing:border-box}body{margin:28px;color:#24211c;font:12px/1.45 Arial,Helvetica,sans-serif}' +
    '.brand{font-size:10px;letter-spacing:2px;font-weight:700;color:#9b7b49}.title{margin:8px 0 4px;font-size:23px;font-weight:700}' +
    '.meta{margin:0 0 18px;color:#686157;font-size:10px}.table-wrap{width:100%;overflow:visible}table{width:100%;border-collapse:collapse;table-layout:auto}' +
    'thead{display:table-header-group}th{background:#29251e;color:#fff;text-align:left;font-weight:700}th,td{padding:7px 8px;border:1px solid #ded8ce;vertical-align:top;overflow-wrap:anywhere}' +
    'tbody tr:nth-child(even){background:#f5f2ec}.empty{text-align:center;color:#777;padding:20px}.footer{margin-top:16px;color:#827b70;font-size:9px}' +
    '@page{size:A4 landscape;margin:12mm}@media print{body{margin:0}.footer{position:fixed;bottom:0}}' +
    '</style></head><body><div class="brand">JB PARFUMS ERP · EXPORTACIÓN</div><h1 class="title">' + title + '</h1>' +
    '<p class="meta">Generado: ' + stamp + ' · ' + rows.length + ' registro(s) · Información interna</p>' +
    '<div class="table-wrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="footer">Documento generado desde los datos cargados en JB PARFUMS ERP. Verifica los registros y filtros aplicados antes de utilizarlo como soporte.</p>' +
    '<script>window.addEventListener("load",function(){window.setTimeout(function(){window.print();},250);});window.addEventListener("afterprint",function(){window.close();});</script>' +
    '</body></html>';
}

export function safeExportFilename(value, extension) {
  const base = String(value || "jb-parfums-exportacion")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "jb-parfums-exportacion";
  return base + "." + extension;
}

export function downloadExport(dataset, format, windowRef) {
  const win = windowRef || window;
  let content, mime, extension;
  if (format === "csv") {
    content = serializeCsv(dataset);
    mime = "text/csv;charset=utf-8";
    extension = "csv";
  } else if (format === "excel") {
    content = serializeExcelXml(dataset);
    mime = "application/vnd.ms-excel;charset=utf-8";
    extension = "xls";
  } else {
    throw new Error("Formato de exportación no compatible.");
  }
  const blob = new Blob([content], { type: mime });
  const url = win.URL.createObjectURL(blob);
  const link = win.document.createElement("a");
  link.href = url;
  link.download = safeExportFilename(dataset.fileBase || dataset.title, extension);
  win.document.body.appendChild(link);
  link.click();
  link.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 1500);
  return link.download;
}

export function openPrintExport(dataset, windowRef) {
  const win = windowRef || window;
  const popup = win.open("", "_blank");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(renderPrintableHtml(dataset));
  popup.document.close();
  return true;
}
