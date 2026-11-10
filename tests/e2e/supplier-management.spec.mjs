import { test, expect } from "@playwright/test";

const workerPattern = /\/api\/erp\/[^?]+/;
const apiBase = "https://jb-parfums-erp-api.jaredblancoh19.workers.dev";
const supplierId = "00000000-0000-0000-0000-000000000201";

function createFixture() {
  return {
    products: [], inventory_movements: [], customers: [], suppliers: [],
    orders: [], order_items: [], purchases: [], purchase_items: [],
    purchase_orders: [], purchase_order_items: [], purchase_receipts: [],
    purchase_receipt_items: [], supplier_invoices: [], supplier_invoice_payments: [],
    invoices: [], invoice_items: [], invoice_payments: [], expenses: [],
    cash_accounts: [], cash_entries: [], employees: [], hr_attendance: [],
    hr_leave_requests: [], hr_payroll_periods: [], hr_payroll_items: [],
    employee_history: [], employee_documents: [],
    settings: [{ setting_key: "default_exchange_rate", setting_value: { value: 36.6 } }]
  };
}

async function installSupplierApi(page, initialSuppliers = []) {
  const data = createFixture();
  data.suppliers = structuredClone(initialSuppliers);
  const requests = [];

  await page.route("**/assets/js/bootstrap.mjs*", route => route.fulfill({
    status: 200,
    contentType: "text/javascript; charset=utf-8",
    body: "document.body.classList.remove('auth-pending','auth-locked');" +
      "document.body.classList.add('erp-authorized');" +
      "window.JBAuth = {" +
      "mode:'authenticated', user:{id:'qa-owner',email:'qa-owner@example.test'}," +
      "profile:{id:'qa-owner',name:'QA Owner',role:'owner',permissions:['*']}," +
      "apiUrl:path=>new URL(path,'" + apiBase + "').toString()," +
      "getToken:async()=> 'qa-only-token' }; import('./app.js');"
  }));

  await page.route(workerPattern, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path.endsWith("/bootstrap") && method === "GET") {
      return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({data}) });
    }
    if (path.endsWith("/resource-usage") && method === "GET") {
      return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({
        database:{sizeBytes:1024}, storage:{sizeBytes:1024}, updatedAt:"2026-11-09T00:00:00.000Z"
      }) });
    }
    if (path === "/api/erp/suppliers" && method === "POST") {
      const payload = request.postDataJSON();
      requests.push({method,path,payload});
      const record = {
        id:supplierId, name:payload.name, contact:payload.contact, phone:payload.phone,
        email:payload.email, address:payload.address, payment_terms:payload.payment_terms,
        minimum_order_usd:payload.minimum_order_usd, lead_time_days:payload.lead_time_days,
        currency:payload.currency, notes:payload.notes, active:true,
        additional_phones:(payload.additional_phones||[]).map((phone,index)=>({phone,display_order:index+1}))
      };
      data.suppliers.push(record);
      return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({record})});
    }
    if (path === "/api/erp/suppliers/" + supplierId && method === "PATCH") {
      const payload = request.postDataJSON();
      requests.push({method,path,payload});
      const current = data.suppliers.find(item=>item.id===supplierId);
      Object.assign(current,{
        name:payload.name,contact:payload.contact,phone:payload.phone,email:payload.email,
        address:payload.address,payment_terms:payload.payment_terms,
        minimum_order_usd:payload.minimum_order_usd,lead_time_days:payload.lead_time_days,
        currency:payload.currency,notes:payload.notes,
        additional_phones:(payload.additional_phones||[]).map((phone,index)=>({phone,display_order:index+1}))
      });
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({record:current})});
    }
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({records:[],data})});
  });
  return {data,requests};
}

async function openSuppliers(page) {
  await page.goto("/");
  await page.locator('#sidebar button[data-view="suppliers"]').click();
  await expect(page.locator('[data-action="new-supplier"]')).toBeVisible();
}

test("supplier form adds two additional phones and persists all of them", async ({page}) => {
  const {data,requests}=await installSupplierApi(page);
  await openSuppliers(page);
  await page.locator('[data-action="new-supplier"]').click();

  await page.locator('#business-form [name="name"]').fill("Aromas del Norte");
  await page.locator('#business-form [name="contact"]').fill("María López");
  await page.locator('#business-form [name="phone"]').fill("82234395");
  await page.locator('#business-form [data-action="supplier-add-phone"]').click();
  await page.locator('#business-form input[name="additionalPhone"]').nth(0).fill("86174977");
  await page.locator('#business-form [data-action="supplier-add-phone"]').click();
  await page.locator('#business-form input[name="additionalPhone"]').nth(1).fill("78805409");
  await page.locator('#business-save').click();

  await expect.poll(()=>requests.length).toBe(1);
  expect(requests[0].payload.additional_phones).toEqual(["86174977","78805409"]);
  await expect(page.locator('.data-table')).toContainText("Aromas del Norte");
  expect(data.suppliers[0].additional_phones.map(item=>item.phone)).toEqual(["86174977","78805409"]);
});

test("supplier form caps additional phones at five and can remove an entry", async ({page}) => {
  await installSupplierApi(page);
  await openSuppliers(page);
  await page.locator('[data-action="new-supplier"]').click();

  for(let index=0;index<6;index+=1){
    await page.locator('#business-form [data-action="supplier-add-phone"]').click();
  }
  await expect(page.locator('#business-form input[name="additionalPhone"]')).toHaveCount(5);
  await page.locator('#business-form [data-action="supplier-remove-phone"]').nth(0).click();
  await expect(page.locator('#business-form input[name="additionalPhone"]')).toHaveCount(4);
});

test("editing a supplier loads existing additional phones for replacement", async ({page}) => {
  const initial=[{
    id:supplierId,name:"Aromas del Norte",contact:"María López",phone:"+50582234395",
    email:"ventas@example.test",currency:"USD",active:true,notes:"",
    additional_phones:[{phone:"+50586174977",display_order:1}]
  }];
  const {requests}=await installSupplierApi(page,initial);
  await openSuppliers(page);
  await page.locator('[data-action="edit-supplier"]').click();
  await expect(page.locator('#business-form input[name="additionalPhone"]')).toHaveCount(1);
  await expect(page.locator('#business-form input[name="additionalPhone"]').first()).toHaveValue("+50586174977");
  await page.locator('#business-form [data-action="supplier-add-phone"]').click();
  await page.locator('#business-form input[name="additionalPhone"]').nth(1).fill("78805409");
  await page.locator('#business-save').click();
  await expect.poll(()=>requests.length).toBe(1);
  expect(requests[0].method).toBe("PATCH");
  expect(requests[0].payload.additional_phones).toEqual(["+50586174977","78805409"]);
});
