import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const workerPattern = /\/api\/erp\/[^?]+/;
const apiBase = 'https://jb-parfums-erp-api.jaredblancoh19.workers.dev';
const fixture = {
  products: [
    { id:'00000000-0000-0000-0000-000000000101', sku:'QA-001', name:'QA Fixture Perfume', brand:'QA Maison', category:'Diseñador', purchase_cost_usd:20, additional_cost_usd:5, unit_cost_usd:25, price_usd:50, stock:5, min_stock:1, active:true, images:[] },
    { id:'00000000-0000-0000-0000-000000000102', sku:'QA-002', name:'QA Low Stock Perfume', brand:'QA Maison', category:'Árabes', purchase_cost_usd:12, additional_cost_usd:2, unit_cost_usd:14, price_usd:30, stock:1, min_stock:3, active:true, images:[] },
    { id:'00000000-0000-0000-0000-000000000103', sku:'QA-003', name:'QA Out of Stock Perfume', brand:'QA Maison', category:'Diseñador', purchase_cost_usd:10, additional_cost_usd:0, unit_cost_usd:10, price_usd:25, stock:0, min_stock:2, active:true, images:[] },
    { id:'00000000-0000-0000-0000-000000000104', sku:'QA-004', name:'QA Archived Perfume', brand:'QA Maison', category:'Árabes', purchase_cost_usd:8, additional_cost_usd:0, unit_cost_usd:8, price_usd:20, stock:4, min_stock:2, active:false, images:[] }
  ],
  inventory_movements: Array.from({length:27},(_,index)=>{
    const entry=index%2===0, delta=entry?2:-1, day=2+Math.floor(index/9);
    return {id:'qa-movement-'+String(index+1),product_id:'00000000-0000-0000-0000-000000000101',movement_type:entry?'Entrada':'Salida',quantity:Math.abs(delta),quantity_delta:delta,previous_stock:10,new_stock:10+delta,note:'Movimiento QA '+String(index+1),reference_type:'manual',reference_id:null,created_at:new Date(Date.UTC(2026,10,day,12,index%9,0)).toISOString()};
  }),
  customers:[], suppliers:[], orders:[], order_items:[], purchases:[], purchase_items:[],
  invoices:[], invoice_items:[], invoice_payments:[], expenses:[], cash_accounts:[], cash_entries:[],
  employees:[], hr_attendance:[], hr_leave_requests:[], hr_payroll_periods:[], hr_payroll_items:[],
  employee_history:[], employee_documents:[],
  settings:[{setting_key:'default_exchange_rate',setting_value:{value:36.6}}]
};

test.beforeEach(async ({page})=>{
  await page.route('**/assets/js/bootstrap.mjs*',route=>route.fulfill({
    status:200,
    contentType:'text/javascript; charset=utf-8',
    body:"document.body.classList.remove('auth-pending','auth-locked');document.body.classList.add('erp-authorized');window.JBAuth={mode:'authenticated',user:{id:'qa-owner',email:'qa-owner@example.test'},profile:{id:'qa-owner',name:'QA Owner',role:'owner',permissions:['*']},apiUrl:path=>new URL(path,'https://jb-parfums-erp-api.jaredblancoh19.workers.dev').toString(),getToken:async()=> 'qa-only-token'};import('./app.js');"
  }));
  await page.route(workerPattern,async route=>{
    const request=route.request(),url=new URL(request.url()),pathname=url.pathname;
    if(request.method()==='GET'){
      const p=pathname.split('/').pop();
      if(p==='inventory-summary')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:{activeReferences:3,unitsInStock:6,lowStock:2,outOfStock:1}})});
    }
    if(pathname.endsWith('/bootstrap')&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:fixture})});
    if(pathname.endsWith('/resource-usage')&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({updatedAt:'2026-11-07T00:00:00.000Z',database:{sizeBytes:134217728,activeConnections:2,transactionsCommitted:1200,transactionsRolledBack:3},storage:{sizeBytes:268435456,objectCount:42,complete:true,scannedPages:1},errors:{database:null,storage:null}})});
    if(pathname.endsWith('/products/import')&&request.method()==='POST')return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({imported:request.postDataJSON().records?.length||0,records:[]})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({records:[],data:fixture})});
  });
});

