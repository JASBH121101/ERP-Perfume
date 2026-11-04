const roundMoneyDefault = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function catalogNumber(value) {
  if (value == null || value === '') return 0;
  let raw = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!raw || raw === '-' || raw === '.' || raw === ',') return 0;
  const comma = raw.lastIndexOf(','), dot = raw.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    raw = raw.split(decimal === ',' ? '.' : ',').join('');
    if (decimal === ',') raw = raw.replace(',', '.');
  } else if (comma >= 0) {
    const decimals = raw.length - comma - 1;
    raw = decimals > 0 && decimals <= 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
  } else if (dot >= 0) {
    const decimals = raw.length - dot - 1;
    if (decimals > 2) raw = raw.replace(/\./g, '');
  }
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}
function catalogHeader(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
const catalogAliases = {
  sku: ['sku','codigo','codigo producto','referencia','ref','clave','code'],
  name: ['producto','nombre','nombre producto','perfume','articulo','item','product','name','description'],
  brand: ['marca','brand'],
  category: ['categoria','category','tipo'],
  purchase_cost_usd: ['costo compra','costo de compra','costo','cost','purchase cost','buy price','precio compra'],
  additional_cost_usd: ['costo adicional','gasto adicional','additional cost'],
  unit_cost_usd: ['costo unitario','unit cost','landed cost'],
  price_usd: ['precio venta','precio de venta','precio publico','pvp','price','sale price','retail price','precio'],
  stock: ['stock','existencias','inventario','cantidad','unidades','qty','quantity'],
  min_stock: ['stock minimo','minimo','min stock','reorder level'],
  concentration: ['concentracion','concentration'],
  gender: ['genero','gender'],
  family: ['familia olfativa','familia','family'],
  size_ml: ['contenido ml','ml','tamano ml','size ml','size'],
  presentation: ['presentacion','presentation'],
  location: ['ubicacion','location','bodega'],
  barcode: ['codigo barras','codigo de barras','barcode','ean'],
  description: ['descripcion','description'],
  supplier_name: ['proveedor','supplier','supplier name'],
  wholesale_price_usd: ['precio mayorista','wholesale price']
};
function catalogField(header) {
  const normalized = catalogHeader(header);
  for (const [field, aliases] of Object.entries(catalogAliases)) {
    if (aliases.includes(normalized)) return field;
  }
  return '';
}
function catalogSku(index) {
  return 'IMP-' + Date.now().toString(36).slice(-5).toUpperCase() + '-' + String(index + 1).padStart(3, '0');
}
export function parseCatalogCSV(text, roundMoney = roundMoneyDefault) {
  const sample = String(text || '').replace(/^\uFEFF/, '').slice(0, 12000);
  let delimiter = ',';
  const counts = [',',';','\t'].map(char => {
    let count = 0, quoted = false;
    for (const ch of sample) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === char) count++;
    }
    return {char,count};
  }).sort((a,b)=>b.count-a.count);
  if (counts[0].count) delimiter = counts[0].char;
  const rows = [];
  let row = [], cell = '', quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i=0;i<source.length;i++) {
    const ch=source[i], next=source[i+1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) { row.push(cell); cell=''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell='';
      if (row.some(value=>String(value).trim())) rows.push(row);
      row=[];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(value=>String(value).trim())) rows.push(row);
  if (rows.length < 2) throw new Error('El CSV debe incluir encabezados y al menos una fila de productos.');
  if (rows.length - 1 > 200) throw new Error('El archivo supera el máximo de 200 productos por importación. Divide el catálogo en varios archivos.');
  const headers = rows[0].map(catalogHeader);
  const mapping = headers.map(catalogField);
  if (!mapping.includes('name')) throw new Error('No pude identificar la columna del producto. Usa un encabezado como Producto, Nombre o Perfume.');
  const parsed = [];
  rows.slice(1,201).forEach((cells,index)=>{
    const record={sku:'',name:'',brand:'',category:'Perfumería',purchase_cost_usd:null,additional_cost_usd:null,unit_cost_usd:null,price_usd:0,stock:0,min_stock:3,active:true,images:[]};
    cells.forEach((value,col)=>{
      const field=mapping[col];
      if (!field) return;
      if (['purchase_cost_usd','additional_cost_usd','unit_cost_usd','price_usd','stock','min_stock','size_ml','wholesale_price_usd'].includes(field)) {
        record[field]=String(value||'').trim()===''?(['stock','min_stock'].includes(field)?0:null):catalogNumber(value);
      }
      else record[field]=String(value||'').trim();
    });
    if (!record.name) return;
    if (!record.sku) record.sku=catalogSku(index);
    if (!record.unit_cost_usd) record.unit_cost_usd=roundMoney(record.purchase_cost_usd+record.additional_cost_usd);
    record.stock=Math.max(0,Math.floor(record.stock));
    record.min_stock=Math.max(0,Math.floor(record.min_stock));
    parsed.push(record);
  });
  if (!parsed.length) throw new Error('No encontré filas con nombre de producto en el CSV.');
  return parsed;
}
export function parseCatalogTextRows(text) {
  const skip=/^(sku|codigo|producto|nombre|descripcion|marca|brand|precio|price|stock|existencias|total|subtotal|p[aá]gina|page|www\.|https?:)/i;
  const lines=String(text||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const rows=[];
  for(const line of lines){
    if(line.length<3||line.length>260||skip.test(line)||!/[a-záéíóúñ]{3}/i.test(line))continue;
    const columns=line.split(/\s{3,}|\s\|\s|\t/).map(x=>x.trim()).filter(Boolean);
    const nums=columns.map((value,index)=>({value,index,amount:catalogNumber(value)})).filter(x=>/^(?:(?:US\$|USD|C\$|NIO|\$)\s*)?[-+]?\d[\d.,]*$/.test(x.value)&&x.amount>0&&x.amount<1000000);
    let name='',amount=null,stock=0;
    if(columns.length>1){
      const first=columns[0];
      const codeLike=/^[A-Z0-9][A-Z0-9._\/-]{2,}$/i.test(first)&&(/[0-9_-]/.test(first)||first===first.toUpperCase());
      const nameStart=codeLike?1:0;
      const firstNum=nums.find(x=>x.index>=nameStart);
      name=columns.slice(nameStart,firstNum?firstNum.index:columns.length).filter(x=>/[a-záéíóúñ]{3}/i.test(x)).join(' ').trim();
      if(firstNum)amount=firstNum.amount;
      const lastNum=nums[nums.length-1];
      if(nums.length>1&&lastNum.index>(firstNum?.index??-1)&&Number.isInteger(lastNum.amount)&&lastNum.amount<100000)stock=lastNum.amount;
    }
    if(!name){
      const skuPrefix=line.match(/^([A-Z0-9][A-Z0-9._\/-]{2,})\s+(.+)$/i);
      const codeLike=Boolean(skuPrefix&&(/[0-9_-]/.test(skuPrefix[1])||skuPrefix[1]===skuPrefix[1].toUpperCase()));
      const candidate=codeLike?skuPrefix[2]:line;
      const explicitStock=candidate.match(/\b(?:stock|existencias|qty|cantidad|unidades)\s*:?\s*(\d+)\b/i);
      if(explicitStock)stock=Math.max(0,Number(explicitStock[1])||0);
      const matches=[...candidate.matchAll(/(?:US\$|USD|C\$|NIO|\$)\s*[-+]?\d[\d.,]*|[-+]?\d[\d,]*[.,]\d{1,2}(?!\d)/gi)];
      name=candidate;
      if(matches.length){
        const selected=matches[matches.length-1];
        const value=catalogNumber(selected[0]);
        if(value>0&&value<1000000){
          amount=amount==null?value:amount;
          name=candidate.slice(0,selected.index).replace(/(?:\b(?:precio|price)\s*:?\s*)?[\s|,;:–-]+$/i,'').trim();
        }
      }
      name=name.replace(/\s+\b(?:stock|existencias|qty|cantidad|unidades)\s*:?\s*\d+\b.*$/i,'').replace(/^\d{1,4}[\s.)-]+/,'').replace(/\s{2,}/g,' ').trim();
    }
    if(name.length<3||!/[a-záéíóúñ]{3}/i.test(name)||/^(p[aá]gina|page|total|subtotal|iva|impuesto|descuento|direccion|telefono|fecha|cliente|proveedor)\b/i.test(name))continue;
    rows.push({sku:catalogSku(rows.length),name:name.slice(0,120),brand:'',category:'Perfumería',purchase_cost_usd:0,additional_cost_usd:0,unit_cost_usd:0,price_usd:0,stock,min_stock:3,active:true,images:[],_detected_amount:amount});
  }
  const unique=[],seen=new Set();
  for(const row of rows){const key=row.name.toLowerCase();if(!seen.has(key)){seen.add(key);unique.push(row);}}
  if(!unique.length)throw new Error('No pude extraer nombres de productos. Revisa que el archivo sea legible o prueba con un CSV.');
  if(unique.length>200)throw new Error('El archivo contiene más de 200 productos detectados. Divide el catálogo en varios archivos.');
  return unique;
}