async function goTo(page,view,width){
  const sidebar=page.locator('#sidebar');
  if(width<=720 && !(await sidebar.evaluate(node=>node.classList.contains('open'))))await page.locator('#menu-toggle').click();
  const button=sidebar.locator('button[data-view="'+view+'"]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveClass(/active/);
}

test.describe('responsive account controls',()=>{
  test('keeps security checkbox and account actions compact and aligned on mobile',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/');
    await page.locator('link[href*="device-responsive.css"]').waitFor({state:'attached'});
    await page.evaluate(()=>{
      const host=document.createElement('section');
      host.className='access-manager-section';
      host.innerHTML='<article class="panel"><div class="table-wrap"><table class="data-table mobile-record-table"><tbody><tr><td class="user-access-controls" data-label="Seguridad y permisos"><label><input type="checkbox" checked> Cambio inicial</label><button class="button button-primary button-small" type="button">Activar acceso</button><details class="user-overrides"><summary>Excepciones (0)</summary></details><button class="button button-quiet button-small" type="button">Guardar cuenta</button></td></tr></tbody></table></div></article>';
      document.body.append(host);
    });
    const card=page.locator('.access-manager-section .panel').last();
    const label=card.locator('.user-access-controls > label');
    const checkbox=label.locator('input[type="checkbox"]');
    const activate=card.getByRole('button',{name:'Activar acceso'});
    await expect(label).toBeVisible();
    await expect(checkbox).toBeVisible();
    await expect(activate).toBeVisible();
    const metrics=await page.evaluate(()=>{
      const card=document.querySelector('.access-manager-section .panel:last-child');
      const label=card.querySelector('.user-access-controls > label');
      const checkbox=label.querySelector('input');
      const button=card.querySelector('button');
      return {cardWidth:card.getBoundingClientRect().width,labelWidth:label.getBoundingClientRect().width,checkboxWidth:checkbox.getBoundingClientRect().width,buttonWidth:button.getBoundingClientRect().width,buttonHeight:button.getBoundingClientRect().height,controlsDisplay:getComputedStyle(card.querySelector('.user-access-controls')).display,alignItems:getComputedStyle(card.querySelector('.user-access-controls')).alignItems};
    });
    expect(metrics.checkboxWidth).toBe(18);
    expect(metrics.labelWidth).toBeLessThan(metrics.cardWidth*.7);
    expect(metrics.buttonWidth).toBeLessThan(metrics.cardWidth*.7);
    expect(metrics.buttonHeight).toBeGreaterThanOrEqual(36);
    expect(metrics.controlsDisplay).toBe('flex');
    expect(metrics.alignItems).toBe('flex-start');
  });

  test('all ERP modules fit mobile, tablet and desktop viewports with responsive evidence',async({page})=>{
    const views=['dashboard','orders','billing','receivables','customers','catalog','products','inventory','purchaseOrders','purchases','suppliers','expenses','cash','payables','hr','dgi','analytics','settings'];
    const widths=[390,768,1440];
    mkdirSync(path.resolve('visual-evidence/responsive-audit'),{recursive:true});
    test.setTimeout(120000);
    for(const width of widths){
      await page.setViewportSize({width,height:900});
      await page.goto('/');
      await page.locator('#view-root').waitFor({state:'attached'});
      await page.locator('link[href*="device-responsive.css"]').waitFor({state:'attached'});
      for(const view of views){
        await goTo(page,view,width);
        await page.waitForTimeout(60);
        const metrics=await page.evaluate(()=>{
          const root=document.getElementById('view-root');
          const viewport=document.documentElement.clientWidth;
          const rect=root.getBoundingClientRect();
          const offenders=[];
          for(const el of root.querySelectorAll('*')){
            const r=el.getBoundingClientRect();
            if(r.width<1||r.height<1||el.closest('.table-wrap'))continue;
            if(r.right>viewport+1||r.left< -1){
              offenders.push({tag:el.tagName,cls:typeof el.className==='string'?el.className:'',right:Math.round(r.right),left:Math.round(r.left),width:Math.round(r.width)});
            }
          }
          return {viewport,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,rootLeft:Math.round(rect.left),rootRight:Math.round(rect.right),offenders:offenders.slice(0,8)};
        });
        expect(metrics.rootLeft,view+' root left at '+width+'px').toBeGreaterThanOrEqual(-1);
        expect(metrics.rootRight,view+' root right at '+width+'px').toBeLessThanOrEqual(width+1);
        expect(metrics.documentWidth,view+' document overflow at '+width+'px').toBeLessThanOrEqual(width+1);
        expect(metrics.offenders,view+' overflowing elements at '+width+'px').toEqual([]);
        const safe=view.replace(/[^a-z0-9-]/gi,'-');
        await page.screenshot({path:path.resolve('visual-evidence/responsive-audit',width+'-'+safe+'.png'),fullPage:false,animations:'disabled'});
      }
    }
  });
});
